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
import type { CommercialCohortStagingE2EReceipt } from "@/lib/worldclass/commercial-cohort-staging-e2e";
import type { CommercialCohortChaosReceipt } from "@/lib/worldclass/commercial-cohort-chaos-recovery";
import type { CommercialCohortObservabilityReceipt } from "@/lib/worldclass/commercial-cohort-observability-incident";
import type {
  CommercialCohortDetachedSignature,
  CommercialCohortPrivateSigner,
  CommercialCohortTrustBundle,
  CommercialCohortTrustKey,
} from "@/lib/worldclass/commercial-cohort-public-checkpoint";

export const PASS4817_PRIVACY_POLICY_ID = "pass4817-privacy-abuse-tenant-audit-v1" as const;
export const PASS4817_PRIVACY_CONTROL_SCHEMA = "velmere.privacy-abuse-control-result.v1" as const;
export const PASS4817_PRIVACY_RECEIPT_SCHEMA = "velmere.privacy-abuse-audit-receipt.v1" as const;

const DIGEST = /^sha256:[a-f0-9]{64}$/;
const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9._:/-]{5,191}$/;
const CLOCK_SKEW_MS = 60_000;
const MIN_TEST_DURATION_MS = 15 * 60 * 1_000;
const MAX_TEST_DURATION_MS = 6 * 60 * 60 * 1_000;
const MAX_TEST_TO_RECEIPT_DELAY_MS = 60 * 60 * 1_000;
const MAX_RECEIPT_LIFETIME_MS = 12 * 60 * 60 * 1_000;

export const PASS4817_REQUIRED_PRIVACY_CONTROLS = [
  "tenant_account_read_isolation",
  "tenant_report_download_isolation",
  "tenant_admin_scope_isolation",
  "checkout_data_minimization",
  "provider_capture_data_minimization",
  "log_and_trace_redaction",
  "retention_expiry_enforcement",
  "deletion_request_completion",
  "export_request_integrity",
  "legal_hold_scope_enforcement",
  "purchase_rate_limit",
  "download_rate_limit",
  "webhook_replay_abuse",
  "privileged_action_audit",
  "audit_log_tamper_evidence",
] as const;

export type CommercialCohortPrivacyControlName = typeof PASS4817_REQUIRED_PRIVACY_CONTROLS[number];

export type CommercialCohortPrivacyMetrics = {
  subjectCount: number;
  attemptCount: number;
  expectedAllowedCount: number;
  actualAllowedCount: number;
  expectedDeniedCount: number;
  actualDeniedCount: number;
  crossTenantLeakCount: number;
  unauthorizedPrivilegedActionCount: number;
  rawSecretLeakCount: number;
  directIdentifierLeakCount: number;
  retentionViolationCount: number;
  deletionResidualCount: number;
  exportMismatchCount: number;
  legalHoldBypassCount: number;
  rateLimitBypassCount: number;
  replayAcceptedCount: number;
  auditGapCount: number;
  auditChainBreakCount: number;
};

export type CommercialCohortPrivacyControlResult = {
  schemaVersion: typeof PASS4817_PRIVACY_CONTROL_SCHEMA;
  policyVersion: typeof PASS4817_PRIVACY_POLICY_ID;
  controlId: string;
  control: CommercialCohortPrivacyControlName;
  evidenceClass: "staging_real_privacy_abuse_test";
  environment: "staging";
  audience: string;
  testedDeploymentId: string;
  testedDeploymentReceiptDigest: string;
  stagingSequence: number;
  stagingReceiptDigest: string;
  chaosSequence: number;
  chaosReceiptDigest: string;
  observabilitySequence: number;
  observabilityReceiptDigest: string;
  buildArtifactDigest: string;
  sourcePackageDigest: string;
  runtimeVersionRoot: string;
  providerConfigRoot: string;
  modelConfigRoot: string;
  supplyChainProvenanceDigest: string;
  testStartedAt: string;
  testCompletedAt: string;
  policySnapshotDigest: string;
  dataClassificationDigest: string;
  retentionScheduleDigest: string;
  redactionPolicyDigest: string;
  rateLimitPolicyDigest: string;
  auditLogPolicyDigest: string;
  queryDigest: string;
  traceRoot: string;
  runbookDigest: string;
  operatorIdDigest: string;
  evidenceDigests: string[];
  metrics: CommercialCohortPrivacyMetrics;
  controlDigest: string;
};

export type CommercialCohortPrivacyReceiptCore = {
  schemaVersion: typeof PASS4817_PRIVACY_RECEIPT_SCHEMA;
  policyVersion: typeof PASS4817_PRIVACY_POLICY_ID;
  testedEnvironment: "staging";
  promotionTarget: "staging" | "production";
  audience: string;
  privacySequence: number;
  previousPrivacyReceiptDigest: string | null;
  testedDeploymentId: string;
  testedDeploymentReceiptDigest: string;
  stagingSequence: number;
  stagingReceiptDigest: string;
  chaosSequence: number;
  chaosReceiptDigest: string;
  observabilitySequence: number;
  observabilityReceiptDigest: string;
  buildArtifactDigest: string;
  sourcePackageDigest: string;
  runtimeVersionRoot: string;
  providerConfigRoot: string;
  modelConfigRoot: string;
  supplyChainProvenanceDigest: string;
  trustEpoch: number;
  trustBundleDigest: string;
  controlDigests: string[];
  controlRoot: string;
  dataClassificationRoot: string;
  minimizationPolicyRoot: string;
  retentionPolicyRoot: string;
  abusePolicyRoot: string;
  auditPolicyRoot: string;
  redactionPolicyRoot: string;
  controlCount: number;
  testStartedAt: string;
  testCompletedAt: string;
  issuedAt: string;
  expiresAt: string;
  runIdDigest: string;
  nonce: string;
};

