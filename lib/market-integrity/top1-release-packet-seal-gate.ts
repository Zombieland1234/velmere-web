import { sha256Token } from "@/lib/security/cryptographic-digest";
import type { VelmereTier } from "@/lib/market-integrity/top1-risk-foundation";
import type { Pass2829ReleaseProofCollectorGate } from "@/lib/market-integrity/top1-release-proof-collector-gate";

export type Pass2830SealState =
  | "not_sealable"
  | "seal_ready"
  | "sealed"
  | "seal_stale"
  | "seal_revoked";

export type Pass2830ReleasePacketSealGate = {
  schemaVersion: "pass2830_release_packet_seal_gate_v1";
  surface: string;
  tier: VelmereTier;
  releasePacketId: string;
  sealId: string;
  sealState: Pass2830SealState;
  sealScore: number;
  sealedAt: string | null;
  expiresAt: string | null;
  packetFreshnessTtlHours: number;
  sealedArtifactCount: number;
  requiredArtifactCount: number;
  sealInputs: {
    payloadHash: string | null;
    sourceReceiptRoot: string | null;
    releasePacketId: string;
    collectorState: Pass2829ReleaseProofCollectorGate["collectorState"];
    proofCompletenessScore: number;
    p0Sealed: boolean;
    p1Sealed: boolean;
    requestedSeal: boolean;
    revoked: boolean;
    codeRefChanged: boolean;
  };
  regressionReplayPolicy: {
    mustReplayWhen: string[];
    replayBlockedWhen: string[];
    customerVisibleCopy: string;
  };
  launchClaimBoundary: {
    canAttachSealToCustomerSurface: boolean;
    canClaimLaunchReady: boolean;
    canClaimWorldClass100: false;
    reason: string;
  };
  operatorNextActions: string[];
};

export const PASS2830_RELEASE_PACKET_SEAL_ACCEPTANCE_GATES = [
  "PASS2830: Release proof packets are not customer proof until they are seal-ready or sealed against payloadHash, sourceReceiptRoot, releasePacketId, artifact rows and code/build metadata.",
  "PASS2830: A sealed release packet must expire or become stale after payload/source/code drift; the system must regenerate a new packet rather than mutating the previous seal.",
  "PASS2830: Revoked, stale or not-sealable packets cannot unlock launch-ready copy, PDF delivery proof, account vault proof or public 100% claims.",
  "PASS2830: Seal state must be visible in PDF payload, report route, Real Markets, report access, delivery state, release-readiness, evidence artifact state, methodology and Shield Pro.",
  "PASS2830: World-class 100% remains false even for sealed packets until live deploy monitoring, provider SLAs, screenshot QA, mobile QA and security scans are continuously replayed.",
] as const;

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Number(value.toFixed(2))));
}

function softHash(input: string) {
  return `pass2830-${sha256Token(input, 24)}`;
}

function addHours(iso: string, hours: number) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  date.setHours(date.getHours() + hours);
  return date.toISOString();
}

