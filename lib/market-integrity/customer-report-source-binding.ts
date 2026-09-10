import { createHmac, timingSafeEqual } from "node:crypto";
import { VELMERE_SOURCE_REGISTRY_V1, type SourceReceipt, type SourceRegistryEntry, type VelmereSourceFamily } from "@/lib/market-integrity/top1-risk-foundation";
import {
  isPass4644CommerciallyFreshReceipt,
  pass4644CanonicalReceiptDigest,
  verifyPass4644ProviderEvidenceReceiptIntegrity,
  type Pass4644ProviderEvidenceReceipt,
} from "@/lib/market-integrity/provider-evidence-receipt";
import { canonicalJson } from "@/lib/security/canonical-json";
import { sha256Digest } from "@/lib/security/cryptographic-digest";

export const PASS4818_CUSTOMER_REPORT_SOURCE_BINDING_ID = "pass4818-customer-report-source-binding-v1" as const;
export const PASS4993_SOURCE_RECEIPT_PROJECTION_ID = "pass4993_source_receipt_projection_v1" as const;

const PROJECTION_SIGNATURE_DOMAIN = "velmere:source-receipt-projection:v1:";
const MIN_PROJECTION_SECRET_LENGTH = 32;

type ProjectionKey = { keyId: string; secret: string; slot: "current" | "previous" };

export type Pass4993SourceReceiptProjectionVerification =
  | { ok: true; keyId: string; keySlot: "current" | "previous"; payloadDigest: string }
  | { ok: false; error: string };

export type CustomerReportSourceBinding = {
  schemaVersion: typeof PASS4818_CUSTOMER_REPORT_SOURCE_BINDING_ID;
  receipts: SourceReceipt[];
  independentContentBoundFamilies: VelmereSourceFamily[];
  independentContentBoundFamilyCount: number;
  independentContentBoundUpstreams: string[];
  independentContentBoundUpstreamCount: number;
  contentBoundReceiptCount: number;
  labelOnlyReceiptCount: number;
  rejectedProviderReceiptCount: number;
  unmappedObservedLabels: string[];
  evidenceLedgerEligible: boolean;
  blockers: string[];
};

function cleanKeyId(value: string | undefined, fallback: string) {
  return String(value ?? "").trim().replace(/[^a-zA-Z0-9._-]+/g, "").slice(0, 48) || fallback;
}

function productionLike(env: Record<string, string | undefined>) {
  return env.NODE_ENV === "production" || env.VERCEL_ENV === "production";
}

function currentProjectionKey(env: Record<string, string | undefined>): ProjectionKey | null {
  const secret = String(env.VELMERE_SOURCE_RECEIPT_PROJECTION_SECRET_CURRENT ?? "").trim();
  if (Buffer.byteLength(secret, "utf8") < MIN_PROJECTION_SECRET_LENGTH) return null;
  return {
    keyId: cleanKeyId(env.VELMERE_SOURCE_RECEIPT_PROJECTION_KEY_ID_CURRENT, "current"),
    secret,
    slot: "current",
  };
}

function projectionVerificationKeys(env: Record<string, string | undefined>): ProjectionKey[] {
  const current = currentProjectionKey(env);
  // A production verifier without an active current key is deliberately not
  // allowed to limp on with only a previous key.
  if (!current && productionLike(env)) return [];
  const keys: ProjectionKey[] = current ? [current] : [];
  const previous = String(env.VELMERE_SOURCE_RECEIPT_PROJECTION_SECRET_PREVIOUS ?? "").trim();
  if (Buffer.byteLength(previous, "utf8") >= MIN_PROJECTION_SECRET_LENGTH) {
    keys.push({
      keyId: cleanKeyId(env.VELMERE_SOURCE_RECEIPT_PROJECTION_KEY_ID_PREVIOUS, "previous"),
      secret: previous,
      slot: "previous",
    });
  }
  return keys;
}

