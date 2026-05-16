export function getChartThemeOptions() {
  const isLight = typeof document !== "undefined" && document.documentElement.classList.contains("theme-light");

  return {
    layout: {
      background: { color: isLight ? "#ffffff" : "#11151c" },
      textColor: isLight ? "#334155" : "#cbd5e1"
    },
    grid: {
      vertLines: { color: isLight ? "rgba(148, 163, 184, 0.22)" : "rgba(148, 163, 184, 0.08)" },
      horzLines: { color: isLight ? "rgba(148, 163, 184, 0.22)" : "rgba(148, 163, 184, 0.08)" }
    },
    rightPriceScale: {
      borderColor: isLight ? "rgba(148, 163, 184, 0.35)" : "rgba(148, 163, 184, 0.18)"
    },
    timeScale: {
      borderColor: isLight ? "rgba(148, 163, 184, 0.35)" : "rgba(148, 163, 184, 0.18)"
    }
  };
}

export function observeChartThemeChange(onChange: () => void) {
  if (typeof document === "undefined" || typeof MutationObserver === "undefined") {
    return () => {};
  }

  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  return () => observer.disconnect();
}
