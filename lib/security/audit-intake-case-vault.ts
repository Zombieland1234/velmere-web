import { ASCII_CONTROL_OR_MARKUP_PATTERN, ASCII_CONTROL_PATTERN } from "./ascii-control-characters";

import { createHash, randomUUID } from "node:crypto";
import { getSupabaseServiceRoleClient } from "@/lib/db/supabase";
import { runRegisteredServiceRoleRpc } from "@/lib/db/supabase-rpc-operation-registry";
import { appendMemoryAuditCaseHistoryEvent, forgetMemoryAuditCaseHistory } from "@/lib/security/audit-case-customer-history";
import { updateMemoryVlmPaidEntitlementStatus } from "@/lib/commerce/vlm-entitlement-ledger";
import { revokeMemoryAdvancedAuditReleasesForEntitlement } from "@/lib/security/advanced-audit-release-store";
import type { AuditSourceCandidates } from "@/lib/security/audit-source-candidates";

export const PASS4611_AUDIT_INTAKE_CASE_VAULT_ID = "pass4611-audit-intake-case-vault" as const;
export const PASS4612_AUDIT_CHECKOUT_BINDING_ID = "pass4612-audit-checkout-case-entitlement-binding" as const;
export const PASS4613_AUDIT_CASE_STATUS_REVOCATION_ID = "pass4613-account-owned-audit-status-payment-terminal-events" as const;
export const PASS4611_AUDIT_INTAKE_BOUNDARY =
  "Audit intake stores the canonical target only in a private server-side case vault. Every saved Basic, Pro or Advanced case has an authenticated account owner; public responses expose only a short case reference and a redacted display label, and paid analysis never starts before entitlement verification." as const;
export const PASS4612_AUDIT_CHECKOUT_BOUNDARY =
  "Paid audit checkout is authorized against the account-owned case, bound to one checkout session and promoted to the paid-review queue only by a server-verified entitlement. A success URL never starts analysis." as const;
export const PASS4613_AUDIT_STATUS_BOUNDARY =
  "Audit status is returned only to the owning account and never exposes the canonical target, account identifiers, raw checkout identifiers or raw provider event identifiers. Signed payment terminal events are append-only and may block or revoke access without deleting prior receipts." as const;

export type AuditIntakeTier = "basic" | "pro" | "advanced";
export type AuditIntakeKind = "contract" | "github" | "url";
export type AuditIntakeStatus =
  | "queued_basic_prescreen"
  | "awaiting_entitlement"
  | "checkout_pending"
  | "queued_paid_review"
  | "payment_blocked"
  | "access_revoked";
export type AuditPaymentTerminalEventType =
  | "checkout_expired"
  | "payment_failed"
  | "refund"
  | "chargeback";
export type AuditIntakeStorageMode =
  | "supabase_durable"
  | "memory_runtime_only"
  | "durable_required_missing"
  | "durable_write_failed";
export type AuditPaidProductId = "vlm_pro_audit_review" | "vlm_advanced_audit_human_review";

export type NormalizedAuditTarget = {
  kind: AuditIntakeKind;
  canonicalTarget: string;
  displayLabel: string;
  targetHash: string;
  chainId?: string;
  chainName?: string;
};

export type AuditIntakeCaseRecord = {
  caseId: string;
  caseRef: string;
  requestId: string;
  target: NormalizedAuditTarget;
  sourceCandidates: AuditSourceCandidates;
  tier: AuditIntakeTier;
  locale: "pl" | "en" | "de";
  status: AuditIntakeStatus;
  accountId?: string;
  accountEmail?: string;
  entitlementRequired: boolean;
  entitlementVerified: boolean;
  analysisStarted: boolean;
  checkoutSessionId?: string;
  checkoutContextHash?: string;
  checkoutProductId?: AuditPaidProductId;
  entitlementId?: string;
  paymentEventId?: string;
  entitlementVerifiedAt?: string;
  blockedReason?: AuditPaymentTerminalEventType;
  blockedEventHash?: string;
  blockedAt?: string;
  createdAt: string;
  updatedAt: string;
  storageMode: AuditIntakeStorageMode;
  durable: boolean;
};

export type AuditIntakeCreateResult = {
  ok: boolean;
  duplicate: boolean;
  record?: AuditIntakeCaseRecord;
  storageMode: AuditIntakeStorageMode;
  durable: boolean;
  failClosed: boolean;
  providerError?: string;
  error?:
    | "case_account_required"
    | "case_account_mismatch"
    | "case_target_withheld"
    | "case_target_revalidation_required"
    | "durable_storage_required"
    | "durable_write_failed";
};

export type AuditCaseMutationResult = {
  ok: boolean;
  record?: AuditIntakeCaseRecord;
  storageMode: AuditIntakeStorageMode;
  durable: boolean;
  failClosed: boolean;
  idempotent?: boolean;
  staleIgnored?: boolean;
  error?:
    | "case_not_found"
    | "case_account_mismatch"
    | "case_tier_mismatch"
    | "case_not_payable"
    | "case_already_bound_to_checkout"
    | "case_checkout_binding_mismatch"
    | "case_entitlement_transition_failed"
    | "case_not_found_or_not_owned"
    | "payment_event_binding_mismatch"
    | "durable_storage_required"
    | "durable_write_failed";
  providerError?: string;
};

type CreateAuditIntakeCaseInput = {
  requestId: string;
  target: NormalizedAuditTarget;
  sourceCandidates?: AuditSourceCandidates;
  tier: AuditIntakeTier;
  locale: "pl" | "en" | "de";
  accountId?: string;
  accountEmail?: string;
};

