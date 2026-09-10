import type { RiskAgentAssessment, TokenRiskResult, TokenRiskSignal } from "./risk-types";
import { normalizeConfidencePercent } from "./confidence-calibration";
import { buildPass423TieredMemorySummary, type Pass423TieredMemorySummary } from "./long-term-memory-spine";
import { buildPass424BrainErrorCorrectionCore, type Pass424BrainErrorCorrectionCore } from "./brain-error-correction-core";
import { buildPass425SourceArbitrationCore, type Pass425SourceArbitrationCore } from "./source-arbitration-hallucination-brake";

export type Pass422BrainLocale = "pl" | "en" | "de";

export type Pass422HistoryPoint = {
  score?: number;
  timestamp?: string;
};

export type Pass422EvidenceRail = {
  id: string;
  label: string;
  score: number;
  confidence: number;
  reason: string;
  evidence: string[];
  contribution: number;
};

export type Pass422MemoryPulse = {
  sampleCount: number;
  decayedSampleCount: number;
  halfLifeHours: number;
  delta24h: number;
  delta7d: number;
  trend: "rising" | "falling" | "flat" | "insufficient_history";
  stability: "stable" | "warming" | "volatile" | "insufficient_history";
  learningWeight: number;
  overfitGuard: "locked" | "shadow" | "limited" | "adaptive";
  overfitReason: string;
};

export type Pass422SourceGenome = {
  sourceCount: number;
  confirmedSourceCount: number;
  missingCoreCount: number;
  confidence: number;
  freshness: "live" | "partial" | "demo" | "missing";
  secondProvider: "confirmed" | "partial" | "missing";
  providerRisk: "healthy" | "watch" | "degraded";
  notes: string[];
};

export type Pass422PdfNarrativeSection = {
  id: "brief" | "risk" | "evidence" | "sources" | "missing" | "memory" | "next" | "signature";
  title: string;
  body: string;
  confidence: number;
};

export type Pass422BrainMemoryCore = {
  version: "brain-memory-anti-overfit-core";
  generatedAt: string;
  asset: {
    symbol: string;
    name: string;
    key: string;
  };
  score: number;
  confidence: number;
  verdict: string;
  livingState: "observing" | "learning_shadow" | "adaptive_review" | "locked_review";
  memory: Pass422MemoryPulse;
  longTermMemory: Pass423TieredMemorySummary;
  pass424: Pass424BrainErrorCorrectionCore;
  pass425: Pass425SourceArbitrationCore;
  sourceGenome: Pass422SourceGenome;
  evidenceRail: Pass422EvidenceRail[];
  missingData: string[];
  adaptiveWeights: Array<{ id: string; label: string; base: number; adjusted: number; reason: string }>;
  antiOverfitRules: string[];
  narrative: Record<Pass422BrainLocale, Pass422PdfNarrativeSection[]>;
  operatorSummary: string;
};

const HALF_LIFE_HOURS = 72;
function clamp(value: number, min = 0, max = 100) {
  return Math.min(max, Math.max(min, value));
}

function rounded(value: number, digits = 2) {
  return Number(value.toFixed(digits));
}

function hoursBetween(nowMs: number, timestamp?: string) {
  if (!timestamp) return 0;
  const time = Date.parse(timestamp);
  if (!Number.isFinite(time)) return 0;
  return Math.max(0, (nowMs - time) / 36e5);
}

function decayWeight(hours: number) {
  return Math.pow(0.5, hours / HALF_LIFE_HOURS);
}

function cleanHistory(history: Pass422HistoryPoint[]) {
  return history
    .filter((item): item is { score: number; timestamp?: string } => typeof item.score === "number" && Number.isFinite(item.score))
    .slice(-240);
}

function scoreDelta(history: Array<{ score: number; timestamp?: string }>, windowHours: number) {
  if (history.length < 2) return 0;
  const nowMs = Date.now();
  const recent = history.filter((item) => hoursBetween(nowMs, item.timestamp) <= windowHours);
  const sample = recent.length >= 2 ? recent : history.slice(-Math.min(history.length, 12));
  const first = sample[0]?.score ?? sample.at(-1)?.score ?? 0;
  const last = sample.at(-1)?.score ?? first;
  return rounded(last - first, 2);
}

