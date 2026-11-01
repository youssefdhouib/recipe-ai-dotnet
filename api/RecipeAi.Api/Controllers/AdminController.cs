using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RecipeAi.Api.Services;

namespace RecipeAi.Api.Controllers;

// Moderation endpoints. The role check is on the whole controller.
[ApiController]
[Route("api/admin")]
[Authorize(Roles = "Admin")]
public class AdminController : ControllerBase
{
    private readonly RecipeService _recipes;

    public AdminController(RecipeService recipes)
    {
        _recipes = recipes;
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
