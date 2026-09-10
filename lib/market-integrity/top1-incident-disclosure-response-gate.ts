import type { VelmereTier } from "@/lib/market-integrity/top1-risk-foundation";
import type { Pass2832ProductionCanaryRollbackGate } from "@/lib/market-integrity/top1-production-canary-rollback-gate";

export type Pass2833IncidentDisclosureState =
  | "no_incident"
  | "incident_watch"
  | "disclosure_required"
  | "customer_notice_drafted"
  | "customer_notice_sent"
  | "postmortem_required"
  | "resolved_with_postmortem";

export type Pass2833IncidentDisclosureResponseGate = {
  schemaVersion: "pass2833_incident_disclosure_response_gate_v1";
  surface: string;
  tier: VelmereTier;
  releasePacketId: string;
  sealId: string;
  generatedAt: string;
  disclosureState: Pass2833IncidentDisclosureState;
  disclosureScore: number;
  incidentSignals: {
    incidentDetected: boolean;
    rollbackRequired: boolean;
    rollbackExecuted: boolean;
    dataLeakSuspected: boolean;
    paidEvidenceAffected: boolean;
    customerImpactCount: number;
    p0SecurityEventCount: number;
    providerOutageMinutes: number;
  };
  customerCommunication: {
    publicStatusPageUpdated: boolean;
    customerNoticeDrafted: boolean;
    customerNoticeSent: boolean;
    supportQueueReady: boolean;
    affectedAccountsRedacted: boolean;
    maxNoticeDelayMinutes: number;
  };
  postmortemBoundary: {
    postmortemRequired: boolean;
    postmortemDueHours: number;
    canResumeCanary: boolean;
    canReopenPaidDelivery: boolean;
    canKeepLaunchReadyCopy: boolean;
    canClaimWorldClass100: false;
    reason: string;
  };
  operatorNextActions: string[];
};

export const PASS2833_INCIDENT_DISCLOSURE_RESPONSE_ACCEPTANCE_GATES = [
  "PASS2833: Rollback_required, rollback_executed, suspected data leakage, paid evidence errors or customer delivery impact trigger incident disclosure review before any launch-ready copy can remain live.",
  "PASS2833: Customer notices must be redacted, evidence-bound and tied to releasePacketId/sealId; they must not expose private report payloads, source secrets, account identifiers or operator notes.",
  "PASS2833: Paid PDF/account-vault/email delivery remains frozen when paid evidence is affected until a notice/status page/support queue/postmortem boundary is satisfied.",
  "PASS2833: A production incident is not erased by rollback; canary resumes only after postmortem-required state clears and a new proof packet can be replayed/resealed.",
  "PASS2833: World-class 100% remains false until incident response, customer disclosure, support readiness and postmortem evidence are fresh after production canary.",
] as const;

function clamp(value: number) {
  return Math.max(0, Math.min(100, Number(value.toFixed(2))));
}

function int(value: number | undefined, fallback = 0) {
  const parsed = Number(value ?? fallback);
  return Number.isFinite(parsed) ? Math.max(0, Math.round(parsed)) : fallback;
}

