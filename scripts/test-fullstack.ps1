# Runs real API/PostgreSQL + browser integration tests without touching development data.
$ErrorActionPreference = "Stop"
$Root = Split-Path $PSScriptRoot -Parent
. (Join-Path $PSScriptRoot "PortUtils.ps1")
Import-LocalEnvironment -Root $Root
if (-not $env:ConnectionStrings__Default) { throw "Set ConnectionStrings__Default in .env.local before running the real-data tests." }
foreach ($port in @(5099,5100,5181)) {
    if (Test-PortInUse -Port $port) { throw "Test port $port is busy. Stop its test server before rerunning." }
}
$testCfg = New-Object System.Data.Common.DbConnectionStringBuilder
$testCfg.set_ConnectionString($env:ConnectionStrings__Default)
$testDatabase = "school_admission_test_live_" + [guid]::NewGuid().ToString("N").Substring(0,8)
$testCfg.set_Item("Database", $testDatabase)
$previousTest = $env:TEST_CONNECTION
$previousApi = $env:LIVE_API_URL
$previousShort = $env:LIVE_SHORT_API_URL
$processes = @()
$logTasks = @()
try {
    $env:TEST_CONNECTION = $testCfg.get_ConnectionString()
    & (Join-Path $PSScriptRoot "test-backend.ps1") -CreateOnly
    $publish = Join-Path $Root "backend\bin\FullStackTest\publish"
    dotnet publish (Join-Path $Root "backend\SchoolAdmission.Api.csproj") -c Release -o $publish
    if ($LASTEXITCODE -ne 0) { throw "Test API publish failed." }
    foreach ($port in @(5099,5100)) {
        $info = New-Object System.Diagnostics.ProcessStartInfo
        $info.FileName = "dotnet"
        $info.Arguments = '"' + (Join-Path $publish "SchoolAdmission.Api.dll") + '"'
        $info.WorkingDirectory = Join-Path $Root "backend"
        $info.UseShellExecute = $false
        $info.CreateNoWindow = $true
        $info.RedirectStandardOutput = $true
        $info.RedirectStandardError = $true
        $info.EnvironmentVariables["ConnectionStrings__Default"] = $testCfg.get_ConnectionString()
        $info.EnvironmentVariables["ASPNETCORE_URLS"] = "http://127.0.0.1:$port"
        $info.EnvironmentVariables["ASPNETCORE_ENVIRONMENT"] = "Production"
        $info.EnvironmentVariables["HOLD_DURATION_SECONDS"] = if ($port -eq 5100) { "6" } else { "600" }
        $info.EnvironmentVariables["Logging__LogLevel__Default"] = "Warning"
        $process = [System.Diagnostics.Process]::Start($info)
        $processes += $process
        $logTasks += @{ Out = $process.StandardOutput.ReadToEndAsync(); Err = $process.StandardError.ReadToEndAsync(); Port = $port }
    }
    foreach ($port in @(5099,5100)) {
        $ready = $false
        for ($attempt=0; $attempt -lt 40; $attempt++) {
            try {
                $response = Invoke-WebRequest "http://127.0.0.1:$port/health" -UseBasicParsing -TimeoutSec 2
                if ($response.StatusCode -eq 200) { $ready = $true; break }
            } catch { }
            if (@($processes | Where-Object HasExited).Count -gt 0) { throw "A test API exited during startup." }
            Start-Sleep -Milliseconds 300
        }
        if (-not $ready) { throw "Test API $port did not become ready." }
    }
    $env:LIVE_API_URL = "http://127.0.0.1:5099"
    $env:LIVE_SHORT_API_URL = "http://127.0.0.1:5100"
    Write-Host "Real-data test database: $testDatabase" -ForegroundColor Green
    Push-Location (Join-Path $Root "frontend")
    try {
        npm.cmd run test:live
        if ($LASTEXITCODE -ne 0) { throw "Full-stack tests failed. See frontend/test-results-live and playwright-report-live." }
    } finally { Pop-Location }
} finally {
    foreach ($process in $processes) {
        if (-not $process.HasExited) { $process.Kill(); $process.WaitForExit(5000) | Out-Null }
        $process.Dispose()
    }
    $logDirectory = Join-Path $Root "frontend\test-results-live"
    New-Item -ItemType Directory -Path $logDirectory -Force | Out-Null
    foreach ($task in $logTasks) {
        if ($task.Out.IsCompleted) { [IO.File]::WriteAllText((Join-Path $logDirectory "api-$($task.Port).out.log"), $task.Out.Result) }
        if ($task.Err.IsCompleted) { [IO.File]::WriteAllText((Join-Path $logDirectory "api-$($task.Port).err.log"), $task.Err.Result) }
    }
    $env:TEST_CONNECTION = $previousTest
    $env:LIVE_API_URL = $previousApi
    $env:LIVE_SHORT_API_URL = $previousShort
}
