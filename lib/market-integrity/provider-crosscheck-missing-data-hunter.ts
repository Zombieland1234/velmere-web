import type { TokenRiskResult } from "./risk-types";
import type { Pass433ProviderProbe, Pass433RealInternetDataArbitration } from "./real-internet-data-arbitration";

export type Pass434ProviderLane = "crypto_market" | "dex_liquidity" | "token_security" | "real_market" | "exchange_health" | "candles" | "unknown";
export type Pass434TruthTier = "confirmed" | "partial" | "conflict" | "insufficient" | "sealed";
export type Pass434AnswerGate = "release" | "release_with_missing_data" | "facts_only" | "operator_review";

export type Pass434ProviderLaneScore = {
  lane: Pass434ProviderLane;
  providers: string[];
  okCount: number;
  partialCount: number;
  errorCount: number;
  coverage: number;
  missing: string[];
  reliability: number;
  customerLine: string;
};

export type Pass434MissingDataHuntItem = {
  id: string;
  field: string;
  severity: "low" | "medium" | "high" | "critical";
  status: "confirmed" | "missing" | "conflict" | "not_attempted";
  attemptedProviders: string[];
  nextProvider: string;
  pdfVisible: boolean;
  chatVisible: boolean;
  reason: string;
};

export type Pass434ProviderCrosscheckMissingDataHunter = {
  version: "provider-crosscheck-missing-data-hunter";
  generatedAt: string;
  truthTier: Pass434TruthTier;
  answerGate: Pass434AnswerGate;
  internetEvidenceScore: number;
  providerLaneScores: Pass434ProviderLaneScore[];
  missingDataHunter: Pass434MissingDataHuntItem[];
  providerCrosscheck: {
    attemptedProviderCount: number;
    okProviderCount: number;
    partialProviderCount: number;
    errorProviderCount: number;
    secondProviderConfirmed: boolean;
    priceConfirmed: boolean;
    candlesConfirmed: boolean;
    securityConfirmed: boolean;
    maximumPublicConfidence: number;
    reason: string;
  };
  pdfTruthContract: {
    onePayload: true;
    noFakeLive: true;
    mustShowMissingData: boolean;
    maxNarrativeSentences: number;
    sectionOrder: ["brief", "sources", "secondProvider", "missing", "next", "signature"];
  };
  probeCommands: string[];
  operatorReadout: string;
  publicReadout: string;
};

function clamp(value: number, min = 0, max = 100) {
  return Math.min(max, Math.max(min, Math.round(value)));
}

function unique(values: Array<string | undefined | null>) {
  return Array.from(new Set(values.filter(Boolean).map((value) => String(value))));
}

function normalizeLane(lane: string): Pass434ProviderLane {
  if (lane === "crypto_market" || lane === "dex_liquidity" || lane === "token_security" || lane === "real_market" || lane === "exchange_health") return lane;
  if (lane.toLowerCase().includes("candle") || lane.toLowerCase().includes("kline")) return "candles";
  return "unknown";
}

