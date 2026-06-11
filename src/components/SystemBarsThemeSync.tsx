"use client";

import { useEffect } from "react";

async function applyDarkSystemBars() {
  document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]').forEach((meta) => {
    meta.content = "#0a0a0d";
  });

  try {
    const { Capacitor, SystemBars, SystemBarsStyle } = await import("@capacitor/core");
    if (!Capacitor.isNativePlatform()) return;
    await SystemBars.setStyle({ style: SystemBarsStyle.Dark });
  } catch {
    // Web/PWA contexts do not need the native SystemBars bridge.
  }
}

export function SystemBarsThemeSync() {
  useEffect(() => {
    void applyDarkSystemBars();
  }, []);

  return null;
}
