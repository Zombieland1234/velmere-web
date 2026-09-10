import { summarizeLaunchReadiness } from "@/lib/launch/launch-readiness-summary";

export type PublishPermissionStatus = "ready" | "partial" | "blocked" | "manual_review";

export type PublishPermissionItem = {
  id: string;
  label: string;
  status: PublishPermissionStatus;
  progress: number;
  sourceMode: "missing" | "checklist" | "manual_review" | "contract_draft";
  requiredBeforePublish: boolean;
  operatorPromise: string;
  safetyBoundary: string;
  blockers: string[];
  nextStep: string;
};

export const publishPermissionGate: PublishPermissionItem[] = [
  {
    id: "draft-only-import",
    label: "Draft-only import",
    status: "manual_review",
    progress: 42,
    sourceMode: "checklist",
    requiredBeforePublish: true,
    operatorPromise: "Imported products land as drafts until provider, SKU and legal truth pass.",
    safetyBoundary: "No import pipeline should create public active products by default.",
    blockers: ["draft mode enforcement", "status override guard", "audit reason"],
    nextStep: "Force all import flows into draft/coming-soon state until publish checklist passes.",
  },
  {
    id: "provider-truth-required",
    label: "Provider truth required",
    status: "blocked",
    progress: 38,
    sourceMode: "manual_review",
    requiredBeforePublish: true,
    operatorPromise: "Product cannot publish until provider source mode, SKU mapping and media truth are reviewed.",
    safetyBoundary: "No product should go active with missing provider mapping, fake stock or unclear media source.",
    blockers: ["provider source snapshot", "SKU mapping", "variant truth", "media rights"],
    nextStep: "Make provider truth snapshot a hard publish gate.",
  },
  {
    id: "shipping-returns-required",
    label: "Shipping and returns required",
    status: "blocked",
    progress: 34,
    sourceMode: "manual_review",
    requiredBeforePublish: true,
    operatorPromise: "Product cannot publish until delivery region, shipping estimate and return exception are visible.",
    safetyBoundary: "No active product with hidden shipping limitations or unclear return exception.",
    blockers: ["shipping region", "delivery estimate", "return exception", "provider appendix"],
    nextStep: "Attach shipping/returns truth to product-level publish checklist.",
  },
  {
    id: "active-publish-permission",
    label: "Active publish permission",
    status: "blocked",
    progress: 16,
    sourceMode: "contract_draft",
    requiredBeforePublish: true,
    operatorPromise: "Only a role with active-publish permission can move a product to live sale state.",
    safetyBoundary: "Coming soon and active publish are separate operations with separate permissions.",
    blockers: ["role scope", "two-step confirm", "operator reason", "audit log"],
    nextStep: "Split coming-soon publish from active sale publish and require explicit role scope.",
  },
  {
    id: "audit-before-publish",
    label: "Audit before publish",
    status: "blocked",
    progress: 44,
    sourceMode: "contract_draft",
    requiredBeforePublish: true,
    operatorPromise: "Publish action records operator, source snapshot, checklist result and reason.",
    safetyBoundary: "No catalogue mutation without persistent audit event and rollback context.",
    blockers: ["operator id", "source snapshot", "checklist result", "rollback id"],
    nextStep: "Admin mutation audit envelope now exists; next persist publish event and rollback context server-side."
  },
];

export function getPublishPermissionSummary() {
  return summarizeLaunchReadiness(publishPermissionGate);
}
