import type { TokenRiskResult } from "./risk-types";
import type { Pass432LiveDataProbeRuntime } from "./live-data-probe-runtime";

export type Pass433ProviderFamily = "crypto_market" | "dex_liquidity" | "token_security" | "real_market" | "exchange_health" | "unknown";
export type Pass433ProviderStatus = "ok" | "partial" | "error" | "not_attempted";
export type Pass433ArbitrationMode =
  | "real_internet_confirmed"
  | "real_internet_partial"
  | "cross_source_conflict"
  | "missing_data_hunt"
  | "sealed_no_fake_live";

export type Pass433ProviderProbe = {
  id: string;
  provider: string;
  family: Pass433ProviderFamily;
  status: Pass433ProviderStatus;
  fieldCoverage: number;
  hasPrice: boolean;
  has24hChange: boolean;
  hasVolume24h: boolean;
  hasMarketCap: boolean;
  hasLiquidity: boolean;
  hasCandles: boolean;
  hasSecurity: boolean;
  sourceFreshness: "fresh" | "stale" | "missing";
  price?: number;
  change24h?: number;
  sample?: string;
  missing: string[];
  error?: string;
};

export type Pass433RealInternetDataArbitration = {
  version: "real-internet-data-arbitration";
  generatedAt: string;
  arbitrationMode: Pass433ArbitrationMode;
  providerCount: number;
  confirmedProviderCount: number;
  attemptedProviderCount: number;
  activeProviderFamilies: Pass433ProviderFamily[];
  providerProbes: Pass433ProviderProbe[];
  internetDataScore: number;
  priceDivergencePercent?: number;
  missingDataHunt: Array<{
    id: string;
    field: string;
    severity: "low" | "medium" | "high";
    attemptedProviders: string[];
    nextProvider: string;
    customerVisible: boolean;
    reason: string;
  }>;
  noFakeLiveEnvelope: {
    canSayLive: boolean;
    canShowPrice: boolean;
    canShowSecondProvider: boolean;
    mustShowMissingData: boolean;
    publicConfidenceCap: number;
    reason: string;
  };
  reportTruthLine: string;
  localProbeCommand: string;
  releaseChecklist: string[];
};

function clamp(value: number, min = 0, max = 100) {
  return Math.min(max, Math.max(min, Math.round(value)));
}

function isNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function freshness(generatedAt?: string) {
  const time = Date.parse(generatedAt ?? "");
  if (!Number.isFinite(time)) return "missing" as const;
  const ageMinutes = (Date.now() - time) / 60000;
  return ageMinutes <= 20 ? "fresh" as const : "stale" as const;
}

function familyFromSource(source: string): Pass433ProviderFamily {
  const clean = source.toLowerCase();
  if (clean.includes("coingecko") || clean.includes("coinmarket")) return "crypto_market";
  if (clean.includes("dex")) return "dex_liquidity";
  if (clean.includes("goplus") || clean.includes("security")) return "token_security";
  if (clean.includes("yahoo") || clean.includes("finance") || clean.includes("stock") || clean.includes("fx")) return "real_market";
  if (["binance", "mexc", "okx", "kraken", "coinbase", "bybit"].some((venue) => clean.includes(venue))) return "exchange_health";
  return "unknown";
}

function fieldCoverage(probe: Omit<Pass433ProviderProbe, "fieldCoverage" | "missing">) {
  const fields = [probe.hasPrice, probe.has24hChange, probe.hasVolume24h, probe.hasMarketCap, probe.hasLiquidity, probe.hasCandles, probe.hasSecurity];
  return clamp((fields.filter(Boolean).length / fields.length) * 100);
}

function missingFields(probe: Omit<Pass433ProviderProbe, "fieldCoverage" | "missing">) {
  return [
    probe.hasPrice ? null : "price",
    probe.has24hChange ? null : "24h change",
    probe.hasVolume24h ? null : "24h volume",
    probe.hasMarketCap ? null : "market cap",
    probe.hasLiquidity ? null : "liquidity",
    probe.hasCandles ? null : "candles",
    probe.hasSecurity ? null : "security flags",
  ].filter(Boolean) as string[];
}

