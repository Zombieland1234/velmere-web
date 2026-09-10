import type { DefiLlamaRiskLane } from "./defillama-adapter";
import type { TokenRiskResult } from "./risk-types";

export type Pass2446DefiLlamaExpansionLane = {
  id: "tvl" | "fees_revenue" | "stablecoin_supply" | "yields" | "dex_volume" | "bridge_chain_exposure" | "historical_chain_tvl";
  label: string;
  status: "live" | "ready_to_fetch" | "watch" | "blocked" | "not_applicable";
  endpointContract: string[];
  confirmedFacts: string[];
  missingFacts: string[];
  riskUse: string;
  customerBoundary: string;
};

export type Pass2446DefiLlamaExpansion = {
  version: "pass2446-defillama-expanded-context-v1";
  mode: "protocol_context" | "stablecoin_context" | "chain_context" | "unresolved" | "degraded";
  protocolSlug?: string;
  primaryChain?: string;
  lanes: Pass2446DefiLlamaExpansionLane[];
  scoreImpact: "none" | "confidence_only" | "review_priority";
  nextOps: string[];
  generatedAt: string;
};

function clean(value: unknown) {
  return String(value ?? "").trim().slice(0, 96);
}

function stablecoinSymbol(result?: TokenRiskResult | null) {
  const symbol = clean(result?.token.symbol).toUpperCase();
  return ["USDT", "USDC", "DAI", "FRAX", "TUSD", "FDUSD", "USDE", "PYUSD", "LUSD", "GUSD"].includes(symbol) ? symbol : undefined;
}

function compact(items: Array<string | false | null | undefined>) {
  return items.filter(Boolean) as string[];
}

