using Microsoft.EntityFrameworkCore;
using RecipeAi.Api.Data;
using RecipeAi.Api.Dtos;

namespace RecipeAi.Api.Services;

public class StatsService
{
    public const int ChartDays = 14;
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
        var trends = new List<TrendDto>
        {
            await TrendAsync("Members", _db.Users.Select(u => u.CreatedOn)),
            await TrendAsync("Recipes", _db.Recipes.Select(r => r.CreatedOn)),
            await TrendAsync("Reviews", _db.Reviews.Select(r => r.CreatedOn)),
            await TrendAsync("Replies", _db.ReviewReplies.Select(r => r.CreatedOn)),
        };

        var weekAgo = DateTime.UtcNow.AddDays(-7);
        var now = DateTimeOffset.UtcNow;
        var moderation = new ModerationCountsDto(
            await _db.Recipes.CountAsync(r => r.IsHidden),
            await _db.Reviews.CountAsync(r => r.IsHidden),
            await _db.ReviewReplies.CountAsync(r => r.IsHidden),
            await _db.Reviews.CountAsync(r => !r.IsHidden && r.Rating <= 2 && r.CreatedOn >= weekAgo),
            await _db.Users.CountAsync(u => u.LockoutEnd != null && u.LockoutEnd > now));

        var perCategory = await _db.Categories
            .OrderByDescending(c => c.Recipes.Count)
            .ThenBy(c => c.Name)
            .Select(c => new CountItemDto(c.Name, c.Recipes.Count))
            .ToListAsync();

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
            trends,
            await _db.Favorites.CountAsync(),
            moderation,
            perCategory,
            await PerDayAsync(_db.Reviews.Select(r => r.CreatedOn), ChartDays),
            await PerDayAsync(_db.Users.Select(u => u.CreatedOn), ChartDays),
            top,
            await GetAiUsageAsync(AiDays),
            await GetRecentActivityAsync());
    }

    // The AI monitor page: totals, success/failure per day and the latest calls.
    public async Task<AiMonitorDto> GetAiMonitorAsync(int days)
    {
        days = Math.Clamp(days, 1, 90);
        var from = DateTime.UtcNow.Date.AddDays(-(days - 1));

        var counts = await _db.AiCallLogs
            .Where(l => l.CreatedOn >= from)
            .GroupBy(l => new { l.CreatedOn.Date, l.Success })
            .Select(g => new { g.Key.Date, g.Key.Success, Count = g.Count() })
            .ToListAsync();
        var perDay = Enumerable.Range(0, days)
            .Select(i => from.AddDays(i))
            .Select(d => new AiDayDto(
                DateOnly.FromDateTime(d),
                counts.Where(c => c.Date == d && c.Success).Sum(c => c.Count),
                counts.Where(c => c.Date == d && !c.Success).Sum(c => c.Count)))
            .ToList();

        var recent = await _db.AiCallLogs
            .OrderByDescending(l => l.CreatedOn)
            .Take(25)
            .Select(l => new AiCallDto(l.Id, l.CreatedOn, l.Step, l.Provider, l.DurationMs, l.Success))
            .ToListAsync();

        return new AiMonitorDto(days, await GetAiUsageAsync(days), perDay, recent);
    }

    private async Task<AiUsageDto> GetAiUsageAsync(int days)
    {
        var since = DateTime.UtcNow.AddDays(-days);
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

    // Total, last 7 days and the 7 days before: three COUNTs on one date column.
    private static async Task<TrendDto> TrendAsync(string label, IQueryable<DateTime> dates)
    {
        var now = DateTime.UtcNow;
        return new TrendDto(
            label,
            await dates.CountAsync(),
            await dates.CountAsync(d => d >= now.AddDays(-7)),
            await dates.CountAsync(d => d >= now.AddDays(-14) && d < now.AddDays(-7)));
    }

    // GROUP BY day, then fill the days without rows with 0 so the chart has no gaps.
    private static async Task<List<DailyCountDto>> PerDayAsync(IQueryable<DateTime> dates, int days)
    {
        var from = DateTime.UtcNow.Date.AddDays(-(days - 1));
        var counts = await dates
            .Where(d => d >= from)
            .GroupBy(d => d.Date)
            .Select(g => new { Day = g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.Day, x => x.Count);

        return Enumerable.Range(0, days)
            .Select(i => from.AddDays(i))
            .Select(d => new DailyCountDto(DateOnly.FromDateTime(d), counts.GetValueOrDefault(d)))
            .ToList();
    }

    // The latest few users, recipes and reviews, merged into one timeline.
    private async Task<List<ActivityDto>> GetRecentActivityAsync()
    {
        var users = await _db.Users
            .OrderByDescending(u => u.CreatedOn).Take(6)
            .Select(u => new ActivityDto("user", u.FullName + " joined", "/admin/users", u.CreatedOn))
            .ToListAsync();
        var recipes = await _db.Recipes
            .OrderByDescending(r => r.CreatedOn).Take(6)
            .Select(r => new ActivityDto("recipe", r.Author.FullName + " published “" + r.Name + "”", "/recipes/" + r.Id, r.CreatedOn))
            .ToListAsync();
        var reviews = await _db.Reviews
            .OrderByDescending(r => r.CreatedOn).Take(6)
            .Select(r => new ActivityDto("review", r.User.FullName + " rated “" + r.Recipe.Name + "” " + r.Rating + "★", "/admin/reviews", r.CreatedOn))
            .ToListAsync();

        return users.Concat(recipes).Concat(reviews).OrderByDescending(a => a.CreatedOn).Take(8).ToList();
    }
}
