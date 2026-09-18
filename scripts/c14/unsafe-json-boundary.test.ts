import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { verifyVlmPaidAccessToken } from "../../lib/commerce/vlm-paid-access-server";
import { verifyPass4657AuditPdfDownloadToken } from "../../lib/security/audit-pdf-download-token";
import { verifyAdminSessionRequest } from "../../lib/admin/session-roles";

function signedToken(payload: string, secret: string) {
  const encoded = Buffer.from(payload, "utf8").toString("base64url");
  const signature = createHmac("sha256", secret).update(encoded).digest("base64url");
  return `${encoded}.${signature}`;
}

test("paid access rejects signed non-object JSON without throwing", { concurrency: false }, () => {
  const previous = process.env.VELMERE_PAID_ACCESS_SECRET;
  const secret = "c14-paid-access-secret-".padEnd(64, "x");
  process.env.VELMERE_PAID_ACCESS_SECRET = secret;
  try {
    const result = verifyVlmPaidAccessToken({
      token: signedToken("null", secret),
      productId: "vlm_pro_analysis_single",
      context: {},
    });
    assert.deepEqual(result, { ok: false, error: "invalid_payload" });
  } finally {
    if (previous === undefined) delete process.env.VELMERE_PAID_ACCESS_SECRET;
    else process.env.VELMERE_PAID_ACCESS_SECRET = previous;
  }
});

test("audit PDF token rejects non-object JSON before payload field access", () => {
  const encoded = Buffer.from("null", "utf8").toString("base64url");
  const result = verifyPass4657AuditPdfDownloadToken({
    token: `vlm_pdf_${encoded}.invalid`,
    accountId: "acct-c14",
    entitlementId: "ent-c14",
    env: {
      VELMERE_AUDIT_PDF_TOKEN_SECRET_CURRENT: "c14-audit-pdf-secret-".padEnd(64, "x"),
      VELMERE_AUDIT_PDF_TOKEN_KEY_ID: "current",
    },
  });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.error, "audit_pdf_token_invalid");
});

test("admin session rejects correctly signed non-object JSON without throwing", { concurrency: false }, () => {
  const previous = process.env.VELMERE_ADMIN_SESSION_SECRET;
  const secret = "c14-admin-session-secret-".padEnd(64, "x");
  process.env.VELMERE_ADMIN_SESSION_SECRET = secret;
  try {
    const request = new Request("https://example.invalid/admin", {
      headers: { "x-velmere-admin-session": signedToken("null", secret) },
    });
    const result = verifyAdminSessionRequest(request, "audit:read");
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.status, "unauthorized");
  } finally {
    if (previous === undefined) delete process.env.VELMERE_ADMIN_SESSION_SECRET;
    else process.env.VELMERE_ADMIN_SESSION_SECRET = previous;
  }
});
