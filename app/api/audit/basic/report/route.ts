import { createHash } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { callAuditBasicCustomerBridge } from '@/lib/security/audit-basic-customer-bridge-client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
function json(status: number, body: unknown) { return NextResponse.json(body, { status, headers: { 'cache-control': 'no-store, max-age=0', pragma: 'no-cache' } }); }
function caseRefOf(request: NextRequest) { return request.nextUrl.searchParams.get('caseRef')?.trim() ?? ''; }
function validCaseRef(value: string) { return /^AUD-[A-F0-9]{10}$/.test(value); }
function routeStatus(code: string) { return code === 'CUSTOMER_WRITE_AUTH_REQUIRED' ? 401 : code === 'AUDIT_SERVER_CAPABILITY_REQUIRED' ? 503 : 502; }

export async function GET(request: NextRequest) {
  const caseRef = caseRefOf(request); if (!validCaseRef(caseRef)) return json(400, { ok: false, error: 'case_ref_invalid' });
  try {
    const result = await callAuditBasicCustomerBridge<Record<string, unknown>>(request.headers.get('authorization'), { action: 'get_pdf', caseRef });
    if (!result.ok || !result.data) return json(result.status, result.raw ?? { ok: false, error: 'bridge_invalid_response' });
    const body = result.data; const pdfBase64 = typeof body.pdfBase64 === 'string' ? body.pdfBase64 : ''; const pdfDigest = typeof body.pdfDigest === 'string' ? body.pdfDigest : ''; const recordDigest = typeof body.recordDigest === 'string' ? body.recordDigest : ''; const reportId = typeof body.reportId === 'string' ? body.reportId : 'velmere-audit-basic-report';
    let bytes: Buffer; try { bytes = Buffer.from(pdfBase64, 'base64'); } catch { return json(502, { ok: false, error: 'pdf_decode_failed' }); }
    const observed = 'sha256:' + createHash('sha256').update(bytes).digest('hex');
    if (bytes.length < 1000 || observed !== pdfDigest || Number(body.pdfByteLength) !== bytes.length || !/^sha256:[a-f0-9]{64}$/.test(recordDigest)) return json(502, { ok: false, error: 'pdf_integrity_failed' });
    const safeName = reportId.replace(/[^A-Za-z0-9._-]+/g, '-').slice(0, 120) || 'velmere-audit-basic-report';
    return new NextResponse(Uint8Array.from(bytes), { status: 200, headers: { 'content-type': 'application/pdf', 'content-length': String(bytes.length), 'content-disposition': 'attachment; filename="' + safeName + '.pdf"', 'cache-control': 'private, no-store, max-age=0', pragma: 'no-cache', etag: '"' + pdfDigest.slice(7) + '"', 'x-velmere-pdf-digest': pdfDigest, 'x-velmere-record-digest': recordDigest } });
  } catch (error) { const code = error instanceof Error ? error.message : 'audit_report_route_failed'; return json(routeStatus(code), { ok: false, error: code }); }
}

export async function DELETE(request: NextRequest) {
  const caseRef = caseRefOf(request); if (!validCaseRef(caseRef)) return json(400, { ok: false, error: 'case_ref_invalid' });
  try {
    const result = await callAuditBasicCustomerBridge<Record<string, unknown>>(request.headers.get('authorization'), { action: 'backup_erase', caseRef });
    if (result.ok && result.data) return json(result.status, { ok: true, ...result.data });
    return json(result.status, result.raw ?? { ok: false, error: 'bridge_invalid_response' });
  } catch (error) { const code = error instanceof Error ? error.message : 'audit_report_erase_failed'; return json(routeStatus(code), { ok: false, error: code }); }
}
