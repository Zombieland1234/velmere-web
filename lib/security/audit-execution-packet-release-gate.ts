import { createHmac, timingSafeEqual } from "node:crypto";

import type { AuditSourceCandidates } from "./audit-source-candidates";
import type { AuditIntakeCaseRecord, AuditIntakeTier } from "./audit-intake-case-vault";
import { hasForbiddenAsciiControlCharacter } from "./ascii-control-characters";
import {
  P82_CURRENT_DEPLOYMENT_READONLY_QUORUM_ID,
  verifyP82CurrentDeploymentReadonlyQuorumReceiptFromEnvironment,
  type P82CurrentDeploymentReadonlyQuorumReceipt,
} from "./audit-current-deployment-readonly-quorum-v2";
import { canonicalJson } from "./canonical-json";
import { sha256Digest } from "./cryptographic-digest";
import {
  AUDIT_CURRENT_DEPLOYMENT_FUTURE_SKEW_MS,
  AUDIT_CURRENT_DEPLOYMENT_MAX_AGE_MS,
  currentDeploymentTimestampBlocker,
} from "./audit-current-deployment-freshness-policy";

export const AUDIT_EXECUTION_PACKET_SCHEMA = "velmere.audit-execution-packet.v1" as const;
export const AUDIT_EXECUTION_RELEASE_GATE_SCHEMA = "velmere.audit-execution-release-gate.v1" as const;
export const AUDIT_EXECUTION_CURRENT_DEPLOYMENT_BINDING_SCHEMA = "velmere.audit-execution-current-deployment-binding.v1" as const;
export { AUDIT_CURRENT_DEPLOYMENT_MAX_AGE_MS } from "./audit-current-deployment-freshness-policy";

type AuditExecutionProxyKind = "NONE" | "EIP_1167_COMPATIBLE_MINIMAL_PROXY" | "EIP_1967" | "OTHER";
type AuditRemediationState = "NO_FINDINGS" | "OPEN_FINDINGS" | "RETEST_PENDING" | "RETESTED_CLOSED" | "RETEST_FAILED";
type AuditBenchmarkEvidenceClass = "LOCAL_SYNTHETIC" | "CASE_BOUND_INTERNAL" | "INDEPENDENT_EXTERNAL";

export type AuditExecutionCaseBinding = {
  caseRef: string;
  requestId: string;
  tier: AuditIntakeTier;
  targetKind: "contract" | "github" | "url";
  targetHash: string;
};

export type AuditExecutionScope = {
  chainId: string;
  contractAddressOrTarget: string;
  snapshotBlock: number;
  sourceCommit: string | null;
  sourceBundleSha256: string | null;
  sourceCandidatesSha256: string;
  compiler: {
    family: string;
    version: string;
    settingsSha256: string;
    artifactSha256: string;
  };
  proxy: {
    kind: AuditExecutionProxyKind;
    implementationAddress: string | null;
    bindingSha256: string;
  };
  included: string[];
  excluded: string[];
  methodology: {
    id: string;
    version: string;
    controls: string[];
    evidenceRootSha256: string;
  };
};

export type AuditTierValueComparison = {
  from: "basic" | "pro";
  to: "pro" | "advanced";
  receiptSha256: string;
  addedEvidenceFamilies: string[];
  addedMaterialFields: string[];
  addedScenarios: string[];
};

