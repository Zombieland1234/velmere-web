import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOTS = ["app", "lib"];
const EXTENSIONS = new Set([".ts", ".tsx", ".js", ".mjs", ".cjs"]);
const PROVIDER_HOSTS = new Map([
  ["coingecko", ["api.coingecko.com"]],
  ["dexscreener-api", ["api.dexscreener.com"]],
  ["geckoterminal", ["api.geckoterminal.com"]],
  ["defillama", ["api.llama.fi", "pro-api.llama.fi"]],
  ["binance", ["api.binance.com", "api1.binance.com", "api2.binance.com", "api3.binance.com"]],
  ["coinbase", ["api.exchange.coinbase.com", "api.coinbase.com"]],
  ["goplus-token-security", ["api.gopluslabs.io"]],
  ["honeypot-is", ["api.honeypot.is"]],
  ["etherscan-v2", ["api.etherscan.io"]],
  ["sec_edgar", ["data.sec.gov", "www.sec.gov"]],
  ["stooq", ["stooq.com"]],
  ["yahoo_finance", ["query1.finance.yahoo.com", "query2.finance.yahoo.com"]],
  ["alpha_vantage", ["alphavantage.co"]],
  ["finnhub", ["finnhub.io"]],
  ["twelve_data", ["twelvedata.com"]],
  ["fred", ["api.stlouisfed.org"]],
  ["ecb_statistics", ["data-api.ecb.europa.eu", "data-api.ecb.europa.eu"]],
  ["eia", ["api.eia.gov"]],
  ["cftc", ["publicreporting.cftc.gov"]],
  ["pyth", ["hermes.pyth.network"]],
  ["sourcify-v2", ["sourcify.dev"]],
]);

const NETWORK_PRIMITIVE = /(?:\bbrokeredEgressFetch\s*\(|\bfetch\s*\(|\.fetch\s*\()/u;
const CENTRAL_MARKER = /c14-provider-enforcement|evaluateC14ProviderOperation/u;
const SPECIALIZED_FAIL_CLOSED = [
  /browser-ecb-delivery-authority/u,
  /R7_ECB_USAGE_POLICY_REVIEW/u,
];

function extension(path) {
  const index = path.lastIndexOf(".");
  return index < 0 ? "" : path.slice(index);
}

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    const stat = statSync(path);
    if (stat.isDirectory()) out.push(...walk(path));
    else if (EXTENSIONS.has(extension(path))) out.push(path);
  }
  return out;
}

const files = ROOTS.flatMap((root) => walk(root));
const findings = [];
const covered = [];

for (const path of files) {
  const text = readFileSync(path, "utf8");
  if (!NETWORK_PRIMITIVE.test(text)) continue;
  const relativePath = relative(".", path).replaceAll("\\", "/");
  for (const [providerId, hosts] of PROVIDER_HOSTS) {
    if (!hosts.some((host) => text.includes(host))) continue;
    const central = CENTRAL_MARKER.test(text);
    const specialized = providerId === "ecb_statistics"
      && SPECIALIZED_FAIL_CLOSED.some((pattern) => pattern.test(text));
    const protectedBy = central ? "c14-central" : specialized ? "ecb-specialized-expiry-gate" : null;
    const row = { providerId, path: relativePath, hosts: hosts.filter((host) => text.includes(host)), protectedBy };
    if (protectedBy) covered.push(row);
    else findings.push(row);
  }
}

console.log(JSON.stringify({
  schemaVersion: "velmere.c14-p22.provider-egress-static-audit.v1",
  filesScanned: files.length,
  coveredEgressFiles: covered.length,
  unprotectedEgressFiles: findings.length,
  covered,
  findings,
}, null, 2));

if (findings.length) {
  throw new Error(`unprotected_provider_egress:${findings.length}`);
}
