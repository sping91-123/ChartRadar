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
| 4 | TODO | Safe local build command candidate selection | What command would be safest if a build becomes allowed? | Command candidate and stop conditions. |
| 5 | TODO | Local build execution decision | Should this run execute a build or close blocked? | Build decision record; no archive/upload. |
| 6 | TODO | Readiness result documentation | What are the final blockers and next run? | Final readiness conclusion and one follow-up candidate. |

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

TODO 3 is complete. The current local iOS build path is `BLOCKED` on this Windows machine due to OS/Xcode/CLT/signing/SPM blockers, and the next task is `4. Safe local build command candidate selection`. No local build, Xcode, signing, Apple console, native project edit, auth, billing, RevenueCat, Supabase, Android, or production configuration change has been authorized.
