"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Bitcoin, ChevronDown, Globe2 } from "lucide-react";
import { savePreferredMarket, type PreferredMarket } from "@/lib/marketPreference";

type HeaderMarket = "crypto" | "stocks";

const marketOptions: Array<{
  key: PreferredMarket;
  label: string;
  description: string;
  href: string;
}> = [
  { key: "coin", label: "Coin Radar", description: "BTC/ETH, 알트, 현물 흐름", href: "/coin" },
  { key: "global", label: "Global Radar", description: "미국장, 글로벌 자산, 일정", href: "/global" }
];

function marketFromHeader(market?: HeaderMarket): PreferredMarket | null {
  if (market === "crypto") return "coin";
  if (market === "stocks") return "global";
  return null;
}

function MarketIcon({ market }: { market?: HeaderMarket }) {
  if (market === "crypto") return <Bitcoin size={18} aria-hidden />;
  if (market === "stocks") return <Globe2 size={18} aria-hidden />;
  return <span className="text-sm font-semibold">C</span>;
}

export function HeaderMarketSwitcher({ market, subtitle }: { market?: HeaderMarket; subtitle: string }) {
  const [open, setOpen] = useState(false);
  const preferred = marketFromHeader(market);
  const title = market === "crypto" ? "Coin Radar" : market === "stocks" ? "Global Radar" : "ChartRadar";

  useEffect(() => {
    if (preferred) savePreferredMarket(preferred);
  }, [preferred]);

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, [open]);

  return (
    <div className="relative min-w-0 flex-1">
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          setOpen((value) => !value);
        }}
        className="flex min-w-0 items-center gap-2 text-left sm:gap-3"
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-ui-sm border border-ui-line bg-ui-panel text-ui-brand sm:h-9 sm:w-9">
          <MarketIcon market={market} />
        </span>
        <span className="min-w-0">
          <span className="flex min-w-0 items-center gap-1.5">
            <span className="truncate text-[15px] font-semibold leading-tight tracking-tight text-ui-text min-[360px]:text-base sm:text-xl">
              {title}
            </span>
            <ChevronDown size={15} className={`shrink-0 text-ui-muted transition ${open ? "rotate-180" : ""}`} aria-hidden />
          </span>
          <span className="mt-0.5 hidden max-w-[34rem] text-xs leading-5 text-ui-muted sm:block">{subtitle}</span>
        </span>
      </button>
      {open ? (
        <div
          role="menu"
          className="absolute left-0 top-[calc(100%+0.55rem)] z-[70] w-64 overflow-hidden rounded-ui-md border border-ui-line bg-ui-panel/95 p-1 shadow-2xl shadow-black/35 backdrop-blur-xl"
          onClick={(event) => event.stopPropagation()}
        >
          {marketOptions.map((option) => (
            <Link
              key={option.key}
              href={option.href}
              role="menuitem"
              onClick={() => {
                savePreferredMarket(option.key);
                setOpen(false);
              }}
              className={`block rounded-ui-sm px-3 py-2.5 transition hover:bg-white/[0.06] ${
                preferred === option.key ? "text-ui-text" : "text-ui-muted"
              }`}
            >
              <span className="block text-sm font-black">{option.label}</span>
              <span className="mt-0.5 block text-xs leading-4">{option.description}</span>
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}
