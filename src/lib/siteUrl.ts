// 배포 환경에서 사용할 Chart Radar 기본 URL을 안전하게 계산합니다.
const productionFallbackUrl = "https://chartradar.ai";
const localFallbackUrl = "http://127.0.0.1:3000";

export function getConfiguredSiteUrl() {
  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
  if (fromEnv) return fromEnv;

  const fromVercel = process.env.VERCEL_URL?.replace(/\/$/, "");
  if (fromVercel) return `https://${fromVercel}`;

  return process.env.NODE_ENV === "production" ? productionFallbackUrl : "";
}

export function getSiteUrlWithLocalFallback() {
  return getConfiguredSiteUrl() || localFallbackUrl;
}
