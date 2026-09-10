import type { RiskAgentId, RiskLevel, RiskSignalId, TokenRiskResult } from "./risk-types";
import {
  normalizeConfidencePercent,
  normalizeConfidenceRatio,
} from "./confidence-calibration";
import { buildPass422BrainMemoryCore } from "./brain-memory-anti-overfit-core";
import { buildPass427BrainBugfixIntegrityRuntime } from "./brain-bugfix-integrity-runtime";
import { buildPass428BrainNarrativeCoherenceRuntime } from "./brain-narrative-coherence-runtime";
import { buildPass429BrainSelfAuditConsensusRuntime } from "./brain-self-audit-consensus-runtime";
import { buildPass430BrainAnswerVerifierRuntime } from "./brain-answer-verifier-runtime";
import { buildPass431BrainCriticLoopRuntime } from "./brain-critic-loop-runtime";
import { buildPass432LiveDataProbeRuntime } from "./live-data-probe-runtime";
import { buildPass433RealInternetDataArbitration } from "./real-internet-data-arbitration";
import { buildPass434ProviderCrosscheckMissingDataHunter } from "./provider-crosscheck-missing-data-hunter";
import { buildPass435LiveQueryTestBench } from "./live-query-test-bench";
import { buildPass436WorldBrainSloGraphRuntime } from "./world-brain-slo-graph-runtime";
import { buildPass437AdaptiveEvidencePlannerRuntime } from "./adaptive-evidence-planner-runtime";
import { buildPass438ProviderExecutionLoopRuntime } from "./provider-execution-loop-runtime";
import { buildPass439TruthReplayHarnessRuntime } from "./truth-replay-harness-runtime";
import { buildPass440SemanticDriftSourceLineageRuntime } from "./semantic-drift-source-lineage-runtime";
import { buildPass441BrainEvalHarnessRuntime } from "./brain-eval-harness-runtime";
import { buildPass442BrainRegressionJudgeRuntime } from "./regression-judge-runtime";

type RiskBrainLayer = {
  id: RiskAgentId | "history";
  label: string;
  score: number;
  confidence: number;
  state: "clear" | "watch" | "warning" | "critical" | "insufficient_data";
  evidence: RiskSignalId[];
  explanation: string;
};

type RiskBrainHistoryPoint = {
  score?: number;
  timestamp?: string;
};


function normalizedSymbol(result: TokenRiskResult) {
  return String(result.token.symbol || result.token.name || "").trim().toUpperCase().replace(/\s+/g, "");
}

function isRealMarketResult(result: TokenRiskResult) {
  const assetClass = result.token.assetClass ?? "crypto";
  return assetClass !== "crypto" && assetClass !== "unknown";
}

function isNativeBlueChipCrypto(result: TokenRiskResult) {
  return ["BTC", "BITCOIN", "ETH", "ETHEREUM", "SOL", "SOLANA", "BNB", "XRP"].includes(normalizedSymbol(result));
}

function requiresTokenEvidence(result: TokenRiskResult) {
  return !isRealMarketResult(result) && !isNativeBlueChipCrypto(result);
}

function stateFromScore(score: number, confidence: number): RiskBrainLayer["state"] {
  if (confidence < 0.35) return "insufficient_data";
  if (score >= 85) return "critical";
  if (score >= 65) return "warning";
  if (score >= 35) return "watch";
  return "clear";
}

function verdictFromScore(score: number): RiskLevel | "review" {
  if (score >= 85) return "critical";
  if (score >= 65) return "high";
  if (score >= 35) return "medium";
  if (score >= 20) return "review";
  return "low";
}

function historySlope(history: RiskBrainHistoryPoint[] = []) {
  const clean = history
    .filter((item) => typeof item.score === "number")
    .slice(-24) as Array<{ score: number; timestamp?: string }>;
  if (clean.length < 2) return 0;
  const first = clean[0].score;
  const last = clean.at(-1)?.score ?? first;
  return last - first;
}

