# iOS First Local Build Readiness

## Scope Status

- Active run: `ios-first-local-build-readiness-run`
- Setup date: 2026-06-10
- Run type: local iOS build readiness audit, blocker decision, and next-run selection.
- This is not a TestFlight upload, archive, App Store submission, Apple Developer mutation, signing setup, or native project edit run.

## Previous Run Reflected

| Item | Status |
| --- | --- |
| Previous active run | `ios-xcode-signing-readiness-run` is `DONE` |
| Bundle ID | `com.staronlabs.chartradar` |
| Signing style | `Automatic` |
| `DEVELOPMENT_TEAM` | Not found |
| `PROVISIONING_PROFILE_SPECIFIER` | Not found |
| `.entitlements` | Not found |
| Sign in with Apple / Push / IAP | HIGH risk |
| Associated Domains | MEDIUM risk |
| First local build/archive/upload | Not run |

## Purpose

- Confirm whether a first local iOS build attempt is possible or should be marked `BLOCKED`.
- Check local environment and build prerequisites before any build command is run.
- Preserve signing, Apple console, native project, auth, billing, RevenueCat, Supabase, Android, and production surfaces.
- Record blockers and the next best run if local build is not ready.

## Operating Rules

- Do not open Xcode.
- Do not change Xcode project settings.
- Do not set Team ID or signing values.
- Do not create certificates, provisioning profiles, Bundle ID/App ID records, or entitlements.
- Do not run archive/upload/TestFlight submission.
- Do not change Apple Developer/App Store Connect, RevenueCat, Supabase, auth, billing, entitlement, Android, or production settings.
- Local build execution is a gated decision. If environment/signing prerequisites are missing, record `BLOCKED`.

## Task Plan

| Order | Status | Task | Main question | Expected output |
| --- | --- | --- | --- | --- |
| 1 | DONE | Local iOS build environment preflight | Is this machine ready to even consider an iOS local build? | OS/Xcode/CLT/SPM/account readiness table. |
| 2 | DONE | iOS project build precondition audit | Is the generated project structurally ready for a Debug build attempt? | Project/scheme/target/signing/SPM/output precondition notes. |
| 3 | DONE | Signing blocker decision | Are missing Team ID/provisioning items blocking local build? | `RUN_ALLOWED` or `BLOCKED` decision basis. |
| 4 | DONE | Safe local build command candidate selection | What command would be safest if a build becomes allowed? | Command candidate and stop conditions. |
| 5 | DONE | Local build execution decision | Should this run execute a build or close blocked? | Build decision record; no archive/upload. |
| 6 | DONE | Readiness result documentation | What are the final blockers and next run? | Final readiness conclusion and one follow-up candidate. |

## Known Blockers At Setup

| Blocker | Status |
| --- | --- |
| macOS/Xcode availability | Unverified |
| Xcode Command Line Tools | Unverified |
| Apple ID / Xcode account login | Manual confirmation required |
| Team ID | Missing / unconfigured |
| Apple Developer membership | Unverified |
| Certificates/provisioning | Unverified |
| Explicit App ID / App Store Connect linkage | Unverified |
| Capabilities/entitlements | Not configured |
| SPM resolution | Unverified |
| First local build | Not run |
| Archive/TestFlight upload | Prohibited |

## TODO 1 Result - Local iOS Build Environment Preflight

Status: `DONE`

Execution date: 2026-06-10

Build decision scope: `NOT_DECIDED` for the run. This TODO only records environment readiness. The environment result itself is `BLOCKED` for local iOS build on this machine because the current OS is Windows, not macOS.

### Commands Checked

| Command | Result | Status |
| --- | --- | --- |
| `git status --short` | Existing untracked `docs/store-listing-assets/` only. | PASS |
| `git branch --show-current` | `main` | PASS |
| `git rev-list --left-right --count HEAD...'@{u}'` | `0 0` | PASS |
| `cmd /c ver` | Microsoft Windows `10.0.26200.8457` | PASS |
| `Get-CimInstance Win32_OperatingSystem` | Microsoft Windows 11 Pro, version `10.0.26200`, build `26200`, 64-bit | PASS |
| `xcodebuild -version` | `xcodebuild` command not found. | BLOCKED |
| `xcode-select -p` | `xcode-select` command not found. | BLOCKED |
| `node -v` | `v24.15.0` | PASS |
| `npm -v` | `11.12.1` | PASS |

### Environment Preflight Table

