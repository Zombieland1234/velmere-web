import { NextResponse } from "next/server";
import { verifySecurityAdminToken } from "@/lib/security/security-admin-auth";
import { buildPass2579AdvancedManualReviewQueueReport } from "@/lib/security/advanced-manual-review-queue";
import { buildPass2580CustomerSafeDeliveryDecisionReport } from "@/lib/security/customer-safe-delivery-decision";
import { buildPass2581AuditVersionedRecheckReceiptReport } from "@/lib/security/audit-versioned-recheck-receipt";
import { buildPass2585PremiumProPdfTemplateContractReport } from "@/lib/security/premium-pro-pdf-template-contract";
import { buildPass2586AdvancedOperatorConsoleMergeReport } from "@/lib/security/advanced-operator-console-merge";
import { buildPass2587ServerPaymentAccountDeliveryGateReport } from "@/lib/security/server-payment-account-delivery-gate";
import { buildPass2588AuditCaseVaultPrivateDeliveryLedgerReport, PASS2588_AUDIT_CASE_VAULT_PRIVATE_DELIVERY_LEDGER_ID } from "@/lib/security/audit-case-vault-private-delivery-ledger";

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
  const reviewLevel = clean(url.searchParams.get("reviewLevel"), "advanced_review", 32);
  const paymentVerified = url.searchParams.get("paymentVerified") === "true";
  const isContract = /^0x[a-fA-F0-9]{40}$/.test(target);
  const base = {
    locale,
    chain,
    contractAddress: isContract ? target : undefined,
    projectName: isContract ? undefined : target,
    reviewLevel: reviewLevel === "pro_review" || reviewLevel === "advanced_review" ? reviewLevel : "basic_review",
  } as const;

  const advancedManualReviewQueue = buildPass2579AdvancedManualReviewQueueReport({ ...base, reviewLevel: "advanced_review" });
  const customerSafeDeliveryDecision = buildPass2580CustomerSafeDeliveryDecisionReport({
    ...base,
    reviewLevel: "advanced_review",
    advancedManualReviewQueue,
  });
  const versionedRecheckReceipt = buildPass2581AuditVersionedRecheckReceiptReport({
    ...base,
    reviewLevel: "advanced_review",
    customerSafeDeliveryDecision,
  });
  const premiumProPdfTemplateContract = buildPass2585PremiumProPdfTemplateContractReport({
    ...base,
    reviewLevel: "advanced_review",
    customerSafeDeliveryDecision,
    versionedRecheckReceipt,
  });
  const advancedOperatorConsoleMerge = buildPass2586AdvancedOperatorConsoleMergeReport({
    ...base,
    reviewLevel: "advanced_review",
    paymentVerified,
    advancedManualReviewQueue,
    customerSafeDeliveryDecision,
    versionedRecheckReceipt,
    premiumProPdfTemplateContract,
  });
  const serverPaymentAccountDeliveryGate = buildPass2587ServerPaymentAccountDeliveryGateReport({
    ...base,
    reviewLevel: "advanced_review",
    versionedRecheckReceipt,
    advancedOperatorConsoleMerge,
  });
  const report = buildPass2588AuditCaseVaultPrivateDeliveryLedgerReport({
    ...base,
    reviewLevel: "advanced_review",
    versionedRecheckReceipt,
    premiumProPdfTemplateContract,
    advancedOperatorConsoleMerge,
    serverPaymentAccountDeliveryGate,
  });

  return NextResponse.json({ ok: true, report }, {
    headers: {
      "cache-control": "no-store",
      "x-velmere-pass2622-private-route-lockdown": "verifySecurityAdminToken-security-console",
      "x-velmere-audit-case-vault-private-delivery-ledger": PASS2588_AUDIT_CASE_VAULT_PRIVATE_DELIVERY_LEDGER_ID,
      "x-velmere-private-delivery-boundary": "vault-pointer-not-raw-payload",
    },
  });
}