export function buildPass2446DefiLlamaExpansion(args: {
  defiLlama?: DefiLlamaRiskLane | null;
  result?: TokenRiskResult | null;
}): Pass2446DefiLlamaExpansion {
  const defiLlama = args.defiLlama;
  const protocol = defiLlama?.matchedProtocol;
  const slug = protocol?.slug;
  const chain = protocol?.chains?.[0] ?? defiLlama?.chainContext?.chainName;
  const stable = stablecoinSymbol(args.result);
  const degraded = defiLlama?.mode === "degraded";
  const mode: Pass2446DefiLlamaExpansion["mode"] = degraded
    ? "degraded"
    : slug
      ? "protocol_context"
      : stable
        ? "stablecoin_context"
        : chain
          ? "chain_context"
          : "unresolved";

  const lanes: Pass2446DefiLlamaExpansionLane[] = [
    {
      id: "tvl",
      label: "Protocol TVL / chain TVL",
      status: degraded ? "blocked" : "watch",
      endpointContract: ["/protocols", slug ? `/protocol/${slug}` : "/protocol/{protocol}", "/v2/chains"],
      confirmedFacts: compact([
        protocol?.name && `matched protocol: ${protocol.name}`,
        protocol?.tvlUsd !== undefined && `protocol TVL: ${protocol.tvlUsd}`,
        chain && `primary chain: ${chain}`,
      ]),
      missingFacts: compact([
        !slug && "protocol slug",
        protocol?.tvlUsd === undefined && "current TVL",
        "pool-level exit depth",
        "TVL methodology note in UI",
      ]),
      riskUse: "Context lane for DeFi exposure and TVL stress; can change confidence/review priority only.",
      customerBoundary: "TVL is not a safety certificate and cannot be used as ROI copy.",
    },
    {
      id: "fees_revenue",
      label: "Fees / revenue quality",
      status: slug ? "ready_to_fetch" : "blocked",
      endpointContract: ["/overview/fees", slug ? `/summary/fees/${slug}` : "/summary/fees/{protocol}"],
      confirmedFacts: [],
      missingFacts: slug ? ["daily fees", "daily revenue", "history window", "protocol fee/revenue methodology"] : ["protocol slug"],
      riskUse: "Advanced protocol quality context: revenue/fee stress vs TVL and market moves.",
      customerBoundary: "Fees and revenue are protocol activity context, not profit guarantees.",
    },
    {
      id: "stablecoin_supply",
      label: "Stablecoin supply / chain distribution",
      status: stable ? "ready_to_fetch" : "not_applicable",
      endpointContract: stable ? ["/stablecoins", "/stablecoincharts/all", "/stablecoinchains", "/stablecoin/{asset}"] : ["/stablecoins", "/stablecoincharts/all"],
      confirmedFacts: stable ? [`stablecoin candidate: ${stable}`] : [],
      missingFacts: stable ? ["stablecoin asset id", "chain distribution", "supply change", "price/peg lane"] : ["stablecoin scope not detected"],
      riskUse: "Stablecoin-specific context for peg/supply/chain concentration.",
      customerBoundary: "Supply distribution is context; peg risk requires price and reserve/evidence lanes too.",
    },
    {
      id: "yields",
      label: "Yield pool exposure",
      status: slug ? "ready_to_fetch" : "watch",
      endpointContract: ["/pools", "/chart/{pool}"],
      confirmedFacts: [],
      missingFacts: ["pool id", "APY history", "pool TVL", "asset composition", "prediction caveat"],
      riskUse: "Only for protocols/pools where user explicitly asks about DeFi pool exposure.",
      customerBoundary: "Yield data is informational; never recommend chasing APY or present it as safe return.",
    },
    {
      id: "dex_volume",
      label: "DEX / options / open-interest volume",
      status: slug || chain ? "ready_to_fetch" : "blocked",
      endpointContract: ["/overview/dexs", chain ? `/overview/dexs/${encodeURIComponent(chain)}` : "/overview/dexs/{chain}", slug ? `/summary/dexs/${slug}` : "/summary/dexs/{protocol}", "/overview/open-interest"],
      confirmedFacts: compact([chain && `chain scope: ${chain}`]),
      missingFacts: ["DEX volume history", "protocol volume summary", "open-interest context", "chain/protocol mapping"],
      riskUse: "Advanced contradiction lane: volume/liquidity/TVL divergence.",
      customerBoundary: "Volume does not prove organic demand; it must be cross-checked for wash/boost context.",
    },
    {
      id: "bridge_chain_exposure",
      label: "Bridge / chain exposure",
      status: chain ? "ready_to_fetch" : "blocked",
      endpointContract: ["/v2/chains", "/v2/historicalChainTvl", chain ? `/v2/historicalChainTvl/${encodeURIComponent(chain)}` : "/v2/historicalChainTvl/{chain}"],
      confirmedFacts: compact([chain && `primary chain: ${chain}`]),
      missingFacts: ["historical chain TVL", "bridge exposure", "chain concentration", "stablecoin share by chain"],
      riskUse: "Macro DeFi context for chain stress and liquidity migration.",
      customerBoundary: "Chain TVL is ecosystem context and must not be treated as token-specific safety.",
    },
    {
      id: "historical_chain_tvl",
      label: "Historical chain TVL timeline",
      status: chain ? "ready_to_fetch" : "watch",
      endpointContract: ["/v2/historicalChainTvl", chain ? `/v2/historicalChainTvl/${encodeURIComponent(chain)}` : "/v2/historicalChainTvl/{chain}"],
      confirmedFacts: compact([chain && `chain scope: ${chain}`]),
      missingFacts: ["timeline coverage", "gap count", "daily continuity", "PDF chart lane"],
      riskUse: "Long-horizon DeFi regime context, similar to 2Y/5Y price chart but for chain TVL.",
      customerBoundary: "Historical TVL explains regime context only; it is not a prediction.",
    },
  ];

  const blockedCount = lanes.filter((lane) => lane.status === "blocked").length;
  const readyCount = lanes.filter((lane) => lane.status === "live" || lane.status === "ready_to_fetch").length;

  return {
    version: "pass2446-defillama-expanded-context-v1",
    mode,
    protocolSlug: slug,
    primaryChain: chain,
    lanes,
    scoreImpact: blockedCount >= 4 ? "confidence_only" : readyCount >= 3 ? "review_priority" : "none",
    nextOps: [
      "Add cached fetchers for /summary/fees/{protocol} and /overview/fees before using revenue in Advanced.",
      "Add stablecoin-specific peg/supply lane for USDT/USDC/DAI-style assets.",
      "Add chain TVL timeline chart and show gap count like price charts.",
      "Keep yield data informational and never turn APY into advice or safety copy.",
      "Merge DefiLlama expansion into Source SLA Ribbon and PDF proof capsule.",
    ],
    generatedAt: new Date().toISOString(),
  };
}
