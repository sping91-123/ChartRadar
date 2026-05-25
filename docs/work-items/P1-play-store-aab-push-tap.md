# P1 Play Store용 AAB 재생성 및 푸시 탭 이동 반영

- 상태: `TODO`
- 담당방: Play Console / 출시 대응
- 인텔리전스: 중간
- 우선순위: P1
- 진행 시점: 스토어 업로드 시점에 진행

## 목표

AndroidManifest `OPEN_ALERTS` 변경, 최신 푸시 탭 라우팅, 최신 웹 UI가 포함된 signed AAB를 생성하고 Play Console 비공개 테스트 트랙에 업로드합니다.

## 현재 기록

- debug 앱에서는 푸시 알림 탭 이동 성공 확인.
- 기존 Play Store 설치본에는 네이티브 Android 변경이 자동 반영되지 않습니다.
- 스토어 테스터에게 반영하려면 versionCode 증가 후 signed AAB를 다시 생성해야 합니다.

## 완료 기준

- `versionCode` 증가.
- signed AAB 생성.
- AAB 내부 `server.url=https://chartradar.kr` 확인.
- Play Store 설치본에서 푸시 탭 시 앱 열림 및 `targetPath` 이동 확인.

## 검증 기준

- `git diff --check`
- `cmd /c npx tsc --noEmit`
- `npm.cmd run build`
- `npm.cmd run smoke:mobile`
- `npm.cmd run smoke:all`
- `npm.cmd run app:sync`
- `npm.cmd run app:android:release`
