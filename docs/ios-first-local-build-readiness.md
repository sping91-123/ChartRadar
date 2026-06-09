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
| 2 | TODO | iOS project build precondition audit | Is the generated project structurally ready for a Debug build attempt? | Project/scheme/target/signing/SPM/output precondition notes. |
| 3 | TODO | Signing blocker decision | Are missing Team ID/provisioning items blocking local build? | `RUN_ALLOWED` or `BLOCKED` decision basis. |
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

This run is registered. The next task is `1. Local iOS build environment preflight`, and no local build, Xcode, signing, Apple console, native project, auth, billing, RevenueCat, Supabase, Android, or production configuration change has been authorized.
