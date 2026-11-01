using RecipeAi.Api.Dtos;

namespace RecipeAi.Api.Services;

// Pure calculation, no database: easy to unit-test.
// BMR with the Mifflin-St Jeor equation (the one dietitians use most today):
//   men:   10 x kg + 6.25 x cm - 5 x age + 5
//   women: 10 x kg + 6.25 x cm - 5 x age - 161
// Maintenance = BMR x activity factor; the goal adjusts it; macros follow common guidelines.
public class CalorieService
{
    private const int MinimumCalories = 1200;

    private static readonly Dictionary<ActivityLevel, double> ActivityFactors = new()
    {
        [ActivityLevel.Sedentary] = 1.2,
        [ActivityLevel.Light] = 1.375,
        [ActivityLevel.Moderate] = 1.55,
        [ActivityLevel.Active] = 1.725,
        [ActivityLevel.VeryActive] = 1.9,
    };

    public CalorieResultDto Calculate(CalorieRequestDto request)
    {
        var bmr = 10 * request.WeightKg + 6.25 * request.HeightCm - 5 * request.Age
                  + (request.Sex == Sex.Male ? 5 : -161);
        var maintenance = bmr * ActivityFactors[request.Activity];

        // Lose: -20% (a moderate deficit), Gain: +10% (a lean surplus). Never below 1200 kcal.
        var target = request.Goal switch
        {
            Goal.Lose => maintenance * 0.8,
            Goal.Gain => maintenance * 1.1,
            _ => maintenance,
        };
        target = Math.Max(target, MinimumCalories);

        // Protein per kg of body weight is higher when losing (keeps muscle) or gaining.
        var proteinPerKg = request.Goal == Goal.Maintain ? 1.6 : 2.0;
        var proteinCalories = proteinPerKg * request.WeightKg * 4;
        var fatCalories = target * 0.25;
        var carbCalories = Math.Max(0, target - proteinCalories - fatCalories);

        var macros = new List<MacroDto>
        {
            Macro("Protein", proteinCalories, 4, target),
            Macro("Carbs", carbCalories, 4, target),
            Macro("Fat", fatCalories, 9, target),
        };

        var goalText = request.Goal switch
        {
            Goal.Lose => "a 20% deficit to lose about 0.5 kg per week",
            Goal.Gain => "a 10% surplus for lean weight gain",
            _ => "your maintenance level to keep your weight stable",
        };

        return new CalorieResultDto(
            (int)Math.Round(bmr),
            (int)Math.Round(maintenance),
            (int)Math.Round(target),
            (int)Math.Round(target / 3),
            macros,
            $"Your body burns about {Math.Round(bmr)} kcal at rest (Mifflin-St Jeor). With your activity that is {Math.Round(maintenance)} kcal per day; the target uses {goalText}.");
    }

    private static MacroDto Macro(string name, double calories, int caloriesPerGram, double total) =>
        new(name, (int)Math.Round(calories / caloriesPerGram), (int)Math.Round(calories), (int)Math.Round(100 * calories / total));
}
