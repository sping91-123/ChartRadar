import type { PerpetualScenarioMonitor } from "./perpetualMonitor";
import { plainDecisionText, qualityLabel } from "./perpetualDecisionCopy";

export function monitorEvaluationStatus(monitor: PerpetualScenarioMonitor, now = Date.now()) {
  if (monitor.status !== "active") return { label: "검사 정지", detail: "다시 시작하기 전에는 조건을 검사하지 않습니다.", nextAt: null, delayed: false };
  if (Date.parse(monitor.expiresAt) <= now) return { label: "감시 기간 종료", detail: "최신 분석에서 새 감시 조건을 선택해 주세요.", nextAt: null, delayed: false };
  const checked = Date.parse(monitor.lastEvaluatedAt ?? "");
  if (!Number.isFinite(checked)) return { label: "첫 검사 대기", detail: "저장 후 최대 5분 간격으로 검사합니다. 아직 검사 결과가 없습니다.", nextAt: null, delayed: false };
  const delayed = now - checked > 7 * 60_000;
  if (delayed) return { label: "확인 지연", detail: "마지막 검사 이후 새 결과가 없습니다. 감시 상태를 다시 확인해 주세요.", nextAt: null, delayed: true };
  const nextAt = new Date(checked + 5 * 60_000).toISOString();
  const evaluation = monitor.lastEvaluation;
  if (!evaluation) return { label: "최근 검사 완료", detail: "검사한 분석의 상세 상태를 불러오지 못했습니다. 알림 발생 여부는 알림함에서 확인할 수 있습니다.", nextAt, delayed: false };
  if (evaluation.quality !== "ready") return { label: qualityLabel(evaluation.quality), detail: "정상 데이터가 모일 때까지 조건 충족 판단을 보류합니다.", nextAt, delayed: false };
  return { label: "조건 아직 미충족", detail: plainDecisionText(evaluation.headline), nextAt, delayed: false };
}
