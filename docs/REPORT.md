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

## Step 2 — Accounts, JWT authentication, validation and error handling
**What we built**

| File | Role |
|---|---|
| `Controllers/AuthController.cs` | `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me` (protected) |
| `Services/AuthService.cs` | Register (unique email, password rules, role `User`), login (password check), current user |
| `Services/TokenService.cs` | Builds the signed JWT with the user id, email, name and roles as **claims** |
| `Controllers/ClaimsPrincipalExtensions.cs` | `User.GetUserId()` / `User.IsAdmin()` helpers for controllers |
| `Dtos/AuthDtos.cs` | `RegisterDto`, `LoginDto`, `UserDto`, `AuthResponseDto` (C# `record`s) |
| `Dtos/AuthValidators.cs` | FluentValidation rules (valid email, password ≥ 8, name required) |
| `Errors/AppExceptions.cs` | `NotFound/BadRequest/Forbidden/Conflict/Unauthorized` exceptions carrying a status code |
| `Errors/GlobalExceptionHandler.cs` | Turns any exception into a standard JSON error (**ProblemDetails**) |
| `Errors/ValidationFilter.cs` | Runs the matching validator before every action; invalid input → 400 with field errors |
| `Data/SeedData.cs` | Now also creates the roles `User` / `Admin`, the admin account (password from user-secrets) and 8 demo recipes |
| `Program.cs` | Registers Identity, JWT bearer auth, our services, validators, the exception handler and Swagger's "Authorize" button |

**How login works (explain it like this)**
1. `POST /api/auth/login` → `AuthService` finds the user and checks the password hash with Identity's `UserManager.CheckPasswordAsync`.
2. `TokenService` creates a **JWT**: a signed JSON with claims (`nameidentifier` = user id, `email`, `name`, `role`) and an expiry (120 min). It's signed with HMAC-SHA256 and the secret `Jwt:Key`.
3. The Angular app sends it on every request: `Authorization: Bearer <token>`.
4. `UseAuthentication()` validates the signature, issuer, audience and expiry, then fills `User` (a `ClaimsPrincipal`). `[Authorize]` refuses anonymous calls with 401, and `[Authorize(Roles = "Admin")]` refuses non-admins with 403.

**Key concepts**
- **Identity** gives us password hashing (PBKDF2), unique emails, roles and the `AspNetUsers` / `AspNetRoles` tables. We use `AddIdentityCore` (no cookies or UI), because the API only issues JWTs.
- **Stateless auth:** the server stores no session. Everything it needs is in the signed token. This scales easily, but a token can't be revoked before it expires (the answer: short expiry + refresh tokens).
- **Middleware order:** `UseExceptionHandler` → `UseAuthentication` (who are you?) → `UseAuthorization` (are you allowed?) → controllers. Putting authorization before authentication would break every `[Authorize]`.
- **DI lifetimes:** `TokenService` and `AuthService` are **Scoped** (one per request), the same as the `DbContext` and `UserManager` they depend on. A Singleton must never depend on a Scoped service.
- **Errors in one place:** services `throw new ConflictException(...)`, and `GlobalExceptionHandler` maps that to HTTP 409 + JSON. Controllers stay one line each. Unknown exceptions become 500 and are logged, with no stack trace leaked to the client.
- **Secrets:** `Jwt:Key` (random, at least 32 chars) and `Seed:AdminPassword` live in user-secrets. The app refuses to start if the key is missing or too short.

**Tested (curl)**
- Register → 200 with token + roles `["User"]`.
- Login → token.
- `/me` with the token → the user.
- `/me` without a token → **401**.
- Wrong password → **401** "Invalid email or password."
- Invalid body → **400** with per-field errors.
- Duplicate email → **409**.
- The database contains the admin, 6 categories and 8 recipes.

**Likely interview questions**
- *What's inside a JWT and is it encrypted?* — Header.Payload.Signature, Base64Url-encoded. It's **signed, not encrypted**: anyone can read the claims, but nobody can change them without the key. So never put secrets in it.
- *Why the same error for unknown email and wrong password?* — To avoid **user enumeration**: an attacker shouldn't learn which emails have accounts.
- *Difference between 401 and 403?* — 401: not authenticated (no valid token). 403: authenticated but not allowed (e.g. not an admin).
- *Where do you validate input, and why FluentValidation?* — In validators, before the action runs, through a global filter. The rules are readable, testable and kept out of controllers and services.
- *How would you add refresh tokens?* — Store a random refresh token (hashed) per user with an expiry, add `POST /auth/refresh` that rotates it and issues a new short-lived JWT.

## Step 3 — Recipes, categories, admin moderation and image upload
**What we built**

| File | Role |
|---|---|
| `Controllers/RecipesController.cs` | `GET /api/recipes` (search, filters, paging), `GET /{id}`, `POST`, `PUT`, `DELETE`, `POST /{id}/image` |
| `Controllers/CategoriesController.cs` | `GET` public; `POST/PUT/DELETE` **admin only** (`[Authorize(Roles = "Admin")]`) |
| `Controllers/AdminController.cs` | `POST /api/admin/recipes/{id}/hide` and `/unhide` (whole controller is admin-only) |
| `Services/RecipeService.cs` | Queries with `IQueryable`, owner/admin rules, mapping to DTOs, image validation |
| `Services/CategoryService.cs` | Unique names (409), refuse deleting a category that still has recipes (409) |
| `Storage/IFileStorage.cs` + `LocalFileStorage.cs` | Save/delete files under `wwwroot/uploads/` behind an interface |
| `Dtos/RecipeDtos.cs`, `CategoryDtos.cs` | `RecipeQuery`, `PagedResult<T>`, list/detail DTOs, `SaveRecipeDto` |
| `Dtos/RecipeValidators.cs` | Rules: name ≤ 120, portions 1–50, minutes 0–1440, valid enum, category id > 0 |
| `Program.cs` | Registers the services, enums as strings in JSON, `UseStaticFiles` for images, CORS for Angular |

**Key code explained**
- **Building a query step by step:** `_db.Recipes.AsNoTracking().AsQueryable()`, then `.Where(...)` only for the filters that were sent. Nothing hits SQL Server until `CountAsync()` / `ToListAsync()`. EF Core then builds **one SQL query** with `WHERE`, `ORDER BY`, `OFFSET/FETCH`.
- **Projection with `.Select(r => new RecipeListItemDto(...))`:** EF translates it to SQL that reads only the needed columns, including `Category.Name`, `Author.FullName` and the **average rating computed in SQL** (`AVG`). No `Include`, no loading of whole entities, no N+1 queries.
- **`AsNoTracking()`** for reads: EF doesn't keep a copy for change tracking, so it's faster and uses less memory. For updates we load with `FindAsync` (tracked), change properties, and call `SaveChangesAsync`, which writes an `UPDATE` with only the changed columns.
- **Paging:** `Skip((page - 1) * pageSize).Take(pageSize)`, with `pageSize` clamped to 1–50 so nobody can request 1 million rows.
- **Authorization at two levels:**
  1. **Roles in attributes:** `[Authorize(Roles = "Admin")]` for categories and moderation.
  2. **Ownership in the service:** `GetEditableAsync` lets only the author or an admin edit or delete a recipe (403 otherwise). You can't express ownership with an attribute, because it depends on the data.
- **Hidden recipes:** excluded from lists for everyone except admins and the author. `GET /{id}` returns **404** (not 403) to others, so we don't even reveal that the recipe exists.
- **Secure image upload:**
  1. Size limit (2 MB, plus `[RequestSizeLimit]`).
  2. Extension whitelist (`.jpg .jpeg .png .webp`).
  3. **Magic-bytes check:** the first bytes must match the real format, so a PHP script renamed `photo.png` is rejected.
  4. A **random GUID file name**: never the user's name, so no path traversal or overwrite.
  5. Delete only paths inside `wwwroot/uploads`.
  - The old image is deleted when it's replaced, and the image is deleted when its recipe is deleted.
- **`IFileStorage` interface:** the service doesn't know files go to disk. Moving to Azure Blob Storage means writing `AzureBlobStorage : IFileStorage` and changing one line in `Program.cs`.
- **DI lifetimes recap:** services are `Scoped` (they use the `DbContext`); `LocalFileStorage` is a `Singleton` (stateless).

**Tested (24 end-to-end checks, all PASS)**
- Browsing: list, search "chicken", filter by category + difficulty.
- Create: 401 without login, 201 as a user, 400 for invalid input or an unknown category.
- Edit: 403 for another user, 200 for the owner.
- Images: PNG upload 200 and served by `UseStaticFiles`; a fake PNG and a PDF are both rejected with 400.
- Moderation: user hide → 403; admin hide → 204; hidden recipe is 404 for anonymous users but visible to the owner; unhide works.
- Categories: create as user 403; as admin 200; duplicate 409; deleting a category that has recipes 409; deleting an empty one 204.
- Delete: another user 403; owner 204, then 404; the image file is removed from disk.

**Likely interview questions**
- *How do you avoid the N+1 problem?* — Project to DTOs with `.Select()`, so EF builds one SQL query with joins and aggregates. Without that, looping over recipes and reading `recipe.Category.Name` would trigger one extra query per recipe with lazy loading.
- *`IQueryable` vs `IEnumerable`?* — `IQueryable` builds an expression that EF translates to SQL (filtering happens in the database). `IEnumerable` filters in memory after loading. Filters must be applied before `ToListAsync()`.
- *Why 404 instead of 403 for a hidden recipe?* — So we don't reveal that the resource exists (information disclosure).
- *How do you secure a file upload?* — Size limit, extension whitelist, content check (magic bytes), random server-side file name, store outside code folders, never execute uploads, and in production add a virus scan and storage like Azure Blob with a CDN.
- *Where do you check permissions?* — Roles with `[Authorize(Roles=...)]` on controllers. Data-dependent rules (ownership) in the service, because only the service knows who owns the recipe.
- *Why return 201 + `CreatedAtAction` on POST?* — REST convention: 201 Created with a `Location` header pointing to the new resource.