function probesFromInput(result: TokenRiskResult, pass433?: Pass433RealInternetDataArbitration, providerAttempts?: Pass433ProviderProbe[]) {
  const probes = providerAttempts?.length ? providerAttempts : pass433?.providerProbes?.length ? pass433.providerProbes : [];
  if (probes.length) return probes;
  const hasPrice = typeof result.metrics.currentPrice === "number" && Number.isFinite(result.metrics.currentPrice);
  return [
    {
      id: "resolved_payload",
      provider: result.dataSources[0] ?? "resolved payload",
      family: result.dataQuality === "live" ? "crypto_market" : "unknown",
      status: result.dataQuality === "live" ? "ok" : result.dataQuality === "partial" ? "partial" : "not_attempted",
      fieldCoverage: clamp([
        result.metrics.currentPrice,
        result.metrics.priceChange24h,
        result.metrics.volume24h,
        result.metrics.marketCap,
        result.metrics.liquidityUsd,
        result.chart?.sevenDay?.length,
      ].filter((value) => typeof value === "number" && Number.isFinite(value)).length / 6 * 100),
      hasPrice,
      has24hChange: typeof result.metrics.priceChange24h === "number" && Number.isFinite(result.metrics.priceChange24h),
      hasVolume24h: typeof result.metrics.volume24h === "number" && Number.isFinite(result.metrics.volume24h),
      hasMarketCap: typeof result.metrics.marketCap === "number" && Number.isFinite(result.metrics.marketCap),
      hasLiquidity: typeof result.metrics.liquidityUsd === "number" && Number.isFinite(result.metrics.liquidityUsd),
      hasCandles: Boolean(result.chart?.sevenDay?.length),
      hasSecurity: Boolean(result.metrics.holderCount || result.metrics.top10HolderPercent || result.metrics.buyTaxPercentage || result.metrics.sellTaxPercentage),
      sourceFreshness: "missing" as const,
      price: result.metrics.currentPrice,
      change24h: result.metrics.priceChange24h,
      missing: [
        hasPrice ? null : "price",
        result.metrics.priceChange24h === undefined ? "24h change" : null,
        result.metrics.volume24h === undefined ? "24h volume" : null,
        result.metrics.marketCap === undefined ? "market cap" : null,
        result.metrics.liquidityUsd === undefined ? "liquidity" : null,
        result.chart?.sevenDay?.length ? null : "candles",
        result.metrics.holderCount || result.metrics.top10HolderPercent ? null : "security flags",
      ].filter(Boolean) as string[],
    } satisfies Pass433ProviderProbe,
  ];
}

function buildLaneScores(probes: Pass433ProviderProbe[]): Pass434ProviderLaneScore[] {
  const lanes = new Map<Pass434ProviderLane, Pass433ProviderProbe[]>();
  for (const probe of probes) {
    const lane = normalizeLane(probe.family);
    lanes.set(lane, [...(lanes.get(lane) ?? []), probe]);
  }
  return Array.from(lanes.entries()).map(([lane, laneProbes]) => {
    const okCount = laneProbes.filter((probe) => probe.status === "ok").length;
    const partialCount = laneProbes.filter((probe) => probe.status === "partial").length;
    const errorCount = laneProbes.filter((probe) => probe.status === "error").length;
    const coverage = clamp(laneProbes.reduce((sum, probe) => sum + probe.fieldCoverage, 0) / Math.max(1, laneProbes.length));
    const missing = unique(laneProbes.flatMap((probe) => probe.missing));
    const reliability = clamp(coverage * 0.54 + okCount * 18 + partialCount * 8 - errorCount * 12 - missing.length * 2);
    const customerLine = `${lane.replace(/_/g, " ")}: ${okCount} ok, ${partialCount} partial, ${errorCount} errors, coverage ${coverage}%.`;
    return {
      lane,
      providers: unique(laneProbes.map((probe) => probe.provider)),
      okCount,
      partialCount,
      errorCount,
      coverage,
      missing,
      reliability,
      customerLine,
    };
  }).sort((a, b) => b.reliability - a.reliability);
}

function severityFor(field: string): Pass434MissingDataHuntItem["severity"] {
  const clean = field.toLowerCase();
  if (clean.includes("price") || clean.includes("second provider")) return "critical";
  if (clean.includes("fresh") || clean.includes("security") || clean.includes("liquidity")) return "high";
  if (clean.includes("volume") || clean.includes("market cap")) return "medium";
  return "low";
}

function nextProviderFor(field: string) {
  const clean = field.toLowerCase();
  if (clean.includes("price")) return "CoinGecko markets + Yahoo/DEX cross-check";
  if (clean.includes("second provider")) return "DEX Screener for token liquidity or Yahoo for stocks/FX";
  if (clean.includes("liquidity")) return "DEX Screener pair liquidity";
  if (clean.includes("security")) return "GoPlus token security when chain and address are present";
  if (clean.includes("candle")) return "Binance klines, MEXC klines, CoinGecko sparkline or Yahoo chart";
  if (clean.includes("fresh")) return "fresh probe route re-run with timestamp check";
  return "provider-specific fallback adapter";
}

