import type { TokenRiskResult } from "./risk-types";
import { buildEvidenceWorkflow, type EvidenceWorkflowInput } from "./evidence-workflow";
import { buildHolderIntelligence } from "./holder-intelligence";
import { buildLiquidityIntelligence, type LiquidityOrderBookInput } from "./liquidity-intelligence";
import { buildProductOpsAudit } from "./product-ops-audit";
import { buildTerminalControlPlane } from "./terminal-control-plane";
import { buildTerminalReadiness, type TerminalReadinessInput } from "./terminal-readiness";
import { buildVlmShieldAccess } from "./vlm-access-layer";

export type TerminalRiskWorkspaceStatus = "ready" | "watch" | "blocked";
export type TerminalRiskWorkspaceLane = "source" | "market" | "holders" | "liquidity" | "evidence" | "policy" | "operator";
export type TerminalRiskWorkspaceMode = "intake_review" | "operator_workspace" | "release_candidate";

export type TerminalRiskWorkspaceDecisionCard = {
  id: string;
  lane: TerminalRiskWorkspaceLane;
  label: string;
  status: TerminalRiskWorkspaceStatus;
  score: number;
  decision: string;
  blockedUntil: string;
  operatorCommand: string;
  confidenceGuard: string;
};

export type TerminalRiskWorkspacePolicyItem = {
  id: string;
  label: string;
  status: TerminalRiskWorkspaceStatus;
  owner: "data" | "legal" | "product" | "security" | "ops";
  rule: string;
  failureMode: string;
};

export type TerminalRiskWorkspaceSourceItem = {
  id: string;
  label: string;
  state: "live" | "partial" | "fallback" | "missing";
  freshness: string;
  visibleInUi: boolean;
  requiredForProduction: string;
};

export type TerminalRiskWorkspaceStep = {
  id: string;
  label: string;
  ifTrue: string;
  ifFalse: string;
  safeLanguage: string;
};

export type TerminalRiskWorkspaceBrief = {
  version: "velmere_terminal_risk_workspace_v1_pass63";
  symbol: string;
  workspaceScore: number;
  mode: TerminalRiskWorkspaceMode;
  headline: string;
  decisionCards: TerminalRiskWorkspaceDecisionCard[];
  policyRegistry: TerminalRiskWorkspacePolicyItem[];
  sourceRegistry: TerminalRiskWorkspaceSourceItem[];
  operatorDecisionTree: TerminalRiskWorkspaceStep[];
  uiFrictionControls: string[];
  reviewScript: string[];
  legalGuardrails: string[];
  generatedAt: string;
};

export type TerminalRiskWorkspaceInput = EvidenceWorkflowInput & TerminalReadinessInput & {
  orderbook?: LiquidityOrderBookInput | null;
  activeCommand?: string;
  sessionMode?: "public_preview" | "operator_session" | "member_session";
};

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function statusFromScore(score: number): TerminalRiskWorkspaceStatus {
  if (score >= 74) return "ready";
  if (score >= 44) return "watch";
  return "blocked";
}

function sourceState(result: TokenRiskResult, hasSource: boolean): "live" | "partial" | "fallback" | "missing" {
  if (!hasSource) return "missing";
  if (result.dataQuality === "live") return "live";
  if (result.dataQuality === "partial") return "partial";
  return "fallback";
}

function modeFromScore(score: number): TerminalRiskWorkspaceMode {
  if (score >= 80) return "release_candidate";
  if (score >= 48) return "operator_workspace";
  return "intake_review";
}

function commandFor(status: TerminalRiskWorkspaceStatus, ready: string, watch: string, blocked: string) {
  if (status === "ready") return ready;
  if (status === "watch") return watch;
  return blocked;
}

