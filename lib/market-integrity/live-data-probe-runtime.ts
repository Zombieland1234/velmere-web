import type { TokenRiskResult } from "./risk-types";
import type { Pass431BrainCriticLoopRuntime } from "./brain-critic-loop-runtime";

export type Pass432DataTruthMode =
  | "real_market_payload"
  | "partial_provider_payload"
  | "demo_or_fixture_payload"
  | "sealed_unverified_payload";

export type Pass432AssetClass = "crypto" | "exchange" | "stock" | "fx" | "commodity" | "real_estate" | "unknown";

export type Pass432ProbeStatus = "ok" | "watch" | "repair" | "sealed";

export type Pass432LiveDataProbeRuntime = {
  version: "live-data-probe-runtime";
  generatedAt: string;
  dataTruthMode: Pass432DataTruthMode;
  assetClass: Pass432AssetClass;
  liveDataScore: number;
  sampleReadout: {
    querySymbol: string;
    displayName: string;
    priceLine: string;
    riskLine: string;
    sourceLine: string;
    missingLine: string;
    confidenceLine: string;
  };
  providerReality: {
    dataQuality: TokenRiskResult["dataQuality"];
    sourceCount: number;
    sources: string[];
    hasLivePrice: boolean;
    hasMarketCap: boolean;
    hasVolume24h: boolean;
    hasPriceChange24h: boolean;
    hasLiquidity: boolean;
    hasTokenAddress: boolean;
    hasChartSparkline: boolean;
    generatedAtFreshness: "fresh" | "stale" | "missing";
  };
  analysisTruthChecklist: Array<{
    id: string;
    ok: boolean;
    status: Pass432ProbeStatus;
    reason: string;
  }>;
  realDataRepairPlan: Array<{
    id: string;
    action: "keep" | "surface_missing" | "cap_confidence" | "request_second_provider" | "seal_live_claim" | "probe_live_route";
    target: "provider" | "brain" | "pdf" | "ui" | "operator";
    reason: string;
  }>;
  queryProbeContract: {
    sampleQueries: string[];
    localCommand: string;
    checks: string[];
    noFakeLiveRule: true;
  };
  publicSummary: string;
};

export type Pass432LensDataTruthContract = {
  version: "pass432-lens-data-truth-contract";
  generatedAt: string;
  locale: "pl" | "en" | "de";
  dataTruthMode: "customer_preview_payload" | "bounded_preview_payload" | "sealed_preview_payload";
  visibleSuggestionLimit: 3;
  previewDownloadSamePayload: true;
  noTechnicalCustomerCopy: true;
  sourceCount: number;
  confidenceBand: "low" | "medium" | "high";
  sampleCustomerLabel: string;
  repairNotes: string[];
};

