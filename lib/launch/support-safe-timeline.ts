import { summarizeLaunchReadiness } from "@/lib/launch/launch-readiness-summary";

export type SupportTimelineStatus = "ready" | "partial" | "blocked" | "manual_review";

export type SupportTimelineItem = {
  id: string;
  label: string;
  status: SupportTimelineStatus;
  progress: number;
  sourceMode: "contract_draft" | "redaction_ready" | "storage_missing" | "manual_review";
  requiredBeforePublicLaunch: boolean;
  operatorPromise: string;
  safetyBoundary: string;
  blockers: string[];
  nextStep: string;
};

export type SupportSafeTimelineEntry = {
  id: string;
  time: string;
  title: string;
  sourceMode: "audit" | "order" | "provider" | "manual";
  visibility: "support_safe" | "internal_only";
  summary: string;
  missingData: string[];
};

export const supportSafeTimelineMatrix: SupportTimelineItem[] = [
  {
    id: "timeline-source",
    label: "Timeline source ledger",
    status: "blocked",
    progress: 22,
    sourceMode: "storage_missing",
    requiredBeforePublicLaunch: true,
    operatorPromise: "Support timeline reads from audit/order/provider ledgers instead of screenshots or memory.",
    safetyBoundary: "No customer support decision should rely on raw internal payloads or untracked manual notes.",
    blockers: ["audit store", "order ledger", "provider snapshot", "source mode"],
    nextStep: "Connect support timeline to persisted audit and order event storage.",
  },
  {
    id: "support-safe-copy",
    label: "Support-safe copy",
    status: "manual_review",
    progress: 44,
    sourceMode: "redaction_ready",
    requiredBeforePublicLaunch: true,
    operatorPromise: "Support sees what happened, what is missing and what can be said safely to a customer.",
    safetyBoundary: "No private prompts, secrets, provider tokens or legal conclusions in support timeline.",
    blockers: ["copy template", "redaction proof", "legal-safe wording", "missing data marker"],
    nextStep: "Create support response templates for product publish and order issues.",
  },
  {
    id: "missing-data-visible",
    label: "Missing data visible",
    status: "manual_review",
    progress: 46,
    sourceMode: "manual_review",
    requiredBeforePublicLaunch: true,
    operatorPromise: "Timeline shows missing provider, shipping, order or refund data instead of pretending certainty.",
    safetyBoundary: "Missing data is never converted into confidence or customer promise.",
    blockers: ["missing data labels", "source confidence", "support escalation rule"],
    nextStep: "Attach missing-data appendix to support timeline entries.",
  },
  {
    id: "customer-boundary",
    label: "Customer boundary",
    status: "blocked",
    progress: 42,
    sourceMode: "contract_draft",
    requiredBeforePublicLaunch: true,
    operatorPromise: "Support can separate internal review from customer-safe messaging.",
    safetyBoundary: "No customer-facing message should expose internal scoring, secrets or unsupported claims.",
    blockers: ["internal-only flag", "customer-safe flag", "export rule", "support approval"],
    nextStep: "Customer-safe export boundary now exists; next wire approval workflow and export renderer."
  },
];

export function createSupportSafeTimelinePreview(entries: SupportSafeTimelineEntry[] = []): SupportSafeTimelineEntry[] {
  if (entries.length) return entries;
  return [
    {
      id: "support-preview-001",
      time: "2026-06-03T00:00:00.000Z",
      title: "Publish blocked before active sale",
      sourceMode: "audit",
      visibility: "support_safe",
      summary: "Product remained blocked because provider truth, shipping/returns proof or publish permission was incomplete.",
      missingData: ["provider truth snapshot", "shipping/returns snapshot", "server auth operator id"],
    },
    {
      id: "support-preview-002",
      time: "2026-06-03T00:05:00.000Z",
      title: "Rollback context missing",
      sourceMode: "manual",
      visibility: "internal_only",
      summary: "Rollback diff is not persisted yet. Operator must not claim reversible publish until storage exists.",
      missingData: ["before/after diff", "rollback id", "support-safe customer summary"],
    },
  ];
}

export function getSupportSafeTimelineSummary() {
  return summarizeLaunchReadiness(supportSafeTimelineMatrix);
}

export const supportTimelineLaunchNote =
  "Support-safe timeline is a preview contract. Production still needs persisted ledgers, customer-safe export rules and support approval workflow.";
