using System.Text;
using System.Text.Json.Serialization;
using System.Threading.RateLimiting;
using FluentValidation;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;
using RecipeAi.Api.Ai;
using RecipeAi.Api.Data;
using RecipeAi.Api.Errors;
using RecipeAi.Api.Models;
using RecipeAi.Api.Services;
using RecipeAi.Api.Storage;

var builder = WebApplication.CreateBuilder(args);
var config = builder.Configuration;

// ---------- 1. Database ----------
var connectionString = config.GetConnectionString("Default")
    ?? throw new InvalidOperationException("ConnectionStrings:Default is missing. Set it with dotnet user-secrets.");
builder.Services.AddDbContext<AppDbContext>(options => options.UseSqlServer(connectionString));

// ---------- 2. Accounts (Identity) + JWT authentication ----------
builder.Services
    .AddIdentityCore<AppUser>(options =>
    {
        options.User.RequireUniqueEmail = true;
        options.Password.RequiredLength = 8;
        options.Password.RequireNonAlphanumeric = false;
    })
    .AddRoles<IdentityRole>()
    .AddEntityFrameworkStores<AppDbContext>();

var jwtKey = config["Jwt:Key"];
if (string.IsNullOrWhiteSpace(jwtKey) || jwtKey.Length < 32)
{
    throw new InvalidOperationException("Jwt:Key is missing or shorter than 32 characters. Set it with dotnet user-secrets.");
}

builder.Services
    .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidIssuer = config["Jwt:Issuer"],
            ValidateAudience = true,
            ValidAudience = config["Jwt:Audience"],
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey)),
            ValidateLifetime = true,
            ClockSkew = TimeSpan.FromMinutes(1),
        };
    });
builder.Services.AddAuthorization();

// ---------- 3. Our services (Scoped = one instance per HTTP request) ----------
builder.Services.AddScoped<TokenService>();
builder.Services.AddScoped<AuthService>();
builder.Services.AddScoped<RecipeService>();
builder.Services.AddScoped<CategoryService>();
builder.Services.AddScoped<NotificationService>();
builder.Services.AddScoped<ReviewService>();
builder.Services.AddScoped<FavoriteService>();
builder.Services.AddSingleton<CalorieService>(); // stateless math: one instance is enough
builder.Services.AddScoped<StatsService>();

// Singleton: LocalFileStorage has no state, one instance is enough for the whole app.
builder.Services.AddSingleton<IFileStorage, LocalFileStorage>();

// ---------- 3b. AI module ----------
builder.Services.Configure<AiOptions>(config.GetSection(AiOptions.SectionName));
var aiOptions = config.GetSection(AiOptions.SectionName).Get<AiOptions>() ?? new AiOptions();

// Typed HttpClient from IHttpClientFactory + standard resilience pipeline (retries with backoff,
// per-attempt timeout, total timeout, circuit breaker). LLM calls are slow, so timeouts are generous.
builder.Services.AddHttpClient<GroqAiProvider>()
    .AddStandardResilienceHandler(options =>
    {
        options.Retry.MaxRetryAttempts = 2;
        options.AttemptTimeout.Timeout = TimeSpan.FromSeconds(aiOptions.TimeoutSeconds);
        options.TotalRequestTimeout.Timeout = TimeSpan.FromSeconds(aiOptions.TimeoutSeconds * 2 + 5);
        options.CircuitBreaker.SamplingDuration = TimeSpan.FromSeconds(aiOptions.TimeoutSeconds * 3);
    });
builder.Services.AddSingleton<OfflineAiProvider>();

// Choose the provider from configuration. The rest of the app only knows IAiProvider.
var useGroq = aiOptions.Provider.Equals("Groq", StringComparison.OrdinalIgnoreCase)
    && !string.IsNullOrWhiteSpace(aiOptions.Groq.ApiKey);
if (useGroq)
{
    builder.Services.AddScoped<IAiProvider>(sp => sp.GetRequiredService<GroqAiProvider>());
}
else
{
    builder.Services.AddSingleton<IAiProvider>(sp => sp.GetRequiredService<OfflineAiProvider>());
}

builder.Services.AddScoped<SuggestionService>();

// Each AI request costs tokens: max N requests per minute per IP address on the "ai" policy.
builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    options.AddPolicy("ai", http => RateLimitPartition.GetFixedWindowLimiter(
        http.Connection.RemoteIpAddress?.ToString() ?? "unknown",
        _ => new FixedWindowRateLimiterOptions
        {
            PermitLimit = config.GetValue("Ai:RequestsPerMinute", 10),
            Window = TimeSpan.FromMinutes(1),
        }));
});

// ---------- 4. Validation + error handling ----------
builder.Services.AddValidatorsFromAssemblyContaining<Program>();
builder.Services.AddExceptionHandler<GlobalExceptionHandler>();
builder.Services.AddProblemDetails();

builder.Services
    .AddControllers(options => options.Filters.Add<ValidationFilter>())
    // Enums travel as text ("Easy") instead of numbers (0): clearer for the Angular app.
    .AddJsonOptions(options => options.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter()));

// The Angular dev server runs on another origin (port 4200), so the browser needs CORS permission.
var allowedOrigins = config.GetSection("Cors:Origins").Get<string[]>() ?? new[] { "http://localhost:4200" };
builder.Services.AddCors(options => options.AddDefaultPolicy(policy =>
    policy.WithOrigins(allowedOrigins).AllowAnyHeader().AllowAnyMethod()));

// ---------- 5. Swagger with a "Authorize" button for the JWT ----------
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(options =>
{
    options.SwaggerDoc("v1", new OpenApiInfo { Title = "Recipe AI API", Version = "v1" });
    var scheme = new OpenApiSecurityScheme
    {
        Name = "Authorization",
        Type = SecuritySchemeType.Http,
        Scheme = "bearer",
        BearerFormat = "JWT",
        In = ParameterLocation.Header,
        Reference = new OpenApiReference { Type = ReferenceType.SecurityScheme, Id = "Bearer" },
    };
    options.AddSecurityDefinition("Bearer", scheme);
    options.AddSecurityRequirement(new OpenApiSecurityRequirement { [scheme] = Array.Empty<string>() });
});

var app = builder.Build();

// ---------- 6. Prepare the database (migrations + starter data) ----------
await SeedData.InitializeAsync(app.Services);
app.Logger.LogInformation("AI provider: {Provider}", useGroq ? "Groq" : "Offline (no Ai:Groq:ApiKey configured)");

// ---------- 7. HTTP pipeline: the order matters ----------
app.UseExceptionHandler();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseStaticFiles();    // serves wwwroot/uploads (recipe images)
app.UseCors();
app.UseAuthentication(); // who are you? (reads the JWT)
app.UseAuthorization();  // are you allowed? ([Authorize], roles)
app.UseRateLimiter();
app.MapControllers();

app.Run();

// Makes Program visible to the test project.
public partial class Program;
