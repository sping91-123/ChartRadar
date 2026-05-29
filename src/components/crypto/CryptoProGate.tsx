// 코인 레이더 Pro 잠금 안내와 CTA 표시 shell을 담당하는 컴포넌트입니다.
import Link from "next/link";
import { Crown } from "lucide-react";

interface CryptoProCtaLinkProps {
  size?: "sm" | "md";
}

interface CryptoAltAnalysisGateBannerProps {
  hasCoinPro: boolean;
  allowed: boolean;
  limit: number;
  used: number;
}

interface CryptoAltAnalysisLimitNoticeProps {
  limit: number;
  symbols: string[];
  onSelectSymbol: (symbol: string) => void;
  getSymbolLabel: (symbol: string) => string;
}

export function CryptoProCtaLink({ size = "sm" }: CryptoProCtaLinkProps) {
  const isLarge = size === "md";
  return (
    <Link
      href="/pro?market=crypto"
      className={
        isLarge
          ? "inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-md bg-cyan-300 px-4 text-sm font-black text-slate-950 transition hover:bg-cyan-200"
          : "inline-flex min-h-9 shrink-0 items-center justify-center gap-1.5 rounded-md bg-cyan-300 px-3 text-xs font-black text-slate-950 transition hover:bg-cyan-200"
      }
    >
      <Crown size={isLarge ? 16 : 13} aria-hidden />
      Coin Pro 상세 보기
    </Link>
  );
}

export function CryptoAltAnalysisGateBanner({
  hasCoinPro,
  allowed,
  limit,
  used
}: CryptoAltAnalysisGateBannerProps) {
  return (
    <div className={`mt-3 border-y py-3 ${allowed ? "border-cyan-300/20" : "border-amber-300/35"}`}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className={`text-xs font-black ${allowed ? "text-cyan-200" : "text-amber-200"}`}>
            {hasCoinPro ? "Coin Pro 알트 분석 무제한" : `무료 분석 ${limit}개 중 ${Math.min(used, limit)}개 사용`}
          </p>
          <p className="mt-1 text-xs leading-5 text-slate-400 [word-break:keep-all]">
            {hasCoinPro
              ? "관심 있는 알트코인을 제한 없이 바꿔가며 구조와 브리핑을 확인할 수 있습니다."
              : allowed
                ? `무료에서는 하루 ${limit}개의 알트를 개별 분석할 수 있습니다. 같은 알트는 다시 열어도 차감되지 않습니다.`
                : "오늘 무료 알트 분석을 모두 사용했습니다. Coin Pro에서는 BTC/ETH·알트 리스크와 추적 조건을 반복 확인할 수 있습니다."}
          </p>
        </div>
        {!hasCoinPro ? <CryptoProCtaLink /> : null}
      </div>
    </div>
  );
}

export function CryptoAltAnalysisLimitNotice({
  limit,
  symbols,
  onSelectSymbol,
  getSymbolLabel
}: CryptoAltAnalysisLimitNoticeProps) {
  return (
    <div className="mt-4 border-y border-amber-300/30 py-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-black text-amber-200">오늘 무료 알트 분석 완료</p>
          <h3 className="mt-2 text-2xl font-black text-white">새 알트 상세 판단은 Coin Pro에서 열립니다.</h3>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300 [word-break:keep-all]">
            무료에서는 하루 {limit}개의 알트를 개별 분석할 수 있어요. 이미 확인한 알트는 다시 열 수 있고,
            새로운 알트의 추적 조건과 리스크까지 확인하려면 Coin Pro가 필요합니다.
          </p>
        </div>
        <CryptoProCtaLink size="md" />
      </div>
      {symbols.length > 0 ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {symbols.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => onSelectSymbol(item)}
              className="rounded border border-white/10 bg-black/20 px-2 py-1 text-xs font-black text-slate-200 hover:border-cyan-300/60"
            >
              다시 보기: {getSymbolLabel(item)}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function CryptoDetailScopeNotice({ hasCoinPro }: { hasCoinPro: boolean }) {
  return (
    <div className="border-t border-white/10 py-3 text-sm leading-6 text-slate-100">
      <span className="block text-xs font-semibold text-slate-400">{hasCoinPro ? "근거 상세 범위" : "Basic 공개 범위"}</span>
      <span className="mt-1 block">
        {hasCoinPro
          ? "Pro에서는 아래에서 구조 근거, 기술 근거, 리스크 점검을 이어서 확인합니다."
          : "Basic에서는 방향 요약만 제공합니다. 상세 조건, 무효화 기준, 세부 리스크는 Pro에서 확인할 수 있습니다."}
      </span>
    </div>
  );
}

export function CryptoBasicAltDetailLock() {
  return (
    <div className="mt-3 border-t border-cyan-300/25 pt-3">
      <p className="text-xs font-black text-cyan-100">Coin Pro 상세 판단 보조</p>
      <p className="mt-1 text-sm leading-6 text-slate-300 [word-break:keep-all]">
        Basic에서는 방향 요약만 제공합니다. 무효화 기준, 구체 가격 레벨, AI 브리핑, 세부 리스크는 Coin Pro에서 확인할 수 있습니다.
      </p>
    </div>
  );
}

export function CryptoAiBriefingGateNotice({ isBasicAltView }: { isBasicAltView: boolean }) {
  return (
    <div className="border-y border-cyan-300/20 py-4">
      <p className="text-xs font-black text-cyan-100">Pro 판단 보조</p>
      <h3 className="mt-1 text-lg font-black text-white">
        {isBasicAltView ? "AI 알트 브리핑은 Coin Pro에서 상세 근거로 열립니다." : "AI 레이더 브리핑은 Pro에서 상세 근거로 열립니다."}
      </h3>
      <p className="mt-2 text-sm leading-6 text-slate-300 [word-break:keep-all]">
        {isBasicAltView
          ? "Basic에서는 방향 요약만 제공합니다. 구체 조건, 가격 레벨, 무효화 기준이 포함될 수 있는 AI 상세 브리핑은 Coin Pro에서 확인할 수 있습니다."
          : "Basic에서는 방향 요약만 제공합니다. 구체 조건, 가격 레벨, 무효화 기준이 포함될 수 있는 AI 상세 브리핑은 Pro에서 확인할 수 있습니다."}
      </p>
    </div>
  );
}

export function CryptoMajorDetailGateNotice() {
  return (
    <div className="border-y border-cyan-300/20 py-4">
      <p className="text-sm font-bold text-cyan-100">Pro 상세 판단 보조</p>
      <p className="mt-2 text-sm leading-6 text-slate-300 [word-break:keep-all]">
        Basic에서는 방향 요약만 제공합니다. 구체적인 롱/숏 추적 조건, 무효화 기준, 관찰 구간, 다음 레벨, 세부 리스크는 Pro에서 확인할 수 있습니다.
        이 정보는 투자 권유가 아니라 판단 보조용입니다.
      </p>
    </div>
  );
}
