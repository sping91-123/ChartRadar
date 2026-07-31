import {
  activeExchangeProviders,
  type ActiveExchangeProvider,
  type ExchangeCredentialInput
} from "@/lib/exchangeJournal";
import {
  createExchangeConnection,
  listExchangeConnections,
  publicExchangeConnection
} from "@/lib/server/exchangeConnectionStore";
import { exchangeApiContext, privateExchangeJson } from "@/lib/server/exchangeApi";
import {
  assertExchangeMutationConfiguration,
  ExchangeJournalConfigurationError,
  isExchangeProviderEnabled
} from "@/lib/server/exchangeJournalConfig";
import { assertExchangeOperationalControlEnabled } from "@/lib/server/exchangeOperationalControl";
import { getExchangeConnector } from "@/lib/server/exchanges/connector";
import { ExchangeConnectorError } from "@/lib/server/exchanges/types";
import { syncExchangeConnection } from "@/lib/server/exchangeSync";
import { entitlementRateKey } from "@/lib/server/requestEntitlement";
import { rateLimit, readJsonBodyLimited } from "@/lib/server/rateLimit";
import { isSupabaseAdminConfigured } from "@/lib/server/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function activeProvider(value: unknown): ActiveExchangeProvider | null {
  return typeof value === "string" && activeExchangeProviders.includes(value as ActiveExchangeProvider)
    ? value as ActiveExchangeProvider
    : null;
}

function connectionError(error: unknown) {
  if (error instanceof ExchangeJournalConfigurationError) {
    return privateExchangeJson(
      { error: "거래소 자동 복기 운영 설정을 확인한 뒤 다시 시도해 주세요.", code: error.code },
      { status: 409 }
    );
  }
  if (error instanceof ExchangeConnectorError) {
    const status = error.code === "rate_limited" ? 429 : error.code === "provider_unavailable" ? 503 : 400;
    const message =
      error.code === "ip_mismatch"
        ? "거래소 API 키의 IP 제한으로 ChartRadar 서버 접속이 차단됐습니다. IP 제한을 끄거나 허용 목록을 확인해 주세요."
        : error.code === "permission_changed"
          ? "읽기 전용 키만 연결할 수 있습니다. 거래·출금·이체 권한을 모두 해제해 주세요."
          : error.code === "rate_limited"
            ? "거래소 요청 제한에 도달했습니다. 잠시 후 다시 시도해 주세요."
            : error.code === "invalid_credentials"
              ? "API 키·Secret·Passphrase를 확인해 주세요."
              : "거래소 연결 상태를 확인하지 못했습니다.";
    return privateExchangeJson({ error: message, code: error.code }, { status });
  }
  const message = error instanceof Error ? error.message : "";
  if (message.includes("connection limit")) {
    return privateExchangeJson(
      { error: "현재 플랜에서 연결할 수 있는 거래소 수를 모두 사용했습니다.", code: "connection_limit_reached" },
      { status: 403 }
    );
  }
  if (message.includes("duplicate") || message.includes("one_active_provider")) {
    return privateExchangeJson(
      { error: "이 거래소는 이미 연결되어 있습니다.", code: "provider_already_connected" },
      { status: 409 }
    );
  }
  return privateExchangeJson({ error: "거래소 연결을 저장하지 못했습니다.", code: "connection_create_failed" }, { status: 503 });
}

export async function GET(request: Request) {
  const context = await exchangeApiContext(request, {
    allowDeletionPending: true,
    allowFeatureDisabledForCleanup: true,
    allowUnpaidForCleanup: true
  });
  if (!context.ok) return context.response;
  if (!isSupabaseAdminConfigured()) {
    return privateExchangeJson({ error: "거래소 연결 저장소가 설정되지 않았습니다." }, { status: 503 });
  }
  const connections = await listExchangeConnections(context.entitlement.userId as string, true).catch(() => null);
  if (!connections) return privateExchangeJson({ error: "거래소 연결을 불러오지 못했습니다." }, { status: 503 });
  return privateExchangeJson({
    capabilities: context.capabilities,
    connections: connections.map(publicExchangeConnection)
  });
}

