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
| 1 | DONE | Capacitor iOS readiness audit | Is the repo structurally ready for iOS platform/build work? | Capacitor/iOS status map and missing native setup notes. |
| 2 | DONE | Apple Developer submission requirement review | What App Store Connect and listing material must be ready before TestFlight? | Apple/TestFlight metadata checklist. |
| 3 | TODO | Sign in with Apple requirement risk review | Does Google login create an Apple sign-in review requirement risk? | Policy risk summary and auth/Supabase impact notes. |
| 4 | TODO | RevenueCat Apple product mapping review | What iOS subscription mapping must exist before paid iOS TestFlight/review? | RevenueCat/App Store product mapping checklist. |
| 5 | TODO | TestFlight first-build checklist | What must be verified before first iOS build/upload? | Pre-build and upload-readiness checklist. |
| 6 | TODO | Select first iOS readiness follow-up run | What is the first practical next run after audit? | One follow-up candidate, no auto-creation. |

## Task 1 - Capacitor iOS Readiness Audit

| Field | Value |
| --- | --- |
| Status | `DONE` |
| Completed date | 2026-06-09 |
| Method | Source inspection only. No iOS platform add, Capacitor sync, iOS build, Xcode open, pod install, archive, upload, external console, native edit, package/script edit, auth, Supabase, billing, RevenueCat, Android, or production action was executed. |
| Implementation allowed in this run? | `No` |

### Checked Files And Paths

| Path or check | Current state | Readiness implication |
| --- | --- | --- |
| `capacitor.config.ts` | Present. Defines `appId`, `appName`, `webDir`, optional `server`, Android options, and `PushNotifications` presentation options. | Common Capacitor config exists, but there is no iOS-specific config block. |
| `package.json` | Present. Has Capacitor CLI/core, Android scripts, smoke scripts, and mobile plugin dependencies. | No iOS add/sync/open/build script is currently defined. |
| `package-lock.json` search | No `@capacitor/ios` package reference was found. | The iOS Capacitor platform dependency appears absent. |
| Repository root `ios/` check | `ios/` directory is missing. | Native iOS platform has not been added in this checkout. |
| Native iOS file search | No `Podfile`, `Info.plist`, `AppDelegate`, `SceneDelegate`, `.xcodeproj`, `.xcworkspace`, `GoogleService-Info.plist`, or `.entitlements` file was found. | There is no native iOS project, signing target, plist, pod setup, Firebase plist, or entitlement file to build/upload yet. |
| `android/app/build.gradle` | Android `namespace` and `applicationId` are `com.staronlabs.chartradar`; Android version is `11 / 1.0.8`. | Confirms the Android package currently matches the Capacitor appId, useful for iOS Bundle ID candidate consistency. |
| `android/app/src/main/res/values/strings.xml` | Android app name and title are `Chart Radar`; package string is `com.staronlabs.chartradar`. | Confirms current display-name convention. Android file was read only. |
| `.env.example` | Contains placeholders for Google OAuth, RevenueCat Android/iOS public keys, RevenueCat REST credential, mobile server URL, and Firebase credentials. | iOS billing and Firebase setup will require environment planning, but actual values were not inspected. |
| `src/lib/mobilePurchases.ts` | Native purchase platform type includes `android` and `ios`; RevenueCat key selection branches by platform. | Code has an iOS-capable branch, but platform/products/native configuration remain unproven. |
| `src/lib/nativeGoogleSignIn.ts` | Native Google Sign-In helper is Android-specific. | iOS auth behavior needs separate review; Sign in with Apple risk remains TODO 3. |
| `src/lib/appPush.ts` | App push client state and support checks are Android-specific. | iOS push readiness is not implemented/proven on the client side. |
| `src/app/api/push-tokens/route.ts` | API type allows `android`, `ios`, or `web` platform values. | Server-side type can accept iOS platform, but native iOS token registration is absent. |
| `src/app/api/billing/app-store/sync/route.ts` | Sync request accepts `android` or `ios`; RevenueCat subscriber state maps active products to billing plans. | Server sync path is platform-aware, but iOS product catalog and RevenueCat mapping remain unverified. |
| `src/lib/server/healthStatus.ts` | Detailed health status distinguishes Android and iOS app billing readiness. | Launch diagnostics can represent iOS billing readiness, but no live environment values were read. |
| `docs/app-store-release.md` | Existing App Store/Google Play preparation document exists. | Useful reference for later TODOs, but it should be re-validated before relying on it for Apple-specific submission. |

