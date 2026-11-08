# Run API + Vite without Docker (PostgreSQL required).
# Usage: .\scripts\run-local.ps1

$ErrorActionPreference = "Stop"
$Root = Split-Path $PSScriptRoot -Parent

$envLocal = Join-Path $Root ".env.local"
if (Test-Path $envLocal) {
    Get-Content $envLocal | ForEach-Object {
        if ($_ -match '^\s*#' -or $_ -match '^\s*$') { return }
        $pair = $_ -split '=', 2
        if ($pair.Length -eq 2) {
            Set-Item -Path "env:$($pair[0].Trim())" -Value $pair[1].Trim()
        }
    }
}

$connection = $env:ConnectionStrings__Default
if (-not $connection) {
    $connection = "Host=localhost;Port=5432;Database=school_admission;Username=postgres;Password=postgres"
}

$hostName = "localhost"
$port = 5432
foreach ($part in $connection.Split(';')) {
    $kv = $part -split '=', 2
    if ($kv.Length -ne 2) { continue }
    switch ($kv[0].Trim().ToLowerInvariant()) {
        "host" { $hostName = $kv[1].Trim() }
        "port" { $port = [int]$kv[1].Trim() }
    }
}

Write-Host "Checking PostgreSQL at ${hostName}:${port}..." -ForegroundColor Cyan
try {
    $tcp = New-Object System.Net.Sockets.TcpClient
    $tcp.Connect($hostName, $port)
    $tcp.Close()
} catch {
    Write-Host "PostgreSQL is not reachable at ${hostName}:${port}." -ForegroundColor Red
    Write-Host ""
    Write-Host "You need EITHER:" -ForegroundColor Yellow
    Write-Host "  A) Docker Desktop  -> Admin: .\scripts\install-docker.ps1  then .\run.ps1"
    Write-Host "  B) PostgreSQL       -> Admin: .\scripts\install-postgres.ps1  then create DB + .env.local"
    Write-Host ""
    Write-Host "Connection string: $connection"
    exit 1
}

$env:ConnectionStrings__Default = $connection
$env:ASPNETCORE_URLS = "http://localhost:8080"
if (-not $env:VITE_API_URL) { $env:VITE_API_URL = "http://localhost:8080" }

$backendDir = Join-Path $Root "backend"
$frontendDir = Join-Path $Root "frontend"

Write-Host "Starting backend at http://localhost:8080 ..." -ForegroundColor Green
$backend = Start-Process -FilePath "dotnet" -ArgumentList "run" -WorkingDirectory $backendDir -PassThru -NoNewWindow

Start-Sleep -Seconds 4

Write-Host "Starting frontend at http://localhost:5173 ..." -ForegroundColor Green
Write-Host "Press Ctrl+C to stop (backend PID $($backend.Id) may need manual stop)." -ForegroundColor DarkGray

Set-Location $frontendDir
try {
    npm run dev
} finally {
    if (-not $backend.HasExited) {
        Stop-Process -Id $backend.Id -Force -ErrorAction SilentlyContinue
    }
}
