using Microsoft.EntityFrameworkCore;
using RecipeAi.Api.Data;
using RecipeAi.Api.Dtos;
using RecipeAi.Api.Errors;
using RecipeAi.Api.Models;
using RecipeAi.Api.Services;

namespace RecipeAi.Api.Tests;

// Business rules of the review system, on an in-memory database.
public class ReviewServiceTests
{
    [Fact]
    public async Task Summary_counts_ratings_from_five_to_one_star()
    {
        await using var db = CreateDb(out var recipeId);
        var service = CreateService(db);
        await service.CreateAsync(recipeId, new SaveReviewDto("Great", 5, ""), "bob");
        await service.CreateAsync(recipeId, new SaveReviewDto("Okay", 3, ""), "eve");

        var result = await service.GetForRecipeAsync(recipeId, null, false, ReviewSort.Newest);

        Assert.Equal(2, result.Summary.Count);
        Assert.Equal(4.0, result.Summary.Average);
        Assert.Equal(new[] { 1, 0, 1, 0, 0 }, result.Summary.Distribution);
    }

    [Fact]
    public async Task Cannot_review_own_recipe_or_review_twice()
    {
        await using var db = CreateDb(out var recipeId);
        var service = CreateService(db);

        await Assert.ThrowsAsync<BadRequestException>(() => service.CreateAsync(recipeId, new SaveReviewDto("Mine", 5, ""), "chef"));

        await service.CreateAsync(recipeId, new SaveReviewDto("Nice", 4, ""), "bob");
        await Assert.ThrowsAsync<ConflictException>(() => service.CreateAsync(recipeId, new SaveReviewDto("Again", 5, ""), "bob"));
    }

    [Fact]
    public async Task Only_the_author_can_edit_and_admin_can_delete()
    {
        await using var db = CreateDb(out var recipeId);
        var service = CreateService(db);
        var id = await service.CreateAsync(recipeId, new SaveReviewDto("Nice", 4, ""), "bob");

        await Assert.ThrowsAsync<ForbiddenException>(() => service.UpdateAsync(id, new SaveReviewDto("Hacked", 1, ""), "eve"));
        await Assert.ThrowsAsync<ForbiddenException>(() => service.DeleteAsync(id, "eve", isAdmin: false));

        await service.UpdateAsync(id, new SaveReviewDto("Even nicer", 5, ""), "bob");
        var review = Assert.Single((await service.GetForRecipeAsync(recipeId, null, false, ReviewSort.Newest)).Reviews);
        Assert.Equal("Even nicer", review.Title);
        Assert.NotNull(review.ModifiedOn);

        await service.DeleteAsync(id, "admin", isAdmin: true);
        Assert.Empty((await service.GetForRecipeAsync(recipeId, null, false, ReviewSort.Newest)).Reviews);
    }

    [Fact]
    public async Task Helpful_vote_toggles_and_is_refused_on_own_review()
    {
        await using var db = CreateDb(out var recipeId);
        var service = CreateService(db);
        var id = await service.CreateAsync(recipeId, new SaveReviewDto("Nice", 4, ""), "bob");

        await Assert.ThrowsAsync<BadRequestException>(() => service.ToggleHelpfulAsync(id, "bob"));

        var first = await service.ToggleHelpfulAsync(id, "eve");
        Assert.Equal(new HelpfulDto(1, true), first);
        var second = await service.ToggleHelpfulAsync(id, "eve");
        Assert.Equal(new HelpfulDto(0, false), second);
    }

    [Fact]
    public async Task Replies_stay_two_levels_deep_and_notify_people()
    {
        await using var db = CreateDb(out var recipeId);
        var service = CreateService(db);
        var reviewId = await service.CreateAsync(recipeId, new SaveReviewDto("Nice", 4, ""), "bob");

        var chef = await service.AddReplyAsync(reviewId, new SaveReplyDto("Thanks!", null), "chef");
        var eve = await service.AddReplyAsync(reviewId, new SaveReplyDto("Agreed", chef.Id), "eve");
        var bob = await service.AddReplyAsync(reviewId, new SaveReplyDto("Same", eve.Id), "bob");

        Assert.True(chef.IsRecipeAuthor);
        Assert.Equal(chef.Id, eve.ParentId);
        Assert.Equal(chef.Id, bob.ParentId); // answering a nested reply attaches to the top-level one
        Assert.Contains(db.Notifications, n => n.UserId == "bob" && n.Text.Contains("replied to your review"));
        Assert.Contains(db.Notifications, n => n.UserId == "eve" && n.Text.Contains("answered your reply"));
    }

    [Fact]
    public async Task Hidden_replies_are_shown_to_admins_only()
    {
        await using var db = CreateDb(out var recipeId);
        var service = CreateService(db);
        var reviewId = await service.CreateAsync(recipeId, new SaveReviewDto("Nice", 4, ""), "bob");
        var reply = await service.AddReplyAsync(reviewId, new SaveReplyDto("Spam", null), "eve");

        await service.SetReplyHiddenAsync(reply.Id, true);

        var publicView = await service.GetForRecipeAsync(recipeId, null, false, ReviewSort.Newest);
        var adminView = await service.GetForRecipeAsync(recipeId, "admin", true, ReviewSort.Newest);
        Assert.Empty(publicView.Reviews[0].Replies);
        Assert.Single(adminView.Reviews[0].Replies);
    }

    private static ReviewService CreateService(AppDbContext db) => new(db, new NotificationService(db));

    private static AppDbContext CreateDb(out int recipeId)
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        var db = new AppDbContext(options);

        var users = new[] { "chef", "bob", "eve", "admin" }
            .Select(id => new AppUser { Id = id, UserName = id, Email = $"{id}@test", FullName = id.ToUpperInvariant() })
            .ToArray();
        var recipe = new Recipe { Name = "Shakshuka", Ingredients = "eggs, tomatoes", Author = users[0], Category = new Category { Name = "Breakfast" } };

        db.AddRange(users);
        db.Add(recipe);
        db.SaveChanges();

        recipeId = recipe.Id;
        return db;
    }
}