export function getPass4993SourceReceiptProjectionReadiness(
  env: Record<string, string | undefined> = process.env,
) {
  const current = currentProjectionKey(env);
  const previous = String(env.VELMERE_SOURCE_RECEIPT_PROJECTION_SECRET_PREVIOUS ?? "").trim();
  return {
    schemaVersion: "pass4993_source_receipt_projection_readiness_v1",
    productionLike: productionLike(env),
    ready: Boolean(current),
    currentKeyConfigured: Boolean(current),
    previousKeyConfigured: Buffer.byteLength(previous, "utf8") >= MIN_PROJECTION_SECRET_LENGTH,
    minimumSecretBytes: MIN_PROJECTION_SECRET_LENGTH,
    blocker: current ? null : "source_receipt_projection_current_secret_missing_or_short",
  } as const;
}

function unsignedProjectionPayload(receipt: SourceReceipt) {
  const { projection: _projection, ...payload } = receipt;
  return payload;
}

function projectionSignature(secret: string, payload: string) {
  return createHmac("sha256", secret)
    .update(`${PROJECTION_SIGNATURE_DOMAIN}${payload}`, "utf8")
    .digest("base64url");
}

function safeEqual(leftValue: string, rightValue: string) {
  const left = Buffer.from(leftValue, "utf8");
  const right = Buffer.from(rightValue, "utf8");
  return left.length > 0 && left.length === right.length && timingSafeEqual(left, right);
}

function normalizedIdentity(value: string | null | undefined) {
  return String(value ?? "").trim().toLowerCase().replace(/[^a-z0-9:.^=\-_/]+/g, "");
}

function normalizedSymbol(value: string | null | undefined) {
  return String(value ?? "").trim().toLowerCase().replace(/[^a-z0-9.^=/-]+/g, "").replace(/-usd$/, "");
}

function normalizedAddress(value: string | null | undefined) {
  const clean = String(value ?? "").trim().toLowerCase();
  return /^0x[a-f0-9]{40}$/.test(clean) ? clean : "";
}

function canonicalResolvedIdentity(receipt: Pass4644ProviderEvidenceReceipt) {
  const address = normalizedAddress(receipt.identity.resolvedAddress);
  const chain = normalizedIdentity(receipt.identity.resolvedChainId);
  if (address) return `address:${chain ? `${chain}:` : ""}${address}`;
  const market = normalizedIdentity(receipt.identity.resolvedMarketId);
  if (market) return `market:${market.replace(/^market:/, "")}`;
  const symbol = normalizedSymbol(receipt.identity.resolvedSymbol);
  return symbol ? `symbol:${symbol}` : null;
}

/** Exact target scoping used both by the builder and downstream paid gates. */
export function pass4993SourceReceiptMatchesCanonicalIdentity(
  receipt: SourceReceipt,
  expectedCanonicalIdentity: string,
) {
  const expected = normalizedIdentity(expectedCanonicalIdentity);
  if (!expected
    || normalizedIdentity(receipt.targetCanonicalIdentity) !== expected
    || !receipt.requestedCanonicalIdentity
    || !receipt.resolvedCanonicalIdentity) return false;
  const requested = normalizedIdentity(receipt.requestedCanonicalIdentity);
  const resolved = normalizedIdentity(receipt.resolvedCanonicalIdentity);
  const resolvedAddress = normalizedAddress(receipt.resolvedIdentity?.address);
  const addressMatch = expected.match(/0x[a-f0-9]{40}/)?.[0] ?? "";
  if (addressMatch) {
    if (!resolvedAddress || resolvedAddress !== addressMatch) return false;
    const expectedChainParts = expected.split(":").slice(0, -1);
    const expectedChain = expectedChainParts.at(-1) ?? "";
    const resolvedChain = normalizedIdentity(receipt.resolvedIdentity?.chainId);
    return !resolvedChain || !expectedChain || resolvedChain === expectedChain || expected.includes(`:${resolvedChain}:`);
  }
  if (expected.startsWith("market:")) {
    const expectedMarket = expected.slice("market:".length);
    return requested === expected || resolved === expected || normalizedIdentity(receipt.resolvedIdentity?.marketId) === expectedMarket;
  }
  if (expected.startsWith("symbol:")) {
    const expectedSymbol = normalizedSymbol(expected.slice("symbol:".length));
    return normalizedSymbol(receipt.resolvedIdentity?.symbol) === expectedSymbol
      && (normalizedSymbol(requested.replace(/^symbol:/, "")) === expectedSymbol || requested === expected);
  }
  if (requested === expected || resolved === expected) return true;
  const expectedParts = expected.split(":").filter(Boolean);
  const terminal = normalizedSymbol(expectedParts.at(-1));
  const symbolMatches = Boolean(terminal
    && normalizedSymbol(receipt.resolvedIdentity?.symbol) === terminal
    && normalizedSymbol(requested.replace(/^(?:symbol|market|address):/, "")) === terminal);
  if (!symbolMatches) return false;
  // A venue/contract-qualified canonical identity (for example
  // equity:xnas:aapl) may only be issued when that qualifier came from the
  // provider receipt. The caller-supplied target itself is never evidence.
  if (expectedParts.length >= 3) {
    const qualifier = expectedParts.slice(1, -1).join(":");
    const resolvedMarket = normalizedIdentity(receipt.resolvedIdentity?.marketId);
    return Boolean(qualifier && (
      resolvedMarket === qualifier
      || resolvedMarket === `${qualifier}:${terminal}`
      || resolvedMarket.startsWith(`${qualifier}:`)
      || requested === expected
      || resolved === expected
    ));
  }
  return true;
}

