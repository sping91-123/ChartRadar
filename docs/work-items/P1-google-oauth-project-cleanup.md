# P1 Google OAuth 프로젝트 정리

- 상태: `BLOCKED`
- 담당방: 인증 / 계정 / 사용자 데이터
- 인텔리전스: 높음
- 우선순위: P1

## 문제

Google 로그인 후 Google 계정 보안 알림에 ChartRadar가 아니라 Google TV 권한 요청처럼 보이는 경고가 반복됩니다.

## 목표

Google OAuth Client ID, Firebase project, Supabase Google Provider, OAuth consent screen, scope 설정이 ChartRadar 프로젝트로 일관되어 있는지 확인합니다. 유료화 전에는 반드시 다시 정리합니다.

## 완료 기준

- Google 계정 보안 알림에 ChartRadar 앱명/권한으로 표시되는지 확인.
- `NEXT_PUBLIC_GOOGLE_CLIENT_ID`, Firebase 프로젝트, Supabase Google Provider, OAuth consent screen이 ChartRadar 기준으로 일치.
- 잘못된 프로젝트/앱 이름/권한 범위가 있으면 코드 수정 대상과 콘솔 체크리스트를 분리해 기록.

## 보류 사유

OAuth 프로젝트/Google Cloud 설정 확인이 필요하지만, 현재 베타 UX 개선을 우선하기 위해 보류했습니다.

## 재개 조건

- Google Cloud Console, Firebase Console, Supabase Auth Provider 설정을 확인할 수 있는 계정 접근이 준비될 때 재개합니다.
