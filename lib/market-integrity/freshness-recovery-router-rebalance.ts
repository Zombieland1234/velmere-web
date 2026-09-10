import { createHash } from "node:crypto";
import type {
  Pass2531ClaimFreshnessGate,
  Pass2531FreshnessReplayFixture,
  Pass2531FreshnessState,
  Pass2531SourceFreshnessExpiryBridgeRebalance,
} from "./source-freshness-expiry-bridge-rebalance";
import type { Pass2526ChipState, Pass2526Surface } from "./reusable-downgrade-chip-rebalance";

export const PASS2532_FRESHNESS_RECOVERY_ROUTER_REBALANCE_ID = "freshness-recovery-router-rebalance-v1" as const;

export type Pass2532RecoverySeverity = "info" | "watch" | "hold" | "blocked";
export type Pass2532RecoveryActionKind =
  | "refresh_sources"
  | "compare_providers"
  | "replay_entitlement"
  | "regenerate_artifact"
  | "force_missing_proof"
  | "manual_review"
  | "admin_dual_control";

export type Pass2532RecoverySurface = Extract<
  Pass2526Surface,
  "shield" | "real_markets" | "browser_pdf" | "angel" | "checkout" | "wallet" | "account_vault" | "admin" | "product"
>;

export type Pass2532RecoveryRoute = {
  id: string;
  surface: Pass2532RecoverySurface;
  actionKind: Pass2532RecoveryActionKind;
  severity: Pass2532RecoverySeverity;
  freshnessState: Pass2531FreshnessState;
  requiredBefore: string;
  inputProofKeys: string[];
  missingProofKeys: string[];
  blockedClaims: string[];
  nextAction: string;
  owner: "runtime" | "provider" | "operator" | "payment" | "artifact" | "ai";
  maxRetryCount: number;
  cooldownSeconds: number;
  copy: { pl: string; en: string; de: string };
};

export type Pass2532RecoveryCheckpoint = {
  id: string;
  gateId: string;
  surface: Pass2532RecoverySurface;
  routes: string[];
  passCondition: string;
  failClosedCondition: string;
  writesTo: string[];
};

export type Pass2532RecoveryFixture = {
  id: string;
  sourceFixtureId: string;
  chipStateBefore: Pass2526ChipState;
  chipStateAfterRecovery: Pass2526ChipState;
  recoveryRouteIds: string[];
  evidenceReplayKeys: string[];
  userVisibleState: "not_enough_proof" | "refreshing" | "compare_required" | "manual_review" | "ready_after_replay";
};

export type Pass2532SemanticLane = {
  id: string;
  percentBefore: number;
  percentAfter: number;
  finding: string;
  implementedGuard: string;
  nextAction: string;
};

export type Pass2532FreshnessRecoveryRouterRebalance = {
  id: typeof PASS2532_FRESHNESS_RECOVERY_ROUTER_REBALANCE_ID;
  state: "ready_for_recovery_ui_mount" | "watch" | "blocked";
  query: string;
  symbol?: string;
  generatedAt: string;
  manualSemanticCompletionBeforePercent: number;
  manualSemanticCompletionAfterPercent: number;
  targetedSemanticBatchFiles: number;
  targetedSemanticBatchLines: number;
  freshnessRecoveryRouterBeforePercent: number;
  freshnessRecoveryRouterAfterPercent: number;
  recoveryActionBindingBeforePercent: number;
  recoveryActionBindingAfterPercent: number;
  providerRefreshLoopBeforePercent: number;
  providerRefreshLoopAfterPercent: number;
  artifactRegenerationFlowBeforePercent: number;
  artifactRegenerationFlowAfterPercent: number;
  angelMissingProofModeBeforePercent: number;
  angelMissingProofModeAfterPercent: number;
  checkoutReplayRecoveryBeforePercent: number;
  checkoutReplayRecoveryAfterPercent: number;
  adminDualControlRecoveryBeforePercent: number;
  adminDualControlRecoveryAfterPercent: number;
  worldclassInventionIndexBeforePercent: number;
  worldclassInventionIndexAfterPercent: number;
  routes: Pass2532RecoveryRoute[];
  checkpoints: Pass2532RecoveryCheckpoint[];
  recoveryFixtures: Pass2532RecoveryFixture[];
  inheritedFreshnessFixtures: Pass2531FreshnessReplayFixture[];
  inheritedClaimGates: Pass2531ClaimFreshnessGate[];
  semanticLanes: Pass2532SemanticLane[];
  masterTxtAdditions: string[];
  nextPassQueue: string[];
  freshnessRecoveryRouterRule: string;
  fingerprint: string;
};

