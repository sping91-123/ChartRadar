"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Bitcoin, ChevronDown, Loader2, TrendingUp } from "lucide-react";
import { savePreferredMarket, type PreferredMarket } from "@/lib/marketPreference";

type HeaderMarket = "crypto" | "stocks";

const marketOptions: Array<{
  key: PreferredMarket;
  label: string;
  description: string;
  href: string;
}> = [
  { key: "coin", label: "Coin Radar", description: "BTC/ETH, 알트, 코인 뉴스", href: "/crypto/home" },
  { key: "global", label: "Global Radar", description: "미국장, 글로벌 자산, 일정", href: "/global" }
];

function marketFromHeader(market?: HeaderMarket): PreferredMarket | null {
  if (market === "crypto") return "coin";
  if (market === "stocks") return "global";
  return null;
}

function CoinRadarSymbol() {
  return (
    <span
      className="relative grid h-full w-full place-items-center overflow-hidden rounded-ui-sm bg-slate-950"
      aria-hidden
    >
      <span className="absolute left-1.5 top-1.5 h-5 w-5 rounded-full border border-amber-200/45 bg-amber-400/25 shadow-[0_0_14px_rgba(245,158,11,0.25)]" />
      <span className="absolute bottom-1.5 right-1.5 grid h-6 w-6 place-items-center rounded-full border border-amber-50/85 bg-[linear-gradient(135deg,#fde68a_0%,#f59e0b_48%,#b45309_100%)] shadow-[0_0_16px_rgba(251,191,36,0.48)]">
        <Bitcoin size={14} strokeWidth={2.7} className="text-slate-950" />
      </span>
    </span>
  );
}

function MarketIcon({ market }: { market?: HeaderMarket }) {
  if (market === "crypto") return <CoinRadarSymbol />;
  if (market === "stocks") return <TrendingUp size={18} aria-hidden />;
  return <span className="text-sm font-semibold">C</span>;
}

export function HeaderMarketSwitcher({ market, subtitle }: { market?: HeaderMarket; subtitle: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [switchingKey, setSwitchingKey] = useState<PreferredMarket | null>(null);
  const switchTimer = useRef<number | null>(null);
  const preferred = marketFromHeader(market);
  const title = market === "crypto" ? "Coin Radar" : market === "stocks" ? "Global Radar" : "Chart Radar";

  useEffect(() => {
    if (preferred) savePreferredMarket(preferred);
  }, [preferred]);

  useEffect(() => {
    setSwitchingKey(null);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, [open]);

  useEffect(() => {
    return () => {
      if (switchTimer.current) window.clearTimeout(switchTimer.current);
    };
  }, []);

  const selectMarket = (option: (typeof marketOptions)[number]) => {
    savePreferredMarket(option.key);
    setOpen(false);

    if (option.key === preferred) return;

    setSwitchingKey(option.key);
    if (switchTimer.current) window.clearTimeout(switchTimer.current);
    switchTimer.current = window.setTimeout(() => {
      router.push(option.href);
    }, 520);
  };

  const switchingLabel = switchingKey === "global" ? "글로벌 레이더를 불러오는 중" : "코인 레이더를 불러오는 중";
  const switchingDescription = switchingKey === "global" ? "미국장과 글로벌 자산 흐름을 준비합니다." : "관심 코인과 선물 흐름을 준비합니다.";

  return (
    <div className="relative min-w-0 flex-1">
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          setOpen((value) => !value);
        }}
        className="flex w-full min-w-0 items-center gap-2.5 text-left sm:gap-3"
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <span className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-ui-sm bg-ui-panel text-ui-brand sm:h-10 sm:w-10">
          <MarketIcon market={market} />
        </span>
        <span className="min-w-0 flex-1 overflow-visible">
          <span className="flex min-w-0 items-center gap-1.5 overflow-visible">
            <span className="shrink-0 whitespace-nowrap text-base font-semibold leading-tight tracking-tight text-ui-text sm:text-xl">
              {title}
            </span>
            <ChevronDown size={16} className={`shrink-0 text-ui-muted transition ${open ? "rotate-180" : ""}`} aria-hidden />
          </span>
          <span className="mt-0.5 hidden max-w-[34rem] text-xs leading-4 text-ui-muted sm:block">{subtitle}</span>
        </span>
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute left-0 top-[calc(100%+0.45rem)] z-[70] w-64 overflow-hidden rounded-ui-md border border-ui-line bg-ui-panel/95 p-1 shadow-2xl shadow-black/35 backdrop-blur-xl"
          onClick={(event) => event.stopPropagation()}
        >
          {marketOptions.map((option) => (
            <button
              key={option.key}
              type="button"
              role="menuitem"
              onClick={() => selectMarket(option)}
              className={`block w-full rounded-ui-sm px-3 py-2 text-left transition hover:bg-white/[0.06] ${
                preferred === option.key ? "text-ui-text" : "text-ui-muted"
              }`}
            >
              <span className="block text-sm font-black">{option.label}</span>
              <span className="mt-0.5 block text-xs leading-4">{option.description}</span>
            </button>
          ))}
        </div>
      ) : null}

      {switchingKey ? (
        <div className="pointer-events-none fixed inset-0 z-[120] grid place-items-center bg-black/35 px-6 backdrop-blur-[2px]">
          <div className="w-full max-w-[18rem] rounded-ui-md border border-ui-line bg-ui-panel/95 px-4 py-4 text-center shadow-2xl shadow-black/40">
            <div className="mx-auto grid h-11 w-11 place-items-center rounded-full bg-ui-brand/12 text-ui-brand">
              <Loader2 size={21} className="animate-spin" aria-hidden />
            </div>
            <p className="mt-3 text-sm font-black text-ui-text">{switchingLabel}</p>
            <p className="mt-1 text-xs font-semibold leading-5 text-ui-muted">{switchingDescription}</p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
