import type { VelmereTier } from "@/lib/market-integrity/top1-risk-foundation";
import type { Pass2831SealDriftMonitorGate } from "@/lib/market-integrity/top1-seal-drift-monitor-gate";

export type Pass2832ProductionCanaryState =
  | "canary_not_started"
  | "canary_running"
  | "rollback_required"
  | "rollback_executed"
  | "canary_promoted"
  | "rollout_blocked";

export type Pass2832ProductionCanaryRollbackGate = {
  schemaVersion: "pass2832_production_canary_rollback_gate_v1";
  surface: string;
  tier: VelmereTier;
  releasePacketId: string;
  sealId: string;
  canaryState: Pass2832ProductionCanaryState;
  canaryScore: number;
  generatedAt: string;
  rolloutPlan: {
    trafficPercent: number;
    minimumObservationMinutes: number;
    observedMinutes: number;
    maxSafeErrorRatePercent: number;
    maxSafeP95LatencyMs: number;
    rollbackSwitchAvailable: boolean;
  };
  runtimeSignals: {
    errorRatePercent: number;
    p95LatencyMs: number;
    providerFailureRatePercent: number;
    pdfMismatchCount: number;
    entitlementErrorCount: number;
    chartSkeletonSpike: boolean;
    customerDeliveryFailureCount: number;
  };
  rollbackBoundary: {
    rollbackRequired: boolean;
    rollbackExecuted: boolean;
    canPromoteToProduction: boolean;
    canKeepLaunchReadyCopy: boolean;
    canClaimWorldClass100: false;
    reason: string;
  };
  operatorNextActions: string[];
};

export const PASS2832_PRODUCTION_CANARY_ROLLBACK_ACCEPTANCE_GATES = [
  "PASS2832: A sealed and monitored packet still cannot go to full production without a canary rollout window, traffic cap, error budget, latency budget and rollback switch.",
  "PASS2832: Provider failures, PDF/UI mismatch, entitlement errors, chart skeleton spikes or customer delivery failures force rollback_required; they must not be hidden as degraded-but-launch-ready.",
  "PASS2832: Rollback execution freezes customer-facing launch-ready copy, account delivery, paid PDF promotion and public 100% claims until a new proof packet is replayed and resealed.",
  "PASS2832: Canary promotion requires PASS2831 monitor watching/launch-ready, sufficient observation time, low errors, low latency, zero PDF mismatch and zero entitlement/customer delivery failures.",
  "PASS2832: World-class 100% remains false until canary/rollback proof is fresh after deploy and the system survives production observation without drift or rollback triggers.",
] as const;

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Number(value.toFixed(2))));
}

function clampTraffic(value: number) {
  return Math.max(0, Math.min(100, Number(value.toFixed(2))));
}

