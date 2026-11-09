param([switch]$CreateOnly)
$ErrorActionPreference = "Stop"
$Root = Split-Path $PSScriptRoot -Parent
. (Join-Path $PSScriptRoot "PortUtils.ps1")
Import-LocalEnvironment -Root $Root
$connection = $env:TEST_CONNECTION
if (-not $connection) {
    $connection = $env:ConnectionStrings__Default
    if (-not $connection) { $connection = "Host=localhost;Port=5432;Database=school_admission;Username=postgres;Password=postgres" }
}
$testConfig = New-Object System.Data.Common.DbConnectionStringBuilder
$testConfig.set_ConnectionString($connection)
if (-not $env:TEST_CONNECTION) { $testConfig.set_Item("Database", "school_admission_test_codex") }
$testDatabase = [string]$testConfig["Database"]
if ($testDatabase -notmatch '^school_admission_test(?:_[A-Za-z0-9]+)*$') {
    throw "Refusing tests: TEST_CONNECTION must name school_admission_test or a database with that prefix."
}
$psqlCommand = Get-Command psql.exe -ErrorAction SilentlyContinue
$psql = if ($psqlCommand) { $psqlCommand.Source } else {
    @("$env:ProgramFiles\PostgreSQL\17\bin\psql.exe", "$env:ProgramFiles\PostgreSQL\18\bin\psql.exe") |
        Where-Object { Test-Path $_ } | Select-Object -First 1
}
if (-not $psql) { throw "psql.exe is required to create the isolated test database." }
$previousTestConnection = $env:TEST_CONNECTION
$previousPassword = $env:PGPASSWORD
$previousTimeout = $env:PGCONNECT_TIMEOUT
try {
    $env:PGPASSWORD = [string]$testConfig["Password"]
    $env:PGCONNECT_TIMEOUT = "5"
    $dbHost = if ($testConfig.ContainsKey("Host")) { [string]$testConfig["Host"] } else { "localhost" }
    $dbPort = if ($testConfig.ContainsKey("Port")) { [string]$testConfig["Port"] } else { "5432" }
    $dbUser = if ($testConfig.ContainsKey("Username")) { [string]$testConfig["Username"] } else { "postgres" }
    $exists = & $psql -X -w -h $dbHost -p $dbPort -U $dbUser -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname = '$testDatabase'"
    if ($LASTEXITCODE -ne 0) { throw "Could not connect to PostgreSQL to prepare the test database." }
    if (-not $exists) {
        & $psql -X -w -h $dbHost -p $dbPort -U $dbUser -d postgres -c "CREATE DATABASE `"$testDatabase`""
        if ($LASTEXITCODE -ne 0) { throw "Could not create the isolated test database." }
    }
    Write-Host "Isolated test database: $testDatabase" -ForegroundColor Green
    if (-not $CreateOnly) {
        $env:TEST_CONNECTION = $testConfig.get_ConnectionString()
        dotnet test (Join-Path $Root "backend\tests\SchoolAdmission.Api.Tests\SchoolAdmission.Api.Tests.csproj")
        if ($LASTEXITCODE -ne 0) { throw "Backend tests failed." }
    }
} finally {
    $env:TEST_CONNECTION = $previousTestConnection
    $env:PGPASSWORD = $previousPassword
    $env:PGCONNECT_TIMEOUT = $previousTimeout
}
