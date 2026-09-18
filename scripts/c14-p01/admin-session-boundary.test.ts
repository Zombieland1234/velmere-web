import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { verifyAdminSessionRequest } from "../../lib/admin/session-roles";

function signedToken(payload: Record<string, unknown>, secret: string) {
  const payload64 = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const signature = createHmac("sha256", secret).update(payload64).digest("base64url");
  return `${payload64}.${signature}`;
}

test("admin verifier rejects a correctly signed session issued in the future", async () => {
  const previous = process.env.VELMERE_ADMIN_SESSION_SECRET;
  const secret = "c14-p01-admin-session-secret-32-bytes-minimum";
  process.env.VELMERE_ADMIN_SESSION_SECRET = secret;
  const now = Date.now();
  const token = signedToken({
    schemaVersion: "velmere.admin-session.v1",
    actorId: "future-operator",
    role: "viewer",
    scopes: ["audit:read"],
    issuedAt: now + 60 * 60 * 1000,
    expiresAt: now + 2 * 60 * 60 * 1000,
    sessionId: "adm_future_c14p01",
  }, secret);

  try {
    const verdict = verifyAdminSessionRequest(
      new Request("https://velmere.test/api/admin/audit-events", {
        headers: { authorization: `Bearer ${token}` },
      }),
      "audit:read",
    );
    assert.equal(verdict.ok, false);
    if (verdict.ok) return;
    assert.equal(verdict.response.status, 401);
    const body = await verdict.response.json() as { code?: string };
    assert.equal(body.code, "admin_session_required");
  } finally {
    if (previous === undefined) delete process.env.VELMERE_ADMIN_SESSION_SECRET;
    else process.env.VELMERE_ADMIN_SESSION_SECRET = previous;
  }
});

test("admin verifier rejects invalid timestamp ordering even with a valid signature", () => {
  const previous = process.env.VELMERE_ADMIN_SESSION_SECRET;
  const secret = "c14-p01-admin-session-secret-32-bytes-minimum";
  process.env.VELMERE_ADMIN_SESSION_SECRET = secret;
  const now = Date.now();
  const token = signedToken({
    schemaVersion: "velmere.admin-session.v1",
    actorId: "invalid-order-operator",
    role: "viewer",
    scopes: ["audit:read"],
    issuedAt: now + 10_000,
    expiresAt: now,
    sessionId: "adm_invalid_order_c14p01",
  }, secret);
  try {
    const verdict = verifyAdminSessionRequest(
      new Request("https://velmere.test/api/admin/audit-events", {
        headers: { authorization: `Bearer ${token}` },
      }),
      "audit:read",
    );
    assert.equal(verdict.ok, false);
  } finally {
    if (previous === undefined) delete process.env.VELMERE_ADMIN_SESSION_SECRET;
    else process.env.VELMERE_ADMIN_SESSION_SECRET = previous;
  }
});
