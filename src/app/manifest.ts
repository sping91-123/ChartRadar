import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/survival",
    name: "차트 레이더 Beta",
    short_name: "차트 레이더",
    description: "진입 전 차트 구조와 포지션 리스크를 먼저 감지하는 코인 분석 레이더",
    start_url: "/survival?source=pwa",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#050608",
    theme_color: "#0ea5e9",
    categories: ["finance", "productivity", "education"],
    lang: "ko-KR",
    shortcuts: [
      {
        name: "BTC / ETH 레이더",
        short_name: "BTC / ETH",
        description: "비트코인과 이더리움 시장 레이더를 바로 엽니다.",
        url: "/survival?source=pwa-shortcut",
        icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }]
      },
      {
        name: "알트코인 레이더",
        short_name: "알트",
        description: "알트코인 감지 목록을 바로 확인합니다.",
        url: "/alts?source=pwa-shortcut",
        icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }]
      },
      {
        name: "레이더뉴스",
        short_name: "뉴스",
        description: "오늘 시장 이슈와 매크로 체크를 바로 확인합니다.",
        url: "/news?source=pwa-shortcut",
        icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }]
      }
    ],
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "maskable"
      }
    ]
  };
}
