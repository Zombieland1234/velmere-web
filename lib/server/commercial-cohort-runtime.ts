import {
  evaluateCommercialCohortGate,
  type CommercialCohortAttestation,
  type CommercialCohortGate,
  type CommercialCohortProduct,
  type CommercialCohortTier,
  type CommercialCohortPublicCheckpointGateInput,
} from "@/lib/worldclass/commercial-cohort-policy";
import type { CommercialCohortAntiCherryPickReceipt } from "@/lib/worldclass/commercial-cohort-anti-cherry-pick";
import {
  verifyCommercialCohortPublicCheckpointChain,
  type CommercialCohortPublicCheckpoint,
  type CommercialCohortRootPublicKey,
  type CommercialCohortTrustBundle,
} from "@/lib/worldclass/commercial-cohort-public-checkpoint";
import {
  verifyCommercialCohortDeploymentReceiptChain,
  type CommercialCohortDeploymentReceipt,
} from "@/lib/worldclass/commercial-cohort-deployment-receipt";
import {
  verifyCommercialCohortStagingE2EReceiptChain,
  type CommercialCohortStagingE2EReceipt,
} from "@/lib/worldclass/commercial-cohort-staging-e2e";
import {
  verifyCommercialCohortChaosReceiptChain,
  type CommercialCohortChaosReceipt,
} from "@/lib/worldclass/commercial-cohort-chaos-recovery";
import {
  verifyCommercialCohortObservabilityReceiptChain,
  type CommercialCohortObservabilityReceipt,
} from "@/lib/worldclass/commercial-cohort-observability-incident";
import {
  verifyCommercialCohortPrivacyReceiptChain,
  type CommercialCohortPrivacyReceipt,
} from "@/lib/worldclass/commercial-cohort-privacy-abuse-audit";
import {
  verifyCommercialCohortReproducibleBuildProvenance,
  type CommercialCohortBuildRecipe,
  type CommercialCohortBuildRunReceipt,
  type CommercialCohortLockfileSbom,
  type CommercialCohortReproducibleBuildProvenance,
  type CommercialCohortSourceManifest,
  type CommercialCohortVulnerabilitySnapshot,
} from "@/lib/worldclass/commercial-cohort-supply-chain-provenance";

