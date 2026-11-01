using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using RecipeAi.Api.Models;
using RecipeAi.Api.Services;

namespace RecipeAi.Api.Data;

// Runs once at startup: applies pending migrations, then inserts starter data if missing.
// Every part is idempotent: running it again changes nothing.
public static class SeedData
{
    private static readonly (string Name, string Description)[] Categories =
    {
        ("Pasta", "Pasta dishes, from quick lunches to slow sauces."),
        ("Main Dish", "Meat, fish and vegetarian main courses."),
        ("Rice", "Risottos, pilafs and rice bowls."),
        ("Soup", "Warm soups and broths."),
        ("Salad", "Fresh salads and bowls."),
        ("Dessert", "Cakes, pastries and sweet treats."),
    };

    public static async Task InitializeAsync(IServiceProvider services)
    {
        using var scope = services.CreateScope();
        var provider = scope.ServiceProvider;
        var db = provider.GetRequiredService<AppDbContext>();
        var logger = provider.GetRequiredService<ILoggerFactory>().CreateLogger("SeedData");

        await db.Database.MigrateAsync();
        await SeedCategoriesAsync(db);
        await SeedRolesAsync(provider.GetRequiredService<RoleManager<IdentityRole>>());

        var admin = await SeedAdminAsync(
            provider.GetRequiredService<UserManager<AppUser>>(),
            provider.GetRequiredService<IConfiguration>(),
            logger);

        if (admin is not null)
        {
            await SeedRecipesAsync(db, admin.Id);
        }
    }

    private static async Task SeedCategoriesAsync(AppDbContext db)
    {
        foreach (var (name, description) in Categories)
        {
            if (!await db.Categories.AnyAsync(c => c.Name == name))
            {
                db.Categories.Add(new Category { Name = name, Description = description });
            }
        }

        await db.SaveChangesAsync();
    }

    private static async Task SeedRolesAsync(RoleManager<IdentityRole> roleManager)
    {
        foreach (var role in new[] { AuthService.UserRole, AuthService.AdminRole })
        {
            if (!await roleManager.RoleExistsAsync(role))
            {
                await roleManager.CreateAsync(new IdentityRole(role));
            }
        }
    }

    // The admin password is never in the code: it comes from user-secrets / environment variables.
    private static async Task<AppUser?> SeedAdminAsync(UserManager<AppUser> userManager, IConfiguration config, ILogger logger)
    {
        var email = config["Seed:AdminEmail"];
        var password = config["Seed:AdminPassword"];
        if (string.IsNullOrWhiteSpace(email) || string.IsNullOrWhiteSpace(password))
        {
            logger.LogWarning("Seed:AdminEmail / Seed:AdminPassword not set: admin and demo recipes are skipped.");
            return null;
        }

        var admin = await userManager.FindByEmailAsync(email);
        if (admin is null)
        {
            admin = new AppUser { UserName = email, Email = email, FullName = "Recipe AI Admin" };
            var result = await userManager.CreateAsync(admin, password);
            if (!result.Succeeded)
            {
                logger.LogError("Admin creation failed: {Errors}", string.Join(" ", result.Errors.Select(e => e.Description)));
                return null;
            }

            await userManager.AddToRolesAsync(admin, new[] { AuthService.UserRole, AuthService.AdminRole });
        }

        return admin;
    }

