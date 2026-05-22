# ChartRadar Work Queue

이 문서는 ChartRadar 작업을 짧은 지시만으로 이어가기 위한 공통 작업 큐입니다. Codex는 별도 지시가 없으면 이 문서의 원칙과 TODO 상태를 기준으로 다음 작업을 판단합니다.

## 작업 처리 원칙

- 한 번에 하나의 TODO만 처리한다.
- 상태가 `TODO`인 항목 중 우선순위가 가장 높은 것만 처리한다.
- 작업 전 `git status --short --branch`를 확인한다.
- 작업 후 필요한 build/smoke 검증을 실행한다.
- 완료하면 해당 항목의 상태를 `DONE`으로 바꾼다.
- 커밋은 하되 push는 하지 않는다.
- 결과 보고에는 수정 파일, 검증 결과, 커밋 해시를 포함한다.
- 비밀값, `.env.local`, `google-services.json`, Firebase key, `CRON_SECRET`은 절대 커밋하지 않는다.

## 공통 저장소 기준

- 저장소: `https://github.com/sping91-123/ChartRadar`
- 기본 브랜치: `main`
- 로컬 기준 경로: `C:\Users\USER\Desktop\바탕화면 정리_2026-05-06\작업 폴더\COTERS\Chart-Radar`
- 운영 URL: `https://chartradar.kr`
- Android package: `com.staronlabs.chartradar`
- 작업 전 현재 폴더가 위 저장소와 연결되어 있는지 확인한다.

## Push 금지 원칙

- TODO 처리 후 기본 동작은 commit까지만 진행한다.
- `git push`는 대표가 명시적으로 요청한 경우에만 실행한다.
- push 전에는 반드시 아래를 확인한다.
  - `git status --short --branch`
  - `git log --oneline -5`
  - `git rev-list --left-right --count HEAD...origin/main`
  - 비밀값 파일 추적 여부

## 비밀값 커밋 금지 원칙

아래 파일 또는 값은 Git 추적 대상에 포함하면 안 된다.

- `.env.local`
- `.env*.local`
- `android/app/google-services.json`
- Firebase 서비스 계정 JSON
- Firebase private key
- Supabase service role key
- `SUPABASE_ACCESS_TOKEN`
- `CRON_SECRET`
- RevenueCat secret key
- Google OAuth client secret
- Android keystore, keystore password, key password

비밀값 추적 여부 확인 예시:

```powershell
git ls-files | Select-String -Pattern '(^|/)(\.env|\.env\.local|google-services\.json|firebase.*\.json|.*service.*account.*\.json|.*private.*key.*|.*cron.*secret.*|.*keystore.*|.*key-password.*)'
```

## 검증 명령 기준

작업 성격에 따라 필요한 검증을 선택하되, 앱 코드 변경 시 최소 build와 관련 smoke를 실행한다.

- 공통:
  - `git diff --check`
  - `cmd /c npx tsc --noEmit`
  - `npm.cmd run build`
- 모바일 영향:
  - `npm.cmd run smoke:mobile`
  - `npm.cmd run app:android:debug`
- 전체 회귀:
  - `npm.cmd run smoke:all`
- 결제 영향:
  - `npm.cmd run smoke:billing`
- 운영/크론 영향:
  - `npm.cmd run smoke:ops`
- 문서만 수정한 경우:
  - build/smoke는 생략 가능
  - `git status --short --branch`는 반드시 확인

## 작업 상태 규칙

- `TODO`: 아직 착수하지 않은 작업
- `IN_PROGRESS`: 현재 작업 중인 항목
- `BLOCKED`: 외부 권한, 계정, API, 운영 데이터, 대표 확인이 필요해 멈춘 항목
- `DONE`: 검증과 커밋까지 완료한 항목

작업을 시작하면 해당 항목을 `IN_PROGRESS`로 바꾸고, 완료 커밋 후 `DONE`으로 바꾼다. 단, 상태 변경 자체도 같은 작업 커밋에 포함한다.

## 현재 남은 TODO 목록

| 우선순위 | 상태 | 작업 | 방 | 인텔리전스 | 목표 | 완료 커밋 |
| --- | --- | --- | --- | --- | --- | --- |
| P1 | DONE | 신규 실업수당 청구 결과 확인중 문제 | 뉴스 / 매크로 레이더 | 높음 | Jobless Claims가 발표 후에도 결과 확인중으로 남지 않게 수정 | `6f1e70f` |
| P2 | DONE | 글로벌 일정 뉴스 압력 명칭/한글화 | /Global | 중간 | 일정 뉴스 압력 표현을 자연스럽게 정리하고 글로벌 뉴스 제목을 한국어 우선 표시 |  |
| P3 | TODO | UI 디자인 시스템 진단 | UI 디자인 시스템 / 브랜드 리뉴얼 | xhigh | AI스럽게 보이는 UI 문제를 진단하고 디자인 시스템 개선안을 작성 |  |
| P4 | TODO | 앱 푸시 로그인 후 실제 테스트 후속 | 알림 시스템 | 높음 | 로그인 상태에서 `push_tokens` 저장과 테스트 알림 수신까지 확인 |  |
