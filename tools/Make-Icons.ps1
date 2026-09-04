# Generates the extension icons (icons\segue-16/32/48/128.png) and the store
# logo (store\logo-300.png) with System.Drawing - no design tool needed.
#
# The picture: two browser windows, the front one offset to the lower right,
# and an arrow carrying something from the back one to the front one - a link
# sent to another window. Blue ground, white shapes; readable at 16 px because
# the shapes are few and thick.

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing
$root = Split-Path $PSScriptRoot -Parent
$null = New-Item -ItemType Directory -Force (Join-Path $root "icons")
$null = New-Item -ItemType Directory -Force (Join-Path $root "store")

function RoundedRect([float]$x, [float]$y, [float]$w, [float]$h, [float]$r) {
    $p = New-Object System.Drawing.Drawing2D.GraphicsPath
    $d = $r * 2
    $p.AddArc($x, $y, $d, $d, 180, 90)
    $p.AddArc($x + $w - $d, $y, $d, $d, 270, 90)
    $p.AddArc($x + $w - $d, $y + $h - $d, $d, $d, 0, 90)
    $p.AddArc($x, $y + $h - $d, $d, $d, 90, 90)
    $p.CloseFigure()
    $p
}

function Draw-Icon([int]$size, [string]$path) {
    $bmp = New-Object System.Drawing.Bitmap $size, $size
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = "AntiAlias"
    $g.Clear([System.Drawing.Color]::Transparent)
    $s = $size / 128.0                       # everything is drawn on a 128 grid

    # ground: rounded square, blue
    $ground = RoundedRect (2 * $s) (2 * $s) (124 * $s) (124 * $s) (26 * $s)
    $brush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
        (New-Object System.Drawing.Point 0, 0), (New-Object System.Drawing.Point $size, $size),
        [System.Drawing.Color]::FromArgb(255, 37, 99, 235), [System.Drawing.Color]::FromArgb(255, 29, 78, 216))
    $g.FillPath($brush, $ground)

    $white = [System.Drawing.Color]::White
    $dim = [System.Drawing.Color]::FromArgb(150, 255, 255, 255)
    $lineW = [Math]::Max(1.5, 7 * $s)

    # back window (upper left), lighter: outline + title bar
    $pen = New-Object System.Drawing.Pen $dim, $lineW
    $g.DrawPath($pen, (RoundedRect (22 * $s) (26 * $s) (52 * $s) (42 * $s) (6 * $s)))
    $g.FillRectangle((New-Object System.Drawing.SolidBrush $dim), (22 * $s), (26 * $s), (52 * $s), (11 * $s))

    # front window (lower right), full white: outline + title bar
    $pen2 = New-Object System.Drawing.Pen $white, $lineW
    $g.DrawPath($pen2, (RoundedRect (54 * $s) (58 * $s) (52 * $s) (42 * $s) (6 * $s)))
    $g.FillRectangle((New-Object System.Drawing.SolidBrush $white), (54 * $s), (58 * $s), (52 * $s), (11 * $s))

    # the arrow: from the back window's body into the front window
    $pen3 = New-Object System.Drawing.Pen $white, $lineW
    $pen3.StartCap = "Round"
    $pen3.EndCap = "ArrowAnchor"
    $pen3.LineJoin = "Round"
    if ($size -ge 32) {
        $g.DrawLine($pen3, (36 * $s), (52 * $s), (66 * $s), (82 * $s))
    } else {
        # at 16 px an arrow head is mud - a plain thick diagonal reads better
        $pen3.EndCap = "Round"
        $g.DrawLine($pen3, (36 * $s), (52 * $s), (68 * $s), (84 * $s))
    }

    $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
    $g.Dispose(); $bmp.Dispose()
    Write-Host "wrote $path"
}

foreach ($n in 16, 32, 48, 128) { Draw-Icon $n (Join-Path $root "icons\segue-$n.png") }
Draw-Icon 300 (Join-Path $root "store\logo-300.png")
