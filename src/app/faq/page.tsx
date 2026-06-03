// 설정 패널에서 분리된 고객지원용 FAQ 페이지입니다.
import type { Metadata } from "next";
import Link from "next/link";
import { Bell, CreditCard, HelpCircle, ShieldCheck, Sparkles } from "lucide-react";
import { AppFooter } from "@/components/AppFooter";
import { Header } from "@/components/Header";
import { HistoryBackButton } from "@/components/HistoryBackButton";

export const metadata: Metadata = {
  title: "자주 묻는 질문",
  description: "Chart Radar 서비스 성격, 데이터 기준, Pro와 결제 안내"
};

const faqItems = [
  {
    icon: ShieldCheck,
    question: "ChartRadar는 투자 조언인가요?",
    answer:
      "ChartRadar는 시장 상태, 리스크, 확인 조건을 정리하는 판단 보조 도구입니다. 특정 거래 행동이나 성과를 약속하지 않습니다."
  },
  {
    icon: HelpCircle,
    question: "가격과 지표는 어디 기준인가요?",
    answer:
      "가격과 지표는 공개 데이터 제공처와 거래소 API 기준으로 집계됩니다. 갱신 지연, 거래소별 차이, 네트워크 상태에 따라 화면 값이 달라질 수 있습니다."
  },
  {
    icon: Sparkles,
    question: "Pro에서는 무엇이 더 열리나요?",
    answer:
      "Basic은 오늘 결론과 핵심 리스크를 먼저 보여주고, Pro는 추적 조건, 무효화 기준, 세부 리스크, 알림과 복기 연결을 더 깊게 확인하는 구조입니다."
  },
  {
    icon: Bell,
    question: "알림과 복기는 어떻게 쓰나요?",
    answer:
      "알림은 조건 변화 확인용으로 쓰고, 복기는 판단 근거와 결과를 남겨 다음에 다시 볼 조건을 정리하는 데 사용합니다."
  },
  {
    icon: CreditCard,
    question: "결제와 환불은 어디서 확인하나요?",
    answer:
      "구독 관리는 결제한 스토어 또는 결제 화면에서 확인합니다. 해지와 환불 기준은 별도 안내 페이지에서 확인할 수 있습니다."
  }
];

export default function FaqPage() {
  return (
    <main className="min-h-screen px-4 pb-10">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-5">
        <Header />
        <HistoryBackButton className="w-fit" />

        <section className="border-y border-surface-line py-5">
          <div className="flex items-start gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center text-accent-blue">
              <HelpCircle size={20} aria-hidden />
            </div>
            <div>
              <h1 className="text-2xl font-black text-white">자주 묻는 질문</h1>
              <p className="mt-2 text-sm leading-6 text-slate-400 [word-break:keep-all]">
                ChartRadar를 사용할 때 자주 확인하는 서비스 성격, 데이터 기준, Pro와 결제 안내를 모았습니다.
              </p>
            </div>
          </div>

          <div className="mt-6 divide-y divide-surface-line border-y border-surface-line">
            {faqItems.map(({ icon: Icon, question, answer }) => (
              <section key={question} className="py-4">
                <div className="flex items-start gap-3">
                  <Icon className="mt-0.5 shrink-0 text-accent-blue" size={18} aria-hidden />
                  <div>
                    <h2 className="text-base font-black text-white">{question}</h2>
                    <p className="mt-2 text-sm leading-7 text-slate-400 [word-break:keep-all]">{answer}</p>
                  </div>
                </div>
              </section>
            ))}
          </div>
        </section>

        <section className="grid gap-3 border-y border-white/10 py-4 text-sm leading-6 text-slate-300 sm:grid-cols-3">
          <Link href="/terms" className="font-bold hover:text-white">
            이용약관
          </Link>
          <Link href="/privacy" className="font-bold hover:text-white">
            개인정보 처리방침
          </Link>
          <Link href="/refund" className="font-bold hover:text-white">
            구독 해지·환불 안내
          </Link>
        </section>

        <AppFooter />
      </div>
    </main>
  );
}
