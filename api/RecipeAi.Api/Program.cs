using Microsoft.EntityFrameworkCore;
using RecipeAi.Api.Data;

var builder = WebApplication.CreateBuilder(args);

// ---------- 1. Register services (dependency injection) ----------
var connectionString = builder.Configuration.GetConnectionString("Default")
    ?? throw new InvalidOperationException("ConnectionStrings:Default is missing. Set it with dotnet user-secrets.");

builder.Services.AddDbContext<AppDbContext>(options => options.UseSqlServer(connectionString));

builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

var app = builder.Build();

// ---------- 2. Prepare the database (migrations + starter data) ----------
await SeedData.InitializeAsync(app.Services);

// ---------- 3. HTTP pipeline (middleware order matters) ----------
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseAuthorization();
app.MapControllers();

app.Run();
