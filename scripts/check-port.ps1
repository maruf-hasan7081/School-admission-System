param([int]$Port = 8080)

$listener = netstat -ano | Select-String "LISTENING" | Select-String ":$Port\s"
if (-not $listener) {
    Write-Host "Port $Port is free." -ForegroundColor Green
    exit 0
}

$processId = [int]($listener.ToString().Trim() -split '\s+' | Select-Object -Last 1)
$proc = Get-Process -Id $processId -ErrorAction SilentlyContinue
$name = if ($proc) { $proc.ProcessName } else { "unknown" }

Write-Host "Port $Port is in use by: $name (PID $processId)" -ForegroundColor Red
Write-Host ""
Write-Host "The assignment API must use http://localhost:8080"
Write-Host "If this is Oracle (TNSLSNR), stop the Oracle listener or change its HTTP port."
Write-Host "If this is an old dotnet run, run: .\scripts\stop-local.ps1"
exit 1
