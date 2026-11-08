# Run this in PowerShell **as Administrator** for local dev without Docker.
# After install: set postgres password, create database school_admission, then .\scripts\run-local.ps1

$ErrorActionPreference = "Stop"

if (-not ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    $projectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
    Write-Host "This installer needs Administrator rights." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "1. Close this terminal"
    Write-Host "2. Start menu -> type PowerShell -> right-click -> Run as administrator"
    Write-Host "3. Paste these two lines:" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "   cd `"$projectRoot`""
    Write-Host "   .\scripts\install-postgres.ps1"
    Write-Host ""
    exit 1
}

Write-Host "Installing PostgreSQL 17 via winget..." -ForegroundColor Cyan
winget install -e --id PostgreSQL.PostgreSQL.17 --accept-package-agreements --accept-source-agreements

Write-Host ""
Write-Host "After install:" -ForegroundColor Green
Write-Host "  1. Note the postgres superuser password you chose in the installer"
Write-Host "  2. Create DB (pgAdmin or psql): CREATE DATABASE school_admission;"
Write-Host "  3. Copy .env.local.example to .env.local and set ConnectionStrings__Default"
Write-Host "  4. .\scripts\run-local.ps1"