### Capacitor Configuration Summary

| Setting | Current value or state | Note |
| --- | --- | --- |
| `appId` | `com.staronlabs.chartradar` | Strong Bundle ID candidate because it matches Android `applicationId`. Actual Apple Bundle ID creation is not done in this run. |
| `appName` | `Chart Radar` | Display-name candidate for iOS. Actual `Info.plist` display name cannot exist until iOS platform is added. |
| `webDir` | `mobile-shell` | Existing mobile shell output is used for Capacitor packaging. |
| `server` | Optional via mobile server URL environment setting. | Needs iOS review later for production build mode and cleartext behavior. |
| Android options | `allowMixedContent: false`, `captureInput: true` | Android-specific config only; no iOS-specific options found. |
| Push plugin config | Presentation options: alert, sound, badge. | Common plugin config exists, but iOS native entitlements/APNs/Firebase plist are not present. |

### iOS Platform And Native Project State

| Item | Current state |
| --- | --- |
| `ios/` directory | Missing |
| Xcode project | Missing |
| Xcode workspace | Missing |
| `Podfile` | Missing |
| `Info.plist` | Missing |
| `AppDelegate` / `SceneDelegate` | Missing |
| Firebase iOS plist | Missing |
| iOS entitlements file | Missing |
| Signing/certificate/provisioning | Not present in repo and not checked externally |

Conclusion: the repo is not ready to build an iOS TestFlight artifact yet because the native iOS platform is absent. The likely platform follow-up candidate is `ios-capacitor-platform-setup-run`, but Task 6 should make the final selection after Apple Developer, Sign in with Apple, RevenueCat, and first-build checklist tasks complete.

### Bundle ID And Display Name Candidates

| Item | Candidate | Basis | Status |
| --- | --- | --- | --- |
| iOS Bundle ID | `com.staronlabs.chartradar` | Matches Capacitor `appId` and Android application ID. | Candidate only; not registered or changed. |
| iOS display name | `Chart Radar` | Matches Capacitor `appName` and Android app name strings. | Candidate only; no `Info.plist` exists. |
| App Store Connect app name | `Chart Radar` | Same naming convention as current app. | Candidate only; Apple availability not checked. |

### iOS Build And Script State

| Script or command family | Current state | Risk |
| --- | --- | --- |
| Android add/sync/open/build scripts | Present for Android only. | Must not be reused for iOS. |
| iOS add/sync/open/build scripts | Not present. | First iOS setup will need explicit commands in a separate run; no script changes in this audit. |
| `app:doctor` | Present and generic Capacitor doctor command. | Not run here. It may be useful later after iOS setup, but it is not proof of iOS readiness now. |
| Xcode/pod/fastlane/upload scripts | Not found. | Native build/upload automation is absent and must not be invented in this run. |

### Native Dependency Readiness

| Area | Current source signal | iOS readiness risk |
| --- | --- | --- |
| Capacitor iOS | `@capacitor/ios` not found. | iOS platform setup cannot proceed cleanly until the iOS package/platform plan is decided. |
| Push notifications | Capacitor push plugin exists, but app push client code is Android-specific and no iOS native project/Firebase plist/entitlements were found. | iOS push requires separate APNs/Firebase/iOS entitlement review after platform setup. |
| RevenueCat purchases | Purchases plugin exists and app code has an iOS platform branch plus iOS public-key placeholder. | App Store subscription products, RevenueCat iOS app, offerings/packages/products, and entitlement mapping remain unverified. |
| Google login | Native Google sign-in helper is Android-specific; web Google login exists elsewhere. | iOS auth and Sign in with Apple policy risk remain TODO 3. |
| Billing sync | Server sync route accepts `ios`; plan resolution uses existing store product identifiers. | iOS product IDs and subscription group mapping remain TODO 4. |

