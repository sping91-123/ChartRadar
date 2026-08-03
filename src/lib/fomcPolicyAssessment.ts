export const FOMC_POLICY_RULE_VERSION = "fomc-policy-v1" as const;

export type FomcRateDecision = "hike" | "hold" | "cut";
export type FomcPolicyStance = "hawkish" | "slightly_hawkish" | "mixed" | "neutral" | "slightly_dovish" | "dovish";
export type FomcRelativeShift = "more_hawkish" | "little_changed" | "more_dovish" | "unavailable";
export type FomcRatePathBias = "hike_risk" | "higher_for_longer" | "balanced" | "easing";
export type FomcRiskAssetImpact = "headwind" | "mixed" | "tailwind";
export type FomcAssessmentConfidence = "high" | "medium" | "low";

export interface FomcSepProjection {
  publishedDate: string;
  projectionYear: number;
  medianRate: number;
  previousMedianRate?: number;
  changeFromPreviousBps?: number;
}

export interface FomcPolicyAssessment {
  schemaVersion: 1;
  ruleVersion: typeof FOMC_POLICY_RULE_VERSION;
  method: "deterministic_official_text";
  meetingDate: string;
  analyzedAt: string;
  decision: FomcRateDecision;
  decisionLabel: string;
  targetRange?: string;
  changeBps?: number;
  vote?: {
    for: number;
    against: number;
    dissentBias: "hike" | "cut" | "mixed" | "unspecified";
  };
  stance: FomcPolicyStance;
  stanceLabel: string;
  relativeShift: FomcRelativeShift;
  relativeShiftLabel: string;
  ratePathBias: FomcRatePathBias;
  ratePathLabel: string;
  riskAssetImpact: FomcRiskAssetImpact;
  riskAssetLabel: string;
  confidence: FomcAssessmentConfidence;
  summary: string;
  rationale: string;
  coverageLabel: string;
  coverage: {
    statement: "included";
    priorStatement: "included" | "unavailable";
    sep: "current_meeting" | "latest_available" | "unavailable";
    pressConference: "transcript_link_available_unparsed" | "transcript_pending" | "unavailable";
  };
  statementUrl: string;
  priorStatementUrl?: string;
  sepUrl?: string;
  pressConferenceUrl?: string;
  transcriptUrl?: string;
  sep?: FomcSepProjection;
}

export interface ParsedFomcStatement {
  decision: FomcRateDecision;
  targetLow?: number;
  targetHigh?: number;
  changeBps?: number;
  vote?: FomcPolicyAssessment["vote"];
  toneScore: number;
  hawkishSignalCount: number;
  dovishSignalCount: number;
}

export type FomcCalendarDocuments = {
  meetingDate: string;
  statementUrl?: string;
  priorStatementUrl?: string;
  sepUrl?: string;
  pressConferenceUrl?: string;
};

export function isFomcPolicyDocumentLabel(label: string) {
  return /fomc|federal funds|fed funds|fed interest rate|fed rate decision/i.test(label) &&
    !/minutes|press conference|implementation note|economic projections|projection materials|speech|speaks|testif|beige book/i.test(label);
}

const FED_HOST = "www.federalreserve.gov";
const statementPath = /^\/newsevents\/pressreleases\/monetary\d{8}[a-z]\.htm$/i;
const sepPath = /^\/monetarypolicy\/fomcprojtabl\d{8}\.htm$/i;
const pressConferencePath = /^\/monetarypolicy\/fomcpresconf\d{8}\.htm$/i;
const transcriptPath = /^\/mediacenter\/files\/fomcpresconf\d{8}\.pdf$/i;

function decodeHtmlEntities(value: string) {
  const named: Record<string, string> = {
    amp: "&",
    apos: "'",
    gt: ">",
    lt: "<",
    nbsp: " ",
    ndash: "–",
    mdash: "—",
    minus: "−",
    quot: '"'
  };
  return value
    .replace(/&#x([0-9a-f]+);/gi, (match, hex: string) => {
      const codePoint = Number.parseInt(hex, 16);
      return Number.isInteger(codePoint) && codePoint > 0 && codePoint <= 0x10ffff ? String.fromCodePoint(codePoint) : match;
    })
    .replace(/&#(\d+);/g, (match, digits: string) => {
      const codePoint = Number.parseInt(digits, 10);
      return Number.isInteger(codePoint) && codePoint > 0 && codePoint <= 0x10ffff ? String.fromCodePoint(codePoint) : match;
    })
    .replace(/&(amp|apos|gt|lt|nbsp|ndash|mdash|minus|quot);/gi, (match, name: string) => named[name.toLowerCase()] ?? match);
}

function compactPlainText(value: string) {
  return decodeHtmlEntities(value)
    .replace(/\u00a0/g, " ")
    .normalize("NFKC")
    .replace(/[‐‑‒–—−]/g, "-")
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function stripHtml(value: string, preserveCells = false) {
  return compactPlainText(
    value
      .replace(/<!--[\s\S]*?-->/g, " ")
      .replace(/<(script|style|noscript|svg|header|nav|footer|form)\b[^>]*>[\s\S]*?<\/\1>/gi, " ")
      .replace(/<br\s*\/?\s*>/gi, "\n")
      .replace(preserveCells ? /<\/(?:td|th)>/gi : /$^/, " | ")
      .replace(/<\/(?:p|li|tr|h[1-6]|div|section|article)>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
  );
}

export function isAllowedFomcDocumentUrl(value: string, kind?: "statement" | "sep" | "press_conference" | "transcript") {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.hostname.toLowerCase() !== FED_HOST || url.username || url.password || url.port || url.search || url.hash) return false;
    if (kind === "statement") return statementPath.test(url.pathname);
    if (kind === "sep") return sepPath.test(url.pathname);
    if (kind === "press_conference") return pressConferencePath.test(url.pathname);
    if (kind === "transcript") return transcriptPath.test(url.pathname);
    return statementPath.test(url.pathname) || sepPath.test(url.pathname) || pressConferencePath.test(url.pathname) || transcriptPath.test(url.pathname);
  } catch {
    return false;
  }
}

