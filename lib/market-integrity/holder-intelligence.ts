import type { TokenRiskResult } from "./risk-types";

type HolderFlowNode = {
  id: "team" | "whales" | "cex" | "dex" | "retail" | "unknown";
  label: string;
  weight: number;
  risk: number;
  confidence: number;
  note: string;
  dataStatus: "live" | "proxy" | "missing";
};

type HolderFlowEdge = {
  from: HolderFlowNode["id"];
  to: HolderFlowNode["id"];
  pressure: number;
  label: string;
};

type ClusterCell = {
  id: string;
  group: HolderFlowNode["id"];
  label: string;
  share: number;
  risk: number;
  confidence: number;
  role: "whale" | "custody" | "liquidity" | "team" | "retail" | "unknown";
  evidence: string;
};

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function finite(value?: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function round(value: number, digits = 0) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

export function buildHolderIntelligence(result: TokenRiskResult) {
  const metrics = result.metrics;
  const token = result.token;
  const marketCap = finite(metrics.marketCap);
  const fdv = finite(metrics.fdv);
  const liquidity = finite(metrics.liquidityUsd);
  const volume = finite(metrics.volume24h);
  const top10 = finite(metrics.top10HolderPercent);
  const holderCount = finite(metrics.holderCount);
  const fdvGap = finite(metrics.fdvToMarketCapRatio) ?? (marketCap && fdv ? fdv / marketCap : undefined);
  const liquidityCoverage = marketCap && liquidity ? (liquidity / marketCap) * 100 : undefined;
  const volumePressure = marketCap && volume ? (volume / marketCap) * 100 : undefined;
  const hasContract = Boolean(token.tokenAddress);
  const inputCount = [top10, holderCount, fdvGap, liquidityCoverage, volumePressure, hasContract ? 1 : undefined]
    .filter((item) => item !== undefined).length;
  const dataCompleteness = clamp(inputCount * 16.7);

  const whaleProxy = top10 ?? (fdvGap && fdvGap > 3 ? 62 : fdvGap && fdvGap > 1.4 ? 42 : 24);
  const cexProxy = holderCount && holderCount > 50000 ? 16 : holderCount && holderCount > 5000 ? 9 : top10 && top10 > 55 ? 22 : 8;
  const teamProxy = fdvGap === undefined ? 14 : fdvGap > 4 ? 28 : fdvGap > 1.8 ? 18 : 9;
  const holderBase = holderCount
    ? holderCount > 100000 ? 12 : holderCount > 10000 ? 24 : holderCount > 1000 ? 44 : 68
    : hasContract ? 48 : 74;
  const unknownProxy = clamp(100 - dataCompleteness + (hasContract ? 0 : 14));

  const concentrationRisk = clamp(whaleProxy * 0.70 + holderBase * 0.22 + teamProxy * 0.08);
  const custodyRisk = clamp(cexProxy * 0.42 + unknownProxy * 0.36 + concentrationRisk * 0.22);
  const teamRisk = fdvGap === undefined ? 45 : clamp((fdvGap - 1) * 30 + teamProxy * 0.72);
  const unlockRisk = fdvGap === undefined ? 35 : clamp((fdvGap - 1) * 34);
  const liquidityExitRisk = liquidityCoverage === undefined ? 42 : liquidityCoverage < 0.5 ? 88 : liquidityCoverage < 2 ? 67 : liquidityCoverage < 5 ? 42 : 18;
  const pressureRisk = volumePressure === undefined ? 36 : volumePressure > 35 ? 82 : volumePressure > 15 ? 62 : volumePressure > 5 ? 34 : 14;
  const dataRisk = 100 - dataCompleteness;
  const dataUncertaintyPercent = Math.round(dataRisk);
  const holderRiskScore = Math.round(
    concentrationRisk * 0.27 + unlockRisk * 0.18 + liquidityExitRisk * 0.22 + pressureRisk * 0.11 + teamRisk * 0.10 + custodyRisk * 0.06 + dataRisk * 0.06,
  );

  const nodes: HolderFlowNode[] = [
    {
      id: "whales",
      label: "Whales / top holders",
      weight: clamp(whaleProxy),
      risk: Math.round(concentrationRisk),
      confidence: top10 !== undefined ? 0.82 : 0.40,
      note: top10 !== undefined ? "Top-holder concentration metric is present; still exclude CEX/custody wallets." : "Top-holder source is not connected; using conservative FDV/float proxy.",
      dataStatus: top10 !== undefined ? "live" : "proxy",
    },
    {
      id: "cex",
      label: "CEX / custody",
      weight: clamp(cexProxy),
      risk: Math.round(custodyRisk),
      confidence: top10 !== undefined && holderCount !== undefined ? 0.48 : 0.24,
      note: "Custody wallets need label enrichment before they are treated as whales or safe float.",
      dataStatus: "proxy",
    },
    {
      id: "dex",
      label: "DEX / LP liquidity",
      weight: liquidityCoverage !== undefined ? clamp(liquidityCoverage * 12) : 18,
      risk: Math.round(liquidityExitRisk),
      confidence: liquidity !== undefined ? 0.76 : 0.32,
      note: liquidityCoverage !== undefined ? "Liquidity coverage compared with market cap." : "Liquidity source missing or unavailable.",
      dataStatus: liquidity !== undefined ? "live" : "missing",
    },
    {
      id: "team",
      label: "Team / treasury",
      weight: clamp(teamProxy),
      risk: Math.round(teamRisk),
      confidence: fdvGap !== undefined ? 0.46 : 0.22,
      note: fdvGap !== undefined ? "FDV/market-cap gap is used as unlock/treasury proxy." : "Team and unlock schedule require project-specific source.",
      dataStatus: fdvGap !== undefined ? "proxy" : "missing",
    },
    {
      id: "retail",
      label: "Retail float",
      weight: holderCount ? clamp(Math.log10(holderCount) * 17) : 18,
      risk: Math.round(holderBase),
      confidence: holderCount !== undefined ? 0.78 : 0.28,
      note: holderCount !== undefined ? "Holder count is present." : "Holder count requires chain-specific source.",
      dataStatus: holderCount !== undefined ? "live" : "missing",
    },
    {
      id: "unknown",
      label: "Unclassified wallets",
      weight: clamp(unknownProxy),
      risk: Math.round(dataRisk),
      confidence: dataCompleteness > 70 ? 0.34 : 0.72,
      note: dataCompleteness > 70 ? "The unclassified-wallet bucket is limited." : "Missing holder data is treated as uncertainty, never as safety.",
      dataStatus: dataCompleteness > 70 ? "proxy" : "missing",
    },
  ];

  const edges: HolderFlowEdge[] = [
    { from: "whales", to: "dex", pressure: Math.round(clamp(concentrationRisk * 0.62 + liquidityExitRisk * 0.38)), label: "possible exit pressure" },
    { from: "team", to: "dex", pressure: Math.round(clamp(teamRisk * 0.58 + liquidityExitRisk * 0.42)), label: "unlock / treasury pressure" },
    { from: "cex", to: "retail", pressure: Math.round(clamp(custodyRisk * 0.46 + pressureRisk * 0.54)), label: "custody flow uncertainty" },
    { from: "unknown", to: "whales", pressure: Math.round(clamp(dataRisk * 0.72 + concentrationRisk * 0.28)), label: "unresolved cluster risk" },
    { from: "retail", to: "dex", pressure: Math.round(clamp(pressureRisk * 0.70 + liquidityExitRisk * 0.30)), label: "volume/liquidity stress" },
  ];

  const clusterMap: ClusterCell[] = nodes.flatMap((node) => {
    const cells = Math.max(2, Math.min(8, Math.round(node.weight / 13)));
    return Array.from({ length: cells }).map((_, index) => {
      const share = round(Math.max(0.8, node.weight / cells) * (0.82 + index / (cells * 4)), 1);
      return {
        id: `${node.id}-${index + 1}`,
        group: node.id,
        label: `${node.label} ${index + 1}`,
        share,
        risk: Math.round(clamp(node.risk * (0.88 + index / (cells * 5)))),
        confidence: round(node.confidence, 2),
        role: node.id === "cex" ? "custody" : node.id === "dex" ? "liquidity" : node.id === "team" ? "team" : node.id === "retail" ? "retail" : node.id === "whales" ? "whale" : "unknown",
        evidence: node.dataStatus === "live" ? "source metric present" : node.dataStatus === "proxy" ? "proxy until labels/API connected" : "missing source — keep uncertainty",
      } satisfies ClusterCell;
    });
  });

  const lanes = [
    {
      id: "concentration",
      label: "Concentration",
      score: Math.round(concentrationRisk),
      value: top10 !== undefined ? `${top10.toFixed(2)}% top 10` : "proxy only",
      nextStep: top10 !== undefined ? "Exclude CEX/custody wallets and cluster related wallets." : "Connect chain holder endpoint and top-wallet clustering.",
    },
    {
      id: "cex",
      label: "CEX / custody labels",
      score: Math.round(custodyRisk),
      value: top10 !== undefined && holderCount !== undefined ? "needs label enrichment" : "proxy only",
      nextStep: "Tag known exchange wallets before interpreting concentration as whale pressure.",
    },
    {
      id: "team",
      label: "Team / unlock",
      score: Math.round(teamRisk),
      value: fdvGap !== undefined ? `${fdvGap.toFixed(2)}x FDV/MC` : "source required",
      nextStep: "Compare circulating supply, locked supply, vesting and treasury wallets.",
    },
    {
      id: "exit",
      label: "Exit liquidity",
      score: Math.round(liquidityExitRisk),
      value: liquidityCoverage !== undefined ? `${liquidityCoverage.toFixed(2)}% liquidity/MC` : "source required",
      nextStep: "Simulate sell impact against DEX and CEX depth.",
    },
    {
      id: "pressure",
      label: "Turnover pressure",
      score: Math.round(pressureRisk),
      value: volumePressure !== undefined ? `${volumePressure.toFixed(2)}% volume/MC` : "source required",
      nextStep: "Check whether volume is organic or concentrated around few venues/pairs.",
    },
  ];

  const missingData = [
    top10 === undefined ? "top holder concentration" : null,
    holderCount === undefined ? "holder count" : null,
    token.tokenAddress ? null : "contract address",
    liquidity === undefined ? "visible liquidity" : null,
    "CEX wallet labels",
    "team/treasury wallet labels",
    "LP lock / remove-liquidity events",
    "source freshness timestamp for holder snapshots",
  ].filter((item): item is string => Boolean(item));

  return {
    version: "velmere-holder-intelligence-v7-pass62-control-plane",
    token: result.token,
    holderRiskScore,
    dataCompleteness: Math.round(dataCompleteness),
    dataUncertaintyPercent,
    uncertainty: dataCompleteness >= 75 ? "low" : dataCompleteness >= 45 ? "medium" : "high",
    verdict: holderRiskScore >= 85 ? "critical_review" : holderRiskScore >= 65 ? "requires_review" : holderRiskScore >= 35 ? "watch" : "clear_under_current_data",
    nodes,
    edges,
    clusterMap,
    lanes,
    missingData,
    sourcePlan: [
      { source: "EVM holders API", purpose: "top wallets, balances, age and transfer graph", status: hasContract ? "ready for integration" : "requires contract address" },
      { source: "CEX label registry", purpose: "exclude exchange/custody wallets from whale classification", status: "planned" },
      { source: "DEX LP events", purpose: "detect LP adds/removes and exit-depth anomalies", status: liquidity !== undefined ? "partial" : "planned" },
      { source: "vesting/treasury registry", purpose: "separate team unlock risk from retail float", status: "planned" },
      { source: "wallet age / transfer graph", purpose: "separate organic retail from fresh sybil clusters", status: "planned" },
    ],
    productionGates: [
      { id: "holder-api", label: "Real holder API", status: hasContract ? "watch" : "blocked", fix: hasContract ? "Connect chain-specific holders endpoint and cache snapshots." : "Missing contract address blocks holder API integration." },
      { id: "wallet-labels", label: "Wallet labels", status: "blocked", fix: "Add CEX/custody/team/treasury/LP label registry before interpreting concentration." },
      { id: "cluster-graph", label: "Cluster graph", status: holderCount !== undefined ? "watch" : "blocked", fix: "Group related wallets, fresh wallets and LP contracts before showing high-confidence clusters." },
      { id: "uncertainty-ui", label: "Uncertainty UI", status: "ready", fix: "Keep unclassified wallets visible and never treat missing data as safety." },
      { id: "source-ledger", label: "Source ledger", status: "watch", fix: "Expose live/partial/fallback mode next to every holder cluster before evidence export." },
    ],
    nextActions: [
      top10 === undefined ? "Connect holder distribution source before trusting holder safety." : "Separate CEX/custody wallets from real whale clusters.",
      "Map top wallets into whales, CEX, DEX/LP, team, retail and unclassified buckets.",
      "Run sell-impact simulation against DEX and CEX depth before classifying exit risk.",
      "Keep language as anomaly/requires review when labels or chain sources are missing.",
    ],
    visualPsychology: {
      layout: "Group wallet roles into compact clusters so the analyst sees concentration, uncertainty and missing labels without panic.",
      trust: "Unclassified wallets stay visible as an explicit bucket; they never disappear into a positive score.",
      nextRead: "The first visual question is whether whale/team/custody labels are real or proxy-only.",
    },
    legalNote: "Holder intelligence is an uncertainty-aware risk signal. It is not legal proof, an accusation or investment advice. Not financial advice. Algorithmic risk flag only.",
    generatedAt: new Date().toISOString(),
  };
}
