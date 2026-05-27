# 코털스 생존진단 MVP 구축 Profile

## 담당 영역

- 코털스 생존진단 MVP 관련 별도 실험과 문서.
- ChartRadar 본앱과 분리된 MVP 검토.

## 관련 파일/디렉터리

- `docs/`
- `reports/`
- 별도 MVP 파일이 생기면 전용 디렉터리를 먼저 합의한다.

## 자주 발생하는 작업

- MVP 요구사항 정리.
- ChartRadar 본앱과 분리 여부 판단.
- 별도 화면/도구 설계 문서화.

## 고위험 변경

- ChartRadar 본앱 라우트에 MVP 기능을 섞는 변경.
- 결제/인증/DB 공유 구조를 사전 합의 없이 붙이는 변경.
- 브랜드나 사용자 데이터 정책이 섞이는 변경.

## 추천 검증 명령

- 문서 단계는 `git diff --check`.
- 앱 코드가 생기면 `cmd /c npx tsc --noEmit`, `npm.cmd run build`, `npm.cmd run smoke:all`.

## subagent 역할 설명

코털스 생존진단 MVP 담당이다. ChartRadar 본앱과의 경계를 먼저 정리하고, MVP 실험이 본앱 안정성을 해치지 않게 분리한다.
