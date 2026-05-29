# P1 디자인 시스템 2차 적용

- 상태: `DONE`
- 담당방: UI 디자인 시스템 / 브랜드 리뉴얼
- 인텔리전스: 높음
- 우선순위: P1

## 목표

이미 추가된 `DesignPrimitives`와 UI token을 기반으로 남은 화면에 단계적으로 적용합니다. AI스럽게 보이는 과한 glow, gradient, badge, 반복 카드 사용을 줄이고 공통 컴포넌트 사용을 늘립니다.

## 범위

후속 적용 후보:

- `/alerts`
- `/news`
- `/journal`
- `/pro`
- `/learn`
- 남은 공통 섹션/카드/배지 영역

이미 완료된 화면은 다시 대규모로 갈아엎지 않습니다.

## 완료 기록

- `full-app-boxless-implementation-run`에서 시장 선택, `/crypto`, `/alts`, `/global`, `/global/assets`, `/news`, `/alerts`, `/journal`, `/learn`, `/pro`, account/settings/support성 화면의 boxless 적용과 QA를 완료했습니다.
- `401e37f Flatten app brand and splash assets`에서 앱 브랜드 아이콘, splash, offline shell까지 그라데이션/AI 느낌을 줄이는 방향으로 정리했습니다.
- 남은 UI 수정은 이 문서를 계속 진행하기보다 새 구체 작업으로 분리합니다.

## 완료 기준

- 공통 primitive 사용 비율이 늘어납니다.
- 라이트/다크 모드에서 정보 위계가 안정적으로 유지됩니다.
- 340px~360px 모바일에서 가로 overflow가 없어야 합니다.
- 기능 로직, 결제, 로그인, 푸시, 레이더 계산 로직은 변경하지 않습니다.

## 검증 기준

- `git diff --check`
- `cmd /c npx tsc --noEmit`
- `npm.cmd run build`
- `npm.cmd run smoke:mobile`
- `npm.cmd run smoke:all`
