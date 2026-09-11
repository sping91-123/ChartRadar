"use client";

import { useState } from "react";
import { ActionButton } from "@/components/ui/DesignPrimitives";
import { personalPriceCondition, type PersonalPriceInput, type WatchIntent } from "@/lib/personalMonitor";
import type { MonitorCondition, PerpetualDecisionSnapshot } from "@/lib/perpetualDecisionSnapshot";

export function PersonalPriceMonitor({ snapshot, intent, enabled, actionable, busy, atLimit, upgradeHref, onCreate }: {
  snapshot: PerpetualDecisionSnapshot; intent: WatchIntent; enabled: boolean; actionable: boolean; busy: boolean; atLimit: boolean;
  upgradeHref: string; onCreate: (condition: MonitorCondition, price: PersonalPriceInput) => void;
}) {
  const [price, setPrice] = useState("");
  const [selection, setSelection] = useState<{ intent: WatchIntent; direction: PersonalPriceInput["direction"] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const direction = selection?.intent === intent ? selection.direction : intent === "long" ? "below" : "above";
  return <details className="mt-3 rounded-xl border border-ui-line p-3">
    <summary className="min-h-10 cursor-pointer py-2 text-sm font-semibold text-ui-brand">내가 정한 가격으로 감시 · Coin Pro</summary>
    <p className="mb-3 text-xs leading-5 text-ui-muted">직접 정한 가격 위·아래에서 15분봉이 마감하는지 확인합니다. 순간적인 가격 터치 알림과 다릅니다.</p>
    {!enabled ? <ActionButton tone="secondary" href={upgradeHref}>Coin Pro 가격 감시 보기</ActionButton> : <form className="space-y-3" onSubmit={event => {
      event.preventDefault();
      const input = { threshold: Number(price.replaceAll(",", "").trim()), direction };
      const condition = personalPriceCondition(snapshot, input);
      if (!condition) { setError("0보다 큰 확인 가격을 숫자로 입력해 주세요. 최대 100,000,000 USDT입니다."); return; }
      setError(null); onCreate(condition, input);
    }}>
      <fieldset disabled={busy || !actionable || atLimit} className="space-y-3">
        <label className="block text-xs font-semibold">내 확인 가격 · USDT<input aria-label="내 확인 가격 USDT" inputMode="decimal" value={price} onChange={e => setPrice(e.target.value)} placeholder="직접 정한 가격 입력" maxLength={24} className="mt-1 block min-h-11 w-full rounded-lg border border-ui-line bg-ui-inset px-3 text-sm" /></label>
        <label className="block text-xs font-semibold">알려줄 조건<select aria-label="가격 확인 방향" value={direction} onChange={e => setSelection({ intent, direction: e.target.value as PersonalPriceInput["direction"] })} className="mt-1 block min-h-11 w-full rounded-lg border border-ui-line bg-ui-inset px-3 text-sm"><option value="above">입력한 가격 이상에서 15분봉 마감</option><option value="below">입력한 가격 이하에서 15분봉 마감</option></select></label>
        <button className="min-h-11 w-full rounded-lg bg-ui-brand px-3 text-sm font-bold text-white disabled:opacity-50" type="submit" disabled={!price.trim()}>{busy ? "가격 조건 저장 중" : atLimit ? "저장 한도를 모두 사용했습니다" : !actionable ? "최신 분석 확인 후 설정 가능" : "이 가격 조건 알림 설정"}</button>
      </fieldset>
      <p className="text-xs leading-5 text-ui-muted">확정된 15분봉 종가 · 최대 5분 간격 검사 · 저장 기준 24시간 · 1회 충족 후 종료. 현재 봉에서 이미 확인된 가격은 저장되지 않습니다.</p>
      {error ? <p role="alert" className="text-xs text-ui-risk">{error}</p> : null}
    </form>}
  </details>;
}
