// 코인 레이더 차트 DOM 컨테이너와 overlay shell을 담당하는 컴포넌트입니다.
import { forwardRef, type ReactNode } from "react";

interface CryptoChartPanelProps {
  chartClassName: string;
  children?: ReactNode;
}

export const CryptoChartPanel = forwardRef<HTMLDivElement, CryptoChartPanelProps>(function CryptoChartPanel(
  { chartClassName, children },
  ref
) {
  return (
    <div className="relative">
      <div ref={ref} className={chartClassName} />
      {children}
    </div>
  );
});