function buildMemory(history: Pass422HistoryPoint[], currentScore: number): Pass422MemoryPulse {
  const clean = cleanHistory(history);
  const nowMs = Date.now();
  const decayedSampleCount = clean.reduce((sum, item) => sum + decayWeight(hoursBetween(nowMs, item.timestamp)), 0);
  const delta24h = scoreDelta(clean, 24);
  const delta7d = clean.length >= 2 ? rounded((clean.at(-1)?.score ?? currentScore) - (clean[0]?.score ?? currentScore), 2) : 0;
  const volatility = clean.length >= 3
    ? clean.slice(-24).reduce((sum, item, index, rows) => {
        if (index === 0) return sum;
        return sum + Math.abs(item.score - rows[index - 1].score);
      }, 0) / Math.max(1, Math.min(clean.length - 1, 23))
    : 0;
  const trend = clean.length < 2
    ? "insufficient_history"
    : delta24h >= 5 || delta7d >= 10
      ? "rising"
      : delta24h <= -5 || delta7d <= -10
        ? "falling"
        : "flat";
  const stability = clean.length < 4
    ? "insufficient_history"
    : volatility >= 12
      ? "volatile"
      : volatility >= 6
        ? "warming"
        : "stable";
  const learningWeight = clean.length < 4
    ? 0
    : clamp(decayedSampleCount / 30, 0, stability === "volatile" ? 0.18 : 0.28);
  const overfitGuard: Pass422MemoryPulse["overfitGuard"] = clean.length < 4
    ? "locked"
    : decayedSampleCount < 8
      ? "shadow"
      : stability === "volatile"
        ? "limited"
        : "adaptive";
  const overfitReason = overfitGuard === "locked"
    ? "Persistent history is too thin; memory may describe, but not steer scoring."
    : overfitGuard === "shadow"
      ? "Memory runs in shadow mode until enough decayed samples exist."
      : overfitGuard === "limited"
        ? "Recent deltas are noisy; adaptive weight is capped to avoid chasing one spike."
        : "History is deep enough for small adaptive context, never for direct price calls.";

  return {
    sampleCount: clean.length,
    decayedSampleCount: rounded(decayedSampleCount, 2),
    halfLifeHours: HALF_LIFE_HOURS,
    delta24h,
    delta7d,
    trend,
    stability,
    learningWeight: rounded(learningWeight, 3),
    overfitGuard,
    overfitReason,
  };
}

function missingCoreData(result: TokenRiskResult, sourceCount: number) {
  const missing = [
    result.metrics.currentPrice === undefined ? "price" : null,
    result.metrics.liquidityUsd === undefined ? "liquidity depth" : null,
    result.metrics.top10HolderPercent === undefined ? "holder concentration" : null,
    result.token.tokenAddress && result.metrics.buyTaxPercentage !== undefined ? null : "contract permissions",
    result.metrics.simulatedSlippage10k === undefined && result.metrics.bidAskImbalancePercent === undefined ? "orderbook depth" : null,
    sourceCount === 0 ? "source ledger" : null,
    sourceCount < 2 ? "second provider" : null,
  ].filter(Boolean) as string[];
  return Array.from(new Set(missing));
}

function buildSourceGenome(result: TokenRiskResult): Pass422SourceGenome {
  const sourceCount = result.dataSources.length;
  const missingData = missingCoreData(result, sourceCount);
  const confidence = normalizeConfidencePercent(result.confidence, 34);
  const freshness: Pass422SourceGenome["freshness"] = result.dataQuality === "live" ? "live" : result.dataQuality === "partial" ? "partial" : result.dataQuality === "demo" ? "demo" : "missing";
  const secondProvider: Pass422SourceGenome["secondProvider"] = sourceCount >= 2 ? "confirmed" : sourceCount === 1 ? "partial" : "missing";
  const providerRisk: Pass422SourceGenome["providerRisk"] = confidence < 42 || missingData.length >= 5
    ? "degraded"
    : confidence < 68 || missingData.length >= 3
      ? "watch"
      : "healthy";
  const notes = [
    secondProvider === "confirmed" ? "Second provider lane is present." : "Second provider lane still limits public confidence.",
    missingData.length ? `${missingData.length} core field(s) stay visible as missing data.` : "Core source fields are available for this pass.",
    freshness === "live" ? "Live lane available; still requires reconnect/freshness guard." : "Live freshness is not fully confirmed in this payload.",
  ];
  return {
    sourceCount,
    confirmedSourceCount: Math.max(0, sourceCount - (secondProvider === "partial" ? 0 : 0)),
    missingCoreCount: missingData.length,
    confidence,
    freshness,
    secondProvider,
    providerRisk,
    notes,
  };
}

