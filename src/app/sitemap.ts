// 검색엔진에 공개할 주요 서비스 경로를 제공한다.
import type { MetadataRoute } from "next";
import { getSiteUrlWithLocalFallback } from "@/lib/siteUrl";

const siteUrl = getSiteUrlWithLocalFallback();

const routes = [
  "",
  "/crypto/home",
  "/crypto/spot",
  "/crypto/perpetual",
  "/crypto/perpetual/alts",
  "/crypto/news",
  "/crypto/review",
  "/crypto/alertlist",
  "/crypto/alertset",
  "/schedule",
  "/menu",
  "/account",
  "/learn",
  "/faq",
  "/global",
  "/stocks",
  "/alerts",
  "/pro",
  "/terms",
  "/privacy",
  "/account/delete",
  "/refund"
];

const dailyCoreRoutes = new Set(["", "/crypto/home", "/crypto/spot", "/crypto/perpetual", "/global", "/stocks"]);

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  return routes.map((route) => ({
    url: `${siteUrl}${route}`,
    lastModified,
    changeFrequency: dailyCoreRoutes.has(route) ? "daily" : "weekly",
    priority: route === "" ? 1 : route === "/crypto/home" || route === "/global" ? 0.9 : route === "/stocks" ? 0.8 : 0.6
  }));
}
