using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using SchoolAdmission.Api.Tests.Infrastructure;
using Xunit;

namespace SchoolAdmission.Api.Tests;

[Collection("Postgres")]
public class ConcurrencyTests(PostgresFixture fixture) : IAsyncLifetime
{
    private readonly HttpClient client = fixture.Factory.CreateClient();

    public Task InitializeAsync()
    {
        Assert.True(PostgresTestConfig.CanConnect(), "PostgreSQL required for concurrency test.");
        return fixture.ResetDatabaseAsync();
    }

    public Task DisposeAsync() => Task.CompletedTask;

    [Fact]
    public async Task ParallelHolds_NeverExceedTotalSeats()
    {
        var create = await client.PostAsJsonAsync("/classes", new { name = "Load test", totalSeats = 5 });
        Assert.Equal(HttpStatusCode.Created, create.StatusCode);

        var classId = JsonDocument.Parse(await create.Content.ReadAsStringAsync())
            .RootElement.GetProperty("id").GetString()!;

        var tasks = Enumerable.Range(0, 80).Select(i => HoldAsync(classId, i));
        var responses = await Task.WhenAll(tasks);

        var created = responses.Count(r => r.StatusCode == HttpStatusCode.Created);
        Assert.Equal(5, created);

        var list = JsonDocument.Parse(await client.GetStringAsync("/classes")).RootElement;
        JsonElement? row = null;
        foreach (var item in list.EnumerateArray())
        {
            if (item.GetProperty("id").GetString() == classId)
            {
                row = item;
                break;
            }
        }

        Assert.NotNull(row);
        var held = row.Value.GetProperty("heldSeats").GetInt32();
        var confirmed = row.Value.GetProperty("confirmedSeats").GetInt32();
        var total = row.Value.GetProperty("totalSeats").GetInt32();
        Assert.Equal(5, held);
        Assert.Equal(0, confirmed);
        Assert.True(held + confirmed <= total);
    }

    private Task<HttpResponseMessage> HoldAsync(string classId, int index)
    {
        var request = new HttpRequestMessage(HttpMethod.Post, $"/classes/{classId}/holds");
        request.Headers.Add("X-Student-Id", (20152691234567800L + index).ToString());
        return client.SendAsync(request);
    }
}
