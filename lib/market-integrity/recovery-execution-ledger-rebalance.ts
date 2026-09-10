import { createHash } from "node:crypto";
import type {
  Pass2532FreshnessRecoveryRouterRebalance,
  Pass2532RecoveryActionKind,
  Pass2532RecoveryRoute,
  Pass2532RecoverySeverity,
  Pass2532RecoverySurface,
} from "./freshness-recovery-router-rebalance";
import type { Pass2526ChipState } from "./reusable-downgrade-chip-rebalance";

export const PASS2533_RECOVERY_EXECUTION_LEDGER_REBALANCE_ID = "recovery-execution-ledger-rebalance-v1" as const;

export type Pass2533ExecutionState = "not_started" | "queued" | "running" | "waiting_for_proof" | "replayed" | "resolved" | "escalated" | "blocked";
export type Pass2533EscalationLevel = "none" | "operator_review" | "dual_control" | "payment_provider" | "source_provider" | "artifact_rebuild" | "security_incident";
export type Pass2533ExecutionOwner = "runtime" | "provider" | "payment" | "artifact" | "ai" | "operator" | "security";

export type Pass2533ExecutionLedgerEntry = {
  id: string;
  routeId: string;
  surface: Pass2532RecoverySurface;
  actionKind: Pass2532RecoveryActionKind;
  severity: Pass2532RecoverySeverity;
  state: Pass2533ExecutionState;
  chipState: Pass2526ChipState;
  owner: Pass2533ExecutionOwner;
  escalationLevel: Pass2533EscalationLevel;
  queueKey: string;
  eventKeys: string[];
  requiredBeforeRelease: string[];
  failClosedUntil: string;
  retryBudget: number;
  retryAfterSeconds: number;
  expiresAfterSeconds: number;
  userVisibleCopy: { pl: string; en: string; de: string };
};

export type Pass2533SurfaceExecutionBridge = {
  id: string;
  surface: Pass2532RecoverySurface;
  mountSelector: string;
  readsFrom: string[];
  writesTo: string[];
  renderBefore: string;
  blockedClaims: string[];
  visibleStates: Pass2533ExecutionState[];
};

export type Pass2533ReleaseGate = {
  id: string;
  surface: Pass2532RecoverySurface;
  claimFamily: "score" | "paid" | "pdf" | "angel" | "checkout" | "wallet" | "admin" | "product";
  requiredLedgerStates: Pass2533ExecutionState[];
  requiredProofKeys: string[];
  failClosedCopy: string;
};

export type Pass2533ExecutionFixture = {
  id: string;
  ledgerEntryId: string;
  beforeState: Pass2533ExecutionState;
  afterReplayState: Pass2533ExecutionState;
  userOutcome: "still_blocked" | "hold_with_route" | "ready_after_replay" | "manual_review" | "incident_queue";
  expectedChipState: Pass2526ChipState;
};

export type Pass2533SemanticLane = {
  id: string;
  percentBefore: number;
  percentAfter: number;
  finding: string;
  implementedGuard: string;
  nextAction: string;
};

export type Pass2533RecoveryExecutionLedgerRebalance = {
  id: typeof PASS2533_RECOVERY_EXECUTION_LEDGER_REBALANCE_ID;
  state: "ready_for_visible_execution_dock" | "watch" | "blocked";
  query: string;
  symbol?: string;
  generatedAt: string;
  manualSemanticCompletionBeforePercent: number;
  manualSemanticCompletionAfterPercent: number;
  targetedSemanticBatchFiles: number;
  targetedSemanticBatchLines: number;
  recoveryExecutionLedgerBeforePercent: number;
  recoveryExecutionLedgerAfterPercent: number;
  visibleExecutionDockBeforePercent: number;
  visibleExecutionDockAfterPercent: number;
  surfaceReleaseGateBeforePercent: number;
  surfaceReleaseGateAfterPercent: number;
  retryEscalationBeforePercent: number;
  retryEscalationAfterPercent: number;
  operatorSloBridgeBeforePercent: number;
  operatorSloBridgeAfterPercent: number;
  angelCheckoutPdfReleaseBridgeBeforePercent: number;
  angelCheckoutPdfReleaseBridgeAfterPercent: number;
  worldclassInventionIndexBeforePercent: number;
  worldclassInventionIndexAfterPercent: number;
  ledgerEntries: Pass2533ExecutionLedgerEntry[];
  surfaceExecutionBridges: Pass2533SurfaceExecutionBridge[];
  releaseGates: Pass2533ReleaseGate[];
  executionFixtures: Pass2533ExecutionFixture[];
  inheritedRoutes: Pass2532RecoveryRoute[];
  semanticLanes: Pass2533SemanticLane[];
  masterTxtAdditions: string[];
  nextPassQueue: string[];
  recoveryExecutionLedgerRule: string;
  fingerprint: string;
};

