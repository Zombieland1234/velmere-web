import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { canonicalJson } from "@/lib/security/canonical-json";
import {
  verifyAndConsumeSecurityOperatorAssertion,
  verifySecurityOperatorAssertion,
  type SecurityOperatorAssertionConsumeVerdict,
} from "@/lib/security/security-operator-assertion";
import {
  reservePass4395DurableIdempotencyKey,
  type Pass4395DurableIdempotencyReserveInput,
  type Pass4395DurableIdempotencyReserveResult,
} from "@/lib/security/durable-idempotency-store";
import type { AdvancedAuditReleaseEnvelope } from "@/lib/security/advanced-audit-release-envelope";

export const PASS6_MANUAL_REVIEW_AUTHORITY_ID = "pass6-advanced-manual-review-authority-v1" as const;
export const PASS6_MANUAL_REVIEW_PRIMARY_PATH = "/internal/security/advanced-manual-review-authority/primary" as const;
export const PASS6_MANUAL_REVIEW_APPROVER_PATH = "/internal/security/advanced-manual-review-authority/approve" as const;
export const PASS6_MANUAL_REVIEW_PRIMARY_SCOPE = "advanced_audit:manual_review" as const;
export const PASS6_MANUAL_REVIEW_APPROVER_SCOPE = "advanced_audit:approve" as const;

const MIN_SIGNING_KEY_BYTES = 32;
const MAX_RECEIPT_LIFETIME_MS = 24 * 60 * 60_000;
const MAX_ISSUANCE_LAG_MS = 10 * 60_000;
const CLOCK_SKEW_MS = 60_000;
const SAFE_NONCE = /^[A-Za-z0-9_-]{24,160}$/;
const SAFE_CASE_ID = /^[A-Za-z0-9][A-Za-z0-9:._-]{5,159}$/;
const SAFE_KEY_ID = /^[A-Za-z0-9][A-Za-z0-9:._-]{2,79}$/;
const SHA256 = /^sha256:[a-f0-9]{64}$/;
const HEX_SHA256 = /^[a-f0-9]{64}$/;

export type Pass6ManualReviewSigningKey = {
  keyId: string;
  secret: string;
};

export type Pass6ManualReviewKeyRing = {
  current?: Pass6ManualReviewSigningKey | null;
  previous?: Pass6ManualReviewSigningKey | null;
};

export type Pass6ManualReviewBoundClaims = {
  caseId: string;
  accountHash: string;
  tier: "advanced";
  packetDigest: string;
  sourceReceiptRoot: string;
  issuedAt: string;
  expiresAt: string;
  nonce: string;
};

export type Pass6ManualReviewAction = Pass6ManualReviewBoundClaims & {
  schemaVersion: "pass6-advanced-manual-review-action-v1";
  action: "primary_review" | "independent_approval";
  decision: "approve";
};

export type Pass6ManualReviewReviewer = {
  role: "primary_reviewer" | "independent_approver";
  operatorPseudonym: string;
  mfa: "webauthn";
  assertionFingerprint: string;
  assertionIssuedAt: string;
  assertionExpiresAt: string;
  assertionNonceHash: string;
  actionDigest: string;
  assertionReplayProtection: {
    durable: boolean;
    storageMode: "upstash_rest_durable" | "supabase_durable" | "memory_runtime_only";
  };
};

export type Pass6ManualReviewAuthorityReceipt = Pass6ManualReviewBoundClaims & {
  schemaVersion: typeof PASS6_MANUAL_REVIEW_AUTHORITY_ID;
  receiptId: string;
  reviewers: [Pass6ManualReviewReviewer, Pass6ManualReviewReviewer];
  signature: {
    algorithm: "hmac-sha256";
    keyId: string;
    value: string;
  };
};

export type Pass6ManualReviewExpectedBinding = Pick<
  Pass6ManualReviewBoundClaims,
  "caseId" | "accountHash" | "tier" | "packetDigest" | "sourceReceiptRoot"
>;

export type Pass6ManualReviewVerification = {
  ok: boolean;
  integrityValid: boolean;
  policyValid: boolean;
  keySlot: "current" | "previous" | null;
  blockers: string[];
  authorityFingerprint: string | null;
};

export type Pass6ManualReviewConsumption = Pass6ManualReviewVerification & {
  consumed: boolean;
  replayProtection: {
    durable: boolean;
    storageMode: Pass4395DurableIdempotencyReserveResult["storageMode"];
    nonceKeyHash: string;
  } | null;
};