export type CommercialCohortPrivacyReceipt = CommercialCohortPrivacyReceiptCore & {
  controls: CommercialCohortPrivacyControlResult[];
  signatures: CommercialCohortDetachedSignature[];
  privacyReceiptDigest: string;
};

export type CommercialCohortPrivacyPreparation = {
  core: CommercialCohortPrivacyReceiptCore;
  controls: CommercialCohortPrivacyControlResult[];
  coreDigest: string;
  signaturePayload: ReturnType<typeof commercialCohortPrivacySignaturePayload>;
};

export type CommercialCohortPrivacyVerification = {
  verified: boolean;
  privacyVerified: boolean;
  tenantIsolationVerified: boolean;
  dataLifecycleVerified: boolean;
  abuseResistanceVerified: boolean;
  auditTrailVerified: boolean;
  privacyRollbackProtected: boolean;
  privacySequence: number | null;
  privacyReceiptDigest: string | null;
  controlCount: number;
  blockers: string[];
};

type PrivacyControlPolicy = {
  minSubjects: number;
  minAttempts: number;
  minDenied: number;
  minAllowed: number;
};

export const PASS4817_PRIVACY_CONTROL_POLICY: Record<CommercialCohortPrivacyControlName, PrivacyControlPolicy> = {
  tenant_account_read_isolation: { minSubjects: 20, minAttempts: 200, minDenied: 100, minAllowed: 20 },
  tenant_report_download_isolation: { minSubjects: 20, minAttempts: 200, minDenied: 100, minAllowed: 20 },
  tenant_admin_scope_isolation: { minSubjects: 10, minAttempts: 100, minDenied: 50, minAllowed: 10 },
  checkout_data_minimization: { minSubjects: 50, minAttempts: 100, minDenied: 0, minAllowed: 100 },
  provider_capture_data_minimization: { minSubjects: 50, minAttempts: 100, minDenied: 0, minAllowed: 100 },
  log_and_trace_redaction: { minSubjects: 50, minAttempts: 500, minDenied: 0, minAllowed: 500 },
  retention_expiry_enforcement: { minSubjects: 50, minAttempts: 100, minDenied: 50, minAllowed: 50 },
  deletion_request_completion: { minSubjects: 30, minAttempts: 60, minDenied: 0, minAllowed: 60 },
  export_request_integrity: { minSubjects: 30, minAttempts: 60, minDenied: 0, minAllowed: 60 },
  legal_hold_scope_enforcement: { minSubjects: 20, minAttempts: 80, minDenied: 40, minAllowed: 40 },
  purchase_rate_limit: { minSubjects: 20, minAttempts: 500, minDenied: 300, minAllowed: 20 },
  download_rate_limit: { minSubjects: 20, minAttempts: 500, minDenied: 300, minAllowed: 20 },
  webhook_replay_abuse: { minSubjects: 20, minAttempts: 300, minDenied: 200, minAllowed: 20 },
  privileged_action_audit: { minSubjects: 10, minAttempts: 100, minDenied: 20, minAllowed: 50 },
  audit_log_tamper_evidence: { minSubjects: 10, minAttempts: 100, minDenied: 50, minAllowed: 20 },
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
  if (!Number.isInteger(value) || Number(value) < min || Number(value) > max) throw new Error(code);
  return Number(value);
}
function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values)).sort();
}
function privateKey(value: string): KeyObject {
  const key = createPrivateKey(clean(value, 16384).replace(/\\n/g, "\n"));
  if (key.asymmetricKeyType !== "ed25519") throw new Error("privacy_private_key_not_ed25519");
  return key;
}
function publicKey(value: string): KeyObject {
  const key = createPublicKey(clean(value, 16384).replace(/\\n/g, "\n"));
  if (key.asymmetricKeyType !== "ed25519") throw new Error("privacy_public_key_not_ed25519");
  return key;
}
function signPayload(privateKeyPem: string, payload: unknown): string {
  return cryptoSign(null, Buffer.from(canonicalJson(payload), "utf8"), privateKey(privateKeyPem)).toString("base64url");
}
function verifyPayload(publicKeyPem: string, payload: unknown, signature: string): boolean {
  try {
    const bytes = Buffer.from(clean(signature, 256).replace(/=+$/g, ""), "base64url");
    return bytes.length === 64 && cryptoVerify(null, Buffer.from(canonicalJson(payload), "utf8"), publicKey(publicKeyPem), bytes);
  } catch {
    return false;
  }
}
function keyUsableAt(key: CommercialCohortTrustKey, at: Date): boolean {
  if (key.purpose !== "release" || key.status === "revoked") return false;
  const notBefore = parseDate(key.notBefore, "privacy_key_not_before_invalid");
  const notAfter = parseDate(key.notAfter, "privacy_key_not_after_invalid");
  return at.getTime() >= notBefore.getTime() && at.getTime() <= notAfter.getTime();
}
function controlCore(control: CommercialCohortPrivacyControlResult): Omit<CommercialCohortPrivacyControlResult, "controlDigest"> {
  const { controlDigest: _digest, ...core } = control;
  return core;
}
function receiptCore(receipt: CommercialCohortPrivacyReceipt): CommercialCohortPrivacyReceiptCore {
  const { controls: _controls, signatures: _signatures, privacyReceiptDigest: _digest, ...core } = receipt;
  return core;
}