### Prepared Items

- Common Capacitor config exists.
- App ID/name candidate is clear and internally consistent with Android.
- Mobile shell output directory is configured.
- Mobile purchase code already recognizes `ios` as a native purchase platform.
- Server billing sync and health diagnostics include iOS-related branches.
- Existing support/privacy/terms/refund/account deletion routes from prior settings polish can support later App Store metadata checks.

### Missing Or Uncertain Items

- Native iOS project is missing.
- `@capacitor/ios` is not present.
- No iOS build, sync, open, archive, upload, pod, or fastlane scripts exist.
- No iOS `Info.plist`, entitlements, Firebase plist, app icons, launch assets, or signing configuration exists in the repo.
- Apple Developer team, Bundle ID registration, signing certificate, provisioning profile, and App Store Connect app record are unverified.
- iOS push notification entitlement/APNs/Firebase path is unverified.
- iOS RevenueCat/App Store product mapping is unverified.
- iOS Google login behavior and Sign in with Apple review risk are unresolved.

### High-Risk Or Separate-Run Items

| Item | Why separate |
| --- | --- |
| `ios-capacitor-platform-setup-run` | Required if the team decides to add the iOS native platform and install/use the iOS Capacitor package. |
| Apple Developer/App Store Connect registration | Requires external console access and can create persistent app identifiers/listing state. |
| Sign in with Apple decision or implementation | Auth/Supabase/UI policy-sensitive and TODO 3 must verify official Apple guidance first. |
| RevenueCat iOS product mapping | Billing/entitlement/revenue-sensitive and App Store Connect product setup is external. |
| iOS push enablement | Requires native entitlements, APNs/Firebase setup, and client/server delivery behavior review. |
| First TestFlight build/upload | Requires Xcode, signing, native project, archive, and upload steps. |

### Handoff To TODO 2 - Apple Developer Review Points

- Confirm Apple Developer account/team availability.
- Confirm whether `com.staronlabs.chartradar` is available and should be used as the Bundle ID.
- Confirm App Store Connect app name availability for `Chart Radar`.
- Confirm category, age rating, privacy policy URL, support URL, marketing URL need, screenshots, keywords, description, review contact, and demo account requirements.
- Confirm whether the existing production web URLs are acceptable for privacy, terms, refund/subscription guidance, account deletion, and support.
- Do not create or modify any Apple Developer/App Store Connect records in TODO 2.

## Task 2 - Apple Developer Submission Requirement Review

| Field | Value |
| --- | --- |
| Status | `DONE` |
| Completed date | 2026-06-09 |
| Method | Documentation and official Apple reference review only. No Apple Developer, App Store Connect, Bundle ID, App ID, TestFlight, iOS platform, iOS build, Xcode, Capacitor sync, RevenueCat, product, entitlement, auth, Supabase, billing, Android, or production setting was changed. |
| Official sources checked | Apple Developer Program enrollment, App ID registration, app capability enablement, App Store Connect app record, app information, app privacy details, TestFlight overview, and external tester guidance. Checked on 2026-06-09. |
| Implementation allowed in this run? | `No` |

### Official Apple Reference Links Checked

