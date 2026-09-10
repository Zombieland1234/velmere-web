import {
  createPrivateKey,
  createPublicKey,
  sign as cryptoSign,
  verify as cryptoVerify,
  type KeyObject,
} from "node:crypto";
import { canonicalJson } from "@/lib/security/canonical-json";
import { sha256Digest } from "@/lib/security/cryptographic-digest";
import type { CommercialCohortDeploymentReceipt } from "@/lib/worldclass/commercial-cohort-deployment-receipt";
import {
  commercialCohortReleaseCandidateDigest,
  type CommercialCohortStagingE2EReceipt,
} from "@/lib/worldclass/commercial-cohort-staging-e2e";
import type {
  CommercialCohortDetachedSignature,
  CommercialCohortPrivateSigner,
  CommercialCohortTrustBundle,
  CommercialCohortTrustKey,
} from "@/lib/worldclass/commercial-cohort-public-checkpoint";

export const PASS4815_CHAOS_RECOVERY_POLICY_ID = "pass4815-chaos-recovery-idempotency-v1" as const;
export const PASS4815_CHAOS_SCENARIO_SCHEMA = "velmere.chaos-recovery-scenario.v1" as const;
export const PASS4815_CHAOS_RECEIPT_SCHEMA = "velmere.chaos-recovery-receipt.v1" as const;

const DIGEST = /^sha256:[a-f0-9]{64}$/;
const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9._:/-]{5,191}$/;
const MAX_SCENARIO_DURATION_MS = 30 * 60 * 1_000;
const MAX_SCENARIO_TO_RECEIPT_DELAY_MS = 2 * 60 * 60 * 1_000;
const MAX_RECEIPT_LIFETIME_MS = 12 * 60 * 60 * 1_000;
const CLOCK_SKEW_MS = 60_000;

export const PASS4815_REQUIRED_CHAOS_SCENARIOS = [
  "stripe_webhook_duplicate_delivery",
  "stripe_webhook_out_of_order_delivery",
  "stripe_webhook_concurrent_race",
  "supabase_transaction_rollback",
  "supabase_primary_failover",
  "entitlement_issue_crash_recovery",
  "entitlement_revoke_reconciliation",
  "audit_queue_worker_crash_retry",
  "advanced_review_partial_failure",
  "pdf_object_store_write_failure",
  "pdf_token_consume_race",
  "provider_timeout_fallback",
  "provider_rate_limit_backoff",
  "provider_stale_conflict_fail_closed",
  "backup_restore_point_in_time",
] as const;

export type CommercialCohortChaosScenarioName = typeof PASS4815_REQUIRED_CHAOS_SCENARIOS[number];
export type CommercialCohortChaosMode =
  | "stripe_test_api_failure_injection"
  | "supabase_staging_fault_injection"
  | "velmere_staging_fault_injection"
  | "live_upstream_staging_fault_injection"
  | "isolated_restore_drill";

export type CommercialCohortChaosMetrics = {
  recoveryTimeMs: number;
  recoveryPointLossMs: number;
  duplicateEffects: number;
  lostEffects: number;
  inconsistentRecords: number;
  retryAttempts: number;
  maxBackoffMs: number;
  deadLetterCount: number;
  recoveredDeadLetterCount: number;
};

export type CommercialCohortChaosScenario = {
  schemaVersion: typeof PASS4815_CHAOS_SCENARIO_SCHEMA;
  policyVersion: typeof PASS4815_CHAOS_RECOVERY_POLICY_ID;
  scenarioId: string;
  scenario: CommercialCohortChaosScenarioName;
  chaosMode: CommercialCohortChaosMode;
  evidenceClass: "staging_real_failure_injection";
  environment: "staging";
  audience: string;
  testedDeploymentId: string;
  testedDeploymentReceiptDigest: string;
  stagingSequence: number;
  stagingReceiptDigest: string;
  releaseCandidateDigest: string;
  buildArtifactDigest: string;
  sourcePackageDigest: string;
  runtimeVersionRoot: string;
  providerConfigRoot: string;
  modelConfigRoot: string;
  supplyChainProvenanceDigest: string;
  startedAt: string;
  failureInjectedAt: string;
  recoveredAt: string;
  observedUntil: string;
  referenceDigests: string[];
  assertions: Record<string, true>;
  metrics: CommercialCohortChaosMetrics;
  preStateDigest: string;
  failureStateDigest: string;
  postRecoveryStateDigest: string;
  durableJournalRoot: string;
  restorePointDigest: string | null;
  evidenceDigest: string;
  scenarioDigest: string;
};

export type CommercialCohortChaosReceiptCore = {
  schemaVersion: typeof PASS4815_CHAOS_RECEIPT_SCHEMA;
  policyVersion: typeof PASS4815_CHAOS_RECOVERY_POLICY_ID;
  testedEnvironment: "staging";
  promotionTarget: "staging" | "production";
  audience: string;
  chaosSequence: number;
  previousChaosReceiptDigest: string | null;
  testedDeploymentId: string;
  testedDeploymentReceiptDigest: string;
  stagingSequence: number;
  stagingReceiptDigest: string;
  releaseCandidateDigest: string;
  buildArtifactDigest: string;
  sourcePackageDigest: string;
  runtimeVersionRoot: string;
  providerConfigRoot: string;
  modelConfigRoot: string;
  supplyChainProvenanceDigest: string;
  trustEpoch: number;
  trustBundleDigest: string;
  scenarioDigests: string[];
  scenarioRoot: string;
  objectiveRoot: string;
  reconciliationRoot: string;
  scenarioCount: number;
  startedAt: string;
  completedAt: string;
  issuedAt: string;
  expiresAt: string;
  runIdDigest: string;
  nonce: string;
};

export type CommercialCohortChaosReceipt = CommercialCohortChaosReceiptCore & {
  scenarios: CommercialCohortChaosScenario[];
  signatures: CommercialCohortDetachedSignature[];
  chaosReceiptDigest: string;
};

export type CommercialCohortChaosPreparation = {
  core: CommercialCohortChaosReceiptCore;
  scenarios: CommercialCohortChaosScenario[];
  coreDigest: string;
  signaturePayload: ReturnType<typeof commercialCohortChaosSignaturePayload>;
};

export type CommercialCohortChaosVerification = {
  verified: boolean;
  chaosRecoveryVerified: boolean;
  recoveryBound: boolean;
  recoveryRollbackProtected: boolean;
  rtoRpoVerified: boolean;
  idempotencyVerified: boolean;
  chaosSequence: number | null;
  chaosReceiptDigest: string | null;
  scenarioCount: number;
  blockers: string[];
};