export function commercialCohortPrivacySignaturePayload(coreDigest: string) {
  return {
    schemaVersion: "velmere.privacy-abuse-audit-signature-payload.v1" as const,
    policyVersion: PASS4817_PRIVACY_POLICY_ID,
    coreDigest: requiredDigest(coreDigest, "privacy_core_digest_invalid"),
  };
}

function validateControl(control: CommercialCohortPrivacyControlResult): string[] {
  const blockers: string[] = [];
  try {
    if (control.schemaVersion !== PASS4817_PRIVACY_CONTROL_SCHEMA || control.policyVersion !== PASS4817_PRIVACY_POLICY_ID) throw new Error(`privacy_control_schema_invalid:${control.control}`);
    if (!(PASS4817_REQUIRED_PRIVACY_CONTROLS as readonly string[]).includes(control.control)) throw new Error("privacy_control_unknown");
    if (control.evidenceClass !== "staging_real_privacy_abuse_test" || control.environment !== "staging") blockers.push(`privacy_non_real_evidence:${control.control}`);
    requiredId(control.controlId, `privacy_control_id_invalid:${control.control}`);
    requiredId(control.audience, `privacy_audience_invalid:${control.control}`);
    requiredId(control.testedDeploymentId, `privacy_deployment_id_invalid:${control.control}`);
    for (const [label, digest] of Object.entries({
      testedDeploymentReceiptDigest: control.testedDeploymentReceiptDigest,
      stagingReceiptDigest: control.stagingReceiptDigest,
      chaosReceiptDigest: control.chaosReceiptDigest,
      observabilityReceiptDigest: control.observabilityReceiptDigest,
      buildArtifactDigest: control.buildArtifactDigest,
      sourcePackageDigest: control.sourcePackageDigest,
      runtimeVersionRoot: control.runtimeVersionRoot,
      providerConfigRoot: control.providerConfigRoot,
      modelConfigRoot: control.modelConfigRoot,
      supplyChainProvenanceDigest: control.supplyChainProvenanceDigest,
      policySnapshotDigest: control.policySnapshotDigest,
      dataClassificationDigest: control.dataClassificationDigest,
      retentionScheduleDigest: control.retentionScheduleDigest,
      redactionPolicyDigest: control.redactionPolicyDigest,
      rateLimitPolicyDigest: control.rateLimitPolicyDigest,
      auditLogPolicyDigest: control.auditLogPolicyDigest,
      queryDigest: control.queryDigest,
      traceRoot: control.traceRoot,
      runbookDigest: control.runbookDigest,
      operatorIdDigest: control.operatorIdDigest,
    })) requiredDigest(digest, `privacy_digest_invalid:${control.control}:${label}`);
    integer(control.stagingSequence, 1, Number.MAX_SAFE_INTEGER, `privacy_staging_sequence_invalid:${control.control}`);
    integer(control.chaosSequence, 1, Number.MAX_SAFE_INTEGER, `privacy_chaos_sequence_invalid:${control.control}`);
    integer(control.observabilitySequence, 1, Number.MAX_SAFE_INTEGER, `privacy_observability_sequence_invalid:${control.control}`);
    const startedAt = parseDate(control.testStartedAt, `privacy_test_started_invalid:${control.control}`);
    const completedAt = parseDate(control.testCompletedAt, `privacy_test_completed_invalid:${control.control}`);
    const duration = completedAt.getTime() - startedAt.getTime();
    if (duration < MIN_TEST_DURATION_MS || duration > MAX_TEST_DURATION_MS) blockers.push(`privacy_test_duration_invalid:${control.control}:${duration}`);
    const policy = PASS4817_PRIVACY_CONTROL_POLICY[control.control];
    const metrics = control.metrics;
    const subjects = integer(metrics.subjectCount, 1, Number.MAX_SAFE_INTEGER, `privacy_subject_count_invalid:${control.control}`);
    const attempts = integer(metrics.attemptCount, 1, Number.MAX_SAFE_INTEGER, `privacy_attempt_count_invalid:${control.control}`);
    const expectedAllowed = integer(metrics.expectedAllowedCount, 0, attempts, `privacy_expected_allowed_invalid:${control.control}`);
    const actualAllowed = integer(metrics.actualAllowedCount, 0, attempts, `privacy_actual_allowed_invalid:${control.control}`);
    const expectedDenied = integer(metrics.expectedDeniedCount, 0, attempts, `privacy_expected_denied_invalid:${control.control}`);
    const actualDenied = integer(metrics.actualDeniedCount, 0, attempts, `privacy_actual_denied_invalid:${control.control}`);
    if (expectedAllowed + expectedDenied !== attempts || actualAllowed + actualDenied !== attempts) blockers.push(`privacy_attempt_accounting_invalid:${control.control}`);
    if (expectedAllowed !== actualAllowed || expectedDenied !== actualDenied) blockers.push(`privacy_decision_mismatch:${control.control}`);
    if (subjects < policy.minSubjects) blockers.push(`privacy_subject_floor:${control.control}:${subjects}/${policy.minSubjects}`);
    if (attempts < policy.minAttempts) blockers.push(`privacy_attempt_floor:${control.control}:${attempts}/${policy.minAttempts}`);
    if (expectedDenied < policy.minDenied) blockers.push(`privacy_denied_floor:${control.control}:${expectedDenied}/${policy.minDenied}`);
    if (expectedAllowed < policy.minAllowed) blockers.push(`privacy_allowed_floor:${control.control}:${expectedAllowed}/${policy.minAllowed}`);
    for (const [field, value] of Object.entries({
      crossTenantLeakCount: metrics.crossTenantLeakCount,
      unauthorizedPrivilegedActionCount: metrics.unauthorizedPrivilegedActionCount,
      rawSecretLeakCount: metrics.rawSecretLeakCount,
      directIdentifierLeakCount: metrics.directIdentifierLeakCount,
      retentionViolationCount: metrics.retentionViolationCount,
      deletionResidualCount: metrics.deletionResidualCount,
      exportMismatchCount: metrics.exportMismatchCount,
      legalHoldBypassCount: metrics.legalHoldBypassCount,
      rateLimitBypassCount: metrics.rateLimitBypassCount,
      replayAcceptedCount: metrics.replayAcceptedCount,
      auditGapCount: metrics.auditGapCount,
      auditChainBreakCount: metrics.auditChainBreakCount,
    })) {
      if (integer(value, 0, Number.MAX_SAFE_INTEGER, `privacy_metric_invalid:${control.control}:${field}`) !== 0) blockers.push(`privacy_zero_tolerance_failed:${control.control}:${field}`);
    }
    const evidence = (control.evidenceDigests ?? []).map((item) => requiredDigest(item, `privacy_evidence_digest_invalid:${control.control}`));
    if (evidence.length < 3 || evidence.length > 32 || new Set(evidence).size !== evidence.length) blockers.push(`privacy_evidence_set_invalid:${control.control}`);
    if (control.controlDigest !== sha256Digest(canonicalJson(controlCore(control)))) blockers.push(`privacy_control_digest_invalid:${control.control}`);
  } catch (error) {
    blockers.push(error instanceof Error ? error.message : "privacy_control_validation_failed");
  }
  return uniqueSorted(blockers);
}


