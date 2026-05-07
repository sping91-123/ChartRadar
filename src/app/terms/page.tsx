import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, FileText, ShieldAlert } from "lucide-react";
import { AppFooter } from "@/components/AppFooter";
import { Header } from "@/components/Header";

export const metadata: Metadata = {
  title: "이용약관",
  description: "차트 레이더 Beta 이용약관"
};

const sections = [
  {
    title: "1. 서비스 목적",
    body:
      "이 서비스는 사용자가 진입 전 차트 구조, 포지션 리스크, 손절 기준, 복기 내용을 정리하도록 돕는 교육용 보조 도구입니다. 제공되는 정보는 투자 자문, 매수·매도 추천, 수익 보장, 자동매매 지시가 아닙니다."
  },
  {
    title: "2. 사용자 책임",
    body:
      "레버리지 거래와 파생상품 거래는 원금 손실과 청산 위험이 큽니다. 사용자는 서비스가 표시하는 판독, 후보, 계산 결과를 참고 정보로만 사용해야 하며, 모든 투자 판단과 결과에 대한 책임은 사용자 본인에게 있습니다."
  },
  {
    title: "3. 베타 기능",
    body:
      "현재 서비스는 공개 베타로 제공되며, 기능, 화면, 판독 기준, 저장 방식, 운영 방식은 사용자 피드백과 안정성 검토에 따라 변경될 수 있습니다. 베타 기간 중 저장한 복기와 설정은 정식 서비스 전환 과정에서 이전되지 않거나 초기화될 수 있습니다."
  },
  {
    title: "4. 금지 행위",
    body:
      "서비스를 무단 복제하거나, 자동화된 방식으로 과도하게 호출하거나, 타인의 계정을 사용하거나, 서비스 결과를 투자 자문·확정 신호처럼 재판매하는 행위를 금지합니다."
  },
  {
    title: "5. 면책",
    body:
      "서비스는 외부 거래소 데이터, 네트워크 상태, 브라우저 환경, 베타 판독 로직의 한계에 영향을 받을 수 있습니다. 서비스 제공자는 데이터 지연, 오류, 중단, 사용자의 매매 손실에 대해 책임을 지지 않습니다."
  },
  {
    title: "6. 약관 변경",
    body:
      "운영자는 서비스 개선과 법적 요구에 따라 약관을 변경할 수 있습니다. 중요한 변경이 있을 경우 서비스 화면 또는 공지 채널을 통해 안내합니다."
  }
];

export default function TermsPage() {
  return (
    <main className="min-h-screen px-4 pb-10">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-5">
        <Header />
        <Link href="/survival" className="inline-flex w-fit items-center gap-2 text-sm font-bold text-slate-400 hover:text-white">
          <ArrowLeft size={16} aria-hidden />
          서비스로 돌아가기
        </Link>

        <section className="rounded-lg border border-surface-line bg-surface-card p-5 shadow-glow">
          <div className="flex items-start gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-accent-blue/25 bg-accent-blue/10 text-accent-blue">
              <FileText size={20} aria-hidden />
            </div>
            <div>
              <h1 className="text-2xl font-black text-white">이용약관</h1>
              <p className="mt-2 text-sm leading-6 text-slate-400">
                시행일: 2026년 5월 7일 · 베타 서비스 기준
              </p>
            </div>
          </div>

          <div className="mt-6 grid gap-4">
            {sections.map((section) => (
              <section key={section.title} className="rounded-lg border border-surface-line bg-surface-cardSoft p-4">
                <h2 className="text-base font-bold text-white">{section.title}</h2>
                <p className="mt-2 text-sm leading-7 text-slate-400">{section.body}</p>
              </section>
            ))}
          </div>
        </section>

        <section className="rounded-lg border border-signal-warning/25 bg-signal-warning/10 p-4 text-sm leading-6 text-signal-warning">
          <div className="flex items-start gap-3">
            <ShieldAlert className="mt-0.5 shrink-0" size={18} aria-hidden />
            <p>
              본 약관은 베타 공개를 위한 기본 문서입니다. 정식 사업자 결제, 앱스토어 출시,
              해외 서비스 확장 전에는 전문가 검토를 권장합니다.
            </p>
          </div>
        </section>

        <AppFooter />
      </div>
    </main>
  );
}