function buildMissingHunter(probes: Pass433ProviderProbe[], pass433?: Pass433RealInternetDataArbitration): Pass434MissingDataHuntItem[] {
  const attempted = unique(probes.map((probe) => probe.provider));
  const pass433Items = pass433?.missingDataHunt ?? [];
  const fields = unique([
    ...pass433Items.map((item) => item.field),
    probes.some((probe) => probe.hasPrice) ? null : "live price",
    probes.filter((probe) => probe.status === "ok" || probe.status === "partial").length >= 2 ? null : "second provider",
    probes.some((probe) => probe.hasVolume24h) ? null : "24h volume",
    probes.some((probe) => probe.hasMarketCap) ? null : "market cap",
    probes.some((probe) => probe.hasLiquidity) ? null : "liquidity",
    probes.some((probe) => probe.hasCandles) ? null : "candles",
    probes.some((probe) => probe.hasSecurity) ? null : "security flags",
    probes.some((probe) => probe.sourceFreshness === "fresh") ? null : "fresh timestamp",
  ]);
  return fields.map((field) => {
    const severity = severityFor(field);
    return {
      id: `pass434_${field.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "")}`,
      field,
      severity,
      status: "missing",
      attemptedProviders: attempted.length ? attempted : ["none"],
      nextProvider: nextProviderFor(field),
      pdfVisible: severity !== "low",
      chatVisible: true,
      reason: `PASS434 could not confirm ${field} across the current provider cross-check set.`,
    } satisfies Pass434MissingDataHuntItem;
  });
}

export function buildPass434ProviderCrosscheckMissingDataHunter(input: {
  result: TokenRiskResult;
  pass433?: Pass433RealInternetDataArbitration;
  providerAttempts?: Pass433ProviderProbe[];
}): Pass434ProviderCrosscheckMissingDataHunter {
  const probes = probesFromInput(input.result, input.pass433, input.providerAttempts);
  const laneScores = buildLaneScores(probes);
  const okProviderCount = probes.filter((probe) => probe.status === "ok").length;
  const partialProviderCount = probes.filter((probe) => probe.status === "partial").length;
  const errorProviderCount = probes.filter((probe) => probe.status === "error").length;
  const attemptedProviderCount = probes.filter((probe) => probe.status !== "not_attempted").length;
  const priceConfirmed = probes.some((probe) => probe.hasPrice);
  const candlesConfirmed = probes.some((probe) => probe.hasCandles);
  const securityConfirmed = probes.some((probe) => probe.hasSecurity);
  const secondProviderConfirmed = okProviderCount + partialProviderCount >= 2;
  const missingDataHunter = buildMissingHunter(probes, input.pass433);
  const hasConflict = input.pass433?.arbitrationMode === "cross_source_conflict" || typeof input.pass433?.priceDivergencePercent === "number" && input.pass433.priceDivergencePercent > 8;
  const avgLaneReliability = laneScores.length ? laneScores.reduce((sum, lane) => sum + lane.reliability, 0) / laneScores.length : 0;
  const criticalMissing = missingDataHunter.filter((item) => item.severity === "critical").length;
  const internetEvidenceScore = clamp(
    avgLaneReliability * 0.5 +
      okProviderCount * 12 +
      partialProviderCount * 6 +
      (secondProviderConfirmed ? 16 : 0) +
      (priceConfirmed ? 10 : 0) +
      (candlesConfirmed ? 5 : 0) +
      (securityConfirmed ? 5 : 0) -
      errorProviderCount * 7 -
      criticalMissing * 14 -
      Math.max(0, missingDataHunter.length - criticalMissing) * 4 -
      (hasConflict ? 22 : 0),
  );
  const truthTier: Pass434TruthTier = hasConflict
    ? "conflict"
    : internetEvidenceScore >= 78 && secondProviderConfirmed && priceConfirmed
      ? "confirmed"
      : internetEvidenceScore >= 52 && priceConfirmed
        ? "partial"
        : internetEvidenceScore >= 30 || missingDataHunter.length
          ? "insufficient"
          : "sealed";
  const answerGate: Pass434AnswerGate = truthTier === "confirmed"
    ? "release"
    : truthTier === "partial"
      ? "release_with_missing_data"
      : truthTier === "conflict"
        ? "operator_review"
        : "facts_only";
  const maximumPublicConfidence = truthTier === "confirmed" ? 86 : truthTier === "partial" ? 62 : truthTier === "conflict" ? 38 : 30;
  const reason = hasConflict
    ? "Provider cross-check detected a conflict; public narrative must be capped and flagged for review."
    : !secondProviderConfirmed
      ? "Second provider is not confirmed; PDF/chat must show missing data instead of claiming full live validation."
      : missingDataHunter.length
        ? "Provider cross-check is usable but missing fields remain visible."
        : "Provider cross-check is strong enough for customer-facing risk readout.";
  const publicReadout = truthTier === "confirmed"
    ? "Dane zostały potwierdzone przez więcej niż jeden kanał providerów."
    : truthTier === "partial"
      ? "Dane są częściowe: wynik może być pokazany, ale z widocznymi brakami."
      : truthTier === "conflict"
        ? "Źródła są sprzeczne: wynik wymaga ostrożności i przeglądu."
        : "Brakuje danych: Angel/PDF może pokazać tylko fakty i missing data.";
  return {
    version: "provider-crosscheck-missing-data-hunter",
    generatedAt: new Date().toISOString(),
    truthTier,
    answerGate,
    internetEvidenceScore,
    providerLaneScores: laneScores,
    missingDataHunter,
    providerCrosscheck: {
      attemptedProviderCount,
      okProviderCount,
      partialProviderCount,
      errorProviderCount,
      secondProviderConfirmed,
      priceConfirmed,
      candlesConfirmed,
      securityConfirmed,
      maximumPublicConfidence,
      reason,
    },
    pdfTruthContract: {
      onePayload: true,
      noFakeLive: true,
      mustShowMissingData: missingDataHunter.length > 0 || answerGate !== "release",
      maxNarrativeSentences: answerGate === "release" ? 6 : answerGate === "release_with_missing_data" ? 4 : 2,
      sectionOrder: ["brief", "sources", "secondProvider", "missing", "next", "signature"],
    },
    probeCommands: [
      "npm run probe:pass434-provider-crosscheck -- bitcoin ethereum solana",
      "npm run probe:pass434-provider-crosscheck -- NVDA AAPL EURUSD=X GC=F",
      "curl /api/market-integrity/probe?query=bitcoin",
    ],
    operatorReadout: `PASS434 ${truthTier}; gate ${answerGate}; score ${internetEvidenceScore}/100; providers ${okProviderCount + partialProviderCount}/${attemptedProviderCount}; missing ${missingDataHunter.length}.`,
    publicReadout,
  };
}

