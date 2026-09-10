import { sha256Token } from "../security/cryptographic-digest";
import type { TokenRiskResult, VelmereMarketAssetClass } from "./risk-types";
import { buildRiskIndicatorCustomerTruth } from "./risk-indicator-customer-truth";
import { isPass4644CommerciallyFreshReceipt, summarizePass4644ProviderReceipts } from "./provider-evidence-receipt";
import { buildPass4646EvidenceProfile } from "./universal-asset-identity";
import { buildPass4650ProviderQualitySnapshot, buildPass4650ReplayManifest, verifyPass4650ReplayManifest } from "./provider-quality-replay";
import { evaluatePass4655TierValueProof } from "./tier-value-proof";

export type AnalysisDepth = "basic" | "pro" | "advanced";
export type AnalysisDataStatus = "insufficient_data" | "limited" | "verified";
export type AnalysisEvidenceCategory =
  | "identity"
  | "market"
  | "liquidity"
  | "holders_ownership"
  | "contract_permissions"
  | "supply_tokenomics"
  | "fundamentals_filings"
  | "macro_rates"
  | "derivatives_microstructure"
  | "history_volatility"
  | "scenario_dependency";

export type AnalysisTierReadiness = {
  sellReady: boolean;
  minimumSources: number;
  minimumSourceFamilies: number;
  minimumConfidence: number;
  minimumMetrics: number;
  minimumEvidenceCategories: number;
  minimumEvidenceObservations: number;
  requiredCategories: AnalysisEvidenceCategory[];
  missingCategories: AnalysisEvidenceCategory[];
  valueDeltaProven: boolean;
  evidenceItemCount: number;
  uniqueEvidenceDelta: number;
  minimumUniqueEvidenceDelta: number;
  corroboratedCategoryCount: number;
  durableReceiptRequired: boolean;
  durableReceiptReady: boolean;
  commercialValueProof: ReturnType<typeof evaluatePass4655TierValueProof>;
  reason: string;
};

export type AnalysisReadiness = {
  schemaVersion: "pass4650_analysis_readiness_v5";
  status: AnalysisDataStatus;
  riskScore: number | null;
  confidencePercent: number;
  sourceCount: number;
  displaySourceCount: number;
  verifiedReceiptCount: number;
  receiptProofRequired: boolean;
  receiptProof: ReturnType<typeof summarizePass4644ProviderReceipts>;
  providerQuality: ReturnType<typeof buildPass4650ProviderQualitySnapshot>;
  replayProof: ReturnType<typeof verifyPass4650ReplayManifest> | null;
  sourceFamilies: string[];
  sourceFamilyCount: number;
  metricCount: number;
  signalCount: number;
  evidenceObservationCount: number;
  evidenceCategories: AnalysisEvidenceCategory[];
  evidenceCategoryCount: number;
  evidenceFingerprint: string;
  evidenceCount: number;
  evidenceItemCount: number;
  corroboratedCategoryCount: number;
  durableReceiptReady: boolean;
  durableReceiptLedgerId: string | null;
  durableReceiptHeadHash: string | null;
  assetEvidenceProfile: ReturnType<typeof buildPass4646EvidenceProfile>;
  missingProof: string[];
  customerMessage: string;
  tiers: Record<AnalysisDepth, AnalysisTierReadiness>;
};

const TIER_REQUIREMENTS: Record<AnalysisDepth, {
  sources: number;
  sourceFamilies: number;
  confidence: number;
  metrics: number;
  categories: number;
  observations: number;
  uniqueDelta: number;
  corroboratedCategories: number;
}> = {
  // Basic remains a useful prescreen, but it cannot publish a numerical verdict
  // from one uncorroborated lane.
  basic: { sources: 2, sourceFamilies: 1, confidence: 20, metrics: 3, categories: 2, observations: 3, uniqueDelta: 0, corroboratedCategories: 0 },
  // Pro must add genuinely broader evidence, not just a longer narrative.
  pro: { sources: 6, sourceFamilies: 2, confidence: 70, metrics: 7, categories: 4, observations: 7, uniqueDelta: 4, corroboratedCategories: 1 },
  // Advanced is an institutional/deep-proof tier. It needs independent
  // provider families and multiple evidence categories before it can be sold.
  advanced: { sources: 10, sourceFamilies: 3, confidence: 85, metrics: 10, categories: 6, observations: 12, uniqueDelta: 5, corroboratedCategories: 2 },
};

