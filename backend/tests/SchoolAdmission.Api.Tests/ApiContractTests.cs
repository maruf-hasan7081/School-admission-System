using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using SchoolAdmission.Api.Tests.Infrastructure;
using Xunit;

namespace SchoolAdmission.Api.Tests;

[Collection("Postgres")]
public class ApiContractTests(PostgresFixture fixture) : IAsyncLifetime
{
    private readonly HttpClient client = fixture.Factory.CreateClient();

    public Task InitializeAsync()
    {
        Assert.True(PostgresTestConfig.CanConnect(), "PostgreSQL required for integration tests.");
        return fixture.ResetDatabaseAsync();
    }

    public Task DisposeAsync() => Task.CompletedTask;

    [Fact]
    public async Task PostClasses_ResponseHasRequiredFields()
    {
        var response = await client.PostAsJsonAsync("/classes", new { name = "Class 6 - Morning Shift", totalSeats = 3 });
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);

        using var doc = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        var root = doc.RootElement;
        Assert.True(root.TryGetProperty("id", out _));
        Assert.True(root.TryGetProperty("name", out _));
        Assert.True(root.TryGetProperty("totalSeats", out _));
    }

    [Fact]
    public async Task GetClasses_ResponseHasSeatCounts()
    {
        await client.PostAsJsonAsync("/classes", new { name = "List test", totalSeats = 2 });

        var list = JsonDocument.Parse(await client.GetStringAsync("/classes")).RootElement;
        Assert.Equal(JsonValueKind.Array, list.ValueKind);
        var first = list[0];
        Assert.True(first.TryGetProperty("heldSeats", out _));
        Assert.True(first.TryGetProperty("confirmedSeats", out _));
        Assert.True(first.TryGetProperty("availableSeats", out _));
    }

    [Fact]
    public async Task PostHold_ResponseContract()
    {
        var created = await client.PostAsJsonAsync("/classes", new { name = "Hold test", totalSeats = 1 });
        var classId = JsonDocument.Parse(await created.Content.ReadAsStringAsync()).RootElement.GetProperty("id").GetString()!;

        using var request = new HttpRequestMessage(HttpMethod.Post, $"/classes/{classId}/holds");
        request.Headers.Add("X-Student-Id", "20152691234567890");

        var response = await client.SendAsync(request);
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);

        using var doc = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        var root = doc.RootElement;
        Assert.Equal("HELD", root.GetProperty("status").GetString());
        Assert.True(root.TryGetProperty("holdId", out _));
        Assert.True(root.TryGetProperty("expiresAt", out _));
    }
}

[CollectionDefinition("Postgres")]
public class PostgresCollection : ICollectionFixture<PostgresFixture>;
