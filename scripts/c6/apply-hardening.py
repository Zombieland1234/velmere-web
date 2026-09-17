"""Reviewed nonvisual repairs for the recovered GitHub runtime, NOT a claim of UI2 identity.
Exact source anchors fail closed. Run only on the isolated C6 branch.
"""
from pathlib import Path
import json,re,hashlib
changes=[]
def replace(s,a,b,n=1):
 if s.count(a)!=n: raise RuntimeError('Unexpected source anchor '+repr(a[:90])+': '+str(s.count(a)))
 return s.replace(a,b)
def edit(path,fn):
 p=Path(path);before=p.read_text();after=fn(before)
 if before==after:raise RuntimeError('No change '+path)
 p.write_text(after);changes.append({'path':path,'beforeSha256':hashlib.sha256(before.encode()).hexdigest(),'afterSha256':hashlib.sha256(after.encode()).hexdigest()})
def tsconfig(s):
 j=json.loads(s)
 if not j['compilerOptions'].get('noEmit'):raise RuntimeError('noEmit is required')
 j['compilerOptions']['allowImportingTsExtensions']=True
 return json.dumps(j,indent=2)+'\n'
edit('tsconfig.json',tsconfig)
edit('next.config.mjs',lambda s:replace(s,'ignoreBuildErrors: true','ignoreBuildErrors: false'))
edit('lib/market-integrity/pass35-a16-canonical-channel-parity.ts',lambda s:replace(s,'kind:(i?"FINDING":"FACT") as const','kind:(i ? "FINDING" as const : "FACT" as const)'))
edit('lib/security/replay/evidence-replay-engine.ts',lambda s:replace(replace(s,'findingsA.add(f.id || f.title);','const identity = f.id || f.title;\n        if (identity) findingsA.add(identity);'),'findingsB.add(f.id || f.title);','const identity = f.id || f.title;\n        if (identity) findingsB.add(identity);'))
shortcut='    // Allow user to execute Pro and Advanced analysis directly\n    startLocalAnalysis(tier);\n    return;\n\n'
for p in ['components/market-integrity/AssetDetailModal.tsx','components/backup/legacy/LegacyAssetPopup.tsx']:
 edit(p,lambda s:replace(s,shortcut,''))
def proxy(s):
 ls=s.splitlines(keepends=True)
 if sum('[DEBUG PROXY EDGE]' in line for line in ls)!=1:raise RuntimeError('debug log anchor mismatch')
 return ''.join(line for line in ls if '[DEBUG PROXY EDGE]' not in line)
edit('proxy.ts',proxy)
def pdf(s):
 s=replace(s,'import { MASTER_50_AUDITS } from "@/lib/security/master-50-audits";\n','')
 s=replace(s,'import { NextRequest, NextResponse } from "next/server";','import { NextRequest, NextResponse } from "next/server";\nimport { publicApiError } from "@/lib/security/api-error-envelope";')
 start=s.index('    if (caseRef) {\n      const caseRecord = await getAuditCaseForOwningAccount');end=s.index('    // Check if account has an active server entitlement in ledger',start)
 s=s[:start]+'    // Historical verification is not current access: regeneration requires an active grant.\n'+s[end:]
 s=replace(s,'import { getAuditCaseForOwningAccount } from "@/lib/security/audit-intake-case-vault";\n','')
 s=replace(s,'    const corpusMatch = MASTER_50_ASSETS.find((a) => {','    const corpusMatch = idClean ? MASTER_50_ASSETS.find((a) => {')
 s=replace(s,'        aId.includes(idClean) ||','        (idClean.length >= 3 && aId.includes(idClean)) ||')
 s=replace(s,'        aName.includes(idClean) ||\n','')
 s=replace(s,'    });\n\n    if (corpusMatch)','    }) : undefined;\n\n    if (corpusMatch)')
 start=s.index('    const isBenchmark = Boolean(');end=s.index('    let effectiveBytecode',start)
 s=s[:start]+'''    if (requestedTierParam && !["basic", "pro", "advanced"].includes(requestedTierParam)) {
      return json(400, { ok: false, error: "invalid_audit_tier" });
    }
    const rank = { basic: 0, pro: 1, advanced: 2 } as const;
    const requestedTier = (requestedTierParam || clientTier) as AuditTier;
    if (rank[requestedTier] > rank[clientTier]) {
      return json(account ? 403 : 401, { ok: false, error: "current_audit_entitlement_required" });
    }
    const effectiveTier: AuditTier = requestedTier;

'''+s[end:]
 s=replace(s,'''  } catch (err: any) {
    console.error("[REPORT_PDF_GET_ERROR]", err);
    return json(500, { ok: false, error: err?.message || String(err), stack: err?.stack });
  }''','''  } catch (error: unknown) {
    return publicApiError(error, { route: "/api/audit/report-pdf", code: "report_pdf_unavailable" });
  }''')
 return s
