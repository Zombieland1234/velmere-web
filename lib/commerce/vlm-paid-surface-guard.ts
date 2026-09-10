import { hashVelmereAccountBinding, resolveRequestAccount } from "@/lib/auth/account-session";
import { hasPass4682ServerEntitlementRecord } from "@/lib/commerce/paid-access-boundary";
import {
  resolveVlmAdvancedOnlyAccess,
  toPaymentRequiredPayload,
  type VlmAccessDepth,
  type VlmAccessGateVerdict,
  type VlmAccessPurpose,
  type VlmAccessSurface,
} from "@/lib/commerce/vlm-advanced-only-access-policy";
import {
  verifyVlmPaidAccountEntitlement,
  verifyVlmPaidEntitlementById,
  type VlmPaidAccountEntitlementVerdict,
  type VlmPaidEntitlementByIdVerdict,
} from "@/lib/commerce/vlm-entitlement-ledger";
import type { VlmPaidAccessContext, VlmPaidProductId } from "@/lib/commerce/vlm-paid-access";

export const VLM_PAID_SURFACE_GUARD_ID = "vlm-paid-surface-guard-v1" as const;

export const VLM_PAID_SURFACE_POLICIES = {
  real_markets_analysis: { surface: "real-markets", purpose: "analysis", depths: ["basic", "pro", "advanced"] },
  vlm_analysis: { surface: "shield", purpose: "analysis", depths: ["basic", "pro", "advanced"], dynamicContext: true },
  market_report: { surface: "shield", purpose: "pdf", depths: ["basic", "pro", "advanced"] },
  lens_pdf: { surface: "browser", purpose: "pdf", depths: ["basic", "pro", "advanced"] },
  angel_standalone: { surface: "unknown", purpose: "analysis", depths: ["basic"], dynamicContext: true },
  // Legacy identifier retained fail-closed; Angel is not a tiered paid product.
  angel_analysis: { surface: "unknown", purpose: "analysis", depths: ["basic"], dynamicContext: true },
  advanced_click: { surface: "unknown", purpose: "analysis", depths: ["basic", "pro", "advanced"], dynamicContext: true },
  brain_analysis: { surface: "shield", purpose: "analysis", depths: ["basic", "pro", "advanced"] },
  audit_review: { surface: "audit", purpose: "audit", depths: ["pro"] },
  audit_pdf_issue: { surface: "audit", purpose: "audit", depths: ["pro"] },
  audit_pdf_download: { surface: "audit", purpose: "pdf", depths: ["pro"] },
} as const satisfies Record<string, {
  surface: VlmAccessSurface;
  purpose: VlmAccessPurpose;
  depths: readonly VlmAccessDepth[];
  dynamicContext?: boolean;
}>;

export type VlmPaidSurfacePolicyId = keyof typeof VLM_PAID_SURFACE_POLICIES;

function policyFor(policyId: VlmPaidSurfacePolicyId) {
  return VLM_PAID_SURFACE_POLICIES[policyId];
}

function assertPolicyDepth(policyId: VlmPaidSurfacePolicyId, depth: unknown) {
  const normalized = depth === "basic" || depth === "pro" || depth === "advanced" ? depth : "basic";
  const policy = policyFor(policyId);
  if (!(policy.depths as readonly string[]).includes(normalized)) {
    throw new Error(`paid_surface_depth_not_allowed:${policyId}:${normalized}`);
  }
}

export async function resolveVlmPaidSurfaceAccess(args: {
  policyId: VlmPaidSurfacePolicyId;
  request: Request;
  depth: unknown;
  locale: VlmPaidAccessContext["locale"];
  assetId?: string | null;
  symbol?: string | null;
  requestId?: string | null;
  auditCaseRef?: string | null;
  returnPath?: string | null;
  surfaceOverride?: VlmAccessSurface;
  purposeOverride?: VlmAccessPurpose;
}): Promise<VlmAccessGateVerdict> {
  assertPolicyDepth(args.policyId, args.depth);
  const policy = policyFor(args.policyId);
  const surface = args.surfaceOverride ?? policy.surface;
  const purpose = args.purposeOverride ?? policy.purpose;
  if ((args.surfaceOverride || args.purposeOverride) && !("dynamicContext" in policy && policy.dynamicContext)) {
    throw new Error(`paid_surface_dynamic_context_not_allowed:${args.policyId}`);
  }
  return resolveVlmAdvancedOnlyAccess({
    request: args.request,
    purpose,
    depth: args.depth,
    surface,
    locale: args.locale,
    assetId: args.assetId,
    symbol: args.symbol,
    requestId: args.requestId,
    auditCaseRef: args.auditCaseRef,
    returnPath: args.returnPath,
  });
}

export function toVlmPaidSurfacePaymentRequiredPayload(
  verdict: Extract<VlmAccessGateVerdict, { ok: false }>,
) {
  return {
    ...toPaymentRequiredPayload(verdict),
    paidSurfaceGuard: VLM_PAID_SURFACE_GUARD_ID,
  };
}

export async function verifyVlmPaidSurfaceTokenEntitlement(args: {
  policyId: "audit_review";
  request: Request;
  productId: VlmPaidProductId;
  context: Partial<VlmPaidAccessContext>;
}): Promise<VlmPaidAccountEntitlementVerdict> {
  const policy = policyFor(args.policyId);
  if (policy.surface !== "audit" || policy.purpose !== "audit") {
    throw new Error(`paid_surface_policy_mismatch:${args.policyId}`);
  }
  const account = await resolveRequestAccount(args.request);
  if (!account) return { ok: false, error: "account_session_required" };
  return verifyVlmPaidAccountEntitlement({
    productId: args.productId,
    context: {
      ...args.context,
      accountIdHash: hashVelmereAccountBinding(account.accountId),
    },
  });
}

export function hasVlmPaidSurfaceServerEntitlement(
  verdict: VlmPaidAccountEntitlementVerdict,
) {
  return hasPass4682ServerEntitlementRecord(verdict);
}

export async function verifyVlmPaidSurfaceEntitlementById(args: {
  policyId: "audit_pdf_download";
  entitlementId: string;
  allowedProductIds: VlmPaidProductId[];
  accountIdHash: string;
  auditCaseRef?: string | null;
  assetId?: string | null;
  symbol?: string | null;
  now?: Date;
}): Promise<VlmPaidEntitlementByIdVerdict> {
  const policy = policyFor(args.policyId);
  if (policy.surface !== "audit" || policy.purpose !== "pdf") {
    throw new Error(`paid_surface_policy_mismatch:${args.policyId}`);
  }
  return verifyVlmPaidEntitlementById({
    entitlementId: args.entitlementId,
    allowedProductIds: args.allowedProductIds,
    accountIdHash: args.accountIdHash,
    auditCaseRef: args.auditCaseRef,
    assetId: args.assetId,
    symbol: args.symbol,
    now: args.now,
  });
}
