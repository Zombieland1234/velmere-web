import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { after, test } from "node:test";
import {
  readVlmPaidEntitlementForOperations, findVlmPaidEntitlementByStripeBinding,
  verifyVlmPaidEntitlementById, verifyVlmPaidAccountEntitlement,
  verifyVlmPaidAccessEntitlement, upsertVlmPaidEntitlementFromDemoReceipt,
} from "../../lib/commerce/vlm-entitlement-ledger";
import { createVlmPaidAccessToken } from "../../lib/commerce/vlm-paid-access-server";
import { context, hash, now, owner, otherOwner, productId, receiptForArgs, row, session } from "./fixtures";

const originalFetch = globalThis.fetch;
const envKeys = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "VELMERE_REQUIRE_PAID_ENTITLEMENT_LEDGER", "VELMERE_PAID_ACCESS_SECRET"] as const;
const originalEnv = Object.fromEntries(envKeys.map(key => [key, process.env[key]]));
process.env.SUPABASE_URL = "https://q11-fixture.invalid";
process.env.SUPABASE_SERVICE_ROLE_KEY = "fixture-only-not-a-credential";
process.env.VELMERE_REQUIRE_PAID_ENTITLEMENT_LEDGER = "true";
process.env.VELMERE_PAID_ACCESS_SECRET = randomBytes(32).toString("hex");
let reply: unknown;
let editReceipt: ((value: Record<string, unknown>) => unknown) | null = null;
let requests = 0;
globalThis.fetch = async (input, init) => {
  const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
  assert.equal(url.hostname, "q11-fixture.invalid", "No external network is permitted by this fixture.");
  requests += 1;
  if (url.pathname.includes("/rpc/")) {
    assert.equal(url.pathname, "/rest/v1/rpc/velmere_create_or_read_vlm_paid_entitlement");
    assert.ok(editReceipt);
    reply = editReceipt(receiptForArgs(JSON.parse(String(init?.body)) as Record<string, unknown>));
  }
  return new Response(JSON.stringify(reply), { status: 200, headers: { "Content-Type": "application/json" } });
};
after(() => {
  globalThis.fetch = originalFetch;
  for (const key of envKeys) {
    const value = originalEnv[key];
    if (value === undefined) delete process.env[key]; else process.env[key] = value;
  }
});
const token = createVlmPaidAccessToken({ productId, context, sessionId: session, now });
assert.ok(token.ok);
const paths = {
  operations: () => readVlmPaidEntitlementForOperations("q11-fixture-grant"),
  stripeBinding: () => findVlmPaidEntitlementByStripeBinding({ stripeSessionId: session, productId, contextHash: hash }),
  byId: () => verifyVlmPaidEntitlementById({ entitlementId: "q11-fixture-grant", allowedProductIds: [productId], accountIdHash: owner, now }),
  account: () => verifyVlmPaidAccountEntitlement({ productId, context, now }),
  token: () => verifyVlmPaidAccessEntitlement({ productId, context, token: token.token, now }),
};
type PathName = keyof typeof paths;
function readCase(name: string, path: PathName, edit: (value: Record<string, unknown>) => unknown, accepted: boolean) {
  test(`${path}: ${name}`, async () => {
    editReceipt = null; reply = edit(row());
    const before = requests;
    const result = await paths[path]();
    assert.equal(requests, before + 1, "The real SDK path must make exactly one fixture request.");
    assert.equal(result.ok, accepted);
  });
}
for (const path of Object.keys(paths) as PathName[]) {
  readCase("matching record", path, value => value, true);
  readCase("absence is not a grant", path, () => null, false);
  readCase("numeric id is not coerced", path, value => ({ ...value, id: 123 }), false);
  readCase("unknown status is rejected", path, value => ({ ...value, status: "invented" }), false);
  readCase("wrong scope for product", path, value => ({ ...value, access_scope: "audit_pro_review" }), false);
  readCase("context content must match its hash", path, value => ({ ...value, context: { ...context, accountIdHash: otherOwner } }), false);
  readCase("invalid amount", path, value => ({ ...value, amount_total: "1000" }), false);
  readCase("invalid expiry", path, value => ({ ...value, expires_at: "2099" }), false);
  readCase("unknown source", path, value => ({ ...value, source: "request_body" }), false);
  readCase("terminal row is operational only", path, value => ({ ...value, status: "refunded", payment_status: "refunded" }), path === "operations" || path === "stripeBinding");
}
for (const path of ["operations", "byId"] as const) {
  readCase("different requested id", path, value => ({ ...value, id: "another-valid-grant" }), false);
}
for (const path of ["stripeBinding", "token"] as const) {
  readCase("different requested session", path, value => ({ ...value, stripe_session_id: "cs_test_other" }), false);
}
for (const path of ["stripeBinding", "token", "account", "byId"] as const) {
  readCase("another legitimate product", path, value => ({ ...value, product_id: "vlm_pro_pdf_single", access_scope: "vlm_pro_pdf" }), false);
}
for (const path of ["token", "account", "byId"] as const) {
  readCase("terminal payment cannot authorize an active row", path, value => ({ ...value, payment_status: "hold" }), false);
}
for (const [name, run] of [
  ["operations", () => readVlmPaidEntitlementForOperations("x".repeat(181))],
  ["byId", () => verifyVlmPaidEntitlementById({ entitlementId: "x".repeat(181), allowedProductIds: [productId], accountIdHash: owner, now })],
  ["stripeBinding", () => findVlmPaidEntitlementByStripeBinding({ stripeSessionId: "x".repeat(181), productId, contextHash: hash })],
] as const) test(`${name}: overlength input is rejected before query, not truncated`, async () => {
  editReceipt = null; reply = row(); const before = requests;
  assert.equal((await run()).ok, false); assert.equal(requests, before);
});

