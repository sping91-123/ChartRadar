"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSupabaseAuth } from "@/lib/useSupabaseAuth";
import { isRapidMoveEventKey, rapidMoveEventKey, rapidMoveNextCheck, readRapidMoveSnapshot, type RapidMoveSnapshot } from "@/lib/rapidPriceMove";

const price = (value: number) => value.toLocaleString("en-US", { maximumFractionDigits: 2 });
const time = (value: string) => new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(value));
const button = "inline-flex min-h-11 items-center justify-center rounded-xl border border-ui-line px-4 py-3 text-sm font-semibold";

export function RapidMoveAlertContent({ snapshot }: { snapshot: RapidMoveSnapshot }) {
  const symbol = snapshot.symbol.replace("USDT", "");
  const low = Math.min(...snapshot.candles.map((candle) => candle.low));
  const high = Math.max(...snapshot.candles.map((candle) => candle.high));
  const pad = Math.max((high - low) * 0.1, high * 0.0001);
  const y = (value: number) => 270 - (value - low + pad) / (high - low + pad * 2) * 240;
  const step = 540 / snapshot.candles.length;
  const x = (index: number) => 16 + step * (index + 0.5);
  const startIndex = snapshot.candles.length - snapshot.windowMinutes;
  const signedChange = `${snapshot.changePercent > 0 ? "+" : ""}${snapshot.changePercent.toFixed(2)}%`;
  return (
    <section className="space-y-5" aria-label="급등락 알림 당시 기록">
      <div className="space-y-2">
        <p className="text-xs font-semibold text-ui-brand">알림 당시 기록 · Binance USDT 무기한 선물</p>
        <h1 className="text-2xl font-bold">{symbol} {snapshot.windowMinutes}분 {signedChange}</h1>
        <p className="text-sm text-ui-muted">{time(snapshot.observedAt)} 기준 · 한국시간</p>
      </div>
      <div className="rounded-2xl border border-ui-line bg-ui-panel p-4">
        <p className="text-xs text-ui-muted">감지한 봉의 종가</p>
        <p className="mt-1 text-2xl font-semibold tabular-nums">{price(snapshot.endPrice)} <span className="text-sm text-ui-muted">USDT</span></p>
        <p className="mt-2 text-sm leading-6">{rapidMoveNextCheck(snapshot)}</p>
      </div>
      <figure className="overflow-hidden rounded-2xl border border-ui-line bg-ui-panel p-3">
        <figcaption className="px-1 text-sm font-semibold">당시 1분봉 <span className="ml-1 text-xs font-normal text-ui-muted">확정 봉 · 저장된 가격</span></figcaption>
        <svg viewBox="0 0 680 310" role="img" aria-label={`${symbol} 알림 당시 1분봉 차트. ${snapshot.windowMinutes}분 동안 ${signedChange}`} className="mt-2 w-full">
          <rect x={x(startIndex) - step / 2} y="24" width={556 - x(startIndex) + step / 2} height="252" fill="currentColor" className="text-sky-400/10" />
          {[snapshot.priorHigh, snapshot.priorLow].map((value, i) => <line key={i} x1="16" x2="556" y1={y(value)} y2={y(value)} stroke="#94a3b8" strokeDasharray="5 5" />)}
          {snapshot.candles.map((candle, i) => {
            const color = candle.close >= candle.open ? "#34d399" : "#fb7185";
            return <g key={candle.time}><line x1={x(i)} x2={x(i)} y1={y(candle.high)} y2={y(candle.low)} stroke={color} /><rect x={x(i) - step * 0.32} width={step * 0.64} y={Math.min(y(candle.open), y(candle.close))} height={Math.max(1.5, Math.abs(y(candle.open) - y(candle.close)))} fill={color} /></g>;
          })}
          <line x1="16" x2="560" y1={y(snapshot.endPrice)} y2={y(snapshot.endPrice)} stroke="#38bdf8" strokeDasharray="3 3" />
          <text x="566" y={y(snapshot.endPrice) + 5} fill="#38bdf8" fontSize="17">{price(snapshot.endPrice)}</text>
          <text x="16" y="300" fill="#94a3b8" fontSize="15">{new Date(snapshot.candles[0].time * 1000).toLocaleTimeString("ko-KR", { timeZone: "Asia/Seoul", hour: "2-digit", minute: "2-digit", hour12: false })}</text>
          <text x="556" y="300" textAnchor="end" fill="#94a3b8" fontSize="15">감지 시점</text>
        </svg>
        <p className="px-1 text-xs leading-5 text-ui-muted">음영: 감지한 {snapshot.windowMinutes}분 · 회색 점선: 변동 전 30분 고가·저가</p>
      </figure>
      <dl className="grid grid-cols-2 gap-3 text-sm">
        <div><dt className="text-ui-muted">변동 전 고가</dt><dd className="mt-1 font-semibold">{price(snapshot.priorHigh)} USDT</dd></div>
        <div><dt className="text-ui-muted">변동 전 저가</dt><dd className="mt-1 font-semibold">{price(snapshot.priorLow)} USDT</dd></div>
        <div><dt className="text-ui-muted">변동 시작 가격</dt><dd className="mt-1 font-semibold">{price(snapshot.startPrice)} USDT</dd></div>
        <div><dt className="text-ui-muted">분당 평균 거래량</dt><dd className="mt-1 font-semibold">{snapshot.volumeRatio === null ? "비교 자료 없음" : `직전 30분 대비 ${snapshot.volumeRatio.toFixed(2)}배`}</dd></div>
      </dl>
      <p className="text-xs leading-5 text-ui-muted">발생한 가격 변동의 기록입니다. 현재 가격은 달라질 수 있습니다. 위 가격 범위는 직전 관측값이며 향후 지지·저항을 보장하지 않습니다.</p>
      <Link href={`/crypto/perpetual?asset=${symbol.toLowerCase()}`} className={`${button} w-full bg-sky-500 text-slate-950`}>{symbol} 현재 분석 보기</Link>
      <Link href="/crypto/alertlist" className={`${button} w-full`}>알림 목록으로</Link>
    </section>
  );
}

