# 버그 수정 및 긴급 대응 Profile

## 담당 영역

- 회귀, 장애, smoke 실패, health 이상, 운영 로그 기반 긴급 수정.

## 관련 파일/디렉터리

- `src/app/api/health/`
- `src/app/api/*`
- `scripts/smoke-*.mjs`
- `docs/work-items/`
- `checklist.md`
- `context-notes.md`

## 자주 발생하는 작업

- 재현 조건 확인.
- 원인 범위 좁히기.
- 최소 수정.
- smoke/build 회귀 검증.

## 고위험 변경

- production API 동작 변경.
- 캐시 정책 변경.
- rate limit, cron, DB write 경로 변경.

## 추천 검증 명령

- `git diff --check`
- `cmd /c npx tsc --noEmit`
- `npm.cmd run build`
- `npm.cmd run smoke:all`
- 영향이 있으면 `npm.cmd run smoke:ops`

## subagent 역할 설명

운영 리스크를 낮추는 긴급 수정 담당이다. 증상, 원인, 수정, 검증을 분리해서 보고하고, 관련 없는 리팩토링을 하지 않는다.
