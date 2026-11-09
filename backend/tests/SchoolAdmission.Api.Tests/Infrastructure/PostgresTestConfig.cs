using Microsoft.EntityFrameworkCore;
using System.Text.RegularExpressions;
using Npgsql;
using SchoolAdmission.Api.Data;
namespace SchoolAdmission.Api.Tests.Infrastructure;

public static class PostgresTestConfig
{
    public static string ConnectionString => Validate(
        Environment.GetEnvironmentVariable("TEST_CONNECTION")
        ?? throw new InvalidOperationException("Set TEST_CONNECTION to a dedicated school_admission_test database. Development connection strings are ignored."));
    public static string Validate(string connectionString)
    {
        var config = new NpgsqlConnectionStringBuilder(connectionString);
        if (config.Database is null || !Regex.IsMatch(config.Database, @"\Aschool_admission_test(?:_[A-Za-z0-9]+)*\z"))
            throw new InvalidOperationException("Refusing tests against a database outside the school_admission_test prefix.");
        return config.ConnectionString;
    }
    public static void AssertSafe(AppDbContext db)
    {
        var actual = new NpgsqlConnectionStringBuilder(Validate(db.Database.GetConnectionString()!));
        var expected = new NpgsqlConnectionStringBuilder(ConnectionString);
        if (actual.Database != expected.Database || actual.Host != expected.Host || actual.Port != expected.Port)
            throw new InvalidOperationException("The configured test DbContext does not match TEST_CONNECTION.");
    }
    public static bool CanConnect()
    {
        using var connection = new NpgsqlConnection(ConnectionString);
        try { connection.Open(); return true; }
        catch { return false; }
    }
}
