param(
    [switch]$SkipIntegration
)

$ErrorActionPreference = "Stop"

Set-Location (Join-Path $PSScriptRoot "..")

function Run-Step {

    param(
        [string]$Title,
        [scriptblock]$Command
    )

    Write-Host ""
    Write-Host "========================================"
    Write-Host $Title -ForegroundColor Cyan
    Write-Host "========================================"

    $global:LASTEXITCODE = 0

    & $Command

    if ($LASTEXITCODE -ne 0) {

        throw "FAILED: $Title"
    }

    Write-Host "PASS: $Title" -ForegroundColor Green
}

$started = Get-Date

Write-Host ""
Write-Host "NEXUS QUALITY ENGINEERING"
Write-Host "Automated validation suite"

Run-Step "01 - Backend Maven tests" {

    mvn -B -f backend/pom.xml clean install
}

Run-Step "02 - API Gateway tests" {

    mvn -B -f api-gateway/pom.xml clean verify
}

Run-Step "03 - Frontend TypeScript" {

    Push-Location frontend

    try {

        npx --no-install tsc --noEmit

    } finally {

        Pop-Location
    }
}

Run-Step "04 - Frontend production build" {

    npm --prefix frontend run build
}

Run-Step "05 - Chaos controller syntax" {

    node --check tools/chaos-controller.cjs
}

Run-Step "06 - Integration test syntax" {

    node --check tests/integration/smoke-test.mjs
}

if (!$SkipIntegration) {

    Run-Step "07 - Docker engine availability" {

        docker info --format "{{.ServerVersion}}"
    }

    Run-Step "08 - Distributed integration tests" {

        node tests/integration/smoke-test.mjs
    }

} else {

    Write-Host ""
    Write-Host "Docker integration tests skipped." `
        -ForegroundColor Yellow
}

$duration = (Get-Date) - $started

Write-Host ""
Write-Host "========================================"

if ($SkipIntegration) {

    Write-Host "BUILD CHECKS PASSED" `
        -ForegroundColor Green

    Write-Host "Integration tests were not executed."

} else {

    Write-Host "ALL CONFIGURED CHECKS PASSED" `
        -ForegroundColor Green
}

Write-Host "Duration: $duration"

Write-Host "========================================"