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
  { key: "coin", label: "Coin Radar", description: "BTC/ETH, 알트, 코인 매크로", href: "/coin" },
  { key: "global", label: "Global Radar", description: "미국장, 글로벌 자산, 일정", href: "/global" }
];

function marketFromHeader(market?: HeaderMarket): PreferredMarket | null {
  if (market === "crypto") return "coin";
  if (market === "stocks") return "global";
  return null;
}

function MarketIcon({ market }: { market?: HeaderMarket }) {
  if (market === "crypto") return <Bitcoin size={16} aria-hidden />;
  if (market === "stocks") return <TrendingUp size={16} aria-hidden />;
  return <span className="text-xs font-semibold">C</span>;
}

export function HeaderMarketSwitcher({ market, subtitle }: { market?: HeaderMarket; subtitle: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [switchingKey, setSwitchingKey] = useState<PreferredMarket | null>(null);
  const switchTimer = useRef<number | null>(null);
  const preferred = marketFromHeader(market);
  const title = market === "crypto" ? "Coin Radar" : market === "stocks" ? "Global Radar" : "ChartRadar";

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
    }, 260);
  };

  return (
    <div className="relative min-w-0 flex-1">
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          setOpen((value) => !value);
        }}
        className="flex min-w-0 items-center gap-2 text-left sm:gap-2.5"
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-ui-sm border border-ui-line bg-ui-panel text-ui-brand sm:h-8 sm:w-8">
          <MarketIcon market={market} />
        </span>
        <span className="min-w-0">
          <span className="flex min-w-0 items-center gap-1.5">
            <span className="truncate text-[15px] font-semibold leading-tight tracking-tight text-ui-text sm:text-lg">
              {title}
            </span>
            <ChevronDown size={14} className={`shrink-0 text-ui-muted transition ${open ? "rotate-180" : ""}`} aria-hidden />
          </span>
          <span className="mt-0.5 hidden max-w-[34rem] text-[11px] leading-4 text-ui-muted sm:block">{subtitle}</span>
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
        <div className="pointer-events-none fixed inset-x-0 top-0 z-[120]">
          <div className="h-0.5 w-full overflow-hidden bg-ui-line">
            <div className="h-full w-1/2 animate-pulse bg-ui-brand" />
          </div>
          <div className="mx-auto mt-2 flex w-fit items-center gap-2 rounded-full border border-ui-line bg-ui-panel/90 px-3 py-1.5 text-[11px] font-semibold text-ui-text shadow-lg shadow-black/25 backdrop-blur-md">
            <Loader2 size={12} className="animate-spin text-ui-brand" aria-hidden />
            {switchingKey === "global" ? "Global Radar loading" : "Coin Radar loading"}
          </div>
        </div>
      ) : null}
    </div>
  );
}
