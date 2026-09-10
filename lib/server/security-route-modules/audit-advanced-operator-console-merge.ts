import { NextResponse } from "next/server";
import { verifySecurityAdminToken } from "@/lib/security/security-admin-auth";
import { buildPass2579AdvancedManualReviewQueueReport } from "@/lib/security/advanced-manual-review-queue";
import { buildPass2580CustomerSafeDeliveryDecisionReport } from "@/lib/security/customer-safe-delivery-decision";
import { buildPass2581AuditVersionedRecheckReceiptReport } from "@/lib/security/audit-versioned-recheck-receipt";
import { buildPass2585PremiumProPdfTemplateContractReport } from "@/lib/security/premium-pro-pdf-template-contract";
import { buildPass2586AdvancedOperatorConsoleMergeReport, PASS2586_ADVANCED_OPERATOR_CONSOLE_MERGE_ID } from "@/lib/security/advanced-operator-console-merge";

function clean(value: string | null, fallback = "", max = 180) {
  const text = String(value ?? fallback).replace(/[<>\r\n]/g, " ").trim();
  return text ? text.slice(0, max) : fallback;
}

export async function GET(request: Request) {
  const pass2622AdminGate = verifySecurityAdminToken(request, ["security:console"]);
  if (!pass2622AdminGate.ok) return pass2622AdminGate.response;

  const url = new URL(request.url);
  const locale = clean(url.searchParams.get("locale"), "en", 8);
  const chain = clean(url.searchParams.get("chain"), "ethereum", 40);
  const target = clean(url.searchParams.get("target"), "Velmere sample token", 180);
  const paymentVerified = url.searchParams.get("paymentVerified") === "true";
  const isContract = /^0x[a-fA-F0-9]{40}$/.test(target);
  const base = {
    locale,
    chain,
    contractAddress: isContract ? target : undefined,
    projectName: isContract ? undefined : target,
    reviewLevel: "advanced_review" as const,
  };

  const advancedManualReviewQueue = buildPass2579AdvancedManualReviewQueueReport(base);
  const customerSafeDeliveryDecision = buildPass2580CustomerSafeDeliveryDecisionReport({
    ...base,
    advancedManualReviewQueue,
  });
  const versionedRecheckReceipt = buildPass2581AuditVersionedRecheckReceiptReport({
    ...base,
    customerSafeDeliveryDecision,
  });
  const premiumProPdfTemplateContract = buildPass2585PremiumProPdfTemplateContractReport({
    ...base,
    customerSafeDeliveryDecision,
    versionedRecheckReceipt,
  });
  const report = buildPass2586AdvancedOperatorConsoleMergeReport({
    ...base,
    paymentVerified,
    advancedManualReviewQueue,
    customerSafeDeliveryDecision,
    versionedRecheckReceipt,
    premiumProPdfTemplateContract,
  });

  return NextResponse.json({ ok: true, report }, {
    headers: {
      "cache-control": "no-store",
      "x-velmere-pass2622-private-route-lockdown": "verifySecurityAdminToken-security-console",
      "x-velmere-advanced-operator-console-merge": PASS2586_ADVANCED_OPERATOR_CONSOLE_MERGE_ID,
      "x-velmere-advanced-boundary": "operator-console-private-not-customer-raw-output",
    },
  });
}