export async function POST(request: Request) {
  const context = await exchangeApiContext(request);
  if (!context.ok) return context.response;
  if (!isSupabaseAdminConfigured()) {
    return privateExchangeJson({ error: "거래소 연결 저장소가 설정되지 않았습니다." }, { status: 503 });
  }
  const limited = await rateLimit(request, {
    key: entitlementRateKey("exchange-connection-create", context.entitlement),
    limit: 5,
    windowMs: 15 * 60 * 1000
  });
  if (!limited.allowed) {
    return privateExchangeJson(
      { error: "연결 확인 요청이 많습니다. 잠시 후 다시 시도해 주세요.", code: "rate_limited" },
      { status: 429, headers: { "Retry-After": String(limited.retryAfter) } }
    );
  }
  const parsed = await readJsonBodyLimited<{
    provider?: unknown;
    label?: unknown;
    apiKey?: unknown;
    secret?: unknown;
    passphrase?: unknown;
  }>(request, 4_096);
  if (!parsed.ok) {
    return privateExchangeJson(
      { error: parsed.tooLarge ? "연결 정보가 너무 큽니다." : "연결 정보 형식이 올바르지 않습니다." },
      { status: parsed.tooLarge ? 413 : 400 }
    );
  }
  const body = parsed.value;
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return privateExchangeJson({ error: "연결 정보 형식이 올바르지 않습니다." }, { status: 400 });
  }
  const provider = activeProvider(body.provider);
  const apiKey = typeof body.apiKey === "string" ? body.apiKey.trim() : "";
  const secret = typeof body.secret === "string" ? body.secret.trim() : "";
  const passphrase = typeof body.passphrase === "string" ? body.passphrase.trim() : "";
  const label = typeof body.label === "string" ? body.label.trim().slice(0, 80) : "";
  if (!provider || !apiKey || !secret || ((provider === "okx" || provider === "bitget") && !passphrase)) {
    return privateExchangeJson(
      { error: "거래소와 API Key·Secret·Passphrase를 다시 확인해 주세요.", code: "invalid_connection_request" },
      { status: 400 }
    );
  }

  try {
    assertExchangeMutationConfiguration(context.entitlement.userId as string);
    await assertExchangeOperationalControlEnabled();
    if (!isExchangeProviderEnabled(provider)) {
      throw new ExchangeConnectorError("provider_unavailable", "provider_unavailable");
    }
    const credentials: ExchangeCredentialInput = { apiKey, secret, ...(passphrase ? { passphrase } : {}) };
    const connector = getExchangeConnector(provider);
    const validation = await connector.validateCredentials(credentials);
    const positionBaseline = await connector.fetchPositionSnapshot(credentials);
    const connection = await createExchangeConnection({
      userId: context.entitlement.userId as string,
      provider,
      label,
      historyDays: context.capabilities.historyDays as 30 | 90,
      connectionLimit: context.capabilities.connectionLimit,
      credentials,
      validation,
      positionBaseline
    });
    if (!connection) throw new Error("exchange_connection_create_failed");

    let initialSync: Awaited<ReturnType<typeof syncExchangeConnection>> | null = null;
    try {
      initialSync = await syncExchangeConnection(context.entitlement.userId as string, connection.id);
    } catch {
      initialSync = null;
    }
    const refreshed = await listExchangeConnections(context.entitlement.userId as string, true);
    const stored = refreshed.find((item) => item.id === connection.id) ?? connection;
    return privateExchangeJson(
      {
        connection: publicExchangeConnection(stored),
        initialSync
      },
      { status: 201 }
    );
  } catch (error) {
    return connectionError(error);
  }
}