export function fomcDocumentDateFromUrl(value: string) {
  if (!isAllowedFomcDocumentUrl(value)) return null;
  const match = new URL(value).pathname.match(/(\d{4})(\d{2})(\d{2})/);
  return match ? `${match[1]}-${match[2]}-${match[3]}` : null;
}

function absoluteFedUrl(value: string) {
  try {
    return new URL(value, "https://www.federalreserve.gov").toString();
  } catch {
    return undefined;
  }
}

function calendarDocumentLinks(html: string) {
  const links: Array<{ url: string; date: string; kind: "statement" | "sep" | "press_conference" }> = [];
  for (const match of Array.from(html.matchAll(/href=["']([^"']+)["']/gi))) {
    const url = absoluteFedUrl(match[1]);
    if (!url) continue;
    const kind = isAllowedFomcDocumentUrl(url, "statement")
      ? "statement" as const
      : isAllowedFomcDocumentUrl(url, "sep")
        ? "sep" as const
        : isAllowedFomcDocumentUrl(url, "press_conference")
          ? "press_conference" as const
          : null;
    if (!kind) continue;
    const date = fomcDocumentDateFromUrl(url);
    if (date) links.push({ url, date, kind });
  }
  return Array.from(new Map(links.map((link) => [link.url, link])).values());
}

export function findFomcCalendarDocuments(html: string, releaseAt: string): FomcCalendarDocuments | null {
  const releaseDate = new Date(releaseAt);
  if (!Number.isFinite(releaseDate.getTime())) return null;
  const meetingDate = releaseDate.toISOString().slice(0, 10);
  const links = calendarDocumentLinks(html);
  const statements = links.filter((link) => link.kind === "statement").sort((left, right) => right.date.localeCompare(left.date));
  const projections = links.filter((link) => link.kind === "sep").sort((left, right) => right.date.localeCompare(left.date));
  return {
    meetingDate,
    statementUrl: statements.find((link) => link.date === meetingDate)?.url,
    priorStatementUrl: statements.find((link) => link.date < meetingDate)?.url,
    sepUrl: projections.find((link) => link.date <= meetingDate)?.url,
    pressConferenceUrl: links.find((link) => link.kind === "press_conference" && link.date === meetingDate)?.url
  };
}

export function findFomcTranscriptUrl(html: string, meetingDate: string) {
  for (const match of Array.from(html.matchAll(/href=["']([^"']+)["']/gi))) {
    const url = absoluteFedUrl(match[1]);
    if (url && isAllowedFomcDocumentUrl(url, "transcript") && fomcDocumentDateFromUrl(url) === meetingDate) return url;
  }
  return undefined;
}

export function extractFomcStatementText(html: string) {
  if (html.length < 200 || html.length > 512 * 1024) return null;
  const text = stripHtml(html);
  const titleIndex = text.search(/Federal Reserve issues FOMC statement/i);
  if (titleIndex < 0) return null;
  const endMatch = text.slice(titleIndex).search(/\n(?:For media inquiries|Implementation Note issued|Last Update)\b/i);
  const sliced = text.slice(titleIndex, endMatch > 0 ? titleIndex + endMatch : undefined).trim();
  if (
    sliced.length < 180 ||
    sliced.length > 16_000 ||
    !/For release at/i.test(sliced) ||
    !/(?:Federal Open Market Committee|Federal Reserve issues FOMC statement)/i.test(sliced) ||
    !/The Committee decided/i.test(sliced) ||
    !/(?:\bvote\b|\bVoting\b)/i.test(sliced)
  ) return null;
  return sliced;
}

function parseMixedNumber(value: string) {
  const normalized = value.trim().replace(/[–—−]/g, "-");
  const mixed = normalized.match(/^(\d+)-(\d+)\/(\d+)$/);
  if (mixed) {
    const denominator = Number(mixed[3]);
    return denominator > 0 ? Number(mixed[1]) + Number(mixed[2]) / denominator : null;
  }
  const fraction = normalized.match(/^(\d+)\/(\d+)$/);
  if (fraction) {
    const denominator = Number(fraction[2]);
    return denominator > 0 ? Number(fraction[1]) / denominator : null;
  }
  const numeric = Number(normalized);
  return Number.isFinite(numeric) ? numeric : null;
}

function parseTargetRange(text: string) {
  const match = text.match(/target range for the federal funds rate[\s\S]{0,100}?\b(?:at|to)\s+(\d+(?:[.–—−-]\d+\/\d+|\.\d+)?|\d+\/\d+)\s+(?:percent\s+)?to\s+(\d+(?:[.–—−-]\d+\/\d+|\.\d+)?|\d+\/\d+)\s+percent/i);
  if (!match) return {};
  const targetLow = parseMixedNumber(match[1]);
  const targetHigh = parseMixedNumber(match[2]);
  return targetLow !== null && targetHigh !== null ? { targetLow, targetHigh } : {};
}

