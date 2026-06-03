"use client";

import type { MouseEvent } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { ActionButton } from "@/components/ui/DesignPrimitives";

export function HistoryBackButton({
  fallbackHref = "/menu",
  label = "이전으로 돌아가기",
  className
}: {
  fallbackHref?: string;
  label?: string;
  className?: string;
}) {
  const router = useRouter();

  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();

    const state = window.history.state as { idx?: number } | null;
    const referrer = document.referrer;
    let hasSameOriginReferrer = false;

    if (referrer) {
      try {
        hasSameOriginReferrer = new URL(referrer).origin === window.location.origin;
      } catch {
        hasSameOriginReferrer = false;
      }
    }

    if (hasSameOriginReferrer || (typeof state?.idx === "number" && state.idx > 0)) {
      router.back();
      return;
    }

    router.push(fallbackHref);
  };

  return (
    <ActionButton type="button" tone="ghost" className={className} onClick={handleClick}>
      <ArrowLeft size={16} aria-hidden />
      {label}
    </ActionButton>
  );
}
