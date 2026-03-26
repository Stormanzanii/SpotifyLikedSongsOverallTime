param(
    [string]$SpicetifyPath = "$env:APPDATA\\spicetify"
)

$ErrorActionPreference = "Stop"

$extensionName = "SpotifyLikedSongsOverallTime.js"
$extensionsDir = Join-Path $SpicetifyPath "Extensions"
$targetFile = Join-Path $extensionsDir $extensionName

if (-not (Get-Command spicetify -ErrorAction SilentlyContinue)) {
    throw "Spicetify CLI was not found in PATH."
}

if (Test-Path $targetFile) {
    Remove-Item -Force $targetFile
}

$configOutput = spicetify config extensions

if ($LASTEXITCODE -eq 0 -and $configOutput) {
    $joinedOutput = ($configOutput | Out-String).Trim()
    if ($joinedOutput) {
        $extensions = $joinedOutput -split "\s+" | Where-Object { $_ -and $_ -ne $extensionName }
        spicetify config extensions $extensions
    } else {
        spicetify config extensions
    }
}

spicetify apply

Write-Host "Uninstalled $extensionName"
