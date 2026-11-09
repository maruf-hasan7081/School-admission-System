function Test-PortInUse {
    param([int]$Port)
    $listening = netstat -ano | Select-String 'LISTENING' | Select-String ":$Port\s"
    return $null -ne $listening
}

function Get-PortOwnerName {
    param([int]$Port)
    $line = netstat -ano | Select-String 'LISTENING' | Select-String ":$Port\s" | Select-Object -First 1
    if (-not $line) { return $null }
    if ($line -notmatch '\s+(\d+)\s*$') { return $null }
    $procId = [int]$Matches[1]
    $proc = Get-Process -Id $procId -ErrorAction SilentlyContinue
    if ($proc) { return "$($proc.ProcessName) (PID $procId)" }
    return "PID $procId"
}

function Resolve-ApiPort {
    param([int[]]$Candidates = @(8080, 5080, 8088, 18080))

    foreach ($p in $Candidates) {
        if (-not (Test-PortInUse -Port $p)) {
            return $p
        }
    }

    throw "No free API port in: $($Candidates -join ', ')"
}

function Set-ApiPortEnvironment {
    param([int]$Port)
    $env:ASPNETCORE_URLS = "http://127.0.0.1:$Port"
    $env:API_HTTP_PORT = "$Port"
    $env:VITE_API_URL = "http://localhost:$Port"
}

function Import-LocalEnvironment {
    param([string]$Root)
    $envFile = Join-Path $Root ".env.local"
    if (Test-Path $envFile) {
        foreach ($line in Get-Content $envFile) {
            if ($line -match "^\s*#" -or $line -match "^\s*$") { continue }
            $pair = $line -split "=", 2
            if ($pair.Length -eq 2) {
                Set-Item -Path "env:$($pair[0].Trim())" -Value $pair[1].Trim()
            }
        }
    }
}

function Get-LocalProjectProcesses {
    param([string]$Root)
    $rootPath = [System.IO.Path]::GetFullPath($Root).TrimEnd('\')
    $backendDll = Join-Path $rootPath "backend\bin\Debug\net8.0\SchoolAdmission.Api.dll"
    $backendExe = Join-Path $rootPath "backend\bin\Debug\net8.0\SchoolAdmission.Api.exe"
    $viteDirectory = Join-Path $rootPath "frontend\node_modules\"
    Get-CimInstance Win32_Process | Where-Object {
        $commandLine = ([string]$_.CommandLine).Replace('/', '\')
        (($_.Name -eq "dotnet.exe" -and $commandLine.IndexOf($backendDll, [StringComparison]::OrdinalIgnoreCase) -ge 0) -or
         ($_.Name -eq "SchoolAdmission.Api.exe" -and $commandLine.IndexOf($backendExe, [StringComparison]::OrdinalIgnoreCase) -ge 0) -or
         ($_.Name -eq "node.exe" -and $commandLine.IndexOf($viteDirectory, [StringComparison]::OrdinalIgnoreCase) -ge 0 -and $commandLine -match '\\vite\\bin\\vite\.js'))
    }
}

function Stop-LocalProjectProcesses {
    param([string]$Root)
    $projectProcesses = @(Get-LocalProjectProcesses -Root $Root)
    foreach ($projectProcess in $projectProcesses) {
        Write-Host "Stopping previous project server: $($projectProcess.Name) (PID $($projectProcess.ProcessId))"
        Stop-Process -Id $projectProcess.ProcessId -Force -ErrorAction SilentlyContinue
    }
    foreach ($projectProcess in $projectProcesses) {
        Wait-Process -Id $projectProcess.ProcessId -Timeout 5 -ErrorAction SilentlyContinue
    }
}

function Resolve-FrontendPort {
    foreach ($candidate in 5173..5193) {
        if (-not (Test-PortInUse -Port $candidate)) { return $candidate }
    }
    throw "No free frontend port between 5173 and 5193."
}
