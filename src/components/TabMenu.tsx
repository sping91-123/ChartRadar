"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  BookOpen,
  Calculator,
  ClipboardCheck,
  History
} from "lucide-react";

const pageLinks = [
  { href: "/survival", label: "레이더", icon: BarChart3 },
  { href: "/diagnosis", label: "원칙 점검", icon: ClipboardCheck },
  { href: "/calculator", label: "수량 계산", icon: Calculator },
  { href: "/journal", label: "복기", icon: History },
  { href: "/learn", label: "학습", icon: BookOpen }
] as const;

export function TabMenu() {
  const pathname = usePathname();

  return (
    <nav className="rounded-lg border border-surface-line bg-surface-card p-2">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        {pageLinks.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href || (pathname === "/" && href === "/survival");

          return (
            <Link
              key={href}
              href={href}
              className={`flex min-h-11 items-center justify-center gap-1.5 rounded-md px-2 text-sm font-semibold transition ${
                isActive
                  ? "bg-accent-blue text-slate-950"
                  : "text-slate-300 hover:bg-white/5 hover:text-white"
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
