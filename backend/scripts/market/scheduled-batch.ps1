# scheduled-batch.ps1 — Automated eBay batch fetch with console rotation
# Called by Windows Task Scheduler every 2 days

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoRoot = Resolve-Path (Join-Path $ScriptDir "..\..\..") | Select-Object -ExpandProperty Path
$StateFile = Join-Path $ScriptDir ".batch-state"
$LogFile = Join-Path $ScriptDir "batch-log.txt"
$BatchScript = Join-Path $ScriptDir "batch-ebay-fetch.js"
$BackfillScript = Join-Path $ScriptDir "backfill-confidence-from-history.js"
$TimeoutMinutes = 30

# Console rotation
$Consoles = @(
    "Super Nintendo",
    "NES",
    "Game Boy",
    "Sega Genesis",
    "Nintendo 64"
)

# Read rotation index
$RotationIndex = 0
if (Test-Path $StateFile) {
    $RotationIndex = [int](Get-Content $StateFile -Raw).Trim()
}
$TargetConsole = $Consoles[$RotationIndex % $Consoles.Count]

# Next rotation
$NextIndex = ($RotationIndex + 1) % $Consoles.Count
Set-Content -Path $StateFile -Value $NextIndex

# Log helper
function Write-Log {
    param([string]$Message)
    $Timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $Line = "[$Timestamp] $Message"
    Write-Host $Line
    Add-Content -Path $LogFile -Value $Line
}

# Start
$StartTime = Get-Date
Write-Log "=== BATCH START ==="
Write-Log "Console: $TargetConsole (rotation index: $RotationIndex)"
Write-Log "Repo: $RepoRoot"

# Output file
$DateStamp = Get-Date -Format "yyyyMMdd-HHmmss"
$OutputFile = Join-Path $ScriptDir "ebay-$DateStamp.json"

try {
    # Phase 1: eBay fetch
    Write-Log "Phase 1: eBay fetch (limit=100, concurrency=5, records=5)"

    $FetchProcess = Start-Process -FilePath "node" `
        -ArgumentList "$BatchScript --console=`"$TargetConsole`" --limit=100 --records=5 --concurrency=5 --output=`"$OutputFile`"" `
        -WorkingDirectory $RepoRoot `
        -NoNewWindow -PassThru -Wait

    if ($FetchProcess.ExitCode -ne 0) {
        Write-Log "ERROR: batch-ebay-fetch exited with code $($FetchProcess.ExitCode)"
    } else {
        if (Test-Path $OutputFile) {
            $Records = (Get-Content $OutputFile -Raw | ConvertFrom-Json).Count
            Write-Log "Fetch complete: $Records records written to $(Split-Path $OutputFile -Leaf)"
        } else {
            Write-Log "Fetch complete: no output file generated"
        }
    }

    # Phase 2: Backfill confidence tiers
    Write-Log "Phase 2: Backfill confidence tiers (--apply)"

    $BackfillProcess = Start-Process -FilePath "node" `
        -ArgumentList "$BackfillScript --apply" `
        -WorkingDirectory $RepoRoot `
        -NoNewWindow -PassThru -Wait

    if ($BackfillProcess.ExitCode -ne 0) {
        Write-Log "ERROR: backfill exited with code $($BackfillProcess.ExitCode)"
    } else {
        Write-Log "Backfill complete"
    }
}
catch {
    Write-Log "EXCEPTION: $_"
}
finally {
    $Elapsed = ((Get-Date) - $StartTime).TotalMinutes
    Write-Log "Duration: $([math]::Round($Elapsed, 1)) minutes"
    Write-Log "Next console: $($Consoles[$NextIndex])"
    Write-Log "=== BATCH END ==="
    Write-Log ""
}
