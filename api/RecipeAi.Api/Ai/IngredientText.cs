using System.Text.RegularExpressions;

namespace RecipeAi.Api.Ai;

// Small text helpers shared by the offline provider and the keyword fallback.
public static partial class IngredientText
{
    private static readonly string[] Noise =
    {
        "fresh", "chopped", "minced", "diced", "ripe", "large", "small", "medium", "peeled", "cubed", "dried",
        "cloves of", "clove of", "cup", "cups", "tablespoons", "tablespoon", "teaspoons", "teaspoon", "of", "and",
    };

    // "200g Spaghetti " -> "spaghetti", "3 cloves of garlic" -> "garlic", "tomatoes" -> "tomato"
    public static string Normalize(string raw)
    {
        var text = raw.ToLowerInvariant();
        text = QuantityRegex().Replace(text, " ");
        foreach (var word in Noise)
        {
            text = Regex.Replace(text, $@"\b{Regex.Escape(word)}\b", " ");
        }

        text = SpacesRegex().Replace(text, " ").Trim();
        return Singular(text);
    }

    public static IEnumerable<string> Split(string ingredients) =>
        ingredients.Split(new[] { ',', '\n', ';' }, StringSplitOptions.RemoveEmptyEntries)
            .Select(Normalize)
            .Where(i => i.Length > 0)
            .Distinct();

    // "chicken" matches "chicken breast", "tomato" matches "tomato".
    public static bool Matches(string userIngredient, string recipeIngredient) =>
        recipeIngredient.Contains(userIngredient, StringComparison.OrdinalIgnoreCase)
        || userIngredient.Contains(recipeIngredient, StringComparison.OrdinalIgnoreCase);

    private static string Singular(string word)
    {
        if (word.EndsWith("oes", StringComparison.Ordinal))
        {
            return word[..^2];
        }

        if (word.EndsWith('s') && !word.EndsWith("ss", StringComparison.Ordinal) && word.Length > 3)
        {
            return word[..^1];
        }

        return word;
    }

    [GeneratedRegex(@"[\d/.,]+\s*(g|kg|ml|l)?\b")]
    private static partial Regex QuantityRegex();

    [GeneratedRegex(@"\s+")]
    private static partial Regex SpacesRegex();
}
