using RecipeAi.Api.Models;

namespace RecipeAi.Api.Dtos;

// Query string for GET /api/recipes?search=pasta&categoryId=1&difficulty=Easy&page=1&pageSize=12
public class RecipeQuery
{
    public string? Search { get; set; }

    public int? CategoryId { get; set; }

    public Difficulty? Difficulty { get; set; }

    // Total time limit (prep + cook), e.g. 20 for "ready in 20 minutes".
    public int? MaxMinutes { get; set; }

    public RecipeSort Sort { get; set; } = RecipeSort.Newest;

    public int Page { get; set; } = 1;

    public int PageSize { get; set; } = 12;
}

public enum RecipeSort
{
    Newest,
    TopRated,
    Quickest,
}

public record PagedResult<T>(IReadOnlyList<T> Items, int Page, int PageSize, int TotalCount);

public record RecipeListItemDto(
    int Id,
    string Name,
    string Description,
    string CategoryName,
    Difficulty Difficulty,
    int PrepMinutes,
    int CookMinutes,
    string? ImagePath,
    double AverageRating,
    int ReviewCount,
    string AuthorName,
    bool IsHidden);

public record RecipeDetailsDto(
    int Id,
    string Name,
    string Description,
    string Ingredients,
    int PrepMinutes,
    int CookMinutes,
    int Portions,
    Difficulty Difficulty,
    string? ImagePath,
    int CategoryId,
    string CategoryName,
    string AuthorId,
    string AuthorName,
    double AverageRating,
    int ReviewCount,
    bool IsHidden,
    DateTime CreatedOn);

// Used for both create (POST) and update (PUT).
public record SaveRecipeDto(
    string Name,
    string Description,
    string Ingredients,
    int PrepMinutes,
    int CookMinutes,
    int Portions,
    Difficulty Difficulty,
    int CategoryId);
