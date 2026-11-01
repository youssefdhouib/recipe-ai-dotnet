namespace RecipeAi.Api.Storage;

// Stores files under wwwroot/uploads, served by UseStaticFiles() in Program.cs.
public class LocalFileStorage : IFileStorage
{
    private const string UploadsRoot = "uploads";
    private readonly string _webRoot;

    public LocalFileStorage(IWebHostEnvironment env)
    {
        _webRoot = env.WebRootPath ?? Path.Combine(env.ContentRootPath, "wwwroot");
    }

    public async Task<string> SaveAsync(Stream content, string extension, string folder, CancellationToken cancellationToken = default)
    {
        // Random file name: never trust or reuse the name sent by the user.
        var fileName = $"{Guid.NewGuid():N}{extension}";
        var directory = Path.Combine(_webRoot, UploadsRoot, folder);
        Directory.CreateDirectory(directory);

        await using var file = File.Create(Path.Combine(directory, fileName));
        await content.CopyToAsync(file, cancellationToken);

        return $"/{UploadsRoot}/{folder}/{fileName}";
    }

    public Task DeleteAsync(string publicPath, CancellationToken cancellationToken = default)
    {
        // Only delete files we created (inside wwwroot/uploads), never an arbitrary path.
        if (!publicPath.StartsWith($"/{UploadsRoot}/", StringComparison.Ordinal))
        {
            return Task.CompletedTask;
        }

        var fullPath = Path.GetFullPath(Path.Combine(_webRoot, publicPath.TrimStart('/')));
        var uploadsDir = Path.GetFullPath(Path.Combine(_webRoot, UploadsRoot));
        if (fullPath.StartsWith(uploadsDir, StringComparison.Ordinal) && File.Exists(fullPath))
        {
            File.Delete(fullPath);
        }

        return Task.CompletedTask;
    }
}
