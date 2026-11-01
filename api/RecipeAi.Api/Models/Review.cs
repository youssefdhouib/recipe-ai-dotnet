namespace RecipeAi.Api.Models;

// One review per user per recipe (enforced by a unique index in AppDbContext).
public class Review : BaseEntity
{
    public int Rating { get; set; }

    public string Comment { get; set; } = string.Empty;

    public bool IsHidden { get; set; }

    public int RecipeId { get; set; }

    public Recipe Recipe { get; set; } = null!;

    public string UserId { get; set; } = string.Empty;

    public AppUser User { get; set; } = null!;
}
