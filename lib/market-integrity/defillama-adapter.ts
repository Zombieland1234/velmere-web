import { readJsonResponseBounded } from "@/lib/network/fetch-with-deadline";
import { brokeredEgressFetch } from "@/lib/network/brokered-egress";
import type { TokenRiskResult } from "./risk-types";

const DEFILLAMA_FREE_BASE = "https://api.llama.fi";
const DEFILLAMA_PRO_BASE = "https://pro-api.llama.fi";

export type DefiLlamaProtocolRow = {
  id?: string | number;
  name?: string;
  slug?: string;
  symbol?: string;
  category?: string;
  chains?: string[];
  chain?: string;
  tvl?: number;
  mcap?: number;
  change_1d?: number;
  change_7d?: number;
  change_1m?: number;
  url?: string;
  audits?: string | number | boolean | null;
  audit_note?: string | null;
  gecko_id?: string | null;
  listedAt?: number;
};

export type DefiLlamaChainRow = {
  name?: string;
  gecko_id?: string | null;
  tokenSymbol?: string | null;
  tvl?: number;
  change_1d?: number;
  change_7d?: number;
  change_1m?: number;
};

export type DefiLlamaProtocolDetail = {
  id?: string | number;
  name?: string;
  slug?: string;
  symbol?: string;
  category?: string;
  url?: string;
  chains?: string[];
  chainTvls?: Record<string, { tvl?: Array<{ date?: number; totalLiquidityUSD?: number }> } | number>;
  currentChainTvls?: Record<string, number>;
  tvl?: Array<{ date?: number; totalLiquidityUSD?: number }>;
  tokensInUsd?: Array<Record<string, number>>;
  tokens?: Array<Record<string, number>>;
  raises?: unknown[];
  hacks?: unknown[];
  audits?: string | number | boolean | null;
  audit_note?: string | null;
  listedAt?: number;
};

export type DefiLlamaProtocolMatch = {
  slug: string;
  name: string;
  symbol?: string;
  category?: string;
  chains: string[];
  tvlUsd?: number;
  marketCapUsd?: number;
  change1d?: number;
  change7d?: number;
  change1m?: number;
  audits?: string | number | boolean | null;
  auditNote?: string | null;
  url?: string;
  matchQuality: "exact" | "strong" | "weak";
};

export type DefiLlamaRiskLane = {
  version: "pass2359-defillama-tvl-protocol-lane-v1";
  mode: "partial" | "unresolved" | "degraded";
  query: string;
  provider: "DefiLlama";
  matchedProtocol?: DefiLlamaProtocolMatch;
  chainContext?: {
    chainName?: string;
    chainTvlUsd?: number;
    chainChange1d?: number;
    chainChange7d?: number;
  };
  sourceFacts: string[];
  missingData: string[];
  confidenceCap: number;
  riskLane: "protocol_tvl_present" | "protocol_tvl_stress" | "chain_context_only" | "unresolved_protocol" | "provider_degraded";
  scoreImpact: "none" | "confidence_only" | "review_priority";
  operatorNextSteps: string[];
  evidenceBoundary: string;
  generatedAt: string;
};

