import { randomBytes } from "node:crypto";
import {
  runRegisteredServiceRoleRpc,
  type SupabaseRpcOperation,
} from "@/lib/db/supabase-rpc-operation-registry";

export const PUBLIC_PROOF_RUNTIME_STATE =
  "DURABLE_SERVER_OWNED_VERIFY_PUBLICATION_REGISTRY" as const;

const PUBLIC_PROOF_ID = /^pubidx-[a-f0-9]{48}$/u;
const CHAIN_ID = /^[1-9][0-9]{0,19}$/u;
const CONTRACT_ADDRESS = /^0x[a-f0-9]{40}$/u;
const CONTRACT_ADDRESS_INPUT = /^0x[a-fA-F0-9]{40}$/u;
const SHA256 = /^[a-f0-9]{64}$/u;
const BLOCK_HASH = /^0x[a-f0-9]{64}$/u;
const BLOCK_NUMBER = /^(?:0|[1-9][0-9]{0,77})$/u;

const VERIFY_STATUSES = new Set([
  "VERIFIED",
  "CHANGE_DETECTED",
  "REVALIDATION_REQUIRED",
  "REVALIDATING",
  "VERIFIED_AGAIN",
  "MONITORING_UNAVAILABLE",
] as const);
const GREEN_VERIFY_STATUSES = new Set(["VERIFIED", "VERIFIED_AGAIN"] as const);
const VERIFY_VISIBILITIES = new Set([
  "PUBLIC",
  "PUBLIC_SUMMARY_PRIVATE_REPORT",
  "PRIVATE",
] as const);
const PUBLIC_VERIFY_VISIBILITIES = new Set([
  "PUBLIC",
  "PUBLIC_SUMMARY_PRIVATE_REPORT",
] as const);
const VERIFY_RISK_STATUSES = new Set([
  "LOW_DETECTED_RISK",
  "ELEVATED_RISK",
  "HIGH_RISK",
  "CRITICAL_RISK",
  "INSUFFICIENT_EVIDENCE",
  "WITHHELD",
] as const);
const VERIFY_EVENT_KINDS = new Set([
  "INITIAL_VERIFICATION",
  "MONITOR_CHECK",
  "MONITORING_FAILURE",
  "REVALIDATION_REQUIRED",
  "REVALIDATION_STARTED",
  "REVALIDATION_COMPLETED",
  "VISIBILITY_CHANGED",
] as const);

export type VerifyStatus =
  | "VERIFIED"
  | "CHANGE_DETECTED"
  | "REVALIDATION_REQUIRED"
  | "REVALIDATING"
  | "VERIFIED_AGAIN"
  | "MONITORING_UNAVAILABLE";
export type VerifyVisibility =
  | "PUBLIC"
  | "PUBLIC_SUMMARY_PRIVATE_REPORT"
  | "PRIVATE";
export type PublicVerifyVisibility = Exclude<VerifyVisibility, "PRIVATE">;
export type VerifyRiskStatus =
  | "LOW_DETECTED_RISK"
  | "ELEVATED_RISK"
  | "HIGH_RISK"
  | "CRITICAL_RISK"
  | "INSUFFICIENT_EVIDENCE"
  | "WITHHELD";
export type VerifyEventKind =
  | "INITIAL_VERIFICATION"
  | "MONITOR_CHECK"
  | "MONITORING_FAILURE"
  | "REVALIDATION_REQUIRED"
  | "REVALIDATION_STARTED"
  | "REVALIDATION_COMPLETED"
  | "VISIBILITY_CHANGED";

export type PublishedPublicProof = {
  schemaVersion: "velmere.verify-public-projection.v1";
  publicProofId: string;
  visibility: PublicVerifyVisibility;
  currentStatus: VerifyStatus;
  riskStatus: VerifyRiskStatus;
  chainId: string;
  contractAddress: string;
  projectName: string | null;
  reportTitle: string;
  publicSummary: string;
  auditVersion: number;
  publicationVersion: number;
  reportDigest: string | null;
  currentDeploymentDigest: string;
  lastCheckedAt: string;
  monitorDueAt: string;
  statusChangedAt: string;
  historyVisibility: "PUBLIC" | "PRIVATE";
  headEventDigest: string;
  canonicalPath: string;
  materialChangeDetected: boolean;
  monitoringCurrent: boolean;
  reportCurrent: boolean;
};

