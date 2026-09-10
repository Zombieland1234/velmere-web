import policyReview from "../../artifacts/r7/providers/R7_ECB_USAGE_POLICY_REVIEW_20260824.json";
import type {
  ProviderDeliveryPurpose,
  ProviderDeliveryRightsResolution,
} from "@/lib/compliance/provider-delivery-rights-gate.mjs";
import {
  inspectR7EcbStatisticsPolicyReceiptBytes,
  R7_ECB_POLICY_REVIEW_PATH,
  R7_ECB_POLICY_REVIEW_SHA256,
} from "@/lib/compliance/ecb-statistics-policy-receipt";
import { canonicalJson } from "@/lib/security/canonical-json";
import { sha256Digest } from "@/lib/security/cryptographic-digest";
import type { VelmereSearchResult } from "@/lib/search/intelligence-search-contract";

export const R7_BROWSER_ECB_POLICY_REVIEW_PATH =
  R7_ECB_POLICY_REVIEW_PATH;
export const R7_BROWSER_ECB_POLICY_REVIEW_SHA256 =
  R7_ECB_POLICY_REVIEW_SHA256;
export const R7_BROWSER_ECB_POLICY_REVIEWED_AT = "2026-08-24T16:25:00.000Z" as const;
export const R7_BROWSER_ECB_POLICY_VALID_UNTIL = "2026-08-31T23:59:59.999Z" as const;
export const R7_BROWSER_ECB_REFERENCE_MAX_AGE_DAYS = 4 as const;
export const R7_BROWSER_ECB_DELIVERY_TTL_SECONDS = 10 * 60;

export type R7BrowserEcbDeliveryBinding = Readonly<{
  schemaVersion: "velmere.r7.browser-delivery-binding.v2";
  lane: "ecb_reference";
  providerId: "ecb_statistics";
  rightsReceiptPath: typeof R7_BROWSER_ECB_POLICY_REVIEW_PATH;
  rightsReceiptSha256: typeof R7_BROWSER_ECB_POLICY_REVIEW_SHA256;
  fieldIds: readonly ["market.reference_rate", "market.reference_date"];
  referenceOnly: true;
  statisticsModified: false;
  authorityReviewedAt: typeof R7_BROWSER_ECB_POLICY_REVIEWED_AT;
  authorityValidUntil: typeof R7_BROWSER_ECB_POLICY_VALID_UNTIL;
  referenceDate: string;
  responseSha256: string;
  referenceCurrentUntil: string;
  deliveryIssuedAt: string;
  deliveryExpiresAt: string;
}>;

const ALLOWED_PURPOSES = new Set<ProviderDeliveryPurpose>([
  "public_display",
  "commercial_product",
  "customer_delivery",
  "retention",
  "pdf_export",
]);

function exactPolicyReviewShape() {
  const approved = policyReview.approvedUse;
  return policyReview.schemaVersion === "velmere.r7.ecb-usage-policy-review.v1"
    && policyReview.sourceId === "ecb_statistics"
    && policyReview.decision === "GREEN_BOUNDED_REFERENCE_LANE"
    && policyReview.officialPolicyUrl === "https://www.ecb.europa.eu/stats/ecb_statistics/governance_and_quality_framework/html/usage_policy.en.html"
    && policyReview.reviewObservation.publicStatisticsFreeReuse === true
    && policyReview.reviewObservation.commercialUseIncluded === true
    && policyReview.reviewObservation.sourceAttributionRequired === true
    && policyReview.reviewObservation.statisticsAndMetadataMustNotBeModified === true
    && policyReview.reviewObservation.thirdPartyDataExcludedWithoutOriginatorPermission === true
    && approved.customerDisplay === true
    && approved.basicPdfExport === true
    && approved.accountArtifactRetention === true
    && approved.accountScopedReadback === true
    && approved.rawResponseCaching === false
    && approved.publicBulkRedistribution === false
    && approved.aiRag === false
    && approved.externalThirdPartySublicensing === false
    && approved.attribution === "Source: ECB statistics."
    && approved.statisticsModified === false
    && approved.referenceOnly === true
    && approved.executableQuote === false
    && approved.marketPriceFieldEligible === false
    && approved.riskVerdictEligible === false
    && approved.paidValueEligible === false
    && canonicalJson(approved.fieldIds) === canonicalJson(["market.reference_rate", "market.reference_date"]);
}

