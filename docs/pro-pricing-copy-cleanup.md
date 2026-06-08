# Pro Pricing Copy Cleanup

## Purpose

This document tracks `pro-pricing-copy-cleanup-run`.

The run implements the first candidate selected by `pricing-access-redesign-run`: cleanup of `/pro` pricing copy and CTA wording. The implementation must preserve billing logic, RevenueCat behavior, product ids, plan ids, entitlements, prices, checkout flow, and Basic/Pro gating.

## Source Decision

`pricing-access-redesign-run` selected `/pro` page copy cleanup because it can clarify product value and reduce iOS/App Review wording risk without touching billing or entitlement logic.

Suggested implementation branch:

- `codex/pro-pricing-copy-cleanup`

## Non-Negotiable Guardrails

- Do not edit `src/lib/billing.ts`.
- Do not edit RevenueCat integration or configuration.
- Do not change product ids, plan ids, entitlement names, or prices.
- Do not edit checkout, confirm, app-store sync, grant, or entitlement-resolution logic.
- Do not change Basic/Pro gating behavior.
- Do not push implementation work directly to `main`.
- Do not use investment-advice, guaranteed-return, loss-avoidance, buy/sell, long/short, or specific asset-recommendation wording.

## Task 1 - `/pro` Current Copy Audit

Status: `DONE`

Audit date: 2026-06-08

Audit scope:

- `src/app/pro/page.tsx`
- `src/components/ProPricingPanel.tsx`
- User-facing plan descriptions and highlights currently rendered from `src/lib/billing.ts`
- `/pro`, `/pro?market=crypto`, and `/pro?market=stocks` copy paths
- CTA labels, Basic vs Pro comparison copy, current plan copy, pre-subscription notes, and trust notes

Forbidden during this audit:

- Code edits.
- `src/lib/billing.ts` edits.
- RevenueCat edits.
- Product id, plan id, entitlement, or price edits.
- Checkout, confirm, sync, grant, or Basic/Pro gating edits.

### Current `/pro` Page Copy Structure

`src/app/pro/page.tsx` is a shell only:

- Renders `Header`.
- Renders `RadarTopNav`.
- Normalizes the `market` query into `all`, `crypto`, or `stocks`.
- Passes `marketScope` to `ProPricingPanel`.
- Renders `AppFooter`.

The page shell has no product-value copy beyond the route-level component composition. The actual `/pro` pricing copy lives in `ProPricingPanel`, with plan card descriptions and highlights coming from the billing plan data.

`ProPricingPanel` copy structure:

| Section | Current source | Current role |
| --- | --- | --- |
| Hero/scope copy | `scopeCopy(marketScope)` | Shows Coin Pro, Global Pro, or All Market Pro framing based on `market` query. |
| Top Basic/Pro/All Market summary | Inline copy in `ProPricingPanel` | Explains first-read Basic, Pro detail, and All Market integrated flow. |
| Basic vs Pro cards | `planDepthRows` | Compares Basic, Coin Pro, Global Pro, and All Market Pro depth. |
| Pro unlock cards | `proUnlockItems` | Explains tracking conditions, invalidation, detailed risk, and alert/review connection. |
| Current plan panel | Inline `DataRow` copy | Shows current entitlement label, Coin Pro access, Global Pro access, and Basic browse CTA. |
| Why All Market panel | Inline `DataRow` copy | Explains why combined coin/global context can matter. |
| Available plans | `getBillingPlansForPage()` plus `billingPlans` data | Shows paid plan cards, prices, descriptions, highlights, limits, renewal text, and checkout CTA. |
| Pre-subscription notes | `preSubscriptionNotes` plus `subscriptionTrustNotes` | Warns that Pro is judgment support, not trading advice or a result guarantee. |

### Coin Pro Copy Status

Current positive alignment:

- Uses judgment-support language: "판단 근거", "추적 조건", "무효화 기준", "세부 리스크".
- CTA says "Coin Pro로 코인 상세 판단 열기", which avoids direct buy/sell or long/short instructions.
- Basic vs Pro copy says Coin Pro opens coin home, spot, major futures, alt futures tracking conditions and invalidation criteria.

Current cleanup candidates:

