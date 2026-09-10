import { ASCII_CONTROL_OR_MARKUP_PATTERN } from "../../security/ascii-control-characters";

import { createHash, randomUUID } from "node:crypto";
import { resolveRequestAccount, PASS2363_ACCOUNT_AUTH_SPINE_ID } from "@/lib/auth/account-session";
import {
  applyApiRateLimit,
  assertSameOriginRequest,
  rejectLargeContentLength,
  securityJson,
} from "@/lib/security/api-guard";
import { readBoundedJsonBody } from "@/lib/security/payment-webhook-guard";
import {
  auditIntakePublicCase,
  createAuditIntakeCase,
  getAuditIntakeRuntimeMode,
  normalizeAuditTarget,
  PASS4611_AUDIT_INTAKE_BOUNDARY,
  PASS4611_AUDIT_INTAKE_CASE_VAULT_ID,
  type AuditIntakeTier,
} from "@/lib/security/audit-intake-case-vault";
import { appendPass2178MutationReceipt } from "@/lib/security/mutation-receipt-vault";
import { storeAuditAccountMessage } from "@/lib/account/audit-account-messages";

function cleanString(value: unknown, max: number) {
  if (typeof value !== "string") return "";
  return value.replace(ASCII_CONTROL_OR_MARKUP_PATTERN, " ").replace(/\s+/g, " ").trim().slice(0, max);
}

function normalizeTier(value: unknown): AuditIntakeTier | null {
  return value === "basic" || value === "pro" || value === "advanced" ? value : null;
}

function normalizeLocale(value: unknown): "pl" | "en" | "de" {
  return value === "pl" || value === "de" ? value : "en";
}

function requestId(value: unknown) {
  const clean = cleanString(value, 96).replace(/[^a-zA-Z0-9:_-]/g, "");
  return clean || `audit_${randomUUID()}`;
}

function requestIdHash(value: string) {
  return `sha256:${createHash("sha256").update(value).digest("hex").slice(0, 24)}`;
}

