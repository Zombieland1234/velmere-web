/** C14-P20 product reality E2E.
 * Runs the built production Next server behind the same signed loopback proxy
 * boundary used by C12. Blocked/withheld products are observations, not PASS
 * credit for a positive customer path.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import http from "node:http";
import { spawn } from "node:child_process";
import { createHmac, randomBytes } from "node:crypto";

const out = process.argv[2] || "/tmp/c14-p20";
fs.mkdirSync(out, { recursive: true });
const work = fs.mkdtempSync(path.join(os.tmpdir(), "velmere-c14-p20-"));
const rows = [];
const children = [];
const redisPassword = randomBytes(32).toString("hex");
const proxySecret = randomBytes(32).toString("hex");
const fingerprintSecret = randomBytes(32).toString("hex");
const redisPort = 16381;
const appPort = 3110;
const proxyPort = 3210;
const audience = "c14-p20-loopback";
const redisConfig = path.join(work, "redis.conf");
fs.writeFileSync(redisConfig, [
  "bind 127.0.0.1",
  "port " + redisPort,
  "protected-mode yes",
  "requirepass " + redisPassword,
  "dir " + work,
  "appendonly no",
  'save ""',
  "",
].join("\n"), { mode: 0o600 });

const env = {
  ...process.env,
  NODE_ENV: "production",
  VERCEL: "0",
  VERCEL_ENV: "",
  NEXT_TELEMETRY_DISABLED: "1",
  VELMERE_TRUSTED_PROXY_PROFILE: "signed_proxy",
  VELMERE_PROXY_HMAC_SECRET: proxySecret,
  VELMERE_PROXY_HMAC_AUDIENCE: audience,
  VELMERE_SECURITY_FINGERPRINT_SECRET: fingerprintSecret,
  VELMERE_RATE_LIMIT_BACKEND: "redis",
  REDIS_URL: "redis://:" + redisPassword + "@127.0.0.1:" + redisPort + "/0",
  VELMERE_CANONICAL_ORIGIN: "http://localhost:" + proxyPort,
  VELMERE_ALLOWED_ORIGINS: "http://localhost:" + appPort,
  VELMERE_LOOPBACK_HTTP_BROWSER_PROOF: "true",
};
delete env.VELMERE_RATE_LIMIT_DISABLED;
delete env.UPSTASH_REDIS_REST_URL;
delete env.UPSTASH_REDIS_REST_TOKEN;

function launch(name, cmd, args) {
  const fd = fs.openSync(path.join(out, name + ".log"), "w");
  const child = spawn(cmd, args, { env, stdio: ["ignore", fd, fd] });
  fs.closeSync(fd);
  children.push(child);
  return child;
}
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function stop(child) {
  if (!child || child.exitCode !== null) return;
  child.kill("SIGTERM");
  await Promise.race([new Promise((resolve) => child.once("exit", resolve)), sleep(2500)]);
  if (child.exitCode === null) child.kill("SIGKILL");
}
async function ready() {
  for (let i = 0; i < 100; i += 1) {
    try {
      const response = await fetch("http://localhost:" + proxyPort + "/en", { signal: AbortSignal.timeout(1500) });
      await response.body?.cancel();
      if (response.status < 500) return;
    } catch {}
    await sleep(300);
  }
  throw new Error("c14_product_server_not_ready");
}
function persist() {
  fs.writeFileSync(path.join(out, "PRODUCT_E2E_RESULTS.json"), JSON.stringify({
    sourceSha: process.env.GITHUB_SHA || null,
    scope: "PRODUCTION_NEXT_EPHEMERAL_REDIS_SIGNED_PROXY_PRODUCT_REALITY_NOT_HOSTED_VERCEL_NOT_STRIPE",
    rows,
  }, null, 2));
}
async function record(id, fn) {
  const row = { id, startedAt: new Date().toISOString() };
  try {
    Object.assign(row, await fn());
    row.result = "PASS";
  } catch (error) {
    row.result = "FAIL";
    row.error = String(error instanceof Error ? error.message : error).slice(0, 900);
  }
  row.finishedAt = new Date().toISOString();
  rows.push(row);
  persist();
  console.log(id, row.result, row.classification || "");
}
function assert(condition, message) {
  if (!condition) throw new Error(message);
}
async function request(route, options = {}) {
  const response = await fetch("http://localhost:" + proxyPort + route, {
    redirect: "manual",
    signal: AbortSignal.timeout(20000),
    ...options,
  });
  const type = response.headers.get("content-type") || "";
  let body = null;
  if (type.includes("application/json")) body = await response.json();
  else body = await response.text();
  return { response, body };
}
function safeBlocked(payload) {
  return payload && typeof payload === "object"
    && payload.liveClaimed !== true
    && payload.numericVerdictPublished !== true;
}
function readC12() {
  const p = path.join(out, "c12", "RESULTS.json");
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

let redis;
let app;
let proxy;
try {
  redis = launch("redis", "redis-server", [redisConfig]);
  await sleep(650);
  app = launch("next", "node", ["node_modules/next/dist/bin/next", "start", "--hostname", "localhost", "--port", String(appPort)]);

  proxy = http.createServer((req, res) => {
    const headers = { ...req.headers };
    for (const key of Object.keys(headers)) {
      if (key.startsWith("x-velmere-proxy-") || [
        "x-forwarded-for", "x-real-ip", "x-vercel-forwarded-for", "x-forwarded-host", "x-forwarded-proto",
      ].includes(key)) delete headers[key];
    }
    const address = req.socket.remoteAddress || "";
    const timestamp = String(Date.now());
    headers["x-velmere-proxy-address"] = address;
    headers["x-velmere-proxy-time"] = timestamp;
    headers["x-velmere-proxy-signature"] = createHmac("sha256", Buffer.from(proxySecret, "hex"))
      .update("velmere-proxy-address-v1\n" + audience + "\n" + timestamp + "\n" + address)
      .digest("hex");
    headers.host = "localhost:" + appPort;
    const next = http.request({
      hostname: "localhost",
      port: appPort,
      path: req.url,
      method: req.method,
      headers,
    }, (upstream) => {
      res.writeHead(upstream.statusCode || 502, upstream.headers);
      upstream.pipe(res);
    });
    next.on("error", () => {
      if (!res.headersSent) res.writeHead(502, { "content-type": "application/json" });
      res.end('{"error":"c14_proxy_upstream_unavailable"}');
    });
    req.pipe(next);
    res.on("close", () => next.destroy());
  });
  await new Promise((resolve) => proxy.listen(proxyPort, "localhost", resolve));
  await ready();

  for (const route of ["/en/shield", "/en/shield-pro", "/en/shield-map", "/en/real-markets"]) {
    await record("page-shell:" + route, async () => {
      const { response, body } = await request(route);
      assert(response.status === 200, "page_http_" + response.status);
      assert(typeof body === "string" && body.length > 500, "page_body_missing");
      return { http: response.status, classification: "UI_SHELL_IMPLEMENTED_NOT_PRODUCT_E2E" };
    });
  }

  await record("shield-basic-production-dev-flags-cannot-bypass-rights", async () => {
    const { response, body } = await request("/api/market-integrity/markets?page=1&perPage=100&tier=basic&live=true", {
      headers: { "x-velmere-dev": "true", "x-velmere-live": "true" },
    });
    assert(response.status !== 200, "production_dev_flag_returned_customer_data");
    assert(safeBlocked(body), "unsafe_shield_blocked_payload");
    return { http: response.status, classification: "PASS_FAIL_CLOSED", mode: body?.mode || body?.availability || body?.error || null };
  });

  for (const tier of ["pro", "advanced"]) {
    await record("shield-batch-" + tier + "-requires-paid-single-asset-path", async () => {
      const { response, body } = await request("/api/market-integrity/markets?page=1&perPage=100&tier=" + tier);
      assert(response.status === 402, "shield_paid_batch_http_" + response.status);
      return { http: response.status, classification: "AUTH_OR_ENTITLEMENT_BLOCKED", error: body?.error || null };
    });
  }

  await record("market-intelligence-basic-x-pro-cannot-bypass-publication", async () => {
    const { response, body } = await request("/api/market-integrity/market-intelligence", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "origin": "http://localhost:" + proxyPort,
        "x-velmere-pro": "true",
      },
      body: JSON.stringify({ assetKey: "BTC", depth: "basic", locale: "en", surface: "shield", evidenceMode: "server_owned" }),
    });
    assert(response.status !== 200, "x_velmere_pro_bypassed_customer_publication");
    assert(safeBlocked(body), "market_intelligence_blocked_payload_claimed_live");
    return { http: response.status, classification: "PASS_FAIL_CLOSED", error: body?.error || null };
  });

  await record("market-impact-orderbook-legacy-authorized-cannot-bypass-rights", async () => {
    const { response, body } = await request("/api/market-integrity/orderbook?symbol=BTCUSDT&authorized=true", {
      headers: { "x-velmere-pro": "true" },
    });
    assert(response.status === 424, "orderbook_legacy_bypass_http_" + response.status);
    assert(body?.error === "NO_USABLE_ORDER_BOOK" && body?.liveClaimed === false, "orderbook_not_fail_closed");
    return { http: response.status, classification: "PASS_FAIL_CLOSED", error: body.error };
  });

  await record("market-impact-liquidity-legacy-authorized-cannot-bypass-rights", async () => {
    const { response, body } = await request("/api/market-integrity/liquidity-intelligence?query=BTC&authorized=true", {
      headers: { "x-velmere-pro": "true" },
    });
    assert(response.status === 424, "liquidity_legacy_bypass_http_" + response.status);
    assert(body?.error === "NO_USABLE_ORDER_BOOK" && body?.liveClaimed === false, "liquidity_not_fail_closed");
    return { http: response.status, classification: "PASS_FAIL_CLOSED", error: body.error };
  });

  await record("shield-map-production-dev-flag-cannot-bypass-rights", async () => {
    const { response, body } = await request("/api/market-integrity/investigator?query=BTC&locale=en", {
      headers: { "x-velmere-dev": "true" },
    });
    assert(response.status === 503, "shield_map_dev_bypass_http_" + response.status);
    assert(safeBlocked(body), "shield_map_blocked_payload_claimed_live");
    return { http: response.status, classification: "PASS_FAIL_CLOSED", error: body?.error || body?.availability || null };
  });

  await record("whale-watch-current-customer-state", async () => {
    const { response, body } = await request("/api/whale-watch?assetKey=BTC&locale=en");
    assert(response.status === 424, "whale_watch_http_" + response.status);
    assert(body?.availability === "WITHHELD" && body?.numbersPublished === false && body?.liveClaimed === false, "whale_watch_truth_boundary");
    return { http: response.status, classification: "PASS_FAIL_CLOSED", blockers: body.blockers || [] };
  });

  await record("angel-deterministic-smalltalk-positive", async () => {
    const { response, body } = await request("/api/angel", {
      method: "POST",
      headers: { "content-type": "application/json", "origin": "http://localhost:" + proxyPort },
      body: JSON.stringify({ message: "hello", locale: "en", history: [] }),
    });
    assert(response.status === 200, "angel_smalltalk_http_" + response.status);
    assert(body?.providerMode === "deterministic_smalltalk" && typeof body?.reply === "string" && body.reply.length > 0, "angel_smalltalk_not_positive");
    return { http: response.status, classification: "PASS_POSITIVE_LIMITED", providerMode: body.providerMode };
  });

  await record("angel-stream-deterministic-positive", async () => {
    const { response, body } = await request("/api/angel/stream", {
      method: "POST",
      headers: { "content-type": "application/json", "origin": "http://localhost:" + proxyPort },
      body: JSON.stringify({ message: "hello", locale: "en", history: [] }),
    });
    assert(response.status === 200, "angel_stream_http_" + response.status);
    assert(typeof body === "string" && body.includes("event: done") && body.includes("deterministic_smalltalk"), "angel_stream_missing_done");
    return { http: response.status, classification: "PASS_POSITIVE_LIMITED", protocol: response.headers.get("x-velmere-stream-protocol") };
  });

  await record("real-markets-basic-current-customer-state", async () => {
    const { response, body } = await request("/api/market-integrity/real-markets?symbols=AAPL&tier=Basic&detail=1");
    assert([200, 503].includes(response.status), "real_markets_basic_http_" + response.status);
    if (response.status !== 200) assert(safeBlocked(body), "real_markets_blocked_payload_claimed_live");
    return {
      http: response.status,
      classification: response.status === 200 ? "PASS_POSITIVE_PROVIDER_DEPENDENT" : "PASS_FAIL_CLOSED_RIGHTS",
      mode: body?.mode || body?.availability || body?.error || null,
    };
  });

  for (const tier of ["Pro", "Advanced"]) {
    await record("real-markets-" + tier.toLowerCase() + "-anonymous-not-positive", async () => {
      const { response, body } = await request("/api/market-integrity/real-markets?symbols=AAPL&tier=" + tier + "&detail=1");
      assert(response.status === 402 || response.status === 503, "real_markets_paid_http_" + response.status);
      return { http: response.status, classification: response.status === 402 ? "AUTH_OR_ENTITLEMENT_BLOCKED" : "RIGHTS_BLOCKED_BEFORE_ENTITLEMENT", error: body?.error || null };
    });
  }

  await record("real-markets-ecb-reference-only-observation", async () => {
    const { response, body } = await request("/api/market-integrity/real-markets?symbols=EURUSD%3DX&referenceFx=1&tier=Basic");
    assert(response.status === 200 || response.status === 503, "ecb_reference_http_" + response.status);
    if (response.status === 200) {
      assert(body?.referenceOnly === true && body?.executableQuote === false && body?.paidValueEligible === false, "ecb_reference_boundary");
    }
    return { http: response.status, classification: response.status === 200 ? "PASS_REFERENCE_ONLY_NOT_PRODUCT_QUOTE" : "PROVIDER_REFERENCE_UNAVAILABLE", mode: body?.mode || null };
  });

  const auditTarget = "0xdac17f958d2ee523a2206206994597c13d831ec7";
  for (const tier of ["pro", "advanced"]) {
    await record("browser-" + tier + "-anonymous-not-positive", async () => {
      const { response, body } = await request("/en/security/audits/report/" + auditTarget + "?chainId=1&analysisMode=runtime&tier=" + tier);
      assert(response.status === 404 || response.status === 200, "browser_paid_unauthorized_http_" + response.status);
      assert(typeof body === "string", "browser_paid_response_not_html");
      assert(!body.includes("audit-canonical-view"), "browser_paid_report_rendered_without_entitlement");
      assert(!body.includes("STATIC_ANALYSIS_COMPLETED"), "browser_paid_runtime_analysis_leaked_without_entitlement");
      return {
        http: response.status,
        classification: response.status === 404 ? "AUTH_OR_ENTITLEMENT_BLOCKED" : "AUTH_BLOCKED_STREAMED_NOT_FOUND_HTTP_200",
        canonicalReportRendered: false,
      };
    });
  }

  await record("risk-indicator-standalone-entrypoint-observation", async () => {
    const api = fs.existsSync("app/api/risk-indicator/route.ts");
    const page = fs.existsSync("app/[locale]/risk-indicator/page.tsx");
    assert(!api && !page, "risk_indicator_entrypoint_appeared_update_matrix");
    return { classification: "NO_CUSTOMER_ENTRYPOINT", api, page };
  });

  const c12 = readC12();
  const c12Rows = new Map((c12?.rows || []).map((row) => [row.id, row]));
  const byId = new Map(rows.map((row) => [row.id, row]));
  const matrix = [
    ["audit-basic", "basic", "IMPLEMENTED_POSITIVE_E2E", ["production-basic-json-worker-public-rpc", "production-basic-pdf-worker-public-rpc"]],
    ["audit-pro", "pro", "IMPLEMENTED_GATED_NO_POSITIVE_E2E", ["production-anonymous-pro-json-still-denied"]],
    ["audit-advanced", "advanced", "IMPLEMENTED_GATED_NOT_FOR_SALE", ["production-anonymous-advanced-pdf-still-denied"]],
    ["browser-basic", "basic", "IMPLEMENTED_POSITIVE_E2E", ["production-runtime-ssr-desktop", "production-runtime-ssr-mobile"]],
    ["browser-pro", "pro", "IMPLEMENTED_GATED_NO_POSITIVE_E2E", ["browser-pro-anonymous-not-positive"]],
    ["browser-advanced", "advanced", "IMPLEMENTED_GATED_NO_POSITIVE_E2E", ["browser-advanced-anonymous-not-positive"]],
    ["shield-basic", "basic", "IMPLEMENTED_FAIL_CLOSED_CURRENTLY", ["shield-basic-production-dev-flags-cannot-bypass-rights", "market-intelligence-basic-x-pro-cannot-bypass-publication"]],
    ["shield-pro", "pro", "IMPLEMENTED_GATED_NO_POSITIVE_E2E", ["shield-batch-pro-requires-paid-single-asset-path"]],
    ["shield-advanced", "advanced", "IMPLEMENTED_GATED_NO_POSITIVE_E2E", ["shield-batch-advanced-requires-paid-single-asset-path"]],
    ["shield-pro-basic", "basic", "UI_AND_SERVER_PATH_PRESENT_NO_POSITIVE_PAID_VALUE_E2E", ["page-shell:/en/shield-pro"]],
    ["shield-pro-pro", "pro", "SERVER_ENTITLEMENT_PATH_PRESENT_NO_POSITIVE_E2E", ["page-shell:/en/shield-pro"]],
    ["shield-pro-advanced", "advanced", "SERVER_ENTITLEMENT_PATH_PRESENT_NO_POSITIVE_E2E", ["page-shell:/en/shield-pro"]],
    ["real-markets-basic", "basic", "IMPLEMENTED_PROVIDER_OR_RIGHTS_DEPENDENT", ["real-markets-basic-current-customer-state", "real-markets-ecb-reference-only-observation"]],
    ["real-markets-pro", "pro", "IMPLEMENTED_GATED_NO_POSITIVE_E2E", ["real-markets-pro-anonymous-not-positive"]],
    ["real-markets-advanced", "advanced", "IMPLEMENTED_GATED_NO_POSITIVE_E2E", ["real-markets-advanced-anonymous-not-positive"]],
    ["shield-map", null, "IMPLEMENTED_FAIL_CLOSED_CURRENTLY", ["page-shell:/en/shield-map", "shield-map-production-dev-flag-cannot-bypass-rights"]],
    ["market-impact", null, "ENGINE_PRESENT_CUSTOMER_DELIVERY_BLOCKED", ["market-impact-orderbook-legacy-authorized-cannot-bypass-rights", "market-impact-liquidity-legacy-authorized-cannot-bypass-rights"]],
    ["whale-watch", null, "ENDPOINT_PRESENT_WITHHELD", ["whale-watch-current-customer-state"]],
    ["angel", null, "PARTIAL_POSITIVE_E2E", ["angel-deterministic-smalltalk-positive", "angel-stream-deterministic-positive"]],
    ["risk-indicator", null, "ENGINE_PROJECTION_ONLY_NO_STANDALONE_ENTRYPOINT", ["risk-indicator-standalone-entrypoint-observation"]],
  ].map(([product, tier, status, evidence]) => ({
    product, tier, status, evidence,
    evidenceResults: evidence.map((id) => {
      const row = byId.get(id) || c12Rows.get(id);
      return row ? { id, result: row.result, http: row.http ?? null, classification: row.classification ?? null } : { id, result: "MISSING" };
    }),
  }));
  fs.writeFileSync(path.join(out, "PRODUCT_MATRIX_RUNTIME.json"), JSON.stringify({
    sourceSha: process.env.GITHUB_SHA || null,
    denominator: 20,
    pdfModel: "OUTPUT_ARTIFACT_NOT_STANDALONE_PRODUCT_FAMILY",
    matrix,
  }, null, 2));
} finally {
  if (proxy) await new Promise((resolve) => proxy.close(resolve));
  for (const child of children) await stop(child);
  fs.rmSync(work, { recursive: true, force: true });
  persist();
}
if (rows.some((row) => row.result !== "PASS")) process.exitCode = 1;
