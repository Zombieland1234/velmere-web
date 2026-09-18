import { NextRequest, NextResponse } from 'next/server';
import { callAuditBasicCustomerBridge } from '@/lib/security/audit-basic-customer-bridge-client';
import { readBoundedJsonBody } from '@/lib/security/payment-webhook-guard';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function POST(request: NextRequest) {
  const caseRef = request.nextUrl.searchParams.get('caseRef')?.trim() ?? '';
  if (!/^AUD-[A-F0-9]{10}$/.test(caseRef)) return NextResponse.json({ ok: false, error: 'case_ref_invalid' }, { status: 400 });
  const parsed = await readBoundedJsonBody<Record<string, unknown>>(request, 8 * 1024, {
    maxDepth: 2,
    requireObject: true,
    rejectDuplicateKeys: true,
    rejectDangerousKeys: true,
  });
  if (!parsed.ok) return parsed.response;
  const body = parsed.value;
  const backupId = typeof body.backupId === 'string' ? body.backupId : '';
  if (!/^abk_[a-f0-9]{64}$/.test(backupId)) return NextResponse.json({ ok: false, error: 'backup_id_invalid' }, { status: 400 });
  try {
    const result = await callAuditBasicCustomerBridge<Record<string, unknown>>(request.headers.get('authorization'), { action: 'restore', caseRef, backupId });
    if (result.ok && result.data) return NextResponse.json({ ok: true, ...result.data }, { status: result.status, headers: { 'cache-control': 'no-store, max-age=0', pragma: 'no-cache' } });
    return NextResponse.json(result.raw ?? { ok: false, error: 'bridge_invalid_response' }, { status: result.status, headers: { 'cache-control': 'no-store, max-age=0', pragma: 'no-cache' } });
  } catch (error) { const code = error instanceof Error ? error.message : 'audit_report_restore_failed'; const status = code === 'CUSTOMER_WRITE_AUTH_REQUIRED' ? 401 : code === 'AUDIT_SERVER_CAPABILITY_REQUIRED' ? 503 : 502; return NextResponse.json({ ok: false, error: code }, { status }); }
}
