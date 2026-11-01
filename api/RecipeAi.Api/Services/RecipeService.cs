using Microsoft.EntityFrameworkCore;
using RecipeAi.Api.Data;
using RecipeAi.Api.Dtos;
using RecipeAi.Api.Errors;
using RecipeAi.Api.Models;
using RecipeAi.Api.Storage;

namespace RecipeAi.Api.Services;

public class RecipeService
{
    private const long MaxImageBytes = 2 * 1024 * 1024; // 2 MB

    // Allowed image types, checked by extension AND by the first bytes of the file ("magic numbers").
    private static readonly Dictionary<string, byte[]> ImageSignatures = new()
    {
        [".jpg"] = new byte[] { 0xFF, 0xD8, 0xFF },
        [".jpeg"] = new byte[] { 0xFF, 0xD8, 0xFF },
        [".png"] = new byte[] { 0x89, 0x50, 0x4E, 0x47 },
        [".webp"] = new byte[] { 0x52, 0x49, 0x46, 0x46 }, // "RIFF"
    };

    private readonly AppDbContext _db;
    private readonly IFileStorage _storage;

    public RecipeService(AppDbContext db, IFileStorage storage)
    {
        _db = db;
        _storage = storage;
    }

    public async Task<PagedResult<RecipeListItemDto>> GetPagedAsync(RecipeQuery query, string? currentUserId, bool isAdmin)
    {
        var page = Math.Max(1, query.Page);
        var pageSize = Math.Clamp(query.PageSize, 1, 50);

        // IQueryable: nothing runs in SQL Server until ToListAsync / CountAsync.
        var recipes = _db.Recipes.AsNoTracking().AsQueryable();

        if (!isAdmin)
        {
            // Hidden recipes stay visible to their author only.
            recipes = recipes.Where(r => !r.IsHidden || r.AuthorId == currentUserId);
        }

        if (!string.IsNullOrWhiteSpace(query.Search))
        {
            var term = query.Search.Trim();
            recipes = recipes.Where(r => r.Name.Contains(term) || r.Ingredients.Contains(term));
        }

        if (query.CategoryId is not null)
        {
            recipes = recipes.Where(r => r.CategoryId == query.CategoryId);
        }

        if (query.Difficulty is not null)
        {
            recipes = recipes.Where(r => r.Difficulty == query.Difficulty);
        }

        if (query.MaxMinutes is not null)
        {
            recipes = recipes.Where(r => r.PrepMinutes + r.CookMinutes <= query.MaxMinutes);
        }

        var total = await recipes.CountAsync();

        // The sort is translated to SQL ORDER BY (the average rating is computed by SQL Server too).
        var ordered = query.Sort switch
        {
            RecipeSort.TopRated => recipes
                .OrderByDescending(r => r.Reviews.Where(v => !v.IsHidden).Select(v => (double?)v.Rating).Average() ?? 0)
                .ThenByDescending(r => r.Reviews.Count(v => !v.IsHidden)),
            RecipeSort.Quickest => recipes.OrderBy(r => r.PrepMinutes + r.CookMinutes).ThenBy(r => r.Name),
            _ => recipes.OrderByDescending(r => r.CreatedOn),
        };

        var items = await ordered
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(r => new RecipeListItemDto(
                r.Id,
                r.Name,
                r.Description,
                r.Category.Name,
                r.Difficulty,
                r.PrepMinutes,
                r.CookMinutes,
                r.ImagePath,
                r.Reviews.Where(v => !v.IsHidden).Select(v => (double?)v.Rating).Average() ?? 0,
                r.Reviews.Count(v => !v.IsHidden),
                r.Author.FullName,
                r.IsHidden))
            .ToListAsync();

        return new PagedResult<RecipeListItemDto>(items, page, pageSize, total);
    }

    public async Task<RecipeDetailsDto> GetByIdAsync(int id, string? currentUserId, bool isAdmin)
    {
        var dto = await _db.Recipes
            .AsNoTracking()
            .Where(r => r.Id == id)
            .Select(r => new RecipeDetailsDto(
                r.Id,
                r.Name,
                r.Description,
                r.Ingredients,
                r.PrepMinutes,
                r.CookMinutes,
                r.Portions,
                r.Difficulty,
                r.ImagePath,
                r.CategoryId,
                r.Category.Name,
                r.AuthorId,
                r.Author.FullName,
                r.Reviews.Where(v => !v.IsHidden).Select(v => (double?)v.Rating).Average() ?? 0,
                r.Reviews.Count(v => !v.IsHidden),
                r.IsHidden,
                r.CreatedOn))
            .FirstOrDefaultAsync();

        // A hidden recipe looks like it doesn't exist (404) to everyone except its author and admins.
        if (dto is null || (dto.IsHidden && !isAdmin && dto.AuthorId != currentUserId))
        {
            throw new NotFoundException("Recipe not found.");
        }

        return dto;
    }

