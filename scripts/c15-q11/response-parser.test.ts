import assert from "node:assert/strict";
import { test } from "node:test";
import { isVlmEntitlementAuthorizing, parseVlmDurableSessionWrite, parseVlmEntitlementRecord, vlmEntitlementTimestamp } from "../../lib/commerce/vlm-entitlement-response";
import { context, row } from "./fixtures";

const invalidRecords: [string, unknown][] = [
  ["missing record", null], ["array instead of row", [row()]],
  ["empty id", { ...row(), id: "" }], ["trimmed id alias", { ...row(), id: " other " }],
  ["overlength id", { ...row(), id: "x".repeat(181) }], ["control in id", { ...row(), id: "x\u0000y" }],
  ["C1 control in id", { ...row(), id: "x\u0085y" }], ["numeric session", { ...row(), stripe_session_id: 7 }],
  ["unknown product", { ...row(), product_id: "other" }], ["null context", { ...row(), context: null }],
  ["array context", { ...row(), context: [] }], ["unknown context key", { ...row(), context: { ...context, authority: "admin" } }],
  ["unknown locale", { ...row(), locale: "xx", context: { ...context, locale: "xx" } }],
  ["column/context locale mismatch", { ...row(), locale: "de" }],
  ["context value would truncate", { ...row(), context: { ...context, assetId: "x".repeat(97) } }],
  ["context value would trim", { ...row(), context: { ...context, assetId: " fixture-asset " } }],
  ["invalid depth", { ...row(), context: { ...context, depth: "owner" } }],
  ["invalid owner hash", { ...row(), context: { ...context, accountIdHash: "owner" } }],
  ["uppercase context hash", { ...row(), context_hash: String(row().context_hash).toUpperCase() }],
  ["negative amount", { ...row(), amount_total: -1 }], ["fractional amount", { ...row(), amount_total: 1.5 }],
  ["unsafe amount", { ...row(), amount_total: Number.MAX_SAFE_INTEGER + 1 }],
  ["infinite amount", { ...row(), amount_total: Infinity }], ["null amount", { ...row(), amount_total: null }],
  ["lowercase currency", { ...row(), currency: "eur" }], ["overlength currency", { ...row(), currency: "EURO" }],
  ["numeric customer", { ...row(), stripe_customer_id: 1 }], ["object queue", { ...row(), audit_queue_id: {} }],
  ["overlength email", { ...row(), customer_email: "x".repeat(321) }], ["overlength name", { ...row(), customer_name: "x".repeat(501) }],
  ["missing payment status", { ...row(), payment_status: null }],
  ["updated before created", { ...row(), updated_at: "2026-01-01T00:00:00Z" }],
  ["expiry equals creation", { ...row(), expires_at: row().created_at }],
];
for (const [name, value] of invalidRecords) test(`record: ${name}`, () => assert.equal(parseVlmEntitlementRecord(value), null));
for (const [name, value] of [
  ["standard UTC", "2026-09-19T00:00:00Z"], ["offset", "2026-09-19T02:00:00+02:00"],
  ["SQL microseconds", "2026-09-19T00:00:00.000000+00:00"], ["SQL space", "2026-09-19 00:00:00+00:00"],
] as const) test(`timestamp: ${name}`, () => assert.equal(vlmEntitlementTimestamp(value), Date.parse("2026-09-19T00:00:00Z")));
for (const value of ["infinity", "2026", "2026-09-19", "2026-09-19T00:00:00", "2026-02-29T00:00:00Z", "2026-04-31T00:00:00Z", "2026-09-19T24:00:00Z", "2026-09-19T00:00:00+16:00", "2026-09-19T00:00:00.1234567Z"]) {
  test(`timestamp: reject ${value}`, () => assert.equal(vlmEntitlementTimestamp(value), null));
}
test("timestamp comparison explicitly has millisecond precision", () => {
  assert.equal(vlmEntitlementTimestamp("2026-09-19T00:00:00.000001Z"), vlmEntitlementTimestamp("2026-09-19T00:00:00.000002Z"));
});
for (const paymentStatus of ["hold", "refunded", "pending", "unpaid", "unknown", "no_payment_required"]) test(`active status does not override ${paymentStatus} payment`, () => {
  const record = parseVlmEntitlementRecord({ ...row(), payment_status: paymentStatus });
  assert.ok(record); assert.equal(isVlmEntitlementAuthorizing(record), false);
});
const expected = parseVlmEntitlementRecord(row());
assert.ok(expected);
for (const [name, value] of [
  ["coerced retryable", { ok: false, retryable: "false", terminal: true, error: "entitlement_release_hold" }],
  ["coerced terminal", { ok: false, retryable: false, terminal: "true", error: "entitlement_release_hold" }],
  ["contradictory refusal", { ok: false, retryable: true, terminal: true, error: "entitlement_release_hold" }],
  ["missing ok", { retryable: false, terminal: true, error: "entitlement_release_hold" }],
  ["unbounded error", { ok: false, retryable: false, terminal: true, error: "x".repeat(121) }],
] as const) test(`receipt: ${name}`, () => {
  const result = parseVlmDurableSessionWrite(value, expected);
  assert.equal(result.ok, false);
  if (!result.ok) { assert.equal(result.error, "entitlement_session_write_invalid_result"); assert.equal(result.retryable, true); assert.equal(result.terminal, false); }
});
test("failure response never attaches an unverified entitlement", () => {
  const result = parseVlmDurableSessionWrite({ ...row(), id: "other", ok: false, retryable: false, terminal: true, error: "entitlement_release_hold" }, expected);
  assert.equal(result.ok, false); if (!result.ok) assert.equal(result.record, undefined);
});
test("all null optional fields and zero monetary amount retain exact types", () => {
  const record = parseVlmEntitlementRecord({ ...row(), amount_total: 0 });
  assert.ok(record); assert.equal(record.amountTotal, 0); assert.equal(record.stripeCustomerId, null);
});
