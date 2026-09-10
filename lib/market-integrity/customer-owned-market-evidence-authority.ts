import { createHmac, timingSafeEqual } from "node:crypto";
import { hashVelmereAccountBinding } from "../auth/account-session";
import { canonicalJson } from "../security/canonical-json";
import { sha256Digest, sha256Hex } from "../security/cryptographic-digest";
import type { MarketImpactVenueSnapshot } from "./market-impact-types";
import { normalizeMarketImpactAssetKey } from "./market-impact-input-validation";

export const CUSTOMER_OWNED_MARKET_EVIDENCE_AUTHORITY_ID =
  "velmere.customer-owned-market-evidence-authority.v1" as const;
export const CUSTOMER_OWNED_MARKET_EVIDENCE_TTL_SECONDS = 15 * 60;

const RECEIPT_ID = /^[A-Za-z0-9:_-]{20,180}$/;
const HEX_64 = /^[a-f0-9]{64}$/;
const MAX_FUTURE_SKEW_MS = 15_000;
const MAX_RECEIPT_LIFETIME_MS = 30 * 60_000;

type SourceClass = "CUSTOMER_OWNED" | "OWNER_AUTHORIZED_NON_PRODUCTION";

export type CustomerOwnedMarketEvidenceRights = Readonly<{
  analysis: true;
  privateCustomerDisplay: true;
  derivedAnalytics: true;
  cache: true;
  retention: true;
  exportAllowed: boolean;
  publicDisplay: false;
  redistribution: false;
}>;

export type CustomerOwnedMarketEvidenceAuthorityReceipt = Readonly<{
  schemaVersion: typeof CUSTOMER_OWNED_MARKET_EVIDENCE_AUTHORITY_ID;
  receiptId: string;
  keyId: string;
  accountIdHash: string;
  assetKey: string;
  snapshotDigest: string;
  snapshotCount: number;
  sourceClass: SourceClass;
  issuedAt: string;
  expiresAt: string;
  rights: CustomerOwnedMarketEvidenceRights;
  attestation: Readonly<{
    ownershipOrAuthorityAsserted: true;
    independentLegalReviewCompleted: false;
    sourceIndependenceVerifiedByVelmere: false;
    liveMarketDataClaimed: false;
  }>;
  signature: string;
}>;

export type CustomerOwnedMarketEvidenceAuthorization =
  | Readonly<{
      authorized: true;
      receipt: CustomerOwnedMarketEvidenceAuthorityReceipt;
      snapshotDigest: string;
      publicProjection: ReturnType<typeof projectCustomerOwnedMarketEvidenceAuthority>;
    }>
  | Readonly<{
      authorized: false;
      error:
        | "customer_market_evidence_secret_missing_or_weak"
        | "customer_market_evidence_receipt_invalid"
        | "customer_market_evidence_signature_invalid"
        | "customer_market_evidence_not_yet_valid"
        | "customer_market_evidence_expired"
        | "customer_market_evidence_account_mismatch"
        | "customer_market_evidence_asset_mismatch"
        | "customer_market_evidence_snapshot_mismatch"
        | "customer_market_evidence_rights_insufficient";
      status: 400 | 401 | 403 | 409 | 503;
      retryable: boolean;
    }>;

function receiptSecrets(explicit?: { current?: string; previous?: string }) {
  return {
    current: (explicit?.current ?? process.env.VELMERE_CUSTOMER_OWNED_MARKET_EVIDENCE_SECRET_CURRENT ?? "").trim(),
    previous: (explicit?.previous ?? process.env.VELMERE_CUSTOMER_OWNED_MARKET_EVIDENCE_SECRET_PREVIOUS ?? "").trim(),
  };
}

function keyId(secret: string) {
  return sha256Hex(`customer-owned-market-evidence-key:${secret}`).slice(0, 20);
}

function snapshotsDigest(snapshots: readonly MarketImpactVenueSnapshot[]) {
  return sha256Digest(canonicalJson(snapshots));
}

function unsignedReceipt(receipt: CustomerOwnedMarketEvidenceAuthorityReceipt) {
  const { signature: _signature, ...unsigned } = receipt;
  return unsigned;
}

function sign(unsigned: Omit<CustomerOwnedMarketEvidenceAuthorityReceipt, "signature">, secret: string) {
  return createHmac("sha256", secret).update(canonicalJson(unsigned), "utf8").digest("hex");
}

function signaturesMatch(provided: string, expected: string) {
  if (!HEX_64.test(provided) || !HEX_64.test(expected)) return false;
  return timingSafeEqual(Buffer.from(provided, "hex"), Buffer.from(expected, "hex"));
}

