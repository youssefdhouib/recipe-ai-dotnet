using FluentValidation;

namespace RecipeAi.Api.Dtos;

public class SaveRecipeDtoValidator : AbstractValidator<SaveRecipeDto>
{
    public SaveRecipeDtoValidator()
    {
        RuleFor(x => x.Name).NotEmpty().MaximumLength(120);
        RuleFor(x => x.Description).NotEmpty().MaximumLength(2000);
        RuleFor(x => x.Ingredients).NotEmpty().MaximumLength(2000);
        RuleFor(x => x.PrepMinutes).InclusiveBetween(0, 1440);
        RuleFor(x => x.CookMinutes).InclusiveBetween(0, 1440);
        RuleFor(x => x.Portions).InclusiveBetween(1, 50);
        RuleFor(x => x.Difficulty).IsInEnum();
        RuleFor(x => x.CategoryId).GreaterThan(0);
    }
}

public class SaveCategoryDtoValidator : AbstractValidator<SaveCategoryDto>
{
    public SaveCategoryDtoValidator()
    {
        RuleFor(x => x.Name).NotEmpty().MaximumLength(60);
        RuleFor(x => x.Description).MaximumLength(300);
    }
}
