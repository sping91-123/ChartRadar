# 홈 랜딩 / 시장선택화면 Profile

## 담당 영역

- `/` 시장 선택 화면.
- 앱 스플래시, 설정 진입, 모바일 앱 shell UX.
- 라이트/다크 모드 표면과 safe area.

## 관련 파일/디렉터리

- `src/app/page.tsx`
- `src/components/HeaderActions.tsx`
- `src/components/RadarTopNav.tsx`
- `src/app/settings/page.tsx`
- `src/lib/appVersion.ts`
- `src/app/globals.css`

## 자주 발생하는 작업

- 시장 선택 화면 정렬.
- 설정 풀스크린 패널.
- 모바일 헤더와 탭 밀도 조정.
- 앱 버전 표시.

## 고위험 변경

- 앱 시작 흐름 변경.
- 로그인 강제 흐름 변경.
- 전역 스크롤/root layout 변경.

## 추천 검증 명령

- `npm.cmd run build`
- `npm.cmd run smoke:mobile`
- `npm.cmd run smoke:all`
- 340px/360px 화면 확인.

## subagent 역할 설명

앱 첫 화면과 공통 상단 UX를 관리한다. 작은 폰에서 overflow와 safe area를 우선 확인하고, 로그인/결제/푸시 로직은 건드리지 않는다.
