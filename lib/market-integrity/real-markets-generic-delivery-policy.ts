import rightsMatrix from "../../config/pass36/a102r44p18-official-provider-rights-decision-matrix.json";
import {
  resolveProviderDeliveryRights,
  type ProviderDeliveryPurpose,
  type ProviderDeliveryRightsResolution,
} from "../compliance/provider-delivery-rights-gate.mjs";
import { canonicalJson } from "../security/canonical-json";
import { sha256Digest } from "../security/cryptographic-digest";

export const REAL_MARKETS_GENERIC_DELIVERY_POLICY_ID =
  "velmere.current-execution.real-markets-generic-delivery-policy.v1" as const;

export type RealMarketsGenericDeliverySurface = "search" | "quotes";
export type RealMarketsGenericTier = "Basic" | "Pro" | "Advanced";

const SEARCH_DELIVERY_PURPOSES = Object.freeze([
  "public_display",
  "commercial_product",
  "customer_delivery",
  "caching",
  "redistribution",
] as const satisfies readonly ProviderDeliveryPurpose[]);

const QUOTE_DELIVERY_PURPOSES = Object.freeze([
  "public_display",
  "commercial_product",
  "customer_delivery",
  "caching",
  "retention",
  "redistribution",
  "derived_analytics_external",
  "pdf_export",
  "ai_rag",
  "paid_tier",
] as const satisfies readonly ProviderDeliveryPurpose[]);

type RegisteredProviderUse = Readonly<{
  providerId: string;
  purposes: readonly ProviderDeliveryPurpose[];
}>;

// Provider families are exact logical upstreams. Retry hosts, aliases and
// multiple URLs never become additional independent or rights-bearing sources.
const REGISTERED_PROVIDER_USES = Object.freeze({
  search: Object.freeze([
    Object.freeze({ providerId: "yahoo_finance", purposes: SEARCH_DELIVERY_PURPOSES }),
  ]),
  quotes: Object.freeze([
    Object.freeze({ providerId: "yahoo_finance", purposes: QUOTE_DELIVERY_PURPOSES }),
    Object.freeze({ providerId: "stooq", purposes: QUOTE_DELIVERY_PURPOSES }),
    Object.freeze({ providerId: "coingecko", purposes: QUOTE_DELIVERY_PURPOSES }),
    Object.freeze({ providerId: "binance", purposes: QUOTE_DELIVERY_PURPOSES }),
    Object.freeze({ providerId: "mexc", purposes: QUOTE_DELIVERY_PURPOSES }),
    Object.freeze({ providerId: "coinbase", purposes: QUOTE_DELIVERY_PURPOSES }),
    Object.freeze({ providerId: "alpha_vantage", purposes: QUOTE_DELIVERY_PURPOSES }),
  ]),
} satisfies Record<RealMarketsGenericDeliverySurface, readonly RegisteredProviderUse[]>);

export type RealMarketsGenericProviderUseDecision = Readonly<{
  providerId: string;
  purposes: readonly ProviderDeliveryPurpose[];
  decisions: readonly ProviderDeliveryRightsResolution[];
  allowed: boolean;
}>;

export type RealMarketsGenericDeliveryPreflight = Readonly<{
  schemaVersion: typeof REAL_MARKETS_GENERIC_DELIVERY_POLICY_ID;
  surface: RealMarketsGenericDeliverySurface;
  state: "READY" | "WITHHELD_RIGHTS_UNVERIFIED";
  observedProviderFamilies: readonly string[];
  providerNetworkAllowed: boolean;
  customerDeliveryAllowed: boolean;
  liveClaimed: false;
  executableQuoteClaimed: false;
  marketPriceEligible: false;
  providerUses: readonly RealMarketsGenericProviderUseDecision[];
  blockers: readonly string[];
  rightsMatrixSha256: string;
  decisionDigest: string;
}>;

