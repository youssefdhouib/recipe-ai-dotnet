using Microsoft.EntityFrameworkCore;
using RecipeAi.Api.Models;

namespace RecipeAi.Api.Data;

// Runs once at startup: applies pending migrations, then inserts starter data if missing.
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
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        await db.Database.MigrateAsync();
        await SeedCategoriesAsync(db);
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
}
