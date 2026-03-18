param(
  [Parameter(Mandatory = $true)]
  [string]$SourcePath,
  [Parameter(Mandatory = $true)]
  [string]$OutputPath,
  [string]$ReportPath = "",
  [int]$CanvasSize = 128,
  [int]$WorkSize = 48
)

$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.Drawing

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

function Get-Luma {
  param([System.Drawing.Color]$Color)
  return (0.299 * $Color.R) + (0.587 * $Color.G) + (0.114 * $Color.B)
}

function Get-ColorDistance {
  param(
    [System.Drawing.Color]$Left,
    [System.Drawing.Color]$Right
  )
  $dr = [double]$Left.R - [double]$Right.R
  $dg = [double]$Left.G - [double]$Right.G
  $db = [double]$Left.B - [double]$Right.B
  return [Math]::Sqrt(($dr * $dr) + ($dg * $dg) + ($db * $db))
}

function Get-BorderColor {
  param([System.Drawing.Bitmap]$Bitmap)

  $points = @(
    @(0, 0),
    @([Math]::Max(0, $Bitmap.Width - 1), 0),
    @(0, [Math]::Max(0, $Bitmap.Height - 1)),
    @([Math]::Max(0, $Bitmap.Width - 1), [Math]::Max(0, $Bitmap.Height - 1))
  )

  $samples = @()
  foreach ($point in $points) {
    $samples += $Bitmap.GetPixel($point[0], $point[1])
  }

  $avgR = [int](($samples | Measure-Object -Property R -Average).Average)
  $avgG = [int](($samples | Measure-Object -Property G -Average).Average)
  $avgB = [int](($samples | Measure-Object -Property B -Average).Average)
  return [System.Drawing.Color]::FromArgb(255, $avgR, $avgG, $avgB)
}

function Convert-ToPaletteColor {
  param(
    [System.Drawing.Color]$Color,
    [System.Drawing.Color[]]$Palette
  )

  $luma = Get-Luma $Color
  $best = $Palette[0]
  $bestDistance = [double]::PositiveInfinity
  foreach ($paletteColor in $Palette) {
    $distance = [Math]::Abs((Get-Luma $paletteColor) - $luma)
    if ($distance -lt $bestDistance) {
      $bestDistance = $distance
      $best = $paletteColor
    }
  }
  return $best
}

function Write-Report {
  param(
    [hashtable]$Report,
    [string]$Path
  )

  if (-not $Path) {
    $Report | ConvertTo-Json -Depth 4
    return
  }

  $dir = Split-Path -Parent $Path
  if ($dir -and -not (Test-Path $dir)) {
    New-Item -ItemType Directory -Path $dir | Out-Null
  }

  ($Report | ConvertTo-Json -Depth 4) | Set-Content -Encoding UTF8 -Path $Path
}

$palette = @(
  (New-HexColor "#0F380F"),
  (New-HexColor "#306230"),
  (New-HexColor "#8BAC0F"),
  (New-HexColor "#9BBC0F")
)

if (-not (Test-Path $SourcePath)) {
  throw "Source image not found: $SourcePath"
}

$outputDir = Split-Path -Parent $OutputPath
if ($outputDir -and -not (Test-Path $outputDir)) {
  New-Item -ItemType Directory -Path $outputDir | Out-Null
}

$sourceImage = [System.Drawing.Image]::FromFile($SourcePath)
$sourceBitmap = [System.Drawing.Bitmap]::new($sourceImage)
$sourceImage.Dispose()

$borderColor = Get-BorderColor $sourceBitmap