export function buildPass433ProviderProbeFromRiskResult(input: {
  result: TokenRiskResult;
  provider?: string;
  family?: Pass433ProviderFamily;
  status?: Pass433ProviderStatus;
  error?: string;
}): Pass433ProviderProbe {
  const { result } = input;
  const source = input.provider ?? result.dataSources[0] ?? "resolved payload";
  const base = {
    id: source.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 60) || "provider",
    provider: source,
    family: input.family ?? familyFromSource(source),
    status: input.status ?? (result.dataQuality === "live" ? "ok" : result.dataQuality === "partial" ? "partial" : "not_attempted"),
    hasPrice: isNumber(result.metrics.currentPrice),
    has24hChange: isNumber(result.metrics.priceChange24h),
    hasVolume24h: isNumber(result.metrics.volume24h),
    hasMarketCap: isNumber(result.metrics.marketCap),
    hasLiquidity: isNumber(result.metrics.liquidityUsd),
    hasCandles: Boolean(result.chart?.sevenDay?.length),
    hasSecurity: Boolean(result.metrics.holderCount || result.metrics.top10HolderPercent || result.metrics.buyTaxPercentage || result.metrics.sellTaxPercentage),
    sourceFreshness: freshness(result.generatedAt),
    price: result.metrics.currentPrice,
    change24h: result.metrics.priceChange24h,
    sample: `${result.token.symbol.toUpperCase()} · score ${result.score}/100 · ${result.level}`,
    error: input.error,
  } satisfies Omit<Pass433ProviderProbe, "fieldCoverage" | "missing">;
  return { ...base, fieldCoverage: fieldCoverage(base), missing: missingFields(base) };
}

function priceDivergence(probes: Pass433ProviderProbe[]) {
  const prices = probes.map((probe) => probe.price).filter(isNumber);
  if (prices.length < 2) return undefined;
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  if (min <= 0) return undefined;
  return Math.round(((max - min) / min) * 10000) / 100;
}

function buildMissingHunt(probes: Pass433ProviderProbe[], pass432?: Pass432LiveDataProbeRuntime): Pass433RealInternetDataArbitration["missingDataHunt"] {
  const attempted = probes.map((probe) => probe.provider);
  const fields = [
    { id: "price", label: "live price", ok: probes.some((p) => p.hasPrice), next: "CoinGecko / Yahoo chart", severity: "high" as const },
    { id: "second_provider", label: "second provider", ok: probes.filter((p) => p.status === "ok" || p.status === "partial").length >= 2, next: "DEX Screener or Yahoo cross-check", severity: "high" as const },
    { id: "volume", label: "24h volume", ok: probes.some((p) => p.hasVolume24h), next: "CoinGecko markets / DEX Screener pair volume", severity: "medium" as const },
    { id: "liquidity", label: "liquidity", ok: probes.some((p) => p.hasLiquidity), next: "DEX Screener pair liquidity", severity: "medium" as const },
    { id: "security", label: "token security flags", ok: probes.some((p) => p.hasSecurity), next: "GoPlus token security when chain/address exists", severity: "medium" as const },
    { id: "candles", label: "candles/sparkline", ok: probes.some((p) => p.hasCandles), next: "CoinGecko sparkline or Binance/Yahoo candles", severity: "low" as const },
    { id: "freshness", label: "fresh timestamp", ok: probes.some((p) => p.sourceFreshness === "fresh") || pass432?.providerReality.generatedAtFreshness === "fresh", next: "re-run live probe route", severity: "medium" as const },
  ];
  return fields
    .filter((field) => !field.ok)
    .map((field) => ({
      id: `missing_${field.id}`,
      field: field.label,
      severity: field.severity,
      attemptedProviders: attempted.length ? attempted : ["none"],
      nextProvider: field.next,
      customerVisible: true,
      reason: `PASS433 tried the resolved provider set and still did not confirm ${field.label}.`,
    }));
}