type AssertionConsume = typeof verifyAndConsumeSecurityOperatorAssertion;
type NonceReserve = (input: Pass4395DurableIdempotencyReserveInput) => Promise<Pass4395DurableIdempotencyReserveResult>;

function sha256(value: string) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function digest(value: string) {
  return `sha256:${sha256(value)}`;
}

function normalizeDigest(value: string, label: string) {
  const normalized = value.trim().toLowerCase();
  const result = normalized.startsWith("sha256:") ? normalized : `sha256:${normalized}`;
  if (!SHA256.test(result)) throw new Error(`${label}_invalid`);
  return result;
}

function normalizeCaseId(value: string) {
  const normalized = value.trim();
  if (!SAFE_CASE_ID.test(normalized)) throw new Error("manual_review_case_id_invalid");
  return normalized;
}

function normalizeDate(value: string | Date, label: string) {
  const parsed = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(parsed.getTime())) throw new Error(`${label}_invalid`);
  return parsed;
}

function normalizeKey(key: Pass6ManualReviewSigningKey | null | undefined, label: string) {
  if (!key) throw new Error(`${label}_missing`);
  const keyId = key.keyId.trim();
  const secret = key.secret;
  if (!SAFE_KEY_ID.test(keyId)) throw new Error(`${label}_id_invalid`);
  if (Buffer.byteLength(secret, "utf8") < MIN_SIGNING_KEY_BYTES) throw new Error(`${label}_too_short`);
  return { keyId, secret };
}

function isProductionLike() {
  return process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production";
}

function receiptWithoutSignature(receipt: Pass6ManualReviewAuthorityReceipt) {
  const { signature, ...unsigned } = receipt;
  void signature;
  return unsigned;
}

function receiptWithoutIdOrSignature(receipt: Pass6ManualReviewAuthorityReceipt) {
  const { receiptId, signature, ...core } = receipt;
  void receiptId;
  void signature;
  return core;
}

function receiptIdFor(receipt: Pass6ManualReviewAuthorityReceipt) {
  return `manual-review-${sha256(canonicalJson(receiptWithoutIdOrSignature(receipt))).slice(0, 40)}`;
}

function signatureFor(receipt: Pass6ManualReviewAuthorityReceipt, secret: string) {
  return createHmac("sha256", secret).update(canonicalJson(receiptWithoutSignature(receipt)), "utf8").digest("hex");
}

function safeHexEqual(left: string, right: string) {
  if (!HEX_SHA256.test(left) || !HEX_SHA256.test(right)) return false;
  return timingSafeEqual(Buffer.from(left, "hex"), Buffer.from(right, "hex"));
}

export function buildPass6ManualReviewAction(
  claims: Pass6ManualReviewBoundClaims,
  action: Pass6ManualReviewAction["action"],
): Pass6ManualReviewAction {
  return {
    schemaVersion: "pass6-advanced-manual-review-action-v1",
    action,
    decision: "approve",
    ...claims,
  };
}

function requestPath(request: Request) {
  try {
    return new URL(request.url).pathname;
  } catch {
    return "";
  }
}

function assertExpectedRequest(request: Request, expectedPath: string) {
  if (request.method.toUpperCase() !== "POST" || requestPath(request) !== expectedPath) {
    throw new Error("manual_review_operator_request_binding_invalid");
  }
}

function assertionReviewer(
  verified: Extract<SecurityOperatorAssertionConsumeVerdict, { ok: true }>,
  role: Pass6ManualReviewReviewer["role"],
  action: Pass6ManualReviewAction,
): Pass6ManualReviewReviewer {
  return {
    role,
    operatorPseudonym: verified.operator.pseudonym,
    mfa: "webauthn",
    assertionFingerprint: verified.operator.assertionFingerprint,
    assertionIssuedAt: verified.payload.issuedAt,
    assertionExpiresAt: verified.payload.expiresAt,
    assertionNonceHash: digest(`operator-assertion-nonce|${verified.payload.operatorId}|${verified.payload.nonce}`),
    actionDigest: digest(canonicalJson(action)),
    assertionReplayProtection: {
      durable: verified.replayProtection.durable,
      storageMode: verified.replayProtection.storageMode,
    },
  };
}

