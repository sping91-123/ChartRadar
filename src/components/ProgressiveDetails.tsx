"use client";

import { useState, type ReactNode } from "react";

/** Mount optional analysis on first expansion; preserve its state on subsequent toggles. */
export function ProgressiveDetails({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  const [visited, setVisited] = useState(false);
  return (
    <details className="group min-w-0 border-t border-ui-line bg-ui-panel/40 px-3 py-2 sm:px-4" onToggle={(event) => { if (event.currentTarget.open) setVisited(true); }}>
      <summary className="min-h-11 cursor-pointer py-2 text-sm font-semibold text-ui-text marker:text-ui-brand">
        {title}
        {description ? <span className="mt-1 block text-xs font-normal leading-5 text-ui-muted">{description}</span> : null}
      </summary>
      {visited ? <div className="mt-2 grid min-w-0 gap-3 pb-3">{children}</div> : null}
    </details>
  );
}
