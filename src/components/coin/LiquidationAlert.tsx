"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSupabaseAuth } from "@/lib/useSupabaseAuth";
import { isLiquidationAlertKey, liquidationAlertKey, liquidationChangeText, liquidationNextCheck, liquidationPrice, readLiquidationAlertSnapshot, type LiquidationAlertSnapshot } from "@/lib/liquidationAlert";

const button = "inline-flex min-h-11 items-center justify-center rounded-xl border border-ui-line px-4 py-3 text-sm font-semibold";
const time = (value: string) => new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(value));

export function LiquidationAlertContent({ snapshot, deliveryStatus }: { snapshot: LiquidationAlertSnapshot; deliveryStatus?: string }) {
  const { prices, side, pressure, change } = snapshot;
  const long = side === "downsideLongs";
  const low = Math.min(...prices.candles.map(c => c.low));
  const high = Math.max(...prices.candles.map(c => c.high));
  const pad = Math.max((high - low) * 0.12, high * 0.0001);
  const y = (v: number) => 230 - (v - low + pad) / (high - low + 2 * pad) * 200;
  const reference = long ? prices.low : prices.high;
  return <section className="space-y-5" aria-label="청산 압력 알림 당시 기록">
    {deliveryStatus === "failed" || deliveryStatus === "sending" || deliveryStatus === "partial" ? <p role="status" className="rounded-xl border border-ui-line p-3 text-sm">{deliveryStatus === "failed" ? "푸시 발송 실패 · 당시 기록만 저장되었습니다." : deliveryStatus === "partial" ? "일부 기기에만 푸시 발송이 접수되었습니다." : "발송 결과 확인 중 · 당시 기록은 저장되었습니다."}</p> : null}
    <div className="space-y-2">
      <p className="text-xs font-semibold text-ui-brand">알림 당시 기록 · Binance BTC USDT 무기한 선물</p>
      <h1 className="text-xl font-bold">BTC {long ? "하락 시 롱" : "상승 시 숏"} 청산 주의</h1>
      <p className="text-xs text-ui-muted">{time(snapshot.observedAt)} 확인 · 한국시간</p>
    </div>
    <div className="rounded-2xl border border-ui-line bg-ui-panel p-4 space-y-3">
      <p className="text-sm font-semibold text-ui-brand">{liquidationChangeText(pressure, change)}</p>
      {change?.previousAt ? <p className="text-xs text-ui-muted">직전 알림: {time(change.previousAt)}{change.reason === "side_changed" ? " · " + (long ? "숏 쪽 → 롱 쪽" : "롱 쪽 → 숏 쪽") : ""}</p> : null}
      <p className="text-xs text-ui-muted">계정 비율 · 롱 {snapshot.longAccountPercent.toFixed(1)}% / 숏 {snapshot.shortAccountPercent.toFixed(1)}%</p>
      <p className="text-sm leading-6">{long ? "롱 쪽으로 포지션이 치우쳐 가격 하락 시 압력이 커질 수 있습니다." : "숏 쪽으로 포지션이 치우쳐 가격 상승 시 압력이 커질 수 있습니다."}</p>
      <p className="text-xs leading-5 text-ui-muted">앱이 공개 파생상품 자료로 계산한 추정 점수입니다. 청산 확률이나 실제 청산 금액이 아닙니다.</p>
    </div>
    <div className="rounded-2xl border border-ui-line bg-ui-panel p-4 space-y-3">
      <p className="text-xs text-ui-muted">당시 확인 기준 · 직전 1시간 {long ? "저가" : "고가"}</p>
      <p className="text-2xl font-bold tabular-nums">{liquidationPrice(reference)} <span className="text-sm text-ui-muted">USDT</span></p>
      <p className="text-sm leading-6">{liquidationNextCheck(snapshot)}</p>
      <p className="text-xs leading-5 text-ui-muted">당시 확정 15분봉 종가 {liquidationPrice(prices.close)} USDT · {time(prices.closedAt)} 마감</p>
      <p className="text-xs leading-5 text-ui-muted">{long ? "기준 위를 유지하거나 회복하면 당시 하단 이탈 우려는 약해질 수 있습니다." : "기준 아래로 돌아오면 당시 상단 돌파 우려는 약해질 수 있습니다."} 포지션 쏠림 위험이 해소됐다는 뜻은 아닙니다.</p>
    </div>
    <figure className="rounded-2xl border border-ui-line bg-ui-panel p-3">
      <figcaption className="text-sm font-semibold">당시 확정 15분봉</figcaption>
      <svg viewBox="0 0 520 275" role="img" aria-label="직전 1시간 네 개 봉과 마지막 확정봉의 가격 비교" className="mt-2 w-full">
        <rect x="20" y="18" width="288" height="220" fill="#38bdf8" opacity="0.08" />
        <line x1="20" x2="386" y1={y(reference)} y2={y(reference)} stroke="#38bdf8" strokeDasharray="5 4" />
        {prices.candles.map((c, i) => {
          const x = 56 + i * 72, color = c.close >= c.open ? "#34d399" : "#fb7185";
          return <g key={c.time}><line x1={x} x2={x} y1={y(c.high)} y2={y(c.low)} stroke={color} /><rect x={x - 17} width="34" y={Math.min(y(c.open), y(c.close))} height={Math.max(2, Math.abs(y(c.open) - y(c.close)))} fill={color} /></g>;
        })}
        <text x="394" y={y(reference) + 5} fill="#38bdf8" fontSize="16">{liquidationPrice(reference)}</text>
        <text x="20" y="261" fill="#94a3b8" fontSize="14">음영: 기준을 만든 직전 1시간</text>
        <text x="386" y="261" textAnchor="end" fill="#94a3b8" fontSize="14">마지막 봉</text>
      </svg>
      <p className="text-xs leading-5 text-ui-muted">실제 관측한 고가·저가입니다. 확정된 지지·저항이나 손절 가격을 뜻하지 않습니다.</p>
    </figure>
    <p className="text-xs leading-5 text-ui-muted">저장 당시의 확인 기준입니다. 현재 상황과 이후 가격 반응은 최신 분석에서 확인하세요.</p>
    <Link href="/crypto/perpetual?asset=btc" className={button + " w-full bg-ui-brand text-white"}>BTC 현재 분석 보기</Link>
    <Link href="/crypto/perpetual?asset=btc#monitor-condition" className={button + " w-full"}>내 가격·조건으로 알림 설정</Link>
    <Link href="/crypto/alertlist" className={button + " w-full"}>알림 목록으로</Link>
  </section>;
}

