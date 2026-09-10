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
import { buildPass2546OperatorDualControlReplacementPublishRebalance } from "@/lib/market-integrity/operator-dual-control-replacement-publish-rebalance";
import { buildPass2547CustomerNoticeDeliveryAppealWindowRebalance } from "@/lib/market-integrity/customer-notice-delivery-appeal-window-rebalance";
import { buildPass2548OneTimeStreamTokenInboxDeliveryRebalance } from "@/lib/market-integrity/one-time-stream-token-inbox-delivery-rebalance";
import { buildPass2549DownloadConsumptionReplayAbuseRebalance } from "@/lib/market-integrity/download-consumption-replay-abuse-rebalance";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const query = url.searchParams.get("query") || "VELMERE_PASS2549_DOWNLOAD_CONSUMPTION_REPLAY_ABUSE";
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
  const pass2546 = buildPass2546OperatorDualControlReplacementPublishRebalance({ query, symbol, pass2545 });
  const pass2547 = buildPass2547CustomerNoticeDeliveryAppealWindowRebalance({ query, symbol, pass2546 });
  const pass2548 = buildPass2548OneTimeStreamTokenInboxDeliveryRebalance({ query, symbol, pass2547 });
  const pass2549 = buildPass2549DownloadConsumptionReplayAbuseRebalance({ query, symbol, pass2548 });

  return NextResponse.json({
    ok: true,
    pass: "2549",
    query,
    symbol,
    downloadConsumptionReplayAbuseRebalance: pass2549,
    consumptionRecords: pass2549.consumptionRecords,
    downloadConsumptionGuards: pass2549.downloadConsumptionGuards,
    angelReplayAbuseBoundaries: pass2549.angelReplayAbuseBoundaries,
    replayAbuseEvents: pass2549.replayAbuseEvents,
    fixtures: pass2549.fixtures,
    semanticLanes: pass2549.semanticLanes,
    rule: pass2549.downloadConsumptionRule,
  });
}
