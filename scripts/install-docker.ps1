# Run this in PowerShell **as Administrator**.
# Installs Docker Desktop, then use .\run.ps1 after reboot + starting Docker.

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
    Write-Host "   .\scripts\install-docker.ps1"
    Write-Host ""
    exit 1
}

Write-Host "Installing Docker Desktop (this can take several minutes)..." -ForegroundColor Cyan
winget install -e --id Docker.DockerDesktop --accept-package-agreements --accept-source-agreements

Write-Host ""
Write-Host "Next steps:" -ForegroundColor Green
Write-Host "  1. Reboot if prompted"
Write-Host "  2. Start Docker Desktop from the Start menu"
Write-Host "  3. New terminal: cd to project, run .\run.ps1"
