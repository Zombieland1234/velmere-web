export type VlmDecisionLocale = "pl" | "en" | "de";
export type VlmReportContextDepth = "basic" | "pro" | "advanced";
export type VlmEvidenceStatus = "verified_live" | "verified_staging" | "fixture_only" | "unavailable" | null | undefined;
export type VlmDecisionState = "VERIFIED" | "LIMITED" | "SIMULATION_ONLY" | "WITHHELD" | "UNCLASSIFIED";

export type VlmDecisionSupportCard = Readonly<{
  schemaVersion: "velmere.standalone.decision-support.v1";
  productId: "market-impact" | "whale-watch" | "risk-indicator" | "angel";
  state: VlmDecisionState;
  headline: string;
  evidenceMode: string;
  facts: readonly string[];
  assumptions: readonly string[];
  missingProof: readonly string[];
  limitations: readonly string[];
  nextSafeAction: string;
  truthBoundary: string;
}>;

export type VlmRiskDimension = "low" | "moderate" | "high" | "unknown";

export type VlmRiskIndicatorDecision = Readonly<{
  schemaVersion: "velmere.risk-indicator.decision.v1";
  productId: "risk-indicator";
  reportContextDepth: VlmReportContextDepth;
  indicator: VlmRiskDimension;
  technicalRisk: VlmRiskDimension;
  marketRisk: VlmRiskDimension;
  dataQualityRisk: VlmRiskDimension;
  probabilityPercent: null;
  leverageRecommendation: null;
  positionSizingRecommendation: null;
  factorsIncreasingRisk: readonly string[];
  factorsReducingRisk: readonly string[];
  missingProof: readonly string[];
  refusalReason: string | null;
  explanationDepth: "summary" | "evidence" | "history_and_governance";
  invariantKey: string;
  truthBoundary: string;
}>;

export type VlmAngelAnswerContract = Readonly<{
  schemaVersion: "velmere.angel.standalone-answer-contract.v1";
  productId: "angel";
  reportContextDepth: VlmReportContextDepth;
  mustAbstain: boolean;
  abstentionReason: string | null;
  orderedSections: readonly [
    "scope",
    "confirmedFacts",
    "calculations",
    "assumptions",
    "sourceConflicts",
    "missingProof",
    "limitations",
    "safeRemediation",
    "nextSafeCheck",
  ];
  maxEvidenceItems: number;
  forbiddenClaims: readonly string[];
  nextSafeCheck: string;
  truthBoundary: string;
}>;

const unique = (values: readonly (string | null | undefined)[], max = 12) =>
  Array.from(new Set(values.map((value) => String(value ?? "").replace(/\s+/gu, " ").trim()).filter(Boolean))).slice(0, max);

