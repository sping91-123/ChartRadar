// Chart Radar에서 사용하는 주요 지표와 구조 판독 기준을 카테고리별로 안내합니다.
import type { Metadata } from "next";
import { Activity, BarChart3, Bell, BookOpen, ChevronDown, Gauge, Globe2, Newspaper, ShieldAlert, Sparkles } from "lucide-react";
import { AppFooter } from "@/components/AppFooter";
import { Header } from "@/components/Header";
import { HistoryBackButton } from "@/components/HistoryBackButton";
import { AppSurface, DataRow, SectionHeader, StatusPill } from "@/components/ui/DesignPrimitives";

export const metadata: Metadata = {
  title: "용어 안내",
  description: "Chart Radar 주요 지표와 시장별 용어 안내"
};

const guideCategories = [
  {
    title: "레이더 판단",
    summary: "최종 판단, 판단 강도, 리스크 기준처럼 모든 레이더에 공통으로 쓰는 용어입니다.",
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
        name: "관망",
        body: "조건이 섞였거나 확인이 부족해 방향 확정보다 관망하기가 유리한 상태입니다. 모르는 상태가 아니라 확인 조건을 우선하는 판단입니다."
      },
      {
        name: "추적 조건",
        body: "시나리오가 더 선명해지려면 확인할 항목입니다. 돌파 유지, 거래량 회복, 지지·저항 반응처럼 다음 확인 기준을 뜻합니다."
      },
      {
        name: "무효화 기준",
        body: "기존 시나리오 강도를 낮추고 다시 봐야 하는 기준입니다. 기준선 반대편에 안착하면 판단을 재평가합니다."
      },
      {
        name: "리스크",
        body: "손실 가능성, 변동성, 구조 충돌, 이벤트 부담을 묶어 부르는 표현입니다. 리스크가 높으면 방향보다 방어 기준 확인이 먼저입니다."
      },
      {
        name: "A급 후보",
        body: "구조 정렬, 반응 구간, 리스크 조건을 종합해 우선 확인 대상으로 분류한 후보입니다. 좋은 후보라는 뜻이지 결과를 보장한다는 뜻은 아닙니다."
      },
      {
        name: "시장 온도",
        body: "시장이 얼마나 뜨겁거나 차가운지 보는 표현입니다. 뜨거울수록 추세가 강할 수 있지만 과열과 추격 리스크도 함께 봅니다."
      }
    ]
  },
  {
    title: "코인 지표",
    summary: "BTC/ETH 레이더에서 구조, 거래량, 변동성, 청산 압력을 읽을 때 쓰는 용어입니다.",
    icon: BarChart3,
    items: [
      {
        name: "BTC / ETH",
        body: "코인 시장의 기준 축으로 보는 대형 자산입니다. 알트보다 먼저 큰 방향, 거래량, 변동성을 확인합니다."
      },
      {
        name: "타임프레임",
        body: "5분, 15분, 1시간, 4시간, 1일처럼 차트를 보는 시간 단위입니다. 짧은 시간봉은 빠르지만 흔들림이 많고, 긴 시간봉은 큰 방향 확인에 유리합니다."
      },
      {
        name: "ICT 구조",
        body: "MSB, CHoCH, Sweep, CISD, OB, FVG, OTE 같은 구조 용어를 묶어 부르는 표현입니다. 가격이 어디서 반응하는지 확인하는 보조 기준입니다."
      },
      {
        name: "MSB / BOS / CHoCH",
        body: "고점과 저점의 깨짐으로 구조 유지와 성격 변화를 보는 용어입니다. MSB와 BOS는 구조 돌파, CHoCH는 흐름 변화 가능성을 확인할 때 씁니다."
      },
      {
        name: "OB / FVG / iFVG / OTE",
        body: "OB는 주문블록, FVG는 빠르게 지나간 비효율 구간, iFVG는 역할이 뒤집힌 FVG, OTE는 깊은 되돌림 관찰 영역입니다. 모두 단독 근거로 쓰지 않습니다."
      },
      {
        name: "POC / 거래량",
        body: "POC는 선택 구간에서 거래가 가장 많이 쌓인 가격대입니다. POC 근처는 균형 구간일 수 있어 방향 확정보다 반응 확인이 중요합니다."
      },
      {
        name: "변동성",
        body: "가격이 흔들리는 폭입니다. 변동성이 커질수록 빠른 움직임이 나올 수 있지만 손절 기준과 포지션 크기도 더 보수적으로 봅니다."
      },
      {
        name: "청산 압력",
        body: "레버리지 포지션이 한쪽으로 쏠려 가격이 반대로 움직일 때 강제 청산이 늘어날 수 있는 압력입니다. 방향보다 급격한 흔들림 점검에 가깝습니다."
      },
      {
        name: "추세 / 지지·저항",
        body: "추세는 가격 흐름의 큰 방향이고, 지지·저항은 가격이 멈추거나 되돌아올 수 있는 기준선입니다. 선 자체보다 반응을 확인합니다."
      }
    ]
  },
  {
    title: "알트코인 지표",
    summary: "알트 후보를 고를 때 쓰는 관심코인, TOP 후보, 유동성, 급변 감지 용어입니다.",
    icon: Activity,
    items: [
      {
        name: "관심코인",
        body: "사용자가 따로 저장해 반복 확인하는 코인입니다. 저장 후 변동성, 거래대금, 구조 변화가 다시 감지되는지 봅니다."
      },
      {
        name: "시장 레이더 TOP",
        body: "현재 조건이 상대적으로 잘 모인 알트 후보를 우선순위로 보여주는 목록입니다. 순위는 확인 순서를 줄이는 보조 기준입니다."
      },
      {
        name: "A급 / B급 / C급 후보",
        body: "구조 정렬, 반응 구간, 리스크 조건을 종합해 후보 품질을 나눈 표현입니다. 등급이 높아도 리스크 점검은 별도로 필요합니다."
      },
      {
        name: "후보 점수",
        body: "여러 조건이 얼마나 맞는지 0~100으로 정리한 보조 점수입니다. 높을수록 확인할 가치가 커질 수 있지만 낮은 리스크를 뜻하지는 않습니다."
      },
      {
        name: "알트 리스크",
        body: "급등 추격, 저유동성, BTC/ETH 흔들림, 변동성 확대처럼 알트에서 먼저 걸러야 할 위험 조건입니다."
      },
      {
        name: "무료 분석 횟수",
        body: "Basic 사용자에게 제공되는 제한된 확인 횟수입니다. 상세 조건과 반복 점검은 Pro 가치로 분리됩니다."
      },
      {
        name: "급변 감지",
        body: "변동률, 거래대금, 구조 변화가 짧은 시간에 커졌을 때 쓰는 표현입니다. 빠른 확인이 필요하지만 추격 리스크도 함께 봅니다."
      }
    ]
  },
  {
    title: "글로벌 지표",
    summary: "미국장과 글로벌 레이더에서 지수, 변동성, 섹터, 대장주 관계를 확인하는 용어입니다.",
    icon: Globe2,
    items: [
      {
        name: "Risk-On / Risk-Off",
        body: "위험자산 선호와 위험회피 상태를 뜻합니다. 지수선물, 금리, 달러, VIX, 섹터 흐름이 같은 방향인지 확인합니다."
      },
      {
        name: "QQQ / SPY",
        body: "나스닥100과 S&P500을 추적하는 대표 ETF입니다. 지수선물 흐름이 실제 ETF 가격 반응으로 이어지는지 확인하는 기준입니다."
      },
      {
        name: "NQ=F / ES=F",
        body: "나스닥100 선물과 S&P500 선물입니다. 미국장 시작 전 시장 방향과 본장 초반 확인 순서를 잡을 때 씁니다."
      },
      {
        name: "VIX",
        body: "시장 변동성 압력을 보는 대표 지표입니다. VIX가 강해지면 방향보다 리스크 점검과 변동성 관리가 우선입니다."
      },
      {
        name: "NVDA / SMH",
        body: "NVDA는 반도체 대장주, SMH는 반도체 ETF입니다. 지수 상승이 반도체 주도력과 함께 움직이는지 확인합니다."
      },
      {
        name: "GLD / CL=F",
        body: "GLD는 금 ETF, CL=F는 유가 선물입니다. 방어 자산과 인플레이션 부담을 간접 확인하는 보조 기준입니다."
      },
      {
        name: "시장 온도계",
        body: "지수, 섹터, 대장주, 매크로 압력이 얼마나 같은 방향으로 움직이는지 묶어 보는 표현입니다."
      },
      {
        name: "관계성 체크",
        body: "지수만 강한지, 섹터와 대장주까지 같이 강한지 확인하는 절차입니다. 흐름이 엇갈리면 판단 강도를 낮춰 봅니다."
      }
    ]
  },
  {
    title: "매크로/뉴스",
    summary: "경제 일정과 뉴스가 시장 변동성에 주는 압력을 읽을 때 쓰는 용어입니다.",
    icon: Newspaper,
    items: [
      {
        name: "CPI / PPI / PCE",
        body: "물가 압력을 보여주는 지표입니다. 예상보다 강하면 금리 부담을, 약하면 부담 완화 가능성을 볼 수 있지만 발표 직후 반응 확인이 우선입니다."
      },
      {
        name: "FOMC / Fed / Powell",
        body: "연준의 금리 경로와 유동성 기대를 바꿀 수 있는 이벤트입니다. 발언 자체보다 달러, 금리, 지수선물 반응을 함께 봅니다."
      },
      {
        name: "신규 실업수당 청구 / 고용",
        body: "고용 흐름과 경기 둔화 가능성을 확인하는 지표입니다. 너무 강해도 금리 부담, 너무 약해도 경기 둔화 우려가 생길 수 있습니다."
      },
      {
        name: "GDP / PMI",
        body: "경기 체력과 기업 활동 흐름을 확인하는 지표입니다. 결과보다 발표 직후 시장이 어떻게 해석하는지가 중요합니다."
      },
      {
        name: "중요 일정 / 참고 일정",
        body: "중요 일정은 발표 전후 변동성이 커질 수 있는 이벤트입니다. 참고 일정은 영향이 작을 수 있지만 가격 반응과 함께 확인합니다."
      },
      {
        name: "이벤트 압력",
        body: "일정과 뉴스가 시장 변동성을 키울 수 있는 정도를 묶어 보는 표현입니다. 방향보다 흔들림 대비에 가깝습니다."
      },
      {
        name: "뉴스 압력",
        body: "공개 뉴스가 우호, 부담, 변동성 확대 중 어느 쪽에 가까운지 묶어 보는 표현입니다. 뉴스만으로 방향을 단정하지 않습니다."
      }
    ]
  },
  {
    title: "알림 시그널",
    summary: "앱 푸시와 조건 감지 알림에서 쓰는 신호 이름입니다.",
    icon: Bell,
    items: [
      {
        name: "앱 푸시 알림",
        body: "앱을 계속 보고 있지 않아도 조건 변화가 감지되면 알려주는 기능입니다. 알림은 확인 보조이며 판단 자체를 대신하지 않습니다."
      },
      {
        name: "코인 레이더 조건 감지",
        body: "저장한 코인이나 레이더 후보에서 구조, 거래대금, 변동성 조건이 다시 맞을 때 쓰는 알림입니다."
      },
      {
        name: "청산 압력 급등",
        body: "롱/숏 비율, 미결제약정, 시장가 체결 쏠림이 과열될 때 알려줍니다. 급격한 흔들림 점검용입니다."
      },
      {
        name: "글로벌 모멘텀 전환",
        body: "QQQ/SPY, NQ/ES, VIX, 반도체, 달러·금 흐름 변화가 감지될 때 알려줍니다."
      },
      {
        name: "VIX 리스크",
        body: "변동성 압력이 커질 때 쓰는 알림 용어입니다. 신규 판단보다 리스크 점검을 먼저 보라는 의미입니다."
      },
      {
        name: "반도체 주도력",
        body: "NVDA, SMH, SOXX 같은 반도체 축이 지수보다 강하거나 약할 때 쓰는 글로벌 시그널입니다."
      },
      {
        name: "매크로 일정 임박",
        body: "CPI, FOMC, 고용처럼 변동성을 키울 수 있는 일정이 가까워졌을 때 알려주는 리마인더입니다."
      }
    ]
  },
  {
    title: "복기/저널",
    summary: "판단 이후 결과와 반복 실수를 정리할 때 쓰는 복기 용어입니다.",
    icon: BookOpen,
    items: [
      {
        name: "손익 결과",
        body: "판단 이후 실제 결과를 기록하는 항목입니다. 수익과 손실보다 원칙을 지켰는지 함께 확인합니다."
      },
      {
        name: "판단 이유",
        body: "당시 어떤 근거로 시나리오를 봤는지 적는 항목입니다. 구조, 거래량, 리스크, 뉴스 같은 판단 근거를 짧게 남깁니다."
      },
      {
        name: "무효화 기준",
        body: "판단이 틀렸다고 보고 재평가해야 했던 기준입니다. 복기에서는 이 기준을 지켰는지 확인합니다."
      },
      {
        name: "다음에 고칠 점",
        body: "반복되는 실수와 개선할 행동을 적는 항목입니다. 결과보다 다음 판단에서 줄일 실수에 초점을 둡니다."
      },
      {
        name: "복기 저장",
        body: "레이더 판단과 사용자의 메모를 남기는 기능입니다. 나중에 비슷한 상황을 비교하는 자료로 씁니다."
      }
    ]
  },
  {
    title: "계정/Pro 용어",
    summary: "Basic과 Pro의 노출 범위, 사용량, 상세 조건 잠금과 관련된 용어입니다.",
    icon: Sparkles,
    items: [
      {
        name: "Basic",
        body: "방향 요약과 일부 핵심 근거를 확인하는 기본 플랜입니다. 상세 조건, 무효화 기준, 세부 리스크는 제한될 수 있습니다."
      },
      {
        name: "Pro",
        body: "추적 조건, 무효화 기준, 상세 리스크, 알림 조건을 더 넓게 확인하는 플랜입니다. 제공 정보는 여전히 판단 보조입니다."
      },
      {
        name: "사용량 제한",
        body: "시장별 분석 횟수나 알림 조건 수에 적용되는 제한입니다. 과도한 호출을 막고 플랜별 제공 범위를 구분합니다."
      },
      {
        name: "잠금 항목",
        body: "Basic 화면에서는 보이지 않고 Pro에서 확인할 수 있는 상세 항목입니다. 방향 요약과 상세 조건을 분리하기 위한 구조입니다."
      }
    ]
  }
];

