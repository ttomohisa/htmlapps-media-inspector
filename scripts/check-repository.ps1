param([switch]$ForceDownload)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)

function Get-Sha256FileHex([string]$Path) {
  if (-not (Test-Path -LiteralPath $Path)) { throw "File not found for SHA-256: $Path" }
  $stream = [System.IO.File]::OpenRead($Path)
  $algorithm = [System.Security.Cryptography.SHA256]::Create()
  try {
    $hashBytes = $algorithm.ComputeHash($stream)
    return (($hashBytes | ForEach-Object { $_.ToString("x2") }) -join "")
  } finally {
    $algorithm.Dispose()
    $stream.Dispose()
  }
}

$required = @(
  "AGENTS.md", "APP_SPEC.md", "app.config.json", "dependencies.json",
  "components\confirm-dialog.html", "components\mobile-bottom-bar.html",
  "docs\COMPONENTS.md", "docs\COMPONENTS.ja.md",
  "src\index.template.html", "build-standalone.ps1", "build-standalone.bat",
  "scripts\build-self-extract.ps1", "scripts\verify-standalone.ps1", "scripts\verify-self-extract.ps1",
  "README.md", "README.ja.md", "LICENSE", "THIRD_PARTY_NOTICES.md",
  "schemas\app-config.schema.json", "schemas\dependencies.schema.json"
)
foreach ($relative in $required) {
  if (-not (Test-Path -LiteralPath (Join-Path $Root $relative))) { throw "Required repository file is missing: $relative" }
}

$mobileBottomBarText = Get-Content -Raw -Encoding UTF8 -LiteralPath (Join-Path $Root "components\mobile-bottom-bar.html")
foreach ($token in @("position: fixed", "env(safe-area-inset-bottom)", "data-mobile-target", "disabled", "window.AppMobileBottomBar")) {
  if (-not $mobileBottomBarText.Contains($token)) { throw "components\mobile-bottom-bar.html is missing required behavior marker: $token" }
}

$selfExtractBuilderPath = Join-Path $Root "scripts\build-self-extract.ps1"
$selfExtractBuilderBytes = [System.IO.File]::ReadAllBytes($selfExtractBuilderPath)
$selfExtractBuilderStart = 0
if ($selfExtractBuilderBytes.Length -ge 3 -and $selfExtractBuilderBytes[0] -eq 0xef -and $selfExtractBuilderBytes[1] -eq 0xbb -and $selfExtractBuilderBytes[2] -eq 0xbf) { $selfExtractBuilderStart = 3 }
for ($index = $selfExtractBuilderStart; $index -lt $selfExtractBuilderBytes.Length; $index += 1) {
  if ($selfExtractBuilderBytes[$index] -gt 0x7f) { throw "scripts\build-self-extract.ps1 must contain ASCII text only so Windows PowerShell 5.1 cannot corrupt loader text." }
}

$buildCompatibilityFiles = @("build-standalone.ps1", "scripts\build-self-extract.ps1", "scripts\verify-standalone.ps1", "scripts\verify-self-extract.ps1")
foreach ($relative in $buildCompatibilityFiles) {
  $text = Get-Content -Raw -Encoding UTF8 -LiteralPath (Join-Path $Root $relative)
  if ($text -match '(?i)\bGet-FileHash\b') { throw "$relative must not depend on Get-FileHash; use the .NET SHA-256 helper." }
  if ($text -match '::new\s*\(') { throw "$relative must not use ::new(); use older-compatible .NET construction syntax." }
}

$app = Get-Content -Raw -Encoding UTF8 -LiteralPath (Join-Path $Root "app.config.json") | ConvertFrom-Json
if ([string]$app.name -ne "Media Inspector") { throw "app.config.json: name must be Media Inspector" }
if ([string]$app.slug -ne "media-inspector") { throw "app.config.json: slug must be media-inspector" }
if ([string]$app.version -ne "1.0.0") { throw "app.config.json: version must be 1.0.0" }
if ([string]$app.repository.owner -ne "ttomohisa" -or [string]$app.repository.name -ne "htmlapps-media-inspector") { throw "app.config.json: repository must be ttomohisa/htmlapps-media-inspector" }
if (-not [bool]$app.build.blockRuntimeNetwork) { throw "Runtime network blocking must stay enabled" }

