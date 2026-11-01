namespace RecipeAi.Api.Dtos;

// Shared by the admin tables: search box, status filter and paging.
public class AdminListQuery
{
    public string? Search { get; set; }

    // recipes: visible | hidden · reviews: visible | hidden | low · users: active | banned | admins
    public string? Status { get; set; }

    public int Page { get; set; } = 1;

    public int PageSize { get; set; } = 15;
}

public record AdminRecipeDto(
    int Id,
    string Name,
    string CategoryName,
    string AuthorName,
    string? ImagePath,
    bool IsHidden,
    int ReviewCount,
    double? AverageRating,
    int Favorites,
    DateTime CreatedOn);

public record AdminReviewDto(
    int Id,
    string Title,
    int Rating,
    string Comment,
    int RecipeId,
    string RecipeName,
    string UserName,
    DateTime CreatedOn,
    bool IsHidden,
    int HelpfulCount,
    int ReplyCount,
    int HiddenReplyCount);

public record AdminReviewDetailsDto(AdminReviewDto Review, IReadOnlyList<ReplyDto> Replies);

public record AdminUserDto(
    string Id,
    string FullName,
    string Email,
    bool IsAdmin,
    bool IsBanned,
    bool IsMe,
    DateTime CreatedOn,
    int Recipes,
    int Reviews,
    int Replies);

// ----- AI monitor -----
public record AiDayDto(DateOnly Date, int Succeeded, int Failed);

public record AiCallDto(int Id, DateTime CreatedOn, string Step, string Provider, int DurationMs, bool Success);

public record AiMonitorDto(int Days, AiUsageDto Usage, IReadOnlyList<AiDayDto> PerDay, IReadOnlyList<AiCallDto> Recent);
