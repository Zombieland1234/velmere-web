import type { VlmBrainOutput, VlmLocale } from "./vlm-contract";
import type { VlmCanonicalFactPacket } from "./vlm-fact-packet";
import {  sanitizeVlmText, stableHash } from "./vlm-security";

export type VlmNarrativeDriftStatus = "stable" | "watch" | "drift" | "locked";
export type VlmDecisionReversibilityTier = "high" | "medium" | "low" | "unknown";

export type VlmNarrativeMemorySnapshot = {
  lastSummary?: string;
  lastNarrativeFingerprint?: string;
  lastEvidenceFingerprint?: string;
  lastVerdict?: string;
  lastConfidence?: number;
};

export type VlmNarrativeDriftAssessment = {
  schemaVersion: "velmere.vlm.narrative-drift-lock.v1";
  status: VlmNarrativeDriftStatus;
  driftScore: number;
  confidencePenalty: number;
  previousNarrativeFingerprint: string | null;
  currentNarrativeFingerprint: string;
  previousEvidenceFingerprint: string | null;
  currentEvidenceFingerprint: string;
  verdictJump: number;
  confidenceJump: number;
  newEvidence: boolean;
  reasons: string[];
};

export type VlmDecisionReversibilityAssessment = {
  schemaVersion: "velmere.vlm.decision-reversibility.v1";
  tier: VlmDecisionReversibilityTier;
  score: number;
  liquidityScore: number;
  executionFrictionScore: number;
  evidenceConfidenceScore: number;
  confidencePenalty: number;
  reasons: string[];
};

const VERDICT_RANK: Record<VlmBrainOutput["verdict"], number> = {
  calm: 0,
  observe: 1,
  review: 2,
  high_risk: 3,
};

const STOP_WORDS = new Set([
  "the", "and", "or", "to", "of", "in", "is", "are", "with", "for", "a", "an", "this", "that", "it",
  "i", "oraz", "albo", "dla", "jest", "sa", "są", "to", "ten", "ta", "te", "w", "z", "na", "do", "und", "oder", "ist", "sind", "mit", "fur", "für", "der", "die", "das",
]);

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function factValueBucket(value: VlmCanonicalFactPacket["facts"][number]["value"]) {
  if (value === null) return null;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return null;
    if (Math.abs(value) >= 1_000_000_000) return Math.round(value / 100_000_000) * 100_000_000;
    if (Math.abs(value) >= 1_000_000) return Math.round(value / 100_000) * 100_000;
    if (Math.abs(value) >= 10_000) return Math.round(value / 1_000) * 1_000;
    if (Math.abs(value) >= 100) return Math.round(value);
    return Number(value.toFixed(2));
  }
  return sanitizeVlmText(value, 80).toLowerCase();
}

export function buildVlmEvidenceFingerprint(packet: VlmCanonicalFactPacket) {
  return stableHash({
    assetId: packet.asset.id,
    deterministicBucket: Math.round(packet.deterministicScore / 5) * 5,
    confidenceBucket: Math.round(packet.confidenceCap / 5) * 5,
    dataQuality: packet.dataQuality,
    quorum: packet.sourceArbitration.evidenceQuorum.status,
    sourceIntegrity: packet.sourceArbitration.sourceIntegrity.status,
    sourceIntegrityFingerprint: packet.sourceArbitration.sourceIntegrity.fingerprint,
    temporalConsistency: packet.sourceArbitration.temporalConsistency.status,
    temporalFingerprint: packet.sourceArbitration.temporalConsistency.fingerprint,
    facts: packet.facts.map((fact) => ({
      id: fact.id,
      value: factValueBucket(fact.value),
      sourceIds: [...fact.sourceIds].sort().slice(0, 8),
      freshness: fact.freshness,
    })),
    signals: packet.signals.map((signal) => ({ id: signal.id, points: Math.round(signal.points / 5) * 5 })).sort((a, b) => a.id.localeCompare(b.id)),
  }).slice(0, 32);
}

function narrativeText(output: VlmBrainOutput) {
  return sanitizeVlmText([
    output.verdict,
    output.headline,
    output.summary,
    output.report.executiveSummary,
    output.report.sourceAssessment,
    output.report.riskScenarios,
    output.report.conclusion,
    ...output.keyFindings.slice(0, 8).map((finding: VlmBrainOutput["keyFindings"][number]) => `${finding.title} ${finding.explanation}`),
  ].join("\n"), 6000);
}

