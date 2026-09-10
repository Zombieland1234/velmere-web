import {
  buildAuditProviderEvidenceDimensions,
  isStrictAuditEvidenceLane,
  PASS4809_AUDIT_PROVIDER_EVIDENCE_DIMENSIONS_ID,
} from "./audit-provider-evidence-dimensions";
import type { AuditReviewSubmission } from "./audit-review-flow";
import type { Pass2570AuditSourceQuorumReport } from "./audit-source-quorum-runtime";
import type { Pass2572AuditProviderRuntimeReport, Pass2572RuntimeLane, Pass2572RuntimeState } from "./audit-provider-runtime-client";

export const LEGACY_PASS2573_AUDIT_RUNTIME_CONFIDENCE_ENGINE_ID = "audit-runtime-confidence-engine" as const;
export const PASS2573_AUDIT_RUNTIME_CONFIDENCE_ENGINE_ID = "audit-runtime-confidence-engine-p89-v2" as const;

export type Pass2573RiskLabel = "Low" | "Medium" | "High" | "Unknown";

export type Pass2573ConfidenceDecision = {
  id: string;
  label: string;
  state: Pass2572RuntimeState | "quorum" | "derived";
  weight: number;
  coveragePoints: number;
  riskDelta: number;
  reviewPriorityDelta: number;
  confidenceDelta: number;
  claim: string;
  customerOutput: string;
  proOutput: string;
  missing: string[];
};

export type Pass2573AuditRuntimeConfidenceReport = {
  passId: typeof PASS2573_AUDIT_RUNTIME_CONFIDENCE_ENGINE_ID;
  generatedAt: string;
  locale: string;
  target: {
    contractAddress?: string;
    projectName?: string;
    chain: string;
  };
  rule: string;
  scoringBoundary: string;
  overall: {
    riskScore: number | null;
    riskLabel: Pass2573RiskLabel;
    reviewPriorityScore: number;
    observedAdverseSignals: number;
    sourceCoverageScore: number;
    sourceConfidence: number;
    providerEvidenceDimensionVersion: typeof PASS4809_AUDIT_PROVIDER_EVIDENCE_DIMENSIONS_ID;
    runtimeLiveLanes: number;
    runtimeIndependentUpstreams: number;
    duplicateStrictLanesRejected: number;
    duplicateLiveLanesRejected: number;
    runtimeConfirmedLanes: number;
    runtimeProblemLanes: number;
    quorumRiskBaseline?: number | null;
    quorumConfidenceBaseline?: number;
  };
  basicSummary: string;
  proSummary: string;
  customerVerdict: string;
  decisions: Pass2573ConfidenceDecision[];
  topMissingEvidence: string[];
  proPdfSections: string[];
  advancedQueue: string[];
};

type ConfidenceInput = Partial<AuditReviewSubmission> & {
  locale?: string;
  sourceQuorum?: Pass2570AuditSourceQuorumReport | null;
  providerRuntime?: Pass2572AuditProviderRuntimeReport | null;
};

function t(locale: string, pl: string, de: string, en: string) {
  return locale === "pl" ? pl : locale === "de" ? de : en;
}

