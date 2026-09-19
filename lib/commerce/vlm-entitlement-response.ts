import { getVlmPaidProduct, normalizePaidContext, normalizeVlmPaidProductId, type VlmPaidAccessContext } from "./vlm-paid-access";
import { hashVlmPaidAccessContext } from "./vlm-paid-access-server";
import type { VlmPaidEntitlementRecord, VlmPaidEntitlementSessionWriteResult, VlmPaidEntitlementSource, VlmPaidEntitlementStatus } from "./vlm-entitlement-ledger";

// This validates the application's transport boundary; it is not a signature,
// proof of a committed transaction, or an independent source of payment truth.
const statuses = new Set<string>(["paid", "active", "expired", "refunded", "revoked", "consumed"]);
const sources = new Set<string>(["stripe_webhook", "checkout_verify", "manual_repair", "local_demo_verify"]);
const hashPattern = /^[a-f0-9]{64}$/;

function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function text(value: unknown, max: number, trim = true): value is string {
  if (typeof value !== "string" || !value || value.length > max || (trim && value.trim() !== value)) return false;
  // A predicate avoids both coercion and a lint exception for control-char regexes.
  for (let i = 0; i < value.length; i += 1) {
    const code = value.charCodeAt(i);
    if (code < 32 || (code >= 127 && code <= 159)) return false;
  }
  return true;
}
export function isVlmEntitlementIdentifier(value: unknown, max = 180): value is string {
  return text(value, max);
}
function nullableText(value: unknown, max: number): value is string | null | undefined {
  return value === null || value === undefined || text(value, max, false);
}
function sameOptional(a: string | null | undefined, b: string | null | undefined) {
  return (a ?? null) === (b ?? null);
}

// SQL timestamps may have an offset and up to microsecond precision. Date gives
// millisecond comparison only. Reject shorthand dates, infinity and rollover.
export function vlmEntitlementTimestamp(value: unknown): number | null {
  if (typeof value !== "string") return null;
  const parts = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2}):(\d{2})(?:\.\d{1,6})?(Z|[+-]\d{2}:\d{2})$/.exec(value);
  if (!parts) return null;
  const [, year, month, day, hour, minute, second, zone] = parts;
  const y = Number(year), m = Number(month), d = Number(day);
  const leap = y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (y < 1 || m < 1 || m > 12 || d < 1 || d > days[m - 1] || Number(hour) > 23 || Number(minute) > 59 || Number(second) > 59) return null;
  if (zone !== "Z" && (Number(zone.slice(1, 3)) > 15 || Number(zone.slice(4)) > 59)) return null;
  const result = Date.parse(value);
  return Number.isFinite(result) ? result : null;
}
function canonicalContext(value: unknown): VlmPaidAccessContext | null {
  if (!object(value)) return null;
  if (!["pl", "en", "de"].includes(String(value.locale)) || !["shield", "shield-pro", "real-markets", "browser", "audit", "unknown"].includes(String(value.surface))) return null;
  const limits: Record<string, number> = { assetId: 96, symbol: 32, requestId: 96, auditCaseRef: 32, returnPath: 360, accountIdHash: 64 };
  const allowed = new Set(["locale", "surface", "depth", ...Object.keys(limits)]);
  if (Object.keys(value).some(key => !allowed.has(key))) return null;
  for (const [key, limit] of Object.entries(limits)) {
    if (value[key] !== undefined && !text(value[key], limit)) return null;
  }
  if (value.depth !== undefined && !["basic", "pro", "advanced"].includes(String(value.depth))) return null;
  if (value.accountIdHash !== undefined && (typeof value.accountIdHash !== "string" || !hashPattern.test(value.accountIdHash))) return null;
  const normalized = normalizePaidContext(value as Partial<VlmPaidAccessContext>);
  // Normalization must not silently truncate or reinterpret an authoritative row.
  if (Object.keys(value).some(key => value[key] !== normalized[key as keyof VlmPaidAccessContext])) return null;
  return normalized;
}
export function sameVlmEntitlementContext(a: VlmPaidAccessContext, b: VlmPaidAccessContext): boolean {
  const left = normalizePaidContext(a), right = normalizePaidContext(b);
  return (Object.keys(left) as (keyof VlmPaidAccessContext)[]).every(key => left[key] === right[key]);
}
export function isVlmEntitlementAuthorizing(record: VlmPaidEntitlementRecord): boolean {
  return (record.status === "paid" || record.status === "active")
    && record.paymentStatus === "paid";
}

