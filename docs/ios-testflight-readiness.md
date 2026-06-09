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
| 3 | DONE | Sign in with Apple requirement risk review | Does Google login create an Apple sign-in review requirement risk? | Policy risk summary and auth/Supabase impact notes. |
| 4 | DONE | RevenueCat Apple product mapping review | What iOS subscription mapping must exist before paid iOS TestFlight/review? | RevenueCat/App Store product mapping checklist. |
| 5 | DONE | TestFlight first-build checklist | What must be verified before first iOS build/upload? | Pre-build and upload-readiness checklist. |
| 6 | DONE | Select first iOS readiness follow-up run | What is the first practical next run after audit? | One follow-up candidate, no auto-creation. |

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

Conclusion: the repo is not ready to build an iOS TestFlight artifact yet because the native iOS platform is absent. Task 6 selected `ios-capacitor-platform-setup-run` as the first follow-up candidate after the Apple Developer, Sign in with Apple, RevenueCat, and first-build checklist tasks completed.

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

## Task 3 - Sign in with Apple Requirement Risk Review

| Field | Value |
| --- | --- |
| Status | `DONE` |
| Completed date | 2026-06-09 |
| Method | Source inspection and official Apple policy review only. No Apple login, auth code, Supabase provider, Apple Developer capability, App Store Connect, Bundle ID, iOS platform, iOS build, Xcode, production auth, or real login test was changed or executed. |
| Official sources checked | App Review Guidelines 4.8 Login Services, Sign in with Apple capability documentation, and App Store review information. Checked on 2026-06-09. |
| Implementation allowed in this run? | `No` |

### Official Apple Policy References Checked

| Topic | Official source |
| --- | --- |
| App Review Guidelines 4.8 Login Services | https://developer.apple.com/app-store/review/guidelines/ |
| Sign in with Apple capability setup | https://developer.apple.com/help/account/configure-app-capabilities/about-sign-in-with-apple |
| Enable app capabilities | https://developer.apple.com/help/account/manage-identifiers/enable-app-capabilities |
| App Review information and demo account fields | https://developer.apple.com/help/app-store-connect/reference/app-review-information |

### Current Login Structure Summary

| Area | Current source signal | iOS readiness implication |
| --- | --- | --- |
| Primary login button | `src/components/GoogleLoginButton.tsx` renders Google login and uses Supabase OAuth on web. | If the same UI ships on iOS, Google is a third-party/social login for the primary app account. |
| Android native login | `src/lib/nativeGoogleSignIn.ts` supports only Android native Google Sign-In and exchanges the Google ID token with Supabase. | iOS has no native Google helper in this checkout; an iOS build would likely fall back to the web OAuth path unless changed later. |
| Web OAuth path | `GoogleLoginButton` builds a Supabase `/auth/v1/authorize` URL with `provider=google` and redirects to `/auth/callback`. | The iOS WebView/Capacitor redirect behavior is unproven and would still count as third-party login if exposed. |
| Kakao login | `src/components/KakaoLoginButton.tsx` renders on web/non-Android when configured; `/api/auth/kakao/*` exchanges Kakao auth into a Supabase session with `provider: "kakao"`. | If Kakao is exposed on iOS, it is also a third-party/social login for the primary app account. |
| Auth callback/session | `src/app/auth/callback/page.tsx` parses the OAuth hash and stores the custom Supabase session. | Apple login would need a compatible callback/session handoff or separate provider flow. |
| Auth state hook | `src/lib/useSupabaseAuth.ts` is the central auth state hook and also refreshes entitlement-derived profile state. | Apple provider support would affect account state, profile display, and entitlement refresh paths. |
| Account page provider display | `src/app/account/page.tsx` labels Google and Kakao providers and falls back to generic provider text. | Apple provider display would need review if implemented later. |
| Login entry points | `src/app/login/page.tsx`, `src/components/HomeEntryGate.tsx`, `src/components/AuthStatus.tsx`, and `src/components/HeaderActions.tsx` route users to login/account flows. | Apple login UI would affect multiple visible entry points, not one isolated button. |
| Own email/password login | No own email/password signup/login route was found in this inspection. | The app does not currently have a first-party account setup alternative that avoids third-party login policy risk. |
| Browse without login | `HomeEntryGate` allows a Basic browse path without login. | Helpful, but account-based features still use Google/Kakao login for saved state, alerts, Pro, and account management. |
| Apple provider | No Apple auth provider helper, button, Supabase provider flow, or capability wiring was found. | Apple login is not implemented in this checkout. |

### Sign in with Apple Need Assessment

