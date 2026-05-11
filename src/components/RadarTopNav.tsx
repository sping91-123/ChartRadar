"use client";
// 차트 레이더의 핵심 페이지로 이동하는 상단 앱 메뉴.
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BellRing, Calculator, Coins, History, Newspaper, Radar, TrendingUp } from "lucide-react";

type MarketScope = "crypto" | "stocks";

const cryptoNavItems = [
  { label: "BTC·ETH", icon: Radar, href: "/survival", match: ["/survival"] },
  { label: "알트", icon: Coins, href: "/alts", match: ["/alts"] },
  { label: "코인뉴스", icon: Newspaper, href: "/news?market=crypto", match: ["/news"] },
  { label: "코인알림", icon: BellRing, href: "/alerts?market=crypto", match: ["/alerts"] },
  { label: "코인복기", icon: History, href: "/journal?market=crypto", match: ["/journal"] },
  { label: "계산기", icon: Calculator, href: "/calculator?market=crypto", match: ["/calculator"] }
] as const;

const stockNavItems = [
  { label: "해외주식", icon: TrendingUp, href: "/stocks", match: ["/stocks"] },
  { label: "주식뉴스", icon: Newspaper, href: "/news?market=stocks", match: ["/news"] },
  { label: "주식알림", icon: BellRing, href: "/alerts?market=stocks", match: ["/alerts"] },
  { label: "주식복기", icon: History, href: "/journal?market=stocks", match: ["/journal"] },
  { label: "계산기", icon: Calculator, href: "/calculator?market=stocks", match: ["/calculator"] }
] as const;

function inferMarket(pathname: string): MarketScope {
  if (pathname === "/stocks") return "stocks";
  return "crypto";
}

export function RadarTopNav({ market: forcedMarket }: { market?: MarketScope } = {}) {
  const pathname = usePathname();
  const market = forcedMarket ?? inferMarket(pathname);
  const navItems = market === "stocks" ? stockNavItems : cryptoNavItems;

  return (
    <nav className="sticky top-0 z-30 rounded-lg border border-surface-line bg-slate-950/88 p-1.5 shadow-[0_16px_44px_rgba(0,0,0,0.34)] backdrop-blur">
      <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${navItems.length}, minmax(0, 1fr))` }}>
        {navItems.map(({ label, icon: Icon, href, match }) => {
          const active = match.some((path) => path === pathname);

          return (
            <Link
              key={label}
              href={href}
              className={`flex min-h-12 flex-col items-center justify-center gap-1 rounded-md px-1 text-[10px] font-black transition sm:min-h-11 sm:flex-row sm:text-xs ${
                active
                  ? "bg-accent-blue/15 text-accent-blue"
                  : "text-slate-400 hover:bg-white/5 hover:text-white"
              }`}
            >
              <Icon size={16} aria-hidden />
              <span className="whitespace-nowrap">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
