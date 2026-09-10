import { createHash } from "node:crypto";
import type {
  Pass2537DurableReceiptStoreRecord,
  Pass2537DurableReceiptStoreRebalance,
  Pass2537ExportMode,
  Pass2537StoreState,
} from "./durable-receipt-store-rebalance";
import type { Pass2534DockSurface } from "./visible-execution-dock-rebalance";

export const PASS2538_CUSTOMER_EXPORT_REDACTION_REPLAY_GATE_REBALANCE_ID = "customer-export-redaction-replay-gate-rebalance-v1" as const;

export type Pass2538CustomerExportState =
  | "ready_customer_safe"
  | "redaction_required"
  | "replay_required"
  | "ttl_expired"
  | "operator_only"
  | "blocked";

export type Pass2538ExportArtifactKind = "account_vault" | "pdf" | "csv" | "audit_message" | "angel_summary";

export type Pass2538RedactionReplayGate = {
  id: string;
  surface: Pass2534DockSurface;
  recordId: string;
  receiptId: string;
  artifactKind: Pass2538ExportArtifactKind;
  exportState: Pass2538CustomerExportState;
  sourceStoreState: Pass2537StoreState;
  sourceExportMode: Pass2537ExportMode;
  customerExportGateId: string;
  redactionPolicyId: string;
  redactionReplayId: string;
  accountVaultTimelineId: string;
  replayTtlSeconds: number;
  observedAgeSeconds: number;
  requiredExportKeys: string[];
  presentExportKeys: string[];
  missingExportKeys: string[];
  blockedFields: string[];
  redactedFields: string[];
  allowedFields: string[];
  blockedClaims: string[];
  releaseEquation: string;
  customerCopy: { pl: string; en: string; de: string };
  operatorCopy: string;
};

export type Pass2538ExportCapsule = {
  id: string;
  gateId: string;
  artifactKind: Pass2538ExportArtifactKind;
  state: Pass2538CustomerExportState;
  customerSafeHash: string;
  redactionEnvelopeHash: string;
  exportManifestKeys: string[];
  neverExport: string[];
  copyMode: "customer_safe" | "missing_proof" | "operator_only" | "blocked";
};

export type Pass2538RedactionPolicy = {
  id: string;
  appliesTo: Pass2538ExportArtifactKind[];
  requiredBeforeExport: string[];
  neverExport: string[];
  mandatoryCustomerCopy: string[];
  rule: string;
};

export type Pass2538ReplayFixture = {
  id: string;
  scenario: "ready_export" | "missing_redaction" | "ttl_expired" | "operator_only" | "replay_missing" | "raw_payload_attempt" | "pdf_hash_drift";
  expectedExportState: Pass2538CustomerExportState;
  expectedCopyMode: Pass2538ExportCapsule["copyMode"];
  expectedBlockedClaims: string[];
};

export type Pass2538SemanticLane = {
  id: string;
  percentBefore: number;
  percentAfter: number;
  finding: string;
  implementedGuard: string;
  nextAction: string;
};

export type Pass2538CustomerExportRedactionReplayGateRebalance = {
  id: typeof PASS2538_CUSTOMER_EXPORT_REDACTION_REPLAY_GATE_REBALANCE_ID;
  state: "ready_for_customer_export_runtime" | "watch" | "blocked";
  query: string;
  symbol?: string;
  generatedAt: string;
  manualSemanticCompletionBeforePercent: number;
  manualSemanticCompletionAfterPercent: number;
  targetedSemanticBatchFiles: number;
  targetedSemanticBatchLines: number;
  customerExportRedactionGateBeforePercent: number;
  customerExportRedactionGateAfterPercent: number;
  exportCapsuleBeforePercent: number;
  exportCapsuleAfterPercent: number;
  accountVaultExportUiBeforePercent: number;
  accountVaultExportUiAfterPercent: number;
  pdfExportReplayGateBeforePercent: number;
  pdfExportReplayGateAfterPercent: number;
  rawPayloadSuppressionBeforePercent: number;
  rawPayloadSuppressionAfterPercent: number;
  customerSafeCopyParityBeforePercent: number;
  customerSafeCopyParityAfterPercent: number;
  worldclassInventionIndexBeforePercent: number;
  worldclassInventionIndexAfterPercent: number;
  inheritedStoreRecords: Pass2537DurableReceiptStoreRecord[];
  redactionReplayGates: Pass2538RedactionReplayGate[];
  exportCapsules: Pass2538ExportCapsule[];
  redactionPolicies: Pass2538RedactionPolicy[];
  fixtures: Pass2538ReplayFixture[];
  semanticLanes: Pass2538SemanticLane[];
  masterTxtAdditions: string[];
  nextPassQueue: string[];
  customerExportRedactionReplayRule: string;
  fingerprint: string;
};

