# School Admission - one command to run the app.
# Docker if available; otherwise PostgreSQL + dotnet + Vite (local dev).
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
    Write-Host "Docker found - starting docker compose up --build" -ForegroundColor Green
    docker compose up --build
    exit $LASTEXITCODE
}

Write-Host "Docker not installed - starting local dev (PostgreSQL + API + UI)..." -ForegroundColor Cyan
Write-Host "(Install Docker later for assignment submit: .\scripts\install-docker.ps1)" -ForegroundColor DarkGray
Write-Host ""

& (Join-Path $Root "scripts\run-local.ps1")
exit $LASTEXITCODE