function issueSourceReceiptProjection(
  receipt: SourceReceipt,
  env: Record<string, string | undefined>,
): SourceReceipt["projection"] {
  const current = currentProjectionKey(env);
  if (!current) return null;
  const canonicalPayload = canonicalJson(unsignedProjectionPayload(receipt));
  return {
    schemaVersion: PASS4993_SOURCE_RECEIPT_PROJECTION_ID,
    algorithm: "HMAC-SHA256",
    keyId: current.keyId,
    payloadDigest: sha256Digest(canonicalPayload),
    signature: projectionSignature(current.secret, canonicalPayload),
  };
}

/**
 * Verifies signature, rotation key, target identity, and the complete time
 * boundary. It is exported so a paid-delivery gate can re-verify the projection
 * instead of trusting booleans copied into a report payload.
 */
export function verifyPass4993SourceReceiptProjection(args: {
  receipt: SourceReceipt;
  expectedCanonicalIdentity: string;
  atTime: string | number | Date;
  env?: Record<string, string | undefined>;
}): Pass4993SourceReceiptProjectionVerification {
  const env = args.env ?? process.env;
  const projection = args.receipt.projection;
  if (!projection
    || projection.schemaVersion !== PASS4993_SOURCE_RECEIPT_PROJECTION_ID
    || projection.algorithm !== "HMAC-SHA256") {
    return { ok: false, error: "source_receipt_projection_missing_or_invalid" };
  }
  const keys = projectionVerificationKeys(env).filter((key) => key.keyId === projection.keyId);
  if (!keys.length) return { ok: false, error: "source_receipt_projection_key_unavailable" };
  const canonicalPayload = canonicalJson(unsignedProjectionPayload(args.receipt));
  const payloadDigest = sha256Digest(canonicalPayload);
  if (!safeEqual(payloadDigest, projection.payloadDigest)) {
    return { ok: false, error: "source_receipt_projection_payload_digest_mismatch" };
  }
  const matchedKey = keys.find((key) => safeEqual(
    projectionSignature(key.secret, canonicalPayload),
    projection.signature,
  ));
  if (!matchedKey) return { ok: false, error: "source_receipt_projection_signature_invalid" };
  if (!pass4993SourceReceiptMatchesCanonicalIdentity(args.receipt, args.expectedCanonicalIdentity)) {
    return { ok: false, error: "source_receipt_projection_identity_mismatch" };
  }
  const atMs = args.atTime instanceof Date ? args.atTime.getTime()
    : typeof args.atTime === "number" ? args.atTime : Date.parse(args.atTime);
  const observedAtMs = Date.parse(args.receipt.observedAt);
  const receivedAtMs = Date.parse(args.receipt.receivedAt ?? "");
  const expiresAtMs = Date.parse(args.receipt.expiresAt ?? "");
  if (![atMs, observedAtMs, receivedAtMs, expiresAtMs].every(Number.isFinite)) {
    return { ok: false, error: "source_receipt_projection_timestamp_invalid" };
  }
  if (observedAtMs > receivedAtMs + 120_000
    || receivedAtMs > atMs + 1_000
    || expiresAtMs < receivedAtMs
    || expiresAtMs < atMs) {
    return { ok: false, error: "source_receipt_projection_expired_or_time_inconsistent" };
  }
  if (args.receipt.identityMatched !== true
    || args.receipt.commercialEvidenceEligible !== true
    || args.receipt.providerReceiptIntegrityVerified !== true
    || args.receipt.timestampProvenance !== "provider"
    || args.receipt.providerVerification === "health_only"
    || !args.receipt.providerSurface
    || !args.receipt.providerVerification
    || !/^sha256:[a-f0-9]{64}$/i.test(args.receipt.providerReceiptCanonicalDigest ?? "")) {
    return { ok: false, error: "source_receipt_projection_commercial_claim_invalid" };
  }
  return { ok: true, keyId: matchedKey.keyId, keySlot: matchedKey.slot, payloadDigest };
}

