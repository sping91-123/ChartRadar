import Link from "next/link";
import Image from "next/image";
import {
  ArrowRight,
  BadgePercent,
  BarChart3,
  BookOpen,
  CheckCircle2,
  MessageCircle,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Youtube
} from "lucide-react";

const exchanges = [
  {
    name: "OKX",
    logo: "/coters/okx-logo.webp",
    payback: "최대 20%",
    maker: "0.016%",
    taker: "0.04%",
    joinUrl: "https://www.okx.com/join/COTERS",
    guideUrl: "/legacy/referral-okx.html"
  },
  {
    name: "비트겟",
    logo: "/coters/bitget-logo.png",
    payback: "최대 20%",
    maker: "0.016%",
    taker: "0.04%",
    joinUrl: "https://partner.bitget.com/bg/COTERS20",
    guideUrl: "/legacy/referral-bitget.html"
  },
  {
    name: "BingX",
    logo: "/coters/bingx-logo-new.png",
    payback: "최대 45%",
    maker: "0.011%",
    taker: "0.0275%",
    joinUrl: "https://bingx.com/partner/COTERS/",
    guideUrl: "/legacy/referral-bingx.html"
  },
  {
    name: "Gate.io",
    logo: "/coters/gate-logo.png",
    payback: "최대 50%",
    maker: "0.01%",
    taker: "0.03%",
    joinUrl: "https://www.gate.com/share/COTERS",
    guideUrl: "/legacy/referral-gate.html"
  },
  {
    name: "LBank",
    logo: "/coters/lbank-logo-final.png",
    payback: "최대 30%",
    maker: "0.014%",
    taker: "0.034%",
    joinUrl: "https://lbank.com/ref/COTERS",
    guideUrl: "/legacy/referral-lbank.html"
  }
];

const productCards = [
  {
    title: "실시간 차트 판독",
    description: "BTCUSDT.P를 중심으로 MSB, CHoCH, OB, FVG, Sweep, OTE, 4H EMA200을 한 화면에서 정리합니다.",
    href: "/survival",
    icon: BarChart3
  },
  {
    title: "진입 전 생존진단",
    description: "진입가, 손절가, 시드, 레버리지를 기준으로 과한 자리인지 먼저 확인합니다.",
    href: "/diagnosis",
    icon: ShieldCheck
  },
  {
    title: "복기와 학습",
    description: "판독 결과를 저장하고, 다음 매매에서 고쳐야 할 리스크를 기록으로 남깁니다.",
    href: "/journal",
    icon: BookOpen
  }
];

const communities = [
  {
    title: "코털스 텔레그램",
    description: "심화반 인증과 주요 공지를 확인하세요.",
    href: "https://t.me/coterstube",
    icon: MessageCircle
  },
  {
    title: "코털스 TALK",
    description: "관점 공유와 커뮤니티 대화를 위한 공개 채널입니다.",
    href: "http://t.me/coters_talk",
    icon: MessageCircle
  },
  {
    title: "유튜브 멤버십",
    description: "영상 강의와 멤버십 콘텐츠로 학습 흐름을 이어갑니다.",
    href: "https://www.youtube.com/channel/UC6f5cQEVfoz9rLk7pMXTzYg/join",
    icon: Youtube
  }
];

