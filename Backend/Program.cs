using Artifax.Data;
using Artifax.Helpers;
using Artifax.Services;
using DotNetEnv;
using Microsoft.AspNetCore.Diagnostics;
using Microsoft.EntityFrameworkCore;

// Load environment variables from a local .env file when running on your own computer.
// On Render the variables come from the dashboard, so a missing file is fine.
Env.Load();

var builder = WebApplication.CreateBuilder(args);

// ---------------------------------------------------------------------------
// CORS — which websites may call this API from the browser.
// FRONTEND_URL can hold one or more comma-separated URLs (e.g. your Vercel site).
// When the frontend uses the Vercel /api rewrite, calls are same-origin and CORS
// doesn't come into play, but keeping this makes direct calls work too.
// ---------------------------------------------------------------------------
var allowedOrigins = new List<string> { "http://localhost:3000", "http://localhost:3001", "http://localhost:5253" };
var frontendUrls = Environment.GetEnvironmentVariable("FRONTEND_URL");
if (!string.IsNullOrWhiteSpace(frontendUrls))
{
    allowedOrigins.AddRange(frontendUrls
        .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
        .Select(url => url.TrimEnd('/')));
}

builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowReactApp", policy =>
    {
        policy.WithOrigins(allowedOrigins.ToArray())
            .AllowAnyHeader()
            .AllowAnyMethod()
            .AllowCredentials();
    });
});

// Every endpoint needs a logged-in session unless marked [AllowAnonymous].
builder.Services.AddControllers(options => options.Filters.Add<RequireSessionFilter>());

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();
builder.Services.AddOpenApi();

// ---------------------------------------------------------------------------
// Database (Supabase Postgres).
// Set ConnectionStrings__ArtifaxDatabase on Render, or the DATABASE_* variables.
// ---------------------------------------------------------------------------
var connectionString = builder.Configuration.GetConnectionString("ArtifaxDatabase");

if (string.IsNullOrWhiteSpace(connectionString))
{
    var host = Environment.GetEnvironmentVariable("DATABASE_HOST");
    var port = Environment.GetEnvironmentVariable("DATABASE_PORT") ?? "5432";
    var database = Environment.GetEnvironmentVariable("DATABASE_NAME") ?? "postgres";
    var username = Environment.GetEnvironmentVariable("DATABASE_USERNAME");
    var password = Environment.GetEnvironmentVariable("DATABASE_PASSWORD");

    if (!string.IsNullOrWhiteSpace(host))
    {
        connectionString = $"Host={host};Port={port};Database={database};Username={username};Password={password};SSL Mode=Require;Trust Server Certificate=true";
    }
}

if (string.IsNullOrWhiteSpace(connectionString))
{
    throw new InvalidOperationException(
        "Database connection is not configured. Set ConnectionStrings__ArtifaxDatabase (or the DATABASE_* variables).");
}

builder.Services.AddDbContext<ArtifaxContext>(options => options.UseNpgsql(connectionString));

// Supabase email codes for the second login step
builder.Services.AddHttpClient<SupabaseOtpService>(client => client.Timeout = TimeSpan.FromSeconds(15));

// Background job: moves crafting orders along every minute
builder.Services.AddHostedService<OrderTimeTrackingService>();

builder.Services.AddDistributedMemoryCache();
builder.Services.AddSession(option =>
{
    option.IdleTimeout = TimeSpan.FromHours(14);
    option.Cookie.HttpOnly = true;
    option.Cookie.IsEssential = true;
    option.Cookie.SameSite = SameSiteMode.None;
    option.Cookie.SecurePolicy = CookieSecurePolicy.Always;
});

var app = builder.Build();

// Never send stack traces to the browser: log the details, return a short message.
app.UseExceptionHandler(errorApp => errorApp.Run(async context =>
{
    var error = context.Features.Get<IExceptionHandlerFeature>()?.Error;
    app.Logger.LogError(error, "Unhandled error on {Path}", context.Request.Path);

    var isDatabaseProblem = false;
    for (var current = error; current != null; current = current.InnerException)
    {
        if (current is Npgsql.NpgsqlException || current is System.Net.Sockets.SocketException)
        {
            isDatabaseProblem = true;
            break;
        }
    }

    context.Response.StatusCode = isDatabaseProblem ? StatusCodes.Status503ServiceUnavailable : StatusCodes.Status500InternalServerError;
    context.Response.ContentType = "text/plain";
    await context.Response.WriteAsync(isDatabaseProblem
        ? "We can't reach the database right now. Please try again in a moment."
        : "Something went wrong on our side. Please try again.");
}));

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
    app.MapOpenApi();

    // Render handles HTTPS in front of the app, so only redirect when running locally.
    app.UseHttpsRedirection();
}

app.UseCors("AllowReactApp");

app.UseSession();

app.UseAuthorization();

// Simple health check for Render ("Health Check Path" = /health)
app.MapGet("/health", () => Results.Ok(new { status = "ok" }));

app.MapControllers();

app.Run();
