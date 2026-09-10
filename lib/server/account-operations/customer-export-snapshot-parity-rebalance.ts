import { NextResponse } from "next/server";
import { buildPass2537DurableReceiptStoreRebalance } from "@/lib/market-integrity/durable-receipt-store-rebalance";
import { buildPass2538CustomerExportRedactionReplayGateRebalance } from "@/lib/market-integrity/customer-export-redaction-replay-gate-rebalance";
import { buildPass2539AccountVaultTimelineExportCapsuleRebalance } from "@/lib/market-integrity/account-vault-timeline-export-capsule-rebalance";
import { buildPass2540CustomerExportZeroLeakReplayRebalance } from "@/lib/market-integrity/customer-export-zero-leak-replay-rebalance";
import { buildPass2541CustomerExportSnapshotParityRebalance, scanPass2541CustomerCopyForBlockedTokens } from "@/lib/market-integrity/customer-export-snapshot-parity-rebalance";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const query = url.searchParams.get("query") || url.searchParams.get("symbol") || "VELMERE_SNAPSHOT_PARITY";
  const symbol = url.searchParams.get("symbol") || undefined;
  const pass2537 = buildPass2537DurableReceiptStoreRebalance({ query, symbol });
  const pass2538 = buildPass2538CustomerExportRedactionReplayGateRebalance({ query, symbol, pass2537 });
  const pass2539 = buildPass2539AccountVaultTimelineExportCapsuleRebalance({ query, symbol, pass2538 });
  const pass2540 = buildPass2540CustomerExportZeroLeakReplayRebalance({ query, symbol, pass2539 });
  const pass2541 = buildPass2541CustomerExportSnapshotParityRebalance({ query, symbol, pass2540 });
  const sampleCopyScan = scanPass2541CustomerCopyForBlockedTokens("Customer copy containing promptRaw and paymentProviderPayload must be blocked before export.");
  return NextResponse.json({
    ok: true,
    pass: "2541",
    customerExportSnapshotParityRebalance: pass2541,
    surfaceSnapshots: pass2541.surfaceSnapshots,
    parityGroups: pass2541.parityGroups,
    fixtures: pass2541.fixtures,
    sampleCopyScan,
    rule: pass2541.snapshotParityRule,
  });
}
