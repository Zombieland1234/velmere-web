import type { VelmereTier } from "@/lib/market-integrity/top1-risk-foundation";
import type { Pass2834CustomerRemedyRefundCreditGate } from "@/lib/market-integrity/top1-customer-remedy-refund-credit-gate";

export type Pass2835AccountVaultRemedyReopenState =
  | "not_required"
  | "audit_trail_missing"
  | "vault_reopen_blocked"
  | "reopen_review_required"
  | "reopen_ready"
  | "reopened_under_watch"
  | "reopen_revoked";

export type Pass2835AccountVaultRemedyReopenAuditGate = {
  schemaVersion: "pass2835_account_vault_remedy_reopen_audit_gate_v1";
  surface: string;
  tier: VelmereTier;
  releasePacketId: string;
  sealId: string;
  generatedAt: string;
  reopenState: Pass2835AccountVaultRemedyReopenState;
  reopenScore: number;
  accountVaultContinuity: {
    accountVaultAuditTrailId: string | null;
    deliveryLedgerEntryId: string | null;
    consumedTokenReceiptId: string | null;
    remedyDecisionId: string | null;
    reopenReceiptId: string | null;
    replaySealId: string | null;
    allIdsRedacted: boolean;
    payloadHashBound: boolean;
    sourceReceiptRootBound: boolean;
    refundCreditDecisionBound: boolean;
  };
  paidDeliveryReopenPolicy: {
    remedyResolved: boolean;
    canReopenPaidDelivery: boolean;
    canResumeAccountVaultDelivery: boolean;
    canSendCustomerDownloadLink: boolean;
    requiresNewToken: boolean;
    revokeOldLinks: boolean;
    watchWindowHours: number;
    canClaimWorldClass100: false;
    reason: string;
  };
  continuityRiskSignals: {
    staleRemedyDecision: boolean;
    reusedConsumedToken: boolean;
    accountVaultTimelineGap: boolean;
    missingReopenReceipt: boolean;
    payloadOrSourceRootDrift: boolean;
    revokedAfterReopen: boolean;
  };
  operatorNextActions: string[];
};

export const PASS2835_ACCOUNT_VAULT_REMEDY_REOPEN_AUDIT_ACCEPTANCE_GATES = [
  "PASS2835: Remedy resolution does not automatically reopen account-vault delivery; a redacted vault audit trail and reopen receipt are required.",
  "PASS2835: Reopened paid delivery must bind account vault audit trail, delivery ledger entry, remedy decision, payloadHash, sourceReceiptRoot and replay seal.",
  "PASS2835: Consumed report tokens cannot be reused after refund/credit/remedy; reopen must issue a new token and revoke old links.",
  "PASS2835: Customer/support packets must expose only redacted identifiers; raw account IDs, payment IDs, PDF payloads, operator notes and source secrets stay out of reopen flows.",
  "PASS2835: Launch-ready/100% copy stays blocked if remedy is resolved but vault timeline, reopen receipt, payload/source root or replay seal continuity is missing.",
] as const;

function clamp(value: number) {
  return Math.max(0, Math.min(100, Number(value.toFixed(2))));
}

function redactId(value: string | null | undefined) {
  if (!value) return null;
  const clean = value.replace(/[^a-zA-Z0-9_-]/g, "");
  if (clean.length <= 8) return `${clean.slice(0, 2)}…redacted`;
  return `${clean.slice(0, 4)}…${clean.slice(-4)}`;
}

