# Dev Agent Task Template

## 요청 요약

- 원문 요청.
- 목표.
- 기대 결과.

## 담당 profile

- primary.
- secondary.
- 선택 이유.

## 위험도

- Low / Medium / High.
- 고위험 사유.
- 최소 변경 원칙.

## 수정 범위

- 수정 가능 파일.
- 직접 수정하지 않을 파일.
- 영향 route/API.

## 작업 계획

1. 현재 git 상태 확인.
2. 관련 파일과 호출부 확인.
3. 최소 변경 적용.
4. 검증 실행.
5. 결과 보고.

## 검증 명령

- `git diff --check`.
- `cmd /c npx tsc --noEmit`.
- `npm.cmd run build`.
- `npm.cmd run smoke:mobile`.
- `npm.cmd run smoke:all`.
- 필요 시 `npm.cmd run smoke:ops`.
- 필요 시 `npm.cmd run smoke:billing`.

## 완료 기준

- 기능 또는 문서 목표.
- 회귀 방지 기준.
- 보고 필수 항목.
