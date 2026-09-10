import type { VelmereTier } from "@/lib/market-integrity/top1-risk-foundation";
import { canonicalJson } from "@/lib/security/canonical-json";
import { sha256Digest } from "@/lib/security/cryptographic-digest";

export const P98_CUSTOMER_PAID_TIER_EXACT_DELIVERY_POLICY_ID =
  "p98-customer-paid-tier-exact-delivery-policy-v1" as const;

const TIERS: readonly VelmereTier[] = ["Basic", "Pro", "Advanced"];
const DELIVERY_POLICY_STATUSES = ["ready_basic", "ready_paid", "redacted_to_basic", "unavailable"] as const;
type DeliveryPolicyStatus = (typeof DELIVERY_POLICY_STATUSES)[number];

const DECISION_KEYS = [
  "schemaVersion",
  "requestedTier",
  "analyzedTier",
  "payloadTier",
  "visibleTier",
  "deliveryPolicyStatus",
  "deliveryPolicyPaidEvidenceAllowed",
  "state",
  "exactTierMatch",
  "implicitDowngradeDetected",
  "lowerAvailableTier",
  "artifactCreationAllowed",
  "pdfTokenAllowed",
  "accountArtifactAllowed",
  "explicitDowngradeAcceptanceRequired",
  "silentDowngradeAllowed",
  "humanReviewRequired",
  "customerReasonCode",
  "customerSafeRule",
  "decisionDigest",
] as const;

const CUSTOMER_PROJECTION_KEYS = [
  "schemaVersion",
  "requestedTier",
  "deliveredTier",
  "state",
  "exactTierMatch",
  "silentDowngradeAllowed",
  "humanReviewRequired",
  "decisionDigest",
] as const;

export type P98CustomerPaidTierExactDeliveryDecision = {
  schemaVersion: typeof P98_CUSTOMER_PAID_TIER_EXACT_DELIVERY_POLICY_ID;
  requestedTier: VelmereTier;
  analyzedTier: VelmereTier;
  payloadTier: VelmereTier | null;
  visibleTier: VelmereTier | null;
  deliveryPolicyStatus: DeliveryPolicyStatus | null;
  deliveryPolicyPaidEvidenceAllowed: boolean;
  state: "BASIC_PREVIEW_ALLOWED" | "EXACT_PAID_TIER_ALLOWED" | "REQUESTED_TIER_WITHHELD";
  exactTierMatch: boolean;
  implicitDowngradeDetected: boolean;
  lowerAvailableTier: VelmereTier | null;
  artifactCreationAllowed: boolean;
  pdfTokenAllowed: boolean;
  accountArtifactAllowed: boolean;
  explicitDowngradeAcceptanceRequired: boolean;
  silentDowngradeAllowed: false;
  humanReviewRequired: false;
  customerReasonCode:
    | "ready_basic_preview"
    | "ready_exact_paid_tier"
    | "analysis_tier_mismatch"
    | "lower_tier_only"
    | "requested_tier_not_ready"
    | "customer_payload_unavailable";
  customerSafeRule: string;
  decisionDigest: string;
};

export type P98CustomerPaidTierDeliveryProjection = {
  schemaVersion: typeof P98_CUSTOMER_PAID_TIER_EXACT_DELIVERY_POLICY_ID;
  requestedTier: VelmereTier;
  deliveredTier: VelmereTier;
  state: "BASIC_PREVIEW_ALLOWED" | "EXACT_PAID_TIER_ALLOWED";
  exactTierMatch: true;
  silentDowngradeAllowed: false;
  humanReviewRequired: false;
  decisionDigest: string;
};

type DeliveryPolicyLike = {
  status?: DeliveryPolicyStatus | null;
  visibleTier?: VelmereTier | null;
  paidEvidenceAllowed?: boolean | null;
};

function tierRank(tier: VelmereTier): number {
  return tier === "Basic" ? 0 : tier === "Pro" ? 1 : 2;
}

function validTier(value: unknown): value is VelmereTier {
  return typeof value === "string" && TIERS.includes(value as VelmereTier);
}

function validDeliveryPolicyStatus(value: unknown): value is DeliveryPolicyStatus {
  return typeof value === "string" && DELIVERY_POLICY_STATUSES.includes(value as DeliveryPolicyStatus);
}

