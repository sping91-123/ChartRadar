// 전역 메타데이터와 테마 초기화를 담당하는 루트 레이아웃.
import type { Metadata, Viewport } from "next";
import { AuthHashRescue } from "@/components/AuthHashRescue";
import { RadarAlertMonitor } from "@/components/RadarAlertMonitor";
import { SystemBarsThemeSync } from "@/components/SystemBarsThemeSync";
import { getSiteUrlWithLocalFallback } from "@/lib/siteUrl";
import "./globals.css";

const siteUrl = getSiteUrlWithLocalFallback();
const appIcon = "/brand/chart-radar-icon.png";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  manifest: "/manifest.webmanifest",
  title: {
    default: "Chart Radar",
    template: "%s | Chart Radar"
  },
  description: "코인과 글로벌 시장의 차트 구조, 기술지표, 시장 이슈를 빠르게 확인하는 분석 레이더",
  applicationName: "Chart Radar",
  keywords: [
    "Chart Radar",
    "차트 레이더",
    "코인 분석",
    "글로벌 시장 분석",
    "미국주식 분석",
    "미국주식",
    "ETF",
    "MSB",
    "CHoCH",
    "FVG",
    "OB",
    "POC",
    "리스크 관리"
  ],
  openGraph: {
    title: "Chart Radar",
    description: "코인과 글로벌 시장의 차트 구조, 기술지표, 시장 이슈를 빠르게 확인하세요.",
    type: "website",
    locale: "ko_KR",
    images: [{ url: appIcon, width: 1024, height: 1024, alt: "Chart Radar app icon" }]
  },
  robots: {
    index: true,
    follow: true
  },
  twitter: {
    card: "summary_large_image",
    title: "Chart Radar",
    description: "코인과 글로벌 시장의 차트 구조와 시장 이슈를 빠르게 확인하세요.",
    images: [appIcon]
  },
  appleWebApp: {
    capable: true,
    title: "Chart Radar",
    statusBarStyle: "black-translucent"
  },
  formatDetection: {
    telephone: false
  },
  icons: {
    icon: appIcon,
    apple: appIcon
  }
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0d" },
    { media: "(prefers-color-scheme: light)", color: "#0a0a0d" }
  ]
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <body>
        <script
          dangerouslySetInnerHTML={{
            __html:
              "try{localStorage.removeItem('chart-radar.theme');document.documentElement.classList.remove('theme-light','theme-system');document.documentElement.classList.add('theme-dark');document.documentElement.style.colorScheme='dark';document.querySelectorAll('meta[name=\"theme-color\"]').forEach(function(m){m.setAttribute('content','#0a0a0d');});}catch(e){document.documentElement.classList.add('theme-dark');}"
          }}
        />
        <AuthHashRescue />
        <SystemBarsThemeSync />
        <div className="app-shell">
          <div className="app-scroll-root">{children}</div>
        </div>
        <RadarAlertMonitor />
      </body>
    </html>
  );
}
