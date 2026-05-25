# Vercel 자동 푸시 Cron 운영 점검.

## 2026-05-25 점검 결론.

- `vercel.json`에는 `/api/push-cron` cron 등록이 존재한다.
- `origin/main`의 `vercel.json`에도 동일한 `/api/push-cron` cron 등록이 존재한다.
- 운영 `https://chartradar.kr/api/push-cron?dryRun=1`은 인증 없이 호출하면 `401 Unauthorized`를 반환한다. 즉 production route 자체는 존재하고 인증 가드가 먼저 동작한다.
- `/api/push-cron?dryRun=1` 또는 `?diagnostics=1`은 `CRON_SECRET` 인증을 통과해야 실행되며, dry-run에서는 실제 FCM 발송과 `push_alert_events` 기록을 하지 않는다.
- Vercel Logs에 5월 23일 이후 `/api/push-cron` 호출이 없다면 조건 감지보다는 Vercel Cron 등록, 비활성화, 플랜별 schedule 제한, latest production 반영 여부를 먼저 확인해야 한다.

## 현재 코드 기준 cron 설정.

```json
{
  "path": "/api/push-cron",
  "schedule": "*/5 * * * *"
}
```

같은 `vercel.json`에는 `/api/macro-sync`도 `*/10 * * * *`로 등록되어 있다.

## Vercel Dashboard 확인 순서.

1. Vercel Dashboard에서 ChartRadar 프로젝트를 연다.
2. `Settings` → `Cron Jobs`로 이동한다.
3. `/api/push-cron` 항목이 등록되어 있는지 확인한다.
4. 해당 항목이 `Disabled` 상태가 아닌지 확인한다.
5. schedule이 `*/5 * * * *`로 보이는지 확인한다.
6. `Last Run`, `Next Run`, 최근 실패 상태를 확인한다.
7. `/api/push-cron` 행의 `View Logs`를 눌러 로그를 확인한다.
8. Logs 화면에 `requestPath:/api/push-cron` 필터가 적용되는지 확인한다.
9. 로그 상세에서 status가 `200`, `401`, `503`, timeout 중 무엇인지 확인한다.
10. latest Production Deployment가 현재 GitHub `main`의 `vercel.json`을 포함하는지 확인한다.

## 로그 확인 기준.

- Cron Jobs 화면의 `View Logs` 버튼으로 들어가는 것이 가장 정확하다.
- 일반 Logs에서 직접 검색한다면 `requestPath:/api/push-cron` 필터를 사용한다.
- Vercel Cron 호출은 `vercel-cron/1.0` user agent를 포함한다.
- Cron endpoint가 3xx redirect 또는 cached response로 끝나면 일반 runtime logs에 기대한 형태로 보이지 않을 수 있다.
- `/api/push-cron`은 `dynamic = "force-dynamic"`이고 인증 실패도 JSON `401`을 반환하므로 현재 코드 기준으로 redirect나 cache 가능성은 낮다.

## 플랜과 schedule 제한.

- Vercel 공식 문서 기준 Hobby 플랜은 Cron Job이 하루 1회까지만 허용된다.
- 현재 `/api/push-cron`의 `*/5 * * * *` schedule은 5분 주기이므로 Pro 이상이 필요하다.
- 현재 `/api/macro-sync`의 `*/10 * * * *` schedule도 Hobby 플랜에서는 제한에 걸릴 수 있다.
- 프로젝트가 Hobby이거나 Pro trial이 종료된 경우, 최신 deployment에서 cron 등록이 실패하거나 Cron Jobs 화면에 기대한 schedule이 등록되지 않을 수 있다.

## 안전한 수동 진단 방법.

운영 자동 발송을 피하려면 실제 `/api/push-cron`을 일반 모드로 호출하지 않는다.

PowerShell 예시는 다음과 같다. 실제 비밀값은 출력하거나 커밋하지 않는다.

```powershell
$headers = @{ Authorization = "Bearer <CRON_SECRET>" }
Invoke-RestMethod "https://chartradar.kr/api/push-cron?dryRun=1" -Headers $headers
```

확인할 응답 항목은 다음과 같다.

- `dryRun`이 `true`인지 확인한다.
- `diagnostics.tokenCount`가 0보다 큰지 확인한다.
- `diagnostics.eligibleEventCount`와 `diagnostics.sendTargetTokenCount`를 확인한다.
- `eventDiagnostics[].wouldSend`, `skippedReason`, `targetTokenCount`를 확인한다.
- dry-run 응답에서 `sent`는 실제 발송 수가 아니라 dry-run 결과 기준이므로, 실제 폰 알림 수신 여부 판단에 사용하지 않는다.

## 상태 코드 해석.

- `200`이면 인증과 scanner 실행이 통과한 것이다.
- `401`이면 `CRON_SECRET` Authorization 헤더가 없거나 Vercel Environment Variable과 일치하지 않는 것이다.
- `503`이면 Supabase 관리자 환경변수 또는 실제 발송 모드의 Firebase 메시징 환경변수가 부족한 것이다.
- `5xx` 또는 timeout이면 scanner 내부 fetch, Supabase, 외부 API, 함수 제한을 Logs 상세에서 확인한다.

## 운영 대안.

5분 자동 푸시가 필요하지만 Vercel 플랜 제한으로 Cron이 불가능하면 다음 대안을 별도 작업으로 검토한다.

- Vercel Pro로 전환하고 `*/5 * * * *`를 유지한다.
- Hobby를 유지해야 한다면 운영 자동 푸시는 하루 1회 이하로 축소하고 실시간성은 포기한다.
- 외부 cron, GitHub Actions, Supabase Scheduled Function, Upstash QStash 중 하나로 `/api/push-cron?dryRun=0` 또는 별도 보호 endpoint를 호출한다.
- 대체안을 적용하더라도 `CRON_SECRET`, 중복 발송 방지, dry-run 진단은 유지한다.
