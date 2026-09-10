import { randomUUID } from "node:crypto";
import type { TokenRiskResult } from "@/lib/market-integrity/risk-types";
import type { buildRiskBrain } from "@/lib/market-integrity/risk-brain";
import {
  type VlmBrainOutput,
  type VlmDepth,
  type VlmLocale,
  type VlmSurface,
  vlmBrainOutputSchema,
} from "./vlm-contract";
import { applyVlmClaimFirewall, bindVlmFindingsToFacts } from "./vlm-claim-firewall";
import { buildCanonicalFactPacket, type VlmCanonicalFactPacket } from "./vlm-fact-packet";
import { readVlmSessionMemory, writeVlmSessionMemory } from "./vlm-memory";
import { generateWithVlmProvider, reviewWithVlmShadow } from "./vlm-provider-registry";
import { sanitizeVlmText, stableHash } from "./vlm-security";
import { inspectVlmUserPrompt } from "./vlm-user-prompt-boundary";
import { inspectVlmAdviceBoundary } from "./vlm-advice-boundary";
import { recordVlmPolicyRejection, recordVlmSecurityInspection } from "./vlm-security-events";
import { buildVlmEpistemicDecision } from "./vlm-epistemic-governor";
import { evaluateVlmShadowReview } from "./vlm-shadow-governor";
import {
  buildVlmEvidenceFingerprint,
  buildVlmNarrativeFingerprint,
  evaluateVlmDecisionReversibility,
  evaluateVlmNarrativeDrift,
  localizedVlmDriftCopy,
  localizedVlmReversibilityCopy,
  type VlmDecisionReversibilityAssessment,
  type VlmNarrativeDriftAssessment,
} from "./vlm-narrative-drift";
import {
  createVlmAnalysisReceipt,
  type VlmAnalysisReceipt,
} from "./vlm-analysis-receipt";
import {
  applyVlmBrainTierDifferentiation,
  buildVlmTierDifferentiationContract,
  type VlmTierDifferentiationContract,
} from "./vlm-tier-differentiation";
import {
  buildVlmEvidenceCapsule,
  type VlmEvidenceCapsule,
} from "./vlm-evidence-capsule";

export type { VlmBrainOutput, VlmDepth, VlmLocale, VlmSurface } from "./vlm-contract";
export { vlmBrainOutputSchema } from "./vlm-contract";
export { buildCanonicalFactPacket as buildVlmFactPacket } from "./vlm-fact-packet";
export {
  createVlmKernelEvidenceItem,
  evaluateVlmKernelEvidence,
  normalizeVlmKernelConfidence,
  runVlmBrainKernel,
  validateVlmEvidenceTimestamp,
  vlmKernelSourceFamily,
} from "./vlm-brain-kernel";
export type {
  VlmBrainKernelAction,
  VlmBrainKernelDepth,
  VlmBrainKernelEvidenceIndependence,
  VlmBrainKernelEvidenceItem,
  VlmBrainKernelFinding,
  VlmBrainKernelInput,
  VlmBrainKernelLocale,
  VlmBrainKernelMissingData,
  VlmBrainKernelOutput,
  VlmBrainKernelProviderMetadataStatus,
  VlmBrainKernelStatus,
  VlmBrainKernelSurface,
  VlmBrainKernelTimestampStatus,
} from "./vlm-brain-kernel";
export { analyzeProductDraftWithVlmKernel } from "./vlm-brain-product-adapter";
export type { VlmProductKernelPayload } from "./vlm-brain-product-adapter";
export { analyzeAuditCaseWithVlmKernel } from "./vlm-brain-audit-adapter";
export type { VlmAuditCaseInput, VlmAuditKernelPayload } from "./vlm-brain-audit-adapter";
export { buildVlmAuditFindingSchemaPack, normalizeVlmAuditFinding, vlmAuditFindingsToKernelFindings } from "./vlm-audit-finding-schema";
export type { VlmAuditFinding, VlmAuditFindingInput, VlmAuditFindingSchemaPack, VlmAuditEvidenceRow, VlmAuditRemediationPlan } from "./vlm-audit-finding-schema";
export { analyzeRiskWithVlmKernel } from "./vlm-brain-risk-adapter";
export type { VlmRiskKernelPayload } from "./vlm-brain-risk-adapter";
export { analyzeMarketSurfaceWithVlmKernel, vlmKernelOutputToUnifiedAuditEvidence } from "./vlm-brain-market-surface";
export type { VlmMarketKernelInput, VlmMarketKernelPayload, VlmMarketKernelSurface } from "./vlm-brain-market-surface";
export {
  applyVlmProviderTelemetryObservation,
  createEmptyVlmProviderTelemetryRecord,
  vlmProviderTelemetryToKernelPatch,
} from "./vlm-brain-provider-telemetry";
export type {
  VlmProviderTelemetryKernelPatch,
  VlmProviderTelemetryLatency,
  VlmProviderTelemetryObservation,
  VlmProviderTelemetryRecord,
  VlmProviderTelemetrySample,
} from "./vlm-brain-provider-telemetry";
export { analyzeLensReportWithVlmKernel } from "./vlm-brain-lens-adapter";
export type { VlmLensKernelInput, VlmLensKernelPayload } from "./vlm-brain-lens-adapter";

export type RiskBrainSnapshot = ReturnType<typeof buildRiskBrain>;

export type VlmBrainInput = {
  result: TokenRiskResult;
  brain: RiskBrainSnapshot;
  locale?: VlmLocale;
  depth?: VlmDepth;
  surface?: VlmSurface;
  prompt?: string;
  sessionId?: string;
};

export type VlmBrainEnvelope = {
  version: "velmere-vlm-brain-v3";
  mode: "gemini" | "rules";
  surface: VlmSurface;
  depth: VlmDepth;
  locale: VlmLocale;
  model: string | null;
  traceId: string;
  generatedAt: string;
  durationMs: number;
  attempts: number;
  cache: "hit" | "miss";
  output: VlmBrainOutput;
  facts: VlmCanonicalFactPacket;
  receipt: VlmAnalysisReceipt;
  tierContract: VlmTierDifferentiationContract;
  evidenceCapsule: VlmEvidenceCapsule;
  contextHash: string;
  diagnostics: {
    providerError?: string;
    sourceCount: number;
    signalCount: number;
    confidenceCap: number;
    truncatedInput: boolean;
    schemaValid: boolean;
    contradictionCount: number;
    missingDataCount: number;
    toolCalls: number;
    promptTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
    estimatedCostUsd?: number;
    claimFirewallRejected?: string[];
    promptSecurityFlags?: string[];
    adviceBoundaryDecision?: string;
    adviceBoundaryFlags?: string[];
    shadowStatus?: "approved" | "revised" | "rejected" | "unavailable" | "not_run";
    shadowModel?: string;
    shadowLatencyMs?: number;
    shadowIssueCodes?: string[];
    shadowConfidenceCap?: number;
    evidenceQuorumStatus?: VlmCanonicalFactPacket["sourceArbitration"]["evidenceQuorum"]["status"];
    evidenceQuorumRatio?: number;
    weakFactIds?: string[];
    sourceIntegrityStatus?: VlmCanonicalFactPacket["sourceArbitration"]["sourceIntegrity"]["status"];
    sourceIntegrityScore?: number;
    sourceIntegrityPenalty?: number;
    quarantinedSourceIds?: string[];
    temporalConsistencyStatus?: VlmCanonicalFactPacket["sourceArbitration"]["temporalConsistency"]["status"];
    temporalConsistencyScore?: number;
    temporalConsistencyPenalty?: number;
    staleTemporalFactIds?: string[];
    narrativeDriftStatus?: VlmNarrativeDriftAssessment["status"];
    narrativeDriftScore?: number;
    narrativeDriftPenalty?: number;
    narrativeDriftReasons?: string[];
    decisionReversibilityTier?: VlmDecisionReversibilityAssessment["tier"];
    decisionReversibilityScore?: number;
    decisionReversibilityPenalty?: number;
    verdictGovernorStatus?: VlmCanonicalFactPacket["verdictGovernor"]["status"];
    verdictAssetFamily?: VlmCanonicalFactPacket["verdictGovernor"]["assetFamily"];
    missingProofLanes?: string[];
    riskConfidenceDelta?: number;
  };
};

type CacheEntry = { expiresAt: number; value: VlmBrainEnvelope };
const envelopeCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 75_000;
const MAX_CACHE = 180;

function publicProviderError(reason?: string): string | undefined {
  if (!reason) return undefined;
  const normalized = reason.toLowerCase();
  if (normalized.includes("claim firewall")) return "claim_firewall_rejected";
  if (normalized.includes("shadow")) return "shadow_review_unavailable";
  if (normalized.includes("security policy")) return "security_policy";
  if (normalized.includes("individualized_advice") || normalized.includes("evasion_or_concealment") || normalized.includes("uncalibrated_probability") || normalized.includes("guarantee_or_professional")) return reason;
  if (normalized.includes("api key") || normalized.includes("not configured")) return "provider_not_configured";
  if (normalized.includes("circuit")) return "provider_circuit_open";
  if (normalized.includes("budget")) return "provider_budget_exhausted";
  if (normalized.includes("schema") || normalized.includes("json")) return "provider_response_invalid";
  return "provider_unavailable";
}

function locale(value?: VlmLocale): VlmLocale {
  return value === "en" || value === "de" ? value : "pl";
}

function depth(value?: VlmDepth): VlmDepth {
  return value === "basic" || value === "pro" || value === "advanced" ? value : "basic";
}

