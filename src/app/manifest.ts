// PWA 설치와 앱 아이콘 정보를 제공하는 매니페스트입니다.
import type { MetadataRoute } from "next";

const icon = "/brand/chart-radar-icon.png";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "차트 레이더",
    short_name: "차트 레이더",
    description: "코인과 글로벌 시장의 차트 흐름을 빠르게 감지하는 분석 레이더입니다.",
    start_url: "/?source=pwa",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0a0a0d",
    theme_color: "#0a0a0d",
    categories: ["finance", "productivity", "education"],
    lang: "ko-KR",
    shortcuts: [
      {
        name: "코인 레이더",
        short_name: "코인",
        description: "BTC와 ETH 시장 레이더를 바로 엽니다.",
        url: "/crypto/home?source=pwa-shortcut",
        icons: [{ src: icon, sizes: "1024x1024", type: "image/png" }]
      },
      {
        name: "알트코인 레이더",
        short_name: "알트코인",
        description: "알트코인 감지 목록을 바로 확인합니다.",
        url: "/crypto/perpetual/alts?source=pwa-shortcut",
        icons: [{ src: icon, sizes: "1024x1024", type: "image/png" }]
      },
      {
        name: "글로벌 레이더",
        short_name: "글로벌",
        description: "글로벌 시장 레이더를 바로 엽니다.",
        url: "/global?source=pwa-shortcut",
        icons: [{ src: icon, sizes: "1024x1024", type: "image/png" }]
      },
      {
        name: "레이더 뉴스",
        short_name: "뉴스",
        description: "오늘 시장 이슈와 매크로 체크를 바로 확인합니다.",
        url: "/crypto/news?source=pwa-shortcut",
        icons: [{ src: icon, sizes: "1024x1024", type: "image/png" }]
      }
    ],
    icons: [
      { src: icon, sizes: "1024x1024", type: "image/png", purpose: "any" },
      { src: icon, sizes: "1024x1024", type: "image/png", purpose: "maskable" }
    ]
  };
}
