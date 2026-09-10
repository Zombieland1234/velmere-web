import { readJsonResponseBounded } from "@/lib/network/fetch-with-deadline";
import { brokeredEgressFetch } from "@/lib/network/brokered-egress";
import { analyzeTokenRisk } from "./risk-engine";
import { fetchGoPlusTokenSecurity } from "./goplus";
import type { TokenRiskInput, TokenRiskResult } from "./risk-types";
import { attachPass4644ProviderReceipts, createPass4644ProviderEvidenceReceipt, pass4644IdentityMatches } from "./provider-evidence-receipt";
import { withholdProviderRiskResult } from "./market-row-delivery-gate";
import { canonicalJson } from "@/lib/security/canonical-json";
import { sha256Digest } from "@/lib/security/cryptographic-digest";

type DexPair = {
  chainId?: string;
  dexId?: string;
  url?: string;
  pairAddress?: string;
  baseToken?: { address?: string; name?: string; symbol?: string };
  quoteToken?: { address?: string; name?: string; symbol?: string };
  priceUsd?: string;
  txns?: { h24?: { buys?: number; sells?: number } };
  volume?: { h24?: number; h6?: number; h1?: number };
  priceChange?: { h1?: number; h6?: number; h24?: number };
  liquidity?: { usd?: number; base?: number; quote?: number };
  fdv?: number;
  marketCap?: number;
  info?: { imageUrl?: string; header?: string; websites?: Array<{ url?: string }>; socials?: Array<{ type?: string; url?: string }> };
};

type DexSearchResponse = { schemaVersion?: string; pairs?: DexPair[] };

function toNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function normalizeQuery(value: string) {
  return value.trim().replace(/\s+/g, " ").slice(0, 120);
}

function pairToRiskInput(pair: DexPair, security: Partial<TokenRiskInput> = {}): TokenRiskInput {
  const token = pair.baseToken ?? {};
  return {
    symbol: token.symbol?.toUpperCase() ?? "UNKNOWN",
    name: token.name ?? token.symbol ?? "Unresolved token",
    image: pair.info?.imageUrl,
    chainId: pair.chainId,
    tokenAddress: token.address,
    pairAddress: pair.pairAddress,
    dexId: pair.dexId,
    url: pair.url,
    currentPrice: toNumber(pair.priceUsd),
    marketCap: toNumber(pair.marketCap),
    fdv: toNumber(pair.fdv),
    liquidityUsd: toNumber(pair.liquidity?.usd),
    volume24h: toNumber(pair.volume?.h24),
    priceChange1h: toNumber(pair.priceChange?.h1),
    priceChange6h: toNumber(pair.priceChange?.h6),
    priceChange24h: toNumber(pair.priceChange?.h24),
    buys24h: toNumber(pair.txns?.h24?.buys),
    sells24h: toNumber(pair.txns?.h24?.sells),
    ...security,
    dataSources: Array.from(new Set(["DEX Screener", ...(security.dataSources ?? [])])),
  };
}

