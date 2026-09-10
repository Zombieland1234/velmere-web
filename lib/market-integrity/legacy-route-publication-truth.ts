import { canonicalJson } from "@/lib/security/canonical-json";
import { isSha256Digest, sha256Digest } from "@/lib/security/cryptographic-digest";
import type { TokenRiskResult } from "./risk-types";
import { withholdProviderRiskResult } from "./market-row-delivery-gate";

export const LEGACY_ROUTE_PUBLICATION_TRUTH_ID = "pass6_legacy_route_publication_truth_v1" as const;

const MAX_PUBLICATION_AGE_MS = 5 * 60_000;
const MAX_CLOCK_SKEW_MS = 30_000;

export type LegacyRiskPublicationTruth = {
  schemaVersion: typeof LEGACY_ROUTE_PUBLICATION_TRUTH_ID;
  mode: "live" | "withheld";
  evidenceState: "verified" | "withheld";
  scorePublished: boolean;
  canonicalIdentity: string;
  completenessBps: number;
  sourceAsOf: string | null;
  sourceReceiptRoot: string | null;
  receiptDigest: string;
  blockers: string[];
};

function canonicalIdentityForResult(result: TokenRiskResult) {
  const address = String(result.token.tokenAddress ?? "").trim().toLowerCase();
  const chain = String(result.token.chainId ?? "").trim().toLowerCase();
  if (/^0x[a-f0-9]{40}$/u.test(address)) return `address:${chain ? `${chain}:` : ""}${address}`;
  const marketId = String(result.token.marketId ?? "").trim().toLowerCase();
  if (marketId) return `market:${marketId}`;
  const symbol = String(result.token.symbol ?? "unknown").trim().toLowerCase() || "unknown";
  return `symbol:${symbol}`;
}

function publicationBlockers(result: TokenRiskResult, generatedAt: string) {
  const delivery = result.providerRiskDelivery;
  const expectedCanonicalIdentity = canonicalIdentityForResult(result);
  const generatedAtMs = Date.parse(generatedAt);
  const sourceAsOfMs = Date.parse(String(delivery?.sourceAsOf ?? ""));
  const blockers = [
    !delivery ? "provider_risk_delivery_missing" : null,
    delivery?.schemaVersion !== "pass6_provider_risk_delivery_v1" ? "provider_risk_delivery_schema_invalid" : null,
    String(delivery?.canonicalIdentity ?? "").trim().toLowerCase() !== expectedCanonicalIdentity
      ? "provider_risk_delivery_identity_mismatch"
      : null,
    delivery?.state !== "verified" ? "provider_risk_delivery_not_verified" : null,
    delivery?.scorePublished !== true ? "score_publication_not_authorized" : null,
    delivery?.completenessBps !== 10_000 ? `delivery_completeness:${delivery?.completenessBps ?? 0}/10000` : null,
    !delivery || !isSha256Digest(delivery.sourceReceiptRoot) ? "source_receipt_root_invalid" : null,
    !delivery || !isSha256Digest(delivery.receiptDigest) ? "delivery_receipt_digest_invalid" : null,
    !Number.isFinite(generatedAtMs) ? "generated_at_invalid" : null,
    !Number.isFinite(sourceAsOfMs) ? "provider_source_time_missing" : null,
    Number.isFinite(generatedAtMs) && Number.isFinite(sourceAsOfMs) && sourceAsOfMs > generatedAtMs + MAX_CLOCK_SKEW_MS
      ? "provider_source_time_in_future"
      : null,
    Number.isFinite(generatedAtMs) && Number.isFinite(sourceAsOfMs) && generatedAtMs - sourceAsOfMs > MAX_PUBLICATION_AGE_MS
      ? "provider_source_time_stale"
      : null,
    typeof result.score !== "number" || !Number.isFinite(result.score) ? "risk_score_missing" : null,
    result.dataQuality !== "live" ? "data_quality_not_live" : null,
    ...(delivery?.blockers ?? []),
  ].filter((value): value is string => Boolean(value));
  return Array.from(new Set(blockers)).sort();
}

/**
 * Last fail-closed boundary for legacy market-integrity routes.  A route may
 * retain the word `live` only when the shared PASS6 provider-risk delivery
 * receipt is complete, current, digest-bound and explicitly authorizes score
 * publication.  Provider labels or a legacy `dataQuality` flag never suffice.
 *
 * The function mutates an unverified result through the shared score firewall
 * so callers cannot accidentally return a numerical risk verdict next to a
 * truthful `withheld` label.
 */
export function enforceLegacyRiskPublicationTruth(
  result: TokenRiskResult,
  generatedAt = new Date().toISOString(),
): LegacyRiskPublicationTruth {
  const blockers = publicationBlockers(result, generatedAt);
  const canonicalIdentity = canonicalIdentityForResult(result);
  if (blockers.length === 0) {
    const delivery = result.providerRiskDelivery!;
    return {
      schemaVersion: LEGACY_ROUTE_PUBLICATION_TRUTH_ID,
      mode: "live",
      evidenceState: "verified",
      scorePublished: true,
      canonicalIdentity,
      completenessBps: 10_000,
      sourceAsOf: delivery.sourceAsOf,
      sourceReceiptRoot: delivery.sourceReceiptRoot,
      receiptDigest: delivery.receiptDigest,
      blockers: [],
    };
  }

  withholdProviderRiskResult({
    result,
    canonicalIdentity,
    generatedAt,
    blockers,
  });
  const delivery = result.providerRiskDelivery!;
  return {
    schemaVersion: LEGACY_ROUTE_PUBLICATION_TRUTH_ID,
    mode: "withheld",
    evidenceState: "withheld",
    scorePublished: false,
    canonicalIdentity,
    completenessBps: 0,
    sourceAsOf: null,
    sourceReceiptRoot: delivery.sourceReceiptRoot,
    receiptDigest: delivery.receiptDigest || sha256Digest(canonicalJson({ canonicalIdentity, generatedAt, blockers })),
    blockers,
  };
}

export function enforceLegacyRiskSweepPublicationTruth(
  results: readonly TokenRiskResult[],
  generatedAt = new Date().toISOString(),
) {
  const rows = results.map((result) => enforceLegacyRiskPublicationTruth(result, generatedAt));
  const verifiedRows = rows.filter((row) => row.evidenceState === "verified").length;
  const blockers = Array.from(new Set(rows.flatMap((row) => row.blockers))).sort();
  return {
    schemaVersion: "pass6_legacy_route_sweep_publication_truth_v1" as const,
    mode: rows.length > 0 && verifiedRows === rows.length ? "live" as const : "withheld" as const,
    evidenceState: rows.length > 0 && verifiedRows === rows.length ? "verified" as const : "withheld" as const,
    scorePublished: rows.length > 0 && verifiedRows === rows.length,
    rowCount: rows.length,
    verifiedRows,
    withheldRows: rows.length - verifiedRows,
    completenessBps: rows.length ? Math.floor((verifiedRows * 10_000) / rows.length) : 0,
    blockers,
    receiptDigest: sha256Digest(canonicalJson(rows.map((row) => row.receiptDigest))),
  };
}
