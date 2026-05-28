"use client";

import { useState } from "react";
import { Activity, AlertTriangle, BarChart3, CheckCircle2, ClipboardPaste } from "lucide-react";

type DirectionText = "bullish" | "bearish" | "neutral" | "unknown";

interface AppStatePayload {
  symbol?: string;
  chartTf?: string;
  mode?: "confirmed" | "aggressive" | string;
  bias?: "long" | "short" | "neutral" | string;
  biasScore?: number;
  structureScore?: number;
  structureDecay?: number;
  msb?: Record<string, DirectionText>;
  choch?: Record<string, DirectionText>;
  oteZone?: "long" | "short" | "none" | string;
  ema200Side?: "above" | "below" | "unknown" | string;
  inFvg?: boolean;
  fvgTf?: string;
  fvgDir?: DirectionText | "none";
  fvgIsIfvg?: boolean;
  fvgTop?: number | null;
  fvgBottom?: number | null;
  cisd?: DirectionText | "none";
}

interface ParsedState {
  payload: AppStatePayload | null;
  error: string;
}

const sampleJson = `{"symbol":"BINANCE:BTCUSDT","chartTf":"15","mode":"confirmed","bias":"long","biasScore":3.5,"structureScore":1.5,"structureDecay":0.75,"msb":{"1m":"bullish","5m":"bullish","15m":"bullish","1h":"bearish","4h":"bullish","1d":"bullish"},"choch":{"1m":"bullish","5m":"bullish","15m":"bullish","1h":"bearish","4h":"bullish","1d":"bullish"},"oteZone":"long","ema200Side":"above","inFvg":true,"fvgTf":"15m","fvgDir":"bullish","fvgIsIfvg":false,"fvgTop":68000,"fvgBottom":67500,"cisd":"none"}`;

function parseAppState(raw: string): ParsedState {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { payload: null, error: "" };
  }

  try {
    const parsed = JSON.parse(trimmed) as AppStatePayload;
    return { payload: parsed, error: "" };
  } catch {
    return {
      payload: null,
      error: "JSON 형식이 올바르지 않습니다. TradingView App State 알림 메시지를 그대로 붙여넣어 주세요."
    };
  }
}

function directionLabel(value?: string) {
  if (value === "bullish") {
    return "상승";
  }
  if (value === "bearish") {
    return "하락";
  }
  if (value === "neutral") {
    return "횡보";
  }
  return "데이터 부족";
}

function getBiasMeta(payload: AppStatePayload | null) {
  if (!payload) {
    return {
      label: "대기 중",
      color: "text-slate-300",
      border: "border-surface-line",
      bg: "bg-surface-card"
    };
  }

  if (payload.bias === "long") {
    return {
      label: "롱 우세",
      color: "text-signal-success",
      border: "border-signal-success/30",
      bg: "bg-signal-success/10"
    };
  }

  if (payload.bias === "short") {
    return {
      label: "숏 우세",
      color: "text-signal-danger",
      border: "border-signal-danger/30",
      bg: "bg-signal-danger/10"
    };
  }

  return {
    label: "횡보",
    color: "text-signal-warning",
    border: "border-signal-warning/30",
    bg: "bg-signal-warning/10"
  };
}

function buildReasons(payload: AppStatePayload) {
  const reasons: string[] = [];

  if (payload.msb?.["4h"]) {
    reasons.push(`4H MSB: ${directionLabel(payload.msb["4h"])}`);
  }
  if (payload.msb?.["1d"]) {
    reasons.push(`1D MSB: ${directionLabel(payload.msb["1d"])}`);
  }
  if (payload.ema200Side === "above") {
    reasons.push("4H EMA200 위");
  }
  if (payload.ema200Side === "below") {
    reasons.push("4H EMA200 아래");
  }
  if (payload.oteZone && payload.oteZone !== "none") {
    reasons.push(`OTE ${payload.oteZone === "long" ? "롱" : "숏"} 존`);
  }
  if (payload.inFvg) {
    reasons.push(`${payload.fvgTf ?? "MTF"} ${payload.fvgIsIfvg ? "iFVG" : "FVG"} 내부`);
  }
  if (payload.cisd && payload.cisd !== "none") {
    reasons.push(`CISD: ${directionLabel(payload.cisd)}`);
  }

  return reasons.length > 0 ? reasons : ["아직 뚜렷한 구조 근거가 부족합니다."];
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-t border-surface-line py-3 first:border-t-0">
      <p className="text-xs font-semibold text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-bold text-white">{value}</p>
    </div>
  );
}

