import {
  absDecimal,
  addDecimal,
  compareDecimal,
  divideDecimal,
  isZeroDecimal,
  minDecimal,
  multiplyDecimal,
  negateDecimal,
  normalizeDecimal,
  subtractDecimal
} from "./decimal";

export const exchangeProviders = ["okx", "bybit", "bitget", "bingx", "lbank"] as const;
export const activeExchangeProviders = ["okx", "bybit", "bitget", "bingx"] as const;

export type ExchangeProvider = (typeof exchangeProviders)[number];
export type ActiveExchangeProvider = (typeof activeExchangeProviders)[number];
export type ExchangeConnectionStatus =
  | "syncing"
  | "ready"
  | "partial"
  | "permission_changed"
  | "ip_mismatch"
  | "rate_limited"
  | "provider_unavailable"
  | "disconnected";
export type ExchangePositionMode = "one_way" | "hedge" | "unknown";
export type ExchangePositionSide = "net" | "long" | "short" | "unknown";
export type ExchangeOpenClose = "open" | "close" | "mixed" | "unknown";
export type ExchangeExecutionType = "trade" | "liquidation" | "adl" | "delivery" | "other";
export type ExchangeCashflowType =
  | "trade_fee"
  | "funding"
  | "liquidation_fee"
  | "adl"
  | "settlement"
  | "transfer"
  | "other";

export interface ExchangeCredentialInput {
  apiKey: string;
  secret: string;
  passphrase?: string;
}

export interface CanonicalExchangeFill {
  provider: ActiveExchangeProvider;
  connectionId: string;
  externalTradeId: string;
  externalOrderId: string | null;
  symbol: string;
  product: "usdt_perpetual";
  side: "buy" | "sell";
  positionMode: ExchangePositionMode;
  positionSide: ExchangePositionSide;
  openClose: ExchangeOpenClose;
  reduceOnly: boolean | null;
  quantityBase: string;
  quantityContracts: string | null;
  contractMultiplier: string | null;
  price: string;
  quoteNotional: string;
  providerRealizedPnl: string | null;
  feeNativeSigned: string;
  feeCurrency: string;
  feeQuoteSigned: string | null;
  executedAt: string;
  providerSequence: string | null;
  executionType: ExchangeExecutionType;
  payloadFingerprint: string;
}

export interface CanonicalExchangeCashflow {
  provider: ActiveExchangeProvider;
  connectionId: string;
  externalCashflowId: string;
  symbol: string | null;
  positionSide: ExchangePositionSide;
  type: ExchangeCashflowType;
  amountSigned: string;
  currency: string;
  amountQuoteSigned: string | null;
  occurredAt: string;
  relatedTradeId: string | null;
  relatedOrderId: string | null;
  allocationStatus: "allocated" | "unallocated" | "ambiguous";
  reconciliationOnly: boolean;
  payloadFingerprint: string;
}

export interface ReconstructedRoundTrip {
  roundTripKey: string;
  connectionId: string;
  provider: ActiveExchangeProvider;
  symbol: string;
  positionSide: "long" | "short";
  openedAt: string;
  closedAt: string;
  quantityBase: string;
  averageEntryPrice: string;
  averageExitPrice: string;
  realizedPnl: string;
  providerRealizedPnl: string | null;
  feeTotal: string;
  fundingTotal: string;
  netPnl: string;
  exitReason: "trade" | "liquidation" | "adl" | "delivery";
  fillCount: number;
  calculationVersion: "round_trip_v1";
  quality: "complete" | "partial";
  warnings: string[];
}

export interface ExchangeReconstructionBaseline {
  flatAt: string;
  openSymbols: string[];
  symbolFlatAt?: Record<string, string>;
}

interface WorkingPosition {
  key: string;
  connectionId: string;
  direction: "long" | "short";
  symbol: string;
  openedAt: string;
  quantity: string;
  openedQuantity: string;
  averageEntryPrice: string;
  exitNotional: string;
  closedQuantity: string;
  realizedPnl: string;
  providerRealizedPnl: string | null;
  feeTotal: string;
  fillCount: number;
  exitReason: ReconstructedRoundTrip["exitReason"];
  quality: ReconstructedRoundTrip["quality"];
  warnings: string[];
  firstTradeId: string;
}

function positionKey(fill: CanonicalExchangeFill) {
  if (fill.positionMode === "hedge" && (fill.positionSide === "long" || fill.positionSide === "short")) {
    return `${fill.connectionId}:${fill.symbol}:${fill.positionSide}`;
  }
  return `${fill.connectionId}:${fill.symbol}:net`;
}