export type RealMarketsGenericCustomerSafeWithheld = Readonly<{
  schemaVersion: "velmere.current-execution.real-markets-generic-withheld.v1";
  ok: false;
  mode: "withheld";
  availability: "WITHHELD";
  error: "real_markets_customer_delivery_unavailable";
  reason: "Customer-display and commercial-delivery rights for the required market data are not verified.";
  surface: RealMarketsGenericDeliverySurface;
  requestedTier: RealMarketsGenericTier | null;
  rightsState: "WITHHELD_RIGHTS_UNVERIFIED";
  results: readonly [];
  quotes: readonly [];
  canonicalQuotes: readonly [];
  riskScore: null;
  confidence: null;
  currentness: "UNKNOWN_BLOCKED";
  liveClaimed: false;
  executable: false;
  executableQuoteClaimed: false;
  marketPriceEligible: false;
  customerFinalCredit: false;
  retryAfter: null;
}>;

function validSurface(value: unknown): value is RealMarketsGenericDeliverySurface {
  return value === "search" || value === "quotes";
}

function validTier(value: unknown): value is RealMarketsGenericTier {
  return value === "Basic" || value === "Pro" || value === "Advanced";
}

function boundedProviderId(value: unknown) {
  if (typeof value !== "string") return "invalid_provider_family";
  return value.replace(/[^a-z0-9_.-]+/giu, "_").slice(0, 64) || "invalid_provider_family";
}

function uniqueStrings(values: readonly string[]) {
  return Array.from(new Set(values));
}

function buildUnsigned(
  surface: RealMarketsGenericDeliverySurface,
  observedProviderFamilies?: readonly string[],
) {
  const registeredUses = REGISTERED_PROVIDER_USES[surface];
  const requiredProviderFamilies = registeredUses.map((providerUse) => providerUse.providerId);
  const requiredProviderFamilySet = new Set<string>(requiredProviderFamilies);
  const rawObserved = observedProviderFamilies === undefined
    ? requiredProviderFamilies
    : observedProviderFamilies.map(boundedProviderId);
  const observed = uniqueStrings(rawObserved);
  const duplicateFamilies = uniqueStrings(rawObserved.filter((providerId, index) => rawObserved.indexOf(providerId) !== index));
  const unregisteredFamilies = observed.filter((providerId) => !requiredProviderFamilySet.has(providerId));
  const missingFamilies = requiredProviderFamilies.filter((providerId) => !observed.includes(providerId));
  const exactFamilySet = duplicateFamilies.length === 0
    && unregisteredFamilies.length === 0
    && missingFamilies.length === 0
    && observed.length === requiredProviderFamilies.length;

  const providerUses = observed.map((providerId) => {
    const registered = registeredUses.find((providerUse) => providerUse.providerId === providerId);
    const purposes = registered?.purposes ?? QUOTE_DELIVERY_PURPOSES;
    const decisions = purposes.map((purpose) =>
      resolveProviderDeliveryRights({ providerId, purpose, matrix: rightsMatrix }));
    return {
      providerId,
      purposes,
      decisions,
      allowed: Boolean(registered) && decisions.length === purposes.length && decisions.every((decision) => decision.allowed),
    };
  });

  const globalBoundary = rightsMatrix.globalTruthBoundary;
  const globalRightsReady = globalBoundary.diagnosticOnly === false
    && globalBoundary.customerDisplayAllowedProviders >= requiredProviderFamilies.length
    && globalBoundary.commercialUseAllowedProviders >= requiredProviderFamilies.length
    && globalBoundary.rightsApprovedProviders >= requiredProviderFamilies.length;
  const providerUsesReady = providerUses.length === requiredProviderFamilies.length
    && providerUses.every((providerUse) => providerUse.allowed);
  const allowed = exactFamilySet && globalRightsReady && providerUsesReady;
  const blockers = uniqueStrings([
    exactFamilySet ? "" : "provider_family_set_mismatch",
    ...duplicateFamilies.map((providerId) => `duplicate_provider_family:${providerId}`),
    ...unregisteredFamilies.map((providerId) => `unregistered_provider_family:${providerId}`),
    ...missingFamilies.map((providerId) => `required_provider_family_missing:${providerId}`),
    globalBoundary.diagnosticOnly === false ? "" : "rights_matrix_diagnostic_only",
    globalBoundary.customerDisplayAllowedProviders >= requiredProviderFamilies.length ? "" : "global_public_display_rights_not_approved",
    globalBoundary.commercialUseAllowedProviders >= requiredProviderFamilies.length ? "" : "global_commercial_use_rights_not_approved",
    globalBoundary.rightsApprovedProviders >= requiredProviderFamilies.length ? "" : "global_provider_rights_not_approved",
    ...providerUses.flatMap((providerUse) => providerUse.allowed ? [] : [`provider_use_not_approved:${providerUse.providerId}`]),
  ].filter(Boolean));

  return {
    schemaVersion: REAL_MARKETS_GENERIC_DELIVERY_POLICY_ID,
    surface,
    state: allowed ? "READY" as const : "WITHHELD_RIGHTS_UNVERIFIED" as const,
    observedProviderFamilies: observed,
    providerNetworkAllowed: allowed,
    customerDeliveryAllowed: allowed,
    liveClaimed: false as const,
    executableQuoteClaimed: false as const,
    marketPriceEligible: false as const,
    providerUses,
    blockers,
    rightsMatrixSha256: String(rightsMatrix.matrixSha256 ?? ""),
  };
}