function signalScore(text: string, signals: Array<{ pattern: RegExp; weight: number }>) {
  return signals.reduce((result, signal) => signal.pattern.test(text)
    ? { score: result.score + signal.weight, count: result.count + 1 }
    : result, { score: 0, count: 0 });
}

function countNamedVoters(value: string) {
  const members = value
    .replace(/\s+/g, " ")
    .split(";")
    .map((member) => member.replace(/^\s*and\s+/i, "").trim())
    .filter(Boolean);
  return members.length;
}

function countNamedDissenters(value: string) {
  return value
    .split(";")
    .map((group) => group.replace(/^\s*and\s+/i, "").split(/,\s+who\b/i)[0]?.trim() ?? "")
    .filter(Boolean)
    .reduce((total, group) => total + group
      .replace(/,\s+and\s+/gi, ",")
      .replace(/\s+and\s+/gi, ",")
      .split(",")
      .map((name) => name.trim())
      .filter(Boolean).length, 0);
}

function dissentBiasForText(text: string, decision: FomcRateDecision): NonNullable<FomcPolicyAssessment["vote"]>["dissentBias"] {
  const prefersNoChange = /preferred (?:no change|to (?:maintain|keep))\b/i.test(text);
  const hasHawkishAlternative = /preferred to (?:raise|increase)\b|did not support (?:the )?inclusion of an easing bias|preferred (?:a )?(?:smaller|lesser) (?:cut|reduction)/i.test(text) ||
    (decision === "cut" && prefersNoChange);
  const hasDovishAlternative = /preferred to (?:lower|reduce)\b|preferred (?:a )?(?:larger|greater) (?:cut|reduction)/i.test(text) ||
    (decision === "hike" && prefersNoChange);
  if (hasHawkishAlternative && hasDovishAlternative) return "mixed";
  if (hasHawkishAlternative) return "hike";
  if (hasDovishAlternative) return "cut";
  return "unspecified";
}

function parseNamedVote(text: string, decision: FomcRateDecision) {
  const forMatch = text.match(/Voting for (?:the monetary policy action|the action|this action) (?:was|were)\s+([\s\S]{1,2400}?)(?:\.\s+Voting against|\.\s*$)/i);
  if (!forMatch) return undefined;
  const againstMatch = text.match(/Voting against (?:the monetary policy action|the action|this action) (?:was|were)\s+([\s\S]{1,1200}?)\.\s*$/i);
  const forCount = countNamedVoters(forMatch[1]);
  const againstText = againstMatch?.[1] ?? "";
  const againstCount = againstText ? countNamedDissenters(againstText) : 0;
  return forCount > 0 ? { for: forCount, against: againstCount, dissentBias: dissentBiasForText(againstText, decision) } : undefined;
}

export function parseFomcStatement(text: string): ParsedFomcStatement | null {
  const normalizedText = compactPlainText(text);
  if (!/(?:Federal Open Market Committee|Federal Reserve issues FOMC statement)/i.test(normalizedText) || !/The Committee decided/i.test(normalizedText)) return null;
  const decisionMatch = normalizedText.match(/The Committee decided to\s+(maintain|keep|raise|increase|lower|reduce)\b/i);
  if (!decisionMatch) return null;
  const action = decisionMatch[1].toLowerCase();
  const decision: FomcRateDecision = /raise|increase/.test(action) ? "hike" : /lower|reduce/.test(action) ? "cut" : "hold";
  const range = parseTargetRange(normalizedText);
  const decisionContext = decisionMatch.index === undefined ? "" : normalizedText.slice(decisionMatch.index, decisionMatch.index + 320);
  const changeMatch = decision === "hold"
    ? null
    : decisionContext.match(/\bby\s+(\d+(?:[.–—−-]\d+\/\d+|\.\d+)?|\d+\/\d+)\s+percentage point/i);
  const parsedChange = changeMatch ? parseMixedNumber(changeMatch[1]) : null;
  const voteMatch = normalizedText.match(/\bby\s+a\s+(\d+)\s*-\s*(\d+)\s+vote/i);
  const dissentText = normalizedText.match(/Voting against[\s\S]*$/i)?.[0] ?? "";
  const dissentBias = dissentBiasForText(dissentText, decision);
  const vote = voteMatch ? {
    for: Number(voteMatch[1]),
    against: Number(voteMatch[2]),
    dissentBias
  } : parseNamedVote(normalizedText, decision);

  const hawkish = signalScore(normalizedText, [
    { pattern: /inflation remains (?:somewhat )?elevated|inflation continues to be elevated/i, weight: 1 },
    { pattern: /upside risks? to inflation|inflation risks? (?:are|remain) tilted to the upside/i, weight: 2 },
    { pattern: /not considering (?:additional|further) (?:rate )?(?:cuts|reductions)|not the time to (?:cut|reduce)/i, weight: 2 },
    { pattern: /prepared to (?:raise|increase|tighten)|additional policy firming/i, weight: 2 },
    { pattern: /strongly committed to returning inflation to (?:its )?2 percent|will deliver price stability/i, weight: 1 }
  ]);
  const dovish = signalScore(normalizedText, [
    { pattern: /job gains have slowed|employment gains have slowed|labor market conditions have softened/i, weight: 1 },
    { pattern: /unemployment rate has moved up|downside risks? to employment (?:have|has) (?:increased|risen)/i, weight: 2 },
    { pattern: /reduce the degree of policy restraint|less restrictive|further adjustments? toward a more neutral stance/i, weight: 2 },
    { pattern: /inflation has eased|made further progress toward the Committee'?s 2 percent objective/i, weight: 1 },
    { pattern: /risks to achieving its employment and inflation goals (?:are|have moved) roughly in balance/i, weight: 1 }
  ]);
  const decisionScore = decision === "hike" ? 3 : decision === "cut" ? -3 : 0;
  const dissentScore = vote?.dissentBias === "hike" ? 2 : vote?.dissentBias === "cut" ? -2 : 0;
  return {
    decision,
    ...range,
    ...(parsedChange !== null ? { changeBps: Math.round(parsedChange * 100) } : {}),
    ...(vote ? { vote } : {}),
    toneScore: decisionScore + dissentScore + hawkish.score - dovish.score,
    hawkishSignalCount: hawkish.count + (decision === "hike" ? 1 : 0) + (vote?.dissentBias === "hike" || vote?.dissentBias === "mixed" ? 1 : 0),
    dovishSignalCount: dovish.count + (decision === "cut" ? 1 : 0) + (vote?.dissentBias === "cut" || vote?.dissentBias === "mixed" ? 1 : 0)
  };
}

function tableRows(html: string) {
  return Array.from(html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi), (row) =>
    Array.from(row[1].matchAll(/<(?:td|th)\b[^>]*>([\s\S]*?)<\/(?:td|th)>/gi), (cell) => stripHtml(cell[1], true).replace(/\s*\|\s*/g, " ").trim())
      .filter(Boolean)
  ).filter((row) => row.length > 0);
}