function clamp(value: number, min = 0, max = 100) {
  return Math.min(max, Math.max(min, value));
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function money(value: number | undefined) {
  if (!isFiniteNumber(value)) return "price unavailable";
  if (value >= 1000) return `$${Math.round(value).toLocaleString("en-US")}`;
  if (value >= 1) return `$${value.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
  return `$${value.toLocaleString("en-US", { maximumSignificantDigits: 5 })}`;
}

function percent(value: number | undefined) {
  if (!isFiniteNumber(value)) return "change unavailable";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

function generatedAtFreshness(generatedAt: string): Pass432LiveDataProbeRuntime["providerReality"]["generatedAtFreshness"] {
  const time = Date.parse(generatedAt);
  if (!Number.isFinite(time)) return "missing";
  const ageMinutes = (Date.now() - time) / 60000;
  if (ageMinutes <= 20) return "fresh";
  return "stale";
}

function guessAssetClass(result: TokenRiskResult): Pass432AssetClass {
  const symbol = result.token.symbol.toUpperCase();
  const name = result.token.name.toLowerCase();
  const sources = result.dataSources.join(" ").toLowerCase();
  if (result.token.chainId || result.token.tokenAddress || sources.includes("coingecko") || sources.includes("dex")) return "crypto";
  if (["BINANCE", "MEXC", "COINBASE", "KRAKEN", "BYBIT", "OKX"].some((venue) => symbol.includes(venue) || name.includes(venue.toLowerCase()))) return "exchange";
  if (symbol.includes("/")) return "fx";
  if (["XAU", "XAG", "GOLD", "SILVER", "WTI", "BRENT"].some((item) => symbol.includes(item) || name.includes(item.toLowerCase()))) return "commodity";
  if (["REIT", "VNQ", "IYR", "XLRE"].some((item) => symbol.includes(item) || name.includes(item.toLowerCase()))) return "real_estate";
  return "unknown";
}

function truthMode(input: {
  result: TokenRiskResult;
  hasLivePrice: boolean;
  sourceCount: number;
  freshness: "fresh" | "stale" | "missing";
  pass431?: Pass431BrainCriticLoopRuntime;
}): Pass432DataTruthMode {
  if (input.result.dataQuality === "demo") return "demo_or_fixture_payload";
  if (!input.hasLivePrice || input.sourceCount <= 0 || input.freshness === "missing") return "sealed_unverified_payload";
  if (input.result.dataQuality === "live" && input.freshness === "fresh" && input.pass431?.sourceAudit.sourceState === "quorum") return "real_market_payload";
  return "partial_provider_payload";
}

export function buildPass432LiveDataProbeRuntime(input: {
  result: TokenRiskResult;
  pass431?: Pass431BrainCriticLoopRuntime;
}): Pass432LiveDataProbeRuntime {
  const { result, pass431 } = input;
  const metrics = result.metrics;
  const sourceCount = result.dataSources.length;
  const sources = Array.from(new Set(result.dataSources.filter(Boolean))).slice(0, 6);
  const hasLivePrice = isFiniteNumber(metrics.currentPrice);
  const hasMarketCap = isFiniteNumber(metrics.marketCap);
  const hasVolume24h = isFiniteNumber(metrics.volume24h);
  const hasPriceChange24h = isFiniteNumber(metrics.priceChange24h);
  const hasLiquidity = isFiniteNumber(metrics.liquidityUsd);
  const hasTokenAddress = Boolean(result.token.tokenAddress);
  const hasChartSparkline = Boolean(result.chart?.sevenDay?.length);
  const freshness = generatedAtFreshness(result.generatedAt);
  const mode = truthMode({ result, hasLivePrice, sourceCount, freshness, pass431 });
  const assetClass = guessAssetClass(result);
  const liveDataScore = clamp(
    (result.dataQuality === "live" ? 22 : result.dataQuality === "partial" ? 10 : 0) +
      (hasLivePrice ? 14 : 0) +
      (hasMarketCap ? 8 : 0) +
      (hasVolume24h ? 8 : 0) +
      (hasPriceChange24h ? 8 : 0) +
      (hasLiquidity ? 8 : 0) +
      (hasChartSparkline ? 6 : 0) +
      Math.min(14, sourceCount * 4) +
      (freshness === "fresh" ? 8 : freshness === "stale" ? 2 : 0) +
      (pass431?.sourceAudit.sourceState === "quorum" ? 12 : pass431?.sourceAudit.sourceState === "single_source" ? 4 : 0),
  );

  const missing: string[] = [];
  if (!hasLivePrice) missing.push("live price");
  if (!hasVolume24h) missing.push("24h volume");
  if (!hasPriceChange24h) missing.push("24h change");
  if (!hasLiquidity && assetClass === "crypto") missing.push("DEX liquidity");
  if (sourceCount < 2) missing.push("second provider");
  if (freshness !== "fresh") missing.push("fresh timestamp");

  const analysisTruthChecklist: Pass432LiveDataProbeRuntime["analysisTruthChecklist"] = [
    { id: "live_price_present", ok: hasLivePrice, status: hasLivePrice ? "ok" : "sealed", reason: hasLivePrice ? `Current price resolved: ${money(metrics.currentPrice)}.` : "No live price; UI/PDF must not claim live valuation." },
    { id: "source_visible", ok: sourceCount > 0, status: sourceCount > 0 ? "ok" : "sealed", reason: sourceCount > 0 ? `Visible source count: ${sourceCount}.` : "No source listed; answer must be facts-only." },
    { id: "second_provider_truth", ok: sourceCount >= 2 || pass431?.sourceAudit.secondProvider === "confirmed", status: sourceCount >= 2 ? "ok" : "watch", reason: sourceCount >= 2 ? "Second-provider lane can be shown." : "Second provider missing or partial; confidence must stay capped." },
    { id: "freshness_visible", ok: freshness === "fresh", status: freshness === "fresh" ? "ok" : freshness === "stale" ? "watch" : "repair", reason: `Payload timestamp freshness: ${freshness}.` },
    { id: "pdf_will_not_fake_data", ok: mode !== "sealed_unverified_payload", status: mode === "sealed_unverified_payload" ? "sealed" : "ok", reason: mode === "sealed_unverified_payload" ? "PDF/chat must say what is missing instead of filling it." : "PDF/chat can use the resolved payload with visible boundaries." },
  ];

  const realDataRepairPlan: Pass432LiveDataProbeRuntime["realDataRepairPlan"] = [];
  if (!hasLivePrice) realDataRepairPlan.push({ id: "surface_missing_price", action: "surface_missing", target: "ui", reason: "Show missing live price instead of zero/fake value." });
  if (sourceCount < 2) realDataRepairPlan.push({ id: "request_second_provider", action: "request_second_provider", target: "provider", reason: "Run second provider before raising public confidence." });
  if (freshness !== "fresh") realDataRepairPlan.push({ id: "probe_freshness", action: "probe_live_route", target: "operator", reason: "Run probe script or route smoke test for BTC/ETH/NVDA/EURUSD before release." });
  if (mode === "sealed_unverified_payload") realDataRepairPlan.push({ id: "seal_live_claim", action: "seal_live_claim", target: "pdf", reason: "Use facts-only wording until live data is confirmed." });
  if (!realDataRepairPlan.length) realDataRepairPlan.push({ id: "keep_live_probe_clean", action: "keep", target: "brain", reason: "Payload contains enough real-data signals for bounded public output." });

  const sampleReadout = {
    querySymbol: result.token.symbol.toUpperCase(),
    displayName: result.token.name,
    priceLine: `${money(metrics.currentPrice)} · 24h ${percent(metrics.priceChange24h)}`,
    riskLine: `Risk ${result.score}/100 · ${result.level} · confidence ${Math.round((result.confidence ?? 0) * 100)}%`,
    sourceLine: sources.length ? sources.join(" · ") : "source missing",
    missingLine: missing.length ? missing.join(" · ") : "core live fields present",
    confidenceLine: `Truth mode ${mode}; live-data score ${Math.round(liveDataScore)}/100; PASS431 ${pass431?.finalAnswerMode ?? "not attached"}.`,
  };

  return {
    version: "live-data-probe-runtime",
    generatedAt: new Date().toISOString(),
    dataTruthMode: mode,
    assetClass,
    liveDataScore: Math.round(liveDataScore),
    sampleReadout,
    providerReality: {
      dataQuality: result.dataQuality,
      sourceCount,
      sources,
      hasLivePrice,
      hasMarketCap,
      hasVolume24h,
      hasPriceChange24h,
      hasLiquidity,
      hasTokenAddress,
      hasChartSparkline,
      generatedAtFreshness: freshness,
    },
    analysisTruthChecklist,
    realDataRepairPlan,
    queryProbeContract: {
      sampleQueries: ["bitcoin", "ethereum", "solana", "binance", "mexc", "NVDA", "EURUSD=X"],
      localCommand: "npm run probe:pass432-live-data -- bitcoin ethereum solana NVDA EURUSD=X",
      checks: [
        "print price/change/source/missing/confidence for each query",
        "mark provider unavailable instead of pretending live data",
        "compare crypto path and real-markets Yahoo path",
        "write no customer-facing technical copy",
      ],
      noFakeLiveRule: true,
    },
    publicSummary: `PASS432 probe ${mode}; ${result.token.symbol.toUpperCase()} shows ${sampleReadout.priceLine}; missing ${missing.length ? missing.join(", ") : "none in core fields"}; score ${Math.round(liveDataScore)}/100.`,
  };
}

export function buildPass432LensDataTruthContract(input: {
  locale: "pl" | "en" | "de";
  sourceConfidence: number;
  sourceCount: number;
  sectionCount: number;
  missingDataCount: number;
}): Pass432LensDataTruthContract {
  const confidenceBand: Pass432LensDataTruthContract["confidenceBand"] = input.sourceConfidence >= 72
    ? "high"
    : input.sourceConfidence >= 48
      ? "medium"
      : "low";
  const dataTruthMode: Pass432LensDataTruthContract["dataTruthMode"] = input.sourceCount >= 2 && input.sectionCount === 6 && confidenceBand !== "low"
    ? "customer_preview_payload"
    : input.sourceCount >= 1 && input.sectionCount === 6
      ? "bounded_preview_payload"
      : "sealed_preview_payload";
  const label = input.locale === "de" ? "PDF-Vorschau" : input.locale === "en" ? "PDF preview" : "Podgląd PDF";
  const repairNotes = [
    input.sourceCount < 2 ? "keep second-provider gap visible" : null,
    input.sectionCount !== 6 ? "restore six-section PDF order" : null,
    input.missingDataCount ? "surface missing data in customer language" : null,
    confidenceBand === "low" ? "cap confidence and avoid strong claims" : null,
  ].filter(Boolean) as string[];
  return {
    version: "pass432-lens-data-truth-contract",
    generatedAt: new Date().toISOString(),
    locale: input.locale,
    dataTruthMode,
    visibleSuggestionLimit: 3,
    previewDownloadSamePayload: true,
    noTechnicalCustomerCopy: true,
    sourceCount: input.sourceCount,
    confidenceBand,
    sampleCustomerLabel: label,
    repairNotes,
  };
}
