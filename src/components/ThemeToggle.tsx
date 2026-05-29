"use client";
// 사용자가 기기 테마, 라이트 모드, 다크 모드를 즉시 전환할 수 있는 버튼.
import { useEffect, useState } from "react";
import { MonitorSmartphone, Moon, Sun } from "lucide-react";

type ThemeMode = "system" | "dark" | "light";

const storageKey = "chart-radar.theme";

function resolvedSystemTheme() {
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

function applyTheme(theme: ThemeMode) {
  const resolved = theme === "system" ? resolvedSystemTheme() : theme;
  document.documentElement.classList.toggle("theme-light", resolved === "light");
  document.documentElement.classList.toggle("theme-dark", resolved === "dark");
  document.documentElement.classList.toggle("theme-system", theme === "system");
  document.documentElement.style.colorScheme = resolved;
  const themeColor = resolved === "light" ? "#f6f8fb" : "#0b0b0f";
  document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]').forEach((meta) => {
    meta.content = themeColor;
  });
  window.dispatchEvent(new CustomEvent("chart-radar-theme-change", { detail: { theme, resolved } }));
}

export function ThemeToggle({ variant = "button" }: { variant?: "button" | "switch" } = {}) {
  const [theme, setTheme] = useState<ThemeMode>("system");

  useEffect(() => {
    const saved = window.localStorage.getItem(storageKey);
    const initial = saved === "light" || saved === "dark" || saved === "system" ? saved : "system";
    setTheme(initial);
    applyTheme(initial);

    const media = window.matchMedia("(prefers-color-scheme: light)");
    const handleSystemThemeChange = () => {
      if ((window.localStorage.getItem(storageKey) ?? "system") === "system") {
        applyTheme("system");
      }
    };
    media.addEventListener("change", handleSystemThemeChange);
    return () => media.removeEventListener("change", handleSystemThemeChange);
  }, []);

  function setThemeMode(next: ThemeMode) {
    setTheme(next);
    window.localStorage.setItem(storageKey, next);
    applyTheme(next);
  }

  function toggleTheme() {
    const next = theme === "system" ? "light" : theme === "light" ? "dark" : "system";
    setThemeMode(next);
  }

  const resolvedTheme = theme === "system" && typeof window !== "undefined" ? resolvedSystemTheme() : theme;
  const isLight = theme === "light";
  const Icon = theme === "system" ? MonitorSmartphone : isLight ? Moon : Sun;
  const themeOptions: Array<{ value: ThemeMode; label: string; description: string }> = [
    { value: "system", label: "기기", description: "휴대폰 설정 사용" },
    { value: "light", label: "라이트", description: "밝은 화면" },
    { value: "dark", label: "다크", description: "어두운 화면" }
  ];

  if (variant === "switch") {
    return (
      <div className="grid w-full grid-cols-3 gap-1 border-y border-white/10 py-1" role="group" aria-label="테마 선택">
        {themeOptions.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => setThemeMode(option.value)}
            className={`min-h-10 px-1 text-center text-xs font-black transition ${
              theme === option.value
                ? "border-b-2 border-cyan-300 text-white"
                : "border-b-2 border-transparent text-slate-400 hover:text-white"
            }`}
            title={option.description}
            aria-pressed={theme === option.value}
          >
            {option.label}
          </button>
        ))}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="inline-flex min-h-8 items-center gap-1.5 rounded-md border border-surface-line bg-surface-cardSoft px-2.5 text-xs font-black text-slate-300 transition hover:border-accent-blue/50 hover:text-white"
      aria-label="테마 전환"
      title={theme === "system" ? `기기 테마 사용 중: ${resolvedTheme === "light" ? "라이트" : "다크"}` : theme === "light" ? "라이트 모드 사용 중" : "다크 모드 사용 중"}
    >
      <Icon size={14} aria-hidden />
      <span className="hidden sm:inline">{theme === "system" ? "기기" : isLight ? "라이트" : "다크"}</span>
    </button>
  );
}