function localeCopy(locale: VlmDecisionLocale) {
  if (locale === "pl") return {
    impactVerified: "Model oparty na zweryfikowanej obserwacji rynku",
    impactStaging: "Model oparty na zweryfikowanym snapshocie stagingowym",
    impactSimulation: "Wyłącznie symulacja — nie rzeczywiste wykonanie",
    impactWithheld: "Wynik wstrzymany z powodu brakujących dowodów",
    impactBoundary: "Wynik opisuje modelowany wpływ przy jawnych założeniach. Nie jest zrealizowanym poślizgiem, prognozą ani gwarancją przyszłego wyniku.",
    impactNext: "Sprawdź typ źródła, czas obserwacji, spread, głębokość i brakujące dowody przed użyciem wyniku.",
    whaleVerified: "Zweryfikowane fakty on-chain i provenance etykiet",
    whaleLimited: "Częściowe fakty on-chain — interpretacja ograniczona",
    whaleWithheld: "Whale Watch wstrzymany z powodu brakujących dowodów",
    whaleBoundary: "Transfer nie oznacza automatycznie kupna, sprzedaży ani zamiaru rynkowego. Niepotwierdzony adres pozostaje UNCLASSIFIED.",
    whaleNext: "Otwórz provenance etykiety i potwierdź kierunek, kontrahenta, bridge/treasury context oraz czas zdarzenia.",
    riskBoundary: "Risk Indicator jest opisowym wskaźnikiem. Nie jest prawdopodobieństwem ceny, rekomendacją dźwigni ani sizingiem pozycji.",
    riskRefusal: "Brak wystarczających danych do uczciwego wskaźnika.",
    angelBoundary: "Angel pozostaje jednym produktem AI. Głębszy raport zwiększa kontekst, ale nie zmienia standardu prawdy, bezpieczeństwa ani evidence.",
    angelNoFacts: "Brak potwierdzonych faktów związanych z pytaniem.",
    angelConflict: "Nierozstrzygnięty konflikt źródeł blokuje jednoznaczny wniosek.",
    angelMissing: "Brak kluczowego dowodu wymaganego do odpowiedzi.",
    angelNext: "Wykonaj następny bezpieczny test wskazany przez evidence packet albo poproś o brakujące źródło.",
  };
  if (locale === "de") return {
    impactVerified: "Modell auf verifizierter Marktbeobachtung",
    impactStaging: "Modell auf verifiziertem Staging-Snapshot",
    impactSimulation: "Nur Simulation — keine reale Ausführung",
    impactWithheld: "Ergebnis wegen fehlender Evidenz zurückgehalten",
    impactBoundary: "Das Ergebnis beschreibt modellierten Impact unter sichtbaren Annahmen. Es ist weder realisierte Slippage noch Prognose oder Garantie.",
    impactNext: "Quellentyp, Beobachtungszeit, Spread, Tiefe und fehlende Evidenz vor Nutzung prüfen.",
    whaleVerified: "Verifizierbare On-Chain-Fakten und Label-Provenienz",
    whaleLimited: "Teilweise On-Chain-Fakten — Interpretation begrenzt",
    whaleWithheld: "Whale Watch wegen fehlender Evidenz zurückgehalten",
    whaleBoundary: "Ein Transfer bedeutet nicht automatisch Kauf, Verkauf oder Marktabsicht. Eine unbestätigte Adresse bleibt UNCLASSIFIED.",
    whaleNext: "Label-Provenienz öffnen und Richtung, Gegenpartei, Bridge/Treasury-Kontext sowie Zeitpunkt prüfen.",
    riskBoundary: "Der Risk Indicator ist deskriptiv. Er ist keine Preiswahrscheinlichkeit, Hebelempfehlung oder Positionsgröße.",
    riskRefusal: "Nicht genügend Daten für einen ehrlichen Indikator.",
    angelBoundary: "Angel bleibt ein einziges KI-Produkt. Mehr Berichtskontext ändert nicht den Wahrheits-, Sicherheits- oder Evidenzstandard.",
    angelNoFacts: "Keine bestätigten Fakten zur Frage vorhanden.",
    angelConflict: "Ein ungelöster Quellenkonflikt blockiert eine eindeutige Schlussfolgerung.",
    angelMissing: "Ein erforderlicher Beleg fehlt.",
    angelNext: "Den nächsten sicheren Check aus dem Evidence Packet ausführen oder die fehlende Quelle anfordern.",
  };
  return {
    impactVerified: "Model based on verified market observation",
    impactStaging: "Model based on a verified staging snapshot",
    impactSimulation: "Simulation only — not a realized execution",
    impactWithheld: "Result withheld because required evidence is missing",
    impactBoundary: "The result is modelled impact under explicit assumptions. It is not realized slippage, a forecast, or a guarantee of a future outcome.",
    impactNext: "Check source type, observation time, spread, depth, and missing evidence before using the result.",
    whaleVerified: "Verifiable on-chain facts and label provenance",
    whaleLimited: "Partial on-chain facts — interpretation is limited",
    whaleWithheld: "Whale Watch withheld because required evidence is missing",
    whaleBoundary: "A transfer does not automatically mean a buy, sell, or market intention. An unverified address remains UNCLASSIFIED.",
    whaleNext: "Open label provenance and confirm direction, counterparty, bridge/treasury context, and event time.",
    riskBoundary: "Risk Indicator is descriptive. It is not a price probability, leverage recommendation, or position-sizing instruction.",
    riskRefusal: "Insufficient data for an honest indicator.",
    angelBoundary: "Angel remains one AI product. Deeper report context does not change its truth, safety, or evidence standard.",
    angelNoFacts: "No confirmed facts are bound to the question.",
    angelConflict: "An unresolved source conflict blocks a definitive conclusion.",
    angelMissing: "Required proof is missing.",
    angelNext: "Run the next safe check named by the evidence packet or request the missing source.",
  };
}

