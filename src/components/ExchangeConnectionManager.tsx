"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Clock3,
  Copy,
  ExternalLink,
  KeyRound,
  Link2,
  Loader2,
  LockKeyhole,
  RefreshCw,
  ShieldCheck,
  Trash2,
  Unplug
} from "lucide-react";
import { Header } from "@/components/Header";
import { ActionButton, AppSurface, DataRow, PanelCard, SectionHeader, StatusPill } from "@/components/ui/DesignPrimitives";
import { useSupabaseAuth } from "@/lib/useSupabaseAuth";

type Provider = "okx" | "bybit" | "bitget" | "bingx" | "lbank";
type ConnectionStatus =
  | "syncing"
  | "ready"
  | "partial"
  | "permission_changed"
  | "ip_mismatch"
  | "rate_limited"
  | "provider_unavailable"
  | "disconnected";

interface CapabilityPayload {
  mode: "off" | "shadow" | "on";
  canUse: boolean;
  isEntitled: boolean;
  canRead: boolean;
  canConnect: boolean;
  canSync: boolean;
  canCleanup: boolean;
  operationsEnabled: boolean;
  reason: string | null;
  egressIps: string[];
  connectionLimit: number;
  historyDays: number;
  providers: Array<{ id: Provider; enabled: boolean; comingSoon: boolean }>;
}

interface ConnectionPayload {
  id: string;
  provider: Exclude<Provider, "lbank">;
  label: string;
  accountMode: string;
  positionMode: string;
  status: ConnectionStatus;
  maskedApiKey: string;
  ipWhitelist: string[];
  historyDays: 30 | 90;
  lastSyncedAt: string | null;
  nextSyncAt: string;
  syncFailureCount: number;
  lastErrorCode: string | null;
  createdAt: string;
}

interface ConnectionsResponse {
  capabilities: CapabilityPayload;
  connections: ConnectionPayload[];
}

const providerLabels: Record<Provider, string> = {
  okx: "OKX",
  bybit: "Bybit",
  bitget: "Bitget",
  bingx: "BingX",
  lbank: "LBank Futures"
};

type ActiveProvider = Exclude<Provider, "lbank">;

interface ProviderSetupGuide {
  officialGuideUrl: string;
  menuPath: string;
  permissionTitle: string;
  permissionDetail: string;
  requiredFields: string;
  steps: Array<{ title: string; detail: string }>;
  caution: string;
}

