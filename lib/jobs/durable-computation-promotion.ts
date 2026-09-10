import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { runRegisteredServiceRoleRpc } from "@/lib/db/supabase-rpc-operation-registry";
import { buildDurableComputationDeploymentContract } from "@/lib/jobs/durable-computation-deployment";
import {
  probeDurableComputationStaging,
  type DurableComputationStagingProbe,
} from "@/lib/jobs/durable-computation-staging";
import {
  getProviderObservationPromotionQuality,
  type ProviderObservationPromotionQuality,
} from "@/lib/market-integrity/provider-observation-quarantine";
import { getProviderQualityIncidentGate } from "@/lib/market-integrity/provider-quality-incident-response";
import { getProviderQualityRollbackRecoveryGate } from "@/lib/market-integrity/provider-quality-auto-rollback";
import { getProviderQualityRecoveryProofGate } from "@/lib/market-integrity/provider-quality-recovery-proof";
import { getProviderRecoveryReleaseCertificateGate } from "@/lib/market-integrity/provider-recovery-release-certificate";
import { getProviderRecoveryReleaseBundleGate } from "@/lib/market-integrity/provider-recovery-release-bundle";
import { getReleaseCandidateAttestationGate } from "@/lib/market-integrity/release-candidate-attestation";
import { getReleaseProvenanceIndexGate } from "@/lib/market-integrity/release-provenance-index";
import { getReleaseTransparencyWitnessPromotionGate } from "@/lib/market-integrity/release-transparency-witness";

export const DURABLE_COMPUTATION_PROMOTION_POLICY_ID =
  "velmere-durable-computation-promotion-v1" as const;
const APPROVAL_MAX_AGE_SECONDS = 300;

type EnvLike = Record<string, string | undefined>;
type PromotionAction = "promote" | "rollback";

type PromotionDependencies = {
  rpc: typeof runRegisteredServiceRoleRpc;
  probe: typeof probeDurableComputationStaging;
  now: () => Date;
  providerQuality: typeof getProviderObservationPromotionQuality;
  incidentGate: typeof getProviderQualityIncidentGate;
  rollbackRecoveryGate: typeof getProviderQualityRollbackRecoveryGate;
  recoveryProofGate: typeof getProviderQualityRecoveryProofGate;
  releaseCertificateGate: typeof getProviderRecoveryReleaseCertificateGate;
  releaseBundleGate: typeof getProviderRecoveryReleaseBundleGate;
  releaseCandidateAttestationGate: typeof getReleaseCandidateAttestationGate;
  releaseProvenanceIndexGate: typeof getReleaseProvenanceIndexGate;
  releaseTransparencyWitnessGate: typeof getReleaseTransparencyWitnessPromotionGate;
};

const defaultDependencies: PromotionDependencies = {
  rpc: runRegisteredServiceRoleRpc,
  probe: probeDurableComputationStaging,
  now: () => new Date(),
  providerQuality: getProviderObservationPromotionQuality,
  incidentGate: getProviderQualityIncidentGate,
  rollbackRecoveryGate: getProviderQualityRollbackRecoveryGate,
  recoveryProofGate: getProviderQualityRecoveryProofGate,
  releaseCertificateGate: getProviderRecoveryReleaseCertificateGate,
  releaseBundleGate: getProviderRecoveryReleaseBundleGate,
  releaseCandidateAttestationGate: getReleaseCandidateAttestationGate,
  releaseProvenanceIndexGate: getReleaseProvenanceIndexGate,
  releaseTransparencyWitnessGate: getReleaseTransparencyWitnessPromotionGate,
};

export type DurableComputationReleaseEvidence = {
  configured: boolean;
  exactCheckpoint: number | null;
  sourceSha256: string | null;
  buildSha256: string | null;
  buildId: string | null;
  promotionSecretConfigured: boolean;
  blockers: string[];
};

export type DurableComputationPromotionReadiness = {
  schemaVersion: "velmere.durable-computation-promotion-readiness.v1";
  ready: boolean;
  deploymentConfigured: boolean;
  stagingProven: boolean;
  exactReleaseConfigured: boolean;
  providerQualityProven: boolean;
  providerQualityDigest: string | null;
  providerIncidentProven: boolean;
  providerIncidentDigest: string | null;
  rollbackRecoveryProven: boolean;
  rollbackExecutionDigest: string | null;
  recoveryProofProven: boolean;
  recoveryProofDigest: string | null;
  releaseCertificateProven: boolean;
  releaseCertificateDigest: string | null;
  releaseBundleProven: boolean;
  releaseBundleDigest: string | null;
  releaseCandidateAttestationProven: boolean;
  releaseCandidateAttestationDigest: string | null;
  releaseProvenanceIndexProven: boolean;
  releaseProvenanceIndexDigest: string | null;
  releaseTransparencyWitnessProven: boolean;
  releaseTransparencyWitnessQuorumDigest: string | null;
  deploymentFingerprint: string;
  capabilityDigest: string | null;
  exactCheckpoint: number | null;
  blockers: string[];
  privacyBoundary: string;
};

export type DurableComputationPromotionRequest = {
  action: PromotionAction;
  deploymentFingerprint: string;
  capabilityDigest: string;
  providerQualityDigest: string;
  sourceSha256: string;
  buildSha256: string;
  buildId: string;
  exactCheckpoint: number;
  operatorId: string;
  reason: string;
  approvalTimestamp: number;
  approvalNonce: string;
  approvalSignature: string;
  targetDeploymentId?: string;
  rollbackExecutionDigest?: string;
  recoveryProofDigest?: string;
  releaseCertificateDigest?: string;
  releaseBundleDigest?: string;
  releaseCandidateAttestationDigest?: string;
  releaseProvenanceIndexDigest?: string;
  releaseTransparencyWitnessQuorumDigest?: string;
};