function firstFiniteNumber(values: string[]) {
  for (const value of values) {
    const match = value.replace(/[−–—]/g, "-").match(/-?\d+(?:\.\d+)?/);
    if (!match) continue;
    const number = Number(match[0]);
    if (Number.isFinite(number)) return number;
  }
  return null;
}

export function parseFomcSepHtml(html: string, sourceUrl: string): FomcSepProjection | null {
  if (!isAllowedFomcDocumentUrl(sourceUrl, "sep") || html.length < 300 || html.length > 2 * 1024 * 1024) return null;
  const plain = stripHtml(html, true);
  if (
    !/FOMC Projections materials, accessible version/i.test(plain) ||
    !/Summary of Economic Projections/i.test(plain) ||
    !/Table 1\./i.test(plain) ||
    !/Projected appropriate policy path/i.test(plain) ||
    !/Federal funds rate/i.test(plain)
  ) return null;
  const date = fomcDocumentDateFromUrl(sourceUrl);
  if (!date) return null;
  const rows = tableRows(html);
  const rateIndex = rows.findIndex((row) => /^Federal funds rate\b/i.test(row[0] ?? ""));
  if (rateIndex < 0) return null;
  const medianHeader = rows.slice(0, rateIndex).find((row) => row.filter((cell) => /^\d{4}$/.test(cell)).length >= 2);
  if (!medianHeader) return null;
  const medianYears: number[] = [];
  for (const cell of medianHeader) {
    if (/^\d{4}$/.test(cell)) medianYears.push(Number(cell));
    else if (medianYears.length > 0 && /longer run/i.test(cell)) break;
  }
  const publishedYear = Number(date.slice(0, 4));
  const desiredProjectionYear = Number(date.slice(5, 7)) === 12 ? publishedYear + 1 : publishedYear;
  const projectionIndex = medianYears.indexOf(desiredProjectionYear);
  if (projectionIndex < 0) return null;
  const medianRate = firstFiniteNumber([rows[rateIndex][projectionIndex + 1] ?? ""]);
  if (medianRate === null || medianRate < 0 || medianRate > 25) return null;
  const previousRow = rows.slice(rateIndex + 1, rateIndex + 4).find((row) => /projection/i.test(row[0] ?? ""));
  const previousMedianRate = previousRow ? firstFiniteNumber([previousRow[projectionIndex + 1] ?? ""]) : null;
  const projectionYear = medianYears[projectionIndex];
  return {
    publishedDate: date,
    projectionYear,
    medianRate,
    ...(previousMedianRate !== null && previousMedianRate >= 0 && previousMedianRate <= 25
      ? {
          previousMedianRate,
          changeFromPreviousBps: Math.round((medianRate - previousMedianRate) * 100)
        }
      : {})
  };
}

function formatRate(value: number) {
  return value.toFixed(3).replace(/0+$/, "").replace(/\.$/, "");
}

function decisionLabel(statement: ParsedFomcStatement) {
  const range = statement.targetLow !== undefined && statement.targetHigh !== undefined
    ? ` · ${formatRate(statement.targetLow)}~${formatRate(statement.targetHigh)}%`
    : "";
  if (statement.decision === "hike") return `금리 인상${range}`;
  if (statement.decision === "cut") return `금리 인하${range}`;
  return `금리 동결${range}`;
}

function stanceForScore(score: number, hasOpposingSignals: boolean): FomcPolicyStance {
  if (hasOpposingSignals) return "mixed";
  if (score >= 4) return "hawkish";
  if (score >= 1) return "slightly_hawkish";
  if (score <= -4) return "dovish";
  if (score <= -1) return "slightly_dovish";
  return "neutral";
}

const stanceLabels: Record<FomcPolicyStance, string> = {
  hawkish: "매파적",
  slightly_hawkish: "다소 매파적",
  mixed: "매파·비둘기 혼재",
  neutral: "중립적",
  slightly_dovish: "다소 비둘기적",
  dovish: "비둘기적"
};

