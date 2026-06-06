import { parseTokenomicsUnlocksHtml, type TokenUnlockReport } from "@/lib/tokenUnlocks";

const FETCH_TIMEOUT_MS = 5500;
const TOKENOMICS_UNLOCKS_URL = "https://app.tokenomics.com/unlocks";

export async function fetchTokenUnlockReport(): Promise<TokenUnlockReport> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(TOKENOMICS_UNLOCKS_URL, {
      headers: {
        Accept: "text/html,application/xhtml+xml",
        "User-Agent": "ChartRadar/1.0 token-unlock-monitor"
      },
      cache: "no-store",
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(`Tokenomics ${response.status}`);
    }

    return parseTokenomicsUnlocksHtml(await response.text());
  } finally {
    clearTimeout(timer);
  }
}
