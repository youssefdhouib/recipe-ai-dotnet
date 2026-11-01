using FluentValidation;

namespace RecipeAi.Api.Dtos;

public enum Sex
{
    Male,
    Female,
}

// Multipliers from the standard activity factors (Mifflin-St Jeor / Harris-Benedict tables).
public enum ActivityLevel
{
    Sedentary,  // x1.2   desk job, little exercise
    Light,      // x1.375 exercise 1-3 days/week
    Moderate,   // x1.55  exercise 3-5 days/week
    Active,     // x1.725 exercise 6-7 days/week
    VeryActive, // x1.9   physical job + training
}

public enum Goal
{
    Lose,
    Maintain,
    Gain,
}

public record CalorieRequestDto(Sex Sex, int Age, double WeightKg, double HeightCm, ActivityLevel Activity, Goal Goal);

public record MacroDto(string Name, int Grams, int Calories, int Percent);

public record CalorieResultDto(
    int Bmr,
    int Maintenance,
    int Target,
    int PerMeal,
    IReadOnlyList<MacroDto> Macros,
    string Explanation);

public class CalorieRequestDtoValidator : AbstractValidator<CalorieRequestDto>
{
    public CalorieRequestDtoValidator()
    {
        RuleFor(x => x.Sex).IsInEnum();
        RuleFor(x => x.Age).InclusiveBetween(15, 100);
        RuleFor(x => x.WeightKg).InclusiveBetween(30, 300);
        RuleFor(x => x.HeightCm).InclusiveBetween(120, 230);
        RuleFor(x => x.Activity).IsInEnum();
        RuleFor(x => x.Goal).IsInEnum();
    }
}
