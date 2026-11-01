using System.Security.Claims;

namespace RecipeAi.Api.Controllers;

// Small helpers so controllers can read the logged-in user from the JWT claims.
public static class ClaimsPrincipalExtensions
{
    public static string GetUserId(this ClaimsPrincipal user) =>
        user.FindFirstValue(ClaimTypes.NameIdentifier)
        ?? throw new InvalidOperationException("No user id in token.");

    public static string? TryGetUserId(this ClaimsPrincipal user) =>
        user.FindFirstValue(ClaimTypes.NameIdentifier);

    public static bool IsAdmin(this ClaimsPrincipal user) => user.IsInRole("Admin");
}
