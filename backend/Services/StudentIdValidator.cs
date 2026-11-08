using System.Text.RegularExpressions;

namespace SchoolAdmission.Api.Services;

public static partial class StudentIdValidator
{
    [GeneratedRegex(@"^\d{17}$")]
    private static partial Regex Pattern();

    public static bool IsValid(string? studentId) =>
        !string.IsNullOrWhiteSpace(studentId) && Pattern().IsMatch(studentId);

    public static void RequireValid(string? studentId)
    {
        if (!IsValid(studentId))
        {
            throw new ApiException(StatusCodes.Status400BadRequest, "Student ID must be exactly 17 digits.");
        }
    }
}
