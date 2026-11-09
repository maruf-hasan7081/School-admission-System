namespace SchoolAdmission.Api.Services;

public static class StudentIdValidator
{
    public static bool IsValid(string? studentId) =>
        studentId is { Length: 17 } && studentId.All(c => c is >= '0' and <= '9');

    public static void RequireValid(string? studentId)
    {
        if (!IsValid(studentId))
            throw new ApiException(400, "Student ID must be exactly 17 digits (0-9).");
    }
}
