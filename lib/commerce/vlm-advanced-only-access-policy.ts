import { hashVelmereAccountBinding, resolveRequestAccount, type VelmereResolvedAccount } from "@/lib/auth/account-session";
import { getVlmPaidProduct, normalizePaidContext, type VlmPaidAccessContext, type VlmPaidProductId } from "@/lib/commerce/vlm-paid-access";
import { getVlmCurrentSkuTruth } from "@/lib/commerce/vlm-current-sku-truth";
import { hasPass4682ServerEntitlementRecord } from "@/lib/commerce/paid-access-boundary";
import {
  buildVlmAdvancedOnlyTierPolicies,
  type VlmAccessDepth,
  type VlmAccessPurpose,
  type VlmAccessSurface,
  type VlmPaidAccessMode,
  type VlmTierPolicy,
} from "@/lib/commerce/vlm-tier-presentation-policy";
export { buildVlmAdvancedOnlyTierPolicies } from "@/lib/commerce/vlm-tier-presentation-policy";
export type {
  VlmAccessDepth,
  VlmAccessPaymentRail,
  VlmAccessPurpose,
  VlmAccessSurface,
  VlmPaidAccessMode,
  VlmTierPolicy,
} from "@/lib/commerce/vlm-tier-presentation-policy";
import {
  getVlmPaidEntitlementRuntimeMode,
  verifyVlmPaidAccountEntitlement,
  verifyVlmPaidEntitlementById,
  type VlmPaidAccountEntitlementVerdict,
} from "@/lib/commerce/vlm-entitlement-ledger";

export const PASS2173_ADVANCED_ONLY_ACCESS_ID = "pass2173-vlm-advanced-only-access-policy" as const;
export const PASS2223_ADVANCED_ONLY_RUNTIME_GATE_ID = "pass2223-advanced-only-runtime-gate-fail-closed" as const;
export const PASS2783_COMMERCIAL_TIER_RECEIPT_LOCK_ID = "pass2783-basic-free-pro-paid-advanced-paid-receipt-lock" as const;

type PaidDepth = Exclude<VlmAccessDepth, "basic">;

type PaidProductVerdictFields = {
  paidRequired: true;
  policy: VlmTierPolicy;
  context: VlmPaidAccessContext;
  product: ReturnType<typeof getVlmPaidProduct>;
  includedProduct?: ReturnType<typeof getVlmPaidProduct>;
  includedReason?: string;
  ledgerMode?: "durable" | "memory" | "token_only_non_production";
};

export type VlmAccessGateVerdict =
  | {
      ok: true;
      depth: "basic";
      paidRequired: false;
      accessMode: "free_basic";
      policy: VlmTierPolicy;
      context: VlmPaidAccessContext;
      reason: "basic_is_free";
    }
  | {
      ok: true;
      depth: PaidDepth;
      paidRequired: true;
      accessMode: VlmPaidAccessMode;
      policy: VlmTierPolicy;
      context: VlmPaidAccessContext;
      entitlement: Extract<VlmPaidAccountEntitlementVerdict, { ok: true }>;
      reason: "paid_entitlement_verified";
    }
  | ({
      ok: false;
      depth: PaidDepth;
      accessMode: VlmPaidAccessMode;
      reason: string;
      headers: Record<string, string>;
    } & PaidProductVerdictFields);

export function normalizeVlmAccessDepth(value: unknown): VlmAccessDepth {
  return value === "basic" || value === "pro" || value === "advanced" ? value : "basic";
}

function productForDepthPurpose(depth: PaidDepth, purpose: VlmAccessPurpose): VlmPaidProductId {
  if (depth === "pro") {
    if (purpose === "pdf") return "vlm_pro_pdf_single";
    if (purpose === "audit") return "vlm_pro_audit_review";
    return "vlm_pro_analysis_single";
  }
  if (purpose === "pdf") return "vlm_advanced_pdf_single";
  if (purpose === "audit") return "vlm_advanced_audit_human_review";
  return "vlm_advanced_analysis_single";
}

function paidAccessModeForDepth(depth: PaidDepth): VlmPaidAccessMode {
  return depth === "pro" ? "paid_pro" : "paid_advanced";
}

export function buildVlmAdvancedOnlyPolicySummary(locale: string = "en") {
  const tiers = buildVlmAdvancedOnlyTierPolicies(locale);
  return {
    schemaVersion: PASS2783_COMMERCIAL_TIER_RECEIPT_LOCK_ID,
    previousPolicyId: PASS2173_ADVANCED_ONLY_ACCESS_ID,
    actualPolicy: "basic_free_limited_prescreen__pro_invitation_only_beta__advanced_not_for_sale",
    paymentBoundary: "Public checkout is disabled. Existing server-bound Pro beta entitlements may be verified; Advanced remains unavailable. Wallet identity never unlocks a tier.",
    tiers: [tiers.basic, tiers.pro, tiers.advanced],
    p0BackendRule: "Pro requires an existing invitation-bound server entitlement. Advanced must fail closed as NOT_FOR_SALE. UI state, wallet connection and legacy checkout metadata cannot promote access.",
  };
}

