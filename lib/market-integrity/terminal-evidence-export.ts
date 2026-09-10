import type { TokenRiskResult } from "./risk-types";
import { buildEvidenceWorkflow } from "./evidence-workflow";
import { buildTerminalSourceTrust } from "./terminal-source-trust";
import { buildTerminalLaunchBridge } from "./terminal-launch-bridge";
import { buildTerminalOperatorCopilot } from "./terminal-operator-copilot";
import type { LiquidityOrderBookInput } from "./liquidity-intelligence";

export type TerminalEvidenceExportState = "draft_ready" | "intake_only" | "blocked";
export type TerminalEvidenceExportLaneState = "ready" | "watch" | "blocked";

export type TerminalEvidenceExportLane = {
  id: string;
  label: string;
  state: TerminalEvidenceExportLaneState;
  detail: string;
  operatorAction: string;
};

export type TerminalEvidenceExportManifestItem = {
  id: string;
  label: string;
  included: boolean;
  quality: TerminalEvidenceExportLaneState;
  note: string;
};

export type TerminalEvidenceExportConsole = {
  version: "velmere_terminal_evidence_export_v1_pass73";
  symbol: string;
  state: TerminalEvidenceExportState;
  exportReadinessScore: number;
  headline: string;
  manifest: TerminalEvidenceExportManifestItem[];
  lanes: TerminalEvidenceExportLane[];
  blockedUntil: string[];
  operatorScript: string[];
  evidenceCopyRules: string[];
  redactionRules: string[];
  legalNote: string;
  generatedAt: string;
};

export type TerminalEvidenceExportInput = {
  historyCount?: number;
  candlesCount?: number;
  chartSource?: string;
  orderbook?: LiquidityOrderBookInput | null;
  hasOrderBook?: boolean;
  activeCommand?: string;
  sessionMode?: "public_preview" | "member_session" | "operator_session";
  walletSessionReady?: boolean;
  exportInfrastructureReady?: boolean;
  rateLimitMiddlewareReady?: boolean;
  persistentAuditLogReady?: boolean;
};

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function laneScore(state: TerminalEvidenceExportLaneState) {
  if (state === "ready") return 18;
  if (state === "watch") return 10;
  return 3;
}

function qualityFromBool(value: boolean, fallback: TerminalEvidenceExportLaneState = "blocked"): TerminalEvidenceExportLaneState {
  return value ? "ready" : fallback;
}