| Item | Check method | Result | Status | Follow-up |
| --- | --- | --- | --- | --- |
| Branch | `git branch --show-current` | `main` | PASS | Continue docs-only active-run workflow. |
| Upstream sync | `git rev-list --left-right --count HEAD...'@{u}'` | `0 0` | PASS | Branch is synced with upstream at preflight time. |
| Working tree | `git status --short` | Existing untracked `docs/store-listing-assets/` only. | PASS | Leave unrelated untracked assets untouched. |
| OS | `cmd /c ver`, `Get-CimInstance Win32_OperatingSystem` | Windows 11 Pro, not macOS. | BLOCKED | Use a macOS machine for local iOS build checks. |
| Xcode availability | `xcodebuild -version` | Command not found. | BLOCKED | Install/use Xcode on macOS before any iOS build attempt. |
| Command Line Tools | `xcode-select -p` | Command not found. | BLOCKED | Confirm `xcode-select` path on macOS. |
| Apple ID / Xcode account | Automatic check not attempted | No local Xcode account state available in this Windows environment. | NOT_CHECKED | Manually confirm Apple ID login in Xcode on macOS. |
| Apple Developer Team | Manual/account check only | Not checked in this TODO; prior signing audit found no `DEVELOPMENT_TEAM`. | NEEDS_MANUAL_CONFIRMATION | Confirm Team ID and membership before signing/build decisions. |
| SPM resolution | Xcode/macOS dependent | Cannot be checked because Xcode is unavailable here. | BLOCKED | Check SPM dependency resolution from Xcode or `xcodebuild -resolvePackageDependencies` only in an allowed later run on macOS. |
| Node/npm | `node -v`, `npm -v` | Node `v24.15.0`, npm `11.12.1`. | PASS | Useful for web build tooling, but not sufficient for iOS native build. |

### Local iOS Build Environment Judgment

Current local iOS build environment: `BLOCKED`.

Reason: the active workspace is running on Windows 11 Pro. A real local iOS build requires macOS with Xcode and Command Line Tools. `xcodebuild` and `xcode-select` are not available in this environment, so SPM resolution, simulator/device destination discovery, and signing/account checks cannot be validated here.

Apple ID/Xcode account readiness remains `NOT_CHECKED` because it requires Xcode account state on macOS. Team ID, Apple Developer membership, signing certificates, provisioning profiles, capabilities, and App Store Connect linkage remain manual/signing blockers from the prior readiness work.

### Next TODO Blockers

- TODO 2 can still inspect the generated iOS project files and document scheme/target/configuration preconditions.
- Any actual local iOS build remains blocked until a macOS/Xcode environment is available and a later decision TODO explicitly allows a build command.
- SPM resolution should not be attempted in this Windows environment.

No iOS build, archive, upload, Xcode open, signing change, provisioning/certificate creation, entitlements/capabilities creation, Apple console change, native project edit, auth/Supabase/billing/RevenueCat/entitlement edit, Android edit, or production action was executed.

## TODO 2 Result - iOS Project Build Precondition Audit

Status: `DONE`

Execution date: 2026-06-10

Method: source inspection only. No Xcode, `xcodebuild`, `npx cap sync ios`, `npx cap open ios`, pod install, archive, upload, signing change, native file edit, or console change was executed.

### Project And Workspace State

| Item | Current state | Build precondition | Current machine judgment | Follow-up |
| --- | --- | --- | --- | --- |
| Xcode project | `ios/App/App.xcodeproj` exists. | Required for local iOS build. | PASS by file inspection | Confirm from Xcode/macOS before any real build. |
| Project workspace | `ios/App/App.xcodeproj/project.xcworkspace` exists. | Xcode can use the project workspace created by Capacitor. | PASS by file inspection | Actual workspace loading is blocked on Windows. |
| Top-level workspace | No top-level `ios/App/App.xcworkspace` was found. | Not required for the current SPM-based generated project unless later tooling creates one. | PASS by file inspection | Re-check if a future sync/build creates workspace changes. |
| Shared scheme file | No `.xcscheme` file was found by file inspection. | Scheme discovery normally requires Xcode or `xcodebuild -list`. | BLOCKED | Confirm scheme list on macOS/Xcode; expected scheme candidate is `App`. |

### Target, Scheme, And Configuration Candidates

| Item | Current state | Status |
| --- | --- | --- |
| Target candidate | `App` native target exists in `project.pbxproj`. | PASS |
| Product name | `App` | PASS |
| Scheme candidate | `App`, inferred from target/product name. | NEEDS_MANUAL_CONFIRMATION |
| Build configurations | `Debug` and `Release` configurations exist. | PASS |
| Default configuration | `Release` is the default configuration name in project and target configuration lists. | PASS |
| Scheme list command | Not run because Xcode/`xcodebuild` is unavailable and forbidden in this TODO. | BLOCKED |

### Build Configuration State