export default function LearnPage() {
  return (
    <main className="min-h-screen px-3 pb-10 sm:px-4">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-4">
        <Header />

        <HistoryBackButton className="w-fit" />

        <AppSurface variant="report" tone="panel" padding="lg" className="space-y-5">
          <SectionHeader
            eyebrow="Learn Center"
            title="용어 안내"
            description="궁금한 분야를 먼저 고른 뒤 필요한 용어만 펼쳐서 확인하세요. 모든 설명은 방향을 단정하지 않는 판단 보조 기준입니다."
            action={<StatusPill tone="info">{guideCategories.length}개 카테고리</StatusPill>}
          />

          <div className="divide-y divide-ui-line border-y border-ui-line">
            {guideCategories.map(({ title, summary, icon: Icon, items }, index) => (
              <details key={title} className="group">
                <summary className="flex cursor-pointer list-none items-start gap-3 py-4 marker:hidden [&::-webkit-details-marker]:hidden">
                  <span className="grid h-9 w-9 shrink-0 place-items-center text-ui-muted">
                    <Icon size={18} aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex min-w-0 flex-wrap items-center gap-2">
                      <span className="text-base font-semibold text-ui-text">{title}</span>
                      <StatusPill tone="info" className="min-h-6 px-2">{items.length}개 용어</StatusPill>
                    </span>
                    <span className="mt-1 block text-ui-body leading-5 text-ui-muted [word-break:keep-all]">{summary}</span>
                  </span>
                  <ChevronDown className="mt-1 shrink-0 text-ui-subtle transition group-open:rotate-180" size={17} aria-hidden />
                </summary>

                <div className="border-t border-ui-line pb-4">
                  <DataRow
                    label={`카테고리 ${index + 1}`}
                    value="선택 확인"
                    detail="용어를 펼쳐 짧은 정의만 확인하는 구조입니다."
                    className="py-3"
                  />
                  <div className="divide-y divide-ui-line border-y border-ui-line">
                    {items.map((item) => (
                      <details key={`${title}-${item.name}`} className="group/item">
                        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-3 text-left marker:hidden [&::-webkit-details-marker]:hidden">
                          <span className="min-w-0 text-sm font-semibold text-ui-text [word-break:keep-all]">{item.name}</span>
                          <span className="inline-flex shrink-0 items-center gap-1 text-ui-label font-semibold text-ui-subtle">
                            <span className="group-open/item:hidden">펼치기</span>
                            <span className="hidden group-open/item:inline">접기</span>
                            <ChevronDown className="transition group-open/item:rotate-180" size={14} aria-hidden />
                          </span>
                        </summary>
                        <p className="border-t border-ui-line px-3 pb-3 pt-2 text-ui-body leading-6 text-ui-muted [word-break:keep-all]">{item.body}</p>
                      </details>
                    ))}
                  </div>
                </div>
              </details>
            ))}
          </div>
        </AppSurface>

        <AppSurface tone="critical" variant="flat" padding="none" className="border-t border-amber-400/28 pt-4">
          <div className="flex items-start gap-3">
            <ShieldAlert className="mt-0.5 shrink-0" size={18} aria-hidden />
            <p className="text-ui-body leading-6 [word-break:keep-all]">
              지표가 여러 개 같은 방향을 가리켜도 결과를 보장하지 않습니다. 실제 판단 전에는 손절 기준, 포지션 크기, 발표 일정, 거래량을 따로 확인해야 합니다.
            </p>
          </div>
        </AppSurface>

        <AppFooter />
      </div>
    </main>
  );
}
