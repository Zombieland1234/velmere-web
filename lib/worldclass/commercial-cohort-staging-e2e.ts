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
import type {
  CommercialCohortDetachedSignature,
  CommercialCohortPrivateSigner,
  CommercialCohortTrustBundle,
  CommercialCohortTrustKey,
} from "@/lib/worldclass/commercial-cohort-public-checkpoint";

export const PASS4814_STAGING_E2E_POLICY_ID = "pass4814-staging-paid-e2e-readiness-v1" as const;
export const PASS4814_STAGING_E2E_PROBE_SCHEMA = "velmere.staging-paid-e2e-probe.v1" as const;
export const PASS4814_STAGING_E2E_RECEIPT_SCHEMA = "velmere.staging-paid-e2e-receipt.v1" as const;

const DIGEST = /^sha256:[a-f0-9]{64}$/;
const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9._:/-]{5,191}$/;
const MAX_PROBE_DURATION_MS = 30 * 60 * 1_000;
const MAX_PROBE_TO_RECEIPT_DELAY_MS = 2 * 60 * 60 * 1_000;
const MAX_RECEIPT_LIFETIME_MS = 12 * 60 * 60 * 1_000;
const CLOCK_SKEW_MS = 60_000;

export const PASS4814_REQUIRED_STAGING_SERVICES = [
  "stripe_checkout",
  "stripe_webhook",
  "supabase_ledger",
  "entitlement_lifecycle",
  "audit_pro_completion",
  "audit_advanced_dual_control",
  "pdf_secure_delivery",
  "provider_audit",
  "provider_shield",
  "provider_real_markets",
] as const;

export type CommercialCohortStagingService = typeof PASS4814_REQUIRED_STAGING_SERVICES[number];
export type CommercialCohortStagingServiceMode =
  | "stripe_test_api"
  | "supabase_staging_project"
  | "velmere_staging_runtime"
  | "live_upstream_staging";

export type CommercialCohortStagingE2EProbe = {
  schemaVersion: typeof PASS4814_STAGING_E2E_PROBE_SCHEMA;
  policyVersion: typeof PASS4814_STAGING_E2E_POLICY_ID;
  probeId: string;
  service: CommercialCohortStagingService;
  serviceMode: CommercialCohortStagingServiceMode;
  evidenceClass: "staging_real_service";
  environment: "staging";
  audience: string;
  testedDeploymentId: string;
  testedDeploymentReceiptDigest: string;
  releaseCandidateDigest: string;
  buildArtifactDigest: string;
  sourcePackageDigest: string;
  runtimeVersionRoot: string;
  providerConfigRoot: string;
  modelConfigRoot: string;
  supplyChainProvenanceDigest: string;
  startedAt: string;
  completedAt: string;
  referenceDigests: string[];
  assertions: Record<string, true>;
  evidenceDigest: string;
  outputDigest: string;
  probeDigest: string;
};

export type CommercialCohortStagingE2EReceiptCore = {
  schemaVersion: typeof PASS4814_STAGING_E2E_RECEIPT_SCHEMA;
  policyVersion: typeof PASS4814_STAGING_E2E_POLICY_ID;
  testedEnvironment: "staging";
  promotionTarget: "staging" | "production";
  audience: string;
  stagingSequence: number;
  previousStagingReceiptDigest: string | null;
  testedDeploymentId: string;
  testedDeploymentReceiptDigest: string;
  testedDeploymentIssuedAt: string;
  releaseCandidateDigest: string;
  buildArtifactDigest: string;
  sourcePackageDigest: string;
  runtimeVersionRoot: string;
  providerConfigRoot: string;
  modelConfigRoot: string;
  supplyChainProvenanceDigest: string;
  trustEpoch: number;
  trustBundleDigest: string;
  probeDigests: string[];
  probeRoot: string;
  serviceRoot: string;
  probeCount: number;
  startedAt: string;
  completedAt: string;
  issuedAt: string;
  expiresAt: string;
  runIdDigest: string;
  nonce: string;
};

export type CommercialCohortStagingE2EReceipt = CommercialCohortStagingE2EReceiptCore & {
  probes: CommercialCohortStagingE2EProbe[];
  signatures: CommercialCohortDetachedSignature[];
  stagingReceiptDigest: string;
};

export type CommercialCohortStagingE2EPreparation = {
  core: CommercialCohortStagingE2EReceiptCore;
  probes: CommercialCohortStagingE2EProbe[];
  coreDigest: string;
  signaturePayload: ReturnType<typeof commercialCohortStagingE2ESignaturePayload>;
};

export type CommercialCohortStagingE2EVerification = {
  verified: boolean;
  stagingE2eVerified: boolean;
  stagingE2eBound: boolean;
  stagingRollbackProtected: boolean;
  stagingSequence: number | null;
  stagingReceiptDigest: string | null;
  probeCount: number;
  blockers: string[];
};

