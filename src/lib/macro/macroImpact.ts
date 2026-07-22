import { type MacroEventItem } from "@/data/macroEvents";

export type MacroImpactVerdict = "호재" | "악재" | "중립";
export type MacroImpactConfidence = "confirmed" | "provisional";
export type MacroImpactCategory = "inflation" | "labor_softness" | "labor_strength" | "growth_demand";

export type MacroImpactAssessment = {
  verdict: MacroImpactVerdict;
  confidence: MacroImpactConfidence;
  badgeLabel: string;
  reason: string;
  category: MacroImpactCategory;
  actual: number;
  expected: number;
  surprise: "higher" | "lower" | "same" | "mixed";
};

const EMPTY_VALUE_PATTERNS = [
  /^$/,
  /^-$/,
  /미정/,
  /예정/,
  /확인/,
  /수집 지연/,
  /pending/i,
  /delayed/i,
  /check/i
];

function isEmptyMacroValue(value?: string) {
  const text = value?.trim() ?? "";
  return EMPTY_VALUE_PATTERNS.some((pattern) => pattern.test(text));
}

function numericMacroValue(value?: string) {
  if (isEmptyMacroValue(value)) return null;
  const match = value?.replace(/,/g, "").match(/(-?\d+(?:\.\d+)?)\s*([KMBT])?/i);
  if (!match) return null;
  const parsed = Number(match[1]);
  const suffix = match[2]?.toUpperCase();
  const multiplier = suffix === "K" ? 1_000 : suffix === "M" ? 1_000_000 : suffix === "B" ? 1_000_000_000 : suffix === "T" ? 1_000_000_000_000 : 1;
  return Number.isFinite(parsed) ? parsed * multiplier : null;
}

function macroValueDimension(value?: string) {
  if (isEmptyMacroValue(value)) return null;
  const normalized = value!.replace(/,/g, "").trim();
  if (normalized.includes(";") || /출처별 .* 상이/.test(normalized)) return "mixed";
  if (normalized.includes("%")) return "percent";
  if (/\$\s*-?\d/.test(normalized)) return "currency";
  if (/-?\d+(?:\.\d+)?\s*[KMBT]\b/i.test(normalized)) return "scaled-count";
  return "plain";
}

function macroValuePeriod(value: string) {
  if (/전월비|\bmom\b|m\/m|month\s*over\s*month/i.test(value)) return "mom";
  if (/전년비|\byoy\b|y\/y|year\s*over\s*year/i.test(value)) return "yoy";
  return null;
}

function parseMacroValueParts(value?: string) {
  if (isEmptyMacroValue(value) || value!.includes(";") || /출처별 .* 상이/.test(value!)) return null;
  const segments = value!.split("/").map((segment) => segment.trim()).filter(Boolean);
  if (segments.length === 0) return null;

  const parts = segments.map((segment) => ({
    period: segments.length > 1 ? macroValuePeriod(segment) : "single",
    dimension: macroValueDimension(segment),
    value: numericMacroValue(segment)
  }));
  if (parts.some((part) => !part.period || !part.dimension || part.dimension === "mixed" || part.value === null)) return null;
  return parts as Array<{ period: string; dimension: string; value: number }>;
}

function macroImpactCategory(label: string): MacroImpactCategory | null {
  const lower = label.toLowerCase();
  if (
    /\bcpi\b|\bppi\b|\bpce\b|inflation|average hourly earnings|wage|personal consumption expenditures/.test(lower)
  ) return "inflation";
  if (/jobless|claims|unemployment rate/.test(lower)) return "labor_softness";
  if (/non-farm|nonfarm|payroll|employment change|jolts/.test(lower)) return "labor_strength";
  if (
    /retail|\bgdp\b|\bpmi\b|\bism\b|durable|home sales|consumer confidence|consumer sentiment|michigan/.test(lower)
  ) return "growth_demand";
  return null;
}

