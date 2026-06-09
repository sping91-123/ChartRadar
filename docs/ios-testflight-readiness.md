# iOS TestFlight Readiness

## Scope Status

- Active run: `ios-testflight-readiness-run`
- Setup date: 2026-06-09
- Run type: readiness audit, checklist planning, and follow-up candidate selection only.
- This is not an iOS production release, native build, TestFlight upload, or App Store submission run.

## Completed Prior Work Reflected

| Prior run | Status |
| --- | --- |
| `android-production-auto-smoke-run` | `DONE / PASS` |
| `alert-quality-operations-run` | `DONE` |
| `alert-pro-rule-ui-clarity-run` | `DONE` |
| `settings-account-polish-run` | `DONE` |
| `settings-support-links-polish-run` | `DONE` |

## Purpose

- Determine whether ChartRadar is ready to start iOS TestFlight build work.
- Identify missing platform, signing, App Store Connect, auth-review, subscription, and checklist items before any iOS build/upload attempt.
- Keep all findings as documentation until a separate implementation or build run is explicitly opened.

## Operating Rules

- Use source and document inspection only unless a task explicitly allows a non-mutating read/check command.
- Do not add the iOS Capacitor platform.
- Do not run iOS sync, build, archive, signing, upload, or TestFlight submission commands.
- Do not change Apple Developer, App Store Connect, RevenueCat, Supabase, billing, entitlement, auth, Android release, iOS native, product ID, plan ID, price, or production settings.
- Do not implement Sign in with Apple during this run.
- If current Apple policy needs to be cited, use official Apple sources and record the date checked.

## Readiness Surfaces To Inspect Later

These are future TODO inspection targets, not approval to change them.

| Surface | Why it matters | Guardrail |
| --- | --- | --- |
| Capacitor config | Determines app ID, app name, webDir, plugins, and platform expectations. | Inspect only; no native/platform changes. |
| iOS directory | Determines whether the native iOS platform already exists. | Do not create or sync iOS platform. |
| Bundle identifier | Required for Apple Developer and App Store Connect registration. | Document candidate only; do not register. |
| package scripts | Shows whether iOS commands already exist. | No script edits. |
| Apple Developer/App Store Connect metadata | Needed before TestFlight upload and review. | No console changes. |
| Sign in with Apple policy | Google login may affect iOS review requirements. | No auth/Supabase implementation. Verify official policy in TODO 3. |
| RevenueCat/App Store products | iOS subscriptions need product and entitlement mapping. | No RevenueCat/App Store Connect/billing changes. |
| TestFlight build checklist | Prevents premature native build/upload attempts. | No build/upload in this run. |

## Task Plan

| Order | Status | Task | Main question | Expected output |
| --- | --- | --- | --- | --- |
| 1 | TODO | Capacitor iOS readiness audit | Is the repo structurally ready for iOS platform/build work? | Capacitor/iOS status map and missing native setup notes. |
| 2 | TODO | Apple Developer submission requirement review | What App Store Connect and listing material must be ready before TestFlight? | Apple/TestFlight metadata checklist. |
| 3 | TODO | Sign in with Apple requirement risk review | Does Google login create an Apple sign-in review requirement risk? | Policy risk summary and auth/Supabase impact notes. |
| 4 | TODO | RevenueCat Apple product mapping review | What iOS subscription mapping must exist before paid iOS TestFlight/review? | RevenueCat/App Store product mapping checklist. |
| 5 | TODO | TestFlight first-build checklist | What must be verified before first iOS build/upload? | Pre-build and upload-readiness checklist. |
| 6 | TODO | Select first iOS readiness follow-up run | What is the first practical next run after audit? | One follow-up candidate, no auto-creation. |

## High-Risk Separation

| Area | Status in this run |
| --- | --- |
| iOS platform/native files | Protected; inspect status only. |
| iOS build/archive/upload | Prohibited. |
| Apple Developer/App Store Connect | No external console changes. |
| Sign in with Apple | Policy/readiness audit only; no implementation. |
| Auth/Supabase | Protected; no code or config edits. |
| Billing/RevenueCat/entitlement | Protected; mapping audit only. |
| Android release | Protected; no Android edits. |
| Production DB/config | Protected; no query or mutation. |

## Follow-Up Candidate Examples

| Candidate | When it should be selected |
| --- | --- |
| `ios-capacitor-platform-setup-run` | iOS native platform is missing or Capacitor iOS setup is the first build blocker. |
| `ios-auth-apple-signin-risk-run` | Apple sign-in policy creates a likely review blocker. |
| `ios-revenuecat-product-mapping-run` | Subscription/product mapping is the biggest TestFlight/review blocker. |
| `ios-store-listing-assets-run` | Metadata/screenshots/privacy/support assets are the biggest missing item. |
| `ios-testflight-build-run` | Readiness blockers are resolved and first native build/upload is the next step. |

## Result Recording Format

Use this format as each TODO completes.

| Field | Value |
| --- | --- |
| Task | `TBD` |
| Status | `TODO` / `DONE` / `BLOCKED` |
| Method | `TBD` |
| Scope inspected | `TBD` |
| Finding summary | `TBD` |
| High-risk area implicated? | `No` / iOS native / Apple Developer / App Store Connect / auth / Supabase / RevenueCat / billing / Android release |
| Recommended follow-up | `TBD` |
| Implementation allowed in this run? | `No` |

## Final Conclusion

This run is registered. The next task is `1. Capacitor iOS readiness audit`, and no iOS platform, build, upload, external console, auth, billing, RevenueCat, Supabase, Android, or production configuration work has been authorized.