| Topic | Official source |
| --- | --- |
| Apple Developer Program enrollment | https://developer.apple.com/support/enrollment/ |
| Register an App ID | https://developer.apple.com/help/account/identifiers/register-an-app-id/ |
| Enable app capabilities | https://developer.apple.com/help/account/manage-identifiers/enable-app-capabilities |
| Add a new app record | https://developer.apple.com/help/app-store-connect/create-an-app-record/add-a-new-app/ |
| App information reference | https://developer.apple.com/help/app-store-connect/reference/app-information/app-information/ |
| App privacy details | https://developer.apple.com/app-store/app-privacy-details/ |
| TestFlight overview | https://developer.apple.com/help/app-store-connect/test-a-beta-version/testflight-overview/ |
| Invite external testers | https://developer.apple.com/help/app-store-connect/test-a-beta-version/invite-external-testers |
| TestFlight subscriptions and IAP testing | https://developer.apple.com/help/app-store-connect/test-a-beta-version/testing-subscriptions-and-in-app-purchases-in-testflight/ |

### Apple Developer Account Preparation

| Requirement | Current ChartRadar signal | Status | Risk / note |
| --- | --- | --- | --- |
| Apple Developer Program membership | Not checked externally. | Needs owner confirmation. | Required before App Store Connect app setup, signing, and TestFlight distribution work. |
| Account type | Unknown: individual vs organization. | Needs owner confirmation. | Organization enrollment may require legal entity and D-U-N-S confirmation. Do not infer business identity from repo text. |
| Team ID | Not checked. | Needs owner confirmation. | Required later for signing, Xcode project setup, capabilities, and App Store Connect coordination. |
| Account roles | Not checked. | Needs owner confirmation. | App ID/app record work generally requires Account Holder/Admin/App Manager style access depending on action. |
| Agreements / Business status | Not checked. | Needs owner confirmation. | App Store Connect app creation can be blocked if required agreements are not accepted. |
| External console work | None. | Prohibited in this TODO. | Do not sign in, create records, change agreements, or modify team settings in this readiness task. |

### Bundle ID / App ID Preparation

| Item | Candidate or requirement | Current status | Console action required later? | Risk / note |
| --- | --- | --- | --- | --- |
| Bundle ID candidate | `com.staronlabs.chartradar` | Present in `capacitor.config.ts`; matches Android package naming. | Yes, if not already registered. | Candidate only. Availability and ownership were not checked. |
| App ID type | Explicit App ID | Not created or verified. | Yes. | Needed for a single app and capability allowlist. |
| Push Notifications capability | Candidate capability. | Not configured for iOS. | Yes, later. | Requires APNs/Firebase/native entitlement planning after iOS platform setup. |
| Sign in with Apple capability | Possible requirement because app currently has Google login. | Not configured. | Maybe, after TODO 3 policy decision. | Do not enable until policy/auth implications are reviewed. |
| In-App Purchase capability | Candidate capability for iOS subscriptions. | Not verified. | Yes, later if subscriptions are offered on iOS. | RevenueCat/App Store product mapping remains TODO 4. |
| Associated Domains | Possible later need. | Not verified. | Maybe. | Only if universal links, web auth callback, or deep-link requirements make it necessary. |
| iOS native entitlement file | Missing because `ios/` platform is absent. | Missing. | Later platform/build run. | Cannot prove capability wiring until native iOS project exists. |

### App Store Connect App Record Preparation

| Field | Current candidate / source | Status | Risk / note |
| --- | --- | --- | --- |
| App name | `Chart Radar` from Capacitor config and Android naming. | Candidate only. | App Store name availability not checked. |
| Bundle ID connection | `com.staronlabs.chartradar` candidate. | Needs App ID registration/selection later. | No App Store Connect app record was created. |
| Primary language | Not confirmed. | Needs owner decision. | Existing app is Korean-first, but App Store Connect value was not chosen. |
| SKU | Not defined. | Needs owner decision. | Should be stable internal identifier; do not invent in docs. |
| Category | Finance candidate from existing release doc. | Needs owner confirmation. | Must fit actual app positioning and review expectations. |
| Age rating | Not completed. | Needs questionnaire later. | Finance/market data, user-generated content absence, web access, and account features should be answered accurately. |
| Price / availability | Not confirmed. | Needs owner decision. | App may be free with subscriptions, but App Store pricing/territories were not checked. |
| Developer name / company name | Not confirmed. | Needs owner confirmation. | Do not invent business/operator display text. |
| App record creation | Not done. | Prohibited in this TODO. | Requires App Store Connect access and persistent external state. |

