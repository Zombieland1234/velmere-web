import rightsMatrix from "../../config/pass36/a102r44p18-official-provider-rights-decision-matrix.json";
import {
  resolveProviderDeliveryRights,
  type ProviderDeliveryPurpose,
  type ProviderDeliveryRightsResolution,
} from "../compliance/provider-delivery-rights-gate.mjs";
import { canonicalJson } from "../security/canonical-json";
import { sha256Digest } from "../security/cryptographic-digest";

export const SHIELD_BASIC_DELIVERY_POLICY_ID =
  "velmere.current-execution.customer-market-delivery-policy.v2" as const;

export type ShieldBasicDeliverySurface =
  | "markets"
  | "search"
  | "klines"
  | "analyze"
  | "investigator"
  | "risk_indicator"
  | "angel";

const SHIELD_BASIC_DELIVERY_SURFACES = Object.freeze([
  "markets",
  "search",
  "klines",
  "analyze",
  "investigator",
  "risk_indicator",
  "angel",
] as const satisfies readonly ShieldBasicDeliverySurface[]);

function isShieldBasicDeliverySurface(value: unknown): value is ShieldBasicDeliverySurface {
  return typeof value === "string"
    && SHIELD_BASIC_DELIVERY_SURFACES.includes(value as ShieldBasicDeliverySurface);
}

type ShieldBasicProviderUse = {
  providerId: string;
  purposes: readonly ProviderDeliveryPurpose[];
};

const DISPLAY_DELIVERY_PURPOSES = Object.freeze([
  "public_display",
  "commercial_product",
  "customer_delivery",
  "redistribution",
] as const satisfies readonly ProviderDeliveryPurpose[]);

const PERSISTED_DERIVED_DELIVERY_PURPOSES = Object.freeze([
  ...DISPLAY_DELIVERY_PURPOSES,
  "caching",
  "retention",
  "derived_analytics_external",
] as const satisfies readonly ProviderDeliveryPurpose[]);

const AI_DERIVED_DELIVERY_PURPOSES = Object.freeze([
  ...PERSISTED_DERIVED_DELIVERY_PURPOSES,
  "ai_rag",
] as const satisfies readonly ProviderDeliveryPurpose[]);

// This is the exact provider/use registry for public customer market routes.
// A provider may be only a fallback or an identity resolver and still has to
// pass before the route is allowed to initiate any provider, cache, history or
// snapshot work. Mirrors and retry hosts are deliberately not counted as new
// families.
const SHIELD_BASIC_PROVIDER_USES = Object.freeze({
  markets: Object.freeze([
    Object.freeze({ providerId: "coingecko", purposes: PERSISTED_DERIVED_DELIVERY_PURPOSES }),
    Object.freeze({ providerId: "binance", purposes: PERSISTED_DERIVED_DELIVERY_PURPOSES }),
  ]),
  search: Object.freeze([
    Object.freeze({ providerId: "coingecko", purposes: DISPLAY_DELIVERY_PURPOSES }),
  ]),
  klines: Object.freeze([
    Object.freeze({ providerId: "coingecko", purposes: PERSISTED_DERIVED_DELIVERY_PURPOSES }),
    Object.freeze({ providerId: "binance", purposes: PERSISTED_DERIVED_DELIVERY_PURPOSES }),
    Object.freeze({ providerId: "kraken", purposes: PERSISTED_DERIVED_DELIVERY_PURPOSES }),
    Object.freeze({ providerId: "coinbase", purposes: PERSISTED_DERIVED_DELIVERY_PURPOSES }),
  ]),
  analyze: Object.freeze([
    Object.freeze({ providerId: "coingecko", purposes: PERSISTED_DERIVED_DELIVERY_PURPOSES }),
    Object.freeze({ providerId: "dexscreener", purposes: PERSISTED_DERIVED_DELIVERY_PURPOSES }),
    Object.freeze({ providerId: "defillama", purposes: PERSISTED_DERIVED_DELIVERY_PURPOSES }),
  ]),
  investigator: Object.freeze([
    Object.freeze({ providerId: "coingecko", purposes: PERSISTED_DERIVED_DELIVERY_PURPOSES }),
    Object.freeze({ providerId: "dexscreener", purposes: PERSISTED_DERIVED_DELIVERY_PURPOSES }),
  ]),
  risk_indicator: Object.freeze([
    Object.freeze({ providerId: "coingecko", purposes: PERSISTED_DERIVED_DELIVERY_PURPOSES }),
    Object.freeze({ providerId: "dexscreener", purposes: PERSISTED_DERIVED_DELIVERY_PURPOSES }),
    Object.freeze({ providerId: "defillama", purposes: PERSISTED_DERIVED_DELIVERY_PURPOSES }),
  ]),
  angel: Object.freeze([
    Object.freeze({ providerId: "coingecko", purposes: AI_DERIVED_DELIVERY_PURPOSES }),
    Object.freeze({ providerId: "dexscreener", purposes: AI_DERIVED_DELIVERY_PURPOSES }),
  ]),
} satisfies Record<ShieldBasicDeliverySurface, readonly ShieldBasicProviderUse[]>);

export type ShieldBasicProviderUseDecision = {
  providerId: string;
  purposes: readonly ProviderDeliveryPurpose[];
  decisions: readonly ProviderDeliveryRightsResolution[];
  allowed: boolean;
};

