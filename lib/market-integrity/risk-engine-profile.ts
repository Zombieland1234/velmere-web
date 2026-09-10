import type {
  RiskLevel,
  TokenRiskInput,
  TokenRiskResult,
  TokenRiskSignal,
} from "./risk-types";

export type AssetMode = "standard" | "stablecoin" | "rwa" | "meme" | "unknown";

export type AssetProfile = {
  mode: AssetMode;
  volatilityWeight: number;
  volumeAnomalyWeight: number;
  expectedPegUsd?: number;
  reviewFocus: string;
  isPeggedAsset: boolean;
  missingDataWeight: number;
  liquiditySensitivity: number;
};

export type DataConsistency = {
  hasImpossibleValue: boolean;
  hasSupplyConflict: boolean;
};

const LEVEL_RANK: Record<RiskLevel, number> = {
  low: 0,
  medium: 1,
  high: 2,
  critical: 3,
};
export function clamp(value: number, min = 0, max = 100) {
  return Math.min(max, Math.max(min, value));
}

export function levelFromScore(score: number): RiskLevel {
  if (score >= 85) return "critical";
  if (score >= 65) return "high";
  if (score >= 35) return "medium";
  return "low";
}

export function badgeFromLevel(level: RiskLevel): TokenRiskResult["badge"] {
  if (level === "critical") return "critical_market_integrity_risk";
  if (level === "high") return "possible_manipulation_risk";
  if (level === "medium") return "elevated_risk";
  return "low_detected_risk";
}

export function finiteNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : undefined;
}

export function hasFiniteNumber(value: unknown) {
  return finiteNumber(value) !== undefined;
}

export function hasBoolean(value: unknown) {
  return typeof value === "boolean";
}

export function rounded(value: number, digits = 2) {
  return Number(value.toFixed(digits));
}

export function addSignal(signals: TokenRiskSignal[], signal: TokenRiskSignal) {
  const existing = signals.find((item) => item.id === signal.id);
  if (!existing) {
    signals.push(signal);
    return;
  }

  existing.metrics = {
    ...(existing.metrics ?? {}),
    ...(signal.metrics ?? {}),
  };

  if (
    signal.points > existing.points ||
    (signal.points === existing.points &&
      LEVEL_RANK[signal.severity] > LEVEL_RANK[existing.severity])
  ) {
    existing.points = signal.points;
    existing.severity = signal.severity;
  }
}

export function sourceFamilyKey(source: string) {
  const lowered = source.trim().toLowerCase();
  // PASS2279: quote/chart/history endpoints from the same market vendor are one source family.
  if (lowered.includes("yahoo")) return "Yahoo Finance market adapter";
  if (lowered.includes("stooq")) return "Stooq quote adapter";
  if (lowered.includes("coingecko")) return "CoinGecko market adapter";
  if (lowered.includes("dexscreener")) return "DexScreener market adapter";
  if (lowered.includes("binance")) return "Binance market adapter";
  if (lowered.includes("velmère") || lowered.includes("velmere") || lowered.includes("internal")) return "Velmère deterministic engine";
  return source.trim();
}

export function uniqueDataSources(input: TokenRiskInput) {
  const normalized = (input.dataSources ?? [])
    .map((source) => sourceFamilyKey(source))
    .filter((source) => source.length > 0);
  return Array.from(new Set(normalized));
}

export function sourceMode(input: TokenRiskInput, dataQuality: TokenRiskResult["dataQuality"]) {
  const count = uniqueDataSources(input).length;
  return `${dataQuality}; ${count} attached source${count === 1 ? "" : "s"}`;
}

