import { readJsonResponseBounded } from "@/lib/network/fetch-with-deadline";
import { brokeredEgressFetch } from "@/lib/network/brokered-egress";

/**
 * Pyth Hermes is a reference-price lane, not a customer-delivery licence.
 * Hermes requires an API key after the 2026-08-26 Core upgrade; this adapter
 * is deliberately server-only and reports rights separately from transport.
 */
const PYTH_HERMES_BASE = "https://pyth.dourolabs.app/hermes";
const MAX_FRESHNESS_MS = 60_000;

const FEED_IDS = {
  BTC: "e62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43",
  ETH: "ff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace",
} as const;

export type PythSymbol = keyof typeof FEED_IDS;
export type PythReferencePrice = {
  provider: "pyth";
  providerFamily: "oracle_reference";
  symbol: PythSymbol;
  feedId: string;
  price: number;
  confidence: number;
  confidenceBps: number;
  observedAt: string;
  retrievedAt: string;
  freshness: "FRESH" | "STALE";
  freshnessTtlMs: number;
  evidenceState: "observed" | "stale";
  deliveryState: "WITHHELD_RIGHTS_UNVERIFIED";
  sourceUri: string;
};

type HermesPayload = Array<{
  id?: string;
  price?: { price?: string; conf?: string; expo?: number; publish_time?: number };
}>;

function finiteInteger(value: unknown) {
  return typeof value === "number" && Number.isSafeInteger(value) ? value : null;
}

function scale(value: string | undefined, expo: number | null) {
  if (!value || expo === null || !/^-?\d+$/u.test(value) || expo < -18 || expo > 0) return null;
  const integer = Number(value);
  const result = integer * 10 ** expo;
  return Number.isFinite(result) ? result : null;
}

/** Fetch a Pyth reference observation. It intentionally never authorizes UI/PDF/export delivery. */
export async function fetchPythReferencePrice(
  symbol: PythSymbol,
  options: { now?: Date; apiKey?: string } = {},
): Promise<PythReferencePrice | null> {
  const apiKey = (options.apiKey ?? process.env.PYTH_API_KEY ?? "").trim();
  if (!apiKey) return null;
  const feedId = FEED_IDS[symbol];
  const sourceUri = `${PYTH_HERMES_BASE}/api/latest_price_feeds?ids%5B%5D=0x${feedId}`;
  const retrieved = options.now ?? new Date();
  const response = await brokeredEgressFetch(sourceUri, {
    headers: { accept: "application/json", authorization: `Bearer ${apiKey}` },
    cache: "no-store",
  }, {
    profile: "pyth_hermes",
    operation: "pyth_latest_reference_price",
    timeoutMs: 4_500,
    maxResponseBytes: 256 * 1024,
  });
  if (!response.ok) return null;
  const entry = (await readJsonResponseBounded<HermesPayload>(response, 256 * 1024))[0];
  const publishTime = finiteInteger(entry?.price?.publish_time);
  const expo = finiteInteger(entry?.price?.expo);
  const price = scale(entry?.price?.price, expo);
  const confidence = scale(entry?.price?.conf, expo);
  if (!entry || entry.id?.toLowerCase() !== feedId || publishTime === null || publishTime <= 0 || price === null || price <= 0 || confidence === null || confidence < 0) return null;
  const observedMs = publishTime * 1_000;
  const ageMs = Math.max(0, retrieved.getTime() - observedMs);
  const freshness = ageMs <= MAX_FRESHNESS_MS ? "FRESH" as const : "STALE" as const;
  return {
    provider: "pyth",
    providerFamily: "oracle_reference",
    symbol,
    feedId: `0x${feedId}`,
    price,
    confidence,
    confidenceBps: Math.round((confidence / price) * 10_000),
    observedAt: new Date(observedMs).toISOString(),
    retrievedAt: retrieved.toISOString(),
    freshness,
    freshnessTtlMs: MAX_FRESHNESS_MS,
    evidenceState: freshness === "FRESH" ? "observed" : "stale",
    deliveryState: "WITHHELD_RIGHTS_UNVERIFIED",
    sourceUri,
  };
}

export const PYTH_REFERENCE_PROVIDER_CONTRACT = {
  provider: "pyth",
  apiKeyRequired: true,
  supportedSymbols: Object.keys(FEED_IDS),
  freshnessTtlMs: MAX_FRESHNESS_MS,
  customerDelivery: "WITHHELD_RIGHTS_UNVERIFIED",
  purpose: "internal_reference_and_cross_source_reconciliation_only",
} as const;
