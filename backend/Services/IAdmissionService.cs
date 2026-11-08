using SchoolAdmission.Api.Models;

namespace SchoolAdmission.Api.Services;

public interface IAdmissionService
{
    Task<ClassResponse> CreateClassAsync(CreateClassRequest request, CancellationToken cancellationToken);
    Task<IReadOnlyList<ClassSummaryResponse>> ListClassesAsync(CancellationToken cancellationToken);
    Task<ClassSummaryResponse> GetClassAsync(string classId, CancellationToken cancellationToken);
    Task<HoldResponse> CreateHoldAsync(string classId, string studentId, CancellationToken cancellationToken);
    Task<HoldDetailResponse> GetHoldAsync(string holdId, CancellationToken cancellationToken);
    Task<HoldConfirmResponse> ConfirmHoldAsync(string holdId, string studentId, CancellationToken cancellationToken);
    Task CancelHoldAsync(string holdId, string studentId, CancellationToken cancellationToken);
    Task<IReadOnlyList<MyHoldResponse>> ListMyHoldsAsync(string studentId, CancellationToken cancellationToken);
    Task ExpireHoldsAsync(CancellationToken cancellationToken);
}