const REQUIRED_ASSERTIONS: Record<CommercialCohortStagingService, readonly string[]> = {
  stripe_checkout: [
    "remoteServiceReached",
    "authenticatedRequest",
    "stripeTestMode",
    "checkoutSessionCreated",
    "expectedAmountCurrencyProduct",
    "customerReferenceHashed",
  ],
  stripe_webhook: [
    "remoteServiceReached",
    "signatureVerified",
    "eventMatchedCheckout",
    "durableWrite",
    "readBackVerified",
    "replayRejected",
    "idempotencyVerified",
    "exactlyOnceEffect",
  ],
  supabase_ledger: [
    "remoteServiceReached",
    "authenticatedRequest",
    "durableWrite",
    "readBackVerified",
    "rlsVerified",
    "transactionBound",
  ],
  entitlement_lifecycle: [
    "durableWrite",
    "readBackVerified",
    "accountBound",
    "paymentBound",
    "entitlementIssued",
    "accessGranted",
    "entitlementRevoked",
    "accessDeniedAfterRevoke",
  ],
  audit_pro_completion: [
    "providerIdentityVerified",
    "independentUpstreamQuorum",
    "durableWrite",
    "immutableSnapshotVerified",
    "automaticCompletionVerified",
    "accountBound",
  ],
  audit_advanced_dual_control: [
    "providerIdentityVerified",
    "independentUpstreamQuorum",
    "durableWrite",
    "immutableSnapshotVerified",
    "dualControlVerified",
    "distinctOperators",
    "accountBound",
  ],
  pdf_secure_delivery: [
    "bearerTokenOnly",
    "singleUseTokenVerified",
    "digestVerified",
    "lengthVerified",
    "tamperRejected",
    "crossAccountRejected",
    "expiredTokenRejected",
    "noQueryToken",
  ],
  provider_audit: [
    "remoteServiceReached",
    "providerIdentityVerified",
    "independentUpstreamQuorum",
    "freshnessVerified",
    "conflictSurfaced",
  ],
  provider_shield: [
    "remoteServiceReached",
    "providerIdentityVerified",
    "independentUpstreamQuorum",
    "freshnessVerified",
    "conflictSurfaced",
  ],
  provider_real_markets: [
    "remoteServiceReached",
    "providerIdentityVerified",
    "independentUpstreamQuorum",
    "freshnessVerified",
    "conflictSurfaced",
    "sessionNormalizationVerified",
  ],
};

const REQUIRED_SERVICE_MODE: Record<CommercialCohortStagingService, CommercialCohortStagingServiceMode> = {
  stripe_checkout: "stripe_test_api",
  stripe_webhook: "stripe_test_api",
  supabase_ledger: "supabase_staging_project",
  entitlement_lifecycle: "velmere_staging_runtime",
  audit_pro_completion: "velmere_staging_runtime",
  audit_advanced_dual_control: "velmere_staging_runtime",
  pdf_secure_delivery: "velmere_staging_runtime",
  provider_audit: "live_upstream_staging",
  provider_shield: "live_upstream_staging",
  provider_real_markets: "live_upstream_staging",
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
  if (key.asymmetricKeyType !== "ed25519") throw new Error("staging_e2e_public_key_not_ed25519");
  return key;
}

function ed25519PrivateKey(value: unknown): KeyObject {
  const key = createPrivateKey(normalizePem(value));
  if (key.asymmetricKeyType !== "ed25519") throw new Error("staging_e2e_private_key_not_ed25519");
  return key;
}

function signPayload(privateKeyPem: string, payload: unknown): string {
  return cryptoSign(null, Buffer.from(canonicalJson(payload), "utf8"), ed25519PrivateKey(privateKeyPem)).toString("base64url");
}

function verifyPayload(publicKeyPem: string, payload: unknown, signature: string): boolean {
  try {
    return cryptoVerify(
      null,
      Buffer.from(canonicalJson(payload), "utf8"),
      ed25519PublicKey(publicKeyPem),
      Buffer.from(requiredSignature(signature, "staging_e2e_signature_encoding_invalid"), "base64url"),
    );
  } catch {
    return false;
  }
}

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean))).sort();
}

function isService(value: unknown): value is CommercialCohortStagingService {
  return (PASS4814_REQUIRED_STAGING_SERVICES as readonly unknown[]).includes(value);
}

function keyUsableAt(key: CommercialCohortTrustKey, at: Date): boolean {
  return key.purpose === "release"
    && key.status !== "revoked"
    && at.getTime() >= new Date(key.notBefore).getTime()
    && at.getTime() < new Date(key.notAfter).getTime();
}

export function commercialCohortReleaseCandidateDigest(input: Pick<CommercialCohortDeploymentReceipt,
  "buildArtifactDigest" | "sourcePackageDigest" | "runtimeVersionRoot" | "providerConfigRoot" | "modelConfigRoot" | "supplyChainProvenanceDigest"
>): string {
  return sha256Digest(canonicalJson({
    buildArtifactDigest: requiredDigest(input.buildArtifactDigest, "staging_e2e_build_digest_invalid"),
    sourcePackageDigest: requiredDigest(input.sourcePackageDigest, "staging_e2e_source_digest_invalid"),
    runtimeVersionRoot: requiredDigest(input.runtimeVersionRoot, "staging_e2e_runtime_root_invalid"),
    providerConfigRoot: requiredDigest(input.providerConfigRoot, "staging_e2e_provider_root_invalid"),
    modelConfigRoot: requiredDigest(input.modelConfigRoot, "staging_e2e_model_root_invalid"),
    supplyChainProvenanceDigest: requiredDigest(input.supplyChainProvenanceDigest, "staging_e2e_supply_chain_digest_invalid"),
  }));
}

