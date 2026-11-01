namespace RecipeAi.Api.Models;

// One row per call to the AI provider: the audit trail behind the admin dashboard's "AI usage" panel.
public class AiCallLog : BaseEntity
{
    // "normalize", "rank" or "ideas".
    public string Step { get; set; } = string.Empty;

    public string Provider { get; set; } = string.Empty;

    public int DurationMs { get; set; }

    public bool Success { get; set; }
}
