import { canonicalJson } from "../security/canonical-json";
import { sha256Hex } from "../security/cryptographic-digest";
import type {
  MarketImpactEvidenceStatus,
  MarketImpactLevelInput,
  MarketImpactVenueSnapshot,
} from "./market-impact-types";

const MAX_LEVELS = 200;

function finitePositive(value: unknown): number | null {
  const parsed = typeof value === "number" ? value : Number(String(value ?? ""));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function levelRows(value: unknown, priceIndex = 0, quantityIndex = 1): MarketImpactLevelInput[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, MAX_LEVELS).flatMap((row) => {
    if (!Array.isArray(row)) return [];
    const price = finitePositive(row[priceIndex]);
    const baseQuantity = finitePositive(row[quantityIndex]);
    return price !== null && baseQuantity !== null ? [{ price, baseQuantity }] : [];
  });
}

function buildSnapshot(args: {
  venueId: string;
  providerFamily: string;
  assetKey: string;
  quoteCurrency?: "USD" | "USDT" | "USDC";
  observedAt: string;
  status: MarketImpactEvidenceStatus;
  feeBps?: number;
  bids: MarketImpactLevelInput[];
  asks: MarketImpactLevelInput[];
  rawPayload: unknown;
}): MarketImpactVenueSnapshot {
  if (args.bids.length === 0 || args.asks.length === 0) throw new Error("order_book_side_empty");
  const sourceDigest = sha256Hex(canonicalJson({
    venueId: args.venueId,
    providerFamily: args.providerFamily,
    assetKey: args.assetKey,
    observedAt: args.observedAt,
    rawPayload: args.rawPayload,
  }));
  return {
    venueId: args.venueId,
    providerFamily: args.providerFamily,
    assetKey: args.assetKey,
    quoteCurrency: args.quoteCurrency ?? "USD",
    observedAt: args.observedAt,
    status: args.status,
    feeBps: args.feeBps,
    bids: args.bids,
    asks: args.asks,
    sourceDigest,
  };
}

export function parseBinanceOrderBook(args: {
  payload: unknown;
  assetKey: string;
  observedAt: string;
  status: MarketImpactEvidenceStatus;
  marketId?: string;
  feeBps?: number;
}): MarketImpactVenueSnapshot {
  const payload = args.payload as { bids?: unknown; asks?: unknown };
  return buildSnapshot({
    venueId: args.marketId ? `binance:${args.marketId}` : "binance:spot",
    providerFamily: "binance",
    assetKey: args.assetKey,
    quoteCurrency: "USDT",
    observedAt: args.observedAt,
    status: args.status,
    feeBps: args.feeBps,
    bids: levelRows(payload?.bids),
    asks: levelRows(payload?.asks),
    rawPayload: args.payload,
  });
}

export function parseMexcOrderBook(args: {
  payload: unknown;
  assetKey: string;
  observedAt: string;
  status: MarketImpactEvidenceStatus;
  marketId?: string;
  feeBps?: number;
}): MarketImpactVenueSnapshot {
  const payload = args.payload as { bids?: unknown; asks?: unknown };
  return buildSnapshot({
    venueId: args.marketId ? `mexc:${args.marketId}` : "mexc:spot",
    providerFamily: "mexc",
    assetKey: args.assetKey,
    quoteCurrency: "USDT",
    observedAt: args.observedAt,
    status: args.status,
    feeBps: args.feeBps,
    bids: levelRows(payload?.bids),
    asks: levelRows(payload?.asks),
    rawPayload: args.payload,
  });
}

export function parseCoinbaseOrderBook(args: {
  payload: unknown;
  assetKey: string;
  observedAt: string;
  status: MarketImpactEvidenceStatus;
  productId?: string;
  feeBps?: number;
}): MarketImpactVenueSnapshot {
  const payload = args.payload as { bids?: unknown; asks?: unknown; pricebook?: { bids?: unknown; asks?: unknown } };
  const bids = payload?.bids ?? payload?.pricebook?.bids;
  const asks = payload?.asks ?? payload?.pricebook?.asks;
  const normalizeObjects = (value: unknown): MarketImpactLevelInput[] => {
    if (!Array.isArray(value)) return [];
    return value.slice(0, MAX_LEVELS).flatMap((row) => {
      if (Array.isArray(row)) {
        const price = finitePositive(row[0]);
        const baseQuantity = finitePositive(row[1]);
        return price !== null && baseQuantity !== null ? [{ price, baseQuantity }] : [];
      }
      if (!row || typeof row !== "object") return [];
      const record = row as Record<string, unknown>;
      const price = finitePositive(record.price ?? record.price_level);
      const baseQuantity = finitePositive(record.size ?? record.new_quantity ?? record.quantity);
      return price !== null && baseQuantity !== null ? [{ price, baseQuantity }] : [];
    });
  };
  return buildSnapshot({
    venueId: args.productId ? `coinbase:${args.productId}` : "coinbase:exchange",
    providerFamily: "coinbase",
    assetKey: args.assetKey,
    quoteCurrency: "USD",
    observedAt: args.observedAt,
    status: args.status,
    feeBps: args.feeBps,
    bids: normalizeObjects(bids),
    asks: normalizeObjects(asks),
    rawPayload: args.payload,
  });
}

export function parseKrakenOrderBook(args: {
  payload: unknown;
  assetKey: string;
  observedAt: string;
  status: MarketImpactEvidenceStatus;
  pairId?: string;
  feeBps?: number;
}): MarketImpactVenueSnapshot {
  const root = args.payload as { error?: unknown; result?: Record<string, { bids?: unknown; asks?: unknown }> };
  if (Array.isArray(root?.error) && root.error.length > 0) throw new Error("kraken_payload_error");
  const result = root?.result && typeof root.result === "object" ? root.result : {};
  const pairId = args.pairId && result[args.pairId]
    ? args.pairId
    : Object.keys(result)[0];
  if (!pairId) throw new Error("kraken_pair_missing");
  const book = result[pairId];
  return buildSnapshot({
    venueId: `kraken:${pairId}`,
    providerFamily: "kraken",
    assetKey: args.assetKey,
    quoteCurrency: "USD",
    observedAt: args.observedAt,
    status: args.status,
    feeBps: args.feeBps,
    bids: levelRows(book?.bids),
    asks: levelRows(book?.asks),
    rawPayload: args.payload,
  });
}