function clean(value: unknown, max = 180) {
  if (typeof value !== "string") return undefined;
  const text = value.replace(/[<>{}\r\n]/g, " ").trim();
  return text ? text.slice(0, max) : undefined;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function stateQuality(state: Pass2572RuntimeState) {
  if (state === "confirmed") return 1;
  if (state === "partial") return 0.28;
  if (state === "blocked") return 0.32;
  if (state === "timeout" || state === "error") return 0.24;
  if (state === "not_run") return 0.16;
  return 0.08;
}

function isExactIdentityConfirmed(lane: Pass2572RuntimeLane) {
  return isStrictAuditEvidenceLane(lane);
}

function independentUpstreamRoots(lanes: Pass2572RuntimeLane[]) {
  return buildAuditProviderEvidenceDimensions(lanes).independentUpstreamRoots;
}

function stateQualityForLane(lane: Pass2572RuntimeLane) {
  if (lane.state === "confirmed" && !isExactIdentityConfirmed(lane)) return 0.42;
  return stateQuality(lane.state);
}

function weightForLane(lane: Pass2572RuntimeLane) {
  if (/explorer/i.test(lane.id)) return 24;
  if (/security|goplus|honeypot/i.test(lane.id)) return 18;
  if (/dex|liquidity/i.test(lane.id)) return 16;
  if (/docs|repo|audit/i.test(lane.id)) return 14;
  if (/market|coingecko/i.test(lane.id)) return 10;
  return lane.tier.includes("basic") ? 8 : 6;
}

function riskDeltaForLane(lane: Pass2572RuntimeLane) {
  // PASS4806: only exact response-bound identity may affect the customer risk score.
  // Unbound or request-only evidence is routed to review priority instead.
  if (!isExactIdentityConfirmed(lane)) return 0;
  const allText = `${lane.claim} ${lane.evidence.join(" ")} ${lane.missing.join(" ")}`.toLowerCase();
  let delta = 0;
  // Only observed adverse evidence may move contract risk. Missing/timeout states
  // increase review priority, not the risk score itself.
  if (/honeypotflag:\s*1|is_honeypot.*1|honeypot.*true/.test(allText)) delta += 42;
  if (/buytax:\s*(0\.[1-9]|[1-9])/.test(allText)) delta += 10;
  if (/selltax:\s*(0\.[1-9]|[1-9])/.test(allText)) delta += 14;
  if (/blacklist.*true|can_blacklist.*1/.test(allText)) delta += 18;
  if (/mint.*enabled|can_mint.*1/.test(allText)) delta += 12;
  if (/proxy:\s*1|upgradeable.*true/.test(allText)) delta += 7;
  if (/liquidity.*removed|lp.*unlocked|lock.*expired/.test(allText)) delta += 16;
  return delta;
}

function reviewPriorityDeltaForLane(lane: Pass2572RuntimeLane) {
  if (lane.state === "missing") return 12;
  if (lane.state === "timeout" || lane.state === "error") return 9;
  if (lane.state === "blocked") return 7;
  if (lane.state === "not_run") return 6;
  if (lane.state === "partial") return 3;
  return 0;
}

function confidenceDeltaForLane(lane: Pass2572RuntimeLane) {
  if (isExactIdentityConfirmed(lane)) return 9;
  if (lane.state === "confirmed") return 2;
  if (lane.state === "partial") return 1;
  if (lane.state === "blocked") return -2;
  if (lane.state === "timeout" || lane.state === "error") return -5;
  if (lane.state === "not_run") return -4;
  return -6;
}

function riskLabel(score: number | null): Pass2573RiskLabel {
  if (score === null) return "Unknown";
  if (score >= 72) return "High";
  if (score >= 48) return "Medium";
  if (score >= 18) return "Low";
  return "Unknown";
}

function outputForState(locale: string, lane: Pass2572RuntimeLane) {
  const evidence = lane.evidence[0];
  const missing = lane.missing[0];
  if (isExactIdentityConfirmed(lane)) return t(locale, "potwierdzone źródłem live i zgodne z tożsamością aktywa", "durch Live-Quelle und Asset-Identitaet bestaetigt", "confirmed by a live source with exact asset identity");
  if (lane.state === "confirmed") return t(locale, "odpowiedź źródła jest użyteczna, ale tożsamość aktywa nie została potwierdzona w odpowiedzi", "nutzbare Provider-Antwort, aber Asset-Identitaet nicht in der Antwort bestaetigt", "usable provider response, but asset identity was not proven by the response");
  if (lane.state === "partial") return evidence || t(locale, "częściowe dane — wymaga drugiego źródła", "teilweise Daten — braucht zweite Quelle", "partial data — needs second source");
  if (lane.state === "blocked") return missing || t(locale, "źródło zablokowane do czasu konfiguracji", "Quelle blockiert bis Konfiguration", "source blocked until configuration");
  if (lane.state === "timeout") return t(locale, "źródło przekroczyło limit czasu", "Quelle hat Timeout erreicht", "source timed out");
  if (lane.state === "error") return t(locale, "źródło zwróciło błąd", "Quelle lieferte Fehler", "source returned an error");
  return missing || t(locale, "brak potwierdzenia", "keine Bestaetigung", "not confirmed");
}

export function buildPass2573AuditRuntimeConfidenceReport(input: ConfidenceInput): Pass2573AuditRuntimeConfidenceReport {
  const locale = input.locale === "pl" || input.locale === "de" || input.locale === "en" ? input.locale : "en";
  const chain = clean(input.chain, 40) ?? input.sourceQuorum?.target.chain ?? input.providerRuntime?.target.chain ?? "ethereum";
  const contractAddress = clean(input.contractAddress, 96) ?? input.providerRuntime?.target.contractAddress ?? input.sourceQuorum?.target.contractAddress;
  const projectName = clean(input.projectName, 90) ?? input.providerRuntime?.target.projectName ?? input.sourceQuorum?.target.projectName;
  const runtimeLanes = input.providerRuntime?.lanes ?? [];
  const evidenceDimensions = buildAuditProviderEvidenceDimensions(runtimeLanes);

  const baselineConfidence = input.sourceQuorum?.overall.confidenceCap ?? 34;
  const bestLaneByUpstream = new Map<string, Pass2572RuntimeLane>();
  for (const lane of runtimeLanes) {
    const key = lane.lineage.upstreamRoot;
    const current = bestLaneByUpstream.get(key);
    if (!current || stateQualityForLane(lane) > stateQualityForLane(current)) bestLaneByUpstream.set(key, lane);
  }
  const deCorrelatedLanes = Array.from(bestLaneByUpstream.values());
  const totalWeight = deCorrelatedLanes.reduce((sum, lane) => sum + weightForLane(lane), 0) || 1;
  const coverage = deCorrelatedLanes.reduce((sum, lane) => sum + weightForLane(lane) * stateQualityForLane(lane), 0) / totalWeight;
  const riskDelta = deCorrelatedLanes.reduce((sum, lane) => sum + riskDeltaForLane(lane), 0);
  const reviewPriorityDelta = deCorrelatedLanes.reduce((sum, lane) => sum + reviewPriorityDeltaForLane(lane), 0);
  const confidenceDelta = deCorrelatedLanes.reduce((sum, lane) => sum + confidenceDeltaForLane(lane), 0);
  const problemLanePenalty = deCorrelatedLanes.filter((lane) => lane.state === "missing" || lane.state === "timeout" || lane.state === "error").length * 2;
  const strictRoots = independentUpstreamRoots(runtimeLanes);
  const runtimeCredit = strictRoots.length * 3;
  const observedAdverseSignals = runtimeLanes.filter((lane) => riskDeltaForLane(lane) > 0).length;
  const riskScore = observedAdverseSignals > 0
    ? clamp(18 + riskDelta - Math.min(runtimeCredit, 10), 12, 96)
    : null;
  const reviewPriorityScore = clamp((input.sourceQuorum?.overall.reviewPriorityScore ?? 20) + reviewPriorityDelta + problemLanePenalty - Math.min(runtimeCredit, 12), 0, 100);
  const sourceCoverageScore = clamp(coverage * 100, 8, 98);
  const quorumCap = strictRoots.length >= 3 ? 92 : strictRoots.length >= 2 ? 82 : strictRoots.length === 1 ? 62 : 44;
  const sourceConfidence = Math.min(quorumCap, clamp(baselineConfidence + confidenceDelta + coverage * 24 - problemLanePenalty, 12, 96));

  const decisions: Pass2573ConfidenceDecision[] = runtimeLanes.map((lane) => {
    const weight = weightForLane(lane);
    const laneCoverage = clamp(stateQualityForLane(lane) * 100, 0, 100);
    return {
      id: lane.id,
      label: lane.label,
      state: lane.state,
      weight,
      coveragePoints: laneCoverage,
      riskDelta: riskDeltaForLane(lane),
      reviewPriorityDelta: reviewPriorityDeltaForLane(lane),
      confidenceDelta: confidenceDeltaForLane(lane),
      claim: lane.claim,
      customerOutput: `${lane.provider}: ${outputForState(locale, lane)}`,
      proOutput: `${lane.provider}: ${lane.claim}; upstream=${lane.lineage.upstreamRoot}; contentReceipt=${lane.receipt ? "yes" : "no"}; evidence=${lane.evidence.length}; missing=${lane.missing.length}; latency=${lane.latencyMs ?? 0}ms`,
      missing: lane.missing,
    };
  });

  const topMissingEvidence = decisions
    .flatMap((decision) => decision.missing.map((item) => `${decision.label}: ${item}`))
    .concat(input.sourceQuorum?.missingEvidence ?? [])
    .filter(Boolean)
    .slice(0, 10);

  const liveLanes = evidenceDimensions.successfulLiveLaneCount;
  const liveUpstreams = strictRoots.length;
  const confirmedLanes = runtimeLanes.filter((lane) => lane.state === "confirmed").length;
  const problemLanes = runtimeLanes.filter((lane) => lane.state === "missing" || lane.state === "timeout" || lane.state === "error").length;

  const basicSummary = t(
    locale,
    `Basic: ${liveLanes}/${runtimeLanes.length} udanych bezpośrednich providerów, ${evidenceDimensions.strictReceiptCount} ścisłych receiptów i ${liveUpstreams} niezależnych upstreamów; coverage ${sourceCoverageScore}/100.`,
    `Basic: ${liveLanes}/${runtimeLanes.length} erfolgreiche direkte Provider, ${evidenceDimensions.strictReceiptCount} strikte Receipts und ${liveUpstreams} unabhaengige Upstreams; Coverage ${sourceCoverageScore}/100.`,
    `Basic: ${liveLanes}/${runtimeLanes.length} successful direct providers, ${evidenceDimensions.strictReceiptCount} strict receipts and ${liveUpstreams} independent upstreams; coverage ${sourceCoverageScore}/100.`,
  );
  const proSummary = t(
    locale,
    "Pro PDF dostaje te same lane'y plus delta ryzyka, delta confidence, missing evidence i latency providerów.",
    "Pro PDF bekommt dieselben Lanes plus Risiko-Delta, Confidence-Delta, Missing Evidence und Provider-Latenz.",
    "Pro PDF receives the same lanes plus risk delta, confidence delta, missing evidence and provider latency.",
  );
  const label = riskLabel(riskScore);
  const customerVerdict = label === "Unknown"
    ? t(locale, "Brak zweryfikowanego sygnału niebezpieczeństwa; score ryzyka pozostaje niedostępny, a braki danych podnoszą wyłącznie priorytet review.", "Kein verifiziertes Gefahrensignal; der Risiko-Score bleibt nicht verfuegbar und Datenluecken erhoehen nur die Review-Prioritaet.", "No verified adverse signal was observed; the risk score remains unavailable and evidence gaps increase review priority only.")
    : label === "High"
    ? t(locale, "Wynik wymaga ostrożności: kilka źródeł nie potwierdziło kluczowych danych albo zwróciło ostrzeżenia.", "Vorsicht: mehrere Quellen bestaetigten wichtige Daten nicht oder lieferten Warnungen.", "Caution: multiple sources did not confirm key data or returned warnings.")
    : label === "Medium"
      ? t(locale, "Wynik jest umiarkowany: część danych jest dostępna, ale pełny Pro review powinien potwierdzić permissions, liquidity i publiczne źródła.", "Mittleres Ergebnis: einige Daten sind verfuegbar, aber Pro sollte Permissions, Liquidity und Quellen bestaetigen.", "Medium result: some data is available, but Pro should confirm permissions, liquidity and public sources.")
      : t(locale, "Basic nie wykrył mocnych czerwonych flag w dostępnych źródłach, ale brakujące dane nadal obniżają pewność.", "Basic fand keine starken Red Flags in verfuegbaren Quellen, aber fehlende Daten senken weiter die Confidence.", "Basic did not find strong red flags in available sources, but missing data still lowers confidence.");

  return {
    passId: PASS2573_AUDIT_RUNTIME_CONFIDENCE_ENGINE_ID,
    generatedAt: new Date().toISOString(),
    locale,
    target: { contractAddress, projectName, chain },
    rule: t(
      locale,
      "PASS2573 rozdziela udane wykonanie providera od ścisłego evidence i zamienia wyłącznie identity-bound adverse facts na customer-safe risk/confidence.",
      "PASS2573 trennt erfolgreiche Provider-Ausführung von strikter Evidenz und wandelt nur identity-bound adverse Facts in customer-safe Risk/Confidence um.",
      "PASS2573 separates successful provider execution from strict evidence and converts only identity-bound adverse facts into customer-safe risk/confidence.",
    ),
    scoringBoundary: "Risk/confidence is evidence coverage, not a guarantee of safety; no seed phrase, no custody, no exploit instructions, no unauthorized active testing.",
    overall: {
      riskScore,
      riskLabel: label,
      reviewPriorityScore,
      observedAdverseSignals,
      sourceCoverageScore,
      sourceConfidence,
      providerEvidenceDimensionVersion: PASS4809_AUDIT_PROVIDER_EVIDENCE_DIMENSIONS_ID,
      runtimeLiveLanes: liveLanes,
      runtimeIndependentUpstreams: liveUpstreams,
      duplicateStrictLanesRejected: evidenceDimensions.duplicateStrictLanesRejected,
      duplicateLiveLanesRejected: evidenceDimensions.duplicateLiveLanesRejected,
      runtimeConfirmedLanes: confirmedLanes,
      runtimeProblemLanes: problemLanes,
      quorumRiskBaseline: input.sourceQuorum?.overall.riskScore,
      quorumConfidenceBaseline: input.sourceQuorum?.overall.confidenceCap,
    },
    basicSummary,
    proSummary,
    customerVerdict,
    decisions: decisions.slice(0, 12),
    topMissingEvidence,
    proPdfSections: [
      "Runtime evidence coverage score",
      "Risk delta per provider lane",
      "Confidence delta per source state",
      "Missing evidence priority list",
      "Customer-safe verdict and Pro scope",
    ],
    advancedQueue: [
      "Manual source freshness check",
      "Owner/proxy/permissions parser confirmation",
      "Liquidity lock and holder relationship review",
      "Private delivery and redaction review after paid receipt",
    ],
  };
}
