/** One research observation using a public EVM node, not a customer/Auth/payment E2E. */
import { mkdirSync, writeFileSync } from 'node:fs';
import { buildCustomerAuditReport } from '../../lib/security/customer-audit-pipeline';
import { renderCanonicalReportToPdf } from '../../lib/security/audit-canonical-report';
const out = process.argv[2] ?? '/tmp/c10-evidence';
mkdirSync(out, { recursive: true });
async function main() {
  const startedAt = new Date().toISOString();
  const report = await buildCustomerAuditReport({
    reportId: 'c10-live-observation', contractAddress: '0xdac17f958d2ee523a2206206994597c13d831ec7',
    contractName: 'Tether USD', chainId: '1', network: 'Ethereum Mainnet', locale: 'en',
    analysisMode: 'runtime',
  }, 'basic', AbortSignal.timeout(15000));
  const observed = report.runtimeAnalysis?.status === 'STATIC_ANALYSIS_COMPLETED';
  writeFileSync(`${out}/OFFLINE_LIVE_RUNTIME_OBSERVATION.json`, JSON.stringify({
    sourceSha: process.env.GITHUB_SHA ?? null, startedAt, finishedAt: new Date().toISOString(),
    scope: 'ONE_OFFLINE_RESEARCH_OBSERVATION_PUBLIC_RPC_REAL_ENGINE_NOT_HOSTED_CUSTOMER_AUTH_OR_PAYMENT_E2E',
    rawProviderBytesRedistributed: false, publicRouteRateGateBypassed: false,
    invokesPublicRoute: false, providerLicenseClaimed: false, independentVerification: false,
    result: observed ? 'OBSERVED' : 'NOT_OBSERVED', report,
  }, null, 2));
  if (observed) {
    const { pdfBytes } = renderCanonicalReportToPdf(report);
    writeFileSync(`${out}/OFFLINE_LIVE_RUNTIME_OBSERVATION.pdf`, pdfBytes);
  }
  console.log(JSON.stringify({ observed, receipt: report.runtimeAnalysis }, null, 2));
}
main().catch(error => { console.error(error instanceof Error ? error.name : 'observation_error'); process.exitCode = 1; });
