using System.Net;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Mvc.Testing;

namespace SchoolAdmission.Api.Tests;

/// <summary>
/// Assignment requires a concurrency test; flesh this out once WebApplicationFactory uses a test database.
/// </summary>
public class ConcurrencyTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly HttpClient client;

    public ConcurrencyTests(WebApplicationFactory<Program> factory)
    {
        client = factory.WithWebHostBuilder(_ => { }).CreateClient();
    }

    [Fact(Skip = "Wire up PostgreSQL test container or shared test DB, then assert holds never exceed seats.")]
    public async Task ParallelHolds_NeverExceedTotalSeats()
    {
        var create = await client.PostAsJsonAsync("/classes", new { name = "Load test", totalSeats = 5 });
        Assert.Equal(HttpStatusCode.Created, create.StatusCode);

        var classId = (await create.Content.ReadFromJsonAsync<CreatedClass>())!.Id;
        var tasks = Enumerable.Range(0, 50).Select(i => HoldAsync(classId, i));
        await Task.WhenAll(tasks);

        var list = await client.GetFromJsonAsync<List<ClassRow>>("/classes");
        var row = list!.First(c => c.Id == classId);
        Assert.True(row.HeldSeats + row.ConfirmedSeats <= row.TotalSeats);
    }

    private Task<HttpResponseMessage> HoldAsync(string classId, int index) =>
        client.SendAsync(new HttpRequestMessage(HttpMethod.Post, $"/classes/{classId}/holds")
        {
            Headers = { { "X-Student-Id", (20152691234567800L + index).ToString() } },
        });

    private sealed record CreatedClass(string Id);
    private sealed record ClassRow(
        string Id,
        int TotalSeats,
        int HeldSeats,
        int ConfirmedSeats,
        int AvailableSeats);
}