export function buildPass2833IncidentDisclosureResponseGate(args: {
  surface: string;
  tier?: VelmereTier;
  productionCanaryRollbackGate: Pass2832ProductionCanaryRollbackGate;
  generatedAt?: string;
  incidentDetected?: boolean;
  dataLeakSuspected?: boolean;
  paidEvidenceAffected?: boolean;
  customerImpactCount?: number;
  p0SecurityEventCount?: number;
  providerOutageMinutes?: number;
  publicStatusPageUpdated?: boolean;
  customerNoticeDrafted?: boolean;
  customerNoticeSent?: boolean;
  supportQueueReady?: boolean;
  affectedAccountsRedacted?: boolean;
  postmortemDueHours?: number;
  postmortemCompleted?: boolean;
}): Pass2833IncidentDisclosureResponseGate {
  const generatedAt = args.generatedAt ?? new Date().toISOString();
  const rollbackRequired = args.productionCanaryRollbackGate.rollbackBoundary.rollbackRequired;
  const rollbackExecuted = args.productionCanaryRollbackGate.rollbackBoundary.rollbackExecuted;
  const customerImpactCount = int(args.customerImpactCount);
  const p0SecurityEventCount = int(args.p0SecurityEventCount);
  const providerOutageMinutes = int(args.providerOutageMinutes);
  const incidentDetected = Boolean(
    args.incidentDetected ||
      rollbackRequired ||
      rollbackExecuted ||
      args.dataLeakSuspected ||
      args.paidEvidenceAffected ||
      customerImpactCount > 0 ||
      p0SecurityEventCount > 0 ||
      providerOutageMinutes >= 15,
  );
  const dataLeakSuspected = Boolean(args.dataLeakSuspected);
  const paidEvidenceAffected = Boolean(args.paidEvidenceAffected || args.productionCanaryRollbackGate.runtimeSignals.entitlementErrorCount > 0 || args.productionCanaryRollbackGate.runtimeSignals.pdfMismatchCount > 0);
  const publicStatusPageUpdated = Boolean(args.publicStatusPageUpdated);
  const customerNoticeDrafted = Boolean(args.customerNoticeDrafted);
  const customerNoticeSent = Boolean(args.customerNoticeSent);
  const supportQueueReady = Boolean(args.supportQueueReady);
  const affectedAccountsRedacted = args.affectedAccountsRedacted ?? true;
  const postmortemDueHours = int(args.postmortemDueHours, 72);
  const postmortemRequired = incidentDetected && (rollbackRequired || rollbackExecuted || dataLeakSuspected || paidEvidenceAffected || customerImpactCount > 0 || p0SecurityEventCount > 0);
  const communicationReady = !incidentDetected || (publicStatusPageUpdated && customerNoticeDrafted && supportQueueReady && affectedAccountsRedacted);
  const noticeComplete = !incidentDetected || (communicationReady && (customerImpactCount === 0 || customerNoticeSent));
  const canResumeCanary = !incidentDetected || (noticeComplete && Boolean(args.postmortemCompleted) && !dataLeakSuspected && !paidEvidenceAffected);
  const canReopenPaidDelivery = !incidentDetected || (noticeComplete && !paidEvidenceAffected && !dataLeakSuspected);
  const canKeepLaunchReadyCopy = args.productionCanaryRollbackGate.rollbackBoundary.canKeepLaunchReadyCopy && !incidentDetected;

  const disclosureState: Pass2833IncidentDisclosureState = !incidentDetected
    ? "no_incident"
    : noticeComplete && Boolean(args.postmortemCompleted)
      ? "resolved_with_postmortem"
      : postmortemRequired && customerNoticeSent
        ? "postmortem_required"
        : customerNoticeSent
          ? "customer_notice_sent"
          : customerNoticeDrafted
            ? "customer_notice_drafted"
            : rollbackRequired || dataLeakSuspected || paidEvidenceAffected || customerImpactCount > 0 || p0SecurityEventCount > 0
              ? "disclosure_required"
              : "incident_watch";

  const disclosureScore = clamp(
    args.productionCanaryRollbackGate.canaryScore +
      (incidentDetected ? -35 : 12) +
      (publicStatusPageUpdated ? 8 : incidentDetected ? -8 : 0) +
      (customerNoticeDrafted ? 8 : incidentDetected ? -10 : 0) +
      (customerNoticeSent ? 10 : customerImpactCount > 0 ? -12 : 0) +
      (supportQueueReady ? 8 : incidentDetected ? -8 : 0) +
      (affectedAccountsRedacted ? 6 : -18) +
      (args.postmortemCompleted ? 10 : postmortemRequired ? -8 : 0) -
      (dataLeakSuspected ? 30 : 0) -
      (paidEvidenceAffected ? 18 : 0) -
      customerImpactCount * 2 -
      p0SecurityEventCount * 16 -
      Math.min(20, providerOutageMinutes / 3),
  );

  return {
    schemaVersion: "pass2833_incident_disclosure_response_gate_v1",
    surface: args.surface,
    tier: args.tier ?? args.productionCanaryRollbackGate.tier,
    releasePacketId: args.productionCanaryRollbackGate.releasePacketId,
    sealId: args.productionCanaryRollbackGate.sealId,
    generatedAt,
    disclosureState,
    disclosureScore,
    incidentSignals: {
      incidentDetected,
      rollbackRequired,
      rollbackExecuted,
      dataLeakSuspected,
      paidEvidenceAffected,
      customerImpactCount,
      p0SecurityEventCount,
      providerOutageMinutes,
    },
    customerCommunication: {
      publicStatusPageUpdated,
      customerNoticeDrafted,
      customerNoticeSent,
      supportQueueReady,
      affectedAccountsRedacted,
      maxNoticeDelayMinutes: dataLeakSuspected || p0SecurityEventCount > 0 ? 60 : 240,
    },
    postmortemBoundary: {
      postmortemRequired,
      postmortemDueHours,
      canResumeCanary,
      canReopenPaidDelivery,
      canKeepLaunchReadyCopy,
      canClaimWorldClass100: false,
      reason: !incidentDetected
        ? "No production incident signal is active; launch copy still depends on canary, seal and artifact proof gates."
        : dataLeakSuspected
          ? "Suspected data leakage freezes launch-ready copy, paid delivery and canary until disclosure, support, investigation and postmortem evidence clear."
          : paidEvidenceAffected
            ? "Paid evidence/PDF/entitlement impact requires customer notice and paid delivery freeze until proof replay and postmortem boundary clear."
            : customerImpactCount > 0
              ? "Customer impact requires redacted notice, support queue and postmortem before canary or launch-ready copy resumes."
              : rollbackRequired || rollbackExecuted
                ? "Rollback/incident state requires disclosure review; rollback alone does not restore production proof."
                : "Incident watch is active; monitor status page/support readiness and keep launch-ready copy blocked until clear.",
    },
    operatorNextActions: [
      "Open incident review when rollback, data leak suspicion, PDF mismatch, entitlement errors, delivery failures or customer impact appear.",
      "Freeze launch-ready copy and paid delivery until notice/status/support/postmortem gates clear and proof is replayed/resealed.",
      "Send only redacted customer notices bound to releasePacketId/sealId; never expose raw report payloads, secrets, private account IDs or operator notes.",
      "After incident resolution, rerun build/typecheck/live provider smoke/mobile/security/PDF parity, reseal the release packet and restart canary.",
    ],
  };
}
