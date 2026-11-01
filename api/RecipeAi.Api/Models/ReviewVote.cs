namespace RecipeAi.Api.Models;

// "This review was helpful": one vote per user per review (unique index).
public class ReviewVote : BaseEntity
{
    public int ReviewId { get; set; }

    public Review Review { get; set; } = null!;

    public string UserId { get; set; } = string.Empty;

    public AppUser User { get; set; } = null!;
}