function signalLabel(signal: TokenRiskSignal) {
  return signal.id.replace(/_/g, " ");
}

function buildEvidenceRail(result: TokenRiskResult): Pass422EvidenceRail[] {
  const agents = result.agentAssessments ?? [];
  const agentRails = agents.map((agent: RiskAgentAssessment) => ({
    id: agent.id,
    label: agent.label,
    score: Math.round(agent.score),
    confidence: normalizeConfidencePercent(agent.confidence, 34),
    reason: agent.reasoning,
    evidence: agent.evidenceSignalIds.map((id) => id.replace(/_/g, " ")).slice(0, 8),
    contribution: rounded(agent.score * agent.weight, 2),
  }));
  const signalRails = result.signals
    .slice()
    .sort((a, b) => b.points - a.points)
    .slice(0, 4)
    .map((signal) => ({
      id: `signal_${signal.id}`,
      label: signalLabel(signal),
      score: Math.round(clamp(signal.points * 2.4)),
      confidence: normalizeConfidencePercent(result.confidence, 34),
      reason: `Signal ${signalLabel(signal)} adds ${signal.points} raw point(s) before fusion and confidence caps.`,
      evidence: Object.entries(signal.metrics ?? {}).slice(0, 5).map(([key, value]) => `${key}: ${String(value)}`),
      contribution: signal.points,
    }));
  return [...agentRails, ...signalRails]
    .sort((a, b) => b.contribution - a.contribution || b.score - a.score)
    .slice(0, 10);
}

function buildAdaptiveWeights(rail: Pass422EvidenceRail[], memory: Pass422MemoryPulse, sourceGenome: Pass422SourceGenome) {
  return rail.slice(0, 6).map((item) => {
    const base = rounded(item.contribution, 2);
    const confidenceFactor = sourceGenome.providerRisk === "degraded" ? 0.72 : sourceGenome.providerRisk === "watch" ? 0.86 : 1;
    const memoryFactor = memory.overfitGuard === "adaptive" && memory.trend === "rising"
      ? 1.05
      : memory.overfitGuard === "limited"
        ? 0.92
        : memory.overfitGuard === "locked"
          ? 0.82
          : 0.88;
    const adjusted = rounded(base * confidenceFactor * memoryFactor, 2);
    return {
      id: item.id,
      label: item.label,
      base,
      adjusted,
      reason: sourceGenome.providerRisk === "degraded"
        ? "Provider confidence caps the weight; missing data must stay visible."
        : memory.overfitGuard !== "adaptive"
          ? "Memory is not trusted enough to amplify this signal."
          : "Small adaptive lift is allowed because history is stable enough.",
    };
  });
}

function localeTitle(locale: Pass422BrainLocale, id: Pass422PdfNarrativeSection["id"]) {
  const titles: Record<Pass422BrainLocale, Record<Pass422PdfNarrativeSection["id"], string>> = {
    pl: {
      brief: "Brief",
      risk: "Ryzyko",
      evidence: "Dowody",
      sources: "Źródła",
      missing: "Brakujące dane",
      memory: "Pamięć mózgu",
      next: "Następny krok",
      signature: "Podpis Velmère",
    },
    en: {
      brief: "Brief",
      risk: "Risk",
      evidence: "Evidence",
      sources: "Sources",
      missing: "Missing data",
      memory: "Brain memory",
      next: "Next step",
      signature: "Velmère signature",
    },
    de: {
      brief: "Kurzbericht",
      risk: "Risiko",
      evidence: "Evidenz",
      sources: "Quellen",
      missing: "Fehlende Daten",
      memory: "Brain Memory",
      next: "Nächster Schritt",
      signature: "Velmère Signatur",
    },
  };
  return titles[locale][id];
}

