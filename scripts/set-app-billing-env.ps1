# 앱 구독 결제에 필요한 비밀 키를 로컬 .env.local에 안전하게 반영합니다.
param(
  [string]$RevenueCatAndroidApiKey,
  [string]$RevenueCatRestApiKey,
  [string]$SupabaseServiceRoleKey,
  [string]$RevenueCatIosApiKey
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$envPath = Join-Path $root ".env.local"

function Read-SecretValue {
  param(
    [string]$Prompt,
    [string]$CurrentValue
  )

  if ($CurrentValue) {
    return $CurrentValue
  }

  $secure = Read-Host $Prompt -AsSecureString
  $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
  try {
    return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)
  } finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)
  }
}

function Set-EnvLine {
  param(
    [string[]]$Lines,
    [string]$Key,
    [string]$Value
  )

  if (-not $Value) {
    return $Lines
  }

  $escaped = [Regex]::Escape($Key)
  $line = "$Key=$Value"
  $found = $false
  $updated = foreach ($item in $Lines) {
    if ($item -match "^$escaped\s*=") {
      $found = $true
      $line
    } else {
      $item
    }
  }

  if (-not $found) {
    $updated += $line
  }

  return $updated
}

if (-not (Test-Path $envPath)) {
  New-Item -ItemType File -Path $envPath | Out-Null
}

$RevenueCatAndroidApiKey = Read-SecretValue "RevenueCat Android 공개 SDK 키를 입력해 주세요" $RevenueCatAndroidApiKey
$RevenueCatRestApiKey = Read-SecretValue "RevenueCat REST API 키를 입력해 주세요" $RevenueCatRestApiKey
$SupabaseServiceRoleKey = Read-SecretValue "Supabase service_role 키를 입력해 주세요" $SupabaseServiceRoleKey

if (-not $RevenueCatIosApiKey) {
  $RevenueCatIosApiKey = Read-Host "iOS RevenueCat 공개 SDK 키가 있으면 입력해 주세요. 없으면 Enter"
}

$lines = @(Get-Content $envPath -Encoding UTF8)
$lines = Set-EnvLine $lines "NEXT_PUBLIC_REVENUECAT_ANDROID_API_KEY" $RevenueCatAndroidApiKey
$lines = Set-EnvLine $lines "REVENUECAT_REST_API_KEY" $RevenueCatRestApiKey
$lines = Set-EnvLine $lines "SUPABASE_SERVICE_ROLE_KEY" $SupabaseServiceRoleKey
$lines = Set-EnvLine $lines "NEXT_PUBLIC_REVENUECAT_IOS_API_KEY" $RevenueCatIosApiKey

Set-Content -Path $envPath -Value $lines -Encoding UTF8

Write-Host "앱 결제 환경변수를 .env.local에 반영했습니다."
Write-Host "이어서 npm.cmd run check:app-billing 을 실행해 주세요."
