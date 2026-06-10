# P2 글로벌 자산 선택칩 모바일 노출 정리

## 상태

- 상태: `TODO`
- 우선순위: `P2`
- 담당방: `/global/assets` 자산레이더
- 인텔리전스: 중간
- 위험도: 낮음~중간
- 관련 route: `/global/assets`
- 관련 Issue:
- 관련 PR:

## 배경

2026-06-11 `AUTO QA SWEEP`에서 Browser 360px급 모바일 viewport로 `/global/assets`를 확인했습니다.
route 진입은 성공했고 전체 문서 기준 가로 overflow는 감지되지 않았지만, 첫 화면 자산 선택칩 일부가 오른쪽 viewport 밖에 위치했습니다.

관찰된 예시는 `NVDA`, `SMH` 등 자산 버튼이 x 좌표 385px 이상에 배치되는 상태입니다. 이 동작이 의도된 가로 스크롤 rail일 수는 있지만, 첫 화면에서는 더 볼 수 있다는 단서가 약합니다.

## 목표

- 모바일 첫 화면에서 자산 선택 영역이 잘린 UI처럼 보이지 않게 정리합니다.
- 가로 스크롤을 유지한다면 스크롤 가능성이 자연스럽게 드러나야 합니다.
- 자산 선택과 현재 선택 자산의 판단 메시지가 서로 경쟁하지 않도록 우선순위를 정리합니다.

## 범위

### 포함

- `/global/assets` 자산 선택칩 rail의 모바일 배치, wrapping, scroll hint, spacing 점검.
- 360px급 viewport에서 버튼이 화면 밖에 걸쳐 보이는 상태 개선.
- 현재 선택 자산의 핵심 판단 메시지와 자산 선택 UI의 위계 조정.

### 제외

- 글로벌 자산 목록 변경.
- 가격/차트/분석 계산 로직 변경.
- Pro gating, auth, Supabase, Android, iOS, production 설정 변경.
- `StockRadarApp` 대규모 리팩터링.

## 예상 수정 파일

- `src/app/global/assets/page.tsx`
- `src/components/global/GlobalAssetSelectionPanel.tsx`
- 필요 시 `src/components/global/stockRadarConfig.ts`

## 검증 명령

- `git status --short --branch`
- `git diff --check`
- `cmd /c npx tsc --noEmit`
- `npm.cmd run build`
- `npm.cmd run smoke:mobile`
- `npm.cmd run smoke:all`
- Browser 360px급 viewport에서 `/global/assets` 첫 화면 재확인

## 완료 기준

- `/global/assets` 첫 화면에서 자산 선택 영역이 깨진 UI처럼 보이지 않습니다.
- 360px급 viewport에서 문서 전체 가로 overflow가 없습니다.
- 자산 선택 UI가 현재 선택 자산 판단 메시지를 밀어내지 않습니다.
- 기능 로직과 Pro 정책이 유지됩니다.

## 중단 조건

- 자산 데이터 구조나 분석 로직 변경이 필요해지는 경우.
- 고위험 영역 수정이 필요해지는 경우.
- 모바일 레이아웃 수정이 데스크톱 자산 선택 UX를 크게 훼손하는 경우.

## 완료 기록

- 완료 커밋:
- PR:
