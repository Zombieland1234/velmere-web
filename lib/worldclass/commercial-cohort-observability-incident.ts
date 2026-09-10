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
import type {
  CommercialCohortDetachedSignature,
  CommercialCohortPrivateSigner,
  CommercialCohortTrustBundle,
  CommercialCohortTrustKey,
} from "@/lib/worldclass/commercial-cohort-public-checkpoint";

export const PASS4816_OBSERVABILITY_POLICY_ID = "pass4816-observability-incident-degradation-v1" as const;
export const PASS4816_SLO_WINDOW_SCHEMA = "velmere.observability-slo-window.v1" as const;
export const PASS4816_OBSERVABILITY_RECEIPT_SCHEMA = "velmere.observability-incident-receipt.v1" as const;

const DIGEST = /^sha256:[a-f0-9]{64}$/;
const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9._:/-]{5,191}$/;
const CLOCK_SKEW_MS = 60_000;
const MIN_WINDOW_MS = 6 * 60 * 60 * 1_000;
const MAX_WINDOW_MS = 24 * 60 * 60 * 1_000;
const MAX_WINDOW_TO_RECEIPT_DELAY_MS = 60 * 60 * 1_000;
const MAX_RECEIPT_LIFETIME_MS = 12 * 60 * 60 * 1_000;
const RATE_EPSILON = 0.000001;

export const PASS4816_REQUIRED_SLO_OBJECTIVES = [
  "stripe_webhook_processing",
  "supabase_ledger_transactions",
  "entitlement_lifecycle",
  "audit_pro_pipeline",
  "audit_advanced_review",
  "pdf_secure_delivery",
  "audit_provider_quorum",
  "shield_provider_freshness",
  "real_markets_provider_freshness",
  "queue_worker_health",
  "customer_account_delivery",
  "incident_response_control_plane",
] as const;

export type CommercialCohortSloObjectiveName = typeof PASS4816_REQUIRED_SLO_OBJECTIVES[number];
export type CommercialCohortDegradationAction =
  | "block_paid_purchase"
  | "block_paid_delivery"
  | "manual_review_only"
  | "last_known_good_with_stale_disclosure"
  | "disable_probabilistic_claims"
  | "read_only_account_access";

export type CommercialCohortSloMetrics = {
  sampleCount: number;
  successCount: number;
  errorCount: number;
  availabilityRate: number;
  p95LatencyMs: number;
  p99LatencyMs: number;
  freshnessP95Ms: number;
  queueAgeP95Ms: number;
  errorBudgetConsumedRatio: number;
  burnRate1h: number;
  burnRate6h: number;
  telemetryCoverageRate: number;
  traceCoverageRate: number;
  missingTelemetryIntervals: number;
  unresolvedSev1Count: number;
  unresolvedSev2Count: number;
  mutedCriticalAlertCount: number;
};

export type CommercialCohortSloWindow = {
  schemaVersion: typeof PASS4816_SLO_WINDOW_SCHEMA;
  policyVersion: typeof PASS4816_OBSERVABILITY_POLICY_ID;
  windowId: string;
  objective: CommercialCohortSloObjectiveName;
  evidenceClass: "staging_real_observation";
  environment: "staging";
  audience: string;
  testedDeploymentId: string;
  testedDeploymentReceiptDigest: string;
  stagingSequence: number;
  stagingReceiptDigest: string;
  chaosSequence: number;
  chaosReceiptDigest: string;
  buildArtifactDigest: string;
  sourcePackageDigest: string;
  runtimeVersionRoot: string;
  providerConfigRoot: string;
  modelConfigRoot: string;
  supplyChainProvenanceDigest: string;
  windowStartedAt: string;
  windowEndedAt: string;
  alertProbeFiredAt: string;
  alertAcknowledgedAt: string;
  alertEscalatedAt: string;
  alertRouteVerified: true;
  degradationAction: CommercialCohortDegradationAction;
  degradationExerciseVerified: true;
  customerDisclosureVerified: true;
  metrics: CommercialCohortSloMetrics;
  evidenceDigests: string[];
  telemetryQueryDigest: string;
  traceRoot: string;
  alertRouteDigest: string;
  runbookDigest: string;
  onCallOwnerDigest: string;
  degradationReceiptDigest: string;
  windowDigest: string;
};

export type CommercialCohortObservabilityReceiptCore = {
  schemaVersion: typeof PASS4816_OBSERVABILITY_RECEIPT_SCHEMA;
  policyVersion: typeof PASS4816_OBSERVABILITY_POLICY_ID;
  testedEnvironment: "staging";
  promotionTarget: "staging" | "production";
  audience: string;
  observabilitySequence: number;
  previousObservabilityReceiptDigest: string | null;
  testedDeploymentId: string;
  testedDeploymentReceiptDigest: string;
  stagingSequence: number;
  stagingReceiptDigest: string;
  chaosSequence: number;
  chaosReceiptDigest: string;
  buildArtifactDigest: string;
  sourcePackageDigest: string;
  runtimeVersionRoot: string;
  providerConfigRoot: string;
  modelConfigRoot: string;
  supplyChainProvenanceDigest: string;
  trustEpoch: number;
  trustBundleDigest: string;
  objectiveDigests: string[];
  objectiveRoot: string;
  sloPolicyRoot: string;
  incidentResponseRoot: string;
  degradationPlanRoot: string;
  objectiveCount: number;
  windowStartedAt: string;
  windowCompletedAt: string;
  issuedAt: string;
  expiresAt: string;
  runIdDigest: string;
  nonce: string;
};

export type CommercialCohortObservabilityReceipt = CommercialCohortObservabilityReceiptCore & {
  windows: CommercialCohortSloWindow[];
  signatures: CommercialCohortDetachedSignature[];
  observabilityReceiptDigest: string;
};

export type CommercialCohortObservabilityPreparation = {
  core: CommercialCohortObservabilityReceiptCore;
  windows: CommercialCohortSloWindow[];
  coreDigest: string;
  signaturePayload: ReturnType<typeof commercialCohortObservabilitySignaturePayload>;
};

