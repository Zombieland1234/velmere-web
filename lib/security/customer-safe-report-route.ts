import type { AuditAccountMessageRecord } from "@/lib/account/audit-account-messages";
import { PASS2369_CUSTOMER_SAFE_REPORT_ROUTE_ID } from "@/lib/account/audit-account-messages";
import { buildPass2368CustomerSafeAuditTimeline, type Pass2368AuditTimelineStage } from "@/lib/security/customer-safe-audit-timeline";
import {
  hasExactAuditAccountArtifactBinding,
  verifyAuditAccountCustomerSnapshot,
} from "@/lib/security/audit-account-customer-snapshot";
import type { CustomerSafeAuditLayoutModel } from "@/lib/security/customer-safe-audit-layout";

export { PASS2369_CUSTOMER_SAFE_REPORT_ROUTE_ID };
export const PASS4821_IMMUTABLE_CUSTOMER_REPORT_ROUTE_ID = "pass4821-immutable-account-customer-report-route-v1" as const;

export type Pass2369CustomerSafeReportPayloadCore = {
  ok: true;
  passId: typeof PASS2369_CUSTOMER_SAFE_REPORT_ROUTE_ID;
  immutableRouteId: typeof PASS4821_IMMUTABLE_CUSTOMER_REPORT_ROUTE_ID;
  source: "immutable-account-snapshot";
  reportId: string;
  requestId: string;
  locale: "pl" | "en" | "de";
  title: string;
  summary: string;
  status: "intake" | "automated_analysis" | "needs_evidence" | "ready" | "delivered" | "blocked_redaction";
  projectName: string;
  reviewLevel: string;
  queueId?: string;
  timeline: ReturnType<typeof buildPass2368CustomerSafeAuditTimeline>;
  links: {
    accountRoute: string;
    publicReportRoute: string;
    pdfRoute: string;
    pdfPreviewRoute: string | null;
    accountArtifactRoute: string | null;
  };
  sections: string[];
  nextSteps: string[];
  forbidden: string[];
  customerBoundary: string;
  refreshedAt: string;
  riskScore: number | null;
  confidenceScore: number | null;
  snapshotDigest: string;
  snapshotReady: true;
  pdfArtifact: {
    pdfDigest: string;
    pdfByteLength: number;
    renderPlanDigest: string;
    pageCount: number;
  };
};

export type Pass2369CustomerSafeReportPayload = Pass2369CustomerSafeReportPayloadCore & {
  canonicalLayout: CustomerSafeAuditLayoutModel;
  layoutDigest: string;
  pdfReady: boolean;
};

type BuildInput = {
  id: string;
  locale: string;
  record: AuditAccountMessageRecord;
};

function normalizeLocale(locale: string): "pl" | "en" | "de" {
  return locale === "pl" || locale === "de" || locale === "en" ? locale : "en";
}

