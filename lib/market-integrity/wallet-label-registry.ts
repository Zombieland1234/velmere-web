import { createHmac, timingSafeEqual } from "node:crypto";
import { canonicalJson } from "../security/canonical-json";
import { sha256Hex } from "../security/cryptographic-digest";
import { canonicalProviderFamily } from "./provider-family-identity";
import type { HolderCategory } from "./whale-watch-contract-types";

export const WALLET_LABEL_REGISTRY_SCHEMA = "velmere.wallet-label-registry.v1" as const;

export interface WalletLabelRegistryPayload {
  schemaVersion: typeof WALLET_LABEL_REGISTRY_SCHEMA;
  assetKey: string;
  holderId: string;
  category: HolderCategory;
  clusterId?: string;
  providerFamily: string;
  sourceDigest: string;
  confidencePercent: number;
  issuedAt: string;
  expiresAt: string;
  nonce: string;
}

export interface WalletLabelRegistryArtifact {
  payload: WalletLabelRegistryPayload;
  payloadDigest: string;
  signature: string;
}

const PLACEHOLDER_SECRET = /(changeme|replace|example|placeholder|secret123|test-secret|dummy)/i;
const VALID_CATEGORIES = new Set<HolderCategory>([
  "private_whale",
  "exchange",
  "custody",
  "bridge",
  "liquidity_pool",
  "treasury",
  "team",
  "burn",
  "contract",
  "unknown",
]);

function strongSecret(secret: string): string {
  const normalized = secret.trim();
  if (normalized.length < 32 || PLACEHOLDER_SECRET.test(normalized)) {
    throw new Error("wallet_label_registry_secret_too_weak");
  }
  return normalized;
}

function normalizeAssetKey(value: string): string {
  return value.trim().toUpperCase().replace(/\s+/g, "").slice(0, 120);
}

function normalizeHolderId(value: string): string {
  return value.trim().toLowerCase().slice(0, 220);
}

function normalizeDigest(value: string): string {
  const normalized = value.trim().toLowerCase().replace(/^sha256:/, "");
  if (!/^[a-f0-9]{64}$/.test(normalized)) throw new Error("wallet_label_registry_source_digest_invalid");
  return normalized;
}

function normalizePayload(
  input: Omit<WalletLabelRegistryPayload, "schemaVersion"> | WalletLabelRegistryPayload,
): WalletLabelRegistryPayload {
  const assetKey = normalizeAssetKey(input.assetKey);
  const holderId = normalizeHolderId(input.holderId);
  const providerFamily = canonicalProviderFamily(input.providerFamily);
  const clusterId = input.clusterId?.trim().toLowerCase().slice(0, 180) || undefined;
  const nonce = input.nonce.trim().slice(0, 180);
  const category = input.category;
  const confidencePercent = Number(input.confidencePercent);
  if (!assetKey || !holderId || !providerFamily || nonce.length < 16 || !VALID_CATEGORIES.has(category)) {
    throw new Error("wallet_label_registry_payload_invalid");
  }
  if (!Number.isFinite(confidencePercent) || confidencePercent < 0 || confidencePercent > 100) {
    throw new Error("wallet_label_registry_confidence_invalid");
  }
  const issuedAt = new Date(input.issuedAt).toISOString();
  const expiresAt = new Date(input.expiresAt).toISOString();
  return {
    schemaVersion: WALLET_LABEL_REGISTRY_SCHEMA,
    assetKey,
    holderId,
    category,
    clusterId,
    providerFamily,
    sourceDigest: normalizeDigest(input.sourceDigest),
    confidencePercent: Math.round(confidencePercent * 100) / 100,
    issuedAt,
    expiresAt,
    nonce,
  };
}

function signDigest(payloadDigest: string, secret: string): string {
  return createHmac("sha256", strongSecret(secret))
    .update(`${WALLET_LABEL_REGISTRY_SCHEMA}:${payloadDigest}`, "utf8")
    .digest("hex");
}

export function createWalletLabelRegistryArtifact(args: {
  payload: Omit<WalletLabelRegistryPayload, "schemaVersion">;
  secret: string;
  maximumLifetimeMs?: number;
}): WalletLabelRegistryArtifact {
  const payload = normalizePayload(args.payload);
  const issuedAt = Date.parse(payload.issuedAt);
  const expiresAt = Date.parse(payload.expiresAt);
  const maximumLifetimeMs = Math.max(60_000, Math.min(365 * 24 * 60 * 60_000, args.maximumLifetimeMs ?? 90 * 24 * 60 * 60_000));
  if (!Number.isFinite(issuedAt) || !Number.isFinite(expiresAt) || expiresAt <= issuedAt || expiresAt - issuedAt > maximumLifetimeMs) {
    throw new Error("wallet_label_registry_time_window_invalid");
  }
  const payloadDigest = sha256Hex(canonicalJson(payload));
  return {
    payload,
    payloadDigest,
    signature: signDigest(payloadDigest, args.secret),
  };
}

