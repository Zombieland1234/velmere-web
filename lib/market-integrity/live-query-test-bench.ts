import type { TokenRiskResult } from "./risk-types";
import type { Pass433ProviderProbe, Pass433RealInternetDataArbitration } from "./real-internet-data-arbitration";
import type { Pass434ProviderCrosscheckMissingDataHunter } from "./provider-crosscheck-missing-data-hunter";

export type Pass435ProbeExpectation = "price" | "change24h" | "volume24h" | "marketCap" | "liquidity" | "candles" | "security" | "freshness" | "secondProvider";
export type Pass435ProviderVerdict = "green" | "amber" | "red" | "sealed";
export type Pass435ReleaseMode = "release_live_readout" | "release_partial_with_missing" | "facts_only_no_live_claim" | "block_pdf_until_probe";

export type Pass435ProviderRealityRow = {
  provider: string;
  family: string;
  status: "ok" | "partial" | "error" | "not_attempted";
  verdict: Pass435ProviderVerdict;
  observedFields: Pass435ProbeExpectation[];
  missingFields: Pass435ProbeExpectation[];
  coverage: number;
  sampleLine: string;
  repairHint: string;
};

export type Pass435LiveQueryTestBench = {
  version: "live-query-test-bench";
  generatedAt: string;
  releaseMode: Pass435ReleaseMode;
  liveReadinessScore: number;
  fakeLiveRisk: number;
  providerRealityRows: Pass435ProviderRealityRow[];
  queryAssertions: Array<{
    id: string;
    passed: boolean;
    severity: "info" | "warning" | "critical";
    statement: string;
    evidence: string;
  }>;
  missingDataReplay: Array<{
    field: string;
    attemptedProviders: string[];
    nextProvider: string;
    mustSurfaceInPdf: boolean;
    mustSurfaceInChat: boolean;
  }>;
  pdfChatContract: {
    onePayload: true;
    oneLocale: true;
    noSecondCopyGenerator: true;
    noFakeLive: true;
    allowedSections: ["brief", "sources", "secondProvider", "missing", "next", "signature"];
    maxMissingItemsInCustomerPdf: number;
    maxSentencesPerSection: number;
  };
  localTestCommands: string[];
  operatorReadout: string;
  publicReadout: string;
};

export type Pass435LensLiveQueryContract = {
  version: "pass435-lens-live-query-contract";
  locale: "pl" | "de" | "en";
  releaseMode: Pass435ReleaseMode;
  onePayload: true;
  noFakeLive: true;
  maxSuggestions: 3;
  customerCopy: "clean_pdf_preview_only";
  missingDataMustBeVisible: boolean;
  maxPublicConfidence: number;
  testBenchLine: string;
};

function clamp(value: number, min = 0, max = 100) {
  return Math.min(max, Math.max(min, Math.round(value)));
}