function cleanRoute(route: unknown, fallback: string) {
  if (typeof route !== "string") return fallback;
  const value = route.replace(/[<>`$\\]/g, "").trim();
  if (!value) return fallback;
  const lowered = value.toLowerCase();
  if (lowered.startsWith("javascript:") || lowered.startsWith("data:") || lowered.startsWith("file:")) return fallback;
  if (!value.startsWith("/")) return fallback;
  return value.slice(0, 320);
}

function stageFromRecord(record: AuditAccountMessageRecord): Pass2368AuditTimelineStage {
  if (record.operatorStatus === "blocked_redaction" || record.operatorStatus === "needs_evidence") return "blocked";
  if (record.operatorStatus === "customer_safe_ready" || record.operatorStatus === "delivered" || record.deliveryStatus === "ready_for_download") return "report_ready";
  if (record.operatorStatus === "human_review" || record.operatorStatus === "pdf_attached" || record.auditQueueId) return "analysis_queue";
  if (record.status === "payment_pending") return "verifying_access";
  return "access_verified";
}

function statusFromRecord(record: AuditAccountMessageRecord): Pass2369CustomerSafeReportPayloadCore["status"] {
  if (record.operatorStatus === "delivered") return "delivered";
  if (record.operatorStatus === "blocked_redaction") return "blocked_redaction";
  if (record.operatorStatus === "needs_evidence") return "needs_evidence";
  if (record.operatorStatus === "customer_safe_ready" || record.deliveryStatus === "ready_for_download") return "ready";
  if (record.operatorStatus === "human_review" || record.operatorStatus === "pdf_attached" || record.status === "human_review") return "automated_analysis";
  return "intake";
}

export function buildPass2369CustomerSafeReportPayload(input: BuildInput): Pass2369CustomerSafeReportPayload {
  const record = input.record;
  const snapshot = record.canonicalCustomerSnapshot;
  if (!snapshot || !verifyAuditAccountCustomerSnapshot(snapshot)) throw new Error("canonical_customer_snapshot_required");

  const locale = normalizeLocale(input.locale);
  if (snapshot.locale !== locale || record.locale !== locale) throw new Error("canonical_customer_snapshot_locale_mismatch");
  if (snapshot.requestId !== record.requestId) throw new Error("canonical_customer_snapshot_request_mismatch");

  const safeId = encodeURIComponent(record.id || snapshot.reportId);
  const publicReportRoute = `/${locale}/security/audits/customer-report/${safeId}`;
  const pdfRoute = `/api/security/audit-watch/customer-safe-report?id=${safeId}&locale=${locale}&format=pdf-safe`;
  const status = statusFromRecord(record);
  const timeline = buildPass2368CustomerSafeAuditTimeline({
    locale,
    stage: stageFromRecord(record),
    queueId: record.auditQueueId,
    accountMessageId: record.id,
    reportRoute: status === "ready" || status === "delivered" ? publicReportRoute : undefined,
  });
  const layout = snapshot.canonicalLayout;
  const exactArtifact = hasExactAuditAccountArtifactBinding(snapshot)
    ? snapshot.exactAccountArtifact
    : null;

  return {
    ok: true,
    passId: PASS2369_CUSTOMER_SAFE_REPORT_ROUTE_ID,
    immutableRouteId: PASS4821_IMMUTABLE_CUSTOMER_REPORT_ROUTE_ID,
    source: "immutable-account-snapshot",
    reportId: snapshot.reportId,
    requestId: snapshot.requestId,
    locale,
    title: snapshot.layoutInput.title,
    summary: snapshot.layoutInput.summary,
    status,
    projectName: snapshot.projectName,
    reviewLevel: `${snapshot.requestedTier}_requested/${snapshot.deliveredTier}_delivered`,
    queueId: record.auditQueueId,
    timeline,
    links: {
      accountRoute: cleanRoute(record.accountRoute, `/${locale}/account?tab=messages`),
      publicReportRoute,
      pdfRoute,
      pdfPreviewRoute: exactArtifact ? `${pdfRoute}&disposition=preview` : null,
      accountArtifactRoute: exactArtifact
        ? `/api/account/customer-artifact?id=${encodeURIComponent(exactArtifact.snapshotId)}`
        : null,
    },
    sections: layout.customerSections,
    nextSteps: layout.nextSteps,
    forbidden: layout.forbidden,
    customerBoundary: snapshot.layoutInput.customerBoundary,
    refreshedAt: snapshot.generatedAt,
    riskScore: snapshot.riskScore,
    confidenceScore: snapshot.confidenceScore,
    snapshotDigest: snapshot.snapshotDigest,
    snapshotReady: true,
    pdfArtifact: {
      pdfDigest: snapshot.pdfArtifact.pdfDigest,
      pdfByteLength: snapshot.pdfArtifact.pdfByteLength,
      renderPlanDigest: snapshot.pdfArtifact.renderPlanDigest,
      pageCount: snapshot.pdfArtifact.pageCount,
    },
    canonicalLayout: layout,
    layoutDigest: layout.layoutDigest,
    pdfReady: Boolean(exactArtifact) && (status === "ready" || status === "delivered"),
  };
}
