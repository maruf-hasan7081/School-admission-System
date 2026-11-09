using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using SchoolAdmission.Api.Tests.Infrastructure;
using Xunit;

namespace SchoolAdmission.Api.Tests;

[Collection("Postgres")]
public class AdmissionRulesTests(PostgresFixture fixture) : IAsyncLifetime
{
    private readonly HttpClient client = fixture.Factory.CreateClient();

    public Task InitializeAsync()
    {
        Assert.True(PostgresTestConfig.CanConnect());
        return fixture.ResetDatabaseAsync();
    }

    public Task DisposeAsync() => Task.CompletedTask;

    [Fact]
    public async Task ConfirmTwice_DoesNotInflateConfirmedSeats()
    {
        var created = await client.PostAsJsonAsync("/classes", new { name = "Confirm twice", totalSeats = 1 });
        var classId = JsonDocument.Parse(await created.Content.ReadAsStringAsync()).RootElement.GetProperty("id").GetString()!;

        var holdReq = new HttpRequestMessage(HttpMethod.Post, $"/classes/{classId}/holds");
        holdReq.Headers.Add("X-Student-Id", "20152691234567801");
        var holdRes = await client.SendAsync(holdReq);
        var holdId = JsonDocument.Parse(await holdRes.Content.ReadAsStringAsync()).RootElement.GetProperty("holdId").GetString()!;

        var confirm = new HttpRequestMessage(HttpMethod.Post, $"/holds/{holdId}/confirm");
        confirm.Headers.Add("X-Student-Id", "20152691234567801");
        Assert.Equal(HttpStatusCode.OK, (await client.SendAsync(confirm)).StatusCode);
        using var secondConfirm = new HttpRequestMessage(HttpMethod.Post, $"/holds/{holdId}/confirm");
        secondConfirm.Headers.Add("X-Student-Id", "20152691234567801");
        Assert.Equal(HttpStatusCode.OK, (await client.SendAsync(secondConfirm)).StatusCode);

        var summary = JsonDocument.Parse(await client.GetStringAsync($"/classes/{classId}")).RootElement;
        Assert.Equal(1, summary.GetProperty("confirmedSeats").GetInt32());
        Assert.Equal(0, summary.GetProperty("heldSeats").GetInt32());
    }

    [Fact]
    public async Task NoSeats_Returns409()
    {
        var created = await client.PostAsJsonAsync("/classes", new { name = "Full", totalSeats = 1 });
        var classId = JsonDocument.Parse(await created.Content.ReadAsStringAsync()).RootElement.GetProperty("id").GetString()!;

        var first = new HttpRequestMessage(HttpMethod.Post, $"/classes/{classId}/holds");
        first.Headers.Add("X-Student-Id", "20152691234567802");
        Assert.Equal(HttpStatusCode.Created, (await client.SendAsync(first)).StatusCode);

        var second = new HttpRequestMessage(HttpMethod.Post, $"/classes/{classId}/holds");
        second.Headers.Add("X-Student-Id", "20152691234567803");
        Assert.Equal(HttpStatusCode.Conflict, (await client.SendAsync(second)).StatusCode);
    }
}