const FAMILY_TO_SOURCE_ID: Readonly<Partial<Record<string, string>>> = Object.freeze({
  coingecko: "coingecko-market-data",
  binance: "binance-spot-depth-klines",
  mexc: "mexc-spot-depth-klines",
  dexscreener: "dexscreener-pairs",
  "dex-screener": "dexscreener-pairs",
  defillama: "defillama-protocol-stablecoin",
  scanner: "verified-chain-scanner",
  goplus: "verified-chain-scanner",
  etherscan: "verified-chain-scanner",
  bscscan: "verified-chain-scanner",
  polygonscan: "verified-chain-scanner",
  sourcify: "verified-chain-scanner",
  solscan: "verified-chain-scanner",
  yahoo: "real-markets-quote-filings",
  stooq: "real-markets-quote-filings",
  yahoo_stooq: "real-markets-quote-filings",
  finnhub: "real-markets-quote-filings",
  alphavantage: "real-markets-quote-filings",
  "alpha-vantage": "real-markets-quote-filings",
  sec: "real-markets-quote-filings",
  sec_edgar: "real-markets-quote-filings",
  velmere_internal: "velmere-deterministic-kernel",
  "velmere-internal": "velmere-deterministic-kernel",
  manual_review: "advanced-human-review",
});

const LABEL_PATTERNS: ReadonlyArray<{ pattern: RegExp; sourceId: string }> = Object.freeze([
  { pattern: /coin\s*gecko/i, sourceId: "coingecko-market-data" },
  { pattern: /binance/i, sourceId: "binance-spot-depth-klines" },
  { pattern: /\bmexc\b/i, sourceId: "mexc-spot-depth-klines" },
  { pattern: /dex\s*screener|dexscreener/i, sourceId: "dexscreener-pairs" },
  { pattern: /defi\s*llama|defillama/i, sourceId: "defillama-protocol-stablecoin" },
  { pattern: /goplus|ether\s*scan|etherscan|bscscan|polygon\s*scan|polygonscan|sourcify|solscan|chain scanner/i, sourceId: "verified-chain-scanner" },
  { pattern: /yahoo|stooq|finnhub|alpha\s*vantage|sec\s*(edgar|companyfacts)|companyfacts|xbrl/i, sourceId: "real-markets-quote-filings" },
  { pattern: /velm[eè]re.*(kernel|internal)|deterministic risk kernel/i, sourceId: "velmere-deterministic-kernel" },
  { pattern: /manual review|manual QA|operator review/i, sourceId: "advanced-human-review" },
]);

function registryById(sourceId: string): SourceRegistryEntry | undefined {
  return VELMERE_SOURCE_REGISTRY_V1.find((entry) => entry.sourceId === sourceId);
}

function normalizeFamily(value: string | null | undefined): string {
  return String(value ?? "").trim().toLowerCase().replace(/[^a-z0-9_-]+/g, "-");
}

