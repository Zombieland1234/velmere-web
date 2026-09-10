import type { VelmereTier } from "@/lib/market-integrity/top1-risk-foundation";
import type { Pass2835AccountVaultRemedyReopenAuditGate } from "@/lib/market-integrity/top1-account-vault-remedy-reopen-audit-gate";

export type Pass2836RemedyReopenReplayLockState =
  | "not_required"
  | "replay_lock_missing"
  | "duplicate_delivery_blocked"
  | "stale_reopen_blocked"
  | "replay_locked"
  | "unlocked_under_watch"
  | "lock_revoked";

export type Pass2836RemedyReopenReplayLockGate = {
  schemaVersion: "pass2836_remedy_reopen_replay_lock_gate_v1";
  surface: string;
  tier: VelmereTier;
  releasePacketId: string;
  sealId: string;
  generatedAt: string;
  replayLockState: Pass2836RemedyReopenReplayLockState;
  replayLockScore: number;
  replayLockEnvelope: {
    replayLockId: string | null;
    reopenReceiptId: string | null;
    newReportTokenHash: string | null;
    oldTokenRevocationReceiptId: string | null;
    deliveryDedupKey: string | null;
    accountVaultTimelineHash: string | null;
    payloadHashBound: boolean;
    sourceReceiptRootBound: boolean;
    entitlementPolicyBound: boolean;
    accountVaultReopenReceiptBound: boolean;
    allIdsRedacted: boolean;
  };
  duplicateDeliveryFirewall: {
    duplicateSuppressionActive: boolean;
    oldConsumedTokenBlocked: boolean;
    oneTimeNewTokenRequired: boolean;
    canIssueReopenToken: boolean;
    canSendCustomerDownloadLink: boolean;
    canRenderPaidEvidence: boolean;
    canResumeAccountVaultDelivery: boolean;
    canClaimWorldClass100: false;
    reason: string;
  };
  replayRiskSignals: {
    duplicateDeliveryAttempt: boolean;
    oldTokenPresented: boolean;
    reopenReceiptReplayMismatch: boolean;
    deliveryDedupKeyMissing: boolean;
    tokenRotationMissing: boolean;
    watchWindowExpired: boolean;
    payloadOrSourceRootDrift: boolean;
    lockRevoked: boolean;
  };
  operatorNextActions: string[];
};