export type AuditExecutionPacketDraft = {
  schemaVersion: typeof AUDIT_EXECUTION_PACKET_SCHEMA;
  generatedAt: string;
  caseBinding: AuditExecutionCaseBinding;
  scope: AuditExecutionScope;
  currentDeployment: {
    schemaVersion: typeof AUDIT_EXECUTION_CURRENT_DEPLOYMENT_BINDING_SCHEMA;
    receiptDigest: string;
    receipt: P82CurrentDeploymentReadonlyQuorumReceipt;
  };
  remediation: {
    state: AuditRemediationState;
    findingSetSha256: string;
    originalSourceSha256: string | null;
    remediatedSourceSha256: string | null;
    retestReceiptRootSha256: string | null;
    openFindingCount: number;
    closedFindingCount: number;
  };
  matchedInputTierValue: {
    canonicalInputSha256: string;
    outputs: {
      basicSha256: string;
      proSha256: string;
      advancedSha256: string | null;
    };
    comparisons: AuditTierValueComparison[];
    benchmark: {
      receiptSha256: string;
      corpusSha256: string;
      evidenceClass: AuditBenchmarkEvidenceClass;
      matchedInputCaseCount: number;
      developmentValidationHoldoutSeparated: boolean;
      failureReportingComplete: boolean;
      cherryPickingExcluded: boolean;
    };
  };
};

export type AuditExecutionPacket = AuditExecutionPacketDraft & {
  packetDigest: string;
  signature: {
    keyId: string;
    hmacSha256: string;
  };
};

export type AuditExecutionPacketSigning = { keyId: string; secret: string };

export type AuditExecutionReleaseGateResult = {
  schemaVersion: typeof AUDIT_EXECUTION_RELEASE_GATE_SCHEMA;
  decision: "ALLOW_COMPLETE" | "WITHHOLD";
  completionAllowed: boolean;
  persistAllowed: boolean;
  expectedTier: AuditIntakeTier;
  caseRef: string;
  packetDigest: string | null;
  currentDeploymentReceiptDigest: string | null;
  matchedInputDigest: string | null;
  blockers: string[];
  releaseBindingDigest: string;
  truthBoundary: string;
};

const DIGEST = /^sha256:[a-f0-9]{64}$/;
const ADDRESS = /^0x[a-f0-9]{40}$/;
const COMMIT = /^[a-f0-9]{40}(?:[a-f0-9]{24})?$/;
const SAFE_ID = /^[a-zA-Z0-9][a-zA-Z0-9:._/-]{0,159}$/;
const HMAC = /^hmac-sha256:[a-f0-9]{64}$/;
const MAX_SCOPE_ROWS = 128;

