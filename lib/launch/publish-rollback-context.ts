import { summarizeLaunchReadiness } from "@/lib/launch/launch-readiness-summary";

export type PublishRollbackStatus = "ready" | "partial" | "blocked" | "manual_review";

export type PublishRollbackItem = {
  id: string;
  label: string;
  status: PublishRollbackStatus;
  progress: number;
  sourceMode: "contract_draft" | "storage_missing" | "manual_review";
  requiredBeforePublicLaunch: boolean;
  operatorPromise: string;
  safetyBoundary: string;
  blockers: string[];
  nextStep: string;
};

export type PublishRollbackDiff = {
  rollbackId: string;
  productId: string;
  previousState: "draft" | "coming_soon" | "active" | "archived" | "unknown";
  nextState: "draft" | "coming_soon" | "active" | "archived";
  changedFields: string[];
  checklistSnapshot: string[];
  customerImpact: "none" | "low" | "medium" | "high";
  supportSummary: string;
};

export const publishRollbackContextMatrix: PublishRollbackItem[] = [
  {
    id: "before-after-diff",
    label: "Before/after diff",
    status: "blocked",
    progress: 20,
    sourceMode: "storage_missing",
    requiredBeforePublicLaunch: true,
    operatorPromise: "Every publish or overwrite stores previous state and next state.",
    safetyBoundary: "No active publish without knowing what changed and how to reverse it.",
    blockers: ["previous state", "next state", "changed fields", "diff storage"],
    nextStep: "Persist product before/after diff for publish and overwrite actions.",
  },
  {
    id: "rollback-id",
    label: "Rollback id",
    status: "blocked",
    progress: 18,
    sourceMode: "contract_draft",
    requiredBeforePublicLaunch: true,
    operatorPromise: "Support can reference a rollback id when a product publish needs reversal.",
    safetyBoundary: "No manual emergency rollback without traceable id and operator reason.",
    blockers: ["rollback id", "operator reason", "auth context", "safe rollback action"],
    nextStep: "Create rollback id and safe rollback procedure for active publish actions.",
  },
  {
    id: "checklist-snapshot",
    label: "Checklist snapshot",
    status: "manual_review",
    progress: 40,
    sourceMode: "manual_review",
    requiredBeforePublicLaunch: true,
    operatorPromise: "Rollback context stores provider truth, shipping/returns truth and legal copy result at publish time.",
    safetyBoundary: "No publish claim should rely on current mutable state only; snapshot must exist.",
    blockers: ["provider truth snapshot", "shipping/returns snapshot", "legal copy snapshot", "operator permission snapshot"],
    nextStep: "Attach launch checklist snapshot to publish audit and rollback diff.",
  },
  {
    id: "customer-impact",
    label: "Customer impact classification",
    status: "manual_review",
    progress: 34,
    sourceMode: "contract_draft",
    requiredBeforePublicLaunch: true,
    operatorPromise: "Support sees whether a publish mistake affects customers, checkout or only internal catalogue state.",
    safetyBoundary: "No support escalation without customer impact class and customer-safe summary.",
    blockers: ["impact class", "support copy", "affected orders", "customer-safe summary"],
    nextStep: "Classify product mutation impact for support-safe timeline.",
  },
];

export function createPublishRollbackDiff(input: {
  productId: string;
  previousState?: PublishRollbackDiff["previousState"];
  nextState: PublishRollbackDiff["nextState"];
  changedFields?: string[];
  checklistSnapshot?: string[];
  customerImpact?: PublishRollbackDiff["customerImpact"];
}): PublishRollbackDiff {
  const productId = input.productId.trim() || "product:unresolved";
  const changedFields = input.changedFields?.length ? input.changedFields : ["status"];
  const checklistSnapshot = input.checklistSnapshot?.length ? input.checklistSnapshot : ["provider truth missing", "shipping/returns missing", "legal review missing"];
  return {
    rollbackId: `rollback-${productId.replace(/[^a-z0-9_-]/gi, "").slice(0, 20) || "product"}-${input.nextState}`,
    productId,
    previousState: input.previousState ?? "unknown",
    nextState: input.nextState,
    changedFields,
    checklistSnapshot,
    customerImpact: input.customerImpact ?? "medium",
    supportSummary: `Product ${productId} changed ${changedFields.join(", ")} to ${input.nextState}. Review checklist snapshot before customer-facing action.`,
  };
}

export function getPublishRollbackContextSummary() {
  return summarizeLaunchReadiness(publishRollbackContextMatrix);
}

export const publishRollbackLaunchNote =
  "Publish rollback context is a preview contract. Production still needs persistent product state diffs and server-side rollback permissions.";
