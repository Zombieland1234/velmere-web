import { searchCoinGeckoMarket } from "@/lib/market-integrity/coingecko";
import { analyzeDexScreenerToken } from "@/lib/market-integrity/dexscreener";
import { isRealMarketVlmQuery, resolveRealMarketTarget, resolveRealMarketVlmRiskResult } from "@/lib/market-integrity/real-market-vlm-adapter";
import { buildAnalysisReadiness, buildInsufficientDataRiskResult } from "@/lib/market-integrity/analysis-readiness";
import { buildPass4645ProviderEvidenceLedger, persistPass4645ProviderEvidenceLedger } from "@/lib/market-integrity/provider-evidence-ledger";
import { getPersistentRiskHistory } from "@/lib/market-integrity/risk-ledger";
import { buildRiskBrain } from "@/lib/market-integrity/risk-brain";
import { hydratePass2484RuntimePremiumEvidence } from "@/lib/market-integrity/runtime-premium-evidence-hydrator";
import { buildDefiLlamaSnapshotForResult } from "@/lib/market-integrity/defillama-adapter";
import { fetchPass2466DerivativesSqueezeProof } from "@/lib/market-integrity/derivatives-squeeze-proof";
import { fetchPass2467LiquidationLongShortProof } from "@/lib/market-integrity/liquidation-long-short-proof";
import { buildSourceSynchronizationPacket } from "@/lib/market-integrity/source-synchronizer";
import { analyzeRiskWithVlmKernel, generateVlmBrainAnalysis, type VlmDepth, type VlmLocale, type VlmSurface } from "@/lib/ai/vlm-brain";
import { resolveVlmPaidSurfaceAccess, toVlmPaidSurfacePaymentRequiredPayload } from "@/lib/commerce/vlm-paid-surface-guard";
import { registerPass4653RefreshTarget } from "@/lib/market-integrity/refresh-registry";
import { recordPass4656ProviderHealthObservations } from "@/lib/market-integrity/provider-health-store";
import { providerObservationFromPass4644Receipt } from "@/lib/market-integrity/provider-receipt-observation";
import { buildPass4656FailClosedProviderRuntimePlan, buildPass4656ProviderRuntimePlan, pass4656ProviderAllowedFailClosed, pass4656ProviderObservationOrigin, pass4656ProviderRuntimeGateEnabled } from "@/lib/market-integrity/provider-runtime-plan";
import { providerFailureObservationFromRuntimeError, providerMissingEvidenceObservation } from "@/lib/market-integrity/provider-runtime-failure";
import { buildPass4653ContinuitySnapshot, hydratePass4653ContinuityEvidence, persistPass4653ContinuitySnapshot, readPass4653ContinuitySnapshot } from "@/lib/market-integrity/continuous-evidence-availability";
import { buildPass4653InstrumentMetadataSnapshot, hydratePass4653InstrumentMetadata, persistPass4653InstrumentMetadataSnapshot, readPass4653InstrumentMetadataSnapshot } from "@/lib/market-integrity/instrument-metadata-cache";
import type { VlmPaidAccessContext } from "@/lib/commerce/vlm-paid-access";
import { securityJson } from "@/lib/security/api-guard";
import { applyConfiguredRiskCalibration } from "@/lib/market-integrity/risk-calibration-runtime";
import { enforceLegacyRiskPublicationTruth } from "@/lib/market-integrity/legacy-route-publication-truth";

export function wantsFullProofEnvelope(request: Request) {
  const url = new URL(request.url);
  return url.searchParams.get("proof") === "full" || request.headers.get("x-velmere-proof-mode") === "full";
}

export function locale(value: unknown): VlmLocale {
  return value === "en" || value === "de" ? value : "pl";
}
export function depth(value: unknown): VlmDepth {
  return value === "basic" || value === "pro" || value === "advanced" ? value : "basic";
}
export function surface(value: unknown): VlmSurface {
  return value === "shield_pro" || value === "real_markets" || value === "shield_map" || value === "lens" || value === "angel"
    ? value
    : "shield";
}

