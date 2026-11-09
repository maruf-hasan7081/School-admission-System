using SchoolAdmission.Api.Models;
using SchoolAdmission.Api.Services;

namespace SchoolAdmission.Api.Api;

public static class AdmissionEndpoints
{
    public static void MapAdmissionEndpoints(this WebApplication app)
    {
        app.MapPost("/classes", async (CreateClassRequest? request, IAdmissionService service, CancellationToken ct) =>
        {
            if (request is null) throw new ApiException(400, "A JSON class request body is required.");
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
            var studentId = RequireStudentId(http);
            var hold = await service.CreateHoldAsync(classId, studentId, ct);
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
            var studentId = RequireStudentId(http);
            var result = await service.ConfirmHoldAsync(holdId, studentId, ct);
            return Results.Ok(result);
        });

        app.MapDelete("/holds/{holdId}", async (
            string holdId,
            HttpContext http,
            IAdmissionService service,
            CancellationToken ct) =>
        {
            var studentId = RequireStudentId(http);
            await service.CancelHoldAsync(holdId, studentId, ct);
            return Results.NoContent();
        });

        app.MapGet("/me/holds", async (
            HttpContext http,
            IAdmissionService service,
            CancellationToken ct) =>
        {
            var studentId = RequireStudentId(http);
            return Results.Ok(await service.ListMyHoldsAsync(studentId, ct));
        });
    }
    private static string RequireStudentId(HttpContext http)
    {
        var values = http.Request.Headers["X-Student-Id"];
        if (values.Count != 1) throw new ApiException(400, "Exactly one X-Student-Id header is required.");
        var studentId = values[0];
        StudentIdValidator.RequireValid(studentId);
        return studentId!;
    }
}
