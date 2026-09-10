import { C0_C1_OR_BIDI_PATTERN } from "../security/ascii-control-characters";

import type { TokenRiskResult } from "./risk-types";
import {
  isPass4644CommerciallyFreshReceipt,
  pass4644FieldValueHash,
  verifyPass4644ProviderEvidenceReceiptIntegrity,
} from "./provider-evidence-receipt";
import type { Pass4644ProviderEvidenceReceipt } from "./provider-evidence-receipt";

const ALLOWED_KEYS = new Set(["query", "locale"]);
const CONTROL_OR_BIDI = C0_C1_OR_BIDI_PATTERN;
const EVM_ADDRESS = /^(?:address:)?(0[xX][a-fA-F0-9]{40})$/u;
const SAFE_IDENTITY_QUERY = /^[A-Za-z0-9][A-Za-z0-9 .^=/_:-]*$/u;
const RECEIPT_CLOCK_SKEW_MS = 120_000;

export type ShieldMapQuery = {
  query: string;
  locale: "pl" | "en" | "de";
  quote: "USD";
  namespace: "address" | "symbol_or_market";
  requestedAddress: string | null;
};

function safeIdentityQuery(value: string) {
  return value.normalize("NFKC") === value
    && SAFE_IDENTITY_QUERY.test(value)
    && !value.includes("%");
}

function receiptRequestedIdentity(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9:.^=\-_/]+/gu, "").slice(0, 180);
}

function normalizedSymbol(value: string | null | undefined) {
  const normalized = String(value ?? "").trim().toUpperCase();
  return /^[A-Z0-9.^=/-]{1,32}$/u.test(normalized) ? normalized : "";
}

function normalizedMarketId(value: string | null | undefined) {
  const normalized = String(value ?? "").trim().toLowerCase();
  return /^[a-z0-9][a-z0-9._/-]{0,119}$/u.test(normalized) ? normalized : "";
}

function normalizedChainId(value: string | null | undefined) {
  const normalized = String(value ?? "").trim().toLowerCase();
  return /^[a-z0-9][a-z0-9._:-]{0,79}$/u.test(normalized) ? normalized : "";
}

function normalizedAddress(value: string | null | undefined) {
  const normalized = String(value ?? "").trim().toLowerCase();
  return /^0x[a-f0-9]{40}$/u.test(normalized) ? normalized : "";
}

function verificationNowMs(now: Date | number | string | undefined) {
  if (now instanceof Date) return now.getTime();
  if (typeof now === "number") return now;
  if (typeof now === "string") return Date.parse(now);
  return Date.now();
}

function fieldPaths(receipt: Pass4644ProviderEvidenceReceipt) {
  return new Set((receipt.fieldEvidence ?? []).map((row) => row.fieldPath));
}

function hasFieldValue(
  receipt: Pass4644ProviderEvidenceReceipt,
  fieldPath: string,
  values: unknown[],
) {
  const hashes = new Set(values.map((value) => pass4644FieldValueHash(value)));
  return (receipt.fieldEvidence ?? []).some((row) =>
    row.fieldPath === fieldPath && hashes.has(row.valueHash),
  );
}

function isDirectQueryReceipt(
  namespace: ShieldMapQuery["namespace"],
  receipt: Pass4644ProviderEvidenceReceipt,
) {
  const paths = fieldPaths(receipt);
  if (namespace === "address") {
    return receipt.providerId === "dexscreener"
      && receipt.providerFamily === "dex_market"
      && receipt.surface === "crypto"
      && paths.has("tokenAddress")
      && paths.has("chainId")
      && paths.has("symbol")
      && paths.has("priceUsd");
  }
  return receipt.providerId === "coingecko"
    && receipt.providerFamily === "market_data"
    && receipt.surface === "crypto"
    && paths.has("id")
    && paths.has("symbol")
    && paths.has("price");
}

