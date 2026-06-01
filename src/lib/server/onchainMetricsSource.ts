import {
  buildBitcoinOnchainMetricReport,
  type DifficultyAdjustmentResponse,
  type MempoolFeesResponse,
  type MempoolStatsResponse,
  type OnchainMetricReport
} from "@/lib/onchainMetrics";

const FETCH_TIMEOUT_MS = 4500;
const MEMPOOL_API = "https://mempool.space/api";

async function fetchJson<T>(url: string) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": "ChartRadar/1.0 onchain-monitor"
      },
      cache: "no-store",
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(`mempool.space ${response.status}`);
    }

    return (await response.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchBitcoinOnchainMetricReport(): Promise<OnchainMetricReport> {
  const [fees, mempool, difficulty] = await Promise.all([
    fetchJson<MempoolFeesResponse>(`${MEMPOOL_API}/v1/fees/recommended`),
    fetchJson<MempoolStatsResponse>(`${MEMPOOL_API}/mempool`),
    fetchJson<DifficultyAdjustmentResponse>(`${MEMPOOL_API}/v1/difficulty-adjustment`)
  ]);

  return buildBitcoinOnchainMetricReport(fees, mempool, difficulty);
}
