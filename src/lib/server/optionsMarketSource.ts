// 서버에서 Deribit 공개 옵션 데이터를 읽어 옵션 시장 온도 리포트를 만듭니다.
import { buildOptionsMarketReport, type DeribitOptionSummaryRow, type OptionsCurrency, type OptionsMarketReport } from "@/lib/optionsMarket";

const FETCH_TIMEOUT_MS = 5000;
const DERIBIT_API = "https://www.deribit.com/api/v2";

interface DeribitBookSummaryResponse {
  result?: DeribitOptionSummaryRow[];
}

async function fetchJson<T>(url: string) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      headers: { Accept: "application/json" },
      cache: "no-store",
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(`Deribit ${response.status}`);
    }

    return (await response.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchOptionsMarketReport(currency: OptionsCurrency): Promise<OptionsMarketReport> {
  const params = new URLSearchParams({
    currency,
    kind: "option"
  });
  const payload = await fetchJson<DeribitBookSummaryResponse>(`${DERIBIT_API}/public/get_book_summary_by_currency?${params.toString()}`);
  const rows = Array.isArray(payload.result) ? payload.result : [];

  if (rows.length === 0) {
    throw new Error("Deribit option summary unavailable");
  }

  return buildOptionsMarketReport(currency, rows);
}