type ScenarioPolicy = {
  mode: CommercialCohortChaosMode;
  maxRtoMs: number;
  maxRpoMs: number;
  maxRetryAttempts: number;
  requireBackoff: boolean;
  allowRecoveredDeadLetter: boolean;
  requiredAssertions: readonly string[];
};

const SCENARIO_POLICY: Record<CommercialCohortChaosScenarioName, ScenarioPolicy> = {
  stripe_webhook_duplicate_delivery: {
    mode: "stripe_test_api_failure_injection", maxRtoMs: 120_000, maxRpoMs: 0, maxRetryAttempts: 4, requireBackoff: false, allowRecoveredDeadLetter: false,
    requiredAssertions: ["signatureVerified", "sameEventIdReplayed", "idempotencyKeyPersisted", "exactlyOnceEffect", "duplicateAcknowledged", "ledgerStable"],
  },
  stripe_webhook_out_of_order_delivery: {
    mode: "stripe_test_api_failure_injection", maxRtoMs: 120_000, maxRpoMs: 0, maxRetryAttempts: 4, requireBackoff: false, allowRecoveredDeadLetter: false,
    requiredAssertions: ["signatureVerified", "olderEventAfterNewer", "monotonicStatePreserved", "noEntitlementResurrection", "ledgerStable"],
  },
  stripe_webhook_concurrent_race: {
    mode: "stripe_test_api_failure_injection", maxRtoMs: 120_000, maxRpoMs: 0, maxRetryAttempts: 4, requireBackoff: false, allowRecoveredDeadLetter: false,
    requiredAssertions: ["concurrentDeliveryObserved", "singleWinner", "transactionIsolationVerified", "exactlyOnceEffect", "ledgerStable"],
  },
  supabase_transaction_rollback: {
    mode: "supabase_staging_fault_injection", maxRtoMs: 180_000, maxRpoMs: 0, maxRetryAttempts: 5, requireBackoff: true, allowRecoveredDeadLetter: false,
    requiredAssertions: ["faultInjectedMidTransaction", "transactionRolledBack", "noPartialRows", "readBackVerified", "retrySucceeded"],
  },
  supabase_primary_failover: {
    mode: "supabase_staging_fault_injection", maxRtoMs: 300_000, maxRpoMs: 0, maxRetryAttempts: 6, requireBackoff: true, allowRecoveredDeadLetter: false,
    requiredAssertions: ["connectionFailureInjected", "boundedRetryObserved", "durableStateRecovered", "readBackVerified", "noSplitBrain"],
  },
  entitlement_issue_crash_recovery: {
    mode: "velmere_staging_fault_injection", maxRtoMs: 300_000, maxRpoMs: 0, maxRetryAttempts: 6, requireBackoff: true, allowRecoveredDeadLetter: false,
    requiredAssertions: ["crashAfterPaymentBeforeGrant", "reconciliationFoundPending", "singleEntitlementIssued", "accessGrantedAfterRecovery", "paymentBound"],
  },
  entitlement_revoke_reconciliation: {
    mode: "velmere_staging_fault_injection", maxRtoMs: 300_000, maxRpoMs: 0, maxRetryAttempts: 6, requireBackoff: true, allowRecoveredDeadLetter: false,
    requiredAssertions: ["revokeFailureInjected", "reconciliationFoundStaleAccess", "accessDeniedAfterRecovery", "noEntitlementResurrection", "accountBound"],
  },
  audit_queue_worker_crash_retry: {
    mode: "velmere_staging_fault_injection", maxRtoMs: 600_000, maxRpoMs: 0, maxRetryAttempts: 8, requireBackoff: true, allowRecoveredDeadLetter: true,
    requiredAssertions: ["workerCrashInjected", "leaseExpired", "retryClaimedByNewWorker", "singleImmutableSnapshot", "singleCustomerMessage", "noDuplicateCharge"],
  },
  advanced_review_partial_failure: {
    mode: "velmere_staging_fault_injection", maxRtoMs: 900_000, maxRpoMs: 0, maxRetryAttempts: 6, requireBackoff: true, allowRecoveredDeadLetter: false,
    requiredAssertions: ["firstApprovalPersisted", "secondApprovalFailureInjected", "releaseStayedBlocked", "distinctApproverRecovered", "singleReadyTransition"],
  },
  pdf_object_store_write_failure: {
    mode: "velmere_staging_fault_injection", maxRtoMs: 300_000, maxRpoMs: 0, maxRetryAttempts: 6, requireBackoff: true, allowRecoveredDeadLetter: false,
    requiredAssertions: ["writeFailureInjected", "noDownloadTokenIssued", "retryStoredExactBytes", "digestVerified", "singleArtifactPublished"],
  },
  pdf_token_consume_race: {
    mode: "velmere_staging_fault_injection", maxRtoMs: 120_000, maxRpoMs: 0, maxRetryAttempts: 3, requireBackoff: false, allowRecoveredDeadLetter: false,
    requiredAssertions: ["parallelConsumeAttempted", "singleConsumeWinner", "loserDenied", "noQueryToken", "auditLogConsistent"],
  },
  provider_timeout_fallback: {
    mode: "live_upstream_staging_fault_injection", maxRtoMs: 120_000, maxRpoMs: 0, maxRetryAttempts: 5, requireBackoff: true, allowRecoveredDeadLetter: false,
    requiredAssertions: ["primaryTimeoutInjected", "boundedTimeout", "independentFallbackUsed", "sourceIdentityVerified", "degradedStateSurfaced", "noFabricatedClaim"],
  },
  provider_rate_limit_backoff: {
    mode: "live_upstream_staging_fault_injection", maxRtoMs: 180_000, maxRpoMs: 0, maxRetryAttempts: 6, requireBackoff: true, allowRecoveredDeadLetter: true,
    requiredAssertions: ["rateLimitInjected", "retryAfterHonored", "boundedExponentialBackoff", "requestBudgetRespected", "degradedStateSurfaced"],
  },
  provider_stale_conflict_fail_closed: {
    mode: "live_upstream_staging_fault_injection", maxRtoMs: 120_000, maxRpoMs: 0, maxRetryAttempts: 3, requireBackoff: false, allowRecoveredDeadLetter: false,
    requiredAssertions: ["staleAndConflictInjected", "freshnessRejected", "conflictSurfaced", "scoreNotUpgraded", "manualReviewRequired"],
  },
  backup_restore_point_in_time: {
    mode: "isolated_restore_drill", maxRtoMs: 1_800_000, maxRpoMs: 300_000, maxRetryAttempts: 3, requireBackoff: false, allowRecoveredDeadLetter: false,
    requiredAssertions: ["backupSnapshotVerified", "restoreIntoIsolatedProject", "restorePointBound", "ledgerReconciled", "entitlementsReconciled", "pdfDigestsReconciled", "noCrossAccountLeak"],
  },
};

