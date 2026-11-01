namespace RecipeAi.Api.Dtos;

public record RegisterDto(string Email, string Password, string FullName);

public record LoginDto(string Email, string Password);

public record UserDto(string Id, string Email, string FullName, IList<string> Roles);

public record AuthResponseDto(string Token, DateTime ExpiresAt, UserDto User);