edit('app/api/audit/report-pdf/route.ts',pdf)
edit('app/api/checkout/stripe-analysis/route.ts',lambda s:'''import { NextResponse } from "next/server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
/** Legacy sessions lack account/readiness bindings. Payment status alone is not an entitlement. */
function retiredCheckout() {
  return NextResponse.json({ ok: false, error: "legacy_checkout_retired",
    checkoutRoute: "/api/checkout/vlm-service", verificationRoute: "/api/checkout/vlm-service/verify",
    paid: false, retryable: false,
  }, { status: 410, headers: { "cache-control": "private, no-store", "x-content-type-options": "nosniff" } });
}
export function POST() { return retiredCheckout(); }
export function GET() { return retiredCheckout(); }
''')
edit('app/api/market-integrity/export/route.ts',lambda s:'''import { NextResponse } from "next/server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
function unverifiedExport() {
  return NextResponse.json({ ok: false, error: "verified_stored_report_required",
    artifactRoute: "/api/account/customer-artifact", retryable: false,
  }, { status: 409, headers: { "cache-control": "private, no-store", "x-content-type-options": "nosniff" } });
}
/** Client-supplied prices, risk and confidence are not verified provider observations. */
export function GET() { return unverifiedExport(); }
export function POST() { return unverifiedExport(); }
''')
p=Path('config/report-access-policy.json')
if p.exists():raise RuntimeError('report policy already exists')
p.write_text(json.dumps({'schemaVersion':'velmere.report-access-policy.v1','policyId':'current-entitlement-for-regeneration-v1','appliesTo':['/api/audit/report-pdf'],'paidRegenerationRequiresCurrentEntitlement':True,'historicalCaseVerificationGrantsCurrentAccess':False,'benchmarkInputGrantsPaidAccess':False,'storedImmutableArtifacts':'existing owner-bound route; full current-rights integration still required','customerContractChange':'not deployed to production'},indent=2)+'\n')
subs={
 'components/market-integrity/AssetAreaChart.tsx':[('let t = "";','let t: string;')],
 'components/market-integrity/ShieldMapCommandClient.tsx':[('let statusText = "";','let statusText: string;'),('let statusBadgeStyle = "";','let statusBadgeStyle: string;')],
 'lib/security/audit-canonical-report.ts':[('let classification: "A" | "B" | "C" | "D" | "E" | "F" = "B";','let classification: "A" | "B" | "C" | "D" | "E" | "F";')],
 'lib/security/formal/formal-engine.ts':[('let status: InvariantStatus = "NOT_RUN";','let status: InvariantStatus;')],
 'lib/security/freshness/data-freshness-engine.ts':[('let status: FreshnessStatus = "LIVE";','let status: FreshnessStatus;')],
 'lib/security/market-evidence/market-provenance-engine.ts':[('let darkPoolStatus: TraditionalMarketMetrics["darkPoolStatus"] = "NOT_OBSERVED_INSUFFICIENT_DATA";','let darkPoolStatus: TraditionalMarketMetrics["darkPoolStatus"];')],
 'lib/security/transient-storage-verifier.ts':[('let forensicSummary = "";','let forensicSummary: string;')],
 'lib/security/unified-audit-pipeline.ts':[('let invStatus: FormalInvariantRecord["status"] = "UNKNOWN";','let invStatus: FormalInvariantRecord["status"];')],
 'lib/server/search-route-modules/lens-report.ts':[('let deliveryBinding: R7BrowserEcbDeliveryBinding | BrowserDerivedDeliveryBinding | null = null;','let deliveryBinding: R7BrowserEcbDeliveryBinding | BrowserDerivedDeliveryBinding | null;')],
 'lib/security/institutional-pipeline-gate.ts':[(f'let {x} = false;',f'let {x}: boolean;') for x in ['evidenceIntegrity','formalIntegrity','scoringIntegrity','pdfIntegrity']],
}
for p,pairs in subs.items():
 def fn(s,pairs=pairs):
  for a,b in pairs:s=replace(s,a,b)
  return s
 edit(p,fn)
for p,a,b in [('lib/market-integrity/coingecko.ts','let row = null;','let row;'),('lib/server/market-integrity-route-modules/investigator.ts','let marketRow = null;','let marketRow;')]:edit(p,lambda s,a=a,b=b:replace(s,a,b))
for p in ['components/market-integrity/AnalysisCardsSection.tsx','components/market-integrity/ShieldRealMarketsParityClient.tsx','components/security/SecurityAuditsCleanPage.tsx','lib/commerce/vlm-paid-access-client.ts','lib/market-integrity/risk-ledger.ts']:
 def catches(s,p=p):
  s=re.sub(r'catch\s*\{\s*\}','catch { /* Best-effort UI/cache operation; preserve the existing fallback. */ }',s)
  if p.endswith('SecurityAuditsCleanPage.tsx'):s=replace(s,'  const runAuditExecution = async (tierToRun: TierId) => {','  async function runAuditExecution(tierToRun: TierId) {')
  return s
 edit(p,catches)
edit('lib/security/input-sanitizer.ts',lambda s:replace(replace(s,'const CONTROL_CHARACTERS = /[\\x00-\\x1f\\x7f]/g;','const CONTROL_CHARACTERS = ASCII_CONTROL_PATTERN;'),'const DANGEROUS_HTML_PATTERNS =','import { ASCII_CONTROL_PATTERN } from "./ascii-control-characters";\n\nconst DANGEROUS_HTML_PATTERNS ='))
def pkg(s):
 j=json.loads(s);j['dependencies']['next']='16.3.5';j['devDependencies']['@next/eslint-plugin-next']='16.3.5'
 j['overrides']['sharp']='0.35.4';j['devDependencies']['postcss-selector-parser']='6.1.4';j['devDependencies']['solc']='0.8.37'
 j['scripts']['dev']='next dev';j['scripts']['typecheck']='tsc --noEmit --strict';j['scripts']['lint']='eslint .';j['scripts']['lint:strict']='eslint . --max-warnings=0';j['scripts']['test:c6']='tsx --test scripts/c6/*.test.ts'
 return json.dumps(j,indent=2)+'\n'
edit('package.json',pkg)
Path('/tmp/c6-changes.json').write_text(json.dumps(changes,indent=2))
print('Prepared nonvisual source changes:',len(changes))
