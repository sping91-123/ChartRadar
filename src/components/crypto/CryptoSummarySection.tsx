// 코인 레이더 상단 판단 영역의 배치 shell을 담당하는 표시용 컴포넌트입니다.
import type { ReactNode } from "react";

interface CryptoSummarySectionProps {
  children: ReactNode;
}

export function CryptoSummarySection({ children }: CryptoSummarySectionProps) {
  return <div className="mt-4 space-y-4">{children}</div>;
}
