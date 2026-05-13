# Android Studio에 포함된 JDK를 자동으로 찾아 디버그 APK를 빌드합니다.
$ErrorActionPreference = "Stop"

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$androidDir = Join-Path $repoRoot "android"

if (-not (Test-Path $androidDir)) {
  throw "android 폴더를 찾지 못했습니다. 먼저 npm.cmd run app:sync를 실행해 주세요."
}

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
  throw "Java JDK를 찾지 못했습니다. Android Studio 설치 후 다시 실행해 주세요."
}

$env:JAVA_HOME = $javaHome
$env:PATH = "$javaHome\bin;$env:PATH"

Write-Host "JAVA_HOME=$javaHome"
Push-Location $androidDir
try {
  .\gradlew.bat assembleDebug
}
finally {
  Pop-Location
}

$apkPath = Join-Path $androidDir "app\build\outputs\apk\debug\app-debug.apk"
if (Test-Path $apkPath) {
  Write-Host "APK 생성 완료: $apkPath"
} else {
  throw "Gradle 빌드는 끝났지만 APK 파일을 찾지 못했습니다."
}
