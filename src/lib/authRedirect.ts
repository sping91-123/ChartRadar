const defaultReturnTo = "/crypto";
const controlCharacterPattern = /[\u0000-\u001f\u007f]/;
const encodedControlOrBackslashPattern = /%(?:0[0-9a-f]|1[0-9a-f]|7f|5c|25)/i;

export function normalizeReturnTo(value: string | null | undefined) {
  if (!value || value.length > 2048) return null;
  const candidate = value.trim();
  if (
    !candidate.startsWith("/") ||
    candidate.startsWith("//") ||
    candidate.includes("\\") ||
    controlCharacterPattern.test(candidate) ||
    encodedControlOrBackslashPattern.test(candidate)
  ) {
    return null;
  }

  try {
    const base = new URL("https://chart-radar.invalid");
    const parsed = new URL(candidate, base);
    if (parsed.origin !== base.origin || !parsed.pathname.startsWith("/")) return null;
    const normalized = `${parsed.pathname}${parsed.search}${parsed.hash}`;
    if (normalized.startsWith("//") || normalized.includes("\\") || controlCharacterPattern.test(normalized)) return null;
    return normalized;
  } catch {
    return null;
  }
}

export function safeReturnTo(value: string | null | undefined, fallback = defaultReturnTo) {
  return normalizeReturnTo(value) ?? fallback;
}

export function trustedRequestOrigin(requestUrl: string, configuredOrigin = process.env.NEXT_PUBLIC_SITE_URL ?? process.env.SITE_URL) {
  const requestOrigin = new URL(requestUrl).origin;
  const configured = configuredOrigin ? new URL(configuredOrigin).origin : null;
  if (configured && requestOrigin === configured) return requestOrigin;

  const request = new URL(requestOrigin);
  const isLocalhost = request.hostname === "localhost" || request.hostname === "127.0.0.1" || request.hostname === "[::1]";
  if (isLocalhost && (request.protocol === "http:" || request.protocol === "https:")) return requestOrigin;
  if (configured) return configured;
  throw new Error("Trusted application origin is not configured.");
}
