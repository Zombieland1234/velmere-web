import type { VelmereTier } from "@/lib/market-integrity/top1-risk-foundation";
import type { Pass2853CustomerExportPostPurgePrivacyAttestationGate } from "@/lib/market-integrity/top1-customer-export-post-purge-privacy-attestation-gate";

export type Pass2854CustomerExportPrivacyIncidentDsrEscalationState =
  | "post_purge_privacy_not_ready"
  | "incident_review_receipt_missing"
  | "export_delivery_freeze_receipt_missing"
  | "incident_classification_missing"
  | "customer_impact_scope_missing"
  | "privacy_security_escalation_receipt_missing"
  | "legal_regulator_review_boundary_missing"
  | "customer_notice_escalation_path_missing"
  | "dsar_audit_packet_missing"
  | "dsar_redaction_manifest_missing"
  | "dsar_raw_secret_leak_detected"
  | "operator_privacy_incident_signoff_missing"
  | "incident_dsr_timeline_hash_missing"
  | "privacy_incident_dsr_escalation_ready";

export type Pass2854CustomerExportResidualIncidentClassification =
  | "none_observed"
  | "suspected_residual_trace"
  | "confirmed_residual_data"
  | "customer_request_only"
  | "legal_hold_review";

export type Pass2854CustomerExportPrivacyIncidentDsrEscalationGate = {
  schemaVersion: "pass2854_customer_export_privacy_incident_dsr_escalation_gate_v1";
  surface: string;
  tier: VelmereTier;
  releasePacketId: string;
  sealId: string;
  generatedAt: string;
  privacyIncidentDsrEscalationState: Pass2854CustomerExportPrivacyIncidentDsrEscalationState;
  privacyIncidentDsrEscalationReadinessScore: number;
  incidentDsrEnvelope: {
    previousPostPurgePrivacyState: string;
    previousPostPurgePrivacyReadinessScore: number;
    previousCanMarkCustomerExportPrivacyClosed: boolean;
    residualDataDetectedInPreviousGate: boolean;
    residualPrivacyIncidentDetected: boolean;
    incidentClassification: Pass2854CustomerExportResidualIncidentClassification;
    incidentReviewReceiptId: string | null;
    exportDeliveryFreezeReceiptId: string | null;
    customerImpactScopeId: string | null;
    privacySecurityEscalationReceiptId: string | null;
    legalRegulatorReviewBoundaryReceiptId: string | null;
    customerNoticeEscalationPathReceiptId: string | null;
    dataSubjectAccessAuditPacketId: string | null;
    dataSubjectAccessRedactionManifestHash: string | null;
    dataSubjectAccessRawSecretLeakDetected: boolean;
    operatorPrivacyIncidentSignoffReceiptId: string | null;
    incidentDsrTimelineHash: string | null;
  };
  incidentDsrPolicy: {
    canClosePrivacyIncidentReview: boolean;
    canServeCustomerDsrAuditPacket: boolean;
    canUnfreezeCustomerExportDelivery: boolean;
    canClaimProductionIncidentDsrWorkflow: false;
    reason: string;
  };
  incidentDsrRiskSignals: {
    postPurgePrivacyNotReady: boolean;
    missingIncidentReviewReceipt: boolean;
    missingExportDeliveryFreezeReceipt: boolean;
    missingIncidentClassification: boolean;
    missingCustomerImpactScope: boolean;
    missingPrivacySecurityEscalationReceipt: boolean;
    missingLegalRegulatorReviewBoundary: boolean;
    missingCustomerNoticeEscalationPath: boolean;
    missingDsrAuditPacket: boolean;
    missingDsrRedactionManifest: boolean;
    dsarRawSecretLeakDetected: boolean;
    missingOperatorPrivacyIncidentSignoff: boolean;
    missingIncidentDsrTimelineHash: boolean;
  };
  customerSafeCopy: string;
  operatorNextActions: string[];
};