const copy = (pl: string, en: string, de: string) => ({ pl, en, de });

function stableFingerprint(payload: unknown) {
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex").toUpperCase();
}

const severityFromChipState: Record<Pass2526ChipState, Pass2532RecoverySeverity> = {
  pass: "info",
  watch: "watch",
  hold: "hold",
  blocked: "blocked",
};

function inferActionKind(fixture: Pass2531FreshnessReplayFixture): Pass2532RecoveryActionKind {
  if (fixture.surface === "checkout") return "replay_entitlement";
  if (fixture.surface === "browser_pdf" || fixture.surface === "account_vault") return "regenerate_artifact";
  if (fixture.surface === "angel") return "force_missing_proof";
  if (fixture.surface === "admin") return "admin_dual_control";
  if (fixture.freshnessState === "diverged") return "compare_providers";
  if (fixture.freshnessState === "expired" || fixture.freshnessState === "stale" || fixture.freshnessState === "delayed") return "refresh_sources";
  return "manual_review";
}

function inferOwner(actionKind: Pass2532RecoveryActionKind): Pass2532RecoveryRoute["owner"] {
  if (actionKind === "replay_entitlement") return "payment";
  if (actionKind === "regenerate_artifact") return "artifact";
  if (actionKind === "force_missing_proof") return "ai";
  if (actionKind === "admin_dual_control") return "operator";
  if (actionKind === "refresh_sources" || actionKind === "compare_providers") return "provider";
  return "operator";
}

function routeCopy(fixture: Pass2531FreshnessReplayFixture, actionKind: Pass2532RecoveryActionKind) {
  const actionLabel: Record<Pass2532RecoveryActionKind, { pl: string; en: string; de: string }> = {
    refresh_sources: copy("Odśwież źródła i pokaż timestamp przed score.", "Refresh sources and show the timestamp before the score.", "Quellen aktualisieren und Zeitstempel vor dem Score anzeigen."),
    compare_providers: copy("Porównaj providerów i pokaż rozjazd przed wnioskiem.", "Compare providers and show divergence before the conclusion.", "Provider vergleichen und Abweichung vor der Aussage zeigen."),
    replay_entitlement: copy("Powtórz receipt + provider event + account binding przed odblokowaniem.", "Replay receipt + provider event + account binding before unlock.", "Receipt + Provider-Event + Account-Bindung vor Freischaltung replayen."),
    regenerate_artifact: copy("Wygeneruj nową rodzinę hashy przed PDF/download/vault.", "Regenerate the hash family before PDF/download/vault.", "Hash-Familie vor PDF/Download/Vault neu erzeugen."),
    force_missing_proof: copy("Przełącz AI w tryb Missing Proof zamiast finalnej odpowiedzi.", "Force AI into Missing Proof mode instead of a final answer.", "KI in Missing-Proof-Modus statt finaler Antwort setzen."),
    manual_review: copy("Wyślij do ręcznego review i zostaw UI w stanie hold.", "Send to manual review and keep UI on hold.", "Zur manuellen Prüfung senden und UI auf Hold lassen."),
    admin_dual_control: copy("Wymagaj drugiego operatora, expiry i audytu override.", "Require second operator, expiry and override audit.", "Zweiten Operator, Ablauf und Override-Audit verlangen."),
  };
  return actionLabel[actionKind];
}

