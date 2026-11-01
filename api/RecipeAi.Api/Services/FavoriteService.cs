using Microsoft.EntityFrameworkCore;
using RecipeAi.Api.Data;
using RecipeAi.Api.Dtos;
using RecipeAi.Api.Errors;
using RecipeAi.Api.Models;

namespace RecipeAi.Api.Services;

public class FavoriteService
{
    private readonly AppDbContext _db;
    private readonly NotificationService _notifications;

    public FavoriteService(AppDbContext db, NotificationService notifications)
    {
        _db = db;
        _notifications = notifications;
    }

    public async Task<IReadOnlyList<RecipeListItemDto>> GetForUserAsync(string userId) =>
        await _db.Favorites
            .AsNoTracking()
            .Where(f => f.UserId == userId && (!f.Recipe.IsHidden || f.Recipe.AuthorId == userId))
            .OrderByDescending(f => f.CreatedOn)
            .Select(f => new RecipeListItemDto(
                f.Recipe.Id,
                f.Recipe.Name,
                f.Recipe.Description,
                f.Recipe.Category.Name,
                f.Recipe.Difficulty,
                f.Recipe.PrepMinutes,
                f.Recipe.CookMinutes,
                f.Recipe.ImagePath,
                f.Recipe.Reviews.Where(v => !v.IsHidden).Select(v => (double?)v.Rating).Average() ?? 0,
                f.Recipe.Reviews.Count(v => !v.IsHidden),
                f.Recipe.Author.FullName,
                f.Recipe.IsHidden))
            .ToListAsync();

    // Idempotent: adding an existing favorite is not an error, it just stays saved.
    public async Task AddAsync(int recipeId, string userId)
    {
        var recipe = await _db.Recipes.AsNoTracking().FirstOrDefaultAsync(r => r.Id == recipeId && (!r.IsHidden || r.AuthorId == userId))
            ?? throw new NotFoundException("Recipe not found.");

        if (await _db.Favorites.AnyAsync(f => f.RecipeId == recipeId && f.UserId == userId))
        {
            return;
        }

        _db.Favorites.Add(new Favorite { RecipeId = recipeId, UserId = userId });

        if (recipe.AuthorId != userId)
        {
            var name = await _db.Users.Where(u => u.Id == userId).Select(u => u.FullName).FirstAsync();
            _notifications.Add(recipe.AuthorId, $"{name} saved your recipe \"{recipe.Name}\" to favorites.", $"/recipes/{recipeId}");
        }

        try
        {
            await _db.SaveChangesAsync();
        }
        catch (DbUpdateException)
        {
            // Concurrent double click: the unique index already holds this favorite. Nothing to do.
        }
    }

    public async Task RemoveAsync(int recipeId, string userId)
    {
        var favorite = await _db.Favorites.FirstOrDefaultAsync(f => f.RecipeId == recipeId && f.UserId == userId);
        if (favorite is not null)
        {
            _db.Favorites.Remove(favorite);
            await _db.SaveChangesAsync();
        }
    }
}