function buildNarrative(locale: Pass422BrainLocale, result: TokenRiskResult, memory: Pass422MemoryPulse, sourceGenome: Pass422SourceGenome, rail: Pass422EvidenceRail[], missingData: string[]): Pass422PdfNarrativeSection[] {
  const symbol = result.token.symbol.toUpperCase();
  const top = rail[0];
  const trendWord = memory.trend.replace(/_/g, " ");
  const sourcePhrase = `${sourceGenome.confidence}% / ${sourceGenome.secondProvider}`;
  const missingText = missingData.length ? missingData.slice(0, 6).join(" · ") : "core fields present";

  const body: Record<Pass422BrainLocale, Record<Pass422PdfNarrativeSection["id"], string>> = {
    pl: {
      brief: `${symbol} ma wynik ${result.score}/100. Velmère rozdziela ruch ceny, płynność, źródła i brakujące pola, żeby raport nie był mocniejszy niż dowody.`,
      risk: `Dominująca warstwa: ${top?.label ?? "brak dominującej warstwy"}. Pamięć trendu: ${trendWord}.`,
      evidence: top ? `${top.reason} Widoczne dowody: ${top.evidence.slice(0, 4).join(" · ") || "brak pełnego raila"}.` : "Brak dominującego raila; wymagany dalszy pomiar.",
      sources: `Model źródeł: ${sourcePhrase}. Stan providera: ${sourceGenome.providerRisk}.`,
      missing: `Brakujące dane: ${missingText}. Braki obniżają confidence zamiast generować losową narrację.`,
      memory: `Mózg ma ${memory.sampleCount} gorących snapshotów oraz wieloletni ledger do ${buildPass423TieredMemorySummary([], result.score).policy.retentionYears} lat. Decay half-life ${memory.halfLifeHours}h i guard ${memory.overfitGuard}. ${memory.overfitReason}`,
      next: sourceGenome.providerRisk === "degraded" ? "Najpierw dopnij drugi provider i brakujące pola, potem rozszerz raport." : "Porównaj trend pamięci, źródła i najważniejszy rail przed publikacją pełniejszego wniosku.",
      signature: "Velmère Security · source-bound report · controlled learning without one-event overfit.",
    },
    en: {
      brief: `${symbol} scores ${result.score}/100. Velmère separates price motion, liquidity, sources and missing fields so the report never becomes stronger than evidence.`,
      risk: `Dominant layer: ${top?.label ?? "no dominant layer"}. Memory trend: ${trendWord}.`,
      evidence: top ? `${top.reason} Visible evidence: ${top.evidence.slice(0, 4).join(" · ") || "no full rail"}.` : "No dominant rail yet; more measurement is required.",
      sources: `Source model: ${sourcePhrase}. Provider state: ${sourceGenome.providerRisk}.`,
      missing: `Missing data: ${missingText}. Gaps lower confidence instead of producing random narrative.`,
      memory: `Brain has ${memory.sampleCount} hot snapshots plus a multi-year ledger policy up to ${buildPass423TieredMemorySummary([], result.score).policy.retentionYears} years. ${memory.halfLifeHours}h decay half-life and ${memory.overfitGuard} guard. ${memory.overfitReason}`,
      next: sourceGenome.providerRisk === "degraded" ? "Attach a second provider and missing fields before expanding the report." : "Compare memory trend, sources and the strongest rail before publishing a stronger conclusion.",
      signature: "Velmère Security · source-bound report · controlled learning without one-event overfit.",
    },
    de: {
      brief: `${symbol} hat einen Score von ${result.score}/100. Velmère trennt Preisbewegung, Liquidität, Quellen und fehlende Felder, damit der Bericht nie stärker als die Evidenz wird.`,
      risk: `Dominante Ebene: ${top?.label ?? "keine dominante Ebene"}. Memory-Trend: ${trendWord}.`,
      evidence: top ? `${top.reason} Sichtbare Evidenz: ${top.evidence.slice(0, 4).join(" · ") || "kein vollständiger Rail"}.` : "Noch kein dominanter Rail; weitere Messung erforderlich.",
      sources: `Quellenmodell: ${sourcePhrase}. Provider-Zustand: ${sourceGenome.providerRisk}.`,
      missing: `Fehlende Daten: ${missingText}. Lücken senken die Konfidenz statt zufällige Narrative zu erzeugen.`,
      memory: `Brain hat ${memory.sampleCount} Hot-Snapshots plus eine Multi-Year-Ledger-Policy bis ${buildPass423TieredMemorySummary([], result.score).policy.retentionYears} Jahre. ${memory.halfLifeHours}h Decay-Halbwertzeit und Guard ${memory.overfitGuard}. ${memory.overfitReason}`,
      next: sourceGenome.providerRisk === "degraded" ? "Zuerst Zweitprovider und fehlende Felder anbinden, danach den Bericht erweitern." : "Memory-Trend, Quellen und stärksten Rail vergleichen, bevor ein stärkerer Schluss publiziert wird.",
      signature: "Velmère Security · source-bound report · controlled learning without one-event overfit.",
    },
  };

  const ids: Pass422PdfNarrativeSection["id"][] = ["brief", "risk", "evidence", "sources", "missing", "memory", "next", "signature"];
  return ids.map((id) => ({
    id,
    title: localeTitle(locale, id),
    body: body[locale][id].slice(0, 520),
    confidence: id === "sources" || id === "missing" ? sourceGenome.confidence : normalizeConfidencePercent(result.confidence, 34),
  }));
}