export function buildRealMarketsGenericDeliveryPreflight(
  surface: RealMarketsGenericDeliverySurface,
  observedProviderFamilies?: readonly string[],
): RealMarketsGenericDeliveryPreflight {
  const unsigned = buildUnsigned(surface, observedProviderFamilies);
  return { ...unsigned, decisionDigest: sha256Digest(canonicalJson(unsigned)) };
}

export function verifyRealMarketsGenericDeliveryPreflight(
  decision: RealMarketsGenericDeliveryPreflight,
): boolean {
  if (!decision || !validSurface(decision.surface) || !Array.isArray(decision.observedProviderFamilies)) return false;
  try {
    return canonicalJson(decision) === canonicalJson(
      buildRealMarketsGenericDeliveryPreflight(decision.surface, decision.observedProviderFamilies),
    );
  } catch {
    return false;
  }
}

export function toRealMarketsGenericCustomerSafeWithheld(
  surface: RealMarketsGenericDeliverySurface,
  requestedTier: RealMarketsGenericTier | null,
): RealMarketsGenericCustomerSafeWithheld {
  return {
    schemaVersion: "velmere.current-execution.real-markets-generic-withheld.v1",
    ok: false,
    mode: "withheld",
    availability: "WITHHELD",
    error: "real_markets_customer_delivery_unavailable",
    reason: "Customer-display and commercial-delivery rights for the required market data are not verified.",
    surface,
    requestedTier: validTier(requestedTier) ? requestedTier : null,
    rightsState: "WITHHELD_RIGHTS_UNVERIFIED",
    results: [],
    quotes: [],
    canonicalQuotes: [],
    riskScore: null,
    confidence: null,
    currentness: "UNKNOWN_BLOCKED",
    liveClaimed: false,
    executable: false,
    executableQuoteClaimed: false,
    marketPriceEligible: false,
    customerFinalCredit: false,
    retryAfter: null,
  };
}

export function projectRealMarketsGenericCustomerDelivery(args: {
  decision: RealMarketsGenericDeliveryPreflight;
  requestedTier: RealMarketsGenericTier | null;
  payload: unknown;
  status?: number;
}):
  | { allowed: true; status: number; payload: unknown }
  | { allowed: false; status: 503; payload: RealMarketsGenericCustomerSafeWithheld } {
  const surface = validSurface(args.decision?.surface) ? args.decision.surface : "quotes";
  if (
    !verifyRealMarketsGenericDeliveryPreflight(args.decision)
    || !args.decision.providerNetworkAllowed
    || !args.decision.customerDeliveryAllowed
  ) {
    return {
      allowed: false,
      status: 503,
      payload: toRealMarketsGenericCustomerSafeWithheld(surface, args.requestedTier),
    };
  }
  return { allowed: true, status: args.status ?? 200, payload: args.payload };
}
