using System.Text.Json;

namespace RecipeAi.Api.Ai;

// Deterministic "AI" with no network: simple word matching that returns the same JSON shapes as the LLM.
// Used when no API key is configured, for demos without internet, and in unit tests.
public class OfflineAiProvider : IAiProvider
{
    private static readonly HashSet<string> Staples = new(StringComparer.OrdinalIgnoreCase)
    {
        "salt", "pepper", "water", "oil", "olive oil", "black pepper",
    };

    public string Name => "Offline (keyword matching)";

    public Task<string> NormalizeIngredientsAsync(IReadOnlyList<string> ingredients, CancellationToken cancellationToken)
    {
        var normalized = ingredients.Select(IngredientText.Normalize).Where(i => i.Length > 0).Distinct().ToList();
        return Task.FromResult(JsonSerializer.Serialize(new { ingredients = normalized }));
    }

    public Task<string> RankRecipesAsync(IReadOnlyList<string> userIngredients, IReadOnlyList<CandidateRecipe> candidates, CancellationToken cancellationToken)
    {
        var results = candidates.Select(c =>
        {
            var recipeIngredients = IngredientText.Split(c.Ingredients).Where(i => !Staples.Contains(i)).ToList();
            var matched = recipeIngredients.Where(r => userIngredients.Any(u => IngredientText.Matches(u, r))).ToList();
            var missing = recipeIngredients.Except(matched).ToList();
            var extra = userIngredients.Where(u => !recipeIngredients.Any(r => IngredientText.Matches(u, r))).ToList();
            var score = recipeIngredients.Count == 0 ? 0 : (int)Math.Round(100.0 * matched.Count / recipeIngredients.Count);

            return new
            {
                id = c.Id,
                score,
                matched,
                missing,
                extra,
                reason = $"You have {matched.Count} of the {recipeIngredients.Count} main ingredients.",
            };
        });

        return Task.FromResult(JsonSerializer.Serialize(new { recipes = results }));
    }

    public Task<string> GenerateIdeasAsync(IReadOnlyList<string> userIngredients, CancellationToken cancellationToken)
    {
        var main = string.Join(", ", userIngredients.Take(4));
        var ideas = new[]
        {
            new { name = $"Quick {userIngredients.FirstOrDefault() ?? "pantry"} stir-fry", description = $"A fast pan dish with {main}.", ingredients = userIngredients, steps = "Chop everything, stir-fry on high heat for 8 minutes, season and serve." },
            new { name = "Oven-baked medley", description = $"Roast {main} together until golden.", ingredients = userIngredients, steps = "Cut into pieces, add oil and spices, bake 25 minutes at 200°C." },
            new { name = "Simple soup", description = $"A warm soup built on {main}.", ingredients = userIngredients, steps = "Sweat the vegetables, cover with stock, simmer 20 minutes, blend if you like." },
        };

        return Task.FromResult(JsonSerializer.Serialize(new { ideas }));
    }
}
