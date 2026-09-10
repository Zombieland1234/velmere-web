import { NextRequest, NextResponse } from 'next/server';
import { callAuditBasicCustomerBridge } from '@/lib/security/audit-basic-customer-bridge-client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function POST(request: NextRequest) {
  const caseRef = request.nextUrl.searchParams.get('caseRef')?.trim() ?? '';
  if (!/^AUD-[A-F0-9]{10}$/.test(caseRef)) return NextResponse.json({ ok: false, error: 'case_ref_invalid' }, { status: 400 });
  let body: unknown; try { body = await request.json(); } catch { return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 }); }
  const backupId = body && typeof body === 'object' && !Array.isArray(body) && typeof (body as Record<string, unknown>).backupId === 'string' ? String((body as Record<string, unknown>).backupId) : '';
  if (!/^abk_[a-f0-9]{64}$/.test(backupId)) return NextResponse.json({ ok: false, error: 'backup_id_invalid' }, { status: 400 });
  try {
    const result = await callAuditBasicCustomerBridge<Record<string, unknown>>(request.headers.get('authorization'), { action: 'restore', caseRef, backupId });
    if (result.ok && result.data) return NextResponse.json({ ok: true, ...result.data }, { status: result.status, headers: { 'cache-control': 'no-store, max-age=0', pragma: 'no-cache' } });
    return NextResponse.json(result.raw ?? { ok: false, error: 'bridge_invalid_response' }, { status: result.status, headers: { 'cache-control': 'no-store, max-age=0', pragma: 'no-cache' } });
  } catch (error) { const code = error instanceof Error ? error.message : 'audit_report_restore_failed'; const status = code === 'CUSTOMER_WRITE_AUTH_REQUIRED' ? 401 : code === 'AUDIT_SERVER_CAPABILITY_REQUIRED' ? 503 : 502; return NextResponse.json({ ok: false, error: code }, { status }); }
}
