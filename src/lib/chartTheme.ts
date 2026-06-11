export function getChartThemeOptions() {
  return {
    layout: {
      background: { color: "#17181e" },
      textColor: "#d8dee9"
    },
    grid: {
      vertLines: { color: "rgba(255, 255, 255, 0.045)" },
      horzLines: { color: "rgba(255, 255, 255, 0.045)" }
    },
    rightPriceScale: {
      borderColor: "rgba(255, 255, 255, 0.08)"
    },
    timeScale: {
      borderColor: "rgba(255, 255, 255, 0.08)"
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