| Setting | Current value | Status |
| --- | --- | --- |
| `PRODUCT_BUNDLE_IDENTIFIER` | `com.staronlabs.chartradar` | PASS |
| `INFOPLIST_FILE` | `App/Info.plist` | PASS |
| `IPHONEOS_DEPLOYMENT_TARGET` | `15.0` | PASS |
| `TARGETED_DEVICE_FAMILY` | `1,2` | PASS |
| `ASSETCATALOG_COMPILER_APPICON_NAME` | `AppIcon` | PASS |
| `MARKETING_VERSION` | `1.0` | PASS |
| `CURRENT_PROJECT_VERSION` | `1` | PASS |
| `CFBundleDisplayName` | `Chart Radar` | PASS |
| `CFBundleIdentifier` | Build setting reference in `Info.plist`. | PASS |
| `CFBundleShortVersionString` | Build setting reference in `Info.plist`. | PASS |
| `CFBundleVersion` | Build setting reference in `Info.plist`. | PASS |
| URL/deep link entries | No `CFBundleURLTypes` entry was found in `Info.plist`. | NEEDS_MANUAL_CONFIRMATION |

### Signing Preconditions

| Signing item | Current state | Build precondition | Current machine judgment | Follow-up |
| --- | --- | --- | --- | --- |
| `DEVELOPMENT_TEAM` | Not found in `project.pbxproj`. | A valid Team ID is needed for real device signing and likely for managed signing. | BLOCKED | TODO 3 must decide whether local build is blocked until Team ID is set in a separate approved run. |
| `CODE_SIGN_STYLE` | `Automatic` for Debug/Release. | Automatic signing still requires Xcode account/team access. | NEEDS_MANUAL_CONFIRMATION | Confirm on macOS/Xcode. |
| `PROVISIONING_PROFILE_SPECIFIER` | Not found. | Automatic signing may omit this, but signing resolution must succeed in Xcode. | NEEDS_MANUAL_CONFIRMATION | Confirm on macOS/Xcode. |
| Certificates | Not checked in this Windows environment. | Apple Development certificate may be needed for local device builds; simulator builds may avoid some signing needs. | BLOCKED | Confirm in macOS/Xcode or Apple Developer workflow. |
| Provisioning | Not checked in this Windows environment. | Development profile may be needed for device build. | BLOCKED | Confirm after Team ID/account state is known. |

### SPM Dependency Preconditions

The generated iOS project uses Swift Package Manager setup through `ios/App/CapApp-SPM/Package.swift`.

| Item | Current state | Status |
| --- | --- | --- |
| Swift tools version | `5.9` | PASS by file inspection |
| iOS platform in package | `.iOS(.v15)` | PASS |
| Capacitor SPM package | `capacitor-swift-pm`, exact `8.3.3` | PASS |
| Local plugin packages | `@capacitor/push-notifications`, `@capawesome/capacitor-google-sign-in`, `@revenuecat/purchases-capacitor` | PASS by file inspection |
| SPM resolution | Not run. Requires macOS/Xcode tooling. | BLOCKED |

SPM resolution remains blocked on the current Windows machine. A later allowed macOS/Xcode run must confirm package resolution before treating the local iOS build path as ready.

### Generated Output Preconditions

Ignored generated outputs are present on disk and are not intended to be staged in this TODO:

| Ignored path | Current state | Build relevance | Status |
| --- | --- | --- | --- |
| `ios/App/App/public/` | Present on disk, ignored by git. | Capacitor web assets for the native shell. | NEEDS_MANUAL_CONFIRMATION |
| `ios/App/App/capacitor.config.json` | Present on disk, ignored by git. | Generated Capacitor native config. | NEEDS_MANUAL_CONFIRMATION |
| `ios/App/App/config.xml` | Present on disk, ignored by git. | Generated Cordova compatibility config. | NEEDS_MANUAL_CONFIRMATION |
| `ios/capacitor-cordova-ios-plugins/` | Present on disk, ignored by git. | Generated Cordova plugin compatibility area. | NEEDS_MANUAL_CONFIRMATION |

These ignored files were not staged or committed by this TODO. A future macOS build-readiness run may need to decide whether `npx cap sync ios` is required before a real build attempt. Sync remains forbidden in this TODO.

### Build Precondition Summary

| Area | Current state | Build before requirement | Current machine judgment | Follow-up |
| --- | --- | --- | --- | --- |
| Project file | `ios/App/App.xcodeproj` exists. | Loadable from Xcode/macOS. | PASS by inspection | Confirm on macOS. |
| Scheme | `App` inferred; no `.xcscheme` found. | Confirm with Xcode scheme list. | BLOCKED | MacOS/Xcode manual or allowed command check. |
| Target/configuration | `App`, `Debug`, `Release`. | Use explicit configuration for any future command. | PASS by inspection | Candidate remains Debug for first local build planning. |
| Signing | Team ID absent, automatic signing, no profile specifier. | Team/account/signing resolution needed. | BLOCKED | TODO 3 signing blocker decision. |
| SPM | SPM package file exists with Capacitor `8.3.3`. | Xcode package resolution needed. | BLOCKED | MacOS/Xcode check in a later allowed run. |
| Generated output | Ignored generated outputs exist on disk. | Confirm freshness or run sync only in an allowed run. | NEEDS_MANUAL_CONFIRMATION | Generated output policy remains a follow-up risk. |
| Environment | Windows 11 Pro, no Xcode/CLT. | macOS/Xcode/CLT required. | BLOCKED | Move build checks to macOS. |