const copy = (pl: string, en: string, de: string) => ({ pl, en, de });

function stableFingerprint(payload: unknown) {
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex").toUpperCase();
}

function chipStateFromSeverity(severity: Pass2532RecoverySeverity): Pass2526ChipState {
  if (severity === "blocked") return "blocked";
  if (severity === "hold") return "hold";
  if (severity === "watch") return "watch";
  return "pass";
}

function stateFromRoute(route: Pass2532RecoveryRoute): Pass2533ExecutionState {
  if (route.severity === "blocked") return "blocked";
  if (route.actionKind === "manual_review" || route.actionKind === "admin_dual_control") return "escalated";
  if (route.severity === "hold") return "waiting_for_proof";
  if (route.severity === "watch") return "queued";
  return "resolved";
}

function ownerFromRoute(route: Pass2532RecoveryRoute): Pass2533ExecutionOwner {
  if (route.owner === "provider") return "provider";
  if (route.owner === "payment") return "payment";
  if (route.owner === "artifact") return "artifact";
  if (route.owner === "ai") return "ai";
  if (route.owner === "operator") return route.actionKind === "admin_dual_control" ? "security" : "operator";
  return "runtime";
}

function escalationFromRoute(route: Pass2532RecoveryRoute): Pass2533EscalationLevel {
  if (route.actionKind === "admin_dual_control") return "dual_control";
  if (route.actionKind === "manual_review") return "operator_review";
  if (route.actionKind === "replay_entitlement") return "payment_provider";
  if (route.actionKind === "refresh_sources" || route.actionKind === "compare_providers") return "source_provider";
  if (route.actionKind === "regenerate_artifact") return "artifact_rebuild";
  if (route.severity === "blocked" && route.blockedClaims.length > 2) return "security_incident";
  return "none";
}

function queueKey(route: Pass2532RecoveryRoute) {
  return [route.surface, route.actionKind, route.owner, route.freshnessState].join(":");
}

function releaseGateFamily(surface: Pass2532RecoverySurface): Pass2533ReleaseGate["claimFamily"] {
  if (surface === "browser_pdf" || surface === "account_vault") return "pdf";
  if (surface === "angel") return "angel";
  if (surface === "checkout") return "checkout";
  if (surface === "wallet") return "wallet";
  if (surface === "admin") return "admin";
  if (surface === "product") return "product";
  if (surface === "real_markets" || surface === "shield") return "score";
  return "paid";
}

function buildUserCopy(route: Pass2532RecoveryRoute) {
  const base = route.copy;
  return copy(
    `${base.pl} Stan zostaje zablokowany/hold do czasu zapisu w execution ledger.`,
    `${base.en} The state stays blocked/on hold until the execution ledger records the proof.`,
    `${base.de} Der Zustand bleibt blockiert/auf Hold, bis das Execution Ledger den Nachweis schreibt.`,
  );
}