function surface(value?: VlmSurface): VlmSurface {
  return value === "shield_pro" || value === "real_markets" || value === "shield_map" || value === "lens" || value === "angel" || value === "admin" ? value : "shield";
}

function copy(localeValue: VlmLocale) {
  if (localeValue === "de") {
    return {
      calm: "Kein Warnsignal dominiert, die Bewertung bleibt jedoch bedingt",
      observe: "Beobachtung empfohlen",
      review: "Manuelle Prüfung empfohlen",
      high: "Erhöhtes Risiko in bestätigten Signalen",
      summary: "Die Bewertung verbindet bestätigte Marktdaten mit einer deterministischen Risikoprüfung.",
      unknown: "Für eine belastbare Aussage fehlen bestätigte Daten.",
      missing: "Fehlende Daten begrenzen die Konfidenz.",
      next: "Aktualisieren Sie Quellen und prüfen Sie die fehlenden Daten erneut.",
      sourceAssessment: "Die Konfidenz ist auf die Qualität, Aktualität, zeitliche Konsistenz und Anzahl unabhängiger Quellen begrenzt.",
      noAdvice: "Dies ist eine Risikoerklärung und keine Anlageberatung.",
    };
  }
  if (localeValue === "en") {
    return {
      calm: "No warning signal dominates, but the assessment remains conditional",
      observe: "Continued observation is recommended",
      review: "Manual review is recommended",
      high: "Elevated risk in confirmed signals",
      summary: "The assessment combines confirmed market facts with a deterministic risk review.",
      unknown: "Confirmed data is insufficient for a stronger conclusion.",
      missing: "Missing data limits confidence.",
      next: "Refresh the sources and verify the missing data again.",
      sourceAssessment: "Confidence is capped by source quality, freshness, temporal consistency and independent-source coverage.",
      noAdvice: "This is a risk explanation, not investment advice.",
    };
  }
  return {
    calm: "Nie dominuje sygnał ostrzegawczy, ale ocena pozostaje warunkowa",
    observe: "Zalecana jest dalsza obserwacja",
    review: "Zalecana jest ręczna weryfikacja",
    high: "Podwyższone ryzyko w potwierdzonych sygnałach",
    summary: "Ocena łączy potwierdzone fakty rynkowe z deterministyczną kontrolą ryzyka.",
    unknown: "Brakuje potwierdzonych danych do mocniejszego wniosku.",
    missing: "Braki danych ograniczają poziom pewności.",
    next: "Odśwież źródła i ponownie zweryfikuj brakujące dane.",
    sourceAssessment: "Pewność jest ograniczona jakością, świeżością, spójnością czasową i liczbą niezależnych źródeł.",
    noAdvice: "To wyjaśnienie ryzyka, a nie porada inwestycyjna.",
  };
}

function verdict(packet: VlmCanonicalFactPacket): VlmBrainOutput["verdict"] {
  if (packet.deterministicScore >= 70) return "high_risk";
  if (packet.deterministicScore >= 45 || packet.confidenceCap < 30) return "review";
  if (packet.deterministicScore >= 24) return "observe";
  return "calm";
}

function severity(score: number): VlmBrainOutput["keyFindings"][number]["severity"] {
  if (score >= 80) return "critical";
  if (score >= 60) return "warning";
  if (score >= 30) return "watch";
  return "info";
}

function findingCopy(localeValue: VlmLocale) {
  if (localeValue === "de") return {
    risk: "Risiko", deterministic: "Deterministischer Wert", confidence: "Konfidenzgrenze", evidence: "Nachweise", noEvidence: "keine bestätigten Signal-IDs", signal: "Bestätigtes deterministisches Signal", points: "Risikopunkte", freshness: "Aktualität",
  };
  if (localeValue === "en") return {
    risk: "Risk", deterministic: "Deterministic score", confidence: "Confidence cap", evidence: "evidence", noEvidence: "no confirmed signal identifiers", signal: "Confirmed deterministic signal", points: "risk points", freshness: "Freshness",
  };
  return {
    risk: "Ryzyko", deterministic: "Wynik deterministyczny", confidence: "Limit pewności", evidence: "dowody", noEvidence: "brak potwierdzonych identyfikatorów sygnałów", signal: "Potwierdzony sygnał deterministyczny", points: "punktów ryzyka", freshness: "Świeżość",
  };
}

const FACT_LABELS: Record<string, Record<VlmLocale, string>> = {
  price: { pl: "Aktualna cena", en: "Current price", de: "Aktueller Preis" },
  "price-change-1h": { pl: "Zmiana ceny 1h", en: "Price change 1h", de: "Preisänderung 1h" },
  "price-change-24h": { pl: "Zmiana ceny 24h", en: "Price change 24h", de: "Preisänderung 24h" },
  "price-change-7d": { pl: "Zmiana ceny 7d", en: "Price change 7d", de: "Preisänderung 7T" },
  "price-change-30d": { pl: "Zmiana ceny 30d", en: "Price change 30d", de: "Preisänderung 30T" },
  "market-cap": { pl: "Kapitalizacja rynkowa", en: "Market capitalization", de: "Marktkapitalisierung" },
  fdv: { pl: "W pełni rozwodniona wycena", en: "Fully diluted valuation", de: "Vollständig verwässerte Bewertung" },
  "volume-24h": { pl: "Wolumen 24h", en: "Volume 24h", de: "Volumen 24h" },
  "liquidity-usd": { pl: "Widoczna płynność", en: "Visible liquidity", de: "Sichtbare Liquidität" },
  "holder-count": { pl: "Liczba holderów", en: "Holder count", de: "Anzahl der Holder" },
  "top10-holder-percent": { pl: "Koncentracja 10 największych holderów", en: "Top 10 holder concentration", de: "Konzentration der 10 größten Holder" },
  "slippage-10k": { pl: "Symulowany poślizg dla 10k", en: "Simulated slippage at 10k", de: "Simulierter Slippage bei 10k" },
  "sell-tax": { pl: "Podatek od sprzedaży", en: "Sell tax", de: "Verkaufssteuer" },
  "risk-score": { pl: "Deterministyczny wynik ryzyka", en: "Deterministic risk score", de: "Deterministischer Risikowert" },
};

function localizedFactLabel(id: string, fallback: string, localeValue: VlmLocale) {
  return FACT_LABELS[id]?.[localeValue] ?? fallback;
}

function localizedFreshness(value: string, localeValue: VlmLocale) {
  const labels: Record<VlmLocale, Record<"fresh" | "aging" | "stale" | "unknown", string>> = {
    pl: { fresh: "świeże", aging: "starzejące się", stale: "nieświeże", unknown: "nieznana" },
    en: { fresh: "fresh", aging: "aging", stale: "stale", unknown: "unknown" },
    de: { fresh: "frisch", aging: "alternd", stale: "veraltet", unknown: "unbekannt" },
  };
  const freshness = value === "fresh" || value === "aging" || value === "stale" || value === "unknown" ? value : null;
  return freshness ? labels[localeValue][freshness] : value;
}

function localizeMissingData(value: string, localeValue: VlmLocale) {
  const normalized = value.trim().toLowerCase();
  const known: Record<string, Record<VlmLocale, string>> = {
    "independent second source": {
      pl: "drugie niezależne źródło",
      en: "independent second source",
      de: "zweite unabhängige Quelle",
    },
    "evidence quorum below strong threshold": {
      pl: "kworum dowodowe poniżej silnego progu",
      en: "evidence quorum below strong threshold",
      de: "Evidenzquorum unter starkem Schwellenwert",
    },
    "source integrity degraded": {
      pl: "integralność źródeł zdegradowana",
      en: "source integrity degraded",
      de: "Quellenintegrität eingeschränkt",
    },
    "source integrity quarantined": {
      pl: "integralność źródeł w kwarantannie",
      en: "source integrity quarantined",
      de: "Quellenintegrität in Quarantäne",
    },
    "temporal consistency aging": {
      pl: "spójność czasowa dowodów starzeje się",
      en: "temporal evidence is aging",
      de: "zeitliche Evidenzkonsistenz altert",
    },
    "temporal consistency stale": {
      pl: "spójność czasowa dowodów jest nieświeża",
      en: "temporal evidence is stale",
      de: "zeitliche Evidenz ist veraltet",
    },
    "temporal consistency invalid": {
      pl: "spójność czasowa dowodów jest nieważna",
      en: "temporal evidence is invalid",
      de: "zeitliche Evidenz ist ungültig",
    },
    "narrative drift watch": {
      pl: "obserwacja dryfu narracji",
      en: "narrative drift watch",
      de: "Narrative Drift unter Beobachtung",
    },
    "narrative drift drift": {
      pl: "wykryty dryf narracji",
      en: "narrative drift detected",
      de: "Narrative Drift erkannt",
    },
    "narrative drift locked": {
      pl: "blokada dryfu narracji aktywna",
      en: "narrative drift lock active",
      de: "Narrative Drift Lock aktiv",
    },
    "decision reversibility low": {
      pl: "niska odwracalność decyzji",
      en: "low decision reversibility",
      de: "niedrige Entscheidungs-Umkehrbarkeit",
    },
    "decision reversibility unknown": {
      pl: "nieznana odwracalność decyzji",
      en: "unknown decision reversibility",
      de: "unbekannte Entscheidungs-Umkehrbarkeit",
    },
  };
  const fact = Object.entries(FACT_LABELS).find(([, labels]) =>
    Object.values(labels).some((label) => label.toLowerCase() === normalized),
  );
  if (normalized.startsWith("temporal consistency: ")) {
    const reason = normalized.replace("temporal consistency: ", "");
    return localeValue === "de"
      ? `zeitliche Konsistenz: ${reason}`
      : localeValue === "en"
        ? `temporal consistency: ${reason}`
        : `spójność czasowa: ${reason}`;
  }
  if (normalized.startsWith("stale temporal evidence for ")) {
    const factId = normalized.replace("stale temporal evidence for ", "");
    const label = FACT_LABELS[factId]?.[localeValue] ?? factId;
    return localeValue === "de"
      ? `veraltete zeitliche Evidenz für ${label}`
      : localeValue === "en"
        ? `stale temporal evidence for ${label}`
        : `nieświeży dowód czasowy dla ${label}`;
  }
  if (normalized.startsWith("source integrity: ")) {
    const reason = normalized.replace("source integrity: ", "");
    return localeValue === "de"
      ? `Quellenintegrität: ${reason}`
      : localeValue === "en"
        ? `source integrity: ${reason}`
        : `integralność źródeł: ${reason}`;
  }
  if (normalized.startsWith("weak quorum for ")) {
    const factId = normalized.replace("weak quorum for ", "");
    const label = FACT_LABELS[factId]?.[localeValue] ?? factId;
    return localeValue === "de"
      ? `schwaches Quellenquorum für ${label}`
      : localeValue === "en"
        ? `weak evidence quorum for ${label}`
        : `słabe kworum dowodowe dla ${label}`;
  }
  return known[normalized]?.[localeValue] ?? (fact ? fact[1][localeValue] : value);
}