export function buildVlmNarrativeFingerprint(output: VlmBrainOutput) {
  return stableHash({
    verdict: output.verdict,
    confidenceBucket: Math.round(output.confidence / 5) * 5,
    narrative: narrativeText(output).toLowerCase(),
  }).slice(0, 32);
}

function tokenSet(text: string) {
  return new Set(
    sanitizeVlmText(text, 6000)
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .split(/[^a-z0-9]+/i)
      .filter((token) => token.length >= 3 && !STOP_WORDS.has(token))
      .slice(0, 260),
  );
}

function jaccard(left: Set<string>, right: Set<string>) {
  if (!left.size && !right.size) return 1;
  let intersection = 0;
  for (const token of left) if (right.has(token)) intersection += 1;
  const union = new Set([...left, ...right]).size;
  return union ? intersection / union : 1;
}

export function evaluateVlmNarrativeDrift(input: {
  packet: VlmCanonicalFactPacket;
  output: VlmBrainOutput;
  previous?: VlmNarrativeMemorySnapshot | null;
}): VlmNarrativeDriftAssessment {
  const currentEvidenceFingerprint = buildVlmEvidenceFingerprint(input.packet);
  const currentNarrativeFingerprint = buildVlmNarrativeFingerprint(input.output);
  const previousSummary = sanitizeVlmText(input.previous?.lastSummary, 2200);
  const previousEvidenceFingerprint = input.previous?.lastEvidenceFingerprint ?? null;
  const previousNarrativeFingerprint = input.previous?.lastNarrativeFingerprint ?? (previousSummary ? stableHash(previousSummary).slice(0, 32) : null);

  if (!previousSummary && !previousNarrativeFingerprint) {
    return {
      schemaVersion: "velmere.vlm.narrative-drift-lock.v1",
      status: "stable",
      driftScore: 0,
      confidencePenalty: 0,
      previousNarrativeFingerprint: null,
      currentNarrativeFingerprint,
      previousEvidenceFingerprint,
      currentEvidenceFingerprint,
      verdictJump: 0,
      confidenceJump: 0,
      newEvidence: true,
      reasons: ["no_previous_narrative"],
    };
  }

  const newEvidence = previousEvidenceFingerprint !== null && previousEvidenceFingerprint !== currentEvidenceFingerprint;
  const previousTokens = tokenSet(previousSummary || String(previousNarrativeFingerprint));
  const currentTokens = tokenSet(narrativeText(input.output));
  const lexicalDrift = Math.round((1 - jaccard(previousTokens, currentTokens)) * 100);
  const previousVerdict = input.previous?.lastVerdict as VlmBrainOutput["verdict"] | undefined;
  const verdictJump = previousVerdict && previousVerdict in VERDICT_RANK
    ? Math.abs(VERDICT_RANK[input.output.verdict] - VERDICT_RANK[previousVerdict])
    : 0;
  const previousConfidence = Number(input.previous?.lastConfidence);
  const confidenceJump = Number.isFinite(previousConfidence) ? Math.abs(input.output.confidence - previousConfidence) : 0;
  let driftScore = lexicalDrift;
  driftScore += verdictJump * 18;
  if (confidenceJump > 20) driftScore += Math.min(22, Math.round((confidenceJump - 20) / 2));
  if (newEvidence) driftScore -= 24;
  driftScore = Math.round(clamp(driftScore));

  const reasons: string[] = [];
  if (!newEvidence) reasons.push("no_material_new_evidence_fingerprint");
  if (lexicalDrift >= 55) reasons.push("narrative_changed_materially");
  if (verdictJump >= 2) reasons.push("verdict_jump_without_clear_bridge");
  if (confidenceJump > 25) reasons.push("confidence_jump_requires_explanation");

  const status: VlmNarrativeDriftStatus = !newEvidence && (verdictJump >= 2 || driftScore >= 78)
    ? "locked"
    : !newEvidence && driftScore >= 62
      ? "drift"
      : driftScore >= 42
        ? "watch"
        : "stable";
  const confidencePenalty = status === "locked"
    ? Math.max(18, Math.ceil(driftScore / 3))
    : status === "drift"
      ? Math.max(10, Math.ceil(driftScore / 5))
      : status === "watch"
        ? Math.max(3, Math.ceil(driftScore / 12))
        : 0;

  return {
    schemaVersion: "velmere.vlm.narrative-drift-lock.v1",
    status,
    driftScore,
    confidencePenalty: Math.round(clamp(confidencePenalty, 0, 45)),
    previousNarrativeFingerprint,
    currentNarrativeFingerprint,
    previousEvidenceFingerprint,
    currentEvidenceFingerprint,
    verdictJump,
    confidenceJump: Math.round(clamp(confidenceJump, 0, 100)),
    newEvidence: previousEvidenceFingerprint === null ? true : newEvidence,
    reasons: reasons.slice(0, 10),
  };
}

