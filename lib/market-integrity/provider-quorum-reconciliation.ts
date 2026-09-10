import { createHash } from "node:crypto";
import {
  buildPass460ProviderConsensus,
  type Pass460ConsensusState,
  type Pass460FreshnessState,
} from "@/lib/market-integrity/provider-consensus";
import type { Pass458TruthAssetClass } from "@/lib/market-integrity/provider-truth-router";

export type ProviderQuorumIdentity = {
  assetId: string;
  quoteCurrency: string;
  observationWindow: string;
};

export type ProviderQuorumObservation = {
  providerId: string;
  /** Root organization when known. Generic capability labels are not independent roots. */
  providerFamily?: string | null;
  resolvedAssetId?: string | null;
  resolvedSymbol?: string | null;
  quoteCurrency?: string | null;
  observationWindow?: string | null;
  source: string;
  price: number | null | undefined;
  sourceTimestamp: number | null | undefined;
  /** Transport completion time measured by the adapter that produced this observation. */
  receivedAt?: string | null;
  /** Measured end-to-end adapter latency; absent is not equivalent to zero. */
  latencyMs?: number | null;
  evidenceEligible?: boolean;
  status?: string | null;
  valueSha256?: string | null;
};

export type ProviderQuorumComparability =
  | "exact_window"
  | "reference_window"
  | "not_comparable"
  | "single_source"
  | "unavailable";

export type ProviderQuorumReconciliation = {
  schemaVersion: "velmere.provider-quorum-reconciliation.v1";
  state: Pass460ConsensusState;
  freshnessState: Pass460FreshnessState;
  comparability: ProviderQuorumComparability;
  /** Usable transport lanes; this is not an independence count. */
  sourceCount: number;
  /** Distinct canonical upstream organizations among usable lanes. */
  independentSourceCount: number;
  providerRootFamilies: string[];
  identityAligned: boolean;
  expectedIdentity: ProviderQuorumIdentity | null;
  selectedProviderId: string | null;
  selectedPrice: number | null;
  primaryPrice: number | null;
  secondaryPrice: number | null;
  secondarySource: string | null;
  timestampSkewSeconds: number | null;
  divergenceBps: number | null;
  divergenceThresholdBps: number;
  confidenceCap: number;
  freshPaidEvidenceEligible: boolean;
  strongClaimEligible: boolean;
  observationDigest: string;
  reasons: string[];
};

const EXACT_WINDOW_SECONDS = 15 * 60;
const REFERENCE_WINDOW_SECONDS = 36 * 60 * 60;
const MAX_FUTURE_SKEW_SECONDS = 5 * 60;
const GENERIC_PROVIDER_FAMILIES = new Set([
  "provider",
  "market",
  "market_data",
  "market_data_secondary",
  "data_provider",
  "quote_provider",
  "real_markets_provider",
  "cex_microstructure",
  "exchange_market",
  "exchange_data",
  "dex_market",
  "contract_risk",
  "contract_security",
  "protocol_fundamentals",
  "fundamentals",
  "fundamentals_data",
  "derivatives",
  "derivatives_data",
  "onchain",
  "onchain_data",
  "holder_data",
  "liquidity_data",
  "market_metadata",
  "market_intelligence",
  "security_flags",
  "audit_provider",
  "unknown",
  "unknown_provider",
  "rejected_unknown_family",
]);

