import type { PerpetualAsset } from "./perpetualDecisionSnapshot";

export interface CftcPositioningRow {
  id?: string;
  cftc_contract_market_code?: string;
  report_date_as_yyyy_mm_dd?: string;
  open_interest_all?: string;
  change_in_open_interest_all?: string;
  asset_mgr_positions_long?: string;
  asset_mgr_positions_short?: string;
  change_in_asset_mgr_long?: string;
  change_in_asset_mgr_short?: string;
  lev_money_positions_long?: string;
  lev_money_positions_short?: string;
  change_in_lev_money_long?: string;
  change_in_lev_money_short?: string;
}

export interface CftcPositioningBrief {
  asset: PerpetualAsset;
  reportDate: string;
  openInterest: number;
  openInterestWeeklyChange: number;
  assetManagerNet: number;
  assetManagerNetWeeklyChange: number;
  leveragedFundsNet: number;
  leveragedFundsNetWeeklyChange: number;
  delayed: true;
  sourceName: "U.S. CFTC";
  sourceUrl: string;
}

const contractCodes: Record<PerpetualAsset, string> = {
  btc: "133741",
  eth: "146021"
};

function finiteInteger(value: unknown) {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.round(parsed) : null;
}

export function cftcContractCode(asset: PerpetualAsset) {
  return contractCodes[asset];
}

export function normalizeCftcPositioning(
  asset: PerpetualAsset,
  row: CftcPositioningRow,
  now = new Date()
): CftcPositioningBrief | null {
  if (row.cftc_contract_market_code?.trim() !== contractCodes[asset]) return null;
  const reportDate = row.report_date_as_yyyy_mm_dd?.slice(0, 10) ?? "";
  const reportMs = /^\d{4}-\d{2}-\d{2}$/.test(reportDate)
    ? Date.parse(`${reportDate}T00:00:00.000Z`)
    : Number.NaN;
  if (!Number.isFinite(reportMs) || reportMs > now.getTime() + 24 * 60 * 60_000 || reportMs < now.getTime() - 21 * 24 * 60 * 60_000) {
    return null;
  }
  const openInterest = finiteInteger(row.open_interest_all);
  const openInterestWeeklyChange = finiteInteger(row.change_in_open_interest_all);
  const assetLong = finiteInteger(row.asset_mgr_positions_long);
  const assetShort = finiteInteger(row.asset_mgr_positions_short);
  const assetLongChange = finiteInteger(row.change_in_asset_mgr_long);
  const assetShortChange = finiteInteger(row.change_in_asset_mgr_short);
  const leveragedLong = finiteInteger(row.lev_money_positions_long);
  const leveragedShort = finiteInteger(row.lev_money_positions_short);
  const leveragedLongChange = finiteInteger(row.change_in_lev_money_long);
  const leveragedShortChange = finiteInteger(row.change_in_lev_money_short);
  if ([openInterest, openInterestWeeklyChange, assetLong, assetShort, assetLongChange, assetShortChange, leveragedLong, leveragedShort, leveragedLongChange, leveragedShortChange].some((value) => value === null)) {
    return null;
  }
  return {
    asset,
    reportDate: new Date(reportMs).toISOString(),
    openInterest: openInterest!,
    openInterestWeeklyChange: openInterestWeeklyChange!,
    assetManagerNet: assetLong! - assetShort!,
    assetManagerNetWeeklyChange: assetLongChange! - assetShortChange!,
    leveragedFundsNet: leveragedLong! - leveragedShort!,
    leveragedFundsNetWeeklyChange: leveragedLongChange! - leveragedShortChange!,
    delayed: true,
    sourceName: "U.S. CFTC",
    sourceUrl: "https://publicreportinghub.cftc.gov/d/gpe5-46if"
  };
}
