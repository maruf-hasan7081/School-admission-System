# School Admission — Windows launcher (PowerShell)
# Usage: .\run.ps1

$ErrorActionPreference = "Stop"
$Root = $PSScriptRoot

function Test-DockerOnPath {
    return $null -ne (Get-Command docker -ErrorAction SilentlyContinue)
}

function Add-DockerToPathIfInstalled {
    $bin = "${env:ProgramFiles}\Docker\Docker\resources\bin"
    if (Test-Path "$bin\docker.exe") {
        $env:Path = "$bin;$env:Path"
        return $true
    }
    return $false
}

if (-not (Test-DockerOnPath)) {
    [void](Add-DockerToPathIfInstalled)
}

if (Test-DockerOnPath) {
    Set-Location $Root
    Write-Host "Starting Docker Compose..." -ForegroundColor Green
    docker compose up --build
    exit $LASTEXITCODE
}

Write-Host ""
Write-Host "Docker was not found." -ForegroundColor Red
Write-Host ""
Write-Host "This project is meant to run with: docker compose up --build"
Write-Host "Install Docker Desktop for Windows, then open a NEW terminal:"
Write-Host "  https://docs.docker.com/desktop/setup/install/windows-install/"
Write-Host ""
Write-Host "Or install via winget (admin PowerShell):"
Write-Host '  winget install -e --id Docker.DockerDesktop'
Write-Host ""
Write-Host "After Docker is running, from this folder:"
Write-Host "  .\run.ps1"
Write-Host ""
Write-Host "Local dev without Docker (requires PostgreSQL on localhost:5432):" -ForegroundColor Yellow
Write-Host "  .\scripts\run-local.ps1"
Write-Host ""
exit 1