function intendedDelta(fill: CanonicalExchangeFill) {
  const quantity = normalizeDecimal(fill.quantityBase);
  if (fill.positionMode === "hedge" && fill.positionSide === "long") {
    return fill.side === "buy" ? quantity : negateDecimal(quantity);
  }
  if (fill.positionMode === "hedge" && fill.positionSide === "short") {
    return fill.side === "sell" ? negateDecimal(quantity) : quantity;
  }
  return fill.side === "buy" ? quantity : negateDecimal(quantity);
}

function directionForSignedQuantity(value: string): "long" | "short" {
  return compareDecimal(value, "0") >= 0 ? "long" : "short";
}

function exitReason(fill: CanonicalExchangeFill): ReconstructedRoundTrip["exitReason"] {
  if (fill.executionType === "liquidation") return "liquidation";
  if (fill.executionType === "adl") return "adl";
  if (fill.executionType === "delivery") return "delivery";
  return "trade";
}

function allocatedFee(fill: CanonicalExchangeFill, quantity: string, totalQuantity: string) {
  if (fill.feeQuoteSigned === null) return null;
  return divideDecimal(multiplyDecimal(fill.feeQuoteSigned, quantity), totalQuantity);
}

function fillSort(left: CanonicalExchangeFill, right: CanonicalExchangeFill) {
  const time = Date.parse(left.executedAt) - Date.parse(right.executedAt);
  if (time !== 0) return time;
  const sequence = String(left.providerSequence ?? "").localeCompare(String(right.providerSequence ?? ""), "en", {
    numeric: true
  });
  if (sequence !== 0) return sequence;
  return left.externalTradeId.localeCompare(right.externalTradeId);
}

function newWorkingPosition(
  fill: CanonicalExchangeFill,
  signedQuantity: string,
  fee: string | null,
  providerRealizedPnl = fill.providerRealizedPnl
): WorkingPosition {
  const direction = directionForSignedQuantity(signedQuantity);
  const warnings: string[] = [];
  let quality: WorkingPosition["quality"] = "complete";
  if (fill.positionSide === "unknown" || fill.positionMode === "unknown") {
    quality = "partial";
    warnings.push("position_context_unknown");
  }
  if (fee === null) {
    quality = "partial";
    warnings.push("fee_quote_unavailable");
  }
  return {
    key: positionKey(fill),
    connectionId: fill.connectionId,
    direction,
    symbol: fill.symbol,
    openedAt: fill.executedAt,
    quantity: absDecimal(signedQuantity),
    openedQuantity: absDecimal(signedQuantity),
    averageEntryPrice: fill.price,
    exitNotional: "0",
    closedQuantity: "0",
    realizedPnl: "0",
    providerRealizedPnl,
    feeTotal: fee ?? "0",
    fillCount: 1,
    exitReason: exitReason(fill),
    quality,
    warnings,
    firstTradeId: fill.externalTradeId
  };
}

function mergeProviderPnl(current: string | null, incoming: string | null) {
  if (incoming === null) return current;
  return current === null ? normalizeDecimal(incoming) : addDecimal(current, incoming);
}

function finalizePosition(
  position: WorkingPosition,
  connectionId: string,
  provider: ActiveExchangeProvider,
  closedAt: string
): ReconstructedRoundTrip {
  const averageExitPrice = isZeroDecimal(position.closedQuantity)
    ? "0"
    : divideDecimal(position.exitNotional, position.closedQuantity);
  return {
    roundTripKey: [
      connectionId,
      position.symbol,
      position.direction,
      position.openedAt,
      position.firstTradeId
    ].join(":"),
    connectionId,
    provider,
    symbol: position.symbol,
    positionSide: position.direction,
    openedAt: position.openedAt,
    closedAt,
    quantityBase: position.openedQuantity,
    averageEntryPrice: position.averageEntryPrice,
    averageExitPrice,
    realizedPnl: position.realizedPnl,
    providerRealizedPnl: position.providerRealizedPnl,
    feeTotal: position.feeTotal,
    fundingTotal: "0",
    netPnl: addDecimal(position.realizedPnl, position.feeTotal),
    exitReason: position.exitReason,
    fillCount: position.fillCount,
    calculationVersion: "round_trip_v1",
    quality: position.quality,
    warnings: Array.from(new Set(position.warnings))
  };
}

