# Recipe AI — Architecture

## What the app does
A recipe platform with an **AI ingredient-matching module**: a user enters the ingredients they have, and the API finds and ranks matching recipes from the database with an LLM, explains each match (matched / missing / extra ingredients), and proposes new recipe ideas when nothing matches well. Around it: accounts (JWT), recipes and categories, image upload, reviews and ratings, favorites, notifications and an admin role.

## Architecture — classic layered Web API

```
recipe-ai-dotnet/
├─ api/
│  ├─ RecipeAi.Api/
│  │  ├─ Controllers/   receive HTTP, call a service, return the result (no business logic)
│  │  ├─ Services/      business rules (RecipeService, AuthService, ReviewService, ...)
│  │  ├─ Ai/            the AI module: IAiProvider, GroqAiProvider, OfflineAiProvider,
│  │  │                 AiResponseValidator, SuggestionService
│  │  ├─ Models/        database tables as C# classes (Recipe, Category, Review, ...)
│  │  ├─ Dtos/          what goes in / out of the API (never expose Models directly)
│  │  ├─ Data/          AppDbContext (EF Core), Migrations/, SeedData
│  │  ├─ Storage/       IFileStorage + LocalFileStorage (image upload)
│  │  ├─ Errors/        GlobalExceptionHandler (ProblemDetails), ValidationFilter, AppExceptions
│  │  └─ Program.cs     startup: dependency injection, auth, Swagger, middleware
│  └─ RecipeAi.Api.Tests/   xUnit tests
├─ web/                 Angular front end
├─ docs/ARCHITECTURE.md this document
└─ docker-compose.yml   SQL Server (and later the API)
```

**The one rule — request flow:**

```
HTTP request
   │
   ▼
Controller      (Controllers/RecipesController)   reads the request, checks auth, returns status codes
   │ calls
   ▼
Service         (Services/RecipeService)          business rules: who can edit, validation, mapping to DTOs
   │ uses
   ▼
AppDbContext    (Data/AppDbContext)               EF Core turns LINQ into SQL
   │
   ▼
SQL Server 2022 (Docker)
```

**Why this structure?**
- It is the standard ASP.NET Core Web API layout (the one from Microsoft's templates and docs), so any .NET developer understands it immediately.
- Each layer has one job: HTTP / business rules / data. Easy to test and to explain.
- **Interfaces only where a dependency is likely to change:** `IAiProvider` (Groq today, Azure OpenAI or Gemini tomorrow, an offline fake for tests) and `IFileStorage` (local disk today, Azure Blob tomorrow). Everything else is a plain class injected with DI.
- **Not used on purpose:** extra projects (Clean Architecture), MediatR, AutoMapper, generic repositories. "The app is small; EF Core's DbContext already is a unit of work + repository. Extra layers would add indirection without value. If the app grew, I would split it into Domain / Application / Infrastructure projects."

## Tech stack and versions

| Area | Technology | Version | Why |
|---|---|---|---|
| SDK / runtime | .NET SDK / ASP.NET Core runtime | 8.0.427 / 8.0.33 | .NET 8 is the current **LTS** (long-term support) release |
| Web API | ASP.NET Core Web API (controllers) | 8.0 | Standard way to build REST APIs in .NET |
| ORM | Entity Framework Core (SqlServer, Design) | 8.0.11 | Maps C# classes to tables, LINQ queries, migrations |
| Database | SQL Server 2022 (Docker image `mcr.microsoft.com/mssql/server:2022-latest`) | 2022 | The database used in Microsoft-stack companies |
| Accounts | ASP.NET Core Identity (EntityFrameworkCore) | 8.0.11 | Password hashing, users and roles out of the box |
| Auth | JWT Bearer authentication | 8.0.11 | Stateless tokens for an Angular SPA |
| Validation | FluentValidation | 11.11.0 | Readable validation rules, separate from controllers |
| HTTP resilience | Microsoft.Extensions.Http.Resilience | 8.10.0 | Retries + timeouts for the AI API calls |
| API docs | Swashbuckle (Swagger UI) | 6.6.2 | Interactive documentation and manual testing |
| Tests | xUnit + EF Core InMemory | 2.5.3 / 8.0.11 | Unit tests for the AI validation and pipeline |
| Migrations tool | dotnet-ef (local tool in `.tools/`) | 8.0.11 | Creates and applies migrations |
| Front end | Angular + Tailwind | 19 | Component framework used with .NET in many teams |
| Runtime for front tooling | Node.js | 22.22.1 | Angular CLI |

## How to run

```bash
# 1. Start SQL Server (password comes from the local .env file, never committed)
docker compose up -d

# 2. Store secrets locally (once)
cd api/RecipeAi.Api
dotnet user-secrets set "ConnectionStrings:Default" "Server=localhost,1433;Database=RecipeAi;User Id=sa;Password=<your password>;TrustServerCertificate=True"

# 3. Run the API — migrations and seed data are applied automatically at startup
dotnet run
# Swagger UI: http://localhost:5295/swagger
```

**Secrets policy:** no password or API key is ever committed. Local secrets live in `dotnet user-secrets` (stored outside the repo, in `~/.microsoft/usersecrets/`) and `.env` (git-ignored).

## AI module design
- `IAiProvider` returns the model's raw JSON; `GroqAiProvider` (typed `HttpClient` + standard resilience handler: retries, timeouts, circuit breaker; JSON mode) or `OfflineAiProvider` (no network), chosen by configuration.
- `AiResponseValidator` treats model output as untrusted input: JSON shape checked, only candidate ids kept, **score computed from matched/missing lists**, lists capped, text truncated.
- `SuggestionService`: clean input → candidates from SQL Server (max 25) → normalise → rank → validate → recipes the model omitted are keyword-scored → ideas when the best score < 40 → **keyword fallback** on any AI failure (`aiAvailable = false`).
- `POST /api/suggestions` is rate-limited (10 requests/minute/IP); every AI call is logged with its duration.
