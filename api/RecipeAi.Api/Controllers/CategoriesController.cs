using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RecipeAi.Api.Dtos;
using RecipeAi.Api.Services;

namespace RecipeAi.Api.Controllers;

[ApiController]
[Route("api/categories")]
public class CategoriesController : ControllerBase
{
    private readonly CategoryService _categories;

    public CategoriesController(CategoryService categories)
    {
        _categories = categories;
    }

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<CategoryDto>>> GetAll() => Ok(await _categories.GetAllAsync());

    [Authorize(Roles = "Admin")]
    [HttpPost]
    public async Task<ActionResult<CategoryDto>> Create(SaveCategoryDto dto) => Ok(await _categories.CreateAsync(dto));

    [Authorize(Roles = "Admin")]
    [HttpPut("{id:int}")]
    public async Task<ActionResult<CategoryDto>> Update(int id, SaveCategoryDto dto) => Ok(await _categories.UpdateAsync(id, dto));

    [Authorize(Roles = "Admin")]
    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id)
    {
        await _categories.DeleteAsync(id);
        return NoContent();
    }
}
