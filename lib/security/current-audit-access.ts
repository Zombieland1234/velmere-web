import type { NextRequest } from "next/server";
import type { AuditTier } from "./audit-canonical-report";
import { verifyVlmPaidSurfaceEntitlementById } from "@/lib/commerce/vlm-paid-surface-guard";
import { verifyVlmPaidAccountEntitlement } from "@/lib/commerce/vlm-entitlement-ledger";
import { hashVelmereAccountBinding } from "@/lib/auth/account-session";

/** Regeneration (JSON and PDF) requires a CURRENT grant. A case's historical
 * entitlementVerified flag is not authority. Archived stored artifacts are a
 * separate access policy; this resolver does not grant access to that archive.
 */
export async function resolveCurrentAuditAccess(
  request: NextRequest,
  accountId: string | null,
  caseRef?: string,
): Promise<{ clientTier: AuditTier; entitlementId?: string }> {
  if (!accountId) {
    return { clientTier: "basic" };
  }

  const entitlementHeader = request.headers.get("x-velmere-entitlement-id")?.trim();
  const searchParams = request.nextUrl.searchParams;
  const entitlementId = entitlementHeader || searchParams.get("entitlementId")?.trim();

  if (!entitlementId) {
    // Historical verification is not current access: regeneration requires an active grant.
    // Check if account has an active server entitlement in ledger
    const accountIdHash = hashVelmereAccountBinding(accountId);
    const advCheck = await verifyVlmPaidAccountEntitlement({
      productId: "vlm_advanced_audit_human_review",
      context: { accountIdHash, auditCaseRef: caseRef },
    });
    if (advCheck.ok && advCheck.entitlement) {
      return { clientTier: "advanced", entitlementId: advCheck.entitlement.id };
    }
    const proCheck = await verifyVlmPaidAccountEntitlement({
      productId: "vlm_pro_audit_review",
      context: { accountIdHash, auditCaseRef: caseRef },
    });
    if (proCheck.ok && proCheck.entitlement) {
      return { clientTier: "pro", entitlementId: proCheck.entitlement.id };
    }
    return { clientTier: "basic" };
  }

  const entitlementCheck = await verifyVlmPaidSurfaceEntitlementById({
    policyId: "audit_pdf_download",
    entitlementId,
    allowedProductIds: ["vlm_pro_audit_review", "vlm_advanced_audit_human_review"],
    accountIdHash: hashVelmereAccountBinding(accountId),
    auditCaseRef: caseRef,
  });

  if (entitlementCheck.ok && entitlementCheck.entitlement) {
    const isAdvanced = entitlementCheck.entitlement.productId === "vlm_advanced_audit_human_review";
    return {
      clientTier: isAdvanced ? "advanced" : "pro",
      entitlementId,
    };
  }

  return { clientTier: "basic" };
}
