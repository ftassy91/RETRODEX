param(
  [int]$Port = 3000,
  [switch]$Force
)

$ErrorActionPreference = "Stop"

Write-Host "RetroDex backend stopper" -ForegroundColor Yellow
Write-Host "Port cible : $Port"

$connections = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue

if (-not $connections) {
  Write-Host "Aucun service en ecoute sur le port $Port." -ForegroundColor Green
  return
}

$stopped = $false

foreach ($connection in $connections) {
  $processId = $connection.OwningProcess
  $process = Get-Process -Id $processId -ErrorAction SilentlyContinue

  if (-not $process) {
    continue
  }

  $commandLine = ""
  try {
    $commandLine = (Get-CimInstance Win32_Process -Filter "ProcessId = $processId").CommandLine
  } catch {
    $commandLine = ""
  }

  $isNodeProcess = $process.ProcessName -eq "node"
  $looksLikeBackend = $isNodeProcess

  if (-not $looksLikeBackend -and -not $Force) {
    Write-Warning "Le process $processId ($($process.ProcessName)) ecoute sur $Port, mais il ne ressemble pas a un backend RetroDex Node. Relance avec -Force si tu veux le stopper."
    continue
  }

  Stop-Process -Id $processId -Force
  Write-Host "Backend stoppe : PID $processId" -ForegroundColor Green
  $stopped = $true
}

if (-not $stopped) {
  Write-Warning "Aucun process backend RetroDex n'a ete stoppe."
}
