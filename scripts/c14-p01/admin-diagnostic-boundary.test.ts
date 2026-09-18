import test from "node:test";
import assert from "node:assert/strict";
import { GET } from "../../lib/server/admin-route-modules/audit-events";

test("unauthenticated admin diagnostic never exposes operator identity, role or scopes", async () => {
  const saved = {
    ADMIN_AUTH_CONTEXT_READY: process.env.ADMIN_AUTH_CONTEXT_READY,
    ADMIN_OPERATOR_ID: process.env.ADMIN_OPERATOR_ID,
    ADMIN_ROLE_PREVIEW: process.env.ADMIN_ROLE_PREVIEW,
    ADMIN_PERMISSION_SCOPES: process.env.ADMIN_PERMISSION_SCOPES,
    ADMIN_SESSION_FRESH: process.env.ADMIN_SESSION_FRESH,
  };
  process.env.ADMIN_AUTH_CONTEXT_READY = "true";
  process.env.ADMIN_OPERATOR_ID = "operator:sensitive-c14p01-internal";
  process.env.ADMIN_ROLE_PREVIEW = "admin";
  process.env.ADMIN_PERMISSION_SCOPES = "product:active_publish,support:export,audit:write";
  process.env.ADMIN_SESSION_FRESH = "true";

  try {
    const response = await GET();
    const raw = await response.text();

    assert.equal(response.status, 423);
    assert.doesNotMatch(raw, /sensitive-c14p01-internal/i);
    assert.doesNotMatch(raw, /product:active_publish|support:export/i);
    assert.doesNotMatch(raw, /"role"\s*:\s*"admin"/i);
    assert.doesNotMatch(raw, /"authenticated"\s*:\s*true/i);
  } finally {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});
