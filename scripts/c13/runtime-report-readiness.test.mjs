/** Browser harness tests: synthetic HTML, not additional product E2E runs. */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { waitForSettledRuntimeReport } from './runtime-report-readiness.mjs';
const out = process.argv[2];
if (!out) throw new Error('Output directory required');
fs.mkdirSync(out, { recursive: true });
const completed = '<div class="audit-canonical-view">STATIC_ANALYSIS_COMPLETED</div>';
const cases = [
  { id: 'one-visible-completed-report-accepted', html: completed, accept: true },
  { id: 'transient-streaming-duplicate-must-settle', html: completed + '<div id="stream-placeholder" hidden>' + completed + '</div>', accept: true, transient: true },
  { id: 'permanent-visible-duplicates-denied', html: completed + completed, accept: false },
  { id: 'permanent-hidden-duplicate-not-ignored', html: completed + '<div hidden>' + completed + '</div>', accept: false },
  { id: 'hidden-only-completed-report-denied', html: '<div hidden>' + completed + '</div>', accept: false },
  { id: 'page-shell-without-report-denied', html: '<main>Application shell</main>', accept: false },
  { id: 'completion-outside-empty-report-denied', html: '<p>STATIC_ANALYSIS_COMPLETED</p><div class="audit-canonical-view">Loading</div>', accept: false },
  { id: 'unavailable-state-cannot-pass-as-completed', html: '<div class="audit-canonical-view">STATIC_ANALYSIS_COMPLETED ANALYSIS_UNAVAILABLE</div>', accept: false },
];
const browser = await chromium.launch({ headless: true }), rows = [];
try {
  for (const c of cases) {
    const page = await browser.newPage();
    let accepted = false, error = null;
    try {
      await page.setContent(c.html);
      const initialCount = await page.locator('.audit-canonical-view').count();
      if (c.transient) {
        assert.equal(initialCount, 2);
        await page.evaluate(() => { setTimeout(() => document.getElementById('stream-placeholder')?.remove(), 150); });
      }
      try { await waitForSettledRuntimeReport(page, 1000); accepted = true; }
      catch (e) { error = { name: e.name, message: e.message.slice(0, 240) }; }
      const finalCount = await page.locator('.audit-canonical-view').count();
      const pass = accepted === c.accept && (c.accept ? finalCount === 1 : error?.name === 'TimeoutError');
      rows.push({ id: c.id, expectedAccepted: c.accept, accepted, initialCount, finalCount, error, result: pass ? 'PASS' : 'FAIL' });
      console.log(c.id, pass ? 'PASS' : 'FAIL');
    } finally { await page.close(); }
  }
} finally {
  await browser.close();
  fs.writeFileSync(path.join(out, 'C13_BROWSER_READINESS_TESTS.json'), JSON.stringify({ sourceSha: process.env.GITHUB_SHA, scope: 'SYNTHETIC_HTML_REAL_CHROMIUM_HARNESS_REGRESSION_NOT_CUSTOMER_PRODUCT_E2E', rows }, null, 2));
}
if (rows.length !== cases.length || rows.some(r => r.result !== 'PASS')) process.exitCode = 1;