/**
 * Builds the only authoritative Advanced manual-review receipt. Both operator
 * assertions are independently signature/body/role/scope/WebAuthn verified and
 * nonce-consumed before the server signs the final dual-control receipt.
 */
export async function issuePass6ManualReviewAuthorityReceipt(args: {
  claims: Omit<Pass6ManualReviewBoundClaims, "tier"> & { tier?: "advanced" };
  primaryAssertionRequest: Request;
  approverAssertionRequest: Request;
  operatorAssertionSecret?: string;
  signingKeyRing: Pass6ManualReviewKeyRing;
  now?: string | Date;
  dependencies?: { consumeAssertion?: AssertionConsume };
}): Promise<Pass6ManualReviewAuthorityReceipt> {
  if (isProductionLike() && args.dependencies?.consumeAssertion) {
    throw new Error("manual_review_test_dependency_forbidden_in_production");
  }
  const currentKey = normalizeKey(args.signingKeyRing.current, "manual_review_current_key");
  if (args.signingKeyRing.previous) {
    const previousKey = normalizeKey(args.signingKeyRing.previous, "manual_review_previous_key");
    if (previousKey.keyId === currentKey.keyId) throw new Error("manual_review_key_ids_must_differ");
  }
  const issued = normalizeDate(args.claims.issuedAt, "manual_review_issued_at");
  const expires = normalizeDate(args.claims.expiresAt, "manual_review_expires_at");
  const now = normalizeDate(args.now ?? new Date(), "manual_review_now");
  if (issued.getTime() > now.getTime() + CLOCK_SKEW_MS) throw new Error("manual_review_not_yet_valid");
  if (now.getTime() - issued.getTime() > MAX_ISSUANCE_LAG_MS) throw new Error("manual_review_issued_at_too_old");
  if (expires.getTime() <= issued.getTime() || expires.getTime() - issued.getTime() > MAX_RECEIPT_LIFETIME_MS) {
    throw new Error("manual_review_lifetime_invalid");
  }
  if (expires.getTime() <= now.getTime()) throw new Error("manual_review_expired");
  if (!SAFE_NONCE.test(args.claims.nonce)) throw new Error("manual_review_nonce_invalid");
  const claims: Pass6ManualReviewBoundClaims = {
    caseId: normalizeCaseId(args.claims.caseId),
    accountHash: normalizeDigest(args.claims.accountHash, "manual_review_account_hash"),
    tier: "advanced",
    packetDigest: normalizeDigest(args.claims.packetDigest, "manual_review_packet_digest"),
    sourceReceiptRoot: normalizeDigest(args.claims.sourceReceiptRoot, "manual_review_source_receipt_root"),
    issuedAt: issued.toISOString(),
    expiresAt: expires.toISOString(),
    nonce: args.claims.nonce,
  };
  const primaryAction = buildPass6ManualReviewAction(claims, "primary_review");
  const approverAction = buildPass6ManualReviewAction(claims, "independent_approval");
  assertExpectedRequest(args.primaryAssertionRequest, PASS6_MANUAL_REVIEW_PRIMARY_PATH);
  assertExpectedRequest(args.approverAssertionRequest, PASS6_MANUAL_REVIEW_APPROVER_PATH);

  const assertionSecret = args.operatorAssertionSecret ?? process.env.VELMERE_SECURITY_OPERATOR_ASSERTION_SECRET;
  const primaryPreflight = verifySecurityOperatorAssertion({
    request: args.primaryAssertionRequest,
    secret: assertionSecret,
    requiredRole: "primary_reviewer",
    requiredScopes: [PASS6_MANUAL_REVIEW_PRIMARY_SCOPE],
    requirePhishingResistantMfa: true,
    requestBody: primaryAction,
    now,
  });
  if (!primaryPreflight.ok) throw new Error(`manual_review_primary_${primaryPreflight.error}`);
  const approverPreflight = verifySecurityOperatorAssertion({
    request: args.approverAssertionRequest,
    secret: assertionSecret,
    requiredRole: "independent_approver",
    requiredScopes: [PASS6_MANUAL_REVIEW_APPROVER_SCOPE],
    requirePhishingResistantMfa: true,
    requestBody: approverAction,
    now,
  });
  if (!approverPreflight.ok) throw new Error(`manual_review_approver_${approverPreflight.error}`);
  if (primaryPreflight.operator.id === approverPreflight.operator.id
    || primaryPreflight.operator.pseudonym === approverPreflight.operator.pseudonym) {
    throw new Error("manual_review_distinct_reviewers_required");
  }

  const consumeAssertion = args.dependencies?.consumeAssertion ?? verifyAndConsumeSecurityOperatorAssertion;
  const primary = await consumeAssertion({
    request: args.primaryAssertionRequest,
    secret: assertionSecret,
    requiredRole: "primary_reviewer",
    requiredScopes: [PASS6_MANUAL_REVIEW_PRIMARY_SCOPE],
    requirePhishingResistantMfa: true,
    requestBody: primaryAction,
    now,
  });
  if (!primary.ok) throw new Error(`manual_review_primary_${primary.error}`);
  const approver = await consumeAssertion({
    request: args.approverAssertionRequest,
    secret: assertionSecret,
    requiredRole: "independent_approver",
    requiredScopes: [PASS6_MANUAL_REVIEW_APPROVER_SCOPE],
    requirePhishingResistantMfa: true,
    requestBody: approverAction,
    now,
  });
  if (!approver.ok) throw new Error(`manual_review_approver_${approver.error}`);
  if (primary.operator.id === approver.operator.id || primary.operator.pseudonym === approver.operator.pseudonym) {
    throw new Error("manual_review_distinct_reviewers_required");
  }
  if (isProductionLike() && (!primary.replayProtection.durable || !approver.replayProtection.durable)) {
    throw new Error("manual_review_operator_nonce_durable_store_required");
  }

  const receipt: Pass6ManualReviewAuthorityReceipt = {
    schemaVersion: PASS6_MANUAL_REVIEW_AUTHORITY_ID,
    receiptId: "",
    ...claims,
    reviewers: [
      assertionReviewer(primary, "primary_reviewer", primaryAction),
      assertionReviewer(approver, "independent_approver", approverAction),
    ],
    signature: { algorithm: "hmac-sha256", keyId: currentKey.keyId, value: "" },
  };
  receipt.receiptId = receiptIdFor(receipt);
  receipt.signature.value = signatureFor(receipt, currentKey.secret);
  return receipt;
}

