using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Hosting;
using SchoolAdmission.Api.Data;
using SchoolAdmission.Api.Services;
namespace SchoolAdmission.Api.Tests.Infrastructure;

public sealed class AdmissionWebApplicationFactory(int holdDurationSeconds = 600) : WebApplicationFactory<Program>
{
    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        var connection = PostgresTestConfig.ConnectionString;
        builder.UseEnvironment("Testing");
        builder.UseSetting("HOLD_DURATION_SECONDS", "600");
        builder.ConfigureTestServices(services => {
            services.RemoveAll<DbContextOptions<AppDbContext>>();
            services.AddDbContext<AppDbContext>(o => o.UseNpgsql(connection));
            services.PostConfigure<AdmissionOptions>(o => o.HoldDurationSeconds = holdDurationSeconds);
        });
    }
    protected override IHost CreateHost(IHostBuilder builder)
    {
        var host = base.CreateHost(builder);
        using var scope = host.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        PostgresTestConfig.AssertSafe(db);
        db.Database.Migrate();
        return host;
    }
}
