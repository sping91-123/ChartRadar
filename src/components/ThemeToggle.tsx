"use client";
// 사용자가 라이트 모드와 다크 모드를 즉시 전환할 수 있는 버튼.
import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

type ThemeMode = "dark" | "light";

const storageKey = "chart-radar.theme";

function applyTheme(theme: ThemeMode) {
  document.documentElement.classList.toggle("theme-light", theme === "light");
  document.documentElement.classList.toggle("theme-dark", theme === "dark");
  document.documentElement.style.colorScheme = theme;
}

export function ThemeToggle({ variant = "button" }: { variant?: "button" | "switch" } = {}) {
  const [theme, setTheme] = useState<ThemeMode>("dark");

  useEffect(() => {
    const saved = window.localStorage.getItem(storageKey);
    const initial = saved === "light" || saved === "dark" ? saved : "dark";
    setTheme(initial);
    applyTheme(initial);
  }, []);

  function toggleTheme() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    window.localStorage.setItem(storageKey, next);
    applyTheme(next);
  }

  const isLight = theme === "light";
  const Icon = isLight ? Moon : Sun;

  if (variant === "switch") {
    return (
      <button
        type="button"
        onClick={toggleTheme}
        className={`relative h-8 w-14 shrink-0 rounded-full border p-1 transition ${
          isLight ? "border-cyan-300/40 bg-cyan-300/20" : "border-white/10 bg-slate-800"
        }`}
        aria-label={isLight ? "다크 모드로 전환" : "라이트 모드로 전환"}
        title={isLight ? "라이트 모드 사용 중" : "다크 모드 사용 중"}
      >
        <span
          className={`grid h-6 w-6 place-items-center rounded-full bg-white text-slate-950 shadow transition ${
            isLight ? "translate-x-6" : "translate-x-0"
          }`}
        >
          <Icon size={13} aria-hidden />
        </span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="inline-flex min-h-8 items-center gap-1.5 rounded-md border border-surface-line bg-surface-cardSoft px-2.5 text-xs font-black text-slate-300 transition hover:border-accent-blue/50 hover:text-white"
      aria-label={isLight ? "다크 모드로 전환" : "라이트 모드로 전환"}
      title={isLight ? "다크 모드" : "라이트 모드"}
    >
      <Icon size={14} aria-hidden />
      <span className="hidden sm:inline">{isLight ? "다크" : "라이트"}</span>
    </button>
  );
}
