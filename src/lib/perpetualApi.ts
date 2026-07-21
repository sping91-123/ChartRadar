import type { PerpetualDecisionSnapshot } from "@/lib/perpetualDecisionSnapshot";
import type { NewsDecisionContext } from "@/lib/newsImpact";
import type { PerpetualRevenueCoreMode } from "@/lib/server/perpetualRevenueCore";

export interface PerpetualSnapshotCapabilities {
  monitorLimit: number;
  activeMonitorCount: number;
  scenarioMonitorCount: number;
  presetCount: number;
  canSeeProDetail: boolean;
  monitorEnabled: boolean;
  canCreateMonitor: boolean;
  requiresAuth: boolean;
  setupRequired: boolean;
}

export interface PerpetualSnapshotResponse {
  snapshot?: PerpetualDecisionSnapshot;
  continuity?: {
    status: "same" | "refreshed" | "current";
    requestedSnapshotId?: string;
  };
  capabilities?: PerpetualSnapshotCapabilities;
  newsContext?: NewsDecisionContext | null;
  mode?: PerpetualRevenueCoreMode;
  error?: string;
}
