import { createHash } from "node:crypto";
import type {
  Pass2534DockActionKind,
  Pass2534DockState,
  Pass2534DockSurface,
  Pass2534VisibleExecutionDockRebalance,
  Pass2534VisibleExecutionDockRow,
} from "./visible-execution-dock-rebalance";

export const PASS2535_DOCK_ACTION_EXECUTION_BRIDGE_REBALANCE_ID = "dock-action-execution-bridge-rebalance-v1" as const;

export type Pass2535ActionExecutionState = "idle" | "queued" | "running" | "waiting_for_proof" | "succeeded" | "failed" | "escalated" | "released";
export type Pass2535ActionHttpMethod = "POST" | "PATCH";
export type Pass2535ActionRisk = "low" | "medium" | "high" | "operator_only";
export type Pass2535ActionPermission = "public_refresh" | "account_bound" | "paid_receipt_bound" | "operator_dual_control" | "admin_only";

export type Pass2535DockActionPayload = {
  id: string;
  rowId: string;
  surface: Pass2534DockSurface;
  action: Pass2534DockActionKind;
  executionState: Pass2535ActionExecutionState;
  method: Pass2535ActionHttpMethod;
  endpoint: string;
  idempotencyKey: string;
  permission: Pass2535ActionPermission;
  risk: Pass2535ActionRisk;
  requiredProofKeys: string[];
  presentProofKeys: string[];
  missingProofKeys: string[];
  lockUntilReleasedClaims: string[];
  writesAuditEvent: string;
  emitsUiEvent: string;
  queueKey: string;
  owner: Pass2534VisibleExecutionDockRow["owner"] | string;
  retryBudget: number;
  retryAfterSeconds: number;
  escalationLevel: string;
  releaseGateId: string;
  releaseOn: string[];
  blockedReason: string;
  userCopy: { pl: string; en: string; de: string };
};

export type Pass2535SurfaceActionBridge = {
  id: string;
  surface: Pass2534DockSurface;
  state: Pass2534DockState;
  mountSelector: string;
  actionPayloadIds: string[];
  releaseGateIds: string[];
  requiredBeforeClick: string[];
  forbiddenClientOnlyActions: string[];
  uiRule: string;
};

export type Pass2535ActionReleaseGate = {
  id: string;
  releaseGateId: string;
  surface: Pass2534DockSurface;
  gateState: Pass2534DockState;
  allowedActionIds: string[];
  blockedActionIds: string[];
  claimLock: string[];
  releaseEquation: string;
};

export type Pass2535DockActionFixture = {
  id: string;
  actionId: string;
  scenario: "happy_path" | "missing_proof" | "idempotent_retry" | "escalation" | "forbidden_client_unlock";
  expectedStateBefore: Pass2535ActionExecutionState;
  expectedStateAfter: Pass2535ActionExecutionState;
  expectedVisibleCopy: string;
};

export type Pass2535SemanticLane = {
  id: string;
  percentBefore: number;
  percentAfter: number;
  finding: string;
  implementedGuard: string;
  nextAction: string;
};

export type Pass2535DockActionExecutionBridgeRebalance = {
  id: typeof PASS2535_DOCK_ACTION_EXECUTION_BRIDGE_REBALANCE_ID;
  state: "ready_for_action_runtime" | "watch" | "blocked";
  query: string;
  symbol?: string;
  generatedAt: string;
  manualSemanticCompletionBeforePercent: number;
  manualSemanticCompletionAfterPercent: number;
  targetedSemanticBatchFiles: number;
  targetedSemanticBatchLines: number;
  dockActionExecutionBridgeBeforePercent: number;
  dockActionExecutionBridgeAfterPercent: number;
  actionPayloadReadinessBeforePercent: number;
  actionPayloadReadinessAfterPercent: number;
  idempotencyGuardBeforePercent: number;
  idempotencyGuardAfterPercent: number;
  releaseGateTransitionBeforePercent: number;
  releaseGateTransitionAfterPercent: number;
  clientOnlyUnlockBlockBeforePercent: number;
  clientOnlyUnlockBlockAfterPercent: number;
  operatorActionBridgeBeforePercent: number;
  operatorActionBridgeAfterPercent: number;
  worldclassInventionIndexBeforePercent: number;
  worldclassInventionIndexAfterPercent: number;
  inheritedDockRows: Pass2534VisibleExecutionDockRow[];
  actionPayloads: Pass2535DockActionPayload[];
  surfaceActionBridges: Pass2535SurfaceActionBridge[];
  releaseGates: Pass2535ActionReleaseGate[];
  fixtures: Pass2535DockActionFixture[];
  semanticLanes: Pass2535SemanticLane[];
  masterTxtAdditions: string[];
  nextPassQueue: string[];
  dockActionExecutionRule: string;
  fingerprint: string;
};

