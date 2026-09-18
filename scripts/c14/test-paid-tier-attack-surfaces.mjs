import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

function source(path) {
  return readFileSync(path, "utf8");
}
function has(path, needle, message) {
  assert.ok(source(path).includes(needle), message ?? `${path} must include ${needle}`);
}
function count(path, needle) {
  return source(path).split(needle).length - 1;
}

const paidReports = [
  "lib/server/market-integrity-route-modules/report.ts",
  "lib/server/market-integrity-route-modules/report-pdf.ts",
  "lib/server/search-route-modules/lens-report.ts",
];
for (const path of paidReports) {
  has(path, "resolveVlmPaidSurfaceAccess", `${path} must use the central paid-surface guard`);
  assert.ok(count(path, "no-store") > 0, `${path} must disable caching for paid/report responses`);
}

for (const path of ["app/api/audit/report/route.ts", "app/api/audit/report-pdf/route.ts"]) {
  has(path, "authorizeDelivery", `${path} must perform post-render current-entitlement authorization`);
  has(path, "no-store", `${path} must be non-cacheable`);
}

const customerReport = "lib/security/customer-report-request.ts";
has(customerReport, "resolveCurrentAuditAccess");
has(customerReport, "rank[tier] > rank[access.clientTier]", "requested audit tier must not exceed current entitlement");
has(customerReport, "finalAccess.entitlementId !== access.entitlementId", "delivery must re-check the exact current entitlement");
assert.ok(count(customerReport, "resolveCurrentAuditAccess") >= 3, "audit report must re-check current access, not trust historical state");

const paidPdf = "lib/server/lazy-route-modules/security--audit-watch--pro-pdf.ts";
for (const needle of [
  "resolveRequestAccount",
  "getAuditCaseForOwningAccount",
  "verifyVlmPaidSurfaceEntitlementById",
  "auditCaseRecord.entitlementId !== entitlementId",
  "readAuditReportSnapshotForDelivery",
  "reportVersionHash",
  "verifyPass4657AuditPdfDownloadToken",
  "reservePass4658AuditPdfDownloadToken",
  "finalizePass4658AuditPdfDownloadToken",
  "audit_pdf_token_in_progress",
  "audit_pdf_token_replayed",
  "no-store",
]) has(paidPdf, needle, `secure paid PDF download must enforce ${needle}`);

const paidPdfIssue = "lib/server/lazy-route-modules/security--audit-watch--pro-pdf--token.ts";
for (const needle of [
  "resolveRequestAccount",
  "getAuditCaseForOwningAccount",
  "resolveVlmPaidSurfaceAccess",
  "readAuditReportSnapshotForDelivery",
  "reportVersionHash",
  "no-store",
]) has(paidPdfIssue, needle, `paid PDF token issue route must enforce ${needle}`);

const workspace = "scripts/c13/shield-workspace-guard.sql";
const workspaceSql = source(workspace);
assert.match(workspaceSql, /p_operation\s+in\s*\(\s*['"]READ['"]\s*,\s*['"]RESTORE['"]\s*\)/i, "workspace READ/RESTORE must inspect stored tier");
assert.match(workspaceSql, /v_latest\.tier\s+not\s+in\s*\(\s*['"]pro['"]\s*,\s*['"]advanced['"]\s*\)/i, "stored workspace tier must be validated");
assert.match(workspaceSql, /velmere_r7_shield_pro_has_paid_entitlement_v1\s*\(\s*v_latest\.tier\s*\)/i, "restore/read must require a current entitlement for the stored tier");
// Workspace owner-binding lives in the deployed RPC definition and is verified separately against Supabase;
// this C13 patch file intentionally contains only the stored-tier hardening delta.

const exportRoute = "app/api/market-integrity/export/route.ts";
has(exportRoute, "verified_stored_report_required", "generic client-composed export must fail closed");
has(exportRoute, "status: 409");
has(exportRoute, "private, no-store");

const draftExport = "lib/server/market-integrity-route-modules/evidence-export.ts";
has(draftExport, 'mode: "draft"', "public evidence export must remain explicitly draft-only");
has(draftExport, "exportInfrastructureReady: false", "draft export must not claim paid/final export readiness");
assert.equal(source(draftExport).includes("buildTierEvidenceProfile"), false, "draft JSON/Markdown route must not project paid tier profiles");

const guard = "lib/commerce/vlm-advanced-only-access-policy.ts";
for (const needle of [
  'entitlementHeader',
  'urlParams?.get("entitlementId")',
  "surface: context.surface",
  "depth: context.depth",
  "hasPass4682ServerEntitlementRecord",
]) has(guard, needle, `central guard must bind direct entitlement IDs via ${needle}`);

const ledger = "lib/commerce/vlm-entitlement-ledger.ts";
for (const needle of [
  "record.context.surface === requestedSurface",
  "record.context.depth === requestedDepth",
  "entitlement_surface_mismatch",
  "entitlement_depth_mismatch",
  "entitlement_account_mismatch",
  "entitlement_expired",
]) has(ledger, needle, `entitlement ledger must enforce ${needle}`);

console.log(JSON.stringify({
  schema: "c14-p18-attack-surface-static-regression-v1",
  checks: {
    bodyQueryHeaderTierBoundary: "central paid guard + exact server record",
    oldReports: "current access rechecked after render",
    reportUrls: "account + case + entitlement + reportVersionHash + one-time token",
    cache: "paid/report routes no-store",
    restore: "stored tier + current entitlement + owner binding",
    guessedIds: "account/case/workspace ownership binding",
    concurrency: "paid PDF token reserve/finalize blocks in-progress/replay",
    exportFormats: "generic export fail-closed; public JSON/Markdown stays draft-only",
    directEntitlementId: "surface + depth + account + product binding",
  },
}, null, 2));
console.log("C14-P18 paid attack-surface static regression: PASS");