export function buildMarketImpactDecisionSupport(args: {
  locale: VlmDecisionLocale;
  evidenceStatus: VlmEvidenceStatus;
  generatedAt?: string | null;
  venueCount?: number | null;
  providerFamilyCount?: number | null;
  representativeScenarioCount?: number | null;
  missingEvidence?: readonly string[] | null;
  blockers?: readonly string[] | null;
}): VlmDecisionSupportCard {
  const c = localeCopy(args.locale);
  const missingProof = unique([...(args.missingEvidence ?? []), ...(args.blockers ?? [])]);
  const venueCount = Number.isFinite(args.venueCount) ? Math.max(0, Number(args.venueCount)) : 0;
  const providerCount = Number.isFinite(args.providerFamilyCount) ? Math.max(0, Number(args.providerFamilyCount)) : 0;
  const scenarioCount = Number.isFinite(args.representativeScenarioCount) ? Math.max(0, Number(args.representativeScenarioCount)) : 0;
  const verified = args.evidenceStatus === "verified_live" && venueCount > 0 && providerCount > 0 && missingProof.length === 0;
  const staging = args.evidenceStatus === "verified_staging" && venueCount > 0;
  const simulation = args.evidenceStatus === "fixture_only" || (!verified && !staging && scenarioCount > 0);
  const state: VlmDecisionState = verified ? "VERIFIED" : staging ? "LIMITED" : simulation ? "SIMULATION_ONLY" : "WITHHELD";
  return Object.freeze({
    schemaVersion: "velmere.standalone.decision-support.v1",
    productId: "market-impact",
    state,
    headline: verified ? c.impactVerified : staging ? c.impactStaging : simulation ? c.impactSimulation : c.impactWithheld,
    evidenceMode: verified ? "VERIFIED_LIVE_ORDER_BOOK_OBSERVATION" : staging ? "VERIFIED_STAGING_SNAPSHOT" : simulation ? "SIMULATION_ONLY" : "EVIDENCE_WITHHELD",
    facts: unique([
      args.generatedAt ? `observedAt=${args.generatedAt}` : null,
      `venueCount=${venueCount}`,
      `providerFamilyCount=${providerCount}`,
      `modelledScenarioCount=${scenarioCount}`,
    ]),
    assumptions: Object.freeze(["order_book_snapshot_is_time_bounded", "model_does_not_predict_future_liquidity", "fees_and_depth_may_change_before_execution"]),
    missingProof,
    limitations: Object.freeze(["realized_slippage_not_observed", "future_execution_not_guaranteed", "simulation_must_not_be_presented_as_trade_result"]),
    nextSafeAction: c.impactNext,
    truthBoundary: c.impactBoundary,
  });
}

export function buildWhaleWatchDecisionSupport(args: {
  locale: VlmDecisionLocale;
  evidenceStatus: VlmEvidenceStatus;
  generatedAt?: string | null;
  transferCount?: number | null;
  holderCount?: number | null;
  verifiedLabelCoveragePercent?: number | null;
  providerFamilies?: readonly string[] | null;
  missingEvidence?: readonly string[] | null;
  blockers?: readonly string[] | null;
}): VlmDecisionSupportCard {
  const c = localeCopy(args.locale);
  const missingProof = unique([...(args.missingEvidence ?? []), ...(args.blockers ?? [])]);
  const transferCount = Number.isFinite(args.transferCount) ? Math.max(0, Number(args.transferCount)) : 0;
  const holderCount = Number.isFinite(args.holderCount) ? Math.max(0, Number(args.holderCount)) : 0;
  const labelCoverage = Number.isFinite(args.verifiedLabelCoveragePercent) ? Math.max(0, Math.min(100, Number(args.verifiedLabelCoveragePercent))) : 0;
  const providers = unique(args.providerFamilies ?? [], 8);
  const verified = args.evidenceStatus === "verified_live" && providers.length > 0 && missingProof.length === 0;
  const limited = ["verified_live", "verified_staging"].includes(String(args.evidenceStatus)) && (transferCount > 0 || holderCount > 0);
  const state: VlmDecisionState = verified ? "VERIFIED" : limited ? "LIMITED" : args.evidenceStatus === "fixture_only" ? "UNCLASSIFIED" : "WITHHELD";
  return Object.freeze({
    schemaVersion: "velmere.standalone.decision-support.v1",
    productId: "whale-watch",
    state,
    headline: verified ? c.whaleVerified : limited || state === "UNCLASSIFIED" ? c.whaleLimited : c.whaleWithheld,
    evidenceMode: verified ? "VERIFIED_ONCHAIN_AND_LABEL_PROVENANCE" : limited ? "PARTIAL_ONCHAIN_EVIDENCE" : state === "UNCLASSIFIED" ? "UNCLASSIFIED_LABEL_STATE" : "EVIDENCE_WITHHELD",
    facts: unique([
      args.generatedAt ? `observedAt=${args.generatedAt}` : null,
      `transferCount=${transferCount}`,
      `holderCount=${holderCount}`,
      `verifiedLabelCoveragePercent=${labelCoverage}`,
      ...providers.map((provider) => `provider=${provider}`),
    ]),
    assumptions: Object.freeze(["transfer_is_not_trade", "exchange_deposit_is_not_proof_of_sale", "entity_label_requires_provenance"]),
    missingProof,
    limitations: Object.freeze(["intent_not_inferred", "buy_sell_not_inferred", "unverified_address_remains_unclassified"]),
    nextSafeAction: c.whaleNext,
    truthBoundary: c.whaleBoundary,
  });
}