export function detectAssetProfile(input: TokenRiskInput): AssetProfile {
  const label = `${input.symbol} ${input.name}`.toLowerCase();
  const normalizedLabel = label.replace(/\s+/g, " ").trim();
  const unknownPattern =
    /(^|[^a-z0-9])(unknown|unverified|unlisted|untitled|new token|new pair|test token|n\/a|na)([^a-z0-9]|$)/;
  const usdPegPattern =
    /(^|[^a-z0-9])(usdt|usdc|dai|busd|tusd|usde|fdusd|pyusd|rlusd|usdp|usds|usdl|usdg|usd0|usdx|frax|lusd|gusd|crvusd|usdd|gho|usd coin|tether|stable usd)([^a-z0-9]|$)/;
  const stablecoinPattern =
    /stablecoin|stable coin|(^|[^a-z0-9])(eurc|eurt|eurs|euroc|ageur|eurd|xsgd|stable eur|stable euro)([^a-z0-9]|$)/;
  const rwaPattern =
    /tokeni[sz]ed|real[- ]world|\brwa\b|treasury|treasury bill|t-bill|tbill|money market|government bond|government securities|tokeni[sz]ed stock|tokeni[sz]ed fund|bond fund|on-chain treasury|short[- ]term bond|blackrock|\bbuidl\b|\busdy\b|\bondo\b|\bousg\b|\bbenji\b|superstate/;
  const memePattern =
    /(^|[^a-z0-9])(meme|memecoin|pepe|shib|shiba|doge|dogecoin|floki|bonk|wif|mog|inu|wojak|turbo|frog|cat token|dog token|baby doge|snek|popcat|brett)([^a-z0-9]|$)/;

  if (normalizedLabel.length < 3 || unknownPattern.test(label)) {
    return {
      mode: "unknown",
      volatilityWeight: 0.9,
      volumeAnomalyWeight: 1,
      reviewFocus: "asset classification and source ledger",
      isPeggedAsset: false,
      missingDataWeight: 1.35,
      liquiditySensitivity: 1,
    };
  }

  if (usdPegPattern.test(label)) {
    return {
      mode: "stablecoin",
      volatilityWeight: 0.45,
      volumeAnomalyWeight: 0.45,
      expectedPegUsd: 1,
      reviewFocus: "peg, issuer and reserve proof",
      isPeggedAsset: true,
      missingDataWeight: 1.15,
      liquiditySensitivity: 0.7,
    };
  }
  if (stablecoinPattern.test(label)) {
    return {
      mode: "stablecoin",
      volatilityWeight: 0.45,
      volumeAnomalyWeight: 0.45,
      reviewFocus: "issuer, reserve and redemption proof",
      isPeggedAsset: true,
      missingDataWeight: 1.15,
      liquiditySensitivity: 0.7,
    };
  }
  if (rwaPattern.test(label)) {
    return {
      mode: "rwa",
      volatilityWeight: 0.65,
      volumeAnomalyWeight: 0.65,
      reviewFocus: "issuer, redemption and custody proof",
      isPeggedAsset: false,
      missingDataWeight: 1.2,
      liquiditySensitivity: 0.85,
    };
  }
  if (memePattern.test(label)) {
    return {
      mode: "meme",
      volatilityWeight: 0.95,
      volumeAnomalyWeight: 1.2,
      reviewFocus: "social/KOL source ledger, holder labels and exit depth",
      isPeggedAsset: false,
      missingDataWeight: 1.25,
      liquiditySensitivity: 1.2,
    };
  }
  return {
    mode: "standard",
    volatilityWeight: 1,
    volumeAnomalyWeight: 1,
    reviewFocus: "market-integrity evidence",
    isPeggedAsset: false,
    missingDataWeight: 1,
    liquiditySensitivity: 1,
  };
}


export function normalizedSymbol(input: TokenRiskInput) {
  return String(input.symbol || "").trim().toUpperCase().replace(/\s+/g, "");
}

