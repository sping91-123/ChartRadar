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
| P1 | DONE | 글로벌 하단 고정 패널 복구 | /Global | 중간 | 글로벌 자산레이더에서 타임프레임과 분석 모드를 조작할 수 있는 하단 고정 패널을 복구하거나 동등한 모바일 조작 UI를 다시 제공한다. | 글로벌 자산레이더에서 타임프레임과 ICT/종합 등 분석 모드 선택이 가능함. 340px~360px 작은 폰에서도 버튼이 잘리지 않음. | 모바일 하단 고정 컨트롤 복구. `e7137f5` |
| P1 | BLOCKED | Google 계정 보안 알림에 Google TV 권한처럼 보이는 문제 점검 | 인증 / 계정 / 사용자 데이터 | 높음 | Google OAuth Client ID, Firebase project, Supabase Google Provider, OAuth consent screen, scope 설정이 ChartRadar 프로젝트로 일관되어 있는지 확인한다. 유료화 전에는 반드시 다시 정리한다. | Google 계정 보안 알림에 ChartRadar 앱명/권한으로 표시되는지 확인. `NEXT_PUBLIC_GOOGLE_CLIENT_ID`, Firebase 프로젝트, Supabase Google Provider, OAuth consent screen이 ChartRadar 기준으로 일치해야 한다. 잘못된 프로젝트/앱 이름/권한 범위가 있으면 코드 수정 대상과 콘솔 체크리스트를 분리해 기록. | OAuth 프로젝트/Google Cloud 설정 확인이 필요하지만, 현재 베타 UX 개선을 우선하기 위해 보류 |
| P0 | DONE | README / 문서 라우팅 정합성 정리 | 개발 메인 | 중간 | README와 실제 현재 라우팅이 맞지 않는 문제를 정리한다. 현재 앱은 `/crypto`, `/alts`, `/global`, `/global/assets`, `/news?market=global`, `/journal?market=global` 중심인데 README에는 `/majors`, `/stocks`, `/calculator` 등 예전 구조가 남아 있을 수 있다. | README, 주요 docs, launch checklist가 현재 실제 라우팅과 일치해야 한다. | README, 모바일 앱 가이드, 출시 체크리스트, 결제 출시 가이드의 현재 라우팅 기준 정리. 완료 커밋: `Sync docs with current routing` |
| P1 | TODO | pushAlertScanner 구조 분리 | 알림 시스템 | 높음 | `src/lib/server/pushAlertScanner.ts`가 너무 커져 자동 알림 조건, 중복 방지, 권한, 진단, 시그널 생성이 한 파일에 몰려 있다. 자동 알림이 안정화되는 것을 확인한 뒤, types, thresholds, eligibility, scanners, diagnostics 등으로 나누는 리팩토링을 진행한다. | 기능 동작은 유지하면서 자동 알림 로직이 역할별로 분리되어야 한다. |  |
| P2 | TODO | 작업 큐 포맷 개선 | 개발 메인 | 중간 | `docs/work-queue.md`가 계속 길어질 경우 작업별 문서로 분리하는 구조를 검토한다. 예: `docs/work-items/P1-001-*.md` | 작업 큐가 사람이 읽고 관리하기 쉬운 구조가 되어야 한다. |  |
| P1 | TODO | 디자인 시스템 2차 적용 | UI 디자인 시스템 / 브랜드 리뉴얼 | 높음 | 이미 추가된 DesignPrimitives와 UI token을 기반으로 `/alerts`, `/news`, `/journal`, `/pro` 등에 단계적으로 적용한다. | AI스럽게 보이는 과한 glow, gradient, badge, 반복 카드가 줄어들고 공통 컴포넌트 사용이 늘어나야 한다. |  |
| P1 | TODO | 앱 버전 표시 중앙화 | 홈 랜딩 / 시장선택화면 | 낮음~중간 | `HeaderActions.tsx` 등에 하드코딩된 앱 버전/빌드 표시를 `src/lib/appVersion.ts` 같은 상수 파일로 분리한다. | `versionName`/`versionCode` 변경 시 설정 화면 표시값 누락 위험이 줄어야 한다. |  |
| P1 | TODO | 자동 푸시 운영 진단 화면 또는 관리자용 로그 요약 | 알림 시스템 | 높음 | 현재 Vercel Logs에서만 확인 가능한 push-cron 진단값을 관리자/개발자용으로 더 쉽게 볼 수 있게 정리한다. 예: 마지막 Cron 실행 시각, tokenCount, eligibleEventCount, skippedLowScoreCount, sendTargetTokenCount, 마지막 skip 사유. | 자동 알림이 왜 왔고 왜 안 왔는지 운영자가 빠르게 확인할 수 있어야 한다. |  |
| P2 | TODO | 매크로 smoke 구조 개선 | 뉴스 / 매크로 레이더 | 중간~높음 | `smoke-ops`가 정적 `macroEvents.ts`의 미래 일정 신선도에 의존하는 문제를 줄인다. 가능하면 `/api/macro-calendar` 또는 공식 source adapter 결과를 기준으로 검사하도록 개선한다. | 정적 예비 일정이 시간이 지나 과거가 되었다고 스모크가 반복적으로 깨지지 않아야 한다. |  |
| P2 | TODO | LiveMarketChart 컴포넌트 분리 | 코인 레이더 /crypto | 높음 | `LiveMarketChart`가 너무 커져 UI/판단/차트/CTA/Pro gate가 섞여 있다. `CryptoChartPanel`, `CryptoSummaryPanel`, `CryptoRiskPanel`, `CryptoModeControls` 등으로 단계적 분리를 검토한다. | 기능 변경 없이 유지보수성이 좋아져야 한다. |  |
| P2 | TODO | StockRadarApp 컴포넌트 분리 | /Global | 높음 | `StockRadarApp`의 글로벌 자산 선택, 차트, 컨트롤바, 요약, fallback 상태를 분리한다. | 글로벌 시장/자산 구조가 더 안정적으로 유지되어야 한다. |  |
| P2 | TODO | Health API 공개 범위 점검 | 버그 수정 / 긴급 대응 | 중간 | `/api/health`가 운영 내부 상태를 너무 자세히 공개하지 않는지 점검한다. 공개용 health와 관리자용 상세 health를 분리할지 검토한다. | 외부에 과도한 운영 정보가 노출되지 않아야 한다. |  |
| P2 | TODO | 세션 저장/refresh token 구조 점검 | 인증 / 계정 / 사용자 데이터 | 높음 | `NEXT_PUBLIC_ALLOW_LOCAL_REFRESH_TOKEN` 등 세션 지속 구조를 유료화 전 점검한다. Capacitor 앱에서 안전한 세션 유지 구조를 검토한다. | 로그인 유지가 안정적이고 보안상 불필요한 노출이 없어야 한다. |  |
| P2 | DONE | 글로벌 상단 탭 정렬 균일화 | /Global | 낮음~중간 | 글로벌 상단의 시장/자산/일정/복기 탭이 모바일에서 균일한 폭 또는 자연스러운 중앙 정렬로 보이게 조정한다. | 340px~360px에서도 탭이 잘리지 않고 왼쪽으로 쏠려 보이지 않음. | 모바일 글로벌 4탭 균등 정렬 적용. `7b14216` |
| P2 | DONE | 지표 안내 화면을 카테고리/상세 진입 구조로 개편 | 레이더 판단 엔진 | 중간 | 지표 안내를 카테고리형 선택 구조로 바꾸고, 각 카테고리에서 항목 목록과 설명을 확인할 수 있게 한다. | 레이더 판단, 코인 지표, 글로벌 지표, 알트 지표, 매크로/뉴스, 알림 시그널, 복기/저널 카테고리로 접근 가능. 1차는 카테고리/아코디언 구조까지 구현. | 카테고리 카드와 용어별 아코디언 구조 적용. 최종 커밋 해시는 완료 보고에 기록 |