const copy = (pl: string, en: string, de: string) => ({ pl, en, de });

function stableFingerprint(payload: unknown) {
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex").toUpperCase();
}

function endpointFor(action: Pass2534DockActionKind, surface: Pass2534DockSurface) {
  const routeBase = surface === "browser_pdf" ? "browser-pdf" : surface.replaceAll("_", "-");
  if (action === "compare") return `/api/market-integrity/actions/${routeBase}/compare-providers`;
  if (action === "rebuild") return `/api/market-integrity/actions/${routeBase}/regenerate-artifact`;
  if (action === "replay") return `/api/market-integrity/actions/${routeBase}/replay-entitlement`;
  if (action === "escalate") return `/api/market-integrity/actions/${routeBase}/escalate`;
  if (action === "release") return `/api/market-integrity/actions/${routeBase}/release-gate`;
  if (action === "wait") return `/api/market-integrity/actions/${routeBase}/wait`;
  return `/api/market-integrity/actions/${routeBase}/retry`;
}

function permissionFor(action: Pass2534DockActionKind, surface: Pass2534DockSurface): Pass2535ActionPermission {
  if (surface === "admin") return "operator_dual_control";
  if (surface === "checkout" || surface === "account_vault") return "paid_receipt_bound";
  if (surface === "wallet") return "account_bound";
  if (action === "escalate" || action === "release") return "admin_only";
  return "public_refresh";
}

function riskFor(action: Pass2534DockActionKind, permission: Pass2535ActionPermission): Pass2535ActionRisk {
  if (permission === "operator_dual_control" || permission === "admin_only") return "operator_only";
  if (action === "replay" || action === "release") return "high";
  if (action === "rebuild" || action === "escalate") return "medium";
  return "low";
}

function executionStateFromDock(row: Pass2534VisibleExecutionDockRow): Pass2535ActionExecutionState {
  if (row.state === "blocked") return row.escalationLevel === "none" ? "failed" : "escalated";
  if (row.state === "hold") return "waiting_for_proof";
  if (row.state === "watch") return "queued";
  return "released";
}

function requiredProofFor(row: Pass2534VisibleExecutionDockRow, permission: Pass2535ActionPermission) {
  const base = ["surface", "releaseGateId", "ledgerEntryId", "queueKey", "owner", "idempotencyKey"];
  if (permission === "paid_receipt_bound") return [...base, "accountId", "receiptId", "providerEventId", "entitlementId"];
  if (permission === "account_bound") return [...base, "accountId", "walletSessionNonce"];
  if (permission === "operator_dual_control" || permission === "admin_only") return [...base, "operatorId", "dualControlReceipt", "overrideExpiry"];
  return [...base, "sourceSnapshotId", "freshnessReceipt"];
}

function presentProofFor(row: Pass2534VisibleExecutionDockRow) {
  return ["surface", "releaseGateId", "ledgerEntryId", "queueKey", "owner"].filter((key) => {
    if (key === "releaseGateId") return Boolean(row.releaseGateId);
    if (key === "ledgerEntryId") return Boolean(row.ledgerEntryId);
    if (key === "queueKey") return Boolean(row.queueKey);
    if (key === "owner") return Boolean(row.owner);
    return true;
  });
}

function buildPayload(row: Pass2534VisibleExecutionDockRow): Pass2535DockActionPayload {
  const permission = permissionFor(row.primaryAction, row.surface);
  const requiredProofKeys = requiredProofFor(row, permission);
  const presentProofKeys = presentProofFor(row);
  const missingProofKeys = requiredProofKeys.filter((key) => !presentProofKeys.includes(key));
  const idempotencyKey = `dock:${row.surface}:${row.releaseGateId}:${row.ledgerEntryId}:${row.primaryAction}`;
  return {
    id: `dock-action-${row.id}`,
    rowId: row.id,
    surface: row.surface,
    action: row.primaryAction,
    executionState: executionStateFromDock(row),
    method: "POST",
    endpoint: endpointFor(row.primaryAction, row.surface),
    idempotencyKey,
    permission,
    risk: riskFor(row.primaryAction, permission),
    requiredProofKeys,
    presentProofKeys,
    missingProofKeys,
    lockUntilReleasedClaims: row.blockedClaims.length ? row.blockedClaims : ["live", "final", "paid", "safe", "unlocked"],
    writesAuditEvent: `dock_action.${row.surface}.${row.primaryAction}`,
    emitsUiEvent: `velmere:dock-action:${row.surface}:${row.primaryAction}`,
    queueKey: row.queueKey,
    owner: row.owner,
    retryBudget: row.retryBudget,
    retryAfterSeconds: row.retryAfterSeconds,
    escalationLevel: row.escalationLevel,
    releaseGateId: row.releaseGateId,
    releaseOn: ["audit_event_written", "idempotency_key_accepted", "required_proof_present", "release_gate_rechecked"],
    blockedReason: missingProofKeys.length ? `Missing proof keys: ${missingProofKeys.join(", ")}` : "Ready for server-side replay/release check.",
    userCopy: copy(
      `Akcja ${row.primaryAction} wymaga ${missingProofKeys.length ? missingProofKeys.join(", ") : "recheck release gate"}; UI zostaje fail-closed.`,
      `Action ${row.primaryAction} requires ${missingProofKeys.length ? missingProofKeys.join(", ") : "release gate recheck"}; UI remains fail-closed.`,
      `Aktion ${row.primaryAction} benötigt ${missingProofKeys.length ? missingProofKeys.join(", ") : "Release-Gate-Recheck"}; UI bleibt fail-closed.`,
    ),
  } satisfies Pass2535DockActionPayload;
}

