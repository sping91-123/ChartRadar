"use client";

import { Suspense } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Coins, Crown, History, Home, Newspaper, Radar, TrendingUp } from "lucide-react";

type MarketScope = "crypto" | "stocks" | "all";

type NavItem = {
  label: string;
  icon: typeof Radar;
  href: string;
  match: string[];
  market?: "crypto" | "global";
};

const cryptoNavItems: NavItem[] = [
  { label: "홈", icon: Home, href: "/coin", match: ["/coin"] },
  { label: "현물", icon: Coins, href: "/spot", match: ["/spot"] },
  { label: "선물", icon: Radar, href: "/crypto", match: ["/crypto", "/alts"] },
  { label: "뉴스", icon: Newspaper, href: "/news?market=crypto", match: ["/news"], market: "crypto" },
  { label: "복기", icon: History, href: "/journal?market=crypto", match: ["/journal"], market: "crypto" }
];

const stockNavItems: NavItem[] = [
  { label: "시장", icon: TrendingUp, href: "/global", match: ["/stocks", "/global"] },
  { label: "자산", icon: Radar, href: "/global/assets", match: ["/global/assets"] },
  { label: "뉴스", icon: Newspaper, href: "/news?market=global", match: ["/news"], market: "global" },
  { label: "복기", icon: History, href: "/journal?market=global", match: ["/journal"], market: "global" }
];

const allNavItems: NavItem[] = [
  { label: "BTC/ETH", icon: Radar, href: "/crypto", match: ["/crypto", "/alts"] },
  { label: "글로벌", icon: TrendingUp, href: "/global", match: ["/stocks", "/global", "/global/assets"] },
  { label: "요금제", icon: Crown, href: "/pro", match: ["/pro", "/checkout/success", "/checkout/fail", "/refund"] }
];

function inferMarket(pathname: string): MarketScope {
  if (pathname === "/stocks" || pathname === "/global" || pathname.startsWith("/global/")) return "stocks";
  return "crypto";
}

function RadarTopNavContent({ market: forcedMarket }: { market?: MarketScope }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const marketParam = searchParams.get("market");
  const market = forcedMarket ?? inferMarket(pathname);
  const navItems = market === "all" ? allNavItems : market === "stocks" ? stockNavItems : cryptoNavItems;
  const isGlobalNav = market === "stocks";
  const isCryptoNav = market === "crypto";
  const isFixedGridNav = isGlobalNav || isCryptoNav;

  const navContent = (
    <div
      className={
        isFixedGridNav
          ? "grid gap-1"
          : "flex gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:grid"
      }
      style={{ gridTemplateColumns: `repeat(${navItems.length}, minmax(0, 1fr))` }}
    >
      {navItems.map(({ label, icon: Icon, href, match, market: itemMarket }) => {
        const isMarketRoute = pathname === "/news" || pathname === "/alerts" || pathname === "/journal";
        const routeMatches = match.some((path) => path === pathname) && (!itemMarket || marketParam === itemMarket || !isMarketRoute);
        const active = routeMatches;

        return (
          <Link
            key={label}
            href={href}
            className={`group flex min-h-11 min-w-0 items-center justify-center gap-1 border-t px-1 text-center text-[10.5px] font-black tracking-tight transition sm:min-h-10 sm:gap-1.5 sm:px-2 sm:text-xs ${
              isFixedGridNav ? "w-full" : "shrink-0 md:shrink"
            } ${
              active ? "border-ui-brand text-ui-text" : "border-transparent bg-transparent text-ui-muted hover:text-ui-text"
            }`}
          >
            <Icon size={14} aria-hidden className={`shrink-0 ${active ? "text-ui-brand" : "text-ui-subtle transition group-hover:text-ui-muted"}`} />
            <span className="whitespace-nowrap">{label}</span>
          </Link>
        );
      })}
    </div>
  );

  return (
    <nav className="radar-bottom-nav fixed inset-x-0 bottom-0 z-40 border-t border-ui-line px-0 pt-1">
      <div className="mx-auto max-w-md px-2">
        {navContent}
      </div>
    </nav>
  );
}

export function RadarTopNav({ market }: { market?: MarketScope } = {}) {
  return (
    <Suspense fallback={<div className="radar-bottom-nav fixed inset-x-0 bottom-0 z-40 h-12" />}>
      <RadarTopNavContent market={market} />
    </Suspense>
  );
}
