# ChartRadar Agent Guide

이 문서는 ChartRadar 저장소에서 Codex와 하위 작업 에이전트가 항상 먼저 참고해야 하는 저장소 운영 지침입니다.

## 프로젝트 정체성

- ChartRadar는 StarOn Labs의 코인/글로벌 시장 판단 보조 앱이다.
- 사용자는 제품 오너이며 최종 의사결정자다.
- 앱의 핵심 가치는 사용자가 차트를 오래 보지 않아도 방향, 리스크, 관망/추적 조건을 빠르게 정리하게 돕는 것이다.
- 투자 권유, 수익 보장, 진입 지시처럼 보이는 문구를 피한다.
- 표현은 매수/매도 지시가 아니라 판단 보조, 추적 조건, 리스크, 무효화 기준, 확인 조건 중심으로 작성한다.

## 기준 저장소

- 기본 로컬 경로는 `X:\Chart-Radar`이다.
- 예전 `C:\Users\USER\...` 경로는 legacy path로 본다.
- 작업 전 반드시 현재 repo path와 Git 루트를 확인한다.
- 기본 브랜치는 `main`이다.
- 운영 URL은 `https://chartradar.kr`이다.
- 앱 구조는 Next.js 웹앱을 Capacitor Android WebView로 감싼 하이브리드 앱이다.

## 기준 Route

- `/`: 시장 선택과 앱 진입.
- `/crypto`: BTC/ETH 중심 코인 레이더.
- `/alts`: 알트코인 레이더.
- `/global`: 글로벌 시장흐름 대시보드.
- `/global/assets`: 글로벌 자산 레이더.
- `/news`: 뉴스/이벤트 레이더.
- `/alerts`: 알림 설정/상태.
- `/journal`: 복기/저널.
- `/learn`: 지표 안내.
- `/login`: 로그인.
- `/pro`: Pro 요금제와 구독.
- `/terms`, `/privacy`, `/refund`, `/account/delete`: 정책과 계정 안내.
- `/admin/entitlements`: 관리자 권한/구독 보정.
- `/majors`는 `/crypto` 호환 또는 redirect로만 취급한다.
- `/stocks`, `/calculator`, `/diagnosis`, `/report`, `/settings`, `/pro/apply`는 현재 주력 route가 아니다.

## 작업 운영 원칙

- 한 번에 하나의 작업만 처리한다.
- 작업 전 `git status --short --branch`와 `git rev-list --left-right --count HEAD...origin/main`을 확인한다.
- local `main`과 `origin/main`이 불일치하면 새 작업을 시작하지 말고 보고한다.
- 작업트리가 dirty이면 기존 변경의 정체를 먼저 확인하고, 무관하거나 충돌 가능성이 있으면 중단한다.
- 기존 사용자 변경이나 미커밋 파일을 되돌리지 않는다.
- 검증 통과 후 하나의 논리 단위로 커밋한다.
- 대표의 명시 승인 전에는 `git push`를 실행하지 않는다.
- 대표의 명시 승인 없이 deploy, Play Console 업로드, AAB 제출, production DB migration을 실행하지 않는다.
- 비밀값, `.env` 실제 파일, `google-services.json`, keystore는 출력하거나 커밋하지 않는다.
- 앱 기능 작업과 문서 작업은 한 커밋에 섞지 않는다.

## 고위험 영역

아래는 항상 고위험으로 취급한다. 필요한 경우 계획을 먼저 제시하고 최소 변경으로 진행한다.

- RevenueCat.
- `src/lib/billing.ts`.
- planId / productId / entitlement.
- Supabase / RLS / production DB migration.
- Google 로그인 / OAuth / 세션.
- Android / Capacitor / AAB / Play Console.
- FCM / push token / push-cron.
- `.env`, Firebase key, keystore, `android/app/google-services.json`.
- 계정 삭제, 로그아웃, 세션 복구, 관리자 권한 보정.

## Basic/Pro 원칙

- Basic은 방향성 요약, 핵심 흐름, 제한된 판단 중심으로 노출한다.
- Pro는 세부 조건, 리스크, 무효화 기준, 추적 조건, 다음 행동 기준, 업데이트 시각을 보여준다.
- Pro gating은 BM 핵심이므로 함부로 약화하지 않는다.
- UI에서 숨기는 것만으로 민감 정보가 보호된다고 판단하지 않는다. 가능하면 데이터 전달 전 제한한다.
- 결제 유도 문구는 과장되거나 투자 수익을 보장하는 느낌이면 안 된다.
- 권장 표현은 판단 보조, 추적 조건, 확인 필요, 관망 우위, 리스크 확대다.

## 결제와 구독 주의사항

- 결제와 구독 권한은 고위험 영역이다.
- RevenueCat productId, entitlement, basePlanId, planId 매핑을 임의 변경하지 않는다.
- `bundle_yearly`는 legacy internal plan id이며, 사용자 노출 상품은 All Market Pro 6개월 구독이다.
- 사용자 화면과 Google Play 상품에는 연간/690,000원 문구가 노출되면 안 된다.
- 결제 API, `src/lib/billing.ts`, app store sync, RevenueCat key 관련 변경은 `npm.cmd run smoke:billing`을 포함한다.
- production 결제 환경변수나 secret 값을 출력하지 않는다.

## 인증과 Supabase 주의사항