$workBitmap = [System.Drawing.Bitmap]::new($WorkSize, $WorkSize, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$workGraphics = [System.Drawing.Graphics]::FromImage($workBitmap)
$workGraphics.Clear([System.Drawing.Color]::Transparent)
$workGraphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
$workGraphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
$workGraphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$workGraphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality

$innerBox = [Math]::Max(10, [int]([Math]::Floor($WorkSize * 0.88)))
$scale = [Math]::Min($innerBox / [double]$sourceBitmap.Width, $innerBox / [double]$sourceBitmap.Height)
$destWidth = [Math]::Max(1, [int]([Math]::Round($sourceBitmap.Width * $scale)))
$destHeight = [Math]::Max(1, [int]([Math]::Round($sourceBitmap.Height * $scale)))
$destX = [int]([Math]::Floor(($WorkSize - $destWidth) / 2))
$destY = [int]([Math]::Floor(($WorkSize - $destHeight) / 2))

$workGraphics.DrawImage($sourceBitmap, $destX, $destY, $destWidth, $destHeight)
$workGraphics.Dispose()

$minX = $WorkSize
$minY = $WorkSize
$maxX = -1
$maxY = -1
$opaquePixels = 0
$usedPalette = New-Object 'System.Collections.Generic.HashSet[string]'

for ($y = 0; $y -lt $WorkSize; $y++) {
  for ($x = 0; $x -lt $WorkSize; $x++) {
    $pixel = $workBitmap.GetPixel($x, $y)
    if ($pixel.A -lt 24) {
      $workBitmap.SetPixel($x, $y, [System.Drawing.Color]::Transparent)
      continue
    }

    $brightness = Get-Luma $pixel
    $distance = Get-ColorDistance $pixel $borderColor

    if (($distance -lt 44 -and $brightness -gt 176) -or $brightness -gt 250) {
      $workBitmap.SetPixel($x, $y, [System.Drawing.Color]::Transparent)
      continue
    }

    $mapped = Convert-ToPaletteColor -Color $pixel -Palette $palette
    $workBitmap.SetPixel($x, $y, $mapped)
    $usedPalette.Add(("#{0:X2}{1:X2}{2:X2}" -f $mapped.R, $mapped.G, $mapped.B)) | Out-Null
    $opaquePixels++

    if ($x -lt $minX) { $minX = $x }
    if ($y -lt $minY) { $minY = $y }
    if ($x -gt $maxX) { $maxX = $x }
    if ($y -gt $maxY) { $maxY = $y }
  }
}

$normalizedBitmap = [System.Drawing.Bitmap]::new($WorkSize, $WorkSize, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$normalizedGraphics = [System.Drawing.Graphics]::FromImage($normalizedBitmap)
$normalizedGraphics.Clear([System.Drawing.Color]::Transparent)
$normalizedGraphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::NearestNeighbor
$normalizedGraphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::Half

if ($maxX -ge $minX -and $maxY -ge $minY) {
  $cropWidth = $maxX - $minX + 1
  $cropHeight = $maxY - $minY + 1
  $normInner = [Math]::Max(10, [int]([Math]::Floor($WorkSize * 0.92)))
  $normScale = [Math]::Min($normInner / [double]$cropWidth, $normInner / [double]$cropHeight)
  $normWidth = [Math]::Max(1, [int]([Math]::Round($cropWidth * $normScale)))
  $normHeight = [Math]::Max(1, [int]([Math]::Round($cropHeight * $normScale)))
  $normX = [int]([Math]::Floor(($WorkSize - $normWidth) / 2))
  $normY = [int]([Math]::Floor(($WorkSize - $normHeight) / 2))
  $srcRect = New-Object System.Drawing.Rectangle $minX, $minY, $cropWidth, $cropHeight
  $destRect = New-Object System.Drawing.Rectangle $normX, $normY, $normWidth, $normHeight
  $normalizedGraphics.DrawImage($workBitmap, $destRect, $srcRect, [System.Drawing.GraphicsUnit]::Pixel)
} else {
  $normalizedGraphics.DrawImage($workBitmap, 0, 0, $WorkSize, $WorkSize)
}
$normalizedGraphics.Dispose()

$finalBitmap = [System.Drawing.Bitmap]::new($CanvasSize, $CanvasSize, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$finalGraphics = [System.Drawing.Graphics]::FromImage($finalBitmap)
$finalGraphics.Clear([System.Drawing.Color]::Transparent)
$finalGraphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::NearestNeighbor
$finalGraphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::Half
$finalGraphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::None
$finalGraphics.DrawImage($normalizedBitmap, 0, 0, $CanvasSize, $CanvasSize)
$finalGraphics.Dispose()

$finalBitmap.Save($OutputPath, [System.Drawing.Imaging.ImageFormat]::Png)

$report = @{
  source = $SourcePath
  output = $OutputPath
  canvas_size = $CanvasSize
  work_size = $WorkSize
  opaque_ratio = [Math]::Round($opaquePixels / [double]($WorkSize * $WorkSize), 4)
  bbox = if ($maxX -ge $minX -and $maxY -ge $minY) {
    @{
      x = $minX
      y = $minY
      width = $maxX - $minX + 1
      height = $maxY - $minY + 1
    }
  } else {
    $null
  }
  colors_used = @($usedPalette)
}

Write-Report -Report $report -Path $ReportPath

$sourceBitmap.Dispose()
$workBitmap.Dispose()
$normalizedBitmap.Dispose()
$finalBitmap.Dispose()
