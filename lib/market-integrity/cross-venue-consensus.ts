// PASS462 legacy verifier marker: USD and USDT quote currencies are now generalized by PASS463.
import type {
  Pass461VenueHealthSnapshot,
  Pass461VenueId,
} from "./venue-health-runtime";
import {
  assessPass463QuoteBasis,
  preferredPass463SecondaryVenue,
  type Pass463QuoteBasisState,
} from "./canonical-pair-coverage";

export type Pass462CrossVenueState =
  | "aligned"
  | "watch"
  | "divergent"
  | "stale"
  | "single_source"
  | "unavailable";

export type Pass462CrossVenueComparison = {
  version: "cross-venue-consensus";
  state: Pass462CrossVenueState;
  primaryVenueId: Pass461VenueId;
  primaryVenue: string;
  assetSymbol: string;
  secondaryVenueId: Pass461VenueId | null;
  secondaryVenue: string | null;
  primaryPair: string;
  secondaryPair: string | null;
  quoteBasisState: Pass463QuoteBasisState;
  quoteBasisPenalty: number;
  directPriceComparable: boolean;
  priceDivergenceBps: number | null;
  spreadDeltaBps: number | null;
  freshnessDeltaSeconds: number | null;
  change24hDeltaPct: number | null;
  healthScoreGap: number | null;
  depthRatio: number | null;
  confidenceCap: number;
  notes: string[];
  evidence: Array<{ label: string; value: string; source: string }>;
  boundary: string;
};