export function buildPass2835AccountVaultRemedyReopenAuditGate(args: {
  surface: string;
  tier?: VelmereTier;
  customerRemedyRefundCreditGate: Pass2834CustomerRemedyRefundCreditGate;
  generatedAt?: string;
  accountVaultAuditTrailId?: string | null;
  deliveryLedgerEntryId?: string | null;
  consumedTokenReceiptId?: string | null;
  remedyDecisionId?: string | null;
  reopenReceiptId?: string | null;
  replaySealId?: string | null;
  allIdsRedacted?: boolean;
  payloadHashBound?: boolean;
  sourceReceiptRootBound?: boolean;
  refundCreditDecisionBound?: boolean;
  staleRemedyDecision?: boolean;
  reusedConsumedToken?: boolean;
  accountVaultTimelineGap?: boolean;
  payloadOrSourceRootDrift?: boolean;
  revokedAfterReopen?: boolean;
  watchWindowHours?: number;
}): Pass2835AccountVaultRemedyReopenAuditGate {
  const remedy = args.customerRemedyRefundCreditGate;
  const generatedAt = args.generatedAt ?? new Date().toISOString();
  const remedyResolved = remedy.remedyState === "no_remedy_required" || remedy.remedyState === "remedy_resolved" || remedy.remedyPolicy.canReopenPaidDelivery;
  const accountVaultAuditTrailReady = Boolean(args.accountVaultAuditTrailId && args.deliveryLedgerEntryId && args.consumedTokenReceiptId);
  const remedyDecisionReady = Boolean(args.remedyDecisionId && args.refundCreditDecisionBound !== false);
  const reopenReceiptReady = Boolean(args.reopenReceiptId);
  const replaySealReady = Boolean(args.replaySealId);
  const allIdsRedacted = args.allIdsRedacted !== false;
  const payloadHashBound = args.payloadHashBound !== false;
  const sourceReceiptRootBound = args.sourceReceiptRootBound !== false;
  const staleRemedyDecision = Boolean(args.staleRemedyDecision);
  const reusedConsumedToken = Boolean(args.reusedConsumedToken);
  const accountVaultTimelineGap = Boolean(args.accountVaultTimelineGap || (!accountVaultAuditTrailReady && remedyResolved));
  const missingReopenReceipt = Boolean(remedyResolved && !reopenReceiptReady);
  const payloadOrSourceRootDrift = Boolean(args.payloadOrSourceRootDrift || !payloadHashBound || !sourceReceiptRootBound);
  const revokedAfterReopen = Boolean(args.revokedAfterReopen);
  const continuityClear = Boolean(
    remedyResolved &&
      accountVaultAuditTrailReady &&
      remedyDecisionReady &&
      reopenReceiptReady &&
      replaySealReady &&
      allIdsRedacted &&
      payloadHashBound &&
      sourceReceiptRootBound &&
      !staleRemedyDecision &&
      !reusedConsumedToken &&
      !accountVaultTimelineGap &&
      !payloadOrSourceRootDrift &&
      !revokedAfterReopen,
  );

  const reopenState: Pass2835AccountVaultRemedyReopenState = !remedy.customerImpactSignals.incidentRequiresRemedyReview && remedy.remedyState === "no_remedy_required"
    ? "not_required"
    : revokedAfterReopen
      ? "reopen_revoked"
      : continuityClear
        ? "reopened_under_watch"
        : remedyResolved && accountVaultAuditTrailReady && remedyDecisionReady && reopenReceiptReady && replaySealReady
          ? "reopen_ready"
          : !accountVaultAuditTrailReady
            ? "audit_trail_missing"
            : remedy.remedyPolicy.canReopenPaidDelivery === false
              ? "vault_reopen_blocked"
              : "reopen_review_required";

  const reopenScore = clamp(
    remedy.remedyScore +
      (remedyResolved ? 12 : -16) +
      (accountVaultAuditTrailReady ? 16 : -18) +
      (remedyDecisionReady ? 12 : -12) +
      (reopenReceiptReady ? 14 : -14) +
      (replaySealReady ? 10 : -10) +
      (allIdsRedacted ? 8 : -20) +
      (payloadHashBound ? 8 : -14) +
      (sourceReceiptRootBound ? 8 : -14) -
      (staleRemedyDecision ? 16 : 0) -
      (reusedConsumedToken ? 24 : 0) -
      (accountVaultTimelineGap ? 16 : 0) -
      (payloadOrSourceRootDrift ? 22 : 0) -
      (revokedAfterReopen ? 30 : 0),
  );

  const canResumeAccountVaultDelivery = continuityClear;
  const canSendCustomerDownloadLink = continuityClear && !reusedConsumedToken;

  return {
    schemaVersion: "pass2835_account_vault_remedy_reopen_audit_gate_v1",
    surface: args.surface,
    tier: args.tier ?? remedy.tier,
    releasePacketId: remedy.releasePacketId,
    sealId: remedy.sealId,
    generatedAt,
    reopenState,
    reopenScore,
    accountVaultContinuity: {
      accountVaultAuditTrailId: redactId(args.accountVaultAuditTrailId),
      deliveryLedgerEntryId: redactId(args.deliveryLedgerEntryId),
      consumedTokenReceiptId: redactId(args.consumedTokenReceiptId),
      remedyDecisionId: redactId(args.remedyDecisionId),
      reopenReceiptId: redactId(args.reopenReceiptId),
      replaySealId: redactId(args.replaySealId),
      allIdsRedacted,
      payloadHashBound,
      sourceReceiptRootBound,
      refundCreditDecisionBound: args.refundCreditDecisionBound !== false,
    },
    paidDeliveryReopenPolicy: {
      remedyResolved,
      canReopenPaidDelivery: continuityClear,
      canResumeAccountVaultDelivery,
      canSendCustomerDownloadLink,
      requiresNewToken: true,
      revokeOldLinks: true,
      watchWindowHours: Math.max(1, Math.round(args.watchWindowHours ?? 24)),
      canClaimWorldClass100: false,
      reason: !remedyResolved
        ? "Customer remedy is not resolved; paid delivery and account-vault delivery remain frozen."
        : reusedConsumedToken
          ? "Consumed report token reuse is blocked; reopen must revoke old links and issue a new payload-bound token."
          : payloadOrSourceRootDrift
            ? "Payload/source root drift requires replay and reseal before customer download links can be restored."
            : !accountVaultAuditTrailReady
              ? "Account vault audit trail is missing; remedy resolution cannot reopen paid delivery by itself."
              : !reopenReceiptReady || !replaySealReady
                ? "Reopen receipt and replay seal are required before account-vault delivery resumes."
                : revokedAfterReopen
                  ? "Reopen was revoked after audit; delivery remains frozen until a fresh remedy/reseal cycle clears."
                  : "Account vault continuity is ready, but customer links must use a new token, old links must be revoked and watch window evidence must be retained.",
    },
    continuityRiskSignals: {
      staleRemedyDecision,
      reusedConsumedToken,
      accountVaultTimelineGap,
      missingReopenReceipt,
      payloadOrSourceRootDrift,
      revokedAfterReopen,
    },
    operatorNextActions: [
      "Bind remedy decision, delivery ledger entry and account-vault audit trail to releasePacketId/sealId before reopening paid delivery.",
      "Issue a new one-time report token; never reuse a consumed token after refund/credit/remedy resolution.",
      "Keep customer-visible reopen packets redacted and free of raw account IDs, payment IDs, PDF payloads, operator notes and source secrets.",
      "After reopen, run a watch window and replay/reseal if payloadHash, sourceReceiptRoot, entitlement policy or delivery ledger changes.",
    ],
  };
}
