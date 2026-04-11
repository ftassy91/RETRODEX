# uninstall-scheduled-task.ps1 — Remove the RetroDex batch pricing scheduled task

$TaskName = "RetroDex-BatchPrix"

$Existing = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
if (-not $Existing) {
    Write-Host "Task '$TaskName' does not exist. Nothing to remove."
    exit 0
}

Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
Write-Host "Task '$TaskName' removed successfully."