export function normalizedRequestId(value: unknown) {
  if (value === undefined || value === null || value === "") return null;
  const requestId = String(value).trim();
  if (requestId.length < 8 || requestId.length > 160) return null;
  return /^[A-Za-z0-9:._-]+$/.test(requestId) ? requestId : null;
}

export function paidSurface(value: VlmSurface): VlmPaidAccessContext["surface"] {
  if (value === "shield_pro") return "shield-pro";
  if (value === "real_markets") return "real-markets";
  if (value === "lens") return "browser";
  return "shield";
}

export async function settleProviderCall<T>(operation: () => Promise<T>) {
  const startedAt = Date.now();
  try {
    return { value: await operation(), error: null as unknown, elapsedMs: Date.now() - startedAt };
  } catch (error) {
    return { value: null as T | null, error, elapsedMs: Date.now() - startedAt };
  }
}

export async function requireVlmTierAccess(request: Request, args: { query: string; locale: VlmLocale; surface: VlmSurface; depth: VlmDepth }) {
  const verdict = await resolveVlmPaidSurfaceAccess({
    policyId: "vlm_analysis",
    request,
    depth: args.depth,
    surfaceOverride: paidSurface(args.surface),
    locale: args.locale,
    assetId: args.query,
    symbol: args.query,
  });
  if (verdict.ok) return { response: null, access: verdict };
  return { response: securityJson(toVlmPaidSurfacePaymentRequiredPayload(verdict), { status: 402, headers: verdict.headers }), access: verdict };
}