| Scenario | Risk level | Reasoning |
| --- | --- | --- |
| iOS app exposes Google login for primary account creation/authentication and no equivalent privacy-preserving login option | HIGH | Apple App Review Guideline 4.8 applies to apps using third-party/social login services such as Google Sign-In for the user's primary account. |
| iOS app exposes both Google and Kakao login and no equivalent privacy-preserving login option | HIGH | More third-party/social login options do not remove the requirement risk; Kakao adds the same review class of risk if exposed. |
| iOS app removes all third-party/social login and only supports a company-owned account system or meaningful no-login use | LOWER, but not current source state | This would require a product/auth decision and likely code/UI changes; it is not the current implementation. |
| Internal-only TestFlight technical build with no external beta review | MEDIUM | It may be possible to test internally before final auth policy resolution, but the unresolved policy risk remains a blocker before external TestFlight/App Review. |
| External TestFlight or App Store Review with current Google/Kakao login exposed | HIGH | External TestFlight can require Beta App Review, and App Store Review will evaluate login policy. |

Conclusion: if ChartRadar plans to offer the current Google login structure on iOS, Sign in with Apple or another equivalent login option should be treated as a HIGH review-readiness risk. The practical follow-up is a separate auth-focused run, not implementation inside this readiness audit.

### Implementation Impact Scope If Apple Login Is Added Later

| Area | Impact to plan later | Risk |
| --- | --- | --- |
| Apple Developer App ID capability | Enable/configure Sign in with Apple for the Bundle ID or related App ID grouping. | HIGH - external console and provisioning impact. |
| Supabase Auth provider | Configure Apple provider, client/service IDs, key/team details, redirect URLs, and provider mapping. | HIGH - production auth configuration. |
| iOS native project | Add entitlement/capability wiring once `ios/` exists. | HIGH - native project/signing impact. |
| Redirect/deep link handling | Confirm OAuth callback works in iOS Capacitor/WebView and returns to the intended route. | HIGH - login reliability and review access. |
| Login UI | Add Apple/equivalent login button to `/login`, `HomeEntryGate`, and possibly settings/account surfaces. | MEDIUM-HIGH - user-facing auth UI. |
| Account provider display | Add Apple provider labeling and test provider metadata assumptions. | MEDIUM. |
| Existing Google/Kakao accounts | Decide whether Apple login creates separate accounts or can be linked to existing user identities. | HIGH - account duplication and entitlement ownership risk. |
| Pro entitlement and RevenueCat sync | Ensure Apple-auth users resolve the same Supabase profile/subscription logic. | HIGH - paid access risk. |
| Privacy policy and App Privacy answers | Update collected data/provider descriptions if Apple login is introduced. | MEDIUM-HIGH. |
| Reviewer account/test notes | Provide a reviewable sign-in path and demo account or instructions if login gates important features. | MEDIUM-HIGH. |

### High-Risk Changes Explicitly Not Done

| Item | Status |
| --- | --- |
| Apple login implementation | Not done. |
| Supabase Apple provider setup | Not done. |
| Apple Developer Sign in with Apple capability | Not enabled or changed. |
| Bundle ID, App ID, certificate, provisioning, or entitlement changes | Not done. |
| Auth UI changes | Not done. |
| Account linking/merge behavior | Not changed. |
| Production auth configuration | Not changed. |
| Google, Kakao, or Apple real login tests | Not run. |
| iOS platform add/sync/build/open/upload | Not run. |

### Follow-Up Run Candidates

| Candidate | Use when |
| --- | --- |
| `ios-auth-apple-signin-risk-run` | The owner wants a deeper policy/design decision before any auth implementation. |
| `ios-auth-provider-mapping-run` | The owner wants to map Google, Kakao, Apple, Supabase identities, existing accounts, and entitlement ownership before implementation. |
| `ios-auth-apple-signin-implementation-run` | The owner approves implementing Apple/equivalent login after provider mapping, capability, redirect, and QA scope are defined. |

### Handoff To TODO 4 - RevenueCat Mapping Points

- Apple login risk is separate from iOS subscription mapping, but both intersect at Supabase user identity and entitlement ownership.
- TODO 4 should document App Store product IDs, subscription group structure, RevenueCat iOS app/offering/package/product mapping, and entitlement names without changing billing code or external consoles.
- If Apple login is later implemented, RevenueCat subscriber identity and Supabase account identity must be checked together before real iOS purchase testing.

## Task 4 - RevenueCat Apple Product Mapping Review

| Field | Value |
| --- | --- |
| Status | `DONE` |
| Completed date | 2026-06-09 |
| Method | Source inspection and official Apple/RevenueCat reference review only. No RevenueCat, App Store Connect, Google Play Console, billing code, mobile purchase code, product ID, plan ID, entitlement, price, auth, Supabase, iOS native, config, real purchase, or restore test was changed or executed. |
| Official sources checked | Apple auto-renewable subscription/subscription group documentation and RevenueCat product, offering, entitlement, customer identity, and restore documentation. Checked on 2026-06-09. |
| Implementation allowed in this run? | `No` |

### Official Apple And RevenueCat References Checked

