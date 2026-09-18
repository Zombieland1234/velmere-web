import { NextRequest, NextResponse } from 'next/server';
import { callAuditBasicCustomerBridge } from '@/lib/security/audit-basic-customer-bridge-client';
import { validateExactObjectKeys, validateExactSearchParams } from '@/lib/security/exact-request-boundary';
import { readBoundedJsonBody } from '@/lib/security/payment-webhook-guard';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const MAX_RESTORE_BODY_BYTES = 4 * 1024;

export async function POST(request: NextRequest) {
  const query = validateExactSearchParams(request.nextUrl, ['caseRef']);
  if (!query.ok) return query.response;
  const caseRef = query.values.caseRef?.trim() ?? '';
  if (!/^AUD-[A-F0-9]{10}$/.test(caseRef)) return NextResponse.json({ ok: false, error: 'case_ref_invalid' }, { status: 400 });

  const parsed = await readBoundedJsonBody<Record<string, unknown>>(request, MAX_RESTORE_BODY_BYTES, { maxDepth: 2 });
  if (!parsed.ok) return parsed.response;
  const exact = validateExactObjectKeys(parsed.value, ['backupId']);
  if (!exact.ok) return exact.response;

  const backupId = typeof parsed.value.backupId === 'string' ? parsed.value.backupId : '';
  if (!/^abk_[a-f0-9]{64}$/.test(backupId)) return NextResponse.json({ ok: false, error: 'backup_id_invalid' }, { status: 400 });
  try {
    const result = await callAuditBasicCustomerBridge<Record<string, unknown>>(request.headers.get('authorization'), { action: 'restore', caseRef, backupId });
    if (result.ok && result.data) return NextResponse.json({ ok: true, ...result.data }, { status: result.status, headers: { 'cache-control': 'no-store, max-age=0', pragma: 'no-cache' } });
    return NextResponse.json(result.raw ?? { ok: false, error: 'bridge_invalid_response' }, { status: result.status, headers: { 'cache-control': 'no-store, max-age=0', pragma: 'no-cache' } });
  } catch (error) { const code = error instanceof Error ? error.message : 'audit_report_restore_failed'; const status = code === 'CUSTOMER_WRITE_AUTH_REQUIRED' ? 401 : code === 'AUDIT_SERVER_CAPABILITY_REQUIRED' ? 503 : 502; return NextResponse.json({ ok: false, error: code }, { status }); }
}