function reasonFor(category: MacroImpactCategory, verdict: MacroImpactVerdict, surprise: "higher" | "lower" | "same" | "mixed") {
  if (surprise === "mixed") return "전월비와 전년비 결과가 엇갈려 한 방향으로 보기 어렵습니다.";
  if (verdict === "중립" || surprise === "same") return "실제값이 예측과 같아 새 방향 신호가 약합니다.";
  if (category === "inflation") {
    return verdict === "호재"
      ? "물가 압력이 예상보다 약해 금리 부담 완화에 우호적입니다."
      : "물가 압력이 예상보다 강해 금리와 달러 부담이 커질 수 있습니다.";
  }
  if (category === "labor_softness") {
    return verdict === "호재"
      ? "고용 둔화 신호가 예상보다 커 금리 부담 완화 쪽입니다."
      : "고용이 예상보다 견조해 금리 부담이 이어질 수 있습니다.";
  }
  if (category === "labor_strength") {
    return verdict === "호재"
      ? "고용 증가세가 예상보다 약해 금리 부담 완화 쪽입니다."
      : "고용 증가세가 예상보다 강해 금리 부담이 이어질 수 있습니다.";
  }
  return verdict === "호재"
    ? "경기·수요가 예상보다 약해 단기 금리 부담 완화 쪽입니다."
    : "경기·수요가 예상보다 강해 단기 금리 부담이 커질 수 있습니다.";
}

export function assessMacroImpact(item: MacroEventItem, nowMs = Date.now()): MacroImpactAssessment | null {
  const releaseMs = Date.parse(item.releaseAt);
  if (!Number.isFinite(releaseMs) || releaseMs > nowMs) return null;
  if (item.isDocumentEvent || item.isNumericEvent === false || item.eventType === "document_release" || item.eventType === "meeting_event" || item.eventType === "speech_event") return null;

  const confidence: MacroImpactConfidence | null = item.actualProvenance === "official"
    ? "confirmed"
    : item.actualProvenance === "public_calendar"
      ? "provisional"
      : null;
  if (!confidence) return null;
  if (item.consensusProvenance !== "official" && item.consensusProvenance !== "public_calendar") return null;

  const actualParts = parseMacroValueParts(item.actualValue ?? item.actual);
  const expectedParts = parseMacroValueParts(item.consensusValue ?? item.forecast);
  if (!actualParts || !expectedParts || actualParts.length !== expectedParts.length) return null;
  if (actualParts.some((part, index) => part.period !== expectedParts[index].period || part.dimension !== expectedParts[index].dimension)) return null;

  const category = macroImpactCategory(item.label);
  if (!category) return null;
  const preferredSurprise = category === "labor_softness" ? "higher" : "lower";
  const componentSurprises = actualParts.map((part, index) => {
    const delta = part.value - expectedParts[index].value;
    return Math.abs(delta) < 1e-9 ? "same" as const : delta > 0 ? "higher" as const : "lower" as const;
  });
  const componentVerdicts = componentSurprises.map<MacroImpactVerdict>((surprise) =>
    surprise === "same" ? "중립" : surprise === preferredSurprise ? "호재" : "악재"
  );
  const directionalVerdicts = new Set(componentVerdicts.filter((verdict) => verdict !== "중립"));
  const verdict: MacroImpactVerdict = directionalVerdicts.size === 0
    ? "중립"
    : directionalVerdicts.size === 1
      ? Array.from(directionalVerdicts)[0]
      : "중립";
  const surprise = directionalVerdicts.size > 1
    ? "mixed" as const
    : componentSurprises.every((value) => value === componentSurprises[0])
      ? componentSurprises[0]
      : componentSurprises.find((value) => value !== "same") ?? "same";

  return {
    verdict,
    confidence,
    badgeLabel: confidence === "provisional" ? `잠정 ${verdict}` : verdict,
    reason: reasonFor(category, verdict, surprise),
    category,
    actual: actualParts[0].value,
    expected: expectedParts[0].value,
    surprise
  };
}
