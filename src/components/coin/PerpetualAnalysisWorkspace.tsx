"use client";

import { type ReactNode, useState } from "react";
import { PerpetualAnalysisTabs } from "@/components/coin/PerpetualAnalysisTabs";
import { PerpetualEvidenceWorkbench } from "@/components/coin/PerpetualEvidenceWorkbench";
import { PerpetualTechnicalEvidencePanel } from "@/components/coin/PerpetualTechnicalEvidencePanel";
import type { PerpetualAnalysisPerspective } from "@/lib/perpetualAnalysisPerspective";
import type { PerpetualDecisionSnapshot } from "@/lib/perpetualDecisionSnapshot";

export function PerpetualAnalysisWorkspace({ snapshot, chart }: { snapshot: PerpetualDecisionSnapshot; chart: ReactNode }) {
  const [perspective, setPerspective] = useState<PerpetualAnalysisPerspective>("combined");

  return (
    <PerpetualAnalysisTabs value={perspective} onChange={setPerspective} between={chart}>
      {perspective === "combined" ? (
        <PerpetualEvidenceWorkbench snapshot={snapshot} mode="combined" />
      ) : perspective === "ict" ? (
        <PerpetualEvidenceWorkbench snapshot={snapshot} mode="ict" />
      ) : (
        <PerpetualTechnicalEvidencePanel snapshot={snapshot} />
      )}
    </PerpetualAnalysisTabs>
  );
}
