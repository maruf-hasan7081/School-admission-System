using Microsoft.EntityFrameworkCore;
using SchoolAdmission.Api.Api;
using SchoolAdmission.Api.Data;
using SchoolAdmission.Api.Middleware;
using SchoolAdmission.Api.Services;

var builder = WebApplication.CreateBuilder(args);

var connectionString = builder.Configuration.GetConnectionString("Default")
    ?? builder.Configuration["DATABASE_URL"]
    ?? throw new InvalidOperationException("Database connection string is not configured.");

builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseNpgsql(connectionString));

builder.Services.AddScoped<IAdmissionService, AdmissionService>();
builder.Services.AddHostedService<HoldExpiryBackgroundService>();

builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
    {
        policy.AllowAnyHeader().AllowAnyMethod().AllowAnyOrigin();
    });
});

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

var app = builder.Build();

if (!app.Environment.IsEnvironment("Testing"))
{
    using var scope = app.Services.CreateScope();
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    db.Database.Migrate();
}

app.UseMiddleware<ApiExceptionMiddleware>();
app.UseCors();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.MapAdmissionEndpoints();

app.Run();

public partial class Program;
