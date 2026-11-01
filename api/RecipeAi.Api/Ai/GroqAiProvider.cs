using System.Net.Http.Headers;
using System.Text.Json;
using System.Text.Json.Nodes;
using Microsoft.Extensions.Options;

namespace RecipeAi.Api.Ai;

// Real LLM provider. Groq exposes an OpenAI-compatible "chat completions" API.
// The HttpClient is injected by IHttpClientFactory (typed client) with retries and timeouts
// configured in Program.cs: no "new HttpClient()" per call, so no socket exhaustion.
public class GroqAiProvider : IAiProvider
{
    private readonly HttpClient _http;
    private readonly GroqOptions _options;

    public GroqAiProvider(HttpClient http, IOptions<AiOptions> options)
    {
        _http = http;
        _options = options.Value.Groq;
        _http.BaseAddress = new Uri(_options.BaseUrl);
        _http.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", _options.ApiKey);
    }

    public string Name => $"Groq ({_options.Model})";

    public Task<string> NormalizeIngredientsAsync(IReadOnlyList<string> ingredients, CancellationToken cancellationToken) =>
        CompleteAsync(AiPrompts.Normalize(ingredients), cancellationToken);

    public Task<string> RankRecipesAsync(IReadOnlyList<string> userIngredients, IReadOnlyList<CandidateRecipe> candidates, CancellationToken cancellationToken) =>
        CompleteAsync(AiPrompts.Rank(userIngredients, candidates), cancellationToken);

    public Task<string> GenerateIdeasAsync(IReadOnlyList<string> userIngredients, CancellationToken cancellationToken) =>
        CompleteAsync(AiPrompts.Ideas(userIngredients), cancellationToken);

    private async Task<string> CompleteAsync(string userPrompt, CancellationToken cancellationToken)
    {
        var payload = new
        {
            model = _options.Model,
            temperature = 0.2, // low = more consistent answers
            max_tokens = 2048,
            response_format = new { type = "json_object" }, // JSON mode: the API forces valid JSON
            messages = new[]
            {
                new { role = "system", content = AiPrompts.System },
                new { role = "user", content = userPrompt },
            },
        };

        using var response = await _http.PostAsJsonAsync("chat/completions", payload, cancellationToken);
        response.EnsureSuccessStatusCode(); // non-2xx -> HttpRequestException -> pipeline fallback

        var body = await response.Content.ReadFromJsonAsync<JsonNode>(cancellationToken: cancellationToken);
        return body?["choices"]?[0]?["message"]?["content"]?.GetValue<string>()
            ?? throw new JsonException("Groq response has no message content.");
    }
}