function cleanQuery(value: string) {
  return value
    .replace(/[<>`]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 96);
}

function lower(value: unknown) {
  return String(value ?? "").trim().toLowerCase();
}

function n(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function compact<T>(items: Array<T | null | undefined | false>): T[] {
  return items.filter(Boolean) as T[];
}

function money(value?: number) {
  if (value === undefined) return "source required";
  if (Math.abs(value) >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(2)}B`;
  if (Math.abs(value) >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (Math.abs(value) >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  return `$${value.toFixed(2)}`;
}

function pct(value?: number) {
  if (value === undefined) return "source required";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(Math.abs(value) >= 10 ? 1 : 2)}%`;
}

function toProPath(path: string) {
  if (path === "/protocols") return "/api/protocols";
  if (path.startsWith("/protocol/")) return `/api${path}`;
  if (path.startsWith("/tvl/")) return `/api${path}`;
  if (path.startsWith("/v2/")) return `/api${path}`;
  if (path.startsWith("/prices/")) return `/coins${path}`;
  if (path.startsWith("/stablecoin")) return `/stablecoins${path}`;
  if (path.startsWith("/overview/")) return `/api${path}`;
  if (path.startsWith("/summary/")) return `/api${path}`;
  return path;
}

function buildDefiLlamaUrl(path: string) {
  const apiKey = process.env.DEFILLAMA_PRO_API_KEY?.trim();
  if (apiKey) return `${DEFILLAMA_PRO_BASE}/${encodeURIComponent(apiKey)}${toProPath(path)}`;
  return `${DEFILLAMA_FREE_BASE}${path}`;
}

async function fetchDefiLlamaJson<T>(path: string, revalidate = 120): Promise<T> {
  const response = await brokeredEgressFetch(buildDefiLlamaUrl(path), {
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(6_000),
    next: { revalidate },
  } as RequestInit & { next: { revalidate: number } }, { profile: "defi_llama", operation: "defillama_json", timeoutMs: 6_000, maxResponseBytes: 16_777_216 });
  if (!response.ok) throw new Error(`DefiLlama request failed with status ${response.status}`);
  return readJsonResponseBounded<T>(response, 16_777_216, { jsonMaxNodes: 500_000 });
}

function normalizeProtocol(row: DefiLlamaProtocolRow): DefiLlamaProtocolMatch | null {
  const slug = cleanQuery(row.slug ?? row.name ?? row.symbol ?? "").toLowerCase().replace(/\s+/g, "-");
  const name = cleanQuery(row.name ?? row.slug ?? row.symbol ?? "");
  if (!slug || !name) return null;
  return {
    slug,
    name,
    symbol: cleanQuery(row.symbol ?? "") || undefined,
    category: cleanQuery(row.category ?? "") || undefined,
    chains: Array.isArray(row.chains) ? row.chains.map((chain) => cleanQuery(chain)).filter(Boolean).slice(0, 12) : compact([cleanQuery(row.chain ?? "")]),
    tvlUsd: n(row.tvl),
    marketCapUsd: n(row.mcap),
    change1d: n(row.change_1d),
    change7d: n(row.change_7d),
    change1m: n(row.change_1m),
    audits: row.audits,
    auditNote: row.audit_note ?? null,
    url: row.url,
    matchQuality: "weak",
  };
}

function scoreProtocolMatch(row: DefiLlamaProtocolMatch, query: string, result?: TokenRiskResult) {
  const q = lower(query);
  const symbol = lower(result?.token.symbol);
  const marketId = lower(result?.token.marketId);
  const names = [lower(row.slug), lower(row.name), lower(row.symbol)].filter(Boolean);
  let score = 0;
  if (names.some((item) => item === q)) score += 100;
  if (symbol && names.some((item) => item === symbol)) score += 80;
  if (marketId && names.some((item) => item === marketId || item.replaceAll("-", " ") === marketId.replaceAll("-", " "))) score += 75;
  if (names.some((item) => item.includes(q) || q.includes(item))) score += 38;
  if (symbol && names.some((item) => item.includes(symbol))) score += 32;
  score += Math.min(20, Math.log10(Math.max(row.tvlUsd ?? 0, 1)) * 2.2);
  return score;
}

export async function fetchDefiLlamaProtocols() {
  const rows = await fetchDefiLlamaJson<DefiLlamaProtocolRow[]>("/protocols", 240);
  return rows.map(normalizeProtocol).filter((row): row is DefiLlamaProtocolMatch => Boolean(row));
}

export async function fetchDefiLlamaChains() {
  return fetchDefiLlamaJson<DefiLlamaChainRow[]>("/v2/chains", 240);
}

export async function searchDefiLlamaProtocols(query: string, result?: TokenRiskResult, limit = 8) {
  const clean = cleanQuery(query || result?.token.symbol || result?.token.name || "");
  if (!clean) return [];
  const protocols = await fetchDefiLlamaProtocols();
  return protocols
    .map((row) => {
      const matchScore = scoreProtocolMatch(row, clean, result);
      return {
        ...row,
        matchQuality: matchScore >= 100 ? "exact" as const : matchScore >= 72 ? "strong" as const : "weak" as const,
        matchScore,
      };
    })
    .filter((row) => row.matchScore >= 34)
    .sort((a, b) => b.matchScore - a.matchScore)
    .slice(0, Math.max(1, Math.min(limit, 20)))
    .map(({ matchScore, ...row }) => row);
}

async function resolveChainContext(match: DefiLlamaProtocolMatch | undefined) {
  const primaryChain = match?.chains?.[0];
  if (!primaryChain) return undefined;
  const chains = await fetchDefiLlamaChains().catch(() => []);
  const chain = chains.find((item) => lower(item.name) === lower(primaryChain));
  if (!chain) return { chainName: primaryChain };
  return {
    chainName: chain.name ?? primaryChain,
    chainTvlUsd: n(chain.tvl),
    chainChange1d: n(chain.change_1d),
    chainChange7d: n(chain.change_7d),
  };
}

export async function fetchDefiLlamaProtocolDetail(slug: string) {
  const clean = encodeURIComponent(cleanQuery(slug).toLowerCase().replace(/\s+/g, "-"));
  if (!clean) throw new Error("Missing DefiLlama protocol slug");
  return fetchDefiLlamaJson<DefiLlamaProtocolDetail>(`/protocol/${clean}`, 240);
}

export async function buildDefiLlamaRiskLane(query: string, result?: TokenRiskResult): Promise<DefiLlamaRiskLane> {
  const clean = cleanQuery(query || result?.token.symbol || result?.token.name || "");
  const generatedAt = new Date().toISOString();
  if (!clean) {
    return {
      version: "pass2359-defillama-tvl-protocol-lane-v1",
      mode: "unresolved",
      query: "",
      provider: "DefiLlama",
      sourceFacts: [],
      missingData: ["protocol query"],
      confidenceCap: 28,
      riskLane: "unresolved_protocol",
      scoreImpact: "confidence_only",
      operatorNextSteps: ["Enter a protocol, chain, token symbol or market id before using the DeFi TVL lane."],
      evidenceBoundary: "No DeFiLlama claim is made without a matched protocol or chain context.",
      generatedAt,
    };
  }

  try {
    const matches = await searchDefiLlamaProtocols(clean, result, 5);
    const best = matches[0];
    const chainContext = await resolveChainContext(best).catch(() => undefined);
    if (!best) {
      return {
        version: "pass2359-defillama-tvl-protocol-lane-v1",
        mode: "unresolved",
        query: clean,
        provider: "DefiLlama",
        chainContext,
        sourceFacts: chainContext?.chainName ? [`Chain context detected: ${chainContext.chainName}, TVL ${money(chainContext.chainTvlUsd)}.`] : [],
        missingData: ["matched protocol TVL", "protocol category", "protocol chain breakdown"],
        confidenceCap: chainContext ? 44 : 32,
        riskLane: chainContext ? "chain_context_only" : "unresolved_protocol",
        scoreImpact: "confidence_only",
        operatorNextSteps: [
          "Do not convert an unresolved protocol into a risk accusation.",
          "Ask for exact protocol slug/URL or use contract/DEX evidence first.",
          "Keep DeFiLlama as a source-coverage lane until a protocol is matched.",
        ],
        evidenceBoundary: "Unresolved DeFiLlama data can lower confidence but cannot prove safety or danger.",
        generatedAt,
      };
    }

    const tvl = best.tvlUsd;
    const severeTvlDrop = best.change7d !== undefined && best.change7d <= -25;
    const lowTvlForMcap = result?.metrics.marketCap && tvl !== undefined && tvl > 0
      ? tvl / result.metrics.marketCap < 0.02
      : false;
    const riskLane = severeTvlDrop || lowTvlForMcap ? "protocol_tvl_stress" : "protocol_tvl_present";
    const confidenceCap = best.matchQuality === "exact" ? 78 : best.matchQuality === "strong" ? 68 : 54;
    const sourceFacts = compact([
      `${best.name} matched on DefiLlama as ${best.slug} (${best.matchQuality}).`,
      tvl !== undefined ? `Protocol TVL: ${money(tvl)}.` : "Protocol TVL not returned by provider.",
      best.category ? `Category: ${best.category}.` : null,
      best.chains.length ? `Chains: ${best.chains.slice(0, 4).join(", ")}${best.chains.length > 4 ? "…" : ""}.` : null,
      best.change1d !== undefined ? `TVL 1d: ${pct(best.change1d)}.` : null,
      best.change7d !== undefined ? `TVL 7d: ${pct(best.change7d)}.` : null,
      chainContext?.chainName ? `Primary chain context: ${chainContext.chainName}, chain TVL ${money(chainContext.chainTvlUsd)}.` : null,
    ]);
    const missingData = compact([
      tvl === undefined ? "protocol TVL" : null,
      best.change7d === undefined ? "7d TVL change" : null,
      best.chains.length === 0 ? "chain list" : null,
      best.audits === undefined || best.audits === null ? "audit metadata" : null,
      "pool-level exit depth",
      "token holder graph",
    ]);

    return {
      version: "pass2359-defillama-tvl-protocol-lane-v1",
      mode: "partial",
      query: clean,
      provider: "DefiLlama",
      matchedProtocol: best,
      chainContext,
      sourceFacts,
      missingData,
      confidenceCap,
      riskLane,
      scoreImpact: riskLane === "protocol_tvl_stress" ? "review_priority" : "none",
      operatorNextSteps: [
        riskLane === "protocol_tvl_stress"
          ? "Compare TVL change with price, DEX liquidity and protocol announcements before escalating."
          : "Use TVL as context; do not treat high TVL as a safety certificate.",
        "Cross-check pool-level liquidity and DEX pair data before any Advanced conclusion.",
        "Show missing pool/holder evidence visibly in Shield, Browser and Angel responses.",
      ],
      evidenceBoundary: "DeFiLlama TVL is context for DeFi protocol coverage; it is not proof of safety, fraud or future performance.",
      generatedAt,
    };
  } catch (error) {
    return {
      version: "pass2359-defillama-tvl-protocol-lane-v1",
      mode: "degraded",
      query: clean,
      provider: "DefiLlama",
      sourceFacts: [],
      missingData: ["DefiLlama provider response", "protocol TVL", "chain context"],
      confidenceCap: 30,
      riskLane: "provider_degraded",
      scoreImpact: "confidence_only",
      operatorNextSteps: [
        "Keep the answer source-honest and say that the DeFi TVL provider is temporarily unavailable.",
        "Do not replace missing TVL with a guessed number.",
        "Retry later or fall back to CoinGecko/DEX Screener while marking DeFiLlama as missing.",
      ],
      evidenceBoundary: error instanceof Error ? error.message : "DefiLlama provider failed.",
      generatedAt,
    };
  }
}

export async function buildDefiLlamaSnapshotForResult(result: TokenRiskResult) {
  const query = result.token.marketId ?? result.token.name ?? result.token.symbol;
  return buildDefiLlamaRiskLane(query, result);
}