function isCurrentDirectReceipt(
  receipt: Pass4644ProviderEvidenceReceipt,
  nowMs: number,
) {
  if (!verifyPass4644ProviderEvidenceReceiptIntegrity(receipt)
    || receipt.identity?.matched !== true
    || receipt.state !== "confirmed"
    || receipt.verification === "health_only"
    || receipt.httpStatus < 200
    || receipt.httpStatus >= 300
    || receipt.payloadBytes <= 2
    || Boolean(receipt.continuity)) {
    return false;
  }
  if (receipt.timestampProvenance === "provider") {
    return isPass4644CommerciallyFreshReceipt(receipt, nowMs);
  }
  if (receipt.timestampProvenance !== "transport_received"
    || receipt.fresh !== false
    || receipt.commercialEvidenceEligible !== false
    || receipt.rejectionReasons.length !== 1
    || receipt.rejectionReasons[0] !== "provider_timestamp_not_source_bound") {
    return false;
  }
  const observedMs = Date.parse(receipt.observedAt);
  const receivedMs = Date.parse(receipt.receivedAt);
  const expiresMs = Date.parse(receipt.expiresAt);
  return [observedMs, receivedMs, expiresMs].every(Number.isFinite)
    && observedMs <= receivedMs + RECEIPT_CLOCK_SKEW_MS
    && receivedMs <= nowMs + RECEIPT_CLOCK_SKEW_MS
    && expiresMs >= receivedMs
    && expiresMs >= nowMs;
}

function identityAndQuoteMatch(
  query: ShieldMapQuery,
  result: TokenRiskResult,
  receipt: Pass4644ProviderEvidenceReceipt,
) {
  const resultSymbol = normalizedSymbol(result.token.symbol);
  const currentPrice = result.metrics.currentPrice;
  if (!resultSymbol || !Number.isFinite(currentPrice) || Number(currentPrice) <= 0) {
    return false;
  }
  if (query.namespace === "address") {
    const resultAddress = normalizedAddress(result.token.tokenAddress);
    const resultChainId = normalizedChainId(result.token.chainId);
    if (!resultAddress || !resultChainId
      || resultAddress !== query.requestedAddress
      || normalizedAddress(receipt.identity.resolvedAddress) !== resultAddress
      || normalizedChainId(receipt.identity.resolvedChainId) !== resultChainId
      || normalizedSymbol(receipt.identity.resolvedSymbol) !== resultSymbol) {
      return false;
    }
    return hasFieldValue(receipt, "tokenAddress", [result.token.tokenAddress, resultAddress])
      && hasFieldValue(receipt, "chainId", [result.token.chainId, resultChainId])
      && hasFieldValue(receipt, "symbol", [result.token.symbol, resultSymbol])
      && hasFieldValue(receipt, "priceUsd", [currentPrice, String(currentPrice)]);
  }
  const resultMarketId = normalizedMarketId(result.token.marketId);
  if (!resultMarketId
    || normalizedMarketId(receipt.identity.resolvedMarketId) !== resultMarketId
    || normalizedSymbol(receipt.identity.resolvedSymbol) !== resultSymbol) {
    return false;
  }
  return hasFieldValue(receipt, "id", [result.token.marketId, resultMarketId])
    && hasFieldValue(receipt, "symbol", [result.token.symbol, resultSymbol])
    && hasFieldValue(receipt, "price", [currentPrice]);
}

export function parseShieldMapQuery(url: URL):
  | { ok: true; value: ShieldMapQuery }
  | { ok: false; status: 400 | 414; code: string } {
  if (Buffer.byteLength(url.toString(), "utf8") > 2048) {
    return { ok: false, status: 414, code: "shield_map_url_too_large" };
  }
  const keys = Array.from(url.searchParams.keys());
  if (keys.some((key) => !ALLOWED_KEYS.has(key))) {
    return { ok: false, status: 400, code: "shield_map_unknown_query_parameter" };
  }
  if (Array.from(ALLOWED_KEYS).some((key) => url.searchParams.getAll(key).length > 1)) {
    return { ok: false, status: 400, code: "shield_map_duplicate_query_parameter" };
  }
  const rawQuery = String(url.searchParams.get("query") ?? "");
  const query = rawQuery.trim().replace(/\s+/gu, " ");
  const queryBytes = Buffer.byteLength(query, "utf8");
  if (!query
    || queryBytes > 120
    || CONTROL_OR_BIDI.test(rawQuery)
    || !safeIdentityQuery(query)) {
    return { ok: false, status: 400, code: "shield_map_query_invalid" };
  }
  const localeRaw = String(url.searchParams.get("locale") ?? "pl").trim();
  if (!(["pl", "en", "de"] as const).includes(localeRaw as "pl" | "en" | "de")) {
    return { ok: false, status: 400, code: "shield_map_locale_invalid" };
  }
  const addressMatch = query.match(EVM_ADDRESS);
  return {
    ok: true,
    value: {
      query,
      locale: localeRaw as "pl" | "en" | "de",
      quote: "USD",
      namespace: addressMatch ? "address" : "symbol_or_market",
      requestedAddress: addressMatch?.[1]?.toLowerCase() ?? null,
    },
  };
}