function clean(value: unknown, max = 4096): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function requiredId(value: unknown, code: string): string {
  const text = clean(value, 192);
  if (!SAFE_ID.test(text)) throw new Error(code);
  return text;
}

function requiredDigest(value: unknown, code: string): string {
  const text = clean(value, 80).toLowerCase();
  if (!DIGEST.test(text)) throw new Error(code);
  return text;
}

function parseDate(value: unknown, code: string): Date {
  const text = clean(value, 64);
  const date = new Date(text);
  if (!text || !Number.isFinite(date.getTime())) throw new Error(code);
  return date;
}

function integer(value: unknown, min: number, max: number, code: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) throw new Error(code);
  return parsed;
}

function requiredSignature(value: unknown, code: string): string {
  const text = clean(value, 256).replace(/=+$/g, "");
  if (!/^[A-Za-z0-9_-]+$/.test(text)) throw new Error(code);
  const bytes = Buffer.from(text, "base64url");
  if (bytes.length !== 64 || bytes.toString("base64url") !== text) throw new Error(code);
  return text;
}

function normalizePem(value: unknown): string {
  return clean(value, 16_384).replace(/\\n/g, "\n");
}

function ed25519PublicKey(value: unknown): KeyObject {
  const key = createPublicKey(normalizePem(value));
  if (key.asymmetricKeyType !== "ed25519") throw new Error("chaos_recovery_public_key_not_ed25519");
  return key;
}

function ed25519PrivateKey(value: unknown): KeyObject {
  const key = createPrivateKey(normalizePem(value));
  if (key.asymmetricKeyType !== "ed25519") throw new Error("chaos_recovery_private_key_not_ed25519");
  return key;
}

function signPayload(privateKeyPem: string, payload: unknown): string {
  return cryptoSign(null, Buffer.from(canonicalJson(payload), "utf8"), ed25519PrivateKey(privateKeyPem)).toString("base64url");
}

function verifyPayload(publicKeyPem: string, payload: unknown, signature: unknown): boolean {
  try {
    return cryptoVerify(null, Buffer.from(canonicalJson(payload), "utf8"), ed25519PublicKey(publicKeyPem), Buffer.from(requiredSignature(signature, "chaos_recovery_signature_invalid"), "base64url"));
  } catch {
    return false;
  }
}

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean))).sort();
}

function keyUsableAt(key: CommercialCohortTrustKey, at: Date): boolean {
  if (key.purpose !== "release" || key.status === "revoked") return false;
  return at.getTime() >= parseDate(key.notBefore, "chaos_recovery_key_not_before_invalid").getTime()
    && at.getTime() < parseDate(key.notAfter, "chaos_recovery_key_not_after_invalid").getTime();
}

function scenarioCore(scenario: CommercialCohortChaosScenario): Omit<CommercialCohortChaosScenario, "scenarioDigest"> {
  const { scenarioDigest: _scenarioDigest, ...core } = scenario;
  return core;
}

function receiptCore(receipt: CommercialCohortChaosReceipt): CommercialCohortChaosReceiptCore {
  const { scenarios: _scenarios, signatures: _signatures, chaosReceiptDigest: _chaosReceiptDigest, ...core } = receipt;
  return core;
}

function validateMetrics(metrics: CommercialCohortChaosMetrics, policy: ScenarioPolicy, scenario: CommercialCohortChaosScenarioName): string[] {
  const blockers: string[] = [];
  const recoveryTimeMs = integer(metrics?.recoveryTimeMs, 0, MAX_SCENARIO_DURATION_MS, `chaos_recovery_rto_metric_invalid:${scenario}`);
  const recoveryPointLossMs = integer(metrics?.recoveryPointLossMs, 0, MAX_SCENARIO_DURATION_MS, `chaos_recovery_rpo_metric_invalid:${scenario}`);
  const duplicateEffects = integer(metrics?.duplicateEffects, 0, 1_000_000, `chaos_recovery_duplicate_metric_invalid:${scenario}`);
  const lostEffects = integer(metrics?.lostEffects, 0, 1_000_000, `chaos_recovery_lost_metric_invalid:${scenario}`);
  const inconsistentRecords = integer(metrics?.inconsistentRecords, 0, 1_000_000, `chaos_recovery_inconsistent_metric_invalid:${scenario}`);
  const retryAttempts = integer(metrics?.retryAttempts, 0, 64, `chaos_recovery_retry_metric_invalid:${scenario}`);
  const maxBackoffMs = integer(metrics?.maxBackoffMs, 0, MAX_SCENARIO_DURATION_MS, `chaos_recovery_backoff_metric_invalid:${scenario}`);
  const deadLetterCount = integer(metrics?.deadLetterCount, 0, 1_000_000, `chaos_recovery_dead_letter_metric_invalid:${scenario}`);
  const recoveredDeadLetterCount = integer(metrics?.recoveredDeadLetterCount, 0, 1_000_000, `chaos_recovery_dead_letter_recovery_metric_invalid:${scenario}`);
  if (recoveryTimeMs > policy.maxRtoMs) blockers.push(`chaos_recovery_rto_exceeded:${scenario}:${recoveryTimeMs}/${policy.maxRtoMs}`);
  if (recoveryPointLossMs > policy.maxRpoMs) blockers.push(`chaos_recovery_rpo_exceeded:${scenario}:${recoveryPointLossMs}/${policy.maxRpoMs}`);
  if (duplicateEffects !== 0) blockers.push(`chaos_recovery_duplicate_effects:${scenario}:${duplicateEffects}`);
  if (lostEffects !== 0) blockers.push(`chaos_recovery_lost_effects:${scenario}:${lostEffects}`);
  if (inconsistentRecords !== 0) blockers.push(`chaos_recovery_inconsistent_records:${scenario}:${inconsistentRecords}`);
  if (retryAttempts < 1 || retryAttempts > policy.maxRetryAttempts) blockers.push(`chaos_recovery_retry_attempts_invalid:${scenario}:${retryAttempts}/${policy.maxRetryAttempts}`);
  if (policy.requireBackoff && maxBackoffMs < 100) blockers.push(`chaos_recovery_backoff_missing:${scenario}`);
  if (!policy.requireBackoff && maxBackoffMs > 0 && retryAttempts < 2) blockers.push(`chaos_recovery_backoff_without_retry:${scenario}`);
  if (deadLetterCount !== recoveredDeadLetterCount) blockers.push(`chaos_recovery_unrecovered_dead_letters:${scenario}:${recoveredDeadLetterCount}/${deadLetterCount}`);
  if (!policy.allowRecoveredDeadLetter && deadLetterCount !== 0) blockers.push(`chaos_recovery_dead_letter_forbidden:${scenario}:${deadLetterCount}`);
  if (policy.allowRecoveredDeadLetter && deadLetterCount > 1) blockers.push(`chaos_recovery_dead_letter_excessive:${scenario}:${deadLetterCount}`);
  return blockers;
}

