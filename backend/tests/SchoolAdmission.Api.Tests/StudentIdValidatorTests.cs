using SchoolAdmission.Api.Services;

namespace SchoolAdmission.Api.Tests;

public class StudentIdValidatorTests
{
    [Fact]
    public void IsValid_AcceptsSeventeenDigits()
    {
        Assert.True(StudentIdValidator.IsValid("20152691234567890"));
    }

    [Theory]
    [InlineData("")]
    [InlineData("123")]
    [InlineData("201526912345678901")]
    public void IsValid_RejectsInvalidValues(string value)
    {
        Assert.False(StudentIdValidator.IsValid(value));
    }
}
