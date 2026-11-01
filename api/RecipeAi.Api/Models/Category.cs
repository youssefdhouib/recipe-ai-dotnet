namespace RecipeAi.Api.Models;

public class Category : BaseEntity
{
    public string Name { get; set; } = string.Empty;

    public string Description { get; set; } = string.Empty;

    public ICollection<Recipe> Recipes { get; set; } = new List<Recipe>();
}