export function LandingPage() {
  return (
    <main className="min-h-screen bg-[#050505] text-white">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#050505]/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <Link href="/" className="flex min-w-0 items-center gap-3">
            <Image
              src="/coters/coters-logo.jpg"
              alt="코털스"
              width={40}
              height={40}
              className="h-10 w-10 shrink-0 rounded-lg object-cover"
            />
            <div className="min-w-0">
              <p className="truncate text-base font-black text-white">코털스</p>
              <p className="truncate text-xs font-semibold text-amber-300">코인에 털린 사람들을 위한 채널</p>
            </div>
          </Link>

          <nav className="hidden items-center gap-6 text-sm font-semibold text-slate-300 md:flex">
            <a href="#exchanges" className="hover:text-white">거래소</a>
            <a href="#premium" className="hover:text-white">심화반</a>
            <a href="#community" className="hover:text-white">커뮤니티</a>
            <Link href="/survival" className="hover:text-white">생존진단</Link>
          </nav>

          <Link
            href="/survival"
            className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-md bg-amber-300 px-3 text-sm font-black text-black hover:bg-amber-200"
          >
            생존진단
            <ArrowRight size={16} aria-hidden />
          </Link>
        </div>
      </header>

      <section className="relative overflow-hidden border-b border-white/10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(251,191,36,0.18),transparent_32%),radial-gradient(circle_at_76%_12%,rgba(56,189,248,0.16),transparent_28%)]" />
        <div className="relative mx-auto grid min-h-[calc(100vh-64px)] max-w-6xl items-center gap-10 px-4 py-12 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-md border border-amber-300/30 bg-amber-300/10 px-3 py-1 text-xs font-black text-amber-200">
              <Sparkles size={14} aria-hidden />
              최대 50% 수수료 페이백 + 진입 전 리스크 점검
            </div>
            <h1 className="mt-5 text-4xl font-black leading-tight tracking-normal text-white sm:text-5xl lg:text-6xl">
              코인에 털린 사람들을 위한 코털스
            </h1>
            <p className="mt-5 text-base leading-7 text-slate-300 sm:text-lg">
              거래소 페이백, 심화반 트레이딩 교육, 그리고 실시간 차트 기반 생존진단까지 한 곳에서 확인하세요.
              코털스는 수익 예측보다 먼저 원칙 위반과 위험한 자리를 걸러내는 데 집중합니다.
            </p>

            <div className="mt-7 grid gap-3 sm:flex">
              <Link
                href="/survival"
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-amber-300 px-5 text-sm font-black text-black hover:bg-amber-200"
              >
                생존진단 시작하기
                <ArrowRight size={17} aria-hidden />
              </Link>
              <a
                href="#exchanges"
                className="inline-flex min-h-12 items-center justify-center rounded-md border border-white/15 bg-white/5 px-5 text-sm font-bold text-white hover:border-amber-300/60"
              >
                거래소 페이백 보기
              </a>
            </div>

            <div className="mt-8 grid grid-cols-3 gap-3">
              {[
                ["50%", "최대 페이백"],
                ["5개", "제휴 거래소"],
                ["실시간", "차트 판독"]
              ].map(([value, label]) => (
                <div key={label} className="rounded-lg border border-white/10 bg-white/[0.04] p-3">
                  <p className="text-xl font-black text-amber-200">{value}</p>
                  <p className="mt-1 text-xs font-semibold text-slate-400">{label}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-white/10 bg-[#111]/80 p-4 shadow-glow">
            <div className="rounded-lg border border-amber-300/20 bg-black/40 p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-bold text-slate-500">COTERS SURVIVAL</p>
                  <h2 className="mt-1 text-2xl font-black text-white">진입 전 판독 요약</h2>
                </div>
                <span className="rounded-md bg-signal-success/15 px-2 py-1 text-xs font-black text-signal-success">
                  교육용
                </span>
              </div>
              <div className="mt-5 space-y-3">
                {[
                  ["상위 구조", "4H MSB 상승, EMA200 위"],
                  ["현재 위치", "디스카운트 구간 근접"],
                  ["주의 신호", "15m 추격 진입 위험"],
                  ["행동 가이드", "관찰 후 손절 기준 먼저 확정"]
                ].map(([label, value]) => (
                  <div key={label} className="flex items-center justify-between gap-4 rounded-md border border-white/10 bg-white/[0.03] px-3 py-3">
                    <span className="text-xs font-bold text-slate-500">{label}</span>
                    <span className="text-right text-sm font-bold text-white">{value}</span>
                  </div>
                ))}
              </div>
              <p className="mt-4 text-xs leading-5 text-slate-500">
                이 도구는 매수·매도 신호가 아니라, 진입 전 리스크 요소를 점검하기 위한 교육용 도구입니다.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section id="product" className="border-b border-white/10 py-14">
        <div className="mx-auto max-w-6xl px-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-black text-sky-300">코털스 생존진단</p>
              <h2 className="mt-2 text-3xl font-black tracking-normal text-white">오를지보다, 털릴 자리인지 먼저 봅니다</h2>
            </div>
            <Link href="/survival" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-sky-300/40 bg-sky-300/10 px-4 text-sm font-black text-sky-200 hover:bg-sky-300/15">
              판독 앱 열기
              <ArrowRight size={16} aria-hidden />
            </Link>
          </div>

          <div className="mt-7 grid gap-4 md:grid-cols-3">
            {productCards.map(({ title, description, href, icon: Icon }) => (
              <Link key={title} href={href} className="rounded-lg border border-white/10 bg-[#101010] p-5 hover:border-sky-300/40">
                <div className="grid h-11 w-11 place-items-center rounded-md border border-sky-300/25 bg-sky-300/10 text-sky-300">
                  <Icon size={21} aria-hidden />
                </div>
                <h3 className="mt-4 text-lg font-black text-white">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-400">{description}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section id="exchanges" className="border-b border-white/10 py-14">
        <div className="mx-auto max-w-6xl px-4">
          <div className="max-w-2xl">
            <p className="text-sm font-black text-amber-300">거래소 페이백</p>
            <h2 className="mt-2 text-3xl font-black tracking-normal text-white">코털스 제휴 거래소</h2>
            <p className="mt-3 text-sm leading-6 text-slate-400">
              거래소 선택은 수수료, 유동성, 사용성, 이벤트 조건을 함께 보고 결정하세요. 아래 링크는 코털스 제휴 링크입니다.
            </p>
          </div>

          <div className="mt-7 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {exchanges.map((exchange) => (
              <article key={exchange.name} className="rounded-lg border border-white/10 bg-[#101010] p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="grid h-12 w-12 place-items-center rounded-md bg-white p-2">
                      <Image
                        src={exchange.logo}
                        alt={exchange.name}
                        width={96}
                        height={40}
                        className="max-h-8 w-auto object-contain"
                      />
                    </div>
                    <div className="min-w-0">
                      <h3 className="truncate text-lg font-black text-white">{exchange.name}</h3>
                      <p className="text-sm font-bold text-amber-200">{exchange.payback}</p>
                    </div>
                  </div>
                  <BadgePercent className="shrink-0 text-amber-300" size={20} aria-hidden />
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
                  <div className="rounded-md border border-white/10 bg-white/[0.03] p-3">
                    <p className="text-xs font-bold text-slate-500">Maker</p>
                    <p className="mt-1 font-black text-white">{exchange.maker}</p>
                  </div>
                  <div className="rounded-md border border-white/10 bg-white/[0.03] p-3">
                    <p className="text-xs font-bold text-slate-500">Taker</p>
                    <p className="mt-1 font-black text-white">{exchange.taker}</p>
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <a
                    href={exchange.joinUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex min-h-10 items-center justify-center rounded-md bg-amber-300 px-3 text-sm font-black text-black hover:bg-amber-200"
                  >
                    가입하기
                  </a>
                  <a
                    href={exchange.guideUrl}
                    className="inline-flex min-h-10 items-center justify-center rounded-md border border-white/10 bg-white/5 px-3 text-sm font-bold text-slate-200 hover:border-amber-300/50"
                  >
                    가이드
                  </a>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="premium" className="border-b border-white/10 py-14">
        <div className="mx-auto grid max-w-6xl gap-6 px-4 lg:grid-cols-[0.9fr_1.1fr]">
          <div>
            <p className="text-sm font-black text-amber-300">코털스 심화반</p>
            <h2 className="mt-2 text-3xl font-black tracking-normal text-white">기법보다 먼저 구조와 대처를 배웁니다</h2>
            <p className="mt-3 text-sm leading-6 text-slate-400">
              MSB, OB, FVG, Liquidity Sweep, POC를 기준으로 타점뿐 아니라 무효화, 대처, 복기까지 연결합니다.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {[
              "3~4구간 상세 매매법 PDF",
              "타점과 무효화 기준 피드백",
              "세부 관점 및 실시간 시황 분석",
              "제휴 거래소 UID 인증 후 참여"
            ].map((text) => (
              <div key={text} className="flex items-start gap-3 rounded-lg border border-white/10 bg-[#101010] p-4">
                <CheckCircle2 className="mt-0.5 shrink-0 text-signal-success" size={18} aria-hidden />
                <p className="text-sm font-bold leading-6 text-slate-200">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="community" className="border-b border-white/10 py-14">
        <div className="mx-auto max-w-6xl px-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-black text-sky-300">커뮤니티</p>
              <h2 className="mt-2 text-3xl font-black tracking-normal text-white">혼자 매매하지 않도록</h2>
            </div>
            <div className="inline-flex items-center gap-2 text-sm font-semibold text-slate-400">
              <Smartphone size={17} aria-hidden />
              모바일에서도 바로 확인 가능
            </div>
          </div>

          <div className="mt-7 grid gap-4 md:grid-cols-3">
            {communities.map(({ title, description, href, icon: Icon }) => (
              <a
                key={title}
                href={href}
                target="_blank"
                rel="noreferrer"
                className="rounded-lg border border-white/10 bg-[#101010] p-5 hover:border-sky-300/40"
              >
                <Icon className="text-sky-300" size={24} aria-hidden />
                <h3 className="mt-4 text-lg font-black text-white">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-400">{description}</p>
              </a>
            ))}
          </div>
        </div>
      </section>

      <footer className="py-8">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 text-sm leading-6 text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <p>© 2026 코털스. All rights reserved.</p>
          <p>
            코털스 생존진단은 투자 조언이나 매수·매도 신호를 제공하지 않는 교육용 도구입니다.
          </p>
        </div>
      </footer>
    </main>
  );
}