function normalizeAssertions(service: CommercialCohortStagingService, input: Record<string, unknown>): Record<string, true> {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error(`staging_e2e_assertions_invalid:${service}`);
  const required = REQUIRED_ASSERTIONS[service];
  const normalized: Record<string, true> = {};
  for (const key of required) {
    if (input[key] !== true) throw new Error(`staging_e2e_assertion_missing:${service}:${key}`);
    normalized[key] = true;
  }
  const unexpected = Object.keys(input).filter((key) => !required.includes(key));
  if (unexpected.length) throw new Error(`staging_e2e_assertion_unexpected:${service}:${unexpected.sort().join(",")}`);
  return normalized;
}

function normalizeProbeContent(input: Omit<CommercialCohortStagingE2EProbe, "probeDigest">) {
  if (!input || input.schemaVersion !== PASS4814_STAGING_E2E_PROBE_SCHEMA || input.policyVersion !== PASS4814_STAGING_E2E_POLICY_ID) {
    throw new Error("staging_e2e_probe_schema_invalid");
  }
  if (!isService(input.service)) throw new Error("staging_e2e_probe_service_invalid");
  if (input.serviceMode !== REQUIRED_SERVICE_MODE[input.service]) throw new Error(`staging_e2e_service_mode_invalid:${input.service}`);
  if (input.evidenceClass !== "staging_real_service") throw new Error(`staging_e2e_non_real_evidence:${input.service}`);
  if (input.environment !== "staging") throw new Error("staging_e2e_probe_environment_invalid");
  const startedAt = parseDate(input.startedAt, "staging_e2e_probe_started_at_invalid");
  const completedAt = parseDate(input.completedAt, "staging_e2e_probe_completed_at_invalid");
  if (completedAt.getTime() < startedAt.getTime() || completedAt.getTime() - startedAt.getTime() > MAX_PROBE_DURATION_MS) {
    throw new Error(`staging_e2e_probe_window_invalid:${input.service}`);
  }
  const referenceDigests = uniqueSorted((input.referenceDigests ?? []).map((value) => requiredDigest(value, `staging_e2e_reference_digest_invalid:${input.service}`)));
  if (referenceDigests.length < 1 || referenceDigests.length > 16) throw new Error(`staging_e2e_reference_count_invalid:${input.service}`);
  return {
    schemaVersion: PASS4814_STAGING_E2E_PROBE_SCHEMA,
    policyVersion: PASS4814_STAGING_E2E_POLICY_ID,
    probeId: requiredId(input.probeId, "staging_e2e_probe_id_invalid"),
    service: input.service,
    serviceMode: input.serviceMode,
    evidenceClass: "staging_real_service" as const,
    environment: "staging" as const,
    audience: requiredId(input.audience, "staging_e2e_probe_audience_invalid"),
    testedDeploymentId: requiredId(input.testedDeploymentId, "staging_e2e_tested_deployment_id_invalid"),
    testedDeploymentReceiptDigest: requiredDigest(input.testedDeploymentReceiptDigest, "staging_e2e_tested_receipt_digest_invalid"),
    releaseCandidateDigest: requiredDigest(input.releaseCandidateDigest, "staging_e2e_release_candidate_digest_invalid"),
    buildArtifactDigest: requiredDigest(input.buildArtifactDigest, "staging_e2e_build_digest_invalid"),
    sourcePackageDigest: requiredDigest(input.sourcePackageDigest, "staging_e2e_source_digest_invalid"),
    runtimeVersionRoot: requiredDigest(input.runtimeVersionRoot, "staging_e2e_runtime_root_invalid"),
    providerConfigRoot: requiredDigest(input.providerConfigRoot, "staging_e2e_provider_root_invalid"),
    modelConfigRoot: requiredDigest(input.modelConfigRoot, "staging_e2e_model_root_invalid"),
    supplyChainProvenanceDigest: requiredDigest(input.supplyChainProvenanceDigest, "staging_e2e_supply_chain_digest_invalid"),
    startedAt: startedAt.toISOString(),
    completedAt: completedAt.toISOString(),
    referenceDigests,
    assertions: normalizeAssertions(input.service, input.assertions),
    evidenceDigest: requiredDigest(input.evidenceDigest, `staging_e2e_evidence_digest_invalid:${input.service}`),
    outputDigest: requiredDigest(input.outputDigest, `staging_e2e_output_digest_invalid:${input.service}`),
  };
}

function normalizeProbe(input: CommercialCohortStagingE2EProbe): CommercialCohortStagingE2EProbe {
  const { probeDigest: _probeDigest, ...raw } = input;
  const normalizedWithoutDigest = normalizeProbeContent(raw);
  const probeDigest = sha256Digest(canonicalJson(normalizedWithoutDigest));
  if (input.probeDigest !== probeDigest) throw new Error(`staging_e2e_probe_digest_invalid:${input.service}`);
  return { ...normalizedWithoutDigest, probeDigest };
}

