namespace RecipeAi.Api.Models;

// One review per user per recipe (enforced by a unique index in AppDbContext).
public class Review : BaseEntity
{
    public string Title { get; set; } = string.Empty;

    public int Rating { get; set; }

    public string Comment { get; set; } = string.Empty;

    public bool IsHidden { get; set; }

    // Set only when the author edits the review. Not ModifiedOn: that audit date also changes
    // when an admin hides the review, which must not show "edited".
    public DateTime? EditedOn { get; set; }

    public int RecipeId { get; set; }

    public Recipe Recipe { get; set; } = null!;

    public string UserId { get; set; } = string.Empty;

    public AppUser User { get; set; } = null!;

    public ICollection<ReviewReply> Replies { get; set; } = new List<ReviewReply>();

    public ICollection<ReviewVote> Votes { get; set; } = new List<ReviewVote>();
}
