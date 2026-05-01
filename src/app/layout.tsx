import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "코털스 | 생존진단",
    template: "%s | 코털스"
  },
  description: "거래소 페이백, 심화반 트레이딩 교육, 진입 전 생존진단을 제공하는 코털스 공식 웹사이트",
  applicationName: "코털스",
  keywords: [
    "코털스",
    "거래소 페이백",
    "트레이딩 교육",
    "비트코인",
    "MSB",
    "CHoCH",
    "FVG",
    "OB",
    "생존진단"
  ],
  openGraph: {
    title: "코털스 | 생존진단",
    description: "코인에 털린 사람들을 위한 코털스 공식 웹사이트와 진입 전 생존진단 도구",
    type: "website",
    locale: "ko_KR"
  },
  robots: {
    index: true,
    follow: true
  },
  twitter: {
    card: "summary_large_image",
    title: "코털스 | 생존진단",
    description: "거래소 페이백, 심화반, 차트 판독을 한 곳에서 확인하세요."
  }
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
