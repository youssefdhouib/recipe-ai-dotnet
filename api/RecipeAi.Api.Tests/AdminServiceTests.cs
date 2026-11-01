using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using RecipeAi.Api.Data;
using RecipeAi.Api.Dtos;
using RecipeAi.Api.Errors;
using RecipeAi.Api.Models;
using RecipeAi.Api.Services;

namespace RecipeAi.Api.Tests;

// Account rules of the admin area, with a real UserManager on an in-memory database.
public class AdminServiceTests
{
    [Fact]
    public async Task Ban_locks_the_account_and_unban_restores_it()
    {
        var (service, users, _) = Create();
        var bob = await users.FindByIdAsync("bob");

        await service.BanAsync("bob", "admin");
        Assert.True(await users.IsLockedOutAsync(bob!));

        await service.UnbanAsync("bob");
        Assert.False(await users.IsLockedOutAsync(bob!));
    }

    [Fact]
    public async Task Cannot_ban_yourself_or_another_admin()
    {
        var (service, users, _) = Create();
        await service.SetAdminAsync("bob", true, "admin");

        await Assert.ThrowsAsync<BadRequestException>(() => service.BanAsync("admin", "admin"));
        await Assert.ThrowsAsync<BadRequestException>(() => service.BanAsync("bob", "admin"));
    }

    [Fact]
    public async Task Admin_role_can_be_given_and_removed_but_not_on_yourself()
    {
        var (service, users, _) = Create();

        await service.SetAdminAsync("bob", true, "admin");
        Assert.True(await users.IsInRoleAsync((await users.FindByIdAsync("bob"))!, AuthService.AdminRole));

        await service.SetAdminAsync("bob", false, "admin");
        Assert.False(await users.IsInRoleAsync((await users.FindByIdAsync("bob"))!, AuthService.AdminRole));

        await Assert.ThrowsAsync<BadRequestException>(() => service.SetAdminAsync("admin", false, "admin"));
    }

    [Fact]
    public async Task User_list_filters_banned_accounts_and_marks_the_current_admin()
    {
        var (service, _, _) = Create();
        await service.BanAsync("bob", "admin");

        var banned = await service.GetUsersAsync(new AdminListQuery { Status = "banned" }, "admin");
        var all = await service.GetUsersAsync(new AdminListQuery(), "admin");

        Assert.Equal("bob", Assert.Single(banned.Items).Id);
        Assert.Equal(3, all.TotalCount);
        Assert.True(all.Items.Single(u => u.Id == "admin").IsMe);
        Assert.True(all.Items.Single(u => u.Id == "admin").IsAdmin);
    }

    [Fact]
    public async Task Recipe_list_searches_and_pages()
    {
        var (service, _, db) = Create();
        var category = new Category { Name = "Soup" };
        for (var i = 1; i <= 7; i++)
        {
            db.Recipes.Add(new Recipe { Name = $"Soup {i}", Ingredients = "water", AuthorId = "bob", Category = category, IsHidden = i == 7 });
        }

        await db.SaveChangesAsync();

        // "Soup", not "soup": the in-memory provider compares case-sensitively (SQL Server does not).
        var page2 = await service.GetRecipesAsync(new AdminListQuery { Search = "Soup", Page = 2, PageSize = 5 });
        var hidden = await service.GetRecipesAsync(new AdminListQuery { Status = "hidden" });

        Assert.Equal(7, page2.TotalCount);
        Assert.Equal(2, page2.Items.Count);
        Assert.Equal("Soup 7", Assert.Single(hidden.Items).Name);
    }

    private static (AdminService Service, UserManager<AppUser> Users, AppDbContext Db) Create()
    {
        var db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options);

        var adminRole = new IdentityRole(AuthService.AdminRole) { NormalizedName = AuthService.AdminRole.ToUpperInvariant() };
        db.Roles.Add(adminRole);
        foreach (var id in new[] { "admin", "bob", "eve" })
        {
            db.Users.Add(new AppUser { Id = id, UserName = id, Email = $"{id}@test", FullName = id.ToUpperInvariant(), LockoutEnabled = true });
        }

        db.UserRoles.Add(new IdentityUserRole<string> { UserId = "admin", RoleId = adminRole.Id });
        db.SaveChanges();

        var users = new UserManager<AppUser>(
            new UserStore<AppUser>(db), null, new PasswordHasher<AppUser>(), null, null,
            new UpperInvariantLookupNormalizer(), new IdentityErrorDescriber(), null, NullLogger<UserManager<AppUser>>.Instance);

        return (new AdminService(db, users), users, db);
    }
}
