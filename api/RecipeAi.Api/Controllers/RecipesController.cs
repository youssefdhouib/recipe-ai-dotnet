using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RecipeAi.Api.Dtos;
using RecipeAi.Api.Services;

namespace RecipeAi.Api.Controllers;

[ApiController]
[Route("api/recipes")]
public class RecipesController : ControllerBase
{
    private readonly RecipeService _recipes;

    public RecipesController(RecipeService recipes)
    {
        _recipes = recipes;
    }

    // Public: anyone can browse. If logged in, the author also sees their own hidden recipes.
    [HttpGet]
    public async Task<ActionResult<PagedResult<RecipeListItemDto>>> GetAll([FromQuery] RecipeQuery query) =>
        Ok(await _recipes.GetPagedAsync(query, User.TryGetUserId(), User.IsAdmin()));

    [HttpGet("{id:int}")]
    public async Task<ActionResult<RecipeDetailsDto>> GetById(int id) =>
        Ok(await _recipes.GetByIdAsync(id, User.TryGetUserId(), User.IsAdmin()));

    [Authorize]
    [HttpPost]
    public async Task<ActionResult<RecipeDetailsDto>> Create(SaveRecipeDto dto)
    {
        var created = await _recipes.CreateAsync(dto, User.GetUserId());
        return CreatedAtAction(nameof(GetById), new { id = created.Id }, created);
    }

    [Authorize]
    [HttpPut("{id:int}")]
    public async Task<ActionResult<RecipeDetailsDto>> Update(int id, SaveRecipeDto dto) =>
        Ok(await _recipes.UpdateAsync(id, dto, User.GetUserId(), User.IsAdmin()));

    [Authorize]
    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id)
    {
        await _recipes.DeleteAsync(id, User.GetUserId(), User.IsAdmin());
        return NoContent();
    }

    // multipart/form-data upload with a field named "file".
    [Authorize]
    [HttpPost("{id:int}/image")]
    [RequestSizeLimit(3 * 1024 * 1024)]
    public async Task<ActionResult<RecipeDetailsDto>> UploadImage(int id, IFormFile file) =>
        Ok(await _recipes.SetImageAsync(id, file, User.GetUserId(), User.IsAdmin()));
}
