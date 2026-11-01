# Recipe AI

**Cook with what's already in your kitchen.** Type the ingredients you have, and an LLM ranks the recipes in the database by how much of each you can cook right now. It shows exactly which ingredients you have and which you'd need to buy, and suggests new ideas when nothing fits.

Built as a full-stack .NET project: **ASP.NET Core 8 Web API · Entity Framework Core 8 · SQL Server 2022 · Identity + JWT · Angular 19 · Groq LLM (swappable provider) · xUnit · Docker**.

![AI ingredient matching](docs/screenshots/ai-match.jpg)

| Home: the pantry input is the hero | Recipe page |
|---|---|
| ![Home](docs/screenshots/home.jpg) | ![Recipe](docs/screenshots/recipe.jpg) |

## Features
- **AI ingredient matching:**
  - Ingredients are normalised in any language ("tomates, ail" → tomato, garlic).
  - Recipes are ranked with matched / missing ingredients and a reason.
  - AI recipe ideas appear when nothing matches well.
- **Recipes:** search, category and difficulty filters, paging, create/edit/delete (owner or admin), secure photo upload.
- **Accounts:** register / login with JWT, roles `User` and `Admin`.
- **Social:** 1–5 star reviews (one per user), favorites, notifications ("X rated your recipe 5/5").
- **Admin moderation:** hide/unhide recipes and reviews, manage categories.

## How the AI is made reliable
The LLM is treated as **untrusted input**:

```
user ingredients ──► clean ──► candidates from SQL Server (max 25, filtered)
                                   │
                   LLM: normalise ─┤──► validate (JSON shape, lists, lengths)
                   LLM: rank ──────┤──► validate (only ids we sent, score computed by our code
                                   │      from matched/missing, forgotten recipes keyword-scored)
                   LLM: ideas ─────┘──► validate (max 3, required fields)
                                   │
              any AI failure ──────┴──► keyword fallback, aiAvailable = false (never a 500)
```

- **Provider behind an interface:** `IAiProvider` → `GroqAiProvider` (real LLM) or `OfflineAiProvider` (no network). It's chosen by configuration, so adding Azure OpenAI means one class.
- **Production-grade HTTP:** a typed `HttpClient` (IHttpClientFactory) with the standard resilience handler (retries, timeouts, circuit breaker) and JSON mode.
- **Rate limiting** on the AI endpoint (429), plus logging of every AI call with its duration.
- Names, photos and categories always come **from our database**, never from the model.

## Architecture
Classic layered ASP.NET Core Web API: **`Controller → Service → AppDbContext → SQL Server`**.

```
api/RecipeAi.Api/
├─ Controllers/   HTTP only: routes, [Authorize], status codes
├─ Services/      business rules (ownership, one review per user, notifications...)
├─ Ai/            IAiProvider, Groq + Offline providers, AiResponseValidator, SuggestionService
├─ Models/        EF Core entities (Recipe, Category, Review, Favorite, Notification, AppUser)
├─ Dtos/          API contracts + FluentValidation validators
├─ Data/          AppDbContext, migrations, seed data
├─ Storage/       IFileStorage + LocalFileStorage
├─ Errors/        global exception handler (ProblemDetails), validation filter
└─ Program.cs     dependency injection, auth, CORS, rate limiting, middleware pipeline
api/RecipeAi.Api.Tests/   27 xUnit tests (AI validator, pipeline with fake providers)
web/                      Angular 19 front end (standalone components, signals, lazy routes)
docs/REPORT.md            step-by-step build report with design decisions
```

## Run it
**Prerequisites:** Docker, plus the .NET 8 SDK and Node 20+ for development.

```bash
cp .env.example .env              # fill in the passwords (and optionally GROQ_API_KEY)

# Option A: everything in Docker (SQL Server + API)
docker compose --profile api up -d --build
# API + Swagger: http://localhost:5295/swagger

# Option B: development (database in Docker, API and web locally)
docker compose up -d              # SQL Server only
cd api/RecipeAi.Api
dotnet user-secrets set "ConnectionStrings:Default" "Server=localhost,1433;Database=RecipeAi;User Id=sa;Password=<MSSQL_SA_PASSWORD>;TrustServerCertificate=True"
dotnet user-secrets set "Jwt:Key" "<random string, 32+ chars>"
dotnet user-secrets set "Seed:AdminPassword" "<admin password>"
dotnet user-secrets set "Ai:Groq:ApiKey" "<optional Groq key>"
dotnet run                        # http://localhost:5295/swagger

# Front end
cd web && npm install && npx ng serve   # http://localhost:4200
```

Migrations and seed data (6 categories, 8 recipes, an admin `admin@recipeai.local`) are applied automatically at startup.

```bash
dotnet test                       # 27 tests
```

## Author
**Youssef Dhouib**, final-year Software Engineering student (AI Engineering), ISIMS Sfax.