    public async Task<RecipeDetailsDto> CreateAsync(SaveRecipeDto dto, string userId)
    {
        await EnsureCategoryExistsAsync(dto.CategoryId);

        var recipe = new Recipe { AuthorId = userId };
        Apply(recipe, dto);
        _db.Recipes.Add(recipe);
        await _db.SaveChangesAsync();

        return await GetByIdAsync(recipe.Id, userId, isAdmin: false);
    }

    public async Task<RecipeDetailsDto> UpdateAsync(int id, SaveRecipeDto dto, string userId, bool isAdmin)
    {
        var recipe = await GetEditableAsync(id, userId, isAdmin);
        await EnsureCategoryExistsAsync(dto.CategoryId);

        Apply(recipe, dto);
        await _db.SaveChangesAsync();

        return await GetByIdAsync(id, userId, isAdmin);
    }

    public async Task DeleteAsync(int id, string userId, bool isAdmin)
    {
        var recipe = await GetEditableAsync(id, userId, isAdmin);
        var imagePath = recipe.ImagePath;

        _db.Recipes.Remove(recipe); // reviews and favorites are removed by cascade
        await _db.SaveChangesAsync();

        if (imagePath is not null)
        {
            await _storage.DeleteAsync(imagePath);
        }
    }

    public async Task<RecipeDetailsDto> SetImageAsync(int id, IFormFile file, string userId, bool isAdmin)
    {
        var recipe = await GetEditableAsync(id, userId, isAdmin);
        var extension = await ValidateImageAsync(file);

        await using var stream = file.OpenReadStream();
        var newPath = await _storage.SaveAsync(stream, extension, "recipes");

        var oldPath = recipe.ImagePath;
        recipe.ImagePath = newPath;
        await _db.SaveChangesAsync();

        if (oldPath is not null)
        {
            await _storage.DeleteAsync(oldPath);
        }

        return await GetByIdAsync(id, userId, isAdmin);
    }

    public async Task SetHiddenAsync(int id, bool hidden)
    {
        var recipe = await _db.Recipes.FindAsync(id) ?? throw new NotFoundException("Recipe not found.");
        recipe.IsHidden = hidden;
        await _db.SaveChangesAsync();
    }

    // Only the author or an admin may change a recipe.
    private async Task<Recipe> GetEditableAsync(int id, string userId, bool isAdmin)
    {
        var recipe = await _db.Recipes.FindAsync(id) ?? throw new NotFoundException("Recipe not found.");
        if (!isAdmin && recipe.AuthorId != userId)
        {
            throw new ForbiddenException("You can only modify your own recipes.");
        }

        return recipe;
    }

    private async Task EnsureCategoryExistsAsync(int categoryId)
    {
        if (!await _db.Categories.AnyAsync(c => c.Id == categoryId))
        {
            throw new BadRequestException("Category does not exist.");
        }
    }

    private static void Apply(Recipe recipe, SaveRecipeDto dto)
    {
        recipe.Name = dto.Name.Trim();
        recipe.Description = dto.Description.Trim();
        recipe.Ingredients = dto.Ingredients.Trim();
        recipe.PrepMinutes = dto.PrepMinutes;
        recipe.CookMinutes = dto.CookMinutes;
        recipe.Portions = dto.Portions;
        recipe.Difficulty = dto.Difficulty;
        recipe.CategoryId = dto.CategoryId;
    }

    private static async Task<string> ValidateImageAsync(IFormFile file)
    {
        if (file.Length == 0 || file.Length > MaxImageBytes)
        {
            throw new BadRequestException("Image must be between 1 byte and 2 MB.");
        }

        var extension = Path.GetExtension(file.FileName).ToLowerInvariant();
        if (!ImageSignatures.TryGetValue(extension, out var signature))
        {
            throw new BadRequestException("Only .jpg, .jpeg, .png and .webp images are allowed.");
        }

        // Don't trust the extension alone: read the first bytes and compare with the real format.
        var header = new byte[signature.Length];
        await using var stream = file.OpenReadStream();
        var read = await stream.ReadAsync(header);
        if (read < signature.Length || !header.SequenceEqual(signature))
        {
            throw new BadRequestException("The file content is not a valid image.");
        }

        return extension;
    }
}
