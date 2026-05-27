# Active Automation Run

## Run Title

- 현재 등록된 active run 없음.

## 목적

- 대표가 특정 문제 묶음을 순서대로 자동 처리하도록 지정하는 공간입니다.
- 작업 묶음이 없으면 Codex는 이 문서를 비어 있는 active run으로 취급하고 `docs/work-items/`에서 다음 후보를 제안합니다.

## 시작 조건

- 대표가 이 문서에 작업 묶음을 등록합니다.
- 작업 목록에 `TODO` 상태 항목이 1개 이상 있어야 합니다.
- 작업 전 `git status --short --branch`와 `git rev-list --left-right --count HEAD...origin/main`이 정상이어야 합니다.

## 중단 조건

- 작업트리가 dirty이고 기존 변경의 정체가 불명확함.
- local과 `origin/main`이 불일치함.
- 작업이 고위험 영역에 닿지만 대표의 명시 승인이 없음.
- production DB migration, AAB 생성, Play Console 업로드, deploy가 필요함.
- 비밀값 파일 또는 민감값 추적이 감지됨.
- 검증 실패 원인이 불명확함.
- 같은 턴에 여러 작업을 처리해야만 하는 상태임.

## 작업 목록

| 순서 | 상태 | 작업 | 담당 영역 | 위험도 | 검증 명령 |
| --- | --- | --- | --- | --- | --- |
| - | DONE | 등록된 작업 없음 | 개발 메인 | LOW | `git status --short --branch`, `git diff --check` |

## 상태 값

- `TODO`: 아직 착수하지 않은 작업.
- `IN_PROGRESS`: 현재 처리 중인 작업.
- `DONE`: 검증과 커밋까지 완료한 작업.
- `BLOCKED`: 대표 확인, 외부 권한, 운영 데이터, 고위험 승인 등이 필요해 멈춘 작업.

## 위험도

- `LOW`: 문서, 작은 구조 정리, 앱 동작 영향이 낮은 변경.
- `MEDIUM`: 앱 코드 또는 사용자 흐름에 영향을 줄 수 있으나 고위험 영역은 아닌 변경.
- `HIGH`: 결제, 인증, Supabase, Android release, Play Console, FCM, production DB, 비밀값과 관련된 변경.

## 완료 보고 형식

- 선택한 active run 작업.
- 선택 이유.
- 수정 파일.
- 변경 내용.
- 건드리지 않은 고위험 영역.
- 검증 결과.
- active run 상태 갱신 여부.
- 커밋 해시 또는 미커밋 상태.
- `git status --short --branch`.
- push 여부. 대표 승인 전에는 하지 않음.
- 다음 active run 작업 또는 work-items 후보.

## push 정책

- 기본 동작은 commit까지만 진행합니다.
- `git push`는 대표가 명시적으로 요청한 경우에만 실행합니다.
- push 전에는 Git 상태, ahead/behind, 최근 커밋, 비밀값 추적 여부를 확인합니다.
