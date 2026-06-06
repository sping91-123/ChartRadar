import { buildStablecoinLiquidityReport, type DefiLlamaStablecoinChartRow, type StablecoinLiquidityReport } from "@/lib/stablecoinLiquidity";

const FETCH_TIMEOUT_MS = 6500;
const DEFILLAMA_STABLECOINS_API = "https://stablecoins.llama.fi";

async function fetchJson<T>(url: string) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": "ChartRadar/1.0 stablecoin-liquidity"
      },
      cache: "no-store",
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(`DeFiLlama stablecoins ${response.status}`);
    }

    return (await response.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchStablecoinLiquidityReport(): Promise<StablecoinLiquidityReport> {
  const rows = await fetchJson<DefiLlamaStablecoinChartRow[]>(`${DEFILLAMA_STABLECOINS_API}/stablecoincharts/all`);
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error("DeFiLlama stablecoin chart unavailable");
  }

  return buildStablecoinLiquidityReport(rows);
}
