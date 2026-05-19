# Android 앱을 운영 Chart Radar 주소로 동기화하는 출시용 스크립트입니다.
$ErrorActionPreference = "Stop"

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$androidConfigPath = Join-Path $repoRoot "android\app\src\main\assets\capacitor.config.json"
$productionUrl = "https://chartradar.kr"

$env:CAPACITOR_SERVER_URL = $productionUrl

Push-Location $repoRoot
try {
  npm.cmd exec -- cap sync android
}
finally {
  Pop-Location
}

if (-not (Test-Path $androidConfigPath)) {
  throw "Capacitor Android config was not generated: $androidConfigPath"
}

$config = Get-Content $androidConfigPath -Raw | ConvertFrom-Json
if (-not $config.server -or $config.server.url -ne $productionUrl) {
  throw "Android app is not targeting $productionUrl. Run npm.cmd run app:sync again and check CAPACITOR_SERVER_URL handling."
}

if ($config.server.cleartext -eq $true) {
  throw "Android production config must not allow cleartext traffic for $productionUrl."
}

Write-Host "Android Capacitor config targets $productionUrl"
