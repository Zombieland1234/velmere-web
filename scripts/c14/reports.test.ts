import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { buildCanonicalAuditReport, canonicalReportToPdfLines, renderCanonicalReportToPdf, type CanonicalAuditReportModel } from "../../lib/security/audit-canonical-report";
import { buildCustomerAuditReport } from "../../lib/security/customer-audit-pipeline";
import { normalizeCustomerReportInput } from "../../lib/security/customer-report-request";
import { canonicalJson } from "../../lib/security/canonical-json";
import { sha256Digest } from "../../lib/security/cryptographic-digest";
import { lintCanonicalReport } from "../../lib/security/report-semantic-linter";
import { verifyReportPki } from "../../lib/security/audit-pki-signature";
import { planCustomerSafePdf } from "../../lib/security/pro-audit-pdf/customer-safe-renderer";
import { verifyExactCustomerPdfPreviewDownloadPair } from "../../lib/reporting/exact-customer-pdf-delivery";
import { currentDeploymentTimestampBlocker, AUDIT_CURRENT_DEPLOYMENT_MAX_AGE_MS, AUDIT_CURRENT_DEPLOYMENT_FUTURE_SKEW_MS } from "../../lib/security/audit-current-deployment-freshness-policy";

const address = "0xdac17f958d2ee523a2206206994597c13d831ec7";

async function customerReport(name = "Tether USD") {
  return buildCustomerAuditReport({
    analysisMode: "reference",
    reportId: "c14-p24-reference",
    contractAddress: address,
    contractName: name,
    chainId: "1",
    network: "Ethereum",
    locale: "en",
  }, "basic");
}

function recomputeCustomerDigest(report: CanonicalAuditReportModel) {
  const clone = JSON.parse(JSON.stringify(report)) as CanonicalAuditReportModel;
  const { reportDigest: _old, ...core } = clone;
  void _old;
  clone.reportDigest = sha256Digest(canonicalJson(core));
  return clone;
}

test("customer JSON is hash-verifiable and remains explicitly unverified", async () => {
  const report = await customerReport();
  assert.equal(report.schemaVersion, "velmere.canonical-audit-report.v1");
  assert.equal(report.verdict.riskScore, null);
  assert.equal(report.verdict.confidenceScore, null);
  assert.equal(report.verdict.evidenceCoverage, null);
  assert.equal(report.verdict.releaseDecision, "NOT_VERIFIED");
  assert.equal(report.executionEvidence?.qualification, "NOT_VERIFIED");
  for (const section of report.sections) {
    if (section.isLocked) assert.equal(section.data, null);
  }
  const { reportDigest, ...core } = report;
  assert.equal(reportDigest, sha256Digest(canonicalJson(core)));
});

test("legacy entitlement projection digest and PKI bind the delivered projection", () => {
  const report = buildCanonicalAuditReport({
    analysisMode: "reference",
    reportId: "c14-p24-legacy-projection",
    contractAddress: address,
    contractName: "Tether USD",
    chainId: "1",
    network: "Ethereum",
    locale: "en",
  }, "basic");
  const { reportDigest, pkiAttestation, ...core } = report;
  assert.equal(reportDigest, sha256Digest(canonicalJson(core)), "reportDigest must hash the delivered projection, excluding the attestation itself");
  assert.ok(pkiAttestation, "delivered projection must carry its own attestation");
  assert.equal(pkiAttestation?.signedDigest, reportDigest.replace(/^sha256:/, ""));
  assert.equal(verifyReportPki(pkiAttestation!), true);
});

test("PDF semantic lines bind the JSON model digest and remain NOT_VERIFIED", async () => {
  const report = await customerReport();
  const lines = canonicalReportToPdfLines(report);
  assert.ok(lines.includes(`Report model SHA-256: ${report.reportDigest}`), "detached PDF must identify the exact report model digest");
  assert.match(lines.join("\n"), /NOT_VERIFIED/);
  assert.doesNotMatch(lines.join("\n"), /Release Decision:\s*PASS|VERIFIED - IMMUTABLE/i);
  const rendered = renderCanonicalReportToPdf(report);
  assert.ok(rendered.pdfByteLength > 1_000);
  const parity = verifyExactCustomerPdfPreviewDownloadPair({
    pdfBytes: rendered.pdfBytes,
    expectedPdfSha256: rendered.pdfDigest,
    filenameStem: "c14-p24-report",
  });
  assert.equal(parity.pass, true);
});

test("semantic linter rejects tampered report digest", async () => {
  const report = await customerReport();
  report.reportDigest = "sha256:" + "0".repeat(64);
  const result = lintCanonicalReport(report, "evm_contract");
  assert.equal(result.valid, false);
  assert.ok(result.issues.some((issue) => issue.code === "REPORT_DIGEST_MISMATCH"));
});

test("semantic linter rejects pathological customer-visible finding length", async () => {
  let report = await customerReport();
  const copy = JSON.parse(JSON.stringify(report)) as CanonicalAuditReportModel;
  const section = copy.sections.find((candidate) => !candidate.isLocked && candidate.id === "basic_findings")!;
  section.data ??= {};
  section.data.findings = [{
    id: "C14-LONG-1",
    severity: "medium",
    title: "X".repeat(1_025),
    category: "C14_TEST",
    description: "bounded regression",
    evidence: "traceable-evidence",
    recommendation: "review",
    requiredTier: "basic",
  }];
  report = recomputeCustomerDigest(copy);
  const result = lintCanonicalReport(report, "evm_contract");
  assert.equal(result.valid, false);
  assert.ok(result.issues.some((issue) => issue.code === "REPORT_TEXT_BUDGET_EXCEEDED" && issue.field.includes("title")));
});

