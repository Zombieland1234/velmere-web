import { PASS481_ASSET_IDENTITIES } from "@/lib/market-integrity/asset-identity-registry";
import type { MarketIntegrityRow } from "@/lib/market-integrity/market-row-types";
import type { TokenRiskResult } from "@/lib/market-integrity/risk-types";
import { buildRiskIndicatorCustomerTruth } from "@/lib/market-integrity/risk-indicator-customer-truth";
import type { KlineAssetIdentity, KlineRequestContract } from "@/lib/market-integrity/kline-asset-identity";
import type { MarketCandle } from "@/lib/market-integrity/kline-types";

export const A102R22_LOCAL_MARKET_REFERENCE_ID =
  "a102r22-local-development-market-reference-not-live-v1" as const;

export const A102R23_LOCAL_KLINE_REFERENCE_ID =
  "a102r23-local-development-kline-reference-not-live-v1" as const;

const FIXED_REFERENCE_EPOCH = "2026-07-30T00:00:00.000Z";
const REFERENCE_VALUES: Record<string, { price: number; marketCap: number; volume: number; risk: number }> = {
  BTC: { price: 64000, marketCap: 1_260_000_000_000, volume: 31_000_000_000, risk: 14 },
  ETH: { price: 3300, marketCap: 397_000_000_000, volume: 18_000_000_000, risk: 22 },
  SOL: { price: 170, marketCap: 79_000_000_000, volume: 3_800_000_000, risk: 36 },
  BNB: { price: 590, marketCap: 87_000_000_000, volume: 1_900_000_000, risk: 24 },
  USDT: { price: 1, marketCap: 112_000_000_000, volume: 48_000_000_000, risk: 6 },
  USDC: { price: 1, marketCap: 32_000_000_000, volume: 6_000_000_000, risk: 5 },
  XRP: { price: 0.55, marketCap: 30_000_000_000, volume: 1_200_000_000, risk: 42 },
  ADA: { price: 0.42, marketCap: 15_000_000_000, volume: 420_000_000, risk: 45 },
  DOGE: { price: 0.13, marketCap: 19_000_000_000, volume: 900_000_000, risk: 64 },
  AVAX: { price: 32, marketCap: 12_500_000_000, volume: 380_000_000, risk: 46 },
  LINK: { price: 14, marketCap: 8_500_000_000, volume: 410_000_000, risk: 32 },
  DOT: { price: 6.2, marketCap: 8_700_000_000, volume: 220_000_000, risk: 50 },
  POL: { price: 0.52, marketCap: 5_200_000_000, volume: 190_000_000, risk: 54 },
  LTC: { price: 74, marketCap: 5_500_000_000, volume: 310_000_000, risk: 38 },
  TRX: { price: 0.12, marketCap: 10_500_000_000, volume: 420_000_000, risk: 41 },
  TON: { price: 6.8, marketCap: 16_700_000_000, volume: 320_000_000, risk: 52 },
  SHIB: { price: 0.000017, marketCap: 10_000_000_000, volume: 360_000_000, risk: 71 },
  UNI: { price: 8.4, marketCap: 5_000_000_000, volume: 210_000_000, risk: 39 },
  ATOM: { price: 7.1, marketCap: 2_800_000_000, volume: 150_000_000, risk: 48 },
  NEAR: { price: 5.2, marketCap: 5_700_000_000, volume: 290_000_000, risk: 51 },
  APT: { price: 7.4, marketCap: 3_400_000_000, volume: 210_000_000, risk: 55 },
  ARB: { price: 0.75, marketCap: 2_500_000_000, volume: 310_000_000, risk: 58 },
  OP: { price: 1.8, marketCap: 2_000_000_000, volume: 190_000_000, risk: 61 },
  SUI: { price: 0.95, marketCap: 2_400_000_000, volume: 260_000_000, risk: 56 },
  PEPE: { price: 0.000012, marketCap: 5_000_000_000, volume: 650_000_000, risk: 78 },
  OM: { price: 0.44, marketCap: 380_000_000, volume: 42_000_000, risk: 94 },
  LAB: { price: 18.00, marketCap: 48_000_000, volume: 3_400_000, risk: 100 },
};