export type CommercialCohortObservabilityVerification = {
  verified: boolean;
  observabilityVerified: boolean;
  telemetryBound: boolean;
  sloVerified: boolean;
  incidentResponseVerified: boolean;
  safeDegradationVerified: boolean;
  observabilityRollbackProtected: boolean;
  observabilitySequence: number | null;
  observabilityReceiptDigest: string | null;
  objectiveCount: number;
  blockers: string[];
};

type SloPolicy = {
  minSamples: number;
  minAvailability: number;
  maxP95LatencyMs: number;
  maxP99LatencyMs: number;
  maxFreshnessP95Ms: number;
  maxQueueAgeP95Ms: number;
  maxErrorBudgetConsumedRatio: number;
  maxBurnRate1h: number;
  maxBurnRate6h: number;
  maxAckMs: number;
  maxEscalationMs: number;
  degradationAction: CommercialCohortDegradationAction;
};

export const PASS4816_SLO_POLICY: Record<CommercialCohortSloObjectiveName, SloPolicy> = {
  stripe_webhook_processing: { minSamples: 500, minAvailability: 0.999, maxP95LatencyMs: 2_000, maxP99LatencyMs: 5_000, maxFreshnessP95Ms: 60_000, maxQueueAgeP95Ms: 60_000, maxErrorBudgetConsumedRatio: 0.5, maxBurnRate1h: 2, maxBurnRate6h: 1, maxAckMs: 300_000, maxEscalationMs: 900_000, degradationAction: "block_paid_purchase" },
  supabase_ledger_transactions: { minSamples: 500, minAvailability: 0.999, maxP95LatencyMs: 1_500, maxP99LatencyMs: 4_000, maxFreshnessP95Ms: 60_000, maxQueueAgeP95Ms: 60_000, maxErrorBudgetConsumedRatio: 0.5, maxBurnRate1h: 2, maxBurnRate6h: 1, maxAckMs: 300_000, maxEscalationMs: 900_000, degradationAction: "block_paid_purchase" },
  entitlement_lifecycle: { minSamples: 200, minAvailability: 0.995, maxP95LatencyMs: 5_000, maxP99LatencyMs: 15_000, maxFreshnessP95Ms: 120_000, maxQueueAgeP95Ms: 120_000, maxErrorBudgetConsumedRatio: 0.5, maxBurnRate1h: 2, maxBurnRate6h: 1, maxAckMs: 300_000, maxEscalationMs: 900_000, degradationAction: "block_paid_delivery" },
  audit_pro_pipeline: { minSamples: 100, minAvailability: 0.99, maxP95LatencyMs: 300_000, maxP99LatencyMs: 900_000, maxFreshnessP95Ms: 300_000, maxQueueAgeP95Ms: 600_000, maxErrorBudgetConsumedRatio: 0.5, maxBurnRate1h: 2, maxBurnRate6h: 1, maxAckMs: 300_000, maxEscalationMs: 900_000, degradationAction: "manual_review_only" },
  audit_advanced_review: { minSamples: 50, minAvailability: 0.99, maxP95LatencyMs: 1_800_000, maxP99LatencyMs: 3_600_000, maxFreshnessP95Ms: 600_000, maxQueueAgeP95Ms: 1_800_000, maxErrorBudgetConsumedRatio: 0.5, maxBurnRate1h: 2, maxBurnRate6h: 1, maxAckMs: 300_000, maxEscalationMs: 900_000, degradationAction: "manual_review_only" },
  pdf_secure_delivery: { minSamples: 150, minAvailability: 0.999, maxP95LatencyMs: 5_000, maxP99LatencyMs: 15_000, maxFreshnessP95Ms: 60_000, maxQueueAgeP95Ms: 120_000, maxErrorBudgetConsumedRatio: 0.25, maxBurnRate1h: 1.5, maxBurnRate6h: 1, maxAckMs: 300_000, maxEscalationMs: 900_000, degradationAction: "block_paid_delivery" },
  audit_provider_quorum: { minSamples: 300, minAvailability: 0.99, maxP95LatencyMs: 10_000, maxP99LatencyMs: 30_000, maxFreshnessP95Ms: 300_000, maxQueueAgeP95Ms: 120_000, maxErrorBudgetConsumedRatio: 0.5, maxBurnRate1h: 2, maxBurnRate6h: 1, maxAckMs: 300_000, maxEscalationMs: 900_000, degradationAction: "manual_review_only" },
  shield_provider_freshness: { minSamples: 1_000, minAvailability: 0.995, maxP95LatencyMs: 5_000, maxP99LatencyMs: 15_000, maxFreshnessP95Ms: 120_000, maxQueueAgeP95Ms: 60_000, maxErrorBudgetConsumedRatio: 0.5, maxBurnRate1h: 2, maxBurnRate6h: 1, maxAckMs: 300_000, maxEscalationMs: 900_000, degradationAction: "last_known_good_with_stale_disclosure" },
  real_markets_provider_freshness: { minSamples: 1_000, minAvailability: 0.995, maxP95LatencyMs: 5_000, maxP99LatencyMs: 15_000, maxFreshnessP95Ms: 300_000, maxQueueAgeP95Ms: 60_000, maxErrorBudgetConsumedRatio: 0.5, maxBurnRate1h: 2, maxBurnRate6h: 1, maxAckMs: 300_000, maxEscalationMs: 900_000, degradationAction: "last_known_good_with_stale_disclosure" },
  queue_worker_health: { minSamples: 500, minAvailability: 0.995, maxP95LatencyMs: 10_000, maxP99LatencyMs: 30_000, maxFreshnessP95Ms: 60_000, maxQueueAgeP95Ms: 300_000, maxErrorBudgetConsumedRatio: 0.5, maxBurnRate1h: 2, maxBurnRate6h: 1, maxAckMs: 300_000, maxEscalationMs: 900_000, degradationAction: "block_paid_delivery" },
  customer_account_delivery: { minSamples: 200, minAvailability: 0.999, maxP95LatencyMs: 3_000, maxP99LatencyMs: 10_000, maxFreshnessP95Ms: 60_000, maxQueueAgeP95Ms: 120_000, maxErrorBudgetConsumedRatio: 0.25, maxBurnRate1h: 1.5, maxBurnRate6h: 1, maxAckMs: 300_000, maxEscalationMs: 900_000, degradationAction: "read_only_account_access" },
  incident_response_control_plane: { minSamples: 50, minAvailability: 0.999, maxP95LatencyMs: 2_000, maxP99LatencyMs: 5_000, maxFreshnessP95Ms: 60_000, maxQueueAgeP95Ms: 60_000, maxErrorBudgetConsumedRatio: 0.25, maxBurnRate1h: 1.5, maxBurnRate6h: 1, maxAckMs: 180_000, maxEscalationMs: 600_000, degradationAction: "disable_probabilistic_claims" },
};