const shiftLabels: Record<FomcRelativeShift, string> = {
  more_hawkish: "직전보다 더 매파적",
  little_changed: "직전과 큰 변화 없음",
  more_dovish: "직전보다 더 비둘기적",
  unavailable: "직전 성명 비교 대기"
};

const pathLabels: Record<FomcRatePathBias, string> = {
  hike_risk: "인상·고금리 쪽 무게",
  higher_for_longer: "인하 기대 약화",
  balanced: "인상·인하 균형",
  easing: "인하 쪽 무게"
};

function riskImpact(stance: FomcPolicyStance, path: FomcRatePathBias) {
  if (stance === "hawkish" || stance === "slightly_hawkish" || path === "hike_risk" || path === "higher_for_longer") {
    return { riskAssetImpact: "headwind" as const, riskAssetLabel: "단기 악재 쪽 · 금리·달러 부담 가능성" };
  }
  if (stance === "dovish" || stance === "slightly_dovish" || path === "easing") {
    return { riskAssetImpact: "tailwind" as const, riskAssetLabel: "단기 호재 쪽 · 유동성 기대에 우호적일 수 있음" };
  }
  return { riskAssetImpact: "mixed" as const, riskAssetLabel: "호재·악재 혼재 · 실제 가격 반응 확인 필요" };
}

function rationaleFor(input: {
  statement: ParsedFomcStatement;
  stance: FomcPolicyStance;
  sep?: FomcSepProjection;
}) {
  const parts: string[] = [];
  if (input.statement.vote?.against) {
    const direction = input.statement.vote.dissentBias === "hike"
      ? "더 긴축적인 경로"
      : input.statement.vote.dissentBias === "cut"
        ? "더 완화적인 경로"
        : input.statement.vote.dissentBias === "mixed" ? "서로 다른 경로" : "다른 결정";
    parts.push(`반대표 ${input.statement.vote.against}명은 ${direction}을 선호했습니다.`);
  }
  if (input.sep?.changeFromPreviousBps) {
    const direction = input.sep.changeFromPreviousBps > 0 ? "높아" : "낮아";
    parts.push(`최신 SEP의 ${input.sep.projectionYear}년 말 정책금리 중앙값은 직전 전망보다 ${Math.abs(input.sep.changeFromPreviousBps) / 100}%p ${direction}졌습니다.`);
  }
  if (parts.length === 0) {
    if (input.stance === "hawkish" || input.stance === "slightly_hawkish") parts.push("성명에서 물가 경계와 긴축 유지 신호가 상대적으로 강하게 확인됐습니다.");
    else if (input.stance === "dovish" || input.stance === "slightly_dovish") parts.push("성명에서 고용 하방 위험과 정책 완화 신호가 상대적으로 강하게 확인됐습니다.");
    else if (input.stance === "mixed") parts.push("성명과 정책금리 전망이 서로 다른 방향을 가리켜 한쪽으로 단정하지 않습니다.");
    else parts.push("성명 문구만으로 인상 또는 인하 방향이 뚜렷하지 않습니다.");
  }
  return parts.join(" ").slice(0, 360);
}

