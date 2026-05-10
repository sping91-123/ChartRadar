# Chart Radar

Chart Radar는 코인과 주요 해외주식의 차트 흐름을 빠르게 감지하는 시장 분석 앱입니다.

이 서비스는 투자 자문, 매수·매도 신호, 수익 보장, 자동매매를 제공하지 않습니다. 핵심 가치는 사용자가 시장 구조, 기술지표, 뉴스, 청산 압력, 관심종목 알림을 한 곳에서 반복 확인하도록 만드는 것입니다.

## 핵심 흐름

- 홈 관제실에서 오늘 시장 온도와 주요 변동을 확인합니다.
- `/survival`에서 BTC와 ETH를 중심으로 코인 레이더를 봅니다.
- `/alts`에서 알트코인 감지 후보를 봅니다.
- `/stocks`에서 주요 해외주식과 ETF 흐름을 확인합니다.
- `/news`에서 매크로 전광판과 AI 뉴스 브리핑을 봅니다.
- `/alerts`에서 관심종목 알림 조건을 관리합니다.
- `/pro`에서 Pro 구독 플랜과 사용량 확장 가치를 확인합니다.

## 주요 페이지

- `/` - 오늘의 시장 관제실
- `/survival` - BTC / ETH 레이더
- `/alts` - 알트코인 레이더
- `/stocks` - 해외주식 레이더
- `/news` - 레이더뉴스와 AI 시장 브리핑
- `/alerts` - 알림 센터
- `/journal` - 매매복기
- `/calculator` - 수량 계산
- `/pro` - Pro 구독
- `/terms` - 이용약관
- `/privacy` - 개인정보 처리방침
- `/refund` - 구독 해지와 환불 안내

## 개발

```bash
npm install
npm run dev
```

개발 중 페이지가 스타일 없이 텍스트처럼 보이면 dev 서버가 켜진 상태에서 `npm run build`를 실행한 뒤 `.next` 캐시가 섞인 경우일 수 있습니다. 그럴 때는 서버를 끄고 `.next`를 지운 뒤 다시 `npm run dev`를 실행합니다. 바탕화면의 `차트레이더 서버 켜기.bat`은 이 정리 과정을 포함합니다.

## 검증

```bash
npm run lint
npm run build
```

빌드 검증 후 브라우저에서 계속 개발 화면을 볼 때는 dev 서버를 한 번 재시작합니다.

## 출시 문서

- 웹 결제 연결은 `docs/payment-launch.md`를 봅니다.
- 앱스토어 제출 준비는 `docs/app-store-release.md`를 봅니다.
- 전체 공개 전 점검은 `LAUNCH_CHECKLIST.md`를 봅니다.

필수 환경변수 예시는 `.env.example`에 있습니다.