const severityWeight: Readonly<Record<VlmRiskDimension, number>> = Object.freeze({ unknown: 0, low: 1, moderate: 2, high: 3 });

export function buildRiskIndicatorDecision(args: {
  locale: VlmDecisionLocale;
  reportContextDepth: VlmReportContextDepth;
  technicalRisk: VlmRiskDimension;
  marketRisk: VlmRiskDimension;
  dataQualityRisk: VlmRiskDimension;
  factorsIncreasingRisk?: readonly string[] | null;
  factorsReducingRisk?: readonly string[] | null;
  missingProof?: readonly string[] | null;
  calibratedProbabilityAvailable?: boolean;
}): VlmRiskIndicatorDecision {
  const c = localeCopy(args.locale);
  const missingProof = unique(args.missingProof ?? []);
  const dimensions = [args.technicalRisk, args.marketRisk, args.dataQualityRisk];
  const indicator = dimensions.every((value) => value === "unknown") || missingProof.length >= 4
    ? "unknown"
    : dimensions.reduce((highest, value) => severityWeight[value] > severityWeight[highest] ? value : highest, "unknown" as VlmRiskDimension);
  const refusalReason = indicator === "unknown" ? c.riskRefusal : null;
  const explanationDepth = args.reportContextDepth === "basic" ? "summary" : args.reportContextDepth === "pro" ? "evidence" : "history_and_governance";
  const invariantKey = `${args.technicalRisk}|${args.marketRisk}|${args.dataQualityRisk}|${missingProof.join("|")}`;
  return Object.freeze({
    schemaVersion: "velmere.risk-indicator.decision.v1",
    productId: "risk-indicator",
    reportContextDepth: args.reportContextDepth,
    indicator,
    technicalRisk: args.technicalRisk,
    marketRisk: args.marketRisk,
    dataQualityRisk: args.dataQualityRisk,
    probabilityPercent: null,
    leverageRecommendation: null,
    positionSizingRecommendation: null,
    factorsIncreasingRisk: unique(args.factorsIncreasingRisk ?? []),
    factorsReducingRisk: unique(args.factorsReducingRisk ?? []),
    missingProof,
    refusalReason,
    explanationDepth,
    invariantKey,
    truthBoundary: args.calibratedProbabilityAvailable
      ? `${c.riskBoundary} A calibrated model may be discussed separately, never substituted for this indicator.`
      : c.riskBoundary,
  });
}

export function buildAngelStandaloneAnswerContract(args: {
  locale: VlmDecisionLocale;
  reportContextDepth: VlmReportContextDepth;
  confirmedFactCount: number;
  providerFamilyCount: number;
  unresolvedSourceConflict: boolean;
  missingProof?: readonly string[] | null;
  nextSafeChecks?: readonly string[] | null;
}): VlmAngelAnswerContract {
  const c = localeCopy(args.locale);
  const missingProof = unique(args.missingProof ?? []);
  const noFacts = args.confirmedFactCount <= 0 || args.providerFamilyCount <= 0;
  const conflict = args.unresolvedSourceConflict;
  const criticalMissing = missingProof.length > 0 && args.confirmedFactCount <= 1;
  const mustAbstain = noFacts || conflict || criticalMissing;
  const abstentionReason = noFacts ? c.angelNoFacts : conflict ? c.angelConflict : criticalMissing ? c.angelMissing : null;
  const maxEvidenceItems = args.reportContextDepth === "basic" ? 4 : args.reportContextDepth === "pro" ? 10 : 18;
  return Object.freeze({
    schemaVersion: "velmere.angel.standalone-answer-contract.v1",
    productId: "angel",
    reportContextDepth: args.reportContextDepth,
    mustAbstain,
    abstentionReason,
    orderedSections: Object.freeze([
      "scope",
      "confirmedFacts",
      "calculations",
      "assumptions",
      "sourceConflicts",
      "missingProof",
      "limitations",
      "safeRemediation",
      "nextSafeCheck",
    ] as const),
    maxEvidenceItems,
    forbiddenClaims: Object.freeze([
      "personalized_investment_advice",
      "guaranteed_return",
      "exact_price_probability_without_calibration",
      "leverage_instruction",
      "position_sizing_instruction",
      "unsupported_source_citation",
      "paid_tier_increases_truth_standard",
    ]),
    nextSafeCheck: unique(args.nextSafeChecks ?? [], 1)[0] ?? c.angelNext,
    truthBoundary: c.angelBoundary,
  });
}