export function buildCommercialCohortPrivacyControlResult(args: Omit<CommercialCohortPrivacyControlResult, "schemaVersion" | "policyVersion" | "controlDigest">): CommercialCohortPrivacyControlResult {
  const core = {
    schemaVersion: PASS4817_PRIVACY_CONTROL_SCHEMA,
    policyVersion: PASS4817_PRIVACY_POLICY_ID,
    ...args,
  } as Omit<CommercialCohortPrivacyControlResult, "controlDigest">;
  const result = { ...core, controlDigest: sha256Digest(canonicalJson(core)) } as CommercialCohortPrivacyControlResult;
  const blockers = validateControl(result);
  if (blockers.length) throw new Error(blockers.join("|"));
  return result;
}

export function prepareCommercialCohortPrivacyReceipt(args: {
  promotionTarget: "staging" | "production";
  audience: string;
  privacySequence: number;
  previousReceipt?: CommercialCohortPrivacyReceipt | null;
  testedDeployment: CommercialCohortDeploymentReceipt;
  stagingReceipt: CommercialCohortStagingE2EReceipt;
  chaosReceipt: CommercialCohortChaosReceipt;
  observabilityReceipt: CommercialCohortObservabilityReceipt;
  trustBundle: CommercialCohortTrustBundle;
  controls: CommercialCohortPrivacyControlResult[];
  dataClassificationRoot: string;
  minimizationPolicyRoot: string;
  retentionPolicyRoot: string;
  abusePolicyRoot: string;
  auditPolicyRoot: string;
  redactionPolicyRoot: string;
  issuedAt?: Date;
  expiresAt: Date;
  runIdDigest: string;
  nonce: string;
}): CommercialCohortPrivacyPreparation {
  const issuedAt = args.issuedAt ?? new Date();
  const controls = [...args.controls].sort((a, b) => a.control.localeCompare(b.control));
  const names = controls.map((item) => item.control);
  if (controls.length !== PASS4817_REQUIRED_PRIVACY_CONTROLS.length || new Set(names).size !== names.length || PASS4817_REQUIRED_PRIVACY_CONTROLS.some((item) => !names.includes(item))) throw new Error("privacy_control_set_invalid");
  const controlBlockers = controls.flatMap(validateControl);
  if (controlBlockers.length) throw new Error(`privacy_control_validation_failed:${controlBlockers.join("|")}`);
  if (args.privacySequence !== (args.previousReceipt?.privacySequence ?? 0) + 1) throw new Error("privacy_sequence_invalid");
  if (args.expiresAt.getTime() <= issuedAt.getTime() || args.expiresAt.getTime() - issuedAt.getTime() > MAX_RECEIPT_LIFETIME_MS) throw new Error("privacy_receipt_lifetime_invalid");
  const testStartedAt = controls.reduce((min, item) => Date.parse(item.testStartedAt) < Date.parse(min) ? item.testStartedAt : min, controls[0]!.testStartedAt);
  const testCompletedAt = controls.reduce((max, item) => Date.parse(item.testCompletedAt) > Date.parse(max) ? item.testCompletedAt : max, controls[0]!.testCompletedAt);
  if (issuedAt.getTime() - Date.parse(testCompletedAt) > MAX_TEST_TO_RECEIPT_DELAY_MS) throw new Error("privacy_receipt_too_late_after_test");
  if (Date.parse(testStartedAt) < Date.parse(args.observabilityReceipt.windowCompletedAt) - CLOCK_SKEW_MS) throw new Error("privacy_test_started_before_observability_completion");
  const controlDigests = controls.map((item) => item.controlDigest);
  const core: CommercialCohortPrivacyReceiptCore = {
    schemaVersion: PASS4817_PRIVACY_RECEIPT_SCHEMA,
    policyVersion: PASS4817_PRIVACY_POLICY_ID,
    testedEnvironment: "staging",
    promotionTarget: args.promotionTarget,
    audience: requiredId(args.audience, "privacy_audience_invalid"),
    privacySequence: integer(args.privacySequence, 1, Number.MAX_SAFE_INTEGER, "privacy_sequence_invalid"),
    previousPrivacyReceiptDigest: args.previousReceipt?.privacyReceiptDigest ?? null,
    testedDeploymentId: requiredId(args.observabilityReceipt.testedDeploymentId, "privacy_tested_deployment_id_invalid"),
    testedDeploymentReceiptDigest: requiredDigest(args.observabilityReceipt.testedDeploymentReceiptDigest, "privacy_tested_deployment_digest_invalid"),
    stagingSequence: args.stagingReceipt.stagingSequence,
    stagingReceiptDigest: args.stagingReceipt.stagingReceiptDigest,
    chaosSequence: args.chaosReceipt.chaosSequence,
    chaosReceiptDigest: args.chaosReceipt.chaosReceiptDigest,
    observabilitySequence: args.observabilityReceipt.observabilitySequence,
    observabilityReceiptDigest: args.observabilityReceipt.observabilityReceiptDigest,
    buildArtifactDigest: args.testedDeployment.buildArtifactDigest,
    sourcePackageDigest: args.testedDeployment.sourcePackageDigest,
    runtimeVersionRoot: args.testedDeployment.runtimeVersionRoot,
    providerConfigRoot: args.testedDeployment.providerConfigRoot,
    modelConfigRoot: args.testedDeployment.modelConfigRoot,
    supplyChainProvenanceDigest: args.testedDeployment.supplyChainProvenanceDigest,
    trustEpoch: args.trustBundle.epoch,
    trustBundleDigest: args.trustBundle.bundleDigest,
    controlDigests,
    controlRoot: sha256Digest(canonicalJson(controlDigests)),
    dataClassificationRoot: requiredDigest(args.dataClassificationRoot, "privacy_data_classification_root_invalid"),
    minimizationPolicyRoot: requiredDigest(args.minimizationPolicyRoot, "privacy_minimization_root_invalid"),
    retentionPolicyRoot: requiredDigest(args.retentionPolicyRoot, "privacy_retention_root_invalid"),
    abusePolicyRoot: requiredDigest(args.abusePolicyRoot, "privacy_abuse_root_invalid"),
    auditPolicyRoot: requiredDigest(args.auditPolicyRoot, "privacy_audit_root_invalid"),
    redactionPolicyRoot: requiredDigest(args.redactionPolicyRoot, "privacy_redaction_root_invalid"),
    controlCount: controls.length,
    testStartedAt,
    testCompletedAt,
    issuedAt: issuedAt.toISOString(),
    expiresAt: args.expiresAt.toISOString(),
    runIdDigest: requiredDigest(args.runIdDigest, "privacy_run_id_invalid"),
    nonce: requiredId(args.nonce, "privacy_nonce_invalid"),
  };
  for (const control of controls) {
    if (control.audience !== core.audience || control.testedDeploymentId !== core.testedDeploymentId || control.testedDeploymentReceiptDigest !== core.testedDeploymentReceiptDigest) throw new Error(`privacy_control_deployment_binding_invalid:${control.control}`);
    if (control.stagingSequence !== core.stagingSequence || control.stagingReceiptDigest !== core.stagingReceiptDigest || control.chaosSequence !== core.chaosSequence || control.chaosReceiptDigest !== core.chaosReceiptDigest || control.observabilitySequence !== core.observabilitySequence || control.observabilityReceiptDigest !== core.observabilityReceiptDigest) throw new Error(`privacy_control_prior_receipt_binding_invalid:${control.control}`);
    if (control.buildArtifactDigest !== core.buildArtifactDigest || control.sourcePackageDigest !== core.sourcePackageDigest || control.runtimeVersionRoot !== core.runtimeVersionRoot || control.providerConfigRoot !== core.providerConfigRoot || control.modelConfigRoot !== core.modelConfigRoot || control.supplyChainProvenanceDigest !== core.supplyChainProvenanceDigest) throw new Error(`privacy_control_release_binding_invalid:${control.control}`);
  }
  const coreDigest = sha256Digest(canonicalJson(core));
  return { core, controls, coreDigest, signaturePayload: commercialCohortPrivacySignaturePayload(coreDigest) };
}

