using Microsoft.AspNetCore.Mvc;
using RecipeAi.Api.Dtos;
using RecipeAi.Api.Services;

namespace RecipeAi.Api.Controllers;

[ApiController]
[Route("api/calories")]
public class CaloriesController : ControllerBase
{
    private readonly CalorieService _calories;

    public CaloriesController(CalorieService calories)
    {
        _calories = calories;
    }

    // POST because the body carries personal data: it should not end up in URLs or server logs.
    [HttpPost]
    public ActionResult<CalorieResultDto> Calculate(CalorieRequestDto request) => Ok(_calories.Calculate(request));
}