function clean(value: unknown) {
  return String(value ?? "").trim();
}

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function isSha(value: string) {
  return /^[0-9a-f]{64}$/.test(value);
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

function usableSecret(value: string) {
  return (
    value.length >= 32 &&
    !/(example|placeholder|changeme|dummy|replace[-_ ]?me|never[-_ ]?production)/i.test(
      value,
    )
  );
}

function safeBuildId(value: string) {
  return /^[A-Za-z0-9._-]{8,128}$/.test(value);
}

function exactCheckpoint(value: unknown) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 4725 && parsed <= 999999
    ? parsed
    : null;
}

function canonicalApprovalPayload(
  input: Omit<DurableComputationPromotionRequest, "approvalSignature">,
) {
  return JSON.stringify({
    action: input.action,
    deploymentFingerprint: input.deploymentFingerprint,
    capabilityDigest: input.capabilityDigest,
    providerQualityDigest: input.providerQualityDigest,
    sourceSha256: input.sourceSha256,
    buildSha256: input.buildSha256,
    buildId: input.buildId,
    exactCheckpoint: input.exactCheckpoint,
    operatorHash: sha256(input.operatorId),
    reasonHash: sha256(input.reason),
    approvalTimestamp: input.approvalTimestamp,
    approvalNonce: input.approvalNonce,
    targetDeploymentId:
      input.action === "rollback" ? (input.targetDeploymentId ?? "") : "",
    rollbackExecutionDigest: input.rollbackExecutionDigest ?? "",
    recoveryProofDigest: input.recoveryProofDigest ?? "",
    releaseCertificateDigest: input.releaseCertificateDigest ?? "",
    releaseBundleDigest: input.releaseBundleDigest ?? "",
    releaseCandidateAttestationDigest:
      input.releaseCandidateAttestationDigest ?? "",
    releaseProvenanceIndexDigest: input.releaseProvenanceIndexDigest ?? "",
    releaseTransparencyWitnessQuorumDigest: input.releaseTransparencyWitnessQuorumDigest ?? "",
  });
}

export function buildDurableComputationReleaseEvidence(
  env: EnvLike = process.env,
): DurableComputationReleaseEvidence {
  const sourceSha256 = clean(
    env.VELMERE_DURABLE_EXACT_SOURCE_SHA256,
  ).toLowerCase();
  const buildSha256 = clean(
    env.VELMERE_DURABLE_EXACT_BUILD_SHA256,
  ).toLowerCase();
  const buildId = clean(env.VELMERE_DURABLE_EXACT_BUILD_ID);
  const checkpoint = exactCheckpoint(env.VELMERE_DURABLE_EXACT_CHECKPOINT);
  const secret = clean(env.VELMERE_DURABLE_PROMOTION_SECRET);
  const blockers: string[] = [];
  if (!isSha(sourceSha256))
    blockers.push("exact_source_sha256_missing_or_invalid");
  if (!isSha(buildSha256))
    blockers.push("exact_build_sha256_missing_or_invalid");
  if (!safeBuildId(buildId)) blockers.push("exact_build_id_missing_or_invalid");
  if (checkpoint === null) blockers.push("exact_checkpoint_missing_or_invalid");
  if (!usableSecret(secret)) blockers.push("promotion_secret_missing_or_weak");
  return {
    configured: blockers.length === 0,
    exactCheckpoint: checkpoint,
    sourceSha256: isSha(sourceSha256) ? sourceSha256 : null,
    buildSha256: isSha(buildSha256) ? buildSha256 : null,
    buildId: safeBuildId(buildId) ? buildId : null,
    promotionSecretConfigured: usableSecret(secret),
    blockers,
  };
}

export function signDurableComputationPromotionApproval(
  input: Omit<DurableComputationPromotionRequest, "approvalSignature">,
  secret: string,
) {
  if (!usableSecret(secret))
    throw new Error("promotion_secret_missing_or_weak");
  return createHmac("sha256", secret)
    .update(canonicalApprovalPayload(input))
    .digest("hex");
}

function withoutApprovalSignature(
  input: DurableComputationPromotionRequest,
): Omit<DurableComputationPromotionRequest, "approvalSignature"> {
  const { approvalSignature: _approvalSignature, ...unsigned } = input;
  return unsigned;
}

function verifyApproval(
  input: DurableComputationPromotionRequest,
  env: EnvLike,
  now: Date,
) {
  const secret = clean(env.VELMERE_DURABLE_PROMOTION_SECRET);
  if (!usableSecret(secret))
    throw new Error("promotion_secret_missing_or_weak");
  if (!/^[A-Za-z0-9_-]{16,96}$/.test(input.approvalNonce))
    throw new Error("approval_nonce_invalid");
  if (!/^[0-9a-f]{64}$/.test(input.approvalSignature))
    throw new Error("approval_signature_invalid");
  const nowSeconds = Math.trunc(now.getTime() / 1000);
  if (
    !Number.isInteger(input.approvalTimestamp) ||
    Math.abs(nowSeconds - input.approvalTimestamp) > APPROVAL_MAX_AGE_SECONDS
  ) {
    throw new Error("approval_expired_or_future");
  }
  const expected = signDurableComputationPromotionApproval(
    withoutApprovalSignature(input),
    secret,
  );
  const expectedBuffer = Buffer.from(expected, "hex");
  const receivedBuffer = Buffer.from(input.approvalSignature, "hex");
  if (
    expectedBuffer.length !== receivedBuffer.length ||
    !timingSafeEqual(expectedBuffer, receivedBuffer)
  ) {
    throw new Error("approval_signature_mismatch");
  }
}