function numberFact(packet: VlmCanonicalFactPacket, id: string) {
  const value = packet.facts.find((fact) => fact.id === id)?.value;
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function evaluateVlmDecisionReversibility(packet: VlmCanonicalFactPacket): VlmDecisionReversibilityAssessment {
  const liquidityUsd = numberFact(packet, "liquidity-usd");
  const volume24h = numberFact(packet, "volume-24h");
  const slippage = numberFact(packet, "slippage-10k");
  const sellTax = numberFact(packet, "sell-tax");
  const reasons: string[] = [];

  const liquidityScore = liquidityUsd === null
    ? 35
    : liquidityUsd >= 5_000_000
      ? 92
      : liquidityUsd >= 1_000_000
        ? 78
        : liquidityUsd >= 250_000
          ? 62
          : liquidityUsd >= 50_000
            ? 42
            : 22;
  if (liquidityUsd === null) reasons.push("liquidity_missing");
  else if (liquidityUsd < 250_000) reasons.push("liquidity_limits_reversibility");

  let executionFrictionScore = 100;
  if (slippage !== null) executionFrictionScore -= clamp(slippage * 4, 0, 65);
  else reasons.push("slippage_missing");
  if (sellTax !== null) executionFrictionScore -= clamp(sellTax * 3, 0, 55);
  else reasons.push("sell_tax_missing");
  if (volume24h !== null && liquidityUsd !== null && liquidityUsd > 0) {
    const stress = volume24h / liquidityUsd;
    if (stress > 5) {
      executionFrictionScore -= 18;
      reasons.push("volume_liquidity_stress");
    } else if (stress > 2) {
      executionFrictionScore -= 8;
      reasons.push("volume_liquidity_watch");
    }
  }
  executionFrictionScore = Math.round(clamp(executionFrictionScore, 0, 100));

  let evidenceConfidenceScore = packet.confidenceCap;
  if (packet.sourceArbitration.evidenceQuorum.status !== "strong") evidenceConfidenceScore -= 18;
  if (packet.sourceArbitration.sourceIntegrity.status !== "trusted") evidenceConfidenceScore -= 16;
  if (packet.sourceArbitration.temporalConsistency.status !== "current") evidenceConfidenceScore -= 14;
  if (packet.missingData.length) evidenceConfidenceScore -= Math.min(18, packet.missingData.length * 2);
  evidenceConfidenceScore = Math.round(clamp(evidenceConfidenceScore, 0, 100));

  if (packet.sourceArbitration.evidenceQuorum.status !== "strong") reasons.push("weak_or_mixed_evidence_quorum");
  if (packet.sourceArbitration.sourceIntegrity.status !== "trusted") reasons.push("source_integrity_limits_reversibility_read");
  if (packet.sourceArbitration.temporalConsistency.status !== "current") reasons.push("temporal_uncertainty_limits_reversibility_read");

  const score = Math.round(clamp(liquidityScore * 0.4 + executionFrictionScore * 0.35 + evidenceConfidenceScore * 0.25));
  const tier: VlmDecisionReversibilityTier = packet.dataQuality !== "live" || liquidityUsd === null
    ? "unknown"
    : score >= 75
      ? "high"
      : score >= 50
        ? "medium"
        : "low";
  if (tier === "low") reasons.push("decision_path_is_hard_to_reverse");
  if (tier === "unknown") reasons.push("insufficient_live_data_for_reversibility_tier");

  const confidencePenalty = tier === "low"
    ? 12
    : tier === "unknown"
      ? 10
      : tier === "medium"
        ? 4
        : 0;

  return {
    schemaVersion: "velmere.vlm.decision-reversibility.v1",
    tier,
    score,
    liquidityScore: Math.round(liquidityScore),
    executionFrictionScore,
    evidenceConfidenceScore,
    confidencePenalty,
    reasons: Array.from(new Set(reasons)).slice(0, 10),
  };
}

export function localizedVlmReversibilityCopy(tier: VlmDecisionReversibilityTier, score: number, locale: VlmLocale) {
  if (locale === "de") {
    if (tier === "high") return `Entscheidungs-Umkehrbarkeit ist hoch (${score}/100): Ausführungsfriktion wirkt derzeit begrenzt, bleibt aber quellenabhängig.`;
    if (tier === "medium") return `Entscheidungs-Umkehrbarkeit ist mittel (${score}/100): Liquidität, Slippage oder Evidenzqualität können das Zurückdrehen erschweren.`;
    if (tier === "low") return `Entscheidungs-Umkehrbarkeit ist niedrig (${score}/100): geringe Liquidität, Friktion oder unsichere Evidenz erhöhen das Risiko einer schwer korrigierbaren Entscheidung.`;
    return `Entscheidungs-Umkehrbarkeit ist unbekannt (${score}/100): es fehlen belastbare Live-Daten für eine klare Einstufung.`;
  }
  if (locale === "en") {
    if (tier === "high") return `Decision reversibility is high (${score}/100): current execution friction appears limited, but remains source-dependent.`;
    if (tier === "medium") return `Decision reversibility is medium (${score}/100): liquidity, slippage or evidence quality can make reversal harder.`;
    if (tier === "low") return `Decision reversibility is low (${score}/100): thin liquidity, friction or uncertain evidence raises the risk of a hard-to-correct decision.`;
    return `Decision reversibility is unknown (${score}/100): reliable live data is insufficient for a clear tier.`;
  }
  if (tier === "high") return `Odwracalność decyzji jest wysoka (${score}/100): tarcie wykonania wygląda ograniczone, ale nadal zależy od jakości źródeł.`;
  if (tier === "medium") return `Odwracalność decyzji jest średnia (${score}/100): płynność, poślizg albo jakość dowodów mogą utrudnić korektę decyzji.`;
  if (tier === "low") return `Odwracalność decyzji jest niska (${score}/100): cienka płynność, tarcie albo niepewne dowody zwiększają ryzyko decyzji trudnej do odkręcenia.`;
  return `Odwracalność decyzji jest nieznana (${score}/100): brakuje wystarczająco pewnych danych live do jasnej klasyfikacji.`;
}

export function localizedVlmDriftCopy(status: VlmNarrativeDriftStatus, score: number, locale: VlmLocale) {
  if (locale === "de") {
    if (status === "locked") return `Narrative Drift Lock aktiv (${score}/100): Die Erzählung änderte sich zu stark ohne ausreichend neue Evidenz.`;
    if (status === "drift") return `Narrative Drift beobachtet (${score}/100): Ton oder Urteil haben sich stärker verändert als die Evidenzlage.`;
    if (status === "watch") return `Narrative Drift unter Beobachtung (${score}/100): kleine Tonverschiebung, weiter quellengebunden interpretieren.`;
    return `Narrative Drift stabil (${score}/100): keine materielle Verschiebung gegenüber dem letzten sicheren Kontext.`;
  }
  if (locale === "en") {
    if (status === "locked") return `Narrative Drift Lock active (${score}/100): the story changed too much without enough new evidence.`;
    if (status === "drift") return `Narrative drift observed (${score}/100): tone or verdict moved more than the evidence picture.`;
    if (status === "watch") return `Narrative drift watch (${score}/100): minor tone shift, keep interpretation evidence-bound.`;
    return `Narrative drift stable (${score}/100): no material shift versus the last safe context.`;
  }
  if (status === "locked") return `Narrative Drift Lock aktywny (${score}/100): narracja zmieniła się za mocno bez wystarczających nowych dowodów.`;
  if (status === "drift") return `Wykryto dryf narracji (${score}/100): ton albo werdykt przesunął się mocniej niż obraz dowodów.`;
  if (status === "watch") return `Obserwacja dryfu narracji (${score}/100): lekka zmiana tonu, interpretacja nadal musi trzymać się dowodów.`;
  return `Dryf narracji stabilny (${score}/100): brak istotnej zmiany względem ostatniego bezpiecznego kontekstu.`;
}
