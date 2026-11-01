using Microsoft.AspNetCore.Identity;

namespace RecipeAi.Api.Models;

// IdentityUser already has Id, Email, UserName, PasswordHash, LockoutEnd... we add FullName and the join date.
// A ban uses Identity's built-in lockout (LockoutEnd = far future), so no extra column is needed.
public class AppUser : IdentityUser
{
    public string FullName { get; set; } = string.Empty;

    public DateTime CreatedOn { get; set; } = DateTime.UtcNow;
}