export type Pass434LensProviderCrosscheckContract = {
  version: "pass434-lens-provider-crosscheck-contract";
  generatedAt: string;
  locale: "pl" | "en" | "de";
  truthTier: Pass434TruthTier;
  providerCount: number;
  missingDataCount: number;
  canUseLiveLabel: boolean;
  customerLine: string;
  noSecondGenerator: true;
};

export function buildPass434LensProviderCrosscheckContract(input: {
  locale: "pl" | "en" | "de";
  sourceCount: number;
  missingDataCount: number;
  sourceConfidence: number;
}): Pass434LensProviderCrosscheckContract {
  const truthTier: Pass434TruthTier = input.sourceCount >= 2 && input.sourceConfidence >= 68 && input.missingDataCount <= 1
    ? "confirmed"
    : input.sourceCount >= 1 && input.sourceConfidence >= 42
      ? "partial"
      : input.missingDataCount > 0
        ? "insufficient"
        : "sealed";
  const canUseLiveLabel = truthTier === "confirmed";
  const customerLine = input.locale === "de"
    ? canUseLiveLabel ? "Provider-Abgleich aktiv." : "Datenlücken bleiben sichtbar."
    : input.locale === "en"
      ? canUseLiveLabel ? "Provider cross-check active." : "Missing data remains visible."
      : canUseLiveLabel ? "Porównanie providerów aktywne." : "Brakujące dane pozostają widoczne.";
  return {
    version: "pass434-lens-provider-crosscheck-contract",
    generatedAt: new Date().toISOString(),
    locale: input.locale,
    truthTier,
    providerCount: input.sourceCount,
    missingDataCount: input.missingDataCount,
    canUseLiveLabel,
    customerLine,
    noSecondGenerator: true,
  };
}
