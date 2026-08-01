import type { AppPushDeviceState } from "@/lib/appPush";

const inFlightStages = new Set<AppPushDeviceState["registrationStage"]>([
  "checking_permission",
  "requesting_permission",
  "registering_device",
  "saving_token"
]);

/**
 * A first saved monitor is the only automatic activation moment. Explicit
 * denial is sticky, while failed or granted-but-unsynced states are safe to
 * retry without changing the user's alert-rule selections.
 */
export function shouldConnectPushAfterFirstMonitor(state: AppPushDeviceState | null | undefined) {
  if (!state?.supported || state.platform !== "android") return false;
  if (state.permission === "unsupported" || state.permission === "denied") return false;
  if (state.registrationStage === "denied" || inFlightStages.has(state.registrationStage)) return false;
  if (state.registrationStage === "enabled" && state.synced) return false;
  if (state.permission === "prompt" || state.permission === "prompt-with-rationale") {
    return state.registrationStage === "idle" || state.registrationStage === "failed";
  }
  return state.permission === "granted" && !state.synced;
}
