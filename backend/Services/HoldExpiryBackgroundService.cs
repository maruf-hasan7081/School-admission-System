namespace SchoolAdmission.Api.Services;

public sealed class HoldExpiryBackgroundService(IServiceProvider services, ILogger<HoldExpiryBackgroundService> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            try {
                await using var scope = services.CreateAsyncScope();
                var admission = scope.ServiceProvider.GetRequiredService<IAdmissionService>();
                await admission.ExpireHoldsAsync(stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { return; }
            catch (Exception ex) { logger.LogError(ex, "Hold expiry sweep failed"); }
            try { await Task.Delay(TimeSpan.FromSeconds(15), stoppingToken); }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { return; }
        }
    }
}