| Topic | Official source |
| --- | --- |
| App Store auto-renewable subscriptions and subscription groups | https://developer.apple.com/help/app-store-connect/manage-subscriptions/offer-auto-renewable-subscriptions |
| Apple subscription group guidance | https://developer.apple.com/app-store/subscriptions/ |
| App Store subscription reference name, Product ID, and availability | https://developer.apple.com/help/app-store-connect/manage-subscriptions/set-availability-for-an-auto-renewable-subscription/ |
| RevenueCat products overview | https://www.revenuecat.com/docs/offerings/products-overview |
| RevenueCat offerings and packages | https://www.revenuecat.com/docs/offerings/overview |
| RevenueCat entitlements | https://www.revenuecat.com/docs/entitlements |
| RevenueCat customer identity | https://www.revenuecat.com/docs/customers/identifying-customers |
| RevenueCat restore purchases | https://www.revenuecat.com/docs/getting-started/restoring-purchases |
| RevenueCat CustomerInfo and active entitlements | https://www.revenuecat.com/docs/customers/customer-info |

### Current Android Product And Entitlement Structure

Source inspection shows the existing paid plan catalog is centralized in `src/lib/billing.ts`. The product IDs below are current store product identifiers in code; they should not be assumed to be final App Store Connect Product IDs without a separate mapping run.

| Internal plan | User-facing product | Duration | Current product ID | Current base plan ID | Market scope | Entitlement expectation | Current amount |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `crypto_monthly` | Coin Pro monthly | 1 month | `chart_radar_crypto_monthly` | `monthly` | `crypto` | `coin_pro` or legacy `crypto_pro` unlocks Coin Pro. | KRW 29,000 |
| `crypto_yearly` | Coin Pro yearly | 1 year | `chart_radar_crypto_yearly` | `year-1` | `crypto` | `coin_pro` or legacy `crypto_pro` unlocks Coin Pro. | KRW 290,000 |
| `stocks_monthly` | Global Pro monthly | 1 month | `chart_radar_global_monthly` | `monthly` | `stocks` | `global_pro` unlocks Global Pro. | KRW 19,000 |
| `stocks_yearly` | Global Pro yearly | 1 year | `chart_radar_global_yearly` | `yearly-1` | `stocks` | `global_pro` unlocks Global Pro. | KRW 190,000 |
| `bundle_monthly` | All Market Pro monthly | 1 month | `chart_radar_bundle_monthly` | `monthly` | `bundle` | `all_market_pro` or legacy `bundle_pro` unlocks Coin and Global Pro. | KRW 39,000 |
| `bundle_yearly` | All Market Pro 6-month, legacy internal ID | 6 months | `chart_radar_bundle_6month` | `month-6` | `bundle` | `all_market_pro` or legacy `bundle_pro` unlocks Coin and Global Pro. | KRW 199,000 |

### Current Code Mapping Signals

| Source | Current signal | iOS implication |
| --- | --- | --- |
| `src/lib/billing.ts` | Paid plans include `appStoreProductId`, Android-like `appStoreBasePlanId`, market scope, price labels, and entitlement aliases. | iOS mapping must decide whether to reuse current product IDs or introduce App Store-specific IDs and then update code in a separate high-risk run. |
| `src/lib/billing.ts` | `getStoreProductIdentifier()` joins product and base plan as `product:basePlan` when a base plan exists. | This is Android-friendly. App Store product mapping should verify whether iOS product lookup should continue requiring a base plan. |
| `src/lib/billing.ts` | Active RevenueCat entitlements resolve `all_market_pro` / `bundle_pro`, `coin_pro` / `crypto_pro`, and `global_pro`. | iOS products should unlock the same canonical entitlements if cross-platform access is intended. |
| `src/lib/mobilePurchases.ts` | Native platform type includes `ios`, and iOS uses `NEXT_PUBLIC_REVENUECAT_IOS_API_KEY`. | iOS purchase flow has a code branch, but App Store products and RevenueCat iOS app mapping are unproven. |
| `src/lib/mobilePurchases.ts` | iOS purchase path checks RevenueCat offerings first. Package ID is normally the internal plan ID, except `bundle_yearly` maps to `bundle_6month`. | RevenueCat package identifiers must match this expectation unless a later implementation run changes code. |
| `src/lib/mobilePurchases.ts` | Purchases are configured with the Supabase user ID as RevenueCat `appUserID`. | Cross-platform entitlement continuity depends on stable Supabase user identity. Do not use email as the App User ID. |
| `src/app/api/billing/app-store/sync/route.ts` | Sync accepts `android` or `ios`, fetches RevenueCat subscriber state, maps active subscriptions by product ID, and maps active entitlements by entitlement ID. | iOS RevenueCat products and entitlements must be visible through the same subscriber API for Supabase entitlement sync to work. |
| `.env.example` | Contains RevenueCat Android public key, iOS public key, and REST key placeholders. | iOS environment readiness needs key provisioning later; no values were read or changed here. |
| `src/lib/server/healthStatus.ts` | Separates Android billing readiness from iOS billing readiness. | Launch diagnostics can represent iOS billing readiness after keys/provider setup, but this task did not validate live values. |

### iOS App Store Product Mapping Needs

The following are planning candidates only. Actual App Store Connect Product IDs must be created or confirmed in a separate high-risk console run before code or RevenueCat mapping is changed.