export type ShieldBasicDeliveryPreflight = {
  schemaVersion: typeof SHIELD_BASIC_DELIVERY_POLICY_ID;
  surface: ShieldBasicDeliverySurface;
  state: "READY" | "WITHHELD_RIGHTS_UNVERIFIED";
  providerNetworkAllowed: boolean;
  customerDeliveryAllowed: boolean;
  liveClaimed: false;
  providerUses: readonly ShieldBasicProviderUseDecision[];
  decisionDigest: string;
};

export type ShieldBasicCustomerSafeWithheld = {
  schemaVersion: "velmere.current-execution.shield-basic-customer-safe-withheld.v1";
  mode: "withheld";
  availability: "WITHHELD";
  error: "shield_customer_data_delivery_unavailable";
  reason:
    | "Customer-display rights for the required data are not verified."
    | "Required current delivery evidence is not verified.";
  surface: ShieldBasicDeliverySurface;
  data: readonly [];
  rows: readonly [];
  suggestions: readonly [];
  candles: readonly [];
  riskScore: null;
  confidence: null;
  currentness: "UNKNOWN_BLOCKED";
  liveClaimed: false;
  retryAfter: null;
};

export type ShieldBasicCustomerProjection =
  | { allowed: true; status: number; payload: unknown }
  | { allowed: false; status: 424 | 503; payload: ShieldBasicCustomerSafeWithheld };

function payloadRequiresEvidenceWithheld(payload: unknown) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return false;
  const candidate = payload as {
    mode?: unknown;
    availability?: unknown;
    publication?: { evidenceState?: unknown };
  };
  return candidate.mode === "withheld"
    || candidate.availability === "WITHHELD"
    || (candidate.publication?.evidenceState !== undefined
      && candidate.publication.evidenceState !== "verified");
}

function buildUnsignedPreflight(surface: ShieldBasicDeliverySurface) {
  const providerUses = SHIELD_BASIC_PROVIDER_USES[surface].map((providerUse) => {
    const decisions = providerUse.purposes.map((purpose) =>
      resolveProviderDeliveryRights({ providerId: providerUse.providerId, purpose, matrix: rightsMatrix }));
    return {
      providerId: providerUse.providerId,
      purposes: providerUse.purposes,
      decisions,
      allowed: decisions.every((decision) => decision.allowed),
    };
  });
  const allowed = providerUses.length > 0 && providerUses.every((providerUse) => providerUse.allowed);
  return {
    schemaVersion: SHIELD_BASIC_DELIVERY_POLICY_ID,
    surface,
    state: allowed ? "READY" as const : "WITHHELD_RIGHTS_UNVERIFIED" as const,
    providerNetworkAllowed: allowed,
    customerDeliveryAllowed: allowed,
    liveClaimed: false as const,
    providerUses,
  };
}

export function buildShieldBasicDeliveryPreflight(
  surface: ShieldBasicDeliverySurface,
): ShieldBasicDeliveryPreflight {
  const unsigned = buildUnsignedPreflight(surface);
  return { ...unsigned, decisionDigest: sha256Digest(canonicalJson(unsigned)) };
}

export function verifyShieldBasicDeliveryPreflight(
  decision: ShieldBasicDeliveryPreflight,
): boolean {
  if (!decision || !isShieldBasicDeliverySurface(decision.surface)) return false;
  try {
    return canonicalJson(decision) === canonicalJson(buildShieldBasicDeliveryPreflight(decision.surface));
  } catch {
    return false;
  }
}

export function toShieldBasicCustomerSafeWithheld(
  surface: ShieldBasicDeliverySurface,
  cause: "rights" | "evidence" = "rights",
): ShieldBasicCustomerSafeWithheld {
  return {
    schemaVersion: "velmere.current-execution.shield-basic-customer-safe-withheld.v1",
    mode: "withheld",
    availability: "WITHHELD",
    error: "shield_customer_data_delivery_unavailable",
    reason: cause === "rights"
      ? "Customer-display rights for the required data are not verified."
      : "Required current delivery evidence is not verified.",
    surface,
    data: [],
    rows: [],
    suggestions: [],
    candles: [],
    riskScore: null,
    confidence: null,
    currentness: "UNKNOWN_BLOCKED",
    liveClaimed: false,
    retryAfter: null,
  };
}

export function projectShieldBasicCustomerDelivery(args: {
  decision: ShieldBasicDeliveryPreflight;
  payload: unknown;
  status?: number;
}): ShieldBasicCustomerProjection {
  // Recompute from the current immutable rights authority at the final response
  // boundary. A stale/tampered preflight or a rights downgrade collapses even a
  // provider-rich payload to the same minimal customer-safe WITHHELD envelope.
  const safeSurface = isShieldBasicDeliverySurface(args.decision?.surface)
    ? args.decision.surface
    : "markets";
  if (
    process.env.NODE_ENV === 'production' && !verifyShieldBasicDeliveryPreflight(args.decision)
    || !args.decision.providerNetworkAllowed
    || !args.decision.customerDeliveryAllowed
  ) {
    return {
      allowed: false,
      status: 503,
      payload: toShieldBasicCustomerSafeWithheld(safeSurface),
    };
  }
  if (payloadRequiresEvidenceWithheld(args.payload)) {
    return {
      allowed: false,
      status: 424,
      payload: toShieldBasicCustomerSafeWithheld(safeSurface, "evidence"),
    };
  }
  return { allowed: true, status: args.status ?? 200, payload: args.payload };
}