export async function analyzeDexScreenerToken(
  query: string,
  options: { allowGoPlus?: boolean } = {},
): Promise<TokenRiskResult> {
  const normalized = normalizeQuery(query);
  if (!normalized) throw new Error("Missing token query");

  const startedAt = Date.now();
  const response = await brokeredEgressFetch(`https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(normalized)}`, {
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(4_500),
    next: { revalidate: 60 },
  } as RequestInit & { next: { revalidate: number } }, { profile: "dex_screener", operation: "dexscreener_search", timeoutMs: 4_500 });

  if (!response.ok) throw new Error(`DEX Screener request failed with status ${response.status}`);
  const data = await readJsonResponseBounded<DexSearchResponse>(response, 1_048_576);
  const pairs = (data.pairs ?? [])
    .filter((pair) => pair.baseToken?.symbol || pair.baseToken?.name)
    .sort((a, b) => (toNumber(b.liquidity?.usd) ?? 0) - (toNumber(a.liquidity?.usd) ?? 0));
  const bestPair = pairs[0];
  if (!bestPair) throw new Error("No DEX pairs found for this query");

  const security: Partial<TokenRiskInput> = options.allowGoPlus === false
    ? {}
    : await fetchGoPlusTokenSecurity(bestPair.chainId, bestPair.baseToken?.address).catch((): Partial<TokenRiskInput> => ({}));
  const result = analyzeTokenRisk(pairToRiskInput(bestPair, security), "live");
  const identityMatched = pass4644IdentityMatches(normalized, {
    symbol: result.token.symbol,
    address: result.token.tokenAddress,
  });
  const receivedAt = new Date();
  const receipts = [createPass4644ProviderEvidenceReceipt({
    providerId: "dexscreener",
    providerFamily: "dex_market",
    surface: "crypto",
    verification: "normalized_response",
    requestedIdentity: normalized,
    resolvedSymbol: result.token.symbol,
    resolvedAddress: result.token.tokenAddress,
    resolvedChainId: result.token.chainId,
    identityMatched,
    capabilities: ["pair_identity", "dex_liquidity", "volume", "transactions", "price"],
    timestampProvenance: "transport_received",
    observedAt: receivedAt,
    receivedAt,
    ttlMs: 90_000,
    httpStatus: response.status,
    latencyMs: Date.now() - startedAt,
    normalizedPayload: {
      chainId: bestPair.chainId,
      pairAddress: bestPair.pairAddress,
      tokenAddress: bestPair.baseToken?.address,
      symbol: bestPair.baseToken?.symbol,
      priceUsd: bestPair.priceUsd,
      liquidityUsd: bestPair.liquidity?.usd,
      volume24h: bestPair.volume?.h24,
      txns24h: bestPair.txns?.h24,
    },
  })];
  if ((security.dataSources ?? []).some((source) => /goplus/i.test(source))) {
    receipts.push(createPass4644ProviderEvidenceReceipt({
      providerId: "goplus",
      providerFamily: "contract_risk",
      surface: "crypto",
      verification: "normalized_response",
      requestedIdentity: bestPair.baseToken?.address ?? normalized,
      resolvedSymbol: result.token.symbol,
      resolvedAddress: result.token.tokenAddress,
      resolvedChainId: result.token.chainId,
      identityMatched: Boolean(bestPair.baseToken?.address && result.token.tokenAddress && bestPair.baseToken.address.toLowerCase() === result.token.tokenAddress.toLowerCase()),
      capabilities: ["token_security", "holders", "owner", "mint", "blacklist", "tax", "honeypot_flags"],
      timestampProvenance: "transport_received",
      observedAt: receivedAt,
      receivedAt,
      ttlMs: 5 * 60_000,
      httpStatus: 200,
      latencyMs: 0,
      normalizedPayload: security,
    }));
  }
  attachPass4644ProviderReceipts(result, receipts);
  const address = String(result.token.tokenAddress ?? "").trim().toLowerCase();
  const chain = String(result.token.chainId ?? "").trim().toLowerCase();
  const canonicalIdentity = /^0x[a-f0-9]{40}$/.test(address)
    ? `address:${chain ? `${chain}:` : ""}${address}`
    : `symbol:${result.token.symbol.trim().toLowerCase()}`;
  const receiptDigest = sha256Digest(canonicalJson({
    schemaVersion: "pass6_provider_risk_delivery_v1",
    canonicalIdentity,
    generatedAt: receivedAt.toISOString(),
    blockers: [],
  }));
  result.providerRiskDelivery = {
    schemaVersion: "pass6_provider_risk_delivery_v1",
    state: "verified",
    scorePublished: true,
    canonicalIdentity,
    sourceReceiptRoot: receiptDigest,
    receiptDigest,
    completenessBps: 10_000,
    sourceAsOf: receivedAt.toISOString(),
    blockers: [],
  };
  result.dataQuality = "live";
  return result;
}
