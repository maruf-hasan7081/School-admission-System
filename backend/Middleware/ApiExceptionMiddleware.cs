using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using SchoolAdmission.Api.Models;
using SchoolAdmission.Api.Services;
namespace SchoolAdmission.Api.Middleware;

public sealed class ApiExceptionMiddleware(RequestDelegate next, ILogger<ApiExceptionMiddleware> logger)
{
    public async Task InvokeAsync(HttpContext context)
    {
        try { await next(context); }
        catch (OperationCanceledException) when (context.RequestAborted.IsCancellationRequested) {
            if (!context.Response.HasStarted) context.Response.StatusCode = 499;
        }
        catch (ApiException ex) when (!context.Response.HasStarted) {
            await WriteAsync(context, ex.StatusCode, ex.Message);
        }
        catch (BadHttpRequestException ex) when (!context.Response.HasStarted) {
            await WriteAsync(context, ex.StatusCode, "Invalid request. Check the JSON body and field value types.");
        }
        catch (JsonException) when (!context.Response.HasStarted) {
            await WriteAsync(context, 400, "Invalid JSON request body.");
        }
        catch (DbUpdateException ex) when (!context.Response.HasStarted &&
            ex.InnerException is PostgresException { SqlState: PostgresErrorCodes.UniqueViolation, ConstraintName: "ix_holds_active_student" }) {
            await WriteAsync(context, 409, "You already have an active application or confirmed admission for this class.");
        }
        catch (NpgsqlException ex) when (!context.Response.HasStarted && ex.IsTransient) {
            logger.LogError(ex, "Database temporarily unavailable");
            await WriteAsync(context, 503, "The admission service is temporarily unavailable. Please try again.");
        }
        catch (Exception ex) when (!context.Response.HasStarted) {
            logger.LogError(ex, "Unhandled API error");
            await WriteAsync(context, 500, "The admission service could not complete this request. Please try again.");
        }
    }
    private static Task WriteAsync(HttpContext context, int status, string message)
    {
        context.Response.StatusCode = status;
        return context.Response.WriteAsJsonAsync(new ApiProblem(message), context.RequestAborted);
    }
}
