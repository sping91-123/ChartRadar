import type { MetadataRoute } from "next";
import { getSiteUrlWithLocalFallback } from "@/lib/siteUrl";

const siteUrl = getSiteUrlWithLocalFallback();

const routes = [
  "",
  "/survival",
  "/alts",
  "/global",
  "/stocks",
  "/news",
  "/alerts",
  "/pro",
  "/calculator",
  "/journal",
  "/terms",
  "/privacy",
  "/refund"
];

const dailyCoreRoutes = new Set(["", "/survival", "/global", "/stocks"]);

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  return routes.map((route) => ({
    url: `${siteUrl}${route}`,
    lastModified,
    changeFrequency: dailyCoreRoutes.has(route) ? "daily" : "weekly",
    priority: route === "" ? 1 : route === "/survival" || route === "/global" ? 0.9 : route === "/stocks" ? 0.8 : 0.6
  }));
}