### Blocker Summary For TODO 3

- Current machine is Windows and cannot run Xcode local build checks.
- Xcode and Command Line Tools are absent.
- Scheme list cannot be confirmed because `xcodebuild -list` is unavailable and forbidden in this TODO.
- `DEVELOPMENT_TEAM` is absent.
- Signing certificates and provisioning state are not confirmed.
- SPM dependency resolution cannot be confirmed on this machine.
- Entitlements/capabilities are still absent.
- Ignored generated output freshness is not guaranteed and may require a later explicitly allowed sync/build-readiness step.

TODO 3 should decide whether missing Team ID/signing/provisioning and the Windows environment make the first local build path `BLOCKED` until a macOS/Xcode environment and signing team are available.

## TODO 3 Result - Signing Blocker Decision

Status: `DONE`

Execution date: 2026-06-10

Decision: `BLOCKED`

Method: decision based on TODO 1 environment preflight and TODO 2 project precondition audit. No Xcode, `xcodebuild`, `npx cap sync ios`, `npx cap open ios`, pod install, archive, upload, signing change, native file edit, or console change was executed.

### Blocker Decision Table

| Blocker | Current state | Decision | Basis | Resolution condition |
| --- | --- | --- | --- | --- |
| OS | Current machine is Windows 11 Pro, not macOS. | BLOCKED | iOS local builds require macOS with Xcode tooling. | Move this check to a macOS build environment. |
| Xcode | `xcodebuild` is not available. | BLOCKED | Scheme listing, SPM resolution, simulator/device discovery, and build execution depend on Xcode. | Install/use Xcode on macOS. |
| Command Line Tools | `xcode-select` is not available. | BLOCKED | Xcode command-line path and build toolchain cannot be confirmed. | Confirm `xcode-select -p` on macOS. |
| Apple ID / Xcode account | Not checked in this Windows environment. | BLOCKED | Xcode account state is required for automatic signing validation. | Confirm Apple ID login in Xcode on macOS. |
| Apple Developer membership | Unverified. | BLOCKED | Team and signing assets depend on a valid Apple Developer account. | Confirm membership and account role. |
| Team ID | `DEVELOPMENT_TEAM` not found in the project. | BLOCKED | Automatic signing still needs a team to resolve signing. | Configure Team ID only in a separately approved signing setup run. |
| Signing style | `CODE_SIGN_STYLE` is `Automatic`. | NEEDS_MANUAL_CONFIRMATION | Automatic signing can work only after Xcode account/team state is available. | Confirm automatic signing resolution on macOS. |
| Provisioning profile | `PROVISIONING_PROFILE_SPECIFIER` not found. | NEEDS_MANUAL_CONFIRMATION | This can be normal for automatic signing, but resolution cannot be verified here. | Confirm via Xcode/signing check on macOS. |
| Certificate | Not checked. | BLOCKED | Device builds require valid signing identity; simulator builds still require Xcode tooling. | Confirm Apple Development certificate state on macOS. |
| Explicit App ID | Registration status unverified. | BLOCKED for device/TestFlight path | Bundle ID `com.staronlabs.chartradar` must be available/registered for signing and App Store Connect linkage. | Confirm or create App ID only in a separate Apple Developer run. |
| SPM resolution | Not checked. | BLOCKED | The project uses SPM through `CapApp-SPM/Package.swift`; Windows cannot resolve Xcode packages. | Resolve packages on macOS/Xcode in an allowed run. |
| Scheme list | `App` inferred; actual scheme list not confirmed. | BLOCKED | `xcodebuild -list` was forbidden and unavailable. | Confirm scheme on macOS/Xcode before any build command. |
| Generated outputs | Ignored iOS generated outputs exist on disk; freshness unverified. | NEEDS_MANUAL_CONFIRMATION | Build may need fresh Capacitor copied assets/config, but sync is forbidden in this TODO. | Decide sync/generated output policy in a later allowed run. |
| Capabilities/entitlements | No `.entitlements`; Apple login, Push, IAP capability not configured. | Not first Debug simulator blocker; HIGH for device/TestFlight/review | Some capabilities may not block a basic simulator build, but they block review/readiness and feature-complete iOS testing. | Split into Apple auth, push, IAP, and signing capability runs. |

### Local Build Execution Decision Draft

Current machine local iOS build execution: `BLOCKED`.

Primary reasons:

- The environment is Windows, not macOS.
- Xcode and Command Line Tools are unavailable.
- Scheme listing and SPM resolution cannot be confirmed.
- Apple ID/Xcode account, Apple Developer membership, Team ID, certificate, and provisioning state are unconfirmed.
- `DEVELOPMENT_TEAM` is absent from the generated project.