export function RapidMoveAlert({ eventKey }: { eventKey: string | null }) {
  const { session, user, isLoading } = useSupabaseAuth();
  const [state, setState] = useState<{ key: string | null; snapshot: RapidMoveSnapshot | null; error: string | null }>({ key: null, snapshot: null, error: null });
  const [retry, setRetry] = useState(0);
  const requestKey = `${user?.id ?? ""}:${eventKey ?? ""}`;
  useEffect(() => {
    if (!session?.accessToken || !isRapidMoveEventKey(eventKey)) return;
    const controller = new AbortController();
    setState({ key: requestKey, snapshot: null, error: null });
    void fetch(`/api/push-alert-events?market=crypto&event=${encodeURIComponent(eventKey)}`, {
      headers: { Authorization: `Bearer ${session.accessToken}` }, cache: "no-store", signal: controller.signal
    }).then(async (response) => {
      if (!response.ok) throw new Error("알림 기록을 불러오지 못했습니다. 다시 확인해 주세요.");
      const data = await response.json();
      const row = data.events?.[0];
      const snapshot = readRapidMoveSnapshot(row?.payload?.auditEvidence?.snapshot);
      if (!snapshot || row?.event_key !== eventKey || rapidMoveEventKey(snapshot) !== eventKey) throw new Error("이 계정에서 알림 당시 자료를 찾을 수 없습니다.");
      if (!controller.signal.aborted) setState({ key: requestKey, snapshot, error: null });
    }).catch((error) => {
      if (!controller.signal.aborted) setState({ key: requestKey, snapshot: null, error: error.message });
    });
    return () => controller.abort();
  }, [eventKey, requestKey, retry, session?.accessToken]);
  if (!isRapidMoveEventKey(eventKey)) return <p className="py-8">알림 주소가 올바르지 않습니다. <Link href="/crypto/alertlist" className="underline">알림 목록 보기</Link></p>;
  if (isLoading) return <p className="py-8" role="status">로그인 상태를 확인하고 있습니다.</p>;
  if (!session) return <div className="space-y-4 py-8"><h1 className="text-xl font-bold">알림 당시 차트 확인</h1><p className="text-sm text-ui-muted">알림을 받은 계정으로 로그인하면 저장된 차트와 가격을 볼 수 있습니다.</p><Link className={button} href={`/login?returnTo=${encodeURIComponent(`/crypto/price-alert?event=${encodeURIComponent(eventKey)}`)}`}>로그인하고 알림 보기</Link></div>;
  if (state.key !== requestKey || (!state.snapshot && !state.error)) return <p className="py-8" role="status">알림 당시 차트를 불러오고 있습니다.</p>;
  if (state.error) return <div className="space-y-4 py-8"><p role="alert">{state.error}</p><button className={button} onClick={() => setRetry((value) => value + 1)}>다시 불러오기</button><Link href="/crypto/alertlist" className={`${button} ml-2`}>알림 목록</Link></div>;
  return state.snapshot ? <RapidMoveAlertContent snapshot={state.snapshot} /> : null;
}
