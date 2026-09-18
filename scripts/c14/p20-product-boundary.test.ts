import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { GET as getOrderbook } from "../../lib/server/market-integrity-route-modules/orderbook";
import { GET as getLiquidity } from "../../lib/server/market-integrity-route-modules/liquidity-intelligence";
import { buildMarketImpactDeliveryPreflight } from "../../lib/market-integrity/market-impact-delivery-policy";

test("C14-P20 blocked orderbook rights cannot be bypassed by legacy client flags", async (t) => {
  const policy = buildMarketImpactDeliveryPreflight("orderbook");
  if (policy.providerNetworkAllowed && policy.customerDeliveryAllowed) {
    t.skip("current provider-rights policy allows the orderbook");
    return;
  }
  const response = await getOrderbook(new Request(
    "http://localhost/api/market-integrity/orderbook?symbol=BTCUSDT&authorized=true",
    { headers: { "x-velmere-pro": "true" } },
  ));
  assert.equal(response.status, 424);
  const body = await response.json();
  assert.equal(body.error, "NO_USABLE_ORDER_BOOK");
  assert.equal(body.liveClaimed, false);
});

test("C14-P20 blocked liquidity rights cannot be bypassed by legacy client flags", async (t) => {
  const policy = buildMarketImpactDeliveryPreflight("liquidity_intelligence");
  if (policy.providerNetworkAllowed && policy.customerDeliveryAllowed) {
    t.skip("current provider-rights policy allows liquidity intelligence");
    return;
  }
  const response = await getLiquidity(new Request(
    "http://localhost/api/market-integrity/liquidity-intelligence?query=BTC&authorized=true",
    { headers: { "x-velmere-pro": "true" } },
  ));
  assert.equal(response.status, 424);
  const body = await response.json();
  assert.equal(body.error, "NO_USABLE_ORDER_BOOK");
  assert.equal(body.liveClaimed, false);
});

test("C14-P20 production product routes do not accept client-controlled dev/pro bypasses", () => {
  const markets = fs.readFileSync("lib/server/market-integrity-route-modules/markets.ts", "utf8");
  const investigator = fs.readFileSync("lib/server/market-integrity-route-modules/investigator.ts", "utf8");
  const intelligence = fs.readFileSync("lib/server/market-integrity-route-modules/market-intelligence.ts", "utf8");
  assert.match(markets, /process\.env\.NODE_ENV !== "production" && \(/);
  assert.match(investigator, /process\.env\.NODE_ENV !== "production" && \(/);
  assert.match(intelligence, /process\.env\.NODE_ENV !== "production" && \(/);
});

test("C14-P20 Shield Map has no synthetic provider-live fallback", () => {
  const source = fs.readFileSync("lib/server/market-integrity-route-modules/investigator.ts", "utf8");
  assert.doesNotMatch(source, /CANONICAL_FALLBACK_ASSETS/);
  assert.doesNotMatch(source, /resolveFallbackMarketRow/);
  assert.doesNotMatch(source, /local hardcoded|hardcoded.*coingecko/i);
});

test("C14-P20 runtime product truth follows current P66 topology and keeps PDF as an artifact", () => {
  const source = fs.readFileSync("lib/server/market-integrity-route-modules/market-intelligence.ts", "utf8");
  assert.match(source, /VLM_CANONICAL_TIERED_FAMILIES/);
  assert.match(source, /VLM_CANONICAL_STANDALONE_PRODUCTS/);
  assert.match(source, /pdfIsProductFamily:\s*false/);
  assert.doesNotMatch(source, /tieredProducts:\s*\["audit",\s*"pdf",\s*"browser"\]/);
});