function validateScenario(scenario: CommercialCohortChaosScenario): string[] {
  const blockers: string[] = [];
  try {
    if (scenario.schemaVersion !== PASS4815_CHAOS_SCENARIO_SCHEMA) throw new Error(`chaos_recovery_scenario_schema_invalid:${scenario.scenario}`);
    if (scenario.policyVersion !== PASS4815_CHAOS_RECOVERY_POLICY_ID) throw new Error(`chaos_recovery_scenario_policy_invalid:${scenario.scenario}`);
    requiredId(scenario.scenarioId, `chaos_recovery_scenario_id_invalid:${scenario.scenario}`);
    if (!(PASS4815_REQUIRED_CHAOS_SCENARIOS as readonly string[]).includes(scenario.scenario)) throw new Error("chaos_recovery_scenario_unknown");
    const policy = SCENARIO_POLICY[scenario.scenario];
    if (scenario.chaosMode !== policy.mode) blockers.push(`chaos_recovery_mode_invalid:${scenario.scenario}`);
    if (scenario.evidenceClass !== "staging_real_failure_injection") blockers.push(`chaos_recovery_evidence_class_invalid:${scenario.scenario}`);
    if (scenario.environment !== "staging") blockers.push(`chaos_recovery_environment_invalid:${scenario.scenario}`);
    requiredId(scenario.audience, `chaos_recovery_audience_invalid:${scenario.scenario}`);
    requiredId(scenario.testedDeploymentId, `chaos_recovery_deployment_id_invalid:${scenario.scenario}`);
    requiredDigest(scenario.testedDeploymentReceiptDigest, `chaos_recovery_deployment_digest_invalid:${scenario.scenario}`);
    integer(scenario.stagingSequence, 1, Number.MAX_SAFE_INTEGER, `chaos_recovery_staging_sequence_invalid:${scenario.scenario}`);
    requiredDigest(scenario.stagingReceiptDigest, `chaos_recovery_staging_receipt_digest_invalid:${scenario.scenario}`);
    requiredDigest(scenario.releaseCandidateDigest, `chaos_recovery_candidate_digest_invalid:${scenario.scenario}`);
    requiredDigest(scenario.buildArtifactDigest, `chaos_recovery_build_digest_invalid:${scenario.scenario}`);
    requiredDigest(scenario.sourcePackageDigest, `chaos_recovery_source_digest_invalid:${scenario.scenario}`);
    requiredDigest(scenario.runtimeVersionRoot, `chaos_recovery_runtime_root_invalid:${scenario.scenario}`);
    requiredDigest(scenario.providerConfigRoot, `chaos_recovery_provider_root_invalid:${scenario.scenario}`);
    requiredDigest(scenario.modelConfigRoot, `chaos_recovery_model_root_invalid:${scenario.scenario}`);
    requiredDigest(scenario.supplyChainProvenanceDigest, `chaos_recovery_supply_chain_digest_invalid:${scenario.scenario}`);
    const startedAt = parseDate(scenario.startedAt, `chaos_recovery_started_at_invalid:${scenario.scenario}`);
    const failureInjectedAt = parseDate(scenario.failureInjectedAt, `chaos_recovery_failure_at_invalid:${scenario.scenario}`);
    const recoveredAt = parseDate(scenario.recoveredAt, `chaos_recovery_recovered_at_invalid:${scenario.scenario}`);
    const observedUntil = parseDate(scenario.observedUntil, `chaos_recovery_observed_until_invalid:${scenario.scenario}`);
    if (failureInjectedAt.getTime() < startedAt.getTime() || recoveredAt.getTime() < failureInjectedAt.getTime() || observedUntil.getTime() < recoveredAt.getTime()) blockers.push(`chaos_recovery_timeline_invalid:${scenario.scenario}`);
    if (observedUntil.getTime() - startedAt.getTime() > MAX_SCENARIO_DURATION_MS) blockers.push(`chaos_recovery_duration_exceeded:${scenario.scenario}`);
    const references = scenario.referenceDigests?.map((value) => requiredDigest(value, `chaos_recovery_reference_invalid:${scenario.scenario}`)) ?? [];
    if (references.length < 2 || references.length > 32 || new Set(references).size !== references.length) blockers.push(`chaos_recovery_reference_set_invalid:${scenario.scenario}`);
    const assertionKeys = Object.entries(scenario.assertions ?? {}).filter(([, value]) => value === true).map(([key]) => key).sort();
    const expectedAssertions = [...policy.requiredAssertions].sort();
    if (canonicalJson(assertionKeys) !== canonicalJson(expectedAssertions)) blockers.push(`chaos_recovery_assertion_set_invalid:${scenario.scenario}`);
    blockers.push(...validateMetrics(scenario.metrics, policy, scenario.scenario));
    requiredDigest(scenario.preStateDigest, `chaos_recovery_pre_state_invalid:${scenario.scenario}`);
    requiredDigest(scenario.failureStateDigest, `chaos_recovery_failure_state_invalid:${scenario.scenario}`);
    requiredDigest(scenario.postRecoveryStateDigest, `chaos_recovery_post_state_invalid:${scenario.scenario}`);
    requiredDigest(scenario.durableJournalRoot, `chaos_recovery_journal_root_invalid:${scenario.scenario}`);
    if (scenario.scenario === "backup_restore_point_in_time") requiredDigest(scenario.restorePointDigest, "chaos_recovery_restore_point_missing");
    else if (scenario.restorePointDigest !== null) requiredDigest(scenario.restorePointDigest, `chaos_recovery_restore_point_invalid:${scenario.scenario}`);
    requiredDigest(scenario.evidenceDigest, `chaos_recovery_evidence_digest_invalid:${scenario.scenario}`);
    const expectedDigest = sha256Digest(canonicalJson(scenarioCore(scenario)));
    if (scenario.scenarioDigest !== expectedDigest) blockers.push(`chaos_recovery_scenario_digest_invalid:${scenario.scenario}`);
  } catch (error) {
    blockers.push(error instanceof Error ? error.message : "chaos_recovery_scenario_validation_failed");
  }
  return uniqueSorted(blockers);
}

