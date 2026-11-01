using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RecipeAi.Api.Dtos;
using RecipeAi.Api.Services;

namespace RecipeAi.Api.Controllers;

// Moderation endpoints. The role check is on the whole controller.
[ApiController]
[Route("api/admin")]
[Authorize(Roles = "Admin")]
public class AdminController : ControllerBase
{
    private readonly RecipeService _recipes;
    private readonly ReviewService _reviews;
    private readonly StatsService _stats;

    public AdminController(RecipeService recipes, ReviewService reviews, StatsService stats)
    {
        _recipes = recipes;
        _reviews = reviews;
        _stats = stats;
    }

    [HttpGet("stats")]
    public async Task<ActionResult<AdminStatsDto>> Stats() => Ok(await _stats.GetAdminAsync());

    [HttpPost("reviews/{id:int}/hide")]
    public async Task<IActionResult> HideReview(int id)
    {
        await _reviews.SetHiddenAsync(id, true);
        return NoContent();
    }

    [HttpPost("reviews/{id:int}/unhide")]
    public async Task<IActionResult> UnhideReview(int id)
    {
        await _reviews.SetHiddenAsync(id, false);
        return NoContent();
    }

    [HttpPost("replies/{id:int}/hide")]
    public async Task<IActionResult> HideReply(int id)
    {
        await _reviews.SetReplyHiddenAsync(id, true);
        return NoContent();
    }

    [HttpPost("replies/{id:int}/unhide")]
    public async Task<IActionResult> UnhideReply(int id)
    {
        await _reviews.SetReplyHiddenAsync(id, false);
        return NoContent();
    }

    [HttpPost("recipes/{id:int}/hide")]
    public async Task<IActionResult> HideRecipe(int id)
    {
        await _recipes.SetHiddenAsync(id, true);
        return NoContent();
    }

    [HttpPost("recipes/{id:int}/unhide")]
    public async Task<IActionResult> UnhideRecipe(int id)
    {
        await _recipes.SetHiddenAsync(id, false);
        return NoContent();
    }
}
