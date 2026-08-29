"use client";

import { type KeyboardEvent, type ReactNode, useId, useRef } from "react";
import {
  perpetualAnalysisPerspectives,
  type PerpetualAnalysisPerspective
} from "@/lib/perpetualAnalysisPerspective";

export function PerpetualAnalysisTabs({
  value,
  onChange,
  between,
  children
}: {
  value: PerpetualAnalysisPerspective;
  onChange: (value: PerpetualAnalysisPerspective) => void;
  between?: ReactNode;
  children: ReactNode;
}) {
  const instanceId = useId();
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const selected = perpetualAnalysisPerspectives.find((item) => item.id === value) ?? perpetualAnalysisPerspectives[0];

  function selectFromKeyboard(event: KeyboardEvent<HTMLButtonElement>, currentIndex: number) {
    let nextIndex = currentIndex;
    if (event.key === "ArrowRight") {
      nextIndex = (currentIndex + 1) % perpetualAnalysisPerspectives.length;
    } else if (event.key === "ArrowLeft") {
      nextIndex = (currentIndex - 1 + perpetualAnalysisPerspectives.length) % perpetualAnalysisPerspectives.length;
    } else if (event.key === "Home") {
      nextIndex = 0;
    } else if (event.key === "End") {
      nextIndex = perpetualAnalysisPerspectives.length - 1;
    } else {
      return;
    }

    event.preventDefault();
    const next = perpetualAnalysisPerspectives[nextIndex];
    onChange(next.id);
    tabRefs.current[nextIndex]?.focus();
  }

  return (
    <section className="space-y-3" aria-labelledby={`${instanceId}-title`}>
      <div className="bg-ui-panel px-3 py-4 sm:px-5">
        <p className="text-[10px] font-black uppercase tracking-[0.12em] text-ui-brand">분석 관점</p>
        <h2 id={`${instanceId}-title`} className="mt-1 text-lg font-black text-ui-text">같은 판단을 원하는 방식으로 확인하세요</h2>
        <p id={`${instanceId}-description`} className="mt-3 text-xs font-semibold leading-5 text-ui-text [word-break:keep-all]">{selected.description}</p>
        <p id={`${instanceId}-boundary`} className="mt-1 text-xs font-semibold leading-5 text-ui-muted [word-break:keep-all]">세 관점은 같은 저장 분석을 읽습니다. 이 탭의 한 신호만으로 상단의 최종 방향이나 감시 조건을 바꾸지 않습니다.</p>
      </div>

      <div
        role="tablist"
        aria-orientation="horizontal"
        aria-label="선물 분석 관점"
        className="sticky top-0 z-30 grid grid-cols-3 gap-1 rounded-ui-sm bg-ui-canvas/95 p-1 backdrop-blur"
      >
        {perpetualAnalysisPerspectives.map((item, index) => {
          const active = item.id === value;
          return (
            <button
              key={item.id}
              ref={(node) => { tabRefs.current[index] = node; }}
              id={`${instanceId}-${item.id}-tab`}
              type="button"
              role="tab"
              aria-selected={active}
              aria-controls={`${instanceId}-panel`}
              aria-describedby={`${instanceId}-description ${instanceId}-boundary`}
              tabIndex={active ? 0 : -1}
              onClick={() => onChange(item.id)}
              onKeyDown={(event) => selectFromKeyboard(event, index)}
              className={`min-h-11 rounded-ui-sm px-2 py-2 text-xs font-black transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ui-brand focus-visible:ring-offset-2 focus-visible:ring-offset-ui-canvas sm:text-sm ${active ? "bg-ui-panel text-ui-activeText shadow-ui-card" : "text-ui-muted hover:bg-ui-panel/60 hover:text-ui-text"}`}
            >
              {item.label}
            </button>
          );
        })}
      </div>

      <div
        id={`${instanceId}-panel`}
        role="tabpanel"
        aria-labelledby={`${instanceId}-${value}-tab`}
        tabIndex={0}
        className="space-y-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ui-brand"
      >
        {between}
        {children}
      </div>
    </section>
  );
}
