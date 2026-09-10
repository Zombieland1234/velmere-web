import { publicApiError } from "@/lib/security/api-error-envelope";
import { NextResponse } from "next/server";
import { searchCoinGeckoMarket } from "@/lib/market-integrity/coingecko";
import { analyzeDexScreenerToken } from "@/lib/market-integrity/dexscreener";
import { buildDefiLlamaSnapshotForResult } from "@/lib/market-integrity/defillama-adapter";
import { buildPass2452RiskCalibrationKernel } from "@/lib/market-integrity/risk-calibration-kernel";
import { buildSourceSynchronizationPacket } from "@/lib/market-integrity/source-synchronizer";
import { applyApiRateLimit, rejectOversizedUrl, sanitizeBoundedParam, securityJson } from "@/lib/security/api-guard";
import { withExpensiveRouteBudget } from "@/lib/security/expensive-route-concurrency-budget";
import {
  buildShieldBasicDeliveryPreflight,
  projectShieldBasicCustomerDelivery,
} from "@/lib/market-integrity/shield-basic-delivery-policy";

type ErrorPayload = { mode: "error"; error: string };
type RiskCalibrationComputation = Awaited<ReturnType<typeof computeRiskCalibration>>;
type RiskCalibrationCoalescer = Map<string, Promise<RiskCalibrationComputation>>;

const ALLOWED_QUERY_KEYS = new Set(["query"]);
const MAX_DISTINCT_PROVIDER_COMPUTATIONS = 12;
const COALESCER_KEY = Symbol.for("velmere.risk-calibration-provider-coalescer.a90.v1");

function riskCalibrationCoalescer(): RiskCalibrationCoalescer {
  const holder = globalThis as typeof globalThis & Record<symbol, unknown>;
  const existing = holder[COALESCER_KEY];
  if (existing instanceof Map) return existing as RiskCalibrationCoalescer;
  const created: RiskCalibrationCoalescer = new Map();
  holder[COALESCER_KEY] = created;
  return created;
}

function validateQueryShape(url: URL) {
  const keys = Array.from(url.searchParams.keys());
  const unsupported = Array.from(new Set(keys.filter((key) => !ALLOWED_QUERY_KEYS.has(key))));
  const duplicate = Array.from(ALLOWED_QUERY_KEYS).filter((key) => url.searchParams.getAll(key).length > 1);
  return unsupported.length || duplicate.length
    ? { ok: false as const, unsupported, duplicate }
    : { ok: true as const };
}

function canonicalComputationKey(query: string) {
  return query.trim().toLocaleLowerCase("en-US").replace(/\s+/gu, " ");
}

async function computeRiskCalibration(query: string) {
  const [coinGecko, dexScreener] = await Promise.allSettled([
    searchCoinGeckoMarket(query),
    analyzeDexScreenerToken(query),
  ]);
  const marketRow = coinGecko.status === "fulfilled" ? coinGecko.value : null;
  const dexResult = dexScreener.status === "fulfilled" ? dexScreener.value : null;
  const result = marketRow?.result ?? dexResult;
  if (!result) throw new Error("risk_calibration_all_market_sources_unavailable");
  const defiLlama = await buildDefiLlamaSnapshotForResult(result);
  const sourceSync = buildSourceSynchronizationPacket({ query, result, defiLlama });
  const riskCalibration = sourceSync.pass2452 ?? buildPass2452RiskCalibrationKernel({
    query,
    symbol: sourceSync.symbol,
    result,
    sourceSync,
    chartOverlay: sourceSync.pass2449,
    tierEvidence: sourceSync.pass2450,
    dataProvenance: sourceSync.pass2451,
  });
  return { result, sourceSync, riskCalibration };
}

function computeRiskCalibrationCoalesced(query: string) {
  const coalescer = riskCalibrationCoalescer();
  const key = canonicalComputationKey(query);
  const existing = coalescer.get(key);
  if (existing) return existing;
  if (coalescer.size >= MAX_DISTINCT_PROVIDER_COMPUTATIONS) {
    return Promise.reject(new Error("risk_calibration_provider_concurrency_budget_exhausted"));
  }
  const tracked: Promise<RiskCalibrationComputation> = computeRiskCalibration(query).finally(() => {
    if (coalescer.get(key) === tracked) coalescer.delete(key);
  });
  coalescer.set(key, tracked);
  return tracked;
}

