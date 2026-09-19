import assert from "node:assert/strict";
import { execFile, execFileSync } from "node:child_process";
import { promisify } from "node:util";
import { test } from "node:test";
import { parseVlmDurableSessionWrite, parseVlmEntitlementRecord, requireVlmEntitlementResponse } from "../../lib/commerce/vlm-entitlement-response";
import { row } from "../c15-q11/fixtures";
import type { VlmPaidEntitlementRecord } from "../../lib/commerce/vlm-entitlement-ledger";

// Explicitly not a PostgREST, GoTrue or Stripe TEST harness. Only a real, local,
// dedicated PostgreSQL database is permitted. Install the Q4-Q8 SQL first.
assert.equal(process.env.Q12_DISPOSABLE_ACK, "ISOLATED_TEST_ONLY");
assert.equal(process.env.PGHOST, "127.0.0.1");
assert.equal(process.env.PGDATABASE, "q12_response_fixture");
assert.equal(process.env.PGUSER, "postgres");
const env = { ...process.env, PGOPTIONS: "-c statement_timeout=15000 -c lock_timeout=10000" };
const cli = ["-X", "-qAt", "-v", "ON_ERROR_STOP=1"];
function sql(query: string, role = "service_role"): unknown {
  assert.ok(["service_role", "postgres", "anon", "authenticated"].includes(role));
  return JSON.parse(execFileSync("psql", cli, { input: `SET ROLE ${role};\n${query};\n`, env, encoding: "utf8", timeout: 20000 }));
}
function quote(value: unknown): string {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "number") { assert.ok(Number.isSafeInteger(value)); return String(value); }
  return "'" + (typeof value === "object" ? JSON.stringify(value) : String(value)).replaceAll("'", "''") + "'";
}
function expected(name: string): VlmPaidEntitlementRecord {
  const result = parseVlmEntitlementRecord({ ...row(), id: `q12_${name}`, stripe_session_id: `cs_test_q12_${name}` });
  assert.ok(result); return result;
}
function create(record: VlmPaidEntitlementRecord): string {
  const args = [record.id, record.stripeSessionId, record.stripeCustomerId, record.productId, record.accessScope,
    record.contextHash, record.context, record.locale, record.amountTotal, record.currency, record.customerEmail,
    record.customerName, record.paymentStatus, record.source, record.auditQueueId, record.expiresAt, record.createdAt];
  return `SELECT public.velmere_create_or_read_vlm_paid_entitlement(${args.map(quote).join(",")})`;
}
function read(id: string): unknown {
  return sql(`SELECT to_jsonb(e) FROM public.velmere_vlm_paid_entitlements e WHERE id=${quote(id)}`);
}
function hold(record: VlmPaidEntitlementRecord): unknown {
  return sql(`SELECT public.velmere_record_vlm_terminal_payment_hold(${[
    record.stripeSessionId, record.productId, record.contextHash, `evt_q12_${record.id}`, "refund", 1700000000,
  ].map(quote).join(",")})`);
}
const first = expected("first");
test("native PostgreSQL version and dedicated fixture", () => {
  assert.match(String(sql("SELECT to_jsonb(version())", "postgres")), /^PostgreSQL 17\./);
  assert.equal(sql("SELECT to_jsonb(count(*)) FROM public.velmere_vlm_paid_entitlements", "postgres"), 0);
});
test("actual first SQL receipt is accepted and a matching record exists", () => {
  const result = parseVlmDurableSessionWrite(sql(create(first)), first);
  assert.ok(result.ok); assert.equal(result.created, true);
  assert.equal(requireVlmEntitlementResponse(read(first.id), { id: first.id, authorizing: true }).id, first.id);
});
test("actual replay keeps the original expiry, creation, source and queue", () => {
  const later = { ...first, source: "manual_repair" as const, auditQueueId: "new-queue-must-not-be-written", createdAt: "2026-09-19T00:00:00Z", updatedAt: "2026-09-19T00:00:00Z", expiresAt: "2027-01-01T00:00:00Z" };
  const result = parseVlmDurableSessionWrite(sql(create(later)), later);
  assert.ok(result.ok); assert.equal(result.idempotent, true);
  assert.equal(Date.parse(result.record.expiresAt), Date.parse(first.expiresAt));
  assert.equal(result.record.source, first.source); assert.equal(result.record.auditQueueId, first.auditQueueId);
});
test("actual session binding conflict remains a terminal refusal", () => {
  const different = { ...first, id: "q12_wrong_id" };
  const result = parseVlmDurableSessionWrite(sql(create(different)), different);
  assert.equal(result.ok, false);
  if (!result.ok) { assert.equal(result.error, "entitlement_binding_conflict"); assert.equal(result.terminal, true); assert.equal(result.retryable, false); }
});
const uncertain = expected("uncertain");
test("rejecting a committed receipt does not claim to roll back SQL", () => {
  const committed = sql(create(uncertain));
  const result = parseVlmDurableSessionWrite(committed, { ...uncertain, id: "different_requested_grant" });
  assert.equal(result.ok, false);
  assert.equal(requireVlmEntitlementResponse(read(uncertain.id), { id: uncertain.id }).id, uncertain.id);
});
test("correct retry after rejected receipt returns the original row", () => {
  const result = parseVlmDurableSessionWrite(sql(create(uncertain)), uncertain);
  assert.ok(result.ok); assert.equal(result.created, false); assert.equal(result.idempotent, true);
});
test("actual terminal hold before grant prevents creation", () => {
  const record = expected("prehold"); hold(record);
  const result = parseVlmDurableSessionWrite(sql(create(record)), record);
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.error, "entitlement_release_hold");
  assert.equal(sql(`SELECT to_jsonb(count(*)) FROM public.velmere_vlm_paid_entitlements WHERE id=${quote(record.id)}`), 0);
});
test("terminal stored row can be read operationally, never as active authority", () => {
  hold(first); const terminal = read(first.id);
  const record = requireVlmEntitlementResponse(terminal, { id: first.id });
  assert.equal(record.status, "refunded");
  assert.throws(() => requireVlmEntitlementResponse(terminal, { id: first.id, authorizing: true }), /binding_invalid/);
});
test("actual PostgreSQL timezone representation compares by instant", () => {
  const record = expected("timezone");
  const data = sql(`SET TIME ZONE 'Europe/Berlin'; ${create(record)}`);
  const result = parseVlmDurableSessionWrite(data, record);
  assert.ok(result.ok); assert.match(result.record.createdAt, /\+02:00$/);
  assert.equal(Date.parse(result.record.createdAt), Date.parse(record.createdAt));
});
test("twelve real clients create once and all original receipts validate", async () => {
  const record = expected("race");
  const run = promisify(execFile);
  const results = await Promise.all(Array.from({ length: 12 }, async () => {
    const { stdout } = await run("psql", [...cli, "-c", `SET ROLE service_role; ${create(record)};`], { env, timeout: 20000 });
    return parseVlmDurableSessionWrite(JSON.parse(stdout), record);
  }));
  assert.equal(results.filter(result => result.ok && result.created).length, 1);
  assert.equal(results.filter(result => result.ok && result.idempotent).length, 11);
  assert.ok(results.every(result => result.ok));
  assert.equal(sql(`SELECT to_jsonb(count(*)) FROM public.velmere_vlm_paid_entitlements WHERE id=${quote(record.id)}`), 1);
});
test("database permits the JS safe-integer boundary without string coercion", () => {
  const record = { ...expected("safe_integer"), amountTotal: Number.MAX_SAFE_INTEGER };
  const result = parseVlmDurableSessionWrite(sql(create(record)), record);
  assert.ok(result.ok); assert.equal(result.record.amountTotal, Number.MAX_SAFE_INTEGER);
});
test("SQL reads for another valid id cannot satisfy the requested grant", () => {
  const wrong = read(uncertain.id);
  assert.throws(() => requireVlmEntitlementResponse(wrong, { id: first.id }), /binding_invalid/);
});