export const PASS2854_CUSTOMER_EXPORT_PRIVACY_INCIDENT_DSR_ESCALATION_ACCEPTANCE_GATES = [
  "PASS2854: Post-purge privacy attestation is not the same as privacy incident close or customer data-subject access readiness.",
  "PASS2854: Any residual-data incident must freeze customer export delivery until incident classification, customer impact scope, security/privacy escalation and customer notice path are recorded.",
  "PASS2854: Customer-facing DSAR/export-of-export packets require their own minimized audit packet and redaction manifest; raw operator notes, raw tokens, raw account IDs and private receipts must never leak.",
  "PASS2854: Legal/regulator review remains a boundary placeholder until real jurisdictional workflow, counsel review and regulator notification evidence exist.",
  "PASS2854: This is a deterministic contract only; production claims still require live incident workflow, DB rows, notification logs, DSAR delivery UI and privacy/security officer signoff.",
] as const;

function clamp(value: number) {
  return Math.max(0, Math.min(100, Number(value.toFixed(2))));
}

function normalizeClassification(
  value?: Pass2854CustomerExportResidualIncidentClassification | null,
): Pass2854CustomerExportResidualIncidentClassification {
  return value ?? "none_observed";
}

export function buildPass2854CustomerExportPrivacyIncidentDsrEscalationGate(args: {
  surface: string;
  tier?: VelmereTier;
  customerExportPostPurgePrivacyAttestationGate: Pass2853CustomerExportPostPurgePrivacyAttestationGate;
  generatedAt?: string;
  residualPrivacyIncidentDetected?: boolean;
  incidentClassification?: Pass2854CustomerExportResidualIncidentClassification | null;
  incidentReviewReceiptId?: string | null;
  exportDeliveryFreezeReceiptId?: string | null;
  customerImpactScopeId?: string | null;
  privacySecurityEscalationReceiptId?: string | null;
  legalRegulatorReviewBoundaryReceiptId?: string | null;
  customerNoticeEscalationPathReceiptId?: string | null;
  dataSubjectAccessAuditPacketId?: string | null;
  dataSubjectAccessRedactionManifestHash?: string | null;
  dataSubjectAccessRawSecretLeakDetected?: boolean;
  operatorPrivacyIncidentSignoffReceiptId?: string | null;
  incidentDsrTimelineHash?: string | null;
}): Pass2854CustomerExportPrivacyIncidentDsrEscalationGate {
  const previousGate = args.customerExportPostPurgePrivacyAttestationGate;
  const generatedAt = args.generatedAt ?? new Date().toISOString();
  const previousReady = Boolean(
    previousGate.postPurgePrivacyAttestationState === "post_purge_privacy_attestation_ready" &&
      previousGate.privacyPolicy.canMarkCustomerExportPrivacyClosed &&
      previousGate.privacyPolicy.canServeCustomerDataAfterPurge === false,
  );
  const residualIncidentDetected = Boolean(
    args.residualPrivacyIncidentDetected || previousGate.privacyEnvelope.residualDataDetected,
  );
  const incidentClassification = normalizeClassification(args.incidentClassification);
  const classificationReady = residualIncidentDetected
    ? incidentClassification !== "none_observed"
    : Boolean(incidentClassification === "none_observed" || incidentClassification === "customer_request_only");
  const incidentEscalationReady = residualIncidentDetected
    ? Boolean(
        args.customerImpactScopeId &&
          args.privacySecurityEscalationReceiptId &&
          args.legalRegulatorReviewBoundaryReceiptId &&
          args.customerNoticeEscalationPathReceiptId,
      )
    : Boolean(args.legalRegulatorReviewBoundaryReceiptId);
  const dsarPacketReady = Boolean(
    args.dataSubjectAccessAuditPacketId &&
      args.dataSubjectAccessRedactionManifestHash &&
      !args.dataSubjectAccessRawSecretLeakDetected,
  );
  const ready = Boolean(
    previousReady &&
      args.incidentReviewReceiptId &&
      args.exportDeliveryFreezeReceiptId &&
      classificationReady &&
      incidentEscalationReady &&
      dsarPacketReady &&
      args.operatorPrivacyIncidentSignoffReceiptId &&
      args.incidentDsrTimelineHash,
  );

  const privacyIncidentDsrEscalationState: Pass2854CustomerExportPrivacyIncidentDsrEscalationState = !previousReady
    ? "post_purge_privacy_not_ready"
    : !args.incidentReviewReceiptId
      ? "incident_review_receipt_missing"
      : !args.exportDeliveryFreezeReceiptId
        ? "export_delivery_freeze_receipt_missing"
        : !classificationReady
          ? "incident_classification_missing"
          : residualIncidentDetected && !args.customerImpactScopeId
            ? "customer_impact_scope_missing"
            : residualIncidentDetected && !args.privacySecurityEscalationReceiptId
              ? "privacy_security_escalation_receipt_missing"
              : !args.legalRegulatorReviewBoundaryReceiptId
                ? "legal_regulator_review_boundary_missing"
                : residualIncidentDetected && !args.customerNoticeEscalationPathReceiptId
                  ? "customer_notice_escalation_path_missing"
                  : !args.dataSubjectAccessAuditPacketId
                    ? "dsar_audit_packet_missing"
                    : !args.dataSubjectAccessRedactionManifestHash
                      ? "dsar_redaction_manifest_missing"
                      : args.dataSubjectAccessRawSecretLeakDetected
                        ? "dsar_raw_secret_leak_detected"
                        : !args.operatorPrivacyIncidentSignoffReceiptId
                          ? "operator_privacy_incident_signoff_missing"
                          : !args.incidentDsrTimelineHash
                            ? "incident_dsr_timeline_hash_missing"
                            : "privacy_incident_dsr_escalation_ready";

  const privacyIncidentDsrEscalationReadinessScore = clamp(
    previousGate.postPurgePrivacyAttestationReadinessScore +
      (previousReady ? 8 : -42) +
      (args.incidentReviewReceiptId ? 10 : -16) +
      (args.exportDeliveryFreezeReceiptId ? 10 : -16) +
      (classificationReady ? 9 : -15) +
      (residualIncidentDetected ? -18 : 6) +
      (args.customerImpactScopeId || !residualIncidentDetected ? 8 : -14) +
      (args.privacySecurityEscalationReceiptId || !residualIncidentDetected ? 8 : -14) +
      (args.legalRegulatorReviewBoundaryReceiptId ? 8 : -13) +
      (args.customerNoticeEscalationPathReceiptId || !residualIncidentDetected ? 8 : -13) +
      (args.dataSubjectAccessAuditPacketId ? 10 : -15) +
      (args.dataSubjectAccessRedactionManifestHash ? 10 : -15) -
      (args.dataSubjectAccessRawSecretLeakDetected ? 54 : 0) +
      (args.operatorPrivacyIncidentSignoffReceiptId ? 9 : -14) +
      (args.incidentDsrTimelineHash ? 10 : -15),
  );

  const reason = ready
    ? "Customer export privacy incident / DSAR escalation gate is ready: post-purge privacy close is followed by incident review, export freeze proof, minimized DSAR audit packet, redaction manifest, legal boundary, operator QA approval and timeline hash."
    : "Customer export privacy incident / DSAR escalation gate is not ready: post-purge privacy close still needs incident review, freeze proof, DSAR minimization/redaction, legal boundary, operator QA approval and timeline hash before customer-facing closure claims.";

  const operatorNextActions = [
    !previousReady ? "Complete PASS2853 post-purge privacy attestation before incident/DSAR close." : null,
    !args.incidentReviewReceiptId ? "Append privacy incident / no-incident review receipt." : null,
    !args.exportDeliveryFreezeReceiptId ? "Freeze customer export delivery while incident/DSAR review is unresolved." : null,
    !classificationReady ? "Classify residual privacy incident or mark customer-request-only/no-incident review." : null,
    residualIncidentDetected && !args.customerImpactScopeId ? "Attach customer impact scope for residual incident." : null,
    residualIncidentDetected && !args.privacySecurityEscalationReceiptId ? "Append privacy/security escalation receipt." : null,
    !args.legalRegulatorReviewBoundaryReceiptId ? "Attach legal/regulator review boundary receipt." : null,
    residualIncidentDetected && !args.customerNoticeEscalationPathReceiptId ? "Attach customer notice escalation path receipt." : null,
    !args.dataSubjectAccessAuditPacketId ? "Create minimized customer data-subject access audit packet." : null,
    !args.dataSubjectAccessRedactionManifestHash ? "Attach DSAR/export-of-export redaction manifest hash." : null,
    args.dataSubjectAccessRawSecretLeakDetected ? "Block DSAR packet and redact raw internal secrets/notes/tokens before delivery." : null,
    !args.operatorPrivacyIncidentSignoffReceiptId ? "Collect privacy/security operator QA approval." : null,
    !args.incidentDsrTimelineHash ? "Record privacy incident / DSAR timeline hash." : null,
  ].filter(Boolean) as string[];

  return {
    schemaVersion: "pass2854_customer_export_privacy_incident_dsr_escalation_gate_v1",
    surface: args.surface,
    tier: args.tier ?? previousGate.tier,
    releasePacketId: previousGate.releasePacketId,
    sealId: previousGate.sealId,
    generatedAt,
    privacyIncidentDsrEscalationState,
    privacyIncidentDsrEscalationReadinessScore,
    incidentDsrEnvelope: {
      previousPostPurgePrivacyState: previousGate.postPurgePrivacyAttestationState,
      previousPostPurgePrivacyReadinessScore: previousGate.postPurgePrivacyAttestationReadinessScore,
      previousCanMarkCustomerExportPrivacyClosed: previousGate.privacyPolicy.canMarkCustomerExportPrivacyClosed,
      residualDataDetectedInPreviousGate: previousGate.privacyEnvelope.residualDataDetected,
      residualPrivacyIncidentDetected: residualIncidentDetected,
      incidentClassification,
      incidentReviewReceiptId: args.incidentReviewReceiptId ?? null,
      exportDeliveryFreezeReceiptId: args.exportDeliveryFreezeReceiptId ?? null,
      customerImpactScopeId: args.customerImpactScopeId ?? null,
      privacySecurityEscalationReceiptId: args.privacySecurityEscalationReceiptId ?? null,
      legalRegulatorReviewBoundaryReceiptId: args.legalRegulatorReviewBoundaryReceiptId ?? null,
      customerNoticeEscalationPathReceiptId: args.customerNoticeEscalationPathReceiptId ?? null,
      dataSubjectAccessAuditPacketId: args.dataSubjectAccessAuditPacketId ?? null,
      dataSubjectAccessRedactionManifestHash: args.dataSubjectAccessRedactionManifestHash ?? null,
      dataSubjectAccessRawSecretLeakDetected: Boolean(args.dataSubjectAccessRawSecretLeakDetected),
      operatorPrivacyIncidentSignoffReceiptId: args.operatorPrivacyIncidentSignoffReceiptId ?? null,
      incidentDsrTimelineHash: args.incidentDsrTimelineHash ?? null,
    },
    incidentDsrPolicy: {
      canClosePrivacyIncidentReview: ready && !residualIncidentDetected,
      canServeCustomerDsrAuditPacket: ready && !args.dataSubjectAccessRawSecretLeakDetected,
      canUnfreezeCustomerExportDelivery: ready && !residualIncidentDetected,
      canClaimProductionIncidentDsrWorkflow: false,
      reason,
    },
    incidentDsrRiskSignals: {
      postPurgePrivacyNotReady: !previousReady,
      missingIncidentReviewReceipt: !args.incidentReviewReceiptId,
      missingExportDeliveryFreezeReceipt: !args.exportDeliveryFreezeReceiptId,
      missingIncidentClassification: !classificationReady,
      missingCustomerImpactScope: residualIncidentDetected && !args.customerImpactScopeId,
      missingPrivacySecurityEscalationReceipt: residualIncidentDetected && !args.privacySecurityEscalationReceiptId,
      missingLegalRegulatorReviewBoundary: !args.legalRegulatorReviewBoundaryReceiptId,
      missingCustomerNoticeEscalationPath: residualIncidentDetected && !args.customerNoticeEscalationPathReceiptId,
      missingDsrAuditPacket: !args.dataSubjectAccessAuditPacketId,
      missingDsrRedactionManifest: !args.dataSubjectAccessRedactionManifestHash,
      dsarRawSecretLeakDetected: Boolean(args.dataSubjectAccessRawSecretLeakDetected),
      missingOperatorPrivacyIncidentSignoff: !args.operatorPrivacyIncidentSignoffReceiptId,
      missingIncidentDsrTimelineHash: !args.incidentDsrTimelineHash,
    },
    customerSafeCopy: ready
      ? "Your export privacy close has a minimized data-subject access audit packet and incident/no-incident review receipt. Raw internal notes, raw account IDs and private tokens are not exposed."
      : "Your export privacy review is not closed yet. Velmère still needs incident review, delivery freeze proof, minimized DSAR packet, redaction manifest, legal boundary and operator QA approval.",
    operatorNextActions,
  };
}
