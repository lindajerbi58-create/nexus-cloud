$ErrorActionPreference = "Stop"

Set-Location $PSScriptRoot

Write-Host ""
Write-Host "========================================"
Write-Host "       NEXUS CLOUD - CONTROL CENTER"
Write-Host "========================================"
Write-Host ""

if (!(Test-Path ".env.docker")) {
    throw "Missing .env.docker configuration."
}

docker info --format "{{.ServerVersion}}"

if ($LASTEXITCODE -ne 0) {
    throw "Docker engine is unavailable."
}

Write-Host "Building Java infrastructure..."

docker compose --env-file .env.docker build master

if ($LASTEXITCODE -ne 0) {
    throw "Java image build failed."
}

Write-Host "Building frontend..."

docker compose --env-file .env.docker build frontend

if ($LASTEXITCODE -ne 0) {
    throw "Frontend image build failed."
}

Write-Host "Starting infrastructure..."

docker compose --env-file .env.docker up -d --no-build

if ($LASTEXITCODE -ne 0) {
    throw "Infrastructure startup failed."
}

docker compose --env-file .env.docker ps

Write-Host ""
Write-Host "Frontend: http://localhost:3100"
Write-Host "API:      http://localhost:8180"
Write-Host ""
Write-Host "Persistent storage: data-docker"
Write-Host "Check service status before signing in."
Write-Host "========================================"