function sparkline(price: number, index: number, change7d: number, symbol: string) {
  const startPrice = price / (1 + (change7d || 0) / 100);
  const seed = Array.from(symbol).reduce((acc, c, i) => acc + c.charCodeAt(0) * (i + 1), index * 37);
  const points = 42;

  const noise = (t: number) => {
    const n1 = Math.sin(t * 1.7 + seed * 0.11) * 0.45;
    const n2 = Math.cos(t * 4.1 + seed * 0.23) * 0.3;
    const n3 = Math.sin(t * 8.9 + seed * 0.57) * 0.15;
    const n4 = Math.cos(t * 17.3 + seed * 0.79) * 0.1;
    return n1 + n2 + n3 + n4;
  };

  const volMagnitude = Math.max(0.012, Math.min(0.045, Math.abs(change7d) * 0.0035));

  return Array.from({ length: points }, (_, i) => {
    if (i === points - 1) return price;
    const progress = i / (points - 1);
    const base = startPrice + (price - startPrice) * progress;
    const envelope = Math.sin(progress * Math.PI);
    const fluctuation = base * noise(progress * 10) * volMagnitude * envelope;
    return Math.max(price * 0.01, base + fluctuation);
  });
}

export function buildLocalDevelopmentMarketReferenceRows(args: { page: number; perPage: number }): MarketIntegrityRow[] {
  if (process.env.NODE_ENV === "production") return [];
  const identities = PASS481_ASSET_IDENTITIES.filter((row) =>
    (row.assetClass === "crypto" || row.assetClass === "exchange_token") && REFERENCE_VALUES[row.symbol],
  );
  const start = (args.page - 1) * args.perPage;
  return identities.slice(start, start + args.perPage).map((identity, index) => {
    const reference = REFERENCE_VALUES[identity.symbol]!;
    const globalIndex = start + index;
    const priceChange1h = ((globalIndex % 9) - 4) * 0.18;
    const priceChange24h = ((globalIndex % 11) - 5) * 0.72;
    const priceChange7d = ((globalIndex % 13) - 6) * 1.35;
    const priceChange30d = ((globalIndex % 15) - 7) * 2.1;
    const series = sparkline(reference.price, globalIndex, priceChange7d, identity.symbol);
    const riskInput = {
      marketId: `local-reference-${identity.symbol.toLowerCase()}`,
      symbol: identity.symbol,
      name: identity.label,
      assetClass: "crypto" as const,
      dataSources: [A102R22_LOCAL_MARKET_REFERENCE_ID],
    };
    const riskScore = reference.risk ?? (globalIndex < 5 ? 18 + globalIndex * 4 : 40 + (globalIndex % 35));
    const level = riskScore < 30 ? ("low" as const) : riskScore < 60 ? ("medium" as const) : ("high" as const);
    const badge = riskScore < 30 ? ("low_detected_risk" as const) : riskScore < 60 ? ("elevated_risk" as const) : ("possible_manipulation_risk" as const);
    const baseResult: Omit<TokenRiskResult, "customerTruth"> = {
      token: {
        marketId: `local-reference-${identity.symbol.toLowerCase()}`,
        symbol: identity.symbol,
        name: identity.label,
        image: `/market-logos/${identity.symbol.toLowerCase()}.svg`,
        rank: globalIndex + 1,
        assetClass: "crypto",
      },
      score: riskScore,
      confidence: 0.88,
      level,
      badge,
      signals: [],
      metrics: {
        currentPrice: reference.price,
        marketCap: reference.marketCap,
        volume24h: reference.volume,
        priceChange1h,
        priceChange24h,
        priceChange7d,
        priceChange30d,
      },
      dataQuality: "demo",
      chart: { sevenDay: series },
      dataSources: [A102R22_LOCAL_MARKET_REFERENCE_ID],
      limitations: [
        "Local development reference only.",
        "Values are fixed illustrative fixtures and are not current market data.",
      ],
      providerRiskDelivery: {
        schemaVersion: "pass6_provider_risk_delivery_v1",
        state: "verified",
        scorePublished: true,
        canonicalIdentity: `local-reference-${identity.symbol.toLowerCase()}`,
        sourceReceiptRoot: "verified_local_reference",
        receiptDigest: "verified_local_reference",
        completenessBps: 10_000,
        sourceAsOf: FIXED_REFERENCE_EPOCH,
        blockers: [],
      },
      generatedAt: FIXED_REFERENCE_EPOCH,
    };
    const result: TokenRiskResult = {
      ...baseResult,
      customerTruth: buildRiskIndicatorCustomerTruth({
        input: riskInput,
        result: baseResult,
        reportContextDepth: null,
      }),
    };
    return {
      id: `local-reference-${identity.symbol.toLowerCase()}`,
      rank: globalIndex + 1,
      symbol: identity.symbol,
      name: identity.label,
      image: `/market-logos/${identity.symbol.toLowerCase()}.svg`,
      price: reference.price,
      priceChange1h,
      priceChange24h,
      priceChange7d,
      priceChange30d,
      marketCap: reference.marketCap,
      volume24h: reference.volume,
      observedAt: FIXED_REFERENCE_EPOCH,
      sparkline7d: series,
      result,
    };
  });
}


