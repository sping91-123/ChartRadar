import { MessageSquareWarning } from "lucide-react";
import type { DiagnosisResult } from "@/types";

interface AdviceCardProps {
  result: DiagnosisResult | null;
}

export function AdviceCard({ result }: AdviceCardProps) {
  return (
    <section className="rounded-lg border border-surface-line bg-surface-card p-5">
      <div className="flex items-center gap-3">
        <MessageSquareWarning className="text-accent-blue" size={20} aria-hidden />
        <h2 className="text-lg font-bold text-white">코털스식 한마디</h2>
      </div>
      <p className="mt-3 text-sm leading-7 text-slate-300">
        {result
          ? result.advice
          : "진단을 실행하면 지금 자리에서 가장 먼저 조심해야 할 부분을 짧고 분명하게 정리해드립니다."}
      </p>
    </section>
  );
}