function metricMeaning(id: string, localeValue: VlmLocale) {
  const meanings: Record<string, Record<VlmLocale, string>> = {
    "price-change-24h": {
      pl: "Opisuje tempo ruchu, nie jakość ani bezpieczeństwo aktywa.",
      en: "It describes movement speed, not asset quality or safety.",
      de: "Beschreibt das Bewegungstempo, nicht Qualität oder Sicherheit des Assets.",
    },
    "liquidity-usd": {
      pl: "Wpływa na możliwość wyjścia z pozycji bez dużego wpływu na cenę.",
      en: "It affects whether a position can be exited without a large price impact.",
      de: "Beeinflusst, ob eine Position ohne starke Preiswirkung verlassen werden kann.",
    },
    "top10-holder-percent": {
      pl: "Wysoka koncentracja może zwiększać zależność rynku od niewielu portfeli.",
      en: "High concentration can make the market more dependent on a small number of wallets.",
      de: "Hohe Konzentration kann den Markt stärker von wenigen Wallets abhängig machen.",
    },
    fdv: {
      pl: "Duża różnica względem kapitalizacji może wskazywać ryzyko przyszłej podaży, ale wymaga danych o unlockach.",
      en: "A large gap versus market cap can indicate future supply risk, but unlock data is required.",
      de: "Eine große Lücke zur Marktkapitalisierung kann auf zukünftiges Angebotsrisiko hinweisen, benötigt aber Unlock-Daten.",
    },
    "slippage-10k": {
      pl: "Pokazuje praktyczne ryzyko wykonania, którego sam wykres ceny nie ujawnia.",
      en: "It shows practical execution risk that a price chart alone does not reveal.",
      de: "Zeigt praktisches Ausführungsrisiko, das ein Preischart allein nicht erkennen lässt.",
    },
    "risk-score": {
      pl: "To priorytet weryfikacji, nie prognoza ceny ani prawdopodobieństwo straty.",
      en: "This is a verification priority, not a price forecast or loss probability.",
      de: "Dies ist eine Prüfpriorität, keine Preisprognose oder Verlustwahrscheinlichkeit.",
    },
  };
  return meanings[id]?.[localeValue] ?? "";
}

function formatFactValue(value: string | number | null) {
  if (value === null) return "unknown";
  if (typeof value === "number") return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(4)));
  return value;
}

function hasPublishableNumericVerdict(packet: VlmCanonicalFactPacket) {
  const externalSources = packet.allowedSourceIds.filter((id) => id !== "internal:risk-engine");
  return (
    packet.verdictGovernor.status === "publishable" &&
    packet.dataQuality === "live" &&
    packet.confidenceCap > 0 &&
    packet.sourceArbitration.providerCount >= 2 &&
    packet.sourceArbitration.evidenceQuorum.status === "strong" &&
    externalSources.length >= 2
  );
}

function withheldRiskCopy(localeValue: VlmLocale) {
  if (localeValue === "de") {
    return {
      title: "Kein veröffentlichbarer Risikowert",
      explanation: "Der numerische Risikowert wird zurückgehalten, bis das erforderliche unabhängige Evidenzquorum erfüllt ist.",
      summary: "Ein numerischer Risikowert wird wegen unzureichender unabhängiger Evidenz nicht veröffentlicht.",
    };
  }
  if (localeValue === "en") {
    return {
      title: "No publishable risk score",
      explanation: "The numeric risk score is withheld until the required independent evidence quorum is satisfied.",
      summary: "A numeric risk score is not published because independent evidence is insufficient.",
    };
  }
  return {
    title: "Brak wyniku ryzyka do publikacji",
    explanation: "Liczbowy wynik ryzyka jest wstrzymany do czasu spełnienia wymaganego kworum niezależnych dowodów.",
    summary: "Liczbowy wynik ryzyka nie jest publikowany z powodu niewystarczających niezależnych dowodów.",
  };
}

function enforceNumericVerdictGovernor(output: VlmBrainOutput, packet: VlmCanonicalFactPacket, localeValue: VlmLocale): VlmBrainOutput {
  if (hasPublishableNumericVerdict(packet)) return output;
  const withheld = withheldRiskCopy(localeValue);
  const safeFinding = {
    id: "deterministic-risk-withheld",
    title: withheld.title,
    explanation: withheld.explanation,
    severity: "watch" as const,
    confidence: 0,
    sourceIds: packet.allowedSourceIds.filter((id) => id !== "internal:risk-engine").slice(0, 8),
  };
  const keyFindings = output.keyFindings
    .filter((finding: VlmBrainOutput["keyFindings"][number]) =>
      finding.id !== "deterministic-risk" &&
      finding.id !== "fact-risk-score" &&
      !finding.id.startsWith("layer-"),
    )
    .map((finding: VlmBrainOutput["keyFindings"][number]) => {
      if (finding.id !== "source-verdict-governor") return finding;
      const missing = packet.verdictGovernor.missingProofLanes.slice(0, 5).join(", ") || (localeValue === "pl" ? "brak" : localeValue === "de" ? "keine" : "none");
      return {
        ...finding,
        explanation: localeValue === "de"
          ? `Asset-Familie ${packet.verdictGovernor.assetFamily}; Status ${packet.verdictGovernor.status}. Fehlende Beweis-Lanes: ${missing}. Der numerische Risikowert bleibt zurückgehalten.`
          : localeValue === "en"
            ? `Asset family ${packet.verdictGovernor.assetFamily}; status ${packet.verdictGovernor.status}. Missing proof lanes: ${missing}. The numeric risk score remains withheld.`
            : `Rodzina aktywa ${packet.verdictGovernor.assetFamily}; status ${packet.verdictGovernor.status}. Brakujące ścieżki dowodu: ${missing}. Liczbowy wynik ryzyka pozostaje wstrzymany.`,
        confidence: 0,
      };
    });
  return {
    ...output,
    verdict: "review",
    headline: withheld.title,
    summary: `${withheld.summary} ${copy(localeValue).noAdvice}`,
    confidence: 0,
    facts: output.facts.filter((fact: VlmBrainOutput["facts"][number]) => fact.id !== "risk-score"),
    keyFindings: [safeFinding, ...keyFindings.filter((finding: VlmBrainOutput["keyFindings"][number]) => finding.id !== safeFinding.id)].slice(0, output.keyFindings.length || 1),
    report: {
      ...output.report,
      executiveSummary: `${withheld.title}. ${withheld.explanation}`,
      conclusion: `${withheld.summary} ${output.nextChecks[0] ?? copy(localeValue).next} ${copy(localeValue).noAdvice}`,
    },
    diagnostics: {
      ...output.diagnostics,
    },
  };
}