async function handleValidatedRequest(
  query: string,
  rateLimit: { remaining: number; resetAt: number },
) {
  try {
    const { result, sourceSync, riskCalibration } = await computeRiskCalibrationCoalesced(query);

    return securityJson({
      mode: sourceSync.mode,
      query,
      symbol: sourceSync.symbol,
      assetClass: sourceSync.assetClass,
      riskRankingScore: riskCalibration.calibratedRiskScore,
      calibratedRiskScore: riskCalibration.calibratedRiskScore,
      scoreInterpretation: "deterministic_evidence_ranking_not_empirical_probability",
      legacyFieldNotice: "calibratedRiskScore is retained for API compatibility; it is not an empirically calibrated probability.",
      empiricalCalibrationStatus: result.empiricalCalibration?.status ?? "not_available",
      confidenceCap: riskCalibration.confidenceCap,
      uncertaintyPercent: riskCalibration.uncertaintyPercent,
      riskCalibration,
      reportEvidenceCapsule: sourceSync.pass2453,
      institutionalRouter: sourceSync.pass2454,
      uiProofStrip: sourceSync.pass2455,
      runtimeParityQueue: sourceSync.pass2456,
      operatorActionQueue: sourceSync.pass2457,
      providerCloseoutRuntime: sourceSync.pass2458,
      sourceFreshnessDriftSentinel: sourceSync.pass2459,
      macroChartIntegrityGate: sourceSync.pass2460,
      macroGapReceipt: sourceSync.pass2461,
      canonicalEvidenceFingerprint: sourceSync.pass2453?.canonicalEvidenceFingerprint,
      components: riskCalibration.components,
      tierValueReceipt: riskCalibration.tierValueReceipt,
      noFillerGovernor: riskCalibration.noFillerGovernor,
      scoreCaps: riskCalibration.scoreCaps,
      dataProvenance: sourceSync.pass2451,
      sourceSyncProof: {
        runtimeParityState: sourceSync.pass2456?.state,
        runtimeParityScore: sourceSync.pass2456?.score,
        pass2450: sourceSync.pass2450?.state,
        pass2451: sourceSync.pass2451?.state,
        pass2452: riskCalibration.state,
        pass2453: sourceSync.pass2453?.state,
        pass2454: sourceSync.pass2454?.state,
        pass2455: sourceSync.pass2455?.state,
        pass2456: sourceSync.pass2456?.state,
        pass2457: sourceSync.pass2457?.state,
        sourceCount: sourceSync.sourceCount,
      },
      rateLimit,
      providerBudget: {
        schemaVersion: "velmere.risk-calibration-provider-budget.a90.v1",
        inFlightDistinctComputations: riskCalibrationCoalescer().size,
        maximumDistinctComputations: MAX_DISTINCT_PROVIDER_COMPUTATIONS,
        sameQuerySingleFlight: true,
        providerDeadlineAndBodyLimits: "enforced_by_brokered_provider_adapters",
      },
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    if (error instanceof Error && error.message === "risk_calibration_provider_concurrency_budget_exhausted") {
      return securityJson({
        mode: "error",
        error: "risk_calibration_provider_capacity_exhausted",
      }, {
        status: 503,
        headers: { "retry-after": "2" },
      });
    }
    return publicApiError(error, { route: "/api/market-integrity/risk-calibration", code: "risk_calibration_kernel_failed", status: 502 });
  }
}

export type RiskCalibrationRouteDependencies = {
  applyRequestRateLimit?: typeof applyApiRateLimit;
  executeValidated?: typeof handleValidatedRequest;
};

export async function executeRiskCalibrationGetRequest(
  request: Request,
  dependencies: RiskCalibrationRouteDependencies = {},
) {
  const applyRequestRateLimit = dependencies.applyRequestRateLimit ?? applyApiRateLimit;
  const executeValidated = dependencies.executeValidated ?? handleValidatedRequest;
  const urlGuard = rejectOversizedUrl(request, 2_048);
  if (urlGuard) return urlGuard;

  const url = new URL(request.url);
  const queryShape = validateQueryShape(url);
  if (!queryShape.ok) {
    return securityJson({
      mode: "error",
      error: "unsupported_or_duplicate_query_parameter",
      unsupported: queryShape.unsupported,
      duplicate: queryShape.duplicate,
    }, { status: 400 });
  }

  const rateLimit = await applyRequestRateLimit(request, { keyPrefix: "risk-calibration", limit: 24, windowMs: 60_000 });
  if (!rateLimit.ok) return rateLimit.response;

  const query = sanitizeBoundedParam(url.searchParams.get("query"), { maxLength: 120, fallback: "" });

  if (!query) return NextResponse.json<ErrorPayload>({ mode: "error", error: "Missing query" }, { status: 400 });

  const rightsPreflight = buildShieldBasicDeliveryPreflight("risk_indicator");
  if (!rightsPreflight.customerDeliveryAllowed || !rightsPreflight.providerNetworkAllowed) {
    const projected = projectShieldBasicCustomerDelivery({
      decision: rightsPreflight,
      payload: null,
      status: 503,
    });
    return securityJson(projected.payload, { status: projected.status });
  }

  return withExpensiveRouteBudget(request, "risk_calibration_get", () => executeValidated(query, {
    remaining: rateLimit.remaining,
    resetAt: rateLimit.resetAt,
  }));
}

export async function GET(request: Request) {
  return executeRiskCalibrationGetRequest(request);
}
