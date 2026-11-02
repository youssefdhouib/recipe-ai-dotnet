using FluentValidation;

namespace RecipeAi.Api.Dtos;

public enum ReviewSort
{
    Newest,
    Helpful,
    Highest,
    Lowest,
}

public record ReplyDto(
    int Id,
    int? ParentId,
    string Content,
    string UserId,
    string UserName,
    bool IsRecipeAuthor,
    DateTime CreatedOn,
    bool IsHidden);

public record ReviewDto(
    int Id,
    string Title,
    int Rating,
    string Comment,
    string UserId,
    string UserName,
    DateTime CreatedOn,
    DateTime? EditedOn,
    bool IsHidden,
    int HelpfulCount,
    bool VotedByMe,
    IReadOnlyList<ReplyDto> Replies);

// Average, count and how many reviews gave 5, 4, 3, 2 and 1 star (index 0 = 5 stars).
public record RatingSummaryDto(double Average, int Count, IReadOnlyList<int> Distribution);

public record RecipeReviewsDto(RatingSummaryDto Summary, IReadOnlyList<ReviewDto> Reviews);

public record SaveReviewDto(string Title, int Rating, string Comment);

public record SaveReplyDto(string Content, int? ParentId);

public record HelpfulDto(int HelpfulCount, bool VotedByMe);

public record NotificationDto(int Id, string Text, string Link, bool IsRead, DateTime CreatedOn);

public record UnreadCountDto(int Count);

public class SaveReviewDtoValidator : AbstractValidator<SaveReviewDto>
{
    public SaveReviewDtoValidator()
    {
        RuleFor(x => x.Title).NotEmpty().MaximumLength(120);
        RuleFor(x => x.Rating).InclusiveBetween(1, 5);
        RuleFor(x => x.Comment).MaximumLength(1000);
    }
}

public class SaveReplyDtoValidator : AbstractValidator<SaveReplyDto>
{
    public SaveReplyDtoValidator()
    {
        RuleFor(x => x.Content).NotEmpty().MaximumLength(1000);
    }
}
