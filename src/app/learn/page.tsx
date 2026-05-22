// Chart Radar에서 사용하는 주요 지표와 구조 판독 기준을 안내합니다.
import type { Metadata } from "next";
import Link from "next/link";
import { Activity, ArrowLeft, BarChart3, Bell, BookOpen, Gauge, Globe2, Layers, Newspaper, ShieldAlert, Thermometer, Waves } from "lucide-react";
import { AppFooter } from "@/components/AppFooter";
import { Header } from "@/components/Header";

export const metadata: Metadata = {
  title: "지표 안내",
  description: "Chart Radar 주요 지표, 판단 강도, 레이더 용어 안내"
};

const guideSections = [
  {
    title: "판단 강도와 결과",
    icon: Gauge,
    items: [
      {
        name: "판단 강도",
        body: "여러 조건이 한 방향으로 얼마나 뚜렷하게 모였는지 나타내는 보조값입니다. 높아도 결과를 보장하지 않고, 낮으면 신호가 약하거나 관망 성격이 강합니다."
      },
      {
        name: "강함 / 보통 / 약함",
        body: "강함은 조건이 비교적 선명한 상태, 보통은 일부 조건만 맞는 상태, 약함은 추가 확인이 필요한 상태입니다. 어느 단계도 단독 판단 기준은 아닙니다."
      },
      {
        name: "롱 우위 / 숏 우위",
        body: "상방 또는 하방 시나리오 근거가 상대적으로 더 많다는 뜻입니다. 가격 반응, 거래량, 리스크 기준을 함께 확인하는 판단 보조 표현입니다."
      },
      {
        name: "관망 우위 / 고위험",
        body: "관망 우위는 조건이 섞였거나 확인이 부족한 상태입니다. 고위험은 변동성, 추격, 이벤트, 구조 충돌 등 방어적으로 봐야 할 조건이 누적된 상태입니다."
      },
      {
        name: "추적 조건 / 무효화 조건",
        body: "추적 조건은 시나리오가 더 선명해지려면 확인할 항목입니다. 무효화 조건은 기존 시나리오 강도를 낮추고 다시 봐야 하는 기준입니다."
      }
    ]
  },
  {
    title: "코인 구조 용어",
    icon: Layers,
    items: [
      {
        name: "타임프레임",
        body: "5분, 15분, 1시간, 4시간, 1일처럼 차트를 보는 시간 단위입니다. 짧은 시간봉은 빠르지만 흔들림이 많고, 긴 시간봉은 느리지만 큰 방향 확인에 유리합니다."
      },
      {
        name: "MSB / BOS / CHoCH",
        body: "고점과 저점의 깨짐으로 구조 유지와 성격 변화를 보는 용어입니다. MSB와 BOS는 구조 돌파, CHoCH는 흐름 변화 가능성을 확인할 때 씁니다."
      },
      {
        name: "Sweep / CISD / Displacement",
        body: "스윕은 이전 고점이나 저점을 건드린 뒤 되돌아오는 움직임입니다. CISD는 단기 상태 변화, Displacement는 강한 몸통 캔들로 방향 에너지를 확인하는 보조 신호입니다."
      },
      {
        name: "OB / FVG / iFVG / BB",
        body: "OB는 주문블록, FVG는 빠르게 지나간 비효율 구간, iFVG는 역할이 뒤집힌 FVG입니다. BB는 Breaker Block 성격의 반응 구간으로 보며 모두 단독 근거로 쓰지 않습니다."
      },
      {
        name: "OTE / PD / 프리미엄·디스카운트",
        body: "OTE는 되돌림이 깊게 들어온 관찰 영역입니다. PD는 현재 가격이 전체 범위에서 비싼 쪽인지 싼 쪽인지 보는 기준이며, 추격 리스크를 점검할 때 함께 씁니다."
      },
      {
        name: "킬존",
        body: "아시아, 런던, 뉴욕처럼 거래 반응이 자주 나오는 시간대입니다. 킬존 밖에서는 구조가 좋아 보여도 타이밍 신뢰도를 낮춰 봅니다."
      }
    ]
  },
  {
    title: "기술지표와 가격대",
    icon: BarChart3,
    items: [
      {
        name: "SMA / EMA / EMA200",
        body: "가격 평균선입니다. SMA는 단순 평균, EMA는 최근 가격 비중이 큰 평균입니다. EMA200은 큰 추세와 현재 가격 위치를 확인하는 장기 기준선으로 씁니다."
      },
      {
        name: "POC",
        body: "선택 구간에서 거래가 가장 많이 쌓인 가격대입니다. POC 근처는 균형 구간일 수 있어 방향 확정보다 반응 확인이 중요합니다."
      },
      {
        name: "VAH / VAL",
        body: "거래가 많이 몰린 가치 영역의 위쪽과 아래쪽 경계입니다. 이탈과 다시 들어오는 움직임은 추세 지속 또는 평균 회귀를 판단할 때 참고합니다."
      },
      {
        name: "VWAP / Volume MA",
        body: "VWAP은 거래량을 반영한 평균 체결 기준입니다. Volume MA는 최근 평균 거래량으로, 현재 움직임에 거래 참여가 붙는지 확인하는 보조값입니다."
      },
      {
        name: "지지선 / 저항선",
        body: "가격이 멈추거나 되돌아올 가능성을 점검하는 기준선입니다. 선 자체보다 돌파, 이탈, 다시 들어온 뒤의 반응을 함께 봅니다."
      },
      {
        name: "피보나치 되돌림",
        body: "최근 고점과 저점 사이에서 가격 위치를 비율로 나눠 보는 기준입니다. 되돌림 위치를 확인하는 보조 도구이며 방향을 보장하지 않습니다."
      }
    ]
  },
  {
    title: "모멘텀·변동성",
    icon: Waves,
    items: [
      {
        name: "RSI / Stochastic / Williams %R / CCI",
        body: "과열과 침체 정도를 보는 모멘텀 지표입니다. 높다고 항상 좋다는 뜻이 아니며, 강한 흐름과 추격 리스크를 함께 확인합니다."
      },
      {
        name: "MACD / ROC / Momentum / Ultimate Oscillator",
        body: "가격 흐름의 속도와 방향 전환 가능성을 보는 지표입니다. 늦게 반응할 수 있어 구조와 거래량을 함께 확인해야 합니다."
      },
      {
        name: "ADX / DMI / Aroon",
        body: "추세 강도와 방향성을 확인하는 지표입니다. 값이 높으면 방향성이 뚜렷할 수 있지만, 이미 많이 움직인 구간인지도 같이 봅니다."
      },
      {
        name: "Supertrend / SAR / 일목균형표",
        body: "추세 유지와 기준선 위치를 확인하는 지표입니다. 횡보장에서는 신호가 자주 바뀔 수 있어 단독 판단보다 보조 근거로 씁니다."
      },
      {
        name: "ATR / Bollinger / Keltner / Donchian",
        body: "변동성과 가격 범위를 보는 지표입니다. 폭이 커지면 방향 신호보다 손절 기준, 포지션 크기, 추격 리스크를 먼저 점검합니다."
      },
      {
        name: "MFI / OBV / CMF / A-D Line / Chaikin",
        body: "거래량과 자금 흐름이 어느 쪽에 더 붙는지 확인하는 지표입니다. 가격 구조와 같이 볼 때 신뢰도가 올라갑니다."
      },
      {
        name: "심리 참고값",
        body: "캔들 흐름으로 과열과 침체 정도를 0~100으로 읽은 참고값입니다. 높으면 추세가 강할 수 있지만 추격 위험도 함께 봐야 합니다."
      },
      {
        name: "캔들스틱 패턴",
        body: "도지, 장악형, 해머, 슈팅스타처럼 현재 캔들의 모양을 해석한 보조 신호입니다. 패턴 이후 다음 캔들 반응이 더 중요합니다."
      }
    ]
  },
  {
    title: "알트코인 레이더",
    icon: Activity,
    items: [
      {
        name: "A급 / B급 / C급 후보",
        body: "구조 정렬, 반응 구간, 리스크 조건을 종합해 후보 품질을 나눈 표현입니다. A급은 우선 확인 대상이라는 뜻이지 결과를 보장하지 않습니다."
      },
      {
        name: "후보 점수",
        body: "여러 조건이 얼마나 맞는지 0~100으로 정리한 보조 점수입니다. 높을수록 확인할 가치가 커질 수 있지만, 낮은 리스크를 뜻하지는 않습니다."
      },
      {
        name: "데이터 신뢰도",
        body: "구조, 타임프레임 정렬, 반응 구간, 리스크 조건이 얼마나 충분한지 보는 상태값입니다. 낮으면 관망 성격을 더 강하게 봅니다."
      },
      {
        name: "거래대금 / 저유동성 리스크",
        body: "거래대금은 시장 참여 규모를 보여줍니다. 저유동성은 가격이 쉽게 흔들릴 수 있다는 뜻이라 알트코인에서는 먼저 걸러야 할 리스크입니다."
      },
      {
        name: "급등 추격 / 변동성 확대",
        body: "가격이 이미 빠르게 움직였거나 캔들 폭이 커진 상태입니다. 방향보다 손절 기준이 멀어지는지, 흔들림이 커지는지를 먼저 확인합니다."
      },
      {
        name: "BTC/ETH 방향 의존",
        body: "알트코인은 BTC와 ETH 방향에 영향을 크게 받습니다. 개별 코인이 좋아 보여도 BTC/ETH가 흔들리면 판단 강도를 낮춰 봅니다."
      },
      {
        name: "관찰 대기 / 관심코인",
        body: "조건 일부는 보이지만 아직 추적 기준이 충분하지 않은 상태입니다. 관심코인은 저장해 두고 변동성, 거래대금, 구조 변화를 다시 확인하는 목록입니다."
      }
    ]
  },
  {
    title: "글로벌 레이더",
    icon: Globe2,
    items: [
      {
        name: "Risk-On / Risk-Off / Neutral",
        body: "위험자산 선호, 위험회피, 중립 상태를 뜻합니다. 지수선물, 금리, 달러, VIX, 섹터 흐름이 같은 방향인지 확인하는 보조 분류입니다."
      },
      {
        name: "NQ / ES / YM / RTY",
        body: "나스닥100, S&P500, 다우, 러셀2000 지수선물입니다. 미국장 시작 전 시장 방향과 확산 정도를 확인할 때 씁니다."
      },
      {
        name: "QQQ / SPY",
        body: "나스닥100과 S&P500을 추적하는 대표 ETF입니다. 지수선물 흐름이 실제 ETF 가격 반응으로 이어지는지 확인하는 기준입니다."
      },
      {
        name: "VIX / 달러 / 금리 프록시",
        body: "VIX는 변동성 압력, UUP는 달러 프록시, TLT·ZN=F·IEF·SHY는 금리 부담을 간접 확인하는 기준입니다. 실제 DXY나 10년물 금리 자체와는 다를 수 있습니다."
      },
      {
        name: "섹터 로테이션",
        body: "기술, 경기소비, 방어, 금융, 에너지, 반도체 등 섹터 간 힘의 이동을 봅니다. 성장 섹터만 강한지, 시장 전체로 확산되는지 확인합니다."
      },
      {
        name: "대장주 / 반도체 주도력",
        body: "NVDA, AAPL, MSFT, AMZN, META, TSLA 같은 종목과 SMH, SOXX 흐름을 봅니다. 지수 상승이 소수 대형주에만 의존하는지 점검합니다."
      },
      {
        name: "시장 폭 / 시장 온도",
        body: "얼마나 많은 자산과 섹터가 같은 방향으로 움직이는지 보는 표현입니다. 뜨거울수록 과열과 추격 리스크도 함께 확인합니다."
      }
    ]
  },
  {
    title: "매크로·뉴스",
    icon: Newspaper,
    items: [
      {
        name: "중요 / 참고",
        body: "중요는 발표 전후 변동성이 커질 수 있는 일정입니다. 참고는 시장 영향이 상대적으로 작지만, 가격 반응과 함께 확인할 수 있는 재료입니다."
      },
      {
        name: "CPI / PPI / PCE",
        body: "물가 압력을 보여주는 지표입니다. 예상보다 강하면 금리 부담을, 약하면 부담 완화 가능성을 볼 수 있지만 발표 직후 반응 확인이 우선입니다."
      },
      {
        name: "FOMC / Fed / Powell",
        body: "연준의 금리 경로와 유동성 기대를 바꿀 수 있는 이벤트입니다. 발언 자체보다 달러, 금리, 지수선물 반응을 함께 봅니다."
      },
      {
        name: "고용 / 실업수당 / GDP / PMI",
        body: "경기 체력과 둔화 우려를 확인하는 지표입니다. 너무 강해도 금리 부담, 너무 약해도 경기 둔화 우려가 생길 수 있습니다."
      },
      {
        name: "ETF 수급 / 규제 / 스테이블코인 / 유동성",
        body: "코인 시장 전체에 영향을 줄 수 있는 뉴스 축입니다. 단기 가격보다 BTC/ETH 반응, 도미넌스, 거래량 변화를 함께 확인합니다."
      },
      {
        name: "뉴스·이벤트 압력",
        body: "공개 뉴스가 우호, 부담, 변동성 확대 중 어느 쪽에 가까운지 묶어 보는 표현입니다. 뉴스만으로 방향을 단정하지 않습니다."
      }
    ]
  },
  {
    title: "알림 시그널",
    icon: Bell,
    items: [
      {
        name: "A급 레이더 감지",
        body: "여러 조건이 맞는 코인 후보가 새로 올라왔을 때 알려주는 Pro 알림입니다. 먼저 확인할 대상을 줄여주는 용도입니다."
      },
      {
        name: "청산 압력 급등",
        body: "롱/숏 비율, 미결제약정, 시장가 체결 쏠림이 과열될 때 알려줍니다. 한쪽 레버리지 포지션이 흔들리며 변동성이 커질 수 있다는 뜻입니다."
      },
      {
        name: "관심코인 급변",
        body: "저장한 코인의 변동률, 거래대금, MSB/CHoCH 변화가 커질 때 알려줍니다. 직접 새로고침하지 않아도 변화 여부를 확인하는 용도입니다."
      },
      {
        name: "뉴스·이벤트 리마인더",
        body: "주요 뉴스 묶음이나 CPI, FOMC, 고용 같은 시장 이벤트가 가까울 때 알려줍니다. 방향보다 변동성 준비를 돕는 알림입니다."
      },
      {
        name: "글로벌 모멘텀 전환",
        body: "QQQ/SPY, NQ/ES, VIX, 반도체, 달러·금 흐름 변화가 감지될 때 알려줍니다. 글로벌 시장 분위기 변화 확인용입니다."
      },
      {
        name: "리스크오프 조합 / 반도체 주도력",
        body: "VIX, 달러, 금 같은 방어 축이 강하거나 반도체가 지수보다 강해지거나 약해질 때 쓰는 알림 용어입니다."
      }
    ]
  },
  {
    title: "공통 리스크 용어",
    icon: Thermometer,
    items: [
      {
        name: "리스크",
        body: "손실 가능성, 변동성, 구조 충돌, 이벤트 부담을 묶어 부르는 표현입니다. 리스크가 높으면 방향보다 방어 기준 확인이 먼저입니다."
      },
      {
        name: "모멘텀",
        body: "가격이 한 방향으로 움직이는 힘과 속도입니다. 강한 모멘텀은 흐름 유지와 과열 가능성을 동시에 봐야 합니다."
      },
      {
        name: "변동성",
        body: "가격이 흔들리는 폭입니다. 변동성이 커질수록 빠른 움직임이 나올 수 있지만, 손절 기준과 포지션 크기도 더 보수적으로 봅니다."
      },
      {
        name: "청산 압력",
        body: "레버리지 포지션이 한쪽으로 쏠려 가격이 반대로 움직일 때 강제 청산이 늘어날 수 있는 압력입니다. 방향보다 급격한 흔들림 점검에 가깝습니다."
      },
      {
        name: "추격 리스크",
        body: "이미 많이 움직인 뒤 따라붙을 때 기준선이 멀어지는 위험입니다. Chart Radar는 이런 구간을 관망 또는 리스크 점검으로 낮춰 봅니다."
      },
      {
        name: "포지션 크기 / 손절 기준",
        body: "한 번의 판단에서 감당할 수 있는 손실 범위와 기준 가격입니다. 지표가 좋아 보여도 이 기준이 불리하면 판단 강도를 낮춰 봅니다."
      }
    ]
  }
];

