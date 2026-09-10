import 'server-only';

export type AuditBasicBridgeResult<T = unknown> = Readonly<{
  status: number;
  ok: boolean;
  data: T | null;
  raw: unknown;
}>;

function requiredServerCapability(): string {
  const value = process.env.VELMERE_AUDIT_SERVER_CAPABILITY?.trim() ?? '';
  if (!/^[a-f0-9]{96}$/.test(value)) throw new Error('AUDIT_SERVER_CAPABILITY_REQUIRED');
  return value;
}

function bridgeUrl(): string {
  const explicit = process.env.VELMERE_AUDIT_CUSTOMER_BRIDGE_URL?.trim() ?? '';
  if (explicit) return explicit;
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? '';
  if (!base.startsWith('https://')) throw new Error('AUDIT_CUSTOMER_BRIDGE_URL_REQUIRED');
  const normalized = base.endsWith('/') ? base.slice(0, -1) : base;
  return normalized + '/functions/v1/r7-audit-basic-customer-bridge';
}

function bearer(value: string | null): string {
  const match = (value ?? '').trim().match(/^Bearer\s+([^\s]{20,8192})$/i);
  if (!match) throw new Error('CUSTOMER_WRITE_AUTH_REQUIRED');
  return 'Bearer ' + match[1];
}

export async function callAuditBasicCustomerBridge<T = unknown>(
  authorization: string | null,
  body: Readonly<Record<string, unknown>>,
): Promise<AuditBasicBridgeResult<T>> {
  const response = await fetch(bridgeUrl(), {
    method: 'POST',
    headers: {
      authorization: bearer(authorization),
      'content-type': 'application/json',
      accept: 'application/json',
      'x-velmere-audit-server-capability': requiredServerCapability(),
    },
    body: JSON.stringify({ schemaVersion: 'velmere.r7.audit-basic-customer-bridge-request.v1', ...body }),
    cache: 'no-store',
    signal: AbortSignal.timeout(20_000),
  });
  const raw: unknown = await response.json().catch(() => null);
  const record = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw as Record<string, unknown> : null;
  const data = record?.data && typeof record.data === 'object' && !Array.isArray(record.data) ? record.data as T : null;
  return { status: response.status, ok: response.ok && record?.ok === true, data, raw };
}