### App Information And Metadata Preparation

| Metadata item | Current source signal | Status | Risk / note |
| --- | --- | --- | --- |
| App description | Existing draft in `docs/app-store-release.md`, but encoding/content should be revalidated before use. | Needs review. | Must avoid investment-advice, guaranteed-return, or trade-instruction wording. |
| Keywords | Existing draft in `docs/app-store-release.md`, but must be reviewed. | Needs review. | Keep judgment-support positioning. |
| Subtitle/promotional text | Not finalized. | Needs owner decision. | Keep concise and avoid outcome promises. |
| Support URL | Public URL not confirmed. | Needs owner decision. | App Store requires a real reachable URL, not only an in-app route or email. |
| Marketing URL | Not confirmed. | Optional/needs decision. | Can be omitted if no stable marketing page exists. |
| Privacy Policy URL | Existing route `/privacy`; public production URL not confirmed in this task. | Needs public URL confirmation. | Required for iOS/macOS app information. |
| Terms URL | Existing route `/terms`; public production URL not confirmed. | Needs public URL confirmation. | Useful for review/support even if not always a separate required field. |
| Refund/subscription guide URL | Existing route `/refund`; public production URL not confirmed. | Needs public URL confirmation. | Important because ChartRadar has subscriptions. |
| Account/data deletion guide URL | Existing route `/account/delete`; public production URL not confirmed. | Needs public URL confirmation. | Important for account deletion accessibility. |
| Support email | `support@staronlabs.com`. | Prepared as contact value. | Email is not a substitute for required web URLs where App Store Connect asks for URLs. |
| General inquiry email | `contact@staronlabs.com`. | Prepared as contact value. | Use for non-support inquiries only. |
| Screenshots | Not prepared for iOS dimensions. | Needs later asset run. | Requires real iOS/mobile screenshots after iOS shell/build path is ready. |
| App icon | Android/native assets exist, but iOS app icon set is absent because `ios/` is missing. | Needs later platform/asset run. | Do not create iOS assets in this TODO. |
| Copyright | Not confirmed. | Needs owner/legal decision. | Do not invent legal text. |

### Privacy And Review Preparation

| Area | Current data candidate | Status | Risk / note |
| --- | --- | --- | --- |
| App Privacy nutrition labels | Not answered in App Store Connect. | Needs later owner/review pass. | Apple requires accurate disclosure of app and third-party partner data practices before submitting apps/updates. |
| Account information | Email/account identifier through login. | Candidate disclosure item. | Exact collection/linkage/use must be confirmed against implementation and providers. |
| Purchase/subscription information | RevenueCat/App Store subscription state. | Candidate disclosure item. | Payment details handled by Apple may differ from subscription status stored/processed by app services. |
| Push/device token | Push token and platform state may be stored for notifications. | Candidate disclosure item. | iOS APNs/Firebase path is not implemented/proven yet. |
| App usage/notification settings | Alert settings, plan usage, and app feature state may be stored. | Candidate disclosure item. | Confirm exact storage tables and retention before final privacy answers. |
| Diagnostics/crash data | Not audited in this TODO. | Needs later review. | Apple/third-party SDK diagnostics must be reflected if collected. |
| Account deletion access | `/account/delete` exists as an in-app/web route. | Candidate support route. | Real deletion flow and App Review accessibility should be manually verified later. |
| Review notes / demo account | Not prepared. | Needs decision. | If login is required for meaningful review, provide reviewer credentials or clear test path in a later run. |
| Financial advice posture | Existing docs position ChartRadar as market analysis/judgment support. | Must preserve. | Metadata and screenshots must not imply guaranteed returns, trading execution, or buy/sell instructions. |

