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
import { buildPass2550ConsumedLedgerDownloadHistoryRebalance } from "@/lib/market-integrity/consumed-ledger-download-history-rebalance";
import { buildPass2551SupportResendRotationAckRebalance } from "@/lib/market-integrity/support-resend-rotation-ack-rebalance";
import { buildPass2552MobileAccountVaultResendReviewPanelRebalance } from "@/lib/market-integrity/mobile-account-vault-resend-review-panel-rebalance";
import { buildPass2553StreamCloseResendPersistenceRebalance } from "@/lib/market-integrity/stream-close-resend-persistence-rebalance";
import { buildPass2554RefundDisputeEvidenceDualControlRebalance } from "@/lib/market-integrity/refund-dispute-evidence-dual-control-rebalance";
import { buildPass2555EvidenceRetentionExpirySupportBoundaryRebalance } from "@/lib/market-integrity/evidence-retention-expiry-support-boundary-rebalance";
import { buildPass2556PurgeJobReceiptAppealReopenRebalance } from "@/lib/market-integrity/purge-job-receipt-appeal-reopen-rebalance";
import { buildPass2557ScheduledPurgeWorkerLegalHoldDsarErasureRebalance } from "@/lib/market-integrity/scheduled-purge-worker-legal-hold-dsar-erasure-rebalance";

export const dynamic = "force-dynamic";

export function GET(request: Request) {
  const url = new URL(request.url);
  const query = url.searchParams.get("query") || "btc";
  const symbol = url.searchParams.get("symbol") || undefined;
  const requestedSupportCaseId = url.searchParams.get("supportCaseId") || undefined;
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
  const pass2550 = buildPass2550ConsumedLedgerDownloadHistoryRebalance({ query, symbol, pass2549 });
  const pass2551 = buildPass2551SupportResendRotationAckRebalance({ query, symbol, pass2550 });
  const pass2552 = buildPass2552MobileAccountVaultResendReviewPanelRebalance({ query, symbol, pass2551 });
  const pass2553 = buildPass2553StreamCloseResendPersistenceRebalance({ query, symbol, pass2552 });
  const pass2554 = buildPass2554RefundDisputeEvidenceDualControlRebalance({ query, symbol, pass2553 });
  const pass2555 = buildPass2555EvidenceRetentionExpirySupportBoundaryRebalance({ query, symbol, pass2554 });
  const pass2556 = buildPass2556PurgeJobReceiptAppealReopenRebalance({ query, symbol, pass2555 });
  const pass2557 = buildPass2557ScheduledPurgeWorkerLegalHoldDsarErasureRebalance({ query, symbol, pass2556 });
  const selectedGuard = pass2557.scheduledPurgeReleaseGuards.find((item) => !requestedSupportCaseId || item.supportCaseId === requestedSupportCaseId) ?? pass2557.scheduledPurgeReleaseGuards[0];

  return NextResponse.json({
    ok: selectedGuard?.customerSafeCompletionVisible ?? false,
    pass: "2557",
    selectedGuard,
    scheduledPurgeWorkerLegalHoldDsarErasureRebalance: pass2557,
    scheduledPurgeWorkerRuns: pass2557.scheduledPurgeWorkerRuns,
    legalHoldDsarGates: pass2557.legalHoldDsarGates,
    providerErasureWebhookReceipts: pass2557.providerErasureWebhookReceipts,
    angelScheduledWorkerBoundaries: pass2557.angelScheduledWorkerBoundaries,
    scheduledPurgeReleaseGuards: pass2557.scheduledPurgeReleaseGuards,
    previousPassPurgeRule: pass2556.releaseEquation,
    releaseEquation: pass2557.releaseEquation,
  }, { status: selectedGuard?.statusCode ?? 200 });
}