export type PublishedPublicProofHistoryEntry = {
  schemaVersion: "velmere.verify-public-history-entry.v1";
  publicProofId: string;
  publicationVersion: number;
  auditVersion: number;
  eventKind: VerifyEventKind;
  status: VerifyStatus;
  riskStatus: VerifyRiskStatus;
  reportDigest: string | null;
  currentDeploymentDigest: string;
  checkedBlockNumber: string;
  checkedBlockHash: string;
  checkedAt: string;
  monitorDueAt: string;
  eventAt: string;
  eventDigest: string;
  previousEventDigest: string | null;
  historicalReportVisibility: "PUBLIC" | "PRIVATE";
};

export type VerifyPublicationAppendReceipt = {
  schemaVersion: "velmere.verify-publication-append-receipt.v1";
  publicProofId: string;
  publicationVersion: number;
  auditVersion: number;
  currentStatus: VerifyStatus;
  visibility: VerifyVisibility;
  eventDigest: string;
  previousEventDigest: string | null;
  idempotent: boolean;
  eventAt: string;
};

export type VerifyRpcRunner = (input: {
  operation: SupabaseRpcOperation;
  args?: Record<string, unknown>;
}) => Promise<{ data: unknown }>;

export type ServerOwnedPublicProofResolver = {
  authority: "server_owned_publication_registry";
  resolveExact(publicProofId: string): Promise<unknown>;
};

export type VerifySearchInput =
  | { mode: "identity"; chainId: string; contractAddress: string; limit: number }
  | { mode: "project"; projectName: string; limit: number };

export type AppendVerifyPublicationEventInput = {
  idempotencyKey: string;
  publicProofId: string;
  chainId: string;
  contractAddress: string;
  eventKind: VerifyEventKind;
  visibility: VerifyVisibility;
  projectName?: string | null;
  reportTitle?: string | null;
  publicSummary?: string | null;
  riskStatus?: VerifyRiskStatus | null;
  reportDigest?: string | null;
  deploymentDigest?: string | null;
  verificationReceiptDigest: string;
  actorDigest: string;
  checkedBlockNumber?: string | null;
  checkedBlockHash?: string | null;
  checkedAt?: string | null;
  monitoringTtlSeconds?: number | null;
  expectedPreviousEventDigest?: string | null;
};

export function createVerifyPublicProofId(
  random: (size: number) => Uint8Array = randomBytes,
) {
  const entropy = random(24);
  if (!(entropy instanceof Uint8Array) || entropy.byteLength !== 24) {
    throw new Error("verify_public_proof_entropy_invalid");
  }
  return `pubidx-${Buffer.from(entropy).toString("hex")}`;
}

const PROJECTION_KEYS = new Set([
  "schemaVersion", "publicProofId", "visibility", "currentStatus", "riskStatus",
  "chainId", "contractAddress", "projectName", "reportTitle", "publicSummary",
  "auditVersion", "publicationVersion", "reportDigest", "currentDeploymentDigest",
  "lastCheckedAt", "monitorDueAt", "statusChangedAt", "historyVisibility",
  "headEventDigest", "canonicalPath", "materialChangeDetected", "monitoringCurrent",
  "reportCurrent",
]);

const HISTORY_KEYS = new Set([
  "schemaVersion", "publicProofId", "publicationVersion", "auditVersion", "eventKind",
  "status", "riskStatus", "reportDigest", "currentDeploymentDigest",
  "checkedBlockNumber", "checkedBlockHash", "checkedAt", "monitorDueAt", "eventAt",
  "eventDigest", "previousEventDigest", "historicalReportVisibility",
]);

const APPEND_RECEIPT_KEYS = new Set([
  "schemaVersion", "publicProofId", "publicationVersion", "auditVersion", "currentStatus",
  "visibility", "eventDigest", "previousEventDigest", "idempotent", "eventAt",
]);

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function hasExactKeys(record: Record<string, unknown>, keys: Set<string>) {
  const actual = Object.keys(record);
  return actual.length === keys.size && actual.every((key) => keys.has(key));
}

function isSafeText(value: unknown, minimum: number, maximum: number) {
  return typeof value === "string"
    && value.length >= minimum
    && value.length <= maximum
    && value === value.trim()
    && !Array.from(value).some((character) => {
      const codePoint = character.codePointAt(0) ?? 0;
      return codePoint <= 0x1f || codePoint === 0x7f;
    });
}

function normalizeTimestamp(value: unknown) {
  if (typeof value !== "string" || value.length < 20 || value.length > 40) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : null;
}

function isSafeVersion(value: unknown) {
  return Number.isSafeInteger(value) && Number(value) >= 1;
}