This run should not execute a local iOS build from the current machine. TODO 4 may still document the safest command candidate for a future macOS/Xcode environment, but the command must remain documentation-only unless a later decision explicitly marks prerequisites ready.

### Debug Build Versus TestFlight/Archive Blockers

| Area | Debug local build relevance | TestFlight/archive relevance | Current decision |
| --- | --- | --- | --- |
| macOS/Xcode/CLT | Required for any local iOS build. | Required for archive/upload workflow. | BLOCKED |
| Scheme confirmation | Required before a safe build command can be trusted. | Required for archive command planning. | BLOCKED |
| SPM resolution | Required before build success can be expected. | Required before archive success can be expected. | BLOCKED |
| Team ID/signing | May be avoidable only for some simulator-only paths, but cannot be validated here. | Required for device/archive/TestFlight signing. | BLOCKED |
| Certificates/provisioning | May be reduced for simulator-only builds, but device/archive needs them. | Required for distribution signing. | BLOCKED |
| Explicit App ID/App Store Connect linkage | Not always needed for simulator-only build. | Required for distribution/TestFlight path. | BLOCKED for archive/TestFlight |
| Sign in with Apple capability | Not necessarily required for a first compile-only simulator build. | HIGH risk for App Review if Google sign-in remains available on iOS. | Separate high-risk follow-up |
| Push/IAP capabilities | Not necessarily required for a first compile-only simulator build. | Required for production feature readiness and review-aligned testing. | Separate high-risk follow-up |
| Generated Capacitor outputs | Required to make native shell load current web assets/config. | Required for archive correctness. | NEEDS_MANUAL_CONFIRMATION |

### TODO 4 Handoff

TODO 4 should document a safe local build command candidate only as a future macOS/Xcode command. It should include stop conditions requiring:

- macOS environment.
- Xcode and Command Line Tools available.
- Confirmed scheme list, likely `App`.
- SPM package resolution available.
- Explicit decision about simulator-only versus device build.
- Signing/team requirements understood before any device/archive path.
- No archive/upload/TestFlight command.

Expected TODO 5 decision remains likely `DO_NOT_RUN / BLOCKED` for the current Windows environment unless the execution environment changes to macOS with Xcode.

## TODO 4 Result - Safe Local Build Command Candidate Selection

Status: `DONE`

Execution date: 2026-06-10

Current machine decision: `BLOCKED / NOT_RUN`

Method: documentation-only command candidate selection. No Xcode, `xcodebuild`, `npx cap sync ios`, `npx cap open ios`, pod install, local build, archive, upload, signing change, native file edit, or console change was executed.

### Command Candidate Table

| Candidate | Command | Purpose | Required preconditions | Current Windows decision | Risk | Earliest allowed point | Prohibited now? |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Environment check | `sw_vers` | Confirm macOS version. | macOS shell. | BLOCKED | LOW | Future macOS preflight run. | Yes on current machine |
| Xcode version check | `xcodebuild -version` | Confirm Xcode build tool availability. | macOS with Xcode installed. | BLOCKED | LOW | Future macOS preflight run. | Yes on current machine |
| Xcode path check | `xcode-select -p` | Confirm active Xcode Command Line Tools path. | macOS with CLT/Xcode configured. | BLOCKED | LOW | Future macOS preflight run. | Yes on current machine |
| Simulator inventory | `xcrun simctl list devices` | Confirm available simulator destinations. | macOS with Xcode simulator runtime. | BLOCKED | LOW | Future macOS preflight run. | Yes on current machine |
| Scheme list | `xcodebuild -list -project ios/App/App.xcodeproj` | Confirm schemes, targets, and configurations before build. | macOS, Xcode, project loadable, SPM parsing available. | BLOCKED | MEDIUM | After environment checks pass. | Yes |
| Debug simulator build | `xcodebuild -project ios/App/App.xcodeproj -scheme App -configuration Debug -sdk iphonesimulator build` | Check whether the iOS project can compile for simulator without device signing. | macOS, Xcode, confirmed `App` scheme, SPM resolved, generated output freshness understood. | BLOCKED | HIGH | Only after TODO 5 or a later run explicitly allows build execution. | Yes |
| Debug simulator build with destination | `xcodebuild -project ios/App/App.xcodeproj -scheme App -configuration Debug -destination "platform=iOS Simulator,name=iPhone 16" build` | Use an explicit simulator destination if available. | Same as Debug simulator build plus confirmed simulator name. | BLOCKED | HIGH | Only after simulator inventory confirms destination and build is allowed. | Yes |
| Generic device build | `xcodebuild -project ios/App/App.xcodeproj -scheme App -configuration Debug -destination "generic/platform=iOS" build` | Check device build readiness. | Team ID, signing identity, provisioning, device/platform signing path. | BLOCKED | HIGH | After signing setup is approved and complete. | Yes |
| Release archive | `xcodebuild -project ios/App/App.xcodeproj -scheme App -configuration Release archive ...` | Create App Store/TestFlight archive. | Distribution signing, App Store Connect linkage, capabilities, archive policy. | FORBIDDEN | HIGH | Separate archive/TestFlight run only. | Yes |
| Upload | Xcode Organizer / Transporter / fastlane / App Store Connect upload commands | Upload build to TestFlight/App Store Connect. | Archive complete, App Store Connect app record, credentials, release approval. | FORBIDDEN | HIGH | Separate upload/TestFlight run only. | Yes |