export function buildCommercialCohortChaosScenario(
  args: Omit<CommercialCohortChaosScenario, "schemaVersion" | "policyVersion" | "scenarioDigest">,
): CommercialCohortChaosScenario {
  const core: Omit<CommercialCohortChaosScenario, "scenarioDigest"> = {
    schemaVersion: PASS4815_CHAOS_SCENARIO_SCHEMA,
    policyVersion: PASS4815_CHAOS_RECOVERY_POLICY_ID,
    ...args,
    referenceDigests: [...args.referenceDigests].map((item) => item.toLowerCase()).sort(),
    assertions: Object.fromEntries(Object.entries(args.assertions).filter(([, value]) => value === true).sort(([a], [b]) => a.localeCompare(b))) as Record<string, true>,
  };
  const scenario = { ...core, scenarioDigest: sha256Digest(canonicalJson(core)) };
  const blockers = validateScenario(scenario);
  if (blockers.length) throw new Error(blockers.join("|"));
  return scenario;
}

export function commercialCohortChaosSignaturePayload(coreDigest: string) {
  return {
    schemaVersion: "velmere.chaos-recovery-signature-payload.v1" as const,
    policyVersion: PASS4815_CHAOS_RECOVERY_POLICY_ID,
    coreDigest: requiredDigest(coreDigest, "chaos_recovery_core_digest_invalid"),
  };
}

export function prepareCommercialCohortChaosReceipt(args: {
  promotionTarget: "staging" | "production";
  audience: string;
  chaosSequence: number;
  previousReceipt?: CommercialCohortChaosReceipt | null;
  testedDeployment: CommercialCohortDeploymentReceipt;
  stagingReceipt: CommercialCohortStagingE2EReceipt;
  trustBundle: CommercialCohortTrustBundle;
  scenarios: CommercialCohortChaosScenario[];
  issuedAt?: Date;
  expiresAt: Date;
  runIdDigest: string;
  nonce: string;
}): CommercialCohortChaosPreparation {
  const promotionTarget = args.promotionTarget;
  if (!(promotionTarget === "staging" || promotionTarget === "production")) throw new Error("chaos_recovery_promotion_target_invalid");
  const audience = requiredId(args.audience, "chaos_recovery_audience_invalid");
  const chaosSequence = integer(args.chaosSequence, 1, Number.MAX_SAFE_INTEGER, "chaos_recovery_sequence_invalid");
  if (chaosSequence === 1 && args.previousReceipt) throw new Error("chaos_recovery_unexpected_previous_receipt");
  if (chaosSequence > 1 && (!args.previousReceipt || args.previousReceipt.chaosSequence !== chaosSequence - 1)) throw new Error("chaos_recovery_previous_receipt_missing");
  if (args.trustBundle.releaseSignatureThreshold < 2) throw new Error("chaos_recovery_dual_release_threshold_required");
  const issuedAt = args.issuedAt ?? new Date();
  const expiresAt = args.expiresAt;
  if (!Number.isFinite(expiresAt.getTime()) || expiresAt.getTime() <= issuedAt.getTime() || expiresAt.getTime() - issuedAt.getTime() > MAX_RECEIPT_LIFETIME_MS) throw new Error("chaos_recovery_receipt_lifetime_invalid");
  if (args.stagingReceipt.audience !== audience || args.stagingReceipt.promotionTarget !== promotionTarget) throw new Error("chaos_recovery_staging_identity_mismatch");
  const releaseCandidateDigest = commercialCohortReleaseCandidateDigest(args.testedDeployment);
  if (args.stagingReceipt.releaseCandidateDigest !== releaseCandidateDigest) throw new Error("chaos_recovery_staging_candidate_mismatch");
  const scenarios = [...args.scenarios].sort((a, b) => a.scenario.localeCompare(b.scenario));
  const scenarioBlockers = scenarios.flatMap(validateScenario);
  if (scenarioBlockers.length) throw new Error(uniqueSorted(scenarioBlockers).join("|"));
  const names = scenarios.map((item) => item.scenario);
  if (scenarios.length !== PASS4815_REQUIRED_CHAOS_SCENARIOS.length || new Set(names).size !== PASS4815_REQUIRED_CHAOS_SCENARIOS.length || names.join("|") !== [...PASS4815_REQUIRED_CHAOS_SCENARIOS].sort().join("|")) {
    throw new Error(`chaos_recovery_scenario_set_invalid:${scenarios.length}/${PASS4815_REQUIRED_CHAOS_SCENARIOS.length}`);
  }
  for (const scenario of scenarios) {
    if (scenario.audience !== audience
      || scenario.testedDeploymentId !== args.stagingReceipt.testedDeploymentId
      || scenario.testedDeploymentReceiptDigest !== args.stagingReceipt.testedDeploymentReceiptDigest
      || scenario.stagingSequence !== args.stagingReceipt.stagingSequence
      || scenario.stagingReceiptDigest !== args.stagingReceipt.stagingReceiptDigest) throw new Error(`chaos_recovery_staging_binding_invalid:${scenario.scenario}`);
    if (scenario.releaseCandidateDigest !== releaseCandidateDigest
      || scenario.buildArtifactDigest !== args.testedDeployment.buildArtifactDigest
      || scenario.sourcePackageDigest !== args.testedDeployment.sourcePackageDigest
      || scenario.runtimeVersionRoot !== args.testedDeployment.runtimeVersionRoot
      || scenario.providerConfigRoot !== args.testedDeployment.providerConfigRoot
      || scenario.modelConfigRoot !== args.testedDeployment.modelConfigRoot
      || scenario.supplyChainProvenanceDigest !== args.testedDeployment.supplyChainProvenanceDigest) throw new Error(`chaos_recovery_release_binding_invalid:${scenario.scenario}`);
    if (parseDate(scenario.startedAt, "chaos_recovery_started_at_invalid").getTime() < parseDate(args.stagingReceipt.issuedAt, "chaos_recovery_staging_issued_at_invalid").getTime() - CLOCK_SKEW_MS) throw new Error(`chaos_recovery_started_before_staging_receipt:${scenario.scenario}`);
    if (issuedAt.getTime() - parseDate(scenario.observedUntil, "chaos_recovery_observed_until_invalid").getTime() > MAX_SCENARIO_TO_RECEIPT_DELAY_MS) throw new Error(`chaos_recovery_scenario_stale_before_receipt:${scenario.scenario}`);
  }
  const startedAt = scenarios.reduce((min, item) => Math.min(min, Date.parse(item.startedAt)), Number.POSITIVE_INFINITY);
  const completedAt = scenarios.reduce((max, item) => Math.max(max, Date.parse(item.observedUntil)), 0);
  if (!Number.isFinite(startedAt) || completedAt > issuedAt.getTime() + CLOCK_SKEW_MS) throw new Error("chaos_recovery_receipt_timeline_invalid");
  const scenarioDigests = scenarios.map((item) => item.scenarioDigest).sort();
  const core: CommercialCohortChaosReceiptCore = {
    schemaVersion: PASS4815_CHAOS_RECEIPT_SCHEMA,
    policyVersion: PASS4815_CHAOS_RECOVERY_POLICY_ID,
    testedEnvironment: "staging",
    promotionTarget,
    audience,
    chaosSequence,
    previousChaosReceiptDigest: args.previousReceipt?.chaosReceiptDigest ?? null,
    testedDeploymentId: args.stagingReceipt.testedDeploymentId,
    testedDeploymentReceiptDigest: args.stagingReceipt.testedDeploymentReceiptDigest,
    stagingSequence: args.stagingReceipt.stagingSequence,
    stagingReceiptDigest: args.stagingReceipt.stagingReceiptDigest,
    releaseCandidateDigest,
    buildArtifactDigest: args.testedDeployment.buildArtifactDigest,
    sourcePackageDigest: args.testedDeployment.sourcePackageDigest,
    runtimeVersionRoot: args.testedDeployment.runtimeVersionRoot,
    providerConfigRoot: args.testedDeployment.providerConfigRoot,
    modelConfigRoot: args.testedDeployment.modelConfigRoot,
    supplyChainProvenanceDigest: args.testedDeployment.supplyChainProvenanceDigest,
    trustEpoch: args.trustBundle.epoch,
    trustBundleDigest: args.trustBundle.bundleDigest,
    scenarioDigests,
    scenarioRoot: sha256Digest(canonicalJson(scenarioDigests)),
    objectiveRoot: sha256Digest(canonicalJson(scenarios.map((item) => ({ scenario: item.scenario, maxRtoMs: SCENARIO_POLICY[item.scenario].maxRtoMs, maxRpoMs: SCENARIO_POLICY[item.scenario].maxRpoMs, maxRetryAttempts: SCENARIO_POLICY[item.scenario].maxRetryAttempts })))),
    reconciliationRoot: sha256Digest(canonicalJson(scenarios.map((item) => ({ scenario: item.scenario, postRecoveryStateDigest: item.postRecoveryStateDigest, durableJournalRoot: item.durableJournalRoot, restorePointDigest: item.restorePointDigest })))),
    scenarioCount: scenarios.length,
    startedAt: new Date(startedAt).toISOString(),
    completedAt: new Date(completedAt).toISOString(),
    issuedAt: issuedAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
    runIdDigest: requiredDigest(args.runIdDigest, "chaos_recovery_run_id_invalid"),
    nonce: requiredId(args.nonce, "chaos_recovery_nonce_invalid"),
  };
  const coreDigest = sha256Digest(canonicalJson(core));
  return { core, scenarios, coreDigest, signaturePayload: commercialCohortChaosSignaturePayload(coreDigest) };
}

