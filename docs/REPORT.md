# Recipe AI — Project Report (interview preparation)

Author: Youssef Dhouib · Repo: `youssefdhouib/recipe-ai-dotnet`

This report explains **what was built, how, and why**, step by step, so I can present and defend the project in technical interviews.

---

# Part 1 — Architecture, stack and how to run

## 1.1 What the app does
A recipe platform with an **AI ingredient-matching module**: a user enters the ingredients they have, and the API finds and ranks matching recipes from the database with an LLM, explains each match (matched / missing / extra ingredients), and proposes new recipe ideas when nothing matches well. Around it: accounts (JWT), recipes and categories, image upload, reviews and ratings, favorites, notifications and an admin role.

## 1.2 Architecture — classic layered Web API

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
│  │  └─ Program.cs     startup: dependency injection, auth, Swagger, middleware
│  └─ RecipeAi.Api.Tests/   xUnit tests
├─ web/                 Angular front end
├─ docs/REPORT.md       this report
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
- **Not used on purpose:** extra projects (Clean Architecture), MediatR, AutoMapper, generic repositories. *Interview answer:* "The app is small; EF Core's DbContext already is a unit of work + repository. Extra layers would add indirection without value. If the app grew, I would split it into Domain / Application / Infrastructure projects."

## 1.3 Tech stack and versions

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
| Front end | Angular + Tailwind | 19 (step 6) | Component framework used with .NET in many teams |
| Runtime for front tooling | Node.js | 22.22.1 | Angular CLI |

## 1.4 NestJS → ASP.NET Core translation

| NestJS (what I know) | ASP.NET Core (this project) |
|---|---|
| `@Controller('recipes')` | `[ApiController] [Route("api/recipes")]` class |
| `@Get(':id')` | `[HttpGet("{id}")]` method |
| `@Injectable()` provider | Service class registered in `Program.cs` (`AddScoped<RecipeService>()`) |
| Constructor injection | Constructor injection (same idea) |
| Module `providers: [...]` | `builder.Services.Add...()` in `Program.cs` |
| Prisma / TypeORM | Entity Framework Core (`AppDbContext`) |
| `prisma migrate` | `dotnet ef migrations add` / `database update` |
| DTO + class-validator | DTO + FluentValidation |
| Guards (`@UseGuards(AuthGuard)`) | `[Authorize]`, `[Authorize(Roles = "Admin")]` |
| Middleware / interceptors | Middleware pipeline in `Program.cs` |
| `.env` / ConfigService | `appsettings.json` + **user-secrets** + environment variables (`IConfiguration`) |

## 1.5 How to run

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

---

# Part 2 — Step by step

## Step 0 — Setup
**What we did**
- Installed the .NET 8 SDK into `~/.dotnet` with Microsoft's official `dotnet-install.sh` (no admin rights needed).
- Created the solution `RecipeAi.sln` with two projects: `RecipeAi.Api` (`dotnet new webapi --use-controllers`) and `RecipeAi.Api.Tests` (`dotnet new xunit`), the test project referencing the API.
- Added the NuGet packages listed in 1.3.
- `docker-compose.yml` runs SQL Server 2022; the SA password is generated into a git-ignored `.env`.
- `.gitignore` from `dotnet new gitignore` + `.env`, `uploads/`, `.tools/`.

**Concepts**
- **Solution (.sln) vs project (.csproj):** a solution groups projects; a project compiles to one assembly (DLL). The test project *references* the API project so tests can use its classes.
- **NuGet** = npm for .NET. Package versions are pinned in the `.csproj`.
- **user-secrets:** per-developer config stored outside the repo, loaded automatically in Development. In production you would use environment variables or Azure Key Vault.

## Step 1 — Models and database
**What we built**

| File | Role |
|---|---|
| `Models/BaseEntity.cs` | Base class: `Id`, `CreatedOn`, `ModifiedOn` |
| `Models/AppUser.cs` | User account; extends Identity's `IdentityUser` with `FullName` |
| `Models/Category.cs` | Recipe category (unique name) |
| `Models/Recipe.cs` | Recipe: text fields, times, portions, `Difficulty`, image, `IsHidden`, category and author |
| `Models/Review.cs` | Rating 1–5 + comment, one per user per recipe |
| `Models/Favorite.cs` | Link user ↔ recipe (unique pair) |
| `Models/Notification.cs` | Message for a user with a link and a read flag |
| `Models/Difficulty.cs` | Enum Easy / Medium / Hard (stored as int) |
| `Data/AppDbContext.cs` | EF Core context: tables, relationships, indexes, automatic audit dates |
| `Data/SeedData.cs` | At startup: apply migrations, insert the 6 categories if missing |
| `Data/Migrations/*_InitialCreate.cs` | Generated SQL schema (C#), versioned with the code |
| `Program.cs` | Registers `AppDbContext` with SQL Server, runs the seed, Swagger |

**Key code explained**
- `AppDbContext : IdentityDbContext<AppUser>` — inheriting from `IdentityDbContext` adds the Identity tables (`AspNetUsers`, `AspNetRoles`, ...). Our own tables are the `DbSet<T>` properties.
- `OnModelCreating` — the "Fluent API": max lengths, **unique indexes** (`Category.Name`, `(UserId, RecipeId)` for reviews and favorites), and **delete behaviour**:
  - `Restrict` on Recipe → Category and Recipe → Author: you cannot delete a category or user that still owns recipes.
  - `Cascade` on Review/Favorite → Recipe: deleting a recipe removes its reviews and favorites.
  - Why not cascade everywhere? SQL Server refuses **multiple cascade paths** to the same table (User → Recipe → Review and User → Review). Restricting the author link avoids that.
- `SaveChangesAsync` override — walks the **ChangeTracker** and sets `CreatedOn` / `ModifiedOn` for every `BaseEntity`, so no service ever forgets it.
- `builder.Services.AddDbContext<AppDbContext>(...)` — registers the context in DI with a **scoped** lifetime (one instance per HTTP request).
- `SeedData.InitializeAsync` — creates a DI scope, calls `Database.MigrateAsync()` (applies pending migrations), then inserts categories only if they don't exist (**idempotent**: safe to run at every start).

**Choices**
- Code-first migrations: the schema lives in C# and in Git, reviewable like code.
- No soft delete: admins **hide** content (`IsHidden`) instead; a real delete is a real delete. Simpler queries, no hidden global filters to explain.
- Ingredients stored as free text: users type naturally; the AI module normalises them.

**Likely interview questions**
- *What is EF Core and why use it?* — An ORM: I write C# classes and LINQ, it generates SQL and maps results back. Migrations keep the schema versioned with the code.
- *What is a migration?* — A C# file describing a schema change (Up/Down). `dotnet ef migrations add X` generates it from the model diff; `Database.Migrate()` or `dotnet ef database update` applies it.
- *What does a unique index on (UserId, RecipeId) give you?* — The database itself guarantees one favorite / one review per user and recipe, even with concurrent requests; the service still checks first to return a clean error.
- *Why DTOs if you have Models?* — Models are the database shape; DTOs are the API contract. Separating them avoids leaking fields (password hash, internal flags) and lets the DB change without breaking clients.
- *What lifetime does DbContext have and why?* — Scoped: one per request. It is not thread-safe and tracks entities for one unit of work.