export function buildTerminalEvidenceExport(
  result: TokenRiskResult,
  input: TerminalEvidenceExportInput = {},
): TerminalEvidenceExportConsole {
  const sessionMode = input.sessionMode ?? "operator_session";
  const launchSessionMode = sessionMode === "member_session" ? "member_utility" : sessionMode;
  const candlesCount = input.candlesCount ?? result.chart?.sevenDay?.length ?? 0;
  const historyCount = input.historyCount ?? 0;
  const chartSource = input.chartSource ?? "unknown chart source";
  const evidence = buildEvidenceWorkflow(result, {
    historyCount,
    candlesCount,
    chartSource,
    orderbook: input.orderbook ?? null,
    activeCommand: input.activeCommand ?? "export",
  });
  const sourceTrust = buildTerminalSourceTrust(result, {
    candlesCount,
    chartSource,
    hasOrderBook: Boolean(input.hasOrderBook ?? input.orderbook),
    orderbook: input.orderbook ?? null,
    historyCount,
    activeCommand: input.activeCommand ?? "export",
    searchResolverGuarded: true,
    suggestionDismissOnOutsideClick: true,
    sourceCooldownActive: false,
    terminalBootDeferred: true,
    modalChunkSplit: true,
    tableWheelUnlocked: true,
    walletSessionReady: Boolean(input.walletSessionReady),
    exportInfrastructureReady: Boolean(input.exportInfrastructureReady),
    rateLimitMiddlewareReady: Boolean(input.rateLimitMiddlewareReady),
  });
  const launchBridge = buildTerminalLaunchBridge(result, {
    candlesCount,
    chartSource,
    hasOrderBook: Boolean(input.hasOrderBook ?? input.orderbook),
    historyCount,
    activeCommand: input.activeCommand ?? "export",
    sessionMode: launchSessionMode,
    terminalBootDeferred: true,
    modalChunkSplit: true,
    shieldMapDetached: true,
    tableWheelUnlocked: true,
    searchResolverGuarded: true,
    suggestionDismissOnOutsideClick: true,
    sourceHonestyVisible: true,
  });
  const copilot = buildTerminalOperatorCopilot(result, {
    candlesCount,
    chartSource,
    hasOrderBook: Boolean(input.hasOrderBook ?? input.orderbook),
    orderbookRiskPoints: input.orderbook?.riskPoints,
    historyCount,
    activeCommand: input.activeCommand ?? "export",
    terminalBootDeferred: true,
    shieldMapDetached: true,
    sourceHonestyVisible: true,
    chatHistoryCount: 0,
  });

  const liveCount = sourceTrust.adapters.filter((item) => item.status === "live").length;
  const partialCount = sourceTrust.adapters.filter((item) => item.status === "partial").length;
  const fallbackCount = sourceTrust.adapters.filter((item) => item.status === "fallback").length;
  const blockedCount = sourceTrust.adapters.filter((item) => item.status === "blocked").length;
  const sourceLedgerState: TerminalEvidenceExportLaneState = blockedCount > 0
    ? "blocked"
    : fallbackCount > 0 || partialCount > 0
      ? "watch"
      : "ready";
  const auditState = qualityFromBool(Boolean(input.persistentAuditLogReady), "blocked");
  const exportInfraState = qualityFromBool(Boolean(input.exportInfrastructureReady), evidence.status === "review_ready" ? "watch" : "blocked");
  const sessionState = sessionMode === "operator_session" || input.walletSessionReady ? "ready" : "blocked";
  const rateLimitState = qualityFromBool(Boolean(input.rateLimitMiddlewareReady), "watch");

  const lanes: TerminalEvidenceExportLane[] = [
    {
      id: "evidence-grade",
      label: "Evidence grade",
      state: evidence.evidenceGrade >= 72 ? "ready" : evidence.evidenceGrade >= 42 ? "watch" : "blocked",
      detail: `${evidence.evidenceGrade}/100 · ${evidence.status.replaceAll("_", " ")}`,
      operatorAction: evidence.status === "review_ready" ? "Draft export can be prepared with legal note and source ledger." : "Keep in intake; list missing sources before any export copy.",
    },
    {
      id: "source-ledger",
      label: "Source ledger",
      state: sourceLedgerState,
      detail: `${liveCount} live · ${partialCount} partial · ${fallbackCount} fallback · ${blockedCount} blocked`,
      operatorAction: "Every export must show live/partial/fallback/blocked lanes next to the risk summary.",
    },
    {
      id: "operator-copilot",
      label: "Operator copilot path",
      state: copilot.missingData.length > 3 ? "watch" : "ready",
      detail: `${copilot.confidenceScore}/100 confidence · ${copilot.uncertaintyPercent}% uncertainty`,
      operatorAction: "Use copilot prompts to explain missing data and next review steps without hype.",
    },
    {
      id: "audit-log",
      label: "Persistent audit log",
      state: auditState,
      detail: input.persistentAuditLogReady ? "server-side audit storage ready" : "no persistent audit storage in this package yet",
      operatorAction: "Do not treat an export as production-ready until command path and source snapshot are stored server-side.",
    },
    {
      id: "export-infra",
      label: "Export infrastructure",
      state: exportInfraState,
      detail: input.exportInfrastructureReady ? "export renderer ready" : "manifest only; renderer still blocked",
      operatorAction: "Keep report export as manifest/preview until JSON/PDF renderer, redactions and timestamps are wired.",
    },
    {
      id: "session-gate",
      label: "Session / VLM gate",
      state: sessionState,
      detail: sessionMode.replaceAll("_", " "),
      operatorAction: "VLM remains utility/access only. No investment language, ROI, yield or passive income copy.",
    },
    {
      id: "rate-limit",
      label: "Rate-limit rail",
      state: rateLimitState,
      detail: input.rateLimitMiddlewareReady ? "server throttle ready" : "client cooldown only; server middleware pending",
      operatorAction: "Production export endpoints require server-side throttles, cache and abuse guard before public launch.",
    },
  ];

  const manifest: TerminalEvidenceExportManifestItem[] = [
    {
      id: "case-header",
      label: "Case header",
      included: true,
      quality: "ready",
      note: `${evidence.caseId} · ${result.token.symbol} · generated ${result.generatedAt}`,
    },
    {
      id: "risk-summary",
      label: "Risk summary",
      included: true,
      quality: result.score >= 0 ? "ready" : "blocked",
      note: `${result.score}/100 · ${result.level} · confidence ${Math.round((result.confidence ?? 0.35) * 100)}%`,
    },
    {
      id: "source-ledger",
      label: "Source ledger",
      included: true,
      quality: sourceLedgerState,
      note: "Live/partial/fallback/blocked source mode must be visible in export body.",
    },
    {
      id: "missing-data",
      label: "Missing-data appendix",
      included: evidence.missingData.length > 0,
      quality: evidence.missingData.length ? "watch" : "ready",
      note: evidence.missingData.length ? `${evidence.missingData.length} blocker(s) listed` : "No major missing-data blocker from visible state.",
    },
    {
      id: "command-path",
      label: "Operator command path",
      included: true,
      quality: "watch",
      note: `Active command: ${input.activeCommand ?? "export"}; persistent storage still required for production.` ,
    },
    {
      id: "legal-note",
      label: "Legal note",
      included: true,
      quality: "ready",
      note: "Not financial advice. Algorithmic risk flag only. Manual review required.",
    },
  ];

  const blockedUntil = [
    sourceLedgerState === "blocked" ? "Resolve blocked source lanes or keep export as intake-only preview." : null,
    auditState === "blocked" ? "Connect persistent audit log for command path, prompt and source snapshot." : null,
    exportInfraState === "blocked" ? "Build evidence JSON/PDF renderer with redactions and source timestamps." : null,
    sessionState === "blocked" ? "Connect wallet/session/VLM utility gate before member-only exports." : null,
    rateLimitState !== "ready" ? "Add server-side rate limits/cache before public export endpoints." : null,
    ...launchBridge.p0Blockers.map((item) => `Launch bridge blocker: ${item}`),
  ].filter((item): item is string => Boolean(item));

  const exportReadinessScore = Math.round(clamp(
    lanes.reduce((sum, lane) => sum + laneScore(lane.state), 0) * 0.72 +
      evidence.evidenceGrade * 0.18 +
      sourceTrust.trustScore * 0.10,
  ));
  const state: TerminalEvidenceExportState = blockedUntil.length >= 4
    ? "blocked"
    : exportReadinessScore >= 70 && exportInfraState !== "blocked" && auditState !== "blocked"
      ? "draft_ready"
      : "intake_only";

  return {
    version: "velmere_terminal_evidence_export_v1_pass73",
    symbol: result.token.symbol,
    state,
    exportReadinessScore,
    headline: state === "draft_ready"
      ? "Evidence export can be drafted with source ledger and legal guardrails."
      : state === "intake_only"
        ? "Evidence export stays in intake preview until blocked rails are closed."
        : "Evidence export is blocked for production use until core rails are wired.",
    manifest,
    lanes,
    blockedUntil: Array.from(new Set(blockedUntil)).slice(0, 12),
    operatorScript: [
      "Open Source Trust and verify live/partial/fallback/blocked lanes.",
      "Attach missing-data appendix before any summary leaves the terminal.",
      "Copy AI copilot wording only if it keeps anomaly/review language.",
      "Do not export as production evidence until audit log and renderer are wired.",
      "Keep VLM as access/session layer only; never attach ROI, yield or profit copy.",
    ],
    evidenceCopyRules: [
      "Say: anomaly, requires review, uncertainty, data gap, source limitation.",
      "Do not say: scam, fraud, guaranteed, proof, safe, buy, sell, hold.",
      "Explain why a score moved and which source is missing before escalation.",
      "Every export must include: Not financial advice. Algorithmic risk flag only.",
    ],
    redactionRules: [
      "Do not expose private scoring weights, thresholds or proprietary heuristics.",
      "Redact raw wallet labels until source licensing and chain attribution are verified.",
      "Hide internal operator notes from public exports unless reviewed.",
      "Keep API keys, provider names under NDA and private rule ids out of public copy.",
    ],
    legalNote: "Evidence export is a controlled triage preview. It is not financial advice, legal proof, an accusation, or an investment promise.",
    generatedAt: new Date().toISOString(),
  };
}
