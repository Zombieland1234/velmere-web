import type { VelmereTier } from "@/lib/market-integrity/top1-risk-foundation";
import type { Pass2843CustomerExportOperatorReleaseReinstatementGate } from "@/lib/market-integrity/top1-customer-export-operator-release-reinstatement-gate";

export type Pass2844CustomerExportPostReinstatementAuditNotificationState =
  | "reinstatement_blocked"
  | "audit_packet_missing"
  | "operator_post_release_audit_missing"
  | "notification_dispatch_missing"
  | "notification_open_missing"
  | "channel_binding_missing"
  | "timeline_hash_missing"
  | "retention_snapshot_missing"
  | "payload_drift_blocked"
  | "notification_content_mismatch"
  | "post_reinstatement_ready";

export type Pass2844CustomerExportNotificationChannel =
  | "account_vault"
  | "email_notice"
  | "api_handoff"
  | "support_thread"
  | "multi_channel";

export type Pass2844CustomerExportPostReinstatementAuditNotificationGate = {
  schemaVersion: "pass2844_customer_export_post_reinstatement_audit_notification_gate_v1";
  surface: string;
  tier: VelmereTier;
  releasePacketId: string;
  sealId: string;
  generatedAt: string;
  postReinstatementState: Pass2844CustomerExportPostReinstatementAuditNotificationState;
  postReinstatementReadinessScore: number;
  notificationAuditEnvelope: {
    reinstatedExportAuditId: string | null;
    operatorPostReleaseAuditReceiptId: string | null;
    customerNotificationDispatchReceiptId: string | null;
    customerNotificationOpenReceiptId: string | null;
    customerNotificationContentHash: string | null;
    notificationChannel: Pass2844CustomerExportNotificationChannel;
    channelBindingReceiptId: string | null;
    customerAccountHash: string | null;
    payloadHashBound: string | null;
    sourceReceiptRootBound: string | null;
    deliveryAuditTimelineHash: string | null;
    reissuedExportLinkId: string | null;
    previousOperatorReleaseReceiptId: string | null;
    previousChannelReinstatementReceiptId: string | null;
    incidentNoConflictReceiptId: string | null;
    retentionSnapshotId: string | null;
  };
  postReinstatementPolicy: {
    canServeCustomerVisibleExport: boolean;
    canClaimCustomerNotified: boolean;
    canClaimReinstatementAudited: boolean;
    canExposeFinalApiHandoff: boolean;
    canAttachSupportPacket: boolean;
    canClaimWorldClass100: false;
    reason: string;
  };
  postReinstatementRiskSignals: {
    previousReinstatementNotReady: boolean;
    missingReinstatedExportAudit: boolean;
    missingOperatorPostReleaseAuditReceipt: boolean;
    missingNotificationDispatchReceipt: boolean;
    missingNotificationOpenReceipt: boolean;
    missingNotificationContentHash: boolean;
    missingChannelBindingReceipt: boolean;
    missingTimelineHash: boolean;
    missingRetentionSnapshot: boolean;
    missingIncidentNoConflictReceipt: boolean;
    payloadOrSourceRootDrift: boolean;
    notificationContentMismatch: boolean;
  };
  customerSafeCopy: string;
  operatorNextActions: string[];
};

export const PASS2844_CUSTOMER_EXPORT_POST_REINSTATEMENT_AUDIT_NOTIFICATION_ACCEPTANCE_GATES = [
  "PASS2844: Reinstated export is not final until a post-reinstatement audit packet proves which operator released it, which channel was reissued and which payloadHash/sourceReceiptRoot remained bound.",
  "PASS2844: Customer notification requires its own dispatch receipt, open/read receipt and content hash; a reissued export link alone cannot prove customer-safe notice.",
  "PASS2844: Channel binding, delivery audit timeline hash, retention snapshot and incident-no-conflict receipt are required before account vault, email, API handoff or support packet can claim reinstated delivery.",
  "PASS2844: Payload/source-root drift or notification-content mismatch freezes customer-visible export even when PASS2843 operator release and reissued channel receipts exist.",
  "PASS2844: The customer-facing copy must say delivery was reinstated after evidence-integrity review; it must not claim legal, financial, market-performance or absolute safety guarantees.",
] as const;

function clamp(value: number) {
  return Math.max(0, Math.min(100, Number(value.toFixed(2))));
}

function redact(value: string | null | undefined) {
  if (!value) return null;
  const clean = String(value).replace(/[^a-zA-Z0-9_-]/g, "");
  if (clean.length <= 10) return `${clean.slice(0, 3)}…redacted`;
  return `${clean.slice(0, 5)}…${clean.slice(-5)}`;
}

