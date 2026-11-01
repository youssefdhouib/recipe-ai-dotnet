using Microsoft.AspNetCore.Identity;

namespace RecipeAi.Api.Models;

// IdentityUser already has Id, Email, UserName, PasswordHash... we only add FullName.
public class AppUser : IdentityUser
{
    public string FullName { get; set; } = string.Empty;
}