function allocateFundingCashflows(
  roundTrips: ReconstructedRoundTrip[],
  cashflows: CanonicalExchangeCashflow[],
  warnings: string[]
) {
  for (const cashflow of cashflows) {
    if (cashflow.reconciliationOnly || cashflow.type !== "funding") continue;
    const occurredAt = Date.parse(cashflow.occurredAt);
    const candidates = roundTrips.filter((position) => {
      if (position.connectionId !== cashflow.connectionId) return false;
      if (cashflow.symbol && position.symbol !== cashflow.symbol) return false;
      if (
        cashflow.positionSide !== "unknown" &&
        cashflow.positionSide !== "net" &&
        position.positionSide !== cashflow.positionSide
      ) {
        return false;
      }
      return occurredAt >= Date.parse(position.openedAt) && occurredAt <= Date.parse(position.closedAt);
    });
    if (cashflow.amountQuoteSigned !== null && candidates.length === 1) {
      const position = candidates[0];
      position.fundingTotal = addDecimal(position.fundingTotal, cashflow.amountQuoteSigned);
      position.netPnl = addDecimal(position.realizedPnl, position.feeTotal, position.fundingTotal);
      continue;
    }
    if (candidates.length > 0) {
      const warning = cashflow.amountQuoteSigned === null ? "funding_quote_unavailable" : "funding_ambiguous";
      for (const position of candidates) {
        position.quality = "partial";
        position.warnings = Array.from(new Set([...position.warnings, warning]));
      }
      warnings.push(`${warning}:${cashflow.externalCashflowId}`);
    } else {
      warnings.push(`funding_unallocated:${cashflow.externalCashflowId}`);
    }
  }
}

export function reconstructRoundTrips(
  fills: CanonicalExchangeFill[],
  cashflows: CanonicalExchangeCashflow[] = [],
  baseline?: ExchangeReconstructionBaseline
): { roundTrips: ReconstructedRoundTrip[]; openPositionCount: number; warnings: string[] } {
  const uniqueFills = Array.from(
    new Map(fills.map((fill) => [`${fill.connectionId}:${fill.product}:${fill.externalTradeId}`, fill])).values()
  ).sort(fillSort);
  const positions = new Map<string, WorkingPosition>();
  const confirmedFlatKeys = new Set<string>();
  const roundTrips: ReconstructedRoundTrip[] = [];
  const warnings: string[] = [];

  for (const fill of uniqueFills) {
    if (fill.product !== "usdt_perpetual" || compareDecimal(fill.quantityBase, "0") <= 0) continue;
    const key = positionKey(fill);
    const signedDelta = intendedDelta(fill);
    const existing = positions.get(key);
    const feeAvailable = fill.feeQuoteSigned !== null;
    const fullFee = feeAvailable ? normalizeDecimal(fill.feeQuoteSigned ?? "0") : null;

    if (!existing) {
      if (fill.reduceOnly) {
        warnings.push(`unmatched_reduce_only:${fill.externalTradeId}`);
        continue;
      }
      const position = newWorkingPosition(fill, signedDelta, fullFee);
      const symbolFlatAt = baseline?.symbolFlatAt?.[fill.symbol];
      const verifiedAt = symbolFlatAt ??
        (baseline && !baseline.openSymbols.includes(fill.symbol) ? baseline.flatAt : null);
      const startsAfterVerifiedFlat = verifiedAt !== null && Date.parse(fill.executedAt) >= Date.parse(verifiedAt);
      if (!confirmedFlatKeys.has(key) && !startsAfterVerifiedFlat) {
        position.quality = "partial";
        position.warnings.push("initial_flat_state_unverified");
      }
      if (fill.openClose === "close") {
        position.quality = "partial";
        position.warnings.push("unmatched_close");
      }
      positions.set(key, position);
      continue;
    }

    const existingSign = existing.direction === "long" ? "1" : "-1";
    const deltaSign = compareDecimal(signedDelta, "0") >= 0 ? "1" : "-1";
    if (existingSign === deltaSign) {
      const nextQuantity = addDecimal(existing.quantity, absDecimal(signedDelta));
      existing.averageEntryPrice = divideDecimal(
        addDecimal(
          multiplyDecimal(existing.averageEntryPrice, existing.quantity),
          multiplyDecimal(fill.price, absDecimal(signedDelta))
        ),
        nextQuantity
      );
      existing.quantity = nextQuantity;
      existing.openedQuantity = addDecimal(existing.openedQuantity, absDecimal(signedDelta));
      existing.feeTotal = addDecimal(existing.feeTotal, fullFee ?? "0");
      existing.providerRealizedPnl = mergeProviderPnl(existing.providerRealizedPnl, fill.providerRealizedPnl);
      existing.fillCount += 1;
      if (!feeAvailable) {
        existing.quality = "partial";
        existing.warnings.push("fee_quote_unavailable");
      }
      continue;
    }

    const incomingQuantity = absDecimal(signedDelta);
    const closeQuantity = minDecimal(existing.quantity, incomingQuantity);
    const closeFee = allocatedFee(fill, closeQuantity, incomingQuantity);
    const priceDifference = existing.direction === "long"
      ? subtractDecimal(fill.price, existing.averageEntryPrice)
      : subtractDecimal(existing.averageEntryPrice, fill.price);
    existing.realizedPnl = addDecimal(existing.realizedPnl, multiplyDecimal(priceDifference, closeQuantity));
    existing.exitNotional = addDecimal(existing.exitNotional, multiplyDecimal(fill.price, closeQuantity));
    existing.closedQuantity = addDecimal(existing.closedQuantity, closeQuantity);
    existing.quantity = subtractDecimal(existing.quantity, closeQuantity);
    existing.feeTotal = addDecimal(existing.feeTotal, closeFee ?? "0");
    existing.providerRealizedPnl = mergeProviderPnl(existing.providerRealizedPnl, fill.providerRealizedPnl);
    existing.fillCount += 1;
    existing.exitReason = exitReason(fill);
    if (!feeAvailable) {
      existing.quality = "partial";
      existing.warnings.push("fee_quote_unavailable");
    }

    const residual = subtractDecimal(incomingQuantity, closeQuantity);
    if (!isZeroDecimal(residual) && fill.reduceOnly) {
      existing.quality = "partial";
      existing.warnings.push("inconsistent_reduce_only");
    }

    if (isZeroDecimal(existing.quantity)) {
      roundTrips.push(finalizePosition(existing, fill.connectionId, fill.provider, fill.executedAt));
      positions.delete(key);
      if (existing.quality === "complete") confirmedFlatKeys.add(key);
    }

    if (!isZeroDecimal(residual)) {
      if (fill.reduceOnly) {
        warnings.push(`inconsistent_reduce_only:${fill.externalTradeId}`);
        continue;
      }
      const residualSigned = deltaSign === "1" ? residual : negateDecimal(residual);
      const residualFee = fullFee === null || closeFee === null ? null : subtractDecimal(fullFee, closeFee);
      const residualPosition = newWorkingPosition(fill, residualSigned, residualFee, null);
      if (existing.quality === "partial") {
        residualPosition.quality = "partial";
        residualPosition.warnings.push(...existing.warnings);
      }
      residualPosition.warnings = Array.from(new Set(residualPosition.warnings));
      positions.set(key, residualPosition);
    }
  }

  allocateFundingCashflows(roundTrips, cashflows, warnings);

  return {
    roundTrips,
    openPositionCount: positions.size,
    warnings: Array.from(new Set(warnings))
  };
}

