"use client";

import Link from "next/link";

const futuresTabs = [
  { id: "btc", label: "비트", detail: "BTC", href: "/crypto/perpetual?asset=btc" },
  { id: "eth", label: "이더", detail: "ETH", href: "/crypto/perpetual?asset=eth" },
  { id: "alts", label: "알트", detail: "Alt Coin", href: "/crypto/perpetual/alts" }
] as const;

type FuturesTabId = (typeof futuresTabs)[number]["id"];
type MajorFuturesTabId = Extract<FuturesTabId, "btc" | "eth">;

export function CoinFuturesSwitch({
  active,
  onAssetChange
}: {
  active: FuturesTabId;
  onAssetChange?: (next: MajorFuturesTabId) => void;
}) {
  return (
    <nav className="rounded-ui-lg bg-ui-panel p-1" aria-label="코인 선물 선택">
      <div className="grid grid-cols-3 gap-1">
        {futuresTabs.map((tab) => {
          const isActive = tab.id === active;
          const className = `min-w-0 rounded-ui-sm px-2 py-2 text-center transition ${isActive ? "bg-ui-active text-ui-text" : "text-ui-muted hover:bg-ui-inset/60 hover:text-ui-text"}`;
          const content = (
            <>
              <span className="block text-sm font-semibold leading-5 tracking-tight">{tab.label}</span>
              <span className="block text-[11px] font-medium leading-4 text-ui-subtle">{tab.detail}</span>
            </>
          );

          if (onAssetChange && (tab.id === "btc" || tab.id === "eth")) {
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => onAssetChange(tab.id)}
                aria-pressed={isActive}
                className={className}
              >
                {content}
              </button>
            );
          }

          return (
            <Link
              key={tab.id}
              href={tab.href}
              aria-current={isActive ? "page" : undefined}
              className={className}
            >
              {content}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