export function buildCommercialCohortStagingE2EProbe(args: Omit<CommercialCohortStagingE2EProbe, "schemaVersion" | "policyVersion" | "probeDigest">): CommercialCohortStagingE2EProbe {
  const normalizedWithoutDigest = normalizeProbeContent({
    schemaVersion: PASS4814_STAGING_E2E_PROBE_SCHEMA,
    policyVersion: PASS4814_STAGING_E2E_POLICY_ID,
    ...args,
  });
  return { ...normalizedWithoutDigest, probeDigest: sha256Digest(canonicalJson(normalizedWithoutDigest)) };
}

function normalizeCore(input: CommercialCohortStagingE2EReceiptCore): CommercialCohortStagingE2EReceiptCore {
  if (!input || input.schemaVersion !== PASS4814_STAGING_E2E_RECEIPT_SCHEMA || input.policyVersion !== PASS4814_STAGING_E2E_POLICY_ID) {
    throw new Error("staging_e2e_receipt_schema_invalid");
  }
  if (input.testedEnvironment !== "staging") throw new Error("staging_e2e_tested_environment_invalid");
  if (!(input.promotionTarget === "staging" || input.promotionTarget === "production")) throw new Error("staging_e2e_promotion_target_invalid");
  const stagingSequence = Number(input.stagingSequence);
  if (!Number.isInteger(stagingSequence) || stagingSequence < 1 || stagingSequence > 1_000_000_000) throw new Error("staging_e2e_sequence_invalid");
  const previousStagingReceiptDigest = stagingSequence === 1
    ? (input.previousStagingReceiptDigest === null ? null : (() => { throw new Error("staging_e2e_genesis_previous_forbidden"); })())
    : requiredDigest(input.previousStagingReceiptDigest, "staging_e2e_previous_digest_invalid");
  const trustEpoch = Number(input.trustEpoch);
  if (!Number.isInteger(trustEpoch) || trustEpoch < 1) throw new Error("staging_e2e_trust_epoch_invalid");
  const probeCount = Number(input.probeCount);
  if (!Number.isInteger(probeCount) || probeCount !== PASS4814_REQUIRED_STAGING_SERVICES.length) throw new Error("staging_e2e_probe_count_invalid");
  const testedDeploymentIssuedAt = parseDate(input.testedDeploymentIssuedAt, "staging_e2e_tested_deployment_issued_at_invalid");
  const startedAt = parseDate(input.startedAt, "staging_e2e_started_at_invalid");
  const completedAt = parseDate(input.completedAt, "staging_e2e_completed_at_invalid");
  const issuedAt = parseDate(input.issuedAt, "staging_e2e_issued_at_invalid");
  const expiresAt = parseDate(input.expiresAt, "staging_e2e_expires_at_invalid");
  if (startedAt.getTime() < testedDeploymentIssuedAt.getTime() - CLOCK_SKEW_MS) throw new Error("staging_e2e_started_before_tested_deployment");
  if (completedAt.getTime() < startedAt.getTime() || issuedAt.getTime() < completedAt.getTime()) throw new Error("staging_e2e_chronology_invalid");
  if (issuedAt.getTime() - completedAt.getTime() > MAX_PROBE_TO_RECEIPT_DELAY_MS) throw new Error("staging_e2e_receipt_issued_too_late");
  if (expiresAt.getTime() <= issuedAt.getTime() || expiresAt.getTime() - issuedAt.getTime() > MAX_RECEIPT_LIFETIME_MS) throw new Error("staging_e2e_receipt_window_invalid");
  const probeDigests = uniqueSorted((input.probeDigests ?? []).map((value) => requiredDigest(value, "staging_e2e_probe_digest_list_invalid")));
  if (probeDigests.length !== PASS4814_REQUIRED_STAGING_SERVICES.length) throw new Error("staging_e2e_probe_digest_count_invalid");
  return {
    schemaVersion: PASS4814_STAGING_E2E_RECEIPT_SCHEMA,
    policyVersion: PASS4814_STAGING_E2E_POLICY_ID,
    testedEnvironment: "staging",
    promotionTarget: input.promotionTarget,
    audience: requiredId(input.audience, "staging_e2e_audience_invalid"),
    stagingSequence,
    previousStagingReceiptDigest,
    testedDeploymentId: requiredId(input.testedDeploymentId, "staging_e2e_tested_deployment_id_invalid"),
    testedDeploymentReceiptDigest: requiredDigest(input.testedDeploymentReceiptDigest, "staging_e2e_tested_receipt_digest_invalid"),
    testedDeploymentIssuedAt: testedDeploymentIssuedAt.toISOString(),
    releaseCandidateDigest: requiredDigest(input.releaseCandidateDigest, "staging_e2e_release_candidate_digest_invalid"),
    buildArtifactDigest: requiredDigest(input.buildArtifactDigest, "staging_e2e_build_digest_invalid"),
    sourcePackageDigest: requiredDigest(input.sourcePackageDigest, "staging_e2e_source_digest_invalid"),
    runtimeVersionRoot: requiredDigest(input.runtimeVersionRoot, "staging_e2e_runtime_root_invalid"),
    providerConfigRoot: requiredDigest(input.providerConfigRoot, "staging_e2e_provider_root_invalid"),
    modelConfigRoot: requiredDigest(input.modelConfigRoot, "staging_e2e_model_root_invalid"),
    supplyChainProvenanceDigest: requiredDigest(input.supplyChainProvenanceDigest, "staging_e2e_supply_chain_digest_invalid"),
    trustEpoch,
    trustBundleDigest: requiredDigest(input.trustBundleDigest, "staging_e2e_trust_bundle_digest_invalid"),
    probeDigests,
    probeRoot: requiredDigest(input.probeRoot, "staging_e2e_probe_root_invalid"),
    serviceRoot: requiredDigest(input.serviceRoot, "staging_e2e_service_root_invalid"),
    probeCount,
    startedAt: startedAt.toISOString(),
    completedAt: completedAt.toISOString(),
    issuedAt: issuedAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
    runIdDigest: requiredDigest(input.runIdDigest, "staging_e2e_run_id_digest_invalid"),
    nonce: requiredId(input.nonce, "staging_e2e_nonce_invalid"),
  };
}

