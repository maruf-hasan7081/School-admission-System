# Starts the API on the first free port (8080 for assignment, else 5080 if Oracle etc. blocks 8080).
# Usage: .\scripts\dotnet-run.ps1

$ErrorActionPreference = "Stop"
$Root = Split-Path $PSScriptRoot -Parent
. (Join-Path $PSScriptRoot "PortUtils.ps1")

Import-LocalEnvironment -Root $Root
$port = Resolve-ApiPort
if ($port -ne 8080) {
    $owner = Get-PortOwnerName -Port 8080
    Write-Host "Port 8080 is used by $owner" -ForegroundColor Yellow
    Write-Host "Local dev will use port $port (Docker / submit still use 8080)." -ForegroundColor Yellow
}

Set-ApiPortEnvironment -Port $port
Write-Host "Starting API at http://localhost:$port" -ForegroundColor Green

Set-Location (Join-Path $Root "backend")
dotnet run --no-launch-profile
exit $LASTEXITCODE
