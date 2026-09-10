import type { AuditAccountMessageRecord, AuditOperatorActionType } from "@/lib/account/audit-account-messages";

export const PASS2372_LINKED_REQUEST_DRAWER_ACTIONS_ID = "pass2372-linked-request-drawer-direct-operator-actions" as const;

export const PASS2372_DRAWER_QUICK_ACTIONS: readonly AuditOperatorActionType[] = [
  "mark_analysis",
  "request_evidence",
  "attach_pdf",
  "mark_ready",
  "deliver_customer_safe_report",
  "block_redaction",
] as const;

export const PASS2372_DRAWER_ACTION_LABEL: Record<AuditOperatorActionType, string> = {
  mark_analysis: "Analyze",
  mark_human_review: "Legacy analyze",
  request_evidence: "Need evidence",
  attach_pdf: "Attach PDF",
  mark_ready: "Mark ready",
  deliver_customer_safe_report: "Deliver",
  block_redaction: "Block",
};

export type Pass2372DrawerActionReadiness = {
  passId: typeof PASS2372_LINKED_REQUEST_DRAWER_ACTIONS_ID;
  enabled: boolean;
  messageId?: string;
  requestId?: string;
  auditQueueId?: string;
  accountId?: string;
  currentOperatorStatus?: string;
  currentDeliveryStatus?: string;
  hasCustomerSafeReport: boolean;
  hasPdfRoute: boolean;
  hasPublicReportRoute: boolean;
  actions: readonly AuditOperatorActionType[];
  safeBoundary: string;
  recommendedNextAction: AuditOperatorActionType;
  checkpoints: string[];
};

function hasReadyReport(message?: AuditAccountMessageRecord) {
  return message?.operatorStatus === "customer_safe_ready" || message?.operatorStatus === "delivered" || message?.customerSafeReport?.status === "ready" || message?.customerSafeReport?.status === "delivered";
}

function recommendedActionFor(message?: AuditAccountMessageRecord): AuditOperatorActionType {
  if (!message) return "mark_analysis";
  if (message.operatorStatus === "intake") return "mark_analysis";
  if ((message.operatorStatus === "automated_analysis" || message.operatorStatus === "human_review") && !(message.pdfRoute || message.customerSafeReport?.pdfRoute)) return "attach_pdf";
  if (message.operatorStatus === "pdf_attached" && !hasReadyReport(message)) return "deliver_customer_safe_report";
  if (message.operatorStatus === "customer_safe_ready") return "deliver_customer_safe_report";
  if (message.operatorStatus === "needs_evidence") return "mark_analysis";
  return "deliver_customer_safe_report";
}

export function buildPass2372DrawerActionReadiness(message?: AuditAccountMessageRecord): Pass2372DrawerActionReadiness {
  const hasPdfRoute = Boolean(message?.pdfRoute || message?.customerSafeReport?.pdfRoute || message?.exportRoute);
  const hasPublicReportRoute = Boolean(message?.publicReportRoute || message?.customerSafeReport?.publicReportRoute);
  return {
    passId: PASS2372_LINKED_REQUEST_DRAWER_ACTIONS_ID,
    enabled: Boolean(message?.id || message?.requestId),
    messageId: message?.id,
    requestId: message?.requestId,
    auditQueueId: message?.auditQueueId,
    accountId: message?.accountId,
    currentOperatorStatus: message?.operatorStatus,
    currentDeliveryStatus: message?.deliveryStatus,
    hasCustomerSafeReport: Boolean(message?.customerSafeReport),
    hasPdfRoute,
    hasPublicReportRoute,
    actions: PASS2372_DRAWER_QUICK_ACTIONS,
    safeBoundary:
      "PASS2372 drawer mini-controls may only move customer-safe audit delivery state. They must not expose raw Stripe payloads, raw webhook bodies, BLIK codes, card data, secrets, seed phrases, exploit instructions, Certified Safe claims or investment advice.",
    recommendedNextAction: recommendedActionFor(message),
    checkpoints: [
      message ? "Linked account message exists and can be updated from the drawer." : "No linked account message loaded; drawer actions stay disabled.",
      hasPdfRoute ? "A PDF/export route is already present or can be regenerated as a safe placeholder." : "Attach PDF should generate the safe placeholder route before delivery evaluation.",
      hasPublicReportRoute ? "Customer report route is present." : "Delivery will create the customer-safe public report route when the deterministic gate passes; mark_ready is optional annotation only.",
      "Account auto-sync and customer-safe report routes remain redacted for payment and exploit data.",
    ],
  };
}
