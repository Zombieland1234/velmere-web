import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { resolveWorkspaceResponseAuthority } from "../../../supabase/functions/r7-shield-pro-paid-workspace-v1/response-authority.ts";
import { guardWorkspaceRequest } from "../../../supabase/functions/r7-shield-pro-paid-workspace-v1/request-boundary.ts";

const payload = (tier: "pro" | "advanced", locale: "pl" | "en" | "de") => ({
  schemaVersion: "fixture",
  tier,
  locale,
  assets: [],
});

test("stored tier and locale are authoritative over caller presentation", () => {
  const authority = resolveWorkspaceResponseAuthority({
    resolution: "RESOLVED",
    tier: "pro",
    locale: "en",
    payload: payload("pro", "en"),
  }, "READ");
  assert.deepEqual(authority, {
    tier: "pro",
    locale: "en",
    payload: payload("pro", "en"),
  });
});

test("advanced stored identity survives a lower request tier", () => {
  const authority = resolveWorkspaceResponseAuthority({
    resolution: "RESOLVED",
    tier: "advanced",
    locale: "de",
    payload: payload("advanced", "de"),
  }, "READ");
  assert.equal(authority?.tier, "advanced");
  assert.equal(authority?.locale, "de");
});

test("payload tier or locale mismatch fails closed", () => {
  assert.equal(resolveWorkspaceResponseAuthority({
    tier: "advanced",
    locale: "en",
    payload: payload("pro", "en"),
  }, "READ"), null);
  assert.equal(resolveWorkspaceResponseAuthority({
    tier: "pro",
    locale: "de",
    payload: payload("pro", "en"),
  }, "RESTORE"), null);
});

test("delete requires stored identity but never requires payload exposure", () => {
  assert.deepEqual(resolveWorkspaceResponseAuthority({
    resolution: "DELETED",
    tier: "advanced",
    locale: "pl",
  }, "DELETE"), { tier: "advanced", locale: "pl", payload: null });
  assert.equal(resolveWorkspaceResponseAuthority({
    resolution: "DELETED",
    locale: "pl",
  }, "DELETE"), null);
});

test("request boundary rejects malformed transport before handler", async () => {
  let calls = 0;
  const handler = async () => { calls += 1; return new Response("ok", { status: 200 }); };

  let response = await guardWorkspaceRequest(new Request("https://example.test/functions/v1/r7", {
    method: "GET",
  }), handler);
  assert.equal(response.status, 405);

  response = await guardWorkspaceRequest(new Request("https://example.test/functions/v1/r7", {
    method: "POST",
    headers: { "content-type": "text/plain" },
    body: "{}",
  }), handler);
  assert.equal(response.status, 415);

  response = await guardWorkspaceRequest(new Request("https://example.test/functions/v1/r7", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{",
  }), handler);
  assert.equal(response.status, 400);

  response = await guardWorkspaceRequest(new Request("https://example.test/functions/v1/r7", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "[]",
  }), handler);
  assert.equal(response.status, 400);

  response = await guardWorkspaceRequest(new Request("https://example.test/functions/v1/r7", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ schemaVersion: "x", tier: 1, locale: "en", operation: "READ" }),
  }), handler);
  assert.equal(response.status, 400);
  assert.equal(calls, 0);
});

test("valid bounded JSON reaches handler with exact parsed fields", async () => {
  let observed: unknown = null;
  const body = {
    schemaVersion: "velmere.r7.shield-pro-paid-workspace-request.v1",
    tier: "pro",
    locale: "en",
    operation: "READ",
    workspaceId: "00000000-0000-4000-8000-00000000002a",
  };
  const response = await guardWorkspaceRequest(new Request("https://example.test/functions/v1/r7", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  }), async (request) => {
    observed = await request.json();
    return new Response("ok", { status: 200 });
  });
  assert.equal(response.status, 200);
  assert.deepEqual(observed, body);
});

test("Edge source rejects CREATE workspaceId and uses resolved authority", async () => {
  const source = await readFile("supabase/functions/r7-shield-pro-paid-workspace-v1/index.ts", "utf8");
  assert.match(source, /operation==="CREATE"\)\&\&workspaceId!==null/);
  assert.match(source, /resolveWorkspaceResponseAuthority\(d,operation\)/);
  assert.match(source, /tier:responseTier,locale:responseLocale/);
  assert.match(source, /workspace_authority_invalid/);
  assert.match(source, /workspace_not_deleted/);
  assert.doesNotMatch(source, /copy\[locale as keyof typeof copy\]/);
});

test("deployment config requires platform JWT verification", async () => {
  const config = await readFile("supabase/config.toml", "utf8");
  assert.match(config, /\[functions\.r7-shield-pro-paid-workspace-v1\][\s\S]*verify_jwt\s*=\s*true/);
});
