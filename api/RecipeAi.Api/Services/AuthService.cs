using Microsoft.AspNetCore.Identity;
using RecipeAi.Api.Dtos;
using RecipeAi.Api.Errors;
using RecipeAi.Api.Models;

namespace RecipeAi.Api.Services;

public class AuthService
{
    public const string UserRole = "User";
    public const string AdminRole = "Admin";

    private readonly UserManager<AppUser> _userManager;
    private readonly TokenService _tokenService;

    public AuthService(UserManager<AppUser> userManager, TokenService tokenService)
    {
        _userManager = userManager;
        _tokenService = tokenService;
    }

    public async Task<AuthResponseDto> RegisterAsync(RegisterDto dto)
    {
        if (await _userManager.FindByEmailAsync(dto.Email) is not null)
        {
            throw new ConflictException("An account with this email already exists.");
        }

        var user = new AppUser { UserName = dto.Email, Email = dto.Email, FullName = dto.FullName.Trim() };

        // Identity hashes the password and checks the password rules configured in Program.cs.
        var result = await _userManager.CreateAsync(user, dto.Password);
        if (!result.Succeeded)
        {
            throw new BadRequestException(string.Join(" ", result.Errors.Select(e => e.Description)));
        }

        await _userManager.AddToRoleAsync(user, UserRole);
        return await BuildResponseAsync(user);
    }

    public async Task<AuthResponseDto> LoginAsync(LoginDto dto)
    {
        var user = await _userManager.FindByEmailAsync(dto.Email);

        // Same message for "unknown email" and "wrong password": don't reveal which accounts exist.
        if (user is null || !await _userManager.CheckPasswordAsync(user, dto.Password))
        {
            throw new UnauthorizedException("Invalid email or password.");
        }

        // Checked after the password, so a stranger cannot find out which accounts are banned.
        if (await _userManager.IsLockedOutAsync(user))
        {
            throw new ForbiddenException("This account has been suspended.");
        }

        return await BuildResponseAsync(user);
    }

    public async Task<UserDto> GetUserAsync(string userId)
    {
        var user = await _userManager.FindByIdAsync(userId) ?? throw new NotFoundException("User not found.");
        return await ToUserDtoAsync(user);
    }

    private async Task<AuthResponseDto> BuildResponseAsync(AppUser user)
    {
        var userDto = await ToUserDtoAsync(user);
        var (token, expiresAt) = _tokenService.CreateToken(user, userDto.Roles);
        return new AuthResponseDto(token, expiresAt, userDto);
    }

    private async Task<UserDto> ToUserDtoAsync(AppUser user)
    {
        var roles = await _userManager.GetRolesAsync(user);
        return new UserDto(user.Id, user.Email ?? string.Empty, user.FullName, roles);
    }
}