export function LiquidationAlert({ eventKey }: { eventKey: string | null }) {
  const { session, user, isLoading } = useSupabaseAuth();
  const [state, setState] = useState<{ key: string; snapshot?: LiquidationAlertSnapshot; deliveryStatus?: string; error?: string }>({ key: "" });
  const [retry, setRetry] = useState(0);
  const requestKey = (user?.id ?? "") + ":" + (eventKey ?? "");
  useEffect(() => {
    if (!session?.accessToken || !isLiquidationAlertKey(eventKey)) return;
    const controller = new AbortController();
    let active = true;
    const timer = setTimeout(() => {
      if (active) setState({ key: requestKey, error: "연결이 지연되고 있습니다. 다시 불러와 주세요." });
      controller.abort();
    }, 8000);
    setState({ key: requestKey });
    void fetch("/api/push-alert-events?market=crypto&event=" + encodeURIComponent(eventKey), {
      headers: { Authorization: "Bearer " + session.accessToken }, cache: "no-store", signal: controller.signal
    }).then(async response => {
      if (!response.ok) throw new Error("알림 기록을 불러오지 못했습니다. 로그인 상태와 연결을 확인해 주세요.");
      const data = await response.json();
      const row = data.events?.[0];
      const snapshot = readLiquidationAlertSnapshot(row?.payload?.auditEvidence?.snapshot?.alert);
      if (!snapshot || row?.rule_id !== "liquidation-pressure" || row?.event_key !== eventKey || liquidationAlertKey(snapshot) !== eventKey)
        throw new Error("이 계정에서 알림 당시 자료를 찾을 수 없습니다.");
      if (active && !controller.signal.aborted) setState({ key: requestKey, snapshot, deliveryStatus: row.delivery_status });
    }).catch((error: Error) => {
      if (active && !controller.signal.aborted) setState({ key: requestKey, error: error.message });
    }).finally(() => clearTimeout(timer));
    return () => { active = false; clearTimeout(timer); controller.abort(); };
  }, [eventKey, requestKey, retry, session?.accessToken]);
  if (!isLiquidationAlertKey(eventKey)) return <p className="py-8">알림 주소가 올바르지 않습니다. <Link href="/crypto/alertlist" className="underline">알림 목록 보기</Link></p>;
  if (isLoading) return <p className="py-8" role="status">로그인 상태를 확인하고 있습니다.</p>;
  if (!session) return <div className="space-y-4 py-8"><h1 className="text-xl font-bold">청산 알림 당시 근거 확인</h1><p className="text-sm text-ui-muted">알림을 받은 계정으로 로그인하면 당시 가격과 변화, 확인 기준을 볼 수 있습니다.</p><Link className={button} href={"/login?returnTo=" + encodeURIComponent("/crypto/liquidation-alert?event=" + encodeURIComponent(eventKey))}>로그인하고 알림 보기</Link></div>;
  if (state.key !== requestKey || (!state.snapshot && !state.error)) return <p className="py-8" role="status">알림 당시 근거를 불러오고 있습니다.</p>;
  if (state.error) return <div className="space-y-4 py-8"><p role="alert">{state.error}</p><button className={button} onClick={() => setRetry(n => n + 1)}>다시 불러오기</button><Link href="/crypto/alertlist" className={button + " ml-2"}>알림 목록</Link></div>;
  return state.snapshot ? <LiquidationAlertContent snapshot={state.snapshot} deliveryStatus={state.deliveryStatus} /> : null;
}
