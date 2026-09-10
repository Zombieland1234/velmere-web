import { createHash } from "node:crypto";
import {
  createPass4644ProviderEvidenceReceipt,
  type Pass4644ProviderEvidenceReceipt,
} from "@/lib/market-integrity/provider-evidence-receipt";
import type { CustomerReportDecisionSection } from "@/lib/market-integrity/customer-report-payload";
import type { ProviderQuorumObservation, ProviderQuorumReconciliation } from "@/lib/market-integrity/provider-quorum-reconciliation";
import type { ProviderEvidenceTierDecision } from "@/lib/market-integrity/provider-evidence-tier-policy";
import type { ProviderObservationLedgerReceipt } from "@/lib/market-integrity/provider-observation-ledger";
import type { VelmereTier } from "@/lib/market-integrity/top1-risk-foundation";

export const PASS4818_REAL_MARKETS_CUSTOMER_EVIDENCE_ID = "pass4818-real-markets-customer-evidence-v1" as const;

export type RealMarketsProviderObservationEvidence = ProviderQuorumObservation;


export type RealMarketsCustomerEvidenceQuote = {
  symbol?: string | null;
  assetClass?: string | null;
  state?: string | null;
  currentPrice?: number | null;
  currency?: string | null;
  source?: string | null;
  sourceTimestamp?: number | null;
  marketCap?: number | null;
  volume24h?: number | null;
  high24h?: number | null;
  low24h?: number | null;
  priceChange1h?: number | null;
  priceChange24h?: number | null;
  priceChange7d?: number | null;
  priceChange30d?: number | null;
  providerQuorum: ProviderQuorumReconciliation;
  providerEvidencePolicy: ProviderEvidenceTierDecision & {
    historyReceiptDigest?: string;
    historicalState?: string;
  };
  providerHistory?: ProviderObservationLedgerReceipt | null;
  providerObservations?: {
    primary: RealMarketsProviderObservationEvidence | null;
    secondary: RealMarketsProviderObservationEvidence | null;
  };
  pass2808ChartReceipt?: {
    status?: "source_bound" | "skeleton_required";
    candleCount?: number;
    source?: string;
    sourceTimestamp?: number | null;
    confidence?: number;
    range?: string;
  } | null;
};

const finite = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);
const positive = (value: unknown): value is number => finite(value) && value > 0;
const clamp = (value: number) => Math.max(0, Math.min(100, Math.round(value * 100) / 100));

function isoFromSeconds(value: number | null | undefined): string | null {
  if (!finite(value) || value <= 0) return null;
  const parsed = new Date(value > 10_000_000_000 ? value : value * 1000);
  return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : null;
}

function normalizedProviderFamily(observation: RealMarketsProviderObservationEvidence): string {
  const joined = `${observation.providerFamily ?? ""} ${observation.providerId} ${observation.source}`.toLowerCase();
  if (joined.includes("stooq")) return "stooq";
  if (joined.includes("yahoo")) return "yahoo";
  if (joined.includes("finnhub")) return "finnhub";
  if (joined.includes("alpha")) return "alphavantage";
  return String(observation.providerFamily ?? "").trim().toLowerCase().replace(/[^a-z0-9_-]+/g, "-") || "unknown-real-markets-provider";
}

function normalizedSymbol(value: string | null | undefined): string {
  return String(value ?? "").trim().toUpperCase().replace(/[^A-Z0-9.^=/-]+/g, "");
}

