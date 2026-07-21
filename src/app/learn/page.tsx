// Chart Radar 화면에서 사용하는 판단 보조 용어를 카테고리별로 안내합니다.
import type { Metadata } from "next";
import { Activity, BarChart3, ChevronDown, Gauge, Globe2, Newspaper, ShieldAlert, Sparkles } from "lucide-react";
import { AppFooter } from "@/components/AppFooter";
import { Header } from "@/components/Header";
import { HistoryBackButton } from "@/components/HistoryBackButton";
import { AppSurface, DataRow, SectionHeader, StatusPill } from "@/components/ui/DesignPrimitives";

export const metadata: Metadata = {
  title: "용어 안내",
  description: "Chart Radar 화면별 판단 보조 용어 안내"
};

const guideCategories = [
  {
    title: "공통 판단 용어",
    summary: "모든 화면에서 반복되는 결론, 확인 조건, 리스크 기준을 이해하기 위한 용어입니다.",
    icon: Gauge,
    items: [
      {
        name: "오늘 결론",
        body: "현재 화면에서 가장 먼저 읽어야 할 요약입니다. 방향을 단정하기보다 오늘은 관망, 추적, 리스크 확인 중 어디에 가까운지 알려줍니다."
      },
      {
        name: "관망",
        body: "조건이 섞였거나 확인이 부족해 성급한 판단보다 다음 조건을 기다리는 상태입니다. 아무것도 보지 않는다는 뜻이 아니라 리스크를 먼저 확인한다는 뜻입니다."
      },
      {
        name: "추적",
        body: "조건이 조금 더 선명해지면 다시 볼 후보입니다. 가격 반응, 거래대금, 구조 변화가 이어지는지 확인하는 흐름입니다."
      },
      {
        name: "확인 필요",
        body: "현재 근거만으로 판단을 강하게 잡기 어렵다는 뜻입니다. 추가 데이터나 다음 반응이 나올 때까지 해석을 보류합니다."
      },
      {
        name: "리스크",
        body: "변동성, 구조 충돌, 이벤트 부담, 유동성 약화처럼 판단을 조심하게 만드는 요소입니다. 리스크가 크면 방향보다 방어적 확인이 먼저입니다."
      },
      {
        name: "추가 확인 조건",
        body: "결론을 다시 판단하기 위해 더 봐야 하는 조건입니다. 돌파 유지, 반등 지속, 거래대금 회복처럼 다음 확인 포인트를 뜻합니다."
      },
      {
        name: "다시 볼 조건",
        body: "지금은 결론을 강하게 내리지 않고, 어떤 변화가 생기면 다시 확인할지 정리한 기준입니다."
      },
      {
        name: "해석을 다시 볼 조건",
        body: "지금 보고 있는 흐름이 약해졌다고 보고 다시 확인해야 하는 조건입니다. 이 조건이 나오면 기존 해석을 낮추고 새 흐름을 확인합니다."
      },
      {
        name: "세부 근거",
        body: "상단 결론 뒤에 있는 데이터와 해석입니다. Basic은 핵심 요약을 먼저 보고, Pro에서는 더 넓은 판단 근거를 확인합니다."
      }
    ]
  },
  {
    title: "코인 홈 용어",
    summary: "코인 홈에서 오늘 시장 상태와 회복 조건, 조심할 점을 읽을 때 쓰는 용어입니다.",
    icon: BarChart3,
    items: [
      {
        name: "회복 확인 조건",
        body: "약한 시장이 다시 안정되는지 볼 때 필요한 조건입니다. BTC 흐름, 변동성 완화, 주요 코인 반응을 함께 확인합니다."
      },
      {
        name: "조심할 것",
        body: "오늘 화면에서 먼저 피하거나 낮춰 봐야 할 위험입니다. 변동성 확대, 약한 반등, 과열, 이벤트 부담이 여기에 들어갑니다."
      },
      {
        name: "판단 근거",
        body: "오늘 결론이 나온 이유를 보여주는 영역입니다. BTC 기준 지표, 대표 코인 상태, 보조 시장 환경을 함께 봅니다."
      },
      {
        name: "시장 상태",
        body: "오늘 코인 시장이 안정, 관망, 변동성 확대 중 어디에 가까운지 압축한 표현입니다. 단일 지표가 아니라 여러 근거를 묶은 요약입니다."
      },
      {
        name: "변동성 주의",
        body: "가격 움직임의 폭이 커질 수 있어 결론보다 리스크 확인이 더 중요하다는 뜻입니다."
      },
      {
        name: "BTC / ETH",
        body: "코인 시장의 기준 축으로 보는 대형 자산입니다. 알트보다 먼저 큰 방향, 거래대금, 변동성을 확인합니다."
      },
      {
        name: "상방 근거 / 하방 근거",
        body: "한쪽 방향을 보조하는 데이터가 상대적으로 많다는 뜻입니다. 결과를 단정하지 않고 반대 리스크도 함께 확인합니다."
      },
      {
        name: "타임프레임",
        body: "5분, 15분, 1시간, 4시간, 1일처럼 차트를 보는 시간 단위입니다. 짧은 시간봉은 빠른 변화, 긴 시간봉은 큰 흐름 확인에 씁니다."
      }
    ]
  },
  {
    title: "현물 용어",
    summary: "현물 페이지에서 관심 알트와 오늘 후보를 구분해 볼 때 쓰는 용어입니다.",
    icon: Activity,
    items: [
      {
        name: "내 관심 알트",
        body: "사용자가 저장해 반복 확인하는 알트입니다. 등록된 경우 오늘 현물 후보보다 먼저 상태를 확인할 수 있습니다."
      },
      {
        name: "오늘 현물 후보",
        body: "오늘 현물 화면에서 먼저 확인할 후보 묶음입니다. 조건을 압축해 보여주지만 결과를 보장하지 않습니다."
      },
      {
        name: "오늘 추적 후보",
        body: "현재 조건이 비교적 선명해 다시 볼 가치가 있는 후보입니다. 추적은 확인 흐름이지 행동 지시가 아닙니다."
      },
      {
        name: "눌림 확인 후보",
        body: "강한 움직임 뒤에 가격이 쉬어 가는지 보는 후보입니다. 바로 따라가기보다 반응과 리스크 기준을 함께 확인합니다."
      },
      {
        name: "추격 주의",
        body: "이미 빠르게 움직인 뒤라 변동성 부담이 커질 수 있다는 뜻입니다. 다음 확인 조건이 더 중요해지는 상태입니다."
      },
      {
        name: "저항 여유",
        body: "위쪽 기준까지 공간이 얼마나 남았는지 보는 보조 표현입니다. 여유가 작으면 리스크 기준을 더 보수적으로 봅니다."
      },
      {
        name: "거래대금",
        body: "해당 코인에 실제 거래가 얼마나 몰렸는지 보는 값입니다. 크다고 항상 좋다는 뜻은 아니며, 변동성 부담도 함께 봅니다."
      }
    ]
  },
  {
    title: "선물 용어",
    summary: "메이저 선물과 알트 선물에서 앱이 감지한 핵심 신호를 읽을 때 쓰는 용어입니다.",
    icon: Sparkles,
    items: [
      {
        name: "앱 감지 신호",
        body: "앱이 데이터에서 먼저 묶어낸 핵심 변화입니다. 사용자가 직접 확인해야 할 조건과 구분하기 위해 쓰는 표현입니다."
      },
      {
        name: "포지션 쏠림",
        body: "선물 시장 참여가 한쪽으로 몰리는 정도를 보는 표현입니다. 쏠림이 커질수록 반대 방향 흔들림 가능성도 함께 봅니다."
      },
      {
        name: "큰 체결 흐름",
        body: "일정 규모 이상의 큰 거래가 유입 또는 이탈 쪽으로 반복되는지 보는 값입니다. 단독 결론보다 변동성 확인에 가깝습니다."
      },
      {
        name: "유입",
        body: "큰 체결이나 유동성이 시장 안으로 들어오는 흐름을 뜻합니다. 추세 확인 전에는 보조 신호로만 봅니다."
      },
      {
        name: "이탈",
        body: "큰 체결이나 유동성이 빠져나가는 흐름을 뜻합니다. 반복되면 변동성 리스크를 더 확인합니다."
      },
      {
        name: "변동성 압력",
        body: "가격이 크게 흔들릴 가능성을 키우는 조건입니다. 방향보다 급격한 움직임과 리스크 기준을 먼저 봅니다."
      },
      {
        name: "포지션 압력",
        body: "미결제약정, 체결 흐름, 쏠림이 함께 커질 때 쓰는 보조 표현입니다. 과열인지 완화되는지 확인합니다."
      },
      {
        name: "메이저 / 알트 선물",
        body: "메이저 선물은 BTC/ETH 중심, 알트 선물은 SOL/XRP/DOGE/BNB 같은 알트 중심으로 구분해 봅니다."
      }
    ]
  },
  {
    title: "시장 환경 용어",
    summary: "시장 전체 조건을 보조 확인할 때 쓰는 용어입니다.",
    icon: Gauge,
    items: [
      {
        name: "시장 환경 참고",
        body: "특정 코인이나 자산만 보지 않고 전체 시장 분위기를 보조 확인하는 영역입니다."
      },
      {
        name: "스테이블코인 유동성",
        body: "코인 시장 주변의 대기 자금 흐름을 보는 보조값입니다. 늘거나 줄었다는 사실보다 가격 반응과 함께 확인합니다."
      },
      {
        name: "BTC 온체인 체온",
        body: "BTC 네트워크 수수료, 대기 거래, 혼잡도를 묶어 보는 변동성 참고값입니다. 선물 방향 결론이 아니라 보조 환경입니다."
      },
      {
        name: "옵션 예상 변동",
        body: "옵션 시장이 예상하는 가격 흔들림 범위입니다. 방향 호재가 아니라 변동성 주의로 읽습니다."
      },
      {
        name: "김치 프리미엄",
        body: "국내 가격과 해외 가격의 차이를 보는 표현입니다. 차이가 커지면 수급 왜곡이나 변동성 부담을 확인합니다."
      },
      {
        name: "환율",
        body: "원화와 달러 가치 변화입니다. 국내 체감 가격과 글로벌 자산 선호를 해석할 때 보조로 확인합니다."
      },
      {
        name: "도미넌스",
        body: "전체 코인 시장에서 특정 자산이 차지하는 비중입니다. BTC 중심 흐름인지 알트 확산인지 볼 때 참고합니다."
      }
    ]
  },
  {
    title: "글로벌 용어",
    summary: "미국장과 글로벌 화면에서 Risk-On/Off, 먼저 볼 자산, 리스크를 읽을 때 쓰는 용어입니다.",
    icon: Globe2,
    items: [
      {
        name: "미국장 30초 체크",
        body: "오늘 미국장 상태를 짧게 확인하는 상단 요약입니다. Risk-On, Risk-Off, 중립 확인 중 어디에 가까운지 보여줍니다."
      },
      {
        name: "Risk-On",
        body: "위험자산 선호가 상대적으로 강한 환경입니다. 지수, 섹터, 대장주가 함께 움직이는지 확인합니다."
      },
      {
        name: "Risk-Off",
        body: "위험회피 성격이 강한 환경입니다. VIX, 금리, 달러, 방어 자산 흐름을 함께 확인합니다."
      },
      {
        name: "먼저 볼 자산",
        body: "오늘 글로벌 화면에서 우선 확인할 자산 1~3개입니다. 숫자 나열보다 왜 먼저 보는지에 초점을 둡니다."
      },
      {
        name: "가장 중요한 리스크",
        body: "오늘 시장에서 판단을 흔들 수 있는 핵심 부담입니다. VIX, 금리, 달러, 섹터 약세, 이벤트 대기가 될 수 있습니다."
      },
      {
        name: "매크로 압력",
        body: "금리, 물가, 고용, 연준 이벤트가 시장 분위기에 주는 부담이나 완화 흐름입니다."
      },
      {
        name: "섹터 로테이션",
        body: "자금이 어느 업종으로 이동하는지 보는 표현입니다. 지수만 강한지, 여러 섹터로 확산되는지 확인합니다."
      },
      {
        name: "대장주 레이더",
        body: "NVDA, AAPL, MSFT 같은 대표 종목이 지수 분위기와 함께 움직이는지 보는 보조 영역입니다."
      }
    ]
  },
  {
    title: "뉴스 용어",
    summary: "뉴스 레이더에서 재료 분류와 갱신 상태를 읽을 때 쓰는 용어입니다.",
    icon: Newspaper,
    items: [
      {
        name: "상승 재료",
        body: "시장에 우호적으로 해석될 수 있는 뉴스입니다. 단독 결론이 아니라 가격 반응과 함께 확인합니다."
      },
      {
        name: "하락 재료",
        body: "시장 부담으로 해석될 수 있는 뉴스입니다. 영향이 실제로 이어지는지는 다른 지표와 함께 봅니다."
      },
      {
        name: "혼재 / 확인 필요",
        body: "긍정과 부정 요소가 함께 있거나 방향을 단정하기 어려운 뉴스입니다. 억지로 한쪽으로 분류하지 않는 상태입니다."
      },
      {
        name: "최근 갱신",
        body: "뉴스 레이더가 마지막으로 정리된 시각입니다. 오래된 뉴스인지 새로 반영된 흐름인지 확인할 때 봅니다."
      },
      {
        name: "이벤트 압력",
        body: "뉴스나 일정이 시장 변동성을 키울 수 있는 정도입니다. 방향보다 흔들림 가능성을 먼저 확인합니다."
      },
      {
        name: "참고 뉴스",
        body: "상단 결론을 보조하는 기사 목록입니다. 제목과 분류가 맞는지 보고, 중요한 뉴스만 추가로 확인합니다."
      }
    ]
  },
  {
    title: "Pro / 계정 용어",
    summary: "Basic과 Pro의 화면 노출 범위, 권한, 계정 페이지에서 보이는 용어입니다.",
    icon: Sparkles,
    items: [
      {
        name: "Basic",
        body: "오늘 결론과 핵심 리스크를 먼저 확인하는 기본 상태입니다. 일부 상세 근거와 조건은 제한될 수 있습니다."
      },
      {
        name: "Coin Pro",
        body: "코인 홈, 현물, 메이저 선물, 알트 선물의 세부 근거와 확인할 가격, 해석을 다시 볼 조건을 더 넓게 확인하는 권한입니다."
      },
      {
        name: "Global Pro",
        body: "미국장 30초 체크, 먼저 볼 자산, 글로벌 리스크 해석의 세부 근거를 더 넓게 확인하는 권한입니다."
      },
      {
        name: "All Market Pro",
        body: "코인과 글로벌 화면의 Pro 범위를 함께 확인하는 권한입니다. 두 시장을 연결해 판단 보조 흐름을 봅니다."
      },
      {
        name: "리스크 해석",
        body: "단순 수치보다 왜 조심해야 하는지 설명하는 Pro 영역입니다. 시장 환경과 화면별 조건을 함께 봅니다."
      },
      {
        name: "사용량 제한",
        body: "시장별 분석 횟수나 알림 조건 수에 적용되는 제한입니다. 플랜별 제공 범위를 구분하기 위한 장치입니다."
      },
      {
        name: "알림 / 복기 연결",
        body: "조건 확인과 기록 흐름을 이어 보는 기능입니다. 알림과 복기는 판단을 대신하지 않고 확인과 기록을 돕습니다."
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
            description="앱 화면에서 보이는 용어를 분야별로 펼쳐서 확인하세요. 모든 설명은 방향을 단정하지 않는 판단 보조 기준입니다."
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
              여러 근거가 같은 방향을 가리켜도 결과를 보장하지 않습니다. 실제 판단 전에는 리스크 기준, 발표 일정, 거래대금, 거래소 또는 증권사 화면의 조건을 따로 확인해야 합니다.
            </p>
          </div>
        </AppSurface>

        <AppFooter />
      </div>
    </main>
  );
}
