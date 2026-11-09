using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using SchoolAdmission.Api.Data;
namespace SchoolAdmission.Api.Tests.Infrastructure;

public sealed class PostgresFixture : IAsyncLifetime
{
    public AdmissionWebApplicationFactory Factory { get; } = new();
    public async Task InitializeAsync()
    {
        _ = PostgresTestConfig.ConnectionString;
        await ResetDatabaseAsync();
    }
    public async Task ResetDatabaseAsync()
    {
        await WithDatabaseAsync(async db => {
            PostgresTestConfig.AssertSafe(db);
            await db.Holds.ExecuteDeleteAsync();
            await db.Classes.ExecuteDeleteAsync();
        });
    }
    public async Task WithDatabaseAsync(Func<AppDbContext, Task> action)
    {
        await using var scope = Factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        PostgresTestConfig.AssertSafe(db);
        await action(db);
    }
    public async Task DisposeAsync() => await Factory.DisposeAsync();
}