export async function resolveVlmAdvancedOnlyAccess(args: {
  request: Request;
  purpose: VlmAccessPurpose;
  depth: unknown;
  surface: VlmAccessSurface;
  locale: VlmPaidAccessContext["locale"];
  assetId?: string | null;
  symbol?: string | null;
  requestId?: string | null;
  auditCaseRef?: string | null;
  returnPath?: string | null;
  account?: VelmereResolvedAccount | null;
}) : Promise<VlmAccessGateVerdict> {
  const depth = normalizeVlmAccessDepth(args.depth);
  const policies = buildVlmAdvancedOnlyTierPolicies(args.locale);
  const account = args.account !== undefined ? args.account : await resolveRequestAccount(args.request);
  const context = normalizePaidContext({
    surface: args.surface,
    locale: args.locale,
    assetId: args.assetId || undefined,
    symbol: args.symbol || undefined,
    depth,
    requestId: args.requestId || undefined,
    auditCaseRef: args.auditCaseRef || undefined,
    returnPath: args.returnPath || undefined,
    accountIdHash: account ? hashVelmereAccountBinding(account.accountId) : undefined,
  }, args.locale);

  if (depth === "basic") {
    return { ok: true, depth, paidRequired: false, accessMode: "free_basic", policy: policies.basic, context, reason: "basic_is_free" };
  }

  const paidDepth = depth as PaidDepth;
  const productId = productForDepthPurpose(paidDepth, args.purpose);
  const policy = { ...policies[paidDepth], productId };
  const paidMode = paidAccessModeForDepth(paidDepth);
  const product = getVlmPaidProduct(productId, args.locale);
  const skuTruth = getVlmCurrentSkuTruth(paidDepth, args.locale);

  if (!account) {
    return {
      ok: false,
      depth: paidDepth,
      paidRequired: true,
      accessMode: paidMode,
      policy,
      context,
      product,
      reason: "invitation_only_beta_account_required",
      headers: { "x-velmere-access-decision": paidDepth === "advanced" ? "NOT_FOR_SALE" : "INVITATION_ONLY_CONTROLLED_BETA" },
    };
  }

  const entitlementHeader = args.request?.headers ? args.request.headers.get("x-velmere-entitlement-id")?.trim() : null;
  const urlParams = args.request?.url ? new URL(args.request.url).searchParams : null;
  const directEntitlementId = entitlementHeader || urlParams?.get("entitlementId")?.trim();

  let entitlement = await verifyVlmPaidAccountEntitlement({ productId, context });

  if (!hasPass4682ServerEntitlementRecord(entitlement) && directEntitlementId) {
    const byIdVerdict = await verifyVlmPaidEntitlementById({
      entitlementId: directEntitlementId,
      allowedProductIds: [productId],
      accountIdHash: context.accountIdHash ?? "",
      auditCaseRef: context.auditCaseRef,
      assetId: context.assetId,
      symbol: context.symbol,
    });
    if (byIdVerdict.ok && byIdVerdict.entitlement) {
      entitlement = byIdVerdict as unknown as VlmPaidAccountEntitlementVerdict;
    }
  }

  if (hasPass4682ServerEntitlementRecord(entitlement)) {
    return {
      ok: true,
      depth: paidDepth,
      paidRequired: true,
      accessMode: paidMode,
      policy,
      context,
      entitlement: entitlement as unknown as Extract<VlmPaidAccountEntitlementVerdict, { ok: true }>,
      reason: "paid_entitlement_verified",
    };
  }
  const primaryEntitlementError =
    (entitlement as { error?: string }).error || "server_entitlement_record_required";

  let includedProduct: ReturnType<typeof getVlmPaidProduct> | undefined;
  let includedReason: string | undefined;
  let ledgerMode = entitlement.ledgerMode;
  if (args.purpose === "pdf") {
    const auditContext = normalizePaidContext({ ...context, surface: "audit", returnPath: undefined }, args.locale);
    const auditBundleProduct = paidDepth === "pro" ? "vlm_pro_audit_review" : "vlm_advanced_audit_human_review";
    const included = await verifyVlmPaidAccountEntitlement({ productId: auditBundleProduct, context: auditContext });
    if (hasPass4682ServerEntitlementRecord(included)) {
      return {
        ok: true,
        depth: paidDepth,
        paidRequired: true,
        accessMode: paidMode,
        policy,
        context,
        entitlement: included as unknown as Extract<VlmPaidAccountEntitlementVerdict, { ok: true }>,
        reason: "paid_entitlement_verified",
      };
    }
    includedProduct = getVlmPaidProduct(auditBundleProduct, args.locale);
    includedReason =
      (included as { error?: string }).error || "server_entitlement_record_required";
    ledgerMode = entitlement.ledgerMode ?? included.ledgerMode;
  }

  return {
    ok: false,
    depth: paidDepth,
    paidRequired: true,
    accessMode: paidMode,
    policy,
    context,
    product,
    includedProduct,
    reason: primaryEntitlementError,
    includedReason,
    ledgerMode,
    headers: { "x-velmere-access-decision": paidDepth === "advanced" ? "NOT_FOR_SALE" : "INVITATION_ONLY_CONTROLLED_BETA" },
  };
}

export function toPaymentRequiredPayload(verdict: Extract<VlmAccessGateVerdict, { ok: false }>) {
  const decision = verdict.product.customerDecision ?? (verdict.depth === "advanced" ? "NOT_FOR_SALE" : "INVITATION_ONLY_CONTROLLED_BETA");
  return {
    ok: false,
    mode: "error",
    error: decision === "NOT_FOR_SALE" ? "product_not_for_sale" : "invitation_required",
    policy: verdict.policy,
    product: verdict.product,
    includedProduct: verdict.includedProduct,
    context: verdict.context,
    reason: verdict.reason,
    includedReason: verdict.includedReason,
    ledgerMode: verdict.ledgerMode,
    requestedTier: verdict.depth,
    decision,
    publicCheckoutAllowed: false,
    publicPrice: null,
    freeTiers: ["basic"],
    invitationOnlyTiers: ["pro"],
    notForSaleTiers: ["advanced"],
    pass2223: PASS2223_ADVANCED_ONLY_RUNTIME_GATE_ID,
    pass2783: PASS2783_COMMERCIAL_TIER_RECEIPT_LOCK_ID,
    runtimeMode: getVlmPaidEntitlementRuntimeMode(),
  };
}