export function commercialCohortStagingE2ESignaturePayload(coreDigest: string) {
  return {
    schemaVersion: "velmere.staging-paid-e2e-signature.v1",
    policyVersion: PASS4814_STAGING_E2E_POLICY_ID,
    coreDigest: requiredDigest(coreDigest, "staging_e2e_core_digest_invalid"),
  } as const;
}

export function prepareCommercialCohortStagingE2EReceipt(args: {
  promotionTarget: "staging" | "production";
  audience: string;
  stagingSequence: number;
  previousReceipt?: CommercialCohortStagingE2EReceipt | null;
  testedDeployment: CommercialCohortDeploymentReceipt;
  trustBundle: CommercialCohortTrustBundle;
  probes: CommercialCohortStagingE2EProbe[];
  issuedAt?: Date;
  expiresAt: Date;
  runIdDigest: string;
  nonce: string;
}): CommercialCohortStagingE2EPreparation {
  const issuedAt = args.issuedAt ?? new Date();
  if (args.testedDeployment.environment !== "staging") throw new Error("staging_e2e_tested_deployment_not_staging");
  if (args.testedDeployment.audience !== args.audience) throw new Error("staging_e2e_tested_deployment_audience_mismatch");
  if (args.testedDeployment.trustEpoch !== args.trustBundle.epoch || args.testedDeployment.trustBundleDigest !== args.trustBundle.bundleDigest) {
    throw new Error("staging_e2e_trust_binding_invalid");
  }
  if (args.stagingSequence === 1 && args.previousReceipt) throw new Error("staging_e2e_genesis_previous_forbidden");
  if (args.stagingSequence > 1 && (!args.previousReceipt || args.previousReceipt.stagingSequence !== args.stagingSequence - 1)) {
    throw new Error("staging_e2e_previous_sequence_invalid");
  }
  const releaseCandidateDigest = commercialCohortReleaseCandidateDigest(args.testedDeployment);
  const probes = (args.probes ?? []).map(normalizeProbe).sort((left, right) => left.service.localeCompare(right.service));
  if (probes.length !== PASS4814_REQUIRED_STAGING_SERVICES.length) throw new Error("staging_e2e_probe_count_invalid");
  const services = probes.map((probe) => probe.service);
  if (uniqueSorted(services).join("|") !== [...PASS4814_REQUIRED_STAGING_SERVICES].sort().join("|")) throw new Error("staging_e2e_service_set_invalid");
  if (new Set(services).size !== services.length) throw new Error("staging_e2e_service_duplicate");
  const testedIssuedAt = new Date(args.testedDeployment.issuedAt);
  for (const probe of probes) {
    if (probe.audience !== args.audience || probe.testedDeploymentId !== args.testedDeployment.deploymentId || probe.testedDeploymentReceiptDigest !== args.testedDeployment.deploymentReceiptDigest) {
      throw new Error(`staging_e2e_probe_deployment_binding_invalid:${probe.service}`);
    }
    if (probe.releaseCandidateDigest !== releaseCandidateDigest
      || probe.buildArtifactDigest !== args.testedDeployment.buildArtifactDigest
      || probe.sourcePackageDigest !== args.testedDeployment.sourcePackageDigest
      || probe.runtimeVersionRoot !== args.testedDeployment.runtimeVersionRoot
      || probe.providerConfigRoot !== args.testedDeployment.providerConfigRoot
      || probe.modelConfigRoot !== args.testedDeployment.modelConfigRoot
      || probe.supplyChainProvenanceDigest !== args.testedDeployment.supplyChainProvenanceDigest) {
      throw new Error(`staging_e2e_probe_release_candidate_binding_invalid:${probe.service}`);
    }
    const startedAt = new Date(probe.startedAt);
    const completedAt = new Date(probe.completedAt);
    if (startedAt.getTime() < testedIssuedAt.getTime() - CLOCK_SKEW_MS) throw new Error(`staging_e2e_probe_before_deployment:${probe.service}`);
    if (completedAt.getTime() > issuedAt.getTime() + CLOCK_SKEW_MS) throw new Error(`staging_e2e_probe_completed_in_future:${probe.service}`);
    if (issuedAt.getTime() - completedAt.getTime() > MAX_PROBE_TO_RECEIPT_DELAY_MS) throw new Error(`staging_e2e_probe_stale_before_receipt:${probe.service}`);
  }
  const probeDigests = probes.map((probe) => probe.probeDigest).sort();
  const startedAt = new Date(Math.min(...probes.map((probe) => new Date(probe.startedAt).getTime())));
  const completedAt = new Date(Math.max(...probes.map((probe) => new Date(probe.completedAt).getTime())));
  const core = normalizeCore({
    schemaVersion: PASS4814_STAGING_E2E_RECEIPT_SCHEMA,
    policyVersion: PASS4814_STAGING_E2E_POLICY_ID,
    testedEnvironment: "staging",
    promotionTarget: args.promotionTarget,
    audience: args.audience,
    stagingSequence: args.stagingSequence,
    previousStagingReceiptDigest: args.previousReceipt?.stagingReceiptDigest ?? null,
    testedDeploymentId: args.testedDeployment.deploymentId,
    testedDeploymentReceiptDigest: args.testedDeployment.deploymentReceiptDigest,
    testedDeploymentIssuedAt: args.testedDeployment.issuedAt,
    releaseCandidateDigest,
    buildArtifactDigest: args.testedDeployment.buildArtifactDigest,
    sourcePackageDigest: args.testedDeployment.sourcePackageDigest,
    runtimeVersionRoot: args.testedDeployment.runtimeVersionRoot,
    providerConfigRoot: args.testedDeployment.providerConfigRoot,
    modelConfigRoot: args.testedDeployment.modelConfigRoot,
    supplyChainProvenanceDigest: args.testedDeployment.supplyChainProvenanceDigest,
    trustEpoch: args.trustBundle.epoch,
    trustBundleDigest: args.trustBundle.bundleDigest,
    probeDigests,
    probeRoot: sha256Digest(canonicalJson(probeDigests)),
    serviceRoot: sha256Digest(canonicalJson(probes.map((probe) => ({ service: probe.service, probeDigest: probe.probeDigest })))),
    probeCount: probes.length,
    startedAt: startedAt.toISOString(),
    completedAt: completedAt.toISOString(),
    issuedAt: issuedAt.toISOString(),
    expiresAt: args.expiresAt.toISOString(),
    runIdDigest: args.runIdDigest,
    nonce: args.nonce,
  });
  const coreDigest = sha256Digest(canonicalJson(core));
  return { core, probes, coreDigest, signaturePayload: commercialCohortStagingE2ESignaturePayload(coreDigest) };
}

