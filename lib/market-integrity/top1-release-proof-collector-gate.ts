import { sha256Token } from "@/lib/security/cryptographic-digest";
import type { VelmereTier } from "@/lib/market-integrity/top1-risk-foundation";
import type {
  Pass2828ArtifactKind,
  Pass2828ArtifactStatus,
  Pass2828EvidenceArtifactHandoffGate,
} from "@/lib/market-integrity/top1-evidence-artifact-handoff-gate";

export type Pass2829ProofFreshnessState =
  | "missing"
  | "fresh"
  | "stale"
  | "failed"
  | "prepared_only";

export type Pass2829ReleaseProofCollectorGate = {
  schemaVersion: "pass2829_release_proof_collector_gate_v1";
  surface: string;
  tier: VelmereTier;
  releasePacketId: string;
  collectorState:
    | "blocked_missing_p0"
    | "collecting_prepared_artifacts"
    | "review_packet_ready"
    | "sealed_release_packet";
  proofCompletenessScore: number;
  sealedArtifactCount: number;
  requiredArtifactCount: number;
  artifactRows: Array<{
    kind: Pass2828ArtifactKind;
    status: Pass2828ArtifactStatus;
    artifactId: string | null;
    freshnessState: Pass2829ProofFreshnessState;
    sealed: boolean;
    evidenceClass: "p0_release_blocker" | "p1_launch_ready" | "p2_operator_review";
    rule: string;
  }>;
  releasePacketBoundary: {
    canAttachToCustomerClaim: boolean;
    canClaimLaunchReady: boolean;
    canClaimWorldClass100: false;
    reason: string;
  };
  artifactStoragePolicy: {
    requiredMetadata: string[];
    immutableFields: string[];
    forbiddenEvidence: string[];
    retentionNote: string;
  };
  operatorRunbook: {
    nextCommands: string[];
    screenshotRoutes: string[];
    liveSmokeTargets: string[];
    pdfParityTargets: string[];
  };
};

export const PASS2829_RELEASE_PROOF_COLLECTOR_ACCEPTANCE_GATES = [
  "PASS2829: Artifact IDs are not enough; release proof packets must classify each artifact as fresh, stale, failed, prepared-only or missing before customer launch claims.",
  "PASS2829: Build and typecheck artifacts are P0 release blockers. If either is missing, stale, failed or prepared-only, launch-ready and 100% claims stay blocked.",
  "PASS2829: A sealed release packet must bind build/typecheck/i18n/verifier/live smoke/screenshots/mobile/security/PDF parity artifacts to one payloadHash/sourceReceiptRoot family before UI/PDF/account/email handoff can reference it.",
  "PASS2829: Prepared verifier text, local notes, screenshots without artifact IDs, or logs without immutable metadata cannot be upgraded into proof.",
  "PASS2829: The release proof collector must be visible in PDF payload, report route, Real Markets, report access, delivery state, release-readiness, methodology and Shield Pro so operator/customer views do not drift.",
] as const;

const ARTIFACT_EVIDENCE_CLASS: Record<Pass2828ArtifactKind, Pass2829ReleaseProofCollectorGate["artifactRows"][number]["evidenceClass"]> = {
  build_log: "p0_release_blocker",
  typecheck_log: "p0_release_blocker",
  i18n_log: "p2_operator_review",
  verifier_log: "p2_operator_review",
  live_provider_smoke: "p1_launch_ready",
  screenshot_pack: "p1_launch_ready",
  mobile_screenshot_pack: "p1_launch_ready",
  security_scan: "p1_launch_ready",
  pdf_parity_packet: "p1_launch_ready",
};

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Number(value.toFixed(2))));
}

function softHash(input: string) {
  return `pass2829-${sha256Token(input, 24)}`;
}

function freshnessFor(status: Pass2828ArtifactStatus, artifactId: string | null): Pass2829ProofFreshnessState {
  if (status === "failed") return "failed";
  if (status === "stale") return "stale";
  if (status === "prepared") return "prepared_only";
  if (status === "attached" && artifactId) return "fresh";
  return "missing";
}

function ruleFor(kind: Pass2828ArtifactKind, freshnessState: Pass2829ProofFreshnessState) {
  const base: Record<Pass2828ArtifactKind, string> = {
    build_log: "Attach immutable npm run build artifact with commit/ref, timestamp, exit code and redacted environment metadata.",
    typecheck_log: "Attach immutable typecheck artifact with dependency install state and exit code; verifier scripts do not replace this.",
    i18n_log: "Attach locale purity/i18n artifact or keep as operator-review evidence only.",
    verifier_log: "Attach verifier log as coverage evidence; never treat it as full build, live provider or screenshot proof.",
    live_provider_smoke: "Attach live provider smoke packet proving source-bound/degraded/circuit-open behavior for BTC/ETH/SOL/AAPL/NVDA/SPY/EURUSD.",
    screenshot_pack: "Attach desktop screenshots for Shield, Real Markets, Shield Pro, VLM, Community, methodology and PDF preview.",
    mobile_screenshot_pack: "Attach 390x844 mobile screenshots proving no hidden overlay, scroll trap, unsafe table overflow or chart touch bug.",
    security_scan: "Attach security scan for SSRF, source poisoning, paid entitlement, token replay, report access and community links.",
    pdf_parity_packet: "Attach PDF parity packet binding UI preview/download/account/email/API handoff to payloadHash and sourceReceiptRoot.",
  };
  if (freshnessState === "fresh") return `${base[kind]} Status: fresh and collectible.`;
  if (freshnessState === "prepared_only") return `${base[kind]} Status: prepared-only; not customer proof.`;
  if (freshnessState === "stale") return `${base[kind]} Status: stale; recapture before release.`;
  if (freshnessState === "failed") return `${base[kind]} Status: failed; release blocker until resolved.`;
  return `${base[kind]} Status: missing; cannot claim launch-ready.`;
}

