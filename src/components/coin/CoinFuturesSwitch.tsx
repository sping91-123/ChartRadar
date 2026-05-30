import Link from "next/link";

const futuresTabs = [
  { id: "major", label: "메이저", detail: "BTC / ETH", href: "/crypto" },
  { id: "alts", label: "알트", detail: "Alt Coin", href: "/alts" }
] as const;

export function CoinFuturesSwitch({ active }: { active: "major" | "alts" }) {
  return (
    <nav className="rounded-ui border border-ui-line bg-ui-panel p-1" aria-label="코인 선물 내부 탭">
      <div className="grid grid-cols-2 gap-1">
        {futuresTabs.map((tab) => {
          const isActive = tab.id === active;

          return (
            <Link
              key={tab.id}
              href={tab.href}
              className={`min-w-0 rounded-ui-sm px-2 py-2 text-center transition ${
                isActive ? "bg-ui-active text-ui-activeText" : "text-ui-muted hover:bg-ui-inset hover:text-ui-text"
              }`}
            >
              <span className="block text-sm font-semibold leading-5 tracking-tight">{tab.label}</span>
              <span className="block text-[11px] font-medium leading-4 text-ui-subtle">{tab.detail}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
