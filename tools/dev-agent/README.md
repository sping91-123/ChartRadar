# ChartRadar Dev Agent

개발 메인 방에서 하나의 요청을 받아 역할별 subagent/task로 분기하기 위한 운영 문서입니다.

## 사용 흐름

1. 요청을 받으면 `AGENTS.md`를 먼저 확인한다.
2. 요청의 담당 영역을 `profiles/` 중 하나 이상으로 분류한다.
3. 고위험 영역인지 판단한다.
4. `task-template.md` 기준으로 작업 계획, 수정 범위, 검증 명령, 위험도를 정리한다.
5. 앱 코드 수정 전 기존 구조와 관련 파일을 확인한다.
6. 작업 완료 후 `report-template.md` 기준으로 결과를 보고한다.

## 라우팅 기준

| 요청 성격 | 우선 profile |
| --- | --- |
| 저장소 운영, 문서, 작업 큐, 라우팅 정합성 | `main.md` |
| 장애, 회귀, 긴급 수정, health, smoke 실패 | `bugfix.md` |
| 홈, 시장 선택, 설정 진입, 모바일 shell UX | `home.md` |
| 판단 모델, RadarInsight, 조건/리스크 구조 | `radar-engine.md` |
| `/crypto`, BTC/ETH, LiveMarketChart | `crypto.md` |
| `/alts`, 알트 스캐너, 알트 UI | `alts.md` |
| `/global`, `/global/assets`, 글로벌 자산 | `global.md` |
| 관리자 권한, 운영 백오피스, entitlement 보정 | `admin.md` |
| Pro, RevenueCat, 결제, entitlement | `billing.md` |
| 로그인, 세션, Google OAuth, 계정 삭제 | `auth.md` |
| FCM, push cron, 알림 설정, 테스트 푸시 | `push.md` |
| `/journal`, 복기, 저장, 피드백 | `journal.md` |
| `/news`, macro calendar, market news | `news.md` |
| Android release, AAB, Play Console | `release.md` |
| 코털스 생존진단 MVP | `coters-survival.md` |

## 고위험 기본값

다음 영역은 항상 고위험으로 분류한다.

- 결제, RevenueCat, planId, entitlement.
- 인증, Supabase session, refresh token, Google OAuth.
- production DB migration, Supabase service role.
- Android release, AAB, Play Console.
- 자동 푸시 발송, FCM token, push cron.

## 금지 사항

- 자동 push 금지.
- 자동 deploy 금지.
- production DB migration 실행 금지.
- AAB 업로드 금지.
- 비밀값 출력 또는 커밋 금지.
