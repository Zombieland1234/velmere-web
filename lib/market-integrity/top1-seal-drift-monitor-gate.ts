import type { VelmereTier } from "@/lib/market-integrity/top1-risk-foundation";
import type { Pass2830ReleasePacketSealGate } from "@/lib/market-integrity/top1-release-packet-seal-gate";

export type Pass2831SealDriftMonitorState =
  | "monitor_disabled"
  | "watching"
  | "replay_required"
  | "replay_blocked"
  | "seal_expired"
  | "seal_revoked";

export type Pass2831SealDriftMonitorGate = {
  schemaVersion: "pass2831_seal_drift_monitor_gate_v1";
  surface: string;
  tier: VelmereTier;
  releasePacketId: string;
  sealId: string;
  monitorState: Pass2831SealDriftMonitorState;
  monitorScore: number;
  generatedAt: string;
  lastReplayAt: string | null;
  nextReplayDueAt: string | null;
  replayCadenceHours: number;
  driftSignals: {
    payloadHashChanged: boolean;
    sourceReceiptRootChanged: boolean;
    codeRefChanged: boolean;
    providerRegistryChanged: boolean;
    pdfRendererChanged: boolean;
    securityPolicyChanged: boolean;
    entitlementPolicyChanged: boolean;
    chartRendererChanged: boolean;
    mobileSurfaceChanged: boolean;
  };
  liveMonitorSignals: {
    heartbeatCount: number;
    failedHeartbeatCount: number;
    latestHeartbeatAt: string | null;
    liveProviderSmokeFresh: boolean;
    pdfParityFresh: boolean;
    securityScanFresh: boolean;
    mobileQaFresh: boolean;
  };
  replayBoundary: {
    replayRequired: boolean;
    replayBlocked: boolean;
    canKeepSealAttached: boolean;
    canKeepLaunchReady: boolean;
    canClaimWorldClass100: false;
    reason: string;
  };
  operatorNextActions: string[];
};

export const PASS2831_SEAL_DRIFT_MONITOR_ACCEPTANCE_GATES = [
  "PASS2831: A sealed release packet must be continuously monitored for payload, source-root, code, provider-registry, PDF-renderer, security-policy, entitlement and mobile/chart drift.",
  "PASS2831: Any drift signal moves the packet to replay_required or replay_blocked; stale seals cannot keep launch-ready copy, customer proof, paid PDF evidence or account-vault delivery unlocked.",
  "PASS2831: Live monitoring heartbeats, provider smoke, PDF parity, security scan and mobile QA freshness must be tracked separately; a verifier log alone is not continuous proof.",
  "PASS2831: Revoked or expired seals are blocked even if old artifacts were once fresh; operator must generate a new packet, replay proof and reseal instead of mutating the old packet.",
  "PASS2831: World-class 100% remains false until the seal monitor has continuous fresh proof across build/typecheck/live providers/screenshots/mobile/security/PDF parity after deploy.",
] as const;

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Number(value.toFixed(2))));
}

function parseIso(value: string | null | undefined) {
  if (!value) return null;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : null;
}

function addHours(iso: string, hours: number) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  date.setHours(date.getHours() + hours);
  return date.toISOString();
}