export function ChartStateReader() {
  const [raw, setRaw] = useState("");
  const parsed = parseAppState(raw);
  const payload = parsed.payload;
  const meta = getBiasMeta(payload);
  const reasons = payload ? buildReasons(payload) : [];

  return (
    <section className="border-y border-surface-line py-4 sm:py-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center text-accent-blue">
            <BarChart3 size={21} aria-hidden />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">차트 구조 판독</h2>
            <p className="mt-1 text-sm leading-6 text-slate-400">
              TradingView App State JSON을 붙여넣으면 롱/숏 우세와 구조 근거를 요약합니다.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setRaw(sampleJson)}
          className="min-h-9 shrink-0 rounded-md border border-surface-line bg-surface-cardSoft px-3 text-xs font-bold text-slate-300 hover:border-accent-blue/60 hover:text-white"
        >
          예시 불러오기
        </button>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,0.95fr)_minmax(320px,1.05fr)]">
        <label className="block space-y-2">
          <span className="flex items-center gap-2 text-sm font-semibold text-slate-200">
            <ClipboardPaste size={16} aria-hidden />
            App State JSON
          </span>
          <textarea
            value={raw}
            onChange={(event) => setRaw(event.target.value)}
            rows={10}
            placeholder='{"symbol":"BINANCE:BTCUSDT","bias":"long",...}'
            className="w-full resize-none rounded-md border border-surface-line bg-surface-cardSoft px-4 py-3 text-sm leading-6 text-white outline-none transition placeholder:text-slate-600 focus:border-accent-blue"
          />
          {parsed.error ? (
            <p className="flex items-start gap-2 rounded-md border border-signal-danger/30 bg-signal-danger/10 p-3 text-sm leading-6 text-signal-danger">
              <AlertTriangle className="mt-0.5 shrink-0" size={16} aria-hidden />
              {parsed.error}
            </p>
          ) : null}
        </label>

        <div className={`border-y ${meta.border} py-4`}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold text-slate-400">판독 결과</p>
              <h3 className={`mt-1 text-2xl font-black ${meta.color}`}>{meta.label}</h3>
            </div>
            <Activity className={meta.color} size={28} aria-hidden />
          </div>

          {payload ? (
            <>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <Metric label="심볼" value={payload.symbol ?? "데이터 부족"} />
                <Metric label="차트 TF" value={payload.chartTf ?? "데이터 부족"} />
                <Metric label="모드" value={payload.mode ?? "데이터 부족"} />
                <Metric label="Bias 점수" value={String(payload.biasScore ?? "데이터 부족")} />
                <Metric label="4H EMA200" value={payload.ema200Side === "above" ? "위" : payload.ema200Side === "below" ? "아래" : "데이터 부족"} />
                <Metric label="FVG" value={payload.inFvg ? `${payload.fvgTf ?? ""} ${payload.fvgIsIfvg ? "iFVG" : "FVG"}` : "없음"} />
              </div>

              <div className="mt-4 rounded-md border border-white/10 bg-black/20 p-3">
                <div className="flex items-center gap-2 text-sm font-bold text-white">
                  <CheckCircle2 className="text-accent-blue" size={16} aria-hidden />
                  판독 근거
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {reasons.map((reason) => (
                    <span
                      key={reason}
                      className="rounded-md border border-white/10 bg-black/25 px-2.5 py-1.5 text-sm font-semibold text-slate-200"
                    >
                      {reason}
                    </span>
                  ))}
                </div>
              </div>

              <p className="mt-4 text-xs leading-5 text-slate-500">
                이 판독은 지표 상태값 요약입니다. 실제 진입 전에는 손절 기준과 포지션 크기를 별도로 점검하세요.
              </p>
            </>
          ) : (
            <p className="mt-4 rounded-md border border-white/10 bg-black/20 p-4 text-sm leading-6 text-slate-400">
              지표 설정에서 App State JSON Alert를 켠 뒤 나온 메시지를 붙여넣으면 여기에 구조 요약이 표시됩니다.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
