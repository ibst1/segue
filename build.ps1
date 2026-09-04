# Packs the extension for the Edge Add-ons store: dist\segue-<version>.zip
# with the extension files only - manifest, scripts, pages, icons. Docs,
# tools, the store folder, git files and this script stay out; the store
# rejects nothing for extra files, but the package is what gets reviewed and
# should be exactly what runs.
#
#   .\build.ps1            -> dist\segue-1.2.0.zip
#   .\build.ps1 -Open      -> ... and open the dist folder

param([switch]$Open)

$ErrorActionPreference = "Stop"
$root = $PSScriptRoot
$manifest = Get-Content (Join-Path $root "manifest.json") -Raw -Encoding UTF8 | ConvertFrom-Json
$version = $manifest.version
$dist = Join-Path $root "dist"
$zip = Join-Path $dist "segue-$version.zip"
$stage = Join-Path $env:TEMP "segue-build-$version"

# the files the manifest refers to, plus the manifest itself
$include = @("manifest.json", "background.js", "content.js",
             "popup.html", "popup.js", "options.html", "options.js",
             "icons")

if (Test-Path $stage) { Remove-Item $stage -Recurse -Force }
$null = New-Item -ItemType Directory -Force $stage
foreach ($f in $include) {
    $src = Join-Path $root $f
    if (-not (Test-Path $src)) { throw "missing: $f" }
    Copy-Item $src (Join-Path $stage $f) -Recurse
}

$null = New-Item -ItemType Directory -Force $dist
if (Test-Path $zip) { Remove-Item $zip -Force }
# Written entry by entry with forward slashes: Compress-Archive (and .NET
# Framework's ZipFile) name entries with backslashes on Windows, and the
# store's unpacker treats "icons\segue-16.png" as a file name, not a path -
# the manifest's icons are then missing.
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem
$archive = [System.IO.Compression.ZipFile]::Open($zip, [System.IO.Compression.ZipArchiveMode]::Create)
try {
    Get-ChildItem $stage -Recurse -File | Sort-Object FullName | ForEach-Object {
        $rel = $_.FullName.Substring($stage.Length + 1).Replace("\", "/")
        $null = [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($archive, $_.FullName, $rel,
            [System.IO.Compression.CompressionLevel]::Optimal)
    }
} finally { $archive.Dispose() }
Remove-Item $stage -Recurse -Force

$size = [Math]::Round((Get-Item $zip).Length / 1KB)
Write-Host "wrote $zip ($size KB)"
[System.IO.Compression.ZipFile]::OpenRead($zip).Entries | ForEach-Object { Write-Host "  $($_.FullName)" }
if ($Open) { Start-Process $dist }