const memoryCases = new Map<string, AuditIntakeCaseRecord>();
const MAX_MEMORY_CASES = 240;
const CASE_SELECT = [
  "case_id",
  "case_ref",
  "request_id",
  "target_kind",
  "target_private",
  "target_hash",
  "target_chain_id",
  "target_chain_name",
  "display_label",
  "source_candidates_json",
  "tier",
  "locale",
  "status",
  "account_id",
  "account_email",
  "entitlement_required",
  "entitlement_verified",
  "analysis_started",
  "checkout_session_id",
  "checkout_context_hash",
  "checkout_product_id",
  "entitlement_id",
  "payment_event_id",
  "entitlement_verified_at",
  "blocked_reason",
  "blocked_event_hash",
  "blocked_at",
  "created_at",
  "updated_at",
].join(",");

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export function buildAuditContractTargetHash(chainIdInput: string, addressInput: string) {
  const chainId = chainIdInput.trim();
  const address = addressInput.trim().toLowerCase();
  if (!/^\d{1,20}$/.test(chainId) || !/^0x[a-f0-9]{40}$/.test(address)) {
    throw new Error("audit_contract_target_identity_invalid");
  }
  return `sha256:${sha256(`velmere-audit-contract-target-v1:${chainId}:${address}`)}`;
}

function productionLike() {
  return process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production";
}

function hasDurableAuditVaultConfig() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

function sanitizeRequestId(value: string) {
  const clean = value.replace(/[^a-zA-Z0-9:_-]/g, "").slice(0, 96);
  return clean || `req_${randomUUID()}`;
}

function memoryCaseKey(accountId: string, requestId: string) {
  return sha256(`velmere-audit-intake-account-request-v1:${accountId}:${requestId}`);
}

function sanitizeCaseRef(value: string) {
  const clean = value.trim().toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 24);
  return /^AUD-[A-Z0-9]{8,16}$/.test(clean) ? clean : "";
}

function sanitizeSessionId(value: string) {
  return value.trim().replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 160);
}

function sanitizeContextHash(value: string) {
  return value.trim().toLowerCase().replace(/[^a-f0-9]/g, "").slice(0, 64);
}

function sanitizeLocale(value: string): "pl" | "en" | "de" {
  return value === "pl" || value === "de" ? value : "en";
}

function sanitizeTier(value: string): AuditIntakeTier {
  return value === "basic" || value === "advanced" ? value : "pro";
}

function sanitizeStatus(value: unknown, tier: AuditIntakeTier): AuditIntakeStatus {
  if (value === "queued_basic_prescreen" || value === "checkout_pending" || value === "queued_paid_review" || value === "payment_blocked" || value === "access_revoked") return value;
  return tier === "basic" ? "queued_basic_prescreen" : "awaiting_entitlement";
}

function sanitizePaidProduct(value: unknown): AuditPaidProductId | undefined {
  return value === "vlm_pro_audit_review" || value === "vlm_advanced_audit_human_review" ? value : undefined;
}

function sanitizePaymentTerminalEventType(value: unknown): AuditPaymentTerminalEventType | undefined {
  return value === "checkout_expired" || value === "payment_failed" || value === "refund" || value === "chargeback" ? value : undefined;
}

function sanitizeText(value: string | undefined, max = 180) {
  if (!value) return undefined;
  const clean = value.replace(ASCII_CONTROL_OR_MARKUP_PATTERN, " ").replace(/\s+/g, " ").trim();
  return clean ? clean.slice(0, max) : undefined;
}

function sanitizeSourceUrl(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return undefined;
  try {
    const parsed = new URL(value.trim());
    if (parsed.protocol !== "https:" || parsed.username || parsed.password || isUnsafeHostname(parsed.hostname)) return undefined;
    parsed.hash = "";
    return parsed.toString().slice(0, 600);
  } catch {
    return undefined;
  }
}

function sanitizeSourceCandidates(value: unknown): AuditSourceCandidates {
  const input = value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
  const candidates: AuditSourceCandidates = {
    auditUrl: sanitizeSourceUrl(input.auditUrl),
    docsUrl: sanitizeSourceUrl(input.docsUrl),
    githubUrl: sanitizeSourceUrl(input.githubUrl),
    website: sanitizeSourceUrl(input.website),
  };
  return Object.fromEntries(Object.entries(candidates).filter(([, item]) => Boolean(item))) as AuditSourceCandidates;
}

function tierForProduct(productId: AuditPaidProductId): "pro" | "advanced" {
  return productId === "vlm_advanced_audit_human_review" ? "advanced" : "pro";
}

export function isPaidAuditProduct(value: unknown): value is AuditPaidProductId {
  return value === "vlm_pro_audit_review" || value === "vlm_advanced_audit_human_review";
}

function isPrivateIpv4(hostname: string) {
  const parts = hostname.split(".").map((part) => Number(part));
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return false;
  const [a, b] = parts;
  return (
    a === 10 ||
    a === 127 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 100 && b >= 64 && b <= 127) ||
    a === 0
  );
}

