namespace RecipeAi.Api.Dtos;

// CoverImage: the photo of the newest visible recipe in the category (for the homepage tiles).
public record CategoryDto(int Id, string Name, string Description, int RecipeCount, string? CoverImage = null);

public record SaveCategoryDto(string Name, string Description);
