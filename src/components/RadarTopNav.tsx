"use client";
// 시장별 주요 페이지로 이동하는 상단 앱 내비게이션입니다.
import { Suspense } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { BellRing, Calculator, Coins, Crown, History, Newspaper, Radar, TrendingUp } from "lucide-react";

type MarketScope = "crypto" | "stocks" | "all";

type NavItem = {
  label: string;
  icon: typeof Radar;
  href: string;
  match: string[];
  market?: "crypto" | "global";
};

const cryptoNavItems: NavItem[] = [
  { label: "Majors", icon: Radar, href: "/majors", match: ["/majors"] },
  { label: "알트코인", icon: Coins, href: "/alts", match: ["/alts"] },
  { label: "뉴스", icon: Newspaper, href: "/news?market=crypto", match: ["/news"], market: "crypto" },
  { label: "알림", icon: BellRing, href: "/alerts?market=crypto", match: ["/alerts"], market: "crypto" },
  { label: "복기", icon: History, href: "/journal?market=crypto", match: ["/journal"], market: "crypto" },
  { label: "계산기", icon: Calculator, href: "/calculator?market=crypto", match: ["/calculator"], market: "crypto" }
];

const stockNavItems: NavItem[] = [
  { label: "글로벌", icon: TrendingUp, href: "/global", match: ["/stocks", "/global"] },
  { label: "뉴스", icon: Newspaper, href: "/news?market=global", match: ["/news"], market: "global" },
  { label: "알림", icon: BellRing, href: "/alerts?market=global", match: ["/alerts"], market: "global" },
  { label: "복기", icon: History, href: "/journal?market=global", match: ["/journal"], market: "global" },
  { label: "계산기", icon: Calculator, href: "/calculator?market=global", match: ["/calculator"], market: "global" }
];

const allNavItems: NavItem[] = [
  { label: "Majors", icon: Radar, href: "/majors", match: ["/majors", "/alts"] },
  { label: "글로벌 레이더", icon: TrendingUp, href: "/global", match: ["/stocks", "/global"] },
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
  const market = forcedMarket ?? inferMarket(pathname);
  const navItems = market === "all" ? allNavItems : market === "stocks" ? stockNavItems : cryptoNavItems;

  return (
    <nav className="sticky top-2 z-30 rounded-xl border border-surface-line bg-slate-950/78 p-1 shadow-[0_14px_42px_rgba(0,0,0,0.28)] backdrop-blur-xl">
      <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${navItems.length}, minmax(0, 1fr))` }}>
        {navItems.map(({ label, icon: Icon, href, match, market: itemMarket }) => {
          const isMarketRoute = pathname === "/news" || pathname === "/alerts" || pathname === "/journal" || pathname === "/calculator";
          const active = match.some((path) => path === pathname) && (!itemMarket || marketParam === itemMarket || !isMarketRoute);

          return (
            <Link
              key={label}
              href={href}
              className={`group flex min-h-11 items-center justify-center gap-1.5 rounded-lg px-2 text-[11px] font-black tracking-tight transition sm:text-xs ${
                active
                  ? "bg-cyan-300/12 text-cyan-200 shadow-[inset_0_0_0_1px_rgba(103,232,249,0.16)]"
                  : "text-slate-400 hover:bg-white/[0.04] hover:text-slate-100"
              }`}
            >
              <Icon size={15} aria-hidden className={active ? "text-cyan-300" : "text-slate-500 transition group-hover:text-slate-300"} />
              <span className="truncate">{label}</span>
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
