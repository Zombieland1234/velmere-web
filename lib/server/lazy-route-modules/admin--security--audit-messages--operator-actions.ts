import { NextResponse } from "next/server";
import { readBoundedJsonBody } from "@/lib/security/payment-webhook-guard";
import { applyApiRateLimit, assertSameOriginRequest, rejectLargeContentLength } from "@/lib/security/api-guard";
import {
  verifySecurityAdminMutationAssertionAfterToken,
  verifySecurityAdminToken,
} from "@/lib/security/security-admin-auth";
import {
  buildAuditOperatorActionReadiness,
  listAuditAccountMessages,
  PASS2361_AUDIT_OPERATOR_ACTIONS_ID,
  PASS2369_CUSTOMER_SAFE_REPORT_ROUTE_ID,
  updateAuditAccountMessage,
  getAuditAccountMessageByIdentifier,
  type AuditOperatorActionType,
} from "@/lib/account/audit-account-messages";
import { buildPass2376FinalDeliveryGate, PASS2376_FINAL_DELIVERY_GATE_ID } from "@/lib/security/final-delivery-gate";
import { createPass2377DeliveryReceipt, PASS2377_DELIVERY_RECEIPT_LEDGER_ID } from "@/lib/security/delivery-receipt-ledger";
import { publicApiError } from "@/lib/security/api-error-envelope";

const ACTIONS = new Set<AuditOperatorActionType>([
  "mark_analysis",
  // Legacy input is normalized by audit-account-messages before persistence/customer output.
  "mark_human_review",
  "request_evidence",
  "attach_pdf",
  "mark_ready",
  "deliver_customer_safe_report",
  "block_redaction",
]);

function cleanText(value: unknown, max = 320) {
  if (typeof value !== "string") return undefined;
  const trimmed = value.replace(/[<>]/g, "").trim();
  return trimmed ? trimmed.slice(0, max) : undefined;
}

function normalizeLocale(value: unknown) {
  return value === "pl" || value === "de" || value === "en" ? value : "en";
}

export async function GET(request: Request) {
  const adminToken = verifySecurityAdminToken(request, ["security:events", "security:export"], undefined, { deferBodyBoundMutationAssertion: true });
  if (!adminToken.ok) return adminToken.response;

  const url = new URL(request.url);
  const locale = normalizeLocale(url.searchParams.get("locale"));
  const delivery = await listAuditAccountMessages({ locale, limit: Number(url.searchParams.get("limit") ?? 24) });

  return NextResponse.json({
    ok: true,
    passId: PASS2361_AUDIT_OPERATOR_ACTIONS_ID,
    source: delivery.source,
    readiness: buildAuditOperatorActionReadiness(delivery.messages),
    messages: delivery.messages,
    operator: adminToken.operator,
  }, {
    headers: {
      "cache-control": "no-store",
      "x-velmere-pass2361-audit-operator-actions": PASS2361_AUDIT_OPERATOR_ACTIONS_ID,
      "x-velmere-customer-safe-report-route": PASS2369_CUSTOMER_SAFE_REPORT_ROUTE_ID,
      "x-velmere-final-delivery-gate": PASS2376_FINAL_DELIVERY_GATE_ID,
    },
  });
}