export async function POST(request: Request) {
  const sizeGuard = rejectLargeContentLength(request, 16 * 1024);
  if (sizeGuard) return sizeGuard;
  const originGuard = assertSameOriginRequest(request, { allowMissingOrigin: process.env.NODE_ENV !== "production" });
  if (originGuard) return originGuard;
  const rate = await applyApiRateLimit(request, { keyPrefix: "pass4611-audit-intake", limit: 8, windowMs: 60_000 });
  if (!rate.ok) return rate.response;

  const parsedBody = await readBoundedJsonBody<Record<string, unknown>>(
    request,
    16 * 1024,
    { maxDepth: 12 },
  );
  if (!parsedBody.ok) return parsedBody.response;
  const payload = parsedBody.value;

  const rawTarget = cleanString(payload.target, 600);
  const recognizedTarget = normalizeAuditTarget(rawTarget);
  const tier = normalizeTier(payload.tier);
  const locale = normalizeLocale(payload.locale);
  const clientRequestId = requestId(payload.requestId);

  if (!recognizedTarget) {
    return securityJson({
      ok: false,
      error: "invalid_target",
      recognizedFutureTargets: ["public URL", "GitHub owner/repository"],
      currentExecutableTarget: { kind: "contract", chainId: "56", chainName: "BSC" },
    }, { status: 400 });
  }
  if (!tier) {
    return securityJson({ ok: false, error: "invalid_tier" }, { status: 400 });
  }
  if (recognizedTarget.kind !== "contract") {
    return securityJson({
      ok: false,
      error: tier === "basic" ? "basic_execution_target_withheld" : "audit_execution_target_withheld",
      executionState: "WITHHELD",
      recognizedTargetKind: recognizedTarget.kind,
      recognizedForFutureTopology: true,
      queued: false,
      analysisStarted: false,
      currentExecutableTarget: { kind: "contract", chainId: "56", chainName: "BSC" },
    }, { status: 422 });
  }
  const requestedChainId = payload.chainId === 56 ? "56" : cleanString(payload.chainId, 20);
  const requestedChainName = cleanString(payload.chainName, 40).toUpperCase();
  if (requestedChainId !== "56" || (requestedChainName && requestedChainName !== "BSC")) {
    return securityJson({
      ok: false,
      error: requestedChainId ? "audit_execution_chain_withheld" : "audit_execution_chain_required",
      executionState: "WITHHELD",
      queued: false,
      analysisStarted: false,
      requiredChain: { chainId: "56", chainName: "BSC" },
    }, { status: 422 });
  }
  const target = normalizeAuditTarget(rawTarget, { chainId: "56", chainName: "BSC" });
  if (!target || target.kind !== "contract" || target.chainId !== "56" || target.chainName !== "BSC") {
    return securityJson({ ok: false, error: "audit_execution_chain_withheld", executionState: "WITHHELD", queued: false }, { status: 422 });
  }
  const account = await resolveRequestAccount(request);
  if (!account) {
    return securityJson(
      {
        ok: false,
        error: "account_required",
        tier,
        entitlementRequired: tier !== "basic",
        analysisStarted: false,
        message: tier === "basic"
          ? "Basic remains free, but every queued report requires an authenticated owner for private status, immutable artifact storage and cross-account isolation."
          : "Paid audit cases require an account before entitlement can be verified.",
      },
      { status: 401, headers: { "x-velmere-pass2363-auth-spine": PASS2363_ACCOUNT_AUTH_SPINE_ID } },
    );
  }

  const result = await createAuditIntakeCase({
    requestId: clientRequestId,
    target,
    sourceCandidates: {
      auditUrl: cleanString(payload.auditUrl, 600) || undefined,
      docsUrl: cleanString(payload.docsUrl, 600) || undefined,
      githubUrl: cleanString(payload.githubUrl, 600) || undefined,
      website: cleanString(payload.website, 600) || undefined,
    },
    tier,
    locale,
    accountId: account?.accountId,
    accountEmail: account?.email,
  });

  if (!result.ok || !result.record) {
    const status = result.error === "durable_storage_required" || result.error === "durable_write_failed"
      ? 503
      : result.error === "case_target_withheld" || result.error === "case_target_revalidation_required"
        ? 422
        : 500;
    return securityJson(
      {
        ok: false,
        error: result.error ?? "audit_intake_failed",
        storageMode: result.storageMode,
        durable: result.durable,
        failClosed: result.failClosed,
        analysisStarted: false,
        boundary: PASS4611_AUDIT_INTAKE_BOUNDARY,
      },
      {
        status,
        headers: {
          "retry-after": "30",
          "x-velmere-pass4611-audit-intake": PASS4611_AUDIT_INTAKE_CASE_VAULT_ID,
          "x-velmere-audit-intake-storage": result.storageMode,
        },
      },
    );
  }

  const mutationReceipt = await appendPass2178MutationReceipt({
    request,
    action: "audit_intake_case_created",
    targetType: "audit_intake_case",
    targetId: result.record.caseRef,
    actorId: account.accountId,
    actorMode: "member",
    payload: {
      caseRef: result.record.caseRef,
      requestIdHash: requestIdHash(clientRequestId),
      targetHash: target.targetHash,
      targetKind: target.kind,
      targetChainId: target.chainId,
      targetChainName: target.chainName,
      tier,
      locale,
      status: result.record.status,
      entitlementRequired: result.record.entitlementRequired,
      duplicate: result.duplicate,
      durable: result.durable,
    },
    safeSummary: "Audit intake case accepted with a redacted target hash. Paid analysis remains blocked until entitlement verification.",
  });

  try {
    await storeAuditAccountMessage({
      message: {
        id: result.record.caseRef,
        title: `Audit Prescreen Case ${result.record.caseRef}`,
        body: `Smart contract prescreen for ${target.displayLabel} (${target.chainName} chain) has been registered. Initial static analysis is in progress.`,
        status: "queued",
        packageLabel: tier === "basic" ? "Velmère Basic Prescreen" : "Velmère Audit",
        requestId: clientRequestId,
        createdAt: new Date().toISOString(),
        eta: "within 15 minutes",
        accountRoute: `/${locale}/account?tab=audits&caseRef=${encodeURIComponent(result.record.caseRef)}`,
        nextSteps: [
          "Contract validity and AST checks are running in background",
          "Check permissions, honeypot and ownership controls",
          "Download your audit artifact once prescreen completes",
        ],
      },
      accountId: account.accountId,
      contactEmail: account.email,
      locale,
      reviewLevel: tier,
      projectName: "Smart Contract Prescreen",
      contractAddress: target.canonicalTarget,
      auditCaseRef: result.record.caseRef,
    });
  } catch {
    // continue safely if message store is offline
  }

  const publicCase = auditIntakePublicCase(result.record);
  const httpStatus = result.duplicate ? 200 : result.record.status === "queued_basic_prescreen" ? 202 : 201;

  return securityJson(
    {
      ok: true,
      passId: PASS4611_AUDIT_INTAKE_CASE_VAULT_ID,
      duplicate: result.duplicate,
      case: publicCase,
      nextAction:
        result.record.status === "queued_basic_prescreen"
          ? "basic_prescreen_queue"
          : "verify_account_entitlement_before_analysis",
      mutationReceipt: {
        receiptId: mutationReceipt.receiptId,
        persisted: mutationReceipt.persisted,
        durableWrite: mutationReceipt.durableWrite,
        rawPayloadStored: false,
      },
      auth: {
        passId: PASS2363_ACCOUNT_AUTH_SPINE_ID,
        accountResolved: true,
      },
      runtime: getAuditIntakeRuntimeMode(),
      executionChain: { chainId: target.chainId, chainName: target.chainName },
      boundary: PASS4611_AUDIT_INTAKE_BOUNDARY,
    },
    {
      status: httpStatus,
      headers: {
        "x-velmere-pass4611-audit-intake": PASS4611_AUDIT_INTAKE_CASE_VAULT_ID,
        "x-velmere-audit-intake-storage": result.storageMode,
        "x-velmere-audit-intake-durable": result.durable ? "true" : "false",
        "x-velmere-audit-analysis-started": "false",
        "x-velmere-pass2363-auth-spine": PASS2363_ACCOUNT_AUTH_SPINE_ID,
      },
    },
  );
}

export async function GET() {
  return securityJson(
    {
      ok: true,
      passId: PASS4611_AUDIT_INTAKE_CASE_VAULT_ID,
      runtime: getAuditIntakeRuntimeMode(),
      currentExecutableTarget: { kind: "contract", chainId: "56", chainName: "BSC", input: "0x contract address" },
      recognizedFutureTargets: ["public URL", "GitHub owner/repository"],
      nonExecutableTargetState: "WITHHELD_NOT_QUEUED",
      tiers: {
        basic: "queues a free account-owned automated pre-screen only after durable case persistence",
        pro: "creates an account-bound case; analysis waits for entitlement",
        advanced: "creates an account-bound case; analysis remains stop-sold today and, when enabled, runs the deeper automated evidence/retest pipeline without mandatory human allocation",
      },
      boundary: PASS4611_AUDIT_INTAKE_BOUNDARY,
    },
    { headers: { "x-velmere-pass4611-audit-intake": PASS4611_AUDIT_INTAKE_CASE_VAULT_ID } },
  );
}
