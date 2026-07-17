export interface FuturesBriefSymbolInput {
  symbol: string;
  label: string;
}

export interface FuturesPressureInput {
  symbol: string;
  upsideShortPressure: number;
  downsideLongPressure: number;
}

export interface FuturesFlowInput {
  symbol: string;
  thresholdUsd: number;
  totalLargeNotionalUsd: number;
  imbalancePercent: number;
}

export function futuresPressureScore(report: FuturesPressureInput) {
  return Math.max(report.upsideShortPressure, report.downsideLongPressure);
}

export function futuresFlowStrength(report: FuturesFlowInput) {
  return (report.totalLargeNotionalUsd / Math.max(report.thresholdUsd, 1)) * (1 + Math.abs(report.imbalancePercent) / 100);
}

export function selectFuturesBriefCandidate<
  Pressure extends FuturesPressureInput,
  Flow extends FuturesFlowInput
>(symbols: FuturesBriefSymbolInput[], pressureReports: Pressure[], flowReports: Flow[]) {
  const pressureBySymbol = new Map(pressureReports.map((report) => [report.symbol.toUpperCase(), report]));
  const flowBySymbol = new Map(flowReports.map((report) => [report.symbol.toUpperCase(), report]));
  return symbols
    .map((item, inputIndex) => ({
      ...item,
      inputIndex,
      pressure: pressureBySymbol.get(item.symbol.toUpperCase()),
      flow: flowBySymbol.get(item.symbol.toUpperCase())
    }))
    .filter((candidate) => candidate.pressure)
    .sort((left, right) => {
      const pressureDelta = futuresPressureScore(right.pressure!) - futuresPressureScore(left.pressure!);
      if (pressureDelta !== 0) return pressureDelta;
      const flowPresenceDelta = Number(Boolean(right.flow)) - Number(Boolean(left.flow));
      if (flowPresenceDelta !== 0) return flowPresenceDelta;
      const flowDelta = (right.flow ? futuresFlowStrength(right.flow) : 0) - (left.flow ? futuresFlowStrength(left.flow) : 0);
      if (flowDelta !== 0) return flowDelta;
      return left.inputIndex - right.inputIndex;
    })[0] ?? null;
}
