namespace RecipeAi.Api.Models;

public class Notification : BaseEntity
{
    public string UserId { get; set; } = string.Empty;

    public AppUser User { get; set; } = null!;

    public string Text { get; set; } = string.Empty;

    // Front-end route to open, e.g. "/recipes/12".
    public string Link { get; set; } = string.Empty;

    public bool IsRead { get; set; }
}