function validateReviewerShape(value: unknown, expectedRole: Pass6ManualReviewReviewer["role"], blockers: Set<string>) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    blockers.add("manual_review_reviewer_shape_invalid");
    return;
  }
  const reviewer = value as Partial<Pass6ManualReviewReviewer>;
  if (reviewer.role !== expectedRole) blockers.add("manual_review_reviewer_role_invalid");
  if (reviewer.mfa !== "webauthn") blockers.add("manual_review_webauthn_required");
  if (!/^operator-[a-f0-9]{16}$/.test(reviewer.operatorPseudonym ?? "")) blockers.add("manual_review_reviewer_identity_invalid");
  if (!HEX_SHA256.test(reviewer.assertionFingerprint ?? "")) blockers.add("manual_review_assertion_fingerprint_invalid");
  if (!SHA256.test(reviewer.assertionNonceHash ?? "")) blockers.add("manual_review_assertion_nonce_hash_invalid");
  if (!SHA256.test(reviewer.actionDigest ?? "")) blockers.add("manual_review_action_digest_invalid");
  if (!reviewer.assertionReplayProtection || typeof reviewer.assertionReplayProtection !== "object") {
    blockers.add("manual_review_assertion_replay_protection_missing");
  } else if (!["upstash_rest_durable", "supabase_durable", "memory_runtime_only"].includes(reviewer.assertionReplayProtection.storageMode)) {
    blockers.add("manual_review_assertion_replay_mode_invalid");
  }
  try {
    const issued = normalizeDate(reviewer.assertionIssuedAt ?? "", "manual_review_assertion_issued_at");
    const expires = normalizeDate(reviewer.assertionExpiresAt ?? "", "manual_review_assertion_expires_at");
    if (expires.getTime() <= issued.getTime()) blockers.add("manual_review_assertion_lifetime_invalid");
  } catch (error) {
    blockers.add(error instanceof Error ? error.message : "manual_review_assertion_time_invalid");
  }
}