export interface ExchangeAnalyticsPosition {
  id: string;
  provider: ActiveExchangeProvider;
  symbol: string;
  positionSide: "long" | "short";
  closedAt: string;
  netPnl: string;
  feeTotal: string;
  fundingTotal: string;
  quality: "complete" | "partial";
  strategyTags?: string[];
  keptPrinciples?: string[];
  brokenPrinciples?: string[];
}

export type ExchangeDecisionAsset = "btc" | "eth";

export interface ExchangeDecisionCandidatePosition {
  id: string;
  userId: string;
  symbol: string;
  openedAt: string;
}

export interface SavedExchangeDecisionJournal {
  id: string;
  userId: string;
  source: "snapshot" | "alert" | "news";
  savedAt: string;
  decisionSnapshotId: string | null;
  decisionContext: {
    asset?: unknown;
    snapshotId?: unknown;
    headline?: unknown;
    topRisk?: unknown;
    primaryCondition?: { label?: unknown } | null;
  };
}

export interface ExchangeDecisionCandidate {
  journalId: string;
  source: "snapshot" | "alert" | "news";
  savedAt: string;
  snapshotId: string | null;
  snapshotAvailable: boolean;
  asset: ExchangeDecisionAsset;
  headline: string;
  topRisk: string;
  primaryConditionLabel: string | null;
}

export function exchangeDecisionAsset(symbol: string): ExchangeDecisionAsset | null {
  const normalized = symbol.trim().toUpperCase();
  if (normalized === "BTCUSDT" || normalized.startsWith("BTC/")) return "btc";
  if (normalized === "ETHUSDT" || normalized.startsWith("ETH/")) return "eth";
  return null;
}

