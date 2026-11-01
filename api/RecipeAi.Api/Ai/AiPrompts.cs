using System.Text;
using System.Text.Json;

namespace RecipeAi.Api.Ai;

// All prompts in one place: easy to review, version and improve without touching the pipeline.
public static class AiPrompts
{
    public const string System =
        "You are a precise culinary assistant inside a recipe application. " +
        "Always answer with ONE valid JSON object and nothing else: no markdown, no code fences, no comments.";

    public static string Normalize(IReadOnlyList<string> ingredients) =>
        $$"""
        Normalize this ingredient list. Return lowercase, singular, clean ingredient names:
        remove quantities, units and descriptors (fresh, chopped, minced...), fix typos,
        translate French or Arabic names to English.

        Ingredients:
        {{string.Join("\n", ingredients.Select(i => "- " + i))}}

        Answer format:
        {"ingredients": ["tomato", "onion", "chicken"]}
        """;

    public static string Rank(IReadOnlyList<string> userIngredients, IReadOnlyList<CandidateRecipe> candidates)
    {
        var list = new StringBuilder();
        foreach (var c in candidates)
        {
            list.AppendLine($"- id: {c.Id} | name: {c.Name} | ingredients: {c.Ingredients}");
        }

        return $$"""
        The user has these ingredients: {{JsonSerializer.Serialize(userIngredients)}}

        Candidate recipes from our database:
        {{list}}
        For EACH candidate recipe:
        1. Normalize its ingredients (lowercase, singular, no quantities).
        2. Compare them with the user's ingredients. Ignore salt, pepper, water and oil.
        3. Give a score from 0 to 100 (100 = the user has everything).
        4. List matched, missing and extra ingredients.
        5. Write one short sentence explaining the score.

        Only use the ids listed above. Answer format:
        {"recipes": [{"id": 12, "score": 85, "matched": ["tomato"], "missing": ["basil"], "extra": [], "reason": "..."}]}
        """;
    }

    public static string Ideas(IReadOnlyList<string> userIngredients) =>
        $$"""
        The user has these ingredients: {{JsonSerializer.Serialize(userIngredients)}}
        No recipe in our database matches well. Suggest 3 simple recipes they could cook,
        mostly with these ingredients.

        Answer format:
        {"ideas": [{"name": "...", "description": "one or two sentences", "ingredients": ["..."], "steps": "two or three sentences"}]}
        """;
}
