"use client";

import { useEffect, useMemo, useRef, type ReactNode } from "react";
import Link from "next/link";
import {
  buildCoinProHref,
  type CoinProPlacement,
  type CoinProRouteKey,
  type CoinProSource
} from "@/lib/coinProConversion";
import { trackProductEvent } from "@/lib/trackProductEvent";
import { useSupabaseAuth } from "@/lib/useSupabaseAuth";
import type { ProductEventSurface } from "@/lib/productEvents";

export function CoinProConversionLink({
  source,
  placement,
  routeKey,
  returnTo,
  symbol,
  surface,
  className,
  children
}: {
  source: CoinProSource;
  placement: CoinProPlacement;
  routeKey: CoinProRouteKey;
  returnTo?: string | null;
  symbol?: string | null;
  surface: ProductEventSurface;
  className?: string;
  children: ReactNode;
}) {
  const { session, isLoading } = useSupabaseAuth();
  const trackedGateRef = useRef<string | null>(null);
  const linkRef = useRef<HTMLAnchorElement>(null);
  const properties = useMemo(() => ({
    source,
    placement,
    routeKey,
    ...(symbol ? { symbol } : {}),
    ...(!isLoading ? { authState: session ? "authenticated" : "anonymous" } : {}),
    variant: "coin-pro-v2"
  } as const), [isLoading, placement, routeKey, session, source, symbol]);

  useEffect(() => {
    if (isLoading) return;
    const trackingKey = `${source}:${placement}:${routeKey}:${symbol ?? ""}`;
    if (trackedGateRef.current === trackingKey) return;
    const target = linkRef.current;
    if (!target || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting && entry.intersectionRatio >= 0.5)) return;
      if (trackedGateRef.current === trackingKey) return;
      trackedGateRef.current = trackingKey;
      void trackProductEvent({ eventName: "pro_gate_viewed", surface, properties });
      observer.disconnect();
    }, { threshold: 0.5 });
    observer.observe(target);
    return () => observer.disconnect();
  }, [isLoading, placement, properties, routeKey, source, surface, symbol]);

  return (
    <Link
      ref={linkRef}
      href={buildCoinProHref({ source, placement, routeKey, returnTo, symbol })}
      className={className}
      onClick={() => {
        void trackProductEvent({ eventName: "pro_cta_clicked", surface, properties });
      }}
    >
      {children}
    </Link>
  );
}
