"use client";
// 시장별 주요 페이지로 이동하는 상단 레이더 내비게이션입니다.
import { Suspense } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { CalendarClock, Coins, Crown, History, Newspaper, Radar, TrendingUp } from "lucide-react";
import { AppSurface } from "@/components/ui/DesignPrimitives";

type MarketScope = "crypto" | "stocks" | "all";

type NavItem = {
  label: string;
  icon: typeof Radar;
  href: string;
  match: string[];
  market?: "crypto" | "global";
};

const cryptoNavItems: NavItem[] = [
  { label: "BTC/ETH", icon: Radar, href: "/crypto", match: ["/crypto"] },
  { label: "알트코인", icon: Coins, href: "/alts", match: ["/alts"] },
  { label: "뉴스", icon: Newspaper, href: "/news?market=crypto", match: ["/news"], market: "crypto" },
  { label: "복기", icon: History, href: "/journal?market=crypto", match: ["/journal"], market: "crypto" }
];

const stockNavItems: NavItem[] = [
  { label: "시장", icon: TrendingUp, href: "/global", match: ["/stocks", "/global"] },
  { label: "자산", icon: Radar, href: "/global/assets", match: ["/global/assets"] },
  { label: "일정", icon: CalendarClock, href: "/news?market=global", match: ["/news"], market: "global" },
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

  return (
    <AppSurface as="nav" tone="panel" padding="sm" className="sticky top-2 z-30 overflow-hidden backdrop-blur-xl">
      <div
        className={
          isGlobalNav || isCryptoNav
            ? "grid grid-cols-4 gap-1.5"
            : "flex gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:grid"
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
              className={`group flex min-h-11 min-w-0 items-center justify-center gap-1 rounded-lg px-1 text-center text-[10.5px] font-black tracking-tight transition sm:min-h-12 sm:gap-1.5 sm:px-3 sm:text-xs ${
                isGlobalNav || isCryptoNav ? "w-full" : "shrink-0 md:shrink"
              } ${
                active
                  ? "bg-ui-active text-ui-activeText ring-1 ring-inset ring-ui-lineStrong"
                  : "text-ui-muted hover:bg-ui-inset hover:text-ui-text"
              }`}
            >
              <Icon size={14} aria-hidden className={`shrink-0 ${active ? "text-ui-activeText" : "text-ui-subtle transition group-hover:text-ui-muted"}`} />
              <span className="whitespace-nowrap">{label}</span>
            </Link>
          );
        })}
      </div>
    </AppSurface>
  );
}

export function RadarTopNav({ market }: { market?: MarketScope } = {}) {
  return (
    <Suspense fallback={<div className="h-[52px] rounded-ui border border-ui-line bg-ui-panel" />}>
      <RadarTopNavContent market={market} />
    </Suspense>
  );
}
