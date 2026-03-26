param(
    [string]$SpicetifyPath = "$env:APPDATA\\spicetify"
)

$ErrorActionPreference = "Stop"

$extensionName = "liked-songs-overall-time.js"
$sourceFile = Join-Path $PSScriptRoot $extensionName
$extensionsDir = Join-Path $SpicetifyPath "Extensions"
$targetFile = Join-Path $extensionsDir $extensionName

if (-not (Test-Path $sourceFile)) {
    throw "Extension file not found: $sourceFile"
}

if (-not (Get-Command spicetify -ErrorAction SilentlyContinue)) {
    throw "Spicetify CLI was not found in PATH."
}

if (-not (Test-Path $extensionsDir)) {
    New-Item -ItemType Directory -Path $extensionsDir | Out-Null
}

Copy-Item -Path $sourceFile -Destination $targetFile -Force

$configOutput = spicetify config extensions
$hasExtension = $false

if ($LASTEXITCODE -eq 0 -and $configOutput) {
    $joinedOutput = ($configOutput | Out-String)
    $hasExtension = $joinedOutput -match [regex]::Escape($extensionName)
}

if (-not $hasExtension) {
    spicetify config extensions $extensionName
}

spicetify apply

Write-Host "Installed $extensionName to $extensionsDir"
Write-Host "Open Spotify and go to Liked Songs, then click 'Generate Playtime'."
