"use client";

import { useId, useState, type ReactNode } from "react";
import { X } from "lucide-react";

export function CompactHelp({ children, label = "상세" }: { children?: ReactNode; label?: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const titleId = useId();
  const buttonLabel = label.includes("기준") ? label : "기준 보기";

  if (!children) return null;

  return (
    <>
      <button
        type="button"
        aria-label={`${label} 보기`}
        onClick={() => setIsOpen(true)}
        className="inline-flex min-h-7 items-center justify-center whitespace-nowrap rounded-full border border-ui-line/25 bg-ui-inset/35 px-2.5 text-[11px] font-bold text-ui-muted transition hover:border-accent-blue/35 hover:bg-ui-inset/55 hover:text-ui-text"
      >
        {buttonLabel}
      </button>
      {isOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          onClick={() => setIsOpen(false)}
        >
          <div className="relative w-full max-w-sm rounded-ui-lg border border-ui-line/25 bg-ui-panel p-4 text-ui-text shadow-none" onClick={(event) => event.stopPropagation()}>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="absolute right-2 top-2 grid h-7 w-7 place-items-center text-ui-muted transition hover:text-ui-text"
              aria-label="팝업 닫기"
            >
              <X size={15} aria-hidden />
            </button>
            <p id={titleId} className="pr-8 text-sm font-semibold text-ui-text">
              {label}
            </p>
            <div className="mt-3 text-sm leading-6 text-ui-muted [word-break:keep-all]">{children}</div>
          </div>
        </div>
      ) : null}
    </>
  );
}