### Recommended Safe Sequence For A Future macOS Environment

Use this sequence only as a candidate order for a later macOS/Xcode run. It is not approved for the current Windows environment.

1. `sw_vers`
2. `xcodebuild -version`
3. `xcode-select -p`
4. `xcrun simctl list devices`
5. `xcodebuild -list -project ios/App/App.xcodeproj`
6. If and only if TODO 5 or a later run allows build execution, choose one Debug simulator build command:
   - `xcodebuild -project ios/App/App.xcodeproj -scheme App -configuration Debug -sdk iphonesimulator build`
   - `xcodebuild -project ios/App/App.xcodeproj -scheme App -configuration Debug -destination "platform=iOS Simulator,name=iPhone 16" build`

The first actual build candidate should be a Debug simulator build, not a device build, archive, or upload. A simulator build reduces signing exposure but still requires macOS, Xcode, a confirmed scheme, SPM resolution, and generated output readiness.

### Execution Stop Conditions

Do not execute any build command if any of the following is true:

- The environment is not macOS.
- Xcode or Command Line Tools are unavailable.
- `xcodebuild -list` cannot confirm scheme `App`.
- SPM package resolution fails or is not checked.
- Generated Capacitor output freshness is unclear and sync is not explicitly allowed.
- The command targets a generic iOS device without Team ID/signing/provisioning readiness.
- The command is an archive, upload, TestFlight, Transporter, or fastlane command.
- The step would require editing `project.pbxproj`, `Info.plist`, entitlements, signing settings, Apple Developer/App Store Connect, auth, Supabase, billing, RevenueCat, entitlement, Android, or production config.

### Explicitly Forbidden Command Families

These remain out of scope for this run and the next local-readiness decision unless a separate run explicitly approves them:

| Family | Examples | Reason |
| --- | --- | --- |
| Archive | `xcodebuild archive`, Xcode Archive | Requires distribution signing and moves toward TestFlight. |
| Upload | Xcode Organizer upload, Transporter, fastlane upload, App Store Connect upload | TestFlight/App Store delivery is outside this run. |
| Device build | `-destination "generic/platform=iOS"` | Requires signing/provisioning readiness not present now. |
| Project mutation | Xcode signing edits, `DEVELOPMENT_TEAM`, entitlements creation | Native/signing mutation is outside this run. |
| Capacitor sync/open | `npx cap sync ios`, `npx cap open ios` | Sync/open are forbidden in this TODO. |
| Pod/manual native setup | `pod install`, manual SPM/native edits | Project uses SPM; manual native setup is not approved. |

### TODO 5 Decision Criteria

TODO 5 should decide `DO_NOT_RUN / BLOCKED` unless the execution environment has changed to macOS and at least the following are true:

- `sw_vers`, `xcodebuild -version`, and `xcode-select -p` pass.
- `xcodebuild -list -project ios/App/App.xcodeproj` confirms scheme `App`.
- SPM resolution is either confirmed by Xcode or expected to complete during a permitted build step.
- A simulator destination exists or `-sdk iphonesimulator` is sufficient for the chosen command.
- No device build, archive, upload, signing mutation, capability mutation, or console mutation is required.

On the current Windows machine, TODO 5 should keep local build execution as `DO_NOT_RUN / BLOCKED`.

## TODO 5 Result - Local Build Execution Decision

Status: `DONE`

Execution date: 2026-06-10

Local iOS build execution: `DO_NOT_RUN`

Readiness status: `BLOCKED`

Method: decision-only documentation based on TODO 1 through TODO 4. No Xcode, `xcodebuild`, `npx cap sync ios`, `npx cap open ios`, pod install, local build, archive, upload, signing change, native file edit, or console change was executed.

### Final Execution Decision

| Decision item | Result | Basis |
| --- | --- | --- |
| Execute local iOS build now? | `DO_NOT_RUN` | Current machine is Windows, not macOS. |
| Local build readiness status | `BLOCKED` | Xcode, Command Line Tools, scheme confirmation, SPM resolution, signing/team checks, and Apple account checks are unavailable. |
| First safe build family | Debug simulator build only, in a future macOS/Xcode environment. | Simulator build reduces signing exposure but still requires Xcode, scheme confirmation, and SPM resolution. |
| Device build | `DO_NOT_RUN` | Team ID, signing identity, certificate, provisioning, and App ID readiness are not confirmed. |
| Archive/TestFlight upload | `FORBIDDEN` | Distribution signing, App Store Connect linkage, and explicit archive/upload approval are outside this run. |

