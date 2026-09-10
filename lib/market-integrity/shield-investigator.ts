import { sha256Token } from "../security/cryptographic-digest";
import type { TokenRiskResult, RiskSignalId } from "./risk-types";
import { lossPreventionPlaybook } from "./loss-prevention-playbook";

export type InvestigatorEvidenceStatus =
  | "confirmed"
  | "likely"
  | "unverified"
  | "red_flag"
  | "unknown";

export type InvestigatorRiskLaneId =
  | "supply"
  | "unlock"
  | "liquidity"
  | "insider"
  | "social"
  | "contract";

export type InvestigatorRiskLane = {
  id: InvestigatorRiskLaneId;
  label: string;
  /**
   * Evidence-backed adverse-risk score for this lane. `null` means the
   * current source envelope is not sufficient to score the lane. Missing
   * evidence is never converted into a synthetic risk number.
   */
  score: number | null;
  /** Evidence-work priority is separate from adverse-risk severity. */
  reviewPriority: number;
  status: InvestigatorEvidenceStatus;
  headline: string;
  body: string;
  nextStep: string;
};

export type InvestigatorEvidenceRow = {
  label: string;
  status: InvestigatorEvidenceStatus;
  value: string;
  body: string;
};

export type InvestigatorCaseFrame = {
  caseId: string;
  asset: string;
  sourceState: string;
  sourceId: string;
  sourceLabel: string;
  sourceTimestamp: number | null;
  primaryConcern: string;
  missingData: string[];
  operatorMode: "monitor" | "review" | "escalate" | "block_verdict";
};

export type InvestigatorNextAction = {
  id: string;
  label: string;
  priority: "low" | "medium" | "high" | "critical";
  body: string;
  command: string;
};

export type InvestigatorAnswerStep = {
  label: string;
  body: string;
};

export type InvestigatorBehavioralTrap = {
  label: string;
  trigger: string;
  risk: string;
  counterMove: string;
};

export type InvestigatorLossPrevention = {
  thesis: string;
  caseStudy: string;
  caseLesson: string;
  behavioralTrap: InvestigatorBehavioralTrap;
  stableRiskReminder: string;
  whyThisMatters: string;
};

export type InvestigatorProtocol = {
  title: string;
  subtitle: string;
  caseFrame: InvestigatorCaseFrame;
  answerContract: InvestigatorAnswerStep[];
  nextActions: InvestigatorNextAction[];
  lossPrevention: InvestigatorLossPrevention;
  quickVerdict: string;
  finalVerdict:
    | "Insufficient evidence for a reliable verdict"
    | "Likely organic growth"
    | "Mixed: growth may include engineered pressure"
    | "High manipulation risk"
    | "Insufficient transparency — treat as high risk until proven otherwise";
  /** Null until every core lane required for the asset has scorable evidence. */
  overallRisk: number | null;
  /** Missing-evidence workload, never presented as adverse-risk severity. */
  evidenceGapScore: number;
  confidence: "Low" | "Medium" | "High";
  confidenceScore: number;
  redFlags: string[];
  lanes: InvestigatorRiskLane[];
  evidence: InvestigatorEvidenceRow[];
  webRequired: boolean;
  webQueries: string[];
  systemPrompt: string;
};

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function stableSourceId(value: string) {
  return `src-${sha256Token(value, 16)}`;
}

