import type {
  MarketImpactExecution,
  MarketImpactNormalizedLevel,
  MarketImpactSide,
  MarketImpactVenueContribution,
} from "./market-impact-types";

function round(value: number, digits = 8): number {
  if (!Number.isFinite(value)) return 0;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function contributionRows(
  consumed: Map<string, { providerFamily: string; baseQuantity: number; quoteNotional: number }>,
  totalQuote: number,
): MarketImpactVenueContribution[] {
  return Array.from(consumed.entries())
    .map(([venueId, row]) => ({
      venueId,
      providerFamily: row.providerFamily,
      baseQuantity: round(row.baseQuantity),
      quoteNotional: round(row.quoteNotional, 4),
      contributionPercent: totalQuote > 0 ? round((row.quoteNotional / totalQuote) * 100, 4) : 0,
    }))
    .sort((a, b) => b.quoteNotional - a.quoteNotional || a.venueId.localeCompare(b.venueId));
}

function addContribution(
  target: Map<string, { providerFamily: string; baseQuantity: number; quoteNotional: number }>,
  level: MarketImpactNormalizedLevel,
  baseQuantity: number,
  quoteNotional: number,
) {
  const current = target.get(level.venueId) ?? {
    providerFamily: level.providerFamily,
    baseQuantity: 0,
    quoteNotional: 0,
  };
  current.baseQuantity += baseQuantity;
  current.quoteNotional += quoteNotional;
  target.set(level.venueId, current);
}

export function simulateMarketExecution(args: {
  side: MarketImpactSide;
  requestedNotionalUsd: number;
  referenceMidPrice: number;
  levels: MarketImpactNormalizedLevel[];
}): MarketImpactExecution {
  const requestedNotionalUsd = Math.max(0, args.requestedNotionalUsd);
  const referenceMidPrice = args.referenceMidPrice;
  const requestedBaseQuantity = referenceMidPrice > 0
    ? requestedNotionalUsd / referenceMidPrice
    : 0;
  const contributions = new Map<string, {
    providerFamily: string;
    baseQuantity: number;
    quoteNotional: number;
  }>();

  let filledBaseQuantity = 0;
  let grossQuoteNotionalUsd = 0;
  let feeUsd = 0;
  let worstPrice: number | null = null;

  if (args.side === "buy") {
    let remainingQuote = requestedNotionalUsd;
    for (const level of args.levels) {
      if (remainingQuote <= 1e-9) break;
      const availableQuote = level.price * level.baseQuantity;
      const consumedQuote = Math.min(remainingQuote, availableQuote);
      const consumedBase = level.price > 0 ? consumedQuote / level.price : 0;
      if (consumedBase <= 0) continue;
      filledBaseQuantity += consumedBase;
      grossQuoteNotionalUsd += consumedQuote;
      feeUsd += consumedQuote * (level.feeBps / 10_000);
      remainingQuote -= consumedQuote;
      worstPrice = level.price;
      addContribution(contributions, level, consumedBase, consumedQuote);
    }
  } else {
    let remainingBase = requestedBaseQuantity;
    for (const level of args.levels) {
      if (remainingBase <= 1e-12) break;
      const consumedBase = Math.min(remainingBase, level.baseQuantity);
      const consumedQuote = consumedBase * level.price;
      if (consumedBase <= 0) continue;
      filledBaseQuantity += consumedBase;
      grossQuoteNotionalUsd += consumedQuote;
      feeUsd += consumedQuote * (level.feeBps / 10_000);
      remainingBase -= consumedBase;
      worstPrice = level.price;
      addContribution(contributions, level, consumedBase, consumedQuote);
    }
  }

  const fillRatio = requestedBaseQuantity > 0
    ? Math.min(1, filledBaseQuantity / requestedBaseQuantity)
    : 0;
  const vwap = filledBaseQuantity > 0
    ? grossQuoteNotionalUsd / filledBaseQuantity
    : null;
  const impactBps = vwap !== null && referenceMidPrice > 0
    ? args.side === "buy"
      ? Math.max(0, ((vwap / referenceMidPrice) - 1) * 10_000)
      : Math.max(0, (1 - (vwap / referenceMidPrice)) * 10_000)
    : null;
  const unfilledNotionalUsd = Math.max(
    0,
    (requestedBaseQuantity - filledBaseQuantity) * referenceMidPrice,
  );
  const netQuoteNotionalUsd = args.side === "buy"
    ? grossQuoteNotionalUsd + feeUsd
    : Math.max(0, grossQuoteNotionalUsd - feeUsd);

  return {
    side: args.side,
    requestedNotionalUsd: round(requestedNotionalUsd, 4),
    referenceMidPrice: round(referenceMidPrice),
    requestedBaseQuantity: round(requestedBaseQuantity),
    filledBaseQuantity: round(filledBaseQuantity),
    grossQuoteNotionalUsd: round(grossQuoteNotionalUsd, 4),
    feeUsd: round(feeUsd, 4),
    netQuoteNotionalUsd: round(netQuoteNotionalUsd, 4),
    fillRatio: round(fillRatio, 8),
    unfilledNotionalUsd: round(unfilledNotionalUsd, 4),
    vwap: vwap === null ? null : round(vwap),
    impactBps: impactBps === null ? null : round(impactBps, 4),
    worstPrice: worstPrice === null ? null : round(worstPrice),
    venueContributions: contributionRows(contributions, grossQuoteNotionalUsd),
  };
}

export function scaleMarketDepth(
  levels: MarketImpactNormalizedLevel[],
  depthMultiplier: number,
): MarketImpactNormalizedLevel[] {
  const multiplier = Math.max(0, Math.min(1, depthMultiplier));
  return levels.map((level) => ({
    ...level,
    baseQuantity: level.baseQuantity * multiplier,
    quoteNotional: level.quoteNotional * multiplier,
  }));
}

export function shockMarketSpread(args: {
  bids: MarketImpactNormalizedLevel[];
  asks: MarketImpactNormalizedLevel[];
  referenceMidPrice: number;
  spreadMultiplier: number;
}): { bids: MarketImpactNormalizedLevel[]; asks: MarketImpactNormalizedLevel[] } {
  const multiplier = Math.max(1, args.spreadMultiplier);
  const mid = args.referenceMidPrice;
  const transform = (level: MarketImpactNormalizedLevel, side: MarketImpactSide) => {
    const distance = Math.abs(level.price - mid);
    const shockedDistance = distance * multiplier;
    const price = side === "buy"
      ? mid + shockedDistance
      : Math.max(Number.EPSILON, mid - shockedDistance);
    return {
      ...level,
      price,
      quoteNotional: price * level.baseQuantity,
    };
  };
  return {
    bids: args.bids.map((level) => transform(level, "sell")).sort((a, b) => b.price - a.price),
    asks: args.asks.map((level) => transform(level, "buy")).sort((a, b) => a.price - b.price),
  };
}