    private static async Task SeedRecipesAsync(AppDbContext db, string authorId)
    {
        var categories = await db.Categories.ToDictionaryAsync(c => c.Name, c => c.Id);

        var recipes = new[]
        {
            new Recipe
            {
                Name = "Rustic Tomato Pasta", CategoryId = categories["Pasta"], Difficulty = Difficulty.Easy,
                Description = "A simple and fresh pasta dish perfect for a quick lunch.",
                Ingredients = "200g spaghetti, 2 ripe tomatoes, 1 small onion, 3 cloves of garlic, olive oil, fresh basil, salt, black pepper",
                PrepMinutes = 10, CookMinutes = 15, Portions = 2,
                ImagePath = "https://images.unsplash.com/photo-1598866594230-a7c12756260f?auto=format&fit=crop&q=80&w=800",
            },
            new Recipe
            {
                Name = "Garlic Butter Chicken", CategoryId = categories["Main Dish"], Difficulty = Difficulty.Medium,
                Description = "Juicy chicken breasts pan-seared with plenty of garlic and butter.",
                Ingredients = "2 chicken breasts, 50g butter, 4 cloves of garlic, fresh parsley, 1 tablespoon olive oil, salt",
                PrepMinutes = 5, CookMinutes = 15, Portions = 2,
                ImagePath = "https://images.unsplash.com/photo-1598103442097-8b74394b95c6?auto=format&fit=crop&q=80&w=800",
            },
            new Recipe
            {
                Name = "Chicken & Tomato Risotto", CategoryId = categories["Rice"], Difficulty = Difficulty.Hard,
                Description = "Creamy risotto with seared chicken and roasted tomatoes.",
                Ingredients = "1 cup arborio rice, 1 chicken breast, 1/2 onion, 3 tomatoes, chicken broth, parmesan, olive oil, white wine",
                PrepMinutes = 10, CookMinutes = 40, Portions = 4,
                ImagePath = "https://images.unsplash.com/photo-1476124369491-e7addf5db371?auto=format&fit=crop&q=80&w=800",
            },
            new Recipe
            {
                Name = "Garden Vegetable Soup", CategoryId = categories["Soup"], Difficulty = Difficulty.Easy,
                Description = "A warming soup filled with seasonal vegetables.",
                Ingredients = "2 carrots, 1 onion, 2 potatoes, 1 cup green peas, vegetable stock, dried oregano, salt",
                PrepMinutes = 15, CookMinutes = 30, Portions = 4,
                ImagePath = "https://images.unsplash.com/photo-1547592166-23ac45744acd?auto=format&fit=crop&q=80&w=800",
            },
            new Recipe
            {
                Name = "Shakshuka", CategoryId = categories["Main Dish"], Difficulty = Difficulty.Easy,
                Description = "Eggs poached in a spiced tomato and pepper sauce, a North African classic.",
                Ingredients = "4 eggs, 4 tomatoes, 1 red pepper, 1 onion, 2 cloves of garlic, harissa, cumin, olive oil, salt",
                PrepMinutes = 10, CookMinutes = 20, Portions = 2,
                ImagePath = "https://images.unsplash.com/photo-1590412200988-a436970781fa?auto=format&fit=crop&q=80&w=800",
            },
            new Recipe
            {
                Name = "Red Lentil Soup", CategoryId = categories["Soup"], Difficulty = Difficulty.Easy,
                Description = "Smooth, filling lentil soup with cumin and lemon.",
                Ingredients = "1 cup red lentils, 1 onion, 1 carrot, 2 cloves of garlic, cumin, lemon, vegetable stock, olive oil",
                PrepMinutes = 10, CookMinutes = 25, Portions = 4,
            },
            new Recipe
            {
                Name = "Greek Salad", CategoryId = categories["Salad"], Difficulty = Difficulty.Easy,
                Description = "Tomatoes, cucumber, olives and feta with oregano.",
                Ingredients = "3 tomatoes, 1 cucumber, 1 red onion, feta cheese, black olives, olive oil, dried oregano",
                PrepMinutes = 10, CookMinutes = 0, Portions = 2,
                ImagePath = "https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&q=80&w=800",
            },
            new Recipe
            {
                Name = "Chocolate Mug Cake", CategoryId = categories["Dessert"], Difficulty = Difficulty.Easy,
                Description = "A one-minute microwave chocolate cake.",
                Ingredients = "4 tablespoons flour, 2 tablespoons cocoa powder, 2 tablespoons sugar, 1 egg, 3 tablespoons milk, 2 tablespoons oil",
                PrepMinutes = 3, CookMinutes = 2, Portions = 1,
                ImagePath = "https://images.unsplash.com/photo-1606313564200-e75d5e30476c?auto=format&fit=crop&q=80&w=800",
            },
        };

        foreach (var recipe in recipes)
        {
            if (!await db.Recipes.AnyAsync(r => r.Name == recipe.Name))
            {
                recipe.AuthorId = authorId;
                db.Recipes.Add(recipe);
            }
        }

        await db.SaveChangesAsync();
    }
}