function isUnsafeHostname(hostname: string) {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (!host || host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local")) return true;
  if (host === "::1" || host.startsWith("fe80:") || host.startsWith("fc") || host.startsWith("fd")) return true;
  return isPrivateIpv4(host);
}

export function normalizeAuditTarget(
  rawValue: string,
  chainIdentity?: { chainId?: unknown; chainName?: unknown },
): NormalizedAuditTarget | null {
  const value = rawValue.replace(ASCII_CONTROL_PATTERN, "").trim().slice(0, 600);
  if (!value) return null;

  if (/^0x[a-fA-F0-9]{40}$/.test(value)) {
    const canonicalTarget = value.toLowerCase();
    const chainId = typeof chainIdentity?.chainId === "string" ? chainIdentity.chainId.trim() : "";
    const chainName = typeof chainIdentity?.chainName === "string" ? chainIdentity.chainName.trim().toUpperCase() : "";
    const currentChain = chainId === "56" && chainName === "BSC";
    return {
      kind: "contract",
      canonicalTarget,
      displayLabel: `${canonicalTarget.slice(0, 8)}…${canonicalTarget.slice(-6)}`,
      targetHash: currentChain
        ? buildAuditContractTargetHash(chainId, canonicalTarget)
        : `sha256:${sha256(canonicalTarget)}`,
      ...(currentChain ? { chainId, chainName } : {}),
    };
  }

  const githubCandidate = /^https?:\/\//i.test(value) ? value : `https://${value}`;
  try {
    const githubUrl = new URL(githubCandidate);
    if (githubUrl.hostname.toLowerCase() === "github.com") {
      const segments = githubUrl.pathname.split("/").filter(Boolean);
      if (segments.length === 2 && segments.every((segment) => /^[A-Za-z0-9_.-]+$/.test(segment))) {
        const owner = segments[0];
        const repo = segments[1].replace(/\.git$/i, "");
        if (!repo) return null;
        const canonicalTarget = `https://github.com/${owner}/${repo}`;
        return {
          kind: "github",
          canonicalTarget,
          displayLabel: `${owner}/${repo}`.slice(0, 96),
          targetHash: `sha256:${sha256(canonicalTarget.toLowerCase())}`,
        };
      }
    }
  } catch {
    // Continue to generic URL parsing.
  }

  try {
    const parsed = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    if (parsed.username || parsed.password || isUnsafeHostname(parsed.hostname)) return null;
    if (!parsed.hostname.includes(".")) return null;
    parsed.hash = "";
    parsed.search = "";
    parsed.pathname = parsed.pathname.replace(/\/{2,}/g, "/");
    if (parsed.pathname !== "/") parsed.pathname = parsed.pathname.replace(/\/$/, "");
    const canonicalTarget = parsed.toString().replace(/\/$/, "");
    return {
      kind: "url",
      canonicalTarget,
      displayLabel: `${parsed.hostname}${parsed.pathname === "/" ? "" : parsed.pathname}`.slice(0, 110),
      targetHash: `sha256:${sha256(canonicalTarget.toLowerCase())}`,
    };
  } catch {
    return null;
  }
}

function rowToRecord(row: Record<string, unknown>): AuditIntakeCaseRecord {
  const tier = sanitizeTier(String(row.tier ?? "pro"));
  const createdAt = String(row.created_at ?? new Date().toISOString());
  const updatedAt = String(row.updated_at ?? createdAt);
  return {
    caseId: String(row.case_id),
    caseRef: String(row.case_ref),
    requestId: String(row.request_id),
    target: {
      kind: row.target_kind === "contract" || row.target_kind === "github" ? row.target_kind : "url",
      canonicalTarget: String(row.target_private ?? ""),
      displayLabel: String(row.display_label ?? "Target"),
      targetHash: String(row.target_hash ?? "sha256:missing"),
      ...(row.target_chain_id ? { chainId: String(row.target_chain_id) } : {}),
      ...(row.target_chain_name ? { chainName: String(row.target_chain_name) } : {}),
    },
    sourceCandidates: sanitizeSourceCandidates(row.source_candidates_json),
    tier,
    locale: sanitizeLocale(String(row.locale ?? "en")),
    status: sanitizeStatus(row.status, tier),
    accountId: sanitizeText(String(row.account_id ?? ""), 120),
    accountEmail: sanitizeText(String(row.account_email ?? ""), 180),
    entitlementRequired: Boolean(row.entitlement_required),
    entitlementVerified: Boolean(row.entitlement_verified),
    analysisStarted: Boolean(row.analysis_started),
    checkoutSessionId: sanitizeText(String(row.checkout_session_id ?? ""), 160),
    checkoutContextHash: sanitizeText(String(row.checkout_context_hash ?? ""), 64),
    checkoutProductId: sanitizePaidProduct(row.checkout_product_id),
    entitlementId: sanitizeText(String(row.entitlement_id ?? ""), 180),
    paymentEventId: sanitizeText(String(row.payment_event_id ?? ""), 180),
    entitlementVerifiedAt: sanitizeText(String(row.entitlement_verified_at ?? ""), 80),
    blockedReason: sanitizePaymentTerminalEventType(row.blocked_reason),
    blockedEventHash: sanitizeText(String(row.blocked_event_hash ?? ""), 80),
    blockedAt: sanitizeText(String(row.blocked_at ?? ""), 80),
    createdAt,
    updatedAt,
    storageMode: "supabase_durable",
    durable: true,
  };
}

function buildRecord(input: CreateAuditIntakeCaseInput, storageMode: AuditIntakeStorageMode, durable: boolean): AuditIntakeCaseRecord {
  const now = new Date().toISOString();
  const caseId = randomUUID();
  const caseRef = `AUD-${sha256(`${caseId}:${input.target.targetHash}`).slice(0, 10).toUpperCase()}`;
  const entitlementRequired = input.tier !== "basic";
  return {
    caseId,
    caseRef,
    requestId: sanitizeRequestId(input.requestId),
    target: input.target,
    sourceCandidates: sanitizeSourceCandidates(input.sourceCandidates),
    tier: sanitizeTier(input.tier),
    locale: sanitizeLocale(input.locale),
    status: entitlementRequired ? "awaiting_entitlement" : "queued_basic_prescreen",
    accountId: sanitizeText(input.accountId, 120),
    accountEmail: sanitizeText(input.accountEmail?.toLowerCase(), 180),
    entitlementRequired,
    entitlementVerified: false,
    analysisStarted: false,
    createdAt: now,
    updatedAt: now,
    storageMode,
    durable,
  };
}

function publicReceipt(record: AuditIntakeCaseRecord) {
  return {
    passId: PASS4611_AUDIT_INTAKE_CASE_VAULT_ID,
    caseRef: record.caseRef,
    requestIdHash: `sha256:${sha256(record.requestId).slice(0, 24)}`,
    targetHash: record.target.targetHash,
    targetKind: record.target.kind,
    targetChainId: record.target.chainId ?? null,
    targetChainName: record.target.chainName ?? null,
    displayLabel: record.target.displayLabel,
    sourceCandidateCount: Object.keys(record.sourceCandidates).length,
    sourceCandidatesDigest: `sha256:${sha256(JSON.stringify(record.sourceCandidates))}`,
    tier: record.tier,
    status: record.status,
    entitlementRequired: record.entitlementRequired,
    entitlementVerified: record.entitlementVerified,
    analysisStarted: record.analysisStarted,
    checkoutBound: Boolean(record.checkoutSessionId),
    boundary: PASS4611_AUDIT_INTAKE_BOUNDARY,
  };
}

async function findSupabaseCaseByRequestId(accountId: string, requestId: string) {
  const supabase = getSupabaseServiceRoleClient();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("velmere_audit_intake_cases")
    .select(CASE_SELECT)
    .eq("account_id", sanitizeText(accountId, 120))
    .eq("request_id", sanitizeRequestId(requestId))
    .maybeSingle();
  if (error) throw new Error(`audit_intake_lookup_failed:${error.message}`);
  if (!data) return null;
  const record = rowToRecord(data as unknown as Record<string, unknown>);
  if (!record.accountId || record.accountId !== sanitizeText(accountId, 120)) {
    throw new Error("audit_intake_idempotency_account_mismatch");
  }
  return record;
}

async function findSupabaseCaseByRef(caseRef: string) {
  const supabase = getSupabaseServiceRoleClient();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("velmere_audit_intake_cases")
    .select(CASE_SELECT)
    .eq("case_ref", sanitizeCaseRef(caseRef))
    .maybeSingle();
  if (error) throw new Error(`audit_case_lookup_failed:${error.message}`);
  return data ? rowToRecord(data as unknown as Record<string, unknown>) : null;
}

function findMemoryCaseByRef(caseRef: string) {
  const normalized = sanitizeCaseRef(caseRef);
  return Array.from(memoryCases.values()).find((record) => record.caseRef === normalized) ?? null;
}

async function insertSupabaseCase(record: AuditIntakeCaseRecord) {
  const supabase = getSupabaseServiceRoleClient();
  if (!supabase) throw new Error("supabase_service_role_client_unavailable");
  const { error } = await supabase.from("velmere_audit_intake_cases").insert({
    case_id: record.caseId,
    case_ref: record.caseRef,
    request_id: record.requestId,
    target_kind: record.target.kind,
    target_private: record.target.canonicalTarget,
    target_hash: record.target.targetHash,
    target_chain_id: record.target.chainId ?? null,
    target_chain_name: record.target.chainName ?? null,
    display_label: record.target.displayLabel,
    source_candidates_json: record.sourceCandidates,
    tier: record.tier,
    locale: record.locale,
    status: record.status,
    account_id: record.accountId ?? null,
    account_email: record.accountEmail ?? null,
    entitlement_required: record.entitlementRequired,
    entitlement_verified: false,
    analysis_started: false,
    intake_receipt: publicReceipt(record),
    created_at: record.createdAt,
    updated_at: record.updatedAt,
  });
  if (!error) return record;
  if (String((error as { code?: string }).code ?? "") === "23505" || /duplicate|unique/i.test(error.message ?? "")) {
    const existing = await findSupabaseCaseByRequestId(record.accountId ?? "", record.requestId);
    if (existing) return existing;
  }
  throw new Error(`audit_intake_insert_failed:${error.message}`);
}

function pruneMemory() {
  while (memoryCases.size > MAX_MEMORY_CASES) {
    const oldest = memoryCases.keys().next().value as string | undefined;
    if (!oldest) break;
    const oldestRecord = memoryCases.get(oldest);
    memoryCases.delete(oldest);
    if (oldestRecord) forgetMemoryAuditCaseHistory(oldestRecord.caseRef);
  }
}

export function getAuditIntakeRuntimeMode() {
  const durableConfigured = hasDurableAuditVaultConfig();
  const production = productionLike();
  return {
    passId: PASS4611_AUDIT_INTAKE_CASE_VAULT_ID,
    checkoutBindingPassId: PASS4612_AUDIT_CHECKOUT_BINDING_ID,
    statusRevocationPassId: PASS4613_AUDIT_CASE_STATUS_REVOCATION_ID,
    productionLike: production,
    durableConfigured,
    memoryAllowed: !production,
    failClosed: production,
    boundary: PASS4611_AUDIT_INTAKE_BOUNDARY,
    checkoutBoundary: PASS4612_AUDIT_CHECKOUT_BOUNDARY,
    statusBoundary: PASS4613_AUDIT_STATUS_BOUNDARY,
  };
}

export async function createAuditIntakeCase(input: CreateAuditIntakeCaseInput): Promise<AuditIntakeCreateResult> {
  const requestId = sanitizeRequestId(input.requestId);
  const accountId = sanitizeText(input.accountId, 120);
  const runtime = getAuditIntakeRuntimeMode();
  if (!accountId) {
    return {
      ok: false,
      duplicate: false,
      storageMode: runtime.durableConfigured ? "supabase_durable" : runtime.productionLike ? "durable_required_missing" : "memory_runtime_only",
      durable: runtime.durableConfigured,
      failClosed: true,
      error: "case_account_required",
    };
  }
  if (input.target.kind !== "contract") {
    return {
      ok: false,
      duplicate: false,
      storageMode: runtime.durableConfigured ? "supabase_durable" : runtime.productionLike ? "durable_required_missing" : "memory_runtime_only",
      durable: runtime.durableConfigured,
      failClosed: true,
      error: "case_target_withheld",
    };
  }
  const expectedTargetHash = input.target.chainId === "56" && input.target.chainName === "BSC"
    ? buildAuditContractTargetHash(input.target.chainId, input.target.canonicalTarget)
    : "";
  if (!expectedTargetHash || input.target.targetHash !== expectedTargetHash) {
    return {
      ok: false,
      duplicate: false,
      storageMode: runtime.durableConfigured ? "supabase_durable" : runtime.productionLike ? "durable_required_missing" : "memory_runtime_only",
      durable: runtime.durableConfigured,
      failClosed: true,
      error: "case_target_revalidation_required",
    };
  }

  if (runtime.durableConfigured) {
    try {
      const existing = await findSupabaseCaseByRequestId(accountId, requestId);
      if (existing) {
        return { ok: true, duplicate: true, record: existing, storageMode: "supabase_durable", durable: true, failClosed: true };
      }
      const record = buildRecord({ ...input, accountId, requestId }, "supabase_durable", true);
      const stored = await insertSupabaseCase(record);
      return {
        ok: true,
        duplicate: stored.caseId !== record.caseId,
        record: stored,
        storageMode: "supabase_durable",
        durable: true,
        failClosed: true,
      };
    } catch (error) {
      if (runtime.productionLike) {
        return {
          ok: false,
          duplicate: false,
          storageMode: "durable_write_failed",
          durable: false,
          failClosed: true,
          error: "durable_write_failed",
          providerError: error instanceof Error ? error.message : "audit_intake_write_failed",
        };
      }
    }
  }

  if (runtime.productionLike) {
    return {
      ok: false,
      duplicate: false,
      storageMode: "durable_required_missing",
      durable: false,
      failClosed: true,
      error: "durable_storage_required",
    };
  }

  const memoryKey = memoryCaseKey(accountId, requestId);
  const existing = memoryCases.get(memoryKey);
  if (existing) {
    if (!existing.accountId || existing.accountId !== accountId) {
      return {
        ok: false,
        duplicate: false,
        storageMode: "memory_runtime_only",
        durable: false,
        failClosed: true,
        error: "case_account_mismatch",
      };
    }
    return { ok: true, duplicate: true, record: existing, storageMode: "memory_runtime_only", durable: false, failClosed: false };
  }
  const record = buildRecord({ ...input, accountId, requestId }, "memory_runtime_only", false);
  memoryCases.set(memoryKey, record);
  appendMemoryAuditCaseHistoryEvent(record, "case_created", { occurredAt: record.createdAt });
  pruneMemory();
  return { ok: true, duplicate: false, record, storageMode: "memory_runtime_only", durable: false, failClosed: false };
}

function authorizeRecord(record: AuditIntakeCaseRecord | null, args: {
  accountId: string;
  tier: "pro" | "advanced";
  productId: AuditPaidProductId;
}) : AuditCaseMutationResult {
  const runtime = getAuditIntakeRuntimeMode();
  const storageMode = record?.storageMode ?? (runtime.durableConfigured ? "supabase_durable" : "memory_runtime_only");
  const durable = record?.durable ?? runtime.durableConfigured;
  if (!record) return { ok: false, error: "case_not_found", storageMode, durable, failClosed: runtime.productionLike };
  if (!record.accountId || record.accountId !== args.accountId) {
    return { ok: false, error: "case_account_mismatch", storageMode, durable, failClosed: runtime.productionLike };
  }
  if (record.tier !== args.tier || tierForProduct(args.productId) !== record.tier) {
    return { ok: false, error: "case_tier_mismatch", storageMode, durable, failClosed: runtime.productionLike };
  }
  if (!record.entitlementRequired || record.entitlementVerified || record.status === "queued_paid_review" || record.status === "queued_basic_prescreen") {
    return { ok: false, error: "case_not_payable", storageMode, durable, failClosed: runtime.productionLike };
  }
  return { ok: true, record, storageMode, durable, failClosed: runtime.productionLike };
}

export async function authorizeAuditCaseForCheckout(args: {
  caseRef: string;
  accountId: string;
  tier: "pro" | "advanced";
  productId: AuditPaidProductId;
}): Promise<AuditCaseMutationResult> {
  const runtime = getAuditIntakeRuntimeMode();
  const caseRef = sanitizeCaseRef(args.caseRef);
  if (!caseRef) return { ok: false, error: "case_not_found", storageMode: runtime.durableConfigured ? "supabase_durable" : "memory_runtime_only", durable: runtime.durableConfigured, failClosed: runtime.productionLike };

  if (runtime.durableConfigured) {
    try {
      return authorizeRecord(await findSupabaseCaseByRef(caseRef), args);
    } catch (error) {
      if (runtime.productionLike) {
        return { ok: false, error: "durable_write_failed", storageMode: "durable_write_failed", durable: false, failClosed: true, providerError: error instanceof Error ? error.message : "audit_case_authorize_failed" };
      }
    }
  }
  if (runtime.productionLike) {
    return { ok: false, error: "durable_storage_required", storageMode: "durable_required_missing", durable: false, failClosed: true };
  }
  return authorizeRecord(findMemoryCaseByRef(caseRef), args);
}

export async function bindAuditCaseToCheckoutSession(args: {
  caseRef: string;
  accountId: string;
  tier: "pro" | "advanced";
  productId: AuditPaidProductId;
  stripeSessionId: string;
  contextHash: string;
}): Promise<AuditCaseMutationResult> {
  const runtime = getAuditIntakeRuntimeMode();
  const caseRef = sanitizeCaseRef(args.caseRef);
  const stripeSessionId = sanitizeSessionId(args.stripeSessionId);
  const contextHash = sanitizeContextHash(args.contextHash);
  const authorization = await authorizeAuditCaseForCheckout({ ...args, caseRef });
  if (!authorization.ok || !authorization.record) return authorization;
  const record = authorization.record;
  if (record.checkoutSessionId && record.checkoutSessionId !== stripeSessionId) {
    return { ...authorization, ok: false, error: "case_already_bound_to_checkout", record: undefined };
  }
  if (record.checkoutSessionId === stripeSessionId && record.checkoutContextHash === contextHash && record.checkoutProductId === args.productId) {
    return { ...authorization, idempotent: true };
  }
  if (!stripeSessionId || contextHash.length !== 64) {
    return { ...authorization, ok: false, error: "case_checkout_binding_mismatch", record: undefined };
  }

  if (runtime.durableConfigured) {
    try {
      const { data } = await runRegisteredServiceRoleRpc({
        operation: "audit_checkout_bind",
        args: {
          p_case_ref: caseRef,
          p_account_id: args.accountId,
          p_tier: args.tier,
          p_product_id: args.productId,
          p_stripe_session_id: stripeSessionId,
          p_context_hash: contextHash,
        },
      });
      const rpc = (data ?? {}) as { ok?: boolean; idempotent?: boolean; error?: string };
      if (!rpc.ok) {
        const mappedError: AuditCaseMutationResult["error"] =
          rpc.error === "case_not_found" ||
          rpc.error === "case_account_mismatch" ||
          rpc.error === "case_tier_mismatch" ||
          rpc.error === "case_not_payable" ||
          rpc.error === "case_already_bound_to_checkout"
            ? rpc.error
            : "case_checkout_binding_mismatch";
        return { ok: false, error: mappedError, storageMode: "supabase_durable", durable: true, failClosed: true };
      }
      const rebound = await findSupabaseCaseByRef(caseRef);
      if (!rebound) return { ok: false, error: "case_not_found", storageMode: "supabase_durable", durable: true, failClosed: true };
      return { ok: true, record: rebound, storageMode: "supabase_durable", durable: true, failClosed: true, idempotent: rpc.idempotent === true };
    } catch (error) {
      if (runtime.productionLike) {
        return { ok: false, error: "durable_write_failed", storageMode: "durable_write_failed", durable: false, failClosed: true, providerError: error instanceof Error ? error.message : "audit_checkout_bind_failed" };
      }
    }
  }

  if (runtime.productionLike) {
    return { ok: false, error: "durable_storage_required", storageMode: "durable_required_missing", durable: false, failClosed: true };
  }
  const updated: AuditIntakeCaseRecord = {
    ...record,
    status: "checkout_pending",
    checkoutSessionId: stripeSessionId,
    checkoutContextHash: contextHash,
    checkoutProductId: args.productId,
    updatedAt: new Date().toISOString(),
  };
  memoryCases.set(memoryCaseKey(updated.accountId ?? "", updated.requestId), updated);
  appendMemoryAuditCaseHistoryEvent(updated, "checkout_bound", { previousStatus: record.status, occurredAt: updated.updatedAt });
  return { ok: true, record: updated, storageMode: "memory_runtime_only", durable: false, failClosed: false };
}

export async function promoteAuditCaseFromPaidEntitlement(args: {
  caseRef: string;
  stripeSessionId: string;
  productId: AuditPaidProductId;
  contextHash: string;
  entitlementId: string;
  paymentEventId: string;
}): Promise<AuditCaseMutationResult> {
  const runtime = getAuditIntakeRuntimeMode();
  const caseRef = sanitizeCaseRef(args.caseRef);
  const stripeSessionId = sanitizeSessionId(args.stripeSessionId);
  const contextHash = sanitizeContextHash(args.contextHash);
  const entitlementId = sanitizeText(args.entitlementId, 180) ?? "";
  const paymentEventId = sanitizeText(args.paymentEventId, 180) ?? "";
  if (!caseRef || !stripeSessionId || contextHash.length !== 64 || !entitlementId || !paymentEventId) {
    return { ok: false, error: "case_checkout_binding_mismatch", storageMode: runtime.durableConfigured ? "supabase_durable" : "memory_runtime_only", durable: runtime.durableConfigured, failClosed: runtime.productionLike };
  }

  if (runtime.durableConfigured) {
    try {
      const { data } = await runRegisteredServiceRoleRpc({
        operation: "audit_paid_case_promote",
        args: {
          p_case_ref: caseRef,
          p_stripe_session_id: stripeSessionId,
          p_product_id: args.productId,
          p_context_hash: contextHash,
          p_entitlement_id: entitlementId,
          p_payment_event_id: paymentEventId,
        },
      });
      const rpc = (data ?? {}) as { ok?: boolean; idempotent?: boolean; error?: string };
      if (!rpc.ok) {
        return { ok: false, error: rpc.error === "case_not_found" ? "case_not_found" : "case_entitlement_transition_failed", storageMode: "supabase_durable", durable: true, failClosed: true };
      }
      const record = await findSupabaseCaseByRef(caseRef);
      if (!record) return { ok: false, error: "case_not_found", storageMode: "supabase_durable", durable: true, failClosed: true };
      return { ok: true, record, storageMode: "supabase_durable", durable: true, failClosed: true, idempotent: rpc.idempotent === true };
    } catch (error) {
      if (runtime.productionLike) {
        return { ok: false, error: "case_entitlement_transition_failed", storageMode: "durable_write_failed", durable: false, failClosed: true, providerError: error instanceof Error ? error.message : "audit_paid_case_transition_failed" };
      }
    }
  }

  if (runtime.productionLike) {
    return { ok: false, error: "durable_storage_required", storageMode: "durable_required_missing", durable: false, failClosed: true };
  }
  const record = findMemoryCaseByRef(caseRef);
  if (!record) return { ok: false, error: "case_not_found", storageMode: "memory_runtime_only", durable: false, failClosed: false };
  if (record.status === "queued_paid_review" && record.entitlementId === entitlementId) {
    return { ok: true, record, storageMode: "memory_runtime_only", durable: false, failClosed: false, idempotent: true };
  }
  if (
    record.status !== "checkout_pending" ||
    record.checkoutSessionId !== stripeSessionId ||
    record.checkoutContextHash !== contextHash ||
    record.checkoutProductId !== args.productId
  ) {
    return { ok: false, error: "case_checkout_binding_mismatch", storageMode: "memory_runtime_only", durable: false, failClosed: false };
  }
  const now = new Date().toISOString();
  const updated: AuditIntakeCaseRecord = {
    ...record,
    status: "queued_paid_review",
    entitlementVerified: true,
    analysisStarted: false,
    entitlementId,
    paymentEventId,
    entitlementVerifiedAt: now,
    updatedAt: now,
  };
  memoryCases.set(memoryCaseKey(updated.accountId ?? "", updated.requestId), updated);
  appendMemoryAuditCaseHistoryEvent(updated, "payment_verified", { previousStatus: record.status, occurredAt: now });
  appendMemoryAuditCaseHistoryEvent(updated, "queued_for_review", { previousStatus: record.status, occurredAt: now });
  return { ok: true, record: updated, storageMode: "memory_runtime_only", durable: false, failClosed: false };
}


export async function getAuditCaseForInternalUse(caseRefInput: string): Promise<AuditCaseMutationResult> {
  const runtime = getAuditIntakeRuntimeMode();
  const caseRef = sanitizeCaseRef(caseRefInput);
  const storageMode: AuditIntakeStorageMode = runtime.durableConfigured ? "supabase_durable" : "memory_runtime_only";
  if (!caseRef) return { ok: false, error: "case_not_found", storageMode, durable: runtime.durableConfigured, failClosed: runtime.productionLike };

  if (runtime.durableConfigured) {
    try {
      const record = await findSupabaseCaseByRef(caseRef);
      if (!record) return { ok: false, error: "case_not_found", storageMode: "supabase_durable", durable: true, failClosed: true };
      return { ok: true, record, storageMode: "supabase_durable", durable: true, failClosed: true };
    } catch (error) {
      if (runtime.productionLike) {
        return { ok: false, error: "durable_write_failed", storageMode: "durable_write_failed", durable: false, failClosed: true, providerError: error instanceof Error ? error.message : "audit_case_internal_lookup_failed" };
      }
    }
  }

  if (runtime.productionLike) return { ok: false, error: "durable_storage_required", storageMode: "durable_required_missing", durable: false, failClosed: true };
  const record = findMemoryCaseByRef(caseRef);
  if (!record) return { ok: false, error: "case_not_found", storageMode: "memory_runtime_only", durable: false, failClosed: false };
  return { ok: true, record, storageMode: "memory_runtime_only", durable: false, failClosed: false };
}

export async function getAuditCaseForOwningAccount(args: {
  caseRef: string;
  accountId: string;
}): Promise<AuditCaseMutationResult> {
  const runtime = getAuditIntakeRuntimeMode();
  const caseRef = sanitizeCaseRef(args.caseRef);
  const accountId = sanitizeText(args.accountId, 120) ?? "";
  const storageMode: AuditIntakeStorageMode = runtime.durableConfigured ? "supabase_durable" : "memory_runtime_only";
  if (!caseRef || !accountId) {
    return { ok: false, error: "case_not_found_or_not_owned", storageMode, durable: runtime.durableConfigured, failClosed: runtime.productionLike };
  }

  if (runtime.durableConfigured) {
    try {
      const record = await findSupabaseCaseByRef(caseRef);
      if (!record || !record.accountId || record.accountId !== accountId) {
        return { ok: false, error: "case_not_found_or_not_owned", storageMode: "supabase_durable", durable: true, failClosed: true };
      }
      return { ok: true, record, storageMode: "supabase_durable", durable: true, failClosed: true };
    } catch (error) {
      if (runtime.productionLike) {
        return { ok: false, error: "durable_write_failed", storageMode: "durable_write_failed", durable: false, failClosed: true, providerError: error instanceof Error ? error.message : "audit_case_status_lookup_failed" };
      }
    }
  }

  if (runtime.productionLike) {
    return { ok: false, error: "durable_storage_required", storageMode: "durable_required_missing", durable: false, failClosed: true };
  }
  const record = findMemoryCaseByRef(caseRef);
  if (!record || !record.accountId || record.accountId !== accountId) {
    return { ok: false, error: "case_not_found_or_not_owned", storageMode: "memory_runtime_only", durable: false, failClosed: false };
  }
  return { ok: true, record, storageMode: "memory_runtime_only", durable: false, failClosed: false };
}

export function auditCaseStatusPublicPayload(record: AuditIntakeCaseRecord) {
  const queueLane = record.status === "queued_basic_prescreen"
    ? "basic_prescreen"
    : record.status === "queued_paid_review"
      ? record.tier === "advanced" ? "advanced_automation" : "pro_review"
      : record.status === "checkout_pending" || record.status === "awaiting_entitlement"
        ? "payment_verification"
        : "blocked";
  const paymentState = record.status === "access_revoked"
    ? record.blockedReason === "chargeback" ? "chargeback" : "refunded"
    : record.status === "payment_blocked"
      ? record.blockedReason === "checkout_expired" ? "expired" : "failed"
      : record.entitlementVerified
        ? "verified"
        : record.status === "checkout_pending" ? "pending" : record.entitlementRequired ? "awaiting" : "not_required";
  return {
    passId: PASS4613_AUDIT_CASE_STATUS_REVOCATION_ID,
    caseRef: record.caseRef,
    tier: record.tier,
    status: record.status,
    queueLane,
    paymentState,
    entitlementRequired: record.entitlementRequired,
    entitlementVerified: record.entitlementVerified,
    analysisStarted: record.analysisStarted,
    checkoutBound: Boolean(record.checkoutSessionId),
    target: {
      kind: record.target.kind,
      hash: record.target.targetHash,
      chainId: record.target.chainId ?? null,
      chainName: record.target.chainName ?? null,
      executionState: record.target.kind === "contract" && record.target.chainId === "56" && record.target.chainName === "BSC"
        ? "CURRENT_EXECUTABLE_BSC"
        : "REVALIDATION_REQUIRED",
    },
    timestamps: {
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      entitlementVerifiedAt: record.entitlementVerifiedAt ?? null,
      blockedAt: record.blockedAt ?? null,
    },
    latestPaymentReceipt: record.blockedEventHash ? {
      eventHash: record.blockedEventHash,
      reason: record.blockedReason ?? "payment_failed",
      recordedAt: record.blockedAt ?? record.updatedAt,
    } : null,
    durable: record.durable,
    storageMode: record.storageMode,
    boundary: PASS4613_AUDIT_STATUS_BOUNDARY,
  };
}

export async function applyAuditCasePaymentTerminalEvent(args: {
  caseRef: string;
  productId: AuditPaidProductId;
  contextHash: string;
  eventId: string;
  eventType: AuditPaymentTerminalEventType;
}): Promise<AuditCaseMutationResult> {
  const runtime = getAuditIntakeRuntimeMode();
  const caseRef = sanitizeCaseRef(args.caseRef);
  const contextHash = sanitizeContextHash(args.contextHash);
  const eventId = sanitizeText(args.eventId, 180) ?? "";
  const eventType = sanitizePaymentTerminalEventType(args.eventType);
  const storageMode: AuditIntakeStorageMode = runtime.durableConfigured ? "supabase_durable" : "memory_runtime_only";
  if (!caseRef || contextHash.length !== 64 || !eventId || !eventType || !isPaidAuditProduct(args.productId)) {
    return { ok: false, error: "payment_event_binding_mismatch", storageMode, durable: runtime.durableConfigured, failClosed: runtime.productionLike };
  }
  const eventHash = `sha256:${sha256(eventId)}`;

  if (runtime.durableConfigured) {
    try {
      const terminalAccessEvent = eventType === "refund" || eventType === "chargeback";
      const { data } = await runRegisteredServiceRoleRpc({
        operation: terminalAccessEvent ? "paid_audit_terminal_transition_apply" : "audit_payment_terminal_apply",
        args: terminalAccessEvent
          ? {
              p_case_ref: caseRef,
              p_product_id: args.productId,
              p_context_hash: contextHash,
              p_event_hash: sha256(eventId),
              p_event_type: eventType,
              p_event_at: new Date().toISOString(),
            }
          : {
              p_case_ref: caseRef,
              p_product_id: args.productId,
              p_context_hash: contextHash,
              p_event_id: eventId,
              p_event_type: eventType,
            },
      });
      const rpc = (data ?? {}) as { ok?: boolean; idempotent?: boolean; staleIgnored?: boolean; error?: string };
      if (!rpc.ok) {
        return { ok: false, error: rpc.error === "case_not_found" ? "case_not_found" : "payment_event_binding_mismatch", storageMode: "supabase_durable", durable: true, failClosed: true };
      }
      const record = await findSupabaseCaseByRef(caseRef);
      if (!record) return { ok: false, error: "case_not_found", storageMode: "supabase_durable", durable: true, failClosed: true };
      return { ok: true, record, storageMode: "supabase_durable", durable: true, failClosed: true, idempotent: rpc.idempotent === true, staleIgnored: rpc.staleIgnored === true };
    } catch (error) {
      if (runtime.productionLike) {
        return { ok: false, error: "durable_write_failed", storageMode: "durable_write_failed", durable: false, failClosed: true, providerError: error instanceof Error ? error.message : "audit_payment_terminal_event_failed" };
      }
    }
  }

  if (runtime.productionLike) {
    return { ok: false, error: "durable_storage_required", storageMode: "durable_required_missing", durable: false, failClosed: true };
  }
  const record = findMemoryCaseByRef(caseRef);
  if (!record) return { ok: false, error: "case_not_found", storageMode: "memory_runtime_only", durable: false, failClosed: false };
  if (record.checkoutProductId !== args.productId || record.checkoutContextHash !== contextHash) {
    return { ok: false, error: "payment_event_binding_mismatch", storageMode: "memory_runtime_only", durable: false, failClosed: false };
  }
  if (record.blockedEventHash === eventHash) {
    return { ok: true, record, storageMode: "memory_runtime_only", durable: false, failClosed: false, idempotent: true };
  }
  if ((eventType === "checkout_expired" || eventType === "payment_failed") && record.status === "queued_paid_review") {
    return { ok: true, record, storageMode: "memory_runtime_only", durable: false, failClosed: false, staleIgnored: true };
  }
  const nextStatus: AuditIntakeStatus = eventType === "refund" || eventType === "chargeback" ? "access_revoked" : "payment_blocked";
  const now = new Date().toISOString();
  const updated: AuditIntakeCaseRecord = {
    ...record,
    status: nextStatus,
    entitlementVerified: false,
    analysisStarted: false,
    blockedReason: eventType,
    blockedEventHash: eventHash,
    blockedAt: now,
    updatedAt: now,
  };
  memoryCases.set(memoryCaseKey(updated.accountId ?? "", updated.requestId), updated);
  if (record.entitlementId) {
    const entitlementStatus = eventType === "chargeback"
      ? "revoked"
      : eventType === "refund"
        ? "refunded"
        : "expired";
    updateMemoryVlmPaidEntitlementStatus({ entitlementId: record.entitlementId, status: entitlementStatus, now: new Date(now) });
    if (eventType === "refund" || eventType === "chargeback") {
      revokeMemoryAdvancedAuditReleasesForEntitlement({ entitlementRef: record.entitlementId, eventId });
    }
  }
  appendMemoryAuditCaseHistoryEvent(
    updated,
    nextStatus === "access_revoked" ? "access_revoked" : "payment_blocked",
    { previousStatus: record.status, occurredAt: now, reason: eventType },
  );
  return { ok: true, record: updated, storageMode: "memory_runtime_only", durable: false, failClosed: false };
}

export function auditIntakePublicCase(record: AuditIntakeCaseRecord) {
  return {
    caseRef: record.caseRef,
    requestId: record.requestId,
    targetKind: record.target.kind,
    targetLabel: record.target.displayLabel,
    targetHash: record.target.targetHash,
    targetChainId: record.target.chainId ?? null,
    targetChainName: record.target.chainName ?? null,
    executionTargetState: record.target.kind === "contract" && record.target.chainId === "56" && record.target.chainName === "BSC"
      ? "CURRENT_EXECUTABLE_BSC"
      : "REVALIDATION_REQUIRED",
    tier: record.tier,
    locale: record.locale,
    status: record.status,
    entitlementRequired: record.entitlementRequired,
    entitlementVerified: record.entitlementVerified,
    analysisStarted: record.analysisStarted,
    checkoutBound: Boolean(record.checkoutSessionId),
    durable: record.durable,
    storageMode: record.storageMode,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    boundary: PASS4611_AUDIT_INTAKE_BOUNDARY,
    checkoutBoundary: PASS4612_AUDIT_CHECKOUT_BOUNDARY,
    statusBoundary: PASS4613_AUDIT_STATUS_BOUNDARY,
  };
}

export function getMemoryAuditIntakeCases() {
  return Array.from(memoryCases.values());
}