export function finalizeCommercialCohortChaosReceipt(args: {
  preparation: CommercialCohortChaosPreparation;
  signatures: CommercialCohortDetachedSignature[];
}): CommercialCohortChaosReceipt {
  const signatures = args.signatures.map((item) => ({ keyId: requiredId(item.keyId, "chaos_recovery_signature_key_invalid"), signature: requiredSignature(item.signature, "chaos_recovery_signature_invalid") })).sort((a, b) => a.keyId.localeCompare(b.keyId));
  const receipt: Omit<CommercialCohortChaosReceipt, "chaosReceiptDigest"> = { ...args.preparation.core, scenarios: args.preparation.scenarios, signatures };
  return { ...receipt, chaosReceiptDigest: sha256Digest(canonicalJson({ core: args.preparation.core, scenarios: args.preparation.scenarios, signatures })) };
}

export function buildCommercialCohortChaosReceipt(args: Parameters<typeof prepareCommercialCohortChaosReceipt>[0] & {
  signers: CommercialCohortPrivateSigner[];
}): CommercialCohortChaosReceipt {
  const preparation = prepareCommercialCohortChaosReceipt(args);
  const signatures = args.signers.map((signer) => ({ keyId: signer.keyId, signature: signPayload(signer.privateKeyPem, preparation.signaturePayload) }));
  return finalizeCommercialCohortChaosReceipt({ preparation, signatures });
}

