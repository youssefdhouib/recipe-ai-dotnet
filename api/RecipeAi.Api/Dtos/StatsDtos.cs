namespace RecipeAi.Api.Dtos;

// Public numbers shown on the homepage.
public record PublicStatsDto(int Recipes, int Reviews, int Members, int Categories);

// ----- Admin dashboard -----
public record CountItemDto(string Label, int Count);

public record DailyCountDto(DateOnly Date, int Count);

public record TopRecipeDto(int Id, string Name, double AverageRating, int ReviewCount);

public record AiStepLatencyDto(string Step, int AverageMs, int Calls);

public record AiUsageDto(int Calls, int Failed, double SuccessRate, int AverageMs, IReadOnlyList<AiStepLatencyDto> Steps);

// A KPI with its trend: how many were added in the last 7 days vs the 7 days before.
public record TrendDto(string Label, int Total, int Last7Days, int Previous7Days);

// What needs an admin's eye.
public record ModerationCountsDto(int HiddenRecipes, int HiddenReviews, int HiddenReplies, int LowRatingsThisWeek, int BannedUsers);

// One line of the "recent activity" feed (kind: user | recipe | review).
public record ActivityDto(string Kind, string Text, string Link, DateTime CreatedOn);

public record AdminStatsDto(
    IReadOnlyList<TrendDto> Trends,
    int Favorites,
    ModerationCountsDto Moderation,
    IReadOnlyList<CountItemDto> RecipesPerCategory,
    IReadOnlyList<DailyCountDto> ReviewsPerDay,
    IReadOnlyList<DailyCountDto> SignupsPerDay,
    IReadOnlyList<TopRecipeDto> TopRecipes,
    AiUsageDto AiUsage,
    IReadOnlyList<ActivityDto> RecentActivity);