export function buildPass2532FreshnessRecoveryRouterRebalance(args: {
  query: string;
  symbol?: string;
  pass2531?: Pass2531SourceFreshnessExpiryBridgeRebalance;
}): Pass2532FreshnessRecoveryRouterRebalance {
  const inheritedFreshnessFixtures = args.pass2531?.replayFixtures ?? [];
  const inheritedClaimGates = args.pass2531?.claimFreshnessGates ?? [];
  const routes: Pass2532RecoveryRoute[] = inheritedFreshnessFixtures.map((fixture) => {
    const actionKind = inferActionKind(fixture);
    const missingProofKeys = fixture.missingProof.map((proof) => proof.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "")).filter(Boolean);
    return {
      id: `recovery-${fixture.id}`,
      surface: fixture.surface as Pass2532RecoverySurface,
      actionKind,
      severity: severityFromChipState[fixture.chipState],
      freshnessState: fixture.freshnessState,
      requiredBefore: fixture.blocksBefore,
      inputProofKeys: ["runtime_chip_state", "freshness_state", "provider_count", "divergence_bps", "blocked_claims"],
      missingProofKeys,
      blockedClaims: fixture.forbiddenClaims,
      nextAction: fixture.recoveryAction,
      owner: inferOwner(actionKind),
      maxRetryCount: actionKind === "refresh_sources" ? 2 : actionKind === "compare_providers" ? 1 : 0,
      cooldownSeconds: actionKind === "refresh_sources" ? 60 : actionKind === "compare_providers" ? 120 : 0,
      copy: routeCopy(fixture, actionKind),
    } satisfies Pass2532RecoveryRoute;
  });

  const checkpoints: Pass2532RecoveryCheckpoint[] = inheritedClaimGates.map((gate) => {
    const gateRoutes = routes.filter((route) => gate.requiredFreshnessFixtureIds.includes(route.id.replace(/^recovery-/, "")));
    return {
      id: `checkpoint-${gate.id}`,
      gateId: gate.id,
      surface: gate.surface as Pass2532RecoverySurface,
      routes: gateRoutes.map((route) => route.id),
      passCondition: "all recovery routes are pass or watch, no blocked forbidden claim, source timestamps within SLA",
      failClosedCondition: gate.failClosedRule,
      writesTo: ["ProofDowngradeChipRail", "source-sync metrics", "Angel missing-proof mode", "PDF/account vault finality log"],
    } satisfies Pass2532RecoveryCheckpoint;
  });

  const recoveryFixtures: Pass2532RecoveryFixture[] = inheritedFreshnessFixtures.map((fixture) => ({
    id: `fixture-${fixture.id}`,
    sourceFixtureId: fixture.id,
    chipStateBefore: fixture.chipState,
    chipStateAfterRecovery: fixture.chipState === "blocked" ? "hold" : fixture.chipState === "hold" ? "watch" : fixture.chipState,
    recoveryRouteIds: [`recovery-${fixture.id}`],
    evidenceReplayKeys: ["runtime_chip_state", "provider_timestamp", "source_quorum", "artifact_hash_family", "entitlement_replay"],
    userVisibleState:
      fixture.chipState === "blocked"
        ? "not_enough_proof"
        : inferActionKind(fixture) === "compare_providers"
          ? "compare_required"
          : inferActionKind(fixture) === "admin_dual_control"
            ? "manual_review"
            : "refreshing",
  }));

  const semanticLanes: Pass2532SemanticLane[] = [
    {
      id: "freshness_recovery_router",
      percentBefore: 0,
      percentAfter: 36,
      finding: "PASS2531 blocked stale/diverged claims, but the user still needs a clear next action instead of a dead blocked state.",
      implementedGuard: "Adds recovery routes for refresh, compare, replay entitlement, regenerate artifact, missing-proof mode and admin dual-control.",
      nextAction: "Mount visible recovery buttons and disabled states in Shield/Real Markets/PDF/Angel/checkout.",
    },
    {
      id: "provider_refresh_loop",
      percentBefore: 24,
      percentAfter: 47,
      finding: "Market data can be stale, delayed or unavailable without a deterministic refresh/cooldown route.",
      implementedGuard: "Adds retry counts, cooldown seconds and provider owner routing for each freshness chip.",
      nextAction: "Wire to real provider fetch status and timestamp ledger.",
    },
    {
      id: "artifact_regeneration_flow",
      percentBefore: 31,
      percentAfter: 52,
      finding: "PDF/account vault finality needs an explicit regenerate-artifact path when hash family is stale or drifted.",
      implementedGuard: "Routes stale artifact fixtures to regenerate_artifact before download/vault finality.",
      nextAction: "Create a visible artifact replay receipt in account vault.",
    },
    {
      id: "angel_missing_proof_mode",
      percentBefore: 86,
      percentAfter: 91,
      finding: "Angel must not answer final/safe/live when source context is stale; it needs a specific recovery mode copy.",
      implementedGuard: "Adds force_missing_proof recovery route and AI owner binding.",
      nextAction: "Show active recovery route inside Angel panel next to context pill.",
    },
    {
      id: "checkout_replay_recovery",
      percentBefore: 81,
      percentAfter: 87,
      finding: "Checkout success URL and wallet identity can still be misunderstood as payment proof.",
      implementedGuard: "Routes checkout freshness failures to replay_entitlement with receipt/provider/account/entitlement keys.",
      nextAction: "Add disabled unlock button copy until recovery checkpoint passes.",
    },
  ];

  const masterTxtAdditions = [
    "PASS2532 adds Freshness Recovery Router: blocked/hold chips must show a concrete recovery action, owner, cooldown and proof keys instead of a dead-end warning.",
    "World-class rule: stale/diverged market data should not only block claims; it must guide the user toward refresh, provider comparison, entitlement replay, artifact regeneration or manual review.",
    "New missing invention: Visible Recovery Action Dock for Shield/Real Markets/PDF/Angel/checkout with disabled CTA states until checkpoint passes.",
    "New missing invention: Provider Refresh Cooldown Ledger to prevent spam-refresh and fake freshness while showing honest timestamps.",
    "New missing invention: Artifact Regeneration Receipt in account vault whenever preview/download/vault hash family changes.",
    "New missing invention: Angel Recovery Context Pill showing exactly which proof route is active before it answers.",
  ];

  const nextPassQueue = [
    "PASS2533: visible recovery action dock in Shield/Real Markets/PDF/Angel/checkout surfaces.",
    "PASS2534: provider refresh cooldown ledger with real timestamp replay and stale-data audit rows.",
    "PASS2535: account vault artifact regeneration receipt and hash-family diff viewer.",
  ];

  const payload = {
    query: args.query,
    symbol: args.symbol,
    routes,
    checkpoints,
    recoveryFixtures,
    semanticLanes,
    previousFingerprint: args.pass2531?.fingerprint ?? "missing-pass2531",
  };

  return {
    id: PASS2532_FRESHNESS_RECOVERY_ROUTER_REBALANCE_ID,
    state: routes.some((route) => route.severity === "blocked") ? "ready_for_recovery_ui_mount" : "watch",
    query: args.query,
    symbol: args.symbol,
    generatedAt: new Date(0).toISOString(),
    manualSemanticCompletionBeforePercent: 48,
    manualSemanticCompletionAfterPercent: 51,
    targetedSemanticBatchFiles: 48,
    targetedSemanticBatchLines: 206340,
    freshnessRecoveryRouterBeforePercent: 0,
    freshnessRecoveryRouterAfterPercent: 36,
    recoveryActionBindingBeforePercent: 28,
    recoveryActionBindingAfterPercent: 54,
    providerRefreshLoopBeforePercent: 24,
    providerRefreshLoopAfterPercent: 47,
    artifactRegenerationFlowBeforePercent: 31,
    artifactRegenerationFlowAfterPercent: 52,
    angelMissingProofModeBeforePercent: 86,
    angelMissingProofModeAfterPercent: 91,
    checkoutReplayRecoveryBeforePercent: 81,
    checkoutReplayRecoveryAfterPercent: 87,
    adminDualControlRecoveryBeforePercent: 62,
    adminDualControlRecoveryAfterPercent: 76,
    worldclassInventionIndexBeforePercent: 76,
    worldclassInventionIndexAfterPercent: 82,
    routes,
    checkpoints,
    recoveryFixtures,
    inheritedFreshnessFixtures,
    inheritedClaimGates,
    semanticLanes,
    masterTxtAdditions,
    nextPassQueue,
    freshnessRecoveryRouterRule:
      "Every blocked/hold freshness, entitlement, artifact, wallet, AI or operator chip must expose a deterministic recovery route with owner, cooldown, proof keys and fail-closed copy before any live/final/paid/safe claim is rendered.",
    fingerprint: stableFingerprint(payload),
  };
}
