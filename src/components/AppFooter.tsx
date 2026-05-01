import { ShieldAlert } from "lucide-react";

export function AppFooter() {
  return (
    <footer className="rounded-lg border border-surface-line bg-surface-card p-4 text-xs leading-6 text-slate-500">
      <div className="flex items-start gap-3">
        <ShieldAlert className="mt-0.5 shrink-0 text-accent-blue" size={16} aria-hidden />
        <p>
          이 도구는 투자 조언이나 매수·매도 신호를 제공하지 않습니다. 사용자의 매매 계획과 차트
          상태에서 원칙 위반과 리스크 요소를 점검하기 위한 교육용 도구입니다. 모든 투자 판단과
          책임은 사용자 본인에게 있습니다.
        </p>
      </div>
    </footer>
  );
}
