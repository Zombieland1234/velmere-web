async function main() {
  import assert from "node:assert/strict";
  import { readFileSync } from "node:fs";
  
  import {
    buildC14ProviderEnforcementMatrix,
    C14_RUNTIME_PROVIDER_IDS,
    evaluateC14ProviderOperation,
  } from "../../lib/compliance/c14-provider-enforcement";
  import { createProviderReliabilityControlPlane } from "../../lib/market-integrity/provider-reliability-control-plane";
  import { buildPass4643ProviderRuntimeInventory } from "../../lib/market-integrity/provider-runtime-inventory";
  
  const NOW = Date.parse("2026-09-18T00:00:00.000Z");
  const ECB_VALID = Date.parse("2026-08-25T12:00:00.000Z");
  
  function decision(
    providerId: string,
    operation: Parameters<typeof evaluateC14ProviderOperation>[0]["operation"],
    channel: Parameters<typeof evaluateC14ProviderOperation>[0]["channel"],
    extra: Partial<Parameters<typeof evaluateC14ProviderOperation>[0]> = {},
  ) {
    return evaluateC14ProviderOperation({
      providerId,
      operation,
      channel,
      nowMs: NOW,
      ...extra,
    });
  }
  
  const matrix = buildC14ProviderEnforcementMatrix(NOW);
  for (const providerId of C14_RUNTIME_PROVIDER_IDS) {
    assert.ok(
      matrix.some((row) => row.providerId === providerId),
      `runtime provider missing from C14 matrix: ${providerId}`,
    );
  }
  
  assert.equal(decision("unknown-provider", "fetch", "internal_diagnostic").allowed, false);
  assert.equal(decision("unknown-provider", "fetch", "internal_diagnostic").state, "UNVERIFIED");
  
  const coinbaseInternal = decision("coinbase", "fetch", "internal_diagnostic");
  assert.equal(coinbaseInternal.allowed, true);
  assert.equal(coinbaseInternal.code, "ALLOW_INTERNAL_DIAGNOSTIC_FETCH");
  assert.equal(decision("coinbase", "display", "customer").allowed, false);
  
  const coingeckoInternal = decision("coingecko", "fetch", "internal_diagnostic");
  assert.equal(coingeckoInternal.allowed, true);
  assert.equal(decision("coingecko", "cache", "internal_diagnostic", { cacheTtlSeconds: 90 }).allowed, false);
  assert.equal(decision("coingecko", "display", "customer", { attributionPresent: true }).allowed, false);
  
  const alphaInternal = decision("alpha_vantage", "fetch", "internal_diagnostic");
  assert.equal(alphaInternal.allowed, true);
  assert.equal(decision("alpha_vantage", "cache", "internal_diagnostic", { cacheTtlSeconds: 60 }).allowed, false);
  assert.equal(decision("alpha_vantage", "display", "customer").allowed, false);
  
  for (const providerId of ["dexscreener", "goplus", "honeypot_is", "etherscan_family"]) {
    const expired = decision(providerId, "fetch", "internal_diagnostic");
    assert.equal(expired.allowed, false, `${providerId} must fail closed after P90 reverifyBy`);
    assert.equal(expired.code, "RIGHTS_REVIEW_EXPIRED");
    assert.equal(expired.state, "EXPIRED");
  }
  
  assert.equal(decision("defillama", "fetch", "internal_diagnostic").allowed, false);
  assert.equal(decision("stooq", "fetch", "internal_diagnostic").state, "UNVERIFIED");
  assert.equal(decision("yahoo_finance", "fetch", "internal_diagnostic").state, "UNVERIFIED");
  assert.equal(decision("sec_edgar", "fetch", "internal_diagnostic").state, "UNVERIFIED");
  
  const ecbExpired = decision("ecb", "display", "customer", { attributionPresent: true });
  assert.equal(ecbExpired.allowed, false);
  assert.equal(ecbExpired.code, "RIGHTS_REVIEW_EXPIRED");
  
  const ecbDisplayBeforeExpiry = evaluateC14ProviderOperation({
    providerId: "ecb",
    operation: "display",
    channel: "customer",
    attributionPresent: true,
    nowMs: ECB_VALID,
  });
  assert.equal(ecbDisplayBeforeExpiry.allowed, true);
  
  const ecbMissingAttribution = evaluateC14ProviderOperation({
    providerId: "ecb",
    operation: "display",
    channel: "customer",
    attributionPresent: false,
    nowMs: ECB_VALID,
  });
  assert.equal(ecbMissingAttribution.allowed, false);
  assert.ok(ecbMissingAttribution.blockers.includes("required_attribution_missing"));
  
  const ecbRawCache = evaluateC14ProviderOperation({
    providerId: "ecb",
    operation: "cache",
    channel: "internal_diagnostic",
    cacheTtlSeconds: 60,
    nowMs: ECB_VALID,
  });
  assert.equal(ecbRawCache.allowed, false);
  
  const ecbBulk = evaluateC14ProviderOperation({
    providerId: "ecb",
    operation: "redistribution",
    channel: "customer",
    dataClass: "raw",
    attributionPresent: true,
    nowMs: ECB_VALID,
  });
  assert.equal(ecbBulk.allowed, false, "specific R7 no-bulk rule must override broad P65 reuse row");
  
  const nvdWithAttribution = evaluateC14ProviderOperation({
    providerId: "nvd",
    operation: "display",
    channel: "customer",
    attributionPresent: true,
    nowMs: NOW,
  });
  assert.equal(nvdWithAttribution.allowed, true);
  assert.equal(evaluateC14ProviderOperation({
    providerId: "nvd",
    operation: "display",
    channel: "customer",
    attributionPresent: false,
    nowMs: NOW,
  }).allowed, false);
  assert.equal(evaluateC14ProviderOperation({
    providerId: "nvd",
    operation: "redistribution",
    channel: "customer",
    dataClass: "raw",
    attributionPresent: true,
    nowMs: NOW,
  }).allowed, true);
  assert.equal(evaluateC14ProviderOperation({
    providerId: "nvd",
    operation: "cache",
    channel: "internal_diagnostic",
    cacheTtlSeconds: 60,
    nowMs: NOW,
  }).allowed, false);
  
  const cryptoInventory = buildPass4643ProviderRuntimeInventory("crypto", {}, NOW);
  const publicButRightsBlocked = cryptoInventory.rows.find((row) => row.id === "defillama");
  assert.equal(publicButRightsBlocked?.transportUsable, true);
  assert.equal(publicButRightsBlocked?.usable, false);
  const coingeckoInventory = cryptoInventory.rows.find((row) => row.id === "coingecko");
  assert.equal(coingeckoInventory?.transportUsable, true);
  assert.equal(coingeckoInventory?.usable, true);
  assert.equal(coingeckoInventory?.customerDeliveryAllowed, false);
  
  let uncachedExecutions = 0;
  const noCachePlane = createProviderReliabilityControlPlane({ now: (() => {
    let current = 1_000;
    return () => current++;
  })() });
  for (let i = 0; i < 2; i += 1) {
    const result = await noCachePlane.execute({
      providerId: "fixture",
      endpointId: "no-cache",
      cacheKey: "same",
      validate: () => true,
      policy: { cacheEnabled: false, maxAttempts: 1 },
      execute: async () => ({ sequence: ++uncachedExecutions }),
    });
    assert.equal(result.ok, true);
    assert.equal(result.receipt.state, "live");
  }
  assert.equal(uncachedExecutions, 2, "cacheEnabled=false must not persist provider payloads");
  
  let cachedExecutions = 0;
  const cachePlane = createProviderReliabilityControlPlane({ now: (() => {
    let current = 2_000;
    return () => current++;
  })() });
  const first = await cachePlane.execute({
    providerId: "fixture",
    endpointId: "cache",
    cacheKey: "same",
    validate: () => true,
    policy: { cacheEnabled: true, freshTtlMs: 10_000, maxAttempts: 1 },
    execute: async () => ({ sequence: ++cachedExecutions }),
  });
  const second = await cachePlane.execute({
    providerId: "fixture",
    endpointId: "cache",
    cacheKey: "same",
    validate: () => true,
    policy: { cacheEnabled: true, freshTtlMs: 10_000, maxAttempts: 1 },
    execute: async () => ({ sequence: ++cachedExecutions }),
  });
  assert.equal(first.receipt.state, "live");
  assert.equal(second.receipt.state, "fresh_cache");
  assert.equal(cachedExecutions, 1);
  
  const deliveryGateSource = readFileSync("lib/market-integrity/market-row-delivery-gate.ts", "utf8");
  assert.match(deliveryGateSource, /provider_rights:/u);
  assert.match(
    deliveryGateSource,
    /return delivery\.state === "verified" && delivery\.fields\[fieldId\]\?\.state === "verified";/u,
  );
  assert.doesNotMatch(deliveryGateSource, /delivery\.state === "withheld"\s*\)/u);
  
  console.log(JSON.stringify({
    schemaVersion: "velmere.c14-p22.provider-enforcement-test.v1",
    assertions: 37,
    runtimeProvidersCovered: C14_RUNTIME_PROVIDER_IDS.length,
    matrixRows: matrix.length,
    currentTime: new Date(NOW).toISOString(),
    result: "PASS",
  }, null, 2));
  
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
