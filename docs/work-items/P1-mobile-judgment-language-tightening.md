# P1 핵심 route 첫 화면 판단 문구 정리

## 상태

- 상태: `DONE`
- 우선순위: `P1`
- 담당방: 모바일 UX / 판단 문구
- 인텔리전스: 높음
- 위험도: 중간
- 관련 route: `/crypto/home`, `/alts`, `/global/assets`, `/news`, `/journal`, `/alerts`
- 관련 Issue:
- 관련 PR:

## 배경

2026-06-11 `AUTO QA SWEEP`에서 Browser 360px급 모바일 viewport로 핵심 route를 확인했습니다.
route 진입은 모두 성공했고 전체 문서 기준 가로 overflow는 감지되지 않았지만, 첫 화면 텍스트에 `매수`, `진입`, `롱`, `숏`, `buy`, `sell`, `long`, `short` 계열 표현이 반복 노출됩니다.

이 표현들은 도메인 용어로 일부 필요하지만, 첫 화면에서 너무 앞에 오면 ChartRadar가 판단 보조 앱이 아니라 거래 지시 앱처럼 읽힐 수 있습니다.

## QA 근거

- `/crypto`와 `/crypto/home`은 `/crypto/home`으로 정상 이동했습니다.
- `/crypto/home` 첫 화면에서 `추격 매수 금지`, `롱/숏 위험`, `진입 대기`, `매수 후보`, `매수가/무효화 알림 저장` 계열 문구가 함께 노출됐습니다.
- `/alts` 첫 화면에서 `알트 롱/숏 위험 결론`, `알트 진입 대기`, `큰 매수/매도 체결` 계열 문구가 반복 노출됐습니다.
- `/global/assets` 첫 화면에서 `buy`, `sell`, `long`, `short`, `롱`, `숏`, `매수` 계열 표현이 감지됐습니다.
- `/news` 첫 화면에서 `위험자산 매수 심리` 문구가 노출됐습니다.
- `/journal` 첫 화면에서 `다음 매매`, `롱`, `숏`, `진입` 계열 입력 문구가 노출됐습니다.
- `/alerts` 첫 화면에서 `매수가/무효화 알림` 문구가 노출됐습니다.

## 목표

- 첫 화면에서 거래 행동보다 조건, 리스크, 무효화, 재확인 기준이 먼저 읽히게 정리합니다.
- `롱/숏` 같은 필요한 도메인 용어는 유지하되, 거래 지시처럼 보이는 문장 구조를 줄입니다.
- Basic 사용자는 현재 상태와 다음 확인 조건을 이해하고, Pro 사용자는 세부 조건과 무효화 기준의 가치를 이해해야 합니다.

## 범위

### 포함

- 첫 화면 헤드라인, badge, CTA, 짧은 설명 문구 정리.
- `/crypto/home`의 판단 순서 문구 정리.
- `/alts`의 위험 결론 문구 정리.
- `/news`, `/journal`, `/alerts`의 거래 행동처럼 읽힐 수 있는 문구 보정.
- 모바일 첫 화면 기준 정보 우선순위 조정.

### 제외

- 신규 기능 추가.
- 데이터 fetch, 판단 엔진, 알림 조건, 저장 로직 변경.
- 결제, 인증, Supabase, Android, iOS, FCM, production 설정 변경.
- Basic/Pro 노출 정책 약화.
- 대규모 디자인 시스템 재작업.

## 예상 수정 파일

- `src/components/coin/CoinRadarHomePanel.tsx`
- `src/components/coin/CoinFuturesBrief.tsx`
- `src/components/RadarNewsPanel.tsx`
- `src/components/RadarAlertCenter.tsx`
- `src/app/journal/page.tsx`
- 필요 시 `/global/assets` 관련 표시 helper 또는 page 파일

## 검증 명령

- `git status --short --branch`
- `git diff --check`
- `cmd /c npx tsc --noEmit`
- `npm.cmd run build`
- `npm.cmd run smoke:mobile`
- `npm.cmd run smoke:all`
- Browser 360px급 viewport에서 `/crypto/home`, `/alts`, `/global/assets`, `/news`, `/journal`, `/alerts` 첫 화면 재확인

## 완료 기준

- 첫 화면 핵심 메시지가 거래 지시보다 판단 조건과 리스크 중심으로 읽힙니다.
- `매수`, `진입`, `buy`, `sell`, `long`, `short` 표현은 필요한 맥락에서만 사용됩니다.
- 모바일 첫 화면의 CTA가 한 번에 이해됩니다.
- Basic/Pro 정책이 약화되지 않습니다.
- 검증 명령 결과를 보고합니다.

## 중단 조건

- 판단 엔진, 가격 계산, 알림 발송, 결제, 인증, Supabase, FCM, native release 수정이 필요해지는 경우.
- 문구 수정만으로 해결되지 않고 화면 구조를 대규모로 바꿔야 하는 경우.
- 기존 데이터 상태나 API 실패가 주 원인으로 확인되는 경우.

## 완료 기록

- 2026-06-11: 핵심 route 첫 화면 문구를 거래 행동보다 조건, 리스크, 무효화, 재확인 기준 중심으로 정리했습니다.
- 수정 범위:
  - `/crypto/home`: `오늘 매수 판단`, `매수 후보`, `진입 대기`, `매수가/무효화` 계열 첫 화면 문구를 `오늘 확인 기준`, `후보 신호`, `관망`, `알림 조건` 중심으로 보정.
  - `/alts`: 선물 브리프의 `진입 대기`, `큰 매수/매도 체결` 반복을 `관망`, `큰 유입·이탈 체결`, `변동성 위험` 중심으로 보정.
  - `/news`: `위험자산 매수 심리` label을 `위험자산 선호 심리`로 보정.
  - `/journal`: 첫 화면 헤드라인과 체크 문구를 `다음 매매`보다 `다음 판단` 중심으로 보정.
  - `/alerts`: `매수가/무효화 알림`을 `기준가/무효화 알림`으로 보정.
  - `/global/assets`: ICT 표시 label의 `롱/숏 OTE`, `Buy-side/Sell-side`를 `상방/하방 OTE`, `상단/하단 유동성`으로 보정.
- 검증:
  - `git diff --check`: PASS
  - `cmd /c npx tsc --noEmit`: PASS
  - `npm.cmd run build`: PASS
  - `npm.cmd run smoke:mobile`: PASS
  - `npm.cmd run smoke:all`: PASS
  - Browser 360px급 viewport: `/crypto/home`, `/alts`, `/global/assets`, `/news`, `/journal`, `/alerts` 재확인 PASS. 이번 P1에서 잡은 첫 화면 문제 표현은 재검출되지 않았고 console error는 없었습니다.
- 남은 리스크:
  - `/global/assets` 자산 선택칩 일부가 오른쪽으로 이어지는 가로 rail 노출 문제는 별도 `P2-global-assets-mobile-chip-rail.md`에 남겼습니다.
- 완료 커밋: 미커밋
- PR:
