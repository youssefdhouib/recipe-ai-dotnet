using FluentValidation;

namespace RecipeAi.Api.Dtos;

public record ReviewDto(int Id, int Rating, string Comment, string UserId, string UserName, DateTime CreatedOn, bool IsHidden);

public record SaveReviewDto(int Rating, string Comment);

public record NotificationDto(int Id, string Text, string Link, bool IsRead, DateTime CreatedOn);

public record UnreadCountDto(int Count);

public class SaveReviewDtoValidator : AbstractValidator<SaveReviewDto>
{
    public SaveReviewDtoValidator()
    {
        RuleFor(x => x.Rating).InclusiveBetween(1, 5);
        RuleFor(x => x.Comment).MaximumLength(1000);
    }
}
