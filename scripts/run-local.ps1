# Run the API and Vite without Docker.
$ErrorActionPreference = "Stop"
$Root = Split-Path $PSScriptRoot -Parent
. (Join-Path $PSScriptRoot "PortUtils.ps1")
Import-LocalEnvironment -Root $Root
# Restart this project's existing servers before selecting ports.
Stop-LocalProjectProcesses -Root $Root
$frontendPort = Resolve-FrontendPort
$backendDir = Join-Path $Root "backend"
$frontendDir = Join-Path $Root "frontend"
$apiPort = Resolve-ApiPort
Set-ApiPortEnvironment -Port $apiPort
$env:ASPNETCORE_ENVIRONMENT = "Development"
Write-Host "API: $env:VITE_API_URL" -ForegroundColor Cyan
if (-not (Test-Path (Join-Path $frontendDir "node_modules"))) {
    Push-Location $frontendDir
    try {
        npm.cmd ci
        if ($LASTEXITCODE -ne 0) { throw "Frontend dependency installation failed." }
    } finally { Pop-Location }
}
dotnet build (Join-Path $backendDir "SchoolAdmission.Api.csproj")
if ($LASTEXITCODE -ne 0) { throw "Backend build failed." }
$apiDll = Join-Path $backendDir "bin\Debug\net8.0\SchoolAdmission.Api.dll"
$startInfo = New-Object System.Diagnostics.ProcessStartInfo
$startInfo.FileName = "dotnet"
$startInfo.Arguments = '"' + $apiDll + '"'
$startInfo.WorkingDirectory = $backendDir
$startInfo.UseShellExecute = $false
$startInfo.CreateNoWindow = $true
$startInfo.EnvironmentVariables["Logging__LogLevel__Microsoft.EntityFrameworkCore"] = "Warning"
$backend = [System.Diagnostics.Process]::Start($startInfo)
try {
    Write-Host "Waiting for API readiness..."
    $ready = $false
    for ($attempt = 0; $attempt -lt 60; $attempt++) {
        if ($backend.HasExited) {
            throw "Backend exited before startup. Check PostgreSQL, the database and .env.local credentials."
        }
        try {
            $response = Invoke-WebRequest "http://127.0.0.1:$apiPort/classes" -UseBasicParsing -TimeoutSec 5
            if ($response.StatusCode -eq 200) { $ready = $true; break }
        } catch { }
        Start-Sleep -Milliseconds 500
    }
    if (-not $ready) { throw "Backend did not become ready. Check the API output above." }
    Write-Host "Backend ready: $env:VITE_API_URL" -ForegroundColor Green
    Write-Host "Frontend: http://localhost:$frontendPort | Press Ctrl+C to stop." -ForegroundColor Green
    Push-Location $frontendDir
    try {
        npm.cmd run dev -- --port $frontendPort --strictPort
        if ($LASTEXITCODE -ne 0) { throw "Frontend startup failed (exit $LASTEXITCODE)." }
    } finally { Pop-Location }
} finally {
    if (-not $backend.HasExited) { Stop-Process -Id $backend.Id -Force -ErrorAction SilentlyContinue }
}