export function verifyShieldMapResolvedIdentity(
  query: ShieldMapQuery,
  result: TokenRiskResult,
  options: { now?: Date | number | string } = {},
) {
  if (!safeIdentityQuery(query.query) || query.quote !== "USD") {
    return { ok: false as const, code: "shield_map_query_identity_invalid" };
  }
  const nowMs = verificationNowMs(options.now);
  if (!Number.isFinite(nowMs)) {
    return { ok: false as const, code: "shield_map_identity_clock_invalid" };
  }
  const expectedRequested = receiptRequestedIdentity(query.query);
  const directReceipts = (result.providerEvidenceReceipts ?? []).filter((receipt) =>
    verifyPass4644ProviderEvidenceReceiptIntegrity(receipt)
      && isDirectQueryReceipt(query.namespace, receipt),
  );
  if (!directReceipts.length) {
    return { ok: false as const, code: "shield_map_identity_unverified" };
  }
  const requestedReceipts = directReceipts.filter((receipt) =>
    receipt.identity.requested === expectedRequested,
  );
  if (!requestedReceipts.length) {
    return { ok: false as const, code: "shield_map_identity_query_mismatch" };
  }
  const currentReceipts = requestedReceipts.filter((receipt) =>
    isCurrentDirectReceipt(receipt, nowMs),
  );
  if (!currentReceipts.length) {
    return { ok: false as const, code: "shield_map_identity_stale" };
  }
  const exactMatches = currentReceipts.filter((receipt) =>
    identityAndQuoteMatch(query, result, receipt),
  );
  if (exactMatches.length !== currentReceipts.length) {
    return { ok: false as const, code: "shield_map_identity_conflict" };
  }
  if (exactMatches.length !== 1) {
    return { ok: false as const, code: "shield_map_identity_ambiguous" };
  }
  const matched = exactMatches[0];
  if (query.namespace === "address") {
    return {
      ok: true as const,
      namespace: "address" as const,
      providerId: matched.providerId,
      providerFamily: matched.providerFamily,
      requested: expectedRequested,
      resolvedAddress: normalizedAddress(matched.identity.resolvedAddress),
      resolvedChainId: normalizedChainId(matched.identity.resolvedChainId),
      resolvedSymbol: normalizedSymbol(matched.identity.resolvedSymbol),
      resolvedQuote: query.quote,
      receiptId: matched.receiptId,
    };
  }
  return {
    ok: true as const,
    namespace: "symbol_or_market" as const,
    providerId: matched.providerId,
    providerFamily: matched.providerFamily,
    requested: expectedRequested,
    resolvedMarketId: normalizedMarketId(matched.identity.resolvedMarketId),
    resolvedSymbol: normalizedSymbol(matched.identity.resolvedSymbol),
    resolvedQuote: query.quote,
    receiptId: matched.receiptId,
  };
}

export function shieldMapTierState() {
  return {
    schemaVersion: "velmere.shield-map.tier-state.v1",
    requestedTier: "basic" as const,
    deliveredTier: "basic" as const,
    serverAuthoritative: true,
    deepDivePresentationOnly: true,
    vlmDepth: "basic" as const,
    pro: "blocked_requires_account_bound_server_entitlement",
    advanced: "blocked_requires_account_bound_server_entitlement_and_evidence_floor",
    rule: "The local deep-dive toggle changes presentation only and never promotes paid analysis depth.",
  };
}