export function parseVlmEntitlementRecord(data: unknown): VlmPaidEntitlementRecord | null {
  if (!object(data) || !isVlmEntitlementIdentifier(data.id) || !isVlmEntitlementIdentifier(data.stripe_session_id)) return null;
  const productId = normalizeVlmPaidProductId(data.product_id);
  const context = canonicalContext(data.context);
  if (!productId || !context || data.locale !== context.locale) return null;
  if (data.access_scope !== getVlmPaidProduct(productId, context.locale).accessScope) return null;
  if (typeof data.status !== "string" || !statuses.has(data.status) || typeof data.source !== "string" || !sources.has(data.source)) return null;
  if (typeof data.context_hash !== "string" || !hashPattern.test(data.context_hash) || hashVlmPaidAccessContext(context) !== data.context_hash) return null;
  if (typeof data.amount_total !== "number" || !Number.isSafeInteger(data.amount_total) || data.amount_total < 0) return null;
  if (typeof data.currency !== "string" || !/^[A-Z]{3}$/.test(data.currency) || !text(data.payment_status, 64)) return null;
  if (!nullableText(data.stripe_customer_id, 180) || !nullableText(data.audit_queue_id, 180)
      || !nullableText(data.customer_email, 320) || !nullableText(data.customer_name, 500)) return null;
  const created = vlmEntitlementTimestamp(data.created_at), updated = vlmEntitlementTimestamp(data.updated_at), expires = vlmEntitlementTimestamp(data.expires_at);
  if (created === null || updated === null || expires === null || updated < created || expires <= created) return null;
  return {
    id: data.id, stripeSessionId: data.stripe_session_id, stripeCustomerId: data.stripe_customer_id ?? null,
    productId, accessScope: data.access_scope as string, status: data.status as VlmPaidEntitlementStatus,
    contextHash: data.context_hash, context, locale: context.locale, amountTotal: data.amount_total,
    currency: data.currency, customerEmail: data.customer_email ?? null, customerName: data.customer_name ?? null,
    paymentStatus: data.payment_status, source: data.source as VlmPaidEntitlementSource,
    createdAt: data.created_at as string, updatedAt: data.updated_at as string, expiresAt: data.expires_at as string,
    auditQueueId: data.audit_queue_id ?? null,
  };
}

export type VlmEntitlementResponseBinding = {
  id?: string; stripeSessionId?: string; productId?: VlmPaidEntitlementRecord["productId"];
  contextHash?: string; accountIdHash?: string; authorizing?: boolean;
};
export function requireVlmEntitlementResponse(data: unknown, expected: VlmEntitlementResponseBinding): VlmPaidEntitlementRecord {
  const record = parseVlmEntitlementRecord(data);
  if (!record || (expected.id !== undefined && record.id !== expected.id)
      || (expected.stripeSessionId !== undefined && record.stripeSessionId !== expected.stripeSessionId)
      || (expected.productId !== undefined && record.productId !== expected.productId)
      || (expected.contextHash !== undefined && record.contextHash !== expected.contextHash)
      || (expected.accountIdHash !== undefined && record.context.accountIdHash !== expected.accountIdHash)
      || (expected.authorizing && !isVlmEntitlementAuthorizing(record))) {
    throw new Error("entitlement_response_binding_invalid");
  }
  return record;
}

function invalidReceipt(): VlmPaidEntitlementSessionWriteResult {
  return { ok: false, error: "entitlement_session_write_invalid_result", retryable: true, terminal: false, mode: "durable" };
}
export function parseVlmDurableSessionWrite(data: unknown, expected: VlmPaidEntitlementRecord): VlmPaidEntitlementSessionWriteResult {
  if (Array.isArray(data) && data.length !== 1) return invalidReceipt();
  const value: unknown = Array.isArray(data) ? data[0] : data;
  if (!object(value)) return invalidReceipt();
  if (value.ok === false) {
    if (typeof value.retryable !== "boolean" || typeof value.terminal !== "boolean"
        || (value.retryable && value.terminal) || typeof value.error !== "string"
        || !/^[a-z][a-z0-9_]{0,119}$/.test(value.error)) return invalidReceipt();
    // A refusal is not an authorization; do not attach an unverified optional row.
    return { ok: false, error: value.error, retryable: value.retryable, terminal: value.terminal, mode: "durable" };
  }
  if (value.ok !== true || typeof value.created !== "boolean" || typeof value.idempotent !== "boolean"
      || value.created === value.idempotent) return invalidReceipt();
  let record: VlmPaidEntitlementRecord;
  try {
    record = requireVlmEntitlementResponse(value, {
      id: expected.id, stripeSessionId: expected.stripeSessionId, productId: expected.productId,
      contextHash: expected.contextHash, authorizing: true,
    });
  } catch { return invalidReceipt(); }
  if (record.accessScope !== expected.accessScope || record.locale !== expected.locale
      || !sameVlmEntitlementContext(record.context, expected.context)
      || record.amountTotal !== expected.amountTotal || record.currency !== expected.currency
      || !sameOptional(record.stripeCustomerId, expected.stripeCustomerId)
      || record.paymentStatus !== expected.paymentStatus) return invalidReceipt();
  // A first write must acknowledge exactly the requested initial period and source.
  // A replay returns the pre-existing row: comparing against a new requested TTL
  // would reject legitimate retries. The SQL store remains replay authority.
  if (value.created && (record.source !== expected.source
      || !sameOptional(record.auditQueueId, expected.auditQueueId)
      || vlmEntitlementTimestamp(record.createdAt) !== vlmEntitlementTimestamp(expected.createdAt)
      || vlmEntitlementTimestamp(record.updatedAt) !== vlmEntitlementTimestamp(expected.updatedAt)
      || vlmEntitlementTimestamp(record.expiresAt) !== vlmEntitlementTimestamp(expected.expiresAt))) return invalidReceipt();
  return { ok: true, record, persisted: true, mode: "durable", created: value.created, idempotent: value.idempotent };
}
