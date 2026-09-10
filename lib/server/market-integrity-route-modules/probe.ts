import { readJsonResponseBounded } from "@/lib/network/fetch-with-deadline";
import { brokeredEgressFetch } from "@/lib/network/brokered-egress";
import { searchCoinGeckoMarket } from "@/lib/market-integrity/coingecko";
import { analyzeDexScreenerToken } from "@/lib/market-integrity/dexscreener";
import {
  buildPass433ProviderProbeFromRiskResult,
  buildPass433RealInternetDataArbitration,
  type Pass433ProviderFamily,
  type Pass433ProviderProbe,
} from "@/lib/market-integrity/real-internet-data-arbitration";
import { buildPass434ProviderCrosscheckMissingDataHunter } from "@/lib/market-integrity/provider-crosscheck-missing-data-hunter";
import { buildPass435LiveQueryTestBench } from "@/lib/market-integrity/live-query-test-bench";
import { buildPass436WorldBrainSloGraphRuntime } from "@/lib/market-integrity/world-brain-slo-graph-runtime";
import { buildPass437AdaptiveEvidencePlannerRuntime } from "@/lib/market-integrity/adaptive-evidence-planner-runtime";
import { buildPass438ProviderExecutionLoopRuntime } from "@/lib/market-integrity/provider-execution-loop-runtime";
import { buildPass439TruthReplayHarnessRuntime } from "@/lib/market-integrity/truth-replay-harness-runtime";
import { buildPass440SemanticDriftSourceLineageRuntime } from "@/lib/market-integrity/semantic-drift-source-lineage-runtime";
import { buildPass441BrainEvalHarnessRuntime } from "@/lib/market-integrity/brain-eval-harness-runtime";
import { buildPass442BrainRegressionJudgeRuntime } from "@/lib/market-integrity/regression-judge-runtime";
import { buildRiskBrain } from "@/lib/market-integrity/risk-brain";
import { getPersistentRiskHistory } from "@/lib/market-integrity/risk-ledger";
import { abuseShieldResponseMeta, applyApiAbuseShield } from "@/lib/security/api-abuse-shield";
import { securityJson } from "@/lib/security/api-guard";
import { publicApiError, reportApiError } from "@/lib/security/api-error-envelope";
import { withExpensiveRouteBudget } from "@/lib/security/expensive-route-concurrency-budget";
import type { TokenRiskResult } from "@/lib/market-integrity/risk-types";
import { buildRiskIndicatorCustomerTruth } from "@/lib/market-integrity/risk-indicator-customer-truth";
import { enforceLegacyRiskPublicationTruth } from "@/lib/market-integrity/legacy-route-publication-truth";

const yahooSymbolAliases: Record<string, string> = {
  btc: "BTC-USD",
  bitcoin: "BTC-USD",
  eth: "ETH-USD",
  ethereum: "ETH-USD",
  sol: "SOL-USD",
  solana: "SOL-USD",
  bnb: "BNB-USD",
  binance: "BNB-USD",
  nvda: "NVDA",
  aapl: "AAPL",
  msft: "MSFT",
  eurusd: "EURUSD=X",
  "eurusd=x": "EURUSD=X",
  gold: "GC=F",
  oil: "CL=F",
};
const binanceSymbolAliases: Record<string, string> = {
  btc: "BTCUSDT",
  bitcoin: "BTCUSDT",
  eth: "ETHUSDT",
  ethereum: "ETHUSDT",
  sol: "SOLUSDT",
  solana: "SOLUSDT",
  bnb: "BNBUSDT",
  binance: "BNBUSDT",
  xrp: "XRPUSDT",
  doge: "DOGEUSDT",
  ada: "ADAUSDT",
};
const safeYahooSymbol = /^[A-Za-z0-9.^=-]{1,24}$/;

function num(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

async function fetchJson(url: string) {
  const response = await brokeredEgressFetch(url, {
    headers: { accept: "application/json", "user-agent": "Velmere-PASS435-Live-Query-TestBench/1.0" },
    cache: "no-store",
  }, { profile: "public_probe", operation: "read_only_probe", timeoutMs: 10_000 });
  if (!response.ok) throw new Error(`provider_${response.status}`);
  return await readJsonResponseBounded<unknown>(response, 2_000_000);
}

async function resolveYahooSymbol(query: string) {
  const clean = query.trim().toLowerCase();
  const direct = yahooSymbolAliases[clean] ?? (safeYahooSymbol.test(query.trim()) ? query.trim().toUpperCase() : undefined);
  if (direct) return direct;
  const payload = await fetchJson(`https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(query)}&quotesCount=1&newsCount=0&enableFuzzyQuery=true`) as { quotes?: Array<{ symbol?: string }> };
  const found = payload.quotes?.find((item) => item.symbol && safeYahooSymbol.test(item.symbol))?.symbol;
  if (!found) throw new Error("no_yahoo_match");
  return found;
}

async function loadYahooRiskResult(query: string): Promise<{ result: TokenRiskResult; probe: Pass433ProviderProbe }> {
  const symbol = await resolveYahooSymbol(query);
  const payload = await fetchJson(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=5d&interval=30m&includePrePost=false&events=div%2Csplits`) as {
    chart?: { result?: Array<{ meta?: { regularMarketPrice?: number; chartPreviousClose?: number; shortName?: string; currency?: string; regularMarketTime?: number }; timestamp?: number[]; indicators?: { quote?: Array<{ close?: Array<number | null>; volume?: Array<number | null> }> } }> };
  };
  const chart = payload.chart?.result?.[0];
  const quote = chart?.indicators?.quote?.[0];
  const closes = (quote?.close ?? []).filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  if (!chart || closes.length < 2) throw new Error("yahoo_chart_empty");
  const first = closes[0];
  const last = num(chart.meta?.regularMarketPrice) ?? closes.at(-1)!;
  const change24h = first ? ((last - first) / first) * 100 : undefined;
  const volume24h = (quote?.volume ?? []).filter((value): value is number => typeof value === "number" && Number.isFinite(value)).slice(-48).reduce((sum, value) => sum + value, 0);
  const volatilityRisk = Math.min(36, Math.abs(change24h ?? 0) * 3);
  const missingRisk = chart.meta?.regularMarketTime ? 0 : 8;
  const score = Math.round(Math.min(100, 18 + volatilityRisk + missingRisk));
  const generatedAt = new Date().toISOString();
  const riskInput = {
    symbol,
    name: chart.meta?.shortName || symbol,
    marketId: symbol,
    assetClass: "stock" as const,
    dataSources: ["Yahoo Finance chart adapter"],
  };
  const baseResult: Omit<TokenRiskResult, "customerTruth"> = {
    token: { symbol, name: riskInput.name, marketId: symbol, url: `https://finance.yahoo.com/quote/${encodeURIComponent(symbol)}` },
    score,
    confidence: 0.54,
    level: score >= 65 ? "high" : score >= 35 ? "medium" : "low",
    badge: score >= 65 ? "possible_manipulation_risk" : score >= 35 ? "elevated_risk" : "low_detected_risk",
    signals: [],
    metrics: {
      currentPrice: last,
      priceChange24h: change24h,
      volume24h: volume24h || undefined,
    },
    dataQuality: "partial",
    chart: { sevenDay: closes.slice(-80) },
    aiSummary: `${symbol} resolved through the PASS434 real-market Yahoo chart lane. Treat as advisory provider data until a paid/official second source is configured.`,
    dataSources: ["Yahoo Finance chart adapter"],
    generatedAt,
  };
  const result: TokenRiskResult = {
    ...baseResult,
    customerTruth: buildRiskIndicatorCustomerTruth({
      input: riskInput,
      result: baseResult,
      reportContextDepth: null,
    }),
  };
  const probe: Pass433ProviderProbe = {
    id: "yahoo_finance_chart",
    provider: "Yahoo Finance chart unofficial",
    family: "real_market",
    status: "partial",
    fieldCoverage: 57,
    hasPrice: true,
    has24hChange: typeof change24h === "number" && Number.isFinite(change24h),
    hasVolume24h: volume24h > 0,
    hasMarketCap: false,
    hasLiquidity: false,
    hasCandles: closes.length > 4,
    hasSecurity: false,
    sourceFreshness: chart.meta?.regularMarketTime ? "fresh" : "missing",
    price: last,
    change24h,
    sample: `${symbol} · Yahoo chart · ${last}`,
    missing: ["market cap", "liquidity", "security flags"],
  };
  return { result, probe };
}

async function loadBinanceKlineProbe(query: string): Promise<Pass433ProviderProbe | undefined> {
  const symbol = binanceSymbolAliases[query.trim().toLowerCase()];
  if (!symbol) return undefined;
  const rows = await fetchJson(`https://api.binance.com/api/v3/klines?symbol=${encodeURIComponent(symbol)}&interval=1h&limit=48`) as unknown[];
  if (!Array.isArray(rows) || rows.length < 2) throw new Error("binance_klines_empty");
  const first = Number((rows[0] as unknown[])[1]);
  const last = Number((rows.at(-1) as unknown[])[4]);
  const volume = rows.reduce<number>((sum, row) => sum + Number((row as unknown[])[5] || 0), 0);
  const change = first > 0 ? ((last - first) / first) * 100 : undefined;
  return {
    id: "binance_spot_klines",
    provider: "Binance spot klines",
    family: "crypto_market",
    status: "partial",
    fieldCoverage: 57,
    hasPrice: Number.isFinite(last),
    has24hChange: typeof change === "number" && Number.isFinite(change),
    hasVolume24h: Number.isFinite(volume) && volume > 0,
    hasMarketCap: false,
    hasLiquidity: false,
    hasCandles: true,
    hasSecurity: false,
    sourceFreshness: "fresh",
    price: last,
    change24h: change,
    sample: `${symbol} · Binance klines · ${last}`,
    missing: ["market cap", "liquidity", "security flags"],
  };
}

function errorProviderProbe(provider: string, family: Pass433ProviderFamily, errorCode: string): Pass433ProviderProbe {
  return {
    id: provider.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, ""),
    provider,
    family,
    status: "error",
    fieldCoverage: 0,
    hasPrice: false,
    has24hChange: false,
    hasVolume24h: false,
    hasMarketCap: false,
    hasLiquidity: false,
    hasCandles: false,
    hasSecurity: false,
    sourceFreshness: "missing",
    missing: ["price", "24h change", "24h volume", "market cap", "liquidity", "candles", "security flags"],
    error: errorCode,
  };
}

function failedProviderProbe(
  provider: string,
  family: Pass433ProviderFamily,
  error: unknown,
  errorCode: string,
) {
  const reported = reportApiError(error, {
    route: "/api/market-integrity/probe",
    code: errorCode,
    status: 502,
  });
  return errorProviderProbe(provider, family, reported.publicCode);
}

async function handleMarketProbeGet(request: Request) {
  const shield = await applyApiAbuseShield(request, "default", {
    keyPrefix: "market-probe-pass435",
    queryParam: "query",
    allowEmptyQuery: false,
  });
  if (!shield.ok) return shield.response;

  const query = (shield.query ?? "").trim();
  if (!query) return securityJson({ mode: "error", error: "Missing query" }, { status: 400 });

  try {
    const providerAttempts: Pass433ProviderProbe[] = [];
    const coinGeckoAttempt = await searchCoinGeckoMarket(query)
      .then((marketRow) => {
        if (!marketRow?.result) return undefined;
        return {
          result: marketRow.result,
          probe: buildPass433ProviderProbeFromRiskResult({ result: marketRow.result, provider: "CoinGecko markets", family: "crypto_market" }),
        };
      })
      .catch((error) => {
        providerAttempts.push(failedProviderProbe("CoinGecko markets", "crypto_market", error, "coingecko_probe_failed"));
        return undefined;
      });
    if (coinGeckoAttempt?.probe) providerAttempts.push(coinGeckoAttempt.probe);

    const dexAttempt = await analyzeDexScreenerToken(query)
      .then((result) => ({
        result,
        probe: buildPass433ProviderProbeFromRiskResult({ result, provider: "DEX Screener + GoPlus", family: "dex_liquidity" }),
      }))
      .catch((error) => {
        providerAttempts.push(failedProviderProbe("DEX Screener + GoPlus", "dex_liquidity", error, "dex_probe_failed"));
        return undefined;
      });
    if (dexAttempt?.probe) providerAttempts.push(dexAttempt.probe);

    const binanceProbe = await loadBinanceKlineProbe(query)
      .catch((error) => {
        providerAttempts.push(failedProviderProbe("Binance spot klines", "crypto_market", error, "binance_probe_failed"));
        return undefined;
      });
    if (binanceProbe) providerAttempts.push(binanceProbe);

    const yahooAttempt = await loadYahooRiskResult(query)
      .catch((error) => {
        providerAttempts.push(failedProviderProbe("Yahoo Finance chart unofficial", "real_market", error, "yahoo_probe_failed"));
        return undefined;
      });
    if (yahooAttempt?.probe) providerAttempts.push(yahooAttempt.probe);

    const result = coinGeckoAttempt?.result ?? dexAttempt?.result ?? yahooAttempt?.result;
    if (!result) throw new Error("No provider produced a usable market payload");
    const generatedAt = new Date().toISOString();
    const publication = enforceLegacyRiskPublicationTruth(result, generatedAt);
    if (publication.evidenceState !== "verified") {
      return securityJson({
        mode: "probe_withheld",
        query,
        result: {
          symbol: result.token.symbol,
          name: result.token.name,
          score: null,
          level: null,
          dataQuality: result.dataQuality,
          metrics: {},
          dataSources: [],
          generatedAt: result.generatedAt,
        },
        publication,
        providerAttempts,
        blocker: "verified_signed_fresh_quorum_market_evidence_required",
        generatedAt,
      }, { status: 424 });
    }

    const id = result.token.marketId ?? result.token.tokenAddress ?? result.token.symbol;
    const history = await getPersistentRiskHistory(id);
    const brain = buildRiskBrain(result, history);
    const pass432 = brain.pass432;
    const pass433 = buildPass433RealInternetDataArbitration({ result, pass432, providerAttempts });
    const pass434 = buildPass434ProviderCrosscheckMissingDataHunter({ result, pass433, providerAttempts });
    const pass435 = buildPass435LiveQueryTestBench({ result, pass433, pass434, providerAttempts });
    const pass436 = buildPass436WorldBrainSloGraphRuntime({ result, pass435 });
    const pass437 = buildPass437AdaptiveEvidencePlannerRuntime({ result, pass435, pass436 });
    const pass438 = buildPass438ProviderExecutionLoopRuntime({ result, pass433, pass435, pass436, pass437, providerAttempts });
    const pass439 = buildPass439TruthReplayHarnessRuntime({ result, pass435, pass436, pass438, providerAttempts });
    const pass440 = buildPass440SemanticDriftSourceLineageRuntime({ result, pass438, pass439, providerAttempts });
    const pass441 = buildPass441BrainEvalHarnessRuntime({ result, pass435, pass439, pass440, providerAttempts });
    const pass442 = buildPass442BrainRegressionJudgeRuntime({ result, pass435, pass439, pass440, pass441, providerAttempts });

    return securityJson({
      mode: "verified_probe",
      publication,
      query,
      result: {
        symbol: result.token.symbol,
        name: result.token.name,
        score: result.score,
        level: result.level,
        dataQuality: result.dataQuality,
        metrics: result.metrics,
        dataSources: result.dataSources,
        generatedAt: result.generatedAt,
      },
      probe: pass432,
      pass432,
      pass433,
      pass434,
      pass435,
      pass436,
      pass437,
      pass438,
      pass439,
      pass440,
      pass441,
      pass442,
      generatedAt,
      liveQueryTestBench: pass435,
      worldBrainSloGraph: pass436,
      adaptiveEvidencePlanner: pass437,
      providerExecutionLoop: pass438,
      truthReplayHarness: pass439,
      semanticDriftLineage: pass440,
      brainEvalHarness: pass441,
      brainRegressionJudge: pass442,
      arbitration: pass433,
      providerCrosscheck: pass434,
      providerAttempts,
      sampleReadout: pass432.sampleReadout,
      providerReality: pass432.providerReality,
      repairPlan: [
        ...pass432.realDataRepairPlan,
        ...pass433.missingDataHunt.map((item) => ({ id: item.id, action: "surface_missing", target: "provider", reason: item.reason })),
        ...pass434.missingDataHunter.map((item) => ({ id: item.id, action: item.status === "conflict" ? "review_conflict" : "hunt_missing", target: item.nextProvider, reason: item.reason })),
        ...pass435.missingDataReplay.map((item) => ({ id: `pass435_${item.field}`, action: "replay_missing_in_pdf_chat", target: item.nextProvider, reason: `${item.field} must be surfaced before live wording.` })),
        ...pass436.interruptPolicy.reasons.filter((reason) => reason !== "none").map((reason) => ({ id: `pass436_${reason}`, action: pass436.interruptPolicy.humanInLoopRequired ? "operator_interrupt" : "monitor_slo", target: pass436.sloEnvelope.alertPolicy, reason: pass436.interruptPolicy.resumeHint })),
        ...pass437.providerPriorityQueue.map((item) => ({ id: item.id, action: "adaptive_probe_plan", target: item.provider, reason: `${item.reason} Next command: ${item.command}` })),
        ...pass438.providerExecutionLedger.map((item) => ({ id: item.id, action: item.state === "observed" ? "record_provider_observation" : item.state === "blocked" ? "operator_pause" : "execute_provider_lane", target: item.provider, reason: item.traceLine })),
        ...pass439.truthReplayNodes.filter((item) => item.state !== "supported").map((item) => ({ id: item.id, action: item.state === "conflict_review" ? "operator_review" : item.state === "missing_evidence" ? "seal_live_claim" : "surface_partial_evidence", target: item.lane, reason: item.replayLine })),
        ...pass440.driftSignals.map((item) => ({ id: item.id, action: item.severity === "high" ? "rewrite_or_seal_claim" : "guard_narrative_tone", target: item.lane, reason: item.repair })),
        ...pass441.evalCases.filter((item) => item.status !== "pass").map((item) => ({ id: item.id, action: item.status === "fail" ? "eval_seal_or_review" : "eval_guard", target: item.lane, reason: item.repair })),
        ...pass442.repairQueue.map((item) => ({ id: item.id, action: item.action, target: item.priority, reason: item.reason })),
      ],
      brainMode: {
        pass431: brain.pass431.finalAnswerMode,
        pass432: pass432.dataTruthMode,
        pass433: pass433.arbitrationMode,
        pass434: pass434.truthTier,
        pass435: pass435.releaseMode,
        pass436: pass436.releaseDecision,
        pass437: pass437.plannerMode,
        pass438: pass438.executionMode,
        pass439: pass439.replayState,
        pass440: pass440.driftState,
        pass441: pass441.evalMode,
        pass442: pass442.regressionMode,
      },
      ...abuseShieldResponseMeta(shield),
    });
  } catch (error) {
    return publicApiError(error, {
      route: "/api/market-integrity/probe",
      code: "brain_verification_probe_failed",
      status: 502,
    });
  }
}

export async function GET(request: Request) {
  return withExpensiveRouteBudget(request, "market_probe_get", () => handleMarketProbeGet(request));
}
