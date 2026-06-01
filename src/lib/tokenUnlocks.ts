export type TokenUnlockPressureLevel = "low" | "medium" | "high" | "extreme";

export interface TokenUnlockEvent {
  project: string;
  symbol: string;
  slug: string | null;
  unlockDate: string | null;
  tokensReleasedPercent: number | null;
  unlockAmountLabel: string;
  percentOfMarketCap: number | null;
  unlockValueUsd: number;
  unlockValueLabel: string;
  pressureLevel: TokenUnlockPressureLevel;
  pressureScore: number;
  sourceUrl: string;
}

export interface TokenUnlockReport {
  items: TokenUnlockEvent[];
  totalUnlockValueUsd: number;
  highestPressure: TokenUnlockEvent | null;
  updatedAt: number;
  source: "tokenomics-public-page";
}

const TOKENOMICS_BASE_URL = "https://app.tokenomics.com";

function decodeHtml(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function cellText(cellHtml: string | undefined) {
  return decodeHtml(String(cellHtml ?? ""))
    .replace(/<!--\s*-->/g, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, "|")
    .replace(/\s+/g, " ")
    .replace(/\|+/g, "|")
    .replace(/^\||\|$/g, "")
    .trim();
}

function compactLabel(value: string) {
  return value.replace(/\|/g, " ").replace(/\s+/g, " ").trim();
}

function parsePercent(value: string) {
  const match = /(-?\d+(?:\.\d+)?)\s*\|?\s*%/.exec(value);
  if (!match) return null;
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseCompactMoney(value: string) {
  const match = /\$?\s*([\d,.]+)\s*([KMBT])?/i.exec(value.replace(/\|/g, ""));
  if (!match) return 0;
  const amount = Number(match[1].replace(/,/g, ""));
  if (!Number.isFinite(amount)) return 0;
  const suffix = match[2]?.toUpperCase();
  const multiplier = suffix === "T" ? 1_000_000_000_000 : suffix === "B" ? 1_000_000_000 : suffix === "M" ? 1_000_000 : suffix === "K" ? 1_000 : 1;
  return amount * multiplier;
}

function extractCalendarDate(rowHtml: string) {
  const match = /dates=(\d{8})(?:%2F|\/)(\d{8})/i.exec(rowHtml);
  if (!match) return null;
  const raw = match[1];
  return `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
}

function extractSlug(rowHtml: string) {
  const match = /data-ph-capture-attribute-target="([^"]+)"/i.exec(rowHtml);
  return match ? decodeHtml(match[1]) : null;
}

function sourceUrlFor(slug: string | null) {
  return slug ? `${TOKENOMICS_BASE_URL}/tokenomics/${slug}/unlocks` : `${TOKENOMICS_BASE_URL}/unlocks`;
}

function pressureScore(valueUsd: number, percentOfMarketCap: number | null, tokensReleasedPercent: number | null) {
  const valueScore =
    valueUsd >= 100_000_000 ? 42 : valueUsd >= 50_000_000 ? 34 : valueUsd >= 20_000_000 ? 26 : valueUsd >= 5_000_000 ? 16 : valueUsd > 0 ? 8 : 0;
  const mcapScore =
    percentOfMarketCap === null
      ? 8
      : percentOfMarketCap >= 10
        ? 42
        : percentOfMarketCap >= 5
          ? 32
          : percentOfMarketCap >= 2
            ? 22
            : percentOfMarketCap >= 1
              ? 14
              : 6;
  const releaseScore =
    tokensReleasedPercent === null ? 0 : tokensReleasedPercent < 25 ? 12 : tokensReleasedPercent < 50 ? 8 : tokensReleasedPercent < 75 ? 4 : 0;

  return Math.min(100, Math.round(valueScore + mcapScore + releaseScore));
}

function pressureLevel(score: number): TokenUnlockPressureLevel {
  if (score >= 70) return "extreme";
  if (score >= 52) return "high";
  if (score >= 30) return "medium";
  return "low";
}

function parseNameCell(value: string) {
  const parts = value.split("|").map((part) => part.trim()).filter(Boolean);
  return {
    project: parts[0] ?? "",
    symbol: parts[1] ?? ""
  };
}

function parseTokenUnlockRow(rowHtml: string): TokenUnlockEvent | null {
  const cells = Array.from(rowHtml.matchAll(/<td[\s\S]*?<\/td>/gi), (match) => match[0]);
  if (cells.length < 7) return null;

  const name = parseNameCell(cellText(cells[1]));
  const amountLabel = compactLabel(cellText(cells[4]));
  const valueLabel = compactLabel(cellText(cells[6]).replace(/^\$\s*/, "$"));
  const unlockValueUsd = parseCompactMoney(valueLabel);
  const percentOfMarketCap = parsePercent(cellText(cells[5]));
  const tokensReleasedPercent = parsePercent(cellText(cells[2]));
  const slug = extractSlug(rowHtml);
  const score = pressureScore(unlockValueUsd, percentOfMarketCap, tokensReleasedPercent);

  if (!name.project || !name.symbol || unlockValueUsd <= 0) return null;

  return {
    project: name.project,
    symbol: name.symbol,
    slug,
    unlockDate: extractCalendarDate(rowHtml),
    tokensReleasedPercent,
    unlockAmountLabel: amountLabel,
    percentOfMarketCap,
    unlockValueUsd,
    unlockValueLabel: valueLabel.startsWith("$") ? valueLabel : `$${valueLabel}`,
    pressureLevel: pressureLevel(score),
    pressureScore: score,
    sourceUrl: sourceUrlFor(slug)
  };
}

export function parseTokenomicsUnlocksHtml(html: string, updatedAt = Date.now()): TokenUnlockReport {
  const table = /<table[\s\S]*?<\/table>/i.exec(html)?.[0] ?? "";
  const rows = Array.from(table.matchAll(/<tr[\s\S]*?<\/tr>/gi), (match) => match[0]);
  const items = rows
    .map(parseTokenUnlockRow)
    .filter((item): item is TokenUnlockEvent => item !== null)
    .sort((a, b) => b.pressureScore - a.pressureScore || b.unlockValueUsd - a.unlockValueUsd);
  const totalUnlockValueUsd = items.reduce((sum, item) => sum + item.unlockValueUsd, 0);

  return {
    items,
    totalUnlockValueUsd,
    highestPressure: items[0] ?? null,
    updatedAt,
    source: "tokenomics-public-page"
  };
}