- "코인 상세 판단" can still sound broad; Task 2 should prefer "코인 판단 근거" or "코인 기준과 리스크" to match the redesign document.
- Plan description from `billingPlans` says "알트 기회와 위험 필터". The word "기회" is not a direct recommendation, but it can read more opportunity-seeking than risk/criteria focused.
- Annual highlight "BTC/ETH·알트 리스크 반복 점검" is safer than monthly "알트 기회와 위험 필터"; align monthly and annual descriptions around criteria, risk, invalidation, and repeated checks.

### Global Pro Copy Status

Current positive alignment:

- Focuses on "미국장 30초 체크", "지수선물", "매크로 압력", "이벤트 리스크", "섹터 로테이션", and "대장주 레이더".
- CTA says "Global Pro로 미국장 상세 판단 열기", which is not an entry instruction.
- The route-specific hero text explains Global Pro as deeper macro/asset context.

Current cleanup candidates:

- "미국장 상세 판단" should be softened toward "미국장 판단 근거" or "글로벌 리스크 맥락" so it reads less final-decision-like.
- Global Pro currently explains data breadth well, but the standalone value could be clearer as daily workflow: risk axis, assets to watch, event context, and follow-up checks.
- Annual copy emphasizes a lower monthly equivalent. Price-value copy is allowed, but Task 2 should keep product value ahead of discount framing.

### All Market Pro Copy Status

Current positive alignment:

- The panel includes a dedicated "WHY ALL MARKET" section.
- Current copy explains that coin and U.S. market risk can be checked together.
- The bundle CTA says "All Market Pro로 전체 시장 판단 열기", not a return or signal claim.

Current cleanup candidates:

- Current plan descriptions still lean on "Coin Pro + Global Pro 통합" and "전체 시장 판단" more than a unique cross-market workflow.
- The phrase "전체 시장 판단" can sound too broad; Task 2 should use "코인·글로벌 리스크 비교", "혼합 알림", or "통합 복기" where possible.
- All Market Pro should read less like the widest access tier and more like a combined workflow: cross-market risk context, mixed alert coverage, and unified review.

### Basic vs Pro Copy Status

Current positive alignment:

- Basic is described as first-read and useful, not broken.
- Pro is described as deeper context behind the first read.
- Copy avoids fear-based "you are unsafe without Pro" language.

Current cleanup candidates:

- Basic plan description from `billingPlans` says "방향 요약만 제공합니다". "만" can make Basic feel intentionally thin. Prefer "방향 요약과 핵심 리스크를 먼저 제공합니다" if Task 2 touches billing-plan copy.
- "Pro는 그 판단이 왜 나왔는지" is aligned with evidence depth, but should keep user agency clear: Pro opens context; it does not make the final decision.

### CTA Copy Status

Current CTA labels:

| Context | Current label | Audit note |
| --- | --- | --- |
| Native checkout unavailable | "Android 앱에서 결제 가능" | Safe and factual. |
| Coin Pro checkout | "Coin Pro로 코인 상세 판단 열기" | Safe, but can be more criteria/risk focused. |
| Global Pro checkout | "Global Pro로 미국장 상세 판단 열기" | Safe, but "판단" can be softened. |
| All Market Pro checkout | "All Market Pro로 전체 시장 판단 열기" | Safe, but too broad and less bundle-workflow specific. |
| Basic browse | "Basic으로 먼저 둘러보기" | Safe and calm. |
| Restore subscription | "구독 권한 불러오기" | Safe and factual. |

CTA cleanup target:

- Prefer "근거 보기", "리스크 맥락 보기", "조건 확인", "알림 조건 확장", and "복기 연결" over "상세 판단 열기" or "전체 시장 판단 열기".

### Current Plan And Pre-Subscription Copy Status

Current positive alignment:

- Login and entitlement status copy is factual.
- Pre-subscription notes explicitly say Pro is not a specific trading recommendation.
- Notes say detailed risk is shown but results are not guaranteed.
- Notes say final judgment and responsibility belong to the user.

Current cleanup candidates:

- Keep these guardrails in Task 2; do not remove them while simplifying the page.
- If copy is shortened, preserve the "not trading advice / no guarantee / final judgment by user" meaning.

### iOS And App Review Risk Candidates

No direct high-risk wording was found such as:

- "buy signal"
- "sell signal"
- "long entry"
- "short entry"
- "guaranteed profit"
- "avoid losses"
- "best coin to buy"
- "investment advice"

Lower-risk wording to refine before iOS:

- "알트 기회와 위험 필터" because "기회" can sound opportunity/recommendation-oriented.
- "전체 시장 판단" because it can overstate scope and finality.
- "상세 판단 열기" because repeated use of "판단" can read stronger than "근거/조건/리스크 확인".
- "방향 요약만 제공합니다" because it may make Basic feel too limited rather than useful.

### Mismatches Against `pricing-access-redesign-run`

| Pricing-access standard | Current mismatch | Task 2 direction |
| --- | --- | --- |
| Pro should emphasize evidence, risk, invalidation, alert conditions, and review. | Some plan card copy still emphasizes "상세 판단" and "전체 시장 판단". | Reframe around "근거", "조건", "리스크", "알림", and "복기". |
| All Market Pro should be a cross-market workflow bundle. | Current plan data says "Coin Pro + Global Pro 통합" and "전체 시장 판단" more than mixed workflow. | Make bundle copy mention cross-market risk comparison, mixed alerts, and unified review. |
| Basic should remain useful and calm. | "방향 요약만" can feel dismissive. | Keep Basic as first-read plus core risk, not a weak teaser. |
| Avoid asset recommendation tone. | "알트 기회" can be read as opportunity-seeking. | Use "알트 조건", "알트 리스크", or "알트 추적 기준". |
| Keep iOS/App Review posture conservative. | Most guardrails are present, but plan-card wording can be more neutral. | Preserve pre-subscription notes and replace broad/ambitious phrases. |

### Task 2 Implementation Candidates

Task 2 should consider only presentation copy and plan-card copy needed for `/pro` display:

1. Replace checkout CTA labels with criteria/risk/workflow language.
2. Reword Coin Pro plan descriptions/highlights away from "기회" and toward conditions, risk, invalidation, repeated checks, and alerts.
3. Reword Global Pro descriptions toward macro/asset/event context and follow-up checks.
4. Reword All Market Pro descriptions/highlights toward cross-market risk comparison, mixed alerts, and unified review.
5. Reword Basic description from "요약만" to useful first-read language.
6. Preserve pre-subscription notes and trust notes.
7. Keep existing plan ids, product ids, prices, billing amounts, entitlement behavior, checkout flow, and gating unchanged.

### Absolute No-Touch Scope

- `src/lib/billing.ts` identifiers and logic:
  - plan ids
  - product ids
  - base plan ids
  - entitlement names
  - prices and billing amounts
  - entitlement resolution helpers
- RevenueCat integration and configuration.
- `src/lib/mobilePurchases.ts`.
- `/api/billing/checkout`.
- `/api/billing/confirm`.
- `/api/billing/app-store/sync`.
- subscription grant or restore behavior.
- Basic/Pro gating rules.
- route behavior outside `/pro`.

## Task 2 - `/pro` Pricing Copy Cleanup

Status: `TODO`

Expected output:

- Basic Radar wording stays useful and calm.
- Coin Pro wording emphasizes crypto criteria, risk context, alerts, repeated checks, and review continuity.
- Global Pro wording emphasizes macro, asset, event, and global-market context.
- All Market Pro wording emphasizes cross-market workflow, mixed alerts, and unified review.
- CTA wording uses judgment-support language: criteria, risk, invalidation, alert conditions, review.
- Existing billing and entitlement behavior is preserved.

Required verification:

- `git diff --check`
- `cmd /c npx tsc --noEmit`
- `npm.cmd run build`
- `npm.cmd run smoke:billing`
- `npm.cmd run smoke:mobile`
- `npm.cmd run smoke:all`
- `/pro` 360px screenshot
- `/pro` desktop screenshot

## Task 3 - Result Documentation

Status: `TODO`

Expected output:

- Summary of `/pro` copy changes.
- Confirmation of preserved billing/product/entitlement scope.
- Screenshot review notes.
- Remaining pricing/access candidates:
  - Coin Radar home Basic/Pro exposure cleanup.
  - Alerts Pro gating/CTA cleanup.
  - Global Pro placement/CTA adjustment.
  - All Market Pro cross-market workflow follow-up.
