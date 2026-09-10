import { createHash } from "node:crypto";
import type { TokenRiskResult } from "./risk-types";
import type {
  Pass4644ProviderEvidenceReceipt,
  Pass4644ProviderFieldEvidence,
  Pass4644ProviderIdentity,
  Pass4644ProviderSurface,
  Pass4644ReceiptState,
  Pass4644ReceiptVerification,
  Pass4644TimestampProvenance,
} from "./provider-evidence-contract";

// Re-export the neutral DTO contract so existing callers keep one stable import
// boundary without maintaining a second structural copy of the receipt schema.
export type {
  Pass4644ProviderEvidenceReceipt,
  Pass4644ProviderFieldEvidence,
  Pass4644ProviderIdentity,
  Pass4644ProviderSurface,
  Pass4644ReceiptState,
  Pass4644ReceiptVerification,
  Pass4644TimestampProvenance,
} from "./provider-evidence-contract";

export type Pass4644ReceiptInput = {
  providerId: string;
  providerFamily: string;
  surface: Pass4644ProviderSurface;
  verification: Pass4644ReceiptVerification;
  state?: Pass4644ReceiptState;
  requestedIdentity: string;
  resolvedSymbol?: string;
  resolvedMarketId?: string;
  resolvedAddress?: string;
  resolvedChainId?: string;
  identityMatched: boolean;
  capabilities?: string[];
  /** Must be explicit; only `provider` plus a valid source timestamp can become commercially eligible. */
  timestampProvenance: Extract<Pass4644TimestampProvenance, "provider" | "transport_received">;
  observedAt?: string | Date | null;
  receivedAt?: string | Date | null;
  ttlMs?: number;
  httpStatus?: number;
  latencyMs?: number;
  normalizedPayload: unknown;
  rejectionReasons?: string[];
};

function parsedDate(value: string | Date | null | undefined): Date | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "string" && !value.trim()) return null;
  const parsed = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  return Number.isFinite(parsed.getTime()) ? parsed : null;
}

