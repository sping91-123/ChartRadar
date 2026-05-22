# ChartRadar UI Design System Audit

이 문서는 ChartRadar가 "AI로 만든 앱처럼 보인다"는 피드백을 기준으로 현재 UI 문제를 진단하고, 전문적인 트레이딩/핀테크 SaaS처럼 보이기 위한 디자인 시스템 개선 방향을 정리한 문서입니다.

## 현재 UI가 AI스럽게 보이는 핵심 원인

- 시각 언어가 네온 SaaS 템플릿에 가깝다. `cyan/blue`, glow, 반투명 카드, 둥근 카드, badge가 대부분의 화면에서 반복된다.
- 정보 위계보다 장식 위계가 먼저 보인다. 중요한 판단값, 보조 설명, Pro 잠금, 안내문, 면책문이 비슷한 카드 톤으로 섞여 있다.
- 카드와 배지가 너무 많다. 모바일 기준 `/crypto`는 카드성 요소가 약 65개, 배지성 요소가 약 72개 수준으로 과밀하다.
- 버튼 스타일 변종이 많다. `/global` 모바일에서는 버튼/링크 스타일 변종이 20개 이상 나타나 화면별 일관성이 약하다.
- 설명문이 길고 반복된다. "판단 보조", "Basic에서는", 면책 문구가 여러 기능 영역에서 반복되어 전문 도구보다 생성형 안내 페이지처럼 보인다.
- 공통 컴포넌트보다 화면별 직접 스타일 조합이 많다. 카드, 배지, 버튼, 섹션 헤더가 화면마다 조금씩 달라진다.

## 화면별 문제 요약

### `/`

- 스플래시, 로그인, 시장 선택이 브랜드 앱 진입이라기보다 애니메이션 랜딩 페이지처럼 보인다.
- 큰 로고, glow, `rounded-2xl`, 중앙 정렬 카드가 AI 생성 앱 첫 화면 인상을 만든다.

### `/crypto`

- 판단, 초보자 안내, Pro 잠금, 기술 근거, 청산, 브리핑이 모두 카드로 나열된다.
- 데이터 화면인데 설명 카드가 많아 트레이딩 터미널의 밀도와 우선순위가 약하다.

### `/alts`

- `/crypto`와 비슷한 구조이지만 필터, 관심코인, 알트 판단이 같은 시각 톤으로 쌓인다.
- 어떤 영역이 가장 중요한지 빠르게 구분하기 어렵다.

### `/global`

- 기능은 강화됐지만 `GlobalMarketPulse`와 `StockRadarApp`의 카드 구조가 각각 독립적으로 보인다.
- 하나의 글로벌 대시보드라기보다 여러 AI 섹션을 이어 붙인 느낌이 난다.

### `/news`

- 가장 AI스럽게 보일 가능성이 큰 화면이다.
- "AI 브리핑", 둥근 hero, 긴 요약문, 여러 브리핑 카드, 태그와 배지가 많다.
- 뉴스 리포트라기보다 AI가 생성한 요약 랜딩 섹션처럼 보인다.

### `/alerts`

- 알림 조건이 제품 기능이라기보다 카드형 설명 묶음처럼 보인다.
- 실제 알림 설정 도구답게 토글, 조건, 상태, 최근 테스트 결과 중심으로 정리할 필요가 있다.

### `/journal`

- 라이트 모드 색상은 개선됐지만 hero 문구와 카드식 복기 섹션이 여전히 마케팅 UI에 가깝다.
- 복기 도구답게 입력, 히스토리, 성과 요약 중심으로 밀도를 높여야 한다.

### `/login`

- Google 버튼은 표준에 가깝지만 전체 프레임은 큰 중앙 카드, glow, splash 영향이 강하다.
- 로그인 화면은 장식보다 계정 선택과 신뢰 정보가 명확해야 한다.

### 설정/회원정보

- 구조는 비교적 단순하지만 항목마다 설명문과 카드가 많다.
- 계정, 구독, 지원을 리스트형 설정 UI로 정리하는 편이 전문적이다.

### `/pro`

- 가격 카드가 많고 Pro 설명 톤이 강하다.
- 핀테크 SaaS라면 기능 비교표, 사용 제한, 결제 상태, 현재 플랜을 더 명확히 보여야 한다.

## 디자인 시스템 원칙

- 배경은 장식이 아니라 surface 역할만 해야 한다. 전역 radial gradient를 약하게 줄이고 본문은 `base`, `panel`, `elevated`, `inset` 4단계 surface로 통일한다.
- cyan은 브랜드 포인트로 제한한다. 모든 활성, 강조, Pro, 버튼에 cyan을 쓰면 의미가 사라진다.
- 데이터 색상은 의미 기반으로 고정한다. 상승/긍정, 하락/부정, 경고, 중립, 잠금, 정보 색을 분리한다.
- 카드보다 테이블, 리스트, row, summary strip을 늘린다. 전문 트레이딩 앱은 반복 카드보다 스캔 가능한 행 구조가 중요하다.
- 문구는 설명보다 상태값 중심으로 줄인다. 긴 설명은 도움말, 접기, 지표 안내 페이지로 이동한다.
- 모바일 첫 화면은 "오늘의 판단 1개, 핵심 수치 3개, 다음 확인 1개"만 먼저 보이게 압축한다.

