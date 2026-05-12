// PWA 설치와 앱 아이콘 정보를 제공하는 매니페스트.
import type { MetadataRoute } from "next";

const icon = "/brand/chart-radar-icon.png";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/survival",
    name: "Chart Radar",
    short_name: "Chart Radar",
    description: "코인과 글로벌 시장의 차트 흐름을 빠르게 감지하는 분석 레이더",
    start_url: "/?source=pwa",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#050608",
    theme_color: "#07142d",
    categories: ["finance", "productivity", "education"],
    lang: "ko-KR",
    shortcuts: [
      {
        name: "Coin Radar",
        short_name: "Coin",
        description: "BTC와 ETH 시장 레이더를 바로 엽니다.",
        url: "/survival?source=pwa-shortcut",
        icons: [{ src: icon, sizes: "1024x1024", type: "image/png" }]
      },
      {
        name: "Altcoin Radar",
        short_name: "Altcoin",
        description: "알트코인 감지 목록을 바로 확인합니다.",
        url: "/alts?source=pwa-shortcut",
        icons: [{ src: icon, sizes: "1024x1024", type: "image/png" }]
      },
      {
        name: "Global Radar",
        short_name: "Global",
        description: "글로벌 시장 레이더를 바로 엽니다.",
        url: "/global?source=pwa-shortcut",
        icons: [{ src: icon, sizes: "1024x1024", type: "image/png" }]
      },
      {
        name: "Radar News",
        short_name: "News",
        description: "오늘 시장 이슈와 매크로 체크를 바로 확인합니다.",
        url: "/news?source=pwa-shortcut",
        icons: [{ src: icon, sizes: "1024x1024", type: "image/png" }]
      }
    ],
    icons: [
      {
        src: icon,
        sizes: "1024x1024",
        type: "image/png",
        purpose: "any"
      },
      {
        src: icon,
        sizes: "1024x1024",
        type: "image/png",
        purpose: "maskable"
      }
    ]
  };
}
