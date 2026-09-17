/** Wait for streaming placeholders to settle; never choose the first duplicate. */
export async function waitForSettledRuntimeReport(page, timeoutMs = 20_000) {
  await page.waitForFunction(() => {
    const reports = document.querySelectorAll('.audit-canonical-view');
    if (reports.length !== 1) return false;
    const report = reports[0];
    const style = getComputedStyle(report);
    const text = report.innerText || '';
    return report.getClientRects().length > 0
      && style.visibility !== 'hidden' && style.visibility !== 'collapse'
      && style.display !== 'none'
      && text.includes('STATIC_ANALYSIS_COMPLETED')
      && !text.includes('ANALYSIS_UNAVAILABLE');
  }, null, { timeout: timeoutMs });
  const report = page.locator('.audit-canonical-view');
  await report.waitFor({ state: 'visible', timeout: timeoutMs });
  if (await report.count() !== 1) throw new Error('runtime_report_not_unique');
}
