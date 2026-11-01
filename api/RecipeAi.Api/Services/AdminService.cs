using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using RecipeAi.Api.Data;
using RecipeAi.Api.Dtos;
using RecipeAi.Api.Errors;
using RecipeAi.Api.Models;

namespace RecipeAi.Api.Services;

// The admin tables (recipes, reviews, users) and the account actions (ban, admin role).
// Hiding/deleting content reuses RecipeService and ReviewService: one place per rule.
public class AdminService
{
    private readonly AppDbContext _db;
    private readonly UserManager<AppUser> _userManager;

    public AdminService(AppDbContext db, UserManager<AppUser> userManager)
    {
        _db = db;
        _userManager = userManager;
    }

    // ---------- Recipes ----------

    public async Task<PagedResult<AdminRecipeDto>> GetRecipesAsync(AdminListQuery q)
    {
        var query = _db.Recipes.AsNoTracking();
        if (!string.IsNullOrWhiteSpace(q.Search))
        {
            var s = q.Search.Trim();
            query = query.Where(r => r.Name.Contains(s) || r.Author.FullName.Contains(s) || r.Category.Name.Contains(s));
        }

        query = q.Status switch
        {
            "visible" => query.Where(r => !r.IsHidden),
            "hidden" => query.Where(r => r.IsHidden),
            _ => query,
        };

        return await PageAsync(
            query.OrderByDescending(r => r.CreatedOn).Select(r => new AdminRecipeDto(
                r.Id,
                r.Name,
                r.Category.Name,
                r.Author.FullName,
                r.ImagePath,
                r.IsHidden,
                r.Reviews.Count,
                r.Reviews.Select(v => (double?)v.Rating).Average(),
                r.Favorites.Count,
                r.CreatedOn)),
            q);
    }

    // ---------- Reviews ----------

    public async Task<PagedResult<AdminReviewDto>> GetReviewsAsync(AdminListQuery q)
    {
        var query = _db.Reviews.AsNoTracking();
        if (!string.IsNullOrWhiteSpace(q.Search))
        {
            var s = q.Search.Trim();
            query = query.Where(r => r.Title.Contains(s) || r.Comment.Contains(s) || r.Recipe.Name.Contains(s) || r.User.FullName.Contains(s));
        }

        query = q.Status switch
        {
            "visible" => query.Where(r => !r.IsHidden),
            "hidden" => query.Where(r => r.IsHidden || r.Replies.Any(p => p.IsHidden)),
            "low" => query.Where(r => r.Rating <= 2),
            _ => query,
        };

        return await PageAsync(query.OrderByDescending(r => r.CreatedOn).Select(ToRow), q);
    }

    // One review with its whole discussion, hidden replies included.
    public async Task<AdminReviewDetailsDto> GetReviewAsync(int id)
    {
        var review = await _db.Reviews.AsNoTracking().Where(r => r.Id == id).Select(ToRow).FirstOrDefaultAsync()
            ?? throw new NotFoundException("Review not found.");

        var replies = await _db.ReviewReplies.AsNoTracking()
            .Where(p => p.ReviewId == id)
            .OrderBy(p => p.CreatedOn)
            .Select(p => new ReplyDto(p.Id, p.ParentId, p.Content, p.UserId, p.User.FullName,
                p.UserId == p.Review.Recipe.AuthorId, p.CreatedOn, p.IsHidden))
            .ToListAsync();

        return new AdminReviewDetailsDto(review, replies);
    }

    // ---------- Users ----------