export async function POST(request: Request) {
  const sizeGuard = rejectLargeContentLength(request, 96 * 1024);
  if (sizeGuard) return sizeGuard;

  const originGuard = assertSameOriginRequest(request, { allowMissingOrigin: true });
  if (originGuard) return originGuard;

  const rate = await applyApiRateLimit(request, {
    keyPrefix: "pass2361-audit-operator-actions",
    limit: 30,
    windowMs: 60_000,
  });
  if (!rate.ok) return rate.response;

  const adminToken = verifySecurityAdminToken(
    request,
    ["security:events", "security:export"],
    undefined,
    { deferBodyBoundMutationAssertion: true },
  );
  if (!adminToken.ok) return adminToken.response;

  type OperatorActionPayload = Partial<{
    messageId: string;
    requestId: string;
    action: AuditOperatorActionType;
    locale: string;
    operatorNote: string;
    pdfRoute: string;
    publicReportRoute: string;
    exportRoute: string;
    finalDeliveryGateId: string;
    routeHealthEndpointPingRequired: boolean;
  }>;
  const parsedBody = await readBoundedJsonBody<OperatorActionPayload>(request, 96 * 1024, { maxDepth: 12 });
  if (!parsedBody.ok) return parsedBody.response;
  const payload = parsedBody.value;
  const admin = await verifySecurityAdminMutationAssertionAfterToken({
    request,
    requiredScopes: ["security:events", "security:export"],
    operatorRequirement: { role: "security_admin", requirePhishingResistantMfa: true },
    requestBody: payload,
  });
  if (!admin.ok) return admin.response;

  const action = payload.action;
  if (!action || !ACTIONS.has(action)) {
    return NextResponse.json({ ok: false, error: "invalid_operator_action", actions: Array.from(ACTIONS) }, { status: 400 });
  }

  const locale = normalizeLocale(payload.locale);
  let finalDeliveryGate;
  if (action === "deliver_customer_safe_report") {
    const current = await getAuditAccountMessageByIdentifier({
      id: cleanText(payload.messageId, 160),
      requestId: cleanText(payload.requestId, 160),
      locale,
    });
    finalDeliveryGate = await buildPass2376FinalDeliveryGate({
      locale,
      message: current?.record ?? null,
      staleAfterMinutes: 15,
    });
    if (!finalDeliveryGate.canDeliver) {
      return NextResponse.json({
        ok: false,
        error: "final_delivery_gate_blocked",
        passId: PASS2376_FINAL_DELIVERY_GATE_ID,
        finalDeliveryGate,
        safetyBoundary: finalDeliveryGate.safeBoundary,
      }, {
        status: 409,
        headers: {
          "cache-control": "no-store",
          "x-velmere-pass2361-audit-operator-actions": PASS2361_AUDIT_OPERATOR_ACTIONS_ID,
          "x-velmere-customer-safe-report-route": PASS2369_CUSTOMER_SAFE_REPORT_ROUTE_ID,
          "x-velmere-final-delivery-gate": PASS2376_FINAL_DELIVERY_GATE_ID,
          "x-velmere-delivery-receipt-ledger": PASS2377_DELIVERY_RECEIPT_LEDGER_ID,
        },
      });
    }
  }

  let updated: Awaited<ReturnType<typeof updateAuditAccountMessage>>;
  try {
    updated = await updateAuditAccountMessage({
      messageId: cleanText(payload.messageId, 160),
      requestId: cleanText(payload.requestId, 160),
      action,
      locale,
      operatorId: admin.operator.id,
      operatorNote: cleanText(payload.operatorNote, 600),
      pdfRoute: cleanText(payload.pdfRoute, 300),
      publicReportRoute: cleanText(payload.publicReportRoute, 300),
      exportRoute: cleanText(payload.exportRoute, 300),
    });
  } catch (error) {
    return publicApiError(error, {
      route: "/api/admin/security/audit-messages/operator-actions",
      code: "audit_operator_action_rejected",
      status: 409,
    });
  }

  if (!updated) {
    return NextResponse.json({ ok: false, error: "audit_message_not_found" }, { status: 404 });
  }

  const deliveryReceipt = action === "deliver_customer_safe_report" && finalDeliveryGate
    ? await createPass2377DeliveryReceipt({
      message: updated.record,
      operatorId: admin.operator.id,
      finalDeliveryGate,
      adminReplayBoardRoute: `/${locale}/admin/security?accountMessageId=${encodeURIComponent(updated.record.id)}#pass2367-live-payment-evidence-rows`,
    })
    : undefined;

  return NextResponse.json({
    ok: true,
    passId: PASS2361_AUDIT_OPERATOR_ACTIONS_ID,
    source: updated.source,
    message: deliveryReceipt?.record ? { ...updated.record, deliveryReceipt: deliveryReceipt.record } : updated.record,
    safetyBoundary: "Customer-safe delivery only: no exploit instructions, no seed phrases, no Certified Safe claims, no investment advice.",
    finalDeliveryGate,
    deliveryReceiptLedger: deliveryReceipt ? {
      passId: PASS2377_DELIVERY_RECEIPT_LEDGER_ID,
      receiptId: deliveryReceipt.record.receiptId,
      checksum: deliveryReceipt.record.checksum,
      source: deliveryReceipt.source,
      durableWrite: deliveryReceipt.durableWrite,
      deliveredAt: deliveryReceipt.record.deliveredAt,
      customerSafeLinks: deliveryReceipt.record.customerSafeLinks,
      safeBoundary: deliveryReceipt.record.safeBoundary,
    } : undefined,
    reportRouteSync: {
      passId: PASS2369_CUSTOMER_SAFE_REPORT_ROUTE_ID,
      accountAutoSync: true,
      publicReportRoute: updated.record.customerSafeReport?.publicReportRoute ?? updated.record.publicReportRoute,
      pdfRoute: updated.record.customerSafeReport?.pdfRoute ?? updated.record.pdfRoute,
    },
  }, {
    headers: {
      "cache-control": "no-store",
      "x-velmere-pass2361-audit-operator-actions": PASS2361_AUDIT_OPERATOR_ACTIONS_ID,
      "x-velmere-customer-safe-report-route": PASS2369_CUSTOMER_SAFE_REPORT_ROUTE_ID,
      "x-velmere-final-delivery-gate": PASS2376_FINAL_DELIVERY_GATE_ID,
      "x-velmere-delivery-receipt-ledger": PASS2377_DELIVERY_RECEIPT_LEDGER_ID,
    },
  });
}
