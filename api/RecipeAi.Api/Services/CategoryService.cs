using Microsoft.EntityFrameworkCore;
using RecipeAi.Api.Data;
using RecipeAi.Api.Dtos;
using RecipeAi.Api.Errors;
using RecipeAi.Api.Models;

namespace RecipeAi.Api.Services;

public class CategoryService
{
    private readonly AppDbContext _db;

    public CategoryService(AppDbContext db)
    {
        _db = db;
    }

    public async Task<IReadOnlyList<CategoryDto>> GetAllAsync() =>
        await _db.Categories
            .AsNoTracking()
            .OrderBy(c => c.Name)
            .Select(c => new CategoryDto(
                c.Id,
                c.Name,
                c.Description,
                c.Recipes.Count(r => !r.IsHidden),
                c.Recipes.Where(r => !r.IsHidden && r.ImagePath != null)
                    .OrderByDescending(r => r.CreatedOn)
                    .Select(r => r.ImagePath)
                    .FirstOrDefault()))
            .ToListAsync();

    public async Task<CategoryDto> CreateAsync(SaveCategoryDto dto)
    {
        await EnsureNameIsFreeAsync(dto.Name, excludeId: null);

        var category = new Category { Name = dto.Name.Trim(), Description = dto.Description.Trim() };
        _db.Categories.Add(category);
        await _db.SaveChangesAsync();

        return new CategoryDto(category.Id, category.Name, category.Description, 0);
    }

    public async Task<CategoryDto> UpdateAsync(int id, SaveCategoryDto dto)
    {
        var category = await _db.Categories.FindAsync(id) ?? throw new NotFoundException("Category not found.");
        await EnsureNameIsFreeAsync(dto.Name, excludeId: id);

        category.Name = dto.Name.Trim();
        category.Description = dto.Description.Trim();
        await _db.SaveChangesAsync();

        var count = await _db.Recipes.CountAsync(r => r.CategoryId == id && !r.IsHidden);
        return new CategoryDto(category.Id, category.Name, category.Description, count);
    }

    public async Task DeleteAsync(int id)
    {
        var category = await _db.Categories.FindAsync(id) ?? throw new NotFoundException("Category not found.");

        // Matches the Restrict rule in AppDbContext, but with a clear message instead of a SQL error.
        if (await _db.Recipes.AnyAsync(r => r.CategoryId == id))
        {
            throw new ConflictException("This category still has recipes. Move or delete them first.");
        }

        _db.Categories.Remove(category);
        await _db.SaveChangesAsync();
    }

    private async Task EnsureNameIsFreeAsync(string name, int? excludeId)
    {
        var trimmed = name.Trim();
        if (await _db.Categories.AnyAsync(c => c.Name == trimmed && c.Id != excludeId))
        {
            throw new ConflictException($"A category named '{trimmed}' already exists.");
        }
    }
}
