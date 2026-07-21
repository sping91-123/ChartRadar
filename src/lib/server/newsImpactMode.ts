export type NewsImpactMode = "off" | "shadow" | "on";

export interface NewsImpactRuntimePolicy {
  mode: NewsImpactMode;
  collect: boolean;
  expose: boolean;
  mutate: boolean;
  push: boolean;
}

export function newsImpactMode(value = process.env.NEWS_IMPACT_V1): NewsImpactMode {
  const normalized = value?.trim().toLowerCase();
  if (normalized === "shadow" || normalized === "on") return normalized;
  return "off";
}

export function isNewsImpactCollectionEnabled(mode = newsImpactMode()) {
  return mode === "shadow" || mode === "on";
}

export function isNewsImpactUiEnabled(mode = newsImpactMode()) {
  return mode === "on";
}

export function isNewsImpactPushEnabled(value = process.env.NEWS_IMPACT_PUSH_ENABLED) {
  return value?.trim().toLowerCase() === "true";
}

export function newsImpactRuntimePolicy(
  mode = newsImpactMode(),
  pushEnabled = isNewsImpactPushEnabled()
): NewsImpactRuntimePolicy {
  const expose = mode === "on";
  return {
    mode,
    collect: mode === "shadow" || expose,
    expose,
    mutate: expose,
    push: expose && pushEnabled
  };
}
