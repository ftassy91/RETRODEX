# install-scheduled-task.ps1 — Create Windows scheduled task for RetroDex batch pricing
# Run as Administrator

$ErrorActionPreference = "Stop"
$TaskName = "RetroDex-BatchPrix"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ScriptPath = Join-Path $ScriptDir "scheduled-batch.ps1"

# Verify script exists
if (-not (Test-Path $ScriptPath)) {
    Write-Error "Script not found: $ScriptPath"
    exit 1
}

# Remove existing task if present
$Existing = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
if ($Existing) {
    Write-Host "Removing existing task '$TaskName'..."
    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
}

# Create trigger: every 2 days at 05:00
$Trigger = New-ScheduledTaskTrigger -Daily -DaysInterval 2 -At "05:00"

# Create action
$Action = New-ScheduledTaskAction `
    -Execute "powershell.exe" `
    -Argument "-ExecutionPolicy Bypass -NoProfile -File `"$ScriptPath`""

# Settings
$Settings = New-ScheduledTaskSettingsSet `
    -WakeToRun `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -ExecutionTimeLimit (New-TimeSpan -Minutes 45) `
    -StartWhenAvailable `
    -RestartCount 1 `
    -RestartInterval (New-TimeSpan -Minutes 10)

# Register
Register-ScheduledTask `
    -TaskName $TaskName `
    -Trigger $Trigger `
    -Action $Action `
    -Settings $Settings `
    -Description "RetroDex: eBay batch price fetch + confidence tier backfill (every 2 days, 5 consoles in rotation)" `
    -RunLevel Highest

# Confirm
$Task = Get-ScheduledTask -TaskName $TaskName
$NextRun = (Get-ScheduledTaskInfo -TaskName $TaskName).NextRunTime
Write-Host ""
Write-Host "Task '$TaskName' created successfully."
Write-Host "  Trigger:  Every 2 days at 05:00"
Write-Host "  Timeout:  45 minutes"
Write-Host "  Script:   $ScriptPath"
Write-Host "  Next run: $NextRun"
Write-Host ""
Write-Host "To test now:  Start-ScheduledTask -TaskName '$TaskName'"
Write-Host "To remove:    .\uninstall-scheduled-task.ps1"