export function verifyWalletLabelRegistryArtifact(args: {
  artifact: WalletLabelRegistryArtifact;
  secret: string;
  now?: Date;
  expected?: Partial<Pick<WalletLabelRegistryPayload, "assetKey" | "holderId" | "category" | "clusterId" | "providerFamily" | "sourceDigest">>;
  maximumLifetimeMs?: number;
  maximumFutureSkewMs?: number;
  minimumConfidencePercent?: number;
}): { ok: true; artifact: WalletLabelRegistryArtifact } | { ok: false; error: string } {
  try {
    if (args.artifact.payload.schemaVersion !== WALLET_LABEL_REGISTRY_SCHEMA) {
      return { ok: false, error: "wallet_label_registry_schema_mismatch" };
    }
    const payload = normalizePayload(args.artifact.payload);
    const payloadDigest = sha256Hex(canonicalJson(payload));
    if (!/^[a-f0-9]{64}$/.test(args.artifact.payloadDigest) || args.artifact.payloadDigest !== payloadDigest) {
      return { ok: false, error: "wallet_label_registry_digest_mismatch" };
    }
    const expectedSignature = signDigest(payloadDigest, args.secret);
    if (!/^[a-f0-9]{64}$/.test(args.artifact.signature)) {
      return { ok: false, error: "wallet_label_registry_signature_invalid" };
    }
    const left = Buffer.from(expectedSignature, "hex");
    const right = Buffer.from(args.artifact.signature, "hex");
    if (left.length !== right.length || !timingSafeEqual(left, right)) {
      return { ok: false, error: "wallet_label_registry_signature_mismatch" };
    }

    const nowMs = (args.now ?? new Date()).getTime();
    const issuedAt = Date.parse(payload.issuedAt);
    const expiresAt = Date.parse(payload.expiresAt);
    const maximumLifetimeMs = Math.max(60_000, Math.min(365 * 24 * 60 * 60_000, args.maximumLifetimeMs ?? 90 * 24 * 60 * 60_000));
    const maximumFutureSkewMs = Math.max(0, Math.min(10 * 60_000, args.maximumFutureSkewMs ?? 60_000));
    if (!Number.isFinite(nowMs) || !Number.isFinite(issuedAt) || !Number.isFinite(expiresAt)) {
      return { ok: false, error: "wallet_label_registry_time_invalid" };
    }
    if (issuedAt > nowMs + maximumFutureSkewMs) return { ok: false, error: "wallet_label_registry_issued_in_future" };
    if (expiresAt <= nowMs) return { ok: false, error: "wallet_label_registry_expired" };
    if (expiresAt <= issuedAt || expiresAt - issuedAt > maximumLifetimeMs) {
      return { ok: false, error: "wallet_label_registry_lifetime_invalid" };
    }
    if (payload.confidencePercent < (args.minimumConfidencePercent ?? 50)) {
      return { ok: false, error: "wallet_label_registry_confidence_below_threshold" };
    }

    const expected = args.expected;
    if (expected?.assetKey && normalizeAssetKey(expected.assetKey) !== payload.assetKey) return { ok: false, error: "wallet_label_registry_asset_mismatch" };
    if (expected?.holderId && normalizeHolderId(expected.holderId) !== payload.holderId) return { ok: false, error: "wallet_label_registry_holder_mismatch" };
    if (expected?.category && expected.category !== payload.category) return { ok: false, error: "wallet_label_registry_category_mismatch" };
    if (expected?.clusterId !== undefined && (expected.clusterId?.trim().toLowerCase() || undefined) !== payload.clusterId) {
      return { ok: false, error: "wallet_label_registry_cluster_mismatch" };
    }
    if (expected?.providerFamily && canonicalProviderFamily(expected.providerFamily) !== payload.providerFamily) {
      return { ok: false, error: "wallet_label_registry_provider_mismatch" };
    }
    if (expected?.sourceDigest && normalizeDigest(expected.sourceDigest) !== payload.sourceDigest) {
      return { ok: false, error: "wallet_label_registry_source_mismatch" };
    }
    return { ok: true, artifact: { payload, payloadDigest, signature: args.artifact.signature } };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "wallet_label_registry_verification_failed" };
  }
}
