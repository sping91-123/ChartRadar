# P1 홈 판단 UX·분석 코인 개인화 v2

## 상태

- 상태: `DONE`
- 우선순위: `P1`
- 완료일: 2026-08-04
- 담당방: `/crypto/home` UX / Coin Basic·Pro
- 위험도: 중간
- 관련 route: `/crypto/home`, `/api/crypto/home-interest-summary`
- 완료 커밋: 미커밋

## 배경

홈의 매크로 일정은 펼친 뒤에도 중복 정보가 많았고, 15분 차트의 가격대 설명은 최신 캔들을 가렸습니다. 또한 홈 분석이 BTC·ETH에 고정되어 저장한 코인이 분석 대상으로 연결되지 않았고, `확정 전` 문구와 시간대별 문장 반복 때문에 현재 상태를 한눈에 파악하기 어려웠습니다.

## 반영 범위

- 홈 매크로 일정의 중복 아코디언을 제거하고 핵심 일정과 전체 일정 링크만 유지했습니다.
- 홈 15분 차트는 핵심 확인선 1개와 신호 아이콘만 남기고 가격대 설명·영역을 숨겼습니다.
- 저장한 분석 코인을 홈 상단 탭과 실제 분석 데이터에 연결했습니다.
- Basic은 1개를 이 기기에서 하루 1회 변경하고, Coin Pro는 최대 5개를 탭으로 비교합니다.
- Binance BTC·ETH는 기존 정밀 선물 스냅샷을 사용하고, 그 외 거래소·종목은 제한된 홈 요약 API를 사용합니다.
- Basic 응답에서는 원시 분석·점수 분해·Pro 근거를 제외하고, Pro 응답에만 제한된 추가 점수를 포함했습니다.
- 초기 구조가 확인되지 않은 상태를 임의의 상승으로 만들지 않도록 홈 판단 엔진을 v2로 분리했습니다.
- `확정 전` 고정 문구를 현재 근거·가장 큰 위험·다음 확인 조건 중심으로 교체했습니다.
- 15분·1시간·4시간 흐름은 색상 화살표로 압축했습니다.

## 검증

- `npm.cmd run test:perpetual-snapshot`: PASS
- `npm.cmd run test:macro-impact`: PASS
- `npm.cmd run test:home-interest-analysis`: PASS
- `npm.cmd run test:coin-product-contract`: PASS
- `npm.cmd run test:perpetual-briefing`: PASS
- `npm.cmd run test:perpetual-monitors`: PASS
- `npm.cmd run test:futures-brief`: PASS
- `npm.cmd run test:news-reactions`: PASS
- `npm.cmd run smoke:billing`: PASS
- `npm.cmd run smoke:ops`: PASS
- `npm.cmd run smoke:copy`: PASS
- `npm.cmd run smoke:mobile`: PASS
- `npx.cmd tsc --noEmit`: PASS
- `npm.cmd run build`: PASS
- Playwright 360px·390px `/crypto/home`: 가로 overflow 없음, console error 없음
- Playwright Basic SOL 선택 화면: 저장 코인이 홈 분석에 반영되고 차트 설명이 캔들을 가리지 않음

## 남은 운영 확인

- Basic의 하루 1회 제한은 현재 계정 서버가 아니라 기기 localStorage 기준입니다. 계정·기기 간 강제 정책이 필요하면 별도 서버 저장소와 마이그레이션이 필요합니다.
- 기존 `perpetual-v1.0.0` 상태 감시는 오판 방지를 위해 fail-closed 처리했습니다. 2026-08-04 production 사전 집계에서 비만료 활성·일시정지 감시는 모두 0건이었으며, 배포 직전 다시 확인합니다.
- 임의 알트코인의 홈 요약은 선택 종목 자체 데이터를 사용하지만, 상세 알트 화면은 지원 범위 전체를 여는 일반 화면일 수 있어 안내 문구를 함께 표시합니다.
- production 배포와 실도메인 검증은 사용자 승인에 따라 후속 릴리스 단계에서 수행하고 결과를 별도로 기록합니다.
