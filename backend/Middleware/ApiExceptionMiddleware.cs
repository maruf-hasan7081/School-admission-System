using SchoolAdmission.Api.Models;
using SchoolAdmission.Api.Services;

namespace SchoolAdmission.Api.Middleware;

public sealed class ApiExceptionMiddleware(RequestDelegate next, ILogger<ApiExceptionMiddleware> logger)
{
    public async Task InvokeAsync(HttpContext context)
    {
        try
        {
            await next(context);
        }
        catch (ApiException ex)
        {
            context.Response.StatusCode = ex.StatusCode;
            await context.Response.WriteAsJsonAsync(new ApiProblem(ex.Message));
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Unhandled error");
            context.Response.StatusCode = StatusCodes.Status400BadRequest;
            await context.Response.WriteAsJsonAsync(new ApiProblem("Request could not be processed."));
        }
    }
}