test("customer input canonicalizes decomposed Unicode to NFC before JSON/HTML/PDF", () => {
  const normalized = normalizeCustomerReportInput({
    address,
    chainId: "1",
    analysisMode: "reference",
    tier: "basic",
    locale: "en",
    name: "Cafe\u0301 Żółć Über €",
  });
  assert.equal(normalized.target.contractName, "Café Żółć Über €");
  assert.equal(normalized.target.contractName, normalized.target.contractName.normalize("NFC"));
});

test("supported Polish/German Unicode survives PDF planning without replacement", () => {
  const plan = planCustomerSafePdf(["Target: Żółć Über €", "Evidence: Café"], {
    documentId: "c14-unicode",
    generatedAt: new Date().toISOString(),
    locale: "pl",
  });
  assert.equal(plan.unsupportedGlyphReplacements, 0);
  assert.ok(plan.renderedRowCount >= 2);
});

test("freshness boundaries fail stale/future timestamps closed", () => {
  const now = new Date("2026-09-18T00:00:00.000Z");
  assert.equal(currentDeploymentTimestampBlocker(Math.floor(now.getTime() / 1000), now), null);
  assert.equal(
    currentDeploymentTimestampBlocker(Math.floor((now.getTime() - AUDIT_CURRENT_DEPLOYMENT_MAX_AGE_MS - 1_000) / 1000), now),
    "current_deployment_snapshot_stale",
  );
  assert.equal(
    currentDeploymentTimestampBlocker(Math.floor((now.getTime() + AUDIT_CURRENT_DEPLOYMENT_FUTURE_SKEW_MS + 1_000) / 1000), now),
    "current_deployment_snapshot_from_future",
  );
});

test("paid/account report routes re-check current authority immediately before delivery", () => {
  const cases = [
    ["lib/server/lazy-route-modules/security--audit-watch--customer-safe-report.ts", "resolveRequestAccount(request)", 2],
    ["lib/server/lazy-route-modules/security--audit-watch--pro-pdf.ts", "verifyVlmPaidSurfaceEntitlementById({", 2],
    ["lib/server/lazy-route-modules/security--audit-watch--pro-pdf--token.ts", "resolveVlmPaidSurfaceAccess({", 2],
    ["lib/server/security-route-modules/audit-report-assembler.ts", "verifyVlmPaidSurfaceTokenEntitlement({", 2],
  ] as const;
  for (const [path, needle, minimum] of cases) {
    const source = readFileSync(path, "utf8");
    const count = source.split(needle).length - 1;
    assert.ok(count >= minimum, `${path}: expected at least ${minimum} final/current authority reads, observed ${count}`);
  }
});


test("XSS-shaped customer text remains valid data and does not corrupt report semantics", async () => {
  const name = '<img id="c14-p24-xss" src=x onerror="globalThis.__c14P24Xss=1"> Café Żółć Über €';
  const normalized = normalizeCustomerReportInput({
    address,
    chainId: "1",
    analysisMode: "reference",
    tier: "basic",
    locale: "en",
    name,
  });
  assert.equal(normalized.target.contractName, name.normalize("NFC"));
  const report = await customerReport(normalized.target.contractName);
  const lint = lintCanonicalReport(report, "evm_contract");
  assert.equal(lint.valid, true, JSON.stringify(lint.issues));
  const lines = canonicalReportToPdfLines(report).join("\n");
  assert.ok(lines.includes(name.normalize("NFC")));
});

test("empty findings remain a valid explicit-unverified report and render to PDF", async () => {
  const report = await customerReport();
  const copy = JSON.parse(JSON.stringify(report)) as CanonicalAuditReportModel;
  for (const section of copy.sections) {
    if (section.data?.findings) section.data.findings = [];
  }
  const empty = recomputeCustomerDigest(copy);
  const lint = lintCanonicalReport(empty, "evm_contract");
  assert.equal(lint.valid, true, JSON.stringify(lint.issues));
  assert.equal(empty.sections.flatMap(section => section.data?.findings ?? []).length, 0);
  assert.ok(renderCanonicalReportToPdf(empty).pdfByteLength > 1_000);
});

test("malformed and oversized report inputs fail closed before generation", () => {
  assert.throws(() => normalizeCustomerReportInput({
    address,
    chainId: "1",
    analysisMode: "reference",
    tier: "basic",
    locale: ["en"],
  } as unknown as Record<string, unknown>), /invalid_body_field_type/);
  assert.throws(() => normalizeCustomerReportInput({
    address,
    chainId: "1",
    analysisMode: "reference",
    tier: "basic",
    locale: "en",
    name: "X".repeat(2_049),
  }), /report_parameter_too_large/);
});

test("Basic PDF route carries the same browser hardening envelope as canonical PDF delivery", () => {
  const source = readFileSync("app/api/audit/basic/report/route.ts", "utf8");
  for (const required of [
    "'x-content-type-options': 'nosniff'",
    "'content-security-policy': 'sandbox'",
    "'cross-origin-resource-policy': 'same-origin'",
    "'x-frame-options': 'DENY'",
    "'referrer-policy': 'no-referrer'",
  ]) assert.ok(source.includes(required), `missing PDF response hardening: ${required}`);
});

test("archive restore route bounds and structurally validates JSON before bridge use", () => {
  const source = readFileSync("app/api/audit/basic/report/restore/route.ts", "utf8");
  assert.ok(source.includes("readBoundedJsonBody<Record<string, unknown>>(request, 8 * 1024"));
  assert.ok(source.includes("rejectDuplicateKeys: true"));
  assert.ok(source.includes("rejectDangerousKeys: true"));
  assert.ok(source.includes("/^abk_[a-f0-9]{64}$/"));
});
