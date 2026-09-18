import test from "node:test";
import assert from "node:assert/strict";
import { POST } from "../../lib/server/internal-worker-route-modules/commerce-fulfilment-outbox";
import {
  issueMarketIntegrityWorkerMutationEnvelope,
  marketIntegrityWorkerScopeForPath,
} from "../../lib/security/market-integrity-cron-auth";

const path = "/api/internal/workers/commerce-fulfilment-outbox";

async function signedRequest(body: Record<string, unknown>, nonce: string) {
  const raw = JSON.stringify(body);
  const scope = marketIntegrityWorkerScopeForPath(path);
  const envKey = `VELMERE_WORKER_${scope}_SECRET_CURRENT`;
  const secret = "c14-p01-worker-secret-current-32-bytes-minimum";
  process.env[envKey] = secret;
  const issued = issueMarketIntegrityWorkerMutationEnvelope({
    secret,
    keyId: "current",
    path,
    rawBody: raw,
    nonce,
  });
  return {
    envKey,
    request: new Request(`https://velmere.test${path}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...issued.headers,
      },
      body: raw,
    }),
  };
}

test("commerce fulfilment worker rejects invalid numeric types at the route boundary", async () => {
  const { envKey, request } = await signedRequest(
    { action: "drain", limit: "not-a-number" },
    "c14p01-invalid-limit-0001",
  );
  try {
    const response = await POST(request);
    assert.equal(response.status, 400);
    const body = await response.json() as { error?: string; field?: string };
    assert.equal(body.error, "worker_body_integer_invalid");
    assert.equal(body.field, "limit");
  } finally {
    delete process.env[envKey];
  }
});

test("commerce fulfilment worker rejects unknown body fields", async () => {
  const { envKey, request } = await signedRequest(
    { action: "drain", unexpectedControl: true },
    "c14p01-unknown-field-0002",
  );
  try {
    const response = await POST(request);
    assert.equal(response.status, 400);
    const body = await response.json() as { error?: string; fields?: string[] };
    assert.equal(body.error, "worker_body_unknown_fields");
    assert.deepEqual(body.fields, ["unexpectedControl"]);
  } finally {
    delete process.env[envKey];
  }
});
