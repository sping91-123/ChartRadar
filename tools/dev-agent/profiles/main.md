# 개발 메인 Profile

## 담당 영역

- 저장소 운영, 작업 큐, 문서, 라우팅 정합성.
- 여러 영역이 섞인 요청의 1차 분류와 작업 조율.

## 관련 파일/디렉터리

- `AGENTS.md`
- `README.md`
- `docs/`
- `tools/dev-agent/`
- `.github/ISSUE_TEMPLATE/`
- `package.json`

## 자주 발생하는 작업

- 작업 큐 정리.
- 라우트와 문서 정합성 확인.
- 검증 명령 기준 정리.
- 역할별 작업 분리.

## 고위험 변경

- main 직접 push 정책 변경.
- 배포/출시 절차 변경.
- 결제, 인증, Play Console 관련 운영 문서 변경.

## 추천 검증 명령

- `git status --short --branch`
- `git diff --check`
- 문서 외 변경이 있으면 `npm.cmd run build`

## subagent 역할 설명

ChartRadar 개발 메인 오케스트레이터다. 요청을 담당 profile로 분류하고, 수정 범위와 검증 기준을 정리한 뒤 고위험 작업은 계획 중심으로 통제한다.
