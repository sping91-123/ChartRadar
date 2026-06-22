import type { CryptoExchangeId, CryptoExchangeMarket } from "@/lib/server/cryptoExchangeData";

export type HomeInterestCoin = CryptoExchangeMarket;

export const homeInterestMaxBasic = 1;
export const homeInterestMaxPro = 5;

export const defaultHomeInterestCoin: HomeInterestCoin = {
  exchangeId: "binance",
  exchangeLabel: "Binance",
  symbol: "BTC/USDT:USDT",
  marketId: "BTCUSDT",
  base: "BTC",
  quote: "USDT",
  settle: "USDT",
  active: true
};

const storageKey = "chartRadar.cryptoHome.interestCoins.v1";
const basicChangeKey = "chartRadar.cryptoHome.basicChange.v1";
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

interface BasicChangeState {
  date: string;
  count: number;
}

function canUseStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function todayKey(now = new Date()) {
  return new Date(now.getTime() + KST_OFFSET_MS).toISOString().slice(0, 10);
}

function nextKstMidnightIso(now = new Date()) {
  const kstNow = new Date(now.getTime() + KST_OFFSET_MS);
  const nextMidnightUtcMs = Date.UTC(kstNow.getUTCFullYear(), kstNow.getUTCMonth(), kstNow.getUTCDate() + 1) - KST_OFFSET_MS;
  return new Date(nextMidnightUtcMs).toISOString();
}

function normalizeCoin(value: unknown): HomeInterestCoin | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Partial<HomeInterestCoin>;
  if (
    !item.exchangeId ||
    !item.exchangeLabel ||
    !item.symbol ||
    !item.marketId ||
    !item.base ||
    !item.quote ||
    !item.settle
  ) {
    return null;
  }
  return {
    exchangeId: item.exchangeId as CryptoExchangeId,
    exchangeLabel: item.exchangeLabel,
    symbol: item.symbol,
    marketId: item.marketId,
    base: item.base,
    quote: item.quote,
    settle: item.settle,
    active: item.active !== false,
    quoteVolume: typeof item.quoteVolume === "number" && Number.isFinite(item.quoteVolume) ? item.quoteVolume : null
  };
}

function dedupeCoins(coins: HomeInterestCoin[]) {
  const seen = new Set<string>();
  return coins.filter((coin) => {
    const key = `${coin.exchangeId}:${coin.symbol}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function readHomeInterestCoins(isPaid = false): HomeInterestCoin[] {
  if (!canUseStorage()) return [defaultHomeInterestCoin];
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return [defaultHomeInterestCoin];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [defaultHomeInterestCoin];
    const normalized = dedupeCoins(parsed.map(normalizeCoin).filter((item): item is HomeInterestCoin => Boolean(item)));
    const limit = isPaid ? homeInterestMaxPro : homeInterestMaxBasic;
    return normalized.length ? normalized.slice(0, limit) : [defaultHomeInterestCoin];
  } catch {
    return [defaultHomeInterestCoin];
  }
}

export function writeHomeInterestCoins(coins: HomeInterestCoin[], isPaid = false) {
  if (!canUseStorage()) return readHomeInterestCoins(isPaid);
  const limit = isPaid ? homeInterestMaxPro : homeInterestMaxBasic;
  const normalized = dedupeCoins(coins).slice(0, limit);
  const next = normalized.length ? normalized : [defaultHomeInterestCoin];
  window.localStorage.setItem(storageKey, JSON.stringify(next));
  return next;
}

function readBasicChangeState(): BasicChangeState {
  if (!canUseStorage()) return { date: todayKey(), count: 0 };
  try {
    const raw = window.localStorage.getItem(basicChangeKey);
    const parsed = raw ? (JSON.parse(raw) as Partial<BasicChangeState>) : {};
    const currentDate = todayKey();
    if (parsed.date !== currentDate) return { date: currentDate, count: 0 };
    return { date: currentDate, count: Math.max(0, Number(parsed.count ?? 0)) };
  } catch {
    return { date: todayKey(), count: 0 };
  }
}

function writeBasicChangeState(state: BasicChangeState) {
  if (!canUseStorage()) return;
  window.localStorage.setItem(basicChangeKey, JSON.stringify(state));
}

export function basicHomeInterestChangeStatus() {
  const state = readBasicChangeState();
  return {
    used: state.count >= 1,
    remaining: Math.max(0, 1 - state.count),
    nextChangeAt: nextKstMidnightIso()
  };
}

export function recordBasicHomeInterestChange() {
  const state = readBasicChangeState();
  writeBasicChangeState({ date: state.date, count: state.count + 1 });
  return basicHomeInterestChangeStatus();
}

export function sameHomeCoin(left: HomeInterestCoin, right: HomeInterestCoin) {
  return left.exchangeId === right.exchangeId && left.symbol === right.symbol;
}