function verifySingleReceipt(args: {
  receipt: CommercialCohortChaosReceipt;
  previousReceipt: CommercialCohortChaosReceipt | null;
  trustBundle: CommercialCohortTrustBundle;
  stagingReceipt: CommercialCohortStagingE2EReceipt;
  current: boolean;
  now: Date;
}): string[] {
  const blockers: string[] = [];
  try {
    const core = receiptCore(args.receipt);
    if (core.schemaVersion !== PASS4815_CHAOS_RECEIPT_SCHEMA || core.policyVersion !== PASS4815_CHAOS_RECOVERY_POLICY_ID) blockers.push(`chaos_recovery_receipt_schema_invalid:${core.chaosSequence}`);
    if (core.testedEnvironment !== "staging") blockers.push(`chaos_recovery_test_environment_invalid:${core.chaosSequence}`);
    if (core.chaosSequence === 1 && core.previousChaosReceiptDigest !== null) blockers.push("chaos_recovery_genesis_previous_digest_present");
    if (core.chaosSequence > 1 && (!args.previousReceipt || core.previousChaosReceiptDigest !== args.previousReceipt.chaosReceiptDigest)) blockers.push(`chaos_recovery_previous_binding_invalid:${core.chaosSequence}`);
    if (core.trustEpoch !== args.trustBundle.epoch || core.trustBundleDigest !== args.trustBundle.bundleDigest) blockers.push(`chaos_recovery_trust_binding_invalid:${core.chaosSequence}`);
    if (core.stagingSequence !== args.stagingReceipt.stagingSequence || core.stagingReceiptDigest !== args.stagingReceipt.stagingReceiptDigest) blockers.push(`chaos_recovery_staging_receipt_binding_invalid:${core.chaosSequence}`);
    if (core.testedDeploymentId !== args.stagingReceipt.testedDeploymentId || core.testedDeploymentReceiptDigest !== args.stagingReceipt.testedDeploymentReceiptDigest) blockers.push(`chaos_recovery_staging_deployment_binding_invalid:${core.chaosSequence}`);
    const scenarios = [...(args.receipt.scenarios ?? [])].sort((a, b) => a.scenario.localeCompare(b.scenario));
    blockers.push(...scenarios.flatMap(validateScenario));
    const names = scenarios.map((item) => item.scenario);
    if (scenarios.length !== core.scenarioCount || new Set(names).size !== PASS4815_REQUIRED_CHAOS_SCENARIOS.length || names.join("|") !== [...PASS4815_REQUIRED_CHAOS_SCENARIOS].sort().join("|")) blockers.push(`chaos_recovery_scenario_set_invalid:${core.chaosSequence}`);
    const scenarioDigests = scenarios.map((item) => item.scenarioDigest).sort();
    if (canonicalJson(scenarioDigests) !== canonicalJson(core.scenarioDigests)) blockers.push(`chaos_recovery_scenario_digest_set_invalid:${core.chaosSequence}`);
    if (core.scenarioRoot !== sha256Digest(canonicalJson(scenarioDigests))) blockers.push(`chaos_recovery_scenario_root_invalid:${core.chaosSequence}`);
    if (core.objectiveRoot !== sha256Digest(canonicalJson(scenarios.map((item) => ({ scenario: item.scenario, maxRtoMs: SCENARIO_POLICY[item.scenario].maxRtoMs, maxRpoMs: SCENARIO_POLICY[item.scenario].maxRpoMs, maxRetryAttempts: SCENARIO_POLICY[item.scenario].maxRetryAttempts }))))) blockers.push(`chaos_recovery_objective_root_invalid:${core.chaosSequence}`);
    if (core.reconciliationRoot !== sha256Digest(canonicalJson(scenarios.map((item) => ({ scenario: item.scenario, postRecoveryStateDigest: item.postRecoveryStateDigest, durableJournalRoot: item.durableJournalRoot, restorePointDigest: item.restorePointDigest }))))) blockers.push(`chaos_recovery_reconciliation_root_invalid:${core.chaosSequence}`);
    for (const scenario of scenarios) {
      if (scenario.audience !== core.audience
        || scenario.testedDeploymentId !== core.testedDeploymentId
        || scenario.testedDeploymentReceiptDigest !== core.testedDeploymentReceiptDigest
        || scenario.stagingSequence !== core.stagingSequence
        || scenario.stagingReceiptDigest !== core.stagingReceiptDigest) blockers.push(`chaos_recovery_scenario_staging_binding_invalid:${scenario.scenario}`);
      if (scenario.releaseCandidateDigest !== core.releaseCandidateDigest
        || scenario.buildArtifactDigest !== core.buildArtifactDigest
        || scenario.sourcePackageDigest !== core.sourcePackageDigest
        || scenario.runtimeVersionRoot !== core.runtimeVersionRoot
        || scenario.providerConfigRoot !== core.providerConfigRoot
        || scenario.modelConfigRoot !== core.modelConfigRoot
        || scenario.supplyChainProvenanceDigest !== core.supplyChainProvenanceDigest) blockers.push(`chaos_recovery_scenario_release_binding_invalid:${scenario.scenario}`);
      if (Date.parse(scenario.startedAt) < Date.parse(args.stagingReceipt.issuedAt) - CLOCK_SKEW_MS) blockers.push(`chaos_recovery_scenario_before_staging_receipt:${scenario.scenario}`);
      if (Date.parse(core.issuedAt) - Date.parse(scenario.observedUntil) > MAX_SCENARIO_TO_RECEIPT_DELAY_MS) blockers.push(`chaos_recovery_scenario_stale_before_receipt:${scenario.scenario}`);
    }
    const issuedAt = parseDate(core.issuedAt, "chaos_recovery_issued_at_invalid");
    const expiresAt = parseDate(core.expiresAt, "chaos_recovery_expires_at_invalid");
    if (expiresAt.getTime() <= issuedAt.getTime() || expiresAt.getTime() - issuedAt.getTime() > MAX_RECEIPT_LIFETIME_MS) blockers.push(`chaos_recovery_receipt_lifetime_invalid:${core.chaosSequence}`);
    if (args.current) {
      if (args.now.getTime() + CLOCK_SKEW_MS < issuedAt.getTime()) blockers.push("chaos_recovery_receipt_not_active");
      if (args.now.getTime() >= expiresAt.getTime()) blockers.push("chaos_recovery_receipt_expired");
    }
    const keys = new Map(args.trustBundle.keys.map((item) => [item.keyId, item]));
    const seen = new Set<string>();
    let valid = 0;
    let active = 0;
    const coreDigest = sha256Digest(canonicalJson(core));
    for (const signature of args.receipt.signatures ?? []) {
      const keyId = requiredId(signature?.keyId, "chaos_recovery_signature_key_invalid");
      if (seen.has(keyId)) {
        blockers.push(`chaos_recovery_signature_duplicate:${core.chaosSequence}:${keyId}`);
        continue;
      }
      seen.add(keyId);
      const key = keys.get(keyId);
      if (!key || !keyUsableAt(key, issuedAt)) {
        blockers.push(`chaos_recovery_signer_invalid:${core.chaosSequence}:${keyId}`);
        continue;
      }
      if (!verifyPayload(key.publicKeyPem, commercialCohortChaosSignaturePayload(coreDigest), signature.signature)) blockers.push(`chaos_recovery_signature_invalid:${core.chaosSequence}:${keyId}`);
      else {
        valid += 1;
        if (key.status === "active") active += 1;
      }
    }
    if (valid < args.trustBundle.releaseSignatureThreshold) blockers.push(`chaos_recovery_signature_threshold:${core.chaosSequence}:${valid}/${args.trustBundle.releaseSignatureThreshold}`);
    if (active < 1) blockers.push(`chaos_recovery_active_signer_missing:${core.chaosSequence}`);
    const normalizedSignatures = (args.receipt.signatures ?? []).map((item) => ({ keyId: item.keyId, signature: item.signature })).sort((a, b) => a.keyId.localeCompare(b.keyId));
    const expectedDigest = sha256Digest(canonicalJson({ core, scenarios, signatures: normalizedSignatures }));
    if (args.receipt.chaosReceiptDigest !== expectedDigest) blockers.push(`chaos_recovery_receipt_digest_invalid:${core.chaosSequence}`);
  } catch (error) {
    blockers.push(error instanceof Error ? error.message : "chaos_recovery_receipt_validation_failed");
  }
  return uniqueSorted(blockers);
}

