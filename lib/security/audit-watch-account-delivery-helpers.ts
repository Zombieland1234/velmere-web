import type { AuditAccountMessageRecord, StoreAuditAccountMessageInput } from "@/lib/account/audit-account-messages";
import type { VlmAuditAccountMessage } from "@/lib/security/vlm-audit-product";
import type { AuditAccountCustomerSnapshot } from "@/lib/security/audit-account-customer-snapshot";

export const PASS4422_AUDIT_WATCH_ACCOUNT_DELIVERY_BOUNDARY = {
  passId: "PASS4422",
  boundary: "analysis_queue_account_delivery_no_human_review_claim",
  visualChanges: false,
  worldclassBenchmarkRequired: true,
  publicTopkaLiveAllowed: false,
  accountDeliveryServerSideOnly: true,
  paidAuditAnalysisQueueBoundary: true,
  humanReviewIncluded: false,
  legacyHumanReviewAliasesNormalized: true,
  privateAccountMessageSanitized: true,
  benchmarkRows: [
    "Private delivery gate before any controlled Pro beta output",
    "Account-delivery input normalization with legacy alias migration",
    "Public/private account envelope minimization",
    "Analysis-queue boundary without a human-review or LIVE claim",
  ],
} as const;

type NullableText = string | null | undefined;

type Pass4422DeliveryInputParams = {
  message: VlmAuditAccountMessage;
  accountId?: NullableText;
  accountEmail?: NullableText;
  contactEmail?: NullableText;
  locale: string;
  reviewLevel: string;
  projectName: string;
  contractAddress: string;
  publicReportRoute: string;
  adminRoute: string;
  exportRoute: string;
  auditQueueId?: NullableText;
  auditCaseRef?: NullableText;
  canonicalCustomerSnapshot?: AuditAccountCustomerSnapshot;
};

export function buildPass4422AuditAccountDeliveryInput(params: Pass4422DeliveryInputParams): StoreAuditAccountMessageInput {
  return {
    message: params.message,
    accountId: params.accountId ?? undefined,
    contactEmail: params.contactEmail ?? params.accountEmail ?? undefined,
    locale: params.locale,
    reviewLevel: params.reviewLevel,
    projectName: params.projectName,
    contractAddress: params.contractAddress,
    publicReportRoute: params.publicReportRoute,
    adminRoute: params.adminRoute,
    exportRoute: params.exportRoute,
    auditQueueId: params.auditQueueId ?? undefined,
    auditCaseRef: params.auditCaseRef ?? undefined,
    canonicalCustomerSnapshot: params.canonicalCustomerSnapshot,
  };
}

type Pass4422StoredAccountMessage = {
  source: string;
  record: Pick<AuditAccountMessageRecord, "deliveryStatus" | "accountId" | "contactEmail" | "requestId">;
};

export function buildPass4422AccountMessageDeliveryEnvelope(params: {
  storedAccountMessage: Pass4422StoredAccountMessage;
  accountSessionSource?: NullableText;
  pass2360Id: string;
  pass2363Id: string;
}) {
  const record = params.storedAccountMessage.record;
  return {
    passId: params.pass2360Id,
    source: params.storedAccountMessage.source,
    deliveryStatus: record.deliveryStatus,
    accountId: record.accountId,
    contactEmail: record.contactEmail ?? null,
    pass2363: {
      passId: params.pass2363Id,
      resolvedFrom: params.accountSessionSource ?? "fallback",
    },
    pass4422: {
      passId: PASS4422_AUDIT_WATCH_ACCOUNT_DELIVERY_BOUNDARY.passId,
      accountDeliveryServerSideOnly: true,
      privateAccountMessageSanitized: true,
      publicTopkaLiveAllowed: false,
    },
  };
}

type Pass4422PaidAccessReceipt = {
  ok?: boolean;
  ledgerMode?: string;
  entitlement?: {
    id?: NullableText;
    auditQueueId?: NullableText;
  } | null;
};

export function buildPass4422PaymentReceiptEnvelope(receipt: Pass4422PaidAccessReceipt | null, pass2362Id: string) {
  if (!receipt?.ok) return null;
  return {
    passId: pass2362Id,
    ledgerMode: receipt.ledgerMode,
    entitlementId: receipt.entitlement?.id ?? null,
    auditQueueId: receipt.entitlement?.auditQueueId ?? null,
    state: "access_verified_analysis_queue",
    boundary: "A controlled Pro beta analysis may start only after server-verified access; Advanced remains NOT_FOR_SALE and wallet connect is not proof.",
    pass4422: {
      passId: PASS4422_AUDIT_WATCH_ACCOUNT_DELIVERY_BOUNDARY.passId,
      paidAuditAnalysisQueueBoundary: true,
      humanReviewIncluded: false,
      publicTopkaLiveAllowed: false,
    },
  };
}

// Legacy export name retained for callers; returned customer-safe state is analysis_queue.
export function buildPass4422HumanReviewQueueEnvelope(receipt: Pass4422PaidAccessReceipt | null, fallbackQueueId: string) {
  if (!receipt?.ok) return null;
  return {
    status: "analysis_queue",
    queueId: receipt.entitlement?.auditQueueId ?? fallbackQueueId,
    customerSafeDelivery: "after_internal_quality_control_and_redaction_check",
    pass4422: {
      passId: PASS4422_AUDIT_WATCH_ACCOUNT_DELIVERY_BOUNDARY.passId,
      analysisQueueBoundary: true,
      humanReviewIncluded: false,
      legacyAdapterNameOnly: true,
      publicTopkaLiveAllowed: false,
    },
  };
}
