import type { UniversalAssetRow } from "./universal-asset-market-matrix";

export const PASS4825_MARKET_COVERAGE_UNIVERSE_ID = "pass4825-market-coverage-universe-v1" as const;

export type Pass4825MarketCoverageProfile = "pass416" | "pass417" | "pass418";

const PROFILE = {
  pass416: {
    sourceRhythm: (lane: string) => `${lane} provider cadence · PASS416 precision anchor · 3 suggestions · chart-first no Orbit mount`,
    priceLane: (lane: string) => `${lane} OHLCV-ready lane · chart first · source timestamp required before live wording`,
    volumeLane: (lane: string) => `${lane} volume lane separates session calendar, stale state, spread and drift from AI summary`,
    proofOrDisclosureLane: (lane: string) => `${lane} logo authority + timestamp + second source + checksum before confidence`,
    secondSourceLane: "primary provider ↔ second source ↔ drift check ↔ Lens preview ↔ PDF download",
    confidenceFloor: 97,
    humanCopy: (symbol: string) => `${symbol} routes through PASS416: anchored search, safe metric text, chart-first modal and exact PDF parity.`,
    nextAdapterStep: "Wire official provider, provider timestamp, session calendar, favicon/logo authority, second-source drift and payload checksum.",
  },
  pass417: {
    sourceRhythm: (lane: string) => `${lane} provider cadence · PASS417 chart anchor · official logo/fav icon lane · no fake-live label`,
    priceLane: (lane: string) => `${lane} OHLCV lane · TradingView-style candles · dead-zone drag · provider timestamp required`,
    volumeLane: (lane: string) => `${lane} volume lane separates market session, spread, stale state and second-source drift`,
    proofOrDisclosureLane: (lane: string) => `${lane} provider timestamp + source lineage + checksum + official visual authority`,
    secondSourceLane: "primary provider ↔ second source ↔ payload checksum ↔ Browser preview ↔ PDF download",
    confidenceFloor: 98,
    humanCopy: (symbol: string) => `${symbol} routes through PASS417: chart-first modal, source-bound AI, exact PDF parity and official-provider adapter lane.`,
    nextAdapterStep: "Attach official provider adapter, session calendar, kline/OHLCV cadence, logo authority, source age and checksum.",
  },
  pass418: {
    sourceRhythm: (lane: string) => `${lane} provider cadence · PASS418 cleanroom · official logo/fav icon lane · no fake-live label`,
    priceLane: (lane: string) => `${lane} OHLCV lane · TradingView-style candles · dead-zone drag · provider timestamp required`,
    volumeLane: (lane: string) => `${lane} volume lane separates market session, spread, stale state and second-source drift`,
    proofOrDisclosureLane: (lane: string) => `${lane} provider timestamp + source lineage + checksum + official visual authority`,
    secondSourceLane: "primary provider ↔ second source ↔ payload checksum ↔ Browser preview ↔ PDF download",
    confidenceFloor: 98,
    humanCopy: (symbol: string) => `${symbol} routes through PASS418: chart-first modal, source-bound AI, exact PDF parity and official-provider adapter lane.`,
    nextAdapterStep: "Attach official provider adapter, session calendar, kline/OHLCV cadence, logo authority, source age and checksum.",
  },
} as const;

const ASSET_CLASSES = new Set<UniversalAssetRow["assetClass"]>(["crypto", "exchange_token", "stock", "fx", "real_estate", "etf", "commodity"]);
const SPARK_TONES = new Set<UniversalAssetRow["sparkTone"]>(["up", "down", "flat", "watch"]);

function laneFor(assetClass: UniversalAssetRow["assetClass"]) {
  if (assetClass === "fx") return "FX";
  if (assetClass === "commodity") return "commodity";
  if (assetClass === "real_estate") return "real-estate";
  if (assetClass === "etf") return "ETF";
  if (assetClass === "exchange_token") return "exchange-token";
  if (assetClass === "crypto") return "crypto";
  return "equity";
}

/**
 * Compact TSV keeps catalog data declarative while one typed builder owns all
 * defaults. Format: id, rank, symbol, name, assetClass, riskPressure, sparkTone.
 */
export function buildPass4825MarketCoverageUniverse(profileId: Pass4825MarketCoverageProfile, source: string): UniversalAssetRow[] {
  const profile = PROFILE[profileId];
  const ids = new Set<string>();
  const ranks = new Set<number>();
  return source.trim().split(/\r?\n/).map((line, index) => {
    const columns = line.split("\t");
    if (columns.length !== 7) throw new Error(`pass4825_market_coverage_column_count:${profileId}:${index}`);
    const [id, rankText, symbol, name, assetClassText, riskText, sparkToneText] = columns;
    const rank = Number(rankText);
    const riskPressure = Number(riskText);
    if (!id || !symbol || !name || !Number.isSafeInteger(rank) || !Number.isFinite(riskPressure)) throw new Error(`pass4825_market_coverage_row_invalid:${profileId}:${index}`);
    if (ids.has(id) || ranks.has(rank)) throw new Error(`pass4825_market_coverage_duplicate:${profileId}:${index}`);
    if (!ASSET_CLASSES.has(assetClassText as UniversalAssetRow["assetClass"]) || !SPARK_TONES.has(sparkToneText as UniversalAssetRow["sparkTone"])) throw new Error(`pass4825_market_coverage_enum_invalid:${profileId}:${index}`);
    ids.add(id);
    ranks.add(rank);
    const assetClass = assetClassText as UniversalAssetRow["assetClass"];
    const sparkTone = sparkToneText as UniversalAssetRow["sparkTone"];
    const lane = laneFor(assetClass);
    return {
      sourceRhythm: profile.sourceRhythm(lane),
      priceLane: profile.priceLane(lane),
      volumeLane: profile.volumeLane(lane),
      proofOrDisclosureLane: profile.proofOrDisclosureLane(lane),
      secondSourceLane: profile.secondSourceLane,
      confidenceFloor: profile.confidenceFloor,
      adapterState: "provider_required",
      humanCopy: profile.humanCopy(symbol),
      nextAdapterStep: profile.nextAdapterStep,
      id,
      rank,
      symbol,
      name,
      assetClass,
      riskPressure,
      sparkTone,
    };
  });
}
