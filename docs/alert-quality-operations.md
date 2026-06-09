# Alert Quality Operations

## Scope Status

- Active run: `alert-quality-operations-run`
- Setup date: 2026-06-09
- Run type: audit, documentation, and improvement-candidate selection only.
- Previous run context: Android production auto smoke is complete and recorded as `PASS`.
- Android phone manual QA: intentionally excluded from this run.

This document defines how to review ChartRadar alert quality from an operations perspective. It does not authorize alert implementation changes, real push sends, production DB or token access, FCM changes, Supabase changes, RevenueCat changes, billing changes, Play Console changes, or Android release changes.

## Purpose

- Check whether current alert behavior appears trustworthy to users.
- Identify copy, repetition, Basic/Pro boundary, and routing quality risks.
- Preserve current alert delivery safety while selecting one first improvement candidate.
- Keep implementation in a later, explicitly approved run.

## Background Evidence

- `docs/qa/android-production-qa-results.md` records the automatic smoke set as `PASS`.
- Safe automatic checks included TypeScript, build, lint, `smoke:copy`, `smoke:mobile`, and `smoke:launch`.
- Manual Android production device QA remains `NOT_RUN`.
- Previous alert/push planning docs already identify push scanner, cron, diagnostics, targetPath, duplicate guard, and dry-run boundaries as important alert-operation surfaces.

## Operating Rules

- Use source and document inspection only unless a later task explicitly allows a non-mutating command.
- Do not run `/api/push-cron` in send mode.
- Do not send real or test push notifications.
- Do not inspect, print, copy, insert, delete, or rotate raw push tokens.
- Do not query or mutate production DB records.
- Do not change FCM, Supabase, RevenueCat, billing, Android release, Play Console, or production configuration.
- Do not change alert code, thresholds, cooldown, duplicate guards, targetPath, Pro gates, or copy during this run.

## Audit Surfaces To Inspect Later

These are candidate surfaces for future TODO tasks. Listing them here is not approval to edit them.

| Surface | Why it matters | Guardrail |
| --- | --- | --- |
| Alert generation | Determines what alert event reaches a user and why. | Inspect only; no threshold or event-builder changes. |
| Permission request and app push state | Determines whether a user understands alert availability. | No FCM/native permission changes. |
| Push token save path | Determines whether alert delivery is possible. | Do not expose or mutate tokens. |
| targetPath routing | Determines where a user lands after tapping an alert. | No routing edits or real push-click test. |
| Pro and Basic alert limits | Determines free/paid trust boundary. | No entitlement, billing, RevenueCat, or Supabase RLS edits. |
| Alert settings UI flow | Determines whether users can understand and control alerts. | No UI or persistence changes. |
| Duplicate and cooldown policy | Determines whether alerts feel noisy or repetitive. | No cooldown or push-cron changes. |
| Alert copy | Determines whether alerts read as judgment support rather than trade instruction. | No send logic or live message changes. |

## Task Plan

| Order | Status | Task | Main question | Expected output |
| --- | --- | --- | --- | --- |
| 1 | TODO | Current alert structure audit | How are alerts generated, permissioned, stored, routed, gated, and configured today? | Structure map and protected-surface notes. |
| 2 | TODO | Alert copy quality review | Does alert copy avoid investment instruction, guarantee, urgency, or excessive trading pressure? | Copy-risk findings and wording guardrails. |
| 3 | TODO | Duplicate and cooldown policy review | Can the same user receive too many or repeated alerts? | Repetition/cooldown risk map. |
| 4 | TODO | Basic/Pro alert limit review | Are free and paid alert limits consistent between UI and intended behavior? | Basic/Pro consistency findings. |
| 5 | TODO | targetPath routing quality review | Where should alert taps land, and what should happen for login-required or missing routes? | Routing expectation table. |
| 6 | TODO | Alert improvement candidate selection | What is the one safest first improvement candidate? | One implementation-run candidate with rationale. |

## Out Of Scope

- Real push send.
- Push-click testing.
- Production DB or token lookup.
- Token insertion, deletion, rotation, or exposure.
- FCM, Supabase, RevenueCat, billing, Play Console, Android release, or production config changes.
- App/UI/script/package changes.
- Android phone manual QA.
- Multiple alert improvements at once.

## Result Recording Format

Use this format as each TODO completes.

| Field | Value |
| --- | --- |
| Task | `TBD` |
| Status | `TODO` / `DONE` / `BLOCKED` |
| Scope inspected | `TBD` |
| Finding summary | `TBD` |
| User trust risk | `LOW` / `MEDIUM` / `HIGH` |
| Protected area implicated? | `No` / FCM / Supabase / RevenueCat / billing / Android release / production DB / token |
| Recommended follow-up | `TBD` |
| Implementation allowed in this run? | `No` |

## Initial Conclusion

The run is ready to start with Task 1. The first task should map the current alert structure and stop at documentation. Any code, database, token, push delivery, or external service change must be split into a separate approved run.
