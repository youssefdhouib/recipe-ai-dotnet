namespace RecipeAi.Api.Models;

// Link table between a user and a recipe they saved. Unique per (UserId, RecipeId).
public class Favorite : BaseEntity
{
    public string UserId { get; set; } = string.Empty;

    public AppUser User { get; set; } = null!;

    public int RecipeId { get; set; }

    public Recipe Recipe { get; set; } = null!;
}
