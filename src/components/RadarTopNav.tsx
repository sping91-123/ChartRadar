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
  { label: "홈", icon: Home, href: "/crypto/home", match: ["/crypto/home"] },
  { label: "현물", icon: Coins, href: "/crypto/spot", match: ["/crypto/spot"] },
  { label: "선물", icon: Radar, href: "/crypto/perpetual", match: ["/crypto/perpetual", "/crypto/perpetual/alts"] },
  { label: "뉴스", icon: Newspaper, href: "/crypto/news", match: ["/crypto/news"], market: "crypto" },
  { label: "복기", icon: History, href: "/crypto/review", match: ["/crypto/review"], market: "crypto" }
];

const stockNavItems: NavItem[] = [
  { label: "시장", icon: TrendingUp, href: "/global", match: ["/stocks", "/global"] },
  { label: "자산", icon: Radar, href: "/global/assets", match: ["/global/assets"] },
  { label: "뉴스", icon: Newspaper, href: "/news?market=global", match: ["/news"], market: "global" },
  { label: "복기", icon: History, href: "/journal?market=global", match: ["/journal"], market: "global" }
];

const allNavItems: NavItem[] = [
  { label: "Coin Radar", icon: Radar, href: "/crypto/home", match: ["/crypto/home", "/crypto/spot", "/crypto/perpetual", "/crypto/perpetual/alts", "/crypto/news", "/crypto/review", "/crypto/alert"] },
  { label: "글로벌", icon: TrendingUp, href: "/global", match: ["/stocks", "/global", "/global/assets"] },
  { label: "요금제", icon: Crown, href: "/pro", match: ["/pro", "/checkout/success", "/checkout/fail", "/refund"] }
];

function inferMarket(pathname: string): MarketScope {
  if (pathname === "/stocks" || pathname === "/global" || pathname.startsWith("/global/")) return "stocks";
  if (pathname.startsWith("/crypto/")) return "crypto";
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
            className={`group flex min-h-[3.35rem] min-w-0 flex-col items-center justify-center gap-1 rounded-ui-sm border px-1.5 py-1 text-center text-[10px] font-black leading-none tracking-tight transition sm:min-h-[3.25rem] sm:px-2 sm:text-[11px] ${
              isFixedGridNav ? "w-full" : "shrink-0 md:shrink"
            } ${
              active
                ? "border-ui-brand/70 bg-ui-brand/15 text-ui-text"
                : "border-transparent bg-transparent text-ui-muted hover:border-ui-line hover:bg-white/[0.035] hover:text-ui-text"
            }`}
          >
            <Icon size={17} aria-hidden className={`shrink-0 ${active ? "text-ui-brand" : "text-ui-subtle transition group-hover:text-ui-muted"}`} />
            <span className="whitespace-nowrap">{label}</span>
          </Link>
        );
      })}
    </div>
  );

  return (
    <nav className="radar-bottom-nav fixed inset-x-0 bottom-0 z-40 px-0 pt-1">
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