### Primary Blocker

The primary blocker is the non-macOS execution environment. The current machine is Windows 11 Pro, so it cannot run the Xcode toolchain required for local iOS builds.

### Secondary Blockers

| Blocker | Current state | Required before retry |
| --- | --- | --- |
| Xcode | Not available. | Xcode installed on macOS. |
| Xcode Command Line Tools | Not available. | `xcode-select -p` returns the intended Xcode path. |
| Scheme confirmation | `App` is only an inferred scheme candidate. | `xcodebuild -list -project ios/App/App.xcodeproj` confirms scheme `App`. |
| SPM resolution | Not possible on Windows. | Xcode/SPM can resolve `CapApp-SPM` packages. |
| Apple ID / Xcode account | `NOT_CHECKED`. | Apple ID signed into Xcode if signing/build path requires it. |
| Apple Developer Team ID | `DEVELOPMENT_TEAM` absent. | Team ID confirmed before device/archive paths; any project mutation must be a separate approved run. |
| Signing/provisioning | Certificate and provisioning state unconfirmed. | Confirm signing assets before device build/archive. |
| Explicit App ID / App Store Connect linkage | Unverified. | Confirm before TestFlight/archive path. |
| Generated output freshness | Ignored iOS generated output exists but freshness is unverified. | Decide whether a later allowed `npx cap sync ios` is needed before build. |

### macOS/Xcode Retry Conditions

Only retry local iOS build readiness from a macOS environment. The minimum pre-build sequence should be:

1. Confirm macOS with `sw_vers`.
2. Confirm Xcode with `xcodebuild -version`.
3. Confirm Command Line Tools path with `xcode-select -p`.
4. Confirm simulator availability with `xcrun simctl list devices`.
5. Confirm scheme/target/configuration with `xcodebuild -list -project ios/App/App.xcodeproj`.
6. Confirm SPM package resolution is possible.
7. Decide whether a Debug simulator build is allowed.

Do not attempt device build, archive, upload, TestFlight submission, signing mutation, capability mutation, or Apple Developer/App Store Connect changes as part of a simple local readiness retry.

### Decision For TODO 6

TODO 6 should document the final readiness result as `BLOCKED` for current-machine local iOS build. The likely next follow-up should target either:

- a macOS/Xcode environment handoff for local build readiness, or
- signing/team setup readiness if a macOS environment is available but Team ID/signing remains unresolved.

## TODO 6 Result - Readiness Result Documentation

Status: `DONE`

Execution date: 2026-06-10

Run status: `DONE`

Local iOS build execution: `DO_NOT_RUN`

Readiness result: `BLOCKED`

Method: final documentation only. No Xcode, `xcodebuild`, `npx cap sync ios`, `npx cap open ios`, pod install, local build, archive, upload, signing change, native file edit, or console change was executed.

### Run Summary

| Item | Final result |
| --- | --- |
| Active run | `ios-first-local-build-readiness-run` |
| Overall run status | `DONE` |
| Local build execution | `DO_NOT_RUN` |
| Readiness status | `BLOCKED` |
| Primary blocker | Current machine is Windows, not macOS/Xcode. |
| Build/archive/upload | Not executed. |
| Code/native/config/console changes | None. |
| Next active-run creation | Not created automatically. |

### Readiness Result Table

| Area | Final state | Result | Notes |
| --- | --- | --- | --- |
| Environment | Windows 11 Pro, not macOS. | BLOCKED | iOS local build requires macOS/Xcode. |
| Xcode/CLT | `xcodebuild` and `xcode-select` unavailable. | BLOCKED | Xcode toolchain cannot be checked or run here. |
| Project/scheme | `ios/App/App.xcodeproj` exists; target candidate `App`; scheme candidate `App`. | PARTIAL | Actual scheme list remains blocked without Xcode. |
| Build configuration | Debug/Release exist; Bundle ID `com.staronlabs.chartradar`; deployment target `15.0`. | PASS by inspection | Structural project settings are present. |
| Signing | `DEVELOPMENT_TEAM` absent; signing/provisioning unconfirmed. | BLOCKED | Device/archive paths require signing readiness. |
| SPM | `CapApp-SPM/Package.swift` exists. | BLOCKED | SPM resolution cannot be confirmed on Windows. |
| Generated outputs | Ignored iOS generated outputs exist on disk. | NEEDS_MANUAL_CONFIRMATION | Freshness/sync policy must be decided in a later allowed run. |
| Build command | Safe command candidates documented for future macOS environment. | NOT_RUN | No build command was executed. |
| Archive/upload | Archive, upload, TestFlight, Transporter, fastlane paths remain forbidden. | FORBIDDEN | Separate high-risk run required. |

### Final Blockers

