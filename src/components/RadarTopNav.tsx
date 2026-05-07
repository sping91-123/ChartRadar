// 차트 레이더의 주요 섹션으로 바로 이동하는 상단 앱 메뉴
import { Grid2X2, LayoutDashboard, Newspaper, Star } from "lucide-react";

const navItems = [
  { label: "기본코인", icon: Grid2X2, href: "#basic-coins", active: true },
  { label: "관심코인", icon: Star, href: "#watchlist", active: false },
  { label: "대시보드", icon: LayoutDashboard, href: "#market-digest", active: false },
  { label: "AI 브리핑", icon: Newspaper, href: "#ai-briefing", active: false }
] as const;

export function RadarTopNav() {
  return (
    <nav className="sticky top-0 z-30 rounded-lg border border-surface-line bg-slate-950/88 p-1.5 shadow-[0_16px_44px_rgba(0,0,0,0.34)] backdrop-blur">
      <div className="grid grid-cols-4 gap-1.5">
        {navItems.map(({ label, icon: Icon, href, active }) => (
          <a
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
          </a>
        ))}
      </div>
    </nav>
  );
}