export function buildPass2844CustomerExportPostReinstatementAuditNotificationGate(args: {
  surface: string;
  tier?: VelmereTier;
  customerExportOperatorReleaseReinstatementGate: Pass2843CustomerExportOperatorReleaseReinstatementGate;
  generatedAt?: string;
  reinstatedExportAuditId?: string | null;
  operatorPostReleaseAuditReceiptId?: string | null;
  customerNotificationDispatchReceiptId?: string | null;
  customerNotificationOpenReceiptId?: string | null;
  customerNotificationContentHash?: string | null;
  notificationChannel?: Pass2844CustomerExportNotificationChannel;
  channelBindingReceiptId?: string | null;
  customerAccountHash?: string | null;
  payloadHashBound?: string | null;
  sourceReceiptRootBound?: string | null;
  deliveryAuditTimelineHash?: string | null;
  reissuedExportLinkId?: string | null;
  previousOperatorReleaseReceiptId?: string | null;
  previousChannelReinstatementReceiptId?: string | null;
  incidentNoConflictReceiptId?: string | null;
  retentionSnapshotId?: string | null;
  payloadOrSourceRootDrift?: boolean;
  notificationContentMismatch?: boolean;
}): Pass2844CustomerExportPostReinstatementAuditNotificationGate {
  const previousGate = args.customerExportOperatorReleaseReinstatementGate;
  const generatedAt = args.generatedAt ?? new Date().toISOString();
  const previousReady = Boolean(previousGate.reinstatementPolicy.canServeCustomerVisibleExport && previousGate.reinstatementState === "reinstatement_ready");
  const auditReady = Boolean(args.reinstatedExportAuditId);
  const operatorAuditReady = Boolean(args.operatorPostReleaseAuditReceiptId);
  const dispatchReady = Boolean(args.customerNotificationDispatchReceiptId);
  const openReady = Boolean(args.customerNotificationOpenReceiptId);
  const contentHashReady = Boolean(args.customerNotificationContentHash);
  const channelBindingReady = Boolean(args.channelBindingReceiptId);
  const timelineReady = Boolean(args.deliveryAuditTimelineHash);
  const retentionReady = Boolean(args.retentionSnapshotId);
  const incidentNoConflictReady = Boolean(args.incidentNoConflictReceiptId);
  const payloadOrSourceRootDrift = Boolean(args.payloadOrSourceRootDrift);
  const notificationContentMismatch = Boolean(args.notificationContentMismatch);

  const ready = Boolean(
    previousReady &&
      auditReady &&
      operatorAuditReady &&
      dispatchReady &&
      openReady &&
      contentHashReady &&
      channelBindingReady &&
      timelineReady &&
      retentionReady &&
      incidentNoConflictReady &&
      !payloadOrSourceRootDrift &&
      !notificationContentMismatch,
  );

  const postReinstatementState: Pass2844CustomerExportPostReinstatementAuditNotificationState = !previousReady
    ? "reinstatement_blocked"
    : payloadOrSourceRootDrift
      ? "payload_drift_blocked"
      : notificationContentMismatch
        ? "notification_content_mismatch"
        : !auditReady
          ? "audit_packet_missing"
          : !operatorAuditReady
            ? "operator_post_release_audit_missing"
            : !dispatchReady
              ? "notification_dispatch_missing"
              : !openReady || !contentHashReady
                ? "notification_open_missing"
                : !channelBindingReady
                  ? "channel_binding_missing"
                  : !timelineReady
                    ? "timeline_hash_missing"
                    : !retentionReady || !incidentNoConflictReady
                      ? "retention_snapshot_missing"
                      : "post_reinstatement_ready";

  const postReinstatementReadinessScore = clamp(
    previousGate.reinstatementReadinessScore +
      (previousReady ? 8 : -36) +
      (auditReady ? 10 : -14) +
      (operatorAuditReady ? 10 : -14) +
      (dispatchReady ? 8 : -12) +
      (openReady ? 6 : -8) +
      (contentHashReady ? 8 : -10) +
      (channelBindingReady ? 10 : -14) +
      (timelineReady ? 8 : -12) +
      (retentionReady ? 6 : -8) +
      (incidentNoConflictReady ? 6 : -10) -
      (payloadOrSourceRootDrift ? 50 : 0) -
      (notificationContentMismatch ? 36 : 0),
  );

  const reason = ready
    ? "Post-reinstatement export is audit-notification ready: operator audit, customer notice, channel binding, timeline hash, retention snapshot and incident-no-conflict receipt are all present."
    : "Post-reinstatement export remains frozen until audit packet, notification proof, channel binding, timeline hash, retention snapshot and payload/source integrity all clear.";

  const operatorNextActions = [
    !previousReady ? "Finish PASS2843 operator release/reinstatement before post-release notification proof." : null,
    !auditReady ? "Append reinstated export audit packet ID." : null,
    !operatorAuditReady ? "Attach operator post-release audit receipt." : null,
    !dispatchReady ? "Send customer reinstatement notification and persist dispatch receipt." : null,
    !openReady ? "Persist customer notification open/read receipt or keep customer-notified claim locked." : null,
    !contentHashReady ? "Hash the exact customer notification copy that was sent." : null,
    !channelBindingReady ? "Bind notification to account/email/API/support channel receipt." : null,
    !timelineReady ? "Append delivery audit timeline hash covering hold, release, reissue and notice." : null,
    !retentionReady ? "Create retention snapshot for the reinstated export event bundle." : null,
    !incidentNoConflictReady ? "Attach incident-no-conflict receipt before final delivery claim." : null,
    payloadOrSourceRootDrift ? "Freeze export and replay/reseal because payload/source-root drift was detected." : null,
    notificationContentMismatch ? "Freeze export and resend corrected customer-safe notification copy." : null,
  ].filter(Boolean) as string[];

  return {
    schemaVersion: "pass2844_customer_export_post_reinstatement_audit_notification_gate_v1",
    surface: args.surface,
    tier: args.tier ?? previousGate.tier,
    releasePacketId: previousGate.releasePacketId,
    sealId: previousGate.sealId,
    generatedAt,
    postReinstatementState,
    postReinstatementReadinessScore,
    notificationAuditEnvelope: {
      reinstatedExportAuditId: redact(args.reinstatedExportAuditId),
      operatorPostReleaseAuditReceiptId: redact(args.operatorPostReleaseAuditReceiptId),
      customerNotificationDispatchReceiptId: redact(args.customerNotificationDispatchReceiptId),
      customerNotificationOpenReceiptId: redact(args.customerNotificationOpenReceiptId),
      customerNotificationContentHash: redact(args.customerNotificationContentHash),
      notificationChannel: args.notificationChannel ?? "account_vault",
      channelBindingReceiptId: redact(args.channelBindingReceiptId),
      customerAccountHash: redact(args.customerAccountHash),
      payloadHashBound: redact(args.payloadHashBound),
      sourceReceiptRootBound: redact(args.sourceReceiptRootBound),
      deliveryAuditTimelineHash: redact(args.deliveryAuditTimelineHash),
      reissuedExportLinkId: redact(args.reissuedExportLinkId ?? previousGate.reinstatementEnvelope.reissuedExportLinkId),
      previousOperatorReleaseReceiptId: redact(args.previousOperatorReleaseReceiptId ?? previousGate.reinstatementEnvelope.operatorReleaseReceiptId),
      previousChannelReinstatementReceiptId: redact(args.previousChannelReinstatementReceiptId ?? previousGate.reinstatementEnvelope.channelReinstatementReceiptId),
      incidentNoConflictReceiptId: redact(args.incidentNoConflictReceiptId),
      retentionSnapshotId: redact(args.retentionSnapshotId),
    },
    postReinstatementPolicy: {
      canServeCustomerVisibleExport: ready,
      canClaimCustomerNotified: ready && dispatchReady && openReady && contentHashReady,
      canClaimReinstatementAudited: ready && auditReady && operatorAuditReady && timelineReady,
      canExposeFinalApiHandoff: ready && (args.notificationChannel === "api_handoff" || args.notificationChannel === "multi_channel"),
      canAttachSupportPacket: ready && (args.notificationChannel === "support_thread" || args.notificationChannel === "multi_channel"),
      canClaimWorldClass100: false,
      reason,
    },
    postReinstatementRiskSignals: {
      previousReinstatementNotReady: !previousReady,
      missingReinstatedExportAudit: !auditReady,
      missingOperatorPostReleaseAuditReceipt: !operatorAuditReady,
      missingNotificationDispatchReceipt: !dispatchReady,
      missingNotificationOpenReceipt: !openReady,
      missingNotificationContentHash: !contentHashReady,
      missingChannelBindingReceipt: !channelBindingReady,
      missingTimelineHash: !timelineReady,
      missingRetentionSnapshot: !retentionReady,
      missingIncidentNoConflictReceipt: !incidentNoConflictReady,
      payloadOrSourceRootDrift,
      notificationContentMismatch,
    },
    customerSafeCopy:
      "Your export was reinstated only after an evidence-integrity review. The notice proves delivery state and access channel, not legal, market-performance, financial or absolute safety guarantees.",
    operatorNextActions,
  };
}
