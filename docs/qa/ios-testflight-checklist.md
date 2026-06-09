# iOS TestFlight Prebuild Checklist

## Scope

- Active run: `ios-testflight-readiness-run`
- Task: `5. TestFlight first-build checklist`
- Date: 2026-06-09
- Purpose: document what must be ready before ChartRadar attempts its first iOS TestFlight build.
- This is a readiness checklist only. It is not approval to add the iOS platform, run Xcode, upload a build, create App Store products, or change external consoles.

## Status Legend

| Status | Meaning |
| --- | --- |
| `READY_TO_CHECK` | Can be checked by the owner or a later run before build work starts. |
| `NEEDS_RUN` | Requires a separate approved run before it can be completed. |
| `BLOCKER` | Blocks the first iOS build or the relevant TestFlight/review path. |
| `NOT_REQUIRED_FOR_INTERNAL_TECH_BUILD` | Can be deferred for a narrow internal technical build if the feature is not tested or submitted for review. |
| `PROHIBITED_IN_THIS_RUN` | Must not be executed or changed during this documentation task. |

## First TestFlight Build Precheck Table

| Area | Item | Current status | Needed action | Risk | Separate run needed? |
| --- | --- | --- | --- | --- | --- |
| Local development environment | macOS availability | Not verified. | Confirm a Mac environment is available for iOS platform setup, Xcode archive, signing, and upload. | HIGH | Yes |
| Local development environment | Xcode installed | Not verified. | Confirm supported Xcode version and App Store Connect upload capability. | HIGH | Yes |
| Local development environment | Xcode Command Line Tools | Not verified. | Confirm tools are installed and selected with `xcode-select` in the build environment. | MEDIUM | Yes |
| Local development environment | CocoaPods | Not verified. | Confirm whether the Capacitor iOS project requires CocoaPods and install only in a build/setup run. | MEDIUM | Yes |
| Local development environment | Node/npm | Existing Windows repo works, but macOS build environment is not checked. | Confirm Node/npm versions and lockfile install behavior on macOS. | MEDIUM | Yes |
| Local development environment | Apple ID login | Not verified. | Confirm Apple ID and App Store Connect role on the Mac/Xcode environment. | HIGH | Yes |
| Capacitor iOS platform | `@capacitor/ios` package | Missing in current dependency tree. | Add dependency only in an approved iOS platform setup run. | BLOCKER | Yes |
| Capacitor iOS platform | `npx cap add ios` | Not run; `ios/` directory is absent. | Add iOS platform only in a separate implementation run. | BLOCKER | Yes |
| Capacitor iOS platform | `npx cap sync ios` | Not run. | Sync after native platform exists and web build output is ready. | BLOCKER | Yes |
| Capacitor iOS platform | Native iOS project | Missing. | Create and inspect `ios/` project in a separate run. | BLOCKER | Yes |
| Capacitor iOS platform | `capacitor.config.ts` app identity | `appId` is `com.staronlabs.chartradar`; `appName` is `Chart Radar`. | Reconfirm before creating Apple Bundle ID or native project. | LOW | No, owner confirmation still needed |
| Apple Developer | Apple Developer Program membership | Not verified. | Confirm membership and account type. | BLOCKER | Yes |
| Apple Developer | Team ID | Not verified. | Confirm Team ID for signing and capabilities. | BLOCKER | Yes |
| Apple Developer | Bundle ID/App ID | Candidate is `com.staronlabs.chartradar`; not created or verified. | Create or confirm explicit App ID after owner approval. | BLOCKER | Yes |
| Apple Developer | Sign in with Apple capability | Need is HIGH if Google/Kakao login ships on iOS. | Decide and configure only after auth follow-up approval. | HIGH | Yes |
| Apple Developer | Push Notifications capability | Candidate capability. | Enable only with iOS push/APNs plan. | HIGH | Yes |
| Apple Developer | In-App Purchase capability | Required for iOS subscriptions. | Enable only with App Store/RevenueCat IAP setup. | HIGH | Yes |
| Apple Developer | Certificates/provisioning profiles | Not verified. | Prepare signing assets in a build/setup run. | BLOCKER | Yes |
| Apple Developer | Signing team in Xcode | Not available because native project is absent. | Configure after `ios/` exists. | BLOCKER | Yes |
| App Store Connect | App record | Not created or verified. | Create app record after Bundle ID is ready. | BLOCKER for upload | Yes |
| App Store Connect | Bundle ID connection | Not connected. | Connect App Store Connect app to explicit Bundle ID. | BLOCKER for upload | Yes |
| App Store Connect | SKU | Not defined. | Owner should choose stable internal SKU. | MEDIUM | Yes |
| App Store Connect | Primary language | Not selected. | Owner should confirm Korean-first or other primary language. | MEDIUM | Yes |
| App Store Connect | Category and age rating | Not finalized. | Complete App Store Connect questionnaire honestly for finance/market-data app. | MEDIUM | Yes |
| App Store Connect | App information | Draft sources exist, final metadata not entered. | Prepare app name, subtitle, description, keywords, copyright, support/contact values. | MEDIUM | Yes |
| App Store Connect | Support URL | Public URL not confirmed. | Confirm reachable production support URL. Email alone is not enough where URL is required. | HIGH | Yes |
| App Store Connect | Privacy policy URL | Existing route `/privacy`; public URL not confirmed. | Confirm production URL before submission. | HIGH | Yes |
| App Store Connect | Marketing URL | Not confirmed. | Decide whether to provide or omit. | LOW | No |
| App Store Connect | Screenshots/app icon | iOS-specific assets not prepared. | Capture/prepare after iOS build path exists. | HIGH for review | Yes |
| Auth readiness | Google/Kakao login on iOS | Current app has Google and web/non-Android Kakao login paths. | Treat Sign in with Apple need as HIGH until resolved. | HIGH | Yes |
| Auth readiness | Supabase Apple provider | Not configured. | Configure only in auth-specific run if Apple login is implemented. | HIGH | Yes |
| Auth readiness | Redirect/deep link behavior | Not verified for iOS WebView/Capacitor. | Test after native iOS project exists. | HIGH | Yes |
| Auth readiness | Duplicate account risk | Google/Kakao/Apple identities may create entitlement ownership issues. | Define account/provider mapping before production auth changes. | HIGH | Yes |
| RevenueCat/IAP readiness | App Store subscription products | Not created or mapped. | Create App Store products only in approved IAP run. | HIGH for paid iOS | Yes |
| RevenueCat/IAP readiness | RevenueCat iOS app/products/offerings/packages | Not configured or verified externally. | Map App Store products to existing entitlements in RevenueCat. | HIGH | Yes |
| RevenueCat/IAP readiness | Entitlement unlock principle | Candidate: same Coin/Global/All Market entitlements across Android and iOS. | Confirm and configure in mapping run. | HIGH | Yes |
| RevenueCat/IAP readiness | Restore purchases UX | Code has restore path, but iOS behavior is unverified. | Test restore with sandbox/TestFlight after product mapping. | HIGH | Yes |
| RevenueCat/IAP readiness | `/pro` iOS copy audit | Android/Google Play wording risk remains. | Audit and adjust iOS-visible purchase copy before review. | MEDIUM-HIGH | Yes |
| Push notification readiness | APNs key/certificate | Not verified. | Prepare APNs setup only in push/iOS platform run. | HIGH | Yes |
| Push notification readiness | Firebase iOS app | Not verified. | Add Firebase iOS app and plist only in approved push/native run. | HIGH | Yes |
| Push notification readiness | `GoogleService-Info.plist` | Missing. | Add only after Firebase iOS app exists; avoid committing secrets unexpectedly. | HIGH | Yes |
| Push notification readiness | Push Notifications capability | Not enabled. | Enable after APNs/Firebase plan. | HIGH | Yes |
| Push notification readiness | Capacitor push plugin iOS readiness | Common plugin exists, but iOS native project is absent. | Verify after `ios/` platform exists. | MEDIUM | Yes |
| Policy/privacy readiness | App Privacy nutrition labels | Not prepared. | Complete data collection/disclosure review before submission. | HIGH | Yes |
| Policy/privacy readiness | Privacy policy URL | Existing route, public URL unconfirmed. | Confirm reachable URL. | HIGH | Yes |
| Policy/privacy readiness | Account deletion access | Existing route `/account/delete`; actual App Review accessibility not manually verified. | Verify in app before submission. | HIGH | Yes |
| Policy/privacy readiness | Support email | `support@staronlabs.com` is the support email. | Use consistently in metadata/support surfaces. | LOW | No |
| Policy/privacy readiness | Inquiry email | `contact@staronlabs.com` is the general inquiry email. | Use only for inquiry/contact context. | LOW | No |
| Policy/privacy readiness | Refund/subscription guide | Existing route `/refund`; public URL unconfirmed. | Confirm URL and iOS-appropriate subscription wording. | MEDIUM | Yes |
| Build/upload readiness | Production web build | Not run in this task. | Run `npm.cmd run build` or agreed build command before sync in future build run. | MEDIUM | Yes |
| Build/upload readiness | Capacitor sync | Not run and prohibited here. | Run after iOS platform exists and web build output is ready. | BLOCKER | Yes |
| Build/upload readiness | Xcode archive | Not possible because native project is absent. | Archive only in build/upload run. | BLOCKER | Yes |
| Build/upload readiness | Signing errors | Not known. | Expect and triage after Team ID/profiles/native project exist. | HIGH | Yes |
| Build/upload readiness | Upload method | Not selected. | Prefer Xcode Organizer for first manual build; consider Transporter/xcodebuild/fastlane only after path is stable. | MEDIUM | Yes |
| TestFlight review readiness | Internal vs external testing | Not decided. | Start with internal technical testing after build path exists; external testing adds Beta App Review. | MEDIUM | Yes |
| TestFlight review readiness | External Beta App Review | Not submitted. | Needed before external testers. | HIGH | Yes |
| TestFlight review readiness | Reviewer account/instructions | Not prepared. | Prepare review notes and safe account path if login is required. | HIGH | Yes |
| TestFlight review readiness | Paid feature testing account | Not prepared. | Needs App Store sandbox/TestFlight IAP setup after product mapping. | HIGH | Yes |
| TestFlight review readiness | Apple login not implemented | Sign in with Apple risk remains HIGH. | Resolve before external TestFlight/App Store review if Google/Kakao login is exposed. | HIGH | Yes |

