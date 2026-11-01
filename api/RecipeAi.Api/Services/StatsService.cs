using Microsoft.EntityFrameworkCore;
using RecipeAi.Api.Data;
using RecipeAi.Api.Dtos;

namespace RecipeAi.Api.Services;

public class StatsService
{
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
}
