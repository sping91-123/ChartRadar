"use client";
// 글로벌 자산레이더 옛 앵커 링크를 별도 자산 페이지로 넘기는 보조 컴포넌트입니다.
import { useEffect } from "react";

export function GlobalAssetHashRedirect() {
  useEffect(() => {
    if (window.location.hash === "#asset-radar") {
      window.location.replace("/global/assets");
    }
  }, []);

  return null;
}
