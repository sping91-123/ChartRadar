import Link from "next/link";
import { ShieldAlert } from "lucide-react";

export function AppFooter() {
  return (
    <footer className="rounded-lg border border-surface-line bg-surface-card p-4 text-xs leading-6 text-slate-500">
      <div className="flex items-start gap-3">
        <ShieldAlert className="mt-0.5 shrink-0 text-accent-blue" size={16} aria-hidden />
        <div className="space-y-2">
          <p>
            이 서비스는 매매 계획과 리스크 요소를 정리하는 교육용 보조 도구입니다.
            제공되는 모든 정보는 매수·매도 추천, 투자 자문, 수익 보장을 의미하지 않습니다.
            레버리지 거래는 원금 손실과 청산 위험이 있으며 모든 투자 판단과 책임은 사용자 본인에게 있습니다.
          </p>
          <p>
            코인 데이터는 Binance 가격을 기준으로 판독합니다.
            해외주식 데이터는 주요 종목의 방향 점검과 관심종목 선별을 돕는 보조 정보로 제공합니다.
          </p>
          <nav className="flex flex-wrap gap-x-3 gap-y-1 text-slate-400" aria-label="서비스 정책">
            <Link href="/terms" className="hover:text-white">
              이용약관
            </Link>
            <Link href="/privacy" className="hover:text-white">
              개인정보 처리방침
            </Link>
            <Link href="/refund" className="hover:text-white">
              구독 해지·환불 안내
            </Link>
          </nav>
          <p className="text-slate-600">Chart Radar.</p>
        </div>
      </div>
    </footer>
  );
}
