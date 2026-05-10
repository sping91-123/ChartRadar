"use client";
// 모바일 홈 화면 설치 안내와 서비스워커 등록을 담당하는 컴포넌트.

import { useEffect, useMemo, useState } from "react";
import { Download, X } from "lucide-react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

const dismissedKey = "chart-radar.pwa-install-dismissed.v1";

function isStandalone() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
}

function isMobileSafari() {
  if (typeof window === "undefined") return false;
  const ua = window.navigator.userAgent;
  return /iPhone|iPad|iPod/i.test(ua) && /Safari/i.test(ua) && !/CriOS|FxiOS|EdgiOS/i.test(ua);
}

declare global {
  interface Navigator {
    standalone?: boolean;
  }
}

export function PwaInstallPrompt() {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIosGuide, setShowIosGuide] = useState(false);
  const [isDismissed, setIsDismissed] = useState(true);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    if (process.env.NODE_ENV !== "production") {
      void navigator.serviceWorker
        .getRegistrations()
        .then((registrations) => Promise.all(registrations.map((registration) => registration.unregister())))
        .then(() =>
          "caches" in window
            ? caches
                .keys()
                .then((keys) =>
                  Promise.all(keys.filter((key) => key.startsWith("chart-radar-")).map((key) => caches.delete(key)))
                )
            : undefined
        )
        .catch(() => undefined);
      return;
    }

    window.addEventListener("load", () => {
      void navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    });
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const dismissed = window.localStorage.getItem(dismissedKey) === "1";
    setIsDismissed(dismissed || isStandalone());
    setShowIosGuide(!dismissed && !isStandalone() && isMobileSafari());

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      if (window.localStorage.getItem(dismissedKey) === "1" || isStandalone()) return;
      setInstallEvent(event as BeforeInstallPromptEvent);
      setIsDismissed(false);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    return () => window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
  }, []);

  const visible = useMemo(() => !isDismissed && (installEvent || showIosGuide), [installEvent, isDismissed, showIosGuide]);

  async function installApp() {
    if (!installEvent) return;
    await installEvent.prompt();
    const choice = await installEvent.userChoice.catch(() => null);
    if (choice?.outcome === "accepted") {
      setIsDismissed(true);
      window.localStorage.setItem(dismissedKey, "1");
    }
    setInstallEvent(null);
  }

  function dismiss() {
    setIsDismissed(true);
    window.localStorage.setItem(dismissedKey, "1");
  }

  if (!visible) return null;

  return (
    <div className="fixed inset-x-3 bottom-3 z-50 mx-auto max-w-md rounded-lg border border-accent-blue/30 bg-slate-950/95 p-3 text-white shadow-[0_22px_70px_rgba(0,0,0,0.45)] backdrop-blur sm:right-4 sm:left-auto">
      <div className="flex items-start gap-3">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-md border border-accent-blue/30 bg-accent-blue/10 text-accent-blue">
          <Download size={18} aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-black">차트 레이더를 앱처럼 설치하세요.</p>
          <p className="mt-1 text-xs leading-5 text-slate-400">
            {installEvent
              ? "홈 화면에서 바로 열고, 브라우저 주소창 없이 레이더를 확인할 수 있습니다."
              : "iPhone에서는 공유 버튼을 누른 뒤 '홈 화면에 추가'를 선택하면 됩니다."}
          </p>
          {installEvent ? (
            <button
              type="button"
              onClick={installApp}
              className="mt-3 inline-flex min-h-9 items-center rounded-md bg-accent-blue px-3 text-xs font-black text-slate-950"
            >
              앱 설치하기
            </button>
          ) : null}
        </div>
        <button
          type="button"
          onClick={dismiss}
          className="grid h-8 w-8 shrink-0 place-items-center rounded-md border border-white/10 text-slate-400 hover:text-white"
          aria-label="앱 설치 안내 닫기"
        >
          <X size={15} aria-hidden />
        </button>
      </div>
    </div>
  );
}