$dependencies = Get-Content -Raw -Encoding UTF8 -LiteralPath (Join-Path $Root "dependencies.json") | ConvertFrom-Json
$ffmpeg = @($dependencies.dependencies | Where-Object { [string]$_.id -eq "ffmpeg-wasm-builder" })
if ($ffmpeg.Count -ne 1) { throw "dependencies.json must contain exactly one ffmpeg-wasm-builder dependency" }
$ffmpeg = $ffmpeg[0]
if ([string]$ffmpeg.source -ne "github-release") { throw "ffmpeg-wasm-builder must use source=github-release" }
if ([string]$ffmpeg.repository -ne "ttomohisa/htmlapps-ffmpeg-wasm-builder") { throw "Unexpected FFmpeg Builder repository" }
if ([string]$ffmpeg.version -ne "1.2.0") { throw "Media Inspector must pin FFmpeg WASM Builder v1.2.0" }
if ([string]$ffmpeg.releaseAsset -ne "ffmpeg-wasm-media-inspector-v{version}.zip") { throw "Wrong Media Inspector release asset" }
if ([string]$ffmpeg.checksumsAsset -ne "SHA256SUMS.txt") { throw "Release checksum list must be SHA256SUMS.txt" }
if ([string]$ffmpeg.sourceAsset -ne "ffmpeg-wasm-sources-v{version}.tar.gz") { throw "Corresponding source asset must derive from Builder version" }
if ([string]$ffmpeg.license -notmatch 'LGPL-2\.1-or-later') { throw "Generated Media Inspector core license must document LGPL-2.1-or-later" }
$assetKeys = @($ffmpeg.assets | ForEach-Object { [string]$_.key })
if ($assetKeys -notcontains "core-js-gzip" -or $assetKeys -notcontains "core-wasm-gzip") { throw "Media Inspector must embed the gzip JavaScript and WASM release assets" }

$templatePath = Join-Path $Root "src\index.template.html"
$templateText = [System.IO.File]::ReadAllText($templatePath, [System.Text.Encoding]::UTF8)
foreach ($token in @(
  "<title>Media Inspector</title>", "WORKERFS", "DecompressionStream", "Media Doctor", "canPlayType",
  'id="videoProbe"', 'id="audioProbe"', 'id="mobileNav"', 'grid-template-columns:repeat(5,minmax(0,1fr))',
  'id="copyJsonButton"', 'id="saveJsonButton"', "__APP_CONFIG_JSON__", "__BUILD_MANIFEST_JSON__", "__EMBEDDED_ASSET_BUNDLE_JSON__"
)) {
  if (-not $templateText.Contains($token)) { throw "Media Inspector template is missing required marker: $token" }
}
if ($templateText -match 'state\.file\.arrayBuffer\s*\(' -or $templateText -match '\.arrayBuffer\s*\(\s*\).*state\.file') { throw "Selected media must not be copied wholesale with File.arrayBuffer()" }
if ($templateText -notmatch 'core\.FS\.mount\(core\.WORKERFS') { throw "Selected media must be mounted through WORKERFS" }
if ($templateText -notmatch "args:\['--input',inputName,'--output',outputName\]") { throw "Media Inspector runner must use its restricted --input/--output interface" }
if ($templateText -match 'Single HTML App Starter') { throw "Starter product copy must not remain in the finished Media Inspector template" }

$buildArguments = @{}
if ($ForceDownload) { $buildArguments.ForceDownload = $true }
& (Join-Path $Root "build-standalone.ps1") @buildArguments

$distOutput = Join-Path $Root "dist\index.html"
$rootOutput = Join-Path $Root "media-inspector.html"
if (-not (Test-Path -LiteralPath $rootOutput)) { throw "Root distribution HTML was not generated: media-inspector.html" }
if ((Get-Sha256FileHex $distOutput) -ne (Get-Sha256FileHex $rootOutput)) { throw "media-inspector.html must match dist/index.html" }

$manifestPath = Join-Path $Root "dist\dependency-manifest.json"
$manifest = Get-Content -Raw -Encoding UTF8 -LiteralPath $manifestPath | ConvertFrom-Json
$resolved = @($manifest.dependencies | Where-Object { [string]$_.id -eq "ffmpeg-wasm-builder" })
if ($resolved.Count -ne 1) { throw "Generated manifest must contain exactly one ffmpeg-wasm-builder dependency" }
if ([string]$resolved[0].version -ne "1.2.0") { throw "Generated manifest Builder version must be 1.2.0" }
if ([string]$resolved[0].archiveSha256 -notmatch '^[0-9a-f]{64}$') { throw "Manifest must record verified Release archive SHA-256" }
if ([string]$resolved[0].sourceSha256 -notmatch '^[0-9a-f]{64}$') { throw "Manifest must record corresponding-source SHA-256" }
if ([string]::IsNullOrWhiteSpace([string]$resolved[0].correspondingSourceUrl)) { throw "Manifest must record corresponding-source URL" }

Write-Host "[OK] Repository check passed." -ForegroundColor Green