function registryForProviderReceipt(receipt: Pass4644ProviderEvidenceReceipt): SourceRegistryEntry | undefined {
  const family = normalizeFamily(receipt.providerFamily);
  const provider = normalizeFamily(receipt.providerId);
  const direct = FAMILY_TO_SOURCE_ID[family] ?? FAMILY_TO_SOURCE_ID[provider];
  if (direct) return registryById(direct);
  const combined = `${receipt.providerFamily} ${receipt.providerId}`;
  const matched = LABEL_PATTERNS.find((entry) => entry.pattern.test(combined));
  return matched ? registryById(matched.sourceId) : undefined;
}

function registryForLabel(label: string): SourceRegistryEntry | undefined {
  const matched = LABEL_PATTERNS.find((entry) => entry.pattern.test(label));
  return matched ? registryById(matched.sourceId) : undefined;
}


function upstreamRootForProviderReceipt(receipt: Pass4644ProviderEvidenceReceipt, entry: SourceRegistryEntry): string {
  const joined = `${receipt.providerFamily} ${receipt.providerId}`.toLowerCase();
  if (entry.sourceFamily === "yahoo_stooq") {
    if (joined.includes("stooq")) return "stooq";
    if (joined.includes("yahoo")) return "yahoo";
    if (joined.includes("finnhub")) return "finnhub";
    if (joined.includes("alpha")) return "alphavantage";
  }
  return entry.sourceFamily;
}

function safeAgeSeconds(receipt: Pass4644ProviderEvidenceReceipt, generatedAtMs: number): number {
  const observedAtMs = Date.parse(receipt.observedAt);
  if (!Number.isFinite(observedAtMs)) return Number.MAX_SAFE_INTEGER;
  return Math.max(0, Math.round((generatedAtMs - observedAtMs) / 1000));
}

function sourceReceiptFromProvider(
  receipt: Pass4644ProviderEvidenceReceipt,
  entry: SourceRegistryEntry,
  generatedAtMs: number,
  targetCanonicalIdentity: string,
): SourceReceipt {
  const ageSeconds = safeAgeSeconds(receipt, generatedAtMs);
  const freshnessStatus: SourceReceipt["freshnessStatus"] = !receipt.fresh
    ? "stale"
    : ageSeconds > entry.freshnessTtlSeconds
      ? "watch"
      : "fresh";
  return {
    receiptId: receipt.receiptId,
    provider: receipt.providerId,
    sourceFamily: entry.sourceFamily,
    dataType: receipt.capabilities.length ? receipt.capabilities.join(" / ") : entry.usedFor.join(" / "),
    observedAt: receipt.observedAt,
    ageSeconds,
    freshnessStatus,
    qualityScore: entry.qualityScore,
    usedInLanes: receipt.capabilities.length ? receipt.capabilities : entry.usedFor,
    evidenceState: "content_bound",
    payloadDigest: /^sha256:/i.test(receipt.payloadHash) ? receipt.payloadHash.toLowerCase() : `sha256:${receipt.payloadHash.toLowerCase()}`,
    providerReceiptId: receipt.receiptId,
    identityMatched: receipt.identity.matched,
    commercialEvidenceEligible: isPass4644CommerciallyFreshReceipt(receipt, generatedAtMs),
    observedLabel: receipt.providerId,
    registrySourceId: entry.sourceId,
    upstreamRoot: upstreamRootForProviderReceipt(receipt, entry),
    providerReceiptCanonicalDigest: `sha256:${pass4644CanonicalReceiptDigest(receipt)}`,
    providerReceiptIntegrityVerified: verifyPass4644ProviderEvidenceReceiptIntegrity(receipt),
    timestampProvenance: receipt.timestampProvenance,
    fieldEvidence: (receipt.fieldEvidence ?? []).map((item) => ({
      fieldPath: item.fieldPath,
      capability: item.capability,
      valueHash: item.valueHash,
    })),
    targetCanonicalIdentity,
    requestedCanonicalIdentity: receipt.identity.requested,
    resolvedCanonicalIdentity: canonicalResolvedIdentity(receipt),
    resolvedIdentity: {
      symbol: receipt.identity.resolvedSymbol?.trim() || null,
      marketId: receipt.identity.resolvedMarketId?.trim() || null,
      address: receipt.identity.resolvedAddress?.trim().toLowerCase() || null,
      chainId: receipt.identity.resolvedChainId?.trim().toLowerCase() || null,
    },
    receivedAt: receipt.receivedAt,
    expiresAt: receipt.expiresAt,
    providerSurface: receipt.surface,
    providerVerification: receipt.verification,
    projection: null,
  };
}