function clean(value: unknown, max = 512): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}
function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean))).sort();
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
  const number = Number(value);
  if (!Number.isInteger(number) || number < min || number > max) throw new Error(code);
  return number;
}
function finite(value: unknown, min: number, max: number, code: string): number {
  const number = Number(value);
  if (!Number.isFinite(number) || number < min || number > max) throw new Error(code);
  return number;
}
function keyUsableAt(key: CommercialCohortTrustKey, at: Date): boolean {
  if (key.purpose !== "release" || key.status === "revoked") return false;
  const notBefore = parseDate(key.notBefore, "observability_key_not_before_invalid");
  const notAfter = parseDate(key.notAfter, "observability_key_not_after_invalid");
  return at.getTime() >= notBefore.getTime() && at.getTime() < notAfter.getTime();
}
function privateKey(value: string): KeyObject {
  const key = createPrivateKey(value);
  if (key.asymmetricKeyType !== "ed25519") throw new Error("observability_private_key_not_ed25519");
  return key;
}
function publicKey(value: string): KeyObject {
  const key = createPublicKey(value);
  if (key.asymmetricKeyType !== "ed25519") throw new Error("observability_public_key_not_ed25519");
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
function windowCore(window: CommercialCohortSloWindow): Omit<CommercialCohortSloWindow, "windowDigest"> {
  const { windowDigest: _windowDigest, ...core } = window;
  return core;
}
function receiptCore(receipt: CommercialCohortObservabilityReceipt): CommercialCohortObservabilityReceiptCore {
  const { windows: _windows, signatures: _signatures, observabilityReceiptDigest: _digest, ...core } = receipt;
  return core;
}
function almostEqual(left: number, right: number): boolean {
  return Math.abs(left - right) <= RATE_EPSILON;
}

function validateWindow(window: CommercialCohortSloWindow): string[] {
  const blockers: string[] = [];
  try {
    if (window.schemaVersion !== PASS4816_SLO_WINDOW_SCHEMA || window.policyVersion !== PASS4816_OBSERVABILITY_POLICY_ID) throw new Error(`observability_window_schema_invalid:${window.objective}`);
    if (!(PASS4816_REQUIRED_SLO_OBJECTIVES as readonly string[]).includes(window.objective)) throw new Error("observability_objective_unknown");
    if (window.evidenceClass !== "staging_real_observation" || window.environment !== "staging") blockers.push(`observability_non_real_evidence:${window.objective}`);
    requiredId(window.windowId, `observability_window_id_invalid:${window.objective}`);
    requiredId(window.audience, `observability_audience_invalid:${window.objective}`);
    requiredId(window.testedDeploymentId, `observability_deployment_id_invalid:${window.objective}`);
    for (const [label, digest] of Object.entries({
      testedDeploymentReceiptDigest: window.testedDeploymentReceiptDigest,
      stagingReceiptDigest: window.stagingReceiptDigest,
      chaosReceiptDigest: window.chaosReceiptDigest,
      buildArtifactDigest: window.buildArtifactDigest,
      sourcePackageDigest: window.sourcePackageDigest,
      runtimeVersionRoot: window.runtimeVersionRoot,
      providerConfigRoot: window.providerConfigRoot,
      modelConfigRoot: window.modelConfigRoot,
      supplyChainProvenanceDigest: window.supplyChainProvenanceDigest,
      telemetryQueryDigest: window.telemetryQueryDigest,
      traceRoot: window.traceRoot,
      alertRouteDigest: window.alertRouteDigest,
      runbookDigest: window.runbookDigest,
      onCallOwnerDigest: window.onCallOwnerDigest,
      degradationReceiptDigest: window.degradationReceiptDigest,
    })) requiredDigest(digest, `observability_digest_invalid:${window.objective}:${label}`);
    integer(window.stagingSequence, 1, Number.MAX_SAFE_INTEGER, `observability_staging_sequence_invalid:${window.objective}`);
    integer(window.chaosSequence, 1, Number.MAX_SAFE_INTEGER, `observability_chaos_sequence_invalid:${window.objective}`);
    const startedAt = parseDate(window.windowStartedAt, `observability_window_started_at_invalid:${window.objective}`);
    const endedAt = parseDate(window.windowEndedAt, `observability_window_ended_at_invalid:${window.objective}`);
    const duration = endedAt.getTime() - startedAt.getTime();
    if (duration < MIN_WINDOW_MS || duration > MAX_WINDOW_MS) blockers.push(`observability_window_duration_invalid:${window.objective}:${duration}`);
    const firedAt = parseDate(window.alertProbeFiredAt, `observability_alert_fired_invalid:${window.objective}`);
    const acknowledgedAt = parseDate(window.alertAcknowledgedAt, `observability_alert_ack_invalid:${window.objective}`);
    const escalatedAt = parseDate(window.alertEscalatedAt, `observability_alert_escalated_invalid:${window.objective}`);
    if (firedAt.getTime() < startedAt.getTime() || escalatedAt.getTime() > endedAt.getTime() + CLOCK_SKEW_MS || acknowledgedAt.getTime() < firedAt.getTime() || escalatedAt.getTime() < acknowledgedAt.getTime()) blockers.push(`observability_alert_timeline_invalid:${window.objective}`);
    const policy = PASS4816_SLO_POLICY[window.objective];
    if (acknowledgedAt.getTime() - firedAt.getTime() > policy.maxAckMs) blockers.push(`observability_ack_slo_exceeded:${window.objective}`);
    if (escalatedAt.getTime() - firedAt.getTime() > policy.maxEscalationMs) blockers.push(`observability_escalation_slo_exceeded:${window.objective}`);
    if (window.alertRouteVerified !== true) blockers.push(`observability_alert_route_unverified:${window.objective}`);
    if (window.degradationExerciseVerified !== true) blockers.push(`observability_degradation_unverified:${window.objective}`);
    if (window.customerDisclosureVerified !== true) blockers.push(`observability_customer_disclosure_unverified:${window.objective}`);
    if (window.degradationAction !== policy.degradationAction) blockers.push(`observability_degradation_action_invalid:${window.objective}`);
    const metrics = window.metrics;
    const samples = integer(metrics.sampleCount, 1, Number.MAX_SAFE_INTEGER, `observability_sample_count_invalid:${window.objective}`);
    const successes = integer(metrics.successCount, 0, samples, `observability_success_count_invalid:${window.objective}`);
    const errors = integer(metrics.errorCount, 0, samples, `observability_error_count_invalid:${window.objective}`);
    if (successes + errors !== samples) blockers.push(`observability_sample_accounting_invalid:${window.objective}`);
    const availability = finite(metrics.availabilityRate, 0, 1, `observability_availability_invalid:${window.objective}`);
    if (!almostEqual(availability, successes / samples)) blockers.push(`observability_availability_not_derived:${window.objective}`);
    if (samples < policy.minSamples) blockers.push(`observability_sample_floor:${window.objective}:${samples}/${policy.minSamples}`);
    if (availability < policy.minAvailability) blockers.push(`observability_availability_slo_failed:${window.objective}`);
    if (finite(metrics.p95LatencyMs, 0, Number.MAX_SAFE_INTEGER, `observability_p95_invalid:${window.objective}`) > policy.maxP95LatencyMs) blockers.push(`observability_p95_slo_failed:${window.objective}`);
    if (finite(metrics.p99LatencyMs, 0, Number.MAX_SAFE_INTEGER, `observability_p99_invalid:${window.objective}`) > policy.maxP99LatencyMs) blockers.push(`observability_p99_slo_failed:${window.objective}`);
    if (metrics.p99LatencyMs < metrics.p95LatencyMs) blockers.push(`observability_latency_quantiles_invalid:${window.objective}`);
    if (finite(metrics.freshnessP95Ms, 0, Number.MAX_SAFE_INTEGER, `observability_freshness_invalid:${window.objective}`) > policy.maxFreshnessP95Ms) blockers.push(`observability_freshness_slo_failed:${window.objective}`);
    if (finite(metrics.queueAgeP95Ms, 0, Number.MAX_SAFE_INTEGER, `observability_queue_age_invalid:${window.objective}`) > policy.maxQueueAgeP95Ms) blockers.push(`observability_queue_age_slo_failed:${window.objective}`);
    if (finite(metrics.errorBudgetConsumedRatio, 0, 100, `observability_error_budget_invalid:${window.objective}`) > policy.maxErrorBudgetConsumedRatio) blockers.push(`observability_error_budget_exceeded:${window.objective}`);
    if (finite(metrics.burnRate1h, 0, 100, `observability_burn_1h_invalid:${window.objective}`) > policy.maxBurnRate1h) blockers.push(`observability_burn_rate_1h_exceeded:${window.objective}`);
    if (finite(metrics.burnRate6h, 0, 100, `observability_burn_6h_invalid:${window.objective}`) > policy.maxBurnRate6h) blockers.push(`observability_burn_rate_6h_exceeded:${window.objective}`);
    if (finite(metrics.telemetryCoverageRate, 0, 1, `observability_telemetry_coverage_invalid:${window.objective}`) < 0.995) blockers.push(`observability_telemetry_coverage_failed:${window.objective}`);
    if (finite(metrics.traceCoverageRate, 0, 1, `observability_trace_coverage_invalid:${window.objective}`) < 0.99) blockers.push(`observability_trace_coverage_failed:${window.objective}`);
    if (integer(metrics.missingTelemetryIntervals, 0, Number.MAX_SAFE_INTEGER, `observability_missing_intervals_invalid:${window.objective}`) !== 0) blockers.push(`observability_missing_telemetry:${window.objective}`);
    if (integer(metrics.unresolvedSev1Count, 0, Number.MAX_SAFE_INTEGER, `observability_sev1_invalid:${window.objective}`) !== 0) blockers.push(`observability_unresolved_sev1:${window.objective}`);
    if (integer(metrics.unresolvedSev2Count, 0, Number.MAX_SAFE_INTEGER, `observability_sev2_invalid:${window.objective}`) !== 0) blockers.push(`observability_unresolved_sev2:${window.objective}`);
    if (integer(metrics.mutedCriticalAlertCount, 0, Number.MAX_SAFE_INTEGER, `observability_muted_alerts_invalid:${window.objective}`) !== 0) blockers.push(`observability_muted_critical_alert:${window.objective}`);
    const evidence = [...(window.evidenceDigests ?? [])].map((item) => requiredDigest(item, `observability_evidence_digest_invalid:${window.objective}`));
    if (evidence.length < 3 || evidence.length > 32 || new Set(evidence).size !== evidence.length) blockers.push(`observability_evidence_set_invalid:${window.objective}`);
    const expectedDigest = sha256Digest(canonicalJson(windowCore(window)));
    if (window.windowDigest !== expectedDigest) blockers.push(`observability_window_digest_invalid:${window.objective}`);
  } catch (error) {
    blockers.push(error instanceof Error ? error.message : "observability_window_validation_failed");
  }
  return uniqueSorted(blockers);
}

export function buildCommercialCohortSloWindow(args: Omit<CommercialCohortSloWindow, "schemaVersion" | "policyVersion" | "windowDigest">): CommercialCohortSloWindow {
  const core: Omit<CommercialCohortSloWindow, "windowDigest"> = {
    schemaVersion: PASS4816_SLO_WINDOW_SCHEMA,
    policyVersion: PASS4816_OBSERVABILITY_POLICY_ID,
    ...args,
    evidenceDigests: [...args.evidenceDigests].map((item) => item.toLowerCase()).sort(),
  };
  const window = { ...core, windowDigest: sha256Digest(canonicalJson(core)) };
  const blockers = validateWindow(window);
  if (blockers.length) throw new Error(blockers.join("|"));
  return window;
}

export function commercialCohortObservabilitySignaturePayload(coreDigest: string) {
  return {
    schemaVersion: "velmere.observability-incident-signature-payload.v1" as const,
    policyVersion: PASS4816_OBSERVABILITY_POLICY_ID,
    coreDigest: requiredDigest(coreDigest, "observability_core_digest_invalid"),
  };
}

export function prepareCommercialCohortObservabilityReceipt(args: {
  promotionTarget: "staging" | "production";
  audience: string;
  observabilitySequence: number;
  previousReceipt?: CommercialCohortObservabilityReceipt | null;
  testedDeployment: CommercialCohortDeploymentReceipt;
  stagingReceipt: CommercialCohortStagingE2EReceipt;
  chaosReceipt: CommercialCohortChaosReceipt;
  trustBundle: CommercialCohortTrustBundle;
  windows: CommercialCohortSloWindow[];
  issuedAt?: Date;
  expiresAt: Date;
  runIdDigest: string;
  nonce: string;
}): CommercialCohortObservabilityPreparation {
  if (!(args.promotionTarget === "staging" || args.promotionTarget === "production")) throw new Error("observability_promotion_target_invalid");
  const audience = requiredId(args.audience, "observability_audience_invalid");
  const observabilitySequence = integer(args.observabilitySequence, 1, Number.MAX_SAFE_INTEGER, "observability_sequence_invalid");
  if (observabilitySequence === 1 && args.previousReceipt) throw new Error("observability_unexpected_previous_receipt");
  if (observabilitySequence > 1 && (!args.previousReceipt || args.previousReceipt.observabilitySequence !== observabilitySequence - 1)) throw new Error("observability_previous_receipt_missing");
  if (args.trustBundle.releaseSignatureThreshold < 2) throw new Error("observability_dual_release_threshold_required");
  const issuedAt = args.issuedAt ?? new Date();
  if (!Number.isFinite(args.expiresAt.getTime()) || args.expiresAt.getTime() <= issuedAt.getTime() || args.expiresAt.getTime() - issuedAt.getTime() > MAX_RECEIPT_LIFETIME_MS) throw new Error("observability_receipt_lifetime_invalid");
  if (args.stagingReceipt.audience !== audience || args.chaosReceipt.audience !== audience) throw new Error("observability_audience_binding_invalid");
  if (args.stagingReceipt.promotionTarget !== args.promotionTarget || args.chaosReceipt.promotionTarget !== args.promotionTarget) throw new Error("observability_promotion_binding_invalid");
  const chaosCompletedAt = parseDate(args.chaosReceipt.completedAt, "observability_chaos_completed_at_invalid");
  const windows = [...args.windows].sort((a, b) => a.objective.localeCompare(b.objective));
  const blockers = windows.flatMap(validateWindow);
  if (blockers.length) throw new Error(uniqueSorted(blockers).join("|"));
  const names = windows.map((item) => item.objective);
  if (windows.length !== PASS4816_REQUIRED_SLO_OBJECTIVES.length || new Set(names).size !== PASS4816_REQUIRED_SLO_OBJECTIVES.length || names.join("|") !== [...PASS4816_REQUIRED_SLO_OBJECTIVES].sort().join("|")) throw new Error(`observability_objective_set_invalid:${windows.length}/${PASS4816_REQUIRED_SLO_OBJECTIVES.length}`);
  for (const window of windows) {
    if (window.audience !== audience
      || window.testedDeploymentId !== args.stagingReceipt.testedDeploymentId
      || window.testedDeploymentReceiptDigest !== args.stagingReceipt.testedDeploymentReceiptDigest
      || window.stagingSequence !== args.stagingReceipt.stagingSequence
      || window.stagingReceiptDigest !== args.stagingReceipt.stagingReceiptDigest
      || window.chaosSequence !== args.chaosReceipt.chaosSequence
      || window.chaosReceiptDigest !== args.chaosReceipt.chaosReceiptDigest) throw new Error(`observability_prior_receipt_binding_invalid:${window.objective}`);
    if (window.buildArtifactDigest !== args.testedDeployment.buildArtifactDigest
      || window.sourcePackageDigest !== args.testedDeployment.sourcePackageDigest
      || window.runtimeVersionRoot !== args.testedDeployment.runtimeVersionRoot
      || window.providerConfigRoot !== args.testedDeployment.providerConfigRoot
      || window.modelConfigRoot !== args.testedDeployment.modelConfigRoot
      || window.supplyChainProvenanceDigest !== args.testedDeployment.supplyChainProvenanceDigest) throw new Error(`observability_release_binding_invalid:${window.objective}`);
    if (Date.parse(window.windowStartedAt) < chaosCompletedAt.getTime() - CLOCK_SKEW_MS) throw new Error(`observability_window_started_before_chaos_completion:${window.objective}`);
    if (issuedAt.getTime() - Date.parse(window.windowEndedAt) > MAX_WINDOW_TO_RECEIPT_DELAY_MS) throw new Error(`observability_window_stale_before_receipt:${window.objective}`);
  }
  const windowStartedAt = Math.min(...windows.map((item) => Date.parse(item.windowStartedAt)));
  const windowCompletedAt = Math.max(...windows.map((item) => Date.parse(item.windowEndedAt)));
  if (!Number.isFinite(windowStartedAt) || windowCompletedAt > issuedAt.getTime() + CLOCK_SKEW_MS) throw new Error("observability_receipt_timeline_invalid");
  const objectiveDigests = windows.map((item) => item.windowDigest).sort();
  const core: CommercialCohortObservabilityReceiptCore = {
    schemaVersion: PASS4816_OBSERVABILITY_RECEIPT_SCHEMA,
    policyVersion: PASS4816_OBSERVABILITY_POLICY_ID,
    testedEnvironment: "staging",
    promotionTarget: args.promotionTarget,
    audience,
    observabilitySequence,
    previousObservabilityReceiptDigest: args.previousReceipt?.observabilityReceiptDigest ?? null,
    testedDeploymentId: args.stagingReceipt.testedDeploymentId,
    testedDeploymentReceiptDigest: args.stagingReceipt.testedDeploymentReceiptDigest,
    stagingSequence: args.stagingReceipt.stagingSequence,
    stagingReceiptDigest: args.stagingReceipt.stagingReceiptDigest,
    chaosSequence: args.chaosReceipt.chaosSequence,
    chaosReceiptDigest: args.chaosReceipt.chaosReceiptDigest,
    buildArtifactDigest: args.testedDeployment.buildArtifactDigest,
    sourcePackageDigest: args.testedDeployment.sourcePackageDigest,
    runtimeVersionRoot: args.testedDeployment.runtimeVersionRoot,
    providerConfigRoot: args.testedDeployment.providerConfigRoot,
    modelConfigRoot: args.testedDeployment.modelConfigRoot,
    supplyChainProvenanceDigest: args.testedDeployment.supplyChainProvenanceDigest,
    trustEpoch: args.trustBundle.epoch,
    trustBundleDigest: args.trustBundle.bundleDigest,
    objectiveDigests,
    objectiveRoot: sha256Digest(canonicalJson(objectiveDigests)),
    sloPolicyRoot: sha256Digest(canonicalJson(PASS4816_REQUIRED_SLO_OBJECTIVES.map((objective) => ({ objective, policy: PASS4816_SLO_POLICY[objective] })))),
    incidentResponseRoot: sha256Digest(canonicalJson(windows.map((item) => ({ objective: item.objective, alertRouteDigest: item.alertRouteDigest, runbookDigest: item.runbookDigest, onCallOwnerDigest: item.onCallOwnerDigest, alertProbeFiredAt: item.alertProbeFiredAt, alertAcknowledgedAt: item.alertAcknowledgedAt, alertEscalatedAt: item.alertEscalatedAt })) )),
    degradationPlanRoot: sha256Digest(canonicalJson(windows.map((item) => ({ objective: item.objective, degradationAction: item.degradationAction, degradationReceiptDigest: item.degradationReceiptDigest, customerDisclosureVerified: item.customerDisclosureVerified })) )),
    objectiveCount: windows.length,
    windowStartedAt: new Date(windowStartedAt).toISOString(),
    windowCompletedAt: new Date(windowCompletedAt).toISOString(),
    issuedAt: issuedAt.toISOString(),
    expiresAt: args.expiresAt.toISOString(),
    runIdDigest: requiredDigest(args.runIdDigest, "observability_run_id_invalid"),
    nonce: requiredId(args.nonce, "observability_nonce_invalid"),
  };
  const coreDigest = sha256Digest(canonicalJson(core));
  return { core, windows, coreDigest, signaturePayload: commercialCohortObservabilitySignaturePayload(coreDigest) };
}

export function finalizeCommercialCohortObservabilityReceipt(args: {
  preparation: CommercialCohortObservabilityPreparation;
  signatures: CommercialCohortDetachedSignature[];
}): CommercialCohortObservabilityReceipt {
  const signatures = [...args.signatures].map((item) => ({ keyId: item.keyId, signature: item.signature })).sort((a, b) => a.keyId.localeCompare(b.keyId));
  const receiptWithoutDigest = { ...args.preparation.core, windows: args.preparation.windows, signatures };
  return { ...receiptWithoutDigest, observabilityReceiptDigest: sha256Digest(canonicalJson(receiptWithoutDigest)) };
}

export function signCommercialCohortObservabilityReceipt(args: {
  preparation: CommercialCohortObservabilityPreparation;
  signers: CommercialCohortPrivateSigner[];
}): CommercialCohortObservabilityReceipt {
  return finalizeCommercialCohortObservabilityReceipt({
    preparation: args.preparation,
    signatures: args.signers.map((signer) => ({ keyId: signer.keyId, signature: signPayload(signer.privateKeyPem, args.preparation.signaturePayload) })),
  });
}

function verifySingleReceipt(args: {
  receipt: CommercialCohortObservabilityReceipt;
  previousReceipt: CommercialCohortObservabilityReceipt | null;
  trustBundle: CommercialCohortTrustBundle;
  stagingReceipt: CommercialCohortStagingE2EReceipt;
  chaosReceipt: CommercialCohortChaosReceipt;
  current: boolean;
  now: Date;
}): string[] {
  const blockers: string[] = [];
  try {
    const core = receiptCore(args.receipt);
    if (core.schemaVersion !== PASS4816_OBSERVABILITY_RECEIPT_SCHEMA || core.policyVersion !== PASS4816_OBSERVABILITY_POLICY_ID) blockers.push(`observability_receipt_schema_invalid:${core.observabilitySequence}`);
    if (core.observabilitySequence === 1 && core.previousObservabilityReceiptDigest !== null) blockers.push("observability_previous_digest_unexpected");
    if (core.observabilitySequence > 1 && core.previousObservabilityReceiptDigest !== args.previousReceipt?.observabilityReceiptDigest) blockers.push(`observability_previous_digest_invalid:${core.observabilitySequence}`);
    if (core.trustEpoch !== args.trustBundle.epoch || core.trustBundleDigest !== args.trustBundle.bundleDigest) blockers.push(`observability_trust_bundle_mismatch:${core.observabilitySequence}`);
    if (core.stagingSequence !== args.stagingReceipt.stagingSequence || core.stagingReceiptDigest !== args.stagingReceipt.stagingReceiptDigest) blockers.push(`observability_staging_receipt_mismatch:${core.observabilitySequence}`);
    if (core.chaosSequence !== args.chaosReceipt.chaosSequence || core.chaosReceiptDigest !== args.chaosReceipt.chaosReceiptDigest) blockers.push(`observability_chaos_receipt_mismatch:${core.observabilitySequence}`);
    const windows = [...(args.receipt.windows ?? [])].sort((a, b) => a.objective.localeCompare(b.objective));
    blockers.push(...windows.flatMap(validateWindow));
    const names = windows.map((item) => item.objective);
    if (windows.length !== core.objectiveCount || new Set(names).size !== PASS4816_REQUIRED_SLO_OBJECTIVES.length || names.join("|") !== [...PASS4816_REQUIRED_SLO_OBJECTIVES].sort().join("|")) blockers.push(`observability_objective_set_invalid:${core.observabilitySequence}`);
    const objectiveDigests = windows.map((item) => item.windowDigest).sort();
    if (canonicalJson(objectiveDigests) !== canonicalJson(core.objectiveDigests)) blockers.push(`observability_objective_digests_invalid:${core.observabilitySequence}`);
    if (core.objectiveRoot !== sha256Digest(canonicalJson(objectiveDigests))) blockers.push(`observability_objective_root_invalid:${core.observabilitySequence}`);
    if (core.sloPolicyRoot !== sha256Digest(canonicalJson(PASS4816_REQUIRED_SLO_OBJECTIVES.map((objective) => ({ objective, policy: PASS4816_SLO_POLICY[objective] }))))) blockers.push(`observability_policy_root_invalid:${core.observabilitySequence}`);
    const expectedIncidentRoot = sha256Digest(canonicalJson(windows.map((item) => ({ objective: item.objective, alertRouteDigest: item.alertRouteDigest, runbookDigest: item.runbookDigest, onCallOwnerDigest: item.onCallOwnerDigest, alertProbeFiredAt: item.alertProbeFiredAt, alertAcknowledgedAt: item.alertAcknowledgedAt, alertEscalatedAt: item.alertEscalatedAt })) ));
    if (core.incidentResponseRoot !== expectedIncidentRoot) blockers.push(`observability_incident_root_invalid:${core.observabilitySequence}`);
    const expectedDegradationRoot = sha256Digest(canonicalJson(windows.map((item) => ({ objective: item.objective, degradationAction: item.degradationAction, degradationReceiptDigest: item.degradationReceiptDigest, customerDisclosureVerified: item.customerDisclosureVerified })) ));
    if (core.degradationPlanRoot !== expectedDegradationRoot) blockers.push(`observability_degradation_root_invalid:${core.observabilitySequence}`);
    for (const window of windows) {
      if (window.audience !== core.audience || window.testedDeploymentId !== core.testedDeploymentId || window.testedDeploymentReceiptDigest !== core.testedDeploymentReceiptDigest) blockers.push(`observability_window_deployment_binding_invalid:${window.objective}`);
      if (window.stagingSequence !== core.stagingSequence || window.stagingReceiptDigest !== core.stagingReceiptDigest || window.chaosSequence !== core.chaosSequence || window.chaosReceiptDigest !== core.chaosReceiptDigest) blockers.push(`observability_window_prior_receipt_binding_invalid:${window.objective}`);
      if (Date.parse(window.windowStartedAt) < Date.parse(args.chaosReceipt.completedAt) - CLOCK_SKEW_MS) blockers.push(`observability_window_started_before_chaos_completion:${window.objective}`);
      if (window.buildArtifactDigest !== core.buildArtifactDigest || window.sourcePackageDigest !== core.sourcePackageDigest || window.runtimeVersionRoot !== core.runtimeVersionRoot || window.providerConfigRoot !== core.providerConfigRoot || window.modelConfigRoot !== core.modelConfigRoot || window.supplyChainProvenanceDigest !== core.supplyChainProvenanceDigest) blockers.push(`observability_window_release_binding_invalid:${window.objective}`);
    }
    const issuedAt = parseDate(core.issuedAt, "observability_issued_at_invalid");
    const expiresAt = parseDate(core.expiresAt, "observability_expires_at_invalid");
    if (expiresAt.getTime() <= issuedAt.getTime() || expiresAt.getTime() - issuedAt.getTime() > MAX_RECEIPT_LIFETIME_MS) blockers.push(`observability_receipt_lifetime_invalid:${core.observabilitySequence}`);
    if (args.current) {
      if (args.now.getTime() + CLOCK_SKEW_MS < issuedAt.getTime()) blockers.push("observability_receipt_not_active");
      if (args.now.getTime() >= expiresAt.getTime()) blockers.push("observability_receipt_expired");
    }
    const coreDigest = sha256Digest(canonicalJson(core));
    const keys = new Map(args.trustBundle.keys.map((item) => [item.keyId, item]));
    const seen = new Set<string>();
    let valid = 0;
    let active = 0;
    for (const signature of args.receipt.signatures ?? []) {
      const keyId = requiredId(signature?.keyId, "observability_signature_key_invalid");
      if (seen.has(keyId)) { blockers.push(`observability_signature_duplicate:${core.observabilitySequence}:${keyId}`); continue; }
      seen.add(keyId);
      const key = keys.get(keyId);
      if (!key || !keyUsableAt(key, issuedAt)) { blockers.push(`observability_signer_invalid:${core.observabilitySequence}:${keyId}`); continue; }
      if (!verifyPayload(key.publicKeyPem, commercialCohortObservabilitySignaturePayload(coreDigest), signature.signature)) blockers.push(`observability_signature_invalid:${core.observabilitySequence}:${keyId}`);
      else { valid += 1; if (key.status === "active") active += 1; }
    }
    if (valid < args.trustBundle.releaseSignatureThreshold) blockers.push(`observability_signature_threshold:${core.observabilitySequence}:${valid}/${args.trustBundle.releaseSignatureThreshold}`);
    if (active < 1) blockers.push(`observability_active_signer_missing:${core.observabilitySequence}`);
    const normalizedSignatures = (args.receipt.signatures ?? []).map((item) => ({ keyId: item.keyId, signature: item.signature })).sort((a, b) => a.keyId.localeCompare(b.keyId));
    const expectedDigest = sha256Digest(canonicalJson({ ...core, windows, signatures: normalizedSignatures }));
    if (args.receipt.observabilityReceiptDigest !== expectedDigest) blockers.push(`observability_receipt_digest_invalid:${core.observabilitySequence}`);
  } catch (error) {
    blockers.push(error instanceof Error ? error.message : "observability_receipt_validation_failed");
  }
  return uniqueSorted(blockers);
}

export function verifyCommercialCohortObservabilityReceiptChain(args: {
  receipts: CommercialCohortObservabilityReceipt[];
  trustBundles: CommercialCohortTrustBundle[];
  expectedAudience: string;
  expectedPromotionTarget: "staging" | "production";
  currentDeploymentReceipt: CommercialCohortDeploymentReceipt;
  currentStagingReceipt: CommercialCohortStagingE2EReceipt;
  currentChaosReceipt: CommercialCohortChaosReceipt;
  minimumObservabilitySequence: number;
  now?: Date;
}): CommercialCohortObservabilityVerification {
  const blockers: string[] = [];
  let current: CommercialCohortObservabilityReceipt | null = null;
  try {
    if (!Array.isArray(args.receipts) || args.receipts.length < 1 || args.receipts.length > 1024) throw new Error("observability_receipt_chain_invalid");
    if (!Array.isArray(args.trustBundles) || !args.trustBundles.length) throw new Error("observability_trust_chain_missing");
    const minimum = integer(args.minimumObservabilitySequence, 1, Number.MAX_SAFE_INTEGER, "observability_minimum_sequence_invalid");
    const now = args.now ?? new Date();
    const digests = new Set<string>();
    const nonces = new Set<string>();
    const roots = new Set<string>();
    const runIds = new Set<string>();
    for (let index = 0; index < args.receipts.length; index += 1) {
      const receipt = args.receipts[index]!;
      if (receipt.observabilitySequence !== index + 1) blockers.push(`observability_sequence_gap:${receipt.observabilitySequence}/${index + 1}`);
      if (digests.has(receipt.observabilityReceiptDigest)) blockers.push(`observability_digest_reused:${receipt.observabilitySequence}`);
      if (nonces.has(receipt.nonce)) blockers.push(`observability_nonce_reused:${receipt.observabilitySequence}`);
      if (roots.has(receipt.objectiveRoot)) blockers.push(`observability_objective_root_reused:${receipt.observabilitySequence}`);
      if (runIds.has(receipt.runIdDigest)) blockers.push(`observability_run_id_reused:${receipt.observabilitySequence}`);
      digests.add(receipt.observabilityReceiptDigest); nonces.add(receipt.nonce); roots.add(receipt.objectiveRoot); runIds.add(receipt.runIdDigest);
      const trustBundle = args.trustBundles.find((item) => item.epoch === receipt.trustEpoch && item.bundleDigest === receipt.trustBundleDigest) ?? null;
      if (!trustBundle) blockers.push(`observability_trust_bundle_missing:${receipt.observabilitySequence}`);
      else blockers.push(...verifySingleReceipt({ receipt, previousReceipt: index > 0 ? args.receipts[index - 1]! : null, trustBundle, stagingReceipt: args.currentStagingReceipt, chaosReceipt: args.currentChaosReceipt, current: index === args.receipts.length - 1, now }));
      current = receipt;
    }
    if (!current) throw new Error("observability_current_receipt_missing");
    if (current.observabilitySequence < minimum) blockers.push(`observability_rollback_floor:${current.observabilitySequence}/${minimum}`);
    if (current.audience !== args.expectedAudience || current.promotionTarget !== args.expectedPromotionTarget) blockers.push("observability_identity_mismatch");
    if (current.stagingSequence !== args.currentStagingReceipt.stagingSequence || current.stagingReceiptDigest !== args.currentStagingReceipt.stagingReceiptDigest) blockers.push("observability_current_staging_mismatch");
    if (current.chaosSequence !== args.currentChaosReceipt.chaosSequence || current.chaosReceiptDigest !== args.currentChaosReceipt.chaosReceiptDigest) blockers.push("observability_current_chaos_mismatch");
    if (current.buildArtifactDigest !== args.currentDeploymentReceipt.buildArtifactDigest || current.sourcePackageDigest !== args.currentDeploymentReceipt.sourcePackageDigest || current.runtimeVersionRoot !== args.currentDeploymentReceipt.runtimeVersionRoot || current.providerConfigRoot !== args.currentDeploymentReceipt.providerConfigRoot || current.modelConfigRoot !== args.currentDeploymentReceipt.modelConfigRoot || current.supplyChainProvenanceDigest !== args.currentDeploymentReceipt.supplyChainProvenanceDigest) blockers.push("observability_current_release_binding_mismatch");
    if (Date.parse(current.windowCompletedAt) > Date.parse(args.currentDeploymentReceipt.issuedAt) + CLOCK_SKEW_MS && args.expectedPromotionTarget === "production" && args.currentDeploymentReceipt.environment === "production") blockers.push("observability_completed_after_production_deployment");
  } catch (error) {
    blockers.push(error instanceof Error ? error.message : "observability_chain_validation_failed");
  }
  const uniqueBlockers = uniqueSorted(blockers);
  const observabilityVerified = uniqueBlockers.length === 0 && Boolean(current);
  const telemetryBound = observabilityVerified && Boolean(current?.windows.every((item) => item.metrics.telemetryCoverageRate >= 0.995 && item.metrics.traceCoverageRate >= 0.99 && item.metrics.missingTelemetryIntervals === 0));
  const sloVerified = observabilityVerified && Boolean(current?.windows.every((item) => validateWindow(item).length === 0));
  const incidentResponseVerified = observabilityVerified && Boolean(current?.windows.every((item) => item.alertRouteVerified && item.metrics.unresolvedSev1Count === 0 && item.metrics.unresolvedSev2Count === 0 && item.metrics.mutedCriticalAlertCount === 0));
  const safeDegradationVerified = observabilityVerified && Boolean(current?.windows.every((item) => item.degradationExerciseVerified && item.customerDisclosureVerified && item.degradationAction === PASS4816_SLO_POLICY[item.objective].degradationAction));
  const observabilityRollbackProtected = observabilityVerified && Boolean(current && current.observabilitySequence >= args.minimumObservabilitySequence);
  return {
    verified: observabilityVerified && telemetryBound && sloVerified && incidentResponseVerified && safeDegradationVerified && observabilityRollbackProtected,
    observabilityVerified,
    telemetryBound,
    sloVerified,
    incidentResponseVerified,
    safeDegradationVerified,
    observabilityRollbackProtected,
    observabilitySequence: current?.observabilitySequence ?? null,
    observabilityReceiptDigest: current?.observabilityReceiptDigest ?? null,
    objectiveCount: current?.objectiveCount ?? 0,
    blockers: uniqueBlockers,
  };
}
