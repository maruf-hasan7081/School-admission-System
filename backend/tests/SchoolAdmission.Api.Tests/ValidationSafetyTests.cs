using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging.Abstractions;
using SchoolAdmission.Api.Middleware;
using SchoolAdmission.Api.Services;
using SchoolAdmission.Api.Tests.Infrastructure;
namespace SchoolAdmission.Api.Tests;

public class ValidationSafetyTests
{
    [Theory]
    [InlineData("Host=localhost;Database=school_admission")]
    [InlineData("Host=localhost;Database=postgres")]
    [InlineData("Host=localhost;Database=school_admission_testproduction;Username=x")]
    public void TestDatabaseGuardRejectsUnsafeNames(string connection)
    {
        Assert.Throws<InvalidOperationException>(() => PostgresTestConfig.Validate(connection));
    }
    [Theory]
    [InlineData("20152691234567890\n")]
    [InlineData(" 20152691234567890")]
    [InlineData("\u0661\u0662\u0663\u0664\u0665\u0666\u0667\u0668\u0669\u0660\u0661\u0662\u0663\u0664\u0665\u0666\u0667")]
    public void StudentIdRejectsNonAsciiOrWhitespace(string value) => Assert.False(StudentIdValidator.IsValid(value));
    [Fact]
    public async Task UnexpectedServerErrorIs500_AndDoesNotExposeException()
    {
        var context = new DefaultHttpContext();
        context.Response.Body = new MemoryStream();
        var middleware = new ApiExceptionMiddleware(_ => throw new InvalidOperationException("private exception detail"),
            NullLogger<ApiExceptionMiddleware>.Instance);
        await middleware.InvokeAsync(context);
        Assert.Equal(500, context.Response.StatusCode);
        context.Response.Body.Position = 0;
        Assert.DoesNotContain("private exception detail", await new StreamReader(context.Response.Body).ReadToEndAsync());
    }
}