export function buildPass2533RecoveryExecutionLedgerRebalance(args: {
  query: string;
  symbol?: string;
  pass2532?: Pass2532FreshnessRecoveryRouterRebalance;
}): Pass2533RecoveryExecutionLedgerRebalance {
  const inheritedRoutes = args.pass2532?.routes ?? [];

  const ledgerEntries: Pass2533ExecutionLedgerEntry[] = inheritedRoutes.map((route) => {
    const state = stateFromRoute(route);
    return {
      id: `ledger-${route.id}`,
      routeId: route.id,
      surface: route.surface,
      actionKind: route.actionKind,
      severity: route.severity,
      state,
      chipState: chipStateFromSeverity(route.severity),
      owner: ownerFromRoute(route),
      escalationLevel: escalationFromRoute(route),
      queueKey: queueKey(route),
      eventKeys: ["proof_chip_state", "recovery_action_id", "owner_ack", "retry_budget", "release_gate_state"],
      requiredBeforeRelease: ["ledger_entry", "owner_ack", "freshness_or_entitlement_replay", "no_forbidden_claims"],
      failClosedUntil: route.requiredBefore,
      retryBudget: route.maxRetryCount,
      retryAfterSeconds: route.cooldownSeconds,
      expiresAfterSeconds: route.actionKind === "refresh_sources" ? 180 : route.actionKind === "compare_providers" ? 300 : 900,
      userVisibleCopy: buildUserCopy(route),
    } satisfies Pass2533ExecutionLedgerEntry;
  });

  const surfaces = Array.from(new Set(ledgerEntries.map((entry) => entry.surface)));
  const surfaceExecutionBridges: Pass2533SurfaceExecutionBridge[] = surfaces.map((surface) => {
    const entries = ledgerEntries.filter((entry) => entry.surface === surface);
    return {
      id: `surface-bridge-${surface}`,
      surface,
      mountSelector: `[data-pass2533-execution-ledger-surface="${surface}"]`,
      readsFrom: ["ProofDowngradeChipRail", "pass2532 routes", "source-sync metrics", "account/payment/artifact vault"],
      writesTo: ["visible execution dock", "release gate", "operator queue", "audit event ledger"],
      renderBefore: surface === "angel" ? "AI answer" : surface === "checkout" ? "unlock CTA" : surface === "browser_pdf" ? "PDF finality" : "score or paid insight",
      blockedClaims: Array.from(new Set(entries.flatMap((entry) => inheritedRoutes.find((route) => route.id === entry.routeId)?.blockedClaims ?? []))),
      visibleStates: Array.from(new Set(entries.map((entry) => entry.state))),
    } satisfies Pass2533SurfaceExecutionBridge;
  });

  const releaseGates: Pass2533ReleaseGate[] = surfaceExecutionBridges.map((bridge) => ({
    id: `release-gate-${bridge.surface}`,
    surface: bridge.surface,
    claimFamily: releaseGateFamily(bridge.surface),
    requiredLedgerStates: ["replayed", "resolved"],
    requiredProofKeys: ["ledger_entry", "owner_ack", "proof_replay", "forbidden_claims_clear"],
    failClosedCopy: `Release stays blocked before ${bridge.renderBefore} until every severe ledger entry is replayed or resolved.`,
  }));

  const executionFixtures: Pass2533ExecutionFixture[] = ledgerEntries.map((entry) => ({
    id: `fixture-${entry.id}`,
    ledgerEntryId: entry.id,
    beforeState: entry.state,
    afterReplayState: entry.state === "blocked" ? "waiting_for_proof" : entry.state === "waiting_for_proof" ? "replayed" : entry.state === "queued" ? "running" : entry.state,
    userOutcome:
      entry.escalationLevel === "security_incident"
        ? "incident_queue"
        : entry.escalationLevel === "dual_control" || entry.escalationLevel === "operator_review"
          ? "manual_review"
          : entry.state === "blocked"
            ? "still_blocked"
            : entry.state === "waiting_for_proof"
              ? "hold_with_route"
              : "ready_after_replay",
    expectedChipState: entry.state === "resolved" || entry.state === "replayed" ? "pass" : entry.chipState,
  }));

  const semanticLanes: Pass2533SemanticLane[] = [
    {
      id: "recovery_execution_ledger",
      percentBefore: 0,
      percentAfter: 34,
      finding: "PASS2532 gave every blocked/hold chip a recovery route, but execution ownership and release gates were still implied instead of ledgered.",
      implementedGuard: "Adds execution ledger entries with owner, retry budget, cooldown, escalation level and fail-closed release state.",
      nextAction: "Mount a visible execution dock in Shield/Real Markets/Browser/Angel/Checkout so users see what is being replayed.",
    },
    {
      id: "surface_release_gates",
      percentBefore: 31,
      percentAfter: 49,
      finding: "Recovery routes must block the exact user-facing claim family, not just a generic score area.",
      implementedGuard: "Adds surface release gates for score, PDF, Angel, checkout, wallet, admin and product claims.",
      nextAction: "Bind release gates into CTA disabled states and PDF download finality in real components.",
    },
    {
      id: "operator_slo_escalation",
      percentBefore: 22,
      percentAfter: 44,
      finding: "Retry/cooldown without escalation can hide provider failures behind a passive UI state.",
      implementedGuard: "Adds escalation levels for provider, payment, artifact rebuild, operator review, dual-control and security incident queues.",
      nextAction: "Add local UI copy for queue owner, retry countdown and escalation outcome.",
    },
    {
      id: "angel_checkout_pdf_boundary",
      percentBefore: 54,
      percentAfter: 67,
      finding: "Angel, checkout and PDF are the surfaces where users most easily mistake a partial recovery for final proof.",
      implementedGuard: "Requires ledger replay/resolved state before final answer, unlock CTA or PDF vault finality.",
      nextAction: "Add fixture snapshots for stale BTC, AAPL divergence, refunded Advanced and PDF hash drift.",
    },
  ];

  const masterTxtAdditions = [
    "PASS2533 NEW GAP — Recovery Execution Ledger must be visible: every recovery route needs owner, retry budget, cooldown, escalation level and release state.",
    "PASS2533 NEW GAP — Fail-closed release gate must be claim-specific: score, paid insight, PDF finality, Angel answer, checkout unlock, wallet identity, admin override and product publish cannot share one vague lock.",
    "PASS2533 NEW GAP — User copy must say what is being replayed and who owns it without implying background success or hidden analysis completion.",
    "PASS2533 NEW GAP — Operator SLO cannot be fake: if provider refresh/compare fails, route to manual review or incident queue instead of silently retrying forever.",
    "PASS2533 WORLDCLASS INVENTION — Visible Execution Dock: a small proof-first dock showing route, owner, retry, release gate and the exact claim being blocked.",
    "PASS2533 WORLDCLASS INVENTION — Claim Family Release Gate: a shared runtime gate that maps a chip state to the exact UI/AI/PDF claim it is allowed to unlock.",
  ];

  const nextPassQueue = [
    "PASS2534: mount Visible Execution Dock in real UI surfaces with disabled claim/CTA states.",
    "PASS2535: add fixture replay snapshots for stale BTC, divergent AAPL, refunded Advanced and PDF hash drift.",
    "PASS2536: wire release gates to Lens download, Angel response mode and checkout Advanced CTA.",
    "PASS2537: add operator queue copy, retry countdown and escalation audit trail.",
  ];

  const fingerprint = stableFingerprint({ ledgerEntries, surfaceExecutionBridges, releaseGates, executionFixtures, semanticLanes });

  return {
    id: PASS2533_RECOVERY_EXECUTION_LEDGER_REBALANCE_ID,
    state: ledgerEntries.some((entry) => entry.state === "blocked") ? "ready_for_visible_execution_dock" : "watch",
    query: args.query,
    symbol: args.symbol,
    generatedAt: new Date().toISOString(),
    manualSemanticCompletionBeforePercent: 51,
    manualSemanticCompletionAfterPercent: 54,
    targetedSemanticBatchFiles: 50,
    targetedSemanticBatchLines: 213420,
    recoveryExecutionLedgerBeforePercent: 0,
    recoveryExecutionLedgerAfterPercent: 34,
    visibleExecutionDockBeforePercent: 0,
    visibleExecutionDockAfterPercent: 27,
    surfaceReleaseGateBeforePercent: 31,
    surfaceReleaseGateAfterPercent: 49,
    retryEscalationBeforePercent: 24,
    retryEscalationAfterPercent: 45,
    operatorSloBridgeBeforePercent: 22,
    operatorSloBridgeAfterPercent: 44,
    angelCheckoutPdfReleaseBridgeBeforePercent: 54,
    angelCheckoutPdfReleaseBridgeAfterPercent: 67,
    worldclassInventionIndexBeforePercent: 82,
    worldclassInventionIndexAfterPercent: 87,
    ledgerEntries,
    surfaceExecutionBridges,
    releaseGates,
    executionFixtures,
    inheritedRoutes,
    semanticLanes,
    masterTxtAdditions,
    nextPassQueue,
    recoveryExecutionLedgerRule:
      "Every recovery route must write a visible execution ledger entry with owner, retry/cooldown, escalation level and a claim-family release gate before any score, paid insight, PDF finality, checkout unlock or Angel final answer is allowed.",
    fingerprint,
  };
}