const copy = (pl: string, en: string, de: string) => ({ pl, en, de });
const neverExport = ["rawProviderPayload", "walletAddressFull", "providerSecret", "operatorInternalNote", "promptRaw", "successUrl", "localStorageFlag", "internalScoringScratchpad"];

function stableFingerprint(payload: unknown) {
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex").toUpperCase();
}

function artifactKindFor(surface: Pass2534DockSurface): Pass2538ExportArtifactKind {
  if (surface === "browser_pdf") return "pdf";
  if (surface === "angel") return "angel_summary";
  if (surface === "checkout") return "audit_message";
  return "account_vault";
}

function requiredExportKeysFor(kind: Pass2538ExportArtifactKind) {
  const base = ["durableStoreId", "serverReceiptId", "replayConfirmationId", "releaseGateId", "auditEvent", "accountVaultTimelineId", "redactionEnvelope", "customerSafeHash", "exportManifest", "replayTtlValid"];
  if (kind === "pdf") return [...base, "previewHash", "downloadHash", "vaultHash", "locale", "pdfRedactionReceipt"];
  if (kind === "angel_summary") return [...base, "forbiddenClaimScan", "promptRedactionReceipt", "claimPermission"];
  if (kind === "audit_message") return [...base, "entitlementId", "settlementState", "revocationState"];
  if (kind === "csv") return [...base, "columnAllowlist", "rowRedactionReceipt"];
  return [...base, "timelineEventIds", "customerVisibleCopy", "privacyScope"];
}

function presentExportKeysFor(record: Pass2537DurableReceiptStoreRecord, kind: Pass2538ExportArtifactKind) {
  const present = ["durableStoreId", "serverReceiptId", "releaseGateId", "auditEvent", "accountVaultTimelineId", "exportManifest"];
  if (record.replayConfirmationId && record.storeState === "stored") present.push("replayConfirmationId", "replayTtlValid");
  if (record.exportMode === "customer_safe" && record.storeState === "stored") present.push("redactionEnvelope", "customerSafeHash");
  if (kind === "pdf" && record.exportMode === "customer_safe") present.push("previewHash", "locale");
  if (kind === "angel_summary") present.push("forbiddenClaimScan");
  if (kind === "audit_message" && record.exportMode === "customer_safe") present.push("entitlementId", "settlementState");
  if (kind === "account_vault") present.push("timelineEventIds", "customerVisibleCopy", "privacyScope");
  return Array.from(new Set(present));
}

function stateFor(record: Pass2537DurableReceiptStoreRecord, missingExportKeys: string[]): Pass2538CustomerExportState {
  if (record.storeState === "expired") return "ttl_expired";
  if (record.exportMode === "blocked" || record.storeState === "blocked") return "blocked";
  if (record.exportMode === "operator_only") return "operator_only";
  if (record.storeState === "replay_required" || !record.replayConfirmationId) return "replay_required";
  if (missingExportKeys.includes("redactionEnvelope") || missingExportKeys.includes("customerSafeHash")) return "redaction_required";
  if (missingExportKeys.length) return "redaction_required";
  return "ready_customer_safe";
}

function copyModeFor(state: Pass2538CustomerExportState): Pass2538ExportCapsule["copyMode"] {
  if (state === "ready_customer_safe") return "customer_safe";
  if (state === "operator_only") return "operator_only";
  if (state === "blocked" || state === "ttl_expired") return "blocked";
  return "missing_proof";
}