function normalizeProjectionTimestamps(record: Record<string, unknown>) {
  const lastCheckedAt = normalizeTimestamp(record.lastCheckedAt);
  const monitorDueAt = normalizeTimestamp(record.monitorDueAt);
  const statusChangedAt = normalizeTimestamp(record.statusChangedAt);
  if (!lastCheckedAt || !monitorDueAt || !statusChangedAt) return null;
  return { ...record, lastCheckedAt, monitorDueAt, statusChangedAt } as Record<string, unknown>;
}

function parsePublishedPublicProof(
  value: unknown,
  expected?: { publicProofId?: string; chainId?: string; contractAddress?: string },
  now = new Date(),
): PublishedPublicProof | null {
  if (!isPlainRecord(value) || !hasExactKeys(value, PROJECTION_KEYS)) return null;
  const normalized = normalizeProjectionTimestamps(value);
  if (!normalized) return null;
  const status = normalized.currentStatus;
  const visibility = normalized.visibility;
  const riskStatus = normalized.riskStatus;
  if (
    normalized.schemaVersion !== "velmere.verify-public-projection.v1"
    || typeof normalized.publicProofId !== "string"
    || !PUBLIC_PROOF_ID.test(normalized.publicProofId)
    || !PUBLIC_VERIFY_VISIBILITIES.has(visibility as PublicVerifyVisibility)
    || !VERIFY_STATUSES.has(status as VerifyStatus)
    || !VERIFY_RISK_STATUSES.has(riskStatus as VerifyRiskStatus)
    || typeof normalized.chainId !== "string" || !CHAIN_ID.test(normalized.chainId)
    || typeof normalized.contractAddress !== "string"
    || !CONTRACT_ADDRESS.test(normalized.contractAddress)
    || !(normalized.projectName === null || isSafeText(normalized.projectName, 2, 120))
    || !isSafeText(normalized.reportTitle, 4, 160)
    || !isSafeText(normalized.publicSummary, 8, 600)
    || !isSafeVersion(normalized.auditVersion)
    || !isSafeVersion(normalized.publicationVersion)
    || typeof normalized.currentDeploymentDigest !== "string"
    || !SHA256.test(normalized.currentDeploymentDigest)
    || typeof normalized.headEventDigest !== "string"
    || !SHA256.test(normalized.headEventDigest)
    || normalized.canonicalPath !== `/proof/market-integrity/${normalized.publicProofId}`
  ) return null;
  if (expected?.publicProofId !== undefined && normalized.publicProofId !== expected.publicProofId) {
    return null;
  }
  if (expected?.chainId !== undefined && normalized.chainId !== expected.chainId) return null;
  if (expected?.contractAddress !== undefined
    && normalized.contractAddress !== expected.contractAddress) return null;

  const green = GREEN_VERIFY_STATUSES.has(status as "VERIFIED" | "VERIFIED_AGAIN");
  const changed = status === "CHANGE_DETECTED"
    || status === "REVALIDATION_REQUIRED"
    || status === "REVALIDATING";
  if (
    normalized.monitoringCurrent !== green
    || normalized.reportCurrent !== green
    || normalized.materialChangeDetected !== changed
    || (!green && riskStatus !== "WITHHELD")
    || (green && Date.parse(normalized.monitorDueAt as string) <= now.getTime())
    || Date.parse(normalized.lastCheckedAt as string) > now.getTime() + 60_000
    || Date.parse(normalized.statusChangedAt as string) > now.getTime() + 60_000
  ) return null;

  if (visibility === "PUBLIC") {
    if (normalized.historyVisibility !== "PUBLIC") return null;
    if (green) {
      if (typeof normalized.reportDigest !== "string"
        || !SHA256.test(normalized.reportDigest)) return null;
    } else if (normalized.reportDigest !== null) return null;
  } else if (normalized.historyVisibility !== "PRIVATE" || normalized.reportDigest !== null) {
    return null;
  }
  return normalized as PublishedPublicProof;
}