function canonicalIso(value: unknown): value is string {
  if (typeof value !== "string" || value.length > 64) return false;
  const milliseconds = Date.parse(value);
  return Number.isFinite(milliseconds) && new Date(milliseconds).toISOString() === value;
}

function hasExactRequiredRights(value: unknown): value is CustomerOwnedMarketEvidenceRights {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const rights = value as Record<string, unknown>;
  return rights.analysis === true
    && rights.privateCustomerDisplay === true
    && rights.derivedAnalytics === true
    && rights.cache === true
    && rights.retention === true
    && typeof rights.exportAllowed === "boolean"
    && rights.publicDisplay === false
    && rights.redistribution === false
    && Object.keys(rights).sort().join("|") === [
      "analysis",
      "cache",
      "derivedAnalytics",
      "exportAllowed",
      "privateCustomerDisplay",
      "publicDisplay",
      "redistribution",
      "retention",
    ].sort().join("|");
}

function structurallyValid(value: unknown): value is CustomerOwnedMarketEvidenceAuthorityReceipt {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const receipt = value as Partial<CustomerOwnedMarketEvidenceAuthorityReceipt>;
  const attestation = receipt.attestation as Record<string, unknown> | undefined;
  return receipt.schemaVersion === CUSTOMER_OWNED_MARKET_EVIDENCE_AUTHORITY_ID
    && typeof receipt.receiptId === "string"
    && RECEIPT_ID.test(receipt.receiptId)
    && typeof receipt.keyId === "string"
    && /^[a-f0-9]{20}$/.test(receipt.keyId)
    && typeof receipt.accountIdHash === "string"
    && /^(?:sha256:)?[a-f0-9]{64}$/.test(receipt.accountIdHash)
    && typeof receipt.assetKey === "string"
    && receipt.assetKey === normalizeMarketImpactAssetKey(receipt.assetKey)
    && typeof receipt.snapshotDigest === "string"
    && /^sha256:[a-f0-9]{64}$/.test(receipt.snapshotDigest)
    && Number.isInteger(receipt.snapshotCount)
    && (receipt.snapshotCount ?? 0) >= 1
    && (receipt.snapshotCount ?? 0) <= 12
    && (receipt.sourceClass === "CUSTOMER_OWNED" || receipt.sourceClass === "OWNER_AUTHORIZED_NON_PRODUCTION")
    && canonicalIso(receipt.issuedAt)
    && canonicalIso(receipt.expiresAt)
    && hasExactRequiredRights(receipt.rights)
    && Boolean(attestation)
    && attestation?.ownershipOrAuthorityAsserted === true
    && attestation?.independentLegalReviewCompleted === false
    && attestation?.sourceIndependenceVerifiedByVelmere === false
    && attestation?.liveMarketDataClaimed === false
    && Object.keys(attestation ?? {}).sort().join("|") === [
      "independentLegalReviewCompleted",
      "liveMarketDataClaimed",
      "ownershipOrAuthorityAsserted",
      "sourceIndependenceVerifiedByVelmere",
    ].sort().join("|")
    && typeof receipt.signature === "string"
    && HEX_64.test(receipt.signature);
}

export function createCustomerOwnedMarketEvidenceAuthority(args: {
  receiptId: string;
  accountId: string;
  assetKey: string;
  snapshots: readonly MarketImpactVenueSnapshot[];
  sourceClass: SourceClass;
  exportAllowed?: boolean;
  now?: Date;
  ttlSeconds?: number;
  secret?: string;
}): CustomerOwnedMarketEvidenceAuthorityReceipt {
  const secret = (args.secret ?? receiptSecrets().current).trim();
  if (secret.length < 32) throw new Error("customer_market_evidence_secret_missing_or_weak");
  if (!RECEIPT_ID.test(args.receiptId)) throw new Error("customer_market_evidence_receipt_id_invalid");
  const assetKey = normalizeMarketImpactAssetKey(args.assetKey);
  if (!assetKey) throw new Error("customer_market_evidence_asset_invalid");
  if (!Array.isArray(args.snapshots) || args.snapshots.length < 1 || args.snapshots.length > 12) {
    throw new Error("customer_market_evidence_snapshots_invalid");
  }
  const now = args.now ?? new Date();
  if (!Number.isFinite(now.getTime())) throw new Error("customer_market_evidence_time_invalid");
  const requestedTtl = Math.trunc(args.ttlSeconds ?? CUSTOMER_OWNED_MARKET_EVIDENCE_TTL_SECONDS);
  const ttlSeconds = Math.max(60, Math.min(MAX_RECEIPT_LIFETIME_MS / 1_000, requestedTtl));
  const unsigned: Omit<CustomerOwnedMarketEvidenceAuthorityReceipt, "signature"> = {
    schemaVersion: CUSTOMER_OWNED_MARKET_EVIDENCE_AUTHORITY_ID,
    receiptId: args.receiptId,
    keyId: keyId(secret),
    accountIdHash: hashVelmereAccountBinding(args.accountId),
    assetKey,
    snapshotDigest: snapshotsDigest(args.snapshots),
    snapshotCount: args.snapshots.length,
    sourceClass: args.sourceClass,
    issuedAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + ttlSeconds * 1_000).toISOString(),
    rights: {
      analysis: true,
      privateCustomerDisplay: true,
      derivedAnalytics: true,
      cache: true,
      retention: true,
      exportAllowed: args.exportAllowed === true,
      publicDisplay: false,
      redistribution: false,
    },
    attestation: {
      ownershipOrAuthorityAsserted: true,
      independentLegalReviewCompleted: false,
      sourceIndependenceVerifiedByVelmere: false,
      liveMarketDataClaimed: false,
    },
  };
  return { ...unsigned, signature: sign(unsigned, secret) };
}