export function resolveInputAssetClass(input: TokenRiskInput): NonNullable<TokenRiskInput["assetClass"]> {
  if (input.assetClass) return input.assetClass;
  const symbol = normalizedSymbol(input);
  const label = `${input.symbol} ${input.name}`.toLowerCase();
  if (/\^gspc|s&p500|sp500|s&p 500|nasdaq|\^ndx|\^dji|dax|stoxx|nikkei|vix/.test(label) || symbol.startsWith("^")) return "index";
  if (/eurusd|eur\/usd|usd\/jpy|gbp\/usd|eur\/pln|=x$/.test(label) || symbol.includes("/")) return "fx";
  if (/gold|silver|copper|wti|brent|crude|natural gas|natgas|commodity|=f$/.test(label)) return "commodity";
  if (/\betf\b|\bspy\b|\bqqq\b|\bvoo\b|\btlt\b|\bgld\b|\bvnq\b|\biyr\b|\bxlre\b|\bhyg\b/.test(label)) return "etf";
  if (/reit|real estate|\bpld\b/.test(label)) return "real_estate";
  if (/stock|equity|nvidia|apple|microsoft|alphabet|amazon|tesla|meta platforms|lvmh|adidas|bmw|mercedes|visa|mastercard/.test(label)) return "stock";
  return "crypto";
}

export function isRealMarketLike(input: TokenRiskInput) {
  const assetClass = resolveInputAssetClass(input);
  return assetClass !== "crypto" && assetClass !== "unknown";
}

export function isLargeNativeCrypto(input: TokenRiskInput) {
  const symbol = normalizedSymbol(input);
  return [
    "BTC", "BITCOIN", "ETH", "ETHEREUM", "SOL", "SOLANA", "BNB", "XRP",
    "DOGE", "DOGECOIN", "ADA", "CARDANO", "LTC", "LITECOIN", "TRX", "TRON",
    "TON", "TONCOIN", "DOT", "POLKADOT", "NEAR", "ATOM", "COSMOS", "AVAX", "AVALANCHE"
  ].includes(symbol);
}

export function requiresTokenContractLane(input: TokenRiskInput) {
  if (isRealMarketLike(input)) return false;
  if (isLargeNativeCrypto(input)) return false;
  return true;
}

export function requiresHolderLane(input: TokenRiskInput) {
  if (isRealMarketLike(input)) return false;
  if (isLargeNativeCrypto(input)) return false;
  return true;
}

export function requiresSupplyLane(input: TokenRiskInput) {
  if (isRealMarketLike(input)) return false;
  return true;
}

export function requiresDexLiquidityLane(input: TokenRiskInput) {
  if (isRealMarketLike(input)) return false;
  if (isLargeNativeCrypto(input)) return false;
  return true;
}

export function requiresOrderbookLane(input: TokenRiskInput) {
  if (isRealMarketLike(input)) return false;
  if (isLargeNativeCrypto(input)) return false;
  return true;
}

export function adjustedPoints(points: number, weight: number) {
  return Math.max(1, Math.round(points * weight));
}

export function hasContractCoverage(input: TokenRiskInput) {
  return [
    input.suspiciousContractPrivileges,
    input.isHoneypot,
    input.canMintNewTokens,
    input.canPauseTrading,
    input.canBlacklist,
  ].some(hasBoolean);
}

export function hasOrderbookCoverage(input: TokenRiskInput) {
  return [
    input.simulatedSlippage10k,
    input.bidAskImbalancePercent,
    input.orderBookDepthDropPercent,
  ].some(hasFiniteNumber);
}

export function hasHolderCoverage(input: TokenRiskInput) {
  return [input.top10HolderPercent, input.holderCount].some(hasFiniteNumber);
}

export function hasSupplyCoverage(input: TokenRiskInput) {
  const circulatingSupply = finiteNumber(input.circulatingSupply);
  const totalSupply = finiteNumber(input.totalSupply);
  const maxSupply = finiteNumber(input.maxSupply);
  return (
    circulatingSupply !== undefined &&
    ((maxSupply !== undefined && maxSupply > 0) ||
      (totalSupply !== undefined && totalSupply > 0))
  );
}

