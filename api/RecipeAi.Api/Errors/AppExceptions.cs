namespace RecipeAi.Api.Errors;

// Services throw these when a business rule fails.
// GlobalExceptionHandler turns them into the right HTTP status code, so controllers stay clean.
public class AppException : Exception
{
    public AppException(string message, int statusCode)
        : base(message)
    {
        StatusCode = statusCode;
    }

    public int StatusCode { get; }
}

public class NotFoundException(string message) : AppException(message, StatusCodes.Status404NotFound);

public class BadRequestException(string message) : AppException(message, StatusCodes.Status400BadRequest);

public class ForbiddenException(string message) : AppException(message, StatusCodes.Status403Forbidden);

public class ConflictException(string message) : AppException(message, StatusCodes.Status409Conflict);

public class UnauthorizedException(string message) : AppException(message, StatusCodes.Status401Unauthorized);
