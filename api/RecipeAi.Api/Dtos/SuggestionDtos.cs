using FluentValidation;
using RecipeAi.Api.Ai;
using RecipeAi.Api.Models;

namespace RecipeAi.Api.Dtos;

public record SuggestionRequestDto(List<string> Ingredients, int? CategoryId, Difficulty? Difficulty);

public record SuggestedRecipeDto(
    int Id,
    string Name,
    string CategoryName,
    Difficulty Difficulty,
    string? ImagePath,
    int Score,
    string Reason,
    List<string> Matched,
    List<string> Missing,
    List<string> Extra);

public record SuggestionResponseDto(
    List<string> NormalizedIngredients,
    List<SuggestedRecipeDto> Recipes,
    List<RecipeIdea> Ideas,
    bool AiAvailable,
    string Provider,
    List<string> Messages);

public class SuggestionRequestDtoValidator : AbstractValidator<SuggestionRequestDto>
{
    public SuggestionRequestDtoValidator()
    {
        RuleFor(x => x.Ingredients).NotEmpty().Must(list => list.Count <= 20)
            .WithMessage("Send between 1 and 20 ingredients.");
        RuleForEach(x => x.Ingredients).NotEmpty().MaximumLength(50);
        RuleFor(x => x.Difficulty).IsInEnum().When(x => x.Difficulty is not null);
    }
}