export function finalizeCommercialCohortPrivacyReceipt(args: {
  preparation: CommercialCohortPrivacyPreparation;
  signatures?: CommercialCohortDetachedSignature[];
  signers?: CommercialCohortPrivateSigner[];
}): CommercialCohortPrivacyReceipt {
  const signatures = args.signatures ?? (args.signers ?? []).map((signer) => ({ keyId: signer.keyId, signature: signPayload(signer.privateKeyPem, args.preparation.signaturePayload) }));
  const normalized = signatures.map((item) => ({ keyId: requiredId(item.keyId, "privacy_signature_key_invalid"), signature: clean(item.signature, 256).replace(/=+$/g, "") })).sort((a, b) => a.keyId.localeCompare(b.keyId));
  const receiptWithoutDigest = { ...args.preparation.core, controls: args.preparation.controls, signatures: normalized };
  return { ...receiptWithoutDigest, privacyReceiptDigest: sha256Digest(canonicalJson(receiptWithoutDigest)) };
}


export function signCommercialCohortPrivacyReceipt(args: {
  preparation: CommercialCohortPrivacyPreparation;
  signers: CommercialCohortPrivateSigner[];
}): CommercialCohortPrivacyReceipt {
  return finalizeCommercialCohortPrivacyReceipt({ preparation: args.preparation, signers: args.signers });
}