| Product line | Duration | Candidate iOS Product ID | App Store product type | Subscription group consideration | Notes |
| --- | --- | --- | --- | --- | --- |
| Coin Pro | 1 month | `chartradar.coinpro.monthly` | Auto-renewable subscription | Candidate group: `Chart Radar Pro` | Unlocks Coin Pro scope only. |
| Coin Pro | 1 year | `chartradar.coinpro.yearly` | Auto-renewable subscription | Same group as Coin monthly. | Annual equivalent of Coin Pro. |
| Global Pro | 1 month | `chartradar.globalpro.monthly` | Auto-renewable subscription | Candidate group: `Chart Radar Pro` | Unlocks Global Pro scope only. |
| Global Pro | 1 year | `chartradar.globalpro.yearly` | Auto-renewable subscription | Same group as Global monthly. | Annual equivalent of Global Pro. |
| All Market Pro | 1 month | `chartradar.allmarketpro.monthly` | Auto-renewable subscription | Candidate group: `Chart Radar Pro`, likely highest level. | Unlocks Coin and Global Pro scopes. |
| All Market Pro | 6 months | `chartradar.allmarketpro.6month` | Auto-renewable subscription | Same group as All Market monthly. | Current app plan uses legacy internal ID `bundle_yearly` but displays a 6-month product. |

### Subscription Group Decision Needed

| Option | Benefit | Risk / decision point |
| --- | --- | --- |
| Single group `Chart Radar Pro` | Aligns with Apple's general guidance for simple subscription structures and supports upgrade/downgrade/crossgrade relationships. | Users can normally hold only one subscription in a group at a time, so Coin+Global separate simultaneous subscriptions would not be the intended model. The bundle product should be the combined path. |
| Separate groups for Coin, Global, and All Market | Allows independent subscriptions by market line. | More complex App Store behavior, more review/UX burden, and possible mismatch with the app's bundle-oriented plan model. |

Recommended planning assumption: use one subscription group if ChartRadar wants one active Pro tier at a time, with All Market Pro above Coin Pro and Global Pro. Confirm with owner/product policy before creating App Store products.

### RevenueCat Mapping Needs

| Mapping item | Required later | Current planning note |
| --- | --- | --- |
| RevenueCat iOS app | Yes | Must be connected to the iOS Bundle ID candidate `com.staronlabs.chartradar` after Apple app setup exists. |
| App Store products in RevenueCat | Yes | Add exact App Store Connect Product IDs after they are created/approved. Current Android IDs must not be assumed final for iOS. |
| Entitlements | Yes | Prefer existing canonical entitlements: `coin_pro`, `global_pro`, and `all_market_pro`; keep legacy aliases in code only for backward compatibility unless a migration run changes them. |
| Offering strategy | Needs decision | Either share the current/default offering across platforms with platform-specific products in equivalent packages, or use an iOS-specific offering if paywall copy/availability differs. |
| Package identifiers | Yes | Current iOS code expects package IDs matching plan IDs: `crypto_monthly`, `crypto_yearly`, `stocks_monthly`, `stocks_yearly`, `bundle_monthly`, and `bundle_6month` for the 6-month All Market package. |
| Product-to-package equivalence | Yes | Equivalent Android/iOS products should sit in the same package if the same paywall option unlocks the same entitlement and duration. |
| App User ID | Yes | Use the Supabase user ID already passed to RevenueCat. Do not use email as App User ID. |
| Restore behavior | Yes | Restore UX already exists in code, but iOS restore transfer/merge behavior and account identity rules need a separate QA/policy run. |
| Server entitlement sync | Yes | RevenueCat REST subscriber state must expose active iOS subscriptions/entitlements so `/api/billing/app-store/sync` can grant Supabase entitlements. |

### Android/iOS Entitlement Unification Candidate

| Access scope | Preferred canonical entitlement | Existing alias accepted by code | Unlock expectation |
| --- | --- | --- | --- |
| Coin Pro | `coin_pro` | `crypto_pro` | Unlock crypto/Coin Pro screens and alerts. |
| Global Pro | `global_pro` | None observed. | Unlock Global Pro screens and alerts. |
| All Market Pro | `all_market_pro` | `bundle_pro` | Unlock both Coin Pro and Global Pro scopes. |

Planning conclusion: iOS products should unlock the same entitlements as Android products so a user has consistent access across platforms when the same Supabase user ID is used as RevenueCat App User ID. Do not change Supabase plan IDs, code product IDs, entitlement names, or price policy inside this readiness run.

### iOS Payment And Review Risks