function parseHistoryEntry(value: unknown): PublishedPublicProofHistoryEntry | null {
  if (!isPlainRecord(value) || !hasExactKeys(value, HISTORY_KEYS)) return null;
  const checkedAt = normalizeTimestamp(value.checkedAt);
  const monitorDueAt = normalizeTimestamp(value.monitorDueAt);
  const eventAt = normalizeTimestamp(value.eventAt);
  if (!checkedAt || !monitorDueAt || !eventAt) return null;
  const normalized = { ...value, checkedAt, monitorDueAt, eventAt } as Record<string, unknown>;
  if (
    normalized.schemaVersion !== "velmere.verify-public-history-entry.v1"
    || typeof normalized.publicProofId !== "string"
    || !PUBLIC_PROOF_ID.test(normalized.publicProofId)
    || !isSafeVersion(normalized.publicationVersion)
    || !isSafeVersion(normalized.auditVersion)
    || !VERIFY_EVENT_KINDS.has(normalized.eventKind as VerifyEventKind)
    || !VERIFY_STATUSES.has(normalized.status as VerifyStatus)
    || !VERIFY_RISK_STATUSES.has(normalized.riskStatus as VerifyRiskStatus)
    || typeof normalized.currentDeploymentDigest !== "string"
    || !SHA256.test(normalized.currentDeploymentDigest)
    || typeof normalized.checkedBlockNumber !== "string"
    || !BLOCK_NUMBER.test(normalized.checkedBlockNumber)
    || typeof normalized.checkedBlockHash !== "string"
    || !BLOCK_HASH.test(normalized.checkedBlockHash)
    || typeof normalized.eventDigest !== "string" || !SHA256.test(normalized.eventDigest)
    || !(normalized.previousEventDigest === null
      || (typeof normalized.previousEventDigest === "string"
        && SHA256.test(normalized.previousEventDigest)))
    || (normalized.historicalReportVisibility !== "PUBLIC"
      && normalized.historicalReportVisibility !== "PRIVATE")
  ) return null;
  if (!GREEN_VERIFY_STATUSES.has(normalized.status as "VERIFIED" | "VERIFIED_AGAIN")
    && normalized.riskStatus !== "WITHHELD") return null;
  if (normalized.historicalReportVisibility === "PUBLIC") {
    if (typeof normalized.reportDigest !== "string" || !SHA256.test(normalized.reportDigest)) {
      return null;
    }
  } else if (normalized.reportDigest !== null) return null;
  return normalized as PublishedPublicProofHistoryEntry;
}

function parseAppendReceipt(value: unknown): VerifyPublicationAppendReceipt | null {
  if (!isPlainRecord(value) || !hasExactKeys(value, APPEND_RECEIPT_KEYS)) return null;
  const eventAt = normalizeTimestamp(value.eventAt);
  if (
    !eventAt
    || value.schemaVersion !== "velmere.verify-publication-append-receipt.v1"
    || typeof value.publicProofId !== "string" || !PUBLIC_PROOF_ID.test(value.publicProofId)
    || !isSafeVersion(value.publicationVersion) || !isSafeVersion(value.auditVersion)
    || !VERIFY_STATUSES.has(value.currentStatus as VerifyStatus)
    || !VERIFY_VISIBILITIES.has(value.visibility as VerifyVisibility)
    || typeof value.eventDigest !== "string" || !SHA256.test(value.eventDigest)
    || !(value.previousEventDigest === null
      || (typeof value.previousEventDigest === "string" && SHA256.test(value.previousEventDigest)))
    || typeof value.idempotent !== "boolean"
  ) return null;
  return { ...value, eventAt } as VerifyPublicationAppendReceipt;
}

function exactRpcObject(value: unknown) {
  if (Array.isArray(value) && value.length === 1 && isPlainRecord(value[0])) return value[0];
  return value;
}

export function canonicalizeVerifySearchInput(input: {
  chainId?: unknown;
  contractAddress?: unknown;
  projectName?: unknown;
  limit?: unknown;
}): VerifySearchInput | null {
  const limitValue = input.limit === undefined ? 5 : Number(input.limit);
  if (!Number.isSafeInteger(limitValue) || limitValue < 1 || limitValue > 10) return null;
  const chainSupplied = input.chainId !== undefined && input.chainId !== null && input.chainId !== "";
  const addressSupplied = input.contractAddress !== undefined
    && input.contractAddress !== null && input.contractAddress !== "";
  const projectSupplied = input.projectName !== undefined
    && input.projectName !== null && input.projectName !== "";
  if (chainSupplied || addressSupplied) {
    if (!chainSupplied || !addressSupplied || projectSupplied
      || typeof input.chainId !== "string" || !CHAIN_ID.test(input.chainId)
      || typeof input.contractAddress !== "string"
      || !CONTRACT_ADDRESS_INPUT.test(input.contractAddress)) return null;
    return {
      mode: "identity",
      chainId: input.chainId,
      contractAddress: input.contractAddress.toLowerCase(),
      limit: limitValue,
    };
  }
  if (!projectSupplied || typeof input.projectName !== "string"
    || !isSafeText(input.projectName, 2, 120)) return null;
  return { mode: "project", projectName: input.projectName, limit: limitValue };
}