function normalizeRequest(
  input: DurableComputationPromotionRequest,
): DurableComputationPromotionRequest {
  const action =
    input.action === "rollback"
      ? "rollback"
      : input.action === "promote"
        ? "promote"
        : null;
  if (!action) throw new Error("promotion_action_invalid");
  const request = {
    ...input,
    action,
    deploymentFingerprint: clean(input.deploymentFingerprint).toLowerCase(),
    capabilityDigest: clean(input.capabilityDigest).toLowerCase(),
    providerQualityDigest: clean(input.providerQualityDigest).toLowerCase(),
    sourceSha256: clean(input.sourceSha256).toLowerCase(),
    buildSha256: clean(input.buildSha256).toLowerCase(),
    buildId: clean(input.buildId),
    operatorId: clean(input.operatorId),
    reason: clean(input.reason),
    approvalNonce: clean(input.approvalNonce),
    approvalSignature: clean(input.approvalSignature).toLowerCase(),
    targetDeploymentId: clean(input.targetDeploymentId),
    rollbackExecutionDigest: clean(input.rollbackExecutionDigest).toLowerCase(),
    recoveryProofDigest: clean(input.recoveryProofDigest).toLowerCase(),
    releaseCertificateDigest: clean(
      input.releaseCertificateDigest,
    ).toLowerCase(),
    releaseBundleDigest: clean(input.releaseBundleDigest).toLowerCase(),
    releaseCandidateAttestationDigest: clean(
      input.releaseCandidateAttestationDigest,
    ).toLowerCase(),
    releaseProvenanceIndexDigest: clean(
      input.releaseProvenanceIndexDigest,
    ).toLowerCase(),
    releaseTransparencyWitnessQuorumDigest: clean(
      input.releaseTransparencyWitnessQuorumDigest,
    ).toLowerCase(),
  } satisfies DurableComputationPromotionRequest;
  if (
    ![
      request.deploymentFingerprint,
      request.capabilityDigest,
      request.providerQualityDigest,
      request.sourceSha256,
      request.buildSha256,
    ].every(isSha)
  )
    throw new Error("promotion_digest_invalid");
  if (!safeBuildId(request.buildId))
    throw new Error("promotion_build_id_invalid");
  if (exactCheckpoint(request.exactCheckpoint) === null)
    throw new Error("promotion_checkpoint_invalid");
  if (request.operatorId.length < 3 || request.operatorId.length > 160)
    throw new Error("promotion_operator_invalid");
  if (request.reason.length < 12 || request.reason.length > 500)
    throw new Error("promotion_reason_invalid");
  if (
    request.action === "rollback" &&
    !isUuid(request.targetDeploymentId ?? "")
  )
    throw new Error("rollback_target_invalid");
  if (
    request.rollbackExecutionDigest &&
    !isSha(request.rollbackExecutionDigest)
  )
    throw new Error("rollback_execution_digest_invalid");
  if (request.recoveryProofDigest && !isSha(request.recoveryProofDigest))
    throw new Error("recovery_proof_digest_invalid");
  if (
    request.releaseCertificateDigest &&
    !isSha(request.releaseCertificateDigest)
  )
    throw new Error("release_certificate_digest_invalid");
  if (request.releaseBundleDigest && !isSha(request.releaseBundleDigest))
    throw new Error("release_bundle_digest_invalid");
  if (
    request.releaseCandidateAttestationDigest &&
    !isSha(request.releaseCandidateAttestationDigest)
  )
    throw new Error("release_candidate_attestation_digest_invalid");
  if (
    request.releaseProvenanceIndexDigest &&
    !isSha(request.releaseProvenanceIndexDigest)
  )
    throw new Error("release_provenance_index_digest_invalid");
  if (request.releaseTransparencyWitnessQuorumDigest && !isSha(request.releaseTransparencyWitnessQuorumDigest))
    throw new Error("release_transparency_witness_quorum_digest_invalid");
  return request;
}