function canonicalSeed(decision: Omit<P98CustomerPaidTierExactDeliveryDecision, "decisionDigest">) {
  return decision;
}

export function buildP98CustomerPaidTierExactDeliveryDecision(args: {
  requestedTier: VelmereTier;
  analyzedTier: VelmereTier;
  payloadTier?: VelmereTier | null;
  deliveryPolicy?: DeliveryPolicyLike | null;
}): P98CustomerPaidTierExactDeliveryDecision {
  const payloadTier = validTier(args.payloadTier) ? args.payloadTier : null;
  const visibleTier = validTier(args.deliveryPolicy?.visibleTier) ? args.deliveryPolicy.visibleTier : null;
  const deliveryPolicyStatus = validDeliveryPolicyStatus(args.deliveryPolicy?.status)
    ? args.deliveryPolicy.status
    : null;
  const deliveryPolicyPaidEvidenceAllowed = args.deliveryPolicy?.paidEvidenceAllowed === true;
  const payloadPresent = payloadTier !== null;
  const analyzedTierMatches = args.analyzedTier === args.requestedTier;
  const payloadTierMatches = payloadTier === args.requestedTier;
  const exactTierMatch = analyzedTierMatches && payloadTierMatches && visibleTier === args.requestedTier;
  const basicReady = args.requestedTier === "Basic"
    && exactTierMatch
    && deliveryPolicyStatus === "ready_basic"
    && deliveryPolicyPaidEvidenceAllowed === false;
  const paidReady = args.requestedTier !== "Basic"
    && exactTierMatch
    && deliveryPolicyStatus === "ready_paid"
    && deliveryPolicyPaidEvidenceAllowed === true;
  const lowerAvailableTier = visibleTier && tierRank(visibleTier) < tierRank(args.requestedTier)
    ? visibleTier
    : null;
  const implicitDowngradeDetected = args.requestedTier !== "Basic" && (
    tierRank(args.analyzedTier) < tierRank(args.requestedTier)
    || (payloadTier !== null && tierRank(payloadTier) < tierRank(args.requestedTier))
    || Boolean(lowerAvailableTier)
  );
  const state = basicReady
    ? "BASIC_PREVIEW_ALLOWED" as const
    : paidReady
      ? "EXACT_PAID_TIER_ALLOWED" as const
      : "REQUESTED_TIER_WITHHELD" as const;
  const artifactCreationAllowed = state !== "REQUESTED_TIER_WITHHELD";
  const customerReasonCode: P98CustomerPaidTierExactDeliveryDecision["customerReasonCode"] = basicReady
    ? "ready_basic_preview"
    : paidReady
      ? "ready_exact_paid_tier"
      : !payloadPresent
        ? "customer_payload_unavailable"
        : !analyzedTierMatches || !payloadTierMatches
          ? "analysis_tier_mismatch"
          : lowerAvailableTier
            ? "lower_tier_only"
            : "requested_tier_not_ready";
  const customerSafeRule = state === "BASIC_PREVIEW_ALLOWED"
    ? "Deliver the bounded Basic preview only. It is not a paid or FINAL artifact."
    : state === "EXACT_PAID_TIER_ALLOWED"
      ? "Deliver only the exact paid tier explicitly requested and accepted by the customer."
      : lowerAvailableTier
        ? "The requested tier is unavailable. A lower tier may be offered only through a separate, explicit customer downgrade decision; no artifact or entitlement is created automatically."
        : "The requested tier is unavailable. Do not create a PDF token, account artifact or paid delivery authority.";

  const unsigned = {
    schemaVersion: P98_CUSTOMER_PAID_TIER_EXACT_DELIVERY_POLICY_ID,
    requestedTier: args.requestedTier,
    analyzedTier: args.analyzedTier,
    payloadTier,
    visibleTier,
    deliveryPolicyStatus,
    deliveryPolicyPaidEvidenceAllowed,
    state,
    exactTierMatch,
    implicitDowngradeDetected,
    lowerAvailableTier,
    artifactCreationAllowed,
    pdfTokenAllowed: artifactCreationAllowed,
    accountArtifactAllowed: artifactCreationAllowed && args.requestedTier !== "Basic",
    explicitDowngradeAcceptanceRequired: Boolean(lowerAvailableTier),
    silentDowngradeAllowed: false as const,
    humanReviewRequired: false as const,
    customerReasonCode,
    customerSafeRule,
  };
  return { ...unsigned, decisionDigest: sha256Digest(canonicalJson(canonicalSeed(unsigned))) };
}

