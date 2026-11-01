namespace RecipeAi.Api.Ai;

// Bound from the "Ai" section of appsettings.json (+ user-secrets for the API key).
public class AiOptions
{
    public const string SectionName = "Ai";

    // "Groq" or "Offline". Groq without an API key falls back to Offline.
    public string Provider { get; set; } = "Groq";

    public int TimeoutSeconds { get; set; } = 30;

    public GroqOptions Groq { get; set; } = new();
}

public class GroqOptions
{
    public string BaseUrl { get; set; } = "https://api.groq.com/openai/v1/";

    public string Model { get; set; } = "llama-3.3-70b-versatile";

    // Never in appsettings.json: set with  dotnet user-secrets set "Ai:Groq:ApiKey" "<key>"
    public string? ApiKey { get; set; }
}
