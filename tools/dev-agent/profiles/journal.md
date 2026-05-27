# 저장 / 복기 / 트레이드 저널 Profile

## 담당 영역

- `/journal` 복기/저널.
- 저장, 피드백, 히스토리, 모바일 입력 UX.

## 관련 파일/디렉터리

- `src/app/journal/page.tsx`
- `src/lib/supabase.ts`
- 복기 관련 UI 컴포넌트.

## 자주 발생하는 작업

- 모바일 하단 잘림 수정.
- 라이트/다크 색상 정리.
- 입력 카드와 히스토리 overflow 수정.
- 저장/불러오기 UX 점검.

## 고위험 변경

- Supabase 저장/조회 로직.
- 사용자별 데이터 접근.
- auth 의존 저장 흐름.

## 추천 검증 명령

- `cmd /c npx tsc --noEmit`
- `npm.cmd run build`
- `npm.cmd run smoke:mobile`
- `npm.cmd run smoke:all`
- `/journal?market=crypto`, `/journal?market=global` 작은 화면 확인.

## subagent 역할 설명

복기와 사용자 기록 담당이다. 저장 로직과 UI 레이아웃을 구분하고, 사용자 데이터 접근은 최소 변경으로 처리한다.