export function verifyP98CustomerPaidTierExactDeliveryDecision(
  decision: P98CustomerPaidTierExactDeliveryDecision,
): boolean {
  if (!decision || typeof decision !== "object" || Array.isArray(decision)) return false;
  const keys = Object.keys(decision).sort();
  if (keys.length !== DECISION_KEYS.length || DECISION_KEYS.some((key) => !keys.includes(key))) return false;
  if (decision.schemaVersion !== P98_CUSTOMER_PAID_TIER_EXACT_DELIVERY_POLICY_ID) return false;
  if (!validTier(decision.requestedTier) || !validTier(decision.analyzedTier)) return false;
  if (decision.payloadTier !== null && !validTier(decision.payloadTier)) return false;
  if (decision.visibleTier !== null && !validTier(decision.visibleTier)) return false;
  if (decision.deliveryPolicyStatus !== null && !validDeliveryPolicyStatus(decision.deliveryPolicyStatus)) return false;
  if (typeof decision.deliveryPolicyPaidEvidenceAllowed !== "boolean") return false;
  if (decision.lowerAvailableTier !== null && !validTier(decision.lowerAvailableTier)) return false;
  if (decision.silentDowngradeAllowed !== false || decision.humanReviewRequired !== false) return false;

  const rebuilt = buildP98CustomerPaidTierExactDeliveryDecision({
    requestedTier: decision.requestedTier,
    analyzedTier: decision.analyzedTier,
    payloadTier: decision.payloadTier,
    deliveryPolicy: {
      visibleTier: decision.visibleTier,
      status: decision.deliveryPolicyStatus,
      paidEvidenceAllowed: decision.deliveryPolicyPaidEvidenceAllowed,
    },
  });
  return canonicalJson(rebuilt) === canonicalJson(decision);
}

export function toP98CustomerPaidTierDeliveryProjection(
  decision: P98CustomerPaidTierExactDeliveryDecision,
): P98CustomerPaidTierDeliveryProjection {
  if (!verifyP98CustomerPaidTierExactDeliveryDecision(decision)) {
    throw new Error("p98_delivery_projection_requires_verified_decision");
  }
  if (decision.state === "REQUESTED_TIER_WITHHELD" || !decision.exactTierMatch || decision.visibleTier === null) {
    throw new Error("p98_delivery_projection_requires_exact_allowed_tier");
  }
  const projection = {
    schemaVersion: decision.schemaVersion,
    requestedTier: decision.requestedTier,
    deliveredTier: decision.visibleTier,
    state: decision.state,
    exactTierMatch: true as const,
    silentDowngradeAllowed: false as const,
    humanReviewRequired: false as const,
    decisionDigest: decision.decisionDigest,
  };
  if (Object.keys(projection).length !== CUSTOMER_PROJECTION_KEYS.length) {
    throw new Error("p98_delivery_projection_shape_mismatch");
  }
  return projection;
}

export function toP98CustomerPaidTierWithheldPayload(
  decision: P98CustomerPaidTierExactDeliveryDecision,
) {
  if (!verifyP98CustomerPaidTierExactDeliveryDecision(decision)) {
    throw new Error("p98_withheld_payload_requires_verified_decision");
  }
  if (decision.state !== "REQUESTED_TIER_WITHHELD") {
    throw new Error("p98_withheld_payload_requires_withheld_decision");
  }
  return {
    ok: false as const,
    mode: "withheld" as const,
    error: "requested_paid_tier_withheld" as const,
    availability: "WITHHELD" as const,
    requestedTier: decision.requestedTier,
    deliveredTier: null,
    lowerAvailableTier: decision.lowerAvailableTier,
    explicitDowngradeRequired: decision.explicitDowngradeAcceptanceRequired,
    silentDowngradeAllowed: false as const,
    humanReviewRequired: false as const,
    retryable: false as const,
    customerAction: decision.customerSafeRule,
  };
}
