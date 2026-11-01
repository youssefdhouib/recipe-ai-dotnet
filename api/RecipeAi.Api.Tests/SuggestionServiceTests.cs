using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using RecipeAi.Api.Ai;
using RecipeAi.Api.Data;
using RecipeAi.Api.Dtos;
using RecipeAi.Api.Models;

namespace RecipeAi.Api.Tests;

// Tests the whole pipeline with an in-memory database and fake AI providers (no network, no SQL Server).
public class SuggestionServiceTests
{
    [Fact]
    public async Task Uses_the_ai_ranking_and_takes_names_from_the_database()
    {
        await using var db = CreateDb(out var pastaId, out _);
        var ai = new ScriptedProvider(
            normalize: """{"ingredients":["tomato","garlic"]}""",
            rank: $$"""{"recipes":[{"id":{{pastaId}},"score":90,"reason":"Great match","matched":["tomato","garlic","spaghetti"],"missing":["olive oil"]},{"id":424242,"score":99}]}""");

        var result = await CreateService(db, ai).SuggestAsync(new SuggestionRequestDto(new() { "Tomatoes", "garlic" }, null, null));

        Assert.True(result.AiAvailable);
        Assert.Single(result.Recipes); // the hallucinated id 424242 is gone
        Assert.Equal("Tomato Pasta", result.Recipes[0].Name); // name from OUR database
        Assert.Equal(75, result.Recipes[0].Score); // 3 matched / 4 listed, computed by us (not the model's 90)
        Assert.Empty(result.Ideas); // a good match exists, no need for AI ideas
    }

    [Fact]
    public async Task Recipes_the_ai_forgot_are_still_scored_by_keywords()
    {
        await using var db = CreateDb(out var pastaId, out _);
        // The model only returns the soup and "forgets" the pasta, which is the best match.
        var soupId = db.Recipes.Single(r => r.Name == "Lentil Soup").Id;
        var ai = new ScriptedProvider(
            normalize: """{"ingredients":["spaghetti","tomato","garlic"]}""",
            rank: $$"""{"recipes":[{"id":{{soupId}},"score":5}]}""");

        var result = await CreateService(db, ai).SuggestAsync(new SuggestionRequestDto(new() { "spaghetti", "tomato", "garlic" }, null, null));

        Assert.True(result.AiAvailable);
        Assert.Equal(pastaId, result.Recipes[0].Id);
        Assert.Equal("Scored by keyword matching.", result.Recipes[0].Reason);
    }

    [Fact]
    public async Task Falls_back_to_keyword_matching_when_the_ai_fails()
    {
        await using var db = CreateDb(out var pastaId, out _);

        var result = await CreateService(db, new FailingProvider())
            .SuggestAsync(new SuggestionRequestDto(new() { "tomato", "spaghetti" }, null, null));

        Assert.False(result.AiAvailable);
        Assert.Equal(pastaId, result.Recipes[0].Id);
        Assert.Contains(result.Messages, m => m.Contains("unavailable"));
    }

    [Fact]
    public async Task Asks_the_ai_for_ideas_when_the_best_match_is_weak()
    {
        await using var db = CreateDb(out var pastaId, out _);
        var ai = new ScriptedProvider(
            normalize: """{"ingredients":["banana"]}""",
            rank: $$"""{"recipes":[{"id":{{pastaId}},"score":5}]}""",
            ideas: """{"ideas":[{"name":"Banana pancakes","description":"Easy","ingredients":["banana","egg"],"steps":"Mix and cook."}]}""");

        var result = await CreateService(db, ai).SuggestAsync(new SuggestionRequestDto(new() { "banana" }, null, null));

        Assert.Single(result.Ideas);
        Assert.Equal("Banana pancakes", result.Ideas[0].Name);
    }

    [Fact]
    public async Task Never_suggests_hidden_recipes()
    {
        await using var db = CreateDb(out _, out var hiddenId);

        var result = await CreateService(db, new OfflineAiProvider())
            .SuggestAsync(new SuggestionRequestDto(new() { "chocolate", "flour" }, null, null));

        Assert.DoesNotContain(result.Recipes, r => r.Id == hiddenId);
    }

    [Fact]
    public async Task Offline_provider_ranks_recipes_without_network()
    {
        await using var db = CreateDb(out var pastaId, out _);

        var result = await CreateService(db, new OfflineAiProvider())
            .SuggestAsync(new SuggestionRequestDto(new() { "200g spaghetti", "2 tomatoes", "garlic" }, null, null));

        Assert.True(result.AiAvailable);
        Assert.Equal(pastaId, result.Recipes[0].Id);
        Assert.True(result.Recipes[0].Score >= 75);
    }

    private static SuggestionService CreateService(AppDbContext db, IAiProvider ai) =>
        new(db, ai, NullLogger<SuggestionService>.Instance);

    private static AppDbContext CreateDb(out int pastaId, out int hiddenId)
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        var db = new AppDbContext(options);

        var author = new AppUser { Id = "u1", UserName = "a@test", Email = "a@test", FullName = "Author" };
        var category = new Category { Name = "Pasta" };
        var pasta = new Recipe
        {
            Name = "Tomato Pasta", Ingredients = "spaghetti, tomatoes, garlic, olive oil", Author = author, Category = category,
        };
        var soup = new Recipe
        {
            Name = "Lentil Soup", Ingredients = "red lentils, onion, cumin", Author = author, Category = category,
        };
        var hidden = new Recipe
        {
            Name = "Secret Cake", Ingredients = "chocolate, flour, sugar", Author = author, Category = category, IsHidden = true,
        };

        db.AddRange(author, category, pasta, soup, hidden);
        db.SaveChanges();

        pastaId = pasta.Id;
        hiddenId = hidden.Id;
        return db;
    }

    private sealed class ScriptedProvider(string normalize, string rank, string ideas = """{"ideas":[]}""") : IAiProvider
    {
        public string Name => "Scripted";

        public Task<string> NormalizeIngredientsAsync(IReadOnlyList<string> ingredients, CancellationToken cancellationToken) => Task.FromResult(normalize);

        public Task<string> RankRecipesAsync(IReadOnlyList<string> userIngredients, IReadOnlyList<CandidateRecipe> candidates, CancellationToken cancellationToken) => Task.FromResult(rank);

        public Task<string> GenerateIdeasAsync(IReadOnlyList<string> userIngredients, CancellationToken cancellationToken) => Task.FromResult(ideas);
    }

    private sealed class FailingProvider : IAiProvider
    {
        public string Name => "Failing";

        public Task<string> NormalizeIngredientsAsync(IReadOnlyList<string> ingredients, CancellationToken cancellationToken) => throw new HttpRequestException("503");

        public Task<string> RankRecipesAsync(IReadOnlyList<string> userIngredients, IReadOnlyList<CandidateRecipe> candidates, CancellationToken cancellationToken) => throw new HttpRequestException("503");

        public Task<string> GenerateIdeasAsync(IReadOnlyList<string> userIngredients, CancellationToken cancellationToken) => throw new HttpRequestException("503");
    }
}
