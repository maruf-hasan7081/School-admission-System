namespace SchoolAdmission.Api.Models;

public sealed record CreateClassRequest(string Name, int TotalSeats);

public sealed record ClassResponse(string Id, string Name, int TotalSeats);

public sealed record ClassSummaryResponse(
    string Id,
    string Name,
    int TotalSeats,
    int HeldSeats,
    int ConfirmedSeats,
    int AvailableSeats);

public sealed record HoldResponse(
    string HoldId,
    string ClassId,
    string StudentId,
    string Status,
    string ExpiresAt);

public sealed record HoldDetailResponse(
    string HoldId,
    string ClassId,
    string Status,
    string ExpiresAt);

public sealed record HoldConfirmResponse(string HoldId, string Status);

public sealed record MyHoldResponse(
    string HoldId,
    string ClassId,
    string ClassName,
    string Status,
    string ExpiresAt);