export function buildPass2829ReleaseProofCollectorGate(args: {
  surface: string;
  tier?: VelmereTier;
  handoffGate: Pass2828EvidenceArtifactHandoffGate;
  payloadHash?: string | null;
  sourceReceiptRoot?: string | null;
  sealedPacketRequested?: boolean;
}): Pass2829ReleaseProofCollectorGate {
  const rows = args.handoffGate.artifactMatrix.map((artifact) => {
    const freshnessState = freshnessFor(artifact.status, artifact.artifactId);
    const sealed = freshnessState === "fresh" && Boolean(artifact.artifactId);
    return {
      kind: artifact.kind,
      status: artifact.status,
      artifactId: artifact.artifactId,
      freshnessState,
      sealed,
      evidenceClass: ARTIFACT_EVIDENCE_CLASS[artifact.kind],
      rule: ruleFor(artifact.kind, freshnessState),
    };
  });
  const requiredRows = rows.filter((row) => row.evidenceClass !== "p2_operator_review");
  const sealedRequired = requiredRows.filter((row) => row.sealed).length;
  const p0Blocked = rows
    .filter((row) => row.evidenceClass === "p0_release_blocker")
    .some((row) => !row.sealed);
  const failedOrStale = rows.some((row) => row.freshnessState === "failed" || row.freshnessState === "stale");
  const allRequiredSealed = requiredRows.every((row) => row.sealed);
  const preparedOnly = rows.some((row) => row.freshnessState === "prepared_only");
  const proofCompletenessScore = clampScore(
    (sealedRequired / requiredRows.length) * 100 - (p0Blocked ? 35 : 0) - (failedOrStale ? 20 : 0) - (preparedOnly ? 6 : 0),
  );
  const collectorState = p0Blocked
    ? "blocked_missing_p0"
    : allRequiredSealed && args.sealedPacketRequested
      ? "sealed_release_packet"
      : allRequiredSealed
        ? "review_packet_ready"
        : "collecting_prepared_artifacts";
  const releasePacketId = softHash([
    args.surface,
    args.tier ?? args.handoffGate.tier,
    args.handoffGate.manifestId,
    args.payloadHash ?? "no-payload",
    args.sourceReceiptRoot ?? "no-source-root",
    collectorState,
    rows.map((row) => `${row.kind}:${row.artifactId ?? row.freshnessState}`).join("|"),
  ].join("::"));

  return {
    schemaVersion: "pass2829_release_proof_collector_gate_v1",
    surface: args.surface,
    tier: args.tier ?? args.handoffGate.tier,
    releasePacketId,
    collectorState,
    proofCompletenessScore,
    sealedArtifactCount: rows.filter((row) => row.sealed).length,
    requiredArtifactCount: requiredRows.length,
    artifactRows: rows,
    releasePacketBoundary: {
      canAttachToCustomerClaim: collectorState === "sealed_release_packet" || collectorState === "review_packet_ready",
      canClaimLaunchReady: collectorState === "sealed_release_packet",
      canClaimWorldClass100: false,
      reason:
        collectorState === "sealed_release_packet"
          ? "Required artifacts are sealed, but world-class 100% still requires post-deploy monitoring, replayable proof review and no open P0/P1 blockers."
          : p0Blocked
            ? "Build/typecheck proof is missing or not sealed; customer launch-ready claims remain blocked."
            : "Release packet is still collecting/reviewing artifacts; prepared proof cannot be promoted to a customer claim.",
    },
    artifactStoragePolicy: {
      requiredMetadata: ["artifactId", "kind", "commitOrBuildRef", "createdAt", "exitCode", "payloadHash", "sourceReceiptRoot", "redactionStatus"],
      immutableFields: ["artifactId", "kind", "payloadHash", "sourceReceiptRoot", "sha256", "createdAt", "commandOrRoute"],
      forbiddenEvidence: ["screenshots without route/device", "logs with secrets", "prepared-only notes", "unredacted private project docs", "wallet connect as payment proof"],
      retentionNote: "Keep release packets immutable and redacted; regenerate rather than mutate if payload/source root changes.",
    },
    operatorRunbook: {
      nextCommands: args.handoffGate.operatorHandoff.requiredCommandReceipts,
      screenshotRoutes: args.handoffGate.operatorHandoff.screenshotRoutes,
      liveSmokeTargets: args.handoffGate.operatorHandoff.liveProviderTargets,
      pdfParityTargets: args.handoffGate.operatorHandoff.pdfParityTargets,
    },
  };
}