const receiptCases: [string, (value: Record<string, unknown>) => unknown, boolean][] = [
  ["matching first write", value => value, true],
  ["singleton result", value => [value], true],
  ["ambiguous result", value => [value, value], false],
  ["empty result", () => [], false],
  ["missing result", () => null, false],
  ["string created flag", value => ({ ...value, created: "false" }), false],
  ["string idempotent flag", value => ({ ...value, idempotent: "false" }), false],
  ["contradictory flags", value => ({ ...value, idempotent: true }), false],
  ["neither first nor replay", value => ({ ...value, created: false }), false],
  ["different id", value => ({ ...value, id: "other-grant" }), false],
  ["different session", value => ({ ...value, stripe_session_id: "vlm_demo_other" }), false],
  ["different product", value => ({ ...value, product_id: "vlm_pro_pdf_single", access_scope: "vlm_pro_pdf" }), false],
  ["different scope", value => ({ ...value, access_scope: "invalid-scope" }), false],
  ["different owner", value => ({ ...value, context: { ...context, accountIdHash: otherOwner } }), false],
  ["different amount", value => ({ ...value, amount_total: Number(value.amount_total) + 1 }), false],
  ["different currency", value => ({ ...value, currency: "USD" }), false],
  ["different customer", value => ({ ...value, stripe_customer_id: "cus_test_other" }), false],
  ["terminal success", value => ({ ...value, status: "refunded" }), false],
  ["first-write expiry changed", value => ({ ...value, expires_at: "2099-01-01T00:00:00.000Z" }), false],
  ["first-write source changed", value => ({ ...value, source: "manual_repair" }), false],
  ["first-write queue changed", value => ({ ...value, audit_queue_id: "other-queue" }), false],
  ["first-write timestamp timezone equivalent", value => ({ ...value, created_at: "2026-09-19T02:00:00.000+02:00", updated_at: "2026-09-19T02:00:00.000+02:00" }), true],
  ["replay retains original dates source and queue", value => ({ ...value, created: false, idempotent: true, created_at: "2026-09-01T00:00:00Z", updated_at: "2026-09-01T00:00:00Z", expires_at: "2026-10-01T00:00:00Z", source: "manual_repair", audit_queue_id: "original-queue" }), true],
  ["explicit binding-conflict refusal", () => ({ ok: false, error: "entitlement_binding_conflict", retryable: false, terminal: true }), false],
  ["explicit hold refusal", () => ({ ok: false, error: "entitlement_release_hold", retryable: false, terminal: true }), false],
];
for (const [name, edit, expected] of receiptCases) test(`write: ${name}`, async () => {
  editReceipt = edit; const before = requests;
  const result = await upsertVlmPaidEntitlementFromDemoReceipt({ sessionId: "vlm_demo_q11", productId, context, now });
  assert.equal(requests, before + 1);
  assert.equal(result.ok, expected);
  if (name.startsWith("replay") && result.ok) {
    assert.equal(result.created, false); assert.equal(result.record.expiresAt, "2026-10-01T00:00:00Z");
    assert.equal(result.record.source, "manual_repair"); assert.equal(result.record.auditQueueId, "original-queue");
  }
  if (name === "explicit hold refusal" && !result.ok) assert.equal(result.error, "entitlement_release_hold");
});
