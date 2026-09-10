import rightsMatrix from "../../config/pass36/a102r44p18-official-provider-rights-decision-matrix.json";
import {
  resolveProviderDeliveryRights,
  type ProviderDeliveryPurpose,
  type ProviderDeliveryRightsResolution,
} from "../compliance/provider-delivery-rights-gate.mjs";
import { canonicalJson } from "../security/canonical-json";
import { sha256Digest } from "../security/cryptographic-digest";

export const MARKET_IMPACT_DELIVERY_POLICY_ID =
  "velmere.current-execution.market-impact-delivery-policy.v1" as const;

export type MarketImpactDeliverySurface =
  | "market_intelligence"
  | "orderbook"
  | "liquidity_intelligence";

const SURFACES = Object.freeze([
  "market_intelligence",
  "orderbook",
  "liquidity_intelligence",
] as const satisfies readonly MarketImpactDeliverySurface[]);

const DELIVERY_PURPOSES = Object.freeze([
  "public_display",
  "commercial_product",
  "customer_delivery",
  "caching",
  "retention",
  "redistribution",
  "derived_analytics_external",
] as const satisfies readonly ProviderDeliveryPurpose[]);

const PROVIDERS = Object.freeze({
  market_intelligence: ["binance", "mexc", "coinbase", "kraken"],
  orderbook: ["binance"],
  liquidity_intelligence: ["coingecko", "dexscreener", "binance", "defillama"],
} as const satisfies Record<MarketImpactDeliverySurface, readonly string[]>);

export type MarketImpactDeliveryPreflight = Readonly<{
  schemaVersion: typeof MARKET_IMPACT_DELIVERY_POLICY_ID;
  surface: MarketImpactDeliverySurface;
  state: "READY" | "NO_USABLE_ORDER_BOOK";
  providerNetworkAllowed: boolean;
  customerDeliveryAllowed: boolean;
  liveClaimed: false;
  decisions: readonly Readonly<{
    providerId: string;
    rights: readonly ProviderDeliveryRightsResolution[];
    allowed: boolean;
  }>[];
  decisionDigest: string;
}>;

export type NoUsableOrderBookPayload = Readonly<{
  schemaVersion: "velmere.current-execution.market-impact-withheld.v1";
  ok: false;
  mode: "withheld";
  availability: "WITHHELD";
  error: "NO_USABLE_ORDER_BOOK";
  reason: "No rights-safe, current, independently corroborated order book is available.";
  depth?: string;
  surface?: string;
  assetKey?: string;
  publication: Readonly<{
    mode: "withheld";
    evidenceState: "withheld";
    liveClaimed: false;
    blockers: readonly ["NO_USABLE_ORDER_BOOK"];
  }>;
  orderbook: null;
  marketImpact: null;
  liquidityIntelligence: null;
  referenceMidPrice: null;
  representativeExecutions: readonly [];
  confidence: null;
  syntheticLiquidityUsed: false;
  liveClaimed: false;
  retryAfter: null;
}>;

function validSurface(value: unknown): value is MarketImpactDeliverySurface {
  return typeof value === "string" && SURFACES.includes(value as MarketImpactDeliverySurface);
}

function buildUnsigned(surface: MarketImpactDeliverySurface) {
  const decisions = PROVIDERS[surface].map((providerId) => {
    const rights = DELIVERY_PURPOSES.map((purpose) =>
      resolveProviderDeliveryRights({ providerId, purpose, matrix: rightsMatrix }));
    return { providerId, rights, allowed: rights.every((decision) => decision.allowed) };
  });
  const allowed = decisions.length > 0 && decisions.every((decision) => decision.allowed);
  return {
    schemaVersion: MARKET_IMPACT_DELIVERY_POLICY_ID,
    surface,
    state: allowed ? "READY" as const : "NO_USABLE_ORDER_BOOK" as const,
    providerNetworkAllowed: allowed,
    customerDeliveryAllowed: allowed,
    liveClaimed: false as const,
    decisions,
  };
}

export function buildMarketImpactDeliveryPreflight(
  surface: MarketImpactDeliverySurface,
): MarketImpactDeliveryPreflight {
  const unsigned = buildUnsigned(surface);
  return { ...unsigned, decisionDigest: sha256Digest(canonicalJson(unsigned)) };
}

export function verifyMarketImpactDeliveryPreflight(decision: MarketImpactDeliveryPreflight): boolean {
  if (!decision || !validSurface(decision.surface)) return false;
  try {
    return canonicalJson(decision) === canonicalJson(buildMarketImpactDeliveryPreflight(decision.surface));
  } catch {
    return false;
  }
}

export function toNoUsableOrderBook(args: {
  depth?: string;
  surface?: string;
  assetKey?: string;
} = {}): NoUsableOrderBookPayload {
  return {
    schemaVersion: "velmere.current-execution.market-impact-withheld.v1",
    ok: false,
    mode: "withheld",
    availability: "WITHHELD",
    error: "NO_USABLE_ORDER_BOOK",
    reason: "No rights-safe, current, independently corroborated order book is available.",
    ...(args.depth ? { depth: args.depth } : {}),
    ...(args.surface ? { surface: args.surface } : {}),
    ...(args.assetKey ? { assetKey: args.assetKey } : {}),
    publication: {
      mode: "withheld",
      evidenceState: "withheld",
      liveClaimed: false,
      blockers: ["NO_USABLE_ORDER_BOOK"],
    },
    orderbook: null,
    marketImpact: null,
    liquidityIntelligence: null,
    referenceMidPrice: null,
    representativeExecutions: [],
    confidence: null,
    syntheticLiquidityUsed: false,
    liveClaimed: false,
    retryAfter: null,
  };
}

export function projectMarketImpactDelivery(args: {
  decision: MarketImpactDeliveryPreflight;
  payload: unknown;
  binding?: { depth?: string; surface?: string; assetKey?: string };
}): { allowed: true; status: 200; payload: unknown } | { allowed: false; status: 424; payload: NoUsableOrderBookPayload } {
  if (
    !verifyMarketImpactDeliveryPreflight(args.decision)
    || !args.decision.providerNetworkAllowed
    || !args.decision.customerDeliveryAllowed
  ) {
    return { allowed: false, status: 424, payload: toNoUsableOrderBook(args.binding) };
  }
  return { allowed: true, status: 200, payload: args.payload };
}