export const inspectR7BrowserEcbPolicyReceiptBytes =
  inspectR7EcbStatisticsPolicyReceiptBytes;

function utcReferenceCurrentUntil(referenceDate: string) {
  const referenceDay = Date.parse(`${referenceDate}T00:00:00.000Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(referenceDate) || !Number.isFinite(referenceDay)) {
    throw new Error("ecb_reference_date_invalid");
  }
  return new Date(referenceDay + (R7_BROWSER_ECB_REFERENCE_MAX_AGE_DAYS + 1) * 86_400_000 - 1).toISOString();
}

function exactIso(value: unknown): value is string {
  if (typeof value !== "string") return false;
  try { return new Date(value).toISOString() === value; } catch { return false; }
}

export function buildR7BrowserEcbDeliveryBinding(args: {
  referenceDate: string;
  responseSha256: string;
  nowMs?: number;
  ttlSeconds?: number;
}): R7BrowserEcbDeliveryBinding {
  const nowMs = args.nowMs ?? Date.now();
  if (!Number.isFinite(nowMs)) throw new Error("ecb_delivery_clock_invalid");
  if (!/^sha256:[a-f0-9]{64}$/u.test(args.responseSha256)) throw new Error("ecb_response_digest_invalid");
  const referenceCurrentUntil = utcReferenceCurrentUntil(args.referenceDate);
  const today = Date.parse(`${new Date(nowMs).toISOString().slice(0, 10)}T00:00:00.000Z`);
  const referenceDay = Date.parse(`${args.referenceDate}T00:00:00.000Z`);
  if (referenceDay > today || today - referenceDay > R7_BROWSER_ECB_REFERENCE_MAX_AGE_DAYS * 86_400_000) {
    throw new Error("ecb_reference_not_current");
  }
  const issuedMs = Math.floor(nowMs / 1000) * 1000;
  const ttlSeconds = Math.max(60, Math.min(30 * 60, Math.floor(args.ttlSeconds ?? R7_BROWSER_ECB_DELIVERY_TTL_SECONDS)));
  const deadlineMs = Math.min(
    issuedMs + ttlSeconds * 1000,
    Date.parse(R7_BROWSER_ECB_POLICY_VALID_UNTIL),
    Date.parse(referenceCurrentUntil),
  );
  const deliveryExpiresMs = Math.floor(deadlineMs / 1000) * 1000;
  if (deliveryExpiresMs <= issuedMs) throw new Error("ecb_delivery_deadline_elapsed");
  return Object.freeze({
    schemaVersion: "velmere.r7.browser-delivery-binding.v2",
    lane: "ecb_reference",
    providerId: "ecb_statistics",
    rightsReceiptPath: R7_BROWSER_ECB_POLICY_REVIEW_PATH,
    rightsReceiptSha256: R7_BROWSER_ECB_POLICY_REVIEW_SHA256,
    fieldIds: ["market.reference_rate", "market.reference_date"] as const,
    referenceOnly: true,
    statisticsModified: false,
    authorityReviewedAt: R7_BROWSER_ECB_POLICY_REVIEWED_AT,
    authorityValidUntil: R7_BROWSER_ECB_POLICY_VALID_UNTIL,
    referenceDate: args.referenceDate,
    responseSha256: args.responseSha256,
    referenceCurrentUntil,
    deliveryIssuedAt: new Date(issuedMs).toISOString(),
    deliveryExpiresAt: new Date(deliveryExpiresMs).toISOString(),
  });
}

export function normalizeR7BrowserEcbDeliveryBinding(
  value: unknown,
): R7BrowserEcbDeliveryBinding | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  try {
    const binding = value as Partial<R7BrowserEcbDeliveryBinding>;
    if (!exactIso(binding.deliveryIssuedAt) || !exactIso(binding.deliveryExpiresAt)
      || !exactIso(binding.referenceCurrentUntil) || !/^sha256:[a-f0-9]{64}$/u.test(String(binding.responseSha256 ?? ""))) return null;
    const ttlSeconds = (Date.parse(binding.deliveryExpiresAt) - Date.parse(binding.deliveryIssuedAt)) / 1000;
    const rebuilt = buildR7BrowserEcbDeliveryBinding({
      referenceDate: String(binding.referenceDate ?? ""),
      responseSha256: String(binding.responseSha256),
      nowMs: Date.parse(binding.deliveryIssuedAt),
      ttlSeconds,
    });
    return canonicalJson(value) === canonicalJson(rebuilt) ? structuredClone(rebuilt) : null;
  } catch {
    return null;
  }
}

const DIRECT_PAIRS = Object.freeze({
  "EUR/USD": "USD",
  "EUR/PLN": "PLN",
  "EUR/GBP": "GBP",
  "EUR/TRY": "TRY",
} as const);

export function isR7BrowserEcbBoundResult(
  value: unknown,
  expectedBinding?: R7BrowserEcbDeliveryBinding | null,
): value is VelmereSearchResult {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const result = value as Partial<VelmereSearchResult>;
  const reference = result.officialReferenceSnapshot;
  const market = result.marketSnapshot;
  const source = Array.isArray(result.sources) && result.sources.length === 1 ? result.sources[0] : null;
  if (!reference || !source || !market) return false;
  const quoteCurrency = DIRECT_PAIRS[reference.pair as keyof typeof DIRECT_PAIRS];
  const referenceMs = Date.parse(`${reference.referenceDate}T00:00:00.000Z`);
  const observedMs = Date.parse(String(market.observedAt ?? ""));
  return result.category === "market"
    && result.sourceMode === "table"
    && result.sourceConfidence === 0
    && result.sourceConfidenceCalibrated === false
    && result.sourceCoverage === 100
    && String(result.id ?? "").startsWith("ecb-reference-")
    && result.symbol === reference.pair
    && reference.schemaVersion === "velmere.r7.browser-official-reference-snapshot.v1"
    && reference.providerId === "ecb_statistics"
    && reference.baseCurrency === "EUR"
    && Boolean(quoteCurrency)
    && reference.quoteCurrency === quoteCurrency
    && Number.isFinite(reference.referenceRate)
    && reference.referenceRate > 0
    && /^\d{4}-\d{2}-\d{2}$/u.test(reference.referenceDate)
    && Number.isFinite(referenceMs)
    && observedMs === referenceMs
    && /^sha256:[a-f0-9]{64}$/u.test(reference.responseSha256)
    && canonicalJson(reference.fieldIds) === canonicalJson(["market.reference_rate", "market.reference_date"])
    && reference.statisticsModified === false
    && reference.directPublishedPair === true
    && reference.referenceOnly === true
    && reference.executableQuote === false
    && reference.marketPriceFieldEligible === false
    && reference.paidValueEligible === false
    && reference.attribution === "Source: ECB statistics."
    && market.assetClass === "fx"
    && market.currency === quoteCurrency
    && market.providerState === "source_bound"
    && market.price === undefined
    && market.venueReferencePrice === undefined
    && market.venueSecondaryPrice === undefined
    && source.id === "ecb-statistics"
    && source.mode === "table"
    && source.freshness === reference.referenceDate
    && source.confidence === 0
    && source.confidenceCalibrated === false
    && source.coverage === 100
    && source.note.includes(reference.attribution)
    && source.note.includes(reference.responseSha256)
    && (!expectedBinding
      || (reference.referenceDate === expectedBinding.referenceDate
        && reference.responseSha256 === expectedBinding.responseSha256));
}

export function inspectR7BrowserEcbDeliveryAuthority(
  nowMs = Date.now(),
) {
  const reviewedAt = Date.parse(policyReview.reviewedAt);
  const validUntil = Date.parse(policyReview.validUntil);
  const byteBinding = inspectR7BrowserEcbPolicyReceiptBytes();
  const blockers: string[] = [];
  if (!byteBinding.valid) blockers.push("ecb_policy_review_exact_bytes_invalid");
  if (!exactPolicyReviewShape()) blockers.push("ecb_policy_review_shape_invalid");
  if (policyReview.reviewedAt !== R7_BROWSER_ECB_POLICY_REVIEWED_AT
    || policyReview.validUntil !== R7_BROWSER_ECB_POLICY_VALID_UNTIL) {
    blockers.push("ecb_policy_review_deadline_mismatch");
  }
  if (!Number.isFinite(reviewedAt) || reviewedAt > nowMs + 5 * 60_000) {
    blockers.push("ecb_policy_review_time_invalid");
  }
  if (!Number.isFinite(validUntil) || validUntil < nowMs) {
    blockers.push("ecb_policy_review_expired");
  }
  return {
    schemaVersion: "velmere.r7.browser-ecb-delivery-authority.v1" as const,
    providerId: "ecb_statistics" as const,
    rightsReceiptPath: R7_BROWSER_ECB_POLICY_REVIEW_PATH,
    rightsReceiptSha256: byteBinding.sha256,
    rightsReceiptByteLength: byteBinding.byteLength,
    physicalReceiptJsonMatched: byteBinding.importedJsonMatches,
    reviewedAt: policyReview.reviewedAt,
    validUntil: policyReview.validUntil,
    attribution: policyReview.approvedUse.attribution,
    ready: blockers.length === 0,
    blockers,
  };
}

export function inspectR7BrowserEcbDeliveryBinding(args: {
  binding: unknown;
  nowMs?: number;
  result?: unknown;
}) {
  const nowMs = args.nowMs ?? Date.now();
  const binding = normalizeR7BrowserEcbDeliveryBinding(args.binding);
  const authority = inspectR7BrowserEcbDeliveryAuthority(nowMs);
  const blockers = [...authority.blockers];
  if (!binding) blockers.push("ecb_delivery_binding_invalid");
  if (binding) {
    const issuedAt = Date.parse(binding.deliveryIssuedAt);
    const deliveryExpiresAt = Date.parse(binding.deliveryExpiresAt);
    const referenceCurrentUntil = Date.parse(binding.referenceCurrentUntil);
    if (issuedAt > nowMs + 30_000) blockers.push("ecb_delivery_issued_in_future");
    if (deliveryExpiresAt <= nowMs) blockers.push("ecb_delivery_original_deadline_elapsed");
    if (referenceCurrentUntil < nowMs) blockers.push("ecb_reference_currentness_elapsed");
    if (deliveryExpiresAt > Date.parse(binding.authorityValidUntil)
      || deliveryExpiresAt > referenceCurrentUntil) {
      blockers.push("ecb_delivery_deadline_extended");
    }
    if (args.result !== undefined && !isR7BrowserEcbBoundResult(args.result, binding)) {
      blockers.push("ecb_delivery_result_binding_mismatch");
    }
  }
  return {
    schemaVersion: "velmere.r7.browser-ecb-bound-delivery-inspection.v1" as const,
    ready: blockers.length === 0,
    blockers,
    binding,
    authority,
  };
}

export function resolveR7BrowserEcbDeliveryRights(args: {
  purpose: ProviderDeliveryPurpose;
  nowMs?: number;
  deliveryBinding?: unknown;
  result?: unknown;
}): ProviderDeliveryRightsResolution {
  const authority = inspectR7BrowserEcbDeliveryAuthority(args.nowMs);
  const blockers = [...authority.blockers];
  if (args.deliveryBinding !== undefined) {
    blockers.push(...inspectR7BrowserEcbDeliveryBinding({
      binding: args.deliveryBinding,
      nowMs: args.nowMs,
      ...(args.result !== undefined ? { result: args.result } : {}),
    }).blockers.filter((blocker) => !blockers.includes(blocker)));
  }
  if (!ALLOWED_PURPOSES.has(args.purpose)) {
    blockers.push(`purpose_not_allowed:${args.purpose}`);
  }
  const allowed = blockers.length === 0;
  const receipt = {
    schemaVersion: "velmere.pass36.a102r44p18.provider-delivery-rights-resolution.v2" as const,
    providerId: "ecb_statistics",
    purpose: args.purpose,
    allowed,
    blockers,
    legalApprovalStatus: allowed ? "OWNER_AUTHORIZED_BOUNDED_INTERNAL" : "WITHHELD",
    engineeringClassification: "GREEN_BOUNDED_REFERENCE_LANE",
    requiredPlanOrConsent: null,
    sourceIds: [R7_BROWSER_ECB_POLICY_REVIEW_PATH],
    matrixSha256: R7_BROWSER_ECB_POLICY_REVIEW_SHA256,
    decisionSha256: R7_BROWSER_ECB_POLICY_REVIEW_SHA256,
    diagnosticOnly: false,
  };
  return {
    ...receipt,
    receiptSha256: sha256Digest(canonicalJson(receipt)).replace(/^sha256:/u, ""),
  };
}
