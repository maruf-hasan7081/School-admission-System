using SchoolAdmission.Api.Data;

namespace SchoolAdmission.Api.Data.Entities;

public class Hold
{
    public string Id { get; set; } = null!;
    public string ClassId { get; set; } = null!;
    public string StudentId { get; set; } = null!;
    public string Status { get; set; } = HoldStatus.Held;
    public DateTime CreatedAtUtc { get; set; }
    public DateTime ExpiresAtUtc { get; set; }
    public DateTime? ConfirmedAtUtc { get; set; }

    public AdmissionClass Class { get; set; } = null!;
}
