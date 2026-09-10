import type { TokenRiskResult } from "./risk-types";
import { buildEvidenceWorkflow, type EvidenceWorkflowInput } from "./evidence-workflow";
import { buildHolderIntelligence } from "./holder-intelligence";
import { buildLiquidityIntelligence, type LiquidityOrderBookInput } from "./liquidity-intelligence";
import { buildTerminalReadiness, type TerminalReadinessInput } from "./terminal-readiness";
import { buildVlmShieldAccess } from "./vlm-access-layer";

export type ProductOpsAuditStatus = "ready" | "watch" | "blocked";
export type ProductOpsAuditMode = "demo_ops" | "operator_preview" | "launch_candidate";

export type ProductOpsAuditGate = {
  id: string;
  label: string;
  status: ProductOpsAuditStatus;
  score: number;
  evidence: string;
  operatorAction: string;
  customerRisk: string;
};

export type ProductOpsAuditTimelineItem = {
  id: string;
  label: string;
  timestamp: string;
  status: ProductOpsAuditStatus;
  detail: string;
};

export type ProductOpsAuditBrief = {
  version: "velmere_product_ops_audit_v2_pass62_control_plane";
  symbol: string;
  mode: ProductOpsAuditMode;
  opsScore: number;
  headline: string;
  gates: ProductOpsAuditGate[];
  sourceCockpit: Array<{ id: string; label: string; status: ProductOpsAuditStatus; detail: string }>;
  caseTimeline: ProductOpsAuditTimelineItem[];
  exportPayload: Array<{ key: string; value: string; guardrail: string }>;
  commandHistory: Array<{ command: string; expectedResult: string; auditNote: string }>;
  abuseControls: string[];
  launchBlockers: string[];
  legalGuardrails: string[];
  generatedAt: string;
};

export type ProductOpsAuditInput = EvidenceWorkflowInput & TerminalReadinessInput & {
  orderbook?: LiquidityOrderBookInput | null;
  activeCommand?: string;
  sessionMode?: "public_preview" | "operator_session" | "member_session";
};

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function statusFromScore(score: number): ProductOpsAuditStatus {
  if (score >= 74) return "ready";
  if (score >= 44) return "watch";
  return "blocked";
}

function modeFromScore(score: number): ProductOpsAuditMode {
  if (score >= 78) return "launch_candidate";
  if (score >= 48) return "operator_preview";
  return "demo_ops";
}

function commandFor(status: ProductOpsAuditStatus, readyCommand: string, watchCommand: string, blockedCommand: string) {
  if (status === "ready") return readyCommand;
  if (status === "watch") return watchCommand;
  return blockedCommand;
}

function compactSourceMode(source?: string) {
  const raw = (source ?? "unknown source").toLowerCase();
  if (raw.includes("binance")) return "binance klines";
  if (raw.includes("sparkline")) return "sparkline fallback";
  if (raw.includes("market")) return "market metrics";
  return source ?? "unknown source";
}

