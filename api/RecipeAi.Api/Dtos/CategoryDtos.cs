namespace RecipeAi.Api.Dtos;

public record CategoryDto(int Id, string Name, string Description, int RecipeCount);

public record SaveCategoryDto(string Name, string Description);
