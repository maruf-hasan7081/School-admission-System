using Microsoft.EntityFrameworkCore;
using SchoolAdmission.Api.Data;
using SchoolAdmission.Api.Data.Entities;
using SchoolAdmission.Api.Models;

namespace SchoolAdmission.Api.Services;

public sealed class AdmissionService(
    AppDbContext db,
    IConfiguration configuration,
    ILogger<AdmissionService> logger) : IAdmissionService
{
    private int HoldDurationSeconds =>
        configuration.GetValue("HOLD_DURATION_SECONDS", 600);

    public async Task<ClassResponse> CreateClassAsync(
        CreateClassRequest request,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Name))
        {
            throw new ApiException(StatusCodes.Status400BadRequest, "Class name is required.");
        }

        if (request.TotalSeats < 1)
        {
            throw new ApiException(StatusCodes.Status400BadRequest, "Total seats must be at least 1.");
        }

        var entity = new AdmissionClass
        {
            Id = NewClassId(),
            Name = request.Name.Trim(),
            TotalSeats = request.TotalSeats,
        };

        db.Classes.Add(entity);
        await db.SaveChangesAsync(cancellationToken);

        return new ClassResponse(entity.Id, entity.Name, entity.TotalSeats);
    }

    public async Task<IReadOnlyList<ClassSummaryResponse>> ListClassesAsync(CancellationToken cancellationToken)
    {
        await ExpireHoldsAsync(cancellationToken);

        var classes = await db.Classes.AsNoTracking().OrderBy(c => c.Name).ToListAsync(cancellationToken);
        var result = new List<ClassSummaryResponse>(classes.Count);

        foreach (var item in classes)
        {
            result.Add(await BuildClassSummaryAsync(item.Id, item.Name, item.TotalSeats, cancellationToken));
        }

        return result;
    }

    public async Task<ClassSummaryResponse> GetClassAsync(string classId, CancellationToken cancellationToken)
    {
        await ExpireHoldsAsync(cancellationToken);

        var item = await db.Classes.AsNoTracking()
            .FirstOrDefaultAsync(c => c.Id == classId, cancellationToken);

        if (item is null)
        {
            throw new ApiException(StatusCodes.Status404NotFound, "Class not found.");
        }

        return await BuildClassSummaryAsync(item.Id, item.Name, item.TotalSeats, cancellationToken);
    }

    public async Task<HoldResponse> CreateHoldAsync(
        string classId,
        string studentId,
        CancellationToken cancellationToken)
    {
        StudentIdValidator.RequireValid(studentId);
        var now = DateTime.UtcNow;

        await using var tx = await db.Database.BeginTransactionAsync(cancellationToken);

        await db.Database.ExecuteSqlInterpolatedAsync(
            $"SELECT id FROM classes WHERE id = {classId} FOR UPDATE");

        var admissionClass = await db.Classes
            .FirstOrDefaultAsync(c => c.Id == classId, cancellationToken);

        if (admissionClass is null)
        {
            throw new ApiException(StatusCodes.Status404NotFound, "Class not found.");
        }

        await ExpireHoldsForClassAsync(classId, now, cancellationToken);

        var hasActive = await db.Holds.AnyAsync(
            h => h.ClassId == classId
                 && h.StudentId == studentId
                 && (h.Status == HoldStatus.Held || h.Status == HoldStatus.Confirmed),
            cancellationToken);

        if (hasActive)
        {
            throw new ApiException(
                StatusCodes.Status409Conflict,
                "You already have an active application or confirmed admission for this class.");
        }

        var (held, confirmed) = await CountSeatsAsync(classId, now, cancellationToken);
        if (held + confirmed >= admissionClass.TotalSeats)
        {
            throw new ApiException(StatusCodes.Status409Conflict, "No seats available.");
        }

        var hold = new Hold
        {
            Id = NewHoldId(),
            ClassId = classId,
            StudentId = studentId,
            Status = HoldStatus.Held,
            CreatedAtUtc = now,
            ExpiresAtUtc = now.AddSeconds(HoldDurationSeconds),
        };

        db.Holds.Add(hold);
        await db.SaveChangesAsync(cancellationToken);
        await tx.CommitAsync(cancellationToken);

        return new HoldResponse(
            hold.Id,
            hold.ClassId,
            hold.StudentId,
            hold.Status,
            hold.ExpiresAtUtc.ToString("O"));
    }

    public async Task<HoldDetailResponse> GetHoldAsync(string holdId, CancellationToken cancellationToken)
    {
        var hold = await db.Holds.AsNoTracking().FirstOrDefaultAsync(h => h.Id == holdId, cancellationToken);
        if (hold is null)
        {
            throw new ApiException(StatusCodes.Status404NotFound, "Hold not found.");
        }

        hold = await EnsureHoldStateAsync(hold, cancellationToken);

        return new HoldDetailResponse(
            hold.Id,
            hold.ClassId,
            hold.Status,
            hold.ExpiresAtUtc.ToString("O"));
    }

    public async Task<HoldConfirmResponse> ConfirmHoldAsync(
        string holdId,
        string studentId,
        CancellationToken cancellationToken)
    {
        StudentIdValidator.RequireValid(studentId);

        var hold = await db.Holds.FirstOrDefaultAsync(h => h.Id == holdId, cancellationToken);
        if (hold is null)
        {
            throw new ApiException(StatusCodes.Status404NotFound, "Hold not found.");
        }

        if (!string.Equals(hold.StudentId, studentId, StringComparison.Ordinal))
        {
            throw new ApiException(StatusCodes.Status403Forbidden, "This hold belongs to another student.");
        }

        hold = await EnsureHoldStateAsync(hold, cancellationToken);

        if (hold.Status == HoldStatus.Confirmed)
        {
            return new HoldConfirmResponse(hold.Id, HoldStatus.Confirmed);
        }

        if (hold.Status != HoldStatus.Held)
        {
            throw new ApiException(StatusCodes.Status409Conflict, "This hold cannot be confirmed.");
        }

        if (hold.ExpiresAtUtc <= DateTime.UtcNow)
        {
            throw new ApiException(StatusCodes.Status409Conflict, "This hold has expired.");
        }

        hold.Status = HoldStatus.Confirmed;
        hold.ConfirmedAtUtc = DateTime.UtcNow;
        await db.SaveChangesAsync(cancellationToken);

        return new HoldConfirmResponse(hold.Id, HoldStatus.Confirmed);
    }

    public async Task CancelHoldAsync(string holdId, string studentId, CancellationToken cancellationToken)
    {
        StudentIdValidator.RequireValid(studentId);

        var hold = await db.Holds.FirstOrDefaultAsync(h => h.Id == holdId, cancellationToken);
        if (hold is null)
        {
            throw new ApiException(StatusCodes.Status404NotFound, "Hold not found.");
        }

        if (!string.Equals(hold.StudentId, studentId, StringComparison.Ordinal))
        {
            throw new ApiException(StatusCodes.Status403Forbidden, "This hold belongs to another student.");
        }

        hold = await EnsureHoldStateAsync(hold, cancellationToken);

        if (hold.Status != HoldStatus.Held)
        {
            throw new ApiException(StatusCodes.Status409Conflict, "Only an active hold can be cancelled.");
        }

        hold.Status = HoldStatus.Cancelled;
        await db.SaveChangesAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<MyHoldResponse>> ListMyHoldsAsync(
        string studentId,
        CancellationToken cancellationToken)
    {
        StudentIdValidator.RequireValid(studentId);
        await ExpireHoldsAsync(cancellationToken);

        var holds = await db.Holds
            .AsNoTracking()
            .Include(h => h.Class)
            .Where(h => h.StudentId == studentId)
            .OrderByDescending(h => h.CreatedAtUtc)
            .ToListAsync(cancellationToken);

        return holds
            .Select(h => new MyHoldResponse(
                h.Id,
                h.ClassId,
                h.Class.Name,
                h.Status,
                h.ExpiresAtUtc.ToString("O")))
            .ToList();
    }

    public async Task ExpireHoldsAsync(CancellationToken cancellationToken)
    {
        var now = DateTime.UtcNow;
        var expired = await db.Holds
            .Where(h => h.Status == HoldStatus.Held && h.ExpiresAtUtc <= now)
            .ExecuteUpdateAsync(
                s => s.SetProperty(h => h.Status, HoldStatus.Expired),
                cancellationToken);

        if (expired > 0)
        {
            logger.LogDebug("Expired {Count} holds", expired);
        }
    }

    private async Task ExpireHoldsForClassAsync(string classId, DateTime now, CancellationToken cancellationToken)
    {
        await db.Holds
            .Where(h => h.ClassId == classId && h.Status == HoldStatus.Held && h.ExpiresAtUtc <= now)
            .ExecuteUpdateAsync(
                s => s.SetProperty(h => h.Status, HoldStatus.Expired),
                cancellationToken);
    }

    private async Task<Hold> EnsureHoldStateAsync(Hold hold, CancellationToken cancellationToken)
    {
        if (hold.Status == HoldStatus.Held && hold.ExpiresAtUtc <= DateTime.UtcNow)
        {
            var tracked = await db.Holds.FirstOrDefaultAsync(h => h.Id == hold.Id, cancellationToken);
            if (tracked is not null && tracked.Status == HoldStatus.Held)
            {
                tracked.Status = HoldStatus.Expired;
                await db.SaveChangesAsync(cancellationToken);
                return tracked;
            }
        }

        return hold;
    }

    private async Task<ClassSummaryResponse> BuildClassSummaryAsync(
        string id,
        string name,
        int totalSeats,
        CancellationToken cancellationToken)
    {
        var now = DateTime.UtcNow;
        var (held, confirmed) = await CountSeatsAsync(id, now, cancellationToken);
        var available = Math.Max(0, totalSeats - held - confirmed);

        return new ClassSummaryResponse(id, name, totalSeats, held, confirmed, available);
    }

    private async Task<(int Held, int Confirmed)> CountSeatsAsync(
        string classId,
        DateTime now,
        CancellationToken cancellationToken)
    {
        var held = await db.Holds.CountAsync(
            h => h.ClassId == classId && h.Status == HoldStatus.Held && h.ExpiresAtUtc > now,
            cancellationToken);

        var confirmed = await db.Holds.CountAsync(
            h => h.ClassId == classId && h.Status == HoldStatus.Confirmed,
            cancellationToken);

        return (held, confirmed);
    }

    private static string NewClassId() => $"c_{Guid.NewGuid():N}";
    private static string NewHoldId() => $"h_{Guid.NewGuid():N}";
}