export function finalizeCommercialCohortStagingE2EReceipt(args: {
  preparation: CommercialCohortStagingE2EPreparation;
  signatures: CommercialCohortDetachedSignature[];
}): CommercialCohortStagingE2EReceipt {
  const signatures = (args.signatures ?? []).map((item) => ({
    keyId: requiredId(item?.keyId, "staging_e2e_signature_key_invalid"),
    signature: requiredSignature(item?.signature, "staging_e2e_signature_encoding_invalid"),
  })).sort((left, right) => left.keyId.localeCompare(right.keyId));
  if (new Set(signatures.map((item) => item.keyId)).size !== signatures.length) throw new Error("staging_e2e_signature_key_duplicate");
  const stagingReceiptDigest = sha256Digest(canonicalJson({ core: args.preparation.core, probes: args.preparation.probes, signatures }));
  return { ...args.preparation.core, probes: args.preparation.probes, signatures, stagingReceiptDigest };
}

export function buildCommercialCohortStagingE2EReceipt(args: Parameters<typeof prepareCommercialCohortStagingE2EReceipt>[0] & {
  signers: CommercialCohortPrivateSigner[];
}): CommercialCohortStagingE2EReceipt {
  const preparation = prepareCommercialCohortStagingE2EReceipt(args);
  return finalizeCommercialCohortStagingE2EReceipt({
    preparation,
    signatures: args.signers.map((signer) => ({ keyId: signer.keyId, signature: signPayload(signer.privateKeyPem, preparation.signaturePayload) })),
  });
}

