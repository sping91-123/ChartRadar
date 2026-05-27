# P1 Play Store용 AAB 재생성 및 푸시 탭 이동 반영

- 상태: `TODO`
- 담당방: Play Console / 출시 대응
- 인텔리전스: 중간
- 우선순위: P1
- 진행 시점: 스토어 업로드 시점에 진행
- 준비 상태: 체크리스트 보강 완료. 실제 AAB 생성과 업로드는 대표 승인 후 별도 진행

## 목표

AndroidManifest `OPEN_ALERTS` 변경, 최신 푸시 탭 라우팅, 최신 웹 UI가 포함된 signed AAB를 생성하고 Play Console 비공개 테스트 트랙에 업로드합니다.

## 현재 기록

- debug 앱에서는 푸시 알림 탭 이동 성공 확인.
- 기존 Play Store 설치본에는 네이티브 Android 변경이 자동 반영되지 않습니다.
- 스토어 테스터에게 반영하려면 versionCode 증가 후 signed AAB를 다시 생성해야 합니다.
- 현재 AndroidManifest에는 `OPEN_ALERTS` intent action이 포함되어 있습니다.
- 현재 Android 설정 기준은 `applicationId=com.staronlabs.chartradar`, `versionCode=6`, `versionName=1.0.3`입니다.

## 대표 승인 전 금지

- `versionCode` 변경 금지.
- signed AAB 생성 금지.
- Play Console 업로드 금지.
- production release 제출 금지.
- keystore, signing password, `google-services.json`, Firebase key 출력 금지.

## 사전 체크리스트

- `git status --short --branch`가 clean인지 확인.
- local `main`과 `origin/main`이 일치하는지 확인.
- `android/app/google-services.json`은 로컬에 존재할 수 있으나 Git 추적 대상이 아닌지 확인.
- keystore와 signing 관련 파일이 Git 추적 대상이 아닌지 확인.
- `CAPACITOR_SERVER_URL=https://chartradar.kr` 기준으로 sync되는지 확인.
- AndroidManifest에 `OPEN_ALERTS` action이 유지되는지 확인.
- 푸시 payload의 `targetPath`가 `/alerts`, `/crypto`, `/alts`, `/global`, `/global/assets` 등 의도한 route로 이동하는지 확인.
- Play Console에 이미 업로드된 최신 `versionCode`보다 새 값이 큰지 확인.
- RevenueCat, billing, productId, entitlement 변경이 이번 AAB 재생성 범위에 섞이지 않는지 확인.
- 앱 코드, Android 설정, 문서 변경을 한 커밋에 섞지 않는다.

## 완료 기준

- 대표 승인 후 `versionCode` 증가.
- `npm.cmd run app:sync`로 최신 웹 빌드와 Capacitor 설정 반영.
- signed AAB 생성.
- AAB 내부 `server.url=https://chartradar.kr` 확인.
- Play Console 비공개 테스트 트랙 업로드.
- Play Store 설치본에서 푸시 탭 시 앱 열림 및 `targetPath` 이동 확인.
- Play Store 설치본에서 Pro 화면, Google 로그인, FCM 토큰 저장, 알림 탭 이동이 기존 기준대로 동작하는지 확인.

## 검증 기준

- `git diff --check`
- `cmd /c npx tsc --noEmit`
- `npm.cmd run build`
- `npm.cmd run smoke:mobile`
- `npm.cmd run smoke:all`
- `npm.cmd run smoke:billing`
- 대표 승인 후에만 `npm.cmd run app:sync`
- 대표 승인 후에만 `npm.cmd run app:android:release`

## Play Console 업로드 전 최종 확인

- 업로드할 AAB의 `versionCode`가 Play Console 기존 값보다 높은지 확인.
- 업로드 대상이 비공개 테스트 트랙인지 확인.
- release note에 푸시 탭 이동과 최신 웹 UI 반영 범위만 적고 투자 성과 보장 표현을 쓰지 않는다.
- 업로드 후 테스터 설치본에서 실제 알림 탭 이동을 확인한다.
- 문제가 있으면 production 확장 전 비공개 테스트 트랙에서 중단한다.