function buildObservationReceipt(args: {
  symbol: string;
  assetClass: string;
  observation: RealMarketsProviderObservationEvidence;
}): Pass4644ProviderEvidenceReceipt {
  const family = normalizedProviderFamily(args.observation);
  const observedAt = isoFromSeconds(args.observation.sourceTimestamp);
  const requestedSymbol = normalizedSymbol(args.symbol);
  const resolvedSymbol = normalizedSymbol(args.observation.resolvedSymbol);
  const contentHashPresent = /^[a-f0-9]{64}$/i.test(String(args.observation.valueSha256 ?? ""));
  const receivedAtPresent = typeof args.observation.receivedAt === "string"
    && Number.isFinite(Date.parse(args.observation.receivedAt));
  const measuredLatencyPresent = typeof args.observation.latencyMs === "number"
    && Number.isFinite(args.observation.latencyMs)
    && args.observation.latencyMs >= 0;
  const identityMatched = Boolean(
    requestedSymbol
    && resolvedSymbol
    && requestedSymbol === resolvedSymbol
    && positive(args.observation.price),
  );
  const evidenceEligible = args.observation.evidenceEligible === true
    && identityMatched
    && contentHashPresent
    && Boolean(observedAt)
    && receivedAtPresent
    && measuredLatencyPresent;
  const ttlMs = family === "stooq" ? 36 * 60 * 60 * 1000 : 20 * 60 * 1000;
  const state = evidenceEligible ? "confirmed" as const : "rejected" as const;
  return createPass4644ProviderEvidenceReceipt({
    providerId: args.observation.providerId || family,
    providerFamily: family,
    surface: "real_markets",
    verification: "normalized_response",
    state,
    requestedIdentity: args.symbol,
    resolvedSymbol: resolvedSymbol || undefined,
    identityMatched,
    // This observation DTO contains exactly identity, price and source time.
    // Richer capabilities require a receipt over the richer provider payload.
    capabilities: ["identity", "price", "quote", "source_timestamp", "real_market_quote"],
    timestampProvenance: "provider",
    observedAt,
    receivedAt: receivedAtPresent ? args.observation.receivedAt : null,
    ttlMs,
    httpStatus: identityMatched ? 200 : 503,
    latencyMs: measuredLatencyPresent ? args.observation.latencyMs! : undefined,
    normalizedPayload: {
      symbol: args.symbol,
      assetClass: args.assetClass,
      providerId: args.observation.providerId,
      providerFamily: family,
      source: args.observation.source,
      price: positive(args.observation.price) ? args.observation.price : null,
      sourceTimestamp: args.observation.sourceTimestamp,
      providerValueSha256: args.observation.valueSha256 ?? null,
    },
    rejectionReasons: [
      args.observation.evidenceEligible === true ? null : "provider_observation_not_evidence_eligible",
      requestedSymbol === resolvedSymbol && requestedSymbol ? null : "provider_symbol_identity_mismatch",
      positive(args.observation.price) ? null : "missing_positive_price",
      contentHashPresent ? null : "provider_content_hash_missing",
      observedAt ? null : "provider_source_timestamp_missing",
      receivedAtPresent ? null : "provider_transport_received_at_missing",
      measuredLatencyPresent ? null : "provider_transport_latency_missing",
    ].filter((value): value is string => Boolean(value)),
  });
}

export function buildPass4818RealMarketsProviderReceipts(args: {
  quote: RealMarketsCustomerEvidenceQuote;
  generatedAt: string;
}): Pass4644ProviderEvidenceReceipt[] {
  const symbol = String(args.quote.symbol ?? "").trim().toUpperCase();
  const assetClass = String(args.quote.assetClass ?? "unknown");
  const observations = [args.quote.providerObservations?.primary ?? null, args.quote.providerObservations?.secondary ?? null]
    .filter((value): value is RealMarketsProviderObservationEvidence => Boolean(value));
  const receipts = observations.map((observation) => buildObservationReceipt({ symbol, assetClass, observation }));
  const unique = new Map<string, Pass4644ProviderEvidenceReceipt>();
  for (const receipt of receipts) unique.set(receipt.receiptId, receipt);
  return Array.from(unique.values());
}

