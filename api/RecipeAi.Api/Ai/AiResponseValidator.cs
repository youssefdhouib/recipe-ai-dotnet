using System.Text.Json;
using System.Text.Json.Nodes;

namespace RecipeAi.Api.Ai;

// The safety layer between the LLM and our app. Pure functions (no DB, no network) -> easy to unit-test.
// Rule: the model's output is untrusted input. Parse it, keep only what is valid, never crash.
public static class AiResponseValidator
{
    private const int MaxIngredients = 30;
    private const int MaxListItems = 20;
    private const int MaxItemLength = 60;
    private const int MaxReasonLength = 300;
    private const int MaxIdeas = 3;

    // Returns null when the answer is unusable (malformed JSON, wrong shape, empty).
    public static List<string>? ParseIngredients(string? json)
    {
        var root = ParseObject(json);
        var list = CleanList(root?["ingredients"], MaxIngredients);
        return list.Count > 0 ? list : null;
    }

    public static List<RankedMatch>? ParseRanking(string? json, IReadOnlyCollection<int> allowedRecipeIds)
    {
        var items = ParseObject(json)?["recipes"] as JsonArray;
        if (items is null)
        {
            return null;
        }

        var allowed = allowedRecipeIds.ToHashSet();
        var seen = new HashSet<int>();
        var results = new List<RankedMatch>();

        foreach (var item in items.OfType<JsonObject>())
        {
            // 1. The id must be one of the recipes WE sent. A hallucinated id is dropped.
            if (!TryGetInt(item["id"], out var id) || !allowed.Contains(id) || !seen.Add(id))
            {
                continue;
            }

            // 2. The score is clamped to 0-100, whatever the model says.
            TryGetInt(item["score"], out var score);

            results.Add(new RankedMatch(
                id,
                Math.Clamp(score, 0, 100),
                CleanList(item["matched"], MaxListItems),
                CleanList(item["missing"], MaxListItems),
                CleanList(item["extra"], MaxListItems),
                Truncate(GetString(item["reason"]), MaxReasonLength)));
        }

        return results.OrderByDescending(r => r.Score).ToList();
    }

    public static List<RecipeIdea> ParseIdeas(string? json)
    {
        var items = ParseObject(json)?["ideas"] as JsonArray;
        if (items is null)
        {
            return new List<RecipeIdea>();
        }

        return items.OfType<JsonObject>()
            .Select(i => new RecipeIdea(
                Truncate(GetString(i["name"]), 120),
                Truncate(GetString(i["description"]), MaxReasonLength),
                CleanList(i["ingredients"], MaxListItems),
                Truncate(GetString(i["steps"]), 600)))
            .Where(i => i.Name.Length > 0)
            .Take(MaxIdeas)
            .ToList();
    }

    // Accepts raw JSON, or JSON wrapped in ```json fences (some models add them despite the prompt).
    private static JsonObject? ParseObject(string? text)
    {
        if (string.IsNullOrWhiteSpace(text))
        {
            return null;
        }

        var trimmed = text.Trim();
        if (trimmed.StartsWith("```", StringComparison.Ordinal))
        {
            var firstNewLine = trimmed.IndexOf('\n');
            var lastFence = trimmed.LastIndexOf("```", StringComparison.Ordinal);
            if (firstNewLine > 0 && lastFence > firstNewLine)
            {
                trimmed = trimmed[(firstNewLine + 1)..lastFence].Trim();
            }
        }

        try
        {
            return JsonNode.Parse(trimmed) as JsonObject;
        }
        catch (JsonException)
        {
            return null;
        }
    }

    private static List<string> CleanList(JsonNode? node, int max) =>
        (node as JsonArray ?? new JsonArray())
            .Select(GetString)
            .Select(s => Truncate(s.ToLowerInvariant(), MaxItemLength))
            .Where(s => s.Length > 0)
            .Distinct()
            .Take(max)
            .ToList();

    private static string GetString(JsonNode? node) =>
        node is JsonValue value && value.TryGetValue<string>(out var s) ? s.Trim() : string.Empty;

    // Models sometimes send numbers as strings ("85") or decimals (85.0): accept both.
    private static bool TryGetInt(JsonNode? node, out int result)
    {
        result = 0;
        if (node is not JsonValue value)
        {
            return false;
        }

        if (value.TryGetValue<int>(out result))
        {
            return true;
        }

        if (value.TryGetValue<double>(out var d))
        {
            result = (int)Math.Round(d);
            return true;
        }

        return value.TryGetValue<string>(out var s) && int.TryParse(s, out result);
    }

    private static string Truncate(string value, int max) => value.Length <= max ? value : value[..max];
}

// Validated, trusted shapes used by the rest of the app.
public record RankedMatch(int RecipeId, int Score, List<string> Matched, List<string> Missing, List<string> Extra, string Reason);

public record RecipeIdea(string Name, string Description, List<string> Ingredients, string Steps);
