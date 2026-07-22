import type { NewsImpactCapabilities, NewsImpactEvent, NewsMarket } from "@/lib/newsImpact";
import { serializeBasicNewsImpactEvent, serializeOfficialNewsImpactEvent } from "@/lib/newsImpact";
import { publicNewsReactionSummary, repairLegacyMacroPresentation } from "@/lib/newsImpactPresentationRules";
import type { NewsImpactMode } from "@/lib/server/newsImpactMode";
import type { RequestEntitlement } from "@/lib/server/requestEntitlement";

const importanceRank = { critical: 3, high: 2, normal: 1 } as const;

export function cleanPublicNewsText(value: string) {
  const named: Record<string, string> = { amp: "&", apos: "'", gt: ">", lt: "<", nbsp: " ", quot: '"' };
  return value
    .replace(/&#x([0-9a-f]+);/gi, (match, hex: string) => {
      const codePoint = Number.parseInt(hex, 16);
      return Number.isInteger(codePoint) && codePoint > 0 && codePoint <= 0x10ffff ? String.fromCodePoint(codePoint) : match;
    })
    .replace(/&#(\d+);/g, (match, digits: string) => {
      const codePoint = Number.parseInt(digits, 10);
      return Number.isInteger(codePoint) && codePoint > 0 && codePoint <= 0x10ffff ? String.fromCodePoint(codePoint) : match;
    })
    .replace(/&(amp|apos|gt|lt|nbsp|quot);/gi, (match, name: string) => named[name.toLowerCase()] ?? match)
    .replace(/ChartRadar 공식 매크로 원장가/g, "미국 공식 기관이")
    .replace(/뚜렷한 글로벌 반응 없음가 관측됐습니다/g, "뚜렷한 글로벌 반응이 관측되지 않았습니다")
    .replace(/발표 전후의 동일 품질 데이터를 확보하지 못해 영향을 판단하지 않습니다\./g, "같은 기준으로 비교할 발표 전후 자료가 부족해 영향을 판단하지 않습니다.")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanReaction<T extends NewsImpactEvent["reaction"]>(reaction: T, event: NewsImpactEvent): T {
  if (!reaction) return reaction;
  const presentation = repairLegacyMacroPresentation({
    category: event.category,
    macroEventKey: event.macroEventKey,
    headline: cleanPublicNewsText(reaction.headline),
    factSummary: cleanPublicNewsText(reaction.factSummary)
  });
  return {
    ...reaction,
    ...presentation,
    reactionSummary: cleanPublicNewsText(reaction.reactionSummary)
  } as T;
}

function cleanNewsEvent(event: NewsImpactEvent): NewsImpactEvent {
  const reaction = cleanReaction(event.reaction, event);
  const publicReaction = event.status === "revised" && reaction?.stage === "detected"
    ? {
        ...reaction,
        reactionSummary: publicNewsReactionSummary({
          eventStatus: event.status,
          stage: reaction.stage,
          reactionSummary: reaction.reactionSummary
        })
      }
    : reaction;
  const categorySafeReaction = event.category === "macro" && publicReaction
    ? {
        ...publicReaction,
        reactionSummary: publicReaction.reactionSummary
          .replace(/공식 발표 내용이 수정되어/g, "공식 실제값이나 비교 수치가 갱신되어")
          .replace(/수정 시점 이후/g, "공식값 갱신 이후")
      }
    : publicReaction;
  const cleanedHeadline = cleanPublicNewsText(event.headline);
  const cleanedFactSummary = cleanPublicNewsText(event.factSummary);
  const { headline, factSummary } = repairLegacyMacroPresentation({
    category: event.category,
    macroEventKey: event.macroEventKey,
    headline: cleanedHeadline,
    factSummary: cleanedFactSummary
  });
  return {
    ...event,
    headline,
    factSummary,
    reaction: categorySafeReaction,
    ...(event.pro ? {
      pro: {
        ...event.pro,
        reactionHistory: event.pro.reactionHistory.map((reaction) => cleanReaction(reaction, event)),
        revisions: event.pro.revisions.map((revision) => ({
          ...revision,
          ...repairLegacyMacroPresentation({
            category: event.category,
            macroEventKey: event.macroEventKey,
            headline: cleanPublicNewsText(revision.headline),
            factSummary: cleanPublicNewsText(revision.factSummary)
          })
        }))
      }
    } : {})
  };
}

export function newsImpactCapabilities(entitlement: RequestEntitlement): NewsImpactCapabilities {
  const failClosed = entitlement.state === "unavailable" || entitlement.state === "deletion_pending";
  return {
    canSeeProEvidence: entitlement.isPaid && !failClosed,
    canEnableImpactAlerts: Boolean(entitlement.userId) && entitlement.isPaid && !failClosed,
    canSaveJournal: Boolean(entitlement.userId) && entitlement.isPaid && !failClosed,
    requiresAuth: !entitlement.userId,
    alertDefaultEnabled: false
  };
}

export function newsImpactCapabilitiesForMode(
  entitlement: RequestEntitlement,
  mode: NewsImpactMode
): NewsImpactCapabilities {
  const capabilities = newsImpactCapabilities(entitlement);
  return mode === "on"
    ? capabilities
    : { ...capabilities, canSeeProEvidence: false, canEnableImpactAlerts: false, canSaveJournal: false };
}

export function serializeOfficialNewsEvents(events: NewsImpactEvent[]) {
  return events.map(cleanNewsEvent).map(serializeOfficialNewsImpactEvent);
}

export function sortNewsImpactEvents(events: NewsImpactEvent[]) {
  return [...events].sort((left, right) => {
    const importance = importanceRank[right.importance] - importanceRank[left.importance];
    return importance || right.occurredAt.localeCompare(left.occurredAt) || right.id.localeCompare(left.id);
  });
}

export function serializeNewsEvents(events: NewsImpactEvent[], pro: boolean) {
  const cleaned = events.map(cleanNewsEvent);
  return pro ? cleaned : cleaned.map(serializeBasicNewsImpactEvent);
}

export function encodeNewsCursor(offset: number) {
  return Buffer.from(JSON.stringify({ v: 1, offset }), "utf8").toString("base64url");
}

export function decodeNewsCursor(value: string | null) {
  if (!value) return 0;
  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as { v?: unknown; offset?: unknown };
    if (parsed.v !== 1 || !Number.isInteger(parsed.offset) || Number(parsed.offset) < 0 || Number(parsed.offset) > 10_000) return 0;
    return Number(parsed.offset);
  } catch {
    return 0;
  }
}

export function normalizeNewsMarket(value: string | null): NewsMarket | null {
  return value === "crypto" || value === "global" ? value : null;
}
