"use client";

import {
  perpetualAlertContextFromPushData,
  type PerpetualAlertContext,
  type PushTargetData
} from "@/lib/pushTargetPath";

const storageKey = "chartRadar.perpetualAlertContext";

export function rememberPerpetualAlertContext(data: PushTargetData | null | undefined) {
  if (typeof window === "undefined" || !data) return null;
  const context = perpetualAlertContextFromPushData(data);
  if (!context) return null;
  window.sessionStorage.setItem(storageKey, JSON.stringify(context));
  return context;
}
export function readPerpetualAlertContext(snapshotId: string): PerpetualAlertContext | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(storageKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PerpetualAlertContext;
    return parsed.snapshotId === snapshotId ? parsed : null;
  } catch {
    return null;
  }
}