export async function resolvePublishedPublicProofWithServerOwnedResolver(
  publicProofId: string,
  resolver: ServerOwnedPublicProofResolver,
  now = new Date(),
): Promise<PublishedPublicProof | null> {
  if (!PUBLIC_PROOF_ID.test(publicProofId)
    || resolver.authority !== "server_owned_publication_registry") return null;
  try {
    return parsePublishedPublicProof(
      await resolver.resolveExact(publicProofId),
      { publicProofId },
      now,
    );
  } catch {
    return null;
  }
}

export async function resolvePublishedPublicProof(
  publicProofId: string,
  dependencies: { rpc?: VerifyRpcRunner; now?: () => Date } = {},
): Promise<PublishedPublicProof | null> {
  if (!PUBLIC_PROOF_ID.test(publicProofId)) return null;
  const rpc = dependencies.rpc ?? runRegisteredServiceRoleRpc;
  try {
    const result = await rpc({
      operation: "verify_publication_resolve_exact",
      args: { p_public_proof_id: publicProofId },
    });
    return parsePublishedPublicProof(
      exactRpcObject(result.data),
      { publicProofId },
      dependencies.now?.() ?? new Date(),
    );
  } catch {
    return null;
  }
}

export async function searchPublishedPublicProofs(
  input: VerifySearchInput,
  dependencies: { rpc?: VerifyRpcRunner; now?: () => Date } = {},
): Promise<PublishedPublicProof[]> {
  const canonical = canonicalizeVerifySearchInput(input);
  if (!canonical) return [];
  const rpc = dependencies.rpc ?? runRegisteredServiceRoleRpc;
  try {
    const result = await rpc({
      operation: "verify_publication_search",
      args: {
        p_chain_id: canonical.mode === "identity" ? canonical.chainId : null,
        p_contract_address: canonical.mode === "identity" ? canonical.contractAddress : null,
        p_project_name: canonical.mode === "project" ? canonical.projectName : null,
        p_limit: canonical.limit,
      },
    });
    if (!Array.isArray(result.data) || result.data.length > canonical.limit) return [];
    const now = dependencies.now?.() ?? new Date();
    const rows: PublishedPublicProof[] = [];
    const proofIds = new Set<string>();
    const identities = new Set<string>();
    for (const value of result.data) {
      const row = parsePublishedPublicProof(value, canonical.mode === "identity"
        ? { chainId: canonical.chainId, contractAddress: canonical.contractAddress }
        : undefined, now);
      if (!row) return [];
      if (canonical.mode === "project"
        && row.projectName?.toLocaleLowerCase("en-US")
          !== canonical.projectName.toLocaleLowerCase("en-US")) return [];
      const identity = `${row.chainId}:${row.contractAddress}`;
      if (proofIds.has(row.publicProofId) || identities.has(identity)) return [];
      proofIds.add(row.publicProofId);
      identities.add(identity);
      rows.push(row);
    }
    return rows;
  } catch {
    return [];
  }
}

export async function resolvePublishedPublicProofHistory(
  publicProofId: string,
  limit = 50,
  dependencies: { rpc?: VerifyRpcRunner } = {},
): Promise<PublishedPublicProofHistoryEntry[]> {
  if (!PUBLIC_PROOF_ID.test(publicProofId)
    || !Number.isSafeInteger(limit) || limit < 1 || limit > 100) return [];
  const rpc = dependencies.rpc ?? runRegisteredServiceRoleRpc;
  try {
    const result = await rpc({
      operation: "verify_publication_history",
      args: { p_public_proof_id: publicProofId, p_limit: limit },
    });
    if (!Array.isArray(result.data) || result.data.length > limit) return [];
    const rows: PublishedPublicProofHistoryEntry[] = [];
    for (const value of result.data) {
      const row = parseHistoryEntry(value);
      if (!row || row.publicProofId !== publicProofId) return [];
      rows.push(row);
    }
    for (let index = 0; index < rows.length; index += 1) {
      const current = rows[index];
      const older = rows[index + 1];
      if (index > 0 && rows[index - 1].publicationVersion <= current.publicationVersion) return [];
      if (older && (
        current.publicationVersion !== older.publicationVersion + 1
        || current.previousEventDigest !== older.eventDigest
        || current.auditVersion < older.auditVersion
      )) return [];
      if (current.publicationVersion === 1 && current.previousEventDigest !== null) return [];
    }
    return rows;
  } catch {
    return [];
  }
}