const KLINE_INTERVAL_MS: Record<KlineRequestContract["range"], number> = {
  "1m": 60_000,
  "15m": 15 * 60_000,
  "1h": 60 * 60_000,
  "4h": 4 * 60 * 60_000,
  "1d": 24 * 60 * 60_000,
  "7d": 7 * 24 * 60 * 60_000,
  "1mo": 24 * 60 * 60_000,
};

const FIXED_REFERENCE_END_MS = Date.parse(FIXED_REFERENCE_EPOCH);

function exactLocalReferenceValue(identity: KlineAssetIdentity) {
  const sym = identity.symbol?.toUpperCase();
  if (sym && REFERENCE_VALUES[sym] && (identity.quote === "USD" || !identity.quote)) {
    return REFERENCE_VALUES[sym];
  }
  const expectedMarketId = `local-reference-${identity.symbol?.toLowerCase()}`;
  if (identity.marketId !== expectedMarketId || identity.quote !== "USD" || identity.chainId !== null || identity.address !== null) {
    return null;
  }
  return REFERENCE_VALUES[identity.symbol] ?? null;
}

function localReferenceCandle(args: {
  basePrice: number;
  index: number;
  timestamp: number;
  symbolSeed: number;
}): MarketCandle {
  const seed = args.symbolSeed + 1337;
  const hash = (n: number) => {
    let h = Math.imul(n ^ (n >>> 16), 0x45d9f3b);
    h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  };

  let cumulative = 0;
  for (let step = 0; step <= args.index; step++) {
    const r1 = hash(seed + step * 31);
    const stepMove = (r1 - 0.494) * 0.0035;
    const wave = Math.sin(step * 0.07 + (seed % 19)) * 0.0003;
    cumulative += stepMove + wave;
  }

  const currentPrice = Math.max(args.basePrice * 0.2, args.basePrice * (1 + cumulative));
  const rHigh = hash(seed + args.index * 101 + 2);
  const rLow = hash(seed + args.index * 101 + 3);
  const rClose = hash(seed + args.index * 101 + 4);

  const candleDelta = (rClose - 0.5) * currentPrice * 0.0045;
  const open = currentPrice;
  const close = currentPrice + candleDelta;
  const spread = Math.abs(close - open);
  const upperWick = Math.max(spread * 0.3, rHigh * currentPrice * 0.0028);
  const lowerWick = Math.max(spread * 0.3, rLow * currentPrice * 0.0028);

  const high = Math.max(open, close) + upperWick;
  const low = Math.max(currentPrice * 0.01, Math.min(open, close) - lowerWick);
  const volBase = Math.max(10, (args.symbolSeed % 50 + 10) * 100_000);
  const volume = Math.round(volBase * (0.6 + hash(seed + args.index * 53) * 1.8 + Math.abs(candleDelta / currentPrice) * 35));

  return {
    timestamp: args.timestamp,
    open,
    high,
    low,
    close,
    volume,
  };
}

export function buildLocalDevelopmentKlineReference(args: {
  identity: KlineAssetIdentity;
  range: KlineRequestContract["range"];
}) {
  if (process.env.NODE_ENV === "production") return null;
  const reference = exactLocalReferenceValue(args.identity);
  if (!reference) return null;
  const intervalMs = KLINE_INTERVAL_MS[args.range];
  const bars = args.range === "1m" ? 240 : 180;
  const symbolSeed = Array.from(args.identity.symbol).reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const firstTimestamp = FIXED_REFERENCE_END_MS - intervalMs * bars;
  const candles = Array.from({ length: bars }, (_, index) => localReferenceCandle({
    basePrice: reference.price,
    index,
    timestamp: firstTimestamp + intervalMs * index,
    symbolSeed,
  }));
  return {
    mode: "local_reference" as const,
    freshness: "local_reference_not_live" as const,
    source: "Velmère local development OHLC reference · illustrative fixed series · not current market data",
    identity: args.identity,
    pair: `${args.identity.symbol}/USD`,
    range: args.range,
    candles,
    generatedAt: FIXED_REFERENCE_EPOCH,
    receivedAt: FIXED_REFERENCE_EPOCH,
    sourceObservations: [],
    providerErrors: ["provider_rights_not_verified"],
    verification: {
      state: "withheld" as const,
      successfulProviders: [],
      providerCount: 0,
      selectedProvider: null,
      exactIdentity: true,
      liveClaimAllowed: false,
    },
    delivery: {
      state: "withheld" as const,
      scorePublished: false,
      blockers: ["local_reference_not_live", "provider_rights_not_verified"],
    },
    referenceProfile: A102R23_LOCAL_KLINE_REFERENCE_ID,
    liveProven: false,
    saleEnabled: false,
  };
}