## Explicitly Prohibited In This Run

- `npm install @capacitor/ios`
- `npx cap add ios`
- `npx cap sync ios`
- `npx cap open ios`
- `pod install`
- `xcodebuild`
- `fastlane`
- Xcode archive
- Transporter or App Store Connect upload
- TestFlight submit
- Apple Developer or App Store Connect changes
- RevenueCat console changes
- App Store subscription product creation
- Supabase Auth provider changes
- Real Google, Kakao, Apple, purchase, or restore tests
- Android release or Play Console changes

## First-Run Blockers

| Blocker | Blocks | Separate run candidate |
| --- | --- | --- |
| `ios/` platform missing | Any native iOS build, Xcode archive, and TestFlight upload. | `ios-capacitor-platform-setup-run` |
| `@capacitor/ios` missing | Capacitor iOS platform setup. | `ios-capacitor-platform-setup-run` |
| Apple Developer membership, Team ID, Bundle ID, signing not verified | App ID creation, signing, archive, upload. | `ios-apple-developer-account-setup-run` |
| App Store Connect app record absent/unverified | TestFlight upload and tester setup. | `ios-app-store-connect-app-record-run` |
| Sign in with Apple risk HIGH | External TestFlight/App Store Review if Google/Kakao login is exposed. | `ios-auth-apple-signin-risk-run` |
| RevenueCat/App Store product mapping incomplete | iOS purchase/restore testing and paid feature review. | `ios-revenuecat-product-mapping-run` |
| APNs/Firebase iOS push not configured | iOS push token and notification QA. | `ios-push-apns-firebase-readiness-run` |
| iOS screenshots/icon missing | App Store/TestFlight review asset readiness. | `ios-store-listing-assets-run` |

## Internal TestFlight Versus External Review

| Scope | What may be enough | What remains blocked |
| --- | --- | --- |
| Internal technical TestFlight build | Native iOS platform, Xcode signing, App Store Connect app record, archive, upload, basic launch path. | Apple login policy, IAP mapping, push, screenshots, privacy labels, and paid feature validation may still be incomplete if not tested or submitted for external review. |
| External TestFlight | Internal build requirements plus Beta App Review information, review notes, support/privacy URLs, and reviewable login path. | Current Sign in with Apple risk and subscription mapping gaps are likely blockers if login or paid features are visible. |
| App Store Review | Full metadata, privacy labels, account deletion access, support URL, IAP products/restore, auth policy compliance, screenshots/icons, and stable signed build. | Do not proceed until high-risk auth/IAP/push/review items are resolved. |

## Handoff To TODO 6

TODO 6 should select exactly one follow-up run. Based on the current checklist, the strongest first technical follow-up candidate is `ios-capacitor-platform-setup-run` because the native iOS platform and `@capacitor/ios` are absent. However, App Store review and paid subscription readiness still require separate high-risk auth and RevenueCat/App Store product mapping runs.
