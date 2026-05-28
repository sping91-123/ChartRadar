# Full App Boxless Implementation Plan

Date: 2026-05-29

Active run: `full-app-boxless-implementation-run`

## Direction

ChartRadar의 최종 UI 방향은 전 화면을 카드/박스/패널 중심 대시보드가 아니라 full-screen consumer app flow로 전환하는 것이다.

이미 완료된 pilot은 방향 검증으로만 본다. 남은 목표는 `/journal` 하나가 아니라 모든 주요 route에 같은 원칙을 적용하는 것이다.

## Completed Foundation

- Boxless design standards documented.
- `AppSurface` and `PanelCard` variants added with backward compatibility.
- `/news` pilot completed.
- Header/Nav/AppShell pilot completed.
- `/alerts` list pilot completed and merged through PR #1.

## Remaining Page Groups

### 1. Journal

Goal:

- 입력 폼, 저장 대기, 복기 히스토리를 card stack이 아니라 form/list flow로 전환한다.

Known audit:

- `docs/journal-boxless-pilot-audit.md`.

Primary file:

- `src/app/journal/page.tsx`.

Must preserve:

- local journal save/load.
- remote journal Supabase sync.
- auth/session behavior.
- note parsing/data shape.
- `/journal?market=crypto` and `/journal?market=global`.

### 2. Global Radar Body

Goal:

- Global Radar 본문을 독립 레이더로 유지하면서 panel/card-heavy dashboard 느낌을 줄인다.

Primary candidates:

- `src/components/StockRadarApp.tsx`.
- `src/components/global/*`.

Must preserve:

- Global Radar independent product mode.
- API fetch and chart logic.
- Pro/Basic gating.

### 3. Global Assets

Goal:

- 자산 레이더를 list/report/chart 중심으로 정리한다.
- 모바일 340px/360px에서 차트와 controls가 답답하지 않게 한다.

Must preserve:

- chart rendering.
- asset data fetch.
- mobile dock behavior.

### 4. Coin Radar

Goal:

- `/crypto` 본문을 report-style 판단 화면으로 재설계한다.
- 이전 실패한 무작정 flatten 방식은 반복하지 않는다.

Must preserve:

- `/crypto` route.
- `/majors` compatibility/redirect.
- BTC/ETH switching.
- timeframe and mode switching.
- chart rendering.
- `visibleRadarInsightForPlan`.
- RadarInsightPanel judgment logic.
- Basic/Pro gating.

### 5. Alts

Goal:

- 알트코인 레이더의 card grid 중첩을 줄이고 list/report scanning flow로 전환한다.

Must preserve:

- scanner/data logic.
- Pro/Basic gating.
- `/alts` route.

### 6. Pro

Goal:

- Pro 화면의 outer wrapper와 CTA 주변 card 중첩을 줄인다.
- 플랜 비교 자체는 명확하게 유지한다.

Must preserve:

- billing copy that is legally/product-wise approved.
- productId, planId, entitlement.
- RevenueCat and billing API logic.
- plan comparison clarity.

### 7. Learn / Account / Support Routes

Goal:

- 정보성 화면의 unnecessary card wrapper를 줄인다.
- 정책/계정/위험 안내는 명확한 경계를 유지한다.

Must preserve:

- auth/account deletion behavior.
- legal/policy copy.
- route behavior.

### 8. Market Selection / Common Fallbacks / Footer

Goal:

- 시장 선택과 공통 footer/fallback/empty/loading surfaces를 final pass로 정리한다.
- 앱 첫 화면이 full-screen app entry처럼 보이게 한다.

Must preserve:

- Coin Radar and Global Radar equal top-level modes.
- `/crypto` and `/global` entry links.
- route behavior.

## Implementation Rules

- One page group per implementation PR unless the change is docs-only.
- Do not combine visual cleanup with data, auth, billing, push, Android, or DB logic.
- Capture mobile and desktop screenshots for every visual PR.
- Do not merge UI/design PRs before visual review.
- Keep touch targets visible even when removing card wrappers.
- Keep boxes for forms, critical warnings, payment comparison, auth, modals, and destructive actions.

## Current Next Step

Start with `/journal` because:

- It is the active run's first unimplemented surface after alerts.
- It is form/list heavy, so it tests whether boxless rules work beyond read-only report screens.
- It is high risk due to persistence, so implementation should be PR-based and visually reviewed.

## Implementation Notes

### `/journal` boxless pilot

Status: implemented on `codex/journal-boxless-form-list-pilot`.

Applied changes:

- Converted the route-level journal surface from a card-like panel to a flat app flow.
- Converted summary, pending radar, quick form, feedback, and history sections to `report` surfaces.
- Removed nested rounded inset wrappers from metrics, saved radar rows, feedback rows, and history detail rows.
- Changed repeated journal entries from card stack presentation to divider/list rows.
- Kept input, textarea, selected chips, destructive delete, and primary save actions bounded as intentional touch targets.

Unchanged areas:

- Journal save/load behavior.
- Remote journal Supabase sync.
- Auth/session behavior.
- Journal note parsing and data shape.
- `/journal?market=crypto` and `/journal?market=global` route behavior.
- Billing, Android, FCM, and production-related code.

Next recommended page group:

- `/global` body report/list pilot, because it is the next high-impact dashboard-style screen and must preserve Global Radar as an independent product mode.

### `/global` body report/list pilot

Status: implemented on `codex/journal-boxless-form-list-pilot`.

Applied changes:

- Weakened the compact global macro ticker from a card-like strip to a divider row.
- Converted the Global Radar outer `enterprise-panel` shell to a full-width report section.
- Converted the main market conclusion, core pressure rows, thermometer, focus assets, relationship checks, and detail sections toward divider/list/report flow.
- Removed repeated nested rounded card wrappers from mini items, fallback checklist items, event rows, sector rows, leader rows, and news pressure rows.
- Kept CTA, Pro upsell, warning, and status badges bounded where they function as touch targets or critical notices.

Unchanged areas:

- `/global` route behavior.
- Global Radar independent product positioning.
- `/api/stocks/market-board` fetch behavior.
- Pro/Basic gating logic.
- Billing, auth, Supabase, Android, FCM, and production-related code.

Next recommended page group:

- `/global/assets`, because it is the next Global Radar surface and contains chart/control wrappers that still need a careful visual pass.

### `/global/assets` asset radar pilot

Status: implemented on `codex/journal-boxless-form-list-pilot`.

Applied changes:

- Converted the `/global/assets` intro from a rounded card to a divider section.
- Converted the main `StockRadarApp` surface from a card/shadow shell to a report-style full-width chart area.
- Weakened the asset selection, featured assets, saved assets, group filters, and universe buttons toward flat list/button rows.
- Converted checklist, playbook, technical snapshot, ICT, and chart wrappers toward divider/report presentation.
- Reduced the desktop control dock from a floating card to a divider bar while keeping the mobile fixed control dock as the one intentional bottom panel.

Unchanged areas:

- Chart rendering and `lightweight-charts` setup.
- Global asset API fetch and candle data shape.
- Timeframe and radar mode controls.
- Watchlist storage and Pro/Basic gating.
- Billing, auth, Supabase, Android, FCM, and production-related code.

Next recommended page group:

- `/crypto` body redesign first pass, with extra care because a previous broad flatten attempt was backed up and rejected.
