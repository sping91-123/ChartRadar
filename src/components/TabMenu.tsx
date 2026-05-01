"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, BookOpen, Calculator, ClipboardCheck, Crown, History } from "lucide-react";

const pageLinks = [
  { href: "/survival", label: "차트 판독", icon: BarChart3 },
  { href: "/diagnosis", label: "진입 진단", icon: ClipboardCheck },
  { href: "/calculator", label: "계산", icon: Calculator },
  { href: "/journal", label: "복기", icon: History },
  { href: "/learn", label: "학습", icon: BookOpen },
  { href: "/pro", label: "PRO", icon: Crown }
] as const;

export function TabMenu() {
  const pathname = usePathname();

  return (
    <nav className="rounded-lg border border-surface-line bg-surface-card p-2">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-6">
        {pageLinks.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href;

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