function parseJsonObject<T>(raw: string | undefined): T | null {
  const value = raw?.trim();
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as T;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function parseJsonArray<T>(raw: string | undefined): T[] | null {
  const value = raw?.trim();
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as T[];
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function parsePositiveInteger(raw: string | undefined): number | null {
  const value = Number(raw?.trim());
  return Number.isInteger(value) && value > 0 ? value : null;
}

function parseAttestation(raw: string | undefined): CommercialCohortAttestation | null {
  return parseJsonObject<CommercialCohortAttestation>(raw);
}

function resolvePublicCheckpointFromEnv(args: {
  attestation: CommercialCohortAttestation | null;
  antiCherryPickReceipt: CommercialCohortAntiCherryPickReceipt | null;
  now?: Date;
}): CommercialCohortPublicCheckpointGateInput | null {
  if (!args.attestation || !args.antiCherryPickReceipt) return null;
  const checkpoints = parseJsonArray<CommercialCohortPublicCheckpoint>(process.env.VELMERE_COMMERCIAL_COHORT_PUBLIC_CHECKPOINT_CHAIN_JSON);
  const trustBundles = parseJsonArray<CommercialCohortTrustBundle>(process.env.VELMERE_COMMERCIAL_COHORT_TRUST_CHAIN_JSON);
  const rootPublicKeys = parseJsonArray<CommercialCohortRootPublicKey>(process.env.VELMERE_COMMERCIAL_COHORT_ROOT_PUBLIC_KEYS_JSON);
  const rootSignatureThreshold = parsePositiveInteger(process.env.VELMERE_COMMERCIAL_COHORT_ROOT_SIGNATURE_THRESHOLD);
  const minimumSequence = parsePositiveInteger(process.env.VELMERE_COMMERCIAL_COHORT_MIN_CHECKPOINT_SEQUENCE);
  const expectedEnvironment = process.env.VELMERE_COMMERCIAL_COHORT_EXPECTED_ENVIRONMENT?.trim();
  const expectedAudience = process.env.VELMERE_COMMERCIAL_COHORT_EXPECTED_AUDIENCE?.trim();
  if (!checkpoints || !trustBundles || !rootPublicKeys || !rootSignatureThreshold || !minimumSequence || !(expectedEnvironment === "staging" || expectedEnvironment === "production") || !expectedAudience) {
    return {
      verified: false,
      publicCheckpointVerified: false,
      rollbackProtected: false,
      externallyWitnessed: false,
      keyRotationVerified: false,
      deploymentReceiptVerified: false,
      artifactBound: false,
      stagingE2eVerified: false,
      stagingE2eBound: false,
      stagingRollbackProtected: false,
      stagingSequence: null,
      stagingReceiptDigest: null,
      stagingProbeCount: 0,
      chaosRecoveryVerified: false,
      recoveryBound: false,
      recoveryRollbackProtected: false,
      rtoRpoVerified: false,
      idempotencyVerified: false,
      chaosSequence: null,
      chaosReceiptDigest: null,
      chaosScenarioCount: 0,
      observabilityVerified: false,
      telemetryBound: false,
      sloVerified: false,
      incidentResponseVerified: false,
      safeDegradationVerified: false,
      observabilityRollbackProtected: false,
      observabilitySequence: null,
      observabilityReceiptDigest: null,
      observabilityObjectiveCount: 0,
      privacyVerified: false,
      tenantIsolationVerified: false,
      dataLifecycleVerified: false,
      abuseResistanceVerified: false,
      auditTrailVerified: false,
      privacyRollbackProtected: false,
      privacySequence: null,
      privacyReceiptDigest: null,
      privacyControlCount: 0,
      supplyChainVerified: false,
      reproducibleBuild: false,
      vulnerabilityGatePassed: false,
      supplyChainBound: false,
      supplyChainProvenanceDigest: null,
      deploymentRollbackProtected: false,
      deploymentSequence: null,
      deploymentReceiptDigest: null,
      checkpointSequence: checkpoints?.at(-1)?.sequence ?? null,
      checkpointDigest: checkpoints?.at(-1)?.checkpointDigest ?? null,
      trustEpoch: trustBundles?.at(-1)?.epoch ?? null,
      externalWitnessCount: checkpoints?.at(-1)?.externalWitnesses?.length ?? 0,
      blockers: ["commercial_cohort_public_checkpoint_configuration_incomplete"],
    };
  }
  const publicVerification = verifyCommercialCohortPublicCheckpointChain({
    checkpoints,
    trustBundles,
    rootPublicKeys,
    rootSignatureThreshold,
    attestation: args.attestation,
    antiCherryPickReceipt: args.antiCherryPickReceipt,
    expectedEnvironment,
    expectedAudience,
    minimumSequence,
    now: args.now,
  });
  const supplyChainProvenance = parseJsonObject<CommercialCohortReproducibleBuildProvenance>(process.env.VELMERE_COMMERCIAL_COHORT_SUPPLY_CHAIN_PROVENANCE_JSON);
  const sourceManifest = parseJsonObject<CommercialCohortSourceManifest>(process.env.VELMERE_COMMERCIAL_COHORT_SOURCE_MANIFEST_JSON);
  const sbom = parseJsonObject<CommercialCohortLockfileSbom>(process.env.VELMERE_COMMERCIAL_COHORT_SBOM_JSON);
  const vulnerabilitySnapshot = parseJsonObject<CommercialCohortVulnerabilitySnapshot>(process.env.VELMERE_COMMERCIAL_COHORT_VULNERABILITY_SNAPSHOT_JSON);
  const buildRecipe = parseJsonObject<CommercialCohortBuildRecipe>(process.env.VELMERE_COMMERCIAL_COHORT_BUILD_RECIPE_JSON);
  const buildRuns = parseJsonArray<CommercialCohortBuildRunReceipt>(process.env.VELMERE_COMMERCIAL_COHORT_BUILD_RUN_RECEIPTS_JSON);
  if (!supplyChainProvenance || !sourceManifest || !sbom || !vulnerabilitySnapshot || !buildRecipe || !buildRuns) {
    return {
      ...publicVerification,
      verified: false,
      deploymentReceiptVerified: false,
      artifactBound: false,
      stagingE2eVerified: false,
      stagingE2eBound: false,
      stagingRollbackProtected: false,
      stagingSequence: null,
      stagingReceiptDigest: null,
      stagingProbeCount: 0,
      chaosRecoveryVerified: false,
      recoveryBound: false,
      recoveryRollbackProtected: false,
      rtoRpoVerified: false,
      idempotencyVerified: false,
      chaosSequence: null,
      chaosReceiptDigest: null,
      chaosScenarioCount: 0,
      observabilityVerified: false,
      telemetryBound: false,
      sloVerified: false,
      incidentResponseVerified: false,
      safeDegradationVerified: false,
      observabilityRollbackProtected: false,
      observabilitySequence: null,
      observabilityReceiptDigest: null,
      observabilityObjectiveCount: 0,
      privacyVerified: false,
      tenantIsolationVerified: false,
      dataLifecycleVerified: false,
      abuseResistanceVerified: false,
      auditTrailVerified: false,
      privacyRollbackProtected: false,
      privacySequence: null,
      privacyReceiptDigest: null,
      privacyControlCount: 0,
      supplyChainVerified: false,
      reproducibleBuild: false,
      vulnerabilityGatePassed: false,
      supplyChainBound: false,
      supplyChainProvenanceDigest: supplyChainProvenance?.provenanceDigest ?? null,
      deploymentRollbackProtected: false,
      deploymentSequence: null,
      deploymentReceiptDigest: null,
      blockers: Array.from(new Set([...publicVerification.blockers, "commercial_cohort_supply_chain_configuration_incomplete"])).sort(),
    };
  }
  const supplyChainVerification = verifyCommercialCohortReproducibleBuildProvenance({
    provenance: supplyChainProvenance,
    sourceManifest,
    sbom,
    vulnerabilitySnapshot,
    buildRecipe,
    buildRuns,
    expectedEnvironment,
    expectedAudience,
    now: args.now,
  });
  const deploymentReceipts = parseJsonArray<CommercialCohortDeploymentReceipt>(process.env.VELMERE_COMMERCIAL_COHORT_DEPLOYMENT_RECEIPT_CHAIN_JSON);
  const minimumDeploymentSequence = parsePositiveInteger(process.env.VELMERE_COMMERCIAL_COHORT_MIN_DEPLOYMENT_SEQUENCE);
  const expectedBuildArtifactDigest = process.env.VELMERE_COMMERCIAL_COHORT_BUILD_ARTIFACT_DIGEST?.trim();
  const expectedSourcePackageDigest = process.env.VELMERE_COMMERCIAL_COHORT_SOURCE_PACKAGE_DIGEST?.trim();
  const expectedModelConfigRoot = process.env.VELMERE_COMMERCIAL_COHORT_MODEL_CONFIG_ROOT?.trim();
  const expectedDeploymentId = process.env.VELMERE_COMMERCIAL_COHORT_EXPECTED_DEPLOYMENT_ID?.trim() || null;
  const currentCheckpoint = checkpoints.at(-1) ?? null;
  const currentTrustBundle = trustBundles.at(-1) ?? null;
  if (!deploymentReceipts || !minimumDeploymentSequence || !expectedBuildArtifactDigest || !expectedSourcePackageDigest || !expectedModelConfigRoot || !currentCheckpoint || !currentTrustBundle) {
    return {
      ...publicVerification,
      verified: false,
      deploymentReceiptVerified: false,
      artifactBound: false,
      stagingE2eVerified: false,
      stagingE2eBound: false,
      stagingRollbackProtected: false,
      stagingSequence: null,
      stagingReceiptDigest: null,
      stagingProbeCount: 0,
      chaosRecoveryVerified: false,
      recoveryBound: false,
      recoveryRollbackProtected: false,
      rtoRpoVerified: false,
      idempotencyVerified: false,
      chaosSequence: null,
      chaosReceiptDigest: null,
      chaosScenarioCount: 0,
      observabilityVerified: false,
      telemetryBound: false,
      sloVerified: false,
      incidentResponseVerified: false,
      safeDegradationVerified: false,
      observabilityRollbackProtected: false,
      observabilitySequence: null,
      observabilityReceiptDigest: null,
      observabilityObjectiveCount: 0,
      privacyVerified: false,
      tenantIsolationVerified: false,
      dataLifecycleVerified: false,
      abuseResistanceVerified: false,
      auditTrailVerified: false,
      privacyRollbackProtected: false,
      privacySequence: null,
      privacyReceiptDigest: null,
      privacyControlCount: 0,
      supplyChainVerified: supplyChainVerification.verified,
      reproducibleBuild: supplyChainVerification.reproducible,
      vulnerabilityGatePassed: supplyChainVerification.vulnerabilityGatePassed,
      supplyChainBound: false,
      supplyChainProvenanceDigest: supplyChainVerification.provenanceDigest,
      deploymentRollbackProtected: false,
      deploymentSequence: deploymentReceipts?.at(-1)?.deploymentSequence ?? null,
      deploymentReceiptDigest: deploymentReceipts?.at(-1)?.deploymentReceiptDigest ?? null,
      blockers: Array.from(new Set([...publicVerification.blockers, ...supplyChainVerification.blockers, "commercial_cohort_deployment_receipt_configuration_incomplete"])).sort(),
    };
  }
  const supplyChainRuntimeBlockers: string[] = [];
  if (supplyChainProvenance.buildArtifactDigest !== expectedBuildArtifactDigest) supplyChainRuntimeBlockers.push("commercial_cohort_supply_chain_build_artifact_mismatch");
  if (supplyChainProvenance.sourcePackageDigest !== expectedSourcePackageDigest) supplyChainRuntimeBlockers.push("commercial_cohort_supply_chain_source_package_mismatch");
  const deploymentVerification = verifyCommercialCohortDeploymentReceiptChain({
    receipts: deploymentReceipts,
    checkpoints,
    trustBundles,
    expectedEnvironment,
    expectedAudience,
    minimumDeploymentSequence,
    expectedDeploymentId,
    expectedBuildArtifactDigest,
    expectedSourcePackageDigest,
    expectedModelConfigRoot,
    expectedSupplyChainProvenanceDigest: supplyChainProvenance.provenanceDigest,
    expectedSbomDigest: supplyChainProvenance.sbomDigest,
    expectedVulnerabilitySnapshotDigest: supplyChainProvenance.vulnerabilitySnapshotDigest,
    expectedBuildRecipeDigest: supplyChainProvenance.buildRecipeDigest,
    now: args.now,
  });
  const stagingReceipts = parseJsonArray<CommercialCohortStagingE2EReceipt>(process.env.VELMERE_COMMERCIAL_COHORT_STAGING_E2E_RECEIPT_CHAIN_JSON);
  const minimumStagingSequence = parsePositiveInteger(process.env.VELMERE_COMMERCIAL_COHORT_MIN_STAGING_E2E_SEQUENCE);
  const currentDeploymentReceipt = deploymentReceipts.at(-1) ?? null;
  const stagingConfigurationBlockers: string[] = [];
  if (!stagingReceipts) stagingConfigurationBlockers.push("commercial_cohort_staging_e2e_receipt_chain_missing");
  if (!minimumStagingSequence) stagingConfigurationBlockers.push("commercial_cohort_staging_e2e_minimum_sequence_missing");
  if (!currentDeploymentReceipt) stagingConfigurationBlockers.push("commercial_cohort_staging_e2e_current_deployment_missing");
  const stagingVerification = stagingReceipts && minimumStagingSequence && currentDeploymentReceipt
    ? verifyCommercialCohortStagingE2EReceiptChain({
        receipts: stagingReceipts,
        trustBundles,
        expectedAudience,
        expectedPromotionTarget: expectedEnvironment,
        currentDeploymentReceipt,
        minimumStagingSequence,
        now: args.now,
      })
    : {
        verified: false,
        stagingE2eVerified: false,
        stagingE2eBound: false,
        stagingRollbackProtected: false,
        stagingSequence: stagingReceipts?.at(-1)?.stagingSequence ?? null,
        stagingReceiptDigest: stagingReceipts?.at(-1)?.stagingReceiptDigest ?? null,
        probeCount: stagingReceipts?.at(-1)?.probeCount ?? 0,
        blockers: stagingConfigurationBlockers.length
          ? stagingConfigurationBlockers
          : ["commercial_cohort_staging_e2e_configuration_incomplete"],
      };
  const chaosReceipts = parseJsonArray<CommercialCohortChaosReceipt>(process.env.VELMERE_COMMERCIAL_COHORT_CHAOS_RECOVERY_RECEIPT_CHAIN_JSON);
  const minimumChaosSequence = parsePositiveInteger(process.env.VELMERE_COMMERCIAL_COHORT_MIN_CHAOS_RECOVERY_SEQUENCE);
  const currentStagingReceipt = stagingReceipts?.at(-1) ?? null;
  const chaosConfigurationBlockers: string[] = [];
  if (!chaosReceipts) chaosConfigurationBlockers.push("commercial_cohort_chaos_recovery_receipt_chain_missing");
  if (!minimumChaosSequence) chaosConfigurationBlockers.push("commercial_cohort_chaos_recovery_minimum_sequence_missing");
  if (!currentDeploymentReceipt) chaosConfigurationBlockers.push("commercial_cohort_chaos_recovery_current_deployment_missing");
  if (!currentStagingReceipt) chaosConfigurationBlockers.push("commercial_cohort_chaos_recovery_current_staging_receipt_missing");
  if (!stagingVerification.verified) chaosConfigurationBlockers.push("commercial_cohort_chaos_recovery_requires_verified_staging_e2e");
  const chaosVerification = chaosReceipts && minimumChaosSequence && currentDeploymentReceipt && currentStagingReceipt && stagingVerification.verified
    ? verifyCommercialCohortChaosReceiptChain({
        receipts: chaosReceipts,
        trustBundles,
        expectedAudience,
        expectedPromotionTarget: expectedEnvironment,
        currentDeploymentReceipt,
        currentStagingReceipt,
        minimumChaosSequence,
        now: args.now,
      })
    : {
        verified: false,
        chaosRecoveryVerified: false,
        recoveryBound: false,
        recoveryRollbackProtected: false,
        rtoRpoVerified: false,
        idempotencyVerified: false,
        chaosSequence: chaosReceipts?.at(-1)?.chaosSequence ?? null,
        chaosReceiptDigest: chaosReceipts?.at(-1)?.chaosReceiptDigest ?? null,
        scenarioCount: chaosReceipts?.at(-1)?.scenarioCount ?? 0,
        blockers: chaosConfigurationBlockers.length
          ? chaosConfigurationBlockers
          : ["commercial_cohort_chaos_recovery_configuration_incomplete"],
      };
  const observabilityReceipts = parseJsonArray<CommercialCohortObservabilityReceipt>(process.env.VELMERE_COMMERCIAL_COHORT_OBSERVABILITY_RECEIPT_CHAIN_JSON);
  const minimumObservabilitySequence = parsePositiveInteger(process.env.VELMERE_COMMERCIAL_COHORT_MIN_OBSERVABILITY_SEQUENCE);
  const currentChaosReceipt = chaosReceipts?.at(-1) ?? null;
  const observabilityConfigurationBlockers: string[] = [];
  if (!observabilityReceipts) observabilityConfigurationBlockers.push("commercial_cohort_observability_receipt_chain_missing");
  if (!minimumObservabilitySequence) observabilityConfigurationBlockers.push("commercial_cohort_observability_minimum_sequence_missing");
  if (!currentDeploymentReceipt) observabilityConfigurationBlockers.push("commercial_cohort_observability_current_deployment_missing");
  if (!currentStagingReceipt) observabilityConfigurationBlockers.push("commercial_cohort_observability_current_staging_receipt_missing");
  if (!currentChaosReceipt) observabilityConfigurationBlockers.push("commercial_cohort_observability_current_chaos_receipt_missing");
  if (!chaosVerification.verified) observabilityConfigurationBlockers.push("commercial_cohort_observability_requires_verified_chaos_recovery");
  const observabilityVerification = observabilityReceipts && minimumObservabilitySequence && currentDeploymentReceipt && currentStagingReceipt && currentChaosReceipt && chaosVerification.verified
    ? verifyCommercialCohortObservabilityReceiptChain({
        receipts: observabilityReceipts,
        trustBundles,
        expectedAudience,
        expectedPromotionTarget: expectedEnvironment,
        currentDeploymentReceipt,
        currentStagingReceipt,
        currentChaosReceipt,
        minimumObservabilitySequence,
        now: args.now,
      })
    : {
        verified: false,
        observabilityVerified: false,
        telemetryBound: false,
        sloVerified: false,
        incidentResponseVerified: false,
        safeDegradationVerified: false,
        observabilityRollbackProtected: false,
        observabilitySequence: observabilityReceipts?.at(-1)?.observabilitySequence ?? null,
        observabilityReceiptDigest: observabilityReceipts?.at(-1)?.observabilityReceiptDigest ?? null,
        objectiveCount: observabilityReceipts?.at(-1)?.objectiveCount ?? 0,
        blockers: observabilityConfigurationBlockers.length
          ? observabilityConfigurationBlockers
          : ["commercial_cohort_observability_configuration_incomplete"],
      };
  const privacyReceipts = parseJsonArray<CommercialCohortPrivacyReceipt>(process.env.VELMERE_COMMERCIAL_COHORT_PRIVACY_RECEIPT_CHAIN_JSON);
  const minimumPrivacySequence = parsePositiveInteger(process.env.VELMERE_COMMERCIAL_COHORT_MIN_PRIVACY_SEQUENCE);
  const currentObservabilityReceipt = observabilityReceipts?.at(-1) ?? null;
  const privacyConfigurationBlockers: string[] = [];
  if (!privacyReceipts) privacyConfigurationBlockers.push("commercial_cohort_privacy_receipt_chain_missing");
  if (!minimumPrivacySequence) privacyConfigurationBlockers.push("commercial_cohort_privacy_minimum_sequence_missing");
  if (!currentDeploymentReceipt) privacyConfigurationBlockers.push("commercial_cohort_privacy_current_deployment_missing");
  if (!currentStagingReceipt) privacyConfigurationBlockers.push("commercial_cohort_privacy_current_staging_receipt_missing");
  if (!currentChaosReceipt) privacyConfigurationBlockers.push("commercial_cohort_privacy_current_chaos_receipt_missing");
  if (!currentObservabilityReceipt) privacyConfigurationBlockers.push("commercial_cohort_privacy_current_observability_receipt_missing");
  if (!observabilityVerification.verified) privacyConfigurationBlockers.push("commercial_cohort_privacy_requires_verified_observability");
  const privacyVerification = privacyReceipts && minimumPrivacySequence && currentDeploymentReceipt && currentStagingReceipt && currentChaosReceipt && currentObservabilityReceipt && observabilityVerification.verified
    ? verifyCommercialCohortPrivacyReceiptChain({
        receipts: privacyReceipts,
        trustBundles,
        expectedAudience,
        expectedPromotionTarget: expectedEnvironment,
        currentDeploymentReceipt,
        currentStagingReceipt,
        currentChaosReceipt,
        currentObservabilityReceipt,
        minimumPrivacySequence,
        now: args.now,
      })
    : {
        verified: false,
        privacyVerified: false,
        tenantIsolationVerified: false,
        dataLifecycleVerified: false,
        abuseResistanceVerified: false,
        auditTrailVerified: false,
        privacyRollbackProtected: false,
        privacySequence: privacyReceipts?.at(-1)?.privacySequence ?? null,
        privacyReceiptDigest: privacyReceipts?.at(-1)?.privacyReceiptDigest ?? null,
        controlCount: privacyReceipts?.at(-1)?.controlCount ?? 0,
        blockers: privacyConfigurationBlockers.length
          ? privacyConfigurationBlockers
          : ["commercial_cohort_privacy_configuration_incomplete"],
      };
  const blockers = Array.from(new Set([
    ...publicVerification.blockers,
    ...supplyChainVerification.blockers,
    ...supplyChainRuntimeBlockers,
    ...deploymentVerification.blockers,
    ...stagingVerification.blockers,
    ...chaosVerification.blockers,
    ...observabilityVerification.blockers,
    ...privacyVerification.blockers,
  ])).sort();
  return {
    ...publicVerification,
    verified: publicVerification.verified && supplyChainVerification.verified && deploymentVerification.verified && stagingVerification.verified && chaosVerification.verified && observabilityVerification.verified && privacyVerification.verified && blockers.length === 0,
    deploymentReceiptVerified: deploymentVerification.deploymentReceiptVerified,
    artifactBound: deploymentVerification.artifactBound,
    stagingE2eVerified: stagingVerification.stagingE2eVerified,
    stagingE2eBound: stagingVerification.stagingE2eBound,
    stagingRollbackProtected: stagingVerification.stagingRollbackProtected,
    stagingSequence: stagingVerification.stagingSequence,
    stagingReceiptDigest: stagingVerification.stagingReceiptDigest,
    stagingProbeCount: stagingVerification.probeCount,
    chaosRecoveryVerified: chaosVerification.chaosRecoveryVerified,
    recoveryBound: chaosVerification.recoveryBound,
    recoveryRollbackProtected: chaosVerification.recoveryRollbackProtected,
    rtoRpoVerified: chaosVerification.rtoRpoVerified,
    idempotencyVerified: chaosVerification.idempotencyVerified,
    chaosSequence: chaosVerification.chaosSequence,
    chaosReceiptDigest: chaosVerification.chaosReceiptDigest,
    chaosScenarioCount: chaosVerification.scenarioCount,
    observabilityVerified: observabilityVerification.observabilityVerified,
    telemetryBound: observabilityVerification.telemetryBound,
    sloVerified: observabilityVerification.sloVerified,
    incidentResponseVerified: observabilityVerification.incidentResponseVerified,
    safeDegradationVerified: observabilityVerification.safeDegradationVerified,
    observabilityRollbackProtected: observabilityVerification.observabilityRollbackProtected,
    observabilitySequence: observabilityVerification.observabilitySequence,
    observabilityReceiptDigest: observabilityVerification.observabilityReceiptDigest,
    observabilityObjectiveCount: observabilityVerification.objectiveCount,
    privacyVerified: privacyVerification.privacyVerified,
    tenantIsolationVerified: privacyVerification.tenantIsolationVerified,
    dataLifecycleVerified: privacyVerification.dataLifecycleVerified,
    abuseResistanceVerified: privacyVerification.abuseResistanceVerified,
    auditTrailVerified: privacyVerification.auditTrailVerified,
    privacyRollbackProtected: privacyVerification.privacyRollbackProtected,
    privacySequence: privacyVerification.privacySequence,
    privacyReceiptDigest: privacyVerification.privacyReceiptDigest,
    privacyControlCount: privacyVerification.controlCount,
    supplyChainVerified: supplyChainVerification.verified,
    reproducibleBuild: supplyChainVerification.reproducible,
    vulnerabilityGatePassed: supplyChainVerification.vulnerabilityGatePassed,
    supplyChainBound: deploymentVerification.supplyChainBound,
    supplyChainProvenanceDigest: supplyChainVerification.provenanceDigest,
    deploymentRollbackProtected: deploymentVerification.deploymentRollbackProtected,
    deploymentSequence: deploymentVerification.deploymentSequence,
    deploymentReceiptDigest: deploymentVerification.deploymentReceiptDigest,
    blockers,
  };
}

export function resolveCommercialCohortGateFromEnv(args: {
  product: Exclude<CommercialCohortProduct, "pdf">;
  tier: Extract<CommercialCohortTier, "pro" | "advanced">;
  now?: Date;
}): CommercialCohortGate {
  const attestation = parseAttestation(process.env.VELMERE_COMMERCIAL_COHORT_ATTESTATION_JSON);
  const antiCherryPickReceipt = parseJsonObject<CommercialCohortAntiCherryPickReceipt>(process.env.VELMERE_COMMERCIAL_COHORT_ANTI_CHERRY_PICK_RECEIPT_JSON);
  const publicCheckpoint = resolvePublicCheckpointFromEnv({ attestation, antiCherryPickReceipt, now: args.now });
  return evaluateCommercialCohortGate({
    attestation,
    secret: process.env.VELMERE_COMMERCIAL_COHORT_SIGNING_SECRET?.trim() || null,
    approverSecret: process.env.VELMERE_COMMERCIAL_COHORT_APPROVER_SECRET?.trim() || null,
    antiCherryPickReceipt,
    antiCherryPickSecret: process.env.VELMERE_COMMERCIAL_COHORT_ANTI_CHERRY_PICK_SECRET?.trim() || null,
    antiCherryPickApproverSecret: process.env.VELMERE_COMMERCIAL_COHORT_ANTI_CHERRY_PICK_APPROVER_SECRET?.trim() || null,
    requireAntiCherryPick: true,
    publicCheckpoint,
    requirePublicCheckpoint: true,
    product: args.product,
    tier: args.tier,
    now: args.now,
  });
}