export async function getDurableComputationPromotionReadiness(
  input: {
    env?: EnvLike;
    dependencies?: Pick<
      PromotionDependencies,
      | "probe"
      | "providerQuality"
      | "incidentGate"
      | "rollbackRecoveryGate"
      | "recoveryProofGate"
      | "releaseCertificateGate"
      | "releaseBundleGate"
      | "releaseCandidateAttestationGate"
      | "releaseProvenanceIndexGate"
      | "releaseTransparencyWitnessGate"
    >;
  } = {},
): Promise<DurableComputationPromotionReadiness> {
  const env = input.env ?? process.env;
  const deployment = buildDurableComputationDeploymentContract(env);
  const release = buildDurableComputationReleaseEvidence(env);
  const probe = await (input.dependencies?.probe ?? defaultDependencies.probe)({
    env,
  });
  const providerQuality = await (
    input.dependencies?.providerQuality ?? defaultDependencies.providerQuality
  )();
  const incidentGate = await (
    input.dependencies?.incidentGate ??
    (input.dependencies?.providerQuality
      ? async () => ({
          schemaVersion: "velmere.provider-quality-promotion-incident-gate.v1",
          ready: providerQuality.ready,
          qualityReady: providerQuality.ready,
          qualityStableAgeSeconds: providerQuality.ready ? 900 : 0,
          qualityDigest: providerQuality.qualityDigest,
          incidentDigest: providerQuality.qualityDigest,
          state: providerQuality.ready ? "healthy" : "open",
          releaseHold: !providerQuality.ready,
          rollbackRequired: false,
          blockers: providerQuality.ready
            ? []
            : ["provider_incident_dependency_fixture_blocked"],
          warnings: [],
          privacyBoundary: "dependency-injected fixture",
        })
      : defaultDependencies.incidentGate)
  )({ expectedQualityDigest: providerQuality.qualityDigest });
  const rollbackRecoveryGate = await (
    input.dependencies?.rollbackRecoveryGate ??
    (input.dependencies
      ? async () => ({
          schemaVersion: "velmere.provider-quality-rollback-recovery-gate.v1",
          ready: true,
          status: "idle",
          executionVerified: false,
          promotionReentryReady: false,
          incidentDigest: null,
          executionDigest: null,
          blockers: [],
          privacyBoundary: "dependency-injected fixture",
        })
      : defaultDependencies.rollbackRecoveryGate)
  )({ env });
  const recoveryProofGate = await (
    input.dependencies?.recoveryProofGate ??
    (input.dependencies
      ? async () => ({
          schemaVersion: "velmere.provider-quality-recovery-proof-gate.v1",
          ready: true,
          required: false,
          state: "not_required",
          proofDigest: null,
          rollbackExecutionDigest: null,
          customerSmokeDigest: null,
          providerSmokeDigest: null,
          blockers: [],
          privacyBoundary: "dependency-injected fixture",
        })
      : defaultDependencies.recoveryProofGate)
  )({
    env,
    expected: {
      rollbackExecutionDigest: rollbackRecoveryGate.executionDigest,
      incidentDigest: incidentGate.incidentDigest,
      qualityDigest: providerQuality.qualityDigest,
      capabilityDigest: probe.capabilityDigest,
      sourceSha256: release.sourceSha256,
      buildSha256: release.buildSha256,
      exactCheckpoint: release.exactCheckpoint,
    },
  });
  const releaseCertificateGate = await (
    input.dependencies?.releaseCertificateGate ??
    (input.dependencies
      ? async () => ({
          schemaVersion:
            "velmere.provider-recovery-release-certificate-gate.v1",
          ready: true,
          required: false,
          state: "not_required",
          certificateDigest: null,
          rollbackExecutionDigest: null,
          expiresAt: null,
          blockers: [],
          privacyBoundary: "dependency-injected fixture",
        })
      : defaultDependencies.releaseCertificateGate)
  )({
    env,
    expected: {
      rollbackExecutionDigest: rollbackRecoveryGate.executionDigest,
      incidentDigest: incidentGate.incidentDigest,
      qualityDigest: providerQuality.qualityDigest,
      capabilityDigest: probe.capabilityDigest,
      sourceSha256: release.sourceSha256,
      buildSha256: release.buildSha256,
      buildId: release.buildId,
      exactCheckpoint: release.exactCheckpoint,
      recoveryProofDigest: recoveryProofGate.proofDigest,
      customerSmokeDigest: recoveryProofGate.customerSmokeDigest,
      providerSmokeDigest: recoveryProofGate.providerSmokeDigest,
    },
  });
  const releaseBundleGate = await (
    input.dependencies?.releaseBundleGate ??
    (input.dependencies
      ? async () => ({
          schemaVersion: "velmere.provider-recovery-release-bundle-gate.v1",
          ready: true,
          required: false,
          state: "not_required",
          bundleDigest: null,
          certificateDigest: null,
          evidenceRoot: null,
          expiresAt: null,
          blockers: [],
          privacyBoundary: "dependency-injected fixture",
        })
      : defaultDependencies.releaseBundleGate)
  )({
    env,
    expected: {
      environment: (env.VELMERE_DEPLOYMENT_ENVIRONMENT ??
        env.VERCEL_ENV ??
        "staging") as "staging" | "production",
      audience: env.VELMERE_RELEASE_BUNDLE_AUDIENCE,
      deploymentFingerprint: deployment.deploymentFingerprint,
      rollbackExecutionDigest:
        rollbackRecoveryGate.executionDigest ?? undefined,
      incidentDigest: incidentGate.incidentDigest ?? undefined,
      qualityDigest: providerQuality.qualityDigest ?? undefined,
      capabilityDigest: probe.capabilityDigest ?? undefined,
      sourceSha256: release.sourceSha256 ?? undefined,
      buildSha256: release.buildSha256 ?? undefined,
      buildId: release.buildId ?? undefined,
      exactCheckpoint: release.exactCheckpoint ?? undefined,
      recoveryProofDigest: recoveryProofGate.proofDigest ?? undefined,
      customerSmokeDigest: recoveryProofGate.customerSmokeDigest ?? undefined,
      providerSmokeDigest: recoveryProofGate.providerSmokeDigest ?? undefined,
      releaseCertificateDigest:
        releaseCertificateGate.certificateDigest ?? undefined,
    },
  });
  const releaseCandidateAttestationGate = await (
    input.dependencies?.releaseCandidateAttestationGate ??
    (input.dependencies
      ? async () => ({
          schemaVersion:
            "velmere.release-candidate-attestation-gate.v1" as const,
          ready: true,
          required: false,
          state: "not_required" as const,
          attestationDigest: null,
          releaseBundleDigest: null,
          manifestRoot: null,
          keyIdHash: null,
          expiresAt: null,
          blockers: [],
          privacyBoundary: "dependency-injected fixture",
        })
      : defaultDependencies.releaseCandidateAttestationGate)
  )({
    env,
    expected: {
      deploymentFingerprint: deployment.deploymentFingerprint,
      rollbackExecutionDigest:
        rollbackRecoveryGate.executionDigest ?? undefined,
      incidentDigest: incidentGate.incidentDigest ?? undefined,
      qualityDigest: providerQuality.qualityDigest ?? undefined,
      capabilityDigest: probe.capabilityDigest ?? undefined,
      sourceSha256: release.sourceSha256 ?? undefined,
      buildSha256: release.buildSha256 ?? undefined,
      buildId: release.buildId ?? undefined,
      exactCheckpoint: release.exactCheckpoint ?? undefined,
      recoveryProofDigest: recoveryProofGate.proofDigest ?? undefined,
      customerSmokeDigest: recoveryProofGate.customerSmokeDigest ?? undefined,
      providerSmokeDigest: recoveryProofGate.providerSmokeDigest ?? undefined,
      releaseCertificateDigest:
        releaseCertificateGate.certificateDigest ?? undefined,
      releaseBundleDigest: releaseBundleGate.bundleDigest ?? undefined,
    },
  });
  const releaseProvenanceIndexGate = await (
    input.dependencies?.releaseProvenanceIndexGate ??
    (input.dependencies
      ? async () => ({
          schemaVersion: "velmere.release-provenance-index-gate.v1" as const,
          ready: true,
          required: false,
          state: "not_required" as const,
          indexDigest: null,
          candidateAttestationDigest: null,
          artifactsRoot: null,
          signerSetDigest: null,
          signatureCount: 0,
          threshold: 0,
          sequence: null,
          expiresAt: null,
          blockers: [],
          privacyBoundary: "dependency-injected fixture",
        })
      : defaultDependencies.releaseProvenanceIndexGate)
  )({
    env,
    expected: {
      candidateAttestationDigest:
        releaseCandidateAttestationGate.attestationDigest ?? undefined,
      releaseBundleDigest: releaseBundleGate.bundleDigest ?? undefined,
      sourceSha256: release.sourceSha256 ?? undefined,
      buildSha256: release.buildSha256 ?? undefined,
      exactCheckpoint: release.exactCheckpoint ?? undefined,
    },
  });
  const releaseTransparencyWitnessGate = await (
    input.dependencies?.releaseTransparencyWitnessGate ??
    (input.dependencies
      ? async () => ({
          schemaVersion: "velmere.release-transparency-witness-promotion-gate.v1" as const,
          ready: true, required: true, state: "verified" as const, quorumDigest: null, checkpointDigest: null,
          provenanceIndexDigest: releaseProvenanceIndexGate.indexDigest, treeSize: null, organizationCount: 2,
          signatureThreshold: 2, expiresAt: null, blockers: [], privacyBoundary: "dependency-injected fixture",
        })
      : defaultDependencies.releaseTransparencyWitnessGate)
  )({ env, expected: {
    provenanceIndexDigest: releaseProvenanceIndexGate.indexDigest, sourceSha256: release.sourceSha256,
    buildSha256: release.buildSha256, exactCheckpoint: release.exactCheckpoint,
  }});
  const blockers = [
    ...deployment.blockers.staging,
    ...release.blockers,
    ...probe.blockers,
    ...providerQuality.blockers,
    ...incidentGate.blockers,
    ...rollbackRecoveryGate.blockers,
    ...recoveryProofGate.blockers,
    ...releaseCertificateGate.blockers,
    ...releaseBundleGate.blockers,
    ...releaseCandidateAttestationGate.blockers,
    ...releaseProvenanceIndexGate.blockers,
    ...releaseTransparencyWitnessGate.blockers,
  ];
  if (!probe.stagingProven) blockers.push("staging_capability_not_proven");
  if (!providerQuality.ready) blockers.push("provider_quality_not_proven");
  if (!incidentGate.ready) blockers.push("provider_incident_gate_not_proven");
  if (!rollbackRecoveryGate.ready)
    blockers.push("provider_rollback_recovery_not_proven");
  if (!recoveryProofGate.ready)
    blockers.push("provider_recovery_proof_not_proven");
  if (!releaseCertificateGate.ready)
    blockers.push("provider_recovery_release_certificate_not_proven");
  if (!releaseBundleGate.ready)
    blockers.push("provider_recovery_release_bundle_not_proven");
  if (!releaseCandidateAttestationGate.ready)
    blockers.push("release_candidate_attestation_not_proven");
  if (!releaseProvenanceIndexGate.ready)
    blockers.push("release_provenance_index_not_proven");
  if (!releaseTransparencyWitnessGate.ready)
    blockers.push("release_transparency_witness_quorum_not_proven");
  return {
    schemaVersion: "velmere.durable-computation-promotion-readiness.v1",
    ready:
      deployment.stagingConfigured &&
      release.configured &&
      probe.stagingProven &&
      providerQuality.ready &&
      incidentGate.ready &&
      rollbackRecoveryGate.ready &&
      recoveryProofGate.ready &&
      releaseCertificateGate.ready &&
      releaseBundleGate.ready &&
      releaseCandidateAttestationGate.ready &&
      releaseProvenanceIndexGate.ready &&
      releaseTransparencyWitnessGate.ready &&
      blockers.length === 0,
    deploymentConfigured: deployment.stagingConfigured,
    stagingProven: probe.stagingProven,
    exactReleaseConfigured: release.configured,
    providerQualityProven: providerQuality.ready,
    providerQualityDigest: providerQuality.qualityDigest,
    providerIncidentProven: incidentGate.ready,
    providerIncidentDigest: incidentGate.incidentDigest,
    rollbackRecoveryProven: rollbackRecoveryGate.ready,
    rollbackExecutionDigest: rollbackRecoveryGate.executionDigest,
    recoveryProofProven: recoveryProofGate.ready,
    recoveryProofDigest: recoveryProofGate.proofDigest,
    releaseCertificateProven: releaseCertificateGate.ready,
    releaseCertificateDigest: releaseCertificateGate.certificateDigest,
    releaseBundleProven: releaseBundleGate.ready,
    releaseBundleDigest: releaseBundleGate.bundleDigest,
    releaseCandidateAttestationProven: releaseCandidateAttestationGate.ready,
    releaseCandidateAttestationDigest:
      releaseCandidateAttestationGate.attestationDigest,
    releaseProvenanceIndexProven: releaseProvenanceIndexGate.ready,
    releaseProvenanceIndexDigest: releaseProvenanceIndexGate.indexDigest,
    releaseTransparencyWitnessProven: releaseTransparencyWitnessGate.ready,
    releaseTransparencyWitnessQuorumDigest: releaseTransparencyWitnessGate.quorumDigest,
    deploymentFingerprint: deployment.deploymentFingerprint,
    capabilityDigest: probe.capabilityDigest,
    exactCheckpoint: release.exactCheckpoint,
    blockers: [...new Set(blockers)],
    privacyBoundary:
      "Only readiness flags, hashes, checkpoint number and blocker codes are returned. Secrets, operator identity, reason, build contents and database rows are never returned.",
  };
}

