namespace RecipeAi.Api.Models;

public class Recipe : BaseEntity
{
    public string Name { get; set; } = string.Empty;

    public string Description { get; set; } = string.Empty;

    // Free text, e.g. "200g spaghetti, 2 tomatoes, garlic". The AI module normalises it.
    public string Ingredients { get; set; } = string.Empty;

    public int PrepMinutes { get; set; }

    public int CookMinutes { get; set; }

    public int Portions { get; set; }

    public Difficulty Difficulty { get; set; }

    public string? ImagePath { get; set; }

    // Set by an admin to hide a recipe from public lists without deleting it.
    public bool IsHidden { get; set; }

    public int CategoryId { get; set; }

    public Category Category { get; set; } = null!;

    public string AuthorId { get; set; } = string.Empty;

    public AppUser Author { get; set; } = null!;

    public ICollection<Review> Reviews { get; set; } = new List<Review>();

    public ICollection<Favorite> Favorites { get; set; } = new List<Favorite>();
}