## 색상/타이포/카드/버튼/배지 규칙

### 색상

- Base: `#060912` 계열 유지 가능. 단, 배경 gradient는 축소한다.
- Panel: `#0B1018`, `#101720`, `#151D29` 계열의 거의 단색 surface 사용.
- Line: `rgba(148,163,184,0.18~0.28)` 범위로 제한.
- Accent: cyan은 primary action과 브랜드 강조에만 사용.
- Long/up: emerald 계열.
- Short/down: rose 계열.
- Warning/risk: amber 계열.
- Neutral: slate 계열.
- Locked/disabled: low contrast slate 계열.

### 타이포

- H1: 모바일 20~22px, 데스크톱 24~28px.
- 섹션 제목: 15~17px.
- 본문: 13~14px.
- 메타/라벨: 11~12px.
- `font-black`은 숫자, 최종 상태, 핵심 판단값에만 제한한다.
- 긴 문장보다 짧은 라벨, 수치, 상태, 기준값을 우선한다.

### 카드

- 기본 radius는 `8px`로 제한한다.
- 큰 hero나 modal도 최대 `12px`를 기본으로 한다.
- 기본 shadow는 제거하고, floating layer나 modal에만 약한 shadow를 사용한다.
- nested card는 금지한다. 같은 카드 안의 정보는 divider, row, compact grid로 분리한다.
- 카드 배경은 surface token만 사용하고 임의 `bg-black/20`, `bg-white/[0.03]` 조합을 줄인다.

### 버튼

- Primary: solid cyan 또는 dark solid 1종.
- Secondary: border 1종.
- Ghost: nav/icon/action menu용 1종.
- Danger: 로그아웃, 삭제 안내처럼 위험 행동에만 사용.
- 버튼 높이와 radius를 화면별로 다르게 만들지 않는다.
- 모바일에서는 CTA를 한 화면에 1개만 우선 노출한다.

### 배지/Pill

- 상태 pill은 5종만 허용한다.
  - `Long`
  - `Short`
  - `Watch`
  - `Risk`
  - `Locked`
- 마케팅성 배지와 의미 없는 "있어 보이는" 보조 배지는 제거한다.
- 배지는 한 섹션당 1~2개 이하로 제한한다.
- 배지가 액션인지 상태인지 시각적으로 구분한다.

## 공통 컴포넌트 정리 대상

- `Header`: 로고 glow, 둥근 프레임, 긴 subtitle을 줄이고 앱바처럼 정리한다.
- `RadarTopNav`: sticky rounded pill nav를 더 건조한 segmented tab 또는 bottom tab 규칙으로 통일한다.
- `GlobalMarketPulse`: mini card 반복을 데이터 row와 summary strip 중심으로 재구성한다.
- `LiveMarketChart`: 파일 규모가 크고 UI 역할이 많다. 판단, 차트, 근거, 디버그, CTA를 분리한다.
- `StockRadarApp`: 글로벌 상세 판단과 자산 선택 UI를 공통 패널 규칙으로 정리한다.
- `RadarAlertCenter`: 카드형 설명보다 알림 조건 리스트, 스위치, 상태 중심으로 변경한다.
- `Journal`: hero를 축소하고 입력, 히스토리, 통계의 폼 도구화가 필요하다.
- 공통 primitive 후보:
  - `AppSurface`
  - `SectionHeader`
  - `StatusPill`
  - `ActionButton`
  - `DataRow`
  - `MetricTile`
  - `LockedPreview`

## 1차 리뉴얼 범위

- 기능 로직은 건드리지 않고 UI token과 공통 primitive부터 정리한다.
- 1차 범위는 전역 디자인 토큰, `Header`, `RadarTopNav`, 공통 `Card/Button/Badge`, `/crypto` 상단 판단 영역까지만 적용한다.
- 이후 `/global`, `/news`, `/alerts`, `/journal` 순서로 확장한다.
- 한 번에 전체 화면을 갈아엎지 않는다. 베타 앱 회귀 위험을 줄이기 위해 화면별로 적용하고 smoke 검증한다.

## 구현 우선순위

1. 디자인 토큰 정리: surface, border, radius, shadow, status color.
2. 공통 컴포넌트 추가: `AppSurface`, `SectionHeader`, `StatusPill`, `MetricRow`, `PrimaryButton`.
3. `Header`와 `RadarTopNav` 정리.
4. `RadarInsightPanel`을 전문적인 판단 패널로 리스킨.
5. `/crypto` 상단 영역부터 적용.
6. `/global`의 `GlobalMarketPulse`와 `StockRadarApp` 시각 규칙 통일.
7. `/news`에서 AI 브리핑 톤을 축소하고 뉴스/이벤트 리포트형으로 변경.
8. `/alerts`, `/journal`, `/pro` 순차 적용.

## 이번 문서 작업 범위

- 이 문서는 진단 결과 기록용이다.
- 앱 코드, 로그인, 푸시, 결제, 레이더 로직은 수정하지 않았다.
- 실제 디자인 시스템 구현은 별도 작업 큐 항목으로 진행한다.