function boundedCandidateText(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

export function matchSavedDecisionCandidates(
  positions: ExchangeDecisionCandidatePosition[],
  journals: SavedExchangeDecisionJournal[],
  userId: string
) {
  const candidates = new Map<string, ExchangeDecisionCandidate>();
  for (const position of positions) {
    if (position.userId !== userId) continue;
    const asset = exchangeDecisionAsset(position.symbol);
    const openedAt = Date.parse(position.openedAt);
    if (!asset || !Number.isFinite(openedAt)) continue;
    const earliest = openedAt - 6 * 60 * 60 * 1000;
    const candidate = journals
      .filter((journal) => journal.userId === userId)
      .filter((journal) => journal.decisionContext?.asset === asset)
      .filter((journal) => {
        const savedAt = Date.parse(journal.savedAt);
        return Number.isFinite(savedAt) && savedAt >= earliest && savedAt <= openedAt;
      })
      .sort((left, right) =>
        Date.parse(right.savedAt) - Date.parse(left.savedAt) || right.id.localeCompare(left.id)
      )[0];
    if (!candidate) continue;
    const contextSnapshotId = boundedCandidateText(candidate.decisionContext.snapshotId, 64);
    const snapshotId = (candidate.decisionSnapshotId ?? contextSnapshotId) || null;
    candidates.set(position.id, {
      journalId: candidate.id,
      source: candidate.source,
      savedAt: candidate.savedAt,
      snapshotId,
      snapshotAvailable: Boolean(candidate.decisionSnapshotId),
      asset,
      headline: boundedCandidateText(candidate.decisionContext.headline, 240),
      topRisk: boundedCandidateText(candidate.decisionContext.topRisk, 500),
      primaryConditionLabel: boundedCandidateText(
        candidate.decisionContext.primaryCondition?.label,
        240
      ) || null
    });
  }
  return candidates;
}

export interface ExchangeAnalytics {
  completedTrades: number;
  wins: number;
  losses: number;
  breakeven: number;
  winRate: number | null;
  netPnl: string;
  grossProfit: string;
  grossLoss: string;
  profitFactor: string | null;
  feeTotal: string;
  fundingTotal: string;
  maxRealizedDrawdown: string;
  reviewedTrades: number;
  principleComplianceRate: number | null;
}

export function calculateExchangeAnalytics(positions: ExchangeAnalyticsPosition[]): ExchangeAnalytics {
  const complete = positions
    .filter((position) => position.quality === "complete")
    .sort((left, right) => Date.parse(left.closedAt) - Date.parse(right.closedAt));
  let wins = 0;
  let losses = 0;
  let breakeven = 0;
  let grossProfit = "0";
  let grossLoss = "0";
  let equity = "0";
  let equityPeak = "0";
  let maxDrawdown = "0";
  let reviewedTrades = 0;
  let keptCount = 0;
  let brokenCount = 0;

  for (const position of complete) {
    const comparison = compareDecimal(position.netPnl, "0");
    if (comparison > 0) {
      wins += 1;
      grossProfit = addDecimal(grossProfit, position.netPnl);
    } else if (comparison < 0) {
      losses += 1;
      grossLoss = addDecimal(grossLoss, absDecimal(position.netPnl));
    } else {
      breakeven += 1;
    }
    equity = addDecimal(equity, position.netPnl);
    if (compareDecimal(equity, equityPeak) > 0) equityPeak = equity;
    const drawdown = subtractDecimal(equityPeak, equity);
    if (compareDecimal(drawdown, maxDrawdown) > 0) maxDrawdown = drawdown;

    const kept = position.keptPrinciples?.length ?? 0;
    const broken = position.brokenPrinciples?.length ?? 0;
    if (kept + broken > 0) {
      reviewedTrades += 1;
      keptCount += kept;
      brokenCount += broken;
    }
  }

  return {
    completedTrades: complete.length,
    wins,
    losses,
    breakeven,
    winRate: wins + losses > 0 ? wins / (wins + losses) : null,
    netPnl: addDecimal(...complete.map((position) => position.netPnl)),
    grossProfit,
    grossLoss,
    profitFactor: isZeroDecimal(grossLoss)
      ? isZeroDecimal(grossProfit) ? null : "infinite"
      : divideDecimal(grossProfit, grossLoss),
    feeTotal: addDecimal(...complete.map((position) => position.feeTotal)),
    fundingTotal: addDecimal(...complete.map((position) => position.fundingTotal)),
    maxRealizedDrawdown: maxDrawdown,
    reviewedTrades,
    principleComplianceRate: keptCount + brokenCount > 0 ? keptCount / (keptCount + brokenCount) : null
  };
}
