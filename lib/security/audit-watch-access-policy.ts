import type { AuditReviewSubmission } from "@/lib/security/audit-review-flow";

export function wantsFullAuditProof(request: Request) {
  const url = new URL(request.url);
  return url.searchParams.get("proof") === "full" || request.headers.get("x-velmere-proof-mode") === "full";
}

export type Pass4640AuditWatchPayload = AuditReviewSubmission & {
  locale?: string;
  readinessOnly?: boolean;
  readinessTier?: "pro" | "advanced";
  requestId?: string;
  auditCaseRef?: string;
};

export type AuditWatchPaidDepth = "pro" | "advanced" | null;

export function resolveAuditWatchPaidDepth(reviewLevel: AuditReviewSubmission["reviewLevel"]): AuditWatchPaidDepth {
  return reviewLevel === "pro_review" ? "pro" : reviewLevel === "advanced_review" ? "advanced" : null;
}

export function resolveAuditWatchReviewLevel(reviewLevel: AuditReviewSubmission["reviewLevel"]): "basic_review" | "pro_review" | "advanced_review" {
  return reviewLevel === "advanced_review" ? "advanced_review" : reviewLevel === "pro_review" ? "pro_review" : "basic_review";
}
