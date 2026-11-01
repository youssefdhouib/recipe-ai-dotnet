namespace RecipeAi.Api.Dtos;

// Public numbers shown on the homepage.
public record PublicStatsDto(int Recipes, int Reviews, int Members, int Categories);

// ----- Admin dashboard -----
public record CountItemDto(string Label, int Count);

public record DailyCountDto(DateOnly Date, int Count);

public record TopRecipeDto(int Id, string Name, double AverageRating, int ReviewCount);

public record AiStepLatencyDto(string Step, int AverageMs, int Calls);

public record AiUsageDto(int Calls, int Failed, double SuccessRate, int AverageMs, IReadOnlyList<AiStepLatencyDto> Steps);

public record AdminStatsDto(
    int Users,
    int Recipes,
    int HiddenRecipes,
    int Reviews,
    int Favorites,
    IReadOnlyList<CountItemDto> RecipesPerCategory,
    IReadOnlyList<DailyCountDto> ReviewsPerDay,
    IReadOnlyList<TopRecipeDto> TopRecipes,
    AiUsageDto AiUsage);