export const PASS2836_REMEDY_REOPEN_REPLAY_LOCK_ACCEPTANCE_GATES = [
  "PASS2836: Remedy reopen must be protected by a replay-lock envelope; remedy/reopen receipts cannot be replayed to issue multiple paid downloads.",
  "PASS2836: A reopened account-vault delivery requires a new one-time token hash, old-token revocation receipt, delivery dedup key and account-vault timeline hash.",
  "PASS2836: Old consumed tokens, duplicate delivery attempts and stale reopen receipts must block paid evidence rendering and customer download links.",
  "PASS2836: Replay-lock envelopes must bind payloadHash, sourceReceiptRoot, entitlement policy and account-vault reopen receipt before paid delivery can resume.",
  "PASS2836: Customer-facing support packets must expose only redacted lock IDs/hashes; raw tokens, payment IDs, account IDs, PDF payloads and operator notes stay hidden.",
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

export function buildPass2836RemedyReopenReplayLockGate(args: {
  surface: string;
  tier?: VelmereTier;
  accountVaultRemedyReopenAuditGate: Pass2835AccountVaultRemedyReopenAuditGate;
  generatedAt?: string;
  replayLockId?: string | null;
  newReportTokenHash?: string | null;
  oldTokenRevocationReceiptId?: string | null;
  deliveryDedupKey?: string | null;
  accountVaultTimelineHash?: string | null;
  allIdsRedacted?: boolean;
  payloadHashBound?: boolean;
  sourceReceiptRootBound?: boolean;
  entitlementPolicyBound?: boolean;
  accountVaultReopenReceiptBound?: boolean;
  duplicateDeliveryAttempt?: boolean;
  oldTokenPresented?: boolean;
  reopenReceiptReplayMismatch?: boolean;
  tokenRotationMissing?: boolean;
  watchWindowExpired?: boolean;
  payloadOrSourceRootDrift?: boolean;
  lockRevoked?: boolean;
}): Pass2836RemedyReopenReplayLockGate {
  const reopen = args.accountVaultRemedyReopenAuditGate;
  const generatedAt = args.generatedAt ?? new Date().toISOString();
  const replayLockReady = Boolean(args.replayLockId);
  const newTokenReady = Boolean(args.newReportTokenHash);
  const oldTokenRevoked = Boolean(args.oldTokenRevocationReceiptId);
  const dedupKeyReady = Boolean(args.deliveryDedupKey);
  const timelineHashReady = Boolean(args.accountVaultTimelineHash);
  const allIdsRedacted = args.allIdsRedacted !== false;
  const payloadHashBound = args.payloadHashBound !== false && reopen.accountVaultContinuity.payloadHashBound;
  const sourceReceiptRootBound = args.sourceReceiptRootBound !== false && reopen.accountVaultContinuity.sourceReceiptRootBound;
  const entitlementPolicyBound = args.entitlementPolicyBound !== false;
  const accountVaultReopenReceiptBound = args.accountVaultReopenReceiptBound !== false && Boolean(reopen.accountVaultContinuity.reopenReceiptId);
  const duplicateDeliveryAttempt = Boolean(args.duplicateDeliveryAttempt);
  const oldTokenPresented = Boolean(args.oldTokenPresented || reopen.continuityRiskSignals.reusedConsumedToken);
  const reopenReceiptReplayMismatch = Boolean(args.reopenReceiptReplayMismatch || reopen.continuityRiskSignals.missingReopenReceipt);
  const deliveryDedupKeyMissing = !dedupKeyReady;
  const tokenRotationMissing = Boolean(args.tokenRotationMissing || !newTokenReady || !oldTokenRevoked);
  const watchWindowExpired = Boolean(args.watchWindowExpired);
  const payloadOrSourceRootDrift = Boolean(args.payloadOrSourceRootDrift || reopen.continuityRiskSignals.payloadOrSourceRootDrift || !payloadHashBound || !sourceReceiptRootBound);
  const lockRevoked = Boolean(args.lockRevoked || reopen.reopenState === "reopen_revoked");
  const reopenClear = reopen.paidDeliveryReopenPolicy.canReopenPaidDelivery && reopen.paidDeliveryReopenPolicy.canResumeAccountVaultDelivery;
  const lockClear = Boolean(
    reopenClear &&
      replayLockReady &&
      newTokenReady &&
      oldTokenRevoked &&
      dedupKeyReady &&
      timelineHashReady &&
      allIdsRedacted &&
      payloadHashBound &&
      sourceReceiptRootBound &&
      entitlementPolicyBound &&
      accountVaultReopenReceiptBound &&
      !duplicateDeliveryAttempt &&
      !oldTokenPresented &&
      !reopenReceiptReplayMismatch &&
      !tokenRotationMissing &&
      !watchWindowExpired &&
      !payloadOrSourceRootDrift &&
      !lockRevoked,
  );

  const replayLockState: Pass2836RemedyReopenReplayLockState = reopen.reopenState === "not_required"
    ? "not_required"
    : lockRevoked
      ? "lock_revoked"
      : duplicateDeliveryAttempt || oldTokenPresented
        ? "duplicate_delivery_blocked"
        : payloadOrSourceRootDrift || watchWindowExpired || reopenReceiptReplayMismatch
          ? "stale_reopen_blocked"
          : lockClear
            ? "unlocked_under_watch"
            : replayLockReady && newTokenReady && oldTokenRevoked && dedupKeyReady && timelineHashReady
              ? "replay_locked"
              : "replay_lock_missing";

  const replayLockScore = clamp(
    reopen.reopenScore +
      (reopenClear ? 12 : -16) +
      (replayLockReady ? 14 : -18) +
      (newTokenReady ? 14 : -20) +
      (oldTokenRevoked ? 12 : -18) +
      (dedupKeyReady ? 10 : -14) +
      (timelineHashReady ? 8 : -12) +
      (allIdsRedacted ? 8 : -20) +
      (payloadHashBound ? 8 : -18) +
      (sourceReceiptRootBound ? 8 : -18) +
      (entitlementPolicyBound ? 6 : -14) -
      (duplicateDeliveryAttempt ? 28 : 0) -
      (oldTokenPresented ? 28 : 0) -
      (reopenReceiptReplayMismatch ? 22 : 0) -
      (tokenRotationMissing ? 20 : 0) -
      (watchWindowExpired ? 14 : 0) -
      (payloadOrSourceRootDrift ? 24 : 0) -
      (lockRevoked ? 32 : 0),
  );

  const canIssueReopenToken = Boolean(reopenClear && replayLockReady && oldTokenRevoked && dedupKeyReady && timelineHashReady && allIdsRedacted && !duplicateDeliveryAttempt && !oldTokenPresented && !lockRevoked);
  const canSendCustomerDownloadLink = lockClear;
  const canRenderPaidEvidence = lockClear;
  const canResumeAccountVaultDelivery = lockClear;

  return {
    schemaVersion: "pass2836_remedy_reopen_replay_lock_gate_v1",
    surface: args.surface,
    tier: args.tier ?? reopen.tier,
    releasePacketId: reopen.releasePacketId,
    sealId: reopen.sealId,
    generatedAt,
    replayLockState,
    replayLockScore,
    replayLockEnvelope: {
      replayLockId: redact(args.replayLockId),
      reopenReceiptId: reopen.accountVaultContinuity.reopenReceiptId,
      newReportTokenHash: redact(args.newReportTokenHash),
      oldTokenRevocationReceiptId: redact(args.oldTokenRevocationReceiptId),
      deliveryDedupKey: redact(args.deliveryDedupKey),
      accountVaultTimelineHash: redact(args.accountVaultTimelineHash),
      payloadHashBound,
      sourceReceiptRootBound,
      entitlementPolicyBound,
      accountVaultReopenReceiptBound,
      allIdsRedacted,
    },
    duplicateDeliveryFirewall: {
      duplicateSuppressionActive: dedupKeyReady && !deliveryDedupKeyMissing,
      oldConsumedTokenBlocked: true,
      oneTimeNewTokenRequired: true,
      canIssueReopenToken,
      canSendCustomerDownloadLink,
      canRenderPaidEvidence,
      canResumeAccountVaultDelivery,
      canClaimWorldClass100: false,
      reason: !reopenClear
        ? "Account-vault remedy reopen audit is not clear; replay-lock cannot reopen paid delivery by itself."
        : duplicateDeliveryAttempt || oldTokenPresented
          ? "Duplicate delivery or old consumed token replay was detected; paid evidence and customer links stay blocked."
          : payloadOrSourceRootDrift
            ? "Payload/source-root drift invalidates the reopen lock; replay, reseal and reissue a new token before delivery."
            : tokenRotationMissing
              ? "Reopen requires new report token hash plus old-token revocation receipt; token rotation is missing."
              : !dedupKeyReady || !timelineHashReady
                ? "Delivery dedup key and account-vault timeline hash are required before customer download links resume."
                : lockRevoked
                  ? "Replay lock was revoked; paid delivery remains frozen until a fresh remedy/reopen cycle clears."
                  : lockClear
                    ? "Replay-lock is active: new token, old-token revocation, dedup key, timeline hash and payload/source bindings are present under watch."
                    : "Replay-lock envelope is prepared but not complete enough to render paid evidence or send download links.",
    },
    replayRiskSignals: {
      duplicateDeliveryAttempt,
      oldTokenPresented,
      reopenReceiptReplayMismatch,
      deliveryDedupKeyMissing,
      tokenRotationMissing,
      watchWindowExpired,
      payloadOrSourceRootDrift,
      lockRevoked,
    },
    operatorNextActions: [
      "Create a replay-lock envelope before any reopened report token is issued.",
      "Attach new report token hash, old-token revocation receipt, delivery dedup key and account-vault timeline hash to the same payload/source root.",
      "Block old consumed-token presentation, duplicate delivery attempts and stale reopen receipts before PDF/account-vault paid evidence renders.",
      "Keep replay-lock support packets redacted; never expose raw tokens, payment IDs, account IDs, PDF payloads or operator notes.",
    ],
  };
}
