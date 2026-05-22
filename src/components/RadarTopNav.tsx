"use client";
// 시장별 주요 페이지로 이동하는 상단 레이더 내비게이션입니다.
import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { CalendarClock, Coins, Crown, History, Newspaper, Radar, TrendingUp } from "lucide-react";

type MarketScope = "crypto" | "stocks" | "all";

type NavItem = {
  label: string;
  icon: typeof Radar;
  href: string;
  match: string[];
  market?: "crypto" | "global";
  hash?: string;
};

const cryptoNavItems: NavItem[] = [
  { label: "BTC/ETH", icon: Radar, href: "/crypto", match: ["/crypto"] },
  { label: "알트코인", icon: Coins, href: "/alts", match: ["/alts"] },
  { label: "뉴스", icon: Newspaper, href: "/news?market=crypto", match: ["/news"], market: "crypto" },
  { label: "복기", icon: History, href: "/journal?market=crypto", match: ["/journal"], market: "crypto" }
];

const stockNavItems: NavItem[] = [
  { label: "시장", icon: TrendingUp, href: "/global", match: ["/stocks", "/global"], hash: "" },
  { label: "자산", icon: Radar, href: "/global#asset-radar", match: ["/stocks", "/global"], hash: "asset-radar" },
  { label: "일정", icon: CalendarClock, href: "/news?market=global", match: ["/news"], market: "global" },
  { label: "복기", icon: History, href: "/journal?market=global", match: ["/journal"], market: "global" }
];

const allNavItems: NavItem[] = [
  { label: "BTC/ETH", icon: Radar, href: "/crypto", match: ["/crypto", "/alts"] },
  { label: "글로벌", icon: TrendingUp, href: "/global", match: ["/stocks", "/global"] },
  { label: "요금제", icon: Crown, href: "/pro", match: ["/pro", "/checkout/success", "/checkout/fail", "/refund"] }
];

function inferMarket(pathname: string): MarketScope {
  if (pathname === "/stocks" || pathname === "/global") return "stocks";
  return "crypto";
}

function RadarTopNavContent({ market: forcedMarket }: { market?: MarketScope }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const marketParam = searchParams.get("market");
  const [hash, setHash] = useState("");
  const market = forcedMarket ?? inferMarket(pathname);
  const navItems = market === "all" ? allNavItems : market === "stocks" ? stockNavItems : cryptoNavItems;
  const isGlobalNav = market === "stocks";

  useEffect(() => {
    const updateHash = () => setHash(window.location.hash.replace("#", ""));
    updateHash();
    window.addEventListener("hashchange", updateHash);
    return () => window.removeEventListener("hashchange", updateHash);
  }, [pathname]);

  return (
    <nav className="sticky top-2 z-30 overflow-hidden rounded-xl border border-surface-line bg-slate-950/78 p-1.5 shadow-[0_14px_42px_rgba(0,0,0,0.28)] backdrop-blur-xl">
      <div
        className={
          isGlobalNav
            ? "grid grid-cols-4 gap-1.5"
            : "flex gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:grid"
        }
        style={{ gridTemplateColumns: `repeat(${navItems.length}, minmax(0, 1fr))` }}
      >
        {navItems.map(({ label, icon: Icon, href, match, market: itemMarket, hash: itemHash }) => {
          const isMarketRoute = pathname === "/news" || pathname === "/alerts" || pathname === "/journal";
          const routeMatches = match.some((path) => path === pathname) && (!itemMarket || marketParam === itemMarket || !isMarketRoute);
          const active =
            itemHash === undefined
              ? routeMatches
              : routeMatches && (itemHash ? hash === itemHash : hash !== "asset-radar");

          return (
            <Link
              key={label}
              href={href}
              className={`group flex min-h-11 min-w-0 items-center justify-center gap-1.5 rounded-lg px-1.5 text-center text-[11px] font-black tracking-tight transition sm:min-h-12 sm:px-3 sm:text-xs ${
                isGlobalNav ? "w-full" : "shrink-0 md:shrink"
              } ${
                active
                  ? "bg-cyan-300/12 text-cyan-200 shadow-[inset_0_0_0_1px_rgba(103,232,249,0.16)]"
                  : "text-slate-400 hover:bg-white/[0.04] hover:text-slate-100"
              }`}
            >
              <Icon size={15} aria-hidden className={active ? "text-cyan-300" : "text-slate-500 transition group-hover:text-slate-300"} />
              <span className="whitespace-nowrap">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export function RadarTopNav({ market }: { market?: MarketScope } = {}) {
  return (
    <Suspense fallback={<div className="h-[52px] rounded-xl border border-surface-line bg-slate-950/70" />}>
      <RadarTopNavContent market={market} />
    </Suspense>
  );
}
