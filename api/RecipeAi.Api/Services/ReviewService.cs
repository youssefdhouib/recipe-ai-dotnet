using Microsoft.EntityFrameworkCore;
using RecipeAi.Api.Data;
using RecipeAi.Api.Dtos;
using RecipeAi.Api.Errors;
using RecipeAi.Api.Models;

namespace RecipeAi.Api.Services;

public class ReviewService
{
    private readonly AppDbContext _db;
    private readonly NotificationService _notifications;

    public ReviewService(AppDbContext db, NotificationService notifications)
    {
        _db = db;
        _notifications = notifications;
    }

    public async Task<IReadOnlyList<ReviewDto>> GetForRecipeAsync(int recipeId, bool isAdmin)
    {
        await EnsureRecipeVisibleAsync(recipeId, viewerId: null, isAdmin);

        return await _db.Reviews
            .AsNoTracking()
            .Where(r => r.RecipeId == recipeId && (isAdmin || !r.IsHidden))
            .OrderByDescending(r => r.CreatedOn)
            .Select(r => new ReviewDto(r.Id, r.Rating, r.Comment, r.UserId, r.User.FullName, r.CreatedOn, r.IsHidden))
            .ToListAsync();
    }

    public async Task<ReviewDto> CreateAsync(int recipeId, SaveReviewDto dto, string userId)
    {
        var recipe = await EnsureRecipeVisibleAsync(recipeId, userId, isAdmin: false);

        if (recipe.AuthorId == userId)
        {
            throw new BadRequestException("You cannot review your own recipe.");
        }

        if (await _db.Reviews.AnyAsync(r => r.RecipeId == recipeId && r.UserId == userId))
        {
            throw new ConflictException("You already reviewed this recipe.");
        }

        var review = new Review { RecipeId = recipeId, UserId = userId, Rating = dto.Rating, Comment = dto.Comment.Trim() };
        _db.Reviews.Add(review);

        var reviewer = await _db.Users.Where(u => u.Id == userId).Select(u => u.FullName).FirstAsync();
        _notifications.Add(recipe.AuthorId, $"{reviewer} rated your recipe \"{recipe.Name}\" {dto.Rating}/5.", $"/recipes/{recipeId}");

        try
        {
            await _db.SaveChangesAsync(); // review + notification saved together (one transaction)
        }
        catch (DbUpdateException)
        {
            // Two simultaneous requests can both pass the AnyAsync check: the unique index catches the second one.
            throw new ConflictException("You already reviewed this recipe.");
        }

        return new ReviewDto(review.Id, review.Rating, review.Comment, userId, reviewer, review.CreatedOn, false);
    }

    public async Task SetHiddenAsync(int reviewId, bool hidden)
    {
        var review = await _db.Reviews.FindAsync(reviewId) ?? throw new NotFoundException("Review not found.");
        review.IsHidden = hidden;
        await _db.SaveChangesAsync();
    }

    private async Task<Recipe> EnsureRecipeVisibleAsync(int recipeId, string? viewerId, bool isAdmin)
    {
        var recipe = await _db.Recipes.AsNoTracking().FirstOrDefaultAsync(r => r.Id == recipeId);
        if (recipe is null || (recipe.IsHidden && !isAdmin && recipe.AuthorId != viewerId))
        {
            throw new NotFoundException("Recipe not found.");
        }

        return recipe;
    }
}
