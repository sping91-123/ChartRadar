// Chart Radar의 서비스 이용 조건을 안내하는 약관 페이지입니다.
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, FileText, ShieldAlert } from "lucide-react";
import { AppFooter } from "@/components/AppFooter";
import { Header } from "@/components/Header";

export const metadata: Metadata = {
  title: "이용약관",
  description: "Chart Radar 이용약관"
};

const sections = [
  {
    title: "1. 서비스 목적",
    body:
      "Chart Radar는 사용자가 진입 전 차트 구조, 변동성, 리스크, 시장 환경을 한 화면에서 정리해 볼 수 있도록 돕는 교육·분석 보조 도구입니다. 서비스가 제공하는 정보는 투자 자문, 매수·매도 추천, 수익 보장, 자동매매 지시가 아닙니다."
  },
  {
    title: "2. 투자 판단과 책임",
    body:
      "코인, 주식, ETF, 파생상품, 레버리지 상품 거래에는 원금 손실과 청산 위험이 있습니다. 사용자는 Chart Radar의 분석, 점수, 브리핑, 알림을 참고 자료로만 사용해야 하며, 모든 투자 판단과 결과에 대한 책임은 사용자 본인에게 있습니다."
  },
  {
    title: "3. 서비스 기능과 변경",
    body:
      "서비스 화면, 분석 기준, 데이터 범위, 알림 방식, 구독 상품은 운영 정책과 사용자 피드백에 따라 조정될 수 있습니다. 중요한 변경은 앱 또는 웹 화면에서 안내합니다."
  },
  {
    title: "4. 유료 구독과 Pro 이용",
    body:
      "Chart Radar Pro는 코인, 글로벌, 올마켓 구독으로 나뉩니다. 앱 결제는 Google Play 정책을 따르고, 웹 결제는 결제 대행사의 정책을 따릅니다. 결제가 확인된 계정은 선택한 시장의 Pro 기능을 이용할 수 있습니다."
  },
  {
    title: "5. 금지 행위",
    body:
      "사용자는 서비스를 무단 복제하거나, 자동화된 방식으로 과도하게 호출하거나, 타인의 계정을 사용하거나, 서비스 결과를 투자 자문·확정 신호처럼 재판매해서는 안 됩니다. 이러한 행위가 확인되면 이용이 제한될 수 있습니다."
  },
  {
    title: "6. 데이터와 면책",
    body:
      "시세와 지표 데이터는 외부 데이터 제공처, 네트워크 상태, 사용 환경, 제공처 제한의 영향을 받을 수 있습니다. 데이터 지연, 오류, 중단 또는 사용자의 매매 손실에 대해 서비스 운영자는 법령상 허용되는 범위 내에서 책임을 지지 않습니다."
  },
  {
    title: "7. 계정 삭제",
    body:
      "사용자는 언제든 계정과 저장 데이터를 삭제 요청할 수 있습니다. 계정 삭제 시 복기, 관심 종목, 알림 조건 등 계정 기반 데이터가 삭제되며, 법령상 보관이 필요한 결제·분쟁 관련 기록은 필요한 기간 동안 보관될 수 있습니다."
  }
];

export default function TermsPage() {
  return (
    <main className="min-h-screen px-4 pb-10">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-5">
        <Header />
        <Link href="/" className="inline-flex w-fit items-center gap-2 text-sm font-bold text-slate-400 hover:text-white">
          <ArrowLeft size={16} aria-hidden />
          홈으로 돌아가기
        </Link>

        <section className="rounded-lg border border-surface-line bg-surface-card p-5 shadow-glow">
          <div className="flex items-start gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-accent-blue/25 bg-accent-blue/10 text-accent-blue">
              <FileText size={20} aria-hidden />
            </div>
            <div>
              <h1 className="text-2xl font-black text-white">이용약관</h1>
              <p className="mt-2 text-sm leading-6 text-slate-400">시행일 2026년 5월 13일</p>
            </div>
          </div>

          <div className="mt-6 grid gap-4">
            {sections.map((section) => (
              <section key={section.title} className="rounded-lg border border-surface-line bg-surface-cardSoft p-4">
                <h2 className="text-base font-bold text-white">{section.title}</h2>
                <p className="mt-2 text-sm leading-7 text-slate-400 [word-break:keep-all]">{section.body}</p>
              </section>
            ))}
          </div>
        </section>

        <section className="rounded-lg border border-signal-warning/25 bg-signal-warning/10 p-4 text-sm leading-6 text-signal-warning">
          <div className="flex items-start gap-3">
            <ShieldAlert className="mt-0.5 shrink-0" size={18} aria-hidden />
            <p>
              Chart Radar는 매매 결정을 대신해 주는 서비스가 아닙니다. 실제 주문 전에는 거래소 또는 증권사 화면에서 가격, 수량,
              레버리지, 손절 기준을 직접 확인해 주세요.
            </p>
          </div>
        </section>

        <AppFooter />
      </div>
    </main>
  );
}
