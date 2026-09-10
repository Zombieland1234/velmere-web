import { NextResponse } from "next/server";
import { buildPass2537DurableReceiptStoreRebalance } from "@/lib/market-integrity/durable-receipt-store-rebalance";
import { buildPass2538CustomerExportRedactionReplayGateRebalance } from "@/lib/market-integrity/customer-export-redaction-replay-gate-rebalance";
import { buildPass2539AccountVaultTimelineExportCapsuleRebalance } from "@/lib/market-integrity/account-vault-timeline-export-capsule-rebalance";
import { buildPass2540CustomerExportZeroLeakReplayRebalance } from "@/lib/market-integrity/customer-export-zero-leak-replay-rebalance";
import { buildPass2541CustomerExportSnapshotParityRebalance } from "@/lib/market-integrity/customer-export-snapshot-parity-rebalance";
import { buildPass2542SnapshotReceiptPersistenceGateRebalance } from "@/lib/market-integrity/snapshot-receipt-persistence-gate-rebalance";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const query = url.searchParams.get("query") || url.searchParams.get("symbol") || "VELMERE_SNAPSHOT_RECEIPT_PERSISTENCE";
  const symbol = url.searchParams.get("symbol") || undefined;
  const pass2537 = buildPass2537DurableReceiptStoreRebalance({ query, symbol });
  const pass2538 = buildPass2538CustomerExportRedactionReplayGateRebalance({ query, symbol, pass2537 });
  const pass2539 = buildPass2539AccountVaultTimelineExportCapsuleRebalance({ query, symbol, pass2538 });
  const pass2540 = buildPass2540CustomerExportZeroLeakReplayRebalance({ query, symbol, pass2539 });
  const pass2541 = buildPass2541CustomerExportSnapshotParityRebalance({ query, symbol, pass2540 });
  const pass2542 = buildPass2542SnapshotReceiptPersistenceGateRebalance({ query, symbol, pass2541 });
  return NextResponse.json({
    ok: true,
    pass: "2542",
    snapshotReceiptPersistenceGateRebalance: pass2542,
    persistedReceipts: pass2542.persistedReceipts,
    ledgerEvents: pass2542.ledgerEvents,
    fixtures: pass2542.fixtures,
    rule: pass2542.persistenceRule,
  });
}
