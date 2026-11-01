using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RecipeAi.Api.Dtos;
using RecipeAi.Api.Services;

namespace RecipeAi.Api.Controllers;

// Everything behind the admin area. The role check is on the whole controller.
[ApiController]
[Route("api/admin")]
[Authorize(Roles = "Admin")]
public class AdminController : ControllerBase
{
    private readonly RecipeService _recipes;
    private readonly ReviewService _reviews;
    private readonly StatsService _stats;
    private readonly AdminService _admin;

    public AdminController(RecipeService recipes, ReviewService reviews, StatsService stats, AdminService admin)
    {
        _recipes = recipes;
        _reviews = reviews;
        _stats = stats;
        _admin = admin;
    }

    // ---------- Dashboard and AI monitor ----------

    [HttpGet("stats")]
    public async Task<ActionResult<AdminStatsDto>> Stats() => Ok(await _stats.GetAdminAsync());

    [HttpGet("ai")]
    public async Task<ActionResult<AiMonitorDto>> Ai([FromQuery] int days = 14) => Ok(await _stats.GetAiMonitorAsync(days));

    // ---------- Tables ----------

    [HttpGet("recipes")]
    public async Task<ActionResult<PagedResult<AdminRecipeDto>>> Recipes([FromQuery] AdminListQuery query) =>
        Ok(await _admin.GetRecipesAsync(query));

    [HttpGet("reviews")]
    public async Task<ActionResult<PagedResult<AdminReviewDto>>> Reviews([FromQuery] AdminListQuery query) =>
        Ok(await _admin.GetReviewsAsync(query));

    [HttpGet("reviews/{id:int}")]
    public async Task<ActionResult<AdminReviewDetailsDto>> Review(int id) => Ok(await _admin.GetReviewAsync(id));

    [HttpGet("users")]
    public async Task<ActionResult<PagedResult<AdminUserDto>>> Users([FromQuery] AdminListQuery query) =>
        Ok(await _admin.GetUsersAsync(query, User.GetUserId()));

    // ---------- Accounts ----------

    [HttpPost("users/{id}/ban")]
    public async Task<IActionResult> Ban(string id)
    {
        await _admin.BanAsync(id, User.GetUserId());
        return NoContent();
    }

    [HttpPost("users/{id}/unban")]
    public async Task<IActionResult> Unban(string id)
    {
        await _admin.UnbanAsync(id);
        return NoContent();
    }

    [HttpPost("users/{id}/make-admin")]
    public async Task<IActionResult> MakeAdmin(string id)
    {
        await _admin.SetAdminAsync(id, true, User.GetUserId());
        return NoContent();
    }

    [HttpPost("users/{id}/remove-admin")]
    public async Task<IActionResult> RemoveAdmin(string id)
    {
        await _admin.SetAdminAsync(id, false, User.GetUserId());
        return NoContent();
    }

    // ---------- Moderation ----------

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
