param(
  [string]$BatchPath = "data/demo_top_card_batch_001.json",
  [string]$CatalogPath = "data/catalog.json",
  [string]$OutputDir = "assets/generated_gb"
)

$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.Drawing

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$root = Split-Path -Parent $scriptDir

function Resolve-ProjectPath {
  param([string]$PathValue)
  if ([System.IO.Path]::IsPathRooted($PathValue)) {
    return $PathValue
  }
  return Join-Path $root $PathValue
}

function New-HexColor {
  param([string]$Hex)
  $clean = $Hex.TrimStart('#')
  return [System.Drawing.Color]::FromArgb(
    255,
    [Convert]::ToInt32($clean.Substring(0, 2), 16),
    [Convert]::ToInt32($clean.Substring(2, 2), 16),
    [Convert]::ToInt32($clean.Substring(4, 2), 16)
  )
}

function Slugify {
  param([string]$Value)
  $normalized = $Value.Normalize([Text.NormalizationForm]::FormKD)
  $builder = New-Object System.Text.StringBuilder
  foreach ($char in $normalized.ToCharArray()) {
    $category = [Globalization.CharUnicodeInfo]::GetUnicodeCategory($char)
    if ($category -ne [Globalization.UnicodeCategory]::NonSpacingMark) {
      [void]$builder.Append($char)
    }
  }
  $ascii = $builder.ToString().ToLowerInvariant()
  $ascii = [Regex]::Replace($ascii, "[^a-z0-9]+", "-")
  return $ascii.Trim('-')
}

function Get-ShortConsole {
  param([string]$Console)
  $map = @{
    "Nintendo Entertainment System" = "NES"
    "Super Nintendo" = "SNES"
    "PlayStation" = "PS1"
    "Game Boy" = "GB"
  }
  if ($map.ContainsKey($Console)) { return $map[$Console] }
  return $Console
}

function Get-TitleCardSlug {
  param(
    [pscustomobject]$Game
  )

  $overrides = @{
    "pokemon-gold-game-boy" = "pokemon-gold"
    "pokemon-silver-game-boy" = "pokemon-silver"
    "pokemon-red-game-boy" = "pokemon-red"
  }
  if ($overrides.ContainsKey($Game.id)) {
    return $overrides[$Game.id]
  }
  return Slugify $Game.title
}

function Get-WrapLines {
  param(
    [System.Drawing.Graphics]$Graphics,
    [string]$Text,
    [System.Drawing.Font]$Font,
    [int]$MaxWidth
  )

  $words = $Text -split '\s+'
  $lines = New-Object System.Collections.Generic.List[string]
  $current = ""

  foreach ($word in $words) {
    $test = if ([string]::IsNullOrWhiteSpace($current)) { $word } else { "$current $word" }
    $size = $Graphics.MeasureString($test, $Font)
    if ($size.Width -le $MaxWidth -or [string]::IsNullOrWhiteSpace($current)) {
      $current = $test
    } else {
      $lines.Add($current)
      $current = $word
    }
  }

  if (-not [string]::IsNullOrWhiteSpace($current)) {
    $lines.Add($current)
  }

  return $lines
}

function Get-HashBytes {
  param([string]$Value)
  $sha = [System.Security.Cryptography.SHA256]::Create()
  try {
    return $sha.ComputeHash([System.Text.Encoding]::UTF8.GetBytes($Value))
  } finally {
    $sha.Dispose()
  }
}

function Draw-Motif {
  param(
    [System.Drawing.Graphics]$Graphics,
    [System.Drawing.Rectangle]$Bounds,
    [byte[]]$Hash,
    [System.Drawing.Color[]]$Palette
  )

  $cell = 8
  $cols = [Math]::Floor($Bounds.Width / $cell)
  $rows = [Math]::Floor($Bounds.Height / $cell)
  $offsetX = $Bounds.X + [Math]::Floor(($Bounds.Width - ($cols * $cell)) / 2)
  $offsetY = $Bounds.Y + [Math]::Floor(($Bounds.Height - ($rows * $cell)) / 2)

  for ($row = 0; $row -lt $rows; $row++) {
    for ($col = 0; $col -lt $cols; $col++) {
      $byte = $Hash[($row * $cols + $col) % $Hash.Length]
      $paletteIndex = if (($byte % 5) -eq 0) { 0 } elseif (($byte % 3) -eq 0) { 1 } elseif (($byte % 2) -eq 0) { 2 } else { 3 }
      $brush = New-Object System.Drawing.SolidBrush($Palette[$paletteIndex])
      try {
        $Graphics.FillRectangle($brush, $offsetX + ($col * $cell), $offsetY + ($row * $cell), $cell - 1, $cell - 1)
      } finally {
        $brush.Dispose()
      }
    }
  }
}