function verifySingleReceipt(args: {
  receipt: CommercialCohortPrivacyReceipt;
  previousReceipt: CommercialCohortPrivacyReceipt | null;
  trustBundle: CommercialCohortTrustBundle;
  observabilityReceipt: CommercialCohortObservabilityReceipt;
  current: boolean;
  now: Date;
}): string[] {
  const blockers: string[] = [];
  try {
    const core = receiptCore(args.receipt);
    if (core.schemaVersion !== PASS4817_PRIVACY_RECEIPT_SCHEMA || core.policyVersion !== PASS4817_PRIVACY_POLICY_ID) throw new Error("privacy_receipt_schema_invalid");
    if (core.privacySequence !== (args.previousReceipt?.privacySequence ?? 0) + 1) blockers.push(`privacy_sequence_gap:${core.privacySequence}`);
    if (core.previousPrivacyReceiptDigest !== (args.previousReceipt?.privacyReceiptDigest ?? null)) blockers.push(`privacy_previous_digest_invalid:${core.privacySequence}`);
    const controls = [...(args.receipt.controls ?? [])].sort((a, b) => a.control.localeCompare(b.control));
    const names = controls.map((item) => item.control);
    if (controls.length !== PASS4817_REQUIRED_PRIVACY_CONTROLS.length || new Set(names).size !== names.length || PASS4817_REQUIRED_PRIVACY_CONTROLS.some((item) => !names.includes(item))) blockers.push("privacy_control_set_invalid");
    blockers.push(...controls.flatMap(validateControl));
    const digests = controls.map((item) => item.controlDigest);
    if (canonicalJson(digests) !== canonicalJson(core.controlDigests) || core.controlRoot !== sha256Digest(canonicalJson(digests))) blockers.push("privacy_control_root_invalid");
    if (core.controlCount !== controls.length) blockers.push("privacy_control_count_invalid");
    for (const control of controls) {
      if (control.audience !== core.audience || control.testedDeploymentId !== core.testedDeploymentId || control.testedDeploymentReceiptDigest !== core.testedDeploymentReceiptDigest) blockers.push(`privacy_control_deployment_binding_invalid:${control.control}`);
      if (control.stagingSequence !== core.stagingSequence || control.stagingReceiptDigest !== core.stagingReceiptDigest || control.chaosSequence !== core.chaosSequence || control.chaosReceiptDigest !== core.chaosReceiptDigest || control.observabilitySequence !== core.observabilitySequence || control.observabilityReceiptDigest !== core.observabilityReceiptDigest) blockers.push(`privacy_control_prior_receipt_binding_invalid:${control.control}`);
      if (control.buildArtifactDigest !== core.buildArtifactDigest || control.sourcePackageDigest !== core.sourcePackageDigest || control.runtimeVersionRoot !== core.runtimeVersionRoot || control.providerConfigRoot !== core.providerConfigRoot || control.modelConfigRoot !== core.modelConfigRoot || control.supplyChainProvenanceDigest !== core.supplyChainProvenanceDigest) blockers.push(`privacy_control_release_binding_invalid:${control.control}`);
    }
    if (core.observabilitySequence !== args.observabilityReceipt.observabilitySequence || core.observabilityReceiptDigest !== args.observabilityReceipt.observabilityReceiptDigest) blockers.push("privacy_observability_binding_invalid");
    const issuedAt = parseDate(core.issuedAt, "privacy_issued_at_invalid");
    const expiresAt = parseDate(core.expiresAt, "privacy_expires_at_invalid");
    if (expiresAt.getTime() <= issuedAt.getTime() || expiresAt.getTime() - issuedAt.getTime() > MAX_RECEIPT_LIFETIME_MS) blockers.push("privacy_receipt_lifetime_invalid");
    if (Date.parse(core.testStartedAt) < Date.parse(args.observabilityReceipt.windowCompletedAt) - CLOCK_SKEW_MS) blockers.push("privacy_test_started_before_observability_completion");
    if (issuedAt.getTime() - Date.parse(core.testCompletedAt) > MAX_TEST_TO_RECEIPT_DELAY_MS) blockers.push("privacy_receipt_too_late_after_test");
    if (args.current) {
      if (args.now.getTime() + CLOCK_SKEW_MS < issuedAt.getTime()) blockers.push("privacy_receipt_not_active");
      if (args.now.getTime() >= expiresAt.getTime()) blockers.push("privacy_receipt_expired");
    }
    const coreDigest = sha256Digest(canonicalJson(core));
    const keys = new Map(args.trustBundle.keys.map((item) => [item.keyId, item]));
    const seen = new Set<string>();
    let valid = 0;
    let active = 0;
    for (const signature of args.receipt.signatures ?? []) {
      const keyId = requiredId(signature.keyId, "privacy_signature_key_invalid");
      if (seen.has(keyId)) { blockers.push(`privacy_signature_duplicate:${keyId}`); continue; }
      seen.add(keyId);
      const key = keys.get(keyId);
      if (!key || !keyUsableAt(key, issuedAt)) { blockers.push(`privacy_signer_invalid:${keyId}`); continue; }
      if (!verifyPayload(key.publicKeyPem, commercialCohortPrivacySignaturePayload(coreDigest), signature.signature)) blockers.push(`privacy_signature_invalid:${keyId}`);
      else { valid += 1; if (key.status === "active") active += 1; }
    }
    if (valid < args.trustBundle.releaseSignatureThreshold) blockers.push(`privacy_signature_threshold:${valid}/${args.trustBundle.releaseSignatureThreshold}`);
    if (active < 1) blockers.push("privacy_active_signer_missing");
    const normalizedSignatures = (args.receipt.signatures ?? []).map((item) => ({ keyId: item.keyId, signature: item.signature })).sort((a, b) => a.keyId.localeCompare(b.keyId));
    const expectedDigest = sha256Digest(canonicalJson({ ...core, controls, signatures: normalizedSignatures }));
    if (args.receipt.privacyReceiptDigest !== expectedDigest) blockers.push("privacy_receipt_digest_invalid");
  } catch (error) {
    blockers.push(error instanceof Error ? error.message : "privacy_receipt_validation_failed");
  }
  return uniqueSorted(blockers);
}