function finite(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function uniqueStrings(values: unknown): string[] {
  if (!Array.isArray(values)) return [];
  return Array.from(new Set(values.map((item) => String(item ?? "").trim()).filter(Boolean)));
}

function normalizeConfidence(value: unknown): number {
  if (!finite(value)) return 0;
  const normalized = value <= 1 ? value * 100 : value;
  return Math.max(0, Math.min(100, Math.round(normalized)));
}

function observedMetricEntries(result: TokenRiskResult) {
  const metrics = result.metrics ?? {};
  return Object.entries(metrics).filter(([, value]) => finite(value));
}

function hasAnyMetric(result: TokenRiskResult, keys: Array<keyof TokenRiskResult["metrics"]>) {
  return keys.some((key) => finite(result.metrics?.[key]));
}

function signalIds(result: TokenRiskResult) {
  return new Set((result.signals ?? []).map((signal) => signal.id));
}


function categoryForCapability(capability: string): AnalysisEvidenceCategory | null {
  const value = capability.toLowerCase();
  if (/identity|symbol|address|chain_context|protocol_identity/.test(value)) return "identity";
  if (/price|quote|market_cap|volume|ohlc/.test(value)) return "market";
  if (/liquidity|tvl|pool|slippage|depth|spread/.test(value)) return "liquidity";
  if (/holder|ownership|treasury|whale/.test(value)) return "holders_ownership";
  if (/permission|honeypot|tax|mint|blacklist|proxy|upgrade|abi|source_code/.test(value)) return "contract_permissions";
  if (/supply|unlock|emission|fdv|tokenomic/.test(value)) return "supply_tokenomics";
  if (/filing|fundamental|earnings|balance_sheet|cash_flow/.test(value)) return "fundamentals_filings";
  if (/macro|rate|yield|inflation|employment|central_bank/.test(value)) return "macro_rates";
  if (/orderbook|derivative|funding|open_interest|imbalance|microstructure/.test(value)) return "derivatives_microstructure";
  if (/history|volatility|drawdown|ath|time_series/.test(value)) return "history_volatility";
  if (/scenario|dependency|stress|correlation|contagion|simulation/.test(value)) return "scenario_dependency";
  return null;
}

function categoryForMetric(key: string): AnalysisEvidenceCategory | null {
  if (["currentPrice", "marketCap", "volume24h", "priceChange24h"].includes(key)) return "market";
  if (["liquidityUsd", "liquidityToMarketCapPercent", "simulatedSlippage10k"].includes(key)) return "liquidity";
  if (["top10HolderPercent", "holderCount"].includes(key)) return "holders_ownership";
  if (["buyTaxPercentage", "sellTaxPercentage"].includes(key)) return "contract_permissions";
  if (["circulatingSupply", "totalSupply", "maxSupply", "fdv", "fdvToMarketCapRatio"].includes(key)) return "supply_tokenomics";
  if (["priceChange1h", "priceChange6h", "priceChange7d", "priceChange14d", "priceChange30d", "drawdownPercent", "athPrice"].includes(key)) return "history_volatility";
  if (["bidAskImbalancePercent", "buySellImbalancePercent", "volumeToLiquidityRatio"].includes(key)) return "derivatives_microstructure";
  return null;
}

function categoryForSignal(id: string): AnalysisEvidenceCategory | null {
  if (/liquidity|slippage/.test(id)) return "liquidity";
  if (/holder/.test(id)) return "holders_ownership";
  if (/contract|mint|blacklist|honeypot|tax/.test(id)) return "contract_permissions";
  if (/supply|fdv/.test(id)) return "supply_tokenomics";
  if (/drawdown|drop|gain|ath|intraday|pump/.test(id)) return "history_volatility";
  if (/orderbook|imbalance|volume_spike|wash_trading/.test(id)) return "derivatives_microstructure";
  return null;
}

type AnalysisEvidenceItem = { id: string; category: AnalysisEvidenceCategory; providerFamily?: string };

function buildEvidenceItems(result: TokenRiskResult, now: Date): AnalysisEvidenceItem[] {
  const items = new Map<string, AnalysisEvidenceItem>();
  const token = result.token;
  if (token.symbol && token.name && (token.marketId || token.tokenAddress || token.url || token.chainId)) {
    items.set(`identity:${token.marketId ?? token.tokenAddress ?? token.symbol}`, { id: `identity:${token.marketId ?? token.tokenAddress ?? token.symbol}`, category: "identity" });
  }
  for (const receipt of result.providerEvidenceReceipts ?? []) {
    if (!isPass4644CommerciallyFreshReceipt(receipt, now)) continue;
    for (const capability of receipt.capabilities) {
      const category = categoryForCapability(capability);
      if (!category) continue;
      const id = `receipt:${receipt.providerFamily}:${category}:${capability}:${receipt.payloadHash}`;
      items.set(id, { id, category, providerFamily: receipt.providerFamily });
    }
  }
  for (const [key] of observedMetricEntries(result)) {
    const category = categoryForMetric(key);
    if (category) items.set(`metric:${category}:${key}`, { id: `metric:${category}:${key}`, category });
  }
  for (const signal of result.signals ?? []) {
    const category = categoryForSignal(signal.id);
    if (category) items.set(`signal:${category}:${signal.id}`, { id: `signal:${category}:${signal.id}`, category });
  }
  return Array.from(items.values());
}

function tierCategorySet(assetClass: VelmereMarketAssetClass | undefined, depth: AnalysisDepth) {
  const depths: AnalysisDepth[] = depth === "basic" ? ["basic"] : depth === "pro" ? ["basic", "pro"] : ["basic", "pro", "advanced"];
  return new Set(depths.flatMap((item) => requiredCategories(assetClass, item)));
}

function evidenceCategories(result: TokenRiskResult, now: Date): AnalysisEvidenceCategory[] {
  const categories = new Set<AnalysisEvidenceCategory>();
  const signals = signalIds(result);
  const token = result.token ?? { symbol: "", name: "" };

  if (token.symbol && token.name && (token.marketId || token.tokenAddress || token.url || token.chainId)) categories.add("identity");
  if (hasAnyMetric(result, ["currentPrice", "marketCap", "volume24h", "priceChange24h"])) categories.add("market");
  if (hasAnyMetric(result, ["liquidityUsd", "simulatedSlippage10k", "bidAskImbalancePercent"]) ||
      signals.has("thin_liquidity") || signals.has("very_thin_liquidity") || signals.has("orderbook_depth_collapse")) categories.add("liquidity");
  if (hasAnyMetric(result, ["top10HolderPercent", "holderCount"]) || signals.has("holder_concentration")) categories.add("holders_ownership");
  if (token.tokenAddress && (signals.has("contract_privileges") || signals.has("mint_risk") || signals.has("blacklist_risk") || signals.has("honeypot_risk") || signals.has("high_sell_tax"))) categories.add("contract_permissions");
  if (hasAnyMetric(result, ["circulatingSupply", "totalSupply", "maxSupply", "fdv", "fdvToMarketCapRatio"]) || signals.has("supply_overhang") || signals.has("fdv_marketcap_gap")) categories.add("supply_tokenomics");
  if (hasAnyMetric(result, ["priceChange7d", "priceChange14d", "priceChange30d", "drawdownPercent", "athPrice"]) ||
      signals.has("major_drawdown") || signals.has("extreme_drawdown")) categories.add("history_volatility");
  if (hasAnyMetric(result, ["bidAskImbalancePercent", "simulatedSlippage10k", "buySellImbalancePercent"]) ||
      signals.has("orderbook_imbalance") || signals.has("sell_pressure_imbalance") || signals.has("volume_spike")) categories.add("derivatives_microstructure");

  for (const receipt of result.providerEvidenceReceipts ?? []) {
    if (!isPass4644CommerciallyFreshReceipt(receipt, now)) continue;
    for (const capability of receipt.capabilities) {
      const category = categoryForCapability(capability);
      if (category) categories.add(category);
    }
  }

  const assetClass = result.token.assetClass ?? "unknown";
  const sourceText = (result.dataSources ?? []).join(" ").toLowerCase();
  if (["stock", "etf", "index", "real_estate", "exchange_equity"].includes(assetClass) && /filing|sec|edgar|fundamental|earnings|balance sheet|cash flow/.test(sourceText)) categories.add("fundamentals_filings");
  if (assetClass !== "crypto" && assetClass !== "unknown" && /macro|rate|yield|central bank|ecb|fred|inflation|employment|eia|cftc/.test(sourceText)) categories.add("macro_rates");
  if ((result.limitations ?? []).some((item) => /scenario|dependency|stress|correlation|contagion/i.test(item)) === false &&
      (result.metaModel?.requiredReview === false || (result.agentAssessments?.length ?? 0) >= 4)) categories.add("scenario_dependency");

  return Array.from(categories);
}

function requiredCategories(assetClass: VelmereMarketAssetClass | undefined, depth: AnalysisDepth): AnalysisEvidenceCategory[] {
  if (depth === "basic") return ["identity", "market"];
  if (!assetClass || assetClass === "crypto" || assetClass === "unknown") {
    return depth === "pro"
      ? ["identity", "market", "liquidity", "holders_ownership"]
      : ["identity", "market", "liquidity", "holders_ownership", "contract_permissions", "scenario_dependency"];
  }
  // PASS4644: do not force equity filings onto FX, indices or commodities.
  // Each Real Markets class now has evidence lanes that match the product.
  if (["fx", "commodity", "index"].includes(assetClass)) {
    return depth === "pro"
      ? ["identity", "market", "history_volatility", "macro_rates"]
      : ["identity", "market", "history_volatility", "macro_rates", "derivatives_microstructure", "scenario_dependency"];
  }
  return depth === "pro"
    ? ["identity", "market", "history_volatility", "fundamentals_filings"]
    : ["identity", "market", "history_volatility", "fundamentals_filings", "macro_rates", "scenario_dependency"];
}

function stableFingerprint(input: unknown) {
  return `p4643_${sha256Token(JSON.stringify(input), 16)}`;
}

function localeMessage(locale: string, status: AnalysisDataStatus) {
  if (locale === "de") {
    if (status === "verified") return "Die Datenabdeckung reicht für eine quellengebundene Bewertung aus.";
    if (status === "limited") return "Die Bewertung ist begrenzt: Eine stärkere Aussage benötigt zusätzliche unabhängige Quellen.";
    return "Unzureichende bestätigte Daten. Es wird kein numerisches Risikourteil veröffentlicht.";
  }
  if (locale === "en") {
    if (status === "verified") return "Data coverage is sufficient for a source-bound assessment.";
    if (status === "limited") return "The assessment is limited: a stronger conclusion needs additional independent sources.";
    return "Confirmed data is insufficient. No numerical risk verdict is published.";
  }
  if (status === "verified") return "Pokrycie danych wystarcza do oceny związanej ze źródłami.";
  if (status === "limited") return "Ocena jest ograniczona: mocniejszy wniosek wymaga dodatkowych niezależnych źródeł.";
  return "Brak wystarczających potwierdzonych danych. Liczbowy werdykt ryzyka nie jest publikowany.";
}

export function buildAnalysisReadiness(result: TokenRiskResult, locale = "en"): AnalysisReadiness {
  const evaluationNow = new Date();
  const displaySources = uniqueStrings(result.dataSources);
  const receiptProof = summarizePass4644ProviderReceipts(result.providerEvidenceReceipts, evaluationNow);
  const requestedIdentity = result.providerEvidenceReceipts?.[0]?.identity.requested ?? result.token.tokenAddress ?? result.token.marketId ?? result.token.symbol;
  const providerQuality = buildPass4650ProviderQualitySnapshot({
    receipts: result.providerEvidenceReceipts,
    requestedIdentity,
    assetClass: result.token.assetClass ?? "unknown",
    now: evaluationNow,
  });
  const replayManifest = buildPass4650ReplayManifest({ quality: providerQuality, ledger: result.providerEvidenceLedger ?? null });
  const replayProof = result.providerEvidenceLedger
    ? verifyPass4650ReplayManifest({
        manifest: replayManifest,
        quality: providerQuality,
        ledger: result.providerEvidenceLedger,
        signingSecret: process.env.VELMERE_PROVIDER_RECEIPT_SIGNING_SECRET?.trim() || null,
      })
    : null;
  // PASS4650: labels and even formally eligible receipts are not enough. Re-evaluate
  // freshness at replay time and deduplicate mirrored/copy-identical provider payloads.
  const sources = providerQuality.independentProviders;
  const sourceFamilies = providerQuality.independentProviderFamilies;
  const limitations = uniqueStrings(result.limitations ?? result.metaModel?.limitations ?? []);
  const confidencePercent = normalizeConfidence(result.confidence);
  const metricEntries = observedMetricEntries(result);
  const metricCount = metricEntries.length;
  const signalCount = Array.isArray(result.signals) ? result.signals.length : 0;
  const categories = evidenceCategories(result, evaluationNow);
  const evidenceItems = buildEvidenceItems(result, evaluationNow);
  const evidenceObservationCount = evidenceItems.length;
  const corroboratedCategoryCount = providerQuality.corroboratedCategories.length;
  const assetEvidenceProfile = buildPass4646EvidenceProfile(result.token.assetClass ?? "unknown");
  const durableReceiptReady = result.providerEvidencePersistence?.durable === true &&
    result.providerEvidencePersistence.readBackVerified === true &&
    Boolean(result.providerEvidenceLedger?.headHash) &&
    result.providerEvidenceLedger?.signed === true &&
    result.providerEvidenceLedger?.depth !== "basic" &&
    result.providerEvidencePersistence.headHash === result.providerEvidenceLedger?.headHash &&
    replayProof?.valid === true;

  const status: AnalysisDataStatus =
    sources.length < TIER_REQUIREMENTS.basic.sources || metricCount < TIER_REQUIREMENTS.basic.metrics
      ? "insufficient_data"
      : sourceFamilies.length >= 2 && confidencePercent >= 60 && categories.length >= 3
        ? "verified"
        : "limited";

  const tiers = Object.fromEntries(
    (Object.keys(TIER_REQUIREMENTS) as AnalysisDepth[]).map((depth) => {
      const requirement = TIER_REQUIREMENTS[depth];
      const required = requiredCategories(result.token.assetClass, depth);
      const missingCategories = required.filter((category) => !categories.includes(category));
      const thresholdReady =
        sources.length >= requirement.sources &&
        sourceFamilies.length >= requirement.sourceFamilies &&
        confidencePercent >= requirement.confidence &&
        metricCount >= requirement.metrics &&
        categories.length >= requirement.categories &&
        evidenceObservationCount >= requirement.observations &&
        missingCategories.length === 0;
      const currentCategorySet = tierCategorySet(result.token.assetClass, depth);
      const currentEvidenceItems = evidenceItems.filter((item) => currentCategorySet.has(item.category));
      const lowerDepth: AnalysisDepth | null = depth === "advanced" ? "pro" : depth === "pro" ? "basic" : null;
      const lowerEvidenceItems = lowerDepth
        ? evidenceItems.filter((item) => tierCategorySet(result.token.assetClass, lowerDepth).has(item.category))
        : [];
      const uniqueEvidenceDelta = Math.max(0, currentEvidenceItems.length - lowerEvidenceItems.length);
      const valueDeltaProven = depth === "basic" || uniqueEvidenceDelta >= requirement.uniqueDelta;
      const durableReceiptRequired = depth !== "basic";
      const providerQualityReady = providerQuality.commerciallyUsable &&
        (depth !== "advanced" || providerQuality.tierResilience.advanced.survivesAnySingleFamilyOutage);
      const currentCategories = categories.filter((category) => currentCategorySet.has(category));
      const lowerCategorySet = lowerDepth ? tierCategorySet(result.token.assetClass, lowerDepth) : new Set<AnalysisEvidenceCategory>();
      const lowerCategories = lowerDepth ? categories.filter((category) => lowerCategorySet.has(category)) : [];
      const lowerRequired = lowerDepth ? requiredCategories(result.token.assetClass, lowerDepth) : [];
      const exclusiveRequiredCategories = required.filter((category) => !lowerRequired.includes(category));
      const commercialValueProof = evaluatePass4655TierValueProof({
        current: {
          tier: depth,
          categories: currentCategories,
          providerFamilies: sourceFamilies,
          verifiedReceiptCount: receiptProof.confirmedCommercialReceiptCount,
          durableReadBack: durableReceiptReady,
          outageFamilySurvived: depth === "advanced"
            ? providerQuality.tierResilience.advanced.survivesAnySingleFamilyOutage
            : undefined,
        },
        lowerTier: lowerDepth ? {
          tier: lowerDepth,
          categories: lowerCategories,
          providerFamilies: sourceFamilies,
          verifiedReceiptCount: receiptProof.confirmedCommercialReceiptCount,
          durableReadBack: durableReceiptReady,
        } : null,
        requiredExclusiveCategories: exclusiveRequiredCategories.length ? exclusiveRequiredCategories : required,
        minimumUniqueDelta: depth === "basic" ? required.length : exclusiveRequiredCategories.length,
      });
      const sellReady = thresholdReady && providerQualityReady && valueDeltaProven && commercialValueProof.sellReady && corroboratedCategoryCount >= requirement.corroboratedCategories && (!durableReceiptRequired || durableReceiptReady);
      const reason = sellReady
        ? "tier_value_and_verified_receipt_thresholds_met"
        : [
            sources.length < requirement.sources ? `verified_receipts:${sources.length}/${requirement.sources}` : null,
            sourceFamilies.length < requirement.sourceFamilies ? `receipt_families:${sourceFamilies.length}/${requirement.sourceFamilies}` : null,
            confidencePercent < requirement.confidence ? `confidence:${confidencePercent}/${requirement.confidence}` : null,
            metricCount < requirement.metrics ? `metrics:${metricCount}/${requirement.metrics}` : null,
            categories.length < requirement.categories ? `evidence_categories:${categories.length}/${requirement.categories}` : null,
            evidenceObservationCount < requirement.observations ? `evidence_observations:${evidenceObservationCount}/${requirement.observations}` : null,
            corroboratedCategoryCount < requirement.corroboratedCategories ? `corroborated_categories:${corroboratedCategoryCount}/${requirement.corroboratedCategories}` : null,
            !providerQuality.commerciallyUsable ? `provider_quality:${providerQuality.blockers.join("|") || providerQuality.qualityScore}` : null,
            depth === "advanced" && !providerQuality.tierResilience.advanced.survivesAnySingleFamilyOutage
              ? `single_family_outage_not_resilient:${providerQuality.tierResilience.advanced.failingFamilies.join("|")}`
              : null,
            durableReceiptRequired && !durableReceiptReady ? "durable_provider_receipt_not_ready" : null,
            missingCategories.length ? `missing_categories:${missingCategories.join("|")}` : null,
            !valueDeltaProven ? "tier_value_delta_not_proven" : null,
            !commercialValueProof.sellReady ? `commercial_value_proof:${commercialValueProof.blockers.join("|")}` : null,
          ].filter(Boolean).join(",");
      return [depth, {
        sellReady,
        minimumSources: requirement.sources,
        minimumSourceFamilies: requirement.sourceFamilies,
        minimumConfidence: requirement.confidence,
        minimumMetrics: requirement.metrics,
        minimumEvidenceCategories: requirement.categories,
        minimumEvidenceObservations: requirement.observations,
        requiredCategories: required,
        missingCategories,
        valueDeltaProven,
        evidenceItemCount: currentEvidenceItems.length,
        uniqueEvidenceDelta,
        minimumUniqueEvidenceDelta: requirement.uniqueDelta,
        corroboratedCategoryCount,
        durableReceiptRequired,
        durableReceiptReady,
        commercialValueProof,
        reason,
      }];
    }),
  ) as AnalysisReadiness["tiers"];

  return {
    schemaVersion: "pass4650_analysis_readiness_v5",
    status,
    riskScore: status === "insufficient_data" ? null : result.score,
    confidencePercent,
    sourceCount: sources.length,
    displaySourceCount: displaySources.length,
    verifiedReceiptCount: receiptProof.confirmedCommercialReceiptCount,
    receiptProofRequired: true,
    receiptProof,
    providerQuality,
    replayProof,
    sourceFamilies,
    sourceFamilyCount: sourceFamilies.length,
    metricCount,
    signalCount,
    evidenceObservationCount,
    evidenceCategories: categories,
    evidenceCategoryCount: categories.length,
    evidenceFingerprint: stableFingerprint({
      symbol: result.token.symbol,
      assetClass: result.token.assetClass,
      receipts: (result.providerEvidenceReceipts ?? []).filter((receipt) => isPass4644CommerciallyFreshReceipt(receipt, evaluationNow)).map((receipt) => ({ id: receipt.receiptId, hash: receipt.payloadHash })).sort((a, b) => a.id.localeCompare(b.id)),
      metrics: metricEntries.map(([key]) => key).sort(),
      signals: (result.signals ?? []).map((signal) => signal.id).sort(),
      categories: categories.slice().sort(),
    }),
    evidenceCount: evidenceObservationCount,
    evidenceItemCount: evidenceItems.length,
    corroboratedCategoryCount,
    durableReceiptReady,
    durableReceiptLedgerId: result.providerEvidenceLedger?.ledgerId ?? null,
    durableReceiptHeadHash: result.providerEvidenceLedger?.headHash ?? null,
    assetEvidenceProfile,
    missingProof: Array.from(new Set([
      ...limitations,
      !durableReceiptReady && receiptProof.confirmedCommercialReceiptCount > 0
        ? "Provider receipts were captured but not durably persisted and read back."
        : null,
      receiptProof.confirmedCommercialReceiptCount === 0 && displaySources.length > 0
        ? "Provider labels are present, but no fresh identity-bound commercial receipts were attached."
        : null,
      providerQuality.mirroredPayloadHashes.length > 0
        ? "Copy-identical payloads from different provider families were not counted as independent evidence."
        : null,
      providerQuality.futureTimestampReceiptIds.length > 0
        ? "Provider receipts with future timestamps were rejected during replay."
        : null,
      result.providerEvidenceLedger && replayProof?.valid !== true
        ? "The durable provider ledger could not be reproduced from the current receipt set."
        : null,
    ].filter((value): value is string => Boolean(value)))).slice(0, 12),
    customerMessage: localeMessage(locale, status),
    tiers,
  };
}

export function premiumDepthNotReady(readiness: AnalysisReadiness, depth: AnalysisDepth) {
  return depth !== "basic" && !readiness.tiers[depth].sellReady;
}

export function buildInsufficientDataRiskResult(
  query: string,
  assetClass: VelmereMarketAssetClass = "crypto",
  reason = "No confirmed provider returned enough data for an evidence-bound assessment.",
): TokenRiskResult {
  const cleanQuery = query.trim() || "UNKNOWN";
  const symbol = cleanQuery.toUpperCase().replace(/[^A-Z0-9.^=-]/g, "").slice(0, 18) || "UNKNOWN";
  const input = {
    marketId: `insufficient:${assetClass}:${symbol}`,
    symbol,
    name: cleanQuery,
    assetClass,
    dataSources: [] as string[],
  };
  const result: Omit<TokenRiskResult, "customerTruth"> = {
    token: {
      marketId: input.marketId,
      symbol,
      name: cleanQuery,
      assetClass,
    },
    score: 0,
    confidence: 0,
    level: "low",
    badge: "low_detected_risk",
    signals: [],
    metrics: {},
    dataQuality: "partial",
    dataSources: [],
    limitations: [reason],
    generatedAt: new Date().toISOString(),
    metaModel: {
      version: "pass4643.insufficient-data.v2",
      verdict: "insufficient_data",
      dataFusionScore: 0,
      conflictLevel: "none",
      requiredReview: true,
      summary: "No numerical risk verdict is available because confirmed data coverage is insufficient.",
      escalation: "Retry providers or add independent evidence before publishing or selling a stronger tier.",
      limitations: [reason],
    },
  };
  return {
    ...result,
    customerTruth: buildRiskIndicatorCustomerTruth({ input, result, reportContextDepth: null }),
  };
}