export async function resolveAnalysis(query: string, options: { locale: VlmLocale; depth: VlmDepth; surface: VlmSurface; prompt?: string }) {
  // PASS4640/PASS4642: the explicitly selected product surface is authoritative.
  const preferRealMarkets = options.surface === "real_markets" ||
    ((options.surface === "lens" || options.surface === "angel") && isRealMarketVlmQuery(query));
  const continuitySurface = preferRealMarkets ? "real_markets" as const : "crypto" as const;
  const instrumentMetadataRead = preferRealMarkets
    ? await readPass4653InstrumentMetadataSnapshot({ requestedIdentity: query, surface: "real_markets" }).catch(() => ({
        schemaVersion: "pass4653_instrument_metadata_read_v1" as const,
        snapshot: null,
        mode: "not_configured" as const,
        readBackVerified: false,
        blockers: ["metadata_read_failed"],
      }))
    : null;
  let realMarketTarget = preferRealMarkets ? resolveRealMarketTarget(query) : null;
  if (preferRealMarkets && instrumentMetadataRead?.snapshot) {
    const metadata = instrumentMetadataRead.snapshot;
    realMarketTarget = {
      symbol: metadata.canonicalSymbol,
      name: metadata.canonicalName,
      assetClass: metadata.assetClass,
    };
  }
  const pass4656ProviderHealthGateEnabled = pass4656ProviderRuntimeGateEnabled();
  const pass4656ProviderDescriptors = preferRealMarkets
    ? [
        { providerId: "yahoo_finance", providerFamily: "market_data", priority: 100 },
        { providerId: "stooq", providerFamily: "market_data_secondary", priority: 90 },
      ]
    : [
        { providerId: "coingecko", providerFamily: "market_data", priority: 100 },
        { providerId: "dexscreener", providerFamily: "dex_market", priority: 90 },
        { providerId: "goplus", providerFamily: "contract_risk", priority: 80 },
        { providerId: "binance_spot", providerFamily: "cex_microstructure", priority: 70 },
        { providerId: "defillama", providerFamily: "protocol_fundamentals", priority: 60 },
        { providerId: "binance_usdm", providerFamily: "derivatives_binance", priority: 50 },
        { providerId: "bybit_linear", providerFamily: "derivatives_bybit", priority: 40 },
      ];
  let pass4656ProviderRuntimePlanError: string | null = null;
  const pass4656ProviderRuntimePlan = await buildPass4656ProviderRuntimePlan({
    tier: options.depth,
    providers: pass4656ProviderDescriptors,
  }).catch((error) => {
    pass4656ProviderRuntimePlanError = `provider_runtime_plan_error:${error instanceof Error ? error.name : "unknown"}`;
    return buildPass4656FailClosedProviderRuntimePlan({
      tier: options.depth,
      providers: pass4656ProviderDescriptors,
      reason: pass4656ProviderRuntimePlanError,
    });
  });
  const providerAllowed = (providerId: string) => pass4656ProviderAllowedFailClosed({
    plan: pass4656ProviderRuntimePlan,
    providerId,
    gateEnabled: pass4656ProviderHealthGateEnabled,
  });
  const realMarketAttempt = preferRealMarkets && (providerAllowed("yahoo_finance") || providerAllowed("stooq"))
    ? await settleProviderCall(() => resolveRealMarketVlmRiskResult(realMarketTarget?.symbol ?? query, {
        providerAllowlist: pass4656ProviderRuntimePlan?.allowedProviderIds,
      }))
    : null;
  const realMarketResult = realMarketAttempt?.value ?? null;
  const [coinGeckoAttempt, dexAttempt] = realMarketResult || preferRealMarkets
    ? [null, null]
    : await Promise.all([
        providerAllowed("coingecko") ? settleProviderCall(() => searchCoinGeckoMarket(query)) : Promise.resolve(null),
        providerAllowed("dexscreener")
          ? settleProviderCall(() => analyzeDexScreenerToken(query, { allowGoPlus: providerAllowed("goplus") }))
          : Promise.resolve(null),
      ]);
  const marketRow = coinGeckoAttempt?.value ?? null;
  const dexResult = dexAttempt?.value ?? null;

  if (pass4656ProviderRuntimePlan?.enabled) {
    const runtimeFailures = [];
    if (preferRealMarkets && realMarketAttempt) {
      const receiptIds = new Set((realMarketResult?.providerEvidenceReceipts ?? []).map((receipt) => receipt.providerId));
      for (const provider of [
        { providerId: "yahoo_finance", providerFamily: "market_data", capabilities: ["identity", "quote", "history", "volume"] },
        { providerId: "stooq", providerFamily: "market_data_secondary", capabilities: ["identity", "quote", "volume"] },
      ]) {
        if (!providerAllowed(provider.providerId) || receiptIds.has(provider.providerId)) continue;
        runtimeFailures.push(realMarketAttempt.error
          ? providerFailureObservationFromRuntimeError({
              ...provider,
              requestedIdentity: realMarketTarget?.symbol ?? query,
              error: realMarketAttempt.error,
              elapsedMs: realMarketAttempt.elapsedMs,
              origin: pass4656ProviderObservationOrigin(pass4656ProviderRuntimePlan, provider.providerId),
            })
          : providerMissingEvidenceObservation({
              ...provider,
              requestedIdentity: realMarketTarget?.symbol ?? query,
              elapsedMs: realMarketAttempt.elapsedMs,
              origin: pass4656ProviderObservationOrigin(pass4656ProviderRuntimePlan, provider.providerId),
            }));
      }
    } else if (!preferRealMarkets) {
      if (providerAllowed("coingecko") && coinGeckoAttempt && !marketRow) {
        runtimeFailures.push(coinGeckoAttempt.error
          ? providerFailureObservationFromRuntimeError({
              providerId: "coingecko", providerFamily: "market_data", requestedIdentity: query,
              error: coinGeckoAttempt.error, elapsedMs: coinGeckoAttempt.elapsedMs,
              capabilities: ["identity", "price", "market_cap", "volume", "history", "supply"],
              origin: pass4656ProviderObservationOrigin(pass4656ProviderRuntimePlan, "coingecko"),
            })
          : providerMissingEvidenceObservation({
              providerId: "coingecko", providerFamily: "market_data", requestedIdentity: query,
              elapsedMs: coinGeckoAttempt.elapsedMs, capabilities: ["identity", "price", "market_cap", "volume", "history", "supply"],
              origin: pass4656ProviderObservationOrigin(pass4656ProviderRuntimePlan, "coingecko"),
            }));
      }
      if (providerAllowed("dexscreener") && dexAttempt && !dexResult) {
        runtimeFailures.push(dexAttempt.error
          ? providerFailureObservationFromRuntimeError({
              providerId: "dexscreener", providerFamily: "dex_market", requestedIdentity: query,
              error: dexAttempt.error, elapsedMs: dexAttempt.elapsedMs,
              capabilities: ["pair_identity", "dex_liquidity", "volume", "transactions", "price"],
              origin: pass4656ProviderObservationOrigin(pass4656ProviderRuntimePlan, "dexscreener"),
            })
          : providerMissingEvidenceObservation({
              providerId: "dexscreener", providerFamily: "dex_market", requestedIdentity: query,
              elapsedMs: dexAttempt.elapsedMs, capabilities: ["pair_identity", "dex_liquidity", "volume", "transactions", "price"],
              origin: pass4656ProviderObservationOrigin(pass4656ProviderRuntimePlan, "dexscreener"),
            }));
      }
    }
    if (runtimeFailures.length > 0) {
      await recordPass4656ProviderHealthObservations({ observations: runtimeFailures, ttlMs: 5 * 60_000 }).catch(() => null);
    }
  }
  let resolvedResult = realMarketResult ?? marketRow?.result ?? dexResult ??
    buildInsufficientDataRiskResult(
      realMarketTarget?.symbol ?? query,
      realMarketTarget?.assetClass ?? (options.surface === "real_markets" ? "stock" : "crypto"),
      options.surface === "real_markets"
        ? "Real Markets providers did not return a confirmed quote for this symbol."
        : "Crypto providers did not return a confirmed market or DEX record for this asset.",
    );
  if (realMarketTarget && !realMarketResult) {
    resolvedResult.token.name = realMarketTarget.name;
    resolvedResult.token.symbol = realMarketTarget.symbol;
    resolvedResult.token.assetClass = realMarketTarget.assetClass;
  }
  if (preferRealMarkets && instrumentMetadataRead?.snapshot && !realMarketResult) {
    resolvedResult = hydratePass4653InstrumentMetadata({
      result: resolvedResult,
      snapshot: instrumentMetadataRead.snapshot,
      requestedIdentity: query,
      surface: "real_markets",
    }).result;
  }
  if (preferRealMarkets && realMarketResult) {
    const metadataSnapshot = buildPass4653InstrumentMetadataSnapshot({
      requestedIdentity: query,
      surface: "real_markets",
      result: realMarketResult,
    });
    if (metadataSnapshot) {
      await persistPass4653InstrumentMetadataSnapshot(metadataSnapshot).catch(() => null);
    }
  }

  const refreshRegistration = await registerPass4653RefreshTarget({
    requestedIdentity: query,
    surface: continuitySurface,
    assetClass: resolvedResult.token.assetClass ?? (preferRealMarkets ? "stock" : "crypto"),
    requestedTier: options.depth,
  }).catch((error) => ({
    schemaVersion: "pass4653_refresh_registration_v1" as const,
    registered: false,
    durable: false,
    mode: "not_configured" as const,
    targetKey: `${continuitySurface}:registration_failed`,
    nextRefreshAt: new Date().toISOString(),
    blockers: [`refresh_registration_error:${error instanceof Error ? error.name : "unknown"}`],
  }));
  resolvedResult.pass4653RefreshRegistration = refreshRegistration;
  const continuitySnapshot = await readPass4653ContinuitySnapshot({
    requestedIdentity: query,
    surface: continuitySurface,
  }).catch(() => null);
  const initialContinuityHydration = hydratePass4653ContinuityEvidence({
    currentResult: resolvedResult,
    snapshot: continuitySnapshot,
    requestedIdentity: query,
    surface: continuitySurface,
    reason: "provider_outage",
  });
  resolvedResult = initialContinuityHydration.result;
  resolvedResult.pass4653RefreshRegistration = refreshRegistration;

  const premiumDepth = options.depth !== "basic";
  const providerHealthRuntimeEnabled = pass4656ProviderHealthGateEnabled;
  const providerHealthTierReady = pass4656ProviderRuntimePlan?.hasEvidencePath === true;
  const baseReadiness = buildAnalysisReadiness(resolvedResult, options.locale);
  if (premiumDepth && providerHealthRuntimeEnabled && !providerHealthTierReady) {
    resolvedResult.limitations = Array.from(new Set([
      ...(resolvedResult.limitations ?? []),
      "Provider health quorum is not ready for this paid tier.",
    ]));
    return {
      mode: "limited" as const,
      sourceMode: preferRealMarkets ? "real_markets" as const : "crypto_market_integrity" as const,
      result: resolvedResult,
      marketRow,
      premiumFailFast: true as const,
      failFastStage: "provider_health_quorum" as const,
      baseReadiness,
      pass4653Continuity: initialContinuityHydration.continuity,
      pass4656ProviderHealth: {
        enabled: true,
        ready: false,
        mode: pass4656ProviderRuntimePlan?.snapshotMode ?? "unavailable",
        blockers: Array.from(new Set([
          ...(pass4656ProviderRuntimePlan?.snapshotBlockers ?? []),
          ...(pass4656ProviderRuntimePlan?.blockers ?? []),
          ...(pass4656ProviderRuntimePlanError ? [pass4656ProviderRuntimePlanError] : []),
        ])),
        gateEnabled: pass4656ProviderHealthGateEnabled,
        runtimePlan: pass4656ProviderRuntimePlan,
      },
    };
  }
  // Zero-source paid requests cannot become sell-ready. Return before premium
  // hydration, historical ledgers, kernel expansion and generative AI.
  const premiumContinuityEligible = options.depth === "pro"
    ? initialContinuityHydration.continuity.paidContinuityEligible.pro
    : options.depth === "advanced"
      ? initialContinuityHydration.continuity.paidContinuityEligible.advanced
      : true;
  const premiumFailFast = premiumDepth && baseReadiness.sourceCount === 0 && !premiumContinuityEligible;
  if (premiumFailFast) {
    return {
      mode: "limited" as const,
      sourceMode: preferRealMarkets ? "real_markets" as const : "crypto_market_integrity" as const,
      result: resolvedResult,
      marketRow,
      premiumFailFast: true as const,
      failFastStage: "base_source_quorum" as const,
      baseReadiness,
      pass4653Continuity: initialContinuityHydration.continuity,
    };
  }

  const premiumNetworkAllowed = premiumDepth;
  const allowedDerivativeVenues = [
    providerAllowed("binance_usdm") && "binance_usdm",
    providerAllowed("bybit_linear") && "bybit_linear",
  ].filter((venue): venue is "binance_usdm" | "bybit_linear" => Boolean(venue));
  const hydrationPromise = hydratePass2484RuntimePremiumEvidence({
    query,
    result: resolvedResult,
    allowNetwork: premiumNetworkAllowed && providerAllowed("binance_spot"),
  });
  const defiLlamaPromise = premiumNetworkAllowed && providerAllowed("defillama")
    ? buildDefiLlamaSnapshotForResult(resolvedResult).catch(() => null)
    : Promise.resolve(null);
  const derivativesPromise = premiumNetworkAllowed
    ? fetchPass2466DerivativesSqueezeProof({
        query,
        symbol: resolvedResult.token.symbol,
        result: resolvedResult,
        allowedVenues: allowedDerivativeVenues,
      }).catch(() => null)
    : Promise.resolve(null);
  const liquidationPromise = premiumNetworkAllowed
    ? derivativesPromise.then((pass2466) => fetchPass2467LiquidationLongShortProof({
        query,
        symbol: resolvedResult.token.symbol,
        result: resolvedResult,
        pass2466,
        allowedVenues: allowedDerivativeVenues,
      })).catch(() => null)
    : Promise.resolve(null);
  const [{ result: hydratedResult, hydration: pass2484Hydration }, defiLlama, derivativesSqueeze, liquidationLongShort] = await Promise.all([
    hydrationPromise,
    defiLlamaPromise,
    derivativesPromise,
    liquidationPromise,
  ]);
  let result = hydratedResult;
  // Recompute continuity after premium providers have had a chance to return.
  // Existing replay receipts are removed first so the same snapshot cannot be
  // counted twice in one request.
  const liveOnlyResult = {
    ...result,
    providerEvidenceReceipts: (result.providerEvidenceReceipts ?? []).filter((receipt) => !receipt.continuity),
  };
  const finalContinuityHydration = hydratePass4653ContinuityEvidence({
    currentResult: liveOnlyResult,
    snapshot: continuitySnapshot,
    requestedIdentity: query,
    surface: continuitySurface,
    reason: "provider_outage",
  });
  result = finalContinuityHydration.result;
  result.pass4653RefreshRegistration = refreshRegistration;

  // PASS4806: probability claims are attached only by the production runtime
  // after both the signed holdout profile and the current signed drift receipt
  // pass verification. Missing or invalid calibration remains explicitly blocked.
  const pass4806RiskCalibration = applyConfiguredRiskCalibration(result);
  result = pass4806RiskCalibration.result;

  const continuitySnapshotToPersist = buildPass4653ContinuitySnapshot({
    requestedIdentity: query,
    surface: continuitySurface,
    result,
    previousSnapshot: continuitySnapshot,
  });
  if (continuitySnapshotToPersist) {
    result.pass4653ContinuityPersistence = await persistPass4653ContinuitySnapshot(continuitySnapshotToPersist).catch((error) => ({
      schemaVersion: "pass4653_continuity_persistence_v1" as const,
      durable: false,
      mode: "not_configured" as const,
      snapshotId: continuitySnapshotToPersist.snapshotId,
      snapshotHash: continuitySnapshotToPersist.snapshotHash,
      readBackVerified: false,
      locator: null,
      blockers: [`continuity_persistence_error:${error instanceof Error ? error.name : "unknown"}`],
    }));
  }

  const sourceSync = buildSourceSynchronizationPacket({ query, result, defiLlama, derivativesSqueeze, liquidationLongShort, pass2484Hydration });
  const providerEvidenceLedger = buildPass4645ProviderEvidenceLedger({
    receipts: result.providerEvidenceReceipts,
    requestedIdentity: query,
    surface: preferRealMarkets ? "real_markets" : "crypto",
    depth: options.depth,
    generatedAt: new Date(),
    signingSecret: process.env.VELMERE_PROVIDER_RECEIPT_SIGNING_SECRET?.trim() || null,
  });
  const providerEvidencePersistence = await persistPass4645ProviderEvidenceLedger(providerEvidenceLedger).catch((error) => ({
    schemaVersion: "pass4645_provider_evidence_persistence_v1" as const,
    durable: false,
    mode: "not_configured" as const,
    ledgerId: providerEvidenceLedger.ledgerId,
    headHash: providerEvidenceLedger.headHash,
    recordCount: providerEvidenceLedger.entries.length,
    readBackVerified: false,
    persistedAt: null,
    locator: null,
    blockers: [`provider_receipt_persistence_error:${error instanceof Error ? error.name : "unknown"}`],
  }));
  result.providerEvidenceLedger = providerEvidenceLedger;
  result.providerEvidencePersistence = providerEvidencePersistence;
  const pass4656ProviderHealth = (result.providerEvidenceReceipts ?? []).length > 0
    ? await recordPass4656ProviderHealthObservations({
        observations: (result.providerEvidenceReceipts ?? []).map((receipt) => providerObservationFromPass4644Receipt(receipt, {
          origin: pass4656ProviderObservationOrigin(pass4656ProviderRuntimePlan, receipt.providerId),
        })),
        ttlMs: 5 * 60_000,
      }).catch((error) => ({
        ok: false as const,
        error: `provider_health_record_error:${error instanceof Error ? error.name : "unknown"}`,
      }))
    : { ok: false as const, error: "provider_health_receipts_missing" };
  const generatedAt = new Date().toISOString();
  const publication = enforceLegacyRiskPublicationTruth(result, generatedAt);
  if (publication.evidenceState !== "verified") {
    return {
      mode: "limited" as const,
      sourceMode: preferRealMarkets ? "real_markets" as const : "crypto_market_integrity" as const,
      result,
      marketRow,
      publication,
      premiumFailFast: true as const,
      failFastStage: "signed_fresh_quorum_publication_gate" as const,
      baseReadiness,
      pass2484Hydration,
      pass4653Continuity: finalContinuityHydration.continuity,
      pass4806RiskCalibration: pass4806RiskCalibration.runtime,
      pass4656ProviderHealth: {
        ...pass4656ProviderHealth,
        gateEnabled: pass4656ProviderHealthGateEnabled,
        runtimePlanError: pass4656ProviderRuntimePlanError,
        runtimePlan: pass4656ProviderRuntimePlan,
      },
      generatedAt,
    };
  }
  const id = result.token.marketId ?? result.token.tokenAddress ?? result.token.symbol;
  const history = await getPersistentRiskHistory(id, 144);
  const brain = buildRiskBrain(result, history);
  const kernel = analyzeRiskWithVlmKernel({
    result,
    history,
    locale: options.locale,
    depth: options.depth,
    surface: options.surface === "real_markets" ? "real_markets" : options.surface === "shield_map" ? "shield_map" : options.surface === "lens" ? "lens" : "shield",
  });
  const ai = await generateVlmBrainAnalysis({ result, brain, ...options });
  return {
    mode: publication.mode,
    publication,
    sourceMode: preferRealMarkets ? "real_markets" as const : "crypto_market_integrity" as const,
    result,
    marketRow,
    history,
    brain,
    kernel,
    ai,
    premiumFailFast: false as const,
    baseReadiness,
    pass2484Hydration,
    pass4653Continuity: finalContinuityHydration.continuity,
    pass4806RiskCalibration: pass4806RiskCalibration.runtime,
    pass4656ProviderHealth: {
      ...pass4656ProviderHealth,
      gateEnabled: pass4656ProviderHealthGateEnabled,
      runtimePlanError: pass4656ProviderRuntimePlanError,
      runtimePlan: pass4656ProviderRuntimePlan,
    },
    generatedAt,
    sourceSync,
    pass2485: sourceSync.pass2485,
    pass2486: sourceSync.pass2486,
    pass2487: sourceSync.pass2487,
    pass2496: sourceSync.pass2496,
    pass2497: sourceSync.pass2497,
    pass2498: sourceSync.pass2498,
    pass2499: sourceSync.pass2499,
    pass2500: sourceSync.pass2500,
    pass2501: sourceSync.pass2501,
  };
}

export type ResolvedVlmAnalysis = Awaited<ReturnType<typeof resolveAnalysis>>;
export type PremiumFailFastAnalysis = Extract<ResolvedVlmAnalysis, { premiumFailFast: true }>;
export type FullResolvedVlmAnalysis = Extract<ResolvedVlmAnalysis, { premiumFailFast: false }>;
