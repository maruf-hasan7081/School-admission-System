using SchoolAdmission.Api.Models;
using SchoolAdmission.Api.Services;

namespace SchoolAdmission.Api.Api;

public static class AdmissionEndpoints
{
    public static void MapAdmissionEndpoints(this WebApplication app)
    {
        app.MapPost("/classes", async (CreateClassRequest request, IAdmissionService service, CancellationToken ct) =>
        {
            var created = await service.CreateClassAsync(request, ct);
            return Results.Created($"/classes/{created.Id}", created);
        });

        app.MapGet("/classes", async (IAdmissionService service, CancellationToken ct) =>
            Results.Ok(await service.ListClassesAsync(ct)));

        app.MapGet("/classes/{classId}", async (string classId, IAdmissionService service, CancellationToken ct) =>
            Results.Ok(await service.GetClassAsync(classId, ct)));

        app.MapPost("/classes/{classId}/holds", async (
            string classId,
            HttpContext http,
            IAdmissionService service,
            CancellationToken ct) =>
        {
            var studentId = http.Request.Headers["X-Student-Id"].FirstOrDefault();
            var hold = await service.CreateHoldAsync(classId, studentId ?? string.Empty, ct);
            return Results.Created($"/holds/{hold.HoldId}", hold);
        });

        app.MapGet("/holds/{holdId}", async (string holdId, IAdmissionService service, CancellationToken ct) =>
            Results.Ok(await service.GetHoldAsync(holdId, ct)));

        app.MapPost("/holds/{holdId}/confirm", async (
            string holdId,
            HttpContext http,
            IAdmissionService service,
            CancellationToken ct) =>
        {
            var studentId = http.Request.Headers["X-Student-Id"].FirstOrDefault();
            var result = await service.ConfirmHoldAsync(holdId, studentId ?? string.Empty, ct);
            return Results.Ok(result);
        });

        app.MapDelete("/holds/{holdId}", async (
            string holdId,
            HttpContext http,
            IAdmissionService service,
            CancellationToken ct) =>
        {
            var studentId = http.Request.Headers["X-Student-Id"].FirstOrDefault();
            await service.CancelHoldAsync(holdId, studentId ?? string.Empty, ct);
            return Results.NoContent();
        });

        app.MapGet("/me/holds", async (
            HttpContext http,
            IAdmissionService service,
            CancellationToken ct) =>
        {
            var studentId = http.Request.Headers["X-Student-Id"].FirstOrDefault();
            return Results.Ok(await service.ListMyHoldsAsync(studentId ?? string.Empty, ct));
        });
    }
}
