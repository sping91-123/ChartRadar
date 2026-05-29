import type { SetupAlertMarket, SetupAlertPreset } from "@/lib/setupAlertPresets";
import type { PushAlertPresetRow } from "@/lib/server/push/types";

export function presetFromRow(row: PushAlertPresetRow): SetupAlertPreset {
  return {
    id: row.preset_id,
    market: row.market,
    symbol: row.symbol,
    mode: row.mode ?? undefined,
    timeframe: row.timeframe,
    side: row.side,
    quality: row.quality,
    score: Number(row.score),
    headline: row.headline,
    savedAt: Date.parse(row.saved_at) || Date.now()
  };
}

export function presetsForMarket(rows: PushAlertPresetRow[], market: SetupAlertMarket) {
  return rows.filter((preset) => preset.market === market);
}

export function groupPresetsByUser(rows: PushAlertPresetRow[]) {
  const presetsByUser = new Map<string, PushAlertPresetRow[]>();

  for (const preset of rows) {
    const rowsForUser = presetsByUser.get(preset.user_id) ?? [];
    rowsForUser.push(preset);
    presetsByUser.set(preset.user_id, rowsForUser);
  }

  return presetsByUser;
}

export function presetCountForMarket(rows: PushAlertPresetRow[], market: SetupAlertMarket) {
  return presetsForMarket(rows, market).length;
}

export function presetScanInputsForMarket(rows: PushAlertPresetRow[], market: SetupAlertMarket) {
  return presetsForMarket(rows, market).map((preset) => ({ symbol: preset.symbol, timeframe: preset.timeframe }));
}