function verifySingleReceipt(args: {
  receipt: CommercialCohortStagingE2EReceipt;
  previousReceipt: CommercialCohortStagingE2EReceipt | null;
  trustBundle: CommercialCohortTrustBundle;
  current: boolean;
  now: Date;
}): string[] {
  const blockers: string[] = [];
  try {
    const { probes: rawProbes, signatures: _signatures, stagingReceiptDigest: _digest, ...rawCore } = args.receipt;
    const core = normalizeCore(rawCore);
    const probes = (rawProbes ?? []).map(normalizeProbe).sort((left, right) => left.service.localeCompare(right.service));
    if (core.stagingSequence === 1) {
      if (args.previousReceipt) blockers.push("staging_e2e_genesis_previous_present");
    } else if (!args.previousReceipt || args.previousReceipt.stagingSequence !== core.stagingSequence - 1 || core.previousStagingReceiptDigest !== args.previousReceipt.stagingReceiptDigest) {
      blockers.push(`staging_e2e_previous_binding_invalid:${core.stagingSequence}`);
    }
    if (core.trustEpoch !== args.trustBundle.epoch || core.trustBundleDigest !== args.trustBundle.bundleDigest) blockers.push(`staging_e2e_trust_binding_invalid:${core.stagingSequence}`);
    const services = probes.map((probe) => probe.service);
    if (probes.length !== core.probeCount || new Set(services).size !== PASS4814_REQUIRED_STAGING_SERVICES.length || uniqueSorted(services).join("|") !== [...PASS4814_REQUIRED_STAGING_SERVICES].sort().join("|")) {
      blockers.push(`staging_e2e_service_set_invalid:${core.stagingSequence}`);
    }
    const probeDigests = probes.map((probe) => probe.probeDigest).sort();
    if (canonicalJson(probeDigests) !== canonicalJson(core.probeDigests)) blockers.push(`staging_e2e_probe_digest_set_invalid:${core.stagingSequence}`);
    if (core.probeRoot !== sha256Digest(canonicalJson(probeDigests))) blockers.push(`staging_e2e_probe_root_invalid:${core.stagingSequence}`);
    if (core.serviceRoot !== sha256Digest(canonicalJson(probes.map((probe) => ({ service: probe.service, probeDigest: probe.probeDigest }))))) blockers.push(`staging_e2e_service_root_invalid:${core.stagingSequence}`);
    for (const probe of probes) {
      if (probe.audience !== core.audience || probe.testedDeploymentId !== core.testedDeploymentId || probe.testedDeploymentReceiptDigest !== core.testedDeploymentReceiptDigest) blockers.push(`staging_e2e_probe_deployment_binding_invalid:${probe.service}`);
      if (probe.releaseCandidateDigest !== core.releaseCandidateDigest
        || probe.buildArtifactDigest !== core.buildArtifactDigest
        || probe.sourcePackageDigest !== core.sourcePackageDigest
        || probe.runtimeVersionRoot !== core.runtimeVersionRoot
        || probe.providerConfigRoot !== core.providerConfigRoot
        || probe.modelConfigRoot !== core.modelConfigRoot
        || probe.supplyChainProvenanceDigest !== core.supplyChainProvenanceDigest) blockers.push(`staging_e2e_probe_release_binding_invalid:${probe.service}`);
      if (new Date(probe.startedAt).getTime() < new Date(core.testedDeploymentIssuedAt).getTime() - CLOCK_SKEW_MS) blockers.push(`staging_e2e_probe_before_deployment:${probe.service}`);
      if (new Date(core.issuedAt).getTime() - new Date(probe.completedAt).getTime() > MAX_PROBE_TO_RECEIPT_DELAY_MS) blockers.push(`staging_e2e_probe_stale_before_receipt:${probe.service}`);
    }
    const issuedAt = new Date(core.issuedAt);
    const expiresAt = new Date(core.expiresAt);
    if (args.current) {
      if (args.now.getTime() + CLOCK_SKEW_MS < issuedAt.getTime()) blockers.push("staging_e2e_receipt_not_active");
      if (args.now.getTime() >= expiresAt.getTime()) blockers.push("staging_e2e_receipt_expired");
    }
    const keys = new Map(args.trustBundle.keys.map((item) => [item.keyId, item]));
    const seen = new Set<string>();
    let valid = 0;
    let active = 0;
    const coreDigest = sha256Digest(canonicalJson(core));
    for (const signature of args.receipt.signatures ?? []) {
      const keyId = requiredId(signature?.keyId, "staging_e2e_signature_key_invalid");
      if (seen.has(keyId)) {
        blockers.push(`staging_e2e_signature_duplicate:${core.stagingSequence}:${keyId}`);
        continue;
      }
      seen.add(keyId);
      const key = keys.get(keyId);
      if (!key || !keyUsableAt(key, issuedAt)) {
        blockers.push(`staging_e2e_signer_invalid:${core.stagingSequence}:${keyId}`);
        continue;
      }
      if (!verifyPayload(key.publicKeyPem, commercialCohortStagingE2ESignaturePayload(coreDigest), signature.signature)) blockers.push(`staging_e2e_signature_invalid:${core.stagingSequence}:${keyId}`);
      else {
        valid += 1;
        if (key.status === "active") active += 1;
      }
    }
    if (valid < args.trustBundle.releaseSignatureThreshold) blockers.push(`staging_e2e_signature_threshold:${core.stagingSequence}:${valid}/${args.trustBundle.releaseSignatureThreshold}`);
    if (active < 1) blockers.push(`staging_e2e_active_signer_missing:${core.stagingSequence}`);
    const normalizedSignatures = (args.receipt.signatures ?? []).map((item) => ({ keyId: item.keyId, signature: item.signature })).sort((a, b) => a.keyId.localeCompare(b.keyId));
    const expectedDigest = sha256Digest(canonicalJson({ core, probes, signatures: normalizedSignatures }));
    if (args.receipt.stagingReceiptDigest !== expectedDigest) blockers.push(`staging_e2e_receipt_digest_invalid:${core.stagingSequence}`);
  } catch (error) {
    blockers.push(error instanceof Error ? error.message : "staging_e2e_receipt_validation_failed");
  }
  return uniqueSorted(blockers);
}

