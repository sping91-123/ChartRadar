const productionScannerOrigin = "https://chartradar.kr";

export function resolvePushScannerOrigin(
  requestUrl: string,
  configuredSiteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? process.env.SITE_URL,
  nodeEnv = process.env.NODE_ENV
) {
  const request = new URL(requestUrl);
  const isLocalRequest =
    request.hostname === "localhost" ||
    request.hostname === "127.0.0.1" ||
    request.hostname === "[::1]";
  if (nodeEnv !== "production" && isLocalRequest && (request.protocol === "http:" || request.protocol === "https:")) {
    return request.origin;
  }

  if (!configuredSiteUrl) throw new Error("Public application origin is not configured for the Push scanner.");
  const configured = new URL(configuredSiteUrl);
  if (configured.origin.toLowerCase() !== productionScannerOrigin) {
    throw new Error("Push scanner origin must be the canonical HTTPS production host.");
  }
  return configured.origin;
}
