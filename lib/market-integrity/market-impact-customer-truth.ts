import {
  buildVlmStandaloneInsightContract,
  type VlmReportContextDepth,
  type VlmStandaloneInsightContract,
} from "../product/vlm-standalone-insight-contract";
import {
  buildVlmCustomerTruthReasons,
  resolveVlmConfidenceClass,
  resolveVlmTruthState,
  uniqueVlmTruthStrings,
  type VlmCustomerLocale,
  type VlmEvidenceOrigin,
  type VlmStandaloneCustomerTruthEnvelope,
  type VlmTruthReasonCode,
} from "../product/vlm-standalone-customer-truth";
import type {
  MarketImpactExecution,
  MarketImpactVenueSummary,
} from "./market-impact-types";

export type MarketImpactInputMode =
  | "CURRENT_ORDER_BOOK_SNAPSHOT"
  | "VERIFIED_STAGING_ORDER_BOOK_SNAPSHOT"
  | "FIXTURE_ORDER_BOOK_SIMULATION"
  | "NO_USABLE_ORDER_BOOK";

export type MarketImpactCustomerTruth = VlmStandaloneCustomerTruthEnvelope & {
  productId: "market-impact";
  locale: VlmCustomerLocale;
  inputMode: MarketImpactInputMode;
  resultMode: "SNAPSHOT_EXECUTION_SIMULATION" | "SIMULATION_ONLY" | "WITHHELD";
  forecastClaimAllowed: false;
  futureOutcomeClaimAllowed: false;
  realizedSlippageClaimAllowed: false;
  hiddenLiquidityModeled: false;
  orderBookReplenishmentModeled: false;
  queuePositionModeled: false;
  marketReactionModeled: false;
  predictionOutcomeStatus: "MISSING_PREDICTED_VS_REALIZED_OUTCOME";
  observedVenueCount: number;
  providerFamilyCount: number;
  executionScenarioCount: number;
  commercialRightsStatus: "NOT_EVALUATED_BY_MODEL";
  contract: VlmStandaloneInsightContract;
};

function inputMode(
  evidenceStatus: "verified_live" | "verified_staging" | "fixture_only" | "unavailable",
): MarketImpactInputMode {
  if (evidenceStatus === "verified_live") return "CURRENT_ORDER_BOOK_SNAPSHOT";
  if (evidenceStatus === "verified_staging") return "VERIFIED_STAGING_ORDER_BOOK_SNAPSHOT";
  if (evidenceStatus === "fixture_only") return "FIXTURE_ORDER_BOOK_SIMULATION";
  return "NO_USABLE_ORDER_BOOK";
}

function oldestObservedAt(venues: MarketImpactVenueSummary[]): string | null {
  const timestamps = venues
    .flatMap((venue) => [venue.observedAt, venue.quoteRateObservedAt])
    .filter((value): value is string => Boolean(value))
    .map((value) => Date.parse(value))
    .filter(Number.isFinite);
  return timestamps.length > 0 ? new Date(Math.min(...timestamps)).toISOString() : null;
}

function localizedSummary(args: {
  locale: VlmCustomerLocale;
  mode: MarketImpactInputMode;
  venueCount: number;
  scenarioCount: number;
}): string {
  const fixture = args.mode === "FIXTURE_ORDER_BOOK_SIMULATION";
  const unavailable = args.mode === "NO_USABLE_ORDER_BOOK";
  if (args.locale === "pl") {
    if (unavailable) return "Market Impact wstrzymuje wynik: brak użytecznego order booka. Bez głębokości rynku nie publikujemy poślizgu ani wpływu zlecenia.";
    return `Market Impact symuluje wykonanie na ${args.venueCount} snapshotach rynku i ${args.scenarioCount} scenariuszach. ${fixture ? "Dane są testowe. " : ""}Wynik nie jest prognozą przyszłego fillu ani zrealizowanym poślizgiem.`;
  }
  if (args.locale === "de") {
    if (unavailable) return "Market Impact hält das Ergebnis zurück: Ein nutzbares Orderbuch fehlt. Ohne Markttiefe veröffentlichen wir keinen Slippage- oder Impact-Wert.";
    return `Market Impact simuliert die Ausführung auf ${args.venueCount} Markt-Snapshots und ${args.scenarioCount} Szenarien. ${fixture ? "Die Daten sind Testdaten. " : ""}Das Ergebnis ist weder Prognose eines zukünftigen Fills noch realisierte Slippage.`;
  }
  if (unavailable) return "Market Impact withholds the result because no usable order book is bound. Slippage and order impact are not published without market depth.";
  return `Market Impact simulates execution across ${args.venueCount} market snapshots and ${args.scenarioCount} scenarios. ${fixture ? "The data is fixture-only. " : ""}The result is not a forecast of a future fill or realized slippage.`;
}