export function buildPass4818RealMarketsEvidenceRisk(quote: RealMarketsCustomerEvidenceQuote): number {
  const quorum = quote.providerQuorum;
  let risk = 18;
  if (quote.state !== "live" || !positive(quote.currentPrice)) risk += 48;
  if (quorum.state === "unavailable") risk += 35;
  else if (quorum.state === "divergent") risk += 30;
  else if (quorum.state === "single_source") risk += 20;
  else if (quorum.state === "watch") risk += 11;
  if (quorum.freshnessState === "missing") risk += 22;
  else if (quorum.freshnessState === "stale") risk += 18;
  else if (quorum.freshnessState === "aging") risk += 8;
  if (quorum.comparability === "not_comparable") risk += 14;
  else if (quorum.comparability === "reference_window") risk += 6;
  if (!quote.providerEvidencePolicy.freshPaidEvidenceAllowed) risk += 8;
  if (!finite(quote.volume24h)) risk += 4;
  if (!finite(quote.marketCap) && ["stock", "equity", "etf", "exchange_equity"].includes(String(quote.assetClass))) risk += 4;
  return clamp(risk);
}

export function buildPass4818RealMarketsMissingEvidence(quote: RealMarketsCustomerEvidenceQuote): string[] {
  const missing = [
    quote.state === "live" && positive(quote.currentPrice) ? null : "live positive quote unavailable",
    quote.providerQuorum.independentSourceCount >= 2 ? null : "second independent quote upstream missing",
    quote.providerQuorum.comparability === "exact_window" ? null : `provider timing is ${quote.providerQuorum.comparability}`,
    quote.providerQuorum.freshnessState === "fresh" ? null : `quote freshness is ${quote.providerQuorum.freshnessState}`,
    quote.providerQuorum.state === "aligned" ? null : `provider consensus is ${quote.providerQuorum.state}`,
    quote.pass2808ChartReceipt?.status === "source_bound" && (quote.pass2808ChartReceipt.candleCount ?? 0) >= 2 ? null : "source-bound chart history unavailable",
    quote.providerHistory?.durability === "supabase" && quote.providerHistory.persisted ? null : "durable provider observation history unavailable",
    finite(quote.volume24h) ? null : "24h volume unavailable",
  ].filter((value): value is string => Boolean(value));
  return Array.from(new Set(missing));
}

export function buildPass4818RealMarketsProviderConflicts(quote: RealMarketsCustomerEvidenceQuote): string[] {
  const conflicts = [
    quote.providerQuorum.state === "divergent" ? `provider divergence ${quote.providerQuorum.divergenceBps ?? "unknown"} bps` : null,
    quote.providerQuorum.comparability === "not_comparable" ? "provider timestamps cannot be compared" : null,
    quote.providerHistory?.state === "anomalous" ? "cross-request provider history is anomalous" : null,
  ].filter((value): value is string => Boolean(value));
  return Array.from(new Set(conflicts));
}

function displayNumber(value: number | null | undefined, suffix = ""): string {
  return finite(value) ? `${value.toLocaleString("en-US", { maximumFractionDigits: 4 })}${suffix}` : "unavailable";
}