export function verifyCommercialCohortPrivacyReceiptChain(args: {
  receipts: CommercialCohortPrivacyReceipt[];
  trustBundles: CommercialCohortTrustBundle[];
  expectedAudience: string;
  expectedPromotionTarget: "staging" | "production";
  currentDeploymentReceipt: CommercialCohortDeploymentReceipt;
  currentStagingReceipt: CommercialCohortStagingE2EReceipt;
  currentChaosReceipt: CommercialCohortChaosReceipt;
  currentObservabilityReceipt: CommercialCohortObservabilityReceipt;
  minimumPrivacySequence: number;
  now?: Date;
}): CommercialCohortPrivacyVerification {
  const blockers: string[] = [];
  let current: CommercialCohortPrivacyReceipt | null = null;
  try {
    if (!Array.isArray(args.receipts) || args.receipts.length < 1 || args.receipts.length > 1024) throw new Error("privacy_receipt_chain_invalid");
    if (!Array.isArray(args.trustBundles) || !args.trustBundles.length) throw new Error("privacy_trust_chain_missing");
    const minimum = integer(args.minimumPrivacySequence, 1, Number.MAX_SAFE_INTEGER, "privacy_minimum_sequence_invalid");
    const now = args.now ?? new Date();
    const digests = new Set<string>();
    const nonces = new Set<string>();
    const roots = new Set<string>();
    const runIds = new Set<string>();
    for (let index = 0; index < args.receipts.length; index += 1) {
      const receipt = args.receipts[index]!;
      if (receipt.privacySequence !== index + 1) blockers.push(`privacy_sequence_gap:${receipt.privacySequence}/${index + 1}`);
      if (digests.has(receipt.privacyReceiptDigest)) blockers.push(`privacy_digest_reused:${receipt.privacySequence}`);
      if (nonces.has(receipt.nonce)) blockers.push(`privacy_nonce_reused:${receipt.privacySequence}`);
      if (roots.has(receipt.controlRoot)) blockers.push(`privacy_control_root_reused:${receipt.privacySequence}`);
      if (runIds.has(receipt.runIdDigest)) blockers.push(`privacy_run_id_reused:${receipt.privacySequence}`);
      digests.add(receipt.privacyReceiptDigest); nonces.add(receipt.nonce); roots.add(receipt.controlRoot); runIds.add(receipt.runIdDigest);
      const trustBundle = args.trustBundles.find((item) => item.epoch === receipt.trustEpoch && item.bundleDigest === receipt.trustBundleDigest) ?? null;
      if (!trustBundle) blockers.push(`privacy_trust_bundle_missing:${receipt.privacySequence}`);
      else blockers.push(...verifySingleReceipt({ receipt, previousReceipt: index > 0 ? args.receipts[index - 1]! : null, trustBundle, observabilityReceipt: args.currentObservabilityReceipt, current: index === args.receipts.length - 1, now }));
      current = receipt;
    }
    if (!current) throw new Error("privacy_current_receipt_missing");
    if (current.privacySequence < minimum) blockers.push(`privacy_rollback_floor:${current.privacySequence}/${minimum}`);
    if (current.audience !== args.expectedAudience || current.promotionTarget !== args.expectedPromotionTarget) blockers.push("privacy_identity_mismatch");
    if (current.stagingSequence !== args.currentStagingReceipt.stagingSequence || current.stagingReceiptDigest !== args.currentStagingReceipt.stagingReceiptDigest) blockers.push("privacy_current_staging_mismatch");
    if (current.chaosSequence !== args.currentChaosReceipt.chaosSequence || current.chaosReceiptDigest !== args.currentChaosReceipt.chaosReceiptDigest) blockers.push("privacy_current_chaos_mismatch");
    if (current.observabilitySequence !== args.currentObservabilityReceipt.observabilitySequence || current.observabilityReceiptDigest !== args.currentObservabilityReceipt.observabilityReceiptDigest) blockers.push("privacy_current_observability_mismatch");
    if (current.buildArtifactDigest !== args.currentDeploymentReceipt.buildArtifactDigest || current.sourcePackageDigest !== args.currentDeploymentReceipt.sourcePackageDigest || current.runtimeVersionRoot !== args.currentDeploymentReceipt.runtimeVersionRoot || current.providerConfigRoot !== args.currentDeploymentReceipt.providerConfigRoot || current.modelConfigRoot !== args.currentDeploymentReceipt.modelConfigRoot || current.supplyChainProvenanceDigest !== args.currentDeploymentReceipt.supplyChainProvenanceDigest) blockers.push("privacy_current_release_binding_mismatch");
  } catch (error) {
    blockers.push(error instanceof Error ? error.message : "privacy_chain_validation_failed");
  }
  const uniqueBlockers = uniqueSorted(blockers);
  const privacyVerified = uniqueBlockers.length === 0 && Boolean(current);
  const controls = current?.controls ?? [];
  const tenantIsolationVerified = privacyVerified && controls.filter((item) => item.control.startsWith("tenant_")).every((item) => item.metrics.crossTenantLeakCount === 0 && item.metrics.unauthorizedPrivilegedActionCount === 0);
  const dataLifecycleVerified = privacyVerified && controls.filter((item) => ["checkout_data_minimization", "provider_capture_data_minimization", "log_and_trace_redaction", "retention_expiry_enforcement", "deletion_request_completion", "export_request_integrity", "legal_hold_scope_enforcement"].includes(item.control)).every((item) => validateControl(item).length === 0);
  const abuseResistanceVerified = privacyVerified && controls.filter((item) => ["purchase_rate_limit", "download_rate_limit", "webhook_replay_abuse"].includes(item.control)).every((item) => item.metrics.rateLimitBypassCount === 0 && item.metrics.replayAcceptedCount === 0);
  const auditTrailVerified = privacyVerified && controls.filter((item) => ["privileged_action_audit", "audit_log_tamper_evidence"].includes(item.control)).every((item) => item.metrics.auditGapCount === 0 && item.metrics.auditChainBreakCount === 0 && item.metrics.unauthorizedPrivilegedActionCount === 0);
  const privacyRollbackProtected = privacyVerified && Boolean(current && current.privacySequence >= args.minimumPrivacySequence);
  return {
    verified: privacyVerified && tenantIsolationVerified && dataLifecycleVerified && abuseResistanceVerified && auditTrailVerified && privacyRollbackProtected,
    privacyVerified,
    tenantIsolationVerified,
    dataLifecycleVerified,
    abuseResistanceVerified,
    auditTrailVerified,
    privacyRollbackProtected,
    privacySequence: current?.privacySequence ?? null,
    privacyReceiptDigest: current?.privacyReceiptDigest ?? null,
    controlCount: current?.controlCount ?? 0,
    blockers: uniqueBlockers,
  };
}
