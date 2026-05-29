# Completed Work History

이 문서는 기존 `docs/work-queue.md`에 누적되어 있던 `DONE` 항목을 보존하기 위한 완료 이력입니다. 완료된 작업을 다시 수정해야 하면 기존 항목을 되돌리지 말고 새 TODO를 만듭니다.

| 우선순위 | 작업 | 담당방 | 인텔리전스 | 완료 결과 |
| --- | --- | --- | --- | --- |
| P1 | 신규 실업수당 청구 결과 확인중 문제 | 뉴스 / 매크로 레이더 | 높음 | `6f1e70f` |
| P2 | 글로벌 일정 뉴스 압력 명칭/한글화 | /Global | 중간 | `0f6be13` |
| P3 | UI 디자인 시스템 진단 | UI 디자인 시스템 / 브랜드 리뉴얼 | xhigh | `docs/ui-design-system-audit.md` |
| P4 | 앱 푸시 로그인 후 실제 테스트 후속 | 알림 시스템 | 높음 | 실제 폰에서 알림 권한 팝업 표시 확인, 테스트 푸시 실제 수신 성공. 관련 기록: `21b22a6`, 실기기 테스트 성공 확인 |
| P1 | 알림 테스트 패널 관리자 전용화 또는 제거 | 알림 시스템 | 높음 | 관리자 계정에서만 테스트 패널 표시, 일반 사용자 UI에서는 숨김. `/api/push-test`도 관리자 계정만 허용. `c5e6664` |
| P1 | 설정 화면 전면 페이지화 및 라이트모드 반투명 문제 수정 | 홈 랜딩 / 시장선택화면 | 중간 | 풀스크린 설정 패널, 라이트모드 불투명 surface, 340px/360px 확인 완료 |
| P1 | 글로벌 하단 고정 패널 복구 | /Global | 중간 | 모바일 하단 고정 컨트롤 복구. `e7137f5` |
| P0 | README / 문서 라우팅 정합성 정리 | 개발 메인 | 중간 | README, 모바일 앱 가이드, 출시 체크리스트, 결제 출시 가이드의 현재 라우팅 기준 정리. 완료 커밋: `Sync docs with current routing` |
| P1 | 앱 버전 표시 중앙화 | 홈 랜딩 / 시장선택화면 | 낮음~중간 | `src/lib/appVersion.ts`로 앱 버전 표시값 중앙화. 설정 화면 표시 문구는 `앱 버전 1.0.3 / 빌드 6` 기준. 완료 커밋: `Centralize app version display` |
| P1 | 자동 푸시 운영 진단 화면 또는 관리자용 로그 요약 | 알림 시스템 | 높음 | 관리자 전용 `/api/admin/push-diagnostics`와 알림 화면 관리자 접이식 진단 패널 추가 |
| P2 | 매크로 smoke 구조 개선 | 뉴스 / 매크로 레이더 | 중간~높음 | `/api/macro-calendar` 응답을 우선 검사하고 정적 fallback은 형태 안전성만 확인하도록 조정 |
| P2 | Health API 공개 범위 점검 | 버그 수정 / 긴급 대응 | 중간 | 공개 `/api/health`는 최소 상태만 반환하고 상세 운영 상태는 관리자 전용 `/api/admin/health`로 분리. 완료 커밋: `Limit public health check details` |
| P2 | 세션 저장/refresh token 구조 점검 | 인증 / 계정 / 사용자 데이터 | 높음 | `docs/auth-session-audit.md`에 현재 구조와 refresh token localStorage 위험도, Android/WebView 차이, 후속 secure storage 대안을 기록. corrupt session 정리와 native signOut 실패 흡수 최소 보정 |
| P2 | 글로벌 상단 탭 정렬 균일화 | /Global | 낮음~중간 | 모바일 글로벌 4탭 균등 정렬 적용. `7b14216` |
| P2 | 지표 안내 화면을 카테고리/상세 진입 구조로 개편 | 레이더 판단 엔진 | 중간 | 카테고리 카드와 용어별 아코디언 구조 적용 |
| P2 | 작업 큐 포맷 개선 | 개발 메인 | 중간 | `docs/work-queue.md`를 인덱스화하고 활성 작업과 완료 이력을 `docs/work-items/`로 분리. 완료 커밋: `Reorganize work queue documentation` |
| P1 | pushAlertScanner 구조 분리 | 알림 시스템 | 높음 | 타입, threshold, eligibility, entitlement, preference, duplicate guard, optional source, diagnostics, target, event builder, send, cooldown, scanner, preset, personalization, preset event, generic event helper 분리 완료. 최신 완료 커밋: `f847a7f` |
| P2 | LiveMarketChart 컴포넌트 분리 | 코인 레이더 /crypto | 높음 | 타입/상수/data helper/chart shell/control shell/summary shell/Pro gate/저널 payload/알트 사용량/브리핑 하이라이트/초보자 안내/차트 보조 helper 분리 완료. 최신 완료 커밋: `1295647` |
