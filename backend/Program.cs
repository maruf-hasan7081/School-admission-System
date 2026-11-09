using System.Globalization;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using SchoolAdmission.Api.Api;
using SchoolAdmission.Api.Data;
using SchoolAdmission.Api.Middleware;
using SchoolAdmission.Api.Services;

var builder = WebApplication.CreateBuilder(args);
var connectionString = builder.Configuration.GetConnectionString("Default")
    ?? throw new InvalidOperationException("ConnectionStrings__Default is required.");

builder.Services.AddDbContext<AppDbContext>(options => options.UseNpgsql(connectionString));
builder.Services.AddOptions<AdmissionOptions>()
    .Configure<IConfiguration>((options, config) => {
        var raw = config["HOLD_DURATION_SECONDS"];
        if (raw is null) return;
        if (!int.TryParse(raw, NumberStyles.None, CultureInfo.InvariantCulture, out var duration) || duration <= 0)
            throw new OptionsValidationException(nameof(AdmissionOptions), typeof(AdmissionOptions),
                ["HOLD_DURATION_SECONDS must be a positive integer."]);
        options.HoldDurationSeconds = duration;
    })
    .Validate(o => o.HoldDurationSeconds > 0, "HOLD_DURATION_SECONDS must be positive.")
    .ValidateOnStart();
builder.Services.Configure<RouteHandlerOptions>(o => o.ThrowOnBadRequest = true);
builder.Services.AddScoped<IAdmissionService, AdmissionService>();
builder.Services.AddHostedService<HoldExpiryBackgroundService>();
builder.Services.AddCors(o => o.AddDefaultPolicy(p => p.AllowAnyHeader().AllowAnyMethod().AllowAnyOrigin()));
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();
var app = builder.Build();
_ = app.Services.GetRequiredService<IOptions<AdmissionOptions>>().Value;

if (!app.Environment.IsEnvironment("Testing"))
{
    using var scope = app.Services.CreateScope();
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    // EF8 does not serialize migrations across app instances. Hold a session
    // advisory lock on this connection until schema initialization completes.
    db.Database.OpenConnection();
    try {
        db.Database.ExecuteSqlRaw("SELECT pg_advisory_lock(7294105421)");
        try { db.Database.Migrate(); }
        finally { db.Database.ExecuteSqlRaw("SELECT pg_advisory_unlock(7294105421)"); }
    }
    finally { db.Database.CloseConnection(); }
}
app.UseMiddleware<ApiExceptionMiddleware>();
app.UseCors();
if (app.Environment.IsDevelopment()) { app.UseSwagger(); app.UseSwaggerUI(); }
app.MapAdmissionEndpoints();
app.MapGet("/health", async (AppDbContext db, CancellationToken ct) =>
    await db.Database.CanConnectAsync(ct)
        ? Results.Ok(new { status = "ready" })
        : Results.Json(new { message = "Database is unavailable." }, statusCode: 503));
app.Run();
public partial class Program;
