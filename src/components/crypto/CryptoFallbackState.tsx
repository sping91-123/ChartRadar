// 코인 레이더의 일반 loading/error 표시 UI를 담당하는 컴포넌트입니다.
import { AlertTriangle } from "lucide-react";

export function CryptoChartLoadingOverlay() {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-surface-cardSoft/85 backdrop-blur-sm">
      <div className="rounded-md border border-white/10 bg-black/30 px-4 py-3 text-sm font-semibold text-slate-200">
        <span className="radar-scan-line inline-flex rounded-md px-1">레이더가 차트 구조를 감지하는 중입니다.</span>
      </div>
    </div>
  );
}

export function CryptoErrorState({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-2 rounded-md border border-signal-danger/30 bg-signal-danger/10 p-3 text-sm leading-6 text-signal-danger">
      <AlertTriangle className="mt-0.5 shrink-0" size={16} aria-hidden />
      {message}
    </div>
  );
}