function sourceReceiptFromLabel(label: string, entry: SourceRegistryEntry, generatedAt: string): SourceReceipt {
  return {
    receiptId: `label-only:${entry.sourceId}:${generatedAt.slice(0, 19)}Z`,
    provider: entry.label,
    sourceFamily: entry.sourceFamily,
    dataType: entry.usedFor.join(" / "),
    observedAt: generatedAt,
    ageSeconds: 0,
    freshnessStatus: "missing",
    qualityScore: Math.min(50, entry.qualityScore),
    usedInLanes: entry.usedFor,
    evidenceState: "label_only",
    payloadDigest: null,
    providerReceiptId: null,
    identityMatched: false,
    commercialEvidenceEligible: false,
    observedLabel: label,
    registrySourceId: entry.sourceId,
    upstreamRoot: null,
    providerReceiptCanonicalDigest: null,
    providerReceiptIntegrityVerified: false,
    timestampProvenance: null,
    fieldEvidence: [],
    targetCanonicalIdentity: null,
    requestedCanonicalIdentity: null,
    resolvedCanonicalIdentity: null,
    resolvedIdentity: null,
    receivedAt: null,
    expiresAt: null,
    providerSurface: null,
    providerVerification: null,
    projection: null,
  };
}

export function buildCustomerReportSourceBinding(args: {
  providerEvidenceReceipts?: Pass4644ProviderEvidenceReceipt[] | null;
  observedSourceLabels?: string[] | null;
  generatedAt: string;
  /** Mandatory target for any content-bound/paid provider projection. */
  expectedCanonicalIdentity?: string | null;
  /** Explicit injection keeps key-rotation tests deterministic. */
  projectionEnv?: Record<string, string | undefined>;
}): CustomerReportSourceBinding {
  const generatedAtMs = Date.parse(args.generatedAt);
  const providerReceipts = args.providerEvidenceReceipts ?? [];
  const normalizedLabels = Array.from(new Set((args.observedSourceLabels ?? []).map((label) => label.trim()).filter(Boolean))).slice(0, 32);
  if (!Number.isFinite(generatedAtMs)) {
    return {
      schemaVersion: PASS4818_CUSTOMER_REPORT_SOURCE_BINDING_ID,
      receipts: [],
      independentContentBoundFamilies: [],
      independentContentBoundFamilyCount: 0,
      independentContentBoundUpstreams: [],
      independentContentBoundUpstreamCount: 0,
      contentBoundReceiptCount: 0,
      labelOnlyReceiptCount: 0,
      rejectedProviderReceiptCount: providerReceipts.length,
      unmappedObservedLabels: [],
      evidenceLedgerEligible: false,
      blockers: [
        "generated_at_invalid",
        "no_content_bound_provider_receipts",
        "independent_content_bound_upstreams:0/2",
      ],
    };
  }
  const safeGeneratedAtMs = generatedAtMs;
  const expectedCanonicalIdentity = String(args.expectedCanonicalIdentity ?? "").trim();
  const projectionEnv = args.projectionEnv ?? process.env;
  const projectionReady = getPass4993SourceReceiptProjectionReadiness(projectionEnv).ready;
  const receiptsByKey = new Map<string, SourceReceipt>();
  const unmappedObservedLabels = new Set<string>();
  let rejectedProviderReceiptCount = 0;

  for (const receipt of providerReceipts) {
    const entry = registryForProviderReceipt(receipt);
    const eligible = receipt.state === "confirmed"
      && isPass4644CommerciallyFreshReceipt(receipt, safeGeneratedAtMs)
      && receipt.identity.matched
      && /^[a-f0-9]{64}$/i.test(receipt.payloadHash)
      && Boolean(expectedCanonicalIdentity)
      && projectionReady;
    if (!entry || !eligible) {
      rejectedProviderReceiptCount += 1;
      if (!entry) unmappedObservedLabels.add(`${receipt.providerFamily}:${receipt.providerId}`.slice(0, 140));
      continue;
    }
    const candidate = sourceReceiptFromProvider(receipt, entry, safeGeneratedAtMs, expectedCanonicalIdentity);
    if (!pass4993SourceReceiptMatchesCanonicalIdentity(candidate, expectedCanonicalIdentity)) {
      rejectedProviderReceiptCount += 1;
      continue;
    }
    candidate.projection = issueSourceReceiptProjection(candidate, projectionEnv);
    const projectionVerification = verifyPass4993SourceReceiptProjection({
      receipt: candidate,
      expectedCanonicalIdentity,
      atTime: safeGeneratedAtMs,
      env: projectionEnv,
    });
    if (!projectionVerification.ok) {
      rejectedProviderReceiptCount += 1;
      continue;
    }
    const key = `${entry.sourceId}:${candidate.upstreamRoot ?? receipt.providerId}`;
    const previous = receiptsByKey.get(key);
    if (!previous || candidate.ageSeconds < previous.ageSeconds) receiptsByKey.set(key, candidate);
  }

  for (const label of normalizedLabels) {
    const entry = registryForLabel(label);
    if (!entry) {
      unmappedObservedLabels.add(label.slice(0, 140));
      continue;
    }
    const hasObservedReceipt = Array.from(receiptsByKey.values()).some((receipt) => receipt.registrySourceId === entry.sourceId && receipt.evidenceState === "content_bound");
    if (!hasObservedReceipt) receiptsByKey.set(`${entry.sourceId}:label`, sourceReceiptFromLabel(label, entry, args.generatedAt));
  }

  const receipts = Array.from(receiptsByKey.values()).sort((left, right) => {
    if (left.evidenceState !== right.evidenceState) return left.evidenceState === "content_bound" ? -1 : 1;
    return left.sourceFamily.localeCompare(right.sourceFamily);
  });
  const contentBound = receipts.filter((receipt) => receipt.evidenceState === "content_bound" && receipt.commercialEvidenceEligible === true);
  const independentContentBoundFamilies = Array.from(new Set(
    contentBound
      .map((receipt) => receipt.sourceFamily)
      .filter((family) => family !== "velmere_internal" && family !== "manual_review"),
  )).sort() as VelmereSourceFamily[];
  const independentContentBoundUpstreams = Array.from(new Set(
    contentBound
      .filter((receipt) => receipt.sourceFamily !== "velmere_internal" && receipt.sourceFamily !== "manual_review")
      .map((receipt) => receipt.upstreamRoot ?? receipt.sourceFamily),
  )).sort();
  const labelOnlyReceiptCount = receipts.filter((receipt) => receipt.evidenceState === "label_only").length;
  const blockers = [
    !expectedCanonicalIdentity ? "expected_canonical_identity_missing" : null,
    !projectionReady ? "source_receipt_projection_signing_key_unavailable" : null,
    contentBound.length === 0 ? "no_content_bound_provider_receipts" : null,
    independentContentBoundUpstreams.length < 2 ? `independent_content_bound_upstreams:${independentContentBoundUpstreams.length}/2` : null,
    labelOnlyReceiptCount > 0 ? `label_only_sources_not_commercial_evidence:${labelOnlyReceiptCount}` : null,
    unmappedObservedLabels.size > 0 ? `unmapped_observed_sources:${unmappedObservedLabels.size}` : null,
  ].filter((value): value is string => Boolean(value));

  return {
    schemaVersion: PASS4818_CUSTOMER_REPORT_SOURCE_BINDING_ID,
    receipts,
    independentContentBoundFamilies,
    independentContentBoundFamilyCount: independentContentBoundFamilies.length,
    independentContentBoundUpstreams,
    independentContentBoundUpstreamCount: independentContentBoundUpstreams.length,
    contentBoundReceiptCount: contentBound.length,
    labelOnlyReceiptCount,
    rejectedProviderReceiptCount,
    unmappedObservedLabels: Array.from(unmappedObservedLabels).sort(),
    evidenceLedgerEligible: blockers.length === 0,
    blockers,
  };
}
