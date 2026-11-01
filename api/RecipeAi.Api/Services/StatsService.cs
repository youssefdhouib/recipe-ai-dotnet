using Microsoft.EntityFrameworkCore;
using RecipeAi.Api.Data;
using RecipeAi.Api.Dtos;

namespace RecipeAi.Api.Services;

public class StatsService
{
    public const int ReviewDays = 14;
    public const int AiDays = 7;

    private readonly AppDbContext _db;

    public StatsService(AppDbContext db)
    {
        _db = db;
    }

    // Four COUNT queries; only visible content is counted.
    public async Task<PublicStatsDto> GetPublicAsync() => new(
        await _db.Recipes.CountAsync(r => !r.IsHidden),
        await _db.Reviews.CountAsync(r => !r.IsHidden),
        await _db.Users.CountAsync(),
        await _db.Categories.CountAsync());

    // Every aggregation (COUNT, AVG, GROUP BY) runs in SQL Server; only small result sets come back.
    public async Task<AdminStatsDto> GetAdminAsync()
    {
        var perCategory = await _db.Categories
            .OrderByDescending(c => c.Recipes.Count)
            .ThenBy(c => c.Name)
            .Select(c => new CountItemDto(c.Name, c.Recipes.Count))
            .ToListAsync();

        // GROUP BY day, then fill the days without reviews with 0 so the chart has no gaps.
        var today = DateTime.UtcNow.Date;
        var from = today.AddDays(-(ReviewDays - 1));
        var counts = await _db.Reviews
            .Where(r => r.CreatedOn >= from)
            .GroupBy(r => r.CreatedOn.Date)
            .Select(g => new { Day = g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.Day, x => x.Count);
        var perDay = Enumerable.Range(0, ReviewDays)
            .Select(i => from.AddDays(i))
            .Select(d => new DailyCountDto(DateOnly.FromDateTime(d), counts.GetValueOrDefault(d)))
            .ToList();

        // Sort on the entity BEFORE projecting: EF Core cannot translate an ORDER BY on a DTO's property.
        var top = await _db.Recipes
            .Where(r => r.Reviews.Any(v => !v.IsHidden))
            .OrderByDescending(r => r.Reviews.Where(v => !v.IsHidden).Average(v => (double)v.Rating))
            .ThenByDescending(r => r.Reviews.Count(v => !v.IsHidden))
            .Take(5)
            .Select(r => new TopRecipeDto(
                r.Id,
                r.Name,
                r.Reviews.Where(v => !v.IsHidden).Average(v => (double)v.Rating),
                r.Reviews.Count(v => !v.IsHidden)))
            .ToListAsync();

        return new AdminStatsDto(
            await _db.Users.CountAsync(),
            await _db.Recipes.CountAsync(),
            await _db.Recipes.CountAsync(r => r.IsHidden),
            await _db.Reviews.CountAsync(),
            await _db.Favorites.CountAsync(),
            perCategory,
            perDay,
            top,
            await GetAiUsageAsync());
    }

    private async Task<AiUsageDto> GetAiUsageAsync()
    {
        var since = DateTime.UtcNow.AddDays(-AiDays);
        var logs = _db.AiCallLogs.Where(l => l.CreatedOn >= since);

        var calls = await logs.CountAsync();
        if (calls == 0)
        {
            return new AiUsageDto(0, 0, 0, 0, Array.Empty<AiStepLatencyDto>());
        }

        var failed = await logs.CountAsync(l => !l.Success);
        var averageMs = (int)Math.Round(await logs.Where(l => l.Success).Select(l => (double?)l.DurationMs).AverageAsync() ?? 0);
        var steps = await logs
            .Where(l => l.Success)
            .GroupBy(l => l.Step)
            .Select(g => new AiStepLatencyDto(g.Key, (int)g.Average(l => l.DurationMs), g.Count()))
            .ToListAsync();

        // Pipeline order, not alphabetical: normalize -> rank -> ideas.
        var order = new[] { "normalize", "rank", "ideas" };
        steps = steps.OrderBy(s => Array.IndexOf(order, s.Step)).ToList();

        return new AiUsageDto(calls, failed, Math.Round(100.0 * (calls - failed) / calls, 1), averageMs, steps);
    }
}
