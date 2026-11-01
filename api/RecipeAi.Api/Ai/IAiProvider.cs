namespace RecipeAi.Api.Ai;

// What the suggestion pipeline needs from "an AI". Each method returns the model's RAW JSON text.
// We never trust it directly: AiResponseValidator parses and checks every answer, whatever the provider.
// Implementations: GroqAiProvider (real LLM) and OfflineAiProvider (deterministic, no network).
public interface IAiProvider
{
    string Name { get; }

    Task<string> NormalizeIngredientsAsync(IReadOnlyList<string> ingredients, CancellationToken cancellationToken);

    Task<string> RankRecipesAsync(
        IReadOnlyList<string> userIngredients,
        IReadOnlyList<CandidateRecipe> candidates,
        CancellationToken cancellationToken);

    Task<string> GenerateIdeasAsync(IReadOnlyList<string> userIngredients, CancellationToken cancellationToken);
}

// The minimum we send to the AI about each recipe from our database.
public record CandidateRecipe(int Id, string Name, string Ingredients);
