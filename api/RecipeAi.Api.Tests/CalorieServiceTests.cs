using RecipeAi.Api.Dtos;
using RecipeAi.Api.Services;

namespace RecipeAi.Api.Tests;

public class CalorieServiceTests
{
    private readonly CalorieService _service = new();

    [Fact]
    public void Bmr_matches_the_mifflin_st_jeor_formula_for_a_man()
    {
        // 10*80 + 6.25*180 - 5*25 + 5 = 800 + 1125 - 125 + 5 = 1805
        var result = _service.Calculate(new CalorieRequestDto(Sex.Male, 25, 80, 180, ActivityLevel.Sedentary, Goal.Maintain));

        Assert.Equal(1805, result.Bmr);
        Assert.Equal(2166, result.Maintenance); // 1805 * 1.2
        Assert.Equal(2166, result.Target);
    }

    [Fact]
    public void Bmr_uses_minus_161_for_a_woman()
    {
        // 10*60 + 6.25*165 - 5*30 - 161 = 600 + 1031.25 - 150 - 161 = 1320.25
        var result = _service.Calculate(new CalorieRequestDto(Sex.Female, 30, 60, 165, ActivityLevel.Moderate, Goal.Maintain));

        Assert.Equal(1320, result.Bmr);
        Assert.Equal(2046, result.Maintenance); // 1320.25 * 1.55
    }

    [Fact]
    public void Lose_goal_is_a_20_percent_deficit_and_gain_a_10_percent_surplus()
    {
        var lose = _service.Calculate(new CalorieRequestDto(Sex.Male, 25, 80, 180, ActivityLevel.Sedentary, Goal.Lose));
        var gain = _service.Calculate(new CalorieRequestDto(Sex.Male, 25, 80, 180, ActivityLevel.Sedentary, Goal.Gain));

        Assert.Equal(1733, lose.Target); // 2166 * 0.8
        Assert.Equal(2383, gain.Target); // 2166 * 1.1
    }

    [Fact]
    public void Target_never_goes_below_1200_kcal()
    {
        var result = _service.Calculate(new CalorieRequestDto(Sex.Female, 80, 40, 140, ActivityLevel.Sedentary, Goal.Lose));

        Assert.Equal(1200, result.Target);
    }

    [Fact]
    public void Macros_add_up_to_about_the_target()
    {
        var result = _service.Calculate(new CalorieRequestDto(Sex.Male, 25, 80, 180, ActivityLevel.Active, Goal.Maintain));

        var total = result.Macros.Sum(m => m.Calories);
        Assert.InRange(total, result.Target - 3, result.Target + 3);
        Assert.Equal(128, result.Macros.Single(m => m.Name == "Protein").Grams); // 1.6 g * 80 kg
    }
}