- Supabase service role key, access token, refresh token, private key는 절대 커밋하거나 출력하지 않는다.
- Google Identity Services, Firebase, Supabase Google Provider, OAuth consent screen은 같은 ChartRadar 프로젝트 기준으로 맞아야 한다.
- refresh token 저장 정책은 보안 영향이 있으므로 문서와 코드 변경을 분리해서 검토한다.
- admin API는 비로그인 401, 비관리자 403 원칙을 지킨다.

## Android와 Play Console 주의사항

- Android 앱은 `https://chartradar.kr`을 여는 Capacitor WebView 구조다.
- `android/app/google-services.json`은 로컬에는 필요할 수 있지만 Git에는 포함하면 안 된다.
- `versionCode`는 Play Console 업로드 전 기존 업로드보다 높아야 한다.
- AndroidManifest, Firebase, FCM, Google Sign-In 변경은 기존 설치 앱에 자동 반영되지 않는다. 새 APK/AAB 빌드와 Play Console 업로드가 필요하다.
- 자동 AAB 업로드, Play Console 제출, production release는 대표의 명시 지시 없이는 하지 않는다.
- `npm.cmd run app:android:release`는 최종 제출 준비 단계에서만 실행한다.

## 자동화 운영

- `docs/work-queue.md`는 작업 우선순위와 상태를 관리하는 상위 인덱스다.
- `docs/work-items/`는 세부 작업 문서 위치다.
- `docs/automation-runs/active-run.md`는 대표가 지정한 특정 문제 묶음을 순서대로 처리하는 active run 문서다.
- 대표가 `AUTO NEXT`라고 하면 먼저 `docs/automation-runs/active-run.md`가 있는지 확인한다.
- active run에 `TODO`가 있으면 `docs/work-items/`에서 임의 선택하지 말고 active run의 다음 `TODO` 1개만 처리한다.
- active run이 비어 있거나 모든 작업이 `DONE`이면 그때만 `docs/work-items/`에서 다음 후보를 제안한다.
- 대표가 `AUTO PLAN ONLY`라고 하면 active run의 다음 `TODO`에 대한 계획만 보고하고 수정하지 않는다.
- 대표가 `AUTO RUN ACTIVE PLAN`이라고 하면 active run의 `TODO`를 순서대로 처리하되, 한 턴에는 하나의 작업만 처리한다.
- `AUTO NEXT`는 선택 이유, 위험도, 수정 범위, 검증 명령을 먼저 정리한 뒤 진행한다.
- active run 또는 work item 완료 시 해당 항목 상태를 `DONE`으로 갱신할지 보고한다. 같은 커밋에 포함해도 되는 문서 갱신인지 판단한다.
- 고위험 작업은 실행 전 멈추고 대표 승인을 요청한다.
- push는 대표 승인 전 금지한다.
- 필요한 경우 `tools/dev-agent/profiles/`의 역할 프로필을 참고한다.
- 작업 템플릿은 `tools/dev-agent/task-template.md`를 사용한다.
- 결과 보고는 `tools/dev-agent/report-template.md`를 사용한다.
- subagent는 조사, 위험 검토, 테스트 계획, 리뷰에만 사용한다.
- 병렬 수정은 금지한다. 실제 코드 수정은 하나의 main 작업 흐름에서만 한다.

## 검증 명령

작업 성격에 맞게 `package.json` 기준 실제 존재하는 명령을 사용한다. 기본 후보는 아래와 같다.

- 문서만 수정한 경우.
  - `git diff --check`.
  - `git status --short --branch`.
- 일반 앱 코드 수정.
  - `git diff --check`.
  - `cmd /c npx tsc --noEmit`.
  - `npm.cmd run build`.
  - `npm.cmd run smoke:mobile`.
  - `npm.cmd run smoke:all`.
- 운영/크론/푸시/매크로 변경.
  - `npm.cmd run smoke:ops`.
  - 가능하면 `/api/push-cron?dryRun=1&diagnostics=1` 로컬 확인.
  - dryRun에서 실제 발송, DB write, 민감정보 노출이 없는지 확인.
- 결제 변경.
  - `npm.cmd run smoke:billing`.
  - RevenueCat, Toss, Supabase entitlement 경로를 함께 확인.
- Android 변경.
  - `npm.cmd run app:sync`.
  - `npm.cmd run app:android:debug`.
  - release AAB는 대표 지시가 있을 때만 생성한다.

## 완료 보고 형식

작업 완료 시 반드시 아래를 보고한다.

- 선택한 작업.
- 선택 이유.
- 수정 파일.
- 변경 내용.
- 건드리지 않은 고위험 영역.
- 검증 결과.
- 커밋 해시 또는 미커밋 상태.
- `git status --short --branch`.
- push 여부. 대표 승인 전에는 하지 않음.
- 다음 추천 작업.

## 중단 조건

아래 상황에서는 작업을 중단하고 보고한다.

- 작업트리가 dirty이고 기존 변경의 정체가 불명확함.
- local과 `origin/main`이 불일치함.
- 고위험 영역 수정이 필요하지만 대표의 범위 승인이나 계획 확인이 없음.
- production DB migration 필요.
- Android release/AAB 생성 필요.
- 비밀값 파일 또는 민감값 추적 감지.
- 검증 실패 원인이 불명확함.
- 여러 작업이 충돌 가능함.
- 요청 범위 밖의 앱 코드 수정이 필요함.
