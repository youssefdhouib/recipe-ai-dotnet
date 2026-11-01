namespace RecipeAi.Api.Storage;

// An interface because the storage will change: local disk today, Azure Blob Storage in production.
// Services only know this contract, not where files really go.
public interface IFileStorage
{
    // Saves the file and returns its public path, e.g. "/uploads/recipes/abc.jpg".
    Task<string> SaveAsync(Stream content, string extension, string folder, CancellationToken cancellationToken = default);

    Task DeleteAsync(string publicPath, CancellationToken cancellationToken = default);
}
