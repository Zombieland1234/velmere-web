import { createHmac, timingSafeEqual } from "node:crypto";
import { canonicalJson } from "../security/canonical-json";
import { sha256Hex } from "../security/cryptographic-digest";

export interface MarketAssetBindingPayload {
  schemaVersion: "velmere.market-asset-binding.v1";
  chainId: string;
  tokenAddress: string;
  tokenSymbol: string;
  quoteAsset: "USD" | "USDT" | "USDC";
  venueMarkets: {
    binance?: string;
    mexc?: string;
    coinbase?: string;
    kraken?: string;
  };
  source: string;
  issuedAt: string;
  expiresAt: string;
  nonce: string;
}

export interface MarketAssetBindingArtifact {
  payload: MarketAssetBindingPayload;
  payloadDigest: string;
  signature: string;
}

const PLACEHOLDER_SECRET = /(changeme|replace|example|placeholder|secret123|test-secret|dummy)/i;

function assertStrongSecret(secret: string): string {
  const normalized = secret.trim();
  if (normalized.length < 32 || PLACEHOLDER_SECRET.test(normalized)) {
    throw new Error("market_asset_binding_secret_too_weak");
  }
  return normalized;
}

function normalizePayload(input: Omit<MarketAssetBindingPayload, "schemaVersion">): MarketAssetBindingPayload {
  const chainId = input.chainId.trim().toLowerCase().slice(0, 80);
  const tokenAddress = input.tokenAddress.trim().toLowerCase().slice(0, 180);
  const tokenSymbol = input.tokenSymbol.trim().toUpperCase().replace(/[^A-Z0-9._-]/g, "").slice(0, 32);
  const source = input.source.trim().slice(0, 180);
  const nonce = input.nonce.trim().slice(0, 180);
  if (!chainId || !tokenAddress || !tokenSymbol || !source || nonce.length < 16) {
    throw new Error("market_asset_binding_payload_invalid");
  }
  if (chainId.startsWith("eip155:") && !/^0x[a-f0-9]{40}$/.test(tokenAddress)) {
    throw new Error("market_asset_binding_evm_address_invalid");
  }
  const venueMarkets = Object.fromEntries(
    Object.entries(input.venueMarkets)
      .filter(([, value]) => typeof value === "string" && value.trim())
      .map(([key, value]) => [key, String(value).trim().toUpperCase().replace(/[^A-Z0-9:._-]/g, "").slice(0, 80)]),
  ) as MarketAssetBindingPayload["venueMarkets"];
  if (Object.keys(venueMarkets).length === 0) throw new Error("market_asset_binding_market_missing");
  return {
    schemaVersion: "velmere.market-asset-binding.v1",
    chainId,
    tokenAddress,
    tokenSymbol,
    quoteAsset: input.quoteAsset,
    venueMarkets,
    source,
    issuedAt: new Date(input.issuedAt).toISOString(),
    expiresAt: new Date(input.expiresAt).toISOString(),
    nonce,
  };
}

function signatureFor(payloadDigest: string, secret: string): string {
  return createHmac("sha256", assertStrongSecret(secret))
    .update(`velmere.market-asset-binding.v1:${payloadDigest}`)
    .digest("hex");
}

export function createMarketAssetBinding(args: {
  payload: Omit<MarketAssetBindingPayload, "schemaVersion">;
  secret: string;
}): MarketAssetBindingArtifact {
  const payload = normalizePayload(args.payload);
  const issuedAt = Date.parse(payload.issuedAt);
  const expiresAt = Date.parse(payload.expiresAt);
  if (!Number.isFinite(issuedAt) || !Number.isFinite(expiresAt) || expiresAt <= issuedAt) {
    throw new Error("market_asset_binding_time_window_invalid");
  }
  const payloadDigest = sha256Hex(canonicalJson(payload));
  return {
    payload,
    payloadDigest,
    signature: signatureFor(payloadDigest, args.secret),
  };
}

export function verifyMarketAssetBinding(args: {
  artifact: MarketAssetBindingArtifact;
  secret: string;
  now?: Date;
  expected?: Partial<Pick<MarketAssetBindingPayload, "chainId" | "tokenAddress" | "tokenSymbol" | "quoteAsset">>;
  maximumLifetimeMs?: number;
}): { ok: true; artifact: MarketAssetBindingArtifact } | { ok: false; error: string } {
  try {
    if (args.artifact.payload.schemaVersion !== "velmere.market-asset-binding.v1") {
      return { ok: false, error: "market_asset_binding_schema_mismatch" };
    }
    const payload = normalizePayload(args.artifact.payload);
    const actualDigest = sha256Hex(canonicalJson(payload));
    if (!/^[a-f0-9]{64}$/.test(args.artifact.payloadDigest) || args.artifact.payloadDigest !== actualDigest) {
      return { ok: false, error: "market_asset_binding_digest_mismatch" };
    }
    const expectedSignature = signatureFor(actualDigest, args.secret);
    if (!/^[a-f0-9]{64}$/.test(args.artifact.signature)) {
      return { ok: false, error: "market_asset_binding_signature_invalid" };
    }
    const left = Buffer.from(expectedSignature, "hex");
    const right = Buffer.from(args.artifact.signature, "hex");
    if (left.length !== right.length || !timingSafeEqual(left, right)) {
      return { ok: false, error: "market_asset_binding_signature_mismatch" };
    }
    const nowMs = (args.now ?? new Date()).getTime();
    const issuedAt = Date.parse(payload.issuedAt);
    const expiresAt = Date.parse(payload.expiresAt);
    if (!Number.isFinite(nowMs) || !Number.isFinite(issuedAt) || !Number.isFinite(expiresAt)) {
      return { ok: false, error: "market_asset_binding_time_invalid" };
    }
    if (issuedAt > nowMs + 60_000) return { ok: false, error: "market_asset_binding_issued_in_future" };
    if (expiresAt <= nowMs) return { ok: false, error: "market_asset_binding_expired" };
    const maximumLifetimeMs = args.maximumLifetimeMs ?? 7 * 24 * 60 * 60_000;
    if (expiresAt - issuedAt > maximumLifetimeMs) return { ok: false, error: "market_asset_binding_lifetime_too_long" };
    const expected = args.expected ?? {};
    if (expected.chainId && payload.chainId !== expected.chainId.trim().toLowerCase()) return { ok: false, error: "market_asset_binding_chain_mismatch" };
    if (expected.tokenAddress && payload.tokenAddress !== expected.tokenAddress.trim().toLowerCase()) return { ok: false, error: "market_asset_binding_address_mismatch" };
    if (expected.tokenSymbol && payload.tokenSymbol !== expected.tokenSymbol.trim().toUpperCase()) return { ok: false, error: "market_asset_binding_symbol_mismatch" };
    if (expected.quoteAsset && payload.quoteAsset !== expected.quoteAsset) return { ok: false, error: "market_asset_binding_quote_mismatch" };
    return { ok: true, artifact: { ...args.artifact, payload } };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "market_asset_binding_invalid" };
  }
}
