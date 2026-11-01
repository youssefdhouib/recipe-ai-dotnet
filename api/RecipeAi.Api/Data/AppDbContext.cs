using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using RecipeAi.Api.Models;

namespace RecipeAi.Api.Data;

// The bridge between C# objects and SQL Server tables (EF Core).
// IdentityDbContext adds the user/role tables (AspNetUsers, AspNetRoles...) for us.
public class AppDbContext : IdentityDbContext<AppUser>
{
    public AppDbContext(DbContextOptions<AppDbContext> options)
        : base(options)
    {
    }

    public DbSet<Recipe> Recipes => Set<Recipe>();

    public DbSet<Category> Categories => Set<Category>();

    public DbSet<Review> Reviews => Set<Review>();

    public DbSet<Favorite> Favorites => Set<Favorite>();

    public DbSet<Notification> Notifications => Set<Notification>();

    public DbSet<AiCallLog> AiCallLogs => Set<AiCallLog>();

    protected override void OnModelCreating(ModelBuilder builder)
    {
        base.OnModelCreating(builder);

        builder.Entity<Category>(e =>
        {
            e.Property(c => c.Name).HasMaxLength(60);
            e.Property(c => c.Description).HasMaxLength(300);
            e.HasIndex(c => c.Name).IsUnique();
        });

        builder.Entity<Recipe>(e =>
        {
            e.Property(r => r.Name).HasMaxLength(120);
            e.Property(r => r.Description).HasMaxLength(2000);
            e.Property(r => r.Ingredients).HasMaxLength(2000);
            e.Property(r => r.ImagePath).HasMaxLength(300);

            // Restrict: you cannot delete a category or a user that still owns recipes.
            e.HasOne(r => r.Category).WithMany(c => c.Recipes)
                .HasForeignKey(r => r.CategoryId).OnDelete(DeleteBehavior.Restrict);
            e.HasOne(r => r.Author).WithMany()
                .HasForeignKey(r => r.AuthorId).OnDelete(DeleteBehavior.Restrict);
        });

        builder.Entity<Review>(e =>
        {
            e.Property(r => r.Comment).HasMaxLength(1000);
            e.HasIndex(r => new { r.UserId, r.RecipeId }).IsUnique();

            // Cascade: deleting a recipe deletes its reviews.
            e.HasOne(r => r.Recipe).WithMany(x => x.Reviews)
                .HasForeignKey(r => r.RecipeId).OnDelete(DeleteBehavior.Cascade);
            e.HasOne(r => r.User).WithMany()
                .HasForeignKey(r => r.UserId).OnDelete(DeleteBehavior.Cascade);
        });

        builder.Entity<Favorite>(e =>
        {
            e.HasIndex(f => new { f.UserId, f.RecipeId }).IsUnique();
            e.HasOne(f => f.Recipe).WithMany(r => r.Favorites)
                .HasForeignKey(f => f.RecipeId).OnDelete(DeleteBehavior.Cascade);
            e.HasOne(f => f.User).WithMany()
                .HasForeignKey(f => f.UserId).OnDelete(DeleteBehavior.Cascade);
        });

        builder.Entity<Notification>(e =>
        {
            e.Property(n => n.Text).HasMaxLength(300);
            e.Property(n => n.Link).HasMaxLength(200);
            e.HasIndex(n => new { n.UserId, n.IsRead });
            e.HasOne(n => n.User).WithMany()
                .HasForeignKey(n => n.UserId).OnDelete(DeleteBehavior.Cascade);
        });

        builder.Entity<AiCallLog>(e =>
        {
            e.Property(l => l.Step).HasMaxLength(20);
            e.Property(l => l.Provider).HasMaxLength(80);
            e.HasIndex(l => l.CreatedOn); // the dashboard always filters on the last N days
        });
    }

    // Fill CreatedOn / ModifiedOn automatically so services never have to.
    public override Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
    {
        var now = DateTime.UtcNow;
        foreach (var entry in ChangeTracker.Entries<BaseEntity>())
        {
            if (entry.State == EntityState.Added)
            {
                entry.Entity.CreatedOn = now;
            }
            else if (entry.State == EntityState.Modified)
            {
                entry.Entity.ModifiedOn = now;
            }
        }

        return base.SaveChangesAsync(cancellationToken);
    }
}
