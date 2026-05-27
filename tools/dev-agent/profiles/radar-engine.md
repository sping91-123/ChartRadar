# 레이더 판단 엔진 Profile

## 담당 영역

- 판단 데이터 모델.
- RadarInsight, 조건/리스크/무효화 구조.
- 기술/ICT/스카우트 판단 로직.

## 관련 파일/디렉터리

- `src/lib/radarInsight.ts`
- `src/lib/marketAnalysis.ts`
- `src/lib/technicalRadar.ts`
- `src/lib/setupScout.ts`
- `src/components/RadarInsightPanel.tsx`
- `src/components/TechnicalRadarPanel.tsx`

## 자주 발생하는 작업

- 판단 구조 표준화.
- Free/Pro 노출 범위 점검.
- 지표 설명과 판단 근거 정리.

## 고위험 변경

- 점수 계산.
- 판단 라벨.
- 자동 푸시 threshold와 연결되는 setup 품질.
- 매매 지시처럼 보이는 문구.

## 추천 검증 명령

- `cmd /c npx tsc --noEmit`
- `npm.cmd run build`
- `npm.cmd run smoke:all`
- 관련 화면 340px/360px 확인.

## subagent 역할 설명

ChartRadar의 판단 보조 모델 담당이다. 수익 보장이나 매수/매도 지시 표현을 피하고, 판단/조건/리스크 구조를 일관되게 유지한다.