export function buildMarketImpactCustomerTruth(args: {
  locale?: VlmCustomerLocale;
  reportContextDepth?: VlmReportContextDepth;
  evidenceStatus: "verified_live" | "verified_staging" | "fixture_only" | "unavailable";
  venues: MarketImpactVenueSummary[];
  executions: MarketImpactExecution[];
  providerFamilies: string[];
  blockers: string[];
  excludedVenues: Array<{ venueId: string; reason: string }>;
  evidenceOrigin?: "provider" | "user_supplied";
}): MarketImpactCustomerTruth {
  const locale = args.locale ?? "en";
  const userSupplied = args.evidenceOrigin === "user_supplied";
  const sourceClass = userSupplied ? "USER_SUPPLIED" as const : "PROVIDER" as const;
  const reportContextDepth = args.reportContextDepth ?? "basic";
  const publicReportContextDepth = args.reportContextDepth ?? null;
  const mode = inputMode(args.evidenceStatus);
  const fixtureOnly = mode === "FIXTURE_ORDER_BOOK_SIMULATION";
  const unavailable = mode === "NO_USABLE_ORDER_BOOK" || args.venues.length === 0;
  const independentlyVerifiedEvidenceCount = userSupplied
    ? (args.providerFamilies.length > 0 ? 1 : 0)
    : args.providerFamilies.length;
  const stale = args.blockers.some((value) =>
    /(?:^|[_:\s-])(?:stale|staleness|fresh|freshness|age)(?:$|[_:\s-])/iu.test(value),
  );
  const conflicted = args.blockers.some((value) => /conflict|divergence|cross_venue/iu.test(value));
  const reasonCodes: VlmTruthReasonCode[] = [
    "SIMULATION_NOT_FORECAST",
    "ORDER_BOOK_OUTCOME_MISSING",
    userSupplied ? "INDEPENDENT_REVIEW_MISSING" : "PROVIDER_RIGHTS_UNVERIFIED",
    "REAL_CUSTOMER_PROOF_MISSING",
  ];
  if (unavailable) reasonCodes.push("ORDER_BOOK_UNAVAILABLE", "NO_BOUND_EVIDENCE", "MISSING_DATA");
  if (fixtureOnly) reasonCodes.push("FIXTURE_ONLY");
  if (independentlyVerifiedEvidenceCount < 2 && !unavailable) reasonCodes.push("SINGLE_SOURCE_ONLY");
  if (stale) reasonCodes.push("STALE_DATA");
  if (conflicted) reasonCodes.push("SOURCE_CONFLICT");
  const reasonCards = buildVlmCustomerTruthReasons(reasonCodes, locale, 9);
  const observedAt = oldestObservedAt(args.venues);
  const resultMode = unavailable
    ? "WITHHELD" as const
    : fixtureOnly
      ? "SIMULATION_ONLY" as const
      : "SNAPSHOT_EXECUTION_SIMULATION" as const;

  const evidenceOrigins = uniqueVlmTruthStrings([
    args.providerFamilies.length > 0 ? sourceClass : null,
    args.executions.length > 0 ? "VELMERE_DERIVED" : null,
    args.executions.length > 0 ? "SIMULATION" : null,
    fixtureOnly ? "FIXTURE" : null,
  ], 8) as VlmEvidenceOrigin[];
  const evidenceRef = `market-impact:${args.evidenceStatus}:${args.venues.length}:${args.executions.length}`;
  const missingProof = uniqueVlmTruthStrings([
    ...args.blockers,
    unavailable ? "fresh identity-bound L2 order book snapshot" : null,
    independentlyVerifiedEvidenceCount < 2 ? "second independently verified provider family" : null,
    userSupplied
      ? "independent review of the customer ownership/authority attestation"
      : "rights-approved commercial-use evidence for displayed market data",
    "predicted-versus-realized slippage outcome",
    "hidden-liquidity and replenishment observation",
    "real-customer comprehension and decision-outcome evidence",
  ], 14);
  const limitations = [
    "Visible order-book depth is not total market liquidity.",
    "A snapshot simulation cannot guarantee a future fill or price response.",
    "Realized slippage may differ because the order book changes during execution.",
    "Hidden liquidity, queue position, cancellations, replenishment and market reaction are not modeled.",
    "The result is informational and is not an instruction to trade.",
  ];
  const nextSafeCheck = unavailable
    ? "Bind a fresh, rights-approved L2 order-book snapshot to the exact asset identity and rerun the model."
    : "Record the estimate before an authorized execution, then compare it with the separately observed fill without changing the preregistered metric.";

  const contract = buildVlmStandaloneInsightContract({
    productId: "market-impact",
    reportContextDepth,
    state: unavailable ? "withheld" : fixtureOnly || args.blockers.length > 0 ? "limited" : "available",
    facts: [
      { id: "input-mode", label: "Input mode", value: mode, sourceClass: fixtureOnly ? "UNKNOWN" : sourceClass, evidenceRefs: [evidenceRef], observedAt },
      { id: "venue-count", label: userSupplied ? "Customer-supplied venue snapshots" : "Observed venues", value: args.venues.length, sourceClass, evidenceRefs: [evidenceRef], observedAt },
      { id: "provider-family-count", label: userSupplied ? "Customer-declared source families" : "Independent provider families", value: args.providerFamilies.length, sourceClass, evidenceRefs: [evidenceRef], observedAt },
      ...args.venues.slice(0, 8).map((venue) => ({
        id: `venue-${venue.venueId}`,
        label: `${venue.venueId} visible depth USD`,
        value: venue.bidDepthUsd + venue.askDepthUsd,
        sourceClass,
        evidenceRefs: [venue.sourceDigest ?? evidenceRef],
        observedAt: venue.observedAt,
      })),
    ],
    calculations: [
      ...args.executions.slice(0, 16).map((execution, index) => ({
        id: `execution-${index + 1}`,
        label: `${execution.side} USD ${execution.requestedNotionalUsd} modeled impact bps`,
        value: execution.impactBps,
        sourceClass: "VELMERE_DERIVED" as const,
        evidenceRefs: [evidenceRef],
        observedAt,
      })),
    ],
    assumptions: [
      { id: "static-book", text: "The visible order book remains static during each simulated execution.", evidenceRefs: [evidenceRef] },
      { id: "visible-only", text: "Hidden liquidity, queue priority, cancellations and replenishment are not modeled.", evidenceRefs: [evidenceRef] },
      { id: "identity-binding", text: "The asset identity and quote conversion belong to the intended market.", evidenceRefs: [evidenceRef] },
    ],
    simulations: args.executions.slice(0, 12).map((execution, index) => ({
      id: `scenario-${index + 1}`,
      text: `${execution.side} USD ${execution.requestedNotionalUsd}: fill ratio ${execution.fillRatio}, modeled impact ${String(execution.impactBps)} bps.`,
      evidenceRefs: [evidenceRef],
    })),
    conflicts: [
      ...(conflicted ? [{ id: "source-conflict", text: "Venue prices or source evidence exceed the accepted disagreement threshold.", evidenceRefs: [evidenceRef] }] : []),
      ...args.excludedVenues.slice(0, 8).map((row, index) => ({ id: `excluded-${index + 1}`, text: `${row.venueId}: ${row.reason}`, evidenceRefs: [evidenceRef] })),
    ],
    missingProof,
    limitations,
    nextSafeActions: reasonCards.map((reason) => reason.nextSafeAction).concat(nextSafeCheck),
  });

  return {
    schemaVersion: "velmere.standalone-customer-truth.v1",
    contractId: "pass36-a102r44p35-standalone-customer-truth",
    productId: "market-impact",
    locale,
    reportContextDepth: publicReportContextDepth,
    reportContextChangesExplanationOnly: true,
    truthState: resolveVlmTruthState({
      unavailable,
      fixtureOnly,
      stale,
      conflicted,
      blockingReasons: reasonCards.filter((reason) => reason.severity === "BLOCK").length,
      evidenceCount: independentlyVerifiedEvidenceCount,
    }),
    confidenceClass: resolveVlmConfidenceClass({
      calibrated: false,
      verified: !unavailable && !fixtureOnly,
      evidenceCount: independentlyVerifiedEvidenceCount,
    }),
    evidenceOrigins,
    facts: uniqueVlmTruthStrings([
      `input_mode=${mode}`,
      `observed_at=${observedAt ?? "unavailable"}`,
      `venue_count=${args.venues.length}`,
      `provider_family_count=${args.providerFamilies.length}`,
      `execution_scenario_count=${args.executions.length}`,
      `excluded_venue_count=${args.excludedVenues.length}`,
      ...args.venues.slice(0, 4).map((venue) => `${venue.venueId}:spread_bps=${venue.spreadBps}:bid_depth_usd=${venue.bidDepthUsd}:ask_depth_usd=${venue.askDepthUsd}`),
    ], 12),
    calculations: uniqueVlmTruthStrings([
      "visible L2 depth aggregation",
      "static-snapshot execution walk",
      "fee-aware VWAP and fill ratio",
      "cross-venue mid-price divergence",
      ...args.executions.slice(0, 6).map((execution) => `${execution.side}:${execution.requestedNotionalUsd}:impact_bps=${String(execution.impactBps)}:fill_ratio=${execution.fillRatio}`),
    ], 12),
    assumptions: [
      "The visible order book remains static during each simulated execution.",
      "Hidden liquidity, queue position, cancellations, replenishment and market reaction are not modeled.",
      "Only fees and levels present in the bound snapshot are included.",
      "The asset identity and quote conversion belong to the intended market.",
    ],
    simulations: args.executions.length > 0
      ? uniqueVlmTruthStrings(args.executions.slice(0, 8).map((execution) => `${execution.side} USD ${execution.requestedNotionalUsd}: fill_ratio=${execution.fillRatio}, impact_bps=${String(execution.impactBps)}`), 8)
      : [],
    conflicts: uniqueVlmTruthStrings([
      conflicted ? "venue prices or source evidence exceed the accepted disagreement threshold" : null,
      ...args.excludedVenues.slice(0, 4).map((row) => `${row.venueId}:${row.reason}`),
    ], 8),
    missingProof,
    limitations,
    nextSafeCheck,
    probabilityClaimAllowed: false,
    investmentRecommendationAllowed: false,
    leverageRecommendationAllowed: false,
    guaranteedOutcomeClaimAllowed: false,
    customerSummary: localizedSummary({ locale, mode, venueCount: args.venues.length, scenarioCount: args.executions.length }),
    reasonCards,
    inputMode: mode,
    resultMode,
    forecastClaimAllowed: false,
    futureOutcomeClaimAllowed: false,
    realizedSlippageClaimAllowed: false,
    hiddenLiquidityModeled: false,
    orderBookReplenishmentModeled: false,
    queuePositionModeled: false,
    marketReactionModeled: false,
    predictionOutcomeStatus: "MISSING_PREDICTED_VS_REALIZED_OUTCOME",
    observedVenueCount: args.venues.length,
    providerFamilyCount: args.providerFamilies.length,
    executionScenarioCount: args.executions.length,
    commercialRightsStatus: "NOT_EVALUATED_BY_MODEL",
    contract,
  };
}
