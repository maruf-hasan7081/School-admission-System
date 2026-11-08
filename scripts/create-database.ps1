# Creates database school_admission (run after PostgreSQL install).
# Usage: .\scripts\create-database.ps1

$ErrorActionPreference = "Stop"
$Root = Split-Path $PSScriptRoot -Parent
$envLocal = Join-Path $Root ".env.local"

$psql = @(
    "$env:ProgramFiles\PostgreSQL\17\bin\psql.exe",
    "$env:ProgramFiles\PostgreSQL\18\bin\psql.exe"
) | Where-Object { Test-Path $_ } | Select-Object -First 1

if (-not $psql) {
    Write-Host "psql.exe not found. Use pgAdmin 4 from the Start menu." -ForegroundColor Red
    Write-Host 'In pgAdmin: Databases -> Create -> name: school_admission'
    exit 1
}

Write-Host "Using: $psql" -ForegroundColor Cyan
Write-Host "Enter the postgres password you set during installation."
Write-Host ""

& $psql -U postgres -h localhost -p 5432 -c "CREATE DATABASE school_admission;"

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "Database created." -ForegroundColor Green
}

if (-not (Test-Path $envLocal)) {
    Copy-Item (Join-Path $Root ".env.local.example") $envLocal
    Write-Host "Created .env.local - set Password= if it is not postgres." -ForegroundColor Yellow
}

Write-Host ""
Write-Host 'Next: .\scripts\run-local.ps1'