export function buildPass433RealInternetDataArbitration(input: {
  result: TokenRiskResult;
  pass432?: Pass432LiveDataProbeRuntime;
  providerAttempts?: Pass433ProviderProbe[];
}): Pass433RealInternetDataArbitration {
  const baseProvider = buildPass433ProviderProbeFromRiskResult({ result: input.result });
  const providerProbes = (input.providerAttempts?.length ? input.providerAttempts : [baseProvider])
    .filter(Boolean)
    .map((probe, index) => ({ ...probe, id: probe.id || `provider_${index + 1}` }));
  const confirmed = providerProbes.filter((probe) => probe.status === "ok");
  const attempted = providerProbes.filter((probe) => probe.status !== "not_attempted");
  const families = Array.from(new Set(providerProbes.map((probe) => probe.family))).filter((family) => family !== "unknown");
  const divergence = priceDivergence(providerProbes);
  const missingDataHunt = buildMissingHunt(providerProbes, input.pass432);
  const hasConflict = isNumber(divergence) && divergence > 8;
  const hasPrice = providerProbes.some((probe) => probe.hasPrice);
  const hasSecond = attempted.length >= 2 && confirmed.length >= 1;
  const hasFresh = providerProbes.some((probe) => probe.sourceFreshness === "fresh");
  const avgCoverage = providerProbes.length
    ? providerProbes.reduce((sum, probe) => sum + probe.fieldCoverage, 0) / providerProbes.length
    : 0;
  const internetDataScore = clamp(
    avgCoverage * 0.42 +
      Math.min(25, confirmed.length * 11) +
      (hasSecond ? 13 : 0) +
      (hasPrice ? 10 : 0) +
      (hasFresh ? 8 : 0) -
      (hasConflict ? 20 : 0) -
      Math.min(18, missingDataHunt.length * 3),
  );
  const arbitrationMode: Pass433ArbitrationMode = hasConflict
    ? "cross_source_conflict"
    : confirmed.length >= 2 && hasPrice && hasFresh
      ? "real_internet_confirmed"
      : confirmed.length >= 1 && hasPrice
        ? "real_internet_partial"
        : missingDataHunt.length
          ? "missing_data_hunt"
          : "sealed_no_fake_live";
  const publicConfidenceCap = arbitrationMode === "real_internet_confirmed"
    ? 88
    : arbitrationMode === "real_internet_partial"
      ? 64
      : arbitrationMode === "cross_source_conflict"
        ? 42
        : 34;
  const noFakeLiveEnvelope = {
    canSayLive: arbitrationMode === "real_internet_confirmed" || arbitrationMode === "real_internet_partial",
    canShowPrice: hasPrice,
    canShowSecondProvider: confirmed.length >= 2,
    mustShowMissingData: missingDataHunt.length > 0 || arbitrationMode !== "real_internet_confirmed",
    publicConfidenceCap,
    reason: hasConflict
      ? `Provider price divergence ${divergence}% requires conflict review.`
      : missingDataHunt.length
        ? `Missing fields remain visible: ${missingDataHunt.map((item) => item.field).join(", ")}.`
        : "Provider payload is bounded enough for public risk readout.",
  };
  return {
    version: "real-internet-data-arbitration",
    generatedAt: new Date().toISOString(),
    arbitrationMode,
    providerCount: providerProbes.length,
    confirmedProviderCount: confirmed.length,
    attemptedProviderCount: attempted.length,
    activeProviderFamilies: families.length ? families : ["unknown"],
    providerProbes,
    internetDataScore,
    priceDivergencePercent: divergence,
    missingDataHunt,
    noFakeLiveEnvelope,
    reportTruthLine: `PASS433 ${arbitrationMode}; providers ${confirmed.length}/${providerProbes.length}; missing ${missingDataHunt.length}; confidence cap ${publicConfidenceCap}%.`,
    localProbeCommand: "npm run probe:pass433-real-internet-data -- bitcoin ethereum solana NVDA EURUSD=X MEXC",
    releaseChecklist: [
      "run PASS433 probe locally with internet before release",
      "show missing fields in PDF/chat instead of filling them",
      "cap confidence when only one provider resolves",
      "mark Yahoo-based real-market data as unofficial/advisory provider unless a paid source is configured",
      "do not claim live data when provider status is error or not_attempted",
    ],
  };
}

export type Pass433LensRealDataContract = {
  version: "pass433-lens-real-data-contract";
  generatedAt: string;
  locale: "pl" | "en" | "de";
  providerCount: number;
  missingDataCount: number;
  canUseLiveLabel: boolean;
  customerLine: string;
  mustShowMissingData: boolean;
  noSecondGenerator: true;
};

export function buildPass433LensRealDataContract(input: {
  locale: "pl" | "en" | "de";
  sourceCount: number;
  missingDataCount: number;
  sourceConfidence: number;
}): Pass433LensRealDataContract {
  const canUseLiveLabel = input.sourceCount >= 2 && input.sourceConfidence >= 65 && input.missingDataCount <= 1;
  const customerLine = input.locale === "de"
    ? canUseLiveLabel ? "Daten mit Provider-Abgleich." : "Datenlücken bleiben sichtbar."
    : input.locale === "en"
      ? canUseLiveLabel ? "Data with provider cross-check." : "Missing data remains visible."
      : canUseLiveLabel ? "Dane z porównaniem providerów." : "Brakujące dane pozostają widoczne.";
  return {
    version: "pass433-lens-real-data-contract",
    generatedAt: new Date().toISOString(),
    locale: input.locale,
    providerCount: input.sourceCount,
    missingDataCount: input.missingDataCount,
    canUseLiveLabel,
    customerLine,
    mustShowMissingData: input.missingDataCount > 0 || !canUseLiveLabel,
    noSecondGenerator: true,
  };
}
