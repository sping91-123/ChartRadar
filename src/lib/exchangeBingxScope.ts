const maximumBingxSymbolsPerSync = 8;

export function bingxSymbol(symbol: string) {
  const normalized = symbol.toUpperCase();
  if (normalized.includes("/")) return normalized;
  const base = normalized.replace(/[-_]?USDT(?:\.P)?$/, "");
  return base ? `${base}/USDT:USDT` : normalized;
}

export function selectBingxSyncSymbols(symbols: string[], limit = maximumBingxSymbolsPerSync) {
  const normalized = Array.from(new Set(symbols.map(bingxSymbol)));
  const boundedLimit = Math.max(1, limit);
  return {
    symbols: normalized.slice(0, boundedLimit),
    truncated: normalized.length > boundedLimit
  };
}
