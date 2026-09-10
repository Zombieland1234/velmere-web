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
import { buildPass2558RlsSupportDashboardErasureReconciliationRebalance } from "@/lib/market-integrity/rls-support-dashboard-erasure-reconciliation-rebalance";
import { buildPass2559SupportDashboardActionRlsPolicyTestRebalance } from "@/lib/market-integrity/support-dashboard-action-rls-policy-test-rebalance";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const query = url.searchParams.get("query") || url.searchParams.get("receipt") || "VELMERE_CUSTOMER_EXPORT_DOWNLOAD";
  const symbol = url.searchParams.get("symbol") || url.searchParams.get("receipt") || undefined;
  const requestedCaseId = url.searchParams.get("caseId") || undefined;

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
  const pass2558 = buildPass2558RlsSupportDashboardErasureReconciliationRebalance({ query, symbol, pass2557 });
  const pass2559 = buildPass2559SupportDashboardActionRlsPolicyTestRebalance({ query, symbol, pass2558 });
  const guard = pass2544.downloadRouteGuards.find((item) => !requestedCaseId || item.caseId === requestedCaseId) ?? pass2544.downloadRouteGuards[0];
  const streamGuard = pass2545.physicalStreamGuards.find((item) => !requestedCaseId || item.caseId === requestedCaseId) ?? pass2545.physicalStreamGuards[0];
  const releaseGuard = pass2546.downloadReleaseGuards.find((item) => !requestedCaseId || item.caseId === requestedCaseId) ?? pass2546.downloadReleaseGuards[0];
  const noticeGuard = pass2547.downloadNoticeGuards.find((item) => !requestedCaseId || item.caseId === requestedCaseId) ?? pass2547.downloadNoticeGuards[0];
  const streamTokenGuard = pass2548.downloadStreamTokenGuards.find((item) => !requestedCaseId || item.caseId === requestedCaseId) ?? pass2548.downloadStreamTokenGuards[0];
  const consumptionGuard = pass2549.downloadConsumptionGuards.find((item) => !requestedCaseId || item.caseId === requestedCaseId) ?? pass2549.downloadConsumptionGuards[0];
  const finalConsumedGuard = pass2550.finalConsumedDownloadGuards.find((item) => !requestedCaseId || item.caseId === requestedCaseId) ?? pass2550.finalConsumedDownloadGuards[0];
  const supportResendGuard = pass2551.supportResendGuards.find((item) => !requestedCaseId || item.caseId === requestedCaseId) ?? pass2551.supportResendGuards[0];
  const mobilePanelGuard = pass2552.supportCtaGuards.find((item) => !requestedCaseId || item.supportCaseId === supportResendGuard?.supportCaseId) ?? pass2552.supportCtaGuards[0];
  const streamCloseGuard = pass2553.downloadStreamReleaseGuards.find((item) => !requestedCaseId || item.supportCaseId === supportResendGuard?.supportCaseId) ?? pass2553.downloadStreamReleaseGuards[0];
  const refundDisputeGuard = pass2554.refundDisputeReleaseGuards.find((item) => !requestedCaseId || item.supportCaseId === supportResendGuard?.supportCaseId) ?? pass2554.refundDisputeReleaseGuards[0];
  const retentionExpiryGuard = pass2555.retentionExpiryReleaseGuards.find((item) => !requestedCaseId || item.supportCaseId === supportResendGuard?.supportCaseId) ?? pass2555.retentionExpiryReleaseGuards[0];
  const purgeReleaseGuard = pass2556.purgeReleaseGuards.find((item) => !requestedCaseId || item.supportCaseId === supportResendGuard?.supportCaseId) ?? pass2556.purgeReleaseGuards[0];
  const scheduledPurgeGuard = pass2557.scheduledPurgeReleaseGuards.find((item) => !requestedCaseId || item.supportCaseId === supportResendGuard?.supportCaseId) ?? pass2557.scheduledPurgeReleaseGuards[0];
  const rlsSupportDashboardGuard = pass2558.rlsSupportDashboardReleaseGuards.find((item) => !requestedCaseId || item.supportCaseId === supportResendGuard?.supportCaseId) ?? pass2558.rlsSupportDashboardReleaseGuards[0];
  const supportActionGuard = pass2559.supportDashboardActionReleaseGuards.find((item) => !requestedCaseId || item.supportCaseId === supportResendGuard?.supportCaseId) ?? pass2559.supportDashboardActionReleaseGuards[0];

  if (!guard || !noticeGuard || !releaseGuard?.customerReleaseAllowed || !noticeGuard.downloadAllowedAfterNotice || !streamTokenGuard?.downloadAllowedWithToken || !consumptionGuard?.streamMayStart || !finalConsumedGuard?.customerCanSeeDownloadHistory || !supportResendGuard?.accountInboxOnly || (!supportResendGuard.supportMayIssueResend && !supportResendGuard.refundMayOpenReview) || !mobilePanelGuard || !streamCloseGuard?.contentDispositionAllowed || !refundDisputeGuard?.refundDisputeReleaseAllowed || !retentionExpiryGuard?.evidenceRetentionReleaseAllowed || !purgeReleaseGuard?.purgeStatusVisibleToCustomer || !scheduledPurgeGuard?.customerSafeCompletionVisible || !rlsSupportDashboardGuard?.supportDashboardVisible || !rlsSupportDashboardGuard?.rlsPoliciesReady || !rlsSupportDashboardGuard?.noRawDashboardLeak || !supportActionGuard?.supportActionVisible || !supportActionGuard?.customerTimelineVisible || !supportActionGuard?.noRawActionLeak || (!streamGuard?.streamAllowed && !releaseGuard.replacementPublishAllowed)) {
    return NextResponse.json({
      ok: false,
      pass: "2559",
      error: "customer_export_download_blocked_by_support_dashboard_action_rls_policy_test_gate",
      previousPassSupportDashboardActionError: "customer_export_download_blocked_by_support_dashboard_action_rls_policy_test_gate",
      previousPassRlsSupportDashboardCompat: { pass: "2558" },
      previousPassRlsSupportDashboardError: "customer_export_download_blocked_by_rls_support_dashboard_erasure_reconciliation_gate",
      previousPassScheduledPurgeCompat: { pass: "2557" },
      previousPassScheduledPurgeWorkerError: "customer_export_download_blocked_by_scheduled_purge_worker_legal_hold_dsar_erasure_gate",
      previousPassPurgeCompat: { pass: "2556" },
      previousPassPurgeError: "customer_export_download_blocked_by_purge_job_receipt_appeal_reopen_gate",
      supportDashboardActionGuard: supportActionGuard,
      supportDashboardActionCompat: { pass: "2559" },
      evidenceRetentionCompat: { pass: "2555" },
      previousPassEvidenceRetentionError: "customer_export_download_blocked_by_evidence_retention_expiry_support_boundary_gate",
      refundDisputeCompat: { pass: "2554" },
      previousPassRefundDisputeError: "customer_export_download_blocked_by_refund_dispute_evidence_dual_control_gate",
      previousPassSupportResendRotationAckError: "customer_export_download_blocked_by_support_resend_rotation_ack_gate",
      previousPassConsumedLedgerError: "customer_export_download_blocked_by_consumed_ledger_download_history_gate",
      previousPassConsumptionError: "customer_export_download_blocked_by_download_consumption_replay_abuse_gate",
      previousPassStreamTokenError: "customer_export_download_blocked_by_one_time_stream_token_inbox_delivery_gate",
      previousPassNoticeError: "customer_export_download_blocked_by_customer_notice_delivery_appeal_window_gate",
      previousPassReleaseError: "customer_export_download_blocked_by_operator_dual_control_replacement_publish_gate",
      previousPassStreamError: "customer_export_download_blocked_by_support_replay_persistence_stream_gate",
      previousPassCompatError: "customer_export_download_blocked_by_recall_resolution_support_replay",
      resolutionState: guard?.state ?? "blocked",
      decision: guard?.decision ?? "block_customer_download",
      supportCaseId: guard?.supportCaseId ?? "missing-support-case",
      replayRunId: guard?.replayRunId ?? "missing-replay-run",
      customerSafeResolutionHash: guard?.customerSafeResolutionHash ?? "missing-customer-safe-resolution-hash",
      recallChainHash: guard?.recallChainHash ?? "missing-recall-chain-hash",
      streamState: streamGuard?.state ?? "blocked",
      streamDecision: streamGuard?.decision ?? "block_stream",
      durableStoreId: streamGuard?.durableStoreId ?? "missing-durable-store",
      idempotencyKey: streamGuard?.idempotencyKey ?? "missing-idempotency-key",
      persistenceChainHash: streamGuard?.persistenceChainHash ?? "missing-persistence-chain-hash",
      releaseState: releaseGuard?.state ?? "blocked",
      releaseDecision: releaseGuard?.decision ?? "block_release",
      approvalChainHash: releaseGuard?.approvalChainHash ?? "missing-approval-chain-hash",
      customerNoticeHash: releaseGuard?.customerNoticeHash ?? "missing-customer-notice-hash",
      replacementPublishAllowed: releaseGuard?.replacementPublishAllowed ?? false,
      noticeState: noticeGuard?.state ?? "blocked",
      noticeDecision: noticeGuard?.decision ?? "block_release",
      noticeDeliveryId: noticeGuard?.noticeDeliveryId ?? "missing-notice-delivery",
      noticeDeliveryReceiptHash: noticeGuard?.noticeDeliveryReceiptHash ?? "missing-notice-delivery-receipt-hash",
      customerAcknowledgementHash: noticeGuard?.customerAcknowledgementHash ?? "missing-customer-acknowledgement-hash",
      appealWindowState: noticeGuard?.appealWindowState ?? "blocked",
      appealWindowId: noticeGuard?.appealWindowId ?? "missing-appeal-window",
      streamTokenState: streamTokenGuard?.state ?? "blocked",
      streamTokenDecision: streamTokenGuard?.decision ?? "block_release",
      tokenState: streamTokenGuard?.tokenState ?? "blocked",
      contentStreamTokenId: streamTokenGuard?.contentStreamTokenId ?? "missing-one-time-stream-token",
      oneTimeStreamTokenHash: streamTokenGuard?.oneTimeStreamTokenHash ?? "missing-one-time-stream-token-hash",
      inboxDeliveryReceiptHash: streamTokenGuard?.inboxDeliveryReceiptHash ?? "missing-inbox-delivery-receipt-hash",
      resendCooldownState: streamTokenGuard?.resendCooldownState ?? "blocked",
      emailBounceState: streamTokenGuard?.emailBounceState ?? "unknown",
      previousPassStreamRule: pass2545.persistenceRule,
      previousPassReleaseRule: pass2546.operatorDualControlRule,
      previousPassNoticeRule: pass2547.customerNoticeDeliveryRule,
      previousPassStreamTokenRule: pass2548.oneTimeStreamTokenRule,
      consumptionState: consumptionGuard?.state ?? "blocked",
      consumptionDecision: consumptionGuard?.decision ?? "block_stream",
      ledgerState: consumptionGuard?.ledgerState ?? "blocked",
      firstByteLedgerEventId: consumptionGuard?.firstByteLedgerEventId ?? "missing-first-byte-ledger-event",
      firstByteLedgerHash: consumptionGuard?.firstByteLedgerHash ?? "missing-first-byte-ledger-hash",
      tokenReplayCount: consumptionGuard?.tokenReplayCount ?? -1,
      streamMayStart: consumptionGuard?.streamMayStart ?? false,
      previousPassConsumptionRule: pass2549.downloadConsumptionRule,
      finalConsumedState: finalConsumedGuard?.state ?? "blocked",
      finalConsumedDecision: finalConsumedGuard?.decision ?? "block_history",
      consumedLedgerEventId: finalConsumedGuard?.consumedLedgerEventId ?? "missing-consumed-ledger-event",
      consumedLedgerHash: finalConsumedGuard?.consumedLedgerHash ?? "missing-consumed-ledger-hash",
      customerVisibleHistoryHash: finalConsumedGuard?.customerVisibleHistoryHash ?? "missing-customer-visible-history-hash",
      reDownloadState: finalConsumedGuard?.reDownloadState ?? "blocked",
      canReDownloadWithoutSupport: finalConsumedGuard?.canReDownloadWithoutSupport ?? false,
      noRawDeviceLeakScore: finalConsumedGuard?.noRawDeviceLeakScore ?? 0,
      supportResendState: supportResendGuard?.state ?? "blocked",
      supportResendDecision: supportResendGuard?.decision ?? "block_resend",
      supportResendRequestId: supportResendGuard?.supportResendRequestId ?? "missing-support-resend-request",
      rotatedResendTokenHash: supportResendGuard?.rotatedResendTokenHash ?? "missing-rotated-resend-token-hash",
      customerResendAckHash: supportResendGuard?.customerResendAckHash ?? "missing-customer-resend-ack-hash",
      refundPolicySnapshotHash: supportResendGuard?.refundPolicySnapshotHash ?? "missing-refund-policy-snapshot-hash",
      supportMayIssueResend: supportResendGuard?.supportMayIssueResend ?? false,
      refundMayOpenReview: supportResendGuard?.refundMayOpenReview ?? false,
      previousPassSupportResendRule: pass2551.supportResendRule,
      mobilePanelState: mobilePanelGuard?.blockedReason ?? "missing-mobile-panel-guard",
      streamCloseState: streamCloseGuard?.state ?? "blocked",
      streamCloseDecision: streamCloseGuard?.decision ?? "block_download",
      streamCloseHookId: streamCloseGuard?.streamCloseHookId ?? "missing-stream-close-hook",
      responseCloseEventId: streamCloseGuard?.responseCloseEventId ?? "missing-response-close-event",
      routeOpenOnlyBlocked: streamCloseGuard?.routeOpenOnlyBlocked ?? true,
      consumedLedgerAppendAllowed: streamCloseGuard?.consumedLedgerAppendAllowed ?? false,
      resendQueuePersistenceState: streamCloseGuard?.resendQueuePersistenceState ?? "blocked",
      idempotencyLockState: streamCloseGuard?.idempotencyLockState ?? "blocked",
      previousPassStreamCloseRule: pass2553.releaseEquation,
      refundDisputeState: refundDisputeGuard?.evidenceState ?? "blocked",
      refundDisputeDecision: refundDisputeGuard?.decision ?? "block_refund_dispute_copy",
      customerSafeEvidencePackId: refundDisputeGuard?.customerSafeEvidencePackId ?? "missing-customer-safe-evidence-pack",
      supportSlaClockId: refundDisputeGuard?.supportSlaClockId ?? "missing-support-sla-clock",
      dualControlState: refundDisputeGuard?.dualControlState ?? "blocked",
      currentPassRefundDisputeRule: pass2554.releaseEquation,
      retentionState: retentionExpiryGuard?.retentionState ?? "blocked",
      retentionDecision: retentionExpiryGuard?.decision ?? "block_support_status",
      retentionEnvelopeHash: retentionExpiryGuard?.retentionEnvelopeHash ?? "missing-retention-envelope-hash",
      retentionPolicySnapshotHash: retentionExpiryGuard?.retentionPolicySnapshotHash ?? "missing-retention-policy-snapshot-hash",
      secondApproverReceiptHash: retentionExpiryGuard?.secondApproverReceiptHash ?? "missing-second-approver-receipt-hash",
      customerTimelineId: retentionExpiryGuard?.customerTimelineId ?? "missing-customer-timeline",
      currentPassEvidenceRetentionRule: pass2555.releaseEquation,
      purgeState: purgeReleaseGuard?.purgeState ?? "blocked",
      purgeDecision: purgeReleaseGuard?.decision ?? "block_purge_status",
      purgeJobReceiptHash: purgeReleaseGuard?.purgeJobReceiptHash ?? "missing-purge-job-receipt-hash",
      purgeDryRunHash: purgeReleaseGuard?.purgeDryRunHash ?? "missing-purge-dry-run-hash",
      customerDeletionTimelineId: purgeReleaseGuard?.customerDeletionTimelineId ?? "missing-customer-deletion-timeline",
      purgeAppealWindowId: purgeReleaseGuard?.appealWindowId ?? "missing-appeal-window",
      appealReopenState: purgeReleaseGuard?.appealReopenState ?? "blocked",
      rlsAccountBindingHash: purgeReleaseGuard?.rlsAccountBindingHash ?? "missing-rls-account-binding-hash",
      currentPassPurgeRule: pass2556.releaseEquation,
      scheduledWorkerState: scheduledPurgeGuard?.scheduledWorkerState ?? "blocked",
      scheduledPurgeDecision: scheduledPurgeGuard?.decision ?? "block_worker_status",
      scheduledPurgeWorkerRunId: scheduledPurgeGuard?.workerRunId ?? "missing-worker-run",
      workerDryRunReceiptHash: scheduledPurgeGuard?.workerDryRunReceiptHash ?? "missing-worker-dry-run-receipt-hash",
      retryBackoffReceiptHash: scheduledPurgeGuard?.retryBackoffReceiptHash ?? "missing-retry-backoff-receipt-hash",
      deadLetterQueueId: scheduledPurgeGuard?.deadLetterQueueId ?? "missing-dead-letter-queue",
      legalHoldState: scheduledPurgeGuard?.legalHoldState ?? "blocked",
      dsarErasureRequestHash: scheduledPurgeGuard?.dsarErasureRequestHash ?? "missing-dsar-erasure-request-hash",
      providerErasureWebhookState: scheduledPurgeGuard?.providerWebhookState ?? "blocked",
      providerErasureWebhookHash: scheduledPurgeGuard?.providerErasureWebhookHash ?? "missing-provider-erasure-webhook-hash",
      customerCompletionNoticeHash: scheduledPurgeGuard?.customerCompletionNoticeHash ?? "missing-customer-completion-notice-hash",
      currentPassScheduledWorkerRule: pass2557.releaseEquation,
      rlsDashboardState: rlsSupportDashboardGuard?.dashboardState ?? "blocked",
      providerReconciliationState: rlsSupportDashboardGuard?.reconciliationState ?? "blocked",
      rlsSchemaHash: rlsSupportDashboardGuard?.rlsSchemaHash ?? "missing-rls-schema-hash",
      providerAckReconciliationHash: rlsSupportDashboardGuard?.providerAckReconciliationHash ?? "missing-provider-ack-reconciliation-hash",
      operatorAuditEventHash: rlsSupportDashboardGuard?.operatorAuditEventHash ?? "missing-operator-audit-event-hash",
      currentPassRlsSupportDashboardRule: pass2558.releaseEquation,
      supportDashboardActionState: supportActionGuard?.actionState ?? "blocked",
      rlsPolicyTestState: supportActionGuard?.rlsPolicyTestState ?? "blocked",
      customerDsarTimelineState: supportActionGuard?.customerDsarTimelineState ?? "blocked",
      providerRetryAttemptBucket: supportActionGuard?.providerRetryAttemptBucket ?? "blocked",
      supportActionReceiptHash: supportActionGuard?.actionReceiptHash ?? "missing-support-action-receipt-hash",
      rlsPolicyFixtureHash: supportActionGuard?.rlsPolicyFixtureHash ?? "missing-rls-policy-fixture-hash",
      providerRetryReceiptHash: supportActionGuard?.providerRetryReceiptHash ?? "missing-provider-retry-receipt-hash",
      deadLetterReplayHash: supportActionGuard?.deadLetterReplayHash ?? "missing-dead-letter-replay-hash",
      customerDsarTimelineHash: supportActionGuard?.customerDsarTimelineHash ?? "missing-customer-dsar-timeline-hash",
      currentPassSupportDashboardActionRule: pass2559.releaseEquation,
      rule: pass2559.releaseEquation,
    }, { status: supportActionGuard?.statusCode ?? scheduledPurgeGuard?.statusCode ?? purgeReleaseGuard?.statusCode ?? retentionExpiryGuard?.statusCode ?? refundDisputeGuard?.statusCode ?? finalConsumedGuard?.statusCode ?? consumptionGuard?.statusCode ?? streamTokenGuard?.statusCode ?? noticeGuard?.statusCode ?? releaseGuard?.statusCode ?? streamGuard?.statusCode ?? 423 });
  }

  return NextResponse.json({
    ok: true,
    pass: "2559",
    mode: finalConsumedGuard.decision === "show_download_history_card" ? "customer_export_download_consumed_ledger_history_guard_passed" : "customer_export_download_final_guard_passed",
    supportDashboardActionGuard: supportActionGuard,
    supportDashboardActionCompat: { pass: "2559" },
    evidenceRetentionCompat: { pass: "2555" },
    refundDisputeCompat: { pass: "2554" },
    guard,
    streamGuard,
    releaseGuard,
    noticeGuard,
    streamTokenGuard,
    consumptionGuard,
    finalConsumedGuard,
    supportResendGuard,
    mobilePanelGuard,
    streamCloseGuard,
    refundDisputeGuard,
    retentionExpiryGuard,
    purgeReleaseGuard,
    scheduledPurgeGuard,
    rlsSupportDashboardGuard,
    customerSafeResolutionHash: guard.customerSafeResolutionHash,
    persistenceChainHash: streamGuard?.persistenceChainHash,
    approvalChainHash: releaseGuard.approvalChainHash,
    customerNoticeHash: releaseGuard.customerNoticeHash,
    contentStreamToken: streamTokenGuard.contentStreamTokenId ?? releaseGuard.contentStreamToken,
    oneTimeStreamTokenHash: streamTokenGuard.oneTimeStreamTokenHash,
    inboxDeliveryReceiptHash: streamTokenGuard.inboxDeliveryReceiptHash,
    firstByteLedgerEventId: consumptionGuard.firstByteLedgerEventId,
    firstByteLedgerHash: consumptionGuard.firstByteLedgerHash,
    ledgerState: consumptionGuard.ledgerState,
    replayCounterState: consumptionGuard.replayCounterState,
    tokenReplayCount: consumptionGuard.tokenReplayCount,
    replacementPublishToken: releaseGuard.replacementPublishToken,
    noticeDeliveryId: noticeGuard.noticeDeliveryId,
    noticeDeliveryReceiptHash: noticeGuard.noticeDeliveryReceiptHash,
    customerAcknowledgementHash: noticeGuard.customerAcknowledgementHash,
    appealWindowState: noticeGuard.appealWindowState,
    consumedLedgerEventId: finalConsumedGuard.consumedLedgerEventId,
    consumedLedgerHash: finalConsumedGuard.consumedLedgerHash,
    customerVisibleHistoryHash: finalConsumedGuard.customerVisibleHistoryHash,
    reDownloadState: finalConsumedGuard.reDownloadState,
    finalDownloadCompleted: finalConsumedGuard.finalDownloadCompleted,
    customerCanSeeDownloadHistory: finalConsumedGuard.customerCanSeeDownloadHistory,
    supportResendRequestId: supportResendGuard.supportResendRequestId,
    rotatedResendTokenHash: supportResendGuard.rotatedResendTokenHash,
    customerResendAckHash: supportResendGuard.customerResendAckHash,
    refundPolicySnapshotHash: supportResendGuard.refundPolicySnapshotHash,
    streamCloseHookId: streamCloseGuard.streamCloseHookId,
    responseCloseEventId: streamCloseGuard.responseCloseEventId,
    consumedLedgerAppendAllowed: streamCloseGuard.consumedLedgerAppendAllowed,
    resendQueuePersistenceState: streamCloseGuard.resendQueuePersistenceState,
    idempotencyLockState: streamCloseGuard.idempotencyLockState,
    routeOpenOnlyBlocked: streamCloseGuard.routeOpenOnlyBlocked,
    customerSafeEvidencePackId: refundDisputeGuard.customerSafeEvidencePackId,
    supportSlaClockId: refundDisputeGuard.supportSlaClockId,
    dualControlState: refundDisputeGuard.dualControlState,
    refundDisputeReleaseAllowed: refundDisputeGuard.refundDisputeReleaseAllowed,
    retentionState: retentionExpiryGuard.retentionState,
    retentionDecision: retentionExpiryGuard.decision,
    retentionEnvelopeHash: retentionExpiryGuard.retentionEnvelopeHash,
    retentionPolicySnapshotHash: retentionExpiryGuard.retentionPolicySnapshotHash,
    secondApproverReceiptHash: retentionExpiryGuard.secondApproverReceiptHash,
    customerTimelineId: retentionExpiryGuard.customerTimelineId,
    evidenceRetentionReleaseAllowed: retentionExpiryGuard.evidenceRetentionReleaseAllowed && purgeReleaseGuard.purgeStatusVisibleToCustomer,
    purgeState: purgeReleaseGuard.purgeState,
    purgeDecision: purgeReleaseGuard.decision,
    purgeJobReceiptHash: purgeReleaseGuard.purgeJobReceiptHash,
    purgeDryRunHash: purgeReleaseGuard.purgeDryRunHash,
    customerDeletionTimelineId: purgeReleaseGuard.customerDeletionTimelineId,
    customerDeletionTimelineHash: purgeReleaseGuard.customerDeletionTimelineHash,
    appealWindowId: purgeReleaseGuard.appealWindowId,
    appealReopenState: purgeReleaseGuard.appealReopenState,
    rlsAccountBindingHash: purgeReleaseGuard.rlsAccountBindingHash,
    purgeStatusVisibleToCustomer: purgeReleaseGuard.purgeStatusVisibleToCustomer,
    purgeMutationAllowed: purgeReleaseGuard.purgeMutationAllowed,
    scheduledWorkerState: scheduledPurgeGuard.scheduledWorkerState,
    scheduledPurgeDecision: scheduledPurgeGuard.decision,
    scheduledPurgeWorkerRunId: scheduledPurgeGuard.workerRunId,
    workerDryRunReceiptHash: scheduledPurgeGuard.workerDryRunReceiptHash,
    retryBackoffReceiptHash: scheduledPurgeGuard.retryBackoffReceiptHash,
    deadLetterQueueId: scheduledPurgeGuard.deadLetterQueueId,
    legalHoldState: scheduledPurgeGuard.legalHoldState,
    dsarErasureRequestHash: scheduledPurgeGuard.dsarErasureRequestHash,
    providerErasureWebhookState: scheduledPurgeGuard.providerWebhookState,
    providerErasureWebhookHash: scheduledPurgeGuard.providerErasureWebhookHash,
    customerCompletionNoticeHash: scheduledPurgeGuard.customerCompletionNoticeHash,
    scheduledPurgeCustomerSafeCompletionVisible: scheduledPurgeGuard.customerSafeCompletionVisible,
    scheduledPurgeWorkerMutationAllowed: scheduledPurgeGuard.workerMutationAllowed,
    rlsDashboardState: rlsSupportDashboardGuard.dashboardState,
    providerReconciliationState: rlsSupportDashboardGuard.reconciliationState,
    rlsSchemaHash: rlsSupportDashboardGuard.rlsSchemaHash,
    providerAckReconciliationHash: rlsSupportDashboardGuard.providerAckReconciliationHash,
    operatorAuditEventHash: rlsSupportDashboardGuard.operatorAuditEventHash,
    supportDashboardVisible: rlsSupportDashboardGuard.supportDashboardVisible,
    noRawDashboardLeak: rlsSupportDashboardGuard.noRawDashboardLeak,
    contentDispositionReady: streamTokenGuard.downloadAllowedWithToken && consumptionGuard.streamMayStart && finalConsumedGuard.customerCanSeeDownloadHistory && supportResendGuard.accountInboxOnly && mobilePanelGuard.ctaVisible && streamCloseGuard.contentDispositionAllowed && refundDisputeGuard.refundDisputeReleaseAllowed && retentionExpiryGuard.evidenceRetentionReleaseAllowed && purgeReleaseGuard.purgeStatusVisibleToCustomer && scheduledPurgeGuard.customerSafeCompletionVisible && rlsSupportDashboardGuard.supportDashboardVisible && rlsSupportDashboardGuard.noRawDashboardLeak,
  });
}