$palette = @(
  (New-HexColor "#0F380F"),
  (New-HexColor "#306230"),
  (New-HexColor "#8BAC0F"),
  (New-HexColor "#9BBC0F")
)

$batchFile = Resolve-ProjectPath $BatchPath
$catalogFile = Resolve-ProjectPath $CatalogPath
$outputFolder = Resolve-ProjectPath $OutputDir

if (-not (Test-Path $outputFolder)) {
  New-Item -ItemType Directory -Path $outputFolder | Out-Null
}

$batch = Get-Content $batchFile -Raw | ConvertFrom-Json
$catalog = Get-Content $catalogFile -Raw | ConvertFrom-Json
$gamesById = @{}
foreach ($game in $catalog) {
  $gamesById[$game.id] = $game
}

$titleFont = New-Object System.Drawing.Font("Consolas", 18, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
$metaFont = New-Object System.Drawing.Font("Consolas", 11, [System.Drawing.FontStyle]::Regular, [System.Drawing.GraphicsUnit]::Pixel)
$badgeFont = New-Object System.Drawing.Font("Consolas", 10, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)

foreach ($gameId in $batch.ids) {
  if (-not $gamesById.ContainsKey($gameId)) {
    Write-Warning "Missing catalog game id: $gameId"
    continue
  }

  $game = $gamesById[$gameId]
  $slug = Get-TitleCardSlug $game
  $outputPath = Join-Path $outputFolder ($slug + ".png")

  $bitmap = New-Object System.Drawing.Bitmap 320, 180
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::None
  $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::NearestNeighbor
  $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::Half
  $graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::SingleBitPerPixelGridFit

  try {
    $bgBrush = New-Object System.Drawing.SolidBrush($palette[3])
    $midBrush = New-Object System.Drawing.SolidBrush($palette[2])
    $darkBrush = New-Object System.Drawing.SolidBrush($palette[1])
    $inkBrush = New-Object System.Drawing.SolidBrush($palette[0])
    $lightPen = New-Object System.Drawing.Pen($palette[2], 2)
    $darkPen = New-Object System.Drawing.Pen($palette[0], 3)
    $midPen = New-Object System.Drawing.Pen($palette[1], 1)

    $graphics.FillRectangle($bgBrush, 0, 0, 320, 180)
    $graphics.FillRectangle($midBrush, 8, 8, 304, 164)
    $graphics.DrawRectangle($darkPen, 8, 8, 304, 164)
    $graphics.DrawRectangle($midPen, 18, 18, 284, 144)

    for ($y = 10; $y -lt 172; $y += 3) {
      $graphics.DrawLine($midPen, 10, $y, 310, $y)
    }

    $motifBounds = New-Object System.Drawing.Rectangle 24, 34, 92, 92
    $graphics.FillRectangle($darkBrush, $motifBounds)
    $graphics.DrawRectangle($lightPen, $motifBounds)
    Draw-Motif -Graphics $graphics -Bounds $motifBounds -Hash (Get-HashBytes $game.id) -Palette $palette

    $badgeRect = New-Object System.Drawing.Rectangle 24, 134, 92, 18
    $graphics.FillRectangle($darkBrush, $badgeRect)
    $graphics.DrawRectangle($midPen, $badgeRect)
    $graphics.DrawString((Get-ShortConsole $game.console), $badgeFont, $midBrush, 30, 136)

    $titleAreaX = 132
    $titleLines = Get-WrapLines -Graphics $graphics -Text $game.title -Font $titleFont -MaxWidth 158
    $lineY = 34
    foreach ($line in $titleLines | Select-Object -First 4) {
      $graphics.DrawString($line, $titleFont, $inkBrush, $titleAreaX, $lineY)
      $lineY += 24
    }

    $rarity = if ($game.rarity) { [string]$game.rarity } else { "UNKNOWN" }
    $graphics.DrawString(("YEAR " + $game.year), $metaFont, $inkBrush, $titleAreaX, 128)
    $graphics.DrawString(("RARITY " + $rarity), $metaFont, $inkBrush, $titleAreaX, 142)
    $graphics.DrawString("RETRODEX DEMO CARD", $metaFont, $darkBrush, $titleAreaX, 156)

    $bitmap.Save($outputPath, [System.Drawing.Imaging.ImageFormat]::Png)
    Write-Output "built: $($slug).png"
  } finally {
    $graphics.Dispose()
    $bitmap.Dispose()
  }
}

$titleFont.Dispose()
$metaFont.Dispose()
$badgeFont.Dispose()