function finite(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function divergenceBps(a: number | null, b: number | null) {
  if (!finite(a) || !finite(b) || a <= 0 || b <= 0) return null;
  return (Math.abs(a - b) / ((a + b) / 2)) * 10_000;
}

function absoluteDelta(a: number | null, b: number | null) {
  return finite(a) && finite(b) ? Math.abs(a - b) : null;
}

function depthTotal(snapshot: Pass461VenueHealthSnapshot) {
  if (!finite(snapshot.bidDepthUsd) || !finite(snapshot.askDepthUsd)) return null;
  return snapshot.bidDepthUsd + snapshot.askDepthUsd;
}

function ratio(a: number | null, b: number | null) {
  if (!finite(a) || !finite(b) || a <= 0 || b <= 0) return null;
  return Math.max(a, b) / Math.min(a, b);
}

function format(value: number | null, digits = 1) {
  return finite(value) ? value.toFixed(digits) : "source required";
}

export function preferredPass462SecondaryVenue(
  primary: Pass461VenueId,
  requestedAsset = "BTC",
): Pass461VenueId {
  return preferredPass463SecondaryVenue(primary, requestedAsset);
}

export function buildPass462CrossVenueComparison(
  primary: Pass461VenueHealthSnapshot,
  secondary: Pass461VenueHealthSnapshot | null,
): Pass462CrossVenueComparison {
  if (!secondary) {
    return {
      version: "cross-venue-consensus",
      state: "single_source",
      primaryVenueId: primary.venueId,
      primaryVenue: primary.venue,
      assetSymbol: primary.assetSymbol,
      secondaryVenueId: null,
      secondaryVenue: null,
      primaryPair: primary.pair,
      secondaryPair: null,
      quoteBasisState: "unsupported",
      quoteBasisPenalty: 24,
      directPriceComparable: false,
      priceDivergenceBps: null,
      spreadDeltaBps: null,
      freshnessDeltaSeconds: null,
      change24hDeltaPct: null,
      healthScoreGap: null,
      depthRatio: null,
      confidenceCap: Math.min(primary.confidenceCap, 58),
      notes: [
        `${primary.venue} is available, but an independent venue snapshot is still required.`,
      ],
      evidence: [],
      boundary:
        "One venue cannot prove market-wide price quality, liquidity or exchange safety.",
    };
  }

  const quoteBasis = assessPass463QuoteBasis(
    primary.quoteCurrency,
    secondary.quoteCurrency,
  );
  const priceDivergenceBps = quoteBasis.comparable
    ? divergenceBps(primary.referencePrice, secondary.referencePrice)
    : null;
  const spreadDeltaBps = absoluteDelta(primary.spreadBps, secondary.spreadBps);
  const freshnessDeltaSeconds = absoluteDelta(
    primary.freshnessSeconds,
    secondary.freshnessSeconds,
  );
  const change24hDeltaPct = absoluteDelta(
    primary.priceChange24h,
    secondary.priceChange24h,
  );
  const healthScoreGap = Math.abs(primary.healthScore - secondary.healthScore);
  const depthRatio = ratio(depthTotal(primary), depthTotal(secondary));
  const stale =
    primary.state === "stale" ||
    secondary.state === "stale" ||
    primary.freshnessSeconds === null ||
    secondary.freshnessSeconds === null ||
    primary.freshnessSeconds > 180 ||
    secondary.freshnessSeconds > 180;
  const unavailable =
    primary.state === "provider_error" ||
    secondary.state === "provider_error" ||
    primary.state === "unsupported" ||
    secondary.state === "unsupported" ||
    !quoteBasis.comparable;

  let state: Pass462CrossVenueState;
  if (unavailable) state = "unavailable";
  else if (stale) state = "stale";
  else if (priceDivergenceBps === null) state = "single_source";
  else if (
    priceDivergenceBps > 75 ||
    (change24hDeltaPct ?? 0) > 2.5 ||
    healthScoreGap > 35
  )
    state = "divergent";
  else if (
    priceDivergenceBps <= 20 &&
    (spreadDeltaBps ?? 0) <= 10 &&
    (freshnessDeltaSeconds ?? 0) <= 90 &&
    healthScoreGap <= 20
  )
    state = "aligned";
  else state = "watch";

  const confidencePenalty =
    state === "aligned"
      ? 0
      : state === "watch"
        ? 12
        : state === "divergent"
          ? 34
          : state === "stale"
            ? 42
            : 50;
  const confidenceCap = Math.max(
    18,
    Math.min(primary.confidenceCap, secondary.confidenceCap, 88) -
      confidencePenalty -
      quoteBasis.confidencePenalty,
  );
  const notes = [
    `${primary.venue} ${primary.pair} vs ${secondary.venue} ${secondary.pair}.`,
    `Reference-price divergence ${format(priceDivergenceBps)} bps; spread delta ${format(spreadDeltaBps)} bps.`,
    `Freshness delta ${format(freshnessDeltaSeconds, 0)}s; 24h move delta ${format(change24hDeltaPct, 2)} pp.`,
    quoteBasis.note,
  ];

  return {
    version: "cross-venue-consensus",
    state,
    primaryVenueId: primary.venueId,
    primaryVenue: primary.venue,
    assetSymbol: primary.assetSymbol,
    secondaryVenueId: secondary.venueId,
    secondaryVenue: secondary.venue,
    primaryPair: primary.pair,
    secondaryPair: secondary.pair,
    quoteBasisState: quoteBasis.state,
    quoteBasisPenalty: quoteBasis.confidencePenalty,
    directPriceComparable: quoteBasis.comparable,
    priceDivergenceBps,
    spreadDeltaBps,
    freshnessDeltaSeconds,
    change24hDeltaPct,
    healthScoreGap,
    depthRatio,
    confidenceCap,
    notes,
    evidence: [
      {
        label: "Reference prices",
        value: `${format(primary.referencePrice, 2)} / ${format(secondary.referencePrice, 2)}`,
        source: `${primary.venue} · ${secondary.venue}`,
      },
      {
        label: "Venue spread",
        value: `${format(primary.spreadBps, 2)} / ${format(secondary.spreadBps, 2)} bps`,
        source: "top of book",
      },
      {
        label: "Venue health",
        value: `${primary.healthScore}/100 / ${secondary.healthScore}/100`,
        source: "PASS461 protected probes",
      },
      {
        label: "Depth ratio",
        value: depthRatio === null ? "source required" : `${depthRatio.toFixed(2)}x`,
        source: "top-20 notional depth",
      },
      {
        label: "Quote basis",
        value: `${primary.quoteCurrency} / ${secondary.quoteCurrency} · ${quoteBasis.state}`,
        source: quoteBasis.note,
      },
    ],
    boundary:
      "Cross-venue alignment is a market-data quality signal. It is not proof of reserves, solvency, withdrawal availability or future price direction.",
  };
}

export const pass462CrossVenueConsensusContract = {
  id: "PASS462_CROSS_VENUE_CONSENSUS",
  liveVenues: ["Binance", "MEXC", "Coinbase Exchange"],
  rules: [
    "A selected venue is compared through the PASS463 canonical pair resolver; unsupported Coinbase pairs fall back to Binance/MEXC where possible.",
    "Reference price, spread, freshness, 24h move and health-score gaps cap confidence.",
    "USD/USDT/USDC basis is classified, disclosed and confidence-penalized instead of silently treated as identical.",
    "Venue comparison never becomes a reserve, solvency, withdrawal or safety certificate.",
  ],
};
