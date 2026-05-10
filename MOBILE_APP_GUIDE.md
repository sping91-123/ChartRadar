# Chart Radar 모바일 앱 준비 메모

## 현재 완료된 것

- PWA 매니페스트가 `/manifest.webmanifest`로 제공됩니다.
- 프로덕션 환경에서는 `/sw.js` 서비스워커가 등록되어 홈 화면 설치와 기본 오프라인 안내가 가능합니다.
- Android 앱 래퍼를 위한 Capacitor 설정이 추가되었습니다.

## 가장 빠른 공개 순서

1. 웹을 먼저 Vercel 같은 호스팅에 배포합니다.
2. 배포 주소를 `NEXT_PUBLIC_SITE_URL`에 넣습니다.
3. Android 앱 빌드 전 PowerShell에서 아래처럼 앱 주소를 지정합니다.

```powershell
$env:CAPACITOR_SERVER_URL="https://실제도메인"
npm run app:add:android
npm run app:sync
npm run app:android
```

## iOS 앱 출시

iOS는 Windows에서 최종 빌드가 어렵습니다. Mac에서 같은 저장소를 받은 뒤 아래 순서로 진행합니다.

```bash
export CAPACITOR_SERVER_URL="https://실제도메인"
npx cap add ios
npx cap sync ios
npx cap open ios
```

## 중요한 결정

현재 Next.js API와 실시간 Binance 데이터, AI 브리핑을 그대로 쓰려면 앱은 배포된 웹앱을 안전하게 감싸는 방식이 가장 빠릅니다. 나중에 완전 네이티브 화면이 필요해지면 Expo 앱을 별도 프로젝트로 만들고, `src/lib`의 분석 로직만 공유하는 방향이 좋습니다.