const providerSetupGuides: Record<ActiveProvider, ProviderSetupGuide> = {
  okx: {
    officialGuideUrl: "https://www.okx.com/en-gb/help/api-faq",
    menuPath: "OKX 웹 로그인 → 프로필 → API 및 연결 → API 키 생성",
    permissionTitle: "Read만 선택",
    permissionDetail: "Read 외 Trade·Withdraw·Transfer·Loan·Earn 등 다른 권한은 모두 끕니다.",
    requiredFields: "API Key · Secret Key · Passphrase",
    steps: [
      {
        title: "API 키를 만드세요",
        detail: "API 이름과 사용 목적을 입력하고 직접 생성 방식의 키를 선택하세요."
      },
      {
        title: "조회 권한만 남기세요",
        detail: "권한은 Read 하나만 선택하고 Trade·Withdraw·Transfer·Loan·Earn 등 나머지는 모두 끄세요."
      },
      {
        title: "IP 제한은 선택입니다",
        detail: "IP 허용 목록을 비워 두어도 연결할 수 있습니다. 별도로 IP 제한을 사용하는 경우에만 아래 운영 IP를 등록하세요."
      },
      {
        title: "세 값을 입력하세요",
        detail: "발급된 API Key, Secret Key와 생성할 때 정한 Passphrase를 아래 입력란에 넣으세요."
      }
    ],
    caution: "OKX Passphrase는 분실하면 복구할 수 없습니다. 잊었다면 기존 키를 삭제하고 새 읽기 전용 키를 만드세요."
  },
  bybit: {
    officialGuideUrl: "https://bybit-exchange.github.io/docs/v5/user/apikey-info",
    menuPath: "Bybit 웹사이트 → 계정 → API → API 관리 → 새 키 생성",
    permissionTitle: "Read-Only + Contract 조회",
    permissionDetail: "Read-Only를 켜고 Contract의 Order·Position 조회 범위를 선택합니다.",
    requiredFields: "API Key · API Secret",
    steps: [
      {
        title: "웹사이트에서 키를 만드세요",
        detail: "Bybit 앱이 아닌 웹사이트의 API 관리에서 System-generated API Key를 생성하세요."
      },
      {
        title: "Read-Only로 제한하세요",
        detail: "키 자체는 Read-Only로 설정하고 Contract 아래 Order와 Position 조회 범위를 선택하세요."
      },
      {
        title: "IP 제한은 선택입니다",
        detail: "IP restriction을 켜지 않아도 연결할 수 있습니다. 별도로 제한할 때만 아래 운영 IP를 등록하세요."
      },
      {
        title: "두 값을 입력하세요",
        detail: "발급 화면의 API Key와 API Secret을 아래 입력란에 넣으세요."
      }
    ],
    caution: "Order·Position은 읽기 전용 키에서 체결·포지션 이력을 조회하기 위한 범위입니다. 키 자체가 Read-Only인지 반드시 확인하세요."
  },
  bitget: {
    officialGuideUrl: "https://www.bitget.com/api-doc/uta/guide",
    menuPath: "Bitget 웹 로그인 → 개인 센터 → API 관리 → 새 API 만들기",
    permissionTitle: "Read-only + UTA 조회",
    permissionDetail: "Unified Account Trade와 Unified Account Management를 읽기 전용으로 선택합니다.",
    requiredFields: "API Key · Secret Key · Passphrase",
    steps: [
      {
        title: "UTA용 키를 만드세요",
        detail: "API 메모와 Passphrase를 정하고 현재 v1이 지원하는 Unified Trading Account용 키를 생성하세요."
      },
      {
        title: "두 조회 범위를 선택하세요",
        detail: "Read-only에서 Unified Account Trade와 Unified Account Management를 선택하고 출금·이체 권한은 끄세요."
      },
      {
        title: "IP 제한은 선택입니다",
        detail: "IP 허용 목록을 비워 두어도 연결할 수 있습니다. 별도로 제한할 때만 아래 운영 IP를 등록하세요."
      },
      {
        title: "세 값을 입력하세요",
        detail: "API Key, Secret Key와 생성할 때 정한 Passphrase를 아래 입력란에 넣으세요."
      }
    ],
    caution: "현재 자동 복기는 Bitget UTA의 USDT 무기한 선물만 연결합니다. Classic 계정 키는 검증이 끝날 때까지 저장하지 않습니다."
  },
  bingx: {
    officialGuideUrl: "https://bingx.com/en-us/account/api/",
    menuPath: "BingX 웹 로그인 → 계정 → API 관리 → API 만들기",
    permissionTitle: "Reading만 선택",
    permissionDetail: "현물·마진·선물 거래, 출금, 내부·통합 이체와 옵션 권한은 모두 끕니다.",
    requiredFields: "API Key · Secret Key",
    steps: [
      {
        title: "API 키를 만드세요",
        detail: "BingX API 관리에서 복기 전용 키를 새로 생성하세요."
      },
      {
        title: "Reading만 켜세요",
        detail: "Reading만 허용하고 모든 거래·출금·내부 이체·통합 이체·옵션 권한은 끄세요."
      },
      {
        title: "IP 제한은 선택입니다",
        detail: "IP restriction을 활성화하지 않아도 연결할 수 있습니다. 별도로 제한할 때만 아래 운영 IP를 등록하세요."
      },
      {
        title: "두 값을 입력하세요",
        detail: "발급 화면의 API Key와 Secret Key를 아래 입력란에 넣으세요."
      }
    ],
    caution: "선물 이력을 읽더라도 Futures 거래 권한은 켜지 않습니다. 거래 권한이 하나라도 감지되면 ChartRadar가 키를 저장하지 않습니다."
  }
};

const statusCopy: Record<ConnectionStatus, { label: string; detail: string; tone: "long" | "watch" | "risk" | "info" }> = {
  syncing: { label: "동기화 중", detail: "체결과 수수료·펀딩 이력을 확인하고 있습니다.", tone: "info" },
  ready: { label: "정상", detail: "최근 동기화 범위의 원장 대사가 완료됐습니다.", tone: "long" },
  partial: { label: "일부 확인 필요", detail: "일부 주문 문맥이나 수수료 대사가 남아 통계에서 제외된 거래가 있습니다.", tone: "watch" },
  permission_changed: { label: "권한 변경", detail: "읽기 전용 권한을 다시 확인한 뒤 재연결해 주세요.", tone: "risk" },
  ip_mismatch: { label: "IP 접속 차단", detail: "API 키의 IP 제한을 끄거나 ChartRadar 서버를 허용한 뒤 다시 연결해 주세요.", tone: "risk" },
  rate_limited: { label: "요청 제한", detail: "거래소 요청 제한이 해제된 뒤 자동으로 다시 확인합니다.", tone: "watch" },
  provider_unavailable: { label: "거래소 응답 지연", detail: "거래소 응답이 복구된 뒤 다시 동기화합니다.", tone: "watch" },
  disconnected: { label: "연결 해제됨", detail: "API 자격정보는 삭제됐고 자동 동기화는 중단됐습니다.", tone: "info" }
};