function object(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function digest(value: unknown) {
  const normalized = String(value ?? "").trim().toLowerCase();
  return DIGEST.test(normalized) ? normalized : null;
}

function address(value: unknown) {
  const normalized = String(value ?? "").trim().toLowerCase();
  return ADDRESS.test(normalized) ? normalized : null;
}

function safeText(value: unknown, max = 160) {
  const normalized = typeof value === "string" ? value.trim() : "";
  return normalized.length > 0 && normalized.length <= max
    && !hasForbiddenAsciiControlCharacter(normalized) && !/[<>]/u.test(normalized)
    ? normalized
    : null;
}

function safeId(value: unknown) {
  const normalized = safeText(value, 160);
  return normalized && SAFE_ID.test(normalized) ? normalized : null;
}

function exactStringRows(value: unknown) {
  if (!Array.isArray(value) || value.length === 0 || value.length > MAX_SCOPE_ROWS) return null;
  const rows = value.map((item) => safeText(item, 240));
  if (rows.some((item) => !item)) return null;
  const normalized = rows as string[];
  return new Set(normalized).size === normalized.length ? normalized : null;
}

function finiteCount(value: unknown) {
  return Number.isInteger(value) && Number(value) >= 0 && Number(value) <= 100_000 ? Number(value) : null;
}

function canonicalIso(value: unknown) {
  const timestamp = Date.parse(String(value ?? ""));
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null;
}

function signingValid(signing: AuditExecutionPacketSigning) {
  return SAFE_ID.test(signing.keyId) && signing.secret.length >= 32;
}

function hmac(signing: AuditExecutionPacketSigning, packetDigest: string) {
  return `hmac-sha256:${createHmac("sha256", signing.secret).update(packetDigest).digest("hex")}`;
}

function safeEqual(left: string, right: string) {
  const leftBytes = Buffer.from(left);
  const rightBytes = Buffer.from(right);
  return leftBytes.length === rightBytes.length && timingSafeEqual(leftBytes, rightBytes);
}

function unsignedPacket(value: AuditExecutionPacket): AuditExecutionPacketDraft {
  const { packetDigest: _packetDigest, signature: _signature, ...draft } = value;
  return draft;
}

export function buildAuditSourceCandidatesDigest(value: AuditSourceCandidates | unknown) {
  return sha256Digest(canonicalJson(value ?? {}));
}

export function buildAuditExecutionMatchedInputDigest(input: {
  caseBinding: AuditExecutionCaseBinding;
  scope: AuditExecutionScope;
  currentDeploymentReceiptDigest: string;
}) {
  return sha256Digest(canonicalJson({
    schemaVersion: "velmere.audit-execution-matched-input.v1",
    caseBinding: input.caseBinding,
    scope: input.scope,
    currentDeploymentReceiptDigest: input.currentDeploymentReceiptDigest,
  }));
}

export function buildAuditExecutionReleaseBindingDigest(input: {
  expectedTier: AuditIntakeTier;
  caseRef: string;
  packetDigest: string | null;
  currentDeploymentReceiptDigest: string | null;
  matchedInputDigest: string | null;
  completionAllowed: boolean;
  blockers: string[];
}) {
  return sha256Digest(canonicalJson({
    schemaVersion: AUDIT_EXECUTION_RELEASE_GATE_SCHEMA,
    expectedTier: input.expectedTier,
    caseRef: input.caseRef,
    packetDigest: input.packetDigest,
    currentDeploymentReceiptDigest: input.currentDeploymentReceiptDigest,
    matchedInputDigest: input.matchedInputDigest,
    completionAllowed: input.completionAllowed,
    blockers: uniqueSorted(input.blockers),
  }));
}

export function sealAuditExecutionPacket(
  draft: AuditExecutionPacketDraft,
  signing: AuditExecutionPacketSigning,
): AuditExecutionPacket {
  if (!signingValid(signing)) throw new Error("audit_execution_packet_signing_invalid");
  const packetDigest = sha256Digest(canonicalJson(draft));
  return {
    ...draft,
    packetDigest,
    signature: { keyId: signing.keyId, hmacSha256: hmac(signing, packetDigest) },
  };
}

export function verifyAuditExecutionPacketSignature(
  value: unknown,
  signing: AuditExecutionPacketSigning,
): value is AuditExecutionPacket {
  if (!signingValid(signing)) return false;
  const packet = object(value) as AuditExecutionPacket | null;
  if (!packet || packet.schemaVersion !== AUDIT_EXECUTION_PACKET_SCHEMA) return false;
  const packetDigest = digest(packet.packetDigest);
  if (!packetDigest || packet.signature?.keyId !== signing.keyId || !HMAC.test(packet.signature?.hmacSha256 ?? "")) return false;
  const expectedDigest = sha256Digest(canonicalJson(unsignedPacket(packet)));
  return packetDigest === expectedDigest && safeEqual(packet.signature.hmacSha256, hmac(signing, packetDigest));
}

function signingFromEnvironment(keyId: string) {
  const current = {
    keyId: String(process.env.VELMERE_AUDIT_EXECUTION_PACKET_KEY_ID_CURRENT ?? "").trim(),
    secret: String(process.env.VELMERE_AUDIT_EXECUTION_PACKET_SECRET_CURRENT ?? ""),
  };
  if (keyId === current.keyId && signingValid(current)) return current;
  const previous = {
    keyId: String(process.env.VELMERE_AUDIT_EXECUTION_PACKET_KEY_ID_PREVIOUS ?? "").trim(),
    secret: String(process.env.VELMERE_AUDIT_EXECUTION_PACKET_SECRET_PREVIOUS ?? ""),
  };
  return keyId === previous.keyId && signingValid(previous) ? previous : null;
}

export function verifyAuditExecutionPacketSignatureFromEnvironment(value: unknown): value is AuditExecutionPacket {
  const keyId = String(object(object(value)?.signature)?.keyId ?? "");
  const signing = signingFromEnvironment(keyId);
  return Boolean(signing && verifyAuditExecutionPacketSignature(value, signing));
}

function requiredComparison(tier: AuditIntakeTier, rows: AuditTierValueComparison[]) {
  const keys = new Set(rows.map((row) => `${row.from}->${row.to}`));
  return keys.has("basic->pro") && (tier !== "advanced" || keys.has("pro->advanced"));
}

function validateComparisonRows(value: unknown, blockers: string[]) {
  if (!Array.isArray(value) || value.length === 0 || value.length > 4) {
    blockers.push("audit_execution_tier_comparison_missing");
    return [];
  }
  const rows = value as AuditTierValueComparison[];
  const keys: string[] = [];
  for (const row of rows) {
    const key = `${row?.from}->${row?.to}`;
    keys.push(key);
    if (!(["basic->pro", "pro->advanced"] as string[]).includes(key)) blockers.push("audit_execution_tier_comparison_pair_invalid");
    if (!digest(row?.receiptSha256)) blockers.push("audit_execution_tier_comparison_receipt_invalid");
    if (!exactStringRows(row?.addedEvidenceFamilies)) blockers.push("audit_execution_added_evidence_family_missing");
    if (!exactStringRows(row?.addedMaterialFields)) blockers.push("audit_execution_added_material_field_missing");
    if (!exactStringRows(row?.addedScenarios)) blockers.push("audit_execution_added_scenario_missing");
  }
  if (new Set(keys).size !== keys.length) blockers.push("audit_execution_tier_comparison_duplicate");
  return rows;
}

function uniqueSorted(values: string[]) {
  return [...new Set(values)].sort();
}

export function buildAuditExecutionPacketReleaseGate(input: {
  packet: unknown;
  record: AuditIntakeCaseRecord;
  expectedTier: AuditIntakeTier;
  now?: Date;
  dependencies?: {
    verifyPacketSignature?: (value: unknown) => boolean;
    verifyCurrentDeploymentReceipt?: (value: unknown) => boolean;
  };
}): AuditExecutionReleaseGateResult {
  const blockers: string[] = [];
  const now = input.now ?? new Date();
  const packetObject = object(input.packet);
  const packet = packetObject as AuditExecutionPacket | null;
  const verifyPacketSignature = input.dependencies?.verifyPacketSignature ?? verifyAuditExecutionPacketSignatureFromEnvironment;
  const verifyCurrentDeploymentReceipt = input.dependencies?.verifyCurrentDeploymentReceipt ?? verifyP82CurrentDeploymentReadonlyQuorumReceiptFromEnvironment;

  if (!packet || packet.schemaVersion !== AUDIT_EXECUTION_PACKET_SCHEMA) {
    blockers.push("audit_execution_packet_schema_invalid");
  }
  if (!verifyPacketSignature(input.packet)) blockers.push("audit_execution_packet_signature_invalid");

  const caseBinding = object(packet?.caseBinding) as AuditExecutionCaseBinding | null;
  const scope = object(packet?.scope) as AuditExecutionScope | null;
  const currentDeployment = object(packet?.currentDeployment);
  const currentReceipt = currentDeployment?.receipt as P82CurrentDeploymentReadonlyQuorumReceipt | undefined;
  const remediation = object(packet?.remediation);
  const tierValue = object(packet?.matchedInputTierValue);
  const outputs = object(tierValue?.outputs);
  const benchmark = object(tierValue?.benchmark);
  const recordChainId = safeId(input.record.target.chainId);
  const recordChainName = safeId(input.record.target.chainName);

  if (!caseBinding
    || caseBinding.caseRef !== input.record.caseRef
    || caseBinding.requestId !== input.record.requestId
    || caseBinding.tier !== input.expectedTier
    || caseBinding.tier !== input.record.tier
    || caseBinding.targetKind !== input.record.target.kind
    || caseBinding.targetHash !== input.record.target.targetHash) {
    blockers.push("audit_execution_case_binding_mismatch");
  }
  if (input.record.target.kind !== "contract") blockers.push("audit_execution_contract_target_required");
  if (input.record.target.kind === "contract" && (!recordChainId || !recordChainName)) {
    blockers.push("audit_execution_target_chain_revalidation_required");
  }
  if (input.record.tier !== input.expectedTier) blockers.push("audit_execution_expected_tier_mismatch");
  if (!input.record.accountId) blockers.push("audit_execution_account_binding_invalid");
  if (input.expectedTier === "basic") {
    if (input.record.status !== "queued_basic_prescreen"
      || input.record.entitlementRequired
      || input.record.entitlementVerified
      || input.record.entitlementId
      || input.record.analysisStarted) {
      blockers.push("audit_execution_basic_case_state_invalid");
    }
  } else if (!input.record.entitlementId || !input.record.entitlementVerified
    || !input.record.entitlementRequired || input.record.status !== "queued_paid_review") {
    blockers.push("audit_execution_entitlement_binding_invalid");
  }

  if (!scope) {
    blockers.push("audit_execution_scope_missing");
  } else {
    if (!safeId(scope.chainId)) blockers.push("audit_execution_chain_id_invalid");
    if (recordChainId && scope.chainId !== recordChainId) blockers.push("audit_execution_chain_id_case_mismatch");
    const canonicalTarget = address(input.record.target.canonicalTarget) ?? safeText(input.record.target.canonicalTarget, 600);
    const scopeTarget = address(scope.contractAddressOrTarget) ?? safeText(scope.contractAddressOrTarget, 600);
    if (!scopeTarget || scopeTarget !== canonicalTarget) blockers.push("audit_execution_target_scope_mismatch");
    if (!Number.isSafeInteger(scope.snapshotBlock) || scope.snapshotBlock <= 0) blockers.push("audit_execution_snapshot_block_invalid");
    if (scope.sourceCommit !== null && !COMMIT.test(String(scope.sourceCommit).toLowerCase())) blockers.push("audit_execution_source_commit_invalid");
    if (scope.sourceBundleSha256 !== null && !digest(scope.sourceBundleSha256)) blockers.push("audit_execution_source_bundle_invalid");
    if (!scope.sourceCommit && !scope.sourceBundleSha256) blockers.push("audit_execution_source_identity_missing");
    if (digest(scope.sourceCandidatesSha256) !== buildAuditSourceCandidatesDigest(input.record.sourceCandidates)) {
      blockers.push("audit_execution_source_candidates_mismatch");
    }
    if (!safeId(scope.compiler?.family) || !safeText(scope.compiler?.version, 80)
      || !digest(scope.compiler?.settingsSha256) || !digest(scope.compiler?.artifactSha256)) {
      blockers.push("audit_execution_compiler_binding_invalid");
    }
    if (!(["NONE", "EIP_1167_COMPATIBLE_MINIMAL_PROXY", "EIP_1967", "OTHER"] as string[]).includes(scope.proxy?.kind)
      || !digest(scope.proxy?.bindingSha256)
      || (scope.proxy?.kind === "NONE" ? scope.proxy.implementationAddress !== null : !address(scope.proxy?.implementationAddress))) {
      blockers.push("audit_execution_proxy_binding_invalid");
    }
    const included = exactStringRows(scope.included);
    const excluded = exactStringRows(scope.excluded);
    if (!included) blockers.push("audit_execution_scope_included_missing");
    if (!excluded) blockers.push("audit_execution_scope_excluded_missing");
    if (included && excluded && included.some((row) => excluded.includes(row))) blockers.push("audit_execution_scope_overlap");
    if (!safeId(scope.methodology?.id) || !safeText(scope.methodology?.version, 80)
      || !exactStringRows(scope.methodology?.controls) || !digest(scope.methodology?.evidenceRootSha256)) {
      blockers.push("audit_execution_methodology_binding_invalid");
    }
  }

  if (currentDeployment?.schemaVersion !== AUDIT_EXECUTION_CURRENT_DEPLOYMENT_BINDING_SCHEMA || !currentReceipt) {
    blockers.push("audit_execution_current_deployment_binding_missing");
  } else {
    if (!verifyCurrentDeploymentReceipt(currentReceipt)) blockers.push("audit_execution_p82_receipt_invalid");
    if (currentReceipt.schemaVersion !== "velmere.p82.current-deployment-readonly-quorum-receipt.v2"
      || currentReceipt.engineId !== P82_CURRENT_DEPLOYMENT_READONLY_QUORUM_ID) {
      blockers.push("audit_execution_p82_identity_invalid");
    }
    if (currentReceipt.caseRef !== input.record.caseRef) blockers.push("audit_execution_case_ref_p82_mismatch");
    if (!recordChainId || !recordChainName
      || currentReceipt.target?.chainId !== recordChainId
      || currentReceipt.target?.chainName !== recordChainName) {
      blockers.push("audit_execution_network_identity_p82_invalid");
    }
    if (digest(currentDeployment.receiptDigest) !== digest(currentReceipt.receiptDigest)) blockers.push("audit_execution_p82_receipt_digest_mismatch");
    if (scope && currentReceipt.target?.chainId !== scope.chainId) blockers.push("audit_execution_chain_id_p82_mismatch");
    if (scope && address(currentReceipt.target?.address) !== address(scope.contractAddressOrTarget)) blockers.push("audit_execution_target_p82_mismatch");
    if (scope && currentReceipt.snapshot?.blockNumber !== scope.snapshotBlock) blockers.push("audit_execution_snapshot_block_p82_mismatch");
    if (scope && currentReceipt.deployment?.proxyKind !== scope.proxy?.kind) blockers.push("audit_execution_proxy_kind_p82_mismatch");
    if (scope && address(currentReceipt.deployment?.implementationAddress) !== address(scope.proxy?.implementationAddress)) {
      blockers.push("audit_execution_proxy_implementation_p82_mismatch");
    }
    if (currentReceipt.executionClass !== "PUBLIC_READONLY_CURRENT"
      || currentReceipt.transportClass !== "DEFAULT_NETWORK_STACK"
      || currentReceipt.classification !== "PASS_EXACT_BLOCK_RUNTIME_PROXY_FORWARDER_QUORUM"
      || currentReceipt.proof?.exactBlockConsensusProven !== true
      || currentReceipt.proof?.currentRuntimeStateProven !== true
      || currentReceipt.proof?.currentProxyImplementationProven !== true
      || currentReceipt.proof?.currentTrustedForwarderStateProven !== true
      || currentReceipt.rights?.customerFactRightsEligible !== true
      || currentReceipt.customerCurrentRuntimeFactEligible !== true) {
      blockers.push("audit_execution_current_deployment_quorum_not_release_eligible");
    }
    const receiptGeneratedAt = canonicalIso(currentReceipt.generatedAt);
    const packetGeneratedAt = canonicalIso(packet?.generatedAt);
    if (!receiptGeneratedAt || !packetGeneratedAt || packetGeneratedAt !== receiptGeneratedAt) {
      blockers.push("audit_execution_current_deployment_time_binding_mismatch");
    } else {
      const age = now.getTime() - Date.parse(receiptGeneratedAt);
      if (!Number.isFinite(age) || age < -AUDIT_CURRENT_DEPLOYMENT_FUTURE_SKEW_MS) blockers.push("audit_execution_current_deployment_receipt_from_future");
      if (age > AUDIT_CURRENT_DEPLOYMENT_MAX_AGE_MS) blockers.push("audit_execution_current_deployment_receipt_stale");
    }
    const snapshotTimeBlocker = currentDeploymentTimestampBlocker(currentReceipt.snapshot?.timestamp, now);
    if (snapshotTimeBlocker === "current_deployment_snapshot_stale") {
      blockers.push("audit_execution_current_deployment_snapshot_stale");
    } else if (snapshotTimeBlocker === "current_deployment_snapshot_from_future") {
      blockers.push("audit_execution_current_deployment_snapshot_from_future");
    } else if (snapshotTimeBlocker) {
      blockers.push("audit_execution_current_deployment_snapshot_timestamp_invalid");
    }
  }

  if (!remediation || !digest(remediation.findingSetSha256)) {
    blockers.push("audit_execution_remediation_binding_invalid");
  } else {
    const openCount = finiteCount(remediation.openFindingCount);
    const closedCount = finiteCount(remediation.closedFindingCount);
    if (openCount === null || closedCount === null) blockers.push("audit_execution_finding_counts_invalid");
    if (remediation.state === "NO_FINDINGS") {
      if (openCount !== 0 || closedCount !== 0) blockers.push("audit_execution_no_findings_counts_invalid");
    } else if (remediation.state === "RETESTED_CLOSED") {
      if (openCount !== 0 || closedCount === null || closedCount < 1
        || !digest(remediation.originalSourceSha256)
        || !digest(remediation.remediatedSourceSha256)
        || remediation.originalSourceSha256 === remediation.remediatedSourceSha256
        || !digest(remediation.retestReceiptRootSha256)) {
        blockers.push("audit_execution_retest_closure_invalid");
      }
    } else if (["OPEN_FINDINGS", "RETEST_PENDING", "RETEST_FAILED"].includes(String(remediation.state))) {
      blockers.push("audit_execution_remediation_not_closed");
    } else {
      blockers.push("audit_execution_remediation_state_invalid");
    }
  }

  const expectedMatchedInput = caseBinding && scope && digest(currentDeployment?.receiptDigest)
    ? buildAuditExecutionMatchedInputDigest({
        caseBinding,
        scope,
        currentDeploymentReceiptDigest: String(currentDeployment?.receiptDigest),
      })
    : null;
  if (!tierValue || !expectedMatchedInput || digest(tierValue.canonicalInputSha256) !== expectedMatchedInput) {
    blockers.push("audit_execution_matched_input_digest_mismatch");
  }
  const basicOutput = digest(outputs?.basicSha256);
  const proOutput = digest(outputs?.proSha256);
  const advancedOutput = outputs?.advancedSha256 === null ? null : digest(outputs?.advancedSha256);
  if (!basicOutput || !proOutput || basicOutput === proOutput) blockers.push("audit_execution_basic_pro_value_not_distinct");
  if ((input.expectedTier === "basic" || input.expectedTier === "pro") && outputs?.advancedSha256 !== null) {
    blockers.push("audit_execution_non_advanced_packet_contains_advanced_output");
  }
  if (input.expectedTier === "advanced" && (!advancedOutput || advancedOutput === basicOutput || advancedOutput === proOutput)) {
    blockers.push("audit_execution_pro_advanced_value_not_distinct");
  }
  const comparisons = validateComparisonRows(tierValue?.comparisons, blockers);
  if (!requiredComparison(input.expectedTier, comparisons)) blockers.push("audit_execution_required_matched_tier_comparison_missing");
  if ((input.expectedTier === "basic" || input.expectedTier === "pro")
    && comparisons.some((row) => row.from === "pro" || row.to === "advanced")) {
    blockers.push("audit_execution_non_advanced_packet_contains_advanced_comparison");
  }
  if (!benchmark || !digest(benchmark.receiptSha256) || !digest(benchmark.corpusSha256)
    || !Number.isInteger(benchmark.matchedInputCaseCount) || Number(benchmark.matchedInputCaseCount) < 1
    || benchmark.developmentValidationHoldoutSeparated !== true
    || benchmark.failureReportingComplete !== true
    || benchmark.cherryPickingExcluded !== true) {
    blockers.push("audit_execution_benchmark_evidence_invalid");
  }
  if (!benchmark || !["CASE_BOUND_INTERNAL", "INDEPENDENT_EXTERNAL"].includes(String(benchmark.evidenceClass))) {
    blockers.push("audit_execution_case_bound_benchmark_required");
  }

  const uniqueBlockers = uniqueSorted(blockers);
  const completionAllowed = uniqueBlockers.length === 0;
  const packetDigest = digest(packet?.packetDigest);
  const currentDeploymentReceiptDigest = digest(currentDeployment?.receiptDigest);
  const matchedInputDigest = digest(tierValue?.canonicalInputSha256);
  const releaseBindingDigest = buildAuditExecutionReleaseBindingDigest({
    expectedTier: input.expectedTier,
    caseRef: input.record.caseRef,
    packetDigest,
    currentDeploymentReceiptDigest,
    matchedInputDigest,
    completionAllowed,
    blockers: uniqueBlockers,
  });
  return {
    schemaVersion: AUDIT_EXECUTION_RELEASE_GATE_SCHEMA,
    decision: completionAllowed ? "ALLOW_COMPLETE" : "WITHHOLD",
    completionAllowed,
    persistAllowed: completionAllowed,
    expectedTier: input.expectedTier,
    caseRef: input.record.caseRef,
    packetDigest,
    currentDeploymentReceiptDigest,
    matchedInputDigest,
    blockers: uniqueBlockers,
    releaseBindingDigest,
    truthBoundary: "This gate proves a signed case/scope/source/compiler/proxy/current-deployment/retest/matched-input binding only. It does not create provider, staging, independent-review, customer, FINAL, GO_PAID or LIVE proof.",
  };
}

export function buildBasicAuditWorkerExecutionContract(record: AuditIntakeCaseRecord) {
  if (record.tier !== "basic") throw new Error("basic_audit_worker_contract_tier_mismatch");
  const accountBound = Boolean(record.accountId);
  const queueEligible = accountBound
    && record.status === "queued_basic_prescreen"
    && Boolean(record.target.chainId && record.target.chainName)
    && !record.entitlementRequired
    && !record.entitlementVerified
    && !record.entitlementId
    && !record.analysisStarted;
  return {
    schemaVersion: "velmere.basic-audit-worker-execution-contract.v1" as const,
    caseRef: record.caseRef,
    tier: record.tier,
    accountBound,
    claimAllowed: queueEligible,
    settleAllowed: queueEligible,
    persistAllowed: queueEligible,
    reason: queueEligible ? null : "basic_audit_case_not_queue_eligible",
    requiredPacketSchema: AUDIT_EXECUTION_PACKET_SCHEMA,
    truthBoundary: "This contract admits an account-owned queued Basic case to the server worker only. Completion still requires the signed execution gate, current P82 evidence, immutable exact PDF bytes and an atomic owner-bound store; it creates no provider, staging, customer, FINAL, GO_PAID or LIVE proof.",
  };
}

export function buildAuditExecutionReleaseSnapshotBinding(result: AuditExecutionReleaseGateResult) {
  if (!result.completionAllowed || !result.persistAllowed || result.decision !== "ALLOW_COMPLETE"
    || !result.packetDigest || !result.currentDeploymentReceiptDigest || !result.matchedInputDigest) {
    throw new Error("audit_execution_release_not_persistable");
  }
  return {
    schemaVersion: result.schemaVersion,
    decision: result.decision,
    completionAllowed: true as const,
    persistAllowed: true as const,
    expectedTier: result.expectedTier,
    caseRef: result.caseRef,
    packetDigest: result.packetDigest,
    currentDeploymentReceiptDigest: result.currentDeploymentReceiptDigest,
    matchedInputDigest: result.matchedInputDigest,
    releaseBindingDigest: result.releaseBindingDigest,
  };
}
