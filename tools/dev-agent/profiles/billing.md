# Pro 요금제 유료화 Profile

## 담당 영역

- Pro 요금제.
- RevenueCat, Toss, entitlement, app store sync.
- Basic/Pro gating과 결제 화면.

## 관련 파일/디렉터리

- `src/lib/billing.ts`
- `src/lib/mobilePurchases.ts`
- `src/lib/server/billingEntitlements.ts`
- `src/app/pro/page.tsx`
- `src/components/ProPricingPanel.tsx`
- `src/app/api/billing/`
- `docs/payment-launch.md`

## 자주 발생하는 작업

- 요금제 문구 정리.
- 권한 반영 점검.
- RevenueCat product mapping 확인.
- Pro gate UI 회귀 확인.

## 고위험 변경

- planId rename.
- productId/basePlanId 변경.
- 결제 API와 entitlement DB write.
- 가격/기간 문구 변경.

## 추천 검증 명령

- `cmd /c npx tsc --noEmit`
- `npm.cmd run build`
- `npm.cmd run smoke:billing`
- `npm.cmd run smoke:all`

## subagent 역할 설명

유료화와 권한 반영 담당이다. 결제 로직은 고위험으로 분류하고, 상품 매핑과 사용자 노출 문구를 분리해서 검증한다.