export function buildRiskBrain(result: TokenRiskResult, history: RiskBrainHistoryPoint[] = []) {
  const agents = result.agentAssessments ?? [];
  const confidence = normalizeConfidenceRatio(result.confidence, 0.34);
  const slope = historySlope(history);
  const historyScore = Math.max(0, Math.min(100, Math.abs(slope) * 3 + (slope > 0 ? 18 : 0)));
  const historyLayer: RiskBrainLayer = {
    id: "history",
    label: "Risk delta memory",
    score: Math.round(historyScore),
    confidence: history.length >= 2 ? 0.72 : 0.22,
    state: history.length >= 2 ? stateFromScore(historyScore, 0.72) : "insufficient_data",
    evidence: [],
    explanation:
      history.length >= 2
        ? `Risk score changed by ${slope > 0 ? "+" : ""}${Math.round(slope)} points across the latest stored snapshots.`
        : "Persistent history is not deep enough yet; run cron/Supabase to unlock delta memory.",
  };
  const layers: RiskBrainLayer[] = [
    ...agents.map((agent) => ({
      id: agent.id,
      label: agent.label,
      score: agent.score,
      confidence: agent.confidence,
      state: stateFromScore(agent.score, agent.confidence),
      evidence: agent.evidenceSignalIds,
      explanation: agent.reasoning,
    })),
    historyLayer,
  ];
  const weightedScore = layers.reduce((sum, layer) => {
    const weight = layer.id === "velocity" ? 0.22
      : layer.id === "liquidity" ? 0.19
        : layer.id === "microstructure" ? 0.17
          : layer.id === "holders" ? 0.16
            : layer.id === "contract" ? 0.14
              : layer.id === "history" ? 0.08
                : 0.04;
    return sum + layer.score * weight;
  }, 0);
  const tokenEvidenceRequired = requiresTokenEvidence(result);
  const realMarketResult = isRealMarketResult(result);
  const missingData = [
    tokenEvidenceRequired && result.metrics.top10HolderPercent === undefined ? "holder concentration" : null,
    tokenEvidenceRequired && result.metrics.holderCount === undefined ? "holder count" : null,
    tokenEvidenceRequired && result.metrics.liquidityUsd === undefined ? "DEX liquidity" : null,
    tokenEvidenceRequired && result.metrics.simulatedSlippage10k === undefined ? "slippage simulation" : null,
    tokenEvidenceRequired && !result.token.tokenAddress ? "contract address" : null,
    realMarketResult && result.metrics.currentPrice === undefined ? "current quote" : null,
    realMarketResult && result.dataSources.length < 2 ? "second market data adapter" : null,
    !realMarketResult && !tokenEvidenceRequired && result.dataSources.length < 2 ? "second native-asset source" : null,
    history.length < 2 ? "persistent risk history" : null,
  ].filter(Boolean) as string[];
  const blockingMissingData = missingData.filter((item) =>
    item !== "persistent risk history" || tokenEvidenceRequired,
  );
  const missingPenalty = Math.min(16, blockingMissingData.length * 2.4);
  let brainScore = Math.min(100, Math.round(weightedScore + missingPenalty));
  const onlyDataUncertainty = result.signals.every((signal) => signal.id === "insufficient_data");
  if ((isNativeBlueChipCrypto(result) || realMarketResult) && onlyDataUncertainty && result.metrics.currentPrice !== undefined) {
    brainScore = Math.min(brainScore, result.dataSources.length >= 2 ? 28 : 34);
  }
  const strongest = [...layers].filter((layer) => layer.id !== "data").sort((a, b) => b.score - a.score)[0];
  const layerMap = Object.fromEntries(layers.map((layer) => [layer.id, layer]));
  const synergyChecks = [
    {
      id: "pump_without_exit_depth",
      label: "Pump without exit depth",
      score: Math.round(((layerMap.velocity?.score ?? 0) * 0.55) + ((layerMap.liquidity?.score ?? 0) * 0.45)),
      body: "Velocity and liquidity are combined to see if a fast move has enough exit depth behind it.",
    },
    {
      id: "holders_vs_liquidity",
      label: "Holder pressure vs liquidity",
      score: Math.round(((layerMap.holders?.score ?? 0) * 0.55) + ((layerMap.liquidity?.score ?? 0) * 0.45)),
      body: "Holder concentration is compared with visible liquidity instead of being judged in isolation.",
    },
    {
      id: "orderbook_vs_price",
      label: "Order book vs price motion",
      score: Math.round(((layerMap.microstructure?.score ?? 0) * 0.52) + ((layerMap.velocity?.score ?? 0) * 0.48)),
      body: "Depth, imbalance and slippage are compared with the live price trajectory.",
    },
    {
      id: "data_uncertainty",
      label: "Data uncertainty",
      score: Math.round(((layerMap.data?.score ?? 0) * 0.65) + missingPenalty * 2.2),
      body: "Missing sources increase review priority but are never presented as proof of wrongdoing.",
    },
  ].sort((a, b) => b.score - a.score);
  const nextActions = [
    strongest ? `Review ${strongest.label} first.` : "Keep automated monitoring active.",
    tokenEvidenceRequired
      ? missingData.includes("holder concentration")
        ? "Connect chain holder distribution before trusting holder safety."
        : "Compare holder distribution against liquidity and volume."
      : realMarketResult
        ? "Compare price, volume and source cadence before interpreting the score."
        : "Compare exchange depth and source coverage before interpreting the score.",
    missingData.includes("persistent risk history") ? "Enable Supabase/cron snapshots to detect risk acceleration." : "Watch for rising risk delta in the next snapshots.",
    result.metaModel?.requiredReview ? "Open evidence report and verify source data manually." : "Keep this as a monitoring case unless score rises.",
  ];
  const pass422 = buildPass422BrainMemoryCore(result, history);
  const pass427 = buildPass427BrainBugfixIntegrityRuntime({ result, brain: pass422, history });
  const pass428 = buildPass428BrainNarrativeCoherenceRuntime({ result, brain: pass422, pass427 });
  const pass429 = buildPass429BrainSelfAuditConsensusRuntime({ result, brain: pass422, pass427, pass428 });
  const pass430 = buildPass430BrainAnswerVerifierRuntime({ result, brain: pass422, pass427, pass428, pass429 });
  const pass431 = buildPass431BrainCriticLoopRuntime({ result, brain: pass422, pass428, pass429, pass430 });
  const pass432 = buildPass432LiveDataProbeRuntime({ result, pass431 });
  const pass433 = buildPass433RealInternetDataArbitration({ result, pass432 });
  const pass434 = buildPass434ProviderCrosscheckMissingDataHunter({ result, pass433 });
  const pass435 = buildPass435LiveQueryTestBench({ result, pass433, pass434 });
  const pass436 = buildPass436WorldBrainSloGraphRuntime({ result, pass435 });
  const pass437 = buildPass437AdaptiveEvidencePlannerRuntime({ result, pass435, pass436 });
  const pass438 = buildPass438ProviderExecutionLoopRuntime({ result, pass433, pass435, pass436, pass437 });
  const pass439 = buildPass439TruthReplayHarnessRuntime({ result, pass435, pass436, pass438 });
  const pass440 = buildPass440SemanticDriftSourceLineageRuntime({ result, pass438, pass439 });
  const pass441 = buildPass441BrainEvalHarnessRuntime({ result, pass435, pass439, pass440 });
  const pass442 = buildPass442BrainRegressionJudgeRuntime({ result, pass435, pass439, pass440, pass441 });
  return {
    version: "velmere-shield-risk-brain-v1",
    token: result.token,
    brainScore,
    verdict: verdictFromScore(brainScore),
    confidence: normalizeConfidencePercent(confidence, 34),
    activeLayers: layers.sort((a, b) => b.score - a.score),
    strongestLayer: strongest,
    synergyChecks,
    missingData,
    decisionPath: [
      `Base risk score: ${result.score}/100.`,
      `Fusion score after AI-brain weighting: ${brainScore}/100 (PASS2278 static-35 brake keeps missing-source placeholders separate from live risk proof).`,
      strongest ? `Dominant layer: ${strongest.label} (${strongest.score}/100).` : "No dominant high-risk layer.",
      synergyChecks[0] ? `Strongest cross-check: ${synergyChecks[0].label} (${synergyChecks[0].score}/100).` : "No strong cross-layer conflict.",
      missingData.length ? `Missing data increases uncertainty: ${missingData.join(", ")}.` : "Core market-integrity layers are present.",
      `PASS422 memory: ${pass422.memory.overfitGuard}; trend ${pass422.memory.trend}; source state ${pass422.sourceGenome.providerRisk}.`,
      `PASS422 anti-overfit: ${pass422.memory.overfitReason}`,
      `PASS424 correction: ${pass422.pass424.mode}; contradiction ${pass422.pass424.contradictionScore}; ${pass422.pass424.publicSummary}`,
      `PASS425 arbitration: ${pass422.pass425.arbitrationMode}; confidence ${pass422.pass425.confidenceBand}; hallucination brake ${pass422.pass425.hallucinationBrake.score}; ${pass422.pass425.publicSummary}`,
      `PASS427 bugfix integrity: ${pass427.runtimeMode}; integrity ${pass427.integrityScore}; ${pass427.publicSummary}`,
      `PASS428 narrative coherence: ${pass428.coherenceMode}; coherence ${pass428.coherenceScore}; confidence cap ${pass428.confidenceCalibration.displayedConfidenceCap}; ${pass428.operatorSummary}`,
      `PASS429 self-audit consensus: ${pass429.answerMode}; consensus ${pass429.consensusState}; public confidence ${pass429.confidenceEnvelope.publicAnswerConfidence}; ${pass429.operatorSummary}`,
      `PASS430 answer verifier: ${pass430.responseMode}; proof ${pass430.proofState}; readiness ${pass430.answerReadinessScore}; ${pass430.publicSummary}`,
      `PASS431 critic loop: ${pass431.criticMode}; final ${pass431.finalAnswerMode}; score ${pass431.criticScore}; confidence ${pass431.finalPublicConfidence}; ${pass431.publicSummary}`,
      `PASS432 live data probe: ${pass432.dataTruthMode}; ${pass432.sampleReadout.priceLine}; missing ${pass432.sampleReadout.missingLine}; live score ${pass432.liveDataScore}/100.`,
      `PASS433 internet arbitration: ${pass433.arbitrationMode}; providers ${pass433.confirmedProviderCount}/${pass433.providerCount}; missing hunts ${pass433.missingDataHunt.length}; confidence cap ${pass433.noFakeLiveEnvelope.publicConfidenceCap}%.`,
      `PASS434 provider crosscheck: ${pass434.truthTier}; gate ${pass434.answerGate}; evidence ${pass434.internetEvidenceScore}/100; ${pass434.providerCrosscheck.reason}`,
      `PASS435 live query test bench: ${pass435.releaseMode}; readiness ${pass435.liveReadinessScore}/100; fake-live risk ${pass435.fakeLiveRisk}/100; assertions ${pass435.queryAssertions.filter((item) => item.passed).length}/${pass435.queryAssertions.length}.`,
      `PASS436 world-brain SLO graph: ${pass436.releaseDecision}; score ${pass436.worldBrainScore}/100; structured ${pass436.structuredOutputReadiness}/100; alert ${pass436.sloEnvelope.alertPolicy}; ${pass436.operatorReadout}`,
      `PASS437 adaptive evidence planner: ${pass437.plannerMode}; plan ${pass437.evidencePlanScore}/100; next ${pass437.nextBestProbe.provider}; ${pass437.operatorReadout}`,
      `PASS438 provider execution loop: ${pass438.executionMode}; score ${pass438.executionScore}/100; next ${pass438.nextExecutableProvider.provider}; ${pass438.operatorReadout}`,
      `PASS439 truth replay harness: ${pass439.replayState}; score ${pass439.replayScore}/100; pdf ${pass439.releaseGate.pdfAllowed ? "allowed" : "blocked"}; ${pass439.operatorReadout}`,
      `PASS440 semantic drift lineage: ${pass440.driftState}; response ${pass440.responseMode}; drift ${pass440.semanticDriftScore}/100; lineage ${pass440.sourceLineageScore}/100; ${pass440.operatorReadout}`,
      `PASS441 brain eval harness: ${pass441.evalMode}; score ${pass441.evalScore}/100; pass/warn/fail ${pass441.passedCount}/${pass441.warningCount}/${pass441.failedCount}; ${pass441.operatorReadout}`,
      `PASS442 regression judge: ${pass442.regressionMode}; score ${pass442.regressionScore}/100; blocked/watch ${pass442.blockedRegressionCount}/${pass442.watchCount}; ${pass442.operatorReadout}`,
    ],
    pass422,
    pass425: pass422.pass425,
    pass427,
    pass428,
    pass429,
    pass430,
    pass431,
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
    nextActions,
    legalNote: "Signal engine only. Not proof, not accusation, not investment advice.",
    generatedAt: new Date().toISOString(),
  };
}
