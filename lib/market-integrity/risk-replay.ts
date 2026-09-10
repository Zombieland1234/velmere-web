import type { RiskLevel, TokenRiskResult } from "./risk-types";
import type { StressScenario } from "./stress-simulator";
import { buildHolderIntelligence } from "./holder-intelligence";
import { buildStressScenarios } from "./stress-simulator";

type ReplayHistoryPoint = {
  score?: number;
  timestamp?: string;
  price?: number;
  volume24h?: number;
  level?: RiskLevel;
};

export type RiskReplayEvent = {
  id: string;
  timestamp: string;
  title: string;
  layer: "price" | "liquidity" | "holders" | "contract" | "orderbook" | "data" | "brain";
  severity: "low" | "watch" | "warning" | "critical";
  score: number;
  evidence: string[];
  analystNote: string;
};

export type RiskReplayPhase = {
  id: string;
  label: string;
  score: number;
  body: string;
  nextStep: string;
};

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function finite(value?: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function severityFromScore(score: number): RiskReplayEvent["severity"] {
  if (score >= 82) return "critical";
  if (score >= 62) return "warning";
  if (score >= 35) return "watch";
  return "low";
}

function isoFromOffset(minutesAgo: number) {
  return new Date(Date.now() - minutesAgo * 60_000).toISOString();
}

function compactMoney(value?: number) {
  if (value === undefined || Number.isNaN(value)) return "unknown";
  if (Math.abs(value) >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(2)}B`;
  if (Math.abs(value) >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (Math.abs(value) >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  return `$${value.toFixed(2)}`;
}

function historyDelta(history: ReplayHistoryPoint[]) {
  const clean = history.filter((point) => finite(point.score) !== undefined) as Array<ReplayHistoryPoint & { score: number }>;
  if (clean.length < 2) return 0;
  return Math.round((clean.at(-1)?.score ?? clean[0].score) - clean[0].score);
}

function historyEvents(history: ReplayHistoryPoint[], result: TokenRiskResult): RiskReplayEvent[] {
  const clean = history
    .filter((point) => finite(point.score) !== undefined && point.timestamp)
    .slice(-6) as Array<ReplayHistoryPoint & { score: number; timestamp: string }>;

  if (clean.length < 2) {
    return [
      {
        id: "memory-bootstrap",
        timestamp: result.generatedAt ?? isoFromOffset(30),
        title: "Risk memory bootstrap",
        layer: "data",
        severity: "watch",
        score: Math.max(28, Math.round(result.score * 0.55)),
        evidence: ["Persistent risk history has fewer than two snapshots.", "Cron and Supabase ledger unlock true replay deltas."],
        analystNote: "Shield is using the current scan as the starting evidence point, not pretending long-term history exists.",
      },
    ];
  }

  return clean.map((point, index) => {
    const previous = clean[Math.max(0, index - 1)];
    const delta = index === 0 ? 0 : Math.round(point.score - previous.score);
    const score = clamp(Math.abs(delta) * 7 + point.score * 0.55 + (delta > 0 ? 10 : 0));
    return {
      id: `snapshot-${index}-${point.timestamp}`,
      timestamp: point.timestamp,
      title: delta > 4 ? "Risk rising snapshot" : delta < -4 ? "Cooling snapshot" : "Stable risk snapshot",
      layer: "brain" as const,
      severity: severityFromScore(score),
      score: Math.round(score),
      evidence: [
        `Stored risk score: ${point.score}/100.`,
        `Delta from previous snapshot: ${delta > 0 ? "+" : ""}${delta}.`,
        point.price ? `Observed price: ${compactMoney(point.price)}.` : "Price snapshot unavailable.",
      ],
      analystNote: delta > 4 ? "Risk acceleration is visible in memory and should be compared with liquidity and holders." : "No strong memory acceleration from this snapshot.",
    } satisfies RiskReplayEvent;
  });
}

function stressEvents(result: TokenRiskResult, stress: ReturnType<typeof buildStressScenarios>): RiskReplayEvent[] {
  return stress.scenarios.slice(0, 3).map((scenario: StressScenario, index) => ({
    id: `stress-${scenario.id}`,
    timestamp: isoFromOffset(24 - index * 7),
    title: scenario.label,
    layer: scenario.id.includes("holder") ? "holders" : scenario.id.includes("sell") ? "liquidity" : scenario.id.includes("contract") ? "contract" : "price",
    severity: scenario.severity,
    score: scenario.score,
    evidence: [
      ...scenario.evidence.slice(0, 2),
      scenario.estimatedSlippagePercent !== undefined ? `Estimated slippage: ${scenario.estimatedSlippagePercent.toFixed(2)}%.` : "Estimated slippage unavailable.",
    ],
    analystNote: scenario.nextStep,
  }));
}

function signalEvents(result: TokenRiskResult): RiskReplayEvent[] {
  const signals = result.signals.slice(0, 5);
  if (!signals.length) return [];
  return signals.map((signal, index) => {
    const layer = signal.id.includes("holder") || signal.id.includes("supply") || signal.id.includes("fdv")
      ? "holders"
      : signal.id.includes("liquidity") || signal.id.includes("slippage") || signal.id.includes("orderbook")
        ? "liquidity"
        : signal.id.includes("tax") || signal.id.includes("contract") || signal.id.includes("honeypot") || signal.id.includes("mint") || signal.id.includes("blacklist")
          ? "contract"
          : signal.id.includes("insufficient")
            ? "data"
            : "price";
    return {
      id: `signal-${signal.id}-${index}`,
      timestamp: isoFromOffset(52 - index * 6),
      title: signal.id.replaceAll("_", " "),
      layer,
      severity: severityFromScore(signal.points),
      score: clamp(signal.points),
      evidence: Object.entries(signal.metrics ?? {}).slice(0, 3).map(([key, value]) => `${key}: ${String(value)}`),
      analystNote: "Signal converted into a replay event so the analyst can see why the score exists instead of reading isolated cards.",
    } satisfies RiskReplayEvent;
  });
}

function buildPhases(result: TokenRiskResult, holder: ReturnType<typeof buildHolderIntelligence>, delta: number): RiskReplayPhase[] {
  const metrics = result.metrics;
  const velocity = clamp(Math.abs(finite(metrics.priceChange24h) ?? 0) * 1.15 + Math.abs(finite(metrics.priceChange7d) ?? 0) * 0.36);
  const liquidityUsd = finite(metrics.liquidityUsd);
  const liquidity = clamp(
    (liquidityUsd !== undefined ? Math.max(0, 70 - Math.log10(Math.max(10, liquidityUsd)) * 8) : 58) +
      (finite(metrics.simulatedSlippage10k) ?? 0) * 1.8,
  );
  const holderScore = holder.holderRiskScore;
  const contract = clamp((finite(metrics.buyTaxPercentage) ?? 0) * 4 + (finite(metrics.sellTaxPercentage) ?? 0) * 4 + (result.token.tokenAddress ? 0 : 22));
  const memory = clamp(Math.abs(delta) * 6 + (delta > 0 ? 18 : 6));

  return [
    {
      id: "velocity-phase",
      label: "Velocity phase",
      score: Math.round(velocity),
      body: "Measures whether the move is slow, organic, parabolic, or reversing fast.",
      nextStep: velocity >= 62 ? "Compare price motion with volume and social/on-chain triggers." : "Keep velocity as a lower-priority monitoring lane.",
    },
    {
      id: "liquidity-phase",
      label: "Exit-liquidity phase",
      score: Math.round(liquidity),
      body: "Checks whether a user can realistically exit without severe slippage or depth collapse.",
      nextStep: liquidity >= 62 ? "Inspect order book, LP depth, spread and simulated sell shock." : "Liquidity does not dominate the current risk picture.",
    },
    {
      id: "holder-phase",
      label: "Holder phase",
      score: holderScore,
      body: "Turns holder concentration, float uncertainty and liquidity coverage into one review lane.",
      nextStep: holderScore >= 62 ? "Connect holder clustering and CEX-wallet exclusion before lowering risk." : "Holder pressure is not dominant in the proxy model.",
    },
    {
      id: "contract-phase",
      label: "Contract phase",
      score: Math.round(contract),
      body: "Uses tax, address availability and contract-control signals as an escalation layer.",
      nextStep: contract >= 62 ? "Escalate to contract-control review." : "Contract layer does not dominate from current inputs.",
    },
    {
      id: "memory-phase",
      label: "Replay memory phase",
      score: Math.round(memory),
      body: "Compares current score with stored snapshots to detect acceleration or cooling.",
      nextStep: delta > 5 ? "Treat this as a rising case and keep the cron ledger active." : "Keep collecting snapshots for stronger replay confidence.",
    },
  ].sort((a, b) => b.score - a.score);
}

export function buildRiskReplay(result: TokenRiskResult, history: ReplayHistoryPoint[] = []) {
  const holder = buildHolderIntelligence(result);
  const stress = buildStressScenarios(result);
  const delta = historyDelta(history);
  const events = [
    ...historyEvents(history, result),
    ...signalEvents(result),
    ...stressEvents(result, stress),
  ].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  const phases = buildPhases(result, holder, delta);
  const acceleration = clamp(result.score * 0.42 + Math.max(0, delta) * 5 + phases[0].score * 0.28);
  const dominant = phases[0];

  return {
    version: "velmere-shield-risk-replay-v1",
    token: result.token,
    baseScore: result.score,
    accelerationScore: Math.round(acceleration),
    dominantPhase: dominant,
    phases,
    events,
    eventCount: events.length,
    memoryDelta: delta,
    replayNarrative: [
      `Current score is ${result.score}/100 with ${result.confidence !== undefined ? Math.round(result.confidence * 100) : 34}% confidence.`,
      `Dominant replay phase: ${dominant.label} (${dominant.score}/100).`,
      delta ? `Stored-memory delta is ${delta > 0 ? "+" : ""}${delta} points.` : "Stored-memory delta is not strong yet.",
      holder.missingData.length ? `Holder uncertainty remains: ${holder.missingData.join(", ")}.` : "Holder proxy has enough core inputs for first-pass review.",
    ],
    analystControls: [
      "Use replay events to see why a score exists across time instead of trusting a single number.",
      "Escalate only when replay, liquidity, holders and contract layers agree.",
      "Treat missing holder or order-book data as uncertainty, not as proof of safety or wrongdoing.",
    ],
    generatedAt: new Date().toISOString(),
  };
}