export function inspectDataConsistency(input: TokenRiskInput): DataConsistency {
  const circulatingSupply = finiteNumber(input.circulatingSupply);
  const totalSupply = finiteNumber(input.totalSupply);
  const maxSupply = finiteNumber(input.maxSupply);
  const hasImpossibleValue = [
    input.currentPrice,
    input.marketCap,
    input.fdv,
    input.liquidityUsd,
    input.volume24h,
    input.averageVolume7d,
    input.circulatingSupply,
    input.totalSupply,
    input.maxSupply,
    input.holderCount,
  ].some((value) => {
    const number = finiteNumber(value);
    return number !== undefined && number < 0;
  });
  const hasImpossiblePercent = [
    input.top10HolderPercent,
    input.buyTaxPercentage,
    input.sellTaxPercentage,
  ].some((value) => {
    const number = finiteNumber(value);
    return number !== undefined && (number < 0 || number > 100);
  });
  const hasSupplyConflict =
    (circulatingSupply !== undefined &&
      totalSupply !== undefined &&
      circulatingSupply > totalSupply) ||
    (circulatingSupply !== undefined &&
      maxSupply !== undefined &&
      circulatingSupply > maxSupply) ||
    (totalSupply !== undefined &&
      maxSupply !== undefined &&
      totalSupply > maxSupply);

  return {
    hasImpossibleValue: hasImpossibleValue || hasImpossiblePercent,
    hasSupplyConflict,
  };
}

export function hasHistoryCoverage(input: TokenRiskInput) {
  return (
    (input.sparkline7d?.length ?? 0) >= 2 ||
    [
      input.priceChange1h,
      input.priceChange6h,
      input.priceChange24h,
      input.priceChange7d,
      input.priceChange14d,
      input.priceChange30d,
    ].filter(hasFiniteNumber).length >= 3
  );
}

export function missingCoreFieldNames(input: TokenRiskInput) {
  const names: string[] = [];
  const assetClass = resolveInputAssetClass(input);
  if (!hasFiniteNumber(input.currentPrice)) names.push("price");
  if (!hasFiniteNumber(input.marketCap) && !hasFiniteNumber(input.fdv) && assetClass !== "fx" && assetClass !== "commodity")
    names.push(assetClass === "index" ? "index reference level" : "market cap or FDV");
  if (!hasFiniteNumber(input.volume24h) && assetClass !== "index" && assetClass !== "fx") names.push("24h volume");
  if (requiresDexLiquidityLane(input) && !hasFiniteNumber(input.liquidityUsd)) names.push("liquidity depth");
  if (requiresSupplyLane(input) && !hasSupplyCoverage(input)) names.push("supply float");
  if (requiresHolderLane(input) && !hasHolderCoverage(input)) names.push("holder concentration");
  if (requiresTokenContractLane(input) && !hasContractCoverage(input)) names.push("contract permissions");
  if (requiresOrderbookLane(input) && !hasOrderbookCoverage(input)) names.push("orderbook depth");
  if (!hasHistoryCoverage(input)) names.push("price history coverage");
  if (uniqueDataSources(input).length === 0) names.push("source ledger");
  else if (uniqueDataSources(input).length === 1) names.push("independent second source");
  return names;
}