export function buildFomcPolicyAssessment(input: {
  meetingDate: string;
  analyzedAt: string;
  statementText: string;
  priorStatementText?: string | null;
  statementUrl: string;
  priorStatementUrl?: string;
  sep?: FomcSepProjection | null;
  sepUrl?: string;
  pressConferenceUrl?: string;
  transcriptUrl?: string;
}): FomcPolicyAssessment | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.meetingDate) || !Number.isFinite(Date.parse(input.analyzedAt))) return null;
  if (!isAllowedFomcDocumentUrl(input.statementUrl, "statement") || fomcDocumentDateFromUrl(input.statementUrl) !== input.meetingDate) return null;
  const statement = parseFomcStatement(input.statementText);
  if (!statement) return null;
  const priorStatementUrl = input.priorStatementUrl &&
    isAllowedFomcDocumentUrl(input.priorStatementUrl, "statement") &&
    (fomcDocumentDateFromUrl(input.priorStatementUrl) ?? input.meetingDate) < input.meetingDate
    ? input.priorStatementUrl
    : undefined;
  const priorStatement = input.priorStatementText && priorStatementUrl ? parseFomcStatement(input.priorStatementText) : null;
  const candidateSep = input.sep ?? null;
  const sepUrl = candidateSep && input.sepUrl &&
    isAllowedFomcDocumentUrl(input.sepUrl, "sep") &&
    fomcDocumentDateFromUrl(input.sepUrl) === candidateSep.publishedDate &&
    candidateSep.publishedDate <= input.meetingDate
    ? input.sepUrl
    : undefined;
  const sep = sepUrl ? candidateSep : null;
  const pressConferenceUrl = input.pressConferenceUrl &&
    isAllowedFomcDocumentUrl(input.pressConferenceUrl, "press_conference") &&
    fomcDocumentDateFromUrl(input.pressConferenceUrl) === input.meetingDate
    ? input.pressConferenceUrl
    : undefined;
  const transcriptUrl = input.transcriptUrl &&
    isAllowedFomcDocumentUrl(input.transcriptUrl, "transcript") &&
    fomcDocumentDateFromUrl(input.transcriptUrl) === input.meetingDate
    ? input.transcriptUrl
    : undefined;
  const sepDelta = sep?.publishedDate === input.meetingDate ? sep.changeFromPreviousBps ?? 0 : 0;
  const sepScore = sepDelta >= 12 ? 2 : sepDelta <= -12 ? -2 : 0;
  const opposingSignals = (
    statement.vote?.dissentBias === "mixed" ||
    statement.toneScore >= 2 && sepScore <= -2 ||
    statement.toneScore <= -2 && sepScore >= 2 ||
    statement.hawkishSignalCount > 0 && statement.dovishSignalCount > 0 && Math.abs(statement.toneScore + sepScore) <= 2
  );
  const stance = stanceForScore(statement.toneScore + sepScore, opposingSignals);
  const relativeDelta = priorStatement ? statement.toneScore - priorStatement.toneScore : null;
  const relativeShift: FomcRelativeShift = relativeDelta === null
    ? "unavailable"
    : relativeDelta >= 2 ? "more_hawkish" : relativeDelta <= -2 ? "more_dovish" : "little_changed";
  const midpoint = statement.targetLow !== undefined && statement.targetHigh !== undefined
    ? (statement.targetLow + statement.targetHigh) / 2
    : null;
  const sepVsCurrent = sep && midpoint !== null ? Math.round((sep.medianRate - midpoint) * 100) : 0;
  let ratePathBias: FomcRatePathBias;
  if (statement.vote?.dissentBias === "hike" || statement.decision === "hike") ratePathBias = "hike_risk";
  else if (statement.decision === "cut") ratePathBias = statement.toneScore >= 0 ? "balanced" : "easing";
  else if (sepVsCurrent >= 12 || statement.toneScore >= 3) ratePathBias = "higher_for_longer";
  else if (sepVsCurrent <= -12 || statement.toneScore <= -3) ratePathBias = "easing";
  else ratePathBias = "balanced";
  const risk = riskImpact(stance, ratePathBias);
  const sepCoverage = sep
    ? sep.publishedDate === input.meetingDate ? "current_meeting" as const : "latest_available" as const
    : "unavailable" as const;
  const pressConference = transcriptUrl
    ? "transcript_link_available_unparsed" as const
    : pressConferenceUrl ? "transcript_pending" as const : "unavailable" as const;
  const coverageLabel = [
    sep ? (sepCoverage === "current_meeting" ? "성명·당일 SEP 반영" : `성명·최근 SEP(${sep.publishedDate.slice(5)}) 반영`) : "성명서만 반영",
    transcriptUrl ? "기자회견 transcript 링크 확인·본문 미반영" : "기자회견 원문 대기"
  ].join(" · ");
  const targetRange = statement.targetLow !== undefined && statement.targetHigh !== undefined
    ? `${formatRate(statement.targetLow)}~${formatRate(statement.targetHigh)}%`
    : undefined;
  const result: FomcPolicyAssessment = {
    schemaVersion: 1,
    ruleVersion: FOMC_POLICY_RULE_VERSION,
    method: "deterministic_official_text",
    meetingDate: input.meetingDate,
    analyzedAt: input.analyzedAt,
    decision: statement.decision,
    decisionLabel: decisionLabel(statement),
    ...(targetRange ? { targetRange } : {}),
    ...(statement.changeBps ? { changeBps: statement.changeBps } : {}),
    ...(statement.vote ? { vote: statement.vote } : {}),
    stance,
    stanceLabel: stanceLabels[stance],
    relativeShift,
    relativeShiftLabel: shiftLabels[relativeShift],
    ratePathBias,
    ratePathLabel: pathLabels[ratePathBias],
    ...risk,
    confidence: priorStatement && sep?.publishedDate === input.meetingDate ? "high" : priorStatement || sep ? "medium" : "low",
    summary: `${decisionLabel(statement)} · ${stanceLabels[stance]} · ${shiftLabels[relativeShift]} · ${pathLabels[ratePathBias]}`.slice(0, 280),
    rationale: rationaleFor({ statement, stance, sep: sep ?? undefined }),
    coverageLabel: coverageLabel.slice(0, 220),
    coverage: {
      statement: "included",
      priorStatement: priorStatement ? "included" : "unavailable",
      sep: sepCoverage,
      pressConference
    },
    statementUrl: input.statementUrl,
    ...(priorStatement && priorStatementUrl ? { priorStatementUrl } : {}),
    ...(sep && sepUrl ? { sepUrl, sep } : {}),
    ...(pressConferenceUrl ? { pressConferenceUrl } : {}),
    ...(transcriptUrl ? { transcriptUrl } : {})
  };
  return parseFomcPolicyAssessment(result);
}

function safeText(value: unknown, maxLength: number) {
  if (typeof value !== "string") return null;
  const text = value.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();
  return text && text.length <= maxLength ? text : null;
}

function isEnum<T extends string>(value: unknown, values: readonly T[]): value is T {
  return typeof value === "string" && values.includes(value as T);
}

