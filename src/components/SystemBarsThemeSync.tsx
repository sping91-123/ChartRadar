"use client";

import { useEffect } from "react";

type ThemeMode = "system" | "dark" | "light";

const storageKey = "chart-radar.theme";

function resolvedSystemTheme() {
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

function readTheme(): ThemeMode {
  const saved = window.localStorage.getItem(storageKey);
  return saved === "light" || saved === "dark" || saved === "system" ? saved : "system";
}

async function applySystemBars(theme: ThemeMode) {
  const resolved = theme === "system" ? resolvedSystemTheme() : theme;
  const themeColor = resolved === "light" ? "#f6f8fb" : "#0b0b0f";

  document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]').forEach((meta) => {
    meta.content = themeColor;
  });

  try {
    const { Capacitor, SystemBars, SystemBarsStyle } = await import("@capacitor/core");
    if (!Capacitor.isNativePlatform()) return;
    await SystemBars.setStyle({ style: resolved === "light" ? SystemBarsStyle.Light : SystemBarsStyle.Dark });
  } catch {
    // Web/PWA contexts do not need the native SystemBars bridge.
  }
}

export function SystemBarsThemeSync() {
  useEffect(() => {
    const sync = () => {
      void applySystemBars(readTheme());
    };
    const syncFromEvent = (event: Event) => {
      const detail = (event as CustomEvent<{ theme?: ThemeMode }>).detail;
      void applySystemBars(detail?.theme ?? readTheme());
    };
    const media = window.matchMedia("(prefers-color-scheme: light)");

    sync();
    window.addEventListener("chart-radar-theme-change", syncFromEvent);
    window.addEventListener("storage", sync);
    media.addEventListener("change", sync);

    return () => {
      window.removeEventListener("chart-radar-theme-change", syncFromEvent);
      window.removeEventListener("storage", sync);
      media.removeEventListener("change", sync);
    };
  }, []);

  return null;
}