export function buildPass2831SealDriftMonitorGate(args: {
  surface: string;
  tier?: VelmereTier;
  releasePacketSealGate: Pass2830ReleasePacketSealGate;
  generatedAt?: string;
  lastReplayAt?: string | null;
  latestHeartbeatAt?: string | null;
  replayCadenceHours?: number;
  payloadHashChanged?: boolean;
  sourceReceiptRootChanged?: boolean;
  codeRefChanged?: boolean;
  providerRegistryChanged?: boolean;
  pdfRendererChanged?: boolean;
  securityPolicyChanged?: boolean;
  entitlementPolicyChanged?: boolean;
  chartRendererChanged?: boolean;
  mobileSurfaceChanged?: boolean;
  heartbeatCount?: number;
  failedHeartbeatCount?: number;
  liveProviderSmokeFresh?: boolean;
  pdfParityFresh?: boolean;
  securityScanFresh?: boolean;
  mobileQaFresh?: boolean;
}): Pass2831SealDriftMonitorGate {
  const generatedAt = args.generatedAt ?? new Date().toISOString();
  const cadenceHours = args.replayCadenceHours ?? 24;
  const lastReplayAt = args.lastReplayAt ?? args.releasePacketSealGate.sealedAt ?? null;
  const nextReplayDueAt = lastReplayAt ? addHours(lastReplayAt, cadenceHours) : null;
  const now = parseIso(generatedAt) ?? Date.now();
  const expiresAt = parseIso(args.releasePacketSealGate.expiresAt);
  const nextDue = parseIso(nextReplayDueAt);
  const sealExpired = Boolean(expiresAt && expiresAt < now) || Boolean(nextDue && nextDue < now);
  const sealRevoked = args.releasePacketSealGate.sealState === "seal_revoked";
  const hasSeal = args.releasePacketSealGate.sealState === "sealed" || args.releasePacketSealGate.sealState === "seal_ready";
  const driftSignals = {
    payloadHashChanged: Boolean(args.payloadHashChanged),
    sourceReceiptRootChanged: Boolean(args.sourceReceiptRootChanged),
    codeRefChanged: Boolean(args.codeRefChanged),
    providerRegistryChanged: Boolean(args.providerRegistryChanged),
    pdfRendererChanged: Boolean(args.pdfRendererChanged),
    securityPolicyChanged: Boolean(args.securityPolicyChanged),
    entitlementPolicyChanged: Boolean(args.entitlementPolicyChanged),
    chartRendererChanged: Boolean(args.chartRendererChanged),
    mobileSurfaceChanged: Boolean(args.mobileSurfaceChanged),
  };
  const driftCount = Object.values(driftSignals).filter(Boolean).length;
  const failedHeartbeatCount = args.failedHeartbeatCount ?? 0;
  const heartbeatCount = args.heartbeatCount ?? 0;
  const freshnessFailures = [
    args.liveProviderSmokeFresh === false,
    args.pdfParityFresh === false,
    args.securityScanFresh === false,
    args.mobileQaFresh === false,
  ].filter(Boolean).length;
  const replayRequired = driftCount > 0 || sealExpired || freshnessFailures > 0 || failedHeartbeatCount > 0;
  const replayBlocked = sealRevoked || !hasSeal || driftSignals.payloadHashChanged || driftSignals.sourceReceiptRootChanged || driftSignals.securityPolicyChanged || driftSignals.entitlementPolicyChanged;
  const monitorState: Pass2831SealDriftMonitorState = !hasSeal
    ? "monitor_disabled"
    : sealRevoked
      ? "seal_revoked"
      : sealExpired
        ? "seal_expired"
        : replayBlocked
          ? "replay_blocked"
          : replayRequired
            ? "replay_required"
            : "watching";
  const canKeepSealAttached = hasSeal && !sealRevoked && !sealExpired && !replayBlocked;
  const canKeepLaunchReady = canKeepSealAttached && !replayRequired && args.releasePacketSealGate.launchClaimBoundary.canClaimLaunchReady;
  const monitorScore = clampScore(
    args.releasePacketSealGate.sealScore +
      (hasSeal ? 8 : -40) +
      (heartbeatCount > 0 ? 6 : -8) -
      driftCount * 10 -
      failedHeartbeatCount * 7 -
      freshnessFailures * 9 -
      (sealExpired ? 30 : 0) -
      (sealRevoked ? 60 : 0),
  );

  return {
    schemaVersion: "pass2831_seal_drift_monitor_gate_v1",
    surface: args.surface,
    tier: args.tier ?? args.releasePacketSealGate.tier,
    releasePacketId: args.releasePacketSealGate.releasePacketId,
    sealId: args.releasePacketSealGate.sealId,
    monitorState,
    monitorScore,
    generatedAt,
    lastReplayAt,
    nextReplayDueAt,
    replayCadenceHours: cadenceHours,
    driftSignals,
    liveMonitorSignals: {
      heartbeatCount,
      failedHeartbeatCount,
      latestHeartbeatAt: args.latestHeartbeatAt ?? null,
      liveProviderSmokeFresh: Boolean(args.liveProviderSmokeFresh),
      pdfParityFresh: Boolean(args.pdfParityFresh),
      securityScanFresh: Boolean(args.securityScanFresh),
      mobileQaFresh: Boolean(args.mobileQaFresh),
    },
    replayBoundary: {
      replayRequired,
      replayBlocked,
      canKeepSealAttached,
      canKeepLaunchReady,
      canClaimWorldClass100: false,
      reason: sealRevoked
        ? "Seal is revoked; old artifacts are metadata only and customer proof is blocked."
        : sealExpired
          ? "Seal monitor detected expired TTL/replay cadence; proof must be replayed and resealed."
          : replayBlocked
            ? "Critical drift or missing seal blocks replay reuse; regenerate the packet and reseal."
            : replayRequired
              ? "Non-critical drift or stale continuous proof requires replay before launch-ready copy can remain attached."
              : canKeepLaunchReady
                ? "Seal is currently watched with fresh continuous proof, but world-class 100% still requires post-deploy monitoring evidence over time."
                : "Monitor is active, but launch-ready remains blocked until the upstream seal and P0/P1 artifacts are fully sealed.",
    },
    operatorNextActions: [
      "Attach fresh heartbeat, live provider smoke, PDF parity, security scan and mobile QA artifact IDs before keeping launch-ready copy live.",
      "Replay and reseal after any payloadHash/sourceReceiptRoot/code/provider/PDF/security/entitlement/mobile/chart drift.",
      "Do not mutate a sealed release packet; create a new packet and link the stale packet as historical metadata.",
      "Keep Shield, Real Markets, Shield Pro, PDF, account vault and public launch copy on the same monitor state.",
    ],
  };
}