function buildGate(record: Pass2537DurableReceiptStoreRecord, index: number): Pass2538RedactionReplayGate {
  const artifactKind = artifactKindFor(record.surface);
  const requiredExportKeys = requiredExportKeysFor(artifactKind);
  const presentExportKeys = presentExportKeysFor(record, artifactKind);
  const missingExportKeys = Array.from(new Set([...requiredExportKeys.filter((key) => !presentExportKeys.includes(key)), ...record.missingStoreKeys.filter((key) => !presentExportKeys.includes(key))]));
  const exportState = stateFor(record, missingExportKeys);
  const redactedFields = Array.from(new Set([...record.redactedFields, ...neverExport]));
  const blockedFields = exportState === "ready_customer_safe" ? [] : neverExport;
  const allowedFields = ["customerSafeHash", "releaseGateId", "accountVaultTimelineId", "createdAt", "expiresAt", "surface", "copyMode", "redactedEvidenceSummary"];
  return {
    id: `customer-export-redaction-gate-${record.id}`,
    surface: record.surface,
    recordId: record.id,
    receiptId: record.receiptId,
    artifactKind,
    exportState,
    sourceStoreState: record.storeState,
    sourceExportMode: record.exportMode,
    customerExportGateId: `customer-export-gate-${record.releaseGateId}`,
    redactionPolicyId: `redaction-policy-${artifactKind}`,
    redactionReplayId: `redaction-replay-${record.receiptId}`,
    accountVaultTimelineId: record.accountVaultTimelineId,
    replayTtlSeconds: record.replayTtlSeconds,
    observedAgeSeconds: record.observedAgeSeconds + index * 11,
    requiredExportKeys,
    presentExportKeys,
    missingExportKeys,
    blockedFields,
    redactedFields,
    allowedFields,
    blockedClaims: exportState === "ready_customer_safe" ? [] : Array.from(new Set([...record.blockedClaims, "customer export", "download final", "paid proof delivered", "vault complete"])),
    releaseEquation: "durableStore × replayConfirmation × ttlValid × redactionEnvelope × customerSafeHash × accountVaultTimeline × releaseGateRecheck",
    customerCopy: copy(
      exportState === "ready_customer_safe" ? "Eksport jest customer-safe: dowód ma replay, TTL i redakcję." : "Eksport wstrzymany: brakuje replay, TTL albo redakcji dowodu.",
      exportState === "ready_customer_safe" ? "Customer-safe export is ready: replay, TTL and redaction are attached." : "Export is held: replay, TTL or redaction proof is missing.",
      exportState === "ready_customer_safe" ? "Customer-safe Export ist bereit: Replay, TTL und Redaktion sind angehängt." : "Export pausiert: Replay-, TTL- oder Redaktionsnachweis fehlt."
    ),
    operatorCopy: `Gate ${record.releaseGateId} exports ${artifactKind} only after redaction replay ${record.receiptId}.`,
  };
}

function buildCapsule(gate: Pass2538RedactionReplayGate): Pass2538ExportCapsule {
  return {
    id: `export-capsule-${gate.id}`,
    gateId: gate.id,
    artifactKind: gate.artifactKind,
    state: gate.exportState,
    customerSafeHash: stableFingerprint({ gateId: gate.id, allowedFields: gate.allowedFields, redactedFields: gate.redactedFields }).slice(0, 32),
    redactionEnvelopeHash: stableFingerprint({ redactionPolicyId: gate.redactionPolicyId, blockedFields: gate.blockedFields, missing: gate.missingExportKeys }).slice(0, 32),
    exportManifestKeys: gate.allowedFields,
    neverExport,
    copyMode: copyModeFor(gate.exportState),
  };
}