export function verifyCommercialCohortChaosReceiptChain(args: {
  receipts: CommercialCohortChaosReceipt[];
  trustBundles: CommercialCohortTrustBundle[];
  expectedAudience: string;
  expectedPromotionTarget: "staging" | "production";
  currentDeploymentReceipt: CommercialCohortDeploymentReceipt;
  currentStagingReceipt: CommercialCohortStagingE2EReceipt;
  minimumChaosSequence: number;
  now?: Date;
}): CommercialCohortChaosVerification {
  const blockers: string[] = [];
  let current: CommercialCohortChaosReceipt | null = null;
  try {
    if (!Array.isArray(args.receipts) || args.receipts.length < 1 || args.receipts.length > 1024) throw new Error("chaos_recovery_receipt_chain_invalid");
    if (!Array.isArray(args.trustBundles) || !args.trustBundles.length) throw new Error("chaos_recovery_trust_chain_missing");
    const minimum = integer(args.minimumChaosSequence, 1, Number.MAX_SAFE_INTEGER, "chaos_recovery_minimum_sequence_invalid");
    const now = args.now ?? new Date();
    const digests = new Set<string>();
    const nonces = new Set<string>();
    const scenarioRoots = new Set<string>();
    const runIds = new Set<string>();
    for (let index = 0; index < args.receipts.length; index += 1) {
      const receipt = args.receipts[index]!;
      if (receipt.chaosSequence !== index + 1) blockers.push(`chaos_recovery_sequence_gap:${receipt.chaosSequence}/${index + 1}`);
      if (digests.has(receipt.chaosReceiptDigest)) blockers.push(`chaos_recovery_digest_reused:${receipt.chaosSequence}`);
      if (nonces.has(receipt.nonce)) blockers.push(`chaos_recovery_nonce_reused:${receipt.chaosSequence}`);
      if (scenarioRoots.has(receipt.scenarioRoot)) blockers.push(`chaos_recovery_scenario_root_reused:${receipt.chaosSequence}`);
      if (runIds.has(receipt.runIdDigest)) blockers.push(`chaos_recovery_run_id_reused:${receipt.chaosSequence}`);
      digests.add(receipt.chaosReceiptDigest);
      nonces.add(receipt.nonce);
      scenarioRoots.add(receipt.scenarioRoot);
      runIds.add(receipt.runIdDigest);
      const trustBundle = args.trustBundles.find((item) => item.epoch === receipt.trustEpoch && item.bundleDigest === receipt.trustBundleDigest) ?? null;
      if (!trustBundle) blockers.push(`chaos_recovery_trust_bundle_missing:${receipt.chaosSequence}`);
      else blockers.push(...verifySingleReceipt({
        receipt,
        previousReceipt: index > 0 ? args.receipts[index - 1]! : null,
        trustBundle,
        stagingReceipt: args.currentStagingReceipt,
        current: index === args.receipts.length - 1,
        now,
      }));
      current = receipt;
    }
    if (!current) throw new Error("chaos_recovery_current_receipt_missing");
    if (current.chaosSequence < minimum) blockers.push(`chaos_recovery_rollback_floor:${current.chaosSequence}/${minimum}`);
    if (current.audience !== args.expectedAudience || current.promotionTarget !== args.expectedPromotionTarget) blockers.push("chaos_recovery_identity_mismatch");
    const currentCandidate = commercialCohortReleaseCandidateDigest(args.currentDeploymentReceipt);
    if (current.releaseCandidateDigest !== currentCandidate) blockers.push("chaos_recovery_release_candidate_mismatch");
    if (current.buildArtifactDigest !== args.currentDeploymentReceipt.buildArtifactDigest) blockers.push("chaos_recovery_build_artifact_mismatch");
    if (current.sourcePackageDigest !== args.currentDeploymentReceipt.sourcePackageDigest) blockers.push("chaos_recovery_source_package_mismatch");
    if (current.runtimeVersionRoot !== args.currentDeploymentReceipt.runtimeVersionRoot) blockers.push("chaos_recovery_runtime_root_mismatch");
    if (current.providerConfigRoot !== args.currentDeploymentReceipt.providerConfigRoot) blockers.push("chaos_recovery_provider_root_mismatch");
    if (current.modelConfigRoot !== args.currentDeploymentReceipt.modelConfigRoot) blockers.push("chaos_recovery_model_root_mismatch");
    if (current.supplyChainProvenanceDigest !== args.currentDeploymentReceipt.supplyChainProvenanceDigest) blockers.push("chaos_recovery_supply_chain_mismatch");
    if (current.stagingSequence !== args.currentStagingReceipt.stagingSequence || current.stagingReceiptDigest !== args.currentStagingReceipt.stagingReceiptDigest) blockers.push("chaos_recovery_current_staging_receipt_mismatch");
    if (Date.parse(current.completedAt) > Date.parse(args.currentDeploymentReceipt.issuedAt) + CLOCK_SKEW_MS && args.expectedPromotionTarget === "production" && args.currentDeploymentReceipt.environment === "production") blockers.push("chaos_recovery_completed_after_production_deployment");
  } catch (error) {
    blockers.push(error instanceof Error ? error.message : "chaos_recovery_chain_validation_failed");
  }
  const uniqueBlockers = uniqueSorted(blockers);
  const chaosRecoveryVerified = uniqueBlockers.length === 0 && Boolean(current);
  const recoveryBound = chaosRecoveryVerified && Boolean(current
    && current.releaseCandidateDigest === commercialCohortReleaseCandidateDigest(args.currentDeploymentReceipt)
    && current.stagingReceiptDigest === args.currentStagingReceipt.stagingReceiptDigest);
  const recoveryRollbackProtected = chaosRecoveryVerified && Boolean(current && current.chaosSequence >= args.minimumChaosSequence);
  const rtoRpoVerified = chaosRecoveryVerified && Boolean(current?.scenarios.every((item) => {
    const policy = SCENARIO_POLICY[item.scenario];
    return item.metrics.recoveryTimeMs <= policy.maxRtoMs && item.metrics.recoveryPointLossMs <= policy.maxRpoMs;
  }));
  const idempotencyVerified = chaosRecoveryVerified && Boolean(current?.scenarios.every((item) => item.metrics.duplicateEffects === 0 && item.metrics.lostEffects === 0 && item.metrics.inconsistentRecords === 0));
  return {
    verified: chaosRecoveryVerified && recoveryBound && recoveryRollbackProtected && rtoRpoVerified && idempotencyVerified,
    chaosRecoveryVerified,
    recoveryBound,
    recoveryRollbackProtected,
    rtoRpoVerified,
    idempotencyVerified,
    chaosSequence: current?.chaosSequence ?? null,
    chaosReceiptDigest: current?.chaosReceiptDigest ?? null,
    scenarioCount: current?.scenarioCount ?? 0,
    blockers: uniqueBlockers,
  };
}