function stableSerialize(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableSerialize).join(",")}]`;
  const object = value as Record<string, unknown>;
  return `{${Object.keys(object).sort().map((key) => `${JSON.stringify(key)}:${stableSerialize(object[key])}`).join(",")}}`;
}

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export function pass4644FieldValueHash(value: unknown) {
  return sha256(stableSerialize(value));
}

function fieldCapability(path: string): string {
  const normalized = path.toLowerCase().replace(/[^a-z0-9]+/g, "_");
  if (/symbol|market_?id|token_?address|pair_?address|chain_?id|asset_?class/.test(normalized)) return "identity";
  if (/price_?change|change_?(?:1h|6h|24h|7d|14d|30d)|open_?price|close|sparkline|ohlc|history/.test(normalized)) return "history";
  if (/market_?cap/.test(normalized)) return "market_cap";
  if (/fdv|fully_?diluted|circulating_?supply|total_?supply|max_?supply|unlock|emission/.test(normalized)) return "supply";
  if (/volume/.test(normalized)) return "volume";
  if (/liquidity|tvl|pool/.test(normalized)) return "liquidity";
  if (/slippage/.test(normalized)) return "slippage";
  if (/orderbook|best_?bid|best_?ask|spread|bid_?depth|ask_?depth|imbalance/.test(normalized)) return "orderbook";
  if (/holder|owner|ownership|whale/.test(normalized)) return "holders";
  if (/tax|honeypot|blacklist|mint|permission|proxy|upgrade|abi|source_?code|bytecode/.test(normalized)) return "contract_permissions";
  if (/filing|fundamental|earnings|balance_?sheet|cash_?flow/.test(normalized)) return "fundamentals";
  if (/funding|open_?interest|liquidation|long_?short|derivative/.test(normalized)) return "derivatives";
  if (/(^|_)price(?:_|$)|last_?price|price_?usd|quote/.test(normalized)) return "price";
  return "unclassified";
}

function buildFieldEvidence(payload: unknown): Pass4644ProviderFieldEvidence[] {
  const rows: Pass4644ProviderFieldEvidence[] = [];
  const seen = new Set<string>();
  const visit = (value: unknown, path: string, depth: number) => {
    if (rows.length >= 96 || depth > 6) return;
    if (value === undefined || typeof value === "function" || typeof value === "symbol" || typeof value === "bigint") return;
    if (value === null || typeof value !== "object" || Array.isArray(value)) {
      if (!path) return;
      const fieldPath = path.slice(0, 180);
      const key = `${fieldPath}:${pass4644FieldValueHash(value)}`;
      if (seen.has(key)) return;
      seen.add(key);
      rows.push({ fieldPath, capability: fieldCapability(fieldPath), valueHash: pass4644FieldValueHash(value) });
      return;
    }
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      const cleanKey = key.replace(/[^A-Za-z0-9_.-]+/g, "_").slice(0, 80);
      visit((value as Record<string, unknown>)[key], path ? `${path}.${cleanKey}` : cleanKey, depth + 1);
    }
  };
  visit(payload, "", 0);
  return rows.sort((left, right) => left.fieldPath.localeCompare(right.fieldPath) || left.valueHash.localeCompare(right.valueHash));
}

function cleanIdentity(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9:.^=\-_/]+/g, "").slice(0, 180);
}

function symbolIdentity(value: string | null | undefined) {
  return String(value ?? "").trim().toUpperCase().replace(/[^A-Z0-9.^=/-]+/g, "").replace(/-USD$/, "");
}

function marketIdentity(value: string | null | undefined) {
  return cleanIdentity(String(value ?? "")).replace(/-usd$/, "");
}

function addressIdentity(value: string | null | undefined) {
  const normalized = String(value ?? "").trim().toLowerCase();
  return /^0x[a-f0-9]{40}$/.test(normalized) ? normalized : "";
}

type Pass4644ReceiptIdFields = Omit<Pass4644ProviderEvidenceReceipt, "receiptId" | "continuity">;

function pass4644ReceiptId(fields: Pass4644ReceiptIdFields) {
  return `p4644_${sha256(stableSerialize({
    schemaVersion: fields.schemaVersion,
    providerId: fields.providerId,
    providerFamily: fields.providerFamily,
    surface: fields.surface,
    verification: fields.verification,
    state: fields.state,
    identity: {
      requested: fields.identity.requested,
      resolvedSymbol: fields.identity.resolvedSymbol ?? null,
      resolvedMarketId: fields.identity.resolvedMarketId ?? null,
      resolvedAddress: fields.identity.resolvedAddress ?? null,
      resolvedChainId: fields.identity.resolvedChainId ?? null,
      matched: fields.identity.matched,
    },
    capabilities: Array.from(new Set(fields.capabilities)).sort(),
    fieldEvidence: (fields.fieldEvidence ?? []).map((item) => ({
      fieldPath: item.fieldPath,
      capability: item.capability,
      valueHash: item.valueHash,
    })).sort((left, right) => left.fieldPath.localeCompare(right.fieldPath) || left.valueHash.localeCompare(right.valueHash)),
    timestampProvenance: fields.timestampProvenance,
    observedAt: fields.observedAt,
    receivedAt: fields.receivedAt,
    expiresAt: fields.expiresAt,
    freshnessMs: fields.freshnessMs,
    fresh: fields.fresh,
    httpStatus: fields.httpStatus,
    latencyMs: fields.latencyMs,
    payloadBytes: fields.payloadBytes,
    payloadHash: fields.payloadHash,
    commercialEvidenceEligible: fields.commercialEvidenceEligible,
    rejectionReasons: Array.from(new Set(fields.rejectionReasons)).sort(),
  })).slice(0, 24)}`;
}

/** Detects mutation of capabilities, transport facts, field hashes or state. */
export function verifyPass4644ProviderEvidenceReceiptIntegrity(
  receipt: Pass4644ProviderEvidenceReceipt,
): boolean {
  if (receipt.schemaVersion !== "pass4644_provider_evidence_receipt_v1") return false;
  const { receiptId, continuity: _continuity, ...fields } = receipt;
  return receiptId === pass4644ReceiptId(fields);
}

export function verifyPass4644ProviderIdentity(args: {
  requested: string;
  resolvedSymbol?: string | null;
  resolvedMarketId?: string | null;
  resolvedAddress?: string | null;
  assertedMatched?: boolean;
}) {
  const requestedRaw = String(args.requested ?? "").trim();
  const requestedMarket = marketIdentity(requestedRaw);
  const requestedSymbol = symbolIdentity(requestedRaw.replace(/^symbol:/i, ""));
  const requestedAddress = addressIdentity(requestedRaw.replace(/^address:/i, ""));
  const resolvedSymbol = symbolIdentity(args.resolvedSymbol);
  const resolvedMarketId = marketIdentity(args.resolvedMarketId);
  const resolvedAddress = addressIdentity(args.resolvedAddress);
  const explicitMarketRequest = /^market:/i.test(requestedRaw);
  const explicitSymbolRequest = /^symbol:/i.test(requestedRaw);
  const explicitAddressRequest = /^address:/i.test(requestedRaw) || Boolean(requestedAddress);
  const compactRequest = requestedRaw.replace(/^symbol:/i, "");
  const symbolLikeRequest = explicitSymbolRequest || (
    !explicitMarketRequest
    && !explicitAddressRequest
    && /^[a-zA-Z0-9.^=/-]{1,12}$/.test(compactRequest)
    && (compactRequest.length <= 6 || compactRequest === compactRequest.toUpperCase() || /[.^=/-]/.test(compactRequest))
  );
  let matched: boolean;
  let namespace: "symbol" | "market" | "address" | "unresolved";
  if (explicitAddressRequest) {
    namespace = "address";
    matched = Boolean(requestedAddress && resolvedAddress && requestedAddress === resolvedAddress);
  } else if (explicitMarketRequest || (resolvedMarketId && (requestedMarket === resolvedMarketId || requestedMarket.replace(/^market:/, "") === resolvedMarketId))) {
    namespace = "market";
    const expectedMarket = marketIdentity(requestedRaw.replace(/^market:/i, ""));
    matched = Boolean(expectedMarket && resolvedMarketId && expectedMarket === resolvedMarketId);
  } else if (symbolLikeRequest) {
    namespace = "symbol";
    matched = Boolean(requestedSymbol && resolvedSymbol && requestedSymbol === resolvedSymbol);
  } else if (resolvedMarketId) {
    namespace = "market";
    const expectedMarket = marketIdentity(requestedRaw.replace(/^market:/i, ""));
    matched = Boolean(expectedMarket && resolvedMarketId && expectedMarket === resolvedMarketId);
  } else {
    matched = Boolean(requestedSymbol && resolvedSymbol && requestedSymbol === resolvedSymbol);
    namespace = matched ? "symbol" : "unresolved";
  }
  if (args.assertedMatched === true) matched = true;
  else if (args.assertedMatched === false) matched = false;
  return {
    matched,
    namespace,
    normalized: {
      requested: requestedMarket,
      resolvedSymbol: resolvedSymbol || null,
      resolvedMarketId: resolvedMarketId || null,
      resolvedAddress: resolvedAddress || null,
    },
  } as const;
}

export function createPass4644ProviderEvidenceReceipt(input: Pass4644ReceiptInput): Pass4644ProviderEvidenceReceipt {
  const receivedInputSupplied = input.receivedAt !== null
    && input.receivedAt !== undefined
    && !(typeof input.receivedAt === "string" && !input.receivedAt.trim());
  const parsedReceived = parsedDate(input.receivedAt);
  // A receipt is evidence about an observed transport, not an opportunity to
  // manufacture transport metadata.  Epoch is an explicit fail-closed
  // sentinel for legacy/diagnostic callers; commercial receipts must supply a
  // valid receivedAt value and a measured latency.
  const received = parsedReceived ?? new Date(0);
  const receivedTimestampMissing = !receivedInputSupplied;
  const receivedTimestampInvalid = receivedInputSupplied && !parsedReceived;
  const latencyInputSupplied = input.latencyMs !== null && input.latencyMs !== undefined;
  const latencyValid = latencyInputSupplied
    && Number.isFinite(input.latencyMs)
    && Number(input.latencyMs) >= 0;
  const observedInputSupplied = input.observedAt !== null
    && input.observedAt !== undefined
    && !(typeof input.observedAt === "string" && !input.observedAt.trim());
  const parsedObserved = parsedDate(input.observedAt);
  const timestampProvenance: Pass4644TimestampProvenance = observedInputSupplied && !parsedObserved
    ? "invalid"
    : input.timestampProvenance === "transport_received"
      ? "transport_received"
      : input.timestampProvenance === "provider" && parsedObserved
        ? "provider"
        : "missing";
  const observed = parsedObserved ?? (timestampProvenance === "transport_received" ? received : null);
  const ttlMs = Math.max(5_000, Math.min(input.ttlMs ?? 5 * 60_000, 24 * 60 * 60_000));
  const expires = new Date((observed ?? received).getTime() + ttlMs);
  const nowMs = received.getTime();
  const freshnessMs = timestampProvenance === "provider" && observed
    ? Math.max(0, nowMs - observed.getTime())
    : null;
  const futureObserved = Boolean(observed && observed.getTime() > nowMs + 120_000);
  const fresh = timestampProvenance === "provider"
    && Boolean(observed)
    && expires.getTime() >= nowMs
    && !futureObserved
    && !receivedTimestampInvalid;
  const serialized = stableSerialize(input.normalizedPayload);
  const payloadBytes = Buffer.byteLength(serialized, "utf8");
  const payloadHash = sha256(serialized);
  const fieldEvidence = buildFieldEvidence(input.normalizedPayload);
  const httpStatus = Number.isFinite(input.httpStatus) ? Number(input.httpStatus) : 200;
  // -1 is the schema's explicit unavailable sentinel.  It cannot be confused
  // with a real sub-millisecond/zero-millisecond measurement.
  const latencyMs = latencyValid ? Math.round(Number(input.latencyMs)) : -1;
  const requestedState = input.state ?? "confirmed";
  const transportMetadataInvalid = receivedTimestampMissing || receivedTimestampInvalid || !latencyValid;
  const state = requestedState === "confirmed" && transportMetadataInvalid ? "rejected" : requestedState;
  const identityVerification = verifyPass4644ProviderIdentity({
    requested: input.requestedIdentity,
    resolvedSymbol: input.resolvedSymbol,
    resolvedMarketId: input.resolvedMarketId,
    resolvedAddress: input.resolvedAddress,
    assertedMatched: input.identityMatched,
  });
  const identity: Pass4644ProviderIdentity = {
    requested: cleanIdentity(input.requestedIdentity),
    resolvedSymbol: input.resolvedSymbol?.trim().toUpperCase(),
    resolvedMarketId: input.resolvedMarketId?.trim().toLowerCase(),
    resolvedAddress: input.resolvedAddress?.trim().toLowerCase(),
    resolvedChainId: input.resolvedChainId?.trim().toLowerCase(),
    matched: identityVerification.matched,
  };
  const rejectionReasons = Array.from(new Set([
    ...(input.rejectionReasons ?? []),
    !identity.matched ? "asset_identity_mismatch" : null,
    timestampProvenance === "missing" && !observedInputSupplied ? "provider_timestamp_missing" : null,
    timestampProvenance === "missing" && observedInputSupplied ? "provider_timestamp_provenance_missing" : null,
    timestampProvenance === "invalid" ? "provider_timestamp_invalid" : null,
    timestampProvenance === "transport_received" ? "provider_timestamp_not_source_bound" : null,
    receivedTimestampMissing ? "receipt_received_at_missing" : null,
    receivedTimestampInvalid ? "receipt_received_at_invalid" : null,
    !latencyInputSupplied ? "receipt_latency_missing" : null,
    latencyInputSupplied && !latencyValid ? "receipt_latency_invalid" : null,
    futureObserved ? "provider_timestamp_from_future" : null,
    timestampProvenance === "provider" && !fresh && !futureObserved ? "stale_provider_response" : null,
    httpStatus < 200 || httpStatus >= 300 ? `http_status_${httpStatus}` : null,
    payloadBytes <= 2 ? "empty_provider_payload" : null,
    state === "rejected" ? "provider_receipt_rejected" : null,
  ].filter((value): value is string => Boolean(value))));
  const commercialEvidenceEligible =
    input.verification !== "health_only" &&
    state === "confirmed" &&
    identity.matched &&
    fresh &&
    httpStatus >= 200 &&
    httpStatus < 300 &&
    payloadBytes > 2 &&
    rejectionReasons.length === 0;
  const receiptFields: Pass4644ReceiptIdFields = {
    schemaVersion: "pass4644_provider_evidence_receipt_v1",
    providerId: input.providerId,
    providerFamily: input.providerFamily,
    surface: input.surface,
    verification: input.verification,
    state,
    identity,
    capabilities: Array.from(new Set((input.capabilities ?? []).map((item) => item.trim()).filter(Boolean))).sort(),
    fieldEvidence,
    timestampProvenance,
    observedAt: observed?.toISOString() ?? "",
    receivedAt: received.toISOString(),
    expiresAt: expires.toISOString(),
    freshnessMs,
    fresh,
    httpStatus,
    latencyMs,
    payloadBytes,
    payloadHash,
    commercialEvidenceEligible,
    rejectionReasons,
  };
  return { ...receiptFields, receiptId: pass4644ReceiptId(receiptFields) };
}

export function attachPass4644ProviderReceipts<T extends TokenRiskResult>(result: T, receipts: Pass4644ProviderEvidenceReceipt[]): T {
  const unique = new Map<string, Pass4644ProviderEvidenceReceipt>();
  for (const receipt of result.providerEvidenceReceipts ?? []) unique.set(receipt.receiptId, receipt);
  for (const receipt of receipts) unique.set(receipt.receiptId, receipt);
  result.providerEvidenceReceipts = Array.from(unique.values());
  return result;
}

/** Canonical content digest used to bind every evidence-bearing receipt field into ledgers/replay. */
export function pass4644CanonicalReceiptDigest(receipt: Pass4644ProviderEvidenceReceipt): string {
  return sha256(stableSerialize({
    schemaVersion: receipt.schemaVersion,
    receiptId: receipt.receiptId,
    providerId: receipt.providerId,
    providerFamily: receipt.providerFamily,
    surface: receipt.surface,
    verification: receipt.verification,
    state: receipt.state,
    identity: {
      requested: receipt.identity.requested,
      resolvedSymbol: receipt.identity.resolvedSymbol ?? null,
      resolvedMarketId: receipt.identity.resolvedMarketId ?? null,
      resolvedAddress: receipt.identity.resolvedAddress ?? null,
      resolvedChainId: receipt.identity.resolvedChainId ?? null,
      matched: receipt.identity.matched,
    },
    capabilities: Array.from(new Set(receipt.capabilities)).sort(),
    fieldEvidence: (receipt.fieldEvidence ?? []).map((item) => ({
      fieldPath: item.fieldPath,
      capability: item.capability,
      valueHash: item.valueHash,
    })).sort((left, right) => left.fieldPath.localeCompare(right.fieldPath) || left.valueHash.localeCompare(right.valueHash)),
    timestampProvenance: receipt.timestampProvenance,
    observedAt: receipt.observedAt,
    receivedAt: receipt.receivedAt,
    expiresAt: receipt.expiresAt,
    freshnessMs: receipt.freshnessMs,
    fresh: receipt.fresh,
    httpStatus: receipt.httpStatus,
    latencyMs: receipt.latencyMs,
    payloadBytes: receipt.payloadBytes,
    payloadHash: receipt.payloadHash,
    commercialEvidenceEligible: receipt.commercialEvidenceEligible,
    rejectionReasons: Array.from(new Set(receipt.rejectionReasons)).sort(),
    continuity: receipt.continuity ?? null,
  }));
}

/**
 * Central fail-closed commercial freshness predicate. It deliberately rejects
 * legacy/deserialized receipts that do not carry explicit provider timestamp provenance.
 */
export function isPass4644CommerciallyFreshReceipt(
  receipt: Pass4644ProviderEvidenceReceipt,
  now?: Date | number,
): boolean {
  if (!verifyPass4644ProviderEvidenceReceiptIntegrity(receipt)
    || receipt.commercialEvidenceEligible !== true
    || receipt.timestampProvenance !== "provider"
    || receipt.fresh !== true
    || receipt.state !== "confirmed"
    || receipt.verification === "health_only"
    || receipt.identity.matched !== true
    || receipt.httpStatus < 200
    || receipt.httpStatus >= 300
    || receipt.payloadBytes <= 2
    || !/^[a-f0-9]{64}$/i.test(receipt.payloadHash)
    || receipt.rejectionReasons.length > 0
    || Boolean(receipt.continuity)) return false;
  if (!verifyPass4644ProviderIdentity({
    requested: receipt.identity.requested,
    resolvedSymbol: receipt.identity.resolvedSymbol,
    resolvedMarketId: receipt.identity.resolvedMarketId,
    resolvedAddress: receipt.identity.resolvedAddress,
    assertedMatched: receipt.identity.matched,
  }).matched) return false;
  const observedMs = Date.parse(receipt.observedAt);
  const receivedMs = Date.parse(receipt.receivedAt);
  const expiresMs = Date.parse(receipt.expiresAt);
  if (![observedMs, receivedMs, expiresMs].every(Number.isFinite)) return false;
  const expectedFreshnessMs = Math.max(0, receivedMs - observedMs);
  if (!Number.isFinite(receipt.freshnessMs)
    || receipt.freshnessMs !== expectedFreshnessMs
    || observedMs > receivedMs + 120_000
    || expiresMs < observedMs
    || expiresMs < receivedMs) return false;
  if (now !== undefined) {
    const nowMs = now instanceof Date ? now.getTime() : now;
    if (!Number.isFinite(nowMs) || observedMs > nowMs + 120_000 || expiresMs < nowMs) return false;
  }
  return true;
}

export function summarizePass4644ProviderReceipts(
  receipts: Pass4644ProviderEvidenceReceipt[] | null | undefined,
  now?: Date | number,
) {
  const rows = receipts ?? [];
  const eligible = rows.filter((receipt) => isPass4644CommerciallyFreshReceipt(receipt, now));
  const confirmed = eligible.filter((receipt) => receipt.state === "confirmed");
  const families = Array.from(new Set(confirmed.map((receipt) => receipt.providerFamily)));
  const providers = Array.from(new Set(confirmed.map((receipt) => receipt.providerId)));
  const capabilities = Array.from(new Set(confirmed.flatMap((receipt) => receipt.capabilities)));
  return {
    schemaVersion: "pass4644_provider_evidence_summary_v1",
    receiptCount: rows.length,
    confirmedCommercialReceiptCount: confirmed.length,
    providerCount: providers.length,
    providerFamilyCount: families.length,
    providers,
    providerFamilies: families,
    capabilityCount: capabilities.length,
    capabilities,
    rejectedReceiptCount: rows.filter((receipt) => receipt.state === "rejected" || receipt.rejectionReasons.length > 0).length,
    staleReceiptCount: rows.filter((receipt) => !receipt.fresh).length,
    identityMismatchCount: rows.filter((receipt) => !receipt.identity.matched).length,
    healthOnlyReceiptCount: rows.filter((receipt) => receipt.verification === "health_only").length,
    providerTimestampReceiptCount: rows.filter((receipt) => receipt.timestampProvenance === "provider").length,
    transportTimestampReceiptCount: rows.filter((receipt) => receipt.timestampProvenance === "transport_received").length,
    missingProviderTimestampCount: rows.filter((receipt) => receipt.timestampProvenance === "missing").length,
    invalidProviderTimestampCount: rows.filter((receipt) => receipt.timestampProvenance === "invalid").length,
  } as const;
}

export function pass4644IdentityMatches(requested: string, resolved: { symbol?: string; marketId?: string; address?: string }) {
  return verifyPass4644ProviderIdentity({
    requested,
    resolvedSymbol: resolved.symbol,
    resolvedMarketId: resolved.marketId,
    resolvedAddress: resolved.address,
    assertedMatched: true,
  }).matched;
}
