// 매크로 일정의 타입 분류와 발표 상태 판정을 담당합니다.
import { type MacroEventStatus, type MacroEventType, type MacroStatusDecision } from "@/lib/macro/types";

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

const emptyActualValues = new Set(["", "발표 전", "결과 확인 중", "결과 확인중", "공식 발표 확인 중", "공식값 확인 중", "미정", "-", "확인 예정"]);

export function hasConfirmedActualValue(actualValue?: string) {
  return Boolean(actualValue && !emptyActualValues.has(actualValue.trim()));
}

export function classifyMacroEvent(title: string): MacroEventType {
  const normalizedTitle = title.toLowerCase();
  const isFedSpeech = /speaks|speech|testifies|testimony|remarks|fed member|powell/i.test(title);
  const isPressConference = /press conference|기자회견/i.test(title);

  if (isFedSpeech && !isPressConference) return "speech_event";
  if (/minutes|beige book|statement|implementation note|projection materials|monetary policy report|의사록|성명서|베이지북/i.test(title)) {
    return "document_release";
  }
  if (/federal funds|interest rate decision|rate decision|policy meeting|central bank|press conference|fomc/i.test(title)) {
    return "meeting_event";
  }
  if (
    /cpi|ppi|payroll|non-farm|nonfarm|nfp|unemployment rate|average hourly earnings|gdp|pce|retail sales|durable goods|home sales|new home sales|existing home sales|consumer confidence|consumer sentiment|jobless|claims|initial claims|initial jobless claims|unemployment insurance weekly claims|신규\s*실업수당\s*청구|pmi|ism|jolts/i.test(
      normalizedTitle
    )
  ) {
    return "numeric_release";
  }
  return "calendar_event";
}

export function statusLabelForDocument(title: string) {
  if (/minutes|의사록/i.test(title)) return "의사록 공개 완료";
  if (/implementation note|정책 실행/i.test(title)) return "정책 실행문 공개 완료";
  if (/press conference|기자회견/i.test(title)) return "기자회견 자료 공개";
  if (/beige book|베이지북/i.test(title)) return "문서 공개 완료";
  if (/statement|성명서/i.test(title)) return "성명서 공개 완료";
  return "문서 공개 완료";
}

function scheduledStatus(distanceMs: number): MacroStatusDecision {
  if (distanceMs <= 30 * MINUTE_MS) {
    return {
      status: "imminent",
      statusLabel: "발표 임박",
      nextRefreshMs: 60 * 1000
    };
  }

  return {
    status: "scheduled",
    statusLabel: "예정",
    nextRefreshMs: distanceMs <= 3 * HOUR_MS ? 3 * MINUTE_MS : 30 * MINUTE_MS
  };
}

function unresolvedAfterReleaseStatus(elapsedMs: number, labelPrefix: "결과" | "공식 발표" | "공식 문서" | "공식 자료"): MacroStatusDecision {
  if (elapsedMs <= 30 * MINUTE_MS) {
    return {
      status: "checking",
      statusLabel: labelPrefix === "결과" ? "결과 확인중" : `${labelPrefix} 확인 중`,
      nextRefreshMs: 60 * 1000
    };
  }

  if (elapsedMs <= 3 * HOUR_MS) {
    return {
      status: "checking",
      statusLabel: `${labelPrefix === "결과" ? "공식 발표" : labelPrefix} 확인 중`,
      nextRefreshMs: 5 * MINUTE_MS
    };
  }

  if (elapsedMs <= 7 * DAY_MS) {
    return {
      status: "official_check_needed",
      statusLabel: `${labelPrefix === "결과" ? "공식 발표" : labelPrefix} 확인 필요`,
      nextRefreshMs: 30 * MINUTE_MS,
      staleReason: "발표 시간이 지났지만 공식 실제값이나 공식 문서 링크가 아직 확인되지 않았습니다."
    };
  }

  return {
    status: "past",
    statusLabel: "지난 일정",
    nextRefreshMs: 6 * HOUR_MS,
    staleReason: "오래 지난 일정이며 공식 실제값 또는 문서 링크가 확인되지 않았습니다."
  };
}

