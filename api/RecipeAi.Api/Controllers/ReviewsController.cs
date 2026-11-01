using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RecipeAi.Api.Dtos;
using RecipeAi.Api.Services;

namespace RecipeAi.Api.Controllers;

// Nested route: reviews always belong to a recipe.
[ApiController]
[Route("api/recipes/{recipeId:int}/reviews")]
public class ReviewsController : ControllerBase
{
    private readonly ReviewService _reviews;

    public ReviewsController(ReviewService reviews)
    {
        _reviews = reviews;
    }

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<ReviewDto>>> GetAll(int recipeId) =>
        Ok(await _reviews.GetForRecipeAsync(recipeId, User.IsAdmin()));

    [Authorize]
    [HttpPost]
    public async Task<ActionResult<ReviewDto>> Create(int recipeId, SaveReviewDto dto) =>
        StatusCode(StatusCodes.Status201Created, await _reviews.CreateAsync(recipeId, dto, User.GetUserId()));
}
