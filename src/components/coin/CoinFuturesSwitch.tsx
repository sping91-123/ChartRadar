import Link from "next/link";

const futuresTabs = [
  { id: "major", label: "메이저", detail: "BTC / ETH", href: "/crypto" },
  { id: "alts", label: "알트", detail: "Alt futures", href: "/alts" }
] as const;

export function CoinFuturesSwitch({ active }: { active: "major" | "alts" }) {
  return (
    <nav className="border-y border-ui-line py-2" aria-label="코인 선물 내부 탭">
      <div className="grid grid-cols-2 gap-0">
        {futuresTabs.map((tab) => {
          const isActive = tab.id === active;

          return (
            <Link
              key={tab.id}
              href={tab.href}
              className={`min-w-0 border-b-2 px-2 py-2 text-center transition ${
                isActive ? "border-ui-brand text-ui-text" : "border-transparent text-ui-muted hover:text-ui-text"
              }`}
            >
              <span className="block text-sm font-semibold tracking-tight">{tab.label}</span>
              <span className="mt-0.5 block text-[11px] font-medium text-ui-subtle">{tab.detail}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