- Current machine is Windows, not macOS.
- Xcode and Xcode Command Line Tools are unavailable.
- Scheme list cannot be confirmed.
- SPM resolution cannot be confirmed.
- Apple ID/Xcode account is `NOT_CHECKED`.
- Apple Developer membership and Team ID are unverified.
- `DEVELOPMENT_TEAM` is absent from the generated Xcode project.
- Signing certificate and provisioning profile state is unconfirmed.
- Explicit App ID `com.staronlabs.chartradar` and App Store Connect linkage are unverified.
- `.entitlements` and capability setup are absent.
- Sign in with Apple, IAP/RevenueCat, and APNs/Firebase iOS readiness remain separate high-risk blockers.

### macOS/Xcode Retry Conditions

Retry local iOS build readiness only after a macOS machine is available. Required preconditions:

1. macOS environment confirmed with `sw_vers`.
2. Xcode installed and confirmed with `xcodebuild -version`.
3. Xcode Command Line Tools selected and confirmed with `xcode-select -p`.
4. Apple ID signed into Xcode if signing/build path requires it.
5. Apple Developer membership and Team ID confirmed.
6. Explicit App ID `com.staronlabs.chartradar` confirmed or created in a separate approved Apple Developer run.
7. Scheme list confirmed with `xcodebuild -list -project ios/App/App.xcodeproj`.
8. SPM resolution confirmed.
9. Debug simulator build decision made separately.

Do not move directly to device build, archive, upload, TestFlight submission, signing mutation, capability mutation, Apple Developer/App Store Connect changes, or RevenueCat/Supabase/auth/billing changes from this run.

### Next Run Candidates

| Candidate | When to choose | Purpose | Risk |
| --- | --- | --- | --- |
| `ios-macos-xcode-environment-setup-run` | No macOS/Xcode build machine is ready. | Prepare/check macOS, Xcode, CLT, simulator, and Xcode account environment before build attempts. | MEDIUM |
| `ios-xcode-team-signing-setup-run` | macOS/Xcode exists but Team ID/signing is unresolved. | Prepare Team ID/signing/certificate/provisioning path without archive/upload. | HIGH |
| `ios-auth-apple-signin-risk-run` | App Review auth risk should be addressed next. | Resolve Sign in with Apple policy/design risk before App Store review. | HIGH |
| `ios-revenuecat-product-mapping-run` | iOS paid subscription readiness is next. | Prepare App Store IAP and RevenueCat iOS product mapping. | HIGH |
| `ios-push-apns-firebase-readiness-run` | iOS alert delivery readiness is next. | Prepare APNs/Firebase iOS push capability and config path. | HIGH |
| `ios-first-local-build-run` | macOS/Xcode, scheme/SPM, and build prerequisites are ready. | Execute the first allowed local Debug simulator build. | HIGH |

Recommended next candidate depends on equipment:

- If no macOS/Xcode machine is available: `ios-macos-xcode-environment-setup-run`.
- If macOS/Xcode is available but signing is not ready: `ios-xcode-team-signing-setup-run`.
- Do not open `ios-first-local-build-run` until macOS/Xcode, scheme confirmation, and SPM readiness are available.

## Build Command Candidate Policy

The likely build command family is:

```powershell
xcodebuild -project ios/App/App.xcodeproj -scheme App -configuration Debug -destination <explicit destination>
```

This is a candidate only. It must not be executed until the run reaches the explicit local-build decision task and records that prerequisites are ready enough. Archive and upload commands are prohibited for this entire run.

## High-Risk Separation

| Area | Status in this run |
| --- | --- |
| Xcode project/signing settings | Readiness audit only; no edits. |
| Apple Developer/App Store Connect | Manual/checklist only; no console changes. |
| Certificates/provisioning | Checklist only; no creation/download. |
| Entitlements/capabilities | Checklist only; no files/toggles. |
| Auth/Supabase | Protected; no edits. |
| Billing/RevenueCat/entitlement | Protected; no edits. |
| Android release | Protected; no edits. |
| Archive/upload/TestFlight | Prohibited. |
| Production DB/config | Protected; no query or mutation. |

## Result Recording Format

Use this format as each TODO completes.

| Field | Value |
| --- | --- |
| Task | `TBD` |
| Status | `TODO` / `DONE` / `BLOCKED` |
| Method | `TBD` |
| Scope inspected | `TBD` |
| Finding summary | `TBD` |
| Build decision | `NOT_DECIDED` / `RUN_ALLOWED` / `BLOCKED` |
| High-risk area implicated? | `No` / Xcode signing / Apple Developer / App Store Connect / entitlements / auth / Supabase / RevenueCat / billing / Android release |
| Recommended follow-up | `TBD` |

## Final Conclusion

The `ios-first-local-build-readiness-run` is complete and `DONE`. Final result: local iOS build execution is `DO_NOT_RUN / BLOCKED` on the current Windows machine. No local build, Xcode, signing, Apple console, native project edit, auth, billing, RevenueCat, Supabase, Android, or production configuration change was authorized or executed.
