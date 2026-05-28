# Automation Runs

이 폴더는 대표가 지정한 특정 문제 묶음을 Codex가 순서대로 처리하기 위한 실행 단위 문서입니다.

## 목적

- `docs/work-items/`는 전체 백로그입니다.
- `docs/automation-runs/active-run.md`는 지금 집중해서 처리할 작업 묶음입니다.
- 대표가 `AUTO NEXT`라고 하면 Codex는 먼저 active run을 확인하고, 남은 `TODO`가 있으면 그중 다음 1개만 처리합니다.
- active run이 없거나 모든 항목이 `DONE`이면 그때만 `docs/work-items/`에서 다음 후보를 제안합니다.

## 운영 원칙

- 한 턴에는 active run의 작업 1개만 처리합니다.
- 고위험 작업은 실행 전 멈추고 대표 승인을 요청합니다.
- push는 대표가 명시적으로 요청한 경우에만 실행합니다.
- 완료 후 active run 상태 갱신이 같은 커밋에 포함 가능한지 판단해 보고합니다.
- 완료된 run은 필요 시 `docs/automation-runs/completed/`로 이동해 보존합니다.

## 방 운영 기준

- 전략실 메인방은 active run 생성, 방향 결정, 우선순위 조정, 결과 검수에 사용합니다.
- active-run 실행방은 하나의 run을 끝낼 때까지 유지합니다. 작업마다 새 방을 만들지 않습니다.
- 고위험 전용방은 결제, 인증, Supabase, Android release, FCM, production migration처럼 별도 승인과 검토가 필요한 작업에 사용합니다.
- 연속성은 채팅방 기억이 아니라 `active-run.md`, completed 기록, GitHub Issue, PR에 남깁니다.

## PR 기반 실행 기준

- active run 안의 조사, 문서 정리, 안전한 운영 문서 작업은 필요 시 `main`에서 커밋할 수 있습니다.
- 앱 코드 구현, UI/디자인 변경, 고위험 영역 변경은 가능하면 branch/PR 단위로 진행합니다.
- 구현 작업은 active run에서 다음 작업을 선정한 뒤 Issue 또는 작업 문서 기준으로 브랜치를 만들고 PR로 검수합니다.
- UI/디자인 작업은 스크린샷 확인 전 push 또는 merge하지 않습니다.
- 결제, 인증, Supabase, Android, FCM, production 관련 작업은 자동 push하지 않습니다.
- PR 본문에는 변경 요약, 검증 결과, 스크린샷 또는 확인 범위, 남은 리스크를 남깁니다.
