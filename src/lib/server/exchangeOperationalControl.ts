import { ExchangeJournalConfigurationError } from "@/lib/server/exchangeJournalConfig";
import { isSupabaseAdminConfigured, supabaseAdminRest } from "@/lib/server/supabaseAdmin";

interface ExchangeFeatureControlRow {
  operations_enabled: boolean;
  reason: string;
  updated_at: string;
}

export interface ExchangeOperationalControl {
  operationsEnabled: boolean;
  reason: string;
  updatedAt: string | null;
}

const failClosedControl: ExchangeOperationalControl = {
  operationsEnabled: false,
  reason: "exchange_operations_control_unavailable",
  updatedAt: null
};

export async function readExchangeOperationalControl(): Promise<ExchangeOperationalControl> {
  if (!isSupabaseAdminConfigured()) return failClosedControl;
  try {
    const rows = await supabaseAdminRest<ExchangeFeatureControlRow[]>(
      "exchange_feature_control?select=operations_enabled,reason,updated_at&id=eq.true&limit=1",
      { timeoutMs: 2_500 }
    );
    const row = rows[0];
    if (!row) return failClosedControl;
    return {
      operationsEnabled: row.operations_enabled === true,
      reason: row.reason,
      updatedAt: row.updated_at
    };
  } catch {
    return failClosedControl;
  }
}

export async function assertExchangeOperationalControlEnabled() {
  const control = await readExchangeOperationalControl();
  if (!control.operationsEnabled) {
    throw new ExchangeJournalConfigurationError("exchange_operations_locked");
  }
  return control;
}