function finitePositive(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function validTimestamp(value: unknown, nowSeconds: number): value is number {
  return typeof value === "number"
    && Number.isFinite(value)
    && value > 0
    && value <= nowSeconds + MAX_FUTURE_SKEW_SECONDS;
}

function cleanToken(value: unknown, casing: "upper" | "lower"): string {
  const cleaned = String(value ?? "")
    .trim()
    .replace(/\s+/g, "")
    .replace(/[^a-zA-Z0-9:._^=/-]/g, "")
    .slice(0, 180);
  return casing === "upper" ? cleaned.toUpperCase() : cleaned.toLowerCase();
}

function normalizedIdentity(value: {
  assetId?: string | null;
  resolvedAssetId?: string | null;
  resolvedSymbol?: string | null;
  quoteCurrency?: string | null;
  observationWindow?: string | null;
} | null | undefined): ProviderQuorumIdentity | null {
  if (!value) return null;
  const assetTokens = [value.assetId, value.resolvedAssetId, value.resolvedSymbol]
    .map((asset) => cleanToken(asset, "upper"))
    .filter(Boolean);
  const distinctAssetTokens = Array.from(new Set(assetTokens));
  // A correct route/canonical ID must never hide a conflicting provider symbol
  // (or the inverse). All supplied identity fields must resolve to one asset.
  if (distinctAssetTokens.length !== 1) return null;
  const assetId = distinctAssetTokens[0]!;
  const quoteCurrency = cleanToken(value.quoteCurrency, "upper");
  const observationWindow = cleanToken(value.observationWindow, "lower");
  return assetId && quoteCurrency && observationWindow
    ? { assetId, quoteCurrency, observationWindow }
    : null;
}

function hasAssetIdentityConflict(observation: ProviderQuorumObservation): boolean {
  const tokens = [observation.resolvedAssetId, observation.resolvedSymbol]
    .map((asset) => cleanToken(asset, "upper"))
    .filter(Boolean);
  return new Set(tokens).size > 1;
}

function identitiesEqual(left: ProviderQuorumIdentity | null, right: ProviderQuorumIdentity | null): boolean {
  return Boolean(left && right
    && left.assetId === right.assetId
    && left.quoteCurrency === right.quoteCurrency
    && left.observationWindow === right.observationWindow);
}

/** Canonicalizes aliases to an upstream organization, not an endpoint or capability class. */
export function canonicalProviderRootFamily(observation: Pick<ProviderQuorumObservation, "providerId" | "providerFamily">): string {
  const providerId = cleanToken(observation.providerId, "lower");
  const suppliedFamily = cleanToken(observation.providerFamily, "lower");
  const fingerprint = `${suppliedFamily} ${providerId}`;
  if (fingerprint.includes("query1.finance.yahoo") || fingerprint.includes("yahoo")) return "yahoo";
  if (fingerprint.includes("stooq")) return "stooq";
  if (fingerprint.includes("coingecko")) return "coingecko";
  if (fingerprint.includes("dexscreener") || fingerprint.includes("dex_screener")) return "dexscreener";
  if (fingerprint.includes("binance")) return "binance";
  if (fingerprint.includes("coinbase")) return "coinbase";
  if (fingerprint.includes("kraken")) return "kraken";
  if (providerId.includes("bybit") || suppliedFamily.includes("bybit")) return "bybit";
  if (providerId.includes("defillama") || suppliedFamily === "defillama") return "defillama";
  if (providerId.includes("goplus") || suppliedFamily.includes("goplus")) return "gopluslabs";
  if (providerId.includes("etherscan") || suppliedFamily === "etherscan") return "etherscan";
  if (providerId.includes("alchemy") || suppliedFamily === "alchemy") return "alchemy";
  if (providerId.includes("quicknode") || suppliedFamily === "quicknode") return "quicknode";
  if (providerId.includes("honeypot") || suppliedFamily.includes("honeypot")) return "honeypot-is";
  if (providerId.includes("geckoterminal") || suppliedFamily === "geckoterminal") return "geckoterminal";
  if (providerId.includes("coinmarketcap") || suppliedFamily === "coinmarketcap") return "coinmarketcap";
  if (fingerprint.includes("alphavantage") || fingerprint.includes("alpha_vantage")) return "alphavantage";
  if (fingerprint.includes("finnhub")) return "finnhub";
  // Unknown endpoint IDs do not prove upstream organizational independence.
  // Only an explicit, non-generic root family may count after known-alias detection.
  return suppliedFamily && !GENERIC_PROVIDER_FAMILIES.has(suppliedFamily) ? suppliedFamily : "";
}

function validEvidenceDigest(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9]{64}$/i.test(value);
}

function digestObservations(input: {
  assetClass: Pass458TruthAssetClass;
  expectedIdentity: ProviderQuorumIdentity | null;
  primary: ProviderQuorumObservation | null;
  secondary: ProviderQuorumObservation | null;
}) {
  const safe = (observation: ProviderQuorumObservation | null) => observation ? {
    providerId: observation.providerId,
    providerFamily: observation.providerFamily ?? null,
    providerRootFamily: canonicalProviderRootFamily(observation),
    identity: normalizedIdentity(observation),
    resolvedAssetId: cleanToken(observation.resolvedAssetId, "upper") || null,
    resolvedSymbol: cleanToken(observation.resolvedSymbol, "upper") || null,
    source: observation.source,
    price: finitePositive(observation.price) ? observation.price : null,
    sourceTimestamp: typeof observation.sourceTimestamp === "number" ? observation.sourceTimestamp : null,
    receivedAt: observation.receivedAt ?? null,
    latencyMs: typeof observation.latencyMs === "number" && Number.isFinite(observation.latencyMs) ? observation.latencyMs : null,
    evidenceEligible: observation.evidenceEligible === true,
    status: observation.status ?? null,
    valueSha256: observation.valueSha256 ?? null,
  } : null;
  return createHash("sha256")
    .update(JSON.stringify({
      assetClass: input.assetClass,
      expectedIdentity: input.expectedIdentity,
      primary: safe(input.primary),
      secondary: safe(input.secondary),
    }))
    .digest("hex");
}