export function projectCustomerOwnedMarketEvidenceAuthority(
  receipt: CustomerOwnedMarketEvidenceAuthorityReceipt,
) {
  return {
    schemaVersion: receipt.schemaVersion,
    receiptId: receipt.receiptId,
    accountBound: true,
    signatureVerified: true,
    assetKey: receipt.assetKey,
    snapshotDigest: receipt.snapshotDigest,
    snapshotCount: receipt.snapshotCount,
    sourceClass: receipt.sourceClass,
    issuedAt: receipt.issuedAt,
    expiresAt: receipt.expiresAt,
    rights: receipt.rights,
    independentLegalReviewCompleted: false,
    sourceIndependenceVerifiedByVelmere: false,
    liveClaimed: false,
    customerFinalEligible: false,
  } as const;
}

export function verifyCustomerOwnedMarketEvidenceAuthority(args: {
  receipt: unknown;
  accountId: string;
  assetKey: string;
  snapshots: readonly MarketImpactVenueSnapshot[];
  now?: Date;
  secrets?: { current?: string; previous?: string };
}): CustomerOwnedMarketEvidenceAuthorization {
  const secrets = receiptSecrets(args.secrets);
  const usableSecrets = [secrets.current, secrets.previous].filter((secret, index, all) => secret.length >= 32 && all.indexOf(secret) === index);
  if (usableSecrets.length === 0) {
    return { authorized: false, error: "customer_market_evidence_secret_missing_or_weak", status: 503, retryable: true };
  }
  if (!structurallyValid(args.receipt)) {
    return { authorized: false, error: "customer_market_evidence_receipt_invalid", status: 400, retryable: false };
  }
  const receipt = args.receipt;
  const matchingSecret = usableSecrets.find((secret) => receipt.keyId === keyId(secret));
  if (!matchingSecret || !signaturesMatch(receipt.signature, sign(unsignedReceipt(receipt), matchingSecret))) {
    return { authorized: false, error: "customer_market_evidence_signature_invalid", status: 401, retryable: false };
  }

  const issuedAtMs = Date.parse(receipt.issuedAt);
  const expiresAtMs = Date.parse(receipt.expiresAt);
  const nowMs = (args.now ?? new Date()).getTime();
  if (!Number.isFinite(nowMs) || issuedAtMs > nowMs + MAX_FUTURE_SKEW_MS) {
    return { authorized: false, error: "customer_market_evidence_not_yet_valid", status: 401, retryable: false };
  }
  if (expiresAtMs <= issuedAtMs || expiresAtMs - issuedAtMs > MAX_RECEIPT_LIFETIME_MS || expiresAtMs <= nowMs) {
    return { authorized: false, error: "customer_market_evidence_expired", status: 401, retryable: false };
  }
  if (!hasExactRequiredRights(receipt.rights)) {
    return { authorized: false, error: "customer_market_evidence_rights_insufficient", status: 403, retryable: false };
  }
  if (receipt.accountIdHash !== hashVelmereAccountBinding(args.accountId)) {
    return { authorized: false, error: "customer_market_evidence_account_mismatch", status: 403, retryable: false };
  }
  const assetKey = normalizeMarketImpactAssetKey(args.assetKey);
  if (!assetKey || receipt.assetKey !== assetKey) {
    return { authorized: false, error: "customer_market_evidence_asset_mismatch", status: 409, retryable: false };
  }
  const snapshotDigest = snapshotsDigest(args.snapshots);
  if (receipt.snapshotCount !== args.snapshots.length || receipt.snapshotDigest !== snapshotDigest) {
    return { authorized: false, error: "customer_market_evidence_snapshot_mismatch", status: 409, retryable: false };
  }
  return {
    authorized: true,
    receipt,
    snapshotDigest,
    publicProjection: projectCustomerOwnedMarketEvidenceAuthority(receipt),
  };
}
