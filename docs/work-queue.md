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

## 현재 작업 큐

| 우선순위 | 상태 | 작업 | 담당방 | 인텔리전스 | 목표 | 완료 기준 | 완료 결과 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| P1 | DONE | 신규 실업수당 청구 결과 확인중 문제 | 뉴스 / 매크로 레이더 | 높음 | Jobless Claims가 발표 후에도 결과 확인중으로 남지 않게 수정 | 발표 후 `결과 확인중`에 장시간 머물지 않고 공식값 또는 확인 필요 상태로 전환 | `6f1e70f` |
| P2 | DONE | 글로벌 일정 뉴스 압력 명칭/한글화 | /Global | 중간 | 일정 뉴스 압력 표현을 자연스럽게 정리하고 글로벌 뉴스 제목을 한국어 우선 표시 | 글로벌 일정/뉴스 표현이 한국어 우선으로 표시되고 압력 문구가 자연스러움 | `0f6be13` |
| P3 | DONE | UI 디자인 시스템 진단 | UI 디자인 시스템 / 브랜드 리뉴얼 | xhigh | AI스럽게 보이는 UI 문제를 진단하고 디자인 시스템 개선안을 작성 | 진단 문서가 저장소에 남고 작업 큐에 완료 기록 | `docs/ui-design-system-audit.md` |
| P4 | DONE | 앱 푸시 로그인 후 실제 테스트 후속 | 알림 시스템 | 높음 | 로그인 상태에서 `push_tokens` 저장과 테스트 알림 수신까지 확인 | 실제 폰에서 알림 권한 팝업 표시와 테스트 푸시 수신 확인 | 실제 폰에서 알림 권한 팝업 표시 확인, 테스트 푸시 실제 수신 성공. 테스트 패널 노출 범위 문제는 별도 TODO로 분리. 관련 기록: `21b22a6`, 실기기 테스트 성공 확인 |
| P1 | DONE | 알림 테스트 패널 관리자 전용화 또는 제거 | 알림 시스템 | 높음 | 알림 테스트 패널은 관리자 계정에만 노출하거나 일반 사용자 화면에서는 완전히 제거한다. 일반 사용자에게는 앱 푸시 연결 상태와 실제 알림 설정만 보여준다. | 일반/테스터 계정에서 테스트 알림 버튼이 보이지 않음. 관리자 계정에서만 테스트 패널이 보이거나 운영 화면에서 제거됨. 오발송 위험이 없음. | 관리자 계정에서만 테스트 패널 표시, 일반 사용자 UI에서는 숨김. `/api/push-test`도 관리자 계정만 허용. c5e6664 |
| P1 | DONE | 설정 화면 전면 페이지화 및 라이트모드 반투명 문제 수정 | 홈 랜딩 / 시장선택화면 | 중간 | 설정은 작은 팝오버가 아니라 전체 화면 설정 페이지 또는 풀스크린 패널로 표시한다. 뒤로/닫기 버튼으로 메인 화면에 돌아올 수 있고 라이트모드에서는 불투명한 흰색/연회색 surface를 사용한다. | 라이트모드 설정 화면이 뒤 화면과 겹쳐 보이지 않음. 모바일에서 닫기/뒤로 이동이 명확함. 설정 진입 버튼 위치가 앱답게 정리됨. | 설정 아이콘에서 풀스크린 패널을 열고 뒤로 버튼으로 닫도록 변경. 라이트모드 불투명 surface와 340px/360px 폭 확인 완료. 커밋 해시는 완료 보고에 기록. |
| P1 | TODO | 글로벌 하단 고정 패널 복구 | /Global | 중간 | 글로벌 자산레이더에서 타임프레임과 분석 모드를 조작할 수 있는 하단 고정 패널을 복구하거나 동등한 모바일 조작 UI를 다시 제공한다. | 글로벌 자산레이더에서 타임프레임과 ICT/종합 등 분석 모드 선택이 가능함. 340px~360px 작은 폰에서도 버튼이 잘리지 않음. |  |
| P1 | TODO | Google 계정 보안 알림에 Google TV 권한처럼 보이는 문제 점검 | 인증 / 계정 / 사용자 데이터 | 높음 | Google OAuth Client ID, Firebase project, OAuth consent screen, scope 설정이 ChartRadar 프로젝트로 일관되어 있는지 확인한다. | Google 계정 보안 알림에 ChartRadar 앱명/권한으로 표시되는지 확인. 잘못된 프로젝트/앱 이름/권한 범위가 있으면 코드 수정 대상과 콘솔 체크리스트를 분리해 기록. |  |
| P2 | TODO | 글로벌 상단 탭 정렬 균일화 | /Global | 낮음~중간 | 글로벌 상단의 시장/자산/일정/복기 탭이 모바일에서 균일한 폭 또는 자연스러운 중앙 정렬로 보이게 조정한다. | 340px~360px에서도 탭이 잘리지 않고 왼쪽으로 쏠려 보이지 않음. |  |
| P2 | TODO | 지표 안내 화면을 카테고리/상세 진입 구조로 개편 | 레이더 판단 엔진 | 중간 | 지표 안내를 카테고리형 선택 구조로 바꾸고, 각 카테고리에서 항목 목록과 설명을 확인할 수 있게 한다. | 레이더 판단, 코인 지표, 글로벌 지표, 알트 지표, 매크로/뉴스, 알림 시그널, 복기/저널 카테고리로 접근 가능. 1차는 카테고리/아코디언 구조까지 구현. |  |