export function computeDataConfidence(
  input: TokenRiskInput,
  dataQuality: TokenRiskResult["dataQuality"],
  profile: AssetProfile,
) {
  const sourceCount = uniqueDataSources(input).length;
  const consistency = inspectDataConsistency(input);
  const missingCoreCount = missingCoreFieldNames(input).length;
  let confidence =
    dataQuality === "live" ? 0.42 : dataQuality === "partial" ? 0.25 : 0.14;

  if (hasFiniteNumber(input.currentPrice)) confidence += 0.08;
  if (hasFiniteNumber(input.marketCap) || hasFiniteNumber(input.fdv))
    confidence += 0.08;
  if (hasFiniteNumber(input.volume24h)) confidence += 0.06;
  if (hasFiniteNumber(input.averageVolume7d)) confidence += 0.03;
  if (hasFiniteNumber(input.liquidityUsd)) confidence += 0.08;
  if (hasSupplyCoverage(input)) confidence += 0.1;
  else if (hasFiniteNumber(input.circulatingSupply)) confidence += 0.04;
  if (hasHolderCoverage(input)) confidence += 0.07;
  if (hasContractCoverage(input)) confidence += 0.07;
  if (hasOrderbookCoverage(input)) confidence += 0.07;
  if (hasHistoryCoverage(input)) confidence += 0.04;

  confidence += Math.min(0.14, sourceCount * 0.045);
  if (sourceCount === 0) confidence -= 0.1;
  if (sourceCount === 1) confidence -= 0.03;
  if (!hasFiniteNumber(input.currentPrice)) confidence -= 0.05;
  if (requiresSupplyLane(input) && !hasSupplyCoverage(input)) confidence -= 0.05;
  if (requiresDexLiquidityLane(input) && !hasFiniteNumber(input.liquidityUsd)) confidence -= 0.04;
  if (requiresHolderLane(input) && !hasHolderCoverage(input)) confidence -= 0.04;
  if (requiresTokenContractLane(input) && !hasContractCoverage(input)) confidence -= 0.04;
  if (requiresOrderbookLane(input) && !hasOrderbookCoverage(input)) confidence -= 0.04;
  const profileConfidencePenalty =
    profile.mode === "stablecoin"
      ? 0.1
      : profile.mode === "rwa"
        ? 0.1
        : profile.mode === "meme"
          ? 0.04
          : profile.mode === "unknown"
            ? 0.12
            : 0;
  confidence -= profileConfidencePenalty;
  if (consistency.hasImpossibleValue) confidence -= 0.12;
  if (consistency.hasSupplyConflict) confidence -= 0.14;

  const profileConfidenceCap =
    profile.mode === "stablecoin"
      ? 0.88
      : profile.mode === "rwa"
        ? 0.86
        : profile.mode === "meme"
          ? 0.9
          : profile.mode === "unknown"
            ? 0.72
            : 0.96;
  const consistencyConfidenceCap = consistency.hasSupplyConflict
    ? 0.68
    : consistency.hasImpossibleValue
      ? 0.74
      : 0.96;
  const missingDataCap =
    missingCoreCount >= 7
      ? 0.34 / profile.missingDataWeight
      : missingCoreCount >= 5
        ? 0.44 / Math.min(1.25, profile.missingDataWeight)
        : missingCoreCount >= 3
          ? 0.64 / Math.min(1.15, profile.missingDataWeight)
          : 0.96;
  const dataQualityConfidenceCap =
    dataQuality === "demo"
      ? 0.28
      : dataQuality === "partial"
        ? sourceCount >= 2 &&
          missingCoreCount <= 2 &&
          !consistency.hasImpossibleValue &&
          !consistency.hasSupplyConflict
          ? 0.58
          : 0.39
        : 0.96;
  const sourceLedgerConfidenceCap =
    sourceCount === 0 ? 0.28 : sourceCount === 1 ? 0.39 : 0.96;
  const confidenceCap = Math.min(
    profileConfidenceCap,
    consistencyConfidenceCap,
    missingDataCap,
    dataQualityConfidenceCap,
    sourceLedgerConfidenceCap,
  );
  return rounded(clamp(confidence, 0.1, confidenceCap), 2);
}

