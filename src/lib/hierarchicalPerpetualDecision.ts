import {
  perpetualStructureTimeframes,
  type PerpetualStructureTimeframe,
  type QualifiedMssState,
  type QualifiedStructureDirection
} from "./qualifiedMss";

export type PerpetualHierarchyLayerId = "macro" | "current" | "reaction";
export type PerpetualHierarchyLayerStatus = "aligned" | "mixed" | "provisional" | "unknown";
export type PerpetualHierarchyDirection = QualifiedStructureDirection | "mixed";

export interface PerpetualHierarchyLayer {
  id: PerpetualHierarchyLayerId;
  label: string;
  timeframes: [PerpetualStructureTimeframe, PerpetualStructureTimeframe];
  direction: PerpetualHierarchyDirection;
  status: PerpetualHierarchyLayerStatus;
  strength: number;
  warningDirection: QualifiedStructureDirection;
  detail: string;
}

export interface HierarchicalPerpetualDecision {
  contractVersion: "perpetual-hierarchy-v1";
  historyMode: "bounded-replay";
  coverage: {
    known: number;
    total: 6;
  };
  normalizedScore: number;
  finalDirection: QualifiedStructureDirection;
  conflict: "none" | "macro" | "macro_current" | "current" | "insufficient";
  reaction: "confirming" | "rejecting" | "mixed" | "unavailable";
  layers: [PerpetualHierarchyLayer, PerpetualHierarchyLayer, PerpetualHierarchyLayer];
}

const timeframeLabels: Record<PerpetualStructureTimeframe, string> = {
  "1m": "1분",
  "5m": "5분",
  "15m": "15분",
  "1h": "1시간",
  "4h": "4시간",
  "1d": "1일"
};

const layerDefinitions = [
  { id: "macro", label: "큰 흐름", timeframes: ["1d", "4h"] },
  { id: "current", label: "현재 구조", timeframes: ["1h", "15m"] },
  { id: "reaction", label: "단기 반응", timeframes: ["5m", "1m"] }
] as const;

function directionText(direction: PerpetualHierarchyDirection) {
  if (direction === "bullish") return "위쪽";
  if (direction === "bearish") return "아래쪽";
  if (direction === "mixed") return "엇갈림";
  return "확인 중";
}

function warningDirection(states: QualifiedMssState[]): QualifiedStructureDirection {
  const warnings = states
    .map((state) => state.activeChoch?.direction ?? "unknown")
    .filter((direction): direction is "bullish" | "bearish" => direction !== "unknown");
  if (!warnings.length) return "unknown";
  return warnings.every((direction) => direction === warnings[0]) ? warnings[0] : "unknown";
}

function buildLayer(
  definition: (typeof layerDefinitions)[number],
  byTimeframe: Map<PerpetualStructureTimeframe, QualifiedMssState>
): PerpetualHierarchyLayer {
  const [firstTimeframe, secondTimeframe] = definition.timeframes;
  const states = [byTimeframe.get(firstTimeframe), byTimeframe.get(secondTimeframe)]
    .filter((state): state is QualifiedMssState => Boolean(state));
  const known = states.filter((state) => state.known && state.integrity === "ready" && state.trend !== "unknown");
  let direction: PerpetualHierarchyDirection = "unknown";
  let status: PerpetualHierarchyLayerStatus = "unknown";
  if (known.length === 2) {
    direction = known[0].trend === known[1].trend ? known[0].trend : "mixed";
    status = direction === "mixed" ? "mixed" : "aligned";
  } else if (known.length === 1) {
    direction = known[0].trend;
    status = "provisional";
  }

  const names = `${timeframeLabels[firstTimeframe]}·${timeframeLabels[secondTimeframe]}`;
  const strength = known.length
    ? known.reduce((sum, state) => sum + state.trendStrength, 0) / known.length
    : 0;
  const detail = status === "aligned"
    ? `${names} 확정 구조(MSS)가 모두 ${directionText(direction)}입니다.`
    : status === "mixed"
      ? `${names} 확정 구조(MSS)가 서로 엇갈립니다.`
      : status === "provisional"
        ? `${names} 중 한 시간대의 확정 구조만 확인됐습니다.`
        : `${names} 확정 구조를 더 확인해야 합니다.`;

  return {
    id: definition.id,
    label: definition.label,
    timeframes: [firstTimeframe, secondTimeframe],
    direction,
    status,
    strength: Number(strength.toFixed(4)),
    warningDirection: warningDirection(states),
    detail
  };
}

function layerValue(layer: PerpetualHierarchyLayer) {
  const direction = layer.direction === "bullish" ? 1 : layer.direction === "bearish" ? -1 : 0;
  if (layer.status === "aligned") return direction * layer.strength;
  if (layer.status === "provisional") return direction * layer.strength * 0.5;
  return 0;
}

export function buildHierarchicalPerpetualDecision(
  states: QualifiedMssState[]
): HierarchicalPerpetualDecision {
  const byTimeframe = new Map(states.map((state) => [state.timeframe, state]));
  const layers = layerDefinitions.map((definition) => buildLayer(definition, byTimeframe)) as [
    PerpetualHierarchyLayer,
    PerpetualHierarchyLayer,
    PerpetualHierarchyLayer
  ];
  const [macro, current, reactionLayer] = layers;
  const directionalMacro = macro.status === "aligned" && (macro.direction === "bullish" || macro.direction === "bearish");
  const directionalCurrent = current.status === "aligned" && (current.direction === "bullish" || current.direction === "bearish");
  const finalDirection: QualifiedStructureDirection = directionalMacro && directionalCurrent && macro.direction === current.direction
    ? macro.direction as QualifiedStructureDirection
    : "unknown";

  let conflict: HierarchicalPerpetualDecision["conflict"] = "none";
  if (macro.status === "mixed") conflict = "macro";
  else if (current.status === "mixed") conflict = "current";
  else if (directionalMacro && directionalCurrent && macro.direction !== current.direction) conflict = "macro_current";
  else if (!directionalMacro || !directionalCurrent) conflict = "insufficient";

  const reaction = reactionLayer.status !== "aligned" || finalDirection === "unknown"
    ? reactionLayer.status === "unknown" || reactionLayer.status === "provisional" ? "unavailable" : "mixed"
    : reactionLayer.direction === finalDirection ? "confirming" : "rejecting";
  const normalizedScore = (
    layerValue(macro) * 0.5 +
    layerValue(current) * 0.35 +
    layerValue(reactionLayer) * 0.15
  );
  const known = perpetualStructureTimeframes.filter((timeframe) => {
    const state = byTimeframe.get(timeframe);
    return state?.integrity === "ready" && state.known;
  }).length;

  return {
    contractVersion: "perpetual-hierarchy-v1",
    historyMode: "bounded-replay",
    coverage: { known, total: 6 },
    normalizedScore: Number(normalizedScore.toFixed(4)),
    finalDirection,
    conflict,
    reaction,
    layers
  };
}