export function buildPass2830ReleasePacketSealGate(args: {
  surface: string;
  tier?: VelmereTier;
  collectorGate: Pass2829ReleaseProofCollectorGate;
  payloadHash?: string | null;
  sourceReceiptRoot?: string | null;
  generatedAt?: string;
  requestedSeal?: boolean;
  revoked?: boolean;
  codeRefChanged?: boolean;
  packetFreshnessTtlHours?: number;
}): Pass2830ReleasePacketSealGate {
  const generatedAt = args.generatedAt ?? new Date().toISOString();
  const ttlHours = args.packetFreshnessTtlHours ?? 24;
  const p0Rows = args.collectorGate.artifactRows.filter((row) => row.evidenceClass === "p0_release_blocker");
  const p1Rows = args.collectorGate.artifactRows.filter((row) => row.evidenceClass === "p1_launch_ready");
  const p0Sealed = p0Rows.length > 0 && p0Rows.every((row) => row.sealed && row.freshnessState === "fresh");
  const p1Sealed = p1Rows.length > 0 && p1Rows.every((row) => row.sealed && row.freshnessState === "fresh");
  const proofComplete = args.collectorGate.proofCompletenessScore >= 99;
  const packetReady = p0Sealed && p1Sealed && proofComplete && Boolean(args.payloadHash) && Boolean(args.sourceReceiptRoot);
  const sealState: Pass2830SealState = args.revoked
    ? "seal_revoked"
    : args.codeRefChanged
      ? "seal_stale"
      : packetReady && args.requestedSeal
        ? "sealed"
        : packetReady
          ? "seal_ready"
          : "not_sealable";
  const sealScore = clampScore(
    args.collectorGate.proofCompletenessScore + (p0Sealed ? 8 : -35) + (p1Sealed ? 8 : -18) + (args.payloadHash ? 4 : -12) + (args.sourceReceiptRoot ? 4 : -12) - (args.revoked ? 60 : 0) - (args.codeRefChanged ? 25 : 0),
  );
  const sealId = softHash([
    args.surface,
    args.tier ?? args.collectorGate.tier,
    args.collectorGate.releasePacketId,
    args.payloadHash ?? "no-payload",
    args.sourceReceiptRoot ?? "no-source-root",
    sealState,
    args.collectorGate.artifactRows.map((row) => `${row.kind}:${row.artifactId ?? row.freshnessState}:${row.sealed}`).join("|"),
  ].join("::"));
  const sealedAt = sealState === "sealed" ? generatedAt : null;
  const expiresAt = sealedAt ? addHours(sealedAt, ttlHours) : null;
  const canAttachSealToCustomerSurface = sealState === "sealed" || sealState === "seal_ready";
  const canClaimLaunchReady = sealState === "sealed";

  return {
    schemaVersion: "pass2830_release_packet_seal_gate_v1",
    surface: args.surface,
    tier: args.tier ?? args.collectorGate.tier,
    releasePacketId: args.collectorGate.releasePacketId,
    sealId,
    sealState,
    sealScore,
    sealedAt,
    expiresAt,
    packetFreshnessTtlHours: ttlHours,
    sealedArtifactCount: args.collectorGate.sealedArtifactCount,
    requiredArtifactCount: args.collectorGate.requiredArtifactCount,
    sealInputs: {
      payloadHash: args.payloadHash ?? null,
      sourceReceiptRoot: args.sourceReceiptRoot ?? null,
      releasePacketId: args.collectorGate.releasePacketId,
      collectorState: args.collectorGate.collectorState,
      proofCompletenessScore: args.collectorGate.proofCompletenessScore,
      p0Sealed,
      p1Sealed,
      requestedSeal: Boolean(args.requestedSeal),
      revoked: Boolean(args.revoked),
      codeRefChanged: Boolean(args.codeRefChanged),
    },
    regressionReplayPolicy: {
      mustReplayWhen: [
        "payloadHash changes",
        "sourceReceiptRoot changes",
        "build or typecheck artifact changes",
        "live provider adapter changes",
        "PDF renderer changes",
        "mobile/overlay code changes",
        "security entitlement/report-token code changes",
      ],
      replayBlockedWhen: [
        "seal is revoked",
        "code reference drift is detected",
        "P0 artifact is missing/stale/failed/prepared-only",
        "PDF parity packet is missing or not fresh",
        "security scan is missing or not fresh",
      ],
      customerVisibleCopy:
        "Release proof is sealed only for the specific payload, source root and artifact packet shown. Any drift requires a new replay and a new seal.",
    },
    launchClaimBoundary: {
      canAttachSealToCustomerSurface,
      canClaimLaunchReady,
      canClaimWorldClass100: false,
      reason: canClaimLaunchReady
        ? "Release packet is sealed for this payload/source root, but world-class 100% still requires continuous post-deploy monitoring and repeated live proof refresh."
        : sealState === "seal_ready"
          ? "Packet is seal-ready but not sealed; operator must run the seal action before launch-ready copy is allowed."
          : sealState === "seal_stale"
            ? "Packet is stale because code/source/payload drift was detected; regenerate and replay proof."
            : sealState === "seal_revoked"
              ? "Packet seal is revoked; customer proof and launch-ready copy are blocked."
              : "Packet is not sealable because P0/P1 artifacts or payload/source binding are missing.",
    },
    operatorNextActions: [
      "Attach fresh build and typecheck proof artifacts with exit codes and commit/build reference.",
      "Attach live provider smoke and PDF parity packets with payloadHash/sourceReceiptRoot metadata.",
      "Run mobile screenshot QA for Shield, Real Markets, Shield Pro, VLM and Community before sealing.",
      "Run SSRF/source poisoning/paid entitlement/report token security scans before sealing.",
      "Regenerate the seal after any payload/source/code drift instead of mutating a sealed packet.",
    ],
  };
}