function n(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function compact(value?: number) {
  if (value === undefined || value === null || Number.isNaN(value))
    return "source required";
  const abs = Math.abs(value);
  if (abs >= 1_000_000_000_000)
    return `$${(value / 1_000_000_000_000).toFixed(2)}T`;
  if (abs >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(2)}B`;
  if (abs >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  return `$${value.toFixed(2)}`;
}

function pct(value?: number) {
  if (value === undefined || value === null || Number.isNaN(value))
    return "source required";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(Math.abs(value) >= 10 ? 1 : 2)}%`;
}

function ratioPercent(part?: number, total?: number) {
  if (!part || !total || part <= 0 || total <= 0) return undefined;
  return (part / total) * 100;
}

function hasSignal(result: TokenRiskResult, ids: RiskSignalId[]) {
  return result.signals.some((signal) => ids.includes(signal.id));
}

function evidenceStatus(args: {
  score: number | null;
  missing: boolean;
}): InvestigatorEvidenceStatus {
  if (args.score === null) return "unknown";
  const score = args.score;
  if (score >= 78) return "red_flag";
  if (score >= 58) return "likely";
  if (args.missing) return "unverified";
  return "confirmed";
}

function confidenceLevel(score: number): InvestigatorProtocol["confidence"] {
  if (score >= 72) return "High";
  if (score >= 48) return "Medium";
  return "Low";
}

export function buildVlmShieldInvestigator(
  result: TokenRiskResult,
): InvestigatorProtocol {
  const token = result.token;
  const symbol = token.symbol || "TOKEN";
  const isBitcoin =
    symbol.toUpperCase() === "BTC" || token.marketId === "bitcoin";
  const totalSupply = result.metrics.totalSupply ?? result.metrics.maxSupply;
  const circulatingSupply = result.metrics.circulatingSupply;
  const circulatingPercent = ratioPercent(circulatingSupply, totalSupply);
  const fdv = n(result.metrics.fdv);
  const marketCap = n(result.metrics.marketCap);
  const fdvRatio =
    result.metrics.fdvToMarketCapRatio ??
    (marketCap > 0 && fdv > 0 ? fdv / marketCap : undefined);
  const liquidity = n(result.metrics.liquidityUsd);
  const liquidityCoverage =
    result.metrics.liquidityToMarketCapPercent ??
    (marketCap > 0 && liquidity > 0
      ? (liquidity / marketCap) * 100
      : undefined);
  const holderTop10 = result.metrics.top10HolderPercent;
  const volumeToLiquidity = result.metrics.volumeToLiquidityRatio;
  const volumeToMarketCap = result.metrics.volumeToMarketCapRatio;
  const pump24 = n(result.metrics.priceChange24h);
  const pump7 = n(result.metrics.priceChange7d);
  const contractSignal = hasSignal(result, [
    "contract_privileges",
    "honeypot_risk",
    "high_sell_tax",
    "mint_risk",
    "blacklist_risk",
  ]);
  const supplySignal = hasSignal(result, ["fdv_marketcap_gap", "supply_overhang"]);
  const liquiditySignal = hasSignal(result, [
    "thin_liquidity",
    "very_thin_liquidity",
    "low_dex_liquidity",
    "orderbook_slippage_risk",
    "orderbook_depth_collapse",
  ]);
  const insiderSignal = hasSignal(result, [
    "holder_concentration",
    "exchange_deposit_anomaly",
  ]);
  const socialSignal = hasSignal(result, [
    "parabolic_24h_gain",
    "parabolic_7d_gain",
    "multi_timeframe_pump",
    "volume_spike",
    "wash_trading_risk",
  ]);
  const lowFloat = circulatingPercent !== undefined && circulatingPercent < 18;
  const missingSupply =
    circulatingPercent === undefined && (fdv > 0 || marketCap > 0);
  // There is no vesting/unlock source in TokenRiskResult today. For non-BTC
  // assets the lane is therefore unscored instead of assigning a synthetic
  // penalty merely because the evidence is missing.
  const missingVesting = !isBitcoin;
  const missingContract = !isBitcoin && token.tokenAddress === undefined;
  const supplyEvidenceAvailable =
    circulatingPercent !== undefined || fdvRatio !== undefined || supplySignal;
  const liquidityEvidenceAvailable =
    liquidityCoverage !== undefined ||
    volumeToLiquidity !== undefined ||
    (typeof result.metrics.simulatedSlippage10k === "number" &&
      Number.isFinite(result.metrics.simulatedSlippage10k)) ||
    liquiditySignal;
  const insiderEvidenceAvailable = holderTop10 !== undefined || insiderSignal;
  const socialEvidenceAvailable =
    (typeof result.metrics.priceChange24h === "number" &&
      Number.isFinite(result.metrics.priceChange24h)) ||
    (typeof result.metrics.priceChange7d === "number" &&
      Number.isFinite(result.metrics.priceChange7d)) ||
    volumeToMarketCap !== undefined ||
    socialSignal;
  const contractEvidenceAvailable = isBitcoin || contractSignal;

  const supplyRiskObserved = clamp(
    (lowFloat ? 42 : 0) +
      (fdvRatio && fdvRatio > 8 ? 28 : fdvRatio && fdvRatio > 3 ? 18 : 0) +
      (supplySignal ? 24 : 0),
  );
  const supplyRisk = supplyEvidenceAvailable ? supplyRiskObserved : null;

  const unlockRisk = isBitcoin
    ? clamp(
          (hasSignal(result, ["supply_overhang"]) ? 18 : 0),
      )
    : null;

  const liquidityRiskObserved = clamp(
    (liquidityCoverage === undefined
      ? 0
      : liquidityCoverage < 0.8
        ? 42
        : liquidityCoverage < 2
          ? 30
          : liquidityCoverage < 5
            ? 18
            : 4) +
      (volumeToLiquidity && volumeToLiquidity > 25
        ? 34
        : volumeToLiquidity && volumeToLiquidity > 8
          ? 20
          : 0) +
      (result.metrics.simulatedSlippage10k &&
      result.metrics.simulatedSlippage10k > 4
        ? 18
        : 0) +
      (liquiditySignal ? 25 : 0),
  );
  const liquidityRisk = liquidityEvidenceAvailable
    ? liquidityRiskObserved
    : null;

  const insiderRiskObserved = clamp(
    (holderTop10 === undefined
      ? 0
      : holderTop10 > 65
        ? 44
        : holderTop10 > 45
          ? 30
          : holderTop10 > 30
            ? 15
            : 4) +
      (insiderSignal ? 28 : 0) +
      (lowFloat ? 10 : 0),
  );
  const insiderRisk = insiderEvidenceAvailable ? insiderRiskObserved : null;

  const socialManipulationRiskObserved = clamp(
    (pump24 > 40 ? 32 : pump24 > 18 ? 20 : 0) +
      (pump7 > 120 ? 30 : pump7 > 55 ? 18 : 0) +
      (volumeToMarketCap && volumeToMarketCap > 1.2
        ? 22
        : volumeToMarketCap && volumeToMarketCap > 0.45
          ? 12
          : 0) +
      (socialSignal ? 30 : 0),
  );
  const socialManipulationRisk = socialEvidenceAvailable
    ? socialManipulationRiskObserved
    : null;

  const contractRisk = isBitcoin
    ? 0
    : contractEvidenceAvailable
      ? clamp(contractSignal ? 56 : 0)
      : null;

  const supplyReviewPriority = clamp((supplyRisk ?? 0) + (missingSupply ? 38 : 8));
  const unlockReviewPriority = isBitcoin ? 18 : 92;
  const liquidityReviewPriority = clamp((liquidityRisk ?? 0) + (liquidityRisk === null ? 88 : 8));
  const insiderReviewPriority = clamp((insiderRisk ?? 0) + (insiderRisk === null ? 86 : 8));
  const socialReviewPriority = clamp((socialManipulationRisk ?? 0) + (socialManipulationRisk === null ? 68 : 6));
  const contractReviewPriority = isBitcoin
    ? 18
    : clamp((contractRisk ?? 0) + (contractRisk === null ? 84 : 10));

  const lanes: InvestigatorRiskLane[] = [
    {
      id: "supply",
      label: "Supply / float",
      score: supplyRisk,
      reviewPriority: supplyReviewPriority,
      status: evidenceStatus({ score: supplyRisk, missing: missingSupply }),
      headline: lowFloat
        ? "LOW FLOAT RISK"
        : missingSupply
          ? "Supply transparency incomplete"
          : "Supply data usable",
      body:
        circulatingPercent === undefined
          ? `Circulating float is not fully confirmed. FDV ${compact(fdv)} vs market cap ${compact(marketCap)} is shown as context; missing float evidence lowers certainty and does not create adverse-risk points by itself.`
          : `${circulatingPercent.toFixed(2)}% of total/max supply appears circulating. Low float makes price easier to move with less capital.`,
      nextStep:
        "Verify supply from explorer, token contract and independent market-data source.",
    },
    {
      id: "unlock",
      label: "Vesting / unlocks",
      score: unlockRisk,
      reviewPriority: unlockReviewPriority,
      status: isBitcoin ? "confirmed" : "unknown",
      headline: isBitcoin
        ? "Protocol issuance replaces team vesting"
        : "Unlock transparency must be proven",
      body: isBitcoin
        ? "Bitcoin has no issuer-controlled team vesting schedule. Review protocol issuance, miner supply and large-holder flows instead of applying a generic token-unlock model."
        : "No local source confirms team, investor, advisor, OTC or hidden whale unlocks. This is an evidence gap: the lane remains unscored until a current source is attached.",
      nextStep: isBitcoin
        ? "Verify current issuance, miner flows and long-term holder supply from current on-chain sources."
        : `Search: ${symbol} token unlock schedule, vesting, OTC allocation, cliff extension.`,
    },
    {
      id: "liquidity",
      label: "Liquidity / exits",
      score: liquidityRisk,
      reviewPriority: liquidityReviewPriority,
      status: evidenceStatus({
        score: liquidityRisk,
        missing: liquidityCoverage === undefined,
      }),
      headline:
        liquidityCoverage !== undefined
          ? `${liquidityCoverage.toFixed(2)}% liquidity coverage`
          : "Liquidity depth incomplete",
      body: `Visible liquidity ${compact(liquidity)}. Volume/liquidity ${volumeToLiquidity ? volumeToLiquidity.toFixed(2) : "source required"}. Exit depth must be checked before trusting the move.`,
      nextStep:
        "Compare DEX pool depth, CEX orderbook, slippage simulation and volume quality.",
    },
    {
      id: "insider",
      label: "Whales / insiders",
      score: insiderRisk,
      reviewPriority: insiderReviewPriority,
      status: evidenceStatus({
        score: insiderRisk,
        missing: holderTop10 === undefined,
      }),
      headline:
        holderTop10 !== undefined
          ? `Top 10 holders proxy ${holderTop10.toFixed(1)}%`
          : "Holder concentration missing",
      body: "Unclassified wallets, team wallets and CEX custody must be separated before calling distribution healthy.",
      nextStep:
        "Cluster holders into team, CEX, LP, treasury, whales, retail and unclassified.",
    },
    {
      id: "social",
      label: "Social / KOL hype",
      score: socialManipulationRisk,
      reviewPriority: socialReviewPriority,
      status:
        socialManipulationRisk === null
          ? "unknown"
          : socialManipulationRisk >= 62
          ? "red_flag"
          : socialManipulationRisk >= 35
            ? "likely"
            : "unknown",
      headline:
        pump24 > 18 || pump7 > 55
          ? "Pump requires OSINT review"
          : "No strong pump signal locally",
      body: `24h ${pct(result.metrics.priceChange24h)}, 7d ${pct(result.metrics.priceChange7d)}. Check KOL disclosures, sponsored threads and coordinated hype before trusting sentiment.`,
      nextStep: `Search X/news/forums for ${symbol} shill, paid KOL, controversy, manipulation, buyback, short squeeze.`,
    },
    {
      id: "contract",
      label: "Contract / governance",
      score: contractRisk,
      reviewPriority: contractReviewPriority,
      status: isBitcoin
        ? "confirmed"
        : contractSignal
          ? "red_flag"
          : "unknown",
      headline: isBitcoin
        ? "No issuer token contract"
        : contractSignal
          ? "Contract privilege signal present"
          : "Contract risk not fully cleared",
      body: isBitcoin
        ? "Bitcoin is a native protocol asset, not an owner-controlled token contract. The relevant risks are protocol, custody, bridge and wrapped-asset exposure."
        : "Audit, owner privileges, upgradeability, mint, blacklist, taxes and pause functions need direct explorer verification.",
      nextStep: isBitcoin
        ? "Separate native BTC risk from exchange custody, bridge and wrapped-BTC contract risk."
        : "Verify contract source, owner, proxy/admin, tax settings, mint authority and audit status.",
    },
  ];

  const laneWeights: Record<InvestigatorRiskLaneId, number> = {
    supply: 0.16,
    unlock: 0.18,
    liquidity: 0.2,
    insider: 0.17,
    social: 0.15,
    contract: 0.14,
  };
  const allCoreLanesScorable = lanes.every((lane) => lane.score !== null);
  const overallRisk = allCoreLanesScorable
    ? clamp(
        lanes.reduce(
          (total, lane) => total + (lane.score ?? 0) * laneWeights[lane.id],
          0,
        ),
      )
    : null;
  const evidenceGapScore = clamp(
    (lanes.filter((lane) => lane.score === null).length / lanes.length) * 100,
  );

  const missingPenalty =
    [
      missingSupply,
      missingVesting,
      holderTop10 === undefined,
      liquidityCoverage === undefined,
      missingContract,
    ].filter(Boolean).length * 8;
  const baseConfidence =
    typeof result.confidence === "number" && Number.isFinite(result.confidence)
      ? result.confidence * 100
      : 0;
  const confidenceScore = clamp(
    baseConfidence -
      missingPenalty +
      (result.dataQuality === "live"
        ? 12
        : result.dataQuality === "partial"
          ? 2
          : -10),
  );
  const redFlags = lanes
    .filter(
      (lane) =>
        lane.status === "red_flag" ||
        (lane.score !== null && lane.score >= 70),
    )
    .map((lane) => `${lane.label}: ${lane.headline}`)
    .slice(0, 8);

  const missingCoreEvidence = lanes.filter((lane) => lane.score === null).length;

  const finalVerdict: InvestigatorProtocol["finalVerdict"] =
    overallRisk === null || missingCoreEvidence > 0
      ? "Insufficient evidence for a reliable verdict"
      : confidenceScore < 38 || redFlags.length >= 4
        ? "Insufficient transparency — treat as high risk until proven otherwise"
        : overallRisk >= 72
          ? "High manipulation risk"
          : overallRisk >= 45
            ? "Mixed: growth may include engineered pressure"
            : "Likely organic growth";

  const quickVerdict = `${symbol}: ${finalVerdict}. ${overallRisk === null ? "Adverse-risk score withheld until every core lane has sufficient evidence" : `Observed adverse-risk score ${overallRisk}/100`}, confidence ${confidenceLevel(confidenceScore)}.`;

  const webQueries = isBitcoin
    ? [
        "Bitcoin circulating supply issuance schedule miner reserves",
        "Bitcoin exchange reserves ETF flows liquidity orderbook",
        "Bitcoin long term holder supply whale concentration",
        "Bitcoin derivatives funding open interest liquidation risk",
        "Bitcoin custody bridge wrapped BTC contract risk",
      ]
    : [
        `${symbol} token circulating supply total supply FDV market cap`,
        `${symbol} token unlock schedule vesting team investors advisors OTC`,
        `${symbol} buyback short squeeze market maker volume spike`,
        `${symbol} KOL paid promotion shill controversy scam allegations`,
        token.tokenAddress
          ? `${token.tokenAddress} contract audit owner mint blacklist tax honeypot`
          : `${symbol} contract audit owner mint blacklist tax honeypot`,
      ];

  const evidence: InvestigatorEvidenceRow[] = [
    {
      label: "Float",
      status:
        circulatingPercent === undefined
          ? "unknown"
          : lowFloat
            ? "red_flag"
            : "confirmed",
      value:
        circulatingPercent === undefined
          ? "source required"
          : `${circulatingPercent.toFixed(2)}%`,
      body: "Compare circulating supply to total/max supply. Low float can make aggressive price moves easier.",
    },
    {
      label: "FDV gap",
      status:
        fdvRatio === undefined
          ? "unknown"
          : fdvRatio > 3
            ? "red_flag"
            : "confirmed",
      value:
        fdvRatio === undefined ? "source required" : `${fdvRatio.toFixed(2)}x`,
      body: "Large FDV/market-cap gaps can indicate future supply overhang and unlock pressure.",
    },
    {
      label: "Vesting",
      status: isBitcoin ? "confirmed" : "unknown",
      value: isBitcoin ? "protocol issuance" : "needs web OSINT",
      body: isBitcoin
        ? "Bitcoin issuance follows protocol rules; miner and holder flows remain the relevant supply-pressure checks."
        : "No current source proves the team/investor/advisor unlock schedule. The gap blocks this lane from receiving a numeric risk score; absence is not an adverse finding by itself.",
    },
    {
      label: "Liquidity",
      status:
        liquidityCoverage === undefined
          ? "unknown"
          : liquidityRisk !== null && liquidityRisk > 60
            ? "red_flag"
            : "likely",
      value:
        liquidityCoverage === undefined
          ? "source required"
          : `${liquidityCoverage.toFixed(2)}%`,
      body: "Coverage and slippage determine whether holders can exit without severe price impact.",
    },
    {
      label: "KOL / social",
      status:
        socialManipulationRisk === null
          ? "unknown"
          : socialManipulationRisk > 55
            ? "likely"
            : "unknown",
      value:
        socialManipulationRisk === null
          ? "source required"
          : `${socialManipulationRisk}/100`,
      body: "Requires current search across X, forums and articles. Treat undisclosed promotions as KOL disclosure risk.",
    },
    {
      label: "Contract",
      status: isBitcoin ? "confirmed" : contractSignal ? "red_flag" : "unknown",
      value: isBitcoin
        ? "native protocol"
        : token.tokenAddress
          ? "address present"
          : "missing address",
      body: isBitcoin
        ? "Native BTC has no issuer-controlled token owner; custody and wrapped versions must be reviewed separately."
        : "Contract privileges must be verified directly from explorer/audit sources.",
    },
  ];

  const missingData = [
    missingSupply ? "circulating / total supply confirmation" : null,
    missingVesting ? "team / investor / advisor unlock schedule" : null,
    holderTop10 === undefined
      ? "holder concentration and wallet clustering"
      : null,
    liquidityCoverage === undefined
      ? "exit liquidity and slippage depth"
      : null,
    missingContract ? "contract address / explorer verification" : null,
  ].filter((item): item is string => Boolean(item));

  const primaryConcern =
    lanes.slice().sort((a, b) => b.reviewPriority - a.reviewPriority)[0]?.label ??
    "source uncertainty";
  const operatorMode: InvestigatorCaseFrame["operatorMode"] =
    finalVerdict === "Insufficient evidence for a reliable verdict" ||
    finalVerdict ===
      "Insufficient transparency — treat as high risk until proven otherwise"
      ? "block_verdict"
      : overallRisk !== null && overallRisk >= 72
        ? "escalate"
        : overallRisk !== null && overallRisk >= 45
          ? "review"
          : "monitor";

  const sourceLabel =
    result.dataSources.filter(Boolean).join(" + ") || result.dataQuality;
  const parsedSourceTimestamp = Number.isFinite(Date.parse(result.generatedAt))
    ? Math.round(Date.parse(result.generatedAt) / 1000)
    : null;
  const caseFrame: InvestigatorCaseFrame = {
    caseId: `${symbol.toLowerCase()}-${String(result.generatedAt ?? Date.now()).slice(0, 10)}`,
    asset: `${token.name ?? symbol} (${symbol})`,
    sourceState: result.dataQuality,
    sourceId: stableSourceId(sourceLabel),
    sourceLabel,
    sourceTimestamp: parsedSourceTimestamp,
    primaryConcern,
    missingData,
    operatorMode,
  };

  const nextActionsUnsorted: InvestigatorNextAction[] = [
    {
      id: "verify-supply",
      label: "Verify supply",
      priority: missingSupply || lowFloat ? "high" : "medium",
      body: "Confirm circulating, total and max supply against explorer and at least one market-data source.",
      command: `Search ${symbol} circulating supply total supply FDV market cap explorer`,
    },
    isBitcoin
      ? {
          id: "inspect-unlocks",
          label: "Review issuance and flows",
          priority: "high",
          body: "Check miner supply, exchange reserves, ETF flows and long-term-holder distribution instead of a token vesting calendar.",
          command:
            "Review Bitcoin issuance, miner reserves, exchange balances and ETF flows",
        }
      : {
          id: "inspect-unlocks",
          label: "Inspect unlocks",
          priority: "critical",
          body: "Find team, investor, advisor, ecosystem, OTC and whale unlock schedules before trusting any pump.",
          command: `Search ${symbol} unlock schedule vesting team investors OTC cliff`,
        },
    {
      id: "check-liquidity",
      label: "Check liquidity",
      priority:
        liquidityRisk === null
          ? "high"
          : liquidityRisk >= 65
            ? "high"
            : "medium",
      body: "Compare DEX depth, CEX order book, spread and slippage so the move is not just thin liquidity.",
      command: `Review ${symbol} DEX liquidity CEX orderbook slippage volume quality`,
    },
    {
      id: "review-kol",
      label: "Review KOL/social",
      priority:
        socialManipulationRisk !== null && socialManipulationRisk >= 55
          ? "high"
          : "medium",
      body: "Search for paid promotions, undisclosed allocations, coordinated hype and controversy.",
      command: `Search ${symbol} KOL paid promotion shill controversy manipulation allegations`,
    },
    isBitcoin
      ? {
          id: "audit-contract",
          label: "Separate custody risk",
          priority: "medium",
          body: "Review exchange custody, bridges and wrapped-BTC contracts separately from native Bitcoin protocol risk.",
          command: "Review BTC custody, bridge and wrapped-token exposure",
        }
      : {
          id: "audit-contract",
          label: "Audit contract",
          priority:
            contractRisk === null
              ? "high"
              : contractRisk >= 60
                ? "high"
                : "medium",
          body: "Verify owner, proxy, mint, blacklist, pause, taxes and audit status from explorer/audit sources.",
          command: token.tokenAddress
            ? `Inspect ${token.tokenAddress} contract owner proxy mint blacklist tax audit`
            : `Find ${symbol} contract address and audit`,
        },
  ];
  const nextActions = nextActionsUnsorted.sort((a, b) => {
    const rank: Record<InvestigatorNextAction["priority"], number> = {
      critical: 4,
      high: 3,
      medium: 2,
      low: 1,
    };
    return rank[b.priority] - rank[a.priority];
  });

  const behavioralTrap =
    (socialManipulationRisk !== null && socialManipulationRisk >= 55) ||
    pump24 > 18 ||
    pump7 > 55
      ? lossPreventionPlaybook.behavioralTraps[0]
      : overallRisk !== null && overallRisk >= 60
        ? lossPreventionPlaybook.behavioralTraps[2]
        : lossPreventionPlaybook.behavioralTraps[1];
  const caseStudy =
    lowFloat || (unlockRisk !== null && unlockRisk >= 60)
      ? lossPreventionPlaybook.caseStudies[1]
      : socialManipulationRisk !== null && socialManipulationRisk >= 55
        ? lossPreventionPlaybook.caseStudies[2]
        : lossPreventionPlaybook.caseStudies[0];
  const stableHabit = lossPreventionPlaybook.riskHabits[0];

  const lossPrevention: InvestigatorLossPrevention = {
    thesis: lossPreventionPlaybook.thesis,
    caseStudy: caseStudy.title,
    caseLesson: caseStudy.lesson,
    behavioralTrap: {
      label: behavioralTrap.label,
      trigger: behavioralTrap.trigger,
      risk: behavioralTrap.risk,
      counterMove: behavioralTrap.counterMove,
    },
    stableRiskReminder: stableHabit.body,
    whyThisMatters:
      "Most catastrophic crypto losses happen when a user mistakes momentum for proof. Shield slows the decision down, exposes missing data and forces the thesis to survive supply, unlock, liquidity, social and contract checks.",
  };

  const answerContract: InvestigatorAnswerStep[] = [
    { label: "Quick verdict", body: quickVerdict },
    {
      label: "Key red flags",
      body: redFlags.length
        ? redFlags.slice(0, 3).join(" · ")
        : "No hard local red flag, but final verdict still needs live OSINT.",
    },
    {
      label: "Evidence status",
      body: evidence.map((item) => `${item.label}: ${item.status}`).join(" · "),
    },
    {
      label: "Missing data",
      body: missingData.length
        ? missingData.join(" · ")
        : "No core missing-data blocker in local model.",
    },
    {
      label: "Psychology trap",
      body: `${behavioralTrap.label}: ${behavioralTrap.risk}`,
    },
    { label: "Loss-prevention note", body: lossPrevention.whyThisMatters },
    {
      label: "Next action",
      body: nextActions[0]?.command ?? `Run full OSINT for ${symbol}.`,
    },
  ];

  const systemPrompt = `You are VLM Shield Investigator, an OSINT-style crypto risk analyst and loss-prevention assistant. You must use current web sources for token-specific analysis. Do not hype. Do not call something a scam or manipulation unless evidence supports it. Classify every major claim as Confirmed, Likely, Unverified, Red Flag, or Unknown. Analyze supply/float, vesting/unlocks, buybacks/short squeeze, liquidity, KOL/social hype, contract/governance and evidence quality. Missing transparency is an evidence gap: lower confidence or withhold the affected score, but never convert absence alone into a numeric adverse finding. Token: ${symbol}. Case mode: ${operatorMode}. Primary concern: ${primaryConcern}. Missing data: ${missingData.join(", ") || "none in local model"}. Required web searches: ${webQueries.join(" | ")}. Explain why the checks matter for preventing avoidable losses. Explain the behavioral trap when users chase parabolic tokens. Prefer risk control, position limits, stable compounding and evidence over lottery thinking. Do not give buy/sell instructions. Return concise sections: Quick Verdict, Key Red Flags, Supply/Float, Vesting/Unlocks, Liquidity/Market Structure, Social/KOL Risk, Contract/Governance Risk, Psychology Trap, VLM Shield Score, Final Verdict and one next action.`;

  return {
    title: "VLM Shield Investigator",
    subtitle:
      "OSINT-style on-chain risk protocol · web-search required for final token verdict",
    caseFrame,
    answerContract,
    nextActions,
    lossPrevention,
    quickVerdict,
    finalVerdict,
    overallRisk,
    evidenceGapScore,
    confidence: confidenceLevel(confidenceScore),
    confidenceScore,
    redFlags: redFlags.length
      ? redFlags
      : [
          "No hard red flag confirmed locally — still require live web OSINT before final verdict.",
        ],
    lanes,
    evidence,
    webRequired: true,
    webQueries,
    systemPrompt,
  };
}
