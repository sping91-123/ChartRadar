# Chart Radar 모바일 앱 가이드

Chart Radar Android 앱은 Capacitor WebView로 운영 웹앱 `https://chartradar.kr`을 여는 하이브리드 앱입니다. 화면과 라우팅의 기준은 Next.js 웹앱이며, Android native 쪽은 로그인, 푸시, 앱 패키징을 담당합니다.

## 현재 기준

- 운영 URL: `https://chartradar.kr`
- Android package: `com.staronlabs.chartradar`
- WebView 서버 URL: `CAPACITOR_SERVER_URL=https://chartradar.kr`
- Firebase 설정 파일: `android/app/google-services.json`
- Firebase 설정 파일과 keystore, 비밀키는 Git에 커밋하지 않습니다.

## 주요 앱 라우트

- `/` - 시장 선택 홈
- `/crypto` - BTC/ETH 코인 레이더
- `/alts` - 알트코인 레이더
- `/global` - 글로벌 시장흐름
- `/global/assets` - 글로벌 자산레이더
- `/news?market=crypto` - 코인 뉴스/이벤트
- `/news?market=global` - 글로벌 일정/이벤트/뉴스
- `/alerts?market=crypto` - 코인 앱 푸시 알림 조건과 상태
- `/alerts?market=global` - 글로벌 앱 푸시 알림 조건과 상태
- `/journal?market=crypto` - 코인 복기/저널
- `/journal?market=global` - 글로벌 복기/저널
- `/learn` - 지표 안내
- `/login` - 로그인
- `/pro` - Pro 구독

## Android 빌드 기본 순서

PowerShell 기준입니다.

```powershell
$env:CAPACITOR_SERVER_URL="https://chartradar.kr"
npm.cmd run build
npm.cmd run app:sync
npm.cmd run app:android:debug
```

release AAB 생성은 별도 제출 지시가 있을 때만 실행합니다.

```powershell
$env:CAPACITOR_SERVER_URL="https://chartradar.kr"
npm.cmd run build
npm.cmd run app:sync
npm.cmd run app:android:release
```

## 확인할 기능

- 앱 시작 시 `https://chartradar.kr` 기준 화면이 열리는지 확인합니다.
- Google 네이티브 로그인이 동작하는지 확인합니다.
- Android 13 이상에서 푸시 권한 팝업이 표시되는지 확인합니다.
- FCM 토큰이 서버에 저장되는지 확인합니다.
- 테스트 푸시는 관리자 계정에서만 노출되어야 합니다.
- `/global/assets`에서 자산레이더 차트와 하단 모바일 컨트롤이 보이는지 확인합니다.
- `/global`, `/news?market=global`, `/journal?market=global`에서는 자산레이더 하단 컨트롤이 노출되지 않아야 합니다.

## iOS 참고

iOS는 Windows에서 최종 빌드할 수 없습니다. Mac에서 같은 저장소를 받은 뒤 아래 흐름으로 진행합니다.

```bash
export CAPACITOR_SERVER_URL="https://chartradar.kr"
npm run build
npx cap sync ios
npx cap open ios
```