export function parseFomcPolicyAssessment(value: unknown): FomcPolicyAssessment | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const item = value as Record<string, unknown>;
  if (item.schemaVersion !== 1 || item.ruleVersion !== FOMC_POLICY_RULE_VERSION || item.method !== "deterministic_official_text") return null;
  const meetingDate = safeText(item.meetingDate, 10);
  const analyzedAt = safeText(item.analyzedAt, 40);
  const decisionLabelValue = safeText(item.decisionLabel, 100);
  const stanceLabelValue = safeText(item.stanceLabel, 80);
  const relativeShiftLabelValue = safeText(item.relativeShiftLabel, 100);
  const ratePathLabelValue = safeText(item.ratePathLabel, 100);
  const riskAssetLabelValue = safeText(item.riskAssetLabel, 160);
  const summary = safeText(item.summary, 280);
  const rationale = safeText(item.rationale, 360);
  const coverageLabel = safeText(item.coverageLabel, 220);
  const statementUrlValue = safeText(item.statementUrl, 320);
  if (
    !meetingDate || !/^\d{4}-\d{2}-\d{2}$/.test(meetingDate) ||
    !analyzedAt || !Number.isFinite(Date.parse(analyzedAt)) ||
    !decisionLabelValue || !stanceLabelValue || !relativeShiftLabelValue || !ratePathLabelValue || !riskAssetLabelValue || !summary || !rationale || !coverageLabel ||
    !statementUrlValue || !isAllowedFomcDocumentUrl(statementUrlValue, "statement") || fomcDocumentDateFromUrl(statementUrlValue) !== meetingDate ||
    !isEnum(item.decision, ["hike", "hold", "cut"] as const) ||
    !isEnum(item.stance, ["hawkish", "slightly_hawkish", "mixed", "neutral", "slightly_dovish", "dovish"] as const) ||
    !isEnum(item.relativeShift, ["more_hawkish", "little_changed", "more_dovish", "unavailable"] as const) ||
    !isEnum(item.ratePathBias, ["hike_risk", "higher_for_longer", "balanced", "easing"] as const) ||
    !isEnum(item.riskAssetImpact, ["headwind", "mixed", "tailwind"] as const) ||
    !isEnum(item.confidence, ["high", "medium", "low"] as const)
  ) return null;
  const coverage = item.coverage && typeof item.coverage === "object" && !Array.isArray(item.coverage)
    ? item.coverage as Record<string, unknown>
    : null;
  if (
    !coverage || coverage.statement !== "included" ||
    !isEnum(coverage.priorStatement, ["included", "unavailable"] as const) ||
    !isEnum(coverage.sep, ["current_meeting", "latest_available", "unavailable"] as const) ||
    !isEnum(coverage.pressConference, ["transcript_link_available_unparsed", "transcript_pending", "unavailable"] as const)
  ) return null;

  const optionalUrl = (name: "priorStatementUrl" | "sepUrl" | "pressConferenceUrl" | "transcriptUrl", kind: "statement" | "sep" | "press_conference" | "transcript") => {
    if (item[name] === undefined) return undefined;
    const text = safeText(item[name], 320);
    return text && isAllowedFomcDocumentUrl(text, kind) ? text : null;
  };
  const priorStatementUrl = optionalUrl("priorStatementUrl", "statement");
  const sepUrl = optionalUrl("sepUrl", "sep");
  const pressConferenceUrl = optionalUrl("pressConferenceUrl", "press_conference");
  const transcriptUrl = optionalUrl("transcriptUrl", "transcript");
  if (priorStatementUrl === null || sepUrl === null || pressConferenceUrl === null || transcriptUrl === null) return null;
  if (priorStatementUrl && (fomcDocumentDateFromUrl(priorStatementUrl) ?? meetingDate) >= meetingDate) return null;
  if (pressConferenceUrl && fomcDocumentDateFromUrl(pressConferenceUrl) !== meetingDate) return null;
  if (transcriptUrl && fomcDocumentDateFromUrl(transcriptUrl) !== meetingDate) return null;

  const targetRange = item.targetRange === undefined ? undefined : safeText(item.targetRange, 40);
  if (item.targetRange !== undefined && !targetRange) return null;
  const changeBps = item.changeBps === undefined ? undefined : item.changeBps;
  if (changeBps !== undefined && (typeof changeBps !== "number" || !Number.isInteger(changeBps) || Math.abs(changeBps) > 1_000)) return null;
  const voteValue = item.vote;
  let vote: FomcPolicyAssessment["vote"];
  if (voteValue !== undefined) {
    if (!voteValue || typeof voteValue !== "object" || Array.isArray(voteValue)) return null;
    const record = voteValue as Record<string, unknown>;
    if (!Number.isInteger(record.for) || !Number.isInteger(record.against) || Number(record.for) < 0 || Number(record.against) < 0 || !isEnum(record.dissentBias, ["hike", "cut", "mixed", "unspecified"] as const)) return null;
    vote = { for: Number(record.for), against: Number(record.against), dissentBias: record.dissentBias };
  }
  let sep: FomcSepProjection | undefined;
  if (item.sep !== undefined) {
    if (!item.sep || typeof item.sep !== "object" || Array.isArray(item.sep) || !sepUrl) return null;
    const record = item.sep as Record<string, unknown>;
    if (typeof record.publishedDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(record.publishedDate) || !Number.isInteger(record.projectionYear) || typeof record.medianRate !== "number" || !Number.isFinite(record.medianRate) || record.medianRate < 0 || record.medianRate > 25) return null;
    const publishedYear = Number(record.publishedDate.slice(0, 4));
    if (Number(record.projectionYear) < publishedYear || Number(record.projectionYear) > publishedYear + 5) return null;
    if (record.previousMedianRate !== undefined && (typeof record.previousMedianRate !== "number" || !Number.isFinite(record.previousMedianRate) || record.previousMedianRate < 0 || record.previousMedianRate > 25)) return null;
    if (record.changeFromPreviousBps !== undefined && (typeof record.changeFromPreviousBps !== "number" || !Number.isInteger(record.changeFromPreviousBps) || Math.abs(record.changeFromPreviousBps) > 2_500)) return null;
    sep = {
      publishedDate: record.publishedDate,
      projectionYear: Number(record.projectionYear),
      medianRate: record.medianRate,
      ...(typeof record.previousMedianRate === "number" ? { previousMedianRate: record.previousMedianRate } : {}),
      ...(typeof record.changeFromPreviousBps === "number" ? { changeFromPreviousBps: record.changeFromPreviousBps } : {})
    };
  }
  if (sepUrl && (!sep || fomcDocumentDateFromUrl(sepUrl) !== sep.publishedDate || sep.publishedDate > meetingDate)) return null;
  if ((coverage.priorStatement === "included") !== Boolean(priorStatementUrl)) return null;
  if ((coverage.sep === "unavailable") !== !sep) return null;
  if (coverage.sep === "current_meeting" && sep?.publishedDate !== meetingDate) return null;
  if (coverage.sep === "latest_available" && (!sep || sep.publishedDate >= meetingDate)) return null;
  if (coverage.pressConference === "transcript_link_available_unparsed" && !transcriptUrl) return null;
  if (coverage.pressConference === "transcript_pending" && (!pressConferenceUrl || transcriptUrl)) return null;
  if (coverage.pressConference === "unavailable" && (pressConferenceUrl || transcriptUrl)) return null;
  return {
    schemaVersion: 1,
    ruleVersion: FOMC_POLICY_RULE_VERSION,
    method: "deterministic_official_text",
    meetingDate,
    analyzedAt,
    decision: item.decision,
    decisionLabel: decisionLabelValue,
    ...(targetRange ? { targetRange } : {}),
    ...(typeof changeBps === "number" ? { changeBps } : {}),
    ...(vote ? { vote } : {}),
    stance: item.stance,
    stanceLabel: stanceLabelValue,
    relativeShift: item.relativeShift,
    relativeShiftLabel: relativeShiftLabelValue,
    ratePathBias: item.ratePathBias,
    ratePathLabel: ratePathLabelValue,
    riskAssetImpact: item.riskAssetImpact,
    riskAssetLabel: riskAssetLabelValue,
    confidence: item.confidence,
    summary,
    rationale,
    coverageLabel,
    coverage: {
      statement: "included",
      priorStatement: coverage.priorStatement,
      sep: coverage.sep,
      pressConference: coverage.pressConference
    },
    statementUrl: statementUrlValue,
    ...(priorStatementUrl ? { priorStatementUrl } : {}),
    ...(sepUrl ? { sepUrl } : {}),
    ...(pressConferenceUrl ? { pressConferenceUrl } : {}),
    ...(transcriptUrl ? { transcriptUrl } : {}),
    ...(sep ? { sep } : {})
  };
}