export function verifyPass6ManualReviewAuthorityReceipt(args: {
  receipt: unknown;
  keyRing?: Pass6ManualReviewKeyRing | null;
  expected: Pass6ManualReviewExpectedBinding;
  now?: string | Date;
}): Pass6ManualReviewVerification {
  const integrityBlockers = new Set<string>();
  const policyBlockers = new Set<string>();
  if (!args.receipt || typeof args.receipt !== "object" || Array.isArray(args.receipt)) {
    return {
      ok: false,
      integrityValid: false,
      policyValid: false,
      keySlot: null,
      blockers: ["manual_review_receipt_shape_invalid"],
      authorityFingerprint: null,
    };
  }
  const receipt = args.receipt as Pass6ManualReviewAuthorityReceipt;
  if (receipt.schemaVersion !== PASS6_MANUAL_REVIEW_AUTHORITY_ID) integrityBlockers.add("manual_review_schema_invalid");
  if (receipt.tier !== "advanced") policyBlockers.add("manual_review_advanced_tier_required");
  if (!SAFE_CASE_ID.test(receipt.caseId ?? "")) integrityBlockers.add("manual_review_case_id_invalid");
  if (!SAFE_NONCE.test(receipt.nonce ?? "")) integrityBlockers.add("manual_review_nonce_invalid");
  for (const [value, label] of [
    [receipt.accountHash, "manual_review_account_hash"],
    [receipt.packetDigest, "manual_review_packet_digest"],
    [receipt.sourceReceiptRoot, "manual_review_source_receipt_root"],
  ] as const) {
    try {
      normalizeDigest(value ?? "", label);
    } catch (error) {
      integrityBlockers.add(error instanceof Error ? error.message : `${label}_invalid`);
    }
  }

  const reviewers = Array.isArray(receipt.reviewers) ? receipt.reviewers : [];
  if (reviewers.length !== 2) integrityBlockers.add("manual_review_reviewer_count_invalid");
  validateReviewerShape(reviewers[0], "primary_reviewer", integrityBlockers);
  validateReviewerShape(reviewers[1], "independent_approver", integrityBlockers);
  if (reviewers.length === 2) {
    if (reviewers[0]?.operatorPseudonym === reviewers[1]?.operatorPseudonym) policyBlockers.add("manual_review_distinct_reviewers_required");
    if (reviewers[0]?.assertionFingerprint === reviewers[1]?.assertionFingerprint) policyBlockers.add("manual_review_distinct_assertions_required");
    const baseClaims: Pass6ManualReviewBoundClaims = {
      caseId: receipt.caseId,
      accountHash: receipt.accountHash,
      tier: receipt.tier,
      packetDigest: receipt.packetDigest,
      sourceReceiptRoot: receipt.sourceReceiptRoot,
      issuedAt: receipt.issuedAt,
      expiresAt: receipt.expiresAt,
      nonce: receipt.nonce,
    };
    const expectedPrimaryAction = digest(canonicalJson(buildPass6ManualReviewAction(baseClaims, "primary_review")));
    const expectedApprovalAction = digest(canonicalJson(buildPass6ManualReviewAction(baseClaims, "independent_approval")));
    if (reviewers[0]?.actionDigest !== expectedPrimaryAction) integrityBlockers.add("manual_review_primary_action_binding_mismatch");
    if (reviewers[1]?.actionDigest !== expectedApprovalAction) integrityBlockers.add("manual_review_approval_action_binding_mismatch");
    try {
      const receiptIssued = normalizeDate(receipt.issuedAt, "manual_review_issued_at");
      const primaryIssued = normalizeDate(reviewers[0]?.assertionIssuedAt ?? "", "manual_review_primary_assertion_issued_at");
      const primaryExpires = normalizeDate(reviewers[0]?.assertionExpiresAt ?? "", "manual_review_primary_assertion_expires_at");
      const approverIssued = normalizeDate(reviewers[1]?.assertionIssuedAt ?? "", "manual_review_approver_assertion_issued_at");
      const approverExpires = normalizeDate(reviewers[1]?.assertionExpiresAt ?? "", "manual_review_approver_assertion_expires_at");
      if (primaryIssued.getTime() > receiptIssued.getTime() + CLOCK_SKEW_MS
        || approverIssued.getTime() > receiptIssued.getTime() + CLOCK_SKEW_MS) {
        integrityBlockers.add("manual_review_assertion_after_receipt_issue");
      }
      if (primaryExpires.getTime() <= receiptIssued.getTime() || approverExpires.getTime() <= receiptIssued.getTime()) {
        integrityBlockers.add("manual_review_assertion_expired_before_receipt_issue");
      }
      if (approverIssued.getTime() + CLOCK_SKEW_MS < primaryIssued.getTime()) {
        policyBlockers.add("manual_review_approval_before_primary_review");
      }
    } catch (error) {
      integrityBlockers.add(error instanceof Error ? error.message : "manual_review_assertion_order_invalid");
    }
    if (isProductionLike() && reviewers.some((reviewer) => reviewer?.assertionReplayProtection?.durable !== true)) {
      policyBlockers.add("manual_review_operator_nonce_durable_store_required");
    }
  }

  try {
    const now = normalizeDate(args.now ?? new Date(), "manual_review_now");
    const issued = normalizeDate(receipt.issuedAt, "manual_review_issued_at");
    const expires = normalizeDate(receipt.expiresAt, "manual_review_expires_at");
    if (expires.getTime() <= issued.getTime() || expires.getTime() - issued.getTime() > MAX_RECEIPT_LIFETIME_MS) {
      integrityBlockers.add("manual_review_lifetime_invalid");
    }
    if (issued.getTime() > now.getTime() + CLOCK_SKEW_MS) policyBlockers.add("manual_review_not_yet_valid");
    if (expires.getTime() <= now.getTime()) policyBlockers.add("manual_review_expired");
  } catch (error) {
    integrityBlockers.add(error instanceof Error ? error.message : "manual_review_timestamp_invalid");
  }

  if (receipt.caseId !== args.expected.caseId) policyBlockers.add("manual_review_case_binding_mismatch");
  if (receipt.accountHash !== args.expected.accountHash) policyBlockers.add("manual_review_account_binding_mismatch");
  if (args.expected.tier !== "advanced" || receipt.tier !== args.expected.tier) policyBlockers.add("manual_review_tier_binding_mismatch");
  if (receipt.packetDigest !== args.expected.packetDigest) policyBlockers.add("manual_review_packet_binding_mismatch");
  if (receipt.sourceReceiptRoot !== args.expected.sourceReceiptRoot) policyBlockers.add("manual_review_source_root_binding_mismatch");

  try {
    if (receipt.receiptId !== receiptIdFor(receipt)) integrityBlockers.add("manual_review_receipt_id_mismatch");
  } catch {
    integrityBlockers.add("manual_review_receipt_canonicalization_invalid");
  }
  let keySlot: Pass6ManualReviewVerification["keySlot"] = null;
  const signature = receipt.signature;
  if (!signature || signature.algorithm !== "hmac-sha256" || !SAFE_KEY_ID.test(signature.keyId ?? "") || !HEX_SHA256.test(signature.value ?? "")) {
    integrityBlockers.add("manual_review_signature_invalid");
  } else {
    // Production verification must always have a valid current key configured.
    // A previous key may verify receipts during a bounded rotation window, but
    // previous-only recovery would turn a stale key into the active root of
    // trust after a deployment/configuration mistake.
    if (isProductionLike()) {
      try {
        normalizeKey(args.keyRing?.current, "manual_review_current_key");
      } catch (error) {
        integrityBlockers.add(error instanceof Error ? error.message : "manual_review_current_key_invalid");
      }
    }
    const candidates: Array<{ slot: "current" | "previous"; key: Pass6ManualReviewSigningKey | null | undefined }> = [
      { slot: "current", key: args.keyRing?.current },
      { slot: "previous", key: args.keyRing?.previous },
    ];
    if (args.keyRing?.current?.keyId && args.keyRing.current.keyId === args.keyRing.previous?.keyId) {
      integrityBlockers.add("manual_review_key_ids_must_differ");
    }
    const matching = candidates.find((candidate) => candidate.key?.keyId === signature.keyId);
    if (!matching) {
      integrityBlockers.add("manual_review_signing_key_unavailable");
    } else {
      try {
        const key = normalizeKey(matching.key, `manual_review_${matching.slot}_key`);
        if (!safeHexEqual(signatureFor(receipt, key.secret), signature.value)) integrityBlockers.add("manual_review_signature_mismatch");
        else keySlot = matching.slot;
      } catch (error) {
        integrityBlockers.add(error instanceof Error ? error.message : "manual_review_signing_key_invalid");
      }
    }
  }

  const integrityValid = integrityBlockers.size === 0;
  const policyValid = policyBlockers.size === 0;
  return {
    ok: integrityValid && policyValid,
    integrityValid,
    policyValid,
    keySlot,
    blockers: Array.from(new Set([...integrityBlockers, ...policyBlockers])).sort(),
    authorityFingerprint: integrityValid ? digest(canonicalJson(receipt)) : null,
  };
}