export function reconcileProviderQuorum(input: {
  assetClass: Pass458TruthAssetClass;
  expectedIdentity?: ProviderQuorumIdentity | null;
  primary: ProviderQuorumObservation | null;
  secondary?: ProviderQuorumObservation | null;
  nowSeconds?: number;
}): ProviderQuorumReconciliation {
  const nowSeconds = input.nowSeconds ?? Math.floor(Date.now() / 1000);
  const expectedIdentity = normalizedIdentity(input.expectedIdentity);
  const secondary = input.secondary ?? null;
  const primaryUsable = Boolean(
    input.primary
    && finitePositive(input.primary.price)
    && validTimestamp(input.primary.sourceTimestamp, nowSeconds),
  );
  const secondaryUsable = Boolean(
    secondary
    && finitePositive(secondary.price)
    && validTimestamp(secondary.sourceTimestamp, nowSeconds),
  );
  const primary = primaryUsable ? input.primary! : null;
  const usableSecondary = secondaryUsable ? secondary! : null;
  const reasons: string[] = [];
  const observationDigest = digestObservations({
    assetClass: input.assetClass,
    expectedIdentity,
    primary: input.primary,
    secondary,
  });

  if (!primary && !usableSecondary) {
    reasons.push("No provider supplied a positive price with a valid timestamp.");
    return {
      schemaVersion: "velmere.provider-quorum-reconciliation.v1",
      state: "unavailable",
      freshnessState: "missing",
      comparability: "unavailable",
      sourceCount: 0,
      independentSourceCount: 0,
      providerRootFamilies: [],
      identityAligned: false,
      expectedIdentity,
      selectedProviderId: null,
      selectedPrice: null,
      primaryPrice: null,
      secondaryPrice: null,
      secondarySource: null,
      timestampSkewSeconds: null,
      divergenceBps: null,
      divergenceThresholdBps: 0,
      confidenceCap: 20,
      freshPaidEvidenceEligible: false,
      strongClaimEligible: false,
      observationDigest,
      reasons,
    };
  }

  if (!primary || !usableSecondary) {
    const selected = primary ?? usableSecondary!;
    const selectedRoot = canonicalProviderRootFamily(selected);
    const selectedIdentity = normalizedIdentity(selected);
    const identityAligned = identitiesEqual(selectedIdentity, expectedIdentity);
    const single = buildPass460ProviderConsensus({
      assetClass: input.assetClass,
      primaryPrice: selected.price,
      secondaryPrice: null,
      sourceTimestamp: selected.sourceTimestamp,
      primaryLabel: selected.source,
      nowSeconds,
    });
    reasons.push(primary ? "Secondary provider is missing or timestamp-invalid." : "Primary provider is missing or timestamp-invalid; secondary is used as fallback.");
    if (!expectedIdentity) reasons.push("Expected asset/currency/window identity is incomplete; paid quorum is fail-closed.");
    else if (!identityAligned) reasons.push("The usable provider does not match the expected asset/currency/window identity.");
    reasons.push(...single.notes);
    return {
      schemaVersion: "velmere.provider-quorum-reconciliation.v1",
      state: single.state,
      freshnessState: single.freshnessState,
      comparability: "single_source",
      sourceCount: 1,
      independentSourceCount: selectedRoot ? 1 : 0,
      providerRootFamilies: selectedRoot ? [selectedRoot] : [],
      identityAligned,
      expectedIdentity,
      selectedProviderId: selected.providerId,
      selectedPrice: selected.price as number,
      primaryPrice: primary ? (primary.price as number) : null,
      secondaryPrice: usableSecondary ? (usableSecondary.price as number) : null,
      secondarySource: usableSecondary ? usableSecondary.source : null,
      timestampSkewSeconds: null,
      divergenceBps: null,
      divergenceThresholdBps: single.divergenceThresholdBps,
      confidenceCap: Math.min(single.confidenceCap, selected.evidenceEligible === true && validEvidenceDigest(selected.valueSha256) ? 68 : 45),
      freshPaidEvidenceEligible: false,
      strongClaimEligible: false,
      observationDigest,
      reasons: reasons.slice(0, 10),
    };
  }

  const primaryRoot = canonicalProviderRootFamily(primary);
  const secondaryRoot = canonicalProviderRootFamily(usableSecondary);
  const providerRootFamilies = Array.from(new Set([primaryRoot, secondaryRoot].filter(Boolean))).sort();
  const providerIdentities = new Set([
    cleanToken(primary.providerId, "lower"),
    cleanToken(usableSecondary.providerId, "lower"),
  ].filter(Boolean));
  const independentSourceCount = Math.min(providerRootFamilies.length, providerIdentities.size);
  const primaryIdentity = normalizedIdentity(primary);
  const secondaryIdentity = normalizedIdentity(usableSecondary);
  const pairIdentityAligned = identitiesEqual(primaryIdentity, secondaryIdentity);
  const identityAligned = Boolean(expectedIdentity
    && pairIdentityAligned
    && identitiesEqual(primaryIdentity, expectedIdentity));

  if (independentSourceCount < 2) {
    const single = buildPass460ProviderConsensus({
      assetClass: input.assetClass,
      primaryPrice: primary.price,
      secondaryPrice: null,
      sourceTimestamp: Math.min(primary.sourceTimestamp as number, usableSecondary.sourceTimestamp as number),
      primaryLabel: primary.source,
      nowSeconds,
    });
    reasons.push(providerRootFamilies.length < 2
      ? "Provider lanes resolve to the same canonical upstream organization and count as one independent source."
      : "Provider lanes reuse the same provider identity and count as one independent source.");
    reasons.push(...single.notes);
    return {
      schemaVersion: "velmere.provider-quorum-reconciliation.v1",
      state: "single_source",
      freshnessState: single.freshnessState,
      comparability: "single_source",
      sourceCount: 2,
      independentSourceCount,
      providerRootFamilies,
      identityAligned,
      expectedIdentity,
      selectedProviderId: primary.providerId,
      selectedPrice: primary.price as number,
      primaryPrice: primary.price as number,
      secondaryPrice: usableSecondary.price as number,
      secondarySource: usableSecondary.source,
      timestampSkewSeconds: Math.abs((primary.sourceTimestamp as number) - (usableSecondary.sourceTimestamp as number)),
      divergenceBps: null,
      divergenceThresholdBps: single.divergenceThresholdBps,
      confidenceCap: Math.min(single.confidenceCap, 52),
      freshPaidEvidenceEligible: false,
      strongClaimEligible: false,
      observationDigest,
      reasons: reasons.slice(0, 10),
    };
  }

  if (!identityAligned) {
    const reference = buildPass460ProviderConsensus({
      assetClass: input.assetClass,
      primaryPrice: primary.price,
      secondaryPrice: null,
      sourceTimestamp: Math.min(primary.sourceTimestamp as number, usableSecondary.sourceTimestamp as number),
      primaryLabel: primary.source,
      nowSeconds,
    });
    if (!expectedIdentity) reasons.push("Expected asset/currency/window identity is incomplete; numeric quorum is fail-closed.");
    else if (hasAssetIdentityConflict(primary) || hasAssetIdentityConflict(usableSecondary)) reasons.push("At least one provider supplied conflicting resolved asset ID and symbol fields.");
    else if (!primaryIdentity || !secondaryIdentity) reasons.push("At least one provider lacks complete asset/currency/window identity.");
    else if (!pairIdentityAligned) reasons.push("Provider asset, quote currency or observation window does not match.");
    else reasons.push("Provider identities agree with each other but not with the requested asset/currency/window.");
    return {
      schemaVersion: "velmere.provider-quorum-reconciliation.v1",
      state: "single_source",
      freshnessState: reference.freshnessState,
      comparability: "not_comparable",
      sourceCount: 2,
      independentSourceCount,
      providerRootFamilies,
      identityAligned: false,
      expectedIdentity,
      selectedProviderId: primary.providerId,
      selectedPrice: primary.price as number,
      primaryPrice: primary.price as number,
      secondaryPrice: usableSecondary.price as number,
      secondarySource: usableSecondary.source,
      timestampSkewSeconds: Math.abs((primary.sourceTimestamp as number) - (usableSecondary.sourceTimestamp as number)),
      divergenceBps: null,
      divergenceThresholdBps: reference.divergenceThresholdBps,
      confidenceCap: Math.min(reference.confidenceCap, 40),
      freshPaidEvidenceEligible: false,
      strongClaimEligible: false,
      observationDigest,
      reasons: reasons.slice(0, 10),
    };
  }

  const timestampSkewSeconds = Math.abs((primary.sourceTimestamp as number) - (usableSecondary.sourceTimestamp as number));
  const comparability: ProviderQuorumComparability = timestampSkewSeconds <= EXACT_WINDOW_SECONDS
    ? "exact_window"
    : timestampSkewSeconds <= REFERENCE_WINDOW_SECONDS
      ? "reference_window"
      : "not_comparable";
  const base = buildPass460ProviderConsensus({
    assetClass: input.assetClass,
    primaryPrice: primary.price,
    secondaryPrice: usableSecondary.price,
    sourceTimestamp: Math.min(primary.sourceTimestamp as number, usableSecondary.sourceTimestamp as number),
    primaryLabel: primary.source,
    secondaryLabel: usableSecondary.source,
    nowSeconds,
  });

  let state = base.state;
  let confidenceCap = base.confidenceCap;
  let threshold = base.divergenceThresholdBps;
  if (comparability === "reference_window") {
    threshold *= 4;
    confidenceCap = Math.min(confidenceCap, 72);
    if ((base.divergenceBps ?? Infinity) <= threshold) {
      state = "watch";
      reasons.push("Providers are within a reference-close window, not an exact timestamp window.");
    } else {
      state = "divergent";
      confidenceCap = Math.min(confidenceCap, 42);
      reasons.push("Reference-close divergence exceeds the widened timestamp-aware threshold.");
    }
  } else if (comparability === "not_comparable") {
    state = "single_source";
    confidenceCap = Math.min(confidenceCap, 52);
    reasons.push("Provider timestamps are too far apart for numeric quorum; values remain separate observations.");
  } else {
    reasons.push("Independent provider timestamps are close enough for exact-window comparison.");
  }

  const bothEvidenceEligible = primary.evidenceEligible === true && usableSecondary.evidenceEligible === true;
  const bothEvidenceBound = validEvidenceDigest(primary.valueSha256)
    && validEvidenceDigest(usableSecondary.valueSha256)
    && primary.valueSha256.toLowerCase() !== usableSecondary.valueSha256.toLowerCase();
  if (!bothEvidenceEligible) {
    confidenceCap = Math.min(confidenceCap, 48);
    reasons.push("At least one provider observation is not explicitly eligible as fresh evidence.");
  }
  if (!bothEvidenceBound) {
    confidenceCap = Math.min(confidenceCap, 48);
    reasons.push("Provider observations require valid and distinct content-bound SHA-256 digests.");
  }
  const freshPaidEvidenceEligible = comparability === "exact_window"
    && state === "aligned"
    && independentSourceCount >= 2
    && identityAligned
    && bothEvidenceEligible
    && bothEvidenceBound
    && base.freshnessState === "fresh";
  const strongClaimEligible = freshPaidEvidenceEligible && confidenceCap >= 80;
  if (!freshPaidEvidenceEligible) reasons.push("Fresh paid evidence requires two independent, identity-aligned, digest-bound and fresh providers.");
  reasons.push(...base.notes);

  return {
    schemaVersion: "velmere.provider-quorum-reconciliation.v1",
    state,
    freshnessState: base.freshnessState,
    comparability,
    sourceCount: 2,
    independentSourceCount,
    providerRootFamilies,
    identityAligned,
    expectedIdentity,
    selectedProviderId: primary.providerId,
    selectedPrice: primary.price as number,
    primaryPrice: primary.price as number,
    secondaryPrice: usableSecondary.price as number,
    secondarySource: usableSecondary.source,
    timestampSkewSeconds,
    divergenceBps: base.divergenceBps,
    divergenceThresholdBps: threshold,
    confidenceCap,
    freshPaidEvidenceEligible,
    strongClaimEligible,
    observationDigest,
    reasons: reasons.slice(0, 12),
  };
}