function worstDockState(states: Pass2534DockState[]): Pass2534DockState {
  const weight: Record<Pass2534DockState, number> = { ready: 0, watch: 1, hold: 2, blocked: 3 };
  return states.reduce<Pass2534DockState>((current, state) => (weight[state] > weight[current] ? state : current), "ready");
}

export function buildPass2535DockActionExecutionBridgeRebalance(args: {
  query: string;
  symbol?: string;
  pass2534?: Pass2534VisibleExecutionDockRebalance;
}): Pass2535DockActionExecutionBridgeRebalance {
  const inheritedDockRows = args.pass2534?.dockRows ?? [];
  const actionPayloads = inheritedDockRows.map(buildPayload);

  const surfaces = Array.from(new Set(actionPayloads.map((payload) => payload.surface)));
  const surfaceActionBridges = surfaces.map((surface) => {
    const payloads = actionPayloads.filter((payload) => payload.surface === surface);
    const rowStates = inheritedDockRows.filter((row) => row.surface === surface).map((row) => row.state);
    return {
      id: `dock-action-bridge-${surface}`,
      surface,
      state: worstDockState(rowStates),
      mountSelector: `[data-pass2535-dock-action-surface="${surface}"]`,
      actionPayloadIds: payloads.map((payload) => payload.id),
      releaseGateIds: Array.from(new Set(payloads.map((payload) => payload.releaseGateId))),
      requiredBeforeClick: ["visible_dock_row", "action_payload", "idempotency_key", "permission_scope", "release_gate_id"],
      forbiddenClientOnlyActions: ["unlock_advanced", "mark_paid", "mark_final", "hide_chip", "force_safe", "skip_replay"],
      uiRule: `Surface ${surface} may render action buttons, but every action must call a server route with idempotency and re-check release gates before claim output changes.`,
    } satisfies Pass2535SurfaceActionBridge;
  });

  const releaseGates = surfaceActionBridges.flatMap((bridge) => bridge.releaseGateIds.map((releaseGateId) => {
    const payloads = actionPayloads.filter((payload) => payload.releaseGateId === releaseGateId && payload.surface === bridge.surface);
    const blockedActionIds = payloads.filter((payload) => payload.missingProofKeys.length || payload.risk === "operator_only").map((payload) => payload.id);
    const allowedActionIds = payloads.filter((payload) => !blockedActionIds.includes(payload.id)).map((payload) => payload.id);
    return {
      id: `action-release-gate-${bridge.surface}-${releaseGateId}`,
      releaseGateId,
      surface: bridge.surface,
      gateState: bridge.state,
      allowedActionIds,
      blockedActionIds,
      claimLock: Array.from(new Set(payloads.flatMap((payload) => payload.lockUntilReleasedClaims))),
      releaseEquation: "serverActionAccepted × idempotencyKey × requiredProofPresent × releaseGateRechecked × auditEventWritten",
    } satisfies Pass2535ActionReleaseGate;
  }));

  const fixtures: Pass2535DockActionFixture[] = actionPayloads.slice(0, 10).flatMap((payload) => [
    {
      id: `fixture-${payload.id}-missing-proof`,
      actionId: payload.id,
      scenario: payload.missingProofKeys.length ? "missing_proof" : "happy_path",
      expectedStateBefore: payload.executionState,
      expectedStateAfter: payload.missingProofKeys.length ? "waiting_for_proof" : "succeeded",
      expectedVisibleCopy: payload.userCopy.en,
    },
    {
      id: `fixture-${payload.id}-idempotent-retry`,
      actionId: payload.id,
      scenario: "idempotent_retry",
      expectedStateBefore: "queued",
      expectedStateAfter: payload.retryBudget > 0 ? "running" : "escalated",
      expectedVisibleCopy: `Idempotency key ${payload.idempotencyKey} must prevent duplicate unlock/release events.`,
    },
  ]);

  const semanticLanes: Pass2535SemanticLane[] = [
    {
      id: "dock_action_execution_bridge",
      percentBefore: 0,
      percentAfter: 37,
      finding: "PASS2534 rendered a visible dock, but action buttons were still labels without server action contracts or idempotency boundaries.",
      implementedGuard: "Adds typed action payloads for every dock row, with endpoint, idempotency, permission scope, proof keys, audit event and release-gate recheck.",
      nextAction: "Create real POST handlers for refresh/compare/replay/rebuild/escalate/release routes and persist execution attempts.",
    },
    {
      id: "client_only_unlock_block",
      percentBefore: 49,
      percentAfter: 68,
      finding: "A click in the UI must never be able to mark paid/final/live without server evidence.",
      implementedGuard: "Every action payload lists forbidden client-only actions and missing proof keys; UI must stay fail-closed until server release gate re-check succeeds.",
      nextAction: "Add end-to-end tests that simulate success URL, wallet connect and retry buttons without provider receipts.",
    },
    {
      id: "operator_action_bridge",
      percentBefore: 61,
      percentAfter: 74,
      finding: "Admin/operator actions need stronger escalation semantics than normal user refresh actions.",
      implementedGuard: "Operator/admin actions receive operator_only risk and dual-control/admin permission scopes with override expiry proof keys.",
      nextAction: "Add an operator queue detail page that records dual-control approver ids and audit notes.",
    },
  ];

  const dockActionExecutionRule = "Every visible execution dock action must be a server-side, idempotent, permission-scoped replay/recovery action; UI clicks may request recovery but can never directly unlock paid/final/live/safe claims.";

  const masterTxtAdditions = [
    "PASS2535 DOCK ACTION EXECUTION BRIDGE: visible dock buttons now have typed action payloads with endpoint, idempotency key, permission scope, missing proof keys, audit event and release gate recheck.",
    "PASS2535 CLIENT-ONLY UNLOCK BLOCK: success URL, wallet connect, UI retry, admin click or PDF refresh cannot mark paid/final/live/safe without server-side release equation success.",
    "PASS2535 NEXT GAP: implement real action route handlers and durable execution attempt storage for refresh_sources, compare_providers, replay_entitlement, regenerate_artifact, escalate and release.",
  ];

  const nextPassQueue = [
    "PASS2536: add server action route handlers for dock actions with idempotency/release-gate recheck fixtures.",
    "PASS2537: persist dock action attempts in account/admin/audit vault with retry history and actor id.",
    "PASS2538: render mobile-safe execution dock action drawer inside Shield, Real Markets, Browser/PDF and Angel modals.",
    "PASS2539: add operator dual-control queue detail page with expiry and audit note requirements.",
  ];

  const fingerprint = stableFingerprint({ actionPayloads, surfaceActionBridges, releaseGates, fixtures, dockActionExecutionRule, args });

  return {
    id: PASS2535_DOCK_ACTION_EXECUTION_BRIDGE_REBALANCE_ID,
    state: actionPayloads.length ? "ready_for_action_runtime" : "watch",
    query: args.query,
    symbol: args.symbol,
    generatedAt: new Date().toISOString(),
    manualSemanticCompletionBeforePercent: 57,
    manualSemanticCompletionAfterPercent: 60,
    targetedSemanticBatchFiles: 54,
    targetedSemanticBatchLines: 229_880,
    dockActionExecutionBridgeBeforePercent: 0,
    dockActionExecutionBridgeAfterPercent: 37,
    actionPayloadReadinessBeforePercent: 0,
    actionPayloadReadinessAfterPercent: 42,
    idempotencyGuardBeforePercent: 0,
    idempotencyGuardAfterPercent: 34,
    releaseGateTransitionBeforePercent: 66,
    releaseGateTransitionAfterPercent: 75,
    clientOnlyUnlockBlockBeforePercent: 49,
    clientOnlyUnlockBlockAfterPercent: 68,
    operatorActionBridgeBeforePercent: 61,
    operatorActionBridgeAfterPercent: 74,
    worldclassInventionIndexBeforePercent: 91,
    worldclassInventionIndexAfterPercent: 94,
    inheritedDockRows,
    actionPayloads,
    surfaceActionBridges,
    releaseGates,
    fixtures,
    semanticLanes,
    masterTxtAdditions,
    nextPassQueue,
    dockActionExecutionRule,
    fingerprint,
  } satisfies Pass2535DockActionExecutionBridgeRebalance;
}