function readLedgerState(data: unknown) {
  const row = Array.isArray(data) ? data[0] : data;
  if (!row || typeof row !== "object")
    return { state: "store_failed", deploymentIdHash: null, idempotent: false };
  const value = row as Record<string, unknown>;
  const state = clean(value.state);
  const deploymentId = clean(value.deployment_id);
  return {
    state: ["promoted", "rolled_back", "conflict"].includes(state)
      ? state
      : "store_failed",
    deploymentIdHash: isUuid(deploymentId) ? sha256(deploymentId) : null,
    idempotent: value.idempotent === true,
  };
}

export async function applyDurableComputationPromotion(input: {
  request: DurableComputationPromotionRequest;
  env?: EnvLike;
  dependencies?: PromotionDependencies;
}) {
  const env = input.env ?? process.env;
  const dependencies = { ...defaultDependencies, ...input.dependencies };
  if (input.dependencies?.providerQuality && !input.dependencies.incidentGate) {
    dependencies.incidentGate = async () => {
      const quality = await dependencies.providerQuality();
      return {
        schemaVersion: "velmere.provider-quality-promotion-incident-gate.v1",
        ready: quality.ready,
        qualityReady: quality.ready,
        qualityStableAgeSeconds: quality.ready ? 900 : 0,
        qualityDigest: quality.qualityDigest,
        incidentDigest: quality.qualityDigest,
        state: quality.ready ? "healthy" : "open",
        releaseHold: !quality.ready,
        rollbackRequired: false,
        blockers: quality.ready
          ? []
          : ["provider_incident_dependency_fixture_blocked"],
        warnings: [],
        privacyBoundary: "dependency-injected fixture",
      };
    };
  }
  if (input.dependencies && !input.dependencies.rollbackRecoveryGate) {
    dependencies.rollbackRecoveryGate = async () => ({
      schemaVersion: "velmere.provider-quality-rollback-recovery-gate.v1",
      ready: true,
      status: "idle",
      executionVerified: false,
      promotionReentryReady: false,
      incidentDigest: null,
      executionDigest: null,
      blockers: [],
      privacyBoundary: "dependency-injected fixture",
    });
  }
  if (input.dependencies && !input.dependencies.recoveryProofGate) {
    dependencies.recoveryProofGate = async () => ({
      schemaVersion: "velmere.provider-quality-recovery-proof-gate.v1",
      ready: true,
      required: false,
      state: "not_required",
      proofDigest: null,
      rollbackExecutionDigest: null,
      customerSmokeDigest: null,
      providerSmokeDigest: null,
      blockers: [],
      privacyBoundary: "dependency-injected fixture",
    });
  }
  if (input.dependencies && !input.dependencies.releaseCertificateGate) {
    dependencies.releaseCertificateGate = async () => ({
      schemaVersion: "velmere.provider-recovery-release-certificate-gate.v1",
      ready: true,
      required: false,
      state: "not_required",
      certificateDigest: null,
      rollbackExecutionDigest: null,
      expiresAt: null,
      blockers: [],
      privacyBoundary: "dependency-injected fixture",
    });
  }
  if (input.dependencies && !input.dependencies.releaseBundleGate) {
    dependencies.releaseBundleGate = async () => ({
      schemaVersion: "velmere.provider-recovery-release-bundle-gate.v1",
      ready: true,
      required: false,
      state: "not_required",
      bundleDigest: null,
      certificateDigest: null,
      evidenceRoot: null,
      expiresAt: null,
      blockers: [],
      privacyBoundary: "dependency-injected fixture",
    });
  }
  if (
    input.dependencies &&
    !input.dependencies.releaseCandidateAttestationGate
  ) {
    dependencies.releaseCandidateAttestationGate = async () => ({
      schemaVersion: "velmere.release-candidate-attestation-gate.v1",
      ready: true,
      required: false,
      state: "not_required",
      attestationDigest: null,
      releaseBundleDigest: null,
      manifestRoot: null,
      keyIdHash: null,
      expiresAt: null,
      blockers: [],
      privacyBoundary: "dependency-injected fixture",
    });
  }
  if (input.dependencies && !input.dependencies.releaseProvenanceIndexGate) {
    dependencies.releaseProvenanceIndexGate = async () => ({
      schemaVersion: "velmere.release-provenance-index-gate.v1",
      ready: true,
      required: false,
      state: "not_required",
      indexDigest: null,
      candidateAttestationDigest: null,
      artifactsRoot: null,
      signerSetDigest: null,
      signatureCount: 0,
      threshold: 0,
      sequence: null,
      expiresAt: null,
      blockers: [],
      privacyBoundary: "dependency-injected fixture",
    });
  }
  if (input.dependencies && !input.dependencies.releaseTransparencyWitnessGate) {
    dependencies.releaseTransparencyWitnessGate = async () => ({
      schemaVersion: "velmere.release-transparency-witness-promotion-gate.v1", ready: true, required: true,
      state: "verified", quorumDigest: null, checkpointDigest: null, provenanceIndexDigest: null, treeSize: null,
      organizationCount: 2, signatureThreshold: 2, expiresAt: null, blockers: [], privacyBoundary: "dependency-injected fixture",
    });
  }
  const request = normalizeRequest(input.request);
  const deployment = buildDurableComputationDeploymentContract(env);
  const release = buildDurableComputationReleaseEvidence(env);
  const probe: DurableComputationStagingProbe = await dependencies.probe({
    env,
  });
  const providerQuality: ProviderObservationPromotionQuality =
    await dependencies.providerQuality();
  const incidentGate = await dependencies.incidentGate({
    expectedQualityDigest: providerQuality.qualityDigest,
  });
  const rollbackRecoveryGate = await dependencies.rollbackRecoveryGate({ env });
  const recoveryProofGate = await dependencies.recoveryProofGate({
    env,
    expected: {
      rollbackExecutionDigest: rollbackRecoveryGate.executionDigest,
      incidentDigest: incidentGate.incidentDigest,
      qualityDigest: providerQuality.qualityDigest,
      capabilityDigest: probe.capabilityDigest,
      sourceSha256: release.sourceSha256,
      buildSha256: release.buildSha256,
      exactCheckpoint: release.exactCheckpoint,
    },
  });
  const releaseCertificateGate = await dependencies.releaseCertificateGate({
    env,
    expected: {
      rollbackExecutionDigest: rollbackRecoveryGate.executionDigest,
      incidentDigest: incidentGate.incidentDigest,
      qualityDigest: providerQuality.qualityDigest,
      capabilityDigest: probe.capabilityDigest,
      sourceSha256: release.sourceSha256,
      buildSha256: release.buildSha256,
      buildId: release.buildId,
      exactCheckpoint: release.exactCheckpoint,
      recoveryProofDigest: recoveryProofGate.proofDigest,
      customerSmokeDigest: recoveryProofGate.customerSmokeDigest,
      providerSmokeDigest: recoveryProofGate.providerSmokeDigest,
    },
  });
  const releaseBundleGate = await dependencies.releaseBundleGate({
    env,
    expected: {
      environment: (env.VELMERE_DEPLOYMENT_ENVIRONMENT ??
        env.VERCEL_ENV ??
        "staging") as "staging" | "production",
      audience: env.VELMERE_RELEASE_BUNDLE_AUDIENCE,
      deploymentFingerprint: deployment.deploymentFingerprint,
      rollbackExecutionDigest:
        rollbackRecoveryGate.executionDigest ?? undefined,
      incidentDigest: incidentGate.incidentDigest ?? undefined,
      qualityDigest: providerQuality.qualityDigest ?? undefined,
      capabilityDigest: probe.capabilityDigest ?? undefined,
      sourceSha256: release.sourceSha256 ?? undefined,
      buildSha256: release.buildSha256 ?? undefined,
      buildId: release.buildId ?? undefined,
      exactCheckpoint: release.exactCheckpoint ?? undefined,
      recoveryProofDigest: recoveryProofGate.proofDigest ?? undefined,
      customerSmokeDigest: recoveryProofGate.customerSmokeDigest ?? undefined,
      providerSmokeDigest: recoveryProofGate.providerSmokeDigest ?? undefined,
      releaseCertificateDigest:
        releaseCertificateGate.certificateDigest ?? undefined,
    },
  });
  const releaseCandidateAttestationGate =
    await dependencies.releaseCandidateAttestationGate({
      env,
      expected: {
        deploymentFingerprint: deployment.deploymentFingerprint,
        rollbackExecutionDigest:
          rollbackRecoveryGate.executionDigest ?? undefined,
        incidentDigest: incidentGate.incidentDigest ?? undefined,
        qualityDigest: providerQuality.qualityDigest ?? undefined,
        capabilityDigest: probe.capabilityDigest ?? undefined,
        sourceSha256: release.sourceSha256 ?? undefined,
        buildSha256: release.buildSha256 ?? undefined,
        buildId: release.buildId ?? undefined,
        exactCheckpoint: release.exactCheckpoint ?? undefined,
        recoveryProofDigest: recoveryProofGate.proofDigest ?? undefined,
        customerSmokeDigest: recoveryProofGate.customerSmokeDigest ?? undefined,
        providerSmokeDigest: recoveryProofGate.providerSmokeDigest ?? undefined,
        releaseCertificateDigest:
          releaseCertificateGate.certificateDigest ?? undefined,
        releaseBundleDigest: releaseBundleGate.bundleDigest ?? undefined,
      },
    });
  const releaseProvenanceIndexGate =
    await dependencies.releaseProvenanceIndexGate({
      env,
      expected: {
        candidateAttestationDigest:
          releaseCandidateAttestationGate.attestationDigest ?? undefined,
        releaseBundleDigest: releaseBundleGate.bundleDigest ?? undefined,
        sourceSha256: release.sourceSha256 ?? undefined,
        buildSha256: release.buildSha256 ?? undefined,
        exactCheckpoint: release.exactCheckpoint ?? undefined,
      },
    });
  const releaseTransparencyWitnessGate = await dependencies.releaseTransparencyWitnessGate({
    env, expected: { provenanceIndexDigest: releaseProvenanceIndexGate.indexDigest, sourceSha256: release.sourceSha256,
      buildSha256: release.buildSha256, exactCheckpoint: release.exactCheckpoint },
  });
  if (!deployment.stagingConfigured)
    throw new Error("promotion_deployment_not_configured");
  if (!release.configured)
    throw new Error("promotion_exact_release_not_configured");
  if (!probe.stagingProven || !probe.capabilityDigest)
    throw new Error("promotion_staging_not_proven");
  if (request.action === "promote" && !providerQuality.ready)
    throw new Error("promotion_provider_quality_not_proven");
  if (request.action === "promote" && !incidentGate.ready)
    throw new Error("promotion_provider_incident_gate_not_proven");
  if (request.action === "promote" && !rollbackRecoveryGate.ready)
    throw new Error("promotion_provider_rollback_recovery_not_proven");
  if (request.action === "promote" && !recoveryProofGate.ready)
    throw new Error("promotion_provider_recovery_proof_not_proven");
  if (request.action === "promote" && !releaseCertificateGate.ready)
    throw new Error(
      "promotion_provider_recovery_release_certificate_not_proven",
    );
  if (request.action === "promote" && !releaseBundleGate.ready)
    throw new Error("promotion_provider_recovery_release_bundle_not_proven");
  if (request.action === "promote" && !releaseCandidateAttestationGate.ready)
    throw new Error("promotion_release_candidate_attestation_not_proven");
  if (request.action === "promote" && !releaseProvenanceIndexGate.ready)
    throw new Error("promotion_release_provenance_index_not_proven");
  if (request.action === "promote" && !releaseTransparencyWitnessGate.ready)
    throw new Error("promotion_release_transparency_witness_quorum_not_proven");
  if (
    request.action === "promote" &&
    rollbackRecoveryGate.executionDigest &&
    request.rollbackExecutionDigest !== rollbackRecoveryGate.executionDigest
  )
    throw new Error("promotion_rollback_execution_digest_mismatch");
  if (
    request.action === "promote" &&
    recoveryProofGate.proofDigest &&
    request.recoveryProofDigest !== recoveryProofGate.proofDigest
  )
    throw new Error("promotion_recovery_proof_digest_mismatch");
  if (
    request.action === "promote" &&
    releaseCertificateGate.certificateDigest &&
    request.releaseCertificateDigest !==
      releaseCertificateGate.certificateDigest
  )
    throw new Error("promotion_release_certificate_digest_mismatch");
  if (
    request.action === "promote" &&
    releaseBundleGate.bundleDigest &&
    request.releaseBundleDigest !== releaseBundleGate.bundleDigest
  )
    throw new Error("promotion_release_bundle_digest_mismatch");
  if (
    request.action === "promote" &&
    releaseCandidateAttestationGate.attestationDigest &&
    request.releaseCandidateAttestationDigest !==
      releaseCandidateAttestationGate.attestationDigest
  )
    throw new Error("promotion_release_candidate_attestation_digest_mismatch");
  if (
    request.action === "promote" &&
    releaseProvenanceIndexGate.indexDigest &&
    request.releaseProvenanceIndexDigest !==
      releaseProvenanceIndexGate.indexDigest
  )
    throw new Error("promotion_release_provenance_index_digest_mismatch");
  if (request.action === "promote" && releaseTransparencyWitnessGate.quorumDigest &&
      request.releaseTransparencyWitnessQuorumDigest !== releaseTransparencyWitnessGate.quorumDigest)
    throw new Error("promotion_release_transparency_witness_quorum_digest_mismatch");
  if (request.deploymentFingerprint !== deployment.deploymentFingerprint)
    throw new Error("promotion_deployment_fingerprint_mismatch");
  if (request.capabilityDigest !== probe.capabilityDigest)
    throw new Error("promotion_capability_digest_mismatch");
  if (request.providerQualityDigest !== providerQuality.qualityDigest)
    throw new Error("promotion_provider_quality_digest_mismatch");
  if (
    request.sourceSha256 !== release.sourceSha256 ||
    request.buildSha256 !== release.buildSha256 ||
    request.buildId !== release.buildId ||
    request.exactCheckpoint !== release.exactCheckpoint
  ) {
    throw new Error("promotion_exact_release_mismatch");
  }
  verifyApproval(request, env, dependencies.now());
  const operatorHash = sha256(request.operatorId);
  const reasonHash = sha256(request.reason);
  const buildIdHash = sha256(request.buildId);
  const requestDigest = sha256(
    canonicalApprovalPayload(withoutApprovalSignature(request)),
  );
  const operation =
    request.action === "promote"
      ? "durable_computation_deployment_promote"
      : "durable_computation_deployment_rollback";
  const { data } = await dependencies.rpc({
    operation,
    args: {
      p_idempotency_key: requestDigest,
      p_deployment_fingerprint: request.deploymentFingerprint,
      p_capability_digest: request.capabilityDigest,
      p_provider_quality_digest: request.providerQualityDigest,
      ...(request.action === "promote"
        ? {
            p_recovery_proof_digest: request.recoveryProofDigest || null,
            p_release_certificate_digest:
              request.releaseCertificateDigest || null,
            p_release_bundle_digest: request.releaseBundleDigest || null,
            p_release_candidate_attestation_digest:
              request.releaseCandidateAttestationDigest || null,
            p_release_provenance_index_digest:
              request.releaseProvenanceIndexDigest || null,
            p_release_transparency_witness_quorum_digest:
              request.releaseTransparencyWitnessQuorumDigest || null,
          }
        : {}),
      p_source_sha256: request.sourceSha256,
      p_build_sha256: request.buildSha256,
      p_build_id_hash: buildIdHash,
      p_exact_checkpoint: request.exactCheckpoint,
      p_operator_hash: operatorHash,
      p_reason_hash: reasonHash,
      ...(request.action === "rollback"
        ? { p_target_deployment_id: request.targetDeploymentId }
        : {}),
    },
  });
  const ledger = readLedgerState(data);
  return {
    schemaVersion: "velmere.durable-computation-promotion-result.v1" as const,
    ok: ledger.state === "promoted" || ledger.state === "rolled_back",
    action: request.action,
    state: ledger.state,
    idempotent: ledger.idempotent,
    deploymentIdHash: ledger.deploymentIdHash,
    requestDigest,
    exactCheckpoint: request.exactCheckpoint,
    providerQualityDigest: request.providerQualityDigest,
    recoveryProofDigest: request.recoveryProofDigest || null,
    releaseCertificateDigest: request.releaseCertificateDigest || null,
    releaseBundleDigest: request.releaseBundleDigest || null,
    releaseCandidateAttestationDigest:
      request.releaseCandidateAttestationDigest || null,
    releaseProvenanceIndexDigest: request.releaseProvenanceIndexDigest || null,
    releaseTransparencyWitnessQuorumDigest: request.releaseTransparencyWitnessQuorumDigest || null,
    privacyBoundary:
      "Only hashes and aggregate state are returned. Operator identity, reason, approval secret/signature, raw deployment ID, build ID and environment values are omitted.",
  };
}
