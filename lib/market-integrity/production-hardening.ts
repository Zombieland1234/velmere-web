import type { TokenRiskResult } from "./risk-types";
import { buildEvidenceWorkflow, type EvidenceWorkflowInput } from "./evidence-workflow";
import { buildHolderIntelligence } from "./holder-intelligence";
import type { LiquidityOrderBookInput } from "./liquidity-intelligence";
import { buildProductOpsAudit } from "./product-ops-audit";
import { buildTerminalControlPlane } from "./terminal-control-plane";
import { buildTerminalRiskWorkspace } from "./terminal-risk-workspace";
import { buildVlmShieldAccess } from "./vlm-access-layer";

export type ProductionHardeningStatus = "ready" | "watch" | "blocked";
export type ProductionHardeningLane = "session" | "rate_limit" | "audit" | "export" | "source" | "vlm" | "legal";
export type ProductionHardeningMode = "safe_preview" | "operator_beta" | "production_candidate";

export type ProductionHardeningGate = {
  id: string;
  lane: ProductionHardeningLane;
  label: string;
  status: ProductionHardeningStatus;
  score: number;
  requirement: string;
  currentState: string;
  fixCommand: string;
  releaseRisk: string;
};

export type ProductionHardeningAuditEvent = {
  id: string;
  timestamp: string;
  actor: "system" | "operator" | "ai" | "policy";
  action: string;
  evidence: string;
  retention: string;
};

export type ProductionHardeningRateLimit = {
  id: string;
  label: string;
  publicPreview: string;
  memberSession: string;
  operatorSession: string;
  abuseSignal: string;
  enforcementState: ProductionHardeningStatus;
};

export type ProductionHardeningExportManifest = {
  id: string;
  label: string;
  included: boolean;
  source: string;
  legalRail: string;
};

export type ProductionHardeningSessionCheck = {
  id: string;
  label: string;
  status: ProductionHardeningStatus;
  sessionRule: string;
  blockedUntil: string;
};

export type ProductionHardeningBrief = {
  version: "velmere_production_hardening_v1_pass64";
  symbol: string;
  hardeningScore: number;
  mode: ProductionHardeningMode;
  headline: string;
  gates: ProductionHardeningGate[];
  auditContract: ProductionHardeningAuditEvent[];
  rateLimitPolicy: ProductionHardeningRateLimit[];
  exportManifest: ProductionHardeningExportManifest[];
  sessionAccessChecks: ProductionHardeningSessionCheck[];
  abuseProtectionQueue: Array<{ id: string; priority: "P0" | "P1" | "P2" | "P3"; task: string; acceptance: string }>;
  releaseChecklist: string[];
  safeCopyRules: string[];
  generatedAt: string;
};

export type ProductionHardeningInput = EvidenceWorkflowInput & {
  orderbook?: LiquidityOrderBookInput | null;
  hasOrderBook?: boolean;
  activeCommand?: string;
  sessionMode?: "public_preview" | "operator_session" | "member_session";
  chatEnabled?: boolean;
  accessLayerVisible?: boolean;
};

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function statusFromScore(score: number): ProductionHardeningStatus {
  if (score >= 76) return "ready";
  if (score >= 46) return "watch";
  return "blocked";
}

function modeFromScore(score: number): ProductionHardeningMode {
  if (score >= 82) return "production_candidate";
  if (score >= 52) return "operator_beta";
  return "safe_preview";
}

function commandFor(status: ProductionHardeningStatus, ready: string, watch: string, blocked: string) {
  if (status === "ready") return ready;
  if (status === "watch") return watch;
  return blocked;
}

function sourceMode(result: TokenRiskResult) {
  if (result.dataQuality === "live") return "live source";
  if (result.dataQuality === "partial") return "partial source";
  return "fallback/demo source";
}