| Risk | Why it matters | Follow-up |
| --- | --- | --- |
| App Store products absent | iOS purchases cannot work without App Store Connect auto-renewable products and RevenueCat mapping. | `ios-app-store-subscription-products-run` or `ios-revenuecat-product-mapping-run`. |
| Product ID/base plan mismatch | Current code expects `appStoreBasePlanId` for native products, while App Store products do not use Google Play base plans in the same way. | Separate implementation review before real iOS purchase testing. |
| Google Play / Android copy on iOS | `/pro`, `/refund`, `/terms`, and purchase-stage copy include Android/Google Play-specific wording. | `ios-pro-page-iap-copy-audit-run`. |
| External payment steering | iOS App Review can reject flows that steer users away from IAP for digital subscriptions. | Review `/pro` and policy pages before App Store submission. |
| Restore behavior unclear | iOS users expect restore purchases; RevenueCat restore behavior and Supabase entitlement sync need QA. | `ios-purchase-restore-readiness-run`. |
| RevenueCat identity/account merge | Apple login, Google login, and Supabase user identity can affect entitlement ownership. | Coordinate with Sign in with Apple follow-up. |
| Internal TestFlight vs paid review | A first internal technical TestFlight may be possible without completed IAP mapping if purchases are not being tested, but external review or paid feature validation will need mapping. | Capture in TODO 5 checklist. |

### High-Risk Changes Explicitly Not Done

| Item | Status |
| --- | --- |
| App Store Connect product creation or subscription group setup | Not done. |
| RevenueCat product, offering, package, entitlement, app, or key changes | Not done. |
| Google Play product changes | Not done. |
| `billing.ts`, `mobilePurchases.ts`, checkout/sync route, product ID, plan ID, entitlement, or price changes | Not done. |
| Supabase/auth/provider/account changes | Not done. |
| iOS platform add/sync/build/open/upload, Xcode, pod install, fastlane, or TestFlight upload | Not run. |
| Real purchase or restore test | Not run. |

### Follow-Up Run Candidates

| Candidate | Purpose |
| --- | --- |
| `ios-revenuecat-product-mapping-run` | Decide exact cross-platform RevenueCat offering, package, product, entitlement, and App User ID mapping. |
| `ios-app-store-subscription-products-run` | Create or configure App Store Connect subscription group and products after owner approval. |
| `ios-pro-page-iap-copy-audit-run` | Remove Android/Google Play-specific purchase wording from iOS-visible surfaces before review. |
| `ios-purchase-restore-readiness-run` | Define and test iOS restore behavior, account identity, and Supabase entitlement sync. |
| `ios-revenuecat-identity-restore-run` | Resolve identity/restore edge cases if Apple login and Google login coexist. |

### Handoff To TODO 5 - First Build Checklist Points

- Separate first iOS technical build readiness from iOS paid purchase readiness.
- Mark IAP purchase/restore testing as unavailable until App Store products and RevenueCat mapping are configured in a separate approved run.
- Do not test `/pro` iOS checkout until product IDs, offerings, packages, entitlements, restore behavior, and review copy have been approved.
- Include a checkpoint for iOS-visible Google Play/Android wording before external TestFlight or App Store Review.
- Keep Sign in with Apple and RevenueCat App User ID planning connected because both affect account identity and paid access.

## Task 5 - TestFlight First-Build Checklist

| Field | Value |
| --- | --- |
| Status | `DONE` |
| Completed date | 2026-06-09 |
| Method | Documentation only. No iOS platform add, iOS sync, iOS build, Xcode, pod install, archive, upload, App Store Connect, Apple Developer, RevenueCat, Supabase, auth, billing, entitlement, Android, real login, real purchase, or restore action was changed or executed. |
| Output checklist | `docs/qa/ios-testflight-checklist.md` |
| Implementation allowed in this run? | `No` |

### Checklist Summary

The first-build checklist separates local build environment, Capacitor iOS platform setup, Apple Developer, App Store Connect, Auth, RevenueCat/IAP, push notifications, policy/privacy, build/upload, and TestFlight review readiness. Each row records current status, needed action, risk, and whether a separate run is required.

### Current Blockers

| Blocker | Impact |
| --- | --- |
| Native iOS platform is absent. | No Xcode project, archive, or TestFlight upload can happen yet. |
| `@capacitor/ios` is absent. | Capacitor iOS platform setup cannot start without a separate approved run. |
| Apple Developer membership, Team ID, Bundle ID, certificates, and provisioning are unverified. | Signing and upload readiness are not established. |
| App Store Connect app record is absent or unverified. | TestFlight upload and tester setup are not ready. |
| Sign in with Apple risk remains HIGH if Google/Kakao login is exposed on iOS. | External TestFlight/App Store Review may be blocked. |
| RevenueCat/App Store product mapping is incomplete. | iOS purchase/restore and paid feature review are not ready. |
| APNs/Firebase iOS push setup is incomplete. | iOS push notification QA is not ready. |
| iOS screenshots/app icon assets are not prepared. | Store/TestFlight review asset readiness is incomplete. |

### Internal TestFlight Versus External Review

| Scope | Readiness note |
| --- | --- |
| Internal technical TestFlight | Can be treated separately from paid subscription/review readiness, but still requires native iOS platform, signing, App Store Connect app record, archive, and upload. |
| External TestFlight | Adds Beta App Review, review notes, support/privacy URLs, and a reviewable login path. Auth and IAP gaps become much more important. |
| App Store Review | Requires full metadata, privacy labels, account deletion access, support URL, IAP products/restore, auth policy compliance, screenshots/icons, and a stable signed build. |

