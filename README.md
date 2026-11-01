# Recipe AI

Recipe platform with an **AI ingredient-matching module**: enter the ingredients you have, and the API ranks matching recipes with an LLM, explains each match, and suggests new ideas when nothing fits.

**Stack:** ASP.NET Core 8 Web API · Entity Framework Core 8 · SQL Server 2022 · ASP.NET Core Identity + JWT · Groq LLM API (swappable provider) · xUnit · Angular

**Architecture:** classic layered Web API: `Controller → Service → AppDbContext → SQL Server`. Details, design choices and a step-by-step build log are in [docs/REPORT.md](docs/REPORT.md).

## Run locally

```bash
docker compose up -d                      # SQL Server (password in a local .env file)
cd api/RecipeAi.Api
dotnet user-secrets set "ConnectionStrings:Default" "Server=localhost,1433;Database=RecipeAi;User Id=sa;Password=<password>;TrustServerCertificate=True"
dotnet run                                # Swagger: http://localhost:5295/swagger
```

> Work in progress. Built step by step; see the report for the current state.
