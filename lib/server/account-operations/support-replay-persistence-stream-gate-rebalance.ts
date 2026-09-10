import { NextResponse } from "next/server";
import { buildPass2537DurableReceiptStoreRebalance } from "@/lib/market-integrity/durable-receipt-store-rebalance";
import { buildPass2538CustomerExportRedactionReplayGateRebalance } from "@/lib/market-integrity/customer-export-redaction-replay-gate-rebalance";
import { buildPass2539AccountVaultTimelineExportCapsuleRebalance } from "@/lib/market-integrity/account-vault-timeline-export-capsule-rebalance";
import { buildPass2540CustomerExportZeroLeakReplayRebalance } from "@/lib/market-integrity/customer-export-zero-leak-replay-rebalance";
import { buildPass2541CustomerExportSnapshotParityRebalance } from "@/lib/market-integrity/customer-export-snapshot-parity-rebalance";
import { buildPass2542SnapshotReceiptPersistenceGateRebalance } from "@/lib/market-integrity/snapshot-receipt-persistence-gate-rebalance";
import { buildPass2543CustomerExportRecallAttestationRebalance } from "@/lib/market-integrity/customer-export-recall-attestation-rebalance";
import { buildPass2544RecallResolutionSupportReplayRebalance } from "@/lib/market-integrity/recall-resolution-support-replay-rebalance";
import { buildPass2545SupportReplayPersistenceStreamGateRebalance } from "@/lib/market-integrity/support-replay-persistence-stream-gate-rebalance";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const query = url.searchParams.get("query") || url.searchParams.get("symbol") || "VELMERE_SUPPORT_REPLAY_PERSISTENCE_STREAM";
  const symbol = url.searchParams.get("symbol") || undefined;
  const pass2537 = buildPass2537DurableReceiptStoreRebalance({ query, symbol });
  const pass2538 = buildPass2538CustomerExportRedactionReplayGateRebalance({ query, symbol, pass2537 });
  const pass2539 = buildPass2539AccountVaultTimelineExportCapsuleRebalance({ query, symbol, pass2538 });
  const pass2540 = buildPass2540CustomerExportZeroLeakReplayRebalance({ query, symbol, pass2539 });
  const pass2541 = buildPass2541CustomerExportSnapshotParityRebalance({ query, symbol, pass2540 });
  const pass2542 = buildPass2542SnapshotReceiptPersistenceGateRebalance({ query, symbol, pass2541 });
  const pass2543 = buildPass2543CustomerExportRecallAttestationRebalance({ query, symbol, pass2542 });
  const pass2544 = buildPass2544RecallResolutionSupportReplayRebalance({ query, symbol, pass2543 });
  const pass2545 = buildPass2545SupportReplayPersistenceStreamGateRebalance({ query, symbol, pass2544 });
  return NextResponse.json({
    ok: true,
    pass: "2545",
    supportReplayPersistenceStreamGateRebalance: pass2545,
    persistenceRecords: pass2545.persistenceRecords,
    physicalStreamGuards: pass2545.physicalStreamGuards,
    angelBoundaries: pass2545.angelBoundaries,
    fixtures: pass2545.fixtures,
    rule: pass2545.persistenceRule,
  });
}