export default function LearnPage() {
  return (
    <main className="min-h-screen px-4 pb-10">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-5">
        <Header />
        <Link href="/" className="inline-flex w-fit items-center gap-2 text-sm font-bold text-slate-400 hover:text-white">
          <ArrowLeft size={16} aria-hidden />
          홈으로 돌아가기
        </Link>

        <section className="enterprise-panel p-5 sm:p-6">
          <div className="flex items-start gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-cyan-300/25 bg-cyan-300/10 text-cyan-200">
              <BookOpen size={20} aria-hidden />
            </div>
            <div>
              <h1 className="text-2xl font-black text-white">지표 안내</h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
                Chart Radar가 화면에서 보여주는 주요 지표, 판단 강도, 레이더 용어의 의미를 정리합니다. 모든 지표는 방향을
                단정하기보다 구조와 리스크를 확인하는 판단 보조 기준입니다.
              </p>
            </div>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {guideSections.map(({ title, icon: Icon, items }) => (
              <section key={title} className="rounded-xl border border-surface-line bg-surface-cardSoft p-4">
                <div className="flex items-center gap-2">
                  <Icon className="text-cyan-300" size={18} aria-hidden />
                  <h2 className="text-base font-black text-white">{title}</h2>
                </div>
                <div className="mt-4 grid gap-3">
                  {items.map((item) => (
                    <article key={item.name} className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
                      <h3 className="text-sm font-black text-cyan-100">{item.name}</h3>
                      <p className="mt-2 text-sm leading-6 text-slate-400 [word-break:keep-all]">{item.body}</p>
                    </article>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </section>

        <section className="rounded-xl border border-signal-warning/25 bg-signal-warning/10 p-4 text-sm leading-6 text-signal-warning">
          <div className="flex items-start gap-3">
            <ShieldAlert className="mt-0.5 shrink-0" size={18} aria-hidden />
            <p>
              지표가 여러 개 같은 방향을 가리켜도 결과를 보장하지 않습니다. 실제 판단 전에는 손절 기준, 포지션 크기, 발표 일정, 거래량을 따로 확인해야 합니다.
            </p>
          </div>
        </section>

        <AppFooter />
      </div>
    </main>
  );
}
