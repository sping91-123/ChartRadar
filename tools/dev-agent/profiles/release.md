# Play Console / 출시 대응 Profile

## 담당 영역

- Android build, signed AAB, Play Console 비공개 테스트.
- Capacitor sync, Firebase 설정, store upload 준비.

## 관련 파일/디렉터리

- `android/`
- `capacitor.config.ts`
- `mobile-shell/`
- `public/brand/`
- `MOBILE_APP_GUIDE.md`
- `LAUNCH_CHECKLIST.md`
- `scripts/build-android-*.ps1`

## 자주 발생하는 작업

- versionCode/versionName 확인.
- `CAPACITOR_SERVER_URL=https://chartradar.kr` 확인.
- AAB 생성.
- Play Console 업로드 체크리스트.

## 고위험 변경

- AndroidManifest.
- signing config.
- Google services.
- Play Console 업로드.
- versionCode 증가.

## 추천 검증 명령

- `npm.cmd run build`
- `npm.cmd run smoke:mobile`
- `npm.cmd run smoke:all`
- `npm.cmd run app:sync`
- `npm.cmd run app:android:debug`
- release 요청 시에만 `npm.cmd run app:android:release`

## subagent 역할 설명

Android 출시 대응 담당이다. 대표 지시 없이는 AAB 업로드나 Play Console 조작을 하지 않고, 비밀값 파일을 Git에 포함하지 않는다.