export function buildLimitations(
  input: TokenRiskInput,
  profile: AssetProfile,
  validationOk: boolean,
  confidence: number,
  dataQuality: TokenRiskResult["dataQuality"],
) {
  const limitations = [
    "This output is an anomaly screen, not a legal finding or accusation.",
  ];
  const consistency = inspectDataConsistency(input);
  const circulatingSupply = finiteNumber(input.circulatingSupply);
  const totalSupply = finiteNumber(input.totalSupply);
  const maxSupply = finiteNumber(input.maxSupply);

  if (dataQuality === "demo") {
    limitations.push("local sample/fallback data; confidence capped below 30%");
  } else if (dataQuality === "partial") {
    limitations.push("partial provider data; confidence capped until live source ledger is corroborated");
  }

  const assetClass = resolveInputAssetClass(input);
  if (requiresSupplyLane(input)) {
    if (circulatingSupply === undefined) {
      limitations.push("circulating supply missing");
    } else if (
      !(
        (maxSupply !== undefined && maxSupply > 0) ||
        (totalSupply !== undefined && totalSupply > 0)
      )
    ) {
      limitations.push("total/max supply missing; circulating float ratio unavailable");
    }
    limitations.push("vesting/unlock schedule not verified");
  } else {
    limitations.push(`${assetClass} instrument: token supply/vesting lanes are not used as risk proof`);
  }

  if (requiresHolderLane(input)) {
    if (!hasHolderCoverage(input)) {
      limitations.push("holder concentration unavailable");
      limitations.push("holder labels unavailable");
    } else {
      limitations.push("holder labels for CEX/team/LP/unknown wallets not verified");
    }
  } else {
    limitations.push(`${assetClass} instrument: holder concentration lane is replaced by issuer/venue/source review`);
  }

  if (requiresTokenContractLane(input)) {
    if (!input.tokenAddress) limitations.push("contract address missing");
    if (!hasContractCoverage(input))
      limitations.push("contract permissions unavailable");
  } else {
    limitations.push(`${assetClass} instrument: smart-contract/admin lane is not assumed without a token contract`);
  }
  if (requiresOrderbookLane(input) && !hasOrderbookCoverage(input))
    limitations.push("orderbook depth unavailable");
  if (!hasHistoryCoverage(input))
    limitations.push("price history coverage incomplete");
  if (requiresDexLiquidityLane(input) && !hasFiniteNumber(input.liquidityUsd))
    limitations.push("liquidity depth unavailable");
  if (requiresDexLiquidityLane(input) && !input.pairAddress && !input.dexId)
    limitations.push("DEX pair/source routing not verified");
  if (requiresTokenContractLane(input) && !hasFiniteNumber(input.buyTaxPercentage) && !hasFiniteNumber(input.sellTaxPercentage))
    limitations.push("tax settings unavailable");
  if (requiresOrderbookLane(input) && (!hasFiniteNumber(input.buys24h) || !hasFiniteNumber(input.sells24h)))
    limitations.push("bid/ask flow counts unavailable");
  if (uniqueDataSources(input).length === 0)
    limitations.push("OSINT source ledger not attached");
  else if (uniqueDataSources(input).length < 2)
    limitations.push("source ledger has limited corroboration");
  limitations.push("KOL/social disclosure data missing");
  if (!validationOk) limitations.push("input validation failed; source fields require review");
  if (consistency.hasImpossibleValue)
    limitations.push("impossible numeric input requires source review");
  if (consistency.hasSupplyConflict)
    limitations.push("supply fields conflict; float ratio requires review");
  if (confidence < 0.4)
    limitations.push("confidence too low; prescreen only");

  if (profile.mode === "stablecoin") {
    limitations.push("issuer proof missing for stablecoin");
    limitations.push("reserve proof missing for stablecoin");
    limitations.push("redemption proof missing for stablecoin");
  } else if (profile.mode === "rwa") {
    limitations.push("issuer proof missing for RWA");
    limitations.push("redemption proof missing for RWA");
    limitations.push("custody/source proof missing for RWA");
  } else if (profile.mode === "meme") {
    limitations.push("meme/social source ledger required");
    limitations.push("paid promotion and allocation disclosures unavailable");
  } else if (profile.mode === "unknown") {
    limitations.push("asset profile unknown; classification requires source review");
  }

  limitations.push("manual review required before escalation");
  return limitations;
}