function formatDate(value: string | null) {
  if (!value) return "아직 없음";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "확인 불가";
  return new Intl.DateTimeFormat("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

async function readApiError(response: Response) {
  const payload = await response.json().catch(() => null) as { error?: string } | null;
  return payload?.error ?? "요청을 완료하지 못했습니다.";
}

function ExchangeSetupGuide({
  provider,
  egressIps,
  onCopyIps
}: {
  provider: ActiveProvider;
  egressIps: string[];
  onCopyIps: () => void;
}) {
  const guide = providerSetupGuides[provider];
  const ipValue = egressIps.join(",");

  return (
    <section
      aria-labelledby={`${provider}-setup-guide-title`}
      className="mt-4 rounded-ui-md bg-ui-inset p-4 ring-1 ring-ui-line sm:p-5"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-ui-brand">먼저 거래소에서 설정</p>
          <h3 id={`${provider}-setup-guide-title`} className="mt-1 text-base font-black text-ui-text">
            {providerLabels[provider]} API 키 발급 방법
          </h3>
          <p className="mt-2 text-xs leading-5 text-ui-muted [word-break:keep-all]">{guide.menuPath}</p>
        </div>
        <a
          href={guide.officialGuideUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-ui-sm bg-ui-elevated px-3 text-sm font-semibold text-ui-text transition hover:bg-ui-panel"
        >
          공식 안내 열기
          <ExternalLink size={15} aria-hidden />
        </a>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-ui-sm bg-ui-panel p-3 ring-1 ring-ui-line">
          <p className="text-[11px] font-black uppercase tracking-[0.14em] text-ui-subtle">필수 권한</p>
          <p className="mt-1 text-sm font-black text-ui-text">{guide.permissionTitle}</p>
          <p className="mt-1 text-xs leading-5 text-ui-muted [word-break:keep-all]">{guide.permissionDetail}</p>
        </div>
        <div className="rounded-ui-sm bg-ui-panel p-3 ring-1 ring-ui-line">
          <p className="text-[11px] font-black uppercase tracking-[0.14em] text-ui-subtle">아래에 입력할 값</p>
          <p className="mt-1 text-sm font-black text-ui-text">{guide.requiredFields}</p>
          <p className="mt-1 text-xs leading-5 text-ui-muted">키 이름이나 거래소 로그인 비밀번호는 입력하지 않습니다.</p>
        </div>
      </div>

      <ol className="mt-4 grid gap-3">
        {guide.steps.map((step, index) => (
          <li key={step.title} className="flex items-start gap-3">
            <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-ui-brand text-xs font-black text-white">
              {index + 1}
            </span>
            <div className="min-w-0">
              <p className="text-sm font-black text-ui-text">{step.title}</p>
              <p className="mt-0.5 text-xs leading-5 text-ui-muted [word-break:keep-all]">{step.detail}</p>
              {index === 2 ? (
                egressIps.length ? (
                  <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
                    <code className="min-w-0 break-all rounded-ui-sm bg-ui-elevated px-3 py-2 text-xs font-bold text-ui-text ring-1 ring-ui-line">
                      {ipValue}
                    </code>
                    <button
                      type="button"
                      onClick={onCopyIps}
                      className="inline-flex min-h-9 shrink-0 items-center justify-center gap-2 rounded-ui-sm bg-ui-elevated px-3 text-xs font-black text-ui-text transition hover:bg-ui-panel"
                    >
                      <Copy size={14} aria-hidden />
                      IP 복사
                    </button>
                  </div>
                ) : (
                  <p className="mt-2 rounded-ui-sm bg-ui-long/10 px-3 py-2 text-xs font-bold leading-5 text-ui-long">
                    IP 허용 목록은 비워 두어도 됩니다. 읽기 전용 권한만 정확히 설정하세요.
                  </p>
                )
              ) : null}
            </div>
          </li>
        ))}
      </ol>

      <div className="mt-4 flex items-start gap-2 rounded-ui-sm bg-ui-watch/10 p-3 text-xs leading-5 text-ui-muted">
        <AlertTriangle size={16} className="mt-0.5 shrink-0 text-ui-watch" aria-hidden />
        <p className="[word-break:keep-all]">{guide.caution}</p>
      </div>
    </section>
  );
}

export function ExchangeConnectionManager() {
  const { session, user, isLoading: isAuthLoading } = useSupabaseAuth();
  const [data, setData] = useState<ConnectionsResponse | null>(null);
  const [selectedProvider, setSelectedProvider] = useState<Exclude<Provider, "lbank"> | null>(null);
  const [label, setLabel] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [secret, setSecret] = useState("");
  const [passphrase, setPassphrase] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [disconnectId, setDisconnectId] = useState<string | null>(null);
  const [isConnectionLoading, setIsConnectionLoading] = useState(false);
  const loadGenerationRef = useRef(0);
  const loadAbortRef = useRef<AbortController | null>(null);
  const identityRef = useRef(user?.id ?? "");

  const accessToken = session?.accessToken ?? "";
  const activeConnections = useMemo(
    () => data?.connections.filter((connection) => connection.status !== "disconnected") ?? [],
    [data?.connections]
  );
  const connectedProviders = useMemo(
    () => new Set(activeConnections.map((connection) => connection.provider)),
    [activeConnections]
  );
  const selectedProviderCapability = selectedProvider
    ? data?.capabilities.providers.find((provider) => provider.id === selectedProvider) ?? null
    : null;
  const canCreateSelectedConnection = Boolean(
    data &&
    selectedProvider &&
    selectedProviderCapability?.enabled &&
    data.capabilities.canConnect &&
    activeConnections.length < data.capabilities.connectionLimit &&
    !connectedProviders.has(selectedProvider)
  );

  const loadConnections = useCallback(async () => {
    loadAbortRef.current?.abort();
    const controller = new AbortController();
    loadAbortRef.current = controller;
    const generation = ++loadGenerationRef.current;
    if (!accessToken) {
      setData(null);
      setIsConnectionLoading(false);
      return;
    }
    setIsConnectionLoading(true);
    setError("");
    try {
      const response = await fetch("/api/exchange-connections", {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: "no-store",
        signal: controller.signal
      });
      if (!response.ok) throw new Error(await readApiError(response));
      const nextData = await response.json() as ConnectionsResponse;
      if (controller.signal.aborted || generation !== loadGenerationRef.current) return;
      setData(nextData);
    } catch (loadError) {
      if (controller.signal.aborted || generation !== loadGenerationRef.current) return;
      setData(null);
      setError(loadError instanceof Error ? loadError.message : "연결 정보를 불러오지 못했습니다.");
    } finally {
      if (generation === loadGenerationRef.current) setIsConnectionLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    identityRef.current = user?.id ?? "";
    loadGenerationRef.current += 1;
    loadAbortRef.current?.abort();
    setData(null);
    setBusyId(null);
    setDisconnectId(null);
    setIsSubmitting(false);
    setIsConnectionLoading(false);
    setSelectedProvider(null);
    setLabel("");
    setApiKey("");
    setSecret("");
    setPassphrase("");
    setNotice("");
    setError("");
  }, [user?.id]);

  useEffect(() => {
    void loadConnections();
    return () => loadAbortRef.current?.abort();
  }, [loadConnections]);

  function clearSensitiveInputs() {
    setApiKey("");
    setSecret("");
    setPassphrase("");
  }

  async function connectExchange() {
    if (!selectedProvider || !apiKey.trim() || !secret.trim()) return;
    const ownerId = user?.id ?? "";
    setIsSubmitting(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/exchange-connections", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          provider: selectedProvider,
          label: label.trim(),
          apiKey: apiKey.trim(),
          secret: secret.trim(),
          passphrase: passphrase.trim()
        })
      });
      if (!response.ok) throw new Error(await readApiError(response));
      const payload = await response.json() as {
        initialSync?: { status?: "ready" | "partial"; warnings?: string[] } | null;
      };
      if (identityRef.current !== ownerId) return;
      clearSensitiveInputs();
      setLabel("");
      setSelectedProvider(null);
      setNotice(
        payload.initialSync?.status === "ready"
          ? "읽기 전용 권한 확인과 첫 동기화를 완료했습니다."
          : payload.initialSync?.status === "partial"
            ? "연결했습니다. 첫 원장 대사가 남아 일부 거래는 통계에서 제외됩니다."
            : "연결을 저장했습니다. 거래소 응답이 복구되면 첫 동기화를 다시 시도해 주세요."
      );
      await loadConnections();
    } catch (connectError) {
      clearSensitiveInputs();
      if (identityRef.current === ownerId) {
        setError(connectError instanceof Error ? connectError.message : "거래소를 연결하지 못했습니다.");
      }
    } finally {
      if (identityRef.current === ownerId) setIsSubmitting(false);
    }
  }

  async function syncConnection(connectionId: string) {
    const ownerId = user?.id ?? "";
    setBusyId(connectionId);
    setError("");
    setNotice("");
    try {
      const response = await fetch(`/api/exchange-connections/${encodeURIComponent(connectionId)}/sync`, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      if (!response.ok) throw new Error(await readApiError(response));
      if (identityRef.current !== ownerId) return;
      setNotice("동기화를 완료했습니다. 일부 거래는 대사가 끝날 때까지 통계에서 제외될 수 있습니다.");
      await loadConnections();
    } catch (syncError) {
      if (identityRef.current === ownerId) {
        const message = syncError instanceof Error ? syncError.message : "동기화를 완료하지 못했습니다.";
        await loadConnections();
        if (identityRef.current === ownerId) setError(message);
      }
    } finally {
      if (identityRef.current === ownerId) setBusyId(null);
    }
  }

  async function disconnectConnection(connectionId: string, deleteHistory: boolean) {
    const ownerId = user?.id ?? "";
    setBusyId(connectionId);
    setError("");
    setNotice("");
    try {
      const response = await fetch(
        `/api/exchange-connections/${encodeURIComponent(connectionId)}?deleteHistory=${deleteHistory ? "true" : "false"}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${accessToken}` }
        }
      );
      if (!response.ok) throw new Error(await readApiError(response));
      if (identityRef.current !== ownerId) return;
      setDisconnectId(null);
      setNotice(
        deleteHistory
          ? "API 자격정보와 자동 수집 거래내역을 삭제했습니다."
          : "API 자격정보를 삭제하고 동기화를 중단했습니다. 기존 복기 기록은 남겨두었습니다."
      );
      await loadConnections();
    } catch (disconnectError) {
      if (identityRef.current === ownerId) {
        setError(disconnectError instanceof Error ? disconnectError.message : "연결을 해제하지 못했습니다.");
      }
    } finally {
      if (identityRef.current === ownerId) setBusyId(null);
    }
  }

  return (
    <main className="min-h-[100dvh] px-3 pb-[calc(5rem+env(safe-area-inset-bottom))] sm:px-4">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-4">
        <Header market="crypto" />
        <Link href="/account" className="inline-flex w-fit items-center gap-2 text-sm font-semibold text-ui-muted hover:text-ui-text">
          <ArrowLeft size={16} aria-hidden />
          회원정보로 돌아가기
        </Link>

        <AppSurface variant="flat" padding="none" radius="none" className="border-b border-ui-line pb-5">
          <StatusPill tone="info" icon={ShieldCheck}>읽기 전용 연결</StatusPill>
          <h1 className="mt-3 text-2xl font-black tracking-tight text-ui-text sm:text-3xl">거래소 API 복기 연결</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-ui-muted [word-break:keep-all]">
            USDT 무기한 선물 체결·수수료·펀딩 이력만 읽습니다. ChartRadar에는 주문·취소·출금·이체 기능이 없습니다.
          </p>
        </AppSurface>

        {error ? (
          <div role="alert">
            <AppSurface tone="critical" variant="report" padding="md">
              <div className="flex items-start gap-2 text-sm font-semibold">
                <AlertTriangle size={18} className="mt-0.5 shrink-0" aria-hidden />
                <span>{error}</span>
              </div>
            </AppSurface>
          </div>
        ) : null}
        {notice ? (
          <div role="status">
            <AppSurface tone="inset" variant="report" padding="md">
              <div className="flex items-start gap-2 text-sm font-semibold text-ui-long">
                <CheckCircle2 size={18} className="mt-0.5 shrink-0" aria-hidden />
                <span>{notice}</span>
              </div>
            </AppSurface>
          </div>
        ) : null}

        {isAuthLoading ? (
          <PanelCard variant="report" padding="lg" className="flex items-center gap-2 text-sm text-ui-muted">
            <Loader2 className="animate-spin" size={18} aria-hidden />
            계정 상태를 확인하고 있습니다.
          </PanelCard>
        ) : !user || !accessToken ? (
          <PanelCard variant="report" padding="lg">
            <SectionHeader
              title="로그인이 필요합니다"
              description="API 자격정보와 자동 거래 원장은 로그인 계정에만 암호화해 저장합니다."
              action={<ActionButton href="/login" tone="primary">로그인</ActionButton>}
            />
          </PanelCard>
        ) : data ? (
          <>
            {data.capabilities.canUse && !data.capabilities.canRead ? (
              <PanelCard variant="report" padding="lg">
                <SectionHeader
                  eyebrow="운영 점검"
                  title="거래소 자동 복기가 잠시 닫혀 있습니다"
                  description="직접 복기는 계속 이용할 수 있습니다. 기존 연결이 있다면 이 화면에서 자격정보와 자동 수집 기록을 안전하게 정리할 수 있습니다."
                  action={<ActionButton href="/journal?mode=manual">직접 복기</ActionButton>}
                />
              </PanelCard>
            ) : null}
            {!data.capabilities.canUse ? (
              <PanelCard variant="report" padding="lg">
                <SectionHeader
                  eyebrow="Coin Pro"
                  title="거래소 API 복기는 Coin Pro 전용입니다"
                  description="새 연결과 동기화는 코인 권한이 포함된 유료 플랜에서 사용할 수 있습니다. 기존 연결이 있다면 아래에서 자격정보와 자동 수집 기록을 직접 정리할 수 있습니다."
                  action={<ActionButton href="/pro?market=crypto&source=exchange-journal" tone="primary">Coin Pro 보기</ActionButton>}
                />
              </PanelCard>
            ) : null}

            <PanelCard variant="report" padding="lg">
              <SectionHeader
                eyebrow={data.capabilities.canUse ? "Coin Pro" : "권한 안내"}
                title="연결 정책"
                description={
                  data.capabilities.canUse
                    ? `현재 플랜은 최대 ${data.capabilities.connectionLimit}개 거래소 · 최근 ${data.capabilities.historyDays}일 범위를 지원합니다.`
                    : "유료 코인 권한이 활성화되면 최대 5개 거래소 · 최근 90일 범위를 지원합니다."
                }
                action={
                  <StatusPill tone={data.capabilities.canUse && data.capabilities.canConnect ? "long" : "watch"}>
                    {!data.capabilities.canUse
                      ? "Coin Pro 필요"
                      : !data.capabilities.canRead
                        ? "운영 점검 중"
                        : data.capabilities.canConnect
                          ? "연결 가능"
                          : "출시 게이트 잠김"}
                  </StatusPill>
                }
              />
              <div className="mt-4 divide-y divide-ui-line">
                <DataRow
                  label="권한"
                  value="거래소별 허용 목록만"
                  detail="아래 안내한 조회 범위 외 쓰기·출금·이체 권한이 감지되면 저장하지 않습니다."
                />
                <DataRow label="동기화 목표" value="최대 15분 간격" detail="거래소 제한이나 점검 중에는 늦어질 수 있습니다." />
                <DataRow
                  label="IP 제한"
                  value={data.capabilities.egressIps.length ? "선택 · 운영 IP 제공" : "선택"}
                  detail={data.capabilities.egressIps.length
                    ? "IP 제한을 사용할 때만 아래 운영 IP를 등록하세요."
                    : "IP를 등록하지 않아도 읽기 전용 API 키를 연결할 수 있습니다."}
                />
              </div>
              {data.capabilities.egressIps.length ? (
                <ActionButton
                  className="mt-3"
                  onClick={() => void navigator.clipboard.writeText(data.capabilities.egressIps.join(","))}
                >
                  <Copy size={16} aria-hidden />
                  IP 복사
                </ActionButton>
              ) : null}
            </PanelCard>

            <PanelCard variant="report" padding="lg">
              <SectionHeader
                title="내 연결"
                description="연결 해제 시 API 자격정보는 즉시 삭제됩니다. 자동 수집 기록은 별도로 삭제할 수 있습니다."
                action={
                  <StatusPill tone="info" icon={Link2}>
                    {data.capabilities.canUse
                      ? `${activeConnections.length}/${data.capabilities.connectionLimit}`
                      : `${activeConnections.length}개 정리 가능`}
                  </StatusPill>
                }
              />
              <div className="mt-4 divide-y divide-ui-line">
                {activeConnections.length ? activeConnections.map((connection, connectionIndex) => {
                  const status = statusCopy[connection.status];
                  return (
                    <article key={connection.id} className="py-4 first:pt-0 last:pb-0">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-base font-black text-ui-text">
                              {providerLabels[connection.provider]}{connection.label ? ` · ${connection.label}` : ""}
                            </h3>
                            <StatusPill tone={status.tone}>{status.label}</StatusPill>
                          </div>
                          <p className="mt-2 text-xs leading-5 text-ui-muted [word-break:keep-all]">{status.detail}</p>
                          <p className="mt-2 text-xs text-ui-subtle">
                            {connection.maskedApiKey} · 마지막 동기화 {formatDate(connection.lastSyncedAt)}
                          </p>
                        </div>
                        <div className="flex shrink-0 flex-wrap gap-2">
                          <ActionButton
                            onClick={() => void syncConnection(connection.id)}
                            disabled={
                              busyId === connection.id ||
                              !data.capabilities.canSync ||
                              connection.status === "syncing" ||
                              connectionIndex >= data.capabilities.connectionLimit
                            }
                          >
                            {busyId === connection.id ? <Loader2 className="animate-spin" size={16} aria-hidden /> : <RefreshCw size={16} aria-hidden />}
                            동기화
                          </ActionButton>
                          <ActionButton tone="danger" onClick={() => setDisconnectId(connection.id)}>
                            <Unplug size={16} aria-hidden />
                            연결 해제
                          </ActionButton>
                        </div>
                      </div>
                      {disconnectId === connection.id ? (
                        <AppSurface tone="critical" variant="report" padding="md" className="mt-3">
                          <p className="text-sm font-semibold">API 자격정보는 두 선택 모두 즉시 삭제됩니다.</p>
                          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                            <ActionButton
                              onClick={() => void disconnectConnection(connection.id, false)}
                              disabled={busyId === connection.id}
                            >
                              기록은 남기고 해제
                            </ActionButton>
                            <ActionButton
                              tone="danger"
                              onClick={() => void disconnectConnection(connection.id, true)}
                              disabled={busyId === connection.id}
                            >
                              <Trash2 size={16} aria-hidden />
                              자동 수집 기록도 삭제
                            </ActionButton>
                            <ActionButton tone="ghost" onClick={() => setDisconnectId(null)}>취소</ActionButton>
                          </div>
                        </AppSurface>
                      ) : null}
                    </article>
                  );
                }) : (
                  <AppSurface tone="inset" variant="report" padding="md">
                    <p className="text-sm text-ui-muted">
                      {data.capabilities.canUse
                        ? "연결된 거래소가 없습니다."
                        : "정리할 기존 거래소 연결이 없습니다."}
                    </p>
                  </AppSurface>
                )}
              </div>
            </PanelCard>

            <PanelCard variant="report" padding="lg">
              <SectionHeader
                title="새 거래소 연결"
                description={
                  data.capabilities.canUse
                    ? data.capabilities.canRead
                      ? "거래소에서 읽기 전용 키를 만든 뒤 입력하세요. IP 제한은 선택입니다."
                      : "운영 점검이 끝난 뒤 새 읽기 전용 연결을 추가할 수 있습니다."
                    : "Coin Pro 권한이 활성화되면 읽기 전용 거래소 연결을 추가할 수 있습니다."
                }
              />
              {data.capabilities.canUse && data.capabilities.canRead ? (
                <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
                {data.capabilities.providers.map((provider) => {
                  const active = selectedProvider === provider.id;
                  const connected = provider.id !== "lbank" && connectedProviders.has(provider.id);
                  const stateLabel = provider.comingSoon
                    ? "검증 후 제공"
                    : connected
                      ? "연결됨"
                      : !provider.enabled
                        ? "연결 준비 중"
                        : !data.capabilities.canConnect
                          ? "설정 확인 가능"
                          : activeConnections.length >= data.capabilities.connectionLimit
                            ? "연결 한도 도달"
                            : "";
                  return (
                    <button
                      key={provider.id}
                      type="button"
                      disabled={provider.comingSoon}
                      onClick={() => {
                        clearSensitiveInputs();
                        setSelectedProvider(provider.id as Exclude<Provider, "lbank">);
                      }}
                      className={`min-h-12 rounded-ui-sm px-3 text-sm font-black transition disabled:cursor-not-allowed disabled:opacity-40 ${
                        active ? "bg-ui-brand text-white" : "bg-ui-elevated text-ui-text hover:bg-ui-inset"
                      }`}
                    >
                      {providerLabels[provider.id]}
                      {stateLabel ? <span className="block text-[10px] font-semibold">{stateLabel}</span> : null}
                    </button>
                  );
                })}
                </div>
              ) : (
                <AppSurface tone="inset" variant="report" padding="md" className="mt-4">
                  <div className="flex items-start gap-2">
                    <LockKeyhole size={18} className="mt-0.5 shrink-0 text-ui-watch" aria-hidden />
                    <div>
                      <p className="text-sm font-black text-ui-text">새 API 연결이 잠겨 있습니다</p>
                      <p className="mt-1 text-xs leading-5 text-ui-muted">
                        {data.capabilities.canUse
                          ? "운영 안전 조건을 다시 확인하는 동안 새 키 입력과 외부 거래소 호출을 받지 않습니다. 기존 연결 해제는 가능합니다."
                          : "직접 복기는 무료로 계속 이용할 수 있으며, 이 화면에서는 기존 자격정보 정리만 가능합니다."}
                      </p>
                    </div>
                  </div>
                </AppSurface>
              )}

              {data.capabilities.canUse && data.capabilities.canRead && selectedProvider ? (
                <>
                  <ExchangeSetupGuide
                    provider={selectedProvider}
                    egressIps={data.capabilities.egressIps}
                    onCopyIps={() => void navigator.clipboard.writeText(data.capabilities.egressIps.join(","))}
                  />
                  {canCreateSelectedConnection ? (
                    <AppSurface tone="inset" variant="report" padding="md" className="mt-4">
                      <div className="flex items-start gap-2">
                        <LockKeyhole size={18} className="mt-0.5 shrink-0 text-ui-brand" aria-hidden />
                        <div>
                          <p className="text-sm font-black text-ui-text">{providerLabels[selectedProvider]} 민감정보 입력</p>
                          <p className="mt-1 text-xs leading-5 text-ui-muted [word-break:keep-all]">
                            입력값은 브라우저 저장소에 보관하지 않으며, 서버에서 읽기 전용 권한을 확인한 뒤 AES-256-GCM으로 암호화합니다.
                          </p>
                        </div>
                      </div>
                      <form
                        className="mt-4 grid gap-4"
                        autoComplete="off"
                        onSubmit={(event) => {
                          event.preventDefault();
                          void connectExchange();
                        }}
                      >
                        <label className="grid gap-2 text-xs font-semibold text-ui-muted">
                          연결 이름 · 선택
                          <input
                            value={label}
                            onChange={(event) => setLabel(event.target.value)}
                            maxLength={80}
                            placeholder="예: 메인 선물 계정"
                            className="min-h-11 rounded-ui-sm bg-ui-panel px-3 text-sm text-ui-text outline-none ring-1 ring-ui-line focus:ring-ui-brand"
                          />
                        </label>
                        <label className="grid gap-2 text-xs font-semibold text-ui-muted">
                          API Key
                          <input
                            value={apiKey}
                            onChange={(event) => setApiKey(event.target.value)}
                            autoComplete="off"
                            autoCapitalize="none"
                            autoCorrect="off"
                            spellCheck={false}
                            required
                            className="min-h-11 rounded-ui-sm bg-ui-panel px-3 font-mono text-sm text-ui-text outline-none ring-1 ring-ui-line focus:ring-ui-brand"
                          />
                        </label>
                        <label className="grid gap-2 text-xs font-semibold text-ui-muted">
                          Secret
                          <input
                            type="password"
                            value={secret}
                            onChange={(event) => setSecret(event.target.value)}
                            autoComplete="new-password"
                            spellCheck={false}
                            required
                            className="min-h-11 rounded-ui-sm bg-ui-panel px-3 font-mono text-sm text-ui-text outline-none ring-1 ring-ui-line focus:ring-ui-brand"
                          />
                        </label>
                        {selectedProvider === "okx" || selectedProvider === "bitget" ? (
                          <label className="grid gap-2 text-xs font-semibold text-ui-muted">
                            Passphrase
                            <input
                              type="password"
                              value={passphrase}
                              onChange={(event) => setPassphrase(event.target.value)}
                              autoComplete="new-password"
                              spellCheck={false}
                              required
                              className="min-h-11 rounded-ui-sm bg-ui-panel px-3 font-mono text-sm text-ui-text outline-none ring-1 ring-ui-line focus:ring-ui-brand"
                            />
                          </label>
                        ) : null}
                        <div className="flex flex-col gap-2 sm:flex-row">
                          <ActionButton
                            type="submit"
                            tone="primary"
                            disabled={isSubmitting || !apiKey.trim() || !secret.trim() || ((selectedProvider === "okx" || selectedProvider === "bitget") && !passphrase.trim())}
                          >
                            {isSubmitting ? <Loader2 className="animate-spin" size={17} aria-hidden /> : <KeyRound size={17} aria-hidden />}
                            권한 확인 후 연결
                          </ActionButton>
                          <ActionButton
                            tone="ghost"
                            onClick={() => {
                              clearSensitiveInputs();
                              setSelectedProvider(null);
                            }}
                          >
                            취소
                          </ActionButton>
                        </div>
                      </form>
                    </AppSurface>
                  ) : (
                    <AppSurface tone="inset" variant="report" padding="md" className="mt-4">
                      <div className="flex items-start gap-2">
                        <LockKeyhole size={18} className="mt-0.5 shrink-0 text-ui-watch" aria-hidden />
                        <div>
                          <p className="text-sm font-black text-ui-text">{providerLabels[selectedProvider]} 민감정보 입력 잠김</p>
                          <p className="mt-1 text-xs leading-5 text-ui-muted [word-break:keep-all]">
                            {connectedProviders.has(selectedProvider)
                              ? "이미 연결된 거래소입니다. 위 내 연결에서 동기화하거나 연결을 해제할 수 있습니다."
                              : activeConnections.length >= data.capabilities.connectionLimit
                                ? "현재 플랜의 연결 한도를 모두 사용했습니다. 기존 연결을 정리한 뒤 다시 시도해 주세요."
                                : !selectedProviderCapability?.enabled
                                  ? "이 거래소는 소액 계정 대사와 권한 검증이 끝난 뒤 연결을 엽니다. 발급 방법만 먼저 확인할 수 있습니다."
                                  : "운영 연결 게이트가 아직 잠겨 있습니다. 발급 방법만 먼저 확인할 수 있습니다."}
                          </p>
                        </div>
                      </div>
                    </AppSurface>
                  )}
                </>
              ) : null}
            </PanelCard>

            <PanelCard variant="report" padding="lg">
              <SectionHeader title="보안 체크" />
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {[
                  ["거래소별 최소 조회 권한", "안내한 조회 범위 외 쓰기·출금·이체 권한이 있으면 자격정보를 저장하지 않습니다."],
                  ["IP 제한 선택", "IP 허용 목록 없이도 연결할 수 있습니다. 거래소에서 제한을 켠 경우에만 등록 IP를 확인합니다."],
                  ["서버 암호화", "레코드별 IV·인증 태그·AAD와 별도 버전 키를 사용합니다."],
                  ["즉시 해제", "연결 해제 시 암호화된 자격정보를 즉시 삭제하고 동기화를 멈춥니다."]
                ].map(([title, detail]) => (
                  <AppSurface key={title} tone="inset" variant="report" padding="md">
                    <div className="flex items-start gap-2">
                      <ShieldCheck size={17} className="mt-0.5 shrink-0 text-ui-long" aria-hidden />
                      <div>
                        <p className="text-sm font-black text-ui-text">{title}</p>
                        <p className="mt-1 text-xs leading-5 text-ui-muted [word-break:keep-all]">{detail}</p>
                      </div>
                    </div>
                  </AppSurface>
                ))}
              </div>
              <p className="mt-4 flex items-start gap-2 text-xs leading-5 text-ui-subtle">
                <Clock3 size={15} className="mt-0.5 shrink-0" aria-hidden />
                읽기 전용 권한이 확인되지 않거나 쓰기·출금·이체 권한이 감지되면 API 키를 저장하지 않습니다.
              </p>
            </PanelCard>
          </>
        ) : isConnectionLoading ? (
          <PanelCard variant="report" padding="lg" className="flex items-center gap-2 text-sm text-ui-muted">
            <Loader2 className="animate-spin" size={18} aria-hidden />
            거래소 연결 정보를 불러오는 중입니다.
          </PanelCard>
        ) : (
          <PanelCard variant="report" padding="lg">
            <SectionHeader
              title="연결 정보를 불러오지 못했습니다"
              description="민감 입력값은 지웠습니다. 네트워크와 로그인 상태를 확인한 뒤 다시 시도해 주세요."
              action={<ActionButton onClick={() => void loadConnections()}>다시 불러오기</ActionButton>}
            />
          </PanelCard>
        )}
      </div>
    </main>
  );
}