export function buildPass422BrainMemoryCore(
  result: TokenRiskResult,
  history: Pass422HistoryPoint[] = [],
): Pass422BrainMemoryCore {
  const sourceGenome = buildSourceGenome(result);
  const memory = buildMemory(history, result.score);
  const longTermMemory = buildPass423TieredMemorySummary(history, result.score);
  const evidenceRail = buildEvidenceRail(result);
  const missingData = Array.from(new Set([...missingCoreData(result, sourceGenome.sourceCount), ...(result.metaModel?.limitations ?? []).slice(0, 8)]));
  const adaptiveWeights = buildAdaptiveWeights(evidenceRail, memory, sourceGenome);
  const pass424 = buildPass424BrainErrorCorrectionCore({
    score: result.score,
    confidence: result.confidence ?? 0.34,
    memory,
    longTermMemory,
    sourceGenome,
    evidenceRail,
    missingData,
  });
  const pass425 = buildPass425SourceArbitrationCore({
    result,
    memory,
    longTermMemory,
    pass424,
    sourceGenome,
    evidenceRail,
    missingData,
  });
  const livingState: Pass422BrainMemoryCore["livingState"] = memory.overfitGuard === "locked"
    ? "locked_review"
    : memory.overfitGuard === "shadow"
      ? "learning_shadow"
      : sourceGenome.providerRisk === "degraded"
        ? "observing"
        : "adaptive_review";
  const confidence = clamp(Math.round(sourceGenome.confidence - Math.min(18, missingData.length * 1.4) + memory.learningWeight * 14 + longTermMemory.learningWeight * 12));
  const narrative = {
    pl: buildNarrative("pl", result, memory, sourceGenome, evidenceRail, missingData),
    en: buildNarrative("en", result, memory, sourceGenome, evidenceRail, missingData),
    de: buildNarrative("de", result, memory, sourceGenome, evidenceRail, missingData),
  };

  return {
    version: "brain-memory-anti-overfit-core",
    generatedAt: new Date().toISOString(),
    asset: {
      symbol: result.token.symbol,
      name: result.token.name,
      key: result.token.marketId ?? result.token.tokenAddress ?? result.token.symbol,
    },
    score: result.score,
    confidence,
    verdict: result.level,
    livingState,
    memory,
    longTermMemory,
    pass424,
    pass425,
    sourceGenome,
    evidenceRail,
    missingData: missingData.slice(0, 16),
    adaptiveWeights,
    antiOverfitRules: [
      "One event can create an observation, not a new rule.",
      "Memory can be retained for years, but old snapshots become archive evidence, not direct steering.",
      "Memory uses decay; old snapshots lose weight automatically.",
      "Missing data lowers confidence instead of filling the gap with narrative.",
      "Second provider disagreement blocks stronger public wording.",
      "Basic, Pro and Advanced share the same truth payload; only field count changes.",
      "AI text is source-bound and deterministic for the same payload/locale.",
      "PASS425 claim filters block unconfirmed provider claims and cap narrative strength.",
      "Personal user memory is not stored long-term unless explicit opt-in exists; market-risk memory is separated.",
    ],
    narrative,
    operatorSummary: `${result.token.symbol} brain ${livingState}; confidence ${confidence}%; memory ${memory.overfitGuard}; long-term ${longTermMemory.learningMode}/${longTermMemory.retentionYears}y; sources ${sourceGenome.providerRisk}; PASS424 ${pass424.mode}/${pass424.contradictionScore}; PASS425 ${pass425.arbitrationMode}/${pass425.confidenceBand}.`,
  };
}

export function pass422SelectNarrative(
  core: Pass422BrainMemoryCore,
  locale: string,
): Pass422PdfNarrativeSection[] {
  const safeLocale: Pass422BrainLocale = locale === "de" || locale === "en" ? locale : "pl";
  return core.narrative[safeLocale];
}
