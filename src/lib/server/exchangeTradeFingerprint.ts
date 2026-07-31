import { createHash } from "node:crypto";
import type { ActiveExchangeProvider } from "@/lib/exchangeJournal";

export interface ExchangeTradeFingerprintInput {
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
  feeTotal: string;
  fundingTotal: string;
  netPnl: string;
  exitReason: "trade" | "liquidation" | "adl" | "delivery";
  fillCount: number;
  quality: "complete" | "partial";
}

export function exchangeTradePositionFingerprint(position: ExchangeTradeFingerprintInput) {
  return createHash("sha256").update(JSON.stringify([
    position.connectionId,
    position.provider,
    position.symbol,
    position.positionSide,
    position.openedAt,
    position.closedAt,
    position.quantityBase,
    position.averageEntryPrice,
    position.averageExitPrice,
    position.realizedPnl,
    position.feeTotal,
    position.fundingTotal,
    position.netPnl,
    position.exitReason,
    position.fillCount,
    position.quality
  ])).digest("hex");
}
