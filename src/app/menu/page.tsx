import Link from "next/link";
import { Header } from "@/components/Header";
import { AppFooter } from "@/components/AppFooter";
import { PanelCard, SectionHeader } from "@/components/ui/DesignPrimitives";

const menuLinks = [
  { href: "/account", label: "회원정보관리", description: "로그인 상태와 계정 정보를 확인합니다." },
  { href: "/learn", label: "용어 안내", description: "지표와 시장별 용어를 카테고리별로 설명합니다." },
  { href: "/faq", label: "자주 묻는 질문", description: "서비스 성격, 데이터 기준, Pro와 결제 안내를 확인합니다." },
  { href: "/pro", label: "Pro", description: "구독 권한과 제공 범위를 확인합니다." },
  { href: "/terms", label: "이용약관", description: "서비스 이용 기준을 확인합니다." },
  { href: "/privacy", label: "개인정보 처리방침", description: "개인정보 처리 기준을 확인합니다." },
  { href: "/refund", label: "구독 해지·환불 안내", description: "구독 관리와 환불 안내를 확인합니다." }
] as const;

export default function MenuPage() {
  return (
    <main className="min-h-screen px-3 pb-10 sm:px-5">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 sm:gap-5">
        <Header />
        <PanelCard variant="report" padding="lg">
          <SectionHeader title="메뉴" description="계정, 안내, 정책 페이지로 이동합니다." />
          <div className="mt-4 divide-y divide-ui-line">
            {menuLinks.map((item) => (
              <Link key={item.href} href={item.href} className="block py-3 transition hover:text-ui-text">
                <p className="text-sm font-black text-ui-text">{item.label}</p>
                <p className="mt-1 text-xs font-semibold leading-5 text-ui-muted">{item.description}</p>
              </Link>
            ))}
          </div>
        </PanelCard>
        <AppFooter />
      </div>
    </main>
  );
}
