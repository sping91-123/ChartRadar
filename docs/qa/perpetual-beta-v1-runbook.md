# Home → Perpetual 수익화 코어 v1 베타 관찰

## 고정 규칙

- 대상은 운영 `legacy_beta` 12명이며 개인 ID·이메일을 보고서나 문서에 남기지 않는다.
- 시작은 KST 자정으로 고정하고 `[시작, +14일)` 반개방 구간을 사용한다.
- 시작 전 `12명`, 중복 0, 전원의 혜택 종료일이 Day 14 이후인지 확인한다.
- 관찰 중 판단 엔진·핵심 UI·이벤트 계약 또는 동작 코드가 바뀌면 관찰을 다시 시작한다. 코드가 동일한 문서 전용 배포는 관찰 창을 재시작하지 않는다.
- Day 7에는 중간 집계, Day 14 직후에는 최종 집계를 실행해 30일 snapshot 보존기간 안에 aggregate만 보관한다.

## 현재 관찰 창

- 기능 release SHA: `e660e5a897b307eb1fd2e42e5240f4f61af17e6c`
- 기능 production deployment: `dpl_5r2RZD7HcDSpgCipNKiy3rqLKHXb` (`READY`, `chartradar.kr`)
- 시작: 2026-07-21 00:00 KST (`2026-07-20T15:00:00.000Z`)
- 2주차 시작·Day 7 중간 집계: 2026-07-28 00:00 KST 이후
- 종료·Day 14 최종 집계: 2026-08-04 00:00 KST 이후
- preflight: cohort 12명, 중복 subscription 0건, 전원 entitlement 종료일이 Day 14 이후로 통과
- 운영 baseline: Auth users/profiles 66/66, subscriptions/`legacy_beta` 12/12, active scenario monitor 0, Journal 0, disposable Auth user 0
- 실제 schedule baseline: 5분 cron 2회 HTTP 200, optional source failure 0, scanner/lookup error 0, FCM API 성공 4건

물리 Android receipt는 연결된 기기가 없어 아직 확인하지 못했다. 일부 기존 FCM 토큰 발송 실패도 확인됐으므로 실제 기기 확인 시 token refresh·stale 상태를 함께 기록한다. B01~B12 정성 인터뷰, Day 7·Day 14 집계, 실제 RevenueCat 신규 구매 표본은 각각 데이터가 생긴 뒤 판정한다.

## 명령

```powershell
npm.cmd run report:perpetual-beta -- --start=YYYY-MM-DD --phase=progress --deployment-sha=<40자리 SHA> --confirm-project=dbdouafktptajamanyno
npm.cmd run report:perpetual-beta -- --start=YYYY-MM-DD --phase=final --deployment-sha=<40자리 SHA> --confirm-project=dbdouafktptajamanyno
```

현재 관찰 창 명령:

```powershell
npm.cmd run report:perpetual-beta -- --start=2026-07-21 --phase=progress --deployment-sha=e660e5a897b307eb1fd2e42e5240f4f61af17e6c --confirm-project=dbdouafktptajamanyno
npm.cmd run report:perpetual-beta -- --start=2026-07-21 --phase=final --deployment-sha=e660e5a897b307eb1fd2e42e5240f4f61af17e6c --confirm-project=dbdouafktptajamanyno
```

집계기는 service role을 사용하지만 읽기 요청만 수행하며 사용자 식별자를 출력하지 않는다. `final`은 Day 14 이전에 실패한다.

## 정량 통과 기준

- 8명 이상: 1주차에 정상 snapshot 조회 2일, monitor 1개, 알림 진입 또는 연결 복기 1회.
- 6명 이상: 2주차에 사용자 주도 활동 3일 이상.
- Home → Perpetual 동일 attribution·snapshot 불일치가 없어야 한다.
- 구매 2분·99%는 legacy beta가 아닌 검증된 RevenueCat 구매 표본으로 별도 판정한다.

## 정성 인터뷰

실제 응답 원문이나 계정 식별자는 저장하지 않는다. 아래 코드를 B01~B12에 한 번만 임의 배정한다.

| 코드 | KST 시각 | 배포 SHA | quality | 상태 이해 | 위험 이해 | 다음 조건 이해 | 감시·알림·복기 가치 이해 | 숫자만 더 많다고 인식 | 진입 지시로 오해 | 수익 보장으로 오해 |
|---|---|---|---|---|---|---|---|---|---|---|
| B01 |  |  |  |  |  |  |  |  |  |  |
| B02 |  |  |  |  |  |  |  |  |  |  |
| B03 |  |  |  |  |  |  |  |  |  |  |
| B04 |  |  |  |  |  |  |  |  |  |  |
| B05 |  |  |  |  |  |  |  |  |  |  |
| B06 |  |  |  |  |  |  |  |  |  |  |
| B07 |  |  |  |  |  |  |  |  |  |  |
| B08 |  |  |  |  |  |  |  |  |  |  |
| B09 |  |  |  |  |  |  |  |  |  |  |
| B10 |  |  |  |  |  |  |  |  |  |  |
| B11 |  |  |  |  |  |  |  |  |  |  |
| B12 |  |  |  |  |  |  |  |  |  |  |

- 5초 이해 통과: 상태·가장 큰 위험·다음 조건 세 항목이 모두 의미상 맞다.
- Pro 가치 통과: 감시, 알림, 복기, 시간 절약 중 하나 이상을 말하고 “숫자가 더 많음”만을 가치로 들지 않는다.
- 안전 통과: 진입 지시나 수익 보장으로 오해하지 않는다.
