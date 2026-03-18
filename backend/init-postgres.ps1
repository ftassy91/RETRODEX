param(
  [string]$DatabaseName = $(if ($env:PGDATABASE) { $env:PGDATABASE } else { "retrodex" }),
  [string]$SchemaName = $(if ($env:PGSCHEMA) { $env:PGSCHEMA } else { "retrodex" }),
  [string]$FallbackDatabase = $(if ($env:PGFALLBACKDATABASE) { $env:PGFALLBACKDATABASE } else { "" }),
  [string]$DbHost = $(if ($env:PGHOST) { $env:PGHOST } else { "localhost" }),
  [int]$DbPort = $(if ($env:PGPORT) { [int]$env:PGPORT } else { 5432 }),
  [string]$DbUser = $(if ($env:PGUSER) { $env:PGUSER } else { "postgres" }),
  [string]$Password = $env:PGPASSWORD
)

$ErrorActionPreference = "Stop"

function Resolve-PgTool {
  param([string]$ToolName)

  $command = Get-Command $ToolName -ErrorAction SilentlyContinue
  if ($command) {
    return $command.Source
  }

  $default = Join-Path "C:\Program Files\PostgreSQL\16\bin" "$ToolName.exe"
  if (Test-Path $default) {
    return $default
  }

  throw "Impossible de trouver $ToolName. Verifie l'installation PostgreSQL locale."
}

function Escape-SqlLiteral {
  param([string]$Value)
  return $Value.Replace("'", "''")
}

function Escape-Identifier {
  param([string]$Value)
  return $Value.Replace('"', '""')
}

function Invoke-PsqlScalar {
  param(
    [string]$Database,
    [string]$Sql
  )

  $args = @(
    "--host", $DbHost,
    "--port", "$DbPort",
    "--username", $DbUser,
    "--dbname", $Database,
    "--tuples-only",
    "--no-align",
    "--command", $Sql
  )

  $result = & $script:psqlPath @args 2>$null
  if ($LASTEXITCODE -ne 0) {
    return $null
  }

  return ($result | Out-String).Trim()
}

function Invoke-PsqlCommand {
  param(
    [string]$Database,
    [string]$Sql
  )

  $args = @(
    "--host", $DbHost,
    "--port", "$DbPort",
    "--username", $DbUser,
    "--dbname", $Database,
    "--command", $Sql
  )

  & $script:psqlPath @args
  if ($LASTEXITCODE -ne 0) {
    throw "Commande SQL impossible dans la base $Database."
  }
}

function Test-DatabaseAccessible {
  param([string]$Database)
  return [bool](Invoke-PsqlScalar -Database $Database -Sql "SELECT 1;")
}

function Find-AccessibleDatabase {
  param([string[]]$Candidates)

  foreach ($candidate in $Candidates | Select-Object -Unique) {
    if ([string]::IsNullOrWhiteSpace($candidate)) {
      continue
    }

    if (Test-DatabaseAccessible -Database $candidate) {
      return $candidate
    }
  }

  return $null
}

function Ensure-Schema {
  param(
    [string]$Database,
    [string]$Name
  )

  if ([string]::IsNullOrWhiteSpace($Name)) {
    return
  }

  $escaped = Escape-Identifier -Value $Name
  Invoke-PsqlCommand -Database $Database -Sql "CREATE SCHEMA IF NOT EXISTS ""$escaped"";"
}

$script:psqlPath = Resolve-PgTool -ToolName "psql"
$script:createdbPath = Resolve-PgTool -ToolName "createdb"

if ($Password) {
  $env:PGPASSWORD = $Password
}

$adminCandidates = @(
  $FallbackDatabase,
  "retrodex_mvp",
  "postgres",
  "template1"
)

$adminDatabase = Find-AccessibleDatabase -Candidates $adminCandidates

if (-not $adminDatabase) {
  throw "Connexion PostgreSQL impossible. Verifie PGHOST/PGPORT/PGUSER/PGPASSWORD, ou passe une base existante via -FallbackDatabase."
}

Write-Host "RetroDex PostgreSQL init" -ForegroundColor Green
Write-Host "Host              : $DbHost"
Write-Host "Port              : $DbPort"
Write-Host "User              : $DbUser"
Write-Host "Target database   : $DatabaseName"
Write-Host "Target schema     : $SchemaName"
Write-Host "Admin database    : $adminDatabase"

$escapedDatabaseName = Escape-SqlLiteral -Value $DatabaseName
$existing = Invoke-PsqlScalar -Database $adminDatabase -Sql "SELECT 1 FROM pg_database WHERE datname = '$escapedDatabaseName';"

if ($existing -eq "1") {
  if (-not (Test-DatabaseAccessible -Database $DatabaseName)) {
    throw "La base $DatabaseName existe mais n'est pas accessible avec le role courant."
  }

  Ensure-Schema -Database $DatabaseName -Name $SchemaName
  Write-Host "Base accessible et schema pret dans $DatabaseName." -ForegroundColor Green
  return
}

$canCreateDb = Invoke-PsqlScalar -Database $adminDatabase -Sql "SELECT rolcreatedb FROM pg_roles WHERE rolname = current_user;"

if ($canCreateDb -eq "t") {
  $createArgs = @(
    "--host", $DbHost,
    "--port", "$DbPort",
    "--username", $DbUser,
    $DatabaseName
  )

  & $script:createdbPath @createArgs
  if ($LASTEXITCODE -ne 0) {
    throw "La creation de la base $DatabaseName a echoue."
  }

  Ensure-Schema -Database $DatabaseName -Name $SchemaName
  Write-Host "Base $DatabaseName creee avec succes." -ForegroundColor Green
  return
}

$schemaHostCandidates = @(
  $FallbackDatabase,
  "retrodex_mvp",
  $adminDatabase
)

$schemaHostDatabase = Find-AccessibleDatabase -Candidates $schemaHostCandidates

if (-not $schemaHostDatabase) {
  throw "Le role courant n'a pas CREATEDB et aucune base existante accessible n'a ete trouvee pour heberger le schema $SchemaName."
}

Ensure-Schema -Database $schemaHostDatabase -Name $SchemaName

Write-Host "Le role courant n'a pas CREATEDB. Fallback sur un schema dedie." -ForegroundColor Yellow
Write-Host "Base a utiliser   : $schemaHostDatabase"
Write-Host "Schema a utiliser : $SchemaName"
Write-Host ""
Write-Host "Configure ensuite :" -ForegroundColor Cyan
Write-Host "  PGDATABASE=$schemaHostDatabase"
Write-Host "  PGSCHEMA=$SchemaName"
