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

    // ---------- Reading ----------

    public async Task<RecipeReviewsDto> GetForRecipeAsync(int recipeId, string? viewerId, bool isAdmin, ReviewSort sort)
    {
        await EnsureRecipeVisibleAsync(recipeId, viewerId, isAdmin);

        // Summary: one GROUP BY Rating query, then the 5..1 distribution is built in memory.
        var counts = await _db.Reviews
            .Where(r => r.RecipeId == recipeId && !r.IsHidden)
            .GroupBy(r => r.Rating)
            .Select(g => new { Rating = g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.Rating, x => x.Count);
        var total = counts.Values.Sum();
        var average = total == 0 ? 0 : Math.Round(counts.Sum(c => c.Key * c.Value) / (double)total, 1);
        var distribution = Enumerable.Range(1, 5).Reverse().Select(star => counts.GetValueOrDefault(star)).ToList();

        var query = _db.Reviews.AsNoTracking().Where(r => r.RecipeId == recipeId && (isAdmin || !r.IsHidden));
        query = sort switch
        {
            ReviewSort.Helpful => query.OrderByDescending(r => r.Votes.Count).ThenByDescending(r => r.CreatedOn),
            ReviewSort.Highest => query.OrderByDescending(r => r.Rating).ThenByDescending(r => r.CreatedOn),
            ReviewSort.Lowest => query.OrderBy(r => r.Rating).ThenByDescending(r => r.CreatedOn),
            _ => query.OrderByDescending(r => r.CreatedOn),
        };

        // One query that also loads each review's replies (EF Core builds the JOIN).
        var reviews = await query
            .Select(r => new ReviewDto(
                r.Id,
                r.Title,
                r.Rating,
                r.Comment,
                r.UserId,
                r.User.FullName,
                r.CreatedOn,
                r.ModifiedOn,
                r.IsHidden,
                r.Votes.Count,
                viewerId != null && r.Votes.Any(v => v.UserId == viewerId),
                r.Replies
                    .Where(p => isAdmin || !p.IsHidden)
                    .OrderBy(p => p.CreatedOn)
                    .Select(p => new ReplyDto(p.Id, p.ParentId, p.Content, p.UserId, p.User.FullName,
                        p.UserId == r.Recipe.AuthorId, p.CreatedOn, p.IsHidden))
                    .ToList()))
            .ToListAsync();

        return new RecipeReviewsDto(new RatingSummaryDto(average, total, distribution), reviews);
    }

    // ---------- Reviews ----------

    public async Task<int> CreateAsync(int recipeId, SaveReviewDto dto, string userId)
    {
        var recipe = await EnsureRecipeVisibleAsync(recipeId, userId, isAdmin: false);

        if (recipe.AuthorId == userId)
        {
            throw new BadRequestException("You cannot review your own recipe.");
        }

        if (await _db.Reviews.AnyAsync(r => r.RecipeId == recipeId && r.UserId == userId))
        {
            throw new ConflictException("You already reviewed this recipe. You can edit your review instead.");
        }

        var review = new Review
        {
            RecipeId = recipeId,
            UserId = userId,
            Title = dto.Title.Trim(),
            Rating = dto.Rating,
            Comment = dto.Comment.Trim(),
        };
        _db.Reviews.Add(review);

        var reviewer = await UserNameAsync(userId);
        _notifications.Add(recipe.AuthorId, $"{reviewer} rated your recipe \"{recipe.Name}\" {dto.Rating}/5: “{review.Title}”.", $"/recipes/{recipeId}");

        try
        {
            await _db.SaveChangesAsync(); // review + notification saved together (one transaction)
        }
        catch (DbUpdateException)
        {
            // Two simultaneous requests can both pass the AnyAsync check: the unique index catches the second one.
            throw new ConflictException("You already reviewed this recipe.");
        }

        return review.Id;
    }

    public async Task UpdateAsync(int reviewId, SaveReviewDto dto, string userId)
    {
        var review = await _db.Reviews.FindAsync(reviewId) ?? throw new NotFoundException("Review not found.");
        if (review.UserId != userId)
        {
            throw new ForbiddenException("You can only edit your own review.");
        }

        review.Title = dto.Title.Trim();
        review.Rating = dto.Rating;
        review.Comment = dto.Comment.Trim();
        await _db.SaveChangesAsync(); // ModifiedOn is set by AppDbContext -> the UI shows "edited"
    }

    public async Task DeleteAsync(int reviewId, string userId, bool isAdmin)
    {
        var review = await _db.Reviews.FindAsync(reviewId) ?? throw new NotFoundException("Review not found.");
        if (!isAdmin && review.UserId != userId)
        {
            throw new ForbiddenException("You can only delete your own review.");
        }

        _db.Reviews.Remove(review); // replies and votes are removed by cascade
        await _db.SaveChangesAsync();
    }

    public async Task SetHiddenAsync(int reviewId, bool hidden)
    {
        var review = await _db.Reviews.FindAsync(reviewId) ?? throw new NotFoundException("Review not found.");
        review.IsHidden = hidden;
        await _db.SaveChangesAsync();
    }

    // ---------- Helpful votes ----------

    // Toggle: the first call adds the vote, the second removes it.
    public async Task<HelpfulDto> ToggleHelpfulAsync(int reviewId, string userId)
    {
        var review = await _db.Reviews.AsNoTracking().FirstOrDefaultAsync(r => r.Id == reviewId && !r.IsHidden)
            ?? throw new NotFoundException("Review not found.");
        if (review.UserId == userId)
        {
            throw new BadRequestException("You cannot vote for your own review.");
        }

        var vote = await _db.ReviewVotes.FirstOrDefaultAsync(v => v.ReviewId == reviewId && v.UserId == userId);
        if (vote is null)
        {
            _db.ReviewVotes.Add(new ReviewVote { ReviewId = reviewId, UserId = userId });
        }
        else
        {
            _db.ReviewVotes.Remove(vote);
        }

        try
        {
            await _db.SaveChangesAsync();
        }
        catch (DbUpdateException)
        {
            // Double click: the unique index already holds this vote.
        }

        var count = await _db.ReviewVotes.CountAsync(v => v.ReviewId == reviewId);
        return new HelpfulDto(count, vote is null);
    }

    // ---------- Replies (the discussion under a review) ----------

    public async Task<ReplyDto> AddReplyAsync(int reviewId, SaveReplyDto dto, string userId)
    {
        var review = await _db.Reviews
            .Include(r => r.Recipe)
            .FirstOrDefaultAsync(r => r.Id == reviewId && !r.IsHidden && !r.Recipe.IsHidden)
            ?? throw new NotFoundException("Review not found.");

        int? parentId = null;
        string? parentAuthorId = null;
        if (dto.ParentId is not null)
        {
            var parent = await _db.ReviewReplies.AsNoTracking().FirstOrDefaultAsync(p => p.Id == dto.ParentId && p.ReviewId == reviewId)
                ?? throw new BadRequestException("The reply you are answering does not exist.");

            // Keep threads two levels deep: answering a nested reply attaches to its top-level reply.
            parentId = parent.ParentId ?? parent.Id;
            parentAuthorId = parent.UserId;
        }

        var reply = new ReviewReply { ReviewId = reviewId, ParentId = parentId, UserId = userId, Content = dto.Content.Trim() };
        _db.ReviewReplies.Add(reply);

        var name = await UserNameAsync(userId);
        var link = $"/recipes/{review.RecipeId}";
        if (review.UserId != userId)
        {
            _notifications.Add(review.UserId, $"{name} replied to your review “{review.Title}”.", link);
        }

        if (parentAuthorId is not null && parentAuthorId != userId && parentAuthorId != review.UserId)
        {
            _notifications.Add(parentAuthorId, $"{name} answered your reply on “{review.Title}”.", link);
        }

        await _db.SaveChangesAsync();

        return new ReplyDto(reply.Id, reply.ParentId, reply.Content, userId, name,
            userId == review.Recipe.AuthorId, reply.CreatedOn, false);
    }

    public async Task DeleteReplyAsync(int replyId, string userId, bool isAdmin)
    {
        var reply = await _db.ReviewReplies.FindAsync(replyId) ?? throw new NotFoundException("Reply not found.");
        if (!isAdmin && reply.UserId != userId)
        {
            throw new ForbiddenException("You can only delete your own reply.");
        }

        // The parent link is NoAction (no cascade on a self-reference), so remove the answers first.
        var children = await _db.ReviewReplies.Where(p => p.ParentId == replyId).ToListAsync();
        _db.ReviewReplies.RemoveRange(children);
        _db.ReviewReplies.Remove(reply);
        await _db.SaveChangesAsync();
    }

    public async Task SetReplyHiddenAsync(int replyId, bool hidden)
    {
        var reply = await _db.ReviewReplies.FindAsync(replyId) ?? throw new NotFoundException("Reply not found.");
        reply.IsHidden = hidden;
        await _db.SaveChangesAsync();
    }

    // ---------- Helpers ----------

    private Task<string> UserNameAsync(string userId) =>
        _db.Users.Where(u => u.Id == userId).Select(u => u.FullName).FirstAsync();

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
