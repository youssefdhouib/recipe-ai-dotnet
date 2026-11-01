namespace RecipeAi.Api.Models;

// A comment under a review (the discussion thread). ParentId = the reply being answered, if any.
// Threads are kept two levels deep: a reply to a reply is attached to the same top-level reply.
public class ReviewReply : BaseEntity
{
    public string Content { get; set; } = string.Empty;

    public bool IsHidden { get; set; }

    public int ReviewId { get; set; }

    public Review Review { get; set; } = null!;

    public int? ParentId { get; set; }

    public ReviewReply? Parent { get; set; }

    public string UserId { get; set; } = string.Empty;

    public AppUser User { get; set; } = null!;
}
