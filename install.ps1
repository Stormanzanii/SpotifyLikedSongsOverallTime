param(
    [string]$SpicetifyPath = "$env:APPDATA\\spicetify",
    [string]$RepoOwner = "Stormanzanii",
    [string]$RepoName = "LikedSongsOverallTime",
    [string]$Branch = "main"
)

$ErrorActionPreference = "Stop"

$extensionName = "SpotifyLikedSongsOverallTime.js"
$extensionsDir = Join-Path $SpicetifyPath "Extensions"
$targetFile = Join-Path $extensionsDir $extensionName
$rawBaseUrl = "https://raw.githubusercontent.com/$RepoOwner/$RepoName/$Branch"
$downloadUrl = "$rawBaseUrl/$extensionName"

if (-not (Get-Command spicetify -ErrorAction SilentlyContinue)) {
    throw "Spicetify CLI was not found in PATH."
}

if (-not (Test-Path $extensionsDir)) {
    New-Item -ItemType Directory -Path $extensionsDir | Out-Null
}

Invoke-WebRequest -UseBasicParsing -Uri $downloadUrl -OutFile $targetFile

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