    public async Task<PagedResult<AdminUserDto>> GetUsersAsync(AdminListQuery q, string currentAdminId)
    {
        var adminRoleId = await _db.Roles.Where(r => r.Name == AuthService.AdminRole).Select(r => r.Id).FirstOrDefaultAsync();
        var now = DateTimeOffset.UtcNow;

        var query = _db.Users.AsNoTracking();
        if (!string.IsNullOrWhiteSpace(q.Search))
        {
            var s = q.Search.Trim();
            query = query.Where(u => u.FullName.Contains(s) || u.Email!.Contains(s));
        }

        query = q.Status switch
        {
            "active" => query.Where(u => u.LockoutEnd == null || u.LockoutEnd <= now),
            "banned" => query.Where(u => u.LockoutEnd != null && u.LockoutEnd > now),
            "admins" => query.Where(u => _db.UserRoles.Any(ur => ur.UserId == u.Id && ur.RoleId == adminRoleId)),
            _ => query,
        };

        return await PageAsync(
            query.OrderByDescending(u => u.CreatedOn).Select(u => new AdminUserDto(
                u.Id,
                u.FullName,
                u.Email ?? string.Empty,
                _db.UserRoles.Any(ur => ur.UserId == u.Id && ur.RoleId == adminRoleId),
                u.LockoutEnd != null && u.LockoutEnd > now,
                u.Id == currentAdminId,
                u.CreatedOn,
                _db.Recipes.Count(r => r.AuthorId == u.Id),
                _db.Reviews.Count(r => r.UserId == u.Id),
                _db.ReviewReplies.Count(r => r.UserId == u.Id))),
            q);
    }

    // A ban is an Identity lockout that never ends: login refuses it and the JWT check in Program.cs
    // rejects the tokens the user already has, so it takes effect at once.
    public async Task BanAsync(string userId, string currentAdminId)
    {
        var user = await FindUserAsync(userId);
        if (userId == currentAdminId)
        {
            throw new BadRequestException("You cannot ban yourself.");
        }

        if (await _userManager.IsInRoleAsync(user, AuthService.AdminRole))
        {
            throw new BadRequestException("Remove the admin role before banning this account.");
        }

        await _userManager.SetLockoutEnabledAsync(user, true);
        await _userManager.SetLockoutEndDateAsync(user, DateTimeOffset.MaxValue);
    }

    public async Task UnbanAsync(string userId)
    {
        var user = await FindUserAsync(userId);
        await _userManager.SetLockoutEndDateAsync(user, null);
    }

    public async Task SetAdminAsync(string userId, bool makeAdmin, string currentAdminId)
    {
        var user = await FindUserAsync(userId);

        // You cannot remove your own role: this also guarantees there is always at least one admin.
        if (userId == currentAdminId)
        {
            throw new BadRequestException("You cannot change your own role.");
        }

        var isAdmin = await _userManager.IsInRoleAsync(user, AuthService.AdminRole);
        if (makeAdmin && !isAdmin)
        {
            if (await _userManager.IsLockedOutAsync(user))
            {
                throw new BadRequestException("Unban this account before making it admin.");
            }

            await _userManager.AddToRoleAsync(user, AuthService.AdminRole);
        }
        else if (!makeAdmin && isAdmin)
        {
            await _userManager.RemoveFromRoleAsync(user, AuthService.AdminRole);
        }
    }

    // ---------- Helpers ----------

    private static readonly System.Linq.Expressions.Expression<Func<Review, AdminReviewDto>> ToRow = r => new AdminReviewDto(
        r.Id,
        r.Title,
        r.Rating,
        r.Comment,
        r.RecipeId,
        r.Recipe.Name,
        r.User.FullName,
        r.CreatedOn,
        r.IsHidden,
        r.Votes.Count,
        r.Replies.Count,
        r.Replies.Count(p => p.IsHidden));

    private async Task<AppUser> FindUserAsync(string userId) =>
        await _userManager.FindByIdAsync(userId) ?? throw new NotFoundException("User not found.");

    // COUNT for the total, then OFFSET/FETCH for one page.
    private static async Task<PagedResult<T>> PageAsync<T>(IQueryable<T> query, AdminListQuery q)
    {
        var page = Math.Max(1, q.Page);
        var pageSize = Math.Clamp(q.PageSize, 5, 50);
        var total = await query.CountAsync();
        var items = await query.Skip((page - 1) * pageSize).Take(pageSize).ToListAsync();
        return new PagedResult<T>(items, page, pageSize, total);
    }
}