export function buildTerminalRiskWorkspace(
  result: TokenRiskResult,
  input: TerminalRiskWorkspaceInput = {},
): TerminalRiskWorkspaceBrief {
  const holder = buildHolderIntelligence(result);
  const liquidity = buildLiquidityIntelligence(result, input.orderbook);
  const evidence = buildEvidenceWorkflow(result, input);
  const readiness = buildTerminalReadiness(result, input);
  const ops = buildProductOpsAudit(result, input);
  const control = buildTerminalControlPlane(result, input);
  const access = buildVlmShieldAccess(result);

  const candlesCount = input.candlesCount ?? result.chart?.sevenDay?.length ?? 0;
  const historyCount = input.historyCount ?? 0;
  const confidencePercent = Math.round((result.confidence ?? 0.35) * 100);
  const hasOrderbook = Boolean(input.hasOrderBook || input.orderbook);
  const activeCommand = input.activeCommand ?? "risk";

  const sourceScore = clamp(
    (result.dataQuality === "live" ? 74 : result.dataQuality === "partial" ? 52 : 28) +
      (candlesCount >= 120 ? 8 : candlesCount >= 60 ? 4 : 0) +
      (historyCount >= 12 ? 6 : 0),
  );
  const marketStructureScore = clamp(
    (candlesCount >= 150 ? 72 : candlesCount >= 90 ? 56 : candlesCount >= 30 ? 38 : 22) +
      (input.chartSource?.toLowerCase().includes("binance") ? 10 : 0) +
      (readiness.gates.find((gate) => gate.id === "chart")?.score ?? 0) * 0.12,
  );
  const holderScore = clamp(holder.dataCompleteness - holder.dataUncertaintyPercent * 0.18 + (holder.clusterMap.length >= 5 ? 8 : 0));
  const liquidityScore = clamp(100 - liquidity.uncertaintyPercent - liquidity.liquidityScore * 0.18 + (hasOrderbook ? 10 : 0));
  const evidenceScore = clamp(evidence.evidenceGrade + (evidence.missingData.length <= 3 ? 7 : -7) + (historyCount >= 6 ? 5 : 0));
  const policyScore = clamp(
    access.complianceGuardrails.length * 9 +
      access.pass59AccessGates.filter((gate) => gate.status !== "blocked").length * 7 +
      access.pass60PolicySpine.filter((policy) => policy.status !== "blocked").length * 6 +
      24,
  );
  const operatorScore = clamp((ops.opsScore + control.controlScore + readiness.overallReadiness) / 3 + (activeCommand ? 4 : 0));

  const sourceStatus = statusFromScore(sourceScore);
  const marketStatus = statusFromScore(marketStructureScore);
  const holderStatus = statusFromScore(holderScore);
  const liquidityStatus = statusFromScore(liquidityScore);
  const evidenceStatus = statusFromScore(evidenceScore);
  const policyStatus = statusFromScore(policyScore);
  const operatorStatus = statusFromScore(operatorScore);

  const decisionCards: TerminalRiskWorkspaceDecisionCard[] = [
    {
      id: "source-truth-decision",
      lane: "source",
      label: "Source truth decision",
      status: sourceStatus,
      score: Math.round(sourceScore),
      decision: sourceStatus === "ready" ? "Allow analyst preview with visible source ledger." : "Keep in manual review until source state is explained near each visual.",
      blockedUntil: sourceStatus === "ready" ? "Regression check only" : "Live/partial/fallback state is visible for candles, holders, liquidity and evidence.",
      operatorCommand: commandFor(sourceStatus, "/workspace.source approve visible-ledger", "/workspace.source compare fallback live", "/workspace.source block strong conclusions"),
      confidenceGuard: `Current confidence ${confidencePercent}%; confidence cannot override source quality.`,
    },
    {
      id: "market-structure-decision",
      lane: "market",
      label: "Market structure decision",
      status: marketStatus,
      score: Math.round(marketStructureScore),
      decision: marketStatus === "ready" ? "Candles can anchor the review." : "Use candles as context only; do not imply exchange-grade certainty.",
      blockedUntil: "All timeframes expose bar count, source and fallback mode.",
      operatorCommand: commandFor(marketStatus, "/workspace.chart compare 1m 15m 1h 4h 1d 7d", "/workspace.chart label sparse-bars", "/workspace.chart request exchange-klines"),
      confidenceGuard: `${candlesCount} candle(s) loaded from ${input.chartSource ?? "unknown chart source"}.`,
    },
    {
      id: "holder-label-decision",
      lane: "holders",
      label: "Holder label decision",
      status: holderStatus,
      score: Math.round(holderScore),
      decision: holderStatus === "ready" ? "Cluster map is usable for triage." : "Keep unknown/custody/team buckets separated and increase uncertainty.",
      blockedUntil: "CEX/custody, team/treasury, DEX/LP, whale and retail labels have source provenance.",
      operatorCommand: commandFor(holderStatus, "/workspace.holders attach label-provenance", "/workspace.holders review unknown bucket", "/workspace.holders request chain-indexer"),
      confidenceGuard: `Holder completeness ${holder.dataCompleteness}% with ${holder.dataUncertaintyPercent}% uncertainty.`,
    },
    {
      id: "liquidity-depth-decision",
      lane: "liquidity",
      label: "Liquidity depth decision",
      status: liquidityStatus,
      score: Math.round(liquidityScore),
      decision: liquidityStatus === "ready" ? "Depth layer can support execution-risk review." : "Treat liquidity as uncertainty; block strong exit-depth claims.",
      blockedUntil: "Live order book or DEX pool depth is attached with slippage ladder and timestamp.",
      operatorCommand: commandFor(liquidityStatus, "/workspace.liquidity attach depth snapshot", "/workspace.liquidity simulate 10k 50k", "/workspace.liquidity mark depth missing"),
      confidenceGuard: `${liquidity.sourceMode} · ${liquidity.uncertaintyPercent}% liquidity uncertainty.`,
    },
    {
      id: "evidence-export-decision",
      lane: "evidence",
      label: "Evidence export decision",
      status: evidenceStatus,
      score: Math.round(evidenceScore),
      decision: evidenceStatus === "ready" ? "Draft evidence export can be generated with legal note." : "Keep case in intake until missing data is listed and visible.",
      blockedUntil: "Export contains source ledger, missing data, command path, timestamp and legal guardrails.",
      operatorCommand: commandFor(evidenceStatus, "/workspace.evidence export draft", "/workspace.evidence add missing-data", "/workspace.evidence block export"),
      confidenceGuard: `${evidence.evidenceGrade}/100 evidence grade; reports are triage, not proof.`,
    },
    {
      id: "policy-access-decision",
      lane: "policy",
      label: "Policy and VLM access decision",
      status: policyStatus,
      score: Math.round(policyScore),
      decision: "VLM remains utility/access only. No investment language is allowed in UI, reports or membership copy.",
      blockedUntil: policyStatus === "ready" ? "Policy regression check only" : "ToS, privacy, data-source policy, acceptable use and utility disclaimer are complete.",
      operatorCommand: commandFor(policyStatus, "/workspace.policy verify legal rails", "/workspace.policy draft source pages", "/workspace.policy block public access"),
      confidenceGuard: `${access.recommendedTier} access recommendation is not a token value or ROI signal.`,
    },
    {
      id: "operator-session-decision",
      lane: "operator",
      label: "Operator session decision",
      status: operatorStatus,
      score: Math.round(operatorScore),
      decision: operatorStatus === "ready" ? "Operator workflow can guide review." : "Operator workflow needs persistent logs, rate limits and case handoff before launch.",
      blockedUntil: "Command history, audit log, rate limits and case owner are persisted server-side.",
      operatorCommand: commandFor(operatorStatus, "/workspace.ops attach session log", "/workspace.ops assign owner", "/workspace.ops require audit storage"),
      confidenceGuard: `Active command path: ${activeCommand}. UI guidance is not an autonomous enforcement action.`,
    },
  ];

  const sourceRegistry: TerminalRiskWorkspaceSourceItem[] = [
    {
      id: "source-candles",
      label: "Candles / OHLCV",
      state: candlesCount >= 120 && input.chartSource?.toLowerCase().includes("binance") ? "live" : candlesCount > 0 ? sourceState(result, true) : "missing",
      freshness: candlesCount >= 120 ? `${candlesCount} bars loaded` : `${candlesCount} bars; sparse or fallback mode`,
      visibleInUi: true,
      requiredForProduction: "Binance/CEX/Dex OHLCV adapter with per-range bar count and timestamp.",
    },
    {
      id: "source-orderbook",
      label: "Order book / depth",
      state: hasOrderbook ? "live" : "missing",
      freshness: hasOrderbook ? liquidity.sourceTruth : "live depth missing",
      visibleInUi: true,
      requiredForProduction: "Multi-exchange CEX book and DEX pool depth with stale snapshot detection.",
    },
    {
      id: "source-holders",
      label: "Holder labels",
      state: holder.dataCompleteness >= 72 ? "partial" : holder.dataCompleteness > 0 ? "fallback" : "missing",
      freshness: `${holder.dataCompleteness}% complete · ${holder.dataUncertaintyPercent}% uncertain`,
      visibleInUi: true,
      requiredForProduction: "Holder-flow indexer, CEX/custody registry, team wallet registry and label provenance.",
    },
    {
      id: "source-replay",
      label: "Replay history",
      state: historyCount >= 12 ? "live" : historyCount > 0 ? "partial" : "missing",
      freshness: `${historyCount} snapshot(s) attached`,
      visibleInUi: true,
      requiredForProduction: "Persistent risk snapshots with immutable case timestamps and command history.",
    },
    {
      id: "source-policy",
      label: "Policy / legal pack",
      state: access.pass60PolicySpine.length >= 4 ? "partial" : "fallback",
      freshness: `${access.pass60PolicySpine.length} policy spine item(s) visible`,
      visibleInUi: true,
      requiredForProduction: "Public data-source policy, terms, privacy, acceptable-use and VLM utility disclaimer pages.",
    },
  ];

  const policyRegistry: TerminalRiskWorkspacePolicyItem[] = [
    {
      id: "policy-language",
      label: "RegTech language policy",
      status: "ready",
      owner: "legal",
      rule: "Use anomaly, review priority and uncertainty language. Never accuse token/team/wallet intent.",
      failureMode: "Public UI sounds like an allegation or legal conclusion.",
    },
    {
      id: "policy-source-honesty",
      label: "Source honesty policy",
      status: sourceRegistry.some((item) => item.state === "missing") ? "watch" : "ready",
      owner: "data",
      rule: "Every major panel must expose live/partial/fallback/missing state before conclusions.",
      failureMode: "Premium visuals hide weak data and create false confidence.",
    },
    {
      id: "policy-vlm-utility",
      label: "VLM utility-only policy",
      status: policyStatus,
      owner: "product",
      rule: "VLM is access/membership utility only; no ROI, yield, passive income or price language.",
      failureMode: "Membership copy drifts into investment promotion.",
    },
    {
      id: "policy-rate-limits",
      label: "Abuse and rate-limit policy",
      status: historyCount >= 12 ? "watch" : "blocked",
      owner: "security",
      rule: "Production endpoints require rate limits, command audit logs and acceptable-use enforcement.",
      failureMode: "Public terminal can be scraped, spammed or used for unsafe public claims.",
    },
    {
      id: "policy-export",
      label: "Evidence export policy",
      status: evidenceStatus,
      owner: "ops",
      rule: "Exports must include source ledger, missing data, manual-review state and legal note.",
      failureMode: "Report is mistaken for investment advice, proof or accusation.",
    },
  ];

  const operatorDecisionTree: TerminalRiskWorkspaceStep[] = [
    {
      id: "decision-source",
      label: "Are live/partial/fallback states visible?",
      ifTrue: "Continue to market structure and holder review.",
      ifFalse: "Block strong conclusions and open source audit.",
      safeLanguage: "Current data state requires manual review before interpretation.",
    },
    {
      id: "decision-liquidity",
      label: "Is live depth or DEX pool depth attached?",
      ifTrue: "Use slippage/depth stress as execution-risk context.",
      ifFalse: "Keep liquidity score as uncertainty; do not present exit depth as confirmed.",
      safeLanguage: "Liquidity depth is incomplete; this is an uncertainty flag, not proof of manipulation.",
    },
    {
      id: "decision-holders",
      label: "Are key holder buckets labelled with provenance?",
      ifTrue: "Review whales/CEX/DEX/team/retail separately.",
      ifFalse: "Treat unknown bucket as unresolved data, not safe distribution.",
      safeLanguage: "Holder labels are incomplete and require additional on-chain review.",
    },
    {
      id: "decision-export",
      label: "Can the case be exported?",
      ifTrue: "Generate draft evidence export with disclaimer and missing data section.",
      ifFalse: "Keep case in intake and list missing data before export.",
      safeLanguage: "Evidence export is algorithmic triage only. Not financial advice. Algorithmic risk flag only.",
    },
  ];

  const workspaceScore = Math.round(clamp(
    sourceScore * 0.14 +
      marketStructureScore * 0.13 +
      holderScore * 0.13 +
      liquidityScore * 0.13 +
      evidenceScore * 0.16 +
      policyScore * 0.16 +
      operatorScore * 0.15,
  ));
  const mode = modeFromScore(workspaceScore);
  const blockedCount = decisionCards.filter((card) => card.status === "blocked").length;

  return {
    version: "velmere_terminal_risk_workspace_v1_pass63",
    symbol: result.token.symbol,
    workspaceScore,
    mode,
    headline: `PASS63 workspace: ${result.token.symbol} is in ${mode.replaceAll("_", " ")} at ${workspaceScore}/100 with ${blockedCount} blocked production lane(s).`,
    decisionCards,
    policyRegistry,
    sourceRegistry,
    operatorDecisionTree,
    uiFrictionControls: [
      "High uncertainty lanes use amber friction, not green approval styling.",
      "Scores are paired with source state, blocked-until text and operator command.",
      "Export actions stay behind evidence guardrails and manual-review copy.",
      "VLM access panels describe permissions, limits and membership, never token value.",
      "The main page remains clean; full decision logic stays inside the modal workspace.",
    ],
    reviewScript: [
      `Open ${activeCommand} command path and confirm source states before reading the score.`,
      "Check candles across 1m, 15m, 1h, 4h, 1d and 7d for structure mismatch.",
      "Review holder unknown bucket separately from whale/CEX/team/retail labels.",
      "Mark missing order book depth as uncertainty before interpreting liquidity anomalies.",
      "Export only after missing data, legal note and manual-review state are attached.",
    ],
    legalGuardrails: [
      "Not financial advice. Algorithmic risk flag only.",
      "No token, team or wallet is accused by Shield output; use anomaly and review wording.",
      "VLM is utility/access only and must not promise ROI, yield, dividends, price appreciation or passive income.",
      "Manual review is required before public claims, moderation, enforcement or external escalation.",
    ],
    generatedAt: new Date().toISOString(),
  };
}