/**
 * Use at the one release transition that turns manual review into paid-delivery
 * authority. It atomically reserves the signed receipt nonce before delivery.
 */
export async function verifyAndConsumePass6ManualReviewAuthorityReceipt(args: {
  receipt: unknown;
  keyRing?: Pass6ManualReviewKeyRing | null;
  expected: Pass6ManualReviewExpectedBinding;
  now?: string | Date;
  dependencies?: { reserveNonce?: NonceReserve };
}): Promise<Pass6ManualReviewConsumption> {
  const verified = verifyPass6ManualReviewAuthorityReceipt(args);
  if (!verified.ok) return { ...verified, consumed: false, replayProtection: null };
  if (isProductionLike() && args.dependencies?.reserveNonce) {
    return {
      ...verified,
      ok: false,
      policyValid: false,
      blockers: [...verified.blockers, "manual_review_test_dependency_forbidden_in_production"],
      consumed: false,
      replayProtection: null,
    };
  }
  const receipt = args.receipt as Pass6ManualReviewAuthorityReceipt;
  const now = normalizeDate(args.now ?? new Date(), "manual_review_now");
  const expires = normalizeDate(receipt.expiresAt, "manual_review_expires_at");
  const ttlSeconds = Math.max(60, Math.min(24 * 60 * 60, Math.ceil((expires.getTime() - now.getTime()) / 1_000) + 60));
  const nonceKeyHash = digest(`advanced-manual-review-receipt-nonce|${receipt.nonce}`);
  const reserveNonce = args.dependencies?.reserveNonce ?? reservePass4395DurableIdempotencyKey;
  const reserved = await reserveNonce({
    keyHash: nonceKeyHash,
    valueHash: digest(canonicalJson(receipt)),
    ttlSeconds,
    receipt: {
      type: PASS6_MANUAL_REVIEW_AUTHORITY_ID,
      receiptId: receipt.receiptId,
      caseIdHash: digest(receipt.caseId),
      accountHash: receipt.accountHash,
      packetDigest: receipt.packetDigest,
      sourceReceiptRoot: receipt.sourceReceiptRoot,
      reviewerPseudonyms: receipt.reviewers.map((reviewer) => reviewer.operatorPseudonym),
      expiresAt: receipt.expiresAt,
    },
  });
  if (reserved.duplicate) {
    return {
      ...verified,
      ok: false,
      policyValid: false,
      blockers: [...verified.blockers, "manual_review_receipt_replayed"],
      consumed: false,
      replayProtection: { durable: reserved.durable, storageMode: reserved.storageMode, nonceKeyHash },
    };
  }
  if (!reserved.ok || (isProductionLike() && !reserved.durable)) {
    return {
      ...verified,
      ok: false,
      policyValid: false,
      blockers: [...verified.blockers, "manual_review_durable_replay_store_unavailable"],
      consumed: false,
      replayProtection: { durable: reserved.durable, storageMode: reserved.storageMode, nonceKeyHash },
    };
  }
  return {
    ...verified,
    consumed: true,
    replayProtection: { durable: reserved.durable, storageMode: reserved.storageMode, nonceKeyHash },
  };
}

export function pass6ManualReviewAuthorityMatchesAdvancedRelease(
  receipt: Pass6ManualReviewAuthorityReceipt,
  envelope: AdvancedAuditReleaseEnvelope,
) {
  const blockers: string[] = [];
  if (receipt.caseId !== envelope.caseRef) blockers.push("manual_review_release_case_mismatch");
  if (receipt.accountHash !== envelope.accountRefHash) blockers.push("manual_review_release_account_mismatch");
  if (receipt.packetDigest !== envelope.payloadHash) blockers.push("manual_review_release_packet_mismatch");
  if (receipt.sourceReceiptRoot !== envelope.sourceReceiptRoot) blockers.push("manual_review_release_source_root_mismatch");
  if (envelope.tier !== "advanced") blockers.push("manual_review_release_tier_mismatch");
  if (envelope.review?.receiptId !== receipt.receiptId) blockers.push("manual_review_release_receipt_id_mismatch");
  return { ok: blockers.length === 0, blockers };
}