export function buildPass4818RealMarketsDecisionSections(args: {
  quote: RealMarketsCustomerEvidenceQuote;
  deliveredTier: VelmereTier;
}): CustomerReportDecisionSection[] {
  const quote = args.quote;
  const quorum = quote.providerQuorum;
  const missing = buildPass4818RealMarketsMissingEvidence(quote);
  const sections: CustomerReportDecisionSection[] = [
    {
      id: "real-markets-evidence-risk",
      title: "Market-data integrity risk",
      minimumTier: "Basic",
      state: quote.state === "live" && quorum.state !== "unavailable" ? (missing.length > 2 ? "watch" : "ready") : "blocked",
      summary: `This score measures evidence and market-data integrity, not expected price direction. Quote ${displayNumber(quote.currentPrice)} ${quote.currency ?? ""}; provider state ${quorum.state}; freshness ${quorum.freshnessState}.`,
      evidence: [
        `Provider observations: ${quorum.sourceCount}`,
        `Comparability: ${quorum.comparability}`,
        `Confidence cap: ${displayNumber(quorum.confidenceCap, "%")}`,
        `Chart candles: ${quote.pass2808ChartReceipt?.candleCount ?? 0}`,
      ],
      actions: missing.slice(0, 4),
    },
    {
      id: "real-markets-provider-reconciliation",
      title: "Provider reconciliation",
      minimumTier: "Pro",
      state: quote.providerEvidencePolicy.maxEvidenceTier === "Basic" ? "blocked" : quote.providerEvidencePolicy.downgradeRequired ? "watch" : "ready",
      summary: `Primary ${displayNumber(quorum.primaryPrice)}, secondary ${displayNumber(quorum.secondaryPrice)}; divergence ${displayNumber(quorum.divergenceBps, " bps")}.`,
      evidence: [
        ...quorum.reasons.slice(0, 6),
        ...(quote.providerHistory?.reasons ?? []).slice(0, 3),
      ],
      actions: quote.providerEvidencePolicy.reasons.slice(0, 5),
    },
    {
      id: "real-markets-scenario-context",
      title: "Liquidity and scenario context",
      minimumTier: "Pro",
      state: finite(quote.volume24h) && finite(quote.high24h) && finite(quote.low24h) ? "ready" : "watch",
      summary: `24h volume ${displayNumber(quote.volume24h)}; high ${displayNumber(quote.high24h)}; low ${displayNumber(quote.low24h)}. These are source observations, not a forecast or execution guarantee.`,
      evidence: [
        `1h change: ${displayNumber(quote.priceChange1h, "%")}`,
        `24h change: ${displayNumber(quote.priceChange24h, "%")}`,
        `7d change: ${displayNumber(quote.priceChange7d, "%")}`,
        `30d change: ${displayNumber(quote.priceChange30d, "%")}`,
      ],
      actions: ["Validate executable spread and depth before trading.", "Treat unavailable volume or stale quotes as a hard confidence cap."],
    },
    {
      id: "real-markets-advanced-automated-synthesis",
      title: "Advanced automated evidence synthesis",
      minimumTier: "Advanced",
      state: quorum.state === "aligned"
        && quorum.freshnessState === "fresh"
        && quorum.independentSourceCount >= 3
        && quote.providerHistory?.historicalEvidenceEligible === true
        && quote.pass2808ChartReceipt?.status === "source_bound"
        ? "ready"
        : "blocked",
      summary: "Advanced is an automated evidence-synthesis product. Optional human QA cannot unlock it, replace missing evidence, or authorize a lower-tier fallback.",
      evidence: [
        `Requested automated tier: ${args.deliveredTier}`,
        `Independent provider observations: ${quorum.independentSourceCount}`,
        `Provider consensus: ${quorum.state} / ${quorum.freshnessState}`,
        `Historical evidence state: ${quote.providerHistory?.state ?? "unavailable"}`,
        `Historical evidence eligible: ${quote.providerHistory?.historicalEvidenceEligible === true ? "yes" : "no"}`,
        `Chart lifecycle: ${quote.pass2808ChartReceipt?.status ?? "unavailable"}`,
      ],
      actions: [
        "Obtain the missing independent, target-bound source evidence.",
        "Execute and bind automated scenario/stress analysis to the same immutable report.",
        "Keep the requested tier WITHHELD until every automated gate passes.",
      ],
    },
  ];
  return sections;
}

export function pass4818RealMarketsReceiptDigest(receipts: Pass4644ProviderEvidenceReceipt[]): string {
  return createHash("sha256")
    .update(JSON.stringify(receipts.map((receipt) => ({ id: receipt.receiptId, hash: receipt.payloadHash })).sort((a, b) => a.id.localeCompare(b.id))))
    .digest("hex");
}
