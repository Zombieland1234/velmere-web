import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac, randomBytes } from "node:crypto";
import { verifyAdminSessionRequest } from "../../lib/admin/session-roles";

function check(payload: Record<string, unknown>, scope: "audit:read" | "audit:write", suffix = "") {
  const previous = process.env.VELMERE_ADMIN_SESSION_SECRET;
  const secret = randomBytes(32).toString("hex");
  process.env.VELMERE_ADMIN_SESSION_SECRET = secret;
  try {
    const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
    const signature = createHmac("sha256", secret).update(encoded).digest("base64url");
    return verifyAdminSessionRequest(new Request("https://example.invalid/admin", {
      headers: { "x-velmere-admin-session": `${encoded}.${signature}${suffix}` },
    }), scope);
  } finally {
    if (previous === undefined) delete process.env.VELMERE_ADMIN_SESSION_SECRET;
    else process.env.VELMERE_ADMIN_SESSION_SECRET = previous;
  }
}
function payload(overrides: Record<string, unknown> = {}) {
  return { schemaVersion: "velmere.admin-session.v1", actorId: "local-fixture-only",
    sessionId: "local-fixture-session", role: "viewer", scopes: ["audit:read"],
    issuedAt: Date.now() - 1000, expiresAt: Date.now() + 60_000, ...overrides };
}
test("integration: signed viewer cannot gain an operator scope", () => {
  const result = check(payload({ scopes: ["audit:read", "audit:write"] }), "audit:write");
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.response.status, 403);
});
test("integration: normal signed viewer retains its allowed scope", () => {
  assert.equal(check(payload(), "audit:read").ok, true);
});
test("integration: normal signed operator retains audit write", () => {
  assert.equal(check(payload({ role: "operator", scopes: ["audit:write"] }), "audit:write").ok, true);
});
test("integration: extra signature segment is rejected", () => {
  assert.equal(check(payload(), "audit:read", ".extra").ok, false);
});
for (const overrides of [
  { issuedAt: 0.5 }, { expiresAt: Number.MAX_SAFE_INTEGER + 1 },
  { issuedAt: Date.now() + 3600_000 }, { expiresAt: Date.now() - 1 },
  { role: "toString" }, { actorId: { not: "a string" } }, { scopes: "audit:write" },
]) {
  test(`integration: malformed signed claim ${Object.keys(overrides)[0]} ${JSON.stringify(overrides)} is refused`, () => {
    assert.equal(check(payload(overrides), "audit:read").ok, false);
  });
}