export function buildPass2832ProductionCanaryRollbackGate(args: {
  surface: string;
  tier?: VelmereTier;
  sealDriftMonitorGate: Pass2831SealDriftMonitorGate;
  generatedAt?: string;
  trafficPercent?: number;
  minimumObservationMinutes?: number;
  observedMinutes?: number;
  errorRatePercent?: number;
  p95LatencyMs?: number;
  providerFailureRatePercent?: number;
  pdfMismatchCount?: number;
  entitlementErrorCount?: number;
  chartSkeletonSpike?: boolean;
  customerDeliveryFailureCount?: number;
  rollbackSwitchAvailable?: boolean;
  rollbackExecuted?: boolean;
}): Pass2832ProductionCanaryRollbackGate {
  const generatedAt = args.generatedAt ?? new Date().toISOString();
  const trafficPercent = clampTraffic(args.trafficPercent ?? 0);
  const minimumObservationMinutes = args.minimumObservationMinutes ?? 45;
  const observedMinutes = Math.max(0, args.observedMinutes ?? 0);
  const errorRatePercent = Math.max(0, Number((args.errorRatePercent ?? 0).toFixed(3)));
  const p95LatencyMs = Math.max(0, Math.round(args.p95LatencyMs ?? 0));
  const providerFailureRatePercent = Math.max(0, Number((args.providerFailureRatePercent ?? 0).toFixed(3)));
  const pdfMismatchCount = Math.max(0, Math.round(args.pdfMismatchCount ?? 0));
  const entitlementErrorCount = Math.max(0, Math.round(args.entitlementErrorCount ?? 0));
  const customerDeliveryFailureCount = Math.max(0, Math.round(args.customerDeliveryFailureCount ?? 0));
  const rollbackSwitchAvailable = args.rollbackSwitchAvailable ?? false;
  const monitorAllowsLaunch = args.sealDriftMonitorGate.replayBoundary.canKeepLaunchReady;
  const observationReady = trafficPercent > 0 && observedMinutes >= minimumObservationMinutes;
  const hardRuntimeFailure =
    errorRatePercent > 1 ||
    p95LatencyMs > 2500 ||
    providerFailureRatePercent > 5 ||
    pdfMismatchCount > 0 ||
    entitlementErrorCount > 0 ||
    customerDeliveryFailureCount > 0 ||
    Boolean(args.chartSkeletonSpike);
  const rollbackRequired = monitorAllowsLaunch && trafficPercent > 0 && hardRuntimeFailure;
  const rollbackExecuted = Boolean(args.rollbackExecuted);
  const canPromoteToProduction =
    monitorAllowsLaunch &&
    observationReady &&
    !hardRuntimeFailure &&
    rollbackSwitchAvailable &&
    args.sealDriftMonitorGate.monitorState === "watching";
  const canKeepLaunchReadyCopy = canPromoteToProduction && !rollbackRequired && !rollbackExecuted;

  const canaryState: Pass2832ProductionCanaryState = !monitorAllowsLaunch
    ? "rollout_blocked"
    : rollbackExecuted
      ? "rollback_executed"
      : rollbackRequired
        ? "rollback_required"
        : canPromoteToProduction
          ? "canary_promoted"
          : trafficPercent > 0
            ? "canary_running"
            : "canary_not_started";

  const canaryScore = clampScore(
    args.sealDriftMonitorGate.monitorScore +
      (monitorAllowsLaunch ? 10 : -35) +
      (rollbackSwitchAvailable ? 8 : -12) +
      (observationReady ? 12 : -8) -
      errorRatePercent * 14 -
      providerFailureRatePercent * 3 -
      pdfMismatchCount * 18 -
      entitlementErrorCount * 16 -
      customerDeliveryFailureCount * 12 -
      (args.chartSkeletonSpike ? 12 : 0) -
      (rollbackExecuted ? 25 : 0),
  );

  return {
    schemaVersion: "pass2832_production_canary_rollback_gate_v1",
    surface: args.surface,
    tier: args.tier ?? args.sealDriftMonitorGate.tier,
    releasePacketId: args.sealDriftMonitorGate.releasePacketId,
    sealId: args.sealDriftMonitorGate.sealId,
    canaryState,
    canaryScore,
    generatedAt,
    rolloutPlan: {
      trafficPercent,
      minimumObservationMinutes,
      observedMinutes,
      maxSafeErrorRatePercent: 1,
      maxSafeP95LatencyMs: 2500,
      rollbackSwitchAvailable,
    },
    runtimeSignals: {
      errorRatePercent,
      p95LatencyMs,
      providerFailureRatePercent,
      pdfMismatchCount,
      entitlementErrorCount,
      chartSkeletonSpike: Boolean(args.chartSkeletonSpike),
      customerDeliveryFailureCount,
    },
    rollbackBoundary: {
      rollbackRequired,
      rollbackExecuted,
      canPromoteToProduction,
      canKeepLaunchReadyCopy,
      canClaimWorldClass100: false,
      reason: !monitorAllowsLaunch
        ? "Canary is blocked because the seal drift monitor cannot keep launch-ready proof attached."
        : rollbackExecuted
          ? "Rollback has been executed; customer launch copy and paid promotion remain frozen until replay and reseal pass again."
          : rollbackRequired
            ? "Canary observed runtime failures; rollback is required before more traffic or launch-ready copy can stay live."
            : canPromoteToProduction
              ? "Canary meets observation, error, latency, entitlement, delivery and PDF parity budgets; production promotion may be reviewed, but 100% remains blocked."
              : trafficPercent > 0
                ? "Canary is running but lacks enough observation time or rollback readiness to promote."
                : "Canary has not started; launch-ready copy cannot move from sealed proof to production proof yet.",
    },
    operatorNextActions: [
      "Start canary at low traffic only after PASS2831 monitor is watching and rollback switch is available.",
      "Rollback immediately on PDF mismatch, entitlement errors, customer delivery failures, provider failure spike or chart skeleton spike.",
      "Do not increase traffic until build/typecheck/live provider smoke/mobile/security/PDF parity evidence remains fresh through the canary window.",
      "After rollback, replay proof, reseal, restart drift monitor and create a new canary packet instead of reusing stale production proof.",
    ],
  };
}
