# Multi-stage build: the SDK image compiles, the small ASP.NET runtime image runs.
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

# Restore first (only the .csproj) so Docker caches the NuGet layer between builds.
COPY RecipeAi.Api/RecipeAi.Api.csproj RecipeAi.Api/
RUN dotnet restore RecipeAi.Api/RecipeAi.Api.csproj

COPY RecipeAi.Api/ RecipeAi.Api/
RUN dotnet publish RecipeAi.Api/RecipeAi.Api.csproj -c Release -o /app --no-restore

FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS runtime
WORKDIR /app
COPY --from=build /app .

# Uploaded images are written here, so the non-root "app" user must own it.
RUN mkdir -p /app/wwwroot/uploads && chown -R app:app /app/wwwroot
USER app

ENV ASPNETCORE_URLS=http://+:8080
EXPOSE 8080
ENTRYPOINT ["dotnet", "RecipeAi.Api.dll"]