function unique<T>(values: T[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function observedFields(probe: Pass433ProviderProbe): Pass435ProbeExpectation[] {
  return [
    probe.hasPrice ? "price" : undefined,
    probe.has24hChange ? "change24h" : undefined,
    probe.hasVolume24h ? "volume24h" : undefined,
    probe.hasMarketCap ? "marketCap" : undefined,
    probe.hasLiquidity ? "liquidity" : undefined,
    probe.hasCandles ? "candles" : undefined,
    probe.hasSecurity ? "security" : undefined,
    probe.sourceFreshness === "fresh" ? "freshness" : undefined,
  ].filter(Boolean) as Pass435ProbeExpectation[];
}

function requiredFieldsForFamily(family: string): Pass435ProbeExpectation[] {
  if (family === "real_market") return ["price", "change24h", "volume24h", "candles", "freshness"];
  if (family === "dex_liquidity") return ["price", "change24h", "volume24h", "liquidity", "security"];
  if (family === "token_security") return ["security", "freshness"];
  if (family === "exchange_health") return ["freshness", "secondProvider"];
  return ["price", "change24h", "volume24h", "marketCap", "candles", "freshness"];
}

function sampleLine(probe: Pass433ProviderProbe) {
  const price = typeof probe.price === "number" && Number.isFinite(probe.price) ? `price ${probe.price}` : "price missing";
  const change = typeof probe.change24h === "number" && Number.isFinite(probe.change24h) ? `24h ${probe.change24h.toFixed(2)}%` : "24h missing";
  return `${probe.provider}: ${probe.status}; ${price}; ${change}; freshness ${probe.sourceFreshness}.`;
}

function repairHint(missing: Pass435ProbeExpectation[]) {
  if (missing.includes("price")) return "Run CoinGecko/Yahoo/DEX price fallback before allowing live wording.";
  if (missing.includes("secondProvider")) return "Confirm a second provider before raising confidence above partial mode.";
  if (missing.includes("liquidity")) return "Run DEX Screener pair liquidity lane when token address or pair exists.";
  if (missing.includes("security")) return "Run GoPlus token security when chain and address are available.";
  if (missing.includes("candles")) return "Run Binance/MEXC klines, CoinGecko sparkline or Yahoo chart before chart-based text.";
  if (missing.includes("freshness")) return "Re-run probe and attach generatedAt/fresh timestamp.";
  return "Keep monitoring; no critical repair hint.";
}

function verdictFor(probe: Pass433ProviderProbe, missing: Pass435ProbeExpectation[]): Pass435ProviderVerdict {
  if (probe.status === "error" || probe.status === "not_attempted") return "sealed";
  if (missing.includes("price")) return "red";
  if (missing.includes("freshness") || missing.includes("secondProvider") || missing.length >= 3) return "amber";
  return "green";
}

function providerRows(probes: Pass433ProviderProbe[], secondProviderConfirmed: boolean): Pass435ProviderRealityRow[] {
  return probes.map((probe) => {
    const observed = observedFields(probe);
    const required = requiredFieldsForFamily(probe.family);
    const missing = unique([
      ...required.filter((field) => !observed.includes(field)),
      secondProviderConfirmed ? undefined : "secondProvider",
    ].filter(Boolean) as Pass435ProbeExpectation[]);
    const coverage = clamp((observed.length / Math.max(1, required.length)) * 100);
    return {
      provider: probe.provider,
      family: probe.family,
      status: probe.status,
      verdict: verdictFor(probe, missing),
      observedFields: observed,
      missingFields: missing,
      coverage,
      sampleLine: sampleLine(probe),
      repairHint: repairHint(missing),
    };
  });
}

export function buildPass435LiveQueryTestBench(input: {
  result: TokenRiskResult;
  pass433?: Pass433RealInternetDataArbitration;
  pass434?: Pass434ProviderCrosscheckMissingDataHunter;
  providerAttempts?: Pass433ProviderProbe[];
}): Pass435LiveQueryTestBench {
  const probes = input.providerAttempts?.length
    ? input.providerAttempts
    : input.pass433?.providerProbes?.length
      ? input.pass433.providerProbes
      : [];
  const okOrPartial = probes.filter((probe) => probe.status === "ok" || probe.status === "partial");
  const secondProviderConfirmed = Boolean(input.pass434?.providerCrosscheck.secondProviderConfirmed) || okOrPartial.length >= 2;
  const rows = providerRows(probes, secondProviderConfirmed);
  const hasPrice = Boolean(input.pass434?.providerCrosscheck.priceConfirmed) || probes.some((probe) => probe.hasPrice);
  const hasFresh = probes.some((probe) => probe.sourceFreshness === "fresh");
  const hasConflict = input.pass433?.arbitrationMode === "cross_source_conflict" || input.pass434?.truthTier === "conflict";
  const criticalMissing = rows.flatMap((row) => row.missingFields).filter((field) => field === "price" || field === "secondProvider").length;
  const liveReadinessScore = clamp(
    (input.pass434?.internetEvidenceScore ?? input.pass433?.internetDataScore ?? 0) * 0.62 +
      (hasPrice ? 12 : -18) +
      (secondProviderConfirmed ? 14 : -12) +
      (hasFresh ? 8 : -6) -
      (hasConflict ? 24 : 0) -
      Math.min(22, criticalMissing * 5),
  );
  const fakeLiveRisk = clamp(
    100 - liveReadinessScore +
      (!hasPrice ? 18 : 0) +
      (!secondProviderConfirmed ? 12 : 0) +
      (!hasFresh ? 8 : 0) +
      (hasConflict ? 18 : 0),
  );
  const releaseMode: Pass435ReleaseMode = hasConflict
    ? "facts_only_no_live_claim"
    : !hasPrice || liveReadinessScore < 28
      ? "block_pdf_until_probe"
      : liveReadinessScore >= 78 && secondProviderConfirmed
        ? "release_live_readout"
        : liveReadinessScore >= 45
          ? "release_partial_with_missing"
          : "facts_only_no_live_claim";
  const missingDataReplay = unique([
    ...(input.pass434?.missingDataHunter ?? []).map((item) => item.field),
    ...rows.flatMap((row) => row.missingFields),
  ].map(String)).map((field) => ({
    field,
    attemptedProviders: unique(probes.map((probe) => probe.provider)),
    nextProvider: input.pass434?.missingDataHunter.find((item) => item.field === field)?.nextProvider ?? repairHint([field as Pass435ProbeExpectation]),
    mustSurfaceInPdf: field === "price" || field === "secondProvider" || field === "liquidity" || field === "security" || fakeLiveRisk >= 55,
    mustSurfaceInChat: true,
  }));
  const queryAssertions = [
    {
      id: "price_observed",
      passed: hasPrice,
      severity: hasPrice ? "info" as const : "critical" as const,
      statement: "A live/partial answer needs an observed price or explicit no-price status.",
      evidence: hasPrice ? "At least one provider returned price." : "No provider returned a usable price.",
    },
    {
      id: "second_provider_gate",
      passed: secondProviderConfirmed,
      severity: secondProviderConfirmed ? "info" as const : "warning" as const,
      statement: "A confident PDF/chat answer needs a second provider or visible missing-data line.",
      evidence: secondProviderConfirmed ? "Two provider lanes are present." : "Second provider is still missing or partial.",
    },
    {
      id: "freshness_gate",
      passed: hasFresh,
      severity: hasFresh ? "info" as const : "warning" as const,
      statement: "A live claim needs a fresh timestamp or the text must avoid live wording.",
      evidence: hasFresh ? "At least one provider has fresh timestamp." : "Freshness missing/stale across attempted providers.",
    },
    {
      id: "no_conflict_gate",
      passed: !hasConflict,
      severity: hasConflict ? "critical" as const : "info" as const,
      statement: "Conflicting source prices must downgrade answer mode.",
      evidence: hasConflict ? "Source arbitration reported conflict." : "No cross-source conflict reported.",
    },
  ];
  const symbol = input.result.token.symbol || input.result.token.name || "asset";
  return {
    version: "live-query-test-bench",
    generatedAt: new Date().toISOString(),
    releaseMode,
    liveReadinessScore,
    fakeLiveRisk,
    providerRealityRows: rows,
    queryAssertions,
    missingDataReplay,
    pdfChatContract: {
      onePayload: true,
      oneLocale: true,
      noSecondCopyGenerator: true,
      noFakeLive: true,
      allowedSections: ["brief", "sources", "secondProvider", "missing", "next", "signature"],
      maxMissingItemsInCustomerPdf: 6,
      maxSentencesPerSection: 3,
    },
    localTestCommands: [
      "npm run probe:live-query-test-bench -- bitcoin ethereum solana",
      "npm run probe:live-query-test-bench -- NVDA EURUSD=X GC=F MEXC",
      `/api/market-integrity/probe?query=${encodeURIComponent(symbol)}`,
    ],
    operatorReadout: `PASS435 ${releaseMode}; readiness ${liveReadinessScore}/100; fake-live risk ${fakeLiveRisk}/100; missing ${missingDataReplay.length}.`,
    publicReadout: releaseMode === "release_live_readout"
      ? "Velmère confirmed the asset through multiple provider lanes before generating the report."
      : releaseMode === "release_partial_with_missing"
        ? "Velmère found usable data, but the report must show which provider fields are still missing."
        : releaseMode === "facts_only_no_live_claim"
          ? "Velmère can answer with bounded facts only because provider coverage is limited or conflicting."
          : "Velmère should not generate a live-style PDF until at least one usable provider payload is confirmed.",
  };
}

export function buildPass435LensLiveQueryContract(input: {
  locale: "pl" | "de" | "en";
  sourceConfidence: number;
  sourceCount: number;
  missingDataCount: number;
}): Pass435LensLiveQueryContract {
  const secondProvider = input.sourceCount >= 2;
  const maxPublicConfidence = clamp(input.sourceConfidence - (secondProvider ? 0 : 18) - input.missingDataCount * 4, 18, 88);
  const releaseMode: Pass435ReleaseMode = input.sourceConfidence >= 75 && secondProvider
    ? "release_live_readout"
    : input.sourceConfidence >= 45
      ? "release_partial_with_missing"
      : input.sourceCount > 0
        ? "facts_only_no_live_claim"
        : "block_pdf_until_probe";
  return {
    version: "pass435-lens-live-query-contract",
    locale: input.locale,
    releaseMode,
    onePayload: true,
    noFakeLive: true,
    maxSuggestions: 3,
    customerCopy: "clean_pdf_preview_only",
    missingDataMustBeVisible: input.missingDataCount > 0 || !secondProvider,
    maxPublicConfidence,
    testBenchLine: `PASS435 ${releaseMode}; confidence cap ${maxPublicConfidence}; source count ${input.sourceCount}; missing ${input.missingDataCount}.`,
  };
}
