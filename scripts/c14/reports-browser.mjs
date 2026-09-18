import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const out = process.argv[2];
if (!out) throw new Error("output directory required");
fs.mkdirSync(out, { recursive: true });

const origin = "http://127.0.0.1:3000";
const address = "0xdac17f958d2ee523a2206206994597c13d831ec7";
const xssName = '<img id="c14-p24-xss" src=x onerror="window.__c14P24Xss=1"> Café Żółć Über €';
const longName = "LONG_UNBROKEN_" + "W".repeat(980);
const rows = [];
const browser = await chromium.launch({ headless: true });

async function visit(page, viewport, name, kind) {
  const url = `${origin}/en/security/audits/report/${address}?chainId=1&tier=basic&analysisMode=reference&name=${encodeURIComponent(name)}`;
  const response = await page.goto(url, { waitUntil: "networkidle", timeout: 30_000 });
  assert.equal(response?.status(), 200);
  await page.waitForTimeout(250);
  const reportViews = await page.locator(".audit-canonical-view").count();
  const body = await page.locator("body").innerText();
  if (reportViews !== 1) {
    console.error(JSON.stringify({ viewport, kind, status: response?.status(), url, body: body.slice(0, 2_000) }));
  }
  assert.equal(reportViews, 1, `${kind} report did not reach canonical SSR view`);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  rows.push({ viewport, kind, url, overflow, bodySha256: createHash("sha256").update(body).digest("hex") });
  assert.equal(overflow, false, `${kind} caused horizontal document overflow on ${viewport}`);
  assert.match(body, /NOT VERIFIED|NOT_VERIFIED|NOT MEASURED/);
  if (kind === "xss") {
    assert.equal(await page.locator("#c14-p24-xss").count(), 0, "payload must render as text, never DOM");
    assert.equal(await page.evaluate(() => globalThis.__c14P24Xss), undefined);
    assert.ok(body.includes("<img id=\"c14-p24-xss\""), "escaped payload should remain visible as text");
    assert.ok(body.includes("Café Żółć Über €"), "supported Unicode should survive browser rendering");
  }
}

try {
  for (const viewport of [
    { name: "desktop", width: 1440, height: 1000 },
    { name: "mobile", width: 390, height: 844 },
  ]) {
    const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height }, reducedMotion: "reduce" });
    const page = await context.newPage();
    const pageErrors = [];
    page.on("pageerror", error => pageErrors.push(error.message));
    await visit(page, viewport.name, xssName, "xss");
    await visit(page, viewport.name, longName, "long-name");
    assert.deepEqual(pageErrors, []);
    await page.screenshot({ path: path.join(out, `report-${viewport.name}.png`), fullPage: true });
    await context.close();
  }

  const context = await browser.newContext();
  const params = new URLSearchParams({
    address,
    chainId: "1",
    tier: "basic",
    analysisMode: "reference",
    locale: "en",
    name: xssName,
  });
  const jsonResponse = await context.request.get(`${origin}/api/audit/report?${params}`);
  assert.equal(jsonResponse.status(), 200);
  assert.match(jsonResponse.headers()["cache-control"] ?? "", /no-store/);
  assert.equal(jsonResponse.headers()["x-content-type-options"], "nosniff");
  const json = await jsonResponse.json();
  assert.equal(json.report.target.contractName, xssName.normalize("NFC"));
  assert.equal(json.report.verdict.releaseDecision, "NOT_VERIFIED");
  assert.equal(json.report.verdict.riskScore, null);
  assert.equal(json.report.verdict.confidenceScore, null);
  assert.equal(json.report.verdict.evidenceCoverage, null);
  assert.match(json.report.reportDigest, /^sha256:[a-f0-9]{64}$/);

  const pdfResponse = await context.request.get(`${origin}/api/audit/report-pdf?${params}&disposition=preview`);
  assert.equal(pdfResponse.status(), 200);
  const pdfHeaders = pdfResponse.headers();
  assert.equal(pdfHeaders["content-type"], "application/pdf");
  assert.match(pdfHeaders["cache-control"] ?? "", /no-store/);
  assert.equal(pdfHeaders["content-security-policy"], "sandbox");
  assert.equal(pdfHeaders["cross-origin-resource-policy"], "same-origin");
  assert.equal(pdfHeaders["x-frame-options"], "DENY");
  assert.match(pdfHeaders["x-velmere-audit-pdf-digest"] ?? "", /^sha256:[a-f0-9]{64}$/);
  assert.match(pdfHeaders["x-velmere-audit-report-digest"] ?? "", /^sha256:[a-f0-9]{64}$/);
  const bytes = Buffer.from(await pdfResponse.body());
  assert.equal(Number(pdfHeaders["content-length"]), bytes.length);
  assert.equal("sha256:" + createHash("sha256").update(bytes).digest("hex"), pdfHeaders["x-velmere-audit-pdf-digest"]);
  const latin = bytes.toString("latin1");
  assert.doesNotMatch(latin, /\/(?:JavaScript|JS|Launch|EmbeddedFile|OpenAction|AA)\b/i);
  assert.doesNotMatch(latin, /<script|onerror\s*=/i);

  fs.writeFileSync(path.join(out, "browser-report-results.json"), JSON.stringify({
    sourceSha: process.env.GITHUB_SHA,
    rows,
    api: {
      jsonStatus: jsonResponse.status(),
      pdfStatus: pdfResponse.status(),
      jsonReportDigest: json.report.reportDigest,
      pdfReportDigest: pdfHeaders["x-velmere-audit-report-digest"],
      pdfDigest: pdfHeaders["x-velmere-audit-pdf-digest"],
      pdfBytes: bytes.length,
    },
  }, null, 2));
  await context.close();
} finally {
  await browser.close();
}