export function buildProductOpsAudit(
  result: TokenRiskResult,
  input: ProductOpsAuditInput = {},
): ProductOpsAuditBrief {
  const holder = buildHolderIntelligence(result);
  const liquidity = buildLiquidityIntelligence(result, input.orderbook);
  const evidence = buildEvidenceWorkflow(result, input);
  const readiness = buildTerminalReadiness(result, input);
  const access = buildVlmShieldAccess(result);

  const confidencePercent = Math.round((result.confidence ?? 0.35) * 100);
  const candlesCount = input.candlesCount ?? result.chart?.sevenDay?.length ?? 0;
  const historyCount = input.historyCount ?? 0;
  const sourceFreshnessScore = clamp(
    (result.dataQuality === "live" ? 72 : result.dataQuality === "partial" ? 50 : 24) +
      (candlesCount >= 120 ? 10 : candlesCount >= 60 ? 5 : 0) +
      (historyCount >= 12 ? 7 : 0) +
      (input.hasOrderBook || input.orderbook ? 6 : 0),
  );
  const exportScore = clamp(evidence.evidenceGrade * 0.74 + (evidence.missingData.length <= 3 ? 12 : 0) + (confidencePercent >= 65 ? 8 : 0));
  const commandScore = clamp(
    54 +
      (input.activeCommand ? 7 : 0) +
      (historyCount >= 3 ? 7 : 0) +
      (liquidity.analystCommands.length >= 4 ? 6 : 0) +
      (evidence.analystCommands.length >= 4 ? 6 : 0) -
      (holder.dataUncertaintyPercent > 58 ? 8 : 0),
  );
  const auditLogScore = clamp(30 + Math.min(32, historyCount * 2.4) + (result.generatedAt ? 8 : 0) + (result.dataSources.length >= 2 ? 8 : 0));
  const abuseControlScore = clamp(58 + (access.pass60PolicySpine.length >= 3 ? 9 : 0) + (readiness.legalGuardrails.length >= 3 ? 9 : 0));
  const vlmPolicyScore = clamp(access.featureMatrix.filter((item) => item.status === "open" || item.status === "api_ready").length * 10 + 36);
  const psychologyScore = clamp(70 + (liquidity.uncertaintyPercent < 45 ? 6 : 0) + (evidence.sourceLedger.length >= 5 ? 5 : 0) - (result.score >= 82 ? 5 : 0));

  const gates: ProductOpsAuditGate[] = [
    {
      id: "source-freshness",
      label: "Source freshness cockpit",
      status: statusFromScore(sourceFreshnessScore),
      score: Math.round(sourceFreshnessScore),
      evidence: `${result.dataQuality} · ${result.dataSources.length} source(s) · ${candlesCount} bars · ${compactSourceMode(input.chartSource)}`,
      operatorAction: commandFor(statusFromScore(sourceFreshnessScore), "/source.audit confirm freshness", "/source.audit compare live fallback", "/source.request live candles orderbook holders"),
      customerRisk: "Premium visuals can create false confidence if live/partial/fallback state is hidden.",
    },
    {
      id: "evidence-export",
      label: "Evidence exportability",
      status: statusFromScore(exportScore),
      score: Math.round(exportScore),
      evidence: `${evidence.evidenceGrade}/100 evidence grade · ${evidence.missingData.length} missing block(s)`,
      operatorAction: commandFor(statusFromScore(exportScore), "/case.export json legal-note", "/case.export draft missing-data", "/case.block export until sources resolved"),
      customerRisk: "Reports must remain triage material, not proof, advice or accusation.",
    },
    {
      id: "command-workflow",
      label: "Command workflow trace",
      status: statusFromScore(commandScore),
      score: Math.round(commandScore),
      evidence: `active command ${input.activeCommand ?? "risk"} · ${evidence.analystCommands.length} evidence command(s)`,
      operatorAction: commandFor(statusFromScore(commandScore), "/command.log attach case", "/command.replay active path", "/command.define missing actions"),
      customerRisk: "AI should guide analysts through actions, not only produce decorative explanation copy.",
    },
    {
      id: "audit-ledger",
      label: "Audit log spine",
      status: statusFromScore(auditLogScore),
      score: Math.round(auditLogScore),
      evidence: `${historyCount} replay snapshot(s) · generated ${result.generatedAt}`,
      operatorAction: commandFor(statusFromScore(auditLogScore), "/audit.attach replay ledger", "/audit.persist more snapshots", "/audit.enable persistent session log"),
      customerRisk: "Without a timeline, analysts cannot prove what the terminal showed at the review moment.",
    },
    {
      id: "abuse-controls",
      label: "Rate-limit / abuse controls",
      status: statusFromScore(abuseControlScore),
      score: Math.round(abuseControlScore),
      evidence: `${readiness.legalGuardrails.length} legal guardrail(s) · ${access.pass60PolicySpine.length} policy spine item(s)`,
      operatorAction: commandFor(statusFromScore(abuseControlScore), "/policy.verify limits", "/policy.draft abuse controls", "/policy.block public launch"),
      customerRisk: "Public endpoints need rate limits, acceptable-use policy and audit logs before real usage.",
    },
    {
      id: "vlm-policy",
      label: "VLM utility access policy",
      status: statusFromScore(vlmPolicyScore),
      score: Math.round(vlmPolicyScore),
      evidence: `${access.recommendedTier} · ${access.featureMatrix.length} feature gate(s) · utility only`,
      operatorAction: commandFor(statusFromScore(vlmPolicyScore), "/vlm.policy verify utility", "/vlm.gate wallet session limits", "/vlm.remove investment wording"),
      customerRisk: "VLM must stay access/membership utility, not ROI, yield or passive income messaging.",
    },
    {
      id: "ux-psychology",
      label: "UX psychology safety",
      status: statusFromScore(psychologyScore),
      score: Math.round(psychologyScore),
      evidence: `${liquidity.uncertaintyPercent}% liquidity uncertainty · ${holder.dataUncertaintyPercent}% holder uncertainty`,
      operatorAction: commandFor(statusFromScore(psychologyScore), "/ux.verify uncertainty labels", "/ux.reduce visual overconfidence", "/ux.block strong claim components"),
      customerRisk: "Dark premium design must not make uncertain model output feel like certainty.",
    },
  ];

  const opsScore = Math.round(clamp(
    sourceFreshnessScore * 0.17 +
      exportScore * 0.17 +
      commandScore * 0.14 +
      auditLogScore * 0.13 +
      abuseControlScore * 0.13 +
      vlmPolicyScore * 0.13 +
      psychologyScore * 0.13,
  ));
  const mode = modeFromScore(opsScore);

  const sourceCockpit = [
    { id: "data-quality", label: "Data quality", status: result.dataQuality === "live" ? "ready" as const : result.dataQuality === "partial" ? "watch" as const : "blocked" as const, detail: `${result.dataQuality} data mode` },
    { id: "candles", label: "Candles", status: candlesCount >= 120 ? "ready" as const : candlesCount >= 60 ? "watch" as const : "blocked" as const, detail: `${candlesCount} bar(s) · ${compactSourceMode(input.chartSource)}` },
    { id: "orderbook", label: "Order book", status: input.hasOrderBook || input.orderbook ? "ready" as const : "blocked" as const, detail: input.hasOrderBook || input.orderbook ? liquidity.sourceTruth : "live depth missing" },
    { id: "holders", label: "Holders", status: statusFromScore(holder.dataCompleteness), detail: `${holder.dataCompleteness}% complete · ${holder.dataUncertaintyPercent}% uncertainty` },
    { id: "replay", label: "Replay", status: historyCount >= 12 ? "ready" as const : historyCount >= 3 ? "watch" as const : "blocked" as const, detail: `${historyCount} snapshot(s)` },
  ];

  const now = new Date().toISOString();
  const caseTimeline: ProductOpsAuditTimelineItem[] = [
    { id: "intake", label: "Token intake", timestamp: result.generatedAt, status: "ready", detail: `${result.token.symbol} loaded with ${result.signals.length} risk signal(s).` },
    { id: "source-audit", label: "Source audit", timestamp: now, status: sourceCockpit.some((item) => item.status === "blocked") ? "watch" : "ready", detail: "Live/partial/fallback state recorded before evidence export." },
    { id: "ai-review", label: "AI SOC review", timestamp: now, status: statusFromScore(commandScore), detail: `Active command path: ${input.activeCommand ?? "risk"}.` },
    { id: "case-export", label: "Case export gate", timestamp: now, status: statusFromScore(exportScore), detail: evidence.status === "review_ready" ? "Export can be drafted with legal note." : "Keep in intake until missing blocks are documented." },
  ];

  const launchBlockers = [
    result.dataQuality !== "live" ? "stable live source freshness contract" : null,
    candlesCount < 120 ? "dense klines for the selected interval" : null,
    !input.hasOrderBook && !input.orderbook ? "live order book / DEX pool depth" : null,
    holder.dataCompleteness < 70 ? "real holder API with wallet labels" : null,
    historyCount < 12 ? "persistent audit timeline with replay snapshots" : null,
    "production rate limits and abuse monitoring",
    "wallet/session gating for VLM access",
    "Terms, privacy, acceptable-use and data-source policy pack",
  ].filter((item): item is string => Boolean(item));

  return {
    version: "velmere_product_ops_audit_v2_pass62_control_plane",
    symbol: result.token.symbol,
    mode,
    opsScore,
    headline: `PASS62 ops audit: ${result.token.symbol} is in ${mode.replaceAll("_", " ")} at ${opsScore}/100. This is product-operational readiness, not investment quality.`,
    gates,
    sourceCockpit,
    caseTimeline,
    exportPayload: [
      { key: "riskScore", value: `${result.score}/100`, guardrail: "Score is triage priority, not proof." },
      { key: "evidenceGrade", value: `${evidence.evidenceGrade}/100`, guardrail: "Export must include missing data." },
      { key: "holderUncertainty", value: `${holder.dataUncertaintyPercent}%`, guardrail: "Unknown wallet buckets cannot be treated as safe." },
      { key: "liquidityUncertainty", value: `${liquidity.uncertaintyPercent}%`, guardrail: "Depth warnings are anomaly flags only." },
      { key: "vlmAccess", value: access.recommendedTier, guardrail: "VLM is utility/access only; no ROI/yield/passive income." },
    ],
    commandHistory: [
      { command: "/source.audit", expectedResult: "Show live/partial/fallback state for every visual.", auditNote: "Blocks false confidence from premium UI." },
      { command: "/case.timeline", expectedResult: "Attach timestamps, score, source quality and active command.", auditNote: "Creates review trace for analyst handoff." },
      { command: "/case.export", expectedResult: "Draft evidence JSON with legal note and missing data.", auditNote: "Never exports accusation or financial advice." },
      { command: "/vlm.policy", expectedResult: "Verify access layer, member limits and no investment wording.", auditNote: "Keeps VLM positioned as utility." },
    ],
    abuseControls: [
      "Add per-IP and per-wallet API rate limits before public endpoints are promoted.",
      "Keep automated report exports behind authenticated operator/member sessions.",
      "Log command execution and report export timestamps for later audit review.",
      "Block public wording that implies fraud proof, guaranteed safety or investment outcome.",
    ],
    launchBlockers: Array.from(new Set(launchBlockers)).slice(0, 10),
    legalGuardrails: [
      "Not financial advice. Algorithmic risk flag only.",
      "Anomaly language only; no scam/fraud/manipulation proof wording.",
      "Manual review is required before enforcement, moderation or public claims.",
      "VLM is utility/access only and must not promise ROI, yield, dividends or passive income.",
    ],
    generatedAt: now,
  };
}
