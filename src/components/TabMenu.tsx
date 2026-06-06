"use client";
// 예전 하단 탭 메뉴를 현재 주요 기능 구조에 맞춰 제공한다.
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, History } from "lucide-react";

const pageLinks = [
  { href: "/crypto/perpetual", label: "BTC/ETH", icon: BarChart3 },
  { href: "/crypto/news", label: "뉴스", icon: BarChart3 },
  { href: "/crypto/review", label: "복기", icon: History }
] as const;

export function TabMenu() {
  const pathname = usePathname();

  return (
    <nav className="border-y border-surface-line py-2">
      <div className="grid grid-cols-3 gap-2">
        {pageLinks.map(({ href, label, icon: Icon }) => {
          const hrefPath = href.split("?")[0];
          const isActive = pathname === hrefPath || (pathname === "/" && hrefPath === "/crypto/home");

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
