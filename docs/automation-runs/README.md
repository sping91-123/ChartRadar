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
