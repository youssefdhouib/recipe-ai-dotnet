using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using RecipeAi.Api.Ai;
using RecipeAi.Api.Dtos;

namespace RecipeAi.Api.Controllers;

[ApiController]
[Route("api/suggestions")]
public class SuggestionsController : ControllerBase
{
    private readonly SuggestionService _suggestions;

    public SuggestionsController(SuggestionService suggestions)
    {
        _suggestions = suggestions;
    }

    // Rate-limited: every call costs LLM tokens, so one client can't spam it (429 Too Many Requests).
    [HttpPost]
    [EnableRateLimiting("ai")]
    public async Task<ActionResult<SuggestionResponseDto>> Suggest(SuggestionRequestDto request, CancellationToken cancellationToken) =>
        Ok(await _suggestions.SuggestAsync(request, cancellationToken));
}