function canonicalAppendInput(input: AppendVerifyPublicationEventInput) {
  const canonicalIdentity = canonicalizeVerifySearchInput({
    chainId: input.chainId,
    contractAddress: input.contractAddress,
    limit: 1,
  });
  if (!canonicalIdentity || canonicalIdentity.mode !== "identity"
    || !SHA256.test(input.idempotencyKey) || !PUBLIC_PROOF_ID.test(input.publicProofId)
    || !VERIFY_EVENT_KINDS.has(input.eventKind) || !VERIFY_VISIBILITIES.has(input.visibility)
    || !SHA256.test(input.verificationReceiptDigest) || !SHA256.test(input.actorDigest)) {
    return null;
  }
  const checkedAt = input.checkedAt === null || input.checkedAt === undefined
    ? null
    : normalizeTimestamp(input.checkedAt);
  if (input.checkedAt !== null && input.checkedAt !== undefined && !checkedAt) return null;
  if (input.projectName !== null && input.projectName !== undefined
    && !isSafeText(input.projectName, 2, 120)) return null;
  if (input.reportTitle !== null && input.reportTitle !== undefined
    && !isSafeText(input.reportTitle, 4, 160)) return null;
  if (input.publicSummary !== null && input.publicSummary !== undefined
    && !isSafeText(input.publicSummary, 8, 600)) return null;
  if (input.riskStatus !== null && input.riskStatus !== undefined
    && !VERIFY_RISK_STATUSES.has(input.riskStatus)) return null;
  for (const digest of [input.reportDigest, input.deploymentDigest, input.expectedPreviousEventDigest]) {
    if (digest !== null && digest !== undefined && !SHA256.test(digest)) return null;
  }
  if (input.checkedBlockNumber !== null && input.checkedBlockNumber !== undefined
    && !BLOCK_NUMBER.test(input.checkedBlockNumber)) return null;
  if (input.checkedBlockHash !== null && input.checkedBlockHash !== undefined
    && !BLOCK_HASH.test(input.checkedBlockHash)) return null;
  if (input.monitoringTtlSeconds !== null && input.monitoringTtlSeconds !== undefined
    && (!Number.isSafeInteger(input.monitoringTtlSeconds)
      || input.monitoringTtlSeconds < 300 || input.monitoringTtlSeconds > 89_940)) return null;
  return { canonicalIdentity, checkedAt };
}

export async function appendVerifyPublicationEvent(
  input: AppendVerifyPublicationEventInput,
  dependencies: { rpc?: VerifyRpcRunner } = {},
): Promise<VerifyPublicationAppendReceipt> {
  const canonical = canonicalAppendInput(input);
  if (!canonical) throw new Error("verify_publication_input_invalid");
  const rpc = dependencies.rpc ?? runRegisteredServiceRoleRpc;
  let data: unknown;
  try {
    data = (await rpc({
      operation: "verify_publication_event_append",
      args: {
        p_idempotency_key: input.idempotencyKey,
        p_public_proof_id: input.publicProofId,
        p_chain_id: canonical.canonicalIdentity.chainId,
        p_contract_address: canonical.canonicalIdentity.contractAddress,
        p_event_kind: input.eventKind,
        p_visibility: input.visibility,
        p_project_name: input.projectName ?? null,
        p_report_title: input.reportTitle ?? null,
        p_public_summary: input.publicSummary ?? null,
        p_risk_status: input.riskStatus ?? null,
        p_report_digest: input.reportDigest ?? null,
        p_deployment_digest: input.deploymentDigest ?? null,
        p_verification_receipt_digest: input.verificationReceiptDigest,
        p_actor_digest: input.actorDigest,
        p_checked_block_number: input.checkedBlockNumber ?? null,
        p_checked_block_hash: input.checkedBlockHash ?? null,
        p_checked_at: canonical.checkedAt,
        p_monitoring_ttl_seconds: input.monitoringTtlSeconds ?? null,
        p_expected_previous_event_digest: input.expectedPreviousEventDigest ?? null,
      },
    })).data;
  } catch {
    throw new Error("verify_publication_append_failed");
  }
  const receipt = parseAppendReceipt(exactRpcObject(data));
  if (!receipt || receipt.publicProofId !== input.publicProofId) {
    throw new Error("verify_publication_append_receipt_invalid");
  }
  return receipt;
}
