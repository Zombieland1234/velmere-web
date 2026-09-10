import { createSupportSafeTimelinePreview, type SupportSafeTimelineEntry } from "@/lib/launch/support-safe-timeline";
import { summarizeLaunchReadiness } from "@/lib/launch/launch-readiness-summary";

export type CustomerSafeExportStatus = "ready" | "partial" | "blocked" | "manual_review";

export type CustomerSafeExportItem = {
  id: string;
  label: string;
  status: CustomerSafeExportStatus;
  progress: number;
  sourceMode: "contract_draft" | "redaction_ready" | "approval_missing" | "manual_review";
  requiredBeforePublicLaunch: boolean;
  operatorPromise: string;
  safetyBoundary: string;
  blockers: string[];
  nextStep: string;
};

export type CustomerSafeExportPreview = {
  exportId: string;
  visibility: "support_safe" | "customer_safe";
  approved: boolean;
  entries: SupportSafeTimelineEntry[];
  redactedFields: string[];
  blockedFields: string[];
  missingApproval: string[];
};

export const customerSafeExportBoundaryMatrix: CustomerSafeExportItem[] = [
  {
    id: "support-to-customer-filter",
    label: "Support-to-customer filter",
    status: "manual_review",
    progress: 42,
    sourceMode: "contract_draft",
    requiredBeforePublicLaunch: true,
    operatorPromise: "Support can turn an internal timeline into customer-safe language without leaking internals.",
    safetyBoundary: "No customer export may include secrets, raw provider payloads, private prompts or legal conclusions.",
    blockers: ["customer-safe copy", "internal-only filter", "approval state", "missing-data wording"],
    nextStep: "Create customer-safe export templates for product, shipping and refund issues.",
  },
  {
    id: "approval-gate",
    label: "Approval gate",
    status: "blocked",
    progress: 18,
    sourceMode: "approval_missing",
    requiredBeforePublicLaunch: true,
    operatorPromise: "Customer-visible export needs support/operator approval before it is sent.",
    safetyBoundary: "No automatic customer-facing export from internal audit without approval.",
    blockers: ["support approval", "operator id", "approval timestamp", "revoke path"],
    nextStep: "Wire approval state to support timeline export.",
  },
  {
    id: "missing-data-language",
    label: "Missing-data language",
    status: "manual_review",
    progress: 48,
    sourceMode: "manual_review",
    requiredBeforePublicLaunch: true,
    operatorPromise: "Customer-safe copy can say what is being checked without promising unavailable facts.",
    safetyBoundary: "Missing data cannot be converted into delivery, refund, safety or legal promises.",
    blockers: ["copy templates", "source state", "uncertainty markers", "policy review"],
    nextStep: "Create PL/DE/EN templates for missing provider, shipping, order and refund data.",
  },
  {
    id: "export-redaction",
    label: "Export redaction",
    status: "partial",
    progress: 54,
    sourceMode: "redaction_ready",
    requiredBeforePublicLaunch: true,
    operatorPromise: "Export removes internal ids, private source details and raw payload fields.",
    safetyBoundary: "Customer-safe export must never include provider tokens, private prompt text or raw scoring internals.",
    blockers: ["field allowlist", "redaction proof", "download renderer", "access policy"],
    nextStep: "Apply export allowlist to support-safe report renderer.",
  },
];

export function createCustomerSafeExportPreview(input?: {
  approved?: boolean;
  entries?: SupportSafeTimelineEntry[];
}): CustomerSafeExportPreview {
  const entries = input?.entries ?? createSupportSafeTimelinePreview();
  const approved = input?.approved === true;
  return {
    exportId: `customer-safe-export-${approved ? "approved" : "blocked"}-preview`,
    visibility: approved ? "customer_safe" : "support_safe",
    approved,
    entries: entries.filter((entry) => entry.visibility === "support_safe"),
    redactedFields: ["operatorId", "providerToken", "webhookSecret", "rawProviderPayload", "privatePrompt", "internalScoring"],
    blockedFields: ["internal_only entries", "legal conclusions", "unsupported delivery promises"],
    missingApproval: approved ? [] : ["support approval", "operator approval timestamp", "customer-safe copy review"],
  };
}

export function getCustomerSafeExportBoundarySummary() {
  return summarizeLaunchReadiness(customerSafeExportBoundaryMatrix);
}

export const customerSafeExportLaunchNote =
  "Customer-safe export boundary is a preview contract. Production still needs approval workflow, export renderer and policy-reviewed customer copy.";