function unresolvedNumericReleaseStatus(elapsedMs: number): MacroStatusDecision {
  if (elapsedMs <= 30 * MINUTE_MS) {
    return {
      status: "released_pending_actual",
      statusLabel: "발표값 확인 중",
      nextRefreshMs: 60 * 1000
    };
  }

  return {
    status: "released_pending_actual",
    statusLabel: "발표값 수집 지연",
    nextRefreshMs: elapsedMs <= 3 * HOUR_MS ? 60 * 1000 : 5 * MINUTE_MS,
    staleReason: "발표 시간이 지났지만 공식 실제값이 아직 확인되지 않았습니다."
  };
}

export function resolveMacroStatus(input: {
  title: string;
  eventType: MacroEventType;
  scheduledAt: string;
  actualValue?: string;
  officialUrl?: string;
  releasedAt?: string;
  nowMs?: number;
}): MacroStatusDecision {
  const nowMs = input.nowMs ?? Date.now();
  const scheduledMs = Date.parse(input.scheduledAt);
  const releasedMs = input.releasedAt ? Date.parse(input.releasedAt) : NaN;
  const effectiveReleasedAt = Number.isFinite(releasedMs) ? input.releasedAt : undefined;

  if (!Number.isFinite(scheduledMs)) {
    return {
      status: "official_check_needed",
      statusLabel: "시간 확인 필요",
      nextRefreshMs: 30 * MINUTE_MS,
      staleReason: "발표 시각을 해석하지 못했습니다."
    };
  }

  if (input.eventType === "numeric_release" && hasConfirmedActualValue(input.actualValue)) {
    return {
      status: "actual_available",
      statusLabel: "실제값 확인",
      nextRefreshMs: 6 * HOUR_MS,
      releasedAt: effectiveReleasedAt ?? input.scheduledAt
    };
  }

  if (input.eventType === "document_release" && input.officialUrl) {
    return {
      status: "document_released",
      statusLabel: statusLabelForDocument(input.title),
      nextRefreshMs: 6 * HOUR_MS,
      releasedAt: effectiveReleasedAt ?? input.scheduledAt
    };
  }

  if (input.eventType === "meeting_event" && input.officialUrl) {
    return {
      status: "meeting_completed",
      statusLabel: /press conference|기자회견/i.test(input.title) ? "기자회견 자료 공개" : "정책 결정 발표 완료",
      nextRefreshMs: 6 * HOUR_MS,
      releasedAt: effectiveReleasedAt ?? input.scheduledAt
    };
  }

  if (input.eventType === "speech_event" && input.officialUrl) {
    return {
      status: "document_released",
      statusLabel: "공식 자료 공개",
      nextRefreshMs: 6 * HOUR_MS,
      releasedAt: effectiveReleasedAt ?? input.scheduledAt
    };
  }

  const distanceMs = scheduledMs - nowMs;
  if (distanceMs > 0) return scheduledStatus(distanceMs);
  const elapsedMs = Math.abs(distanceMs);

  if (input.eventType === "numeric_release") return unresolvedNumericReleaseStatus(elapsedMs);
  if (input.eventType === "document_release") return unresolvedAfterReleaseStatus(elapsedMs, "공식 문서");
  if (input.eventType === "meeting_event") {
    if (elapsedMs <= 90 * MINUTE_MS) {
      return {
        status: "in_progress",
        statusLabel: "진행 중",
        nextRefreshMs: 2 * MINUTE_MS
      };
    }
    return unresolvedAfterReleaseStatus(elapsedMs, "공식 발표");
  }
  if (input.eventType === "speech_event") {
    if (elapsedMs <= 90 * MINUTE_MS) {
      return {
        status: "in_progress",
        statusLabel: "진행 중",
        nextRefreshMs: 2 * MINUTE_MS
      };
    }
    return unresolvedAfterReleaseStatus(elapsedMs, "공식 자료");
  }

  return {
    status: "past",
    statusLabel: "지난 일정",
    nextRefreshMs: elapsedMs <= DAY_MS ? 30 * MINUTE_MS : 6 * HOUR_MS
  };
}

export function legacyStateFromStatus(status: MacroEventStatus): "upcoming" | "released" | "watch" {
  if (status === "scheduled" || status === "imminent" || status === "in_progress") return "upcoming";
  if (status === "released_pending_actual" || status === "checking" || status === "official_check_needed" || status === "delayed" || status === "stale") return "watch";
  return "released";
}
