# stop-batch.ps1 — Request graceful stop of the running batch

$StopFile = Join-Path (Split-Path -Parent $MyInvocation.MyCommand.Path) ".stop-batch"

New-Item -Path $StopFile -ItemType File -Force | Out-Null
Write-Host "Arret demande. Le batch en cours se terminera proprement."
Write-Host "Fichier cree: $StopFile"
