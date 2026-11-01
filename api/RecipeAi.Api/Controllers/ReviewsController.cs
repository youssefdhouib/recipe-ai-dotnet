using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RecipeAi.Api.Dtos;
using RecipeAi.Api.Services;

namespace RecipeAi.Api.Controllers;

// Reviews are listed and created under their recipe; once they exist they have their own URL.
[ApiController]
[Route("api")]
public class ReviewsController : ControllerBase
{
    private readonly ReviewService _reviews;

    public ReviewsController(ReviewService reviews)
    {
        _reviews = reviews;
    }

    [HttpGet("recipes/{recipeId:int}/reviews")]
    public async Task<ActionResult<RecipeReviewsDto>> GetForRecipe(int recipeId, [FromQuery] ReviewSort sort = ReviewSort.Newest) =>
        Ok(await _reviews.GetForRecipeAsync(recipeId, User.TryGetUserId(), User.IsAdmin(), sort));

    [Authorize]
    [HttpPost("recipes/{recipeId:int}/reviews")]
    public async Task<IActionResult> Create(int recipeId, SaveReviewDto dto)
    {
        var id = await _reviews.CreateAsync(recipeId, dto, User.GetUserId());
        return StatusCode(StatusCodes.Status201Created, new { id });
    }

    [Authorize]
    [HttpPut("reviews/{id:int}")]
    public async Task<IActionResult> Update(int id, SaveReviewDto dto)
    {
        await _reviews.UpdateAsync(id, dto, User.GetUserId());
        return NoContent();
    }

    [Authorize]
    [HttpDelete("reviews/{id:int}")]
    public async Task<IActionResult> Delete(int id)
    {
        await _reviews.DeleteAsync(id, User.GetUserId(), User.IsAdmin());
        return NoContent();
    }

    [Authorize]
    [HttpPost("reviews/{id:int}/helpful")]
    public async Task<ActionResult<HelpfulDto>> ToggleHelpful(int id) =>
        Ok(await _reviews.ToggleHelpfulAsync(id, User.GetUserId()));

    [Authorize]
    [HttpPost("reviews/{id:int}/replies")]
    public async Task<ActionResult<ReplyDto>> Reply(int id, SaveReplyDto dto) =>
        StatusCode(StatusCodes.Status201Created, await _reviews.AddReplyAsync(id, dto, User.GetUserId()));

    [Authorize]
    [HttpDelete("replies/{id:int}")]
    public async Task<IActionResult> DeleteReply(int id)
    {
        await _reviews.DeleteReplyAsync(id, User.GetUserId(), User.IsAdmin());
        return NoContent();
    }
}
