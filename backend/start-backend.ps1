param(
  [switch]$NoBrowser
)

$ErrorActionPreference = "Stop"

$backendDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$healthUrl = "http://127.0.0.1:3000/api/health"
$homeUrl = "http://127.0.0.1:3000/home.html"
$debugUrl = "http://127.0.0.1:3000/debug.html"

function Test-BackendHealth {
  try {
    $response = Invoke-WebRequest -UseBasicParsing $healthUrl -TimeoutSec 3
    return $response.StatusCode -eq 200
  } catch {
    return $false
  }
}

function Assert-NodeAvailable {
  $node = Get-Command node -ErrorAction SilentlyContinue
  $npm = Get-Command npm -ErrorAction SilentlyContinue

  if (-not $node -or -not $npm) {
    throw "Node.js / npm n'est pas disponible. Installe Node puis relance ce script."
  }
}

Write-Host "RetroDex backend launcher" -ForegroundColor Green
Write-Host "Dossier : $backendDir"

Assert-NodeAvailable

if (Test-BackendHealth) {
  Write-Host "Le backend tourne deja sur http://127.0.0.1:3000" -ForegroundColor Yellow
  if (-not $NoBrowser) {
    Start-Process $homeUrl
  }
  return
}

Write-Host "Demarrage du backend..." -ForegroundColor Cyan
Start-Process -FilePath "cmd.exe" -WorkingDirectory $backendDir -ArgumentList "/k", "cd /d `"$backendDir`" && npm start"

$ready = $false
for ($i = 0; $i -lt 20; $i++) {
  Start-Sleep -Seconds 1
  if (Test-BackendHealth) {
    $ready = $true
    break
  }
}

if (-not $ready) {
  throw "Le backend n'a pas repondu a temps sur $healthUrl"
}

Write-Host "Backend pret :" -ForegroundColor Green
Write-Host "  Health : $healthUrl"
Write-Host "  Home   : $homeUrl"
Write-Host "  Debug  : $debugUrl"

if (-not $NoBrowser) {
  Start-Process $homeUrl
}