### Separate-Run Items

| Area | Candidate run |
| --- | --- |
| Native iOS platform and Capacitor package setup | `ios-capacitor-platform-setup-run` |
| Apple Developer account, Team ID, Bundle ID, signing | `ios-apple-developer-account-setup-run` |
| App Store Connect app record and listing shell | `ios-app-store-connect-app-record-run` |
| Sign in with Apple policy/implementation decision | `ios-auth-apple-signin-risk-run` |
| RevenueCat/App Store subscription product mapping | `ios-revenuecat-product-mapping-run` |
| APNs/Firebase iOS push readiness | `ios-push-apns-firebase-readiness-run` |
| Store screenshots/icons/listing assets | `ios-store-listing-assets-run` |

### Handoff To TODO 6 - Follow-Up Selection

TODO 6 selected exactly one follow-up run. The checklist points to `ios-capacitor-platform-setup-run` as the strongest first technical candidate because the native iOS platform and `@capacitor/ios` are absent. Auth, IAP, push, and review assets remain separate high-risk tracks.

## Task 6 - Select First iOS Readiness Follow-Up Run

| Field | Value |
| --- | --- |
| Status | `DONE` |
| Completed date | 2026-06-09 |
| Method | Documentation and prioritization only. No follow-up active-run was created. No iOS platform add, iOS sync, iOS build, Xcode, pod install, archive, upload, App Store Connect, Apple Developer, RevenueCat, Supabase, auth, billing, entitlement, Android, real login, real purchase, or restore action was changed or executed. |
| Selected first follow-up candidate | `ios-capacitor-platform-setup-run` |
| Implementation allowed in this run? | `No` |

### Readiness Audit Final Summary

| Area | Final readiness finding |
| --- | --- |
| Capacitor/iOS platform | `ios/` native project is absent and `@capacitor/ios` is not installed. |
| App identity | Bundle ID candidate is `com.staronlabs.chartradar`; display name candidate is `Chart Radar`. |
| Apple Developer | Membership, Team ID, Bundle ID/App ID, capabilities, signing, certificates, and provisioning remain unverified. |
| App Store Connect | App record, SKU, metadata, support/privacy URLs, screenshots, icon, and TestFlight tester setup remain unverified or incomplete. |
| Auth review | Sign in with Apple need remains HIGH if Google/Kakao login is exposed on iOS. |
| RevenueCat/IAP | App Store subscription products and RevenueCat iOS product/offering/package/entitlement mapping remain incomplete. |
| Push | APNs, Firebase iOS app, `GoogleService-Info.plist`, push capability, and iOS native push path remain incomplete. |
| Store assets | iOS screenshots and icon assets are not prepared. |
| Build/upload | First iOS build, archive, and TestFlight upload are not possible until native platform and signing prerequisites exist. |

### Blockers Summary

| Blocker | Why it matters | Follow-up priority |
| --- | --- | --- |
| `ios/` platform missing | Blocks Xcode project inspection, signing setup, archive, and upload. | 1 |
| `@capacitor/ios` missing | Blocks Capacitor iOS platform creation. | 1 |
| Apple Developer/signing unknown | Blocks a signed archive and TestFlight upload. | 2 |
| App Store Connect app record unknown | Blocks upload/tester setup. | 2 |
| Sign in with Apple risk HIGH | Blocks external TestFlight/App Store review if third-party login remains exposed. | 3 |
| RevenueCat/App Store product mapping incomplete | Blocks iOS purchase/restore validation and paid feature review. | 4 |
| APNs/Firebase iOS push incomplete | Blocks iOS push QA. | 5 |
| iOS screenshots/icon missing | Blocks store/review asset readiness. | 6 |

### Follow-Up Candidate Evaluation

| Candidate | User/TestFlight impact | Risk | Timing fit | Decision |
| --- | --- | --- | --- | --- |
| `ios-capacitor-platform-setup-run` | Removes the first technical blocker by adding iOS platform readiness. | MEDIUM-HIGH because native files may be generated. | Best first step because no build/auth/IAP/push validation can be real without native iOS project. | Selected. |
| `ios-auth-apple-signin-risk-run` | Addresses HIGH App Review auth risk. | HIGH due to auth, Supabase, Apple capability, and account-linking impact. | Important, but deeper validation can follow after or parallel to platform setup planning. | Not selected first. |
| `ios-revenuecat-product-mapping-run` | Required for iOS paid subscription readiness. | HIGH due to RevenueCat/App Store Connect product and entitlement impact. | Too early for first technical build path; keep separate before paid QA/review. | Not selected first. |
| `ios-store-listing-assets-run` | Helps metadata/screenshots/privacy/support readiness. | MEDIUM. | Useful after native app/screen path is available for accurate screenshots/assets. | Not selected first. |
| `ios-testflight-build-run` | Directly attempts archive/upload. | HIGH. | Too early because native platform, signing, and app record are not ready. | Explicitly deferred. |

