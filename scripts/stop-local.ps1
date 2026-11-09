# Stop only backend and Vite processes belonging to this project.
$ErrorActionPreference = "Stop"
$Root = Split-Path $PSScriptRoot -Parent
. (Join-Path $PSScriptRoot "PortUtils.ps1")
Stop-LocalProjectProcesses -Root $Root
Write-Host "Project servers stopped."
