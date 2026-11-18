$ErrorActionPreference = "Stop"

Set-Location $PSScriptRoot

Write-Host "Stopping NEXUS Cloud..."

docker compose --env-file .env.docker down

if ($LASTEXITCODE -ne 0) {
    throw "Unable to stop infrastructure."
}

Write-Host ""
Write-Host "Infrastructure stopped."
Write-Host "Persistent data has been preserved."