function deterministicFindings(packet: VlmCanonicalFactPacket, target: number, localeValue: VlmLocale) {
  const text = findingCopy(localeValue);
  const findings: VlmBrainOutput["keyFindings"] = [];
  const publishableNumericVerdict = hasPublishableNumericVerdict(packet);
  const withheld = withheldRiskCopy(localeValue);
  findings.push(publishableNumericVerdict ? {
    id: "deterministic-risk",
    title: `${text.risk} ${packet.deterministicScore}/100`,
    explanation: `${text.deterministic}: ${packet.deterministicScore}/100. ${text.confidence}: ${packet.confidenceCap}/100.`,
    severity: severity(packet.deterministicScore),
    confidence: packet.confidenceCap,
    sourceIds: ["internal:risk-engine"],
  } : {
    id: "deterministic-risk-withheld",
    title: withheld.title,
    explanation: withheld.explanation,
    severity: "watch",
    confidence: 0,
    sourceIds: packet.allowedSourceIds.filter((id) => id !== "internal:risk-engine").slice(0, 8),
  });

  const quorum = packet.sourceArbitration.evidenceQuorum;
  if (quorum.status !== "strong") {
    const quorumTitle = localeValue === "de"
      ? "Evidenzquorum begrenzt die Konfidenz"
      : localeValue === "en"
        ? "Evidence quorum limits confidence"
        : "Kworum dowodowe ogranicza pewność";
    const quorumExplanation = localeValue === "de"
      ? `${quorum.confirmedFactCount}/${quorum.checkedFactCount} prüfbare Fakten erfüllen das Zwei-Provider-Quorum. Schwache Fakten: ${quorum.weakFactIds.slice(0, 5).join(", ") || "keine"}.`
      : localeValue === "en"
        ? `${quorum.confirmedFactCount}/${quorum.checkedFactCount} checkable facts meet the two-provider quorum. Weak facts: ${quorum.weakFactIds.slice(0, 5).join(", ") || "none"}.`
        : `${quorum.confirmedFactCount}/${quorum.checkedFactCount} sprawdzalnych faktów spełnia kworum dwóch providerów. Słabe fakty: ${quorum.weakFactIds.slice(0, 5).join(", ") || "brak"}.`;
    findings.push({
      id: "evidence-quorum",
      title: quorumTitle,
      explanation: quorumExplanation,
      severity: quorum.status === "weak" ? "warning" : "watch",
      confidence: packet.confidenceCap,
      sourceIds: packet.allowedSourceIds.filter((id) => id !== "internal:risk-engine").slice(0, 8),
    });
  }



  const verdictGovernor = packet.verdictGovernor;
  if (verdictGovernor.status !== "publishable") {
    const governorTitle = localeValue === "de"
      ? "Source Verdict Governor begrenzt das Urteil"
      : localeValue === "en"
        ? "Source Verdict Governor limits the verdict"
        : "Source Verdict Governor ogranicza werdykt";
    const governorExplanation = localeValue === "de"
      ? `Asset-Familie ${verdictGovernor.assetFamily}; Status ${verdictGovernor.status}. Fehlende Beweis-Lanes: ${verdictGovernor.missingProofLanes.slice(0, 5).join(", ") || "keine"}. Der numerische Risikowert bleibt zurückgehalten.`
      : localeValue === "en"
        ? `Asset family ${verdictGovernor.assetFamily}; status ${verdictGovernor.status}. Missing proof lanes: ${verdictGovernor.missingProofLanes.slice(0, 5).join(", ") || "none"}. The numeric risk score remains withheld.`
        : `Rodzina aktywa ${verdictGovernor.assetFamily}; status ${verdictGovernor.status}. Brakujące ścieżki dowodu: ${verdictGovernor.missingProofLanes.slice(0, 5).join(", ") || "brak"}. Liczbowy wynik ryzyka pozostaje wstrzymany.`;
    findings.push({
      id: "source-verdict-governor",
      title: governorTitle,
      explanation: governorExplanation,
      severity: verdictGovernor.status === "blocked" || verdictGovernor.status === "operator_review" ? "warning" : "watch",
      confidence: packet.confidenceCap,
      sourceIds: governanceSourceIds(packet),
    });
  }

  const temporal = packet.sourceArbitration.temporalConsistency;
  if (temporal.status !== "current") {
    const temporalTitle = localeValue === "de"
      ? "Evidence Half-Life begrenzt die Aktualität"
      : localeValue === "en"
        ? "Evidence Half-Life limits freshness"
        : "Evidence Half-Life ogranicza świeżość";
    const temporalExplanation = localeValue === "de"
      ? `Zeitstatus ${temporal.status}; Score ${temporal.score}/100; veraltete Fakten: ${temporal.staleFactIds.slice(0, 5).join(", ") || "keine"}.`
      : localeValue === "en"
        ? `Temporal status ${temporal.status}; score ${temporal.score}/100; stale facts: ${temporal.staleFactIds.slice(0, 5).join(", ") || "none"}.`
        : `Status czasowy ${temporal.status}; wynik ${temporal.score}/100; nieświeże fakty: ${temporal.staleFactIds.slice(0, 5).join(", ") || "brak"}.`;
    findings.push({
      id: "temporal-consistency",
      title: temporalTitle,
      explanation: temporalExplanation,
      severity: temporal.status === "invalid" || temporal.status === "stale" ? "warning" : "watch",
      confidence: packet.confidenceCap,
      sourceIds: packet.allowedSourceIds.filter((id) => id !== "internal:risk-engine").slice(0, 8),
    });
  }

  const priorityFactIds = [
    "price-change-24h",
    "liquidity-usd",
    "top10-holder-percent",
    "fdv",
    "slippage-10k",
    "volume-24h",
    "market-cap",
    "price-change-7d",
    "sell-tax",
    "holder-count",
    "price",
  ];
  const rankedFacts = [...packet.facts].sort((left, right) => {
    const leftRank = priorityFactIds.indexOf(left.id);
    const rightRank = priorityFactIds.indexOf(right.id);
    return (leftRank === -1 ? 999 : leftRank) - (rightRank === -1 ? 999 : rightRank);
  });
  const factBudget = target <= 10 ? 3 : target <= 14 ? 5 : 7;
  for (const fact of rankedFacts) {
    if (findings.length >= target) break;
    if (findings.filter((item: VlmBrainOutput["keyFindings"][number]) => item.id.startsWith("fact-")).length >= factBudget) break;
    if (fact.value === null || !fact.sourceIds.length) continue;
    if (!publishableNumericVerdict && fact.id === "risk-score") continue;
    const label = localizedFactLabel(fact.id, fact.label, localeValue);
    const meaning = metricMeaning(fact.id, localeValue);
    findings.push({
      id: `fact-${fact.id}`,
      title: label,
      explanation: `${label}: ${formatFactValue(fact.value)}. ${text.freshness}: ${localizedFreshness(fact.freshness, localeValue)}.${meaning ? ` ${meaning}` : ""}`,
      severity: "info",
      confidence: packet.confidenceCap,
      sourceIds: fact.sourceIds,
    });
  }

  for (const signal of [...packet.signals].sort((left, right) => right.points - left.points)) {
    if (findings.length >= target) break;
    findings.push({
      id: `signal-${signal.id}`,
      title: signal.id.replace(/_/g, " "),
      explanation: `${text.signal}: ${signal.points} ${text.points}.`,
      severity: signal.severity === "critical" ? "critical" : signal.severity === "high" ? "warning" : signal.severity === "medium" ? "watch" : "info",
      confidence: packet.confidenceCap,
      sourceIds: signal.sourceIds,
    });
  }

  for (const layer of publishableNumericVerdict ? [...packet.layers].sort((left, right) => right.score - left.score) : []) {
    if (findings.length >= target) break;
    findings.push({
      id: `layer-${layer.id}`,
      title: layer.label,
      explanation: `${layer.state}; ${text.deterministic.toLowerCase()} ${layer.score}/100; ${text.evidence}: ${layer.evidence.length ? layer.evidence.join(", ") : text.noEvidence}.`,
      severity: severity(layer.score),
      confidence: Math.min(layer.confidence, packet.confidenceCap),
      sourceIds: ["internal:risk-engine"],
    });
  }
  return findings.slice(0, target);
}

function localizedNextChecks(packet: VlmCanonicalFactPacket, localeValue: VlmLocale, depthValue: VlmDepth) {
  const missing = packet.missingData.map((item) => localizeMissingData(item, localeValue));
  const quorumCheck = packet.sourceArbitration.evidenceQuorum.status === "strong"
    ? null
    : localeValue === "de"
      ? "Bestätigen Sie schwache Fakten mit einem zweiten unabhängigen Provider, bevor Sie die Konfidenz erhöhen."
      : localeValue === "en"
        ? "Confirm weak facts with a second independent provider before increasing confidence."
        : "Potwierdź słabe fakty drugim niezależnym providerem, zanim zwiększysz pewność.";
  const base = localeValue === "de"
    ? [
        "Bestätigen Sie Preis und Zeitstempel mit einer zweiten unabhängigen Quelle.",
        "Prüfen Sie, ob Liquidität und Slippage die praktische Ausführbarkeit verändern.",
        "Trennen Sie Preisbewegung von Asset-Qualität und Vertragsrisiko.",
      ]
    : localeValue === "en"
      ? [
          "Confirm price and timestamp with a second independent source.",
          "Check whether liquidity and slippage change practical executability.",
          "Separate price movement from asset quality and contract risk.",
        ]
      : [
          "Potwierdź cenę i timestamp w drugim niezależnym źródle.",
          "Sprawdź, czy płynność i poślizg zmieniają praktyczną wykonalność.",
          "Oddziel ruch ceny od jakości aktywa i ryzyka kontraktu.",
        ];
  const advanced = localeValue === "de"
    ? [
        "Nennen Sie die stärkste alternative Erklärung für das beobachtete Muster.",
        "Bestimmen Sie, welcher fehlende Beleg das Urteil am stärksten verändern könnte.",
      ]
    : localeValue === "en"
      ? [
          "Name the strongest alternative explanation for the observed pattern.",
          "Identify which missing evidence could change the verdict most.",
        ]
      : [
          "Nazwij najmocniejsze alternatywne wyjaśnienie obserwowanego układu.",
          "Ustal, który brakujący dowód może najmocniej zmienić ocenę.",
        ];
  const missingCheck = missing.length
    ? localeValue === "de"
      ? `Priorisieren Sie diese Datenlücke: ${missing[0]}.`
      : localeValue === "en"
        ? `Prioritize this evidence gap: ${missing[0]}.`
        : `Najpierw uzupełnij tę lukę dowodową: ${missing[0]}.`
    : null;
  const governedPacketChecks = packet.nextChecks
    .map((item) => sanitizeVlmText(item, 300))
    .filter(Boolean)
    .slice(0, depthValue === "basic" ? 1 : depthValue === "pro" ? 2 : 3);
  const checks = [...governedPacketChecks, ...base, ...(quorumCheck ? [quorumCheck] : []), ...(depthValue === "advanced" ? advanced : depthValue === "pro" ? advanced.slice(0, 1) : [])];
  if (missingCheck) checks.unshift(missingCheck);
  return checks.slice(0, depthValue === "basic" ? 3 : depthValue === "pro" ? 4 : 6);
}

function decisionNarrative(packet: VlmCanonicalFactPacket, localeValue: VlmLocale) {
  const lowConfidence = packet.confidenceCap < 40;
  if (localeValue === "de") {
    return {
      boundary: lowConfidence
        ? "Die größte Gefahr ist derzeit Überinterpretation: Die Evidenz reicht nur für einen vorsichtigen Prescreen."
        : "Der Risikowert priorisiert Prüfungen; er sagt weder Preisrichtung noch sicheren Verlust voraus.",
      alternative: "Eine starke Preisbewegung kann aus Momentum, dünner Liquidität oder neuer Information entstehen. Der aktuelle Datensatz trennt diese Ursachen nicht vollständig.",
      falsifier: "Die Bewertung sollte neu berechnet werden, wenn eine unabhängige Quelle, bessere Depth-Daten oder neue Holder- und Vertragsdaten den Hauptbefund widerlegen.",
    };
  }
  if (localeValue === "en") {
    return {
      boundary: lowConfidence
        ? "The main risk now is over-interpretation: the evidence supports only a cautious prescreen."
        : "The risk score prioritizes verification; it does not predict price direction or certain loss.",
      alternative: "A strong price move may reflect momentum, thin liquidity or new information. The current evidence does not fully separate those causes.",
      falsifier: "Recalculate the assessment if an independent source, better depth data or new holder and contract evidence contradicts the leading finding.",
    };
  }
  return {
    boundary: lowConfidence
      ? "Największym ryzykiem jest teraz nadinterpretacja: dowody wystarczają tylko do ostrożnego prescreenu."
      : "Wynik ryzyka ustala kolejność weryfikacji; nie przewiduje kierunku ceny ani pewnej straty.",
    alternative: "Silny ruch ceny może wynikać z momentum, cienkiej płynności albo nowej informacji. Obecne dane nie rozdzielają tych przyczyn w pełni.",
    falsifier: "Przelicz ocenę, jeśli niezależne źródło, lepsze dane depth albo nowe dane holderów i kontraktu podważą główny wniosek.",
  };
}

function fallbackOutput(
  packet: VlmCanonicalFactPacket,
  localeValue: VlmLocale,
  depthValue: VlmDepth,
  traceId: string,
  generatedAt: string,
  reason?: string,
): VlmBrainOutput {
  const text = copy(localeValue);
  const publishableNumericVerdict = hasPublishableNumericVerdict(packet);
  const currentVerdict = publishableNumericVerdict ? verdict(packet) : "review";
  const headline = currentVerdict === "calm" ? text.calm : currentVerdict === "observe" ? text.observe : currentVerdict === "review" ? text.review : text.high;
  const target = depthValue === "basic" ? 10 : depthValue === "pro" ? 14 : 20;
  const findings = deterministicFindings(packet, target, localeValue);
  const decision = decisionNarrative(packet, localeValue);
  const nextChecks = localizedNextChecks(packet, localeValue, depthValue);
  const factSummary = packet.facts
    .filter((fact) => fact.value !== null)
    .slice(0, depthValue === "basic" ? 4 : depthValue === "pro" ? 8 : 14)
    .map((fact) => `${localizedFactLabel(fact.id, fact.label, localeValue)}: ${formatFactValue(fact.value)}`)
    .join(" · ");
  const quorum = packet.sourceArbitration.evidenceQuorum;
  const integrity = packet.sourceArbitration.sourceIntegrity;
  const temporal = packet.sourceArbitration.temporalConsistency;
  const sourceSummary = localeValue === "de"
    ? `${packet.sources.length} Quellen; Konfidenzgrenze ${packet.confidenceCap}/100; Evidenzquorum ${quorum.status} (${quorum.confirmedFactCount}/${quorum.checkedFactCount}); Quellenintegrität ${integrity.status} (${integrity.score}/100); zeitliche Konsistenz ${temporal.status} (${temporal.score}/100).`
    : localeValue === "en"
      ? `${packet.sources.length} source records; confidence cap ${packet.confidenceCap}/100; evidence quorum ${quorum.status} (${quorum.confirmedFactCount}/${quorum.checkedFactCount}); source integrity ${integrity.status} (${integrity.score}/100); temporal consistency ${temporal.status} (${temporal.score}/100).`
      : `${packet.sources.length} źródeł; limit pewności ${packet.confidenceCap}/100; kworum dowodowe ${quorum.status} (${quorum.confirmedFactCount}/${quorum.checkedFactCount}); integralność źródeł ${integrity.status} (${integrity.score}/100); spójność czasowa ${temporal.status} (${temporal.score}/100).`;
  const localizedMissing = packet.missingData.map((item) => localizeMissingData(item, localeValue));
  const contractFact = packet.asset.contractAddress
    ? localeValue === "de"
      ? `Eine Vertragsadresse ist für ${packet.asset.chainId ?? "die erfasste Chain"} vorhanden.`
      : localeValue === "en"
        ? `A contract address is present for ${packet.asset.chainId ?? "the recorded chain"}.`
        : `Dostępny jest adres kontraktu dla ${packet.asset.chainId ?? "zapisanej sieci"}.`
    : text.unknown;
  const riskScenario = !publishableNumericVerdict
    ? withheldRiskCopy(localeValue).explanation
    : localeValue === "de"
      ? packet.deterministicScore >= 70 ? "Bestätigte Risikosignale erfordern eine manuelle Prüfung." : packet.confidenceCap < 40 ? "Das Hauptszenario ist Unsicherheit durch fehlende oder schwache Quellenabdeckung." : "Beobachten Sie Liquidität, Marktstruktur und Quellenaktualität."
      : localeValue === "en"
        ? packet.deterministicScore >= 70 ? "Confirmed risk signals require manual review before relying on the result." : packet.confidenceCap < 40 ? "The main scenario is uncertainty caused by missing or weak source coverage." : "Monitor changes in liquidity, market structure and source freshness."
        : packet.deterministicScore >= 70 ? "Potwierdzone sygnały ryzyka wymagają ręcznej weryfikacji." : packet.confidenceCap < 40 ? "Głównym scenariuszem jest niepewność wynikająca z braków lub słabego pokrycia źródeł." : "Monitoruj zmiany płynności, struktury rynku i świeżości źródeł.";

  return {
    schemaVersion: "velmere.vlm.output.v3",
    traceId,
    generatedAt,
    locale: localeValue,
    depth: depthValue,
    providerMode: "deterministic_fallback",
    asset: packet.asset,
    verdict: currentVerdict,
    headline,
    summary: publishableNumericVerdict
      ? localeValue === "de"
        ? `${text.summary} ${packet.asset.name} (${packet.asset.symbol}) hat einen deterministischen Risikowert von ${packet.deterministicScore}/100 bei einer Konfidenzgrenze von ${packet.confidenceCap}/100. ${text.noAdvice}`
        : localeValue === "en"
          ? `${text.summary} ${packet.asset.name} (${packet.asset.symbol}) has deterministic risk ${packet.deterministicScore}/100 and confidence cap ${packet.confidenceCap}/100. ${text.noAdvice}`
          : `${text.summary} ${packet.asset.name} (${packet.asset.symbol}) ma deterministyczny wynik ryzyka ${packet.deterministicScore}/100 przy limicie pewności ${packet.confidenceCap}/100. ${text.noAdvice}`
      : `${withheldRiskCopy(localeValue).summary} ${text.noAdvice}`,
    confidence: packet.confidenceCap,
    facts: publishableNumericVerdict ? packet.facts : packet.facts.filter((fact) => fact.id !== "risk-score"),
    keyFindings: findings.length ? findings : [{
      id: "insufficient-evidence",
      title: text.review,
      explanation: text.unknown,
      severity: "watch",
      confidence: packet.confidenceCap,
      sourceIds: ["internal:risk-engine"],
    }],
    contradictions: packet.conflicts,
    missingData: localizedMissing,
    nextChecks,
    sources: packet.sources,
    report: {
      executiveSummary: `${headline}. ${decision.boundary}`,
      marketStructure: factSummary || text.unknown,
      liquidityAnalysis: packet.facts.filter((fact) => fact.id === "liquidity-usd" || fact.id === "volume-24h" || fact.id === "slippage-10k").map((fact) => `${localizedFactLabel(fact.id, fact.label, localeValue)}: ${formatFactValue(fact.value)}`).join(" · ") || text.unknown,
      holderAnalysis: packet.facts.filter((fact) => fact.id === "holder-count" || fact.id === "top10-holder-percent").map((fact) => `${localizedFactLabel(fact.id, fact.label, localeValue)}: ${formatFactValue(fact.value)}`).join(" · ") || text.unknown,
      contractAnalysis: contractFact,
      sourceAssessment: `${text.sourceAssessment} ${sourceSummary}`,
      riskScenarios: depthValue === "basic"
        ? `${riskScenario} ${decision.boundary}`
        : depthValue === "pro"
          ? `${riskScenario} ${decision.alternative}`
          : `${riskScenario} ${decision.alternative} ${decision.falsifier}`,
      conclusion: `${headline}. ${nextChecks[0] ?? text.next} ${text.noAdvice}`,
    },
    diagnostics: {
      fallbackReason: reason,
      sourceCount: packet.sources.length,
      contradictionCount: packet.conflicts.length,
      missingDataCount: packet.missingData.length,
      schemaValid: true,
      evidenceQuorumStatus: packet.sourceArbitration.evidenceQuorum.status,
      evidenceQuorumRatio: packet.sourceArbitration.evidenceQuorum.quorumRatio,
      sourceIntegrityStatus: packet.sourceArbitration.sourceIntegrity.status,
      sourceIntegrityScore: packet.sourceArbitration.sourceIntegrity.score,
      sourceIntegrityPenalty: packet.sourceArbitration.sourceIntegrity.confidencePenalty,
      quarantinedSourceIds: packet.sourceArbitration.sourceIntegrity.quarantinedSourceIds,
      temporalConsistencyStatus: packet.sourceArbitration.temporalConsistency.status,
      temporalConsistencyScore: packet.sourceArbitration.temporalConsistency.score,
      temporalConsistencyPenalty: packet.sourceArbitration.temporalConsistency.confidencePenalty,
      staleTemporalFactIds: packet.sourceArbitration.temporalConsistency.staleFactIds,
      verdictGovernorStatus: packet.verdictGovernor.status,
      verdictAssetFamily: packet.verdictGovernor.assetFamily,
      missingProofLanes: packet.verdictGovernor.missingProofLanes,
      riskConfidenceDelta: packet.verdictGovernor.riskConfidenceDelta,
    },
  };
}

