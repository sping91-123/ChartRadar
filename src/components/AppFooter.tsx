// 서비스 하단의 투자 유의 문구와 정책 링크를 보여주는 푸터입니다.
import Link from "next/link";
import { ShieldAlert } from "lucide-react";

export function AppFooter() {
  return (
    <footer className="border-y border-surface-line py-4 text-xs leading-6 text-slate-500">
      <div className="flex items-start gap-3">
        <ShieldAlert className="mt-0.5 shrink-0 text-accent-blue" size={16} aria-hidden />
        <div className="space-y-2">
          <p>
            Chart Radar는 매매 계획과 리스크 요소를 정리하는 시장 분석 도구입니다. 제공되는 모든 정보는
            매수·매도 추천, 투자 자문, 성과 약속으로 해석될 수 없습니다. 레버리지 거래와 파생상품 거래에는 원금 손실과
            청산 위험이 있으며, 모든 투자 판단과 책임은 사용자 본인에게 있습니다.
          </p>
          <p>
            시장별 가격 데이터는 공개 데이터 제공처 기준으로 자동 집계됩니다. 데이터 제공처와 갱신 주기에 따라 실제
            거래 화면과 차이가 날 수 있으므로, 최종 주문 전에는 거래소 또는 증권사 화면에서 가격과 조건을 다시 확인해 주세요.
          </p>
          <nav className="flex flex-wrap gap-x-3 gap-y-1 text-slate-400" aria-label="서비스 정책">
            <Link href="/terms" className="hover:text-white">
              이용약관
            </Link>
            <Link href="/privacy" className="hover:text-white">
              개인정보 처리방침
            </Link>
            <Link href="/account/delete" className="hover:text-white">
              계정·데이터 삭제
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
