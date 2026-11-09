using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using SchoolAdmission.Api.Data;
using SchoolAdmission.Api.Data.Entities;
using SchoolAdmission.Api.Models;

namespace SchoolAdmission.Api.Services;

public sealed class AdmissionService(
    AppDbContext db,
    IOptions<AdmissionOptions> options,
    ILogger<AdmissionService> logger) : IAdmissionService
{
    public async Task<ClassResponse> CreateClassAsync(CreateClassRequest request, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.Name))
            throw new ApiException(400, "Class name is required.");
        var name = request.Name.Trim();
        if (name.Length > 256)
            throw new ApiException(400, "Class name must be 256 characters or fewer.");
        if (request.TotalSeats < 1)
            throw new ApiException(400, "Total seats must be at least 1.");
        var entity = new AdmissionClass { Id = $"c_{Guid.NewGuid():N}", Name = name, TotalSeats = request.TotalSeats };
        db.Classes.Add(entity);
        await db.SaveChangesAsync(ct);
        return new ClassResponse(entity.Id, entity.Name, entity.TotalSeats);
    }

    public async Task<IReadOnlyList<ClassSummaryResponse>> ListClassesAsync(CancellationToken ct) =>
        await Summaries(db.Classes.AsNoTracking().OrderBy(c => c.Name).ThenBy(c => c.Id), await DatabaseTimeAsync(ct)).ToListAsync(ct);

    public async Task<ClassSummaryResponse> GetClassAsync(string classId, CancellationToken ct) =>
        await Summaries(db.Classes.AsNoTracking().Where(c => c.Id == classId), await DatabaseTimeAsync(ct)).SingleOrDefaultAsync(ct)
        ?? throw new ApiException(404, "Class not found.");

    public async Task<HoldResponse> CreateHoldAsync(string classId, string studentId, CancellationToken ct)
    {
        StudentIdValidator.RequireValid(studentId);
        await using var tx = await db.Database.BeginTransactionAsync(ct);
        var admissionClass = await LockClassAsync(classId, ct);
        // Read the database clock after acquiring the lock: queued requests must
        // not reserve against a timestamp captured before their wait.
        var now = await DatabaseTimeAsync(ct);
        await db.Holds.Where(h => h.ClassId == classId && h.Status == HoldStatus.Held && h.ExpiresAtUtc <= now)
            .ExecuteUpdateAsync(s => s.SetProperty(h => h.Status, HoldStatus.Expired), ct);
        var active = await db.Holds.AnyAsync(h => h.ClassId == classId && h.StudentId == studentId
            && (h.Status == HoldStatus.Held || h.Status == HoldStatus.Confirmed), ct);
        if (active)
            throw new ApiException(409, "You already have an active application or confirmed admission for this class.");
        var occupied = await db.Holds.CountAsync(h => h.ClassId == classId
            && (h.Status == HoldStatus.Confirmed || (h.Status == HoldStatus.Held && h.ExpiresAtUtc > now)), ct);
        if (occupied >= admissionClass.TotalSeats)
            throw new ApiException(409, "No seats available.");
        var createdAt = await DatabaseTimeAsync(ct);
        var hold = new Hold {
            Id = $"h_{Guid.NewGuid():N}", ClassId = classId, StudentId = studentId,
            Status = HoldStatus.Held, CreatedAtUtc = createdAt,
            ExpiresAtUtc = createdAt.AddSeconds(options.Value.HoldDurationSeconds)
        };
        db.Holds.Add(hold);
        await db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);
        return new HoldResponse(hold.Id, hold.ClassId, hold.StudentId, hold.Status, hold.ExpiresAtUtc.ToString("O"));
    }

    public async Task<HoldDetailResponse> GetHoldAsync(string holdId, CancellationToken ct)
    {
        await ExpireHoldAsync(holdId, ct);
        var hold = await db.Holds.AsNoTracking().SingleOrDefaultAsync(h => h.Id == holdId, ct)
            ?? throw new ApiException(404, "Hold not found.");
        return new HoldDetailResponse(hold.Id, hold.ClassId, hold.Status, hold.ExpiresAtUtc.ToString("O"));
    }

    public async Task<HoldConfirmResponse> ConfirmHoldAsync(string holdId, string studentId, CancellationToken ct)
    {
        StudentIdValidator.RequireValid(studentId);
        await using var tx = await db.Database.BeginTransactionAsync(ct);
        await LockHoldClassAsync(holdId, ct);
        var hold = await OwnedHoldAsync(holdId, studentId, ct);
        if (hold.Status == HoldStatus.Confirmed) {
            await tx.CommitAsync(ct);
            return new HoldConfirmResponse(holdId, HoldStatus.Confirmed);
        }
        // The predicate uses clock_timestamp(), not transaction-start now().
        // It is checked inside the UPDATE, so a paused request cannot resurrect
        // an expired hold after another request has allocated its seat.
        var changed = await db.Database.ExecuteSqlInterpolatedAsync(
            $@"UPDATE holds SET status = {HoldStatus.Confirmed}, confirmed_at_utc = clock_timestamp()
               WHERE id = {holdId} AND status = {HoldStatus.Held} AND expires_at_utc > clock_timestamp()", ct);
        if (changed == 0) {
            await ExpireHoldAsync(holdId, ct);
            await tx.CommitAsync(ct);
            throw new ApiException(409, "Only an active, unexpired hold can be confirmed.");
        }
        await tx.CommitAsync(ct);
        return new HoldConfirmResponse(holdId, HoldStatus.Confirmed);
    }

    public async Task CancelHoldAsync(string holdId, string studentId, CancellationToken ct)
    {
        StudentIdValidator.RequireValid(studentId);
        await using var tx = await db.Database.BeginTransactionAsync(ct);
        await LockHoldClassAsync(holdId, ct);
        await OwnedHoldAsync(holdId, studentId, ct);
        var changed = await db.Database.ExecuteSqlInterpolatedAsync(
            $@"UPDATE holds SET status = {HoldStatus.Cancelled}
               WHERE id = {holdId} AND status = {HoldStatus.Held} AND expires_at_utc > clock_timestamp()", ct);
        if (changed == 0) {
            await ExpireHoldAsync(holdId, ct);
            await tx.CommitAsync(ct);
            throw new ApiException(409, "Only an active, unexpired hold can be cancelled.");
        }
        await tx.CommitAsync(ct);
    }

    public async Task<IReadOnlyList<MyHoldResponse>> ListMyHoldsAsync(string studentId, CancellationToken ct)
    {
        StudentIdValidator.RequireValid(studentId);
        await db.Database.ExecuteSqlInterpolatedAsync(
            $@"UPDATE holds SET status = {HoldStatus.Expired}
               WHERE student_id = {studentId} AND status = {HoldStatus.Held} AND expires_at_utc <= clock_timestamp()", ct);
        return await db.Holds.AsNoTracking().Where(h => h.StudentId == studentId)
            .OrderByDescending(h => h.CreatedAtUtc).ThenBy(h => h.Id)
            .Select(h => new MyHoldResponse(h.Id, h.ClassId, h.Class.Name, h.Status, h.ExpiresAtUtc.ToString("O")))
            .ToListAsync(ct);
    }

    public async Task ExpireHoldsAsync(CancellationToken ct)
    {
        var count = await db.Database.ExecuteSqlInterpolatedAsync(
            $@"UPDATE holds SET status = {HoldStatus.Expired}
               WHERE status = {HoldStatus.Held} AND expires_at_utc <= clock_timestamp()", ct);
        if (count > 0) logger.LogDebug("Expired {Count} holds", count);
    }

    private Task<int> ExpireHoldAsync(string holdId, CancellationToken ct) =>
        db.Database.ExecuteSqlInterpolatedAsync(
            $@"UPDATE holds SET status = {HoldStatus.Expired}
               WHERE id = {holdId} AND status = {HoldStatus.Held} AND expires_at_utc <= clock_timestamp()", ct);

    private async Task<AdmissionClass> LockClassAsync(string classId, CancellationToken ct) =>
        await db.Classes.FromSqlInterpolated($"SELECT * FROM classes WHERE id = {classId} FOR UPDATE")
            .AsNoTracking().SingleOrDefaultAsync(ct)
        ?? throw new ApiException(404, "Class not found.");

    private async Task LockHoldClassAsync(string holdId, CancellationToken ct)
    {
        var classId = await db.Holds.AsNoTracking().Where(h => h.Id == holdId).Select(h => h.ClassId).SingleOrDefaultAsync(ct)
            ?? throw new ApiException(404, "Hold not found.");
        await LockClassAsync(classId, ct);
    }

    private async Task<Hold> OwnedHoldAsync(string holdId, string studentId, CancellationToken ct)
    {
        var hold = await db.Holds.AsNoTracking().SingleOrDefaultAsync(h => h.Id == holdId, ct)
            ?? throw new ApiException(404, "Hold not found.");
        if (!string.Equals(hold.StudentId, studentId, StringComparison.Ordinal))
            throw new ApiException(403, "This hold belongs to another student.");
        return hold;
    }

    private Task<DateTime> DatabaseTimeAsync(CancellationToken ct) =>
        db.Database.SqlQueryRaw<DateTime>("SELECT clock_timestamp() AS \"Value\"").SingleAsync(ct);

    private static IQueryable<ClassSummaryResponse> Summaries(IQueryable<AdmissionClass> classes, DateTime now) =>
        classes.Select(c => new {
            c.Id, c.Name, c.TotalSeats,
            Held = c.Holds.Count(h => h.Status == HoldStatus.Held && h.ExpiresAtUtc > now),
            Confirmed = c.Holds.Count(h => h.Status == HoldStatus.Confirmed)
        }).Select(c => new ClassSummaryResponse(c.Id, c.Name, c.TotalSeats,
            c.Held, c.Confirmed, c.TotalSeats - c.Held - c.Confirmed));
}