function applyOutputConfidenceGovernor(output: VlmBrainOutput, packet: VlmCanonicalFactPacket, providerError?: string): VlmBrainOutput {
  const fallbackBandRequired =
    packet.dataQuality !== "live" ||
    packet.sources.length < 2 ||
    packet.sourceArbitration.providerCount < 2 ||
    packet.sourceArbitration.evidenceQuorum.status !== "strong" ||
    packet.sourceArbitration.sourceIntegrity.status !== "trusted" ||
    packet.sourceArbitration.temporalConsistency.status !== "current" ||
    packet.missingData.length > 0 ||
    packet.verdictGovernor.status !== "publishable" ||
    Boolean(providerError) ||
    output.providerMode === "deterministic_fallback";
  const publicCap = fallbackBandRequired
    ? Math.min(packet.confidenceCap, 39)
    : packet.confidenceCap;
  const confidence = Math.max(0, Math.min(100, Math.round(Math.min(output.confidence, publicCap))));

  return {
    ...output,
    confidence,
    keyFindings: output.keyFindings.map((finding: VlmBrainOutput["keyFindings"][number]) => ({
      ...finding,
      confidence: Math.max(0, Math.min(100, Math.round(Math.min(finding.confidence, publicCap)))),
    })),
    diagnostics: {
      ...output.diagnostics,
      verdictGovernorStatus: packet.verdictGovernor.status,
      verdictAssetFamily: packet.verdictGovernor.assetFamily,
      missingProofLanes: packet.verdictGovernor.missingProofLanes,
      riskConfidenceDelta: packet.verdictGovernor.riskConfidenceDelta,
      sourceCount: packet.sources.length,
      missingDataCount: packet.missingData.length,
      evidenceQuorumStatus: packet.sourceArbitration.evidenceQuorum.status,
      evidenceQuorumRatio: packet.sourceArbitration.evidenceQuorum.quorumRatio,
      weakFactIds: packet.sourceArbitration.evidenceQuorum.weakFactIds,
      sourceIntegrityStatus: packet.sourceArbitration.sourceIntegrity.status,
      sourceIntegrityScore: packet.sourceArbitration.sourceIntegrity.score,
      sourceIntegrityPenalty: packet.sourceArbitration.sourceIntegrity.confidencePenalty,
      quarantinedSourceIds: packet.sourceArbitration.sourceIntegrity.quarantinedSourceIds,
      temporalConsistencyStatus: packet.sourceArbitration.temporalConsistency.status,
      temporalConsistencyScore: packet.sourceArbitration.temporalConsistency.score,
      temporalConsistencyPenalty: packet.sourceArbitration.temporalConsistency.confidencePenalty,
      staleTemporalFactIds: packet.sourceArbitration.temporalConsistency.staleFactIds,
      fallbackReason: providerError ?? output.diagnostics?.fallbackReason,
    },
  };
}


function boundedUnique(values: string[], max: number) {
  return Array.from(new Set(values.map((item) => sanitizeVlmText(item, 320)).filter(Boolean))).slice(0, max);
}

function governanceSourceIds(packet: VlmCanonicalFactPacket) {
  const marketSources = packet.allowedSourceIds.filter((id) => id !== "internal:risk-engine").slice(0, 8);
  return marketSources.length ? marketSources : ["internal:risk-engine"];
}

function narrativeSeverity(status: VlmNarrativeDriftAssessment["status"]): VlmBrainOutput["keyFindings"][number]["severity"] {
  return status === "locked" ? "warning" : status === "drift" ? "watch" : "info";
}

function reversibilitySeverity(tier: VlmDecisionReversibilityAssessment["tier"]): VlmBrainOutput["keyFindings"][number]["severity"] {
  return tier === "low" || tier === "unknown" ? "watch" : "info";
}

function applyNarrativeAndReversibilityGovernors(input: {
  output: VlmBrainOutput;
  packet: VlmCanonicalFactPacket;
  narrative: VlmNarrativeDriftAssessment;
  reversibility: VlmDecisionReversibilityAssessment;
  locale: VlmLocale;
}): VlmBrainOutput {
  const narrativeText = localizedVlmDriftCopy(input.narrative.status, input.narrative.driftScore, input.locale);
  const reversibilityText = localizedVlmReversibilityCopy(input.reversibility.tier, input.reversibility.score, input.locale);
  const combinedPenalty = input.narrative.confidencePenalty + input.reversibility.confidencePenalty;
  const governedConfidence = Math.max(0, Math.round(Math.min(
    input.output.confidence,
    input.packet.confidenceCap,
    Math.max(0, input.output.confidence - combinedPenalty),
  )));
  const keyFindings = [...input.output.keyFindings];
  if (input.narrative.status !== "stable") {
    keyFindings.unshift({
      id: "narrative-drift-lock",
      title: input.locale === "de" ? "Narrative Drift Lock" : input.locale === "en" ? "Narrative Drift Lock" : "Blokada dryfu narracji",
      explanation: narrativeText,
      severity: narrativeSeverity(input.narrative.status),
      confidence: governedConfidence,
      sourceIds: ["internal:risk-engine"],
    });
  }
  keyFindings.unshift({
    id: "decision-reversibility",
    title: input.locale === "de" ? "Entscheidungs-Umkehrbarkeit" : input.locale === "en" ? "Decision reversibility" : "Odwracalność decyzji",
    explanation: reversibilityText,
    severity: reversibilitySeverity(input.reversibility.tier),
    confidence: governedConfidence,
    sourceIds: governanceSourceIds(input.packet),
  });

  const driftMissing = input.narrative.status === "stable" ? [] : [`narrative drift ${input.narrative.status}`];
  const reversibilityMissing = input.reversibility.tier === "high" || input.reversibility.tier === "medium" ? [] : [`decision reversibility ${input.reversibility.tier}`];
  const nextDrift = input.narrative.status === "stable"
    ? null
    : input.locale === "de"
      ? "Begründen Sie jede Änderung des Narrativs mit neuen Quellen, bevor die Konfidenz steigt."
      : input.locale === "en"
        ? "Tie every narrative change to new evidence before raising confidence."
        : "Powiąż każdą zmianę narracji z nowym dowodem, zanim wzrośnie pewność.";
  const nextReversibility = input.locale === "de"
    ? "Prüfen Sie, ob Liquidität, Slippage und Gebühren eine Entscheidung leicht korrigierbar lassen."
    : input.locale === "en"
      ? "Check whether liquidity, slippage and fees keep the decision easy to reverse."
      : "Sprawdź, czy płynność, poślizg i opłaty zostawiają decyzję łatwą do odwrócenia.";

  return {
    ...input.output,
    confidence: governedConfidence,
    keyFindings: keyFindings.slice(0, 24).map((finding) => ({
      ...finding,
      confidence: Math.min(finding.confidence, governedConfidence),
    })),
    missingData: boundedUnique([
      ...input.output.missingData,
      ...driftMissing.map((item) => localizeMissingData(item, input.locale)),
      ...reversibilityMissing.map((item) => localizeMissingData(item, input.locale)),
    ], 24),
    nextChecks: boundedUnique([...input.output.nextChecks, ...(nextDrift ? [nextDrift] : []), nextReversibility], 14),
    report: {
      ...input.output.report,
      riskScenarios: sanitizeVlmText(`${input.output.report.riskScenarios} ${reversibilityText}`, 2200),
      conclusion: sanitizeVlmText(`${input.output.report.conclusion} ${input.narrative.status === "stable" ? "" : narrativeText}`, 2200),
    },
    diagnostics: {
      ...input.output.diagnostics,
      narrativeDriftStatus: input.narrative.status,
      narrativeDriftScore: input.narrative.driftScore,
      narrativeDriftPenalty: input.narrative.confidencePenalty,
      narrativeDriftReasons: input.narrative.reasons,
      decisionReversibilityTier: input.reversibility.tier,
      decisionReversibilityScore: input.reversibility.score,
      decisionReversibilityPenalty: input.reversibility.confidencePenalty,
    },
  };
}

function cacheKey(packet: VlmCanonicalFactPacket, localeValue: VlmLocale, depthValue: VlmDepth, surfaceValue: VlmSurface, prompt?: string, previousEvidenceFingerprint?: string | null, previousNarrativeFingerprint?: string | null) {
  return stableHash({
    packet,
    locale: localeValue,
    depth: depthValue,
    surface: surfaceValue,
    prompt: sanitizeVlmText(prompt, 800),
    previousEvidenceFingerprint: previousEvidenceFingerprint ?? null,
    previousNarrativeFingerprint: previousNarrativeFingerprint ?? null,
  });
}