export function fomcPolicyAssessmentFingerprint(value: FomcPolicyAssessment) {
  const { analyzedAt: _analyzedAt, ...stable } = value;
  return `${value.ruleVersion}:${JSON.stringify(stable)}`;
}

type FomcAssessmentCarrier = {
  source?: string;
  id?: string;
  label: string;
  releaseAt: string;
  fomcPolicyAssessment?: unknown;
};

function assessmentCarrierKey(item: FomcAssessmentCarrier) {
  return `${item.source ?? ""}\u0000${item.id ?? `${item.label}\u0000${item.releaseAt}`}`;
}

function assessmentMatchesCarrier(assessment: FomcPolicyAssessment, item: FomcAssessmentCarrier) {
  const releaseDate = new Date(item.releaseAt);
  return Number.isFinite(releaseDate.getTime()) &&
    assessment.meetingDate === releaseDate.toISOString().slice(0, 10) &&
    isFomcPolicyDocumentLabel(item.label);
}

export function preserveFomcPolicyAssessments<T extends FomcAssessmentCarrier>(
  incomingItems: T[],
  previousItems: FomcAssessmentCarrier[]
): T[] {
  const previousByKey = new Map<string, FomcPolicyAssessment>();
  for (const item of previousItems) {
    const assessment = parseFomcPolicyAssessment(item.fomcPolicyAssessment);
    if (assessment && assessmentMatchesCarrier(assessment, item)) previousByKey.set(assessmentCarrierKey(item), assessment);
  }
  return incomingItems.map((item) => {
    const incoming = parseFomcPolicyAssessment(item.fomcPolicyAssessment);
    if (incoming && assessmentMatchesCarrier(incoming, item)) return { ...item, fomcPolicyAssessment: incoming };
    const previous = previousByKey.get(assessmentCarrierKey(item));
    return { ...item, fomcPolicyAssessment: previous && assessmentMatchesCarrier(previous, item) ? previous : undefined };
  });
}

export function hasFomcAssessmentMetadataChange(
  previousMetadata: Record<string, unknown>,
  incomingMetadata: Record<string, unknown>
) {
  const incoming = parseFomcPolicyAssessment(incomingMetadata.fomc_policy_assessment);
  if (!incoming) return false;
  const incomingFingerprint = typeof incomingMetadata.fomc_policy_fingerprint === "string"
    ? incomingMetadata.fomc_policy_fingerprint
    : null;
  const previousFingerprint = typeof previousMetadata.fomc_policy_fingerprint === "string"
    ? previousMetadata.fomc_policy_fingerprint
    : null;
  return Boolean(incomingFingerprint && incomingFingerprint !== previousFingerprint);
}