### Selected First Follow-Up Run

`ios-capacitor-platform-setup-run` is the recommended first follow-up run.

Reasoning:

- It removes the earliest technical blocker: the repo has no `ios/` native project and no `@capacitor/ios`.
- It can be scoped before TestFlight upload, App Store Connect mutation, RevenueCat mutation, or auth implementation.
- It gives later auth, IAP, push, signing, and screenshot work a real iOS native project to inspect.
- It is still MEDIUM-HIGH risk because native files may be generated, so it must have explicit guardrails and verification.

### Excluded Candidates And Reason

| Candidate | Reason excluded as first run |
| --- | --- |
| `ios-auth-apple-signin-risk-run` | HIGH review risk, but implementing or deeply configuring auth before any native iOS project exists may create premature scope. Keep it as the next high-risk review/auth track. |
| `ios-revenuecat-product-mapping-run` | Required for paid features, but App Store product and RevenueCat console work should not precede first native platform readiness unless purchase testing is the immediate target. |
| `ios-store-listing-assets-run` | Listing assets are useful, but screenshots/icon decisions are more reliable after iOS shell/platform shape is available. |
| `ios-testflight-build-run` | Not viable yet because iOS platform, signing, and App Store Connect app record are not ready. |

### Scope Guardrails For `ios-capacitor-platform-setup-run`

| Allowed candidate scope | Guardrail |
| --- | --- |
| Confirm exact `@capacitor/ios` version and install plan. | Do not change Android release settings or unrelated packages. |
| Create or prepare `ios/` native project only after explicit run approval. | Treat generated native files as expected but inspect them carefully. |
| Reconfirm `appId`, `appName`, and `webDir` before platform setup. | Do not change Bundle ID/product naming without owner confirmation. |
| Run only build/setup checks authorized by that future run. | Do not archive, upload, or submit TestFlight in platform setup. |
| Document native diffs and follow-up blockers. | Do not implement Sign in with Apple, IAP mapping, APNs/Firebase, or listing assets inside platform setup. |

### Final Conclusion For This Readiness Run

`ios-testflight-readiness-run` is complete. The readiness audit selected `ios-capacitor-platform-setup-run` as the first follow-up candidate. That follow-up run has now been registered separately after explicit setup. All implementation, native platform, build/upload, external console, auth, RevenueCat/IAP, Supabase, Android, and production changes remain limited to the explicit scope and guardrails of the new run.

## Follow-Up Active Run Registration

| Field | Value |
| --- | --- |
| Registered date | 2026-06-09 |
| Active run | `ios-capacitor-platform-setup-run` |
| Source candidate | Task 6 from `ios-testflight-readiness-run` |
| Intended scope | Controlled preparation for adding `@capacitor/ios` and generating the Capacitor native iOS platform in separate TODOs. |
| Excluded high-risk areas | Xcode archive/build/upload, TestFlight submission, Apple Developer/App Store Connect changes, RevenueCat/App Store products, Sign in with Apple implementation, auth/Supabase/billing/entitlement changes, Android release changes, production DB/config changes. |

## iOS Capacitor Platform Setup - Task 1 Preflight State

| Field | Value |
| --- | --- |
| Active run | `ios-capacitor-platform-setup-run` |
| Task | `1. iOS setup preflight environment/status check` |
| Status | `DONE` |
| Completed date | 2026-06-09 |
| Method | Read-only command execution and source inspection only. No dependency install, `@capacitor/ios` install, iOS platform add, Capacitor sync, Xcode, pod install, iOS build/archive/upload, external console change, package edit, native edit, config edit, auth, Supabase, billing, RevenueCat, entitlement, Android release, or production action was executed. |

### Commands Executed

| Command | Result |
| --- | --- |
| `git status --short` | Clean working tree before documentation edits. |
| `git branch --show-current` | `main` |
| `git rev-parse --abbrev-ref --symbolic-full-name @{u}` | Equivalent command executed with quoted `@{u}` for PowerShell parsing; result `origin/main`. |
| `git rev-list --left-right --count HEAD...@{u}` | Equivalent command executed with quoted `@{u}` for PowerShell parsing; result `0/0`. |
| `node -v` | `v24.15.0` |
| `npm -v` | `11.12.1` |
| `npm.cmd ls @capacitor/core @capacitor/android @capacitor/ios` | `@capacitor/core@8.3.3` and `@capacitor/android@8.3.3` installed; `@capacitor/ios` not present in the package tree output. |

### Git And Package State

| Check | State |
| --- | --- |
| Branch | `main` |
| Upstream | `origin/main` |
| Ahead/behind | `0/0` |
| Working tree before docs edit | Clean |
| `package.json` / `package-lock.json` | No changes made in this task. |
| `@capacitor/core` | Installed at `8.3.3`. |
| `@capacitor/android` | Installed at `8.3.3`. |
| `@capacitor/ios` | Not installed / not present in `package.json`, `package-lock.json`, or `npm.cmd ls` output. |

