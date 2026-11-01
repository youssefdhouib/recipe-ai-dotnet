using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RecipeAi.Api.Dtos;
using RecipeAi.Api.Services;

namespace RecipeAi.Api.Controllers;

[ApiController]
[Route("api/favorites")]
[Authorize]
public class FavoritesController : ControllerBase
{
    private readonly FavoriteService _favorites;

    public FavoritesController(FavoriteService favorites)
    {
        _favorites = favorites;
    }

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<RecipeListItemDto>>> GetMine() =>
        Ok(await _favorites.GetForUserAsync(User.GetUserId()));

    [HttpPost("{recipeId:int}")]
    public async Task<IActionResult> Add(int recipeId)
    {
        await _favorites.AddAsync(recipeId, User.GetUserId());
        return NoContent();
    }

    [HttpDelete("{recipeId:int}")]
    public async Task<IActionResult> Remove(int recipeId)
    {
        await _favorites.RemoveAsync(recipeId, User.GetUserId());
        return NoContent();
    }
}
