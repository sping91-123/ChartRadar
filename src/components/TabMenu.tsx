"use client";
// 예전 하단 탭 메뉴를 현재 주요 기능 구조에 맞춰 제공한다.
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, History } from "lucide-react";

const pageLinks = [
  { href: "/crypto", label: "BTC/ETH", icon: BarChart3 },
  { href: "/news?market=crypto", label: "뉴스", icon: BarChart3 },
  { href: "/journal?market=crypto", label: "복기", icon: History }
] as const;

export function TabMenu() {
  const pathname = usePathname();

  return (
    <nav className="rounded-lg border border-surface-line bg-surface-card p-2">
      <div className="grid grid-cols-3 gap-2">
        {pageLinks.map(({ href, label, icon: Icon }) => {
          const hrefPath = href.split("?")[0];
          const isActive = pathname === hrefPath || (pathname === "/" && hrefPath === "/crypto");

          return (
            <Link
              key={href}
              href={href}
              className={`flex min-h-11 items-center justify-center gap-1.5 rounded-md px-2 text-sm font-semibold transition ${
                isActive ? "bg-accent-blue text-slate-950" : "text-slate-300 hover:bg-white/5 hover:text-white"
              }`}
            >
              <Icon size={16} aria-hidden />
              <span>{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