### Capacitor Config State

| Setting | Current value | Source |
| --- | --- | --- |
| `appId` | `com.staronlabs.chartradar` | `capacitor.config.ts` |
| `appName` | `Chart Radar` | `capacitor.config.ts` |
| `webDir` | `mobile-shell` | `capacitor.config.ts` |

### iOS Platform State

| Check | State |
| --- | --- |
| `ios/` directory | Missing |
| Native iOS project | Missing because `ios/` is absent. |
| iOS setup readiness | Not ready for platform generation until the next dependency planning/install TODOs are completed. |

### Handoff To Task 2

- Confirm the exact `@capacitor/ios` version needed to match the current Capacitor `8.3.3` packages.
- Select the install command without installing in Task 2.
- Keep `package.json`, `package-lock.json`, `capacitor.config.ts`, Android native/release files, auth/Supabase/billing/RevenueCat/entitlement code, and production settings unchanged until a later TODO explicitly allows changes.

## iOS Capacitor Platform Setup - Task 2 Dependency Candidate

| Field | Value |
| --- | --- |
| Active run | `ios-capacitor-platform-setup-run` |
| Task | `2. Confirm @capacitor/ios install need and command` |
| Status | `DONE` |
| Completed date | 2026-06-09 |
| Method | `package.json`, `package-lock.json`, and npm package-tree inspection only. No dependency install, package edit, lockfile edit, iOS platform add, Capacitor sync, Xcode, pod install, iOS build/archive/upload, external console change, auth, Supabase, billing, RevenueCat, entitlement, Android release, or production action was executed. |

### Current Capacitor Package State

| Package or file | Current state |
| --- | --- |
| `package.json` `dependencies` | `@capacitor/core` is declared as `^8.3.3`. |
| `package.json` `devDependencies` | `@capacitor/android` and `@capacitor/cli` are declared as `^8.3.3`. |
| `package.json` iOS dependency | `@capacitor/ios` is not declared. |
| `package-lock.json` lockfile version | `3`. |
| `package-lock.json` Capacitor lock state | `@capacitor/core` and `@capacitor/android` are locked at `8.3.3`; no `node_modules/@capacitor/ios` entry is present. |
| `npm.cmd ls @capacitor/core @capacitor/android @capacitor/ios` | `@capacitor/core@8.3.3` and `@capacitor/android@8.3.3` are installed; `@capacitor/ios` is absent. |
| Existing iOS scripts | No iOS add/sync/open/build script was found in `package.json`; existing mobile scripts are Android-focused. |

### Add Need Assessment

| Check | Assessment |
| --- | --- |
| Is `@capacitor/ios` needed? | Yes. The repo cannot generate or maintain a Capacitor native iOS project without the iOS platform package. |
| Should the version match current Capacitor packages? | Yes. Use `8.3.3` to match `@capacitor/core`, `@capacitor/android`, and `@capacitor/cli`. |
| Should it be installed in this TODO? | No. This TODO only selects the dependency candidate and command. |
| Should `npx cap add ios` run in this TODO? | No. Platform generation is a later TODO after dependency install and preflight checks. |

### Dependency Location Decision

| Decision | Basis |
| --- | --- |
| Add `@capacitor/ios` to `devDependencies`. | `@capacitor/android` and `@capacitor/cli` are currently in `devDependencies`, so the platform package should follow the existing project convention. |
| Do not add to `dependencies` in the current plan. | `@capacitor/core` is runtime-facing and already in `dependencies`; platform packages follow the Android precedent in `devDependencies`. |

### Selected Install Candidate For TODO 3

| Item | Candidate |
| --- | --- |
| Version | `@capacitor/ios@8.3.3` |
| Command | `npm.cmd install @capacitor/ios@8.3.3 --save-dev` |
| Expected package files | `package.json` and `package-lock.json` only. |
| Expected dependency section | `devDependencies` |

### TODO 3 Guardrails

- Install exactly `@capacitor/ios@8.3.3`.
- Do not upgrade `@capacitor/core`, `@capacitor/android`, `@capacitor/cli`, or unrelated packages.
- Review `package.json` and `package-lock.json` diff before committing.
- Stop if npm attempts a broader dependency churn, major version change, package manager change, or protected-path change.
- Do not run `npx cap add ios`, `npx cap sync ios`, Xcode, pod install, build/archive/upload, external console actions, auth/Supabase/billing/RevenueCat/entitlement changes, Android release changes, or production actions in TODO 3 unless explicitly scoped later.

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

Tasks 1 through 6 are complete. `ios-testflight-readiness-run` is DONE. The selected first follow-up candidate is `ios-capacitor-platform-setup-run`, and it has now been opened as the current active run after explicit setup. iOS platform, dependency, native-file, build/upload, external console, auth, billing, RevenueCat, Supabase, Android, and production configuration work remains constrained by that run's per-TODO guardrails.
