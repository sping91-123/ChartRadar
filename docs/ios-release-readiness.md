# iOS release readiness

The repository contains the iOS RevenueCat product mapping, a native `AuthenticationServices` bridge, Sign in with Apple and In-App Purchase capabilities, and server-side Apple refresh-token revocation for account deletion.

Before an iOS release:

1. Fill the iOS RevenueCat public key and Apple server credentials in the deployment environment.
2. Set a random 32-byte base64 `APPLE_TOKEN_ENCRYPTION_KEY` and keep it server-only.
3. Apply and verify the forward account-deletion migration before enabling `ACCOUNT_DELETION_PROCESSING_ENABLED=true`.
4. Run `npm.cmd run check:ios-billing` and resolve every failure.
5. On macOS, select the real Apple Developer Team, confirm Sign in with Apple and IAP capabilities, archive the app, and upload it to TestFlight.
6. With a disposable sandbox account, test Apple login, purchase, restore, logout, deletion request, Apple token revocation, and final hard deletion.

Windows checks cannot prove signing, StoreKit product availability, archive validity, or App Store Connect offering configuration. Those remain mandatory release gates.

## 2026-07-17 automated gate result

`npm.cmd run check:ios-billing` currently fails on exactly seven external conditions:

1. `NEXT_PUBLIC_REVENUECAT_IOS_API_KEY`
2. `APPLE_TEAM_ID`
3. `APPLE_KEY_ID`
4. `APPLE_CLIENT_ID`
5. `APPLE_PRIVATE_KEY`
6. `APPLE_TOKEN_ENCRYPTION_KEY`
7. Xcode `DEVELOPMENT_TEAM`

The repository-side product model, Apple native bridge, nonce/ID-token exchange, IAP and Sign in with Apple entitlements, server credential encryption, and deletion-time token revocation are implemented. Do not put the private key or token encryption key in any `NEXT_PUBLIC_` variable.

iOS push notifications are not part of this release-ready claim: the current push implementation is Android-only and the iOS target does not declare `aps-environment`. Either omit push from the iOS listing/reviewer claim or implement and verify APNs/Firebase plus the capability in a separate release task.

Completion still requires a Mac with Xcode, a valid Apple Developer Team, certificates/provisioning, App Store Connect IAP products, RevenueCat iOS offering mapping, archive validation, and a disposable TestFlight sandbox flow for login, purchase, restore, logout, deletion request, Apple token revocation, and hard deletion.