export function buildProductionHardening(
  result: TokenRiskResult,
  input: ProductionHardeningInput = {},
): ProductionHardeningBrief {
  const holder = buildHolderIntelligence(result);
  const evidence = buildEvidenceWorkflow(result, input);
  const ops = buildProductOpsAudit(result, input);
  const control = buildTerminalControlPlane(result, input);
  const workspace = buildTerminalRiskWorkspace(result, input);
  const access = buildVlmShieldAccess(result);

  const candlesCount = input.candlesCount ?? result.chart?.sevenDay?.length ?? 0;
  const historyCount = input.historyCount ?? 0;
  const hasOrderBook = Boolean(input.hasOrderBook || input.orderbook);
  const sessionMode = input.sessionMode ?? "public_preview";
  const confidencePercent = Math.round((result.confidence ?? 0.35) * 100);
  const missingDataPenalty = Math.min(22, evidence.missingData.length * 4);

  const sessionScore = clamp(
    42 +
      (sessionMode !== "public_preview" ? 18 : 0) +
      (input.accessLayerVisible ? 10 : 0) +
      (access.pass59AccessGates.filter((gate) => gate.status !== "blocked").length * 5),
  );
  const rateLimitScore = clamp(48 + access.pass62ControlRails.length * 7 + control.releaseRails.filter((rail) => rail.status !== "blocked").length * 4);
  const auditScore = clamp(30 + Math.min(34, historyCount * 2.5) + (result.generatedAt ? 9 : 0) + (workspace.reviewScript.length >= 4 ? 8 : 0));
  const exportScore = clamp(evidence.evidenceGrade * 0.76 + (evidence.exportChecklist.length >= 5 ? 9 : 0) - missingDataPenalty * 0.4);
  const sourceScore = clamp(
    (result.dataQuality === "live" ? 74 : result.dataQuality === "partial" ? 53 : 28) +
      (candlesCount >= 140 ? 9 : candlesCount >= 80 ? 5 : 0) +
      (hasOrderBook ? 8 : 0) +
      (holder.dataCompleteness >= 70 ? 6 : 0),
  );
  const vlmScore = clamp(46 + access.featureMatrix.filter((item) => item.status === "open" || item.status === "api_ready").length * 7 + access.complianceGuardrails.length * 4);
  const legalScore = clamp(58 + evidence.legalGuardrails.length * 5 + workspace.legalGuardrails.length * 5 + (result.score >= 85 ? -6 : 0));

  const gates: ProductionHardeningGate[] = [
    {
      id: "session-access-contract",
      lane: "session",
      label: "Session / access contract",
      status: statusFromScore(sessionScore),
      score: Math.round(sessionScore),
      requirement: "Public preview, member session and operator session must expose different capabilities without investment language.",
      currentState: `${sessionMode.replaceAll("_", " ")} · recommended VLM tier ${access.recommendedTier}`,
      fixCommand: commandFor(statusFromScore(sessionScore), "/prod.session approve scoped access", "/prod.session wire wallet proof", "/prod.session block gated actions"),
      releaseRisk: "Without scoped access, users may see advanced tools without context, limits or policy acceptance.",
    },
    {
      id: "rate-limit-abuse-contract",
      lane: "rate_limit",
      label: "Rate-limit / abuse contract",
      status: statusFromScore(rateLimitScore),
      score: Math.round(rateLimitScore),
      requirement: "Every public endpoint needs per-IP/user limits, bot throttling, abuse reasons and operator-visible denial logs.",
      currentState: `${control.releaseRails.length} release rail(s) · API access remains policy gated`,
      fixCommand: commandFor(statusFromScore(rateLimitScore), "/prod.limits verify rails", "/prod.limits draft middleware", "/prod.limits block public API"),
      releaseRisk: "Unrestricted scans can be abused for scraping, spam, market harassment or noisy evidence exports.",
    },
    {
      id: "persistent-audit-log-contract",
      lane: "audit",
      label: "Persistent audit log contract",
      status: statusFromScore(auditScore),
      score: Math.round(auditScore),
      requirement: "Store who/what/when/source state/command path for every exported or escalated review.",
      currentState: `${historyCount} replay snapshot(s) · generated at ${result.generatedAt}`,
      fixCommand: commandFor(statusFromScore(auditScore), "/prod.audit attach case ledger", "/prod.audit persist session events", "/prod.audit block export"),
      releaseRisk: "A premium terminal without audit logs cannot prove what the operator saw during review.",
    },
    {
      id: "evidence-export-manifest",
      lane: "export",
      label: "Evidence export manifest",
      status: statusFromScore(exportScore),
      score: Math.round(exportScore),
      requirement: "Exports must include source ledger, missing data, model limits, command path, timestamps and legal note.",
      currentState: `${evidence.evidenceGrade}/100 evidence grade · ${evidence.missingData.length} missing block(s)`,
      fixCommand: commandFor(statusFromScore(exportScore), "/prod.export manifest ready", "/prod.export include missing data", "/prod.export keep draft only"),
      releaseRisk: "Evidence can look official if the manifest hides uncertainty, source mode or missing data.",
    },
    {
      id: "source-truth-contract",
      lane: "source",
      label: "Source truth contract",
      status: statusFromScore(sourceScore),
      score: Math.round(sourceScore),
      requirement: "Live, partial, fallback and missing states must be attached to candles, holders, liquidity and AI output.",
      currentState: `${sourceMode(result)} · ${candlesCount} candle(s) · holder completeness ${holder.dataCompleteness}% · depth ${hasOrderBook ? "attached" : "missing"}`,
      fixCommand: commandFor(statusFromScore(sourceScore), "/prod.sources approve visible ledger", "/prod.sources compare fallback", "/prod.sources request live feeds"),
      releaseRisk: "Charts and AI summaries can create false certainty when source quality is not visible in the same viewport.",
    },
    {
      id: "vlm-utility-guardrail-contract",
      lane: "vlm",
      label: "VLM utility guardrail contract",
      status: statusFromScore(vlmScore),
      score: Math.round(vlmScore),
      requirement: "VLM wording must stay membership/access utility only: no ROI, yield, profit or passive income promises.",
      currentState: `${access.tokenRole} · ${access.featureMatrix.length} feature gate(s) · ${access.copyRules.length} copy rule(s)`,
      fixCommand: commandFor(statusFromScore(vlmScore), "/prod.vlm approve utility copy", "/prod.vlm audit copy", "/prod.vlm remove risky language"),
      releaseRisk: "Token access copy can become regulatory risk if it sounds like an investment product.",
    },
    {
      id: "legal-regtech-copy-contract",
      lane: "legal",
      label: "Legal / RegTech copy contract",
      status: statusFromScore(legalScore),
      score: Math.round(legalScore),
      requirement: "Shield must say anomaly, uncertainty and manual review; never accusation, proof or advice.",
      currentState: `${confidencePercent}% model confidence · ${result.score}/100 risk score · ${result.signals.length} signal(s)`,
      fixCommand: commandFor(statusFromScore(legalScore), "/prod.copy approve safe language", "/prod.copy reduce certainty", "/prod.copy block unsafe claims"),
      releaseRisk: "High scores can sound accusatory unless language is explicitly framed as algorithmic risk flag only.",
    },
  ];

  const hardeningScore = Math.round(clamp(
    sessionScore * 0.14 +
      rateLimitScore * 0.14 +
      auditScore * 0.15 +
      exportScore * 0.15 +
      sourceScore * 0.16 +
      vlmScore * 0.13 +
      legalScore * 0.13,
  ));
  const mode = modeFromScore(hardeningScore);

  const now = new Date().toISOString();
  const auditContract: ProductionHardeningAuditEvent[] = [
    {
      id: "scan-intake",
      timestamp: result.generatedAt,
      actor: "system",
      action: "risk scan generated",
      evidence: `${result.token.symbol} · ${result.score}/100 · ${sourceMode(result)}`,
      retention: "Persist for replay when user opens evidence or exports a case.",
    },
    {
      id: "operator-command",
      timestamp: now,
      actor: "operator",
      action: `active command ${input.activeCommand ?? "risk"}`,
      evidence: `Workspace score ${workspace.workspaceScore}/100 · ops score ${ops.opsScore}/100`,
      retention: "Attach selected command and visible source state to the case timeline.",
    },
    {
      id: "ai-brief",
      timestamp: now,
      actor: "ai",
      action: "SOC-style brief prepared",
      evidence: `Confidence ${confidencePercent}% · missing data ${evidence.missingData.length}`,
      retention: "Store prompt, response category and missing-data warnings before export.",
    },
    {
      id: "policy-guardrail",
      timestamp: now,
      actor: "policy",
      action: "safe language rail checked",
      evidence: "Not financial advice. Algorithmic risk flag only. Not legal proof or accusation.",
      retention: "Keep legal rail in export manifest and terminal audit trail.",
    },
  ];

  const rateLimitPolicy: ProductionHardeningRateLimit[] = [
    {
      id: "public-scan-limit",
      label: "Public scan throttle",
      publicPreview: "Low request budget, no bulk evidence export, no automated polling.",
      memberSession: "Higher budget with watchlist context and transparent usage limits.",
      operatorSession: "Case-scoped scans with audit trail and export reason.",
      abuseSignal: "Repeated unknown-token scans, scraping patterns or export loops.",
      enforcementState: "watch",
    },
    {
      id: "ai-prompt-limit",
      label: "AI prompt guard",
      publicPreview: "Short explanations only; no unlimited chat loop.",
      memberSession: "Conversation history allowed with visible uncertainty rails.",
      operatorSession: "Prompt, output and command path logged into case timeline.",
      abuseSignal: "Prompts asking for accusations, guarantees, price calls or harassment.",
      enforcementState: "watch",
    },
    {
      id: "api-depth-limit",
      label: "Depth/orderbook API guard",
      publicPreview: "Unavailable until rate limits and source licensing are confirmed.",
      memberSession: "Read-only depth preview with cache window.",
      operatorSession: "Live depth snapshots with timestamp and source provenance.",
      abuseSignal: "High-frequency depth polling or token enumeration.",
      enforcementState: hasOrderBook ? "watch" : "blocked",
    },
  ];

  const exportManifest: ProductionHardeningExportManifest[] = [
    { id: "case-header", label: "Case header", included: true, source: evidence.caseId, legalRail: "Review ID only; not legal case proof." },
    { id: "source-ledger", label: "Source ledger", included: evidence.sourceLedger.length >= 5, source: `${evidence.sourceLedger.length} ledger row(s)`, legalRail: "Show live/partial/fallback/missing in export." },
    { id: "risk-signals", label: "Risk signals", included: result.signals.length > 0, source: `${result.signals.length} signal(s)`, legalRail: "Signals are anomaly indicators, not accusations." },
    { id: "missing-data", label: "Missing data appendix", included: true, source: `${evidence.missingData.length} missing block(s)`, legalRail: "Missing data increases uncertainty; it never implies safety." },
    { id: "command-path", label: "Command path", included: Boolean(input.activeCommand), source: input.activeCommand ?? "risk", legalRail: "Operator command is workflow trace, not a conclusion." },
    { id: "vlm-access", label: "VLM access state", included: input.accessLayerVisible !== false, source: access.recommendedTier, legalRail: "Access utility only; no investment promise." },
    { id: "legal-note", label: "Legal note", included: true, source: "policy rail", legalRail: "Not financial advice. Algorithmic risk flag only." },
  ];

  const sessionAccessChecks: ProductionHardeningSessionCheck[] = [
    {
      id: "public-preview-scope",
      label: "Public preview scope",
      status: "watch",
      sessionRule: "Can search, open terminal preview and see uncertainty labels; cannot export production evidence or bulk-scan.",
      blockedUntil: "Rate-limit middleware and acceptable-use copy are attached.",
    },
    {
      id: "member-utility-scope",
      label: "VLM member utility scope",
      status: statusFromScore(vlmScore),
      sessionRule: "Can save watchlists, longer replay, AI explanation and evidence snippets as access utility.",
      blockedUntil: "Wallet/session proof, usage limits and non-investment copy are verified.",
    },
    {
      id: "operator-case-scope",
      label: "Operator case scope",
      status: statusFromScore(auditScore),
      sessionRule: "Can run command workflow, export draft evidence and attach audit logs to a case.",
      blockedUntil: "Persistent audit log, export manifest and source registry are stored server-side.",
    },
  ];

  const abuseProtectionQueue = [
    {
      id: "p0-rate-limit-middleware",
      priority: "P0" as const,
      task: "Add route-level rate limits for scan, chat, report, orderbook and export endpoints.",
      acceptance: "Every denied request returns a safe error and writes an abuse/audit reason.",
    },
    {
      id: "p0-export-reason",
      priority: "P0" as const,
      task: "Require export reason and source-ledger visibility before evidence bundle export.",
      acceptance: "Export cannot hide missing data, fallback mode or legal note.",
    },
    {
      id: "p1-wallet-session-proof",
      priority: "P1" as const,
      task: "Wire wallet/session proof for VLM member/pro/research access tiers.",
      acceptance: "Advanced panels know public/member/operator session without investment wording.",
    },
    {
      id: "p1-persistent-audit-table",
      priority: "P1" as const,
      task: "Create persistent audit log storage for command path, prompt, source state and export events.",
      acceptance: "Case timeline can be reconstructed after page refresh or server restart.",
    },
    {
      id: "p2-source-licensing-registry",
      priority: "P2" as const,
      task: "Add data-source policy registry for exchange, DEX, holder and AI outputs.",
      acceptance: "UI can explain what source is licensed, cached, fallback or missing.",
    },
  ];

  const releaseChecklist = [
    "No panel may imply manipulation, fraud or guilt; use anomaly/manual review wording.",
    "Every strong visual must have nearby source quality, uncertainty or missing-data context.",
    "Evidence export requires manifest, timestamp, source ledger, command path and legal note.",
    "Public endpoints require throttling, abuse controls and safe error responses before launch.",
    "VLM copy stays utility/access/membership only; no ROI, yield, dividend, passive income or price promise.",
    "Operator actions must be logged if they affect case status, export status or escalation level.",
  ];

  const safeCopyRules = [
    "Say 'anomalia' instead of accusation.",
    "Say 'wymaga manualnego review' instead of certainty.",
    "Say 'wysoka/średnia/niska niepewność danych' when sources are incomplete.",
    "Say 'Not financial advice. Algorithmic risk flag only.' on reports and exports.",
    "Never present VLM as an investment, ROI product, yield product or passive income mechanism.",
  ];

  return {
    version: "velmere_production_hardening_v1_pass64",
    symbol: result.token.symbol.toUpperCase(),
    hardeningScore,
    mode,
    headline: mode === "production_candidate"
      ? "Production candidate: keep audit/export/rate-limit rails active before public scale."
      : mode === "operator_beta"
        ? "Operator beta: useful terminal spine, but production launch still needs hard gates."
        : "Safe preview: keep this as a transparent review terminal until production contracts are wired.",
    gates,
    auditContract,
    rateLimitPolicy,
    exportManifest,
    sessionAccessChecks,
    abuseProtectionQueue,
    releaseChecklist,
    safeCopyRules,
    generatedAt: now,
  };
}
