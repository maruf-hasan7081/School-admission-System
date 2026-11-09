using System.Net;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using SchoolAdmission.Api.Data;
using SchoolAdmission.Api.Data.Entities;
using SchoolAdmission.Api.Tests.Infrastructure;

namespace SchoolAdmission.Api.Tests;

[Collection("Postgres")]
public class AdmissionSafetyTests(PostgresFixture fixture) : IAsyncLifetime
{
    private readonly HttpClient client = fixture.Factory.CreateClient();
    private const string Student = "20152691234567890";
    private const string Other = "20152691234567891";
    public Task InitializeAsync() => fixture.ResetDatabaseAsync();
    public Task DisposeAsync() => Task.CompletedTask;
    private async Task<string> CreateClass(int seats = 1)
    {
        using var response = await client.PostAsJsonAsync("/classes", new { name = "Safety class", totalSeats = seats });
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        return (await response.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetString()!;
    }
    private async Task<HttpResponseMessage> Send(HttpMethod method, string path, string? student = Student)
    {
        using var request = new HttpRequestMessage(method, path);
        if (student is not null) request.Headers.Add("X-Student-Id", student);
        return await client.SendAsync(request);
    }
    private async Task<string> Reserve(string classId)
    {
        using var response = await Send(HttpMethod.Post, $"/classes/{classId}/holds");
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        return (await response.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("holdId").GetString()!;
    }
    private async Task Expire(string holdId) => await fixture.WithDatabaseAsync(db =>
        db.Database.ExecuteSqlInterpolatedAsync(
            $"UPDATE holds SET created_at_utc = clock_timestamp() - interval '10 minutes', expires_at_utc = clock_timestamp() - interval '1 second' WHERE id = {holdId}"));
    private async Task<JsonElement> Summary(string classId) =>
        await client.GetFromJsonAsync<JsonElement>($"/classes/{classId}");

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("123")]
    [InlineData("201526912345678901")]
    [InlineData("2015269123456789x")]
    public async Task InvalidIdentity_Returns400(string? student)
    {
        using var response = await Send(HttpMethod.Get, "/me/holds", student);
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.True((await response.Content.ReadFromJsonAsync<JsonElement>()).TryGetProperty("message", out _));
    }
    [Fact]
    public async Task MultipleStudentHeaders_Return400()
    {
        using var request = new HttpRequestMessage(HttpMethod.Get, "/me/holds");
        request.Headers.Add("X-Student-Id", new[] { Student, Other });
        using var response = await client.SendAsync(request);
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }
    [Fact]
    public async Task InvalidClassInput_Is4xxWithMessage()
    {
        foreach (var body in new[] { "null", "{}", "{", "{\"name\":\"x\",\"totalSeats\":1.5}", "{\"name\":\"x\",\"totalSeats\":0}", "{\"name\":\"   \",\"totalSeats\":1}" })
        {
            using var response = await client.PostAsync("/classes", new StringContent(body, Encoding.UTF8, "application/json"));
            Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
            Assert.True((await response.Content.ReadFromJsonAsync<JsonElement>()).TryGetProperty("message", out _));
        }
        using var tooLong = await client.PostAsJsonAsync("/classes", new { name = new string('x', 257), totalSeats = 1 });
        Assert.Equal(HttpStatusCode.BadRequest, tooLong.StatusCode);
    }
    [Fact]
    public async Task MissingResources_Are404()
    {
        foreach (var path in new[] { "/classes/absent", "/holds/absent" })
            Assert.Equal(HttpStatusCode.NotFound, (await Send(HttpMethod.Get, path)).StatusCode);
        foreach (var path in new[] { "/classes/absent/holds", "/holds/absent/confirm" })
            Assert.Equal(HttpStatusCode.NotFound, (await Send(HttpMethod.Post, path)).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await Send(HttpMethod.Delete, "/holds/absent")).StatusCode);
    }
    [Fact]
    public async Task OnlyOwnerCanChangeHold_AndMyHoldsIsScoped()
    {
        var classId = await CreateClass();
        var holdId = await Reserve(classId);
        Assert.Equal(HttpStatusCode.Forbidden, (await Send(HttpMethod.Post, $"/holds/{holdId}/confirm", Other)).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await Send(HttpMethod.Delete, $"/holds/{holdId}", Other)).StatusCode);
        var detail = await client.GetFromJsonAsync<JsonElement>($"/holds/{holdId}");
        Assert.Equal("HELD", detail.GetProperty("status").GetString());
        using var otherHolds = await Send(HttpMethod.Get, "/me/holds", Other);
        Assert.Empty((await otherHolds.Content.ReadFromJsonAsync<JsonElement>()).EnumerateArray());
        using var ownHolds = await Send(HttpMethod.Get, "/me/holds");
        var own = (await ownHolds.Content.ReadFromJsonAsync<JsonElement>())[0];
        Assert.Equal(holdId, own.GetProperty("holdId").GetString());
        Assert.Equal("Safety class", own.GetProperty("className").GetString());
    }
    [Fact]
    public async Task DuplicateActiveAndConfirmedApplications_Return409()
    {
        var classId = await CreateClass(3);
        var holdId = await Reserve(classId);
        Assert.Equal(HttpStatusCode.Conflict, (await Send(HttpMethod.Post, $"/classes/{classId}/holds")).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await Send(HttpMethod.Post, $"/holds/{holdId}/confirm")).StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, (await Send(HttpMethod.Post, $"/classes/{classId}/holds")).StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, (await Send(HttpMethod.Delete, $"/holds/{holdId}")).StatusCode);
    }
    [Fact]
    public async Task CancelReleasesSeat_AndAllowsNewApplication()
    {
        var classId = await CreateClass();
        var holdId = await Reserve(classId);
        Assert.Equal(HttpStatusCode.NoContent, (await Send(HttpMethod.Delete, $"/holds/{holdId}")).StatusCode);
        Assert.Equal("CANCELLED", (await client.GetFromJsonAsync<JsonElement>($"/holds/{holdId}")).GetProperty("status").GetString());
        Assert.Equal(1, (await Summary(classId)).GetProperty("availableSeats").GetInt32());
        Assert.Equal(HttpStatusCode.Conflict, (await Send(HttpMethod.Post, $"/holds/{holdId}/confirm")).StatusCode);
        Assert.NotEqual(holdId, await Reserve(classId));
    }
    [Fact]
    public async Task ExpiredHoldCannotConfirmOrCancel_AndSeatIsReusable()
    {
        var classId = await CreateClass();
        var holdId = await Reserve(classId);
        await Expire(holdId);
        Assert.Equal(1, (await Summary(classId)).GetProperty("availableSeats").GetInt32());
        Assert.Equal(HttpStatusCode.Conflict, (await Send(HttpMethod.Post, $"/holds/{holdId}/confirm")).StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, (await Send(HttpMethod.Delete, $"/holds/{holdId}")).StatusCode);
        Assert.Equal("EXPIRED", (await client.GetFromJsonAsync<JsonElement>($"/holds/{holdId}")).GetProperty("status").GetString());
        Assert.NotEqual(holdId, await Reserve(classId));
    }
    [Fact]
    public async Task BackgroundSweepExpiresWithoutAnyClientRequest()
    {
        var holdId = await Reserve(await CreateClass());
        await Expire(holdId);
        var deadline = DateTime.UtcNow.AddSeconds(22);
        var status = "";
        do {
            await fixture.WithDatabaseAsync(async db => status = await db.Holds.Where(h => h.Id == holdId).Select(h => h.Status).SingleAsync());
            if (status == "EXPIRED") break;
            await Task.Delay(200);
        } while (DateTime.UtcNow < deadline);
        Assert.Equal("EXPIRED", status);
    }
    [Fact]
    public async Task ConcurrentConfirmCancelAndReplacement_CannotBothSucceedOrOverbook()
    {
        for (var round = 0; round < 12; round++) {
            var classId = await CreateClass();
            var holdId = await Reserve(classId);
            var confirm = Send(HttpMethod.Post, $"/holds/{holdId}/confirm");
            var cancel = Send(HttpMethod.Delete, $"/holds/{holdId}");
            var replacement = Send(HttpMethod.Post, $"/classes/{classId}/holds", Other);
            await Task.WhenAll(confirm, cancel, replacement);
            var confirmationWon = confirm.Result.StatusCode == HttpStatusCode.OK;
            Assert.Equal(confirmationWon ? HttpStatusCode.Conflict : HttpStatusCode.NoContent, cancel.Result.StatusCode);
            Assert.Equal(confirmationWon ? HttpStatusCode.OK : HttpStatusCode.Conflict, confirm.Result.StatusCode);
            Assert.Contains(replacement.Result.StatusCode, new[] { HttpStatusCode.Created, HttpStatusCode.Conflict });
            var summary = await Summary(classId);
            Assert.True(summary.GetProperty("heldSeats").GetInt32() + summary.GetProperty("confirmedSeats").GetInt32() <= 1);
        }
    }
    [Fact]
    public async Task ParallelSameStudent_CreatesExactlyOneHold()
    {
        var classId = await CreateClass(10);
        var responses = await Task.WhenAll(Enumerable.Range(0, 25).Select(_ => Send(HttpMethod.Post, $"/classes/{classId}/holds")));
        Assert.Single(responses.Where(r => r.StatusCode == HttpStatusCode.Created));
        Assert.All(responses.Where(r => r.StatusCode != HttpStatusCode.Created), r => Assert.Equal(HttpStatusCode.Conflict, r.StatusCode));
    }
    [Fact]
    public async Task IndependentHostsShareCapacityAndPersistence()
    {
        var classId = await CreateClass(3);
        await using var secondHost = new AdmissionWebApplicationFactory();
        using var second = secondHost.CreateClient();
        var requests = Enumerable.Range(0, 24).Select(async index => {
            using var request = new HttpRequestMessage(HttpMethod.Post, $"/classes/{classId}/holds");
            request.Headers.Add("X-Student-Id", (20152691234567000L + index).ToString());
            return await (index % 2 == 0 ? client : second).SendAsync(request);
        });
        var responses = await Task.WhenAll(requests);
        Assert.Equal(3, responses.Count(r => r.StatusCode == HttpStatusCode.Created));
        Assert.All(responses.Where(r => r.StatusCode != HttpStatusCode.Created), r => Assert.Equal(HttpStatusCode.Conflict, r.StatusCode));
        Assert.Equal(3, (await second.GetFromJsonAsync<JsonElement>($"/classes/{classId}")).GetProperty("heldSeats").GetInt32());
    }
    [Fact]
    public async Task QueuedReservationUsesTimeAfterClassLock()
    {
        var classId = await CreateClass();
        var holdId = await Reserve(classId);
        await fixture.WithDatabaseAsync(db => db.Database.ExecuteSqlInterpolatedAsync(
            $"UPDATE holds SET created_at_utc = clock_timestamp() - interval '10 minutes', expires_at_utc = clock_timestamp() + interval '1 second' WHERE id = {holdId}"));
        await using var connection = new NpgsqlConnection(PostgresTestConfig.ConnectionString);
        await connection.OpenAsync();
        await using var tx = await connection.BeginTransactionAsync();
        await using var command = new NpgsqlCommand("SELECT id FROM classes WHERE id = @id FOR UPDATE", connection, tx);
        command.Parameters.AddWithValue("id", classId);
        await command.ExecuteNonQueryAsync();
        var queued = Send(HttpMethod.Post, $"/classes/{classId}/holds", Other);
        await Task.Delay(100);
        Assert.False(queued.IsCompleted);
        await Task.Delay(1200);
        await tx.CommitAsync();
        Assert.Equal(HttpStatusCode.Created, (await queued).StatusCode);
    }
    [Fact]
    public async Task ConfiguredTtlIsUsed_AndRestartPreservesConfirmedHold()
    {
        await using var host = new AdmissionWebApplicationFactory(42);
        using var session = host.CreateClient();
        var classId = await CreateClass();
        using var request = new HttpRequestMessage(HttpMethod.Post, $"/classes/{classId}/holds");
        request.Headers.Add("X-Student-Id", Student);
        var response = await session.SendAsync(request);
        var holdId = (await response.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("holdId").GetString()!;
        await fixture.WithDatabaseAsync(async db => {
            var hold = await db.Holds.AsNoTracking().SingleAsync(h => h.Id == holdId);
            Assert.Equal(TimeSpan.FromSeconds(42), hold.ExpiresAtUtc - hold.CreatedAtUtc);
        });
        Assert.Equal(HttpStatusCode.OK, (await Send(HttpMethod.Post, $"/holds/{holdId}/confirm")).StatusCode);
        await host.DisposeAsync();
        await using var restarted = new AdmissionWebApplicationFactory();
        using var restartedClient = restarted.CreateClient();
        Assert.Equal("CONFIRMED", (await restartedClient.GetFromJsonAsync<JsonElement>($"/holds/{holdId}")).GetProperty("status").GetString());
    }
    [Fact]
    public Task MigrationSnapshotMatchesModel() => fixture.WithDatabaseAsync(db => {
        Assert.False(db.Database.HasPendingModelChanges());
        return Task.CompletedTask;
    });
}
