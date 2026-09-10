import { NextResponse } from "next/server";
import { buildAuditWatchPage } from "@/lib/security/audit-watch";
import { buildAuditReviewFlow, buildAuditVerificationPreview, PASS1534_AUDIT_REVIEW_FLOW_ID, type AuditReviewSubmission } from "@/lib/security/audit-review-flow";
import { buildAuditSampleReport, PASS1574_AUDIT_SAMPLE_REPORT_ID } from "@/lib/security/audit-sample-report";
import { buildAuditReportQueue, PASS1614_AUDIT_REPORT_QUEUE_ID } from "@/lib/security/audit-report-queue";
import { buildAuditReportExportPayload, PASS1654_AUDIT_PDF_SHIELD_EXPORT_ID } from "@/lib/security/audit-pdf-shield-export";
import { buildAuditBusinessFlow, PASS1694_AUDIT_BUSINESS_FLOW_ID } from "@/lib/security/audit-business-flow";
import { buildAuditRegistryApiPayload, buildAuditRegistryDashboard, PASS1894_AUDIT_PUBLIC_REGISTRY_ID } from "@/lib/security/audit-public-registry";
import { buildVlmAuditProductPage, PASS2023_VLM_AUDIT_PRODUCT_ID } from "@/lib/security/vlm-audit-product";
import { buildPass2358AuditHarness, PASS2358_AUDIT_WATCH_CONTRACT_HARNESS_ID } from "@/lib/security/audit-watch-contract-harness";
import { buildPass4421AuditWatchHeaders } from "@/lib/security/audit-watch-response-boundary-helpers";
import { sanitizePublicAuditEnvelope } from "@/lib/security/public-private-route-lockdown";

export async function handleAuditWatchGet() {
  const sample: AuditReviewSubmission = {
    projectName: "Velmère sample token",
    contractAddress: "0x0000000000000000000000000000000000000000",
    chain: "ethereum",
    auditUrl: "https://example.com/public-audit.pdf",
    website: "https://example.com",
    docsUrl: "https://docs.example.com",
    reviewLevel: "basic_review",
  };

  // PASS4691: GET remains public and lightweight; historical deep proof chains are offline artifacts, not customer runtime payloads.
  return NextResponse.json(sanitizePublicAuditEnvelope({
    ok: true,
    surface: "velmere-security-audit-watch",
    page: buildAuditWatchPage("en"),
    flow: buildAuditReviewFlow("en"),
    samplePreview: buildAuditVerificationPreview(sample),
    sampleReport: buildAuditSampleReport("en"),
    sampleReportRoute: "/en/security/audits/sample",
    sampleStatusRoute: "/en/security/audits",
    sampleExportRoute: "/en/security/audits/export/sample",
    sampleExportPayload: buildAuditReportExportPayload("sample", "en"),
    businessFlow: buildAuditBusinessFlow("en"),
    pricingRoute: "/en/security/audits/pricing",
    registryRoute: "/en/security/audits/registry",
    registry: buildAuditRegistryDashboard("en"),
    registryPayload: buildAuditRegistryApiPayload("en"),
    reportQueue: buildAuditReportQueue("en"),
    vlmAuditProduct: buildVlmAuditProductPage("en"),
    pass2358AuditHarness: buildPass2358AuditHarness("en"),
    boundary: [
      "passive public review",
      "no custody",
      "no seed phrases",
      "no investment advice",
      "no unauthorized active testing",
      "no exploit instructions",
    ],
  }, "audit-watch-get"), {
    headers: buildPass4421AuditWatchHeaders({
      "cache-control": "no-store",
      "x-velmere-audit-review-flow": PASS1534_AUDIT_REVIEW_FLOW_ID,
      "x-velmere-audit-sample-report": PASS1574_AUDIT_SAMPLE_REPORT_ID,
      "x-velmere-audit-report-queue": PASS1614_AUDIT_REPORT_QUEUE_ID,
      "x-velmere-audit-pdf-shield-export": PASS1654_AUDIT_PDF_SHIELD_EXPORT_ID,
      "x-velmere-audit-business-flow": PASS1694_AUDIT_BUSINESS_FLOW_ID,
      "x-velmere-audit-public-registry": PASS1894_AUDIT_PUBLIC_REGISTRY_ID,
      "x-velmere-vlm-audit-product": PASS2023_VLM_AUDIT_PRODUCT_ID,
      "x-velmere-pass2358-audit-harness": PASS2358_AUDIT_WATCH_CONTRACT_HARNESS_ID,
    }),
  });
}