export function verifyCommercialCohortStagingE2EReceiptChain(args: {
  receipts: CommercialCohortStagingE2EReceipt[];
  trustBundles: CommercialCohortTrustBundle[];
  expectedAudience: string;
  expectedPromotionTarget: "staging" | "production";
  currentDeploymentReceipt: CommercialCohortDeploymentReceipt;
  minimumStagingSequence: number;
  now?: Date;
}): CommercialCohortStagingE2EVerification {
  const blockers: string[] = [];
  let current: CommercialCohortStagingE2EReceipt | null = null;
  try {
    if (!Array.isArray(args.receipts) || args.receipts.length < 1 || args.receipts.length > 1024) throw new Error("staging_e2e_receipt_chain_invalid");
    if (!Array.isArray(args.trustBundles) || !args.trustBundles.length) throw new Error("staging_e2e_trust_chain_missing");
    const minimum = Number(args.minimumStagingSequence);
    if (!Number.isInteger(minimum) || minimum < 1) throw new Error("staging_e2e_minimum_sequence_invalid");
    const now = args.now ?? new Date();
    const digests = new Set<string>();
    const nonces = new Set<string>();
    const probeRoots = new Set<string>();
    const runIds = new Set<string>();
    for (let index = 0; index < args.receipts.length; index += 1) {
      const receipt = args.receipts[index];
      if (receipt.stagingSequence !== index + 1) blockers.push(`staging_e2e_sequence_gap:${receipt.stagingSequence}/${index + 1}`);
      if (digests.has(receipt.stagingReceiptDigest)) blockers.push(`staging_e2e_digest_reused:${receipt.stagingSequence}`);
      if (nonces.has(receipt.nonce)) blockers.push(`staging_e2e_nonce_reused:${receipt.stagingSequence}`);
      if (probeRoots.has(receipt.probeRoot)) blockers.push(`staging_e2e_probe_root_reused:${receipt.stagingSequence}`);
      if (runIds.has(receipt.runIdDigest)) blockers.push(`staging_e2e_run_id_reused:${receipt.stagingSequence}`);
      digests.add(receipt.stagingReceiptDigest);
      nonces.add(receipt.nonce);
      probeRoots.add(receipt.probeRoot);
      runIds.add(receipt.runIdDigest);
      const trustBundle = args.trustBundles.find((item) => item.epoch === receipt.trustEpoch && item.bundleDigest === receipt.trustBundleDigest) ?? null;
      if (!trustBundle) blockers.push(`staging_e2e_trust_bundle_missing:${receipt.stagingSequence}`);
      else blockers.push(...verifySingleReceipt({
        receipt,
        previousReceipt: index > 0 ? args.receipts[index - 1] : null,
        trustBundle,
        current: index === args.receipts.length - 1,
        now,
      }));
      current = receipt;
    }
    if (!current) throw new Error("staging_e2e_current_receipt_missing");
    if (current.stagingSequence < minimum) blockers.push(`staging_e2e_rollback_floor:${current.stagingSequence}/${minimum}`);
    if (current.audience !== args.expectedAudience || current.promotionTarget !== args.expectedPromotionTarget) blockers.push("staging_e2e_identity_mismatch");
    const currentCandidate = commercialCohortReleaseCandidateDigest(args.currentDeploymentReceipt);
    if (current.releaseCandidateDigest !== currentCandidate) blockers.push("staging_e2e_release_candidate_mismatch");
    if (current.buildArtifactDigest !== args.currentDeploymentReceipt.buildArtifactDigest) blockers.push("staging_e2e_build_artifact_mismatch");
    if (current.sourcePackageDigest !== args.currentDeploymentReceipt.sourcePackageDigest) blockers.push("staging_e2e_source_package_mismatch");
    if (current.runtimeVersionRoot !== args.currentDeploymentReceipt.runtimeVersionRoot) blockers.push("staging_e2e_runtime_root_mismatch");
    if (current.providerConfigRoot !== args.currentDeploymentReceipt.providerConfigRoot) blockers.push("staging_e2e_provider_root_mismatch");
    if (current.modelConfigRoot !== args.currentDeploymentReceipt.modelConfigRoot) blockers.push("staging_e2e_model_root_mismatch");
    if (current.supplyChainProvenanceDigest !== args.currentDeploymentReceipt.supplyChainProvenanceDigest) blockers.push("staging_e2e_supply_chain_mismatch");
    if (args.expectedPromotionTarget === "production" && args.currentDeploymentReceipt.environment === "production" && new Date(current.completedAt).getTime() > new Date(args.currentDeploymentReceipt.issuedAt).getTime() + CLOCK_SKEW_MS) {
      blockers.push("staging_e2e_completed_after_production_deployment");
    }
  } catch (error) {
    blockers.push(error instanceof Error ? error.message : "staging_e2e_chain_validation_failed");
  }
  const uniqueBlockers = uniqueSorted(blockers);
  const stagingE2eVerified = uniqueBlockers.length === 0 && Boolean(current);
  const stagingE2eBound = stagingE2eVerified && Boolean(current
    && current.releaseCandidateDigest === commercialCohortReleaseCandidateDigest(args.currentDeploymentReceipt));
  const stagingRollbackProtected = stagingE2eVerified && Boolean(current && current.stagingSequence >= args.minimumStagingSequence);
  return {
    verified: stagingE2eVerified && stagingE2eBound && stagingRollbackProtected,
    stagingE2eVerified,
    stagingE2eBound,
    stagingRollbackProtected,
    stagingSequence: current?.stagingSequence ?? null,
    stagingReceiptDigest: current?.stagingReceiptDigest ?? null,
    probeCount: current?.probeCount ?? 0,
    blockers: uniqueBlockers,
  };
}
