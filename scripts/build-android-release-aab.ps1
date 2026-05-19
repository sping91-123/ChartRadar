# Android 출시용 AAB를 운영 Chart Radar 주소로 동기화한 뒤 빌드합니다.
$ErrorActionPreference = "Stop"

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$androidDir = Join-Path $repoRoot "android"

if (-not (Test-Path $androidDir)) {
  throw "android folder was not found. Run npm.cmd run app:sync first."
}

& (Join-Path $PSScriptRoot "sync-android-production.ps1")

$jdkCandidates = @(
  "C:\Program Files\Android\Android Studio\jbr",
  "C:\Program Files\Android\Android Studio\jre",
  "C:\Program Files\Eclipse Adoptium",
  "C:\Program Files\Java"
)

$javaHome = $env:JAVA_HOME

if (-not $javaHome -or -not (Test-Path (Join-Path $javaHome "bin\java.exe"))) {
  foreach ($candidate in $jdkCandidates) {
    if (-not (Test-Path $candidate)) {
      continue
    }

    if (Test-Path (Join-Path $candidate "bin\java.exe")) {
      $javaHome = $candidate
      break
    }

    $childJdk = Get-ChildItem -Path $candidate -Directory -ErrorAction SilentlyContinue |
      Where-Object { Test-Path (Join-Path $_.FullName "bin\java.exe") } |
      Select-Object -First 1

    if ($childJdk) {
      $javaHome = $childJdk.FullName
      break
    }
  }
}

if (-not $javaHome -or -not (Test-Path (Join-Path $javaHome "bin\java.exe"))) {
  throw "Java JDK was not found. Install Android Studio or set JAVA_HOME, then run this script again."
}

$env:JAVA_HOME = $javaHome
$env:PATH = "$javaHome\bin;$env:PATH"

Write-Host "JAVA_HOME=$javaHome"
Push-Location $androidDir
try {
  .\gradlew.bat bundleRelease
}
finally {
  Pop-Location
}

$aabPath = Join-Path $androidDir "app\build\outputs\bundle\release\app-release.aab"
if (Test-Path $aabPath) {
  Write-Host "AAB generated: $aabPath"
} else {
  throw "Gradle finished but the release AAB was not found: $aabPath"
}
