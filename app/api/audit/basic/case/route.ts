import { NextRequest, NextResponse } from 'next/server';
import { callAuditBasicCustomerBridge } from '@/lib/security/audit-basic-customer-bridge-client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
function json(status: number, body: unknown) { return NextResponse.json(body, { status, headers: { 'cache-control': 'no-store, max-age=0', pragma: 'no-cache' } }); }
function routeStatus(code: string) { return code === 'CUSTOMER_WRITE_AUTH_REQUIRED' ? 401 : code === 'AUDIT_SERVER_CAPABILITY_REQUIRED' ? 503 : 502; }

export async function POST(request: NextRequest) {
  const length = Number(request.headers.get('content-length') ?? '0');
  if (Number.isFinite(length) && length > 65_536) return json(413, { ok: false, error: 'request_too_large' });
  let caseInput: unknown; try { caseInput = await request.json(); } catch { return json(400, { ok: false, error: 'invalid_json' }); }
  if (!caseInput || typeof caseInput !== 'object' || Array.isArray(caseInput)) return json(400, { ok: false, error: 'case_input_invalid' });
  try { const result = await callAuditBasicCustomerBridge(request.headers.get('authorization'), { action: 'create_case', caseInput: caseInput as Record<string, unknown> }); return json(result.status, result.raw ?? { ok: false, error: 'bridge_invalid_response' }); }
  catch (error) { const code = error instanceof Error ? error.message : 'audit_case_route_failed'; return json(routeStatus(code), { ok: false, error: code }); }
}

export async function GET(request: NextRequest) {
  const caseRef = request.nextUrl.searchParams.get('caseRef')?.trim() ?? '';
  if (!/^AUD-[A-F0-9]{10}$/.test(caseRef)) return json(400, { ok: false, error: 'case_ref_invalid' });
  try { const result = await callAuditBasicCustomerBridge(request.headers.get('authorization'), { action: 'get_case', caseRef }); return json(result.status, result.raw ?? { ok: false, error: 'bridge_invalid_response' }); }
  catch (error) { const code = error instanceof Error ? error.message : 'audit_case_route_failed'; return json(routeStatus(code), { ok: false, error: code }); }
}