### TestFlight Preparation

| Item | Requirement / decision | Status | Risk / note |
| --- | --- | --- | --- |
| Internal testing group | Need group/users after App Store Connect app exists. | Not created. | Apple docs currently describe internal testers as App Store Connect users with app access. |
| External testing | Need decision whether external testers are required. | Not decided. | External testing requires Beta App Review before testers can access approved builds. |
| Tester limit awareness | Apple docs currently describe up to 100 internal testers and up to 10,000 external testers. | Informational only. | Do not treat as a target audience plan. |
| Beta App Review | Required for external TestFlight distribution. | Not submitted. | No build exists yet, so no review can happen in this run. |
| Test information | Needs beta description, review notes, contact info, and instructions. | Not prepared. | Should explain login, subscriptions, notification behavior, and non-trading positioning. |
| Reviewer account | Needs decision. | Not prepared. | If meaningful screens require login/Pro, use a safe reviewer/test account in a separate run. |
| TestFlight IAP/subscription testing | Needs Sandbox Apple Account and App Store product setup later. | Not executed. | Do not test purchases in this readiness task. |
| Build upload | Not possible yet. | Prohibited. | Native iOS project is absent. |

### Current Known Information

| Item | Value |
| --- | --- |
| App display/name candidate | `Chart Radar` |
| Bundle ID candidate | `com.staronlabs.chartradar` |
| Capacitor `webDir` | `mobile-shell` |
| Existing policy/support routes | `/privacy`, `/terms`, `/refund`, `/account/delete`, `/faq` |
| Support email | `support@staronlabs.com` |
| General inquiry email | `contact@staronlabs.com` |
| Existing app posture | Market analysis and judgment-support tool; no trading execution or guaranteed signal claim. |

### Information Still Needed From Owner Or Console

| Needed item | Why it is needed |
| --- | --- |
| Apple Developer Program membership and account type | Required before App ID, signing, App Store Connect, and TestFlight work. |
| Team ID and role/access level | Required for signing, certificates, App ID, and app record work. |
| Bundle ID availability/registration status | `com.staronlabs.chartradar` is only a candidate until checked in Apple Developer. |
| App Store Connect app name availability | `Chart Radar` is only a candidate until checked. |
| Public production base URL | Needed for support, privacy, terms, refund/subscription guide, and account deletion URLs. |
| Category, age rating, pricing/territories, SKU, and primary language | Required for app record/listing readiness. |
| Confirmed legal/company/copyright text | Must not be invented from repo context. |
| Final App Privacy answers | Requires implementation/provider review and owner confirmation. |
| iOS screenshots and icon assets | Need iOS-specific asset preparation after native/iOS route is ready. |
| Reviewer/test account plan | Needed if review must access logged-in or Pro-gated flows. |

### Console Change Prohibition For This TODO

| Console or system | Status |
| --- | --- |
| Apple Developer Program / Certificates, Identifiers & Profiles | No access or changes. |
| App Store Connect app record, metadata, privacy labels, pricing, TestFlight, or review submission | No access or changes. |
| RevenueCat, App Store products, subscription groups, offerings, packages, product IDs, entitlements, or prices | No access or changes. |
| Supabase, auth providers, RLS, production DB, billing sync, Android release, Play Console | No access or changes. |
| iOS platform add/sync/build/open/upload, pod install, Xcode, fastlane, Transporter | Not run. |

### Handoff To TODO 3 - Sign in with Apple Risk Points

- Current source shows Google login exists and the native Google Sign-In helper is Android-specific.
- TODO 3 must verify the current App Review guideline and Apple Developer guidance for apps using third-party/social login before drawing a conclusion.
- If Sign in with Apple is required, the follow-up must be separated from this readiness audit because it may affect UI, auth callback handling, Supabase provider configuration, Apple capability setup, and reviewer login instructions.
- Do not implement Apple login, enable capabilities, or edit auth/Supabase code in TODO 3.

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
