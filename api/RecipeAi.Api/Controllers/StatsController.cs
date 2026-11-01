using Microsoft.AspNetCore.Mvc;
using RecipeAi.Api.Dtos;
using RecipeAi.Api.Services;

namespace RecipeAi.Api.Controllers;

[ApiController]
[Route("api/stats")]
public class StatsController : ControllerBase
{
    private readonly StatsService _stats;

    public StatsController(StatsService stats)
    {
        _stats = stats;
    }

    [HttpGet]
    public async Task<ActionResult<PublicStatsDto>> GetPublic() => Ok(await _stats.GetPublicAsync());
}