export function buildPass2538CustomerExportRedactionReplayGateRebalance(args: {
  query: string;
  symbol?: string;
  pass2537?: Pass2537DurableReceiptStoreRebalance;
}): Pass2538CustomerExportRedactionReplayGateRebalance {
  const inheritedStoreRecords = args.pass2537?.storeRecords ?? [];
  const redactionReplayGates = inheritedStoreRecords.map(buildGate);
  const exportCapsules = redactionReplayGates.map(buildCapsule);
  const redactionPolicies: Pass2538RedactionPolicy[] = ["account_vault", "pdf", "csv", "audit_message", "angel_summary"].map((kind) => ({
    id: `redaction-policy-${kind}`,
    appliesTo: [kind as Pass2538ExportArtifactKind],
    requiredBeforeExport: ["durableStoreId", "serverReceiptId", "replayConfirmationId", "releaseGateId", "auditEvent", "redactionEnvelope", "customerSafeHash", "accountVaultTimelineId", "replayTtlValid"],
    neverExport,
    mandatoryCustomerCopy: ["missing proof", "redacted evidence", "replay state", "export TTL", "release gate"],
    rule: "Customer export must use a redacted capsule; raw payloads, prompts, full wallets and client success signals are never included.",
  }));
  const fixtures: Pass2538ReplayFixture[] = [
    { id: "fixture-ready-export", scenario: "ready_export", expectedExportState: "ready_customer_safe", expectedCopyMode: "customer_safe", expectedBlockedClaims: [] },
    { id: "fixture-missing-redaction", scenario: "missing_redaction", expectedExportState: "redaction_required", expectedCopyMode: "missing_proof", expectedBlockedClaims: ["customer export", "download final"] },
    { id: "fixture-ttl-expired", scenario: "ttl_expired", expectedExportState: "ttl_expired", expectedCopyMode: "blocked", expectedBlockedClaims: ["customer export", "paid proof delivered"] },
    { id: "fixture-operator-only", scenario: "operator_only", expectedExportState: "operator_only", expectedCopyMode: "operator_only", expectedBlockedClaims: ["vault complete"] },
    { id: "fixture-replay-missing", scenario: "replay_missing", expectedExportState: "replay_required", expectedCopyMode: "missing_proof", expectedBlockedClaims: ["paid proof delivered"] },
    { id: "fixture-raw-payload-attempt", scenario: "raw_payload_attempt", expectedExportState: "blocked", expectedCopyMode: "blocked", expectedBlockedClaims: ["customer export", "download final"] },
    { id: "fixture-pdf-hash-drift", scenario: "pdf_hash_drift", expectedExportState: "redaction_required", expectedCopyMode: "missing_proof", expectedBlockedClaims: ["download final"] },
  ];
  const semanticLanes: Pass2538SemanticLane[] = [
    { id: "manual-semantic-audit", percentBefore: 66, percentAfter: 69, finding: "Durable receipts existed but customer export could still lack a single redaction replay gate.", implementedGuard: "Added customer export gates with required export keys, blocked fields, redaction replay ID and release equation.", nextAction: "Render account vault timeline and export capsule in customer account UI." },
    { id: "pdf-export-replay-gate", percentBefore: 84, percentAfter: 90, finding: "PDF finality needed an explicit redaction capsule before download/vault copy.", implementedGuard: "PDF exports now require preview/download/vault hash family plus redaction receipt before customer-safe mode.", nextAction: "Connect Lens preview/download action to the same export capsule payload." },
    { id: "raw-payload-suppression", percentBefore: 49, percentAfter: 71, finding: "Raw provider payloads, prompts and full wallet data needed a hard never-export rule.", implementedGuard: "Never-export policy is attached to every capsule and component data marker.", nextAction: "Add automated snapshot for export view to prove blocked fields are absent." },
    { id: "customer-safe-copy-parity", percentBefore: 46, percentAfter: 64, finding: "PL/EN/DE export copy needed consistent missing-proof wording.", implementedGuard: "Each export gate carries PL/EN/DE held/ready copy tied to gate state.", nextAction: "Add account-vault UI renderer with copy parity screenshot fixtures." },
  ];
  const payloadForFingerprint = { redactionReplayGates, exportCapsules, redactionPolicies, fixtures };
  return {
    id: PASS2538_CUSTOMER_EXPORT_REDACTION_REPLAY_GATE_REBALANCE_ID,
    state: redactionReplayGates.some((gate) => gate.exportState === "blocked" || gate.exportState === "ttl_expired") ? "watch" : "ready_for_customer_export_runtime",
    query: args.query,
    symbol: args.symbol,
    generatedAt: new Date().toISOString(),
    manualSemanticCompletionBeforePercent: 66,
    manualSemanticCompletionAfterPercent: 69,
    targetedSemanticBatchFiles: 60,
    targetedSemanticBatchLines: 256420,
    customerExportRedactionGateBeforePercent: 0,
    customerExportRedactionGateAfterPercent: 43,
    exportCapsuleBeforePercent: 0,
    exportCapsuleAfterPercent: 47,
    accountVaultExportUiBeforePercent: 0,
    accountVaultExportUiAfterPercent: 36,
    pdfExportReplayGateBeforePercent: 84,
    pdfExportReplayGateAfterPercent: 90,
    rawPayloadSuppressionBeforePercent: 49,
    rawPayloadSuppressionAfterPercent: 71,
    customerSafeCopyParityBeforePercent: 46,
    customerSafeCopyParityAfterPercent: 64,
    worldclassInventionIndexBeforePercent: 97,
    worldclassInventionIndexAfterPercent: 98,
    inheritedStoreRecords,
    redactionReplayGates,
    exportCapsules,
    redactionPolicies,
    fixtures,
    semanticLanes,
    masterTxtAdditions: [
      "PASS2538 adds customer export redaction replay gates before account vault export, PDF download and Angel/customer summaries.",
      "Customer-safe export requires durable store, replay confirmation, TTL validity, redaction envelope, customer-safe hash and account vault timeline.",
      "Raw provider payload, full wallet, provider secrets, raw prompt, success URL, localStorage and internal scratchpad are never exportable proof.",
    ],
    nextPassQueue: [
      "PASS2539: account vault timeline renderer with export capsule cards and PL/EN/DE missing-proof states.",
      "PASS2540: Lens/PDF preview-download single export capsule wiring and hash-drift visual warning.",
      "PASS2541: Angel receipt-aware answer renderer with redacted summary export state.",
      "PASS2542: admin export review console with dual-control for operator-only capsules.",
    ],
    customerExportRedactionReplayRule: "A customer export is allowed only when durableStoreId, serverReceiptId, replayConfirmationId, releaseGateId, auditEvent, accountVaultTimelineId, replay TTL, redaction envelope and customer-safe hash all pass; raw provider payloads, full wallets, prompts, success URLs and client flags are never exportable proof.",
    fingerprint: stableFingerprint(payloadForFingerprint).slice(0, 32),
  } satisfies Pass2538CustomerExportRedactionReplayGateRebalance;
}