function readCache(key: string) {
  const item = envelopeCache.get(key);
  if (!item) return null;
  if (item.expiresAt <= Date.now()) {
    envelopeCache.delete(key);
    return null;
  }
  return item.value;
}

function writeCache(key: string, value: VlmBrainEnvelope) {
  while (envelopeCache.size >= MAX_CACHE) {
    const first = envelopeCache.keys().next().value as string | undefined;
    if (!first) break;
    envelopeCache.delete(first);
  }
  envelopeCache.set(key, { expiresAt: Date.now() + CACHE_TTL_MS, value });
}

export async function generateVlmBrainAnalysis(input: VlmBrainInput): Promise<VlmBrainEnvelope> {
  const startedAt = Date.now();
  const traceId = randomUUID();
  const generatedAt = new Date().toISOString();
  const localeValue = locale(input.locale);
  const depthValue = depth(input.depth);
  const surfaceValue = surface(input.surface);
  const packet = buildCanonicalFactPacket(input.result, input.brain);
  const epistemic = buildVlmEpistemicDecision(packet, depthValue);
  if (packet.sourceArbitration.temporalConsistency.status !== "current") {
    recordVlmPolicyRejection({
      vector: "source",
      reason: `temporal_consistency_${packet.sourceArbitration.temporalConsistency.status}`,
      score: packet.sourceArbitration.temporalConsistency.status === "invalid" ? 91 : packet.sourceArbitration.temporalConsistency.status === "stale" ? 76 : 54,
      route: `/internal/vlm/temporal-consistency/${surfaceValue}`,
    });
  }
  if (packet.sourceArbitration.sourceIntegrity.status !== "trusted") {
    recordVlmPolicyRejection({
      vector: "source",
      reason: `source_integrity_${packet.sourceArbitration.sourceIntegrity.status}`,
      score: packet.sourceArbitration.sourceIntegrity.status === "quarantined" ? 92 : 64,
      route: `/internal/vlm/source-integrity/${surfaceValue}`,
    });
  }
  const promptInspection = inspectVlmUserPrompt(input.prompt, 800);
  recordVlmSecurityInspection({
    inspection: promptInspection,
    vector: "input",
    route: `/internal/vlm/brain/${surfaceValue}`,
  });
  const adviceInspection = inspectVlmAdviceBoundary(input.prompt);
  const safePrompt = promptInspection.safe && adviceInspection.allowed ? sanitizeVlmText(input.prompt, 800) : undefined;
  const previousMemory = readVlmSessionMemory(input.sessionId, {
    assetId: packet.asset.id,
    surface: surfaceValue,
  });
  const key = cacheKey(
    packet,
    localeValue,
    depthValue,
    surfaceValue,
    safePrompt,
    previousMemory?.lastEvidenceFingerprint,
    previousMemory?.lastNarrativeFingerprint,
  );
  const cached = readCache(key);
  if (cached) {
    const cachedOutput = {
      ...cached.output,
      traceId,
      generatedAt,
      diagnostics: { ...cached.output.diagnostics, cached: true },
    };
    const cachedMode = cached.mode;
    const cachedReceipt = createVlmAnalysisReceipt({
      traceId,
      mode: cachedMode,
      facts: cached.facts,
      output: cachedOutput,
      shadowStatus: cached.diagnostics.shadowStatus,
      shadowModel: cached.diagnostics.shadowModel,
    });
    const cachedEvidenceCapsule = buildVlmEvidenceCapsule({
      packet: cached.facts,
      output: cachedOutput,
      receipt: cachedReceipt,
      depth: cached.depth,
      surface: cached.surface,
      locale: cached.locale,
      tierContract: cached.tierContract,
    });
    return {
      ...cached,
      traceId,
      generatedAt,
      durationMs: Date.now() - startedAt,
      cache: "hit",
      output: cachedOutput,
      receipt: cachedReceipt,
      evidenceCapsule: cachedEvidenceCapsule,
    };
  }

  const providerRequest = {
    packet,
    locale: localeValue,
    depth: depthValue,
    surface: surfaceValue,
    traceId,
    generatedAt,
    prompt: safePrompt,
    previousAnalysis: previousMemory?.lastSummary,
  };
  // PASS2219: world-class latency policy. Basic/Pro must feel instant in the UI,
  // so they use the claim firewall + confidence governors only. Advanced remains
  // the paid evidence mode and keeps the extra shadow review.
  const shouldRunShadowReview = depthValue === "advanced";
  const noConfirmedExternalEvidence = !packet.sources.some((source) => source.id !== "internal:risk-engine" && Boolean(source.receiptId));
  const provider = !adviceInspection.allowed
    ? {
        ok: false as const,
        error: adviceInspection.publicCode ?? "individualized_advice_not_supported",
        attempts: 0,
        latencyMs: 0,
        toolCalls: 0,
      }
    : noConfirmedExternalEvidence
      ? {
          ok: false as const,
          error: "insufficient_external_evidence_provider_skipped",
          attempts: 0,
          latencyMs: 0,
          toolCalls: 0,
        }
      : await generateWithVlmProvider(providerRequest);

  let output: VlmBrainOutput;
  let rejectedClaims: string[] | undefined;
  let providerError: string | undefined;
  let shadowStatus: VlmBrainEnvelope["diagnostics"]["shadowStatus"] = "not_run";
  let shadowModel: string | undefined;
  let shadowLatencyMs: number | undefined;
  let shadowIssueCodes: string[] | undefined;
  let shadowConfidenceCap: number | undefined;
  let shadowAttempts = 0;
  let shadowPromptTokens: number | undefined;
  let shadowOutputTokens: number | undefined;
  let shadowTotalTokens: number | undefined;
  let shadowEstimatedCostUsd: number | undefined;
  if (provider.ok) {
    const firewall = applyVlmClaimFirewall(provider.output, packet);
    rejectedClaims = firewall.rejectedClaims;
    if (firewall.ok && firewall.output) {
      if (!shouldRunShadowReview) {
        shadowStatus = "not_run";
        output = {
          ...firewall.output,
          diagnostics: {
            ...firewall.output.diagnostics,
            model: provider.model,
            latencyMs: provider.latencyMs,
            attempts: provider.attempts,
            cached: Boolean(provider.cached),
            schemaValid: true,
            sourceCount: packet.sources.length,
            contradictionCount: firewall.output.contradictions.length,
            missingDataCount: firewall.output.missingData.length,
            promptTokens: provider.usage.promptTokens,
            outputTokens: provider.usage.outputTokens,
            totalTokens: provider.usage.totalTokens,
            estimatedCostUsd: provider.usage.estimatedCostUsd,
            toolCalls: provider.toolCalls,
            fallbackReason: firewall.rejectedClaims.length ? "claim_firewall_trimmed" : undefined,
          },
        };
      } else {
        const shadow = await reviewWithVlmShadow(providerRequest, firewall.output);
        shadowModel = shadow.model ?? undefined;
        shadowLatencyMs = shadow.latencyMs;
        shadowAttempts = shadow.attempts;
        if (!shadow.ok) {
          shadowStatus = "unavailable";
          providerError = "shadow_review_unavailable";
          output = fallbackOutput(packet, localeValue, depthValue, traceId, generatedAt, providerError);
        } else {
          shadowPromptTokens = shadow.usage.promptTokens;
          shadowOutputTokens = shadow.usage.outputTokens;
          shadowTotalTokens = shadow.usage.totalTokens;
          shadowEstimatedCostUsd = shadow.usage.estimatedCostUsd;
          const gate = evaluateVlmShadowReview(shadow.review, firewall.output, packet);
          shadowStatus = gate.status;
          shadowIssueCodes = gate.issueCodes;
          shadowConfidenceCap = gate.confidenceCap;
          if (!gate.publish) {
            providerError = "shadow_review_rejected";
            recordVlmPolicyRejection({
              vector: "claim",
              reason: "shadow_review_rejected",
              score: Math.max(90, shadow.review.riskScore),
              route: `/internal/vlm/brain/${surfaceValue}`,
            });
            output = fallbackOutput(packet, localeValue, depthValue, traceId, generatedAt, providerError);
          } else {
            output = {
              ...firewall.output,
              confidence: Math.min(firewall.output.confidence, gate.confidenceCap),
              keyFindings: firewall.output.keyFindings.map((finding: VlmBrainOutput["keyFindings"][number]) => ({
                ...finding,
                confidence: Math.min(finding.confidence, gate.confidenceCap),
              })),
              diagnostics: {
                ...firewall.output.diagnostics,
                model: provider.model,
                latencyMs: provider.latencyMs + shadow.latencyMs,
                attempts: provider.attempts + shadow.attempts,
                cached: Boolean(provider.cached),
                schemaValid: true,
                sourceCount: packet.sources.length,
                contradictionCount: firewall.output.contradictions.length,
                missingDataCount: firewall.output.missingData.length,
                promptTokens: (provider.usage.promptTokens ?? 0) + (shadow.usage.promptTokens ?? 0),
                outputTokens: (provider.usage.outputTokens ?? 0) + (shadow.usage.outputTokens ?? 0),
                totalTokens: (provider.usage.totalTokens ?? 0) + (shadow.usage.totalTokens ?? 0),
                estimatedCostUsd: (provider.usage.estimatedCostUsd ?? 0) + (shadow.usage.estimatedCostUsd ?? 0),
                toolCalls: provider.toolCalls,
              },
            };
          }
        }
      }
    } else {
      providerError = "claim_firewall_rejected";
      recordVlmPolicyRejection({
        vector: "claim",
        reason: "claim_firewall_rejected",
        score: 88,
        route: `/internal/vlm/brain/${surfaceValue}`,
      });
      output = fallbackOutput(packet, localeValue, depthValue, traceId, generatedAt, providerError);
    }
  } else {
    const providerFailure = provider as { ok: false; error?: string };
    providerError = publicProviderError(providerFailure.error);
    output = fallbackOutput(packet, localeValue, depthValue, traceId, generatedAt, providerError);
  }

  const schemaCheck = vlmBrainOutputSchema.safeParse(output);
  if (!schemaCheck.success) {
    providerError = "provider_response_invalid";
    output = fallbackOutput(packet, localeValue, depthValue, traceId, generatedAt, providerError);
  }

  output = applyOutputConfidenceGovernor(output, packet, providerError);
  output = {
    ...output,
    confidence: Math.min(output.confidence, epistemic.confidenceCap, shadowConfidenceCap ?? 100),
    facts: output.facts.map((fact: VlmBrainOutput["facts"][number]) => ({
      ...fact,
      label: localizedFactLabel(fact.id, fact.label, localeValue),
    })),
    missingData: output.missingData.map((item: string) => localizeMissingData(item, localeValue)),
    keyFindings: output.keyFindings.map((finding: VlmBrainOutput["keyFindings"][number]) => ({
      ...finding,
      confidence: Math.min(finding.confidence, epistemic.confidenceCap, shadowConfidenceCap ?? 100),
    })),
  };

  let reversibility = evaluateVlmDecisionReversibility(packet);
  let narrative = evaluateVlmNarrativeDrift({ packet, output, previous: previousMemory });
  if (narrative.status === "locked" || narrative.status === "drift") {
    recordVlmPolicyRejection({
      vector: "claim",
      reason: `narrative_drift_${narrative.status}`,
      score: narrative.status === "locked" ? 88 : 66,
      route: `/internal/vlm/narrative-drift/${surfaceValue}`,
    });
  }
  if (reversibility.tier === "low" || reversibility.tier === "unknown") {
    recordVlmPolicyRejection({
      vector: "claim",
      reason: `decision_reversibility_${reversibility.tier}`,
      score: reversibility.tier === "low" ? 72 : 54,
      route: `/internal/vlm/decision-reversibility/${surfaceValue}`,
    });
  }
  output = applyNarrativeAndReversibilityGovernors({ output, packet, narrative, reversibility, locale: localeValue });
  const finalSchemaCheck = vlmBrainOutputSchema.safeParse(output);
  if (!finalSchemaCheck.success) {
    providerError = "provider_response_invalid";
    output = fallbackOutput(packet, localeValue, depthValue, traceId, generatedAt, providerError);
    reversibility = evaluateVlmDecisionReversibility(packet);
    narrative = evaluateVlmNarrativeDrift({ packet, output, previous: previousMemory });
    output = applyNarrativeAndReversibilityGovernors({ output, packet, narrative, reversibility, locale: localeValue });
  }
  output = applyVlmBrainTierDifferentiation(output);
  output = enforceNumericVerdictGovernor(output, packet, localeValue);
  const tierContract = buildVlmTierDifferentiationContract({ depth: depthValue, locale: localeValue, surface: surfaceValue });
  const tierSchemaCheck = vlmBrainOutputSchema.safeParse(output);
  if (!tierSchemaCheck.success) {
    providerError = "provider_response_invalid";
    output = fallbackOutput(packet, localeValue, depthValue, traceId, generatedAt, providerError);
    output = applyVlmBrainTierDifferentiation(output);
    output = enforceNumericVerdictGovernor(output, packet, localeValue);
  }
  output = bindVlmFindingsToFacts(output, packet);

  const finalNarrativeFingerprint = buildVlmNarrativeFingerprint(output);
  const finalEvidenceFingerprint = buildVlmEvidenceFingerprint(packet);

  writeVlmSessionMemory({
    sessionId: input.sessionId,
    locale: localeValue,
    depth: depthValue,
    surface: surfaceValue,
    assetId: packet.asset.id,
    question: safePrompt,
    summary: output.summary,
    narrativeFingerprint: finalNarrativeFingerprint,
    evidenceFingerprint: finalEvidenceFingerprint,
    verdict: output.verdict,
    confidence: output.confidence,
  });

  const providerLive =
    provider.ok &&
    output.providerMode === "gemini_live" &&
    packet.confidenceCap >= 40 &&
    packet.sourceArbitration.evidenceQuorum.status === "strong" &&
    packet.sourceArbitration.sourceIntegrity.status === "trusted" &&
    packet.sourceArbitration.temporalConsistency.status === "current" &&
    packet.verdictGovernor.status === "publishable" &&
    narrative.status === "stable" &&
    reversibility.tier !== "low" &&
    reversibility.tier !== "unknown" &&
    (shadowStatus === "approved" || shadowStatus === "revised") &&
    !providerError;
  const envelopeMode: VlmBrainEnvelope["mode"] = providerLive ? "gemini" : "rules";
  const receipt = createVlmAnalysisReceipt({
    traceId,
    mode: envelopeMode,
    facts: packet,
    output,
    shadowStatus,
    shadowModel,
  });
  const evidenceCapsule = buildVlmEvidenceCapsule({
    packet,
    output,
    receipt,
    depth: depthValue,
    surface: surfaceValue,
    locale: localeValue,
    tierContract,
  });
  const envelope: VlmBrainEnvelope = {
    version: "velmere-vlm-brain-v3",
    mode: envelopeMode,
    surface: surfaceValue,
    depth: depthValue,
    locale: localeValue,
    model: providerLive ? provider.model : null,
    traceId,
    generatedAt,
    durationMs: Date.now() - startedAt,
    attempts: provider.attempts + shadowAttempts,
    cache: provider.ok && provider.cached ? "hit" : "miss",
    output,
    facts: packet,
    receipt,
    tierContract,
    evidenceCapsule,
    contextHash: evidenceCapsule.contextHash,
    diagnostics: {
      providerError,
      sourceCount: packet.sources.length,
      signalCount: packet.signals.length,
      confidenceCap: packet.confidenceCap,
      truncatedInput: JSON.stringify(packet).length > 28_000,
      schemaValid: true,
      contradictionCount: output.contradictions.length,
      missingDataCount: output.missingData.length,
      toolCalls: provider.toolCalls,
      promptTokens: provider.ok ? (provider.usage.promptTokens ?? 0) + (shadowPromptTokens ?? 0) : undefined,
      outputTokens: provider.ok ? (provider.usage.outputTokens ?? 0) + (shadowOutputTokens ?? 0) : undefined,
      totalTokens: provider.ok ? (provider.usage.totalTokens ?? 0) + (shadowTotalTokens ?? 0) : undefined,
      estimatedCostUsd: provider.ok ? (provider.usage.estimatedCostUsd ?? 0) + (shadowEstimatedCostUsd ?? 0) : undefined,
      claimFirewallRejected: rejectedClaims?.length ? rejectedClaims : undefined,
      promptSecurityFlags: promptInspection.flags.length ? promptInspection.flags : undefined,
      adviceBoundaryDecision: adviceInspection.decision,
      adviceBoundaryFlags: adviceInspection.flags.length ? adviceInspection.flags : undefined,
      shadowStatus,
      shadowModel,
      shadowLatencyMs,
      shadowIssueCodes: shadowIssueCodes?.length ? shadowIssueCodes : undefined,
      shadowConfidenceCap,
      evidenceQuorumStatus: packet.sourceArbitration.evidenceQuorum.status,
      evidenceQuorumRatio: packet.sourceArbitration.evidenceQuorum.quorumRatio,
      weakFactIds: packet.sourceArbitration.evidenceQuorum.weakFactIds,
      sourceIntegrityStatus: packet.sourceArbitration.sourceIntegrity.status,
      sourceIntegrityScore: packet.sourceArbitration.sourceIntegrity.score,
      sourceIntegrityPenalty: packet.sourceArbitration.sourceIntegrity.confidencePenalty,
      quarantinedSourceIds: packet.sourceArbitration.sourceIntegrity.quarantinedSourceIds,
      temporalConsistencyStatus: packet.sourceArbitration.temporalConsistency.status,
      temporalConsistencyScore: packet.sourceArbitration.temporalConsistency.score,
      temporalConsistencyPenalty: packet.sourceArbitration.temporalConsistency.confidencePenalty,
      staleTemporalFactIds: packet.sourceArbitration.temporalConsistency.staleFactIds,
      verdictGovernorStatus: packet.verdictGovernor.status,
      verdictAssetFamily: packet.verdictGovernor.assetFamily,
      missingProofLanes: packet.verdictGovernor.missingProofLanes,
      riskConfidenceDelta: packet.verdictGovernor.riskConfidenceDelta,
      narrativeDriftStatus: narrative.status,
      narrativeDriftScore: narrative.driftScore,
      narrativeDriftPenalty: narrative.confidencePenalty,
      narrativeDriftReasons: narrative.reasons,
      decisionReversibilityTier: reversibility.tier,
      decisionReversibilityScore: reversibility.score,
      decisionReversibilityPenalty: reversibility.confidencePenalty,
    },
  };
  writeCache(key, envelope);
  return envelope;
}

export {
  VLM_BRAIN_CALIBRATION_HASH,
  VLM_BRAIN_CALIBRATION_MANIFEST,
  VLM_BRAIN_CALIBRATION_VERSION,
} from "./vlm-brain-calibration";
