"use client";
// 차트 레이더의 핵심 페이지로 이동하는 상단 앱 메뉴.
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BellRing, Calculator, Coins, History, Newspaper, Radar, TrendingUp } from "lucide-react";

const navItems = [
  { label: "코인", icon: Radar, href: "/survival", match: ["/survival"] },
  { label: "알트코인", icon: Coins, href: "/alts", match: ["/alts"] },
  { label: "해외주식", icon: TrendingUp, href: "/stocks", match: ["/stocks"] },
  { label: "레이더뉴스", icon: Newspaper, href: "/news", match: ["/news"] },
  { label: "알림", icon: BellRing, href: "/alerts", match: ["/alerts"] },
  { label: "매매복기", icon: History, href: "/journal", match: ["/journal"] },
  { label: "계산기", icon: Calculator, href: "/calculator", match: ["/calculator"] }
] as const;

export function RadarTopNav() {
  const pathname = usePathname();

  return (
    <nav className="sticky top-0 z-30 rounded-lg border border-surface-line bg-slate-950/88 p-1.5 shadow-[0_16px_44px_rgba(0,0,0,0.34)] backdrop-blur">
      <div className="grid grid-cols-4 gap-1 sm:grid-cols-7">
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
