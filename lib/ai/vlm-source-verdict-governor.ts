import type { VlmFact } from "./vlm-contract";
import type { VlmSourceArbitration } from "./vlm-source-arbitration";
import { boundedNumber, sanitizeVlmText } from "./vlm-security";

export const PASS2785_SOURCE_VERDICT_GOVERNOR_ID = "pass2785_source_verdict_governor_v1";

export type VlmVerdictAssetFamily =
  | "erc20_contract"
  | "native_crypto"
  | "equity"
  | "fund_etf"
  | "index"
  | "fx_pair"
  | "commodity"
  | "real_estate"
  | "exchange_equity"
  | "unknown";

export type VlmSourceVerdictGovernorStatus = "publishable" | "conditional" | "operator_review" | "blocked";

export type VlmSourceVerdictGovernor = {
  id: typeof PASS2785_SOURCE_VERDICT_GOVERNOR_ID;
  assetFamily: VlmVerdictAssetFamily;
  status: VlmSourceVerdictGovernorStatus;
  confidenceCap: number;
  riskScore: number;
  confidenceScore: number;
  riskConfidenceDelta: number;
  requiredProofLanes: string[];
  missingProofLanes: string[];
  familyMismatchFlags: string[];
  blockedClaims: string[];
  reasons: string[];
  nextChecks: string[];
};

const EQUITY_SYMBOLS = new Set([
  "AAPL", "NVDA", "MSFT", "GOOGL", "GOOG", "AMZN", "META", "TSLA", "NFLX", "AMD", "INTC", "AVGO", "ADBE", "ORCL", "CRM", "SHOP", "V", "MA", "JPM", "BAC", "GS", "MSTR", "COIN", "HOOD", "PLTR", "NKE", "DIS", "ADIDAS", "ADS",
]);

const NATIVE_CRYPTO_SYMBOLS = new Set([
  "BTC", "ETH", "SOL", "BNB", "XRP", "DOGE", "ADA", "AVAX", "DOT", "TRX", "TON", "BCH", "LTC", "XMR", "ATOM", "NEAR", "SUI", "APT", "HBAR", "ICP", "FIL", "ETC",
]);

function clamp(value: number, min = 8, max = 94) {
  return Math.round(boundedNumber(value, min, max, min));
}

function factValue(facts: VlmFact[], id: string) {
  return facts.find((fact) => fact.id === id)?.value ?? null;
}

function hasFact(facts: VlmFact[], id: string) {
  const value = factValue(facts, id);
  return value !== null && value !== undefined && value !== "";
}

function normalizeAssetClass(assetClass: string | undefined | null) {
  return String(assetClass ?? "unknown").trim().toLowerCase().replace(/\s+/g, "_");
}

export function classifyVlmVerdictAssetFamily(input: {
  symbol: string;
  assetClass: string | undefined;
  contractAddress?: string;
  chainId?: string;
}): VlmVerdictAssetFamily {
  const assetClass = normalizeAssetClass(input.assetClass);
  const symbol = input.symbol.trim().toUpperCase();
  const hasContract = Boolean(input.contractAddress?.trim());

  if (assetClass === "stock") return "equity";
  if (assetClass === "exchange_equity") return "exchange_equity";
  if (assetClass === "etf" || assetClass === "fund") return "fund_etf";
  if (assetClass === "index") return "index";
  if (assetClass === "fx" || assetClass.includes("currency")) return "fx_pair";
  if (assetClass === "commodity") return "commodity";
  if (assetClass === "real_estate" || assetClass === "reit") return "real_estate";
  if (assetClass === "crypto" || assetClass === "defi" || assetClass === "exchange_token") return hasContract ? "erc20_contract" : "native_crypto";
  if (hasContract) return "erc20_contract";
  if (NATIVE_CRYPTO_SYMBOLS.has(symbol)) return "native_crypto";
  if (EQUITY_SYMBOLS.has(symbol)) return "equity";
  return "unknown";
}

export function requiredProofLanesForVlmFamily(family: VlmVerdictAssetFamily) {
  switch (family) {
    case "erc20_contract":
      return ["price", "volume-24h", "liquidity-usd", "holder-count", "top10-holder-percent", "sell-tax", "slippage-10k", "contract-address", "independent-provider-quorum"];
    case "native_crypto":
      return ["price", "volume-24h", "market-cap", "venue-source-coverage", "derivatives-or-orderbook-context", "independent-provider-quorum"];
    case "equity":
    case "exchange_equity":
      return ["price", "volume-24h", "market-cap", "issuer-or-filing-context", "second-market-data-provider", "independent-provider-quorum"];
    case "fund_etf":
      return ["price", "volume-24h", "market-cap-or-aum-proxy", "issuer-fund-context", "second-market-data-provider", "independent-provider-quorum"];
    case "index":
      return ["reference-level", "constituent-or-methodology-context", "second-index-provider", "timestamp", "independent-provider-quorum"];
    case "fx_pair":
      return ["price", "daily-reference", "second-fx-provider", "timestamp", "macro-context", "independent-provider-quorum"];
    case "commodity":
      return ["spot-or-futures-price", "volume-or-open-interest", "second-commodity-provider", "contract-methodology", "timestamp", "independent-provider-quorum"];
    case "real_estate":
      return ["price-or-index-proxy", "macro-reference", "issuer-or-vehicle-context", "second-provider", "timestamp", "independent-provider-quorum"];
    default:
      return ["asset-family-confirmation", "price", "second-provider", "timestamp", "independent-provider-quorum"];
  }
}

function missingRequiredProofLanes(input: {
  family: VlmVerdictAssetFamily;
  facts: VlmFact[];
  contractAddress?: string;
  sourceArbitration: VlmSourceArbitration;
}) {
  const missing: string[] = [];
  const proof = input.sourceArbitration;
  const hasProviderQuorum = proof.providerCount >= 2 && proof.evidenceQuorum.status === "strong";

  const requireFact = (lane: string, ids: string[]) => {
    if (!ids.some((id) => hasFact(input.facts, id))) missing.push(lane);
  };

  switch (input.family) {
    case "erc20_contract":
      requireFact("price", ["price"]);
      requireFact("volume-24h", ["volume-24h"]);
      requireFact("liquidity-usd", ["liquidity-usd"]);
      requireFact("holder-count", ["holder-count"]);
      requireFact("top10-holder-percent", ["top10-holder-percent"]);
      requireFact("sell-tax", ["sell-tax"]);
      requireFact("slippage-10k", ["slippage-10k"]);
      if (!input.contractAddress) missing.push("contract-address");
      break;
    case "native_crypto":
      requireFact("price", ["price"]);
      requireFact("volume-24h", ["volume-24h"]);
      requireFact("market-cap", ["market-cap"]);
      if (!hasFact(input.facts, "venue-source-coverage") && proof.providerCount < 2) missing.push("venue-source-coverage");
      if (!hasFact(input.facts, "orderbook-depth") && !hasFact(input.facts, "derivatives-context")) missing.push("derivatives-or-orderbook-context");
      break;
    case "equity":
    case "exchange_equity":
      requireFact("price", ["price"]);
      requireFact("volume-24h", ["volume-24h"]);
      requireFact("market-cap", ["market-cap"]);
      if (!hasFact(input.facts, "issuer-or-filing-context") && !hasFact(input.facts, "venue-source-coverage")) missing.push("issuer-or-filing-context");
      break;
    case "fund_etf":
      requireFact("price", ["price"]);
      requireFact("volume-24h", ["volume-24h"]);
      if (!hasFact(input.facts, "market-cap") && !hasFact(input.facts, "aum-proxy")) missing.push("market-cap-or-aum-proxy");
      if (!hasFact(input.facts, "issuer-fund-context") && !hasFact(input.facts, "venue-source-coverage")) missing.push("issuer-fund-context");
      break;
    case "index":
      requireFact("reference-level", ["market-cap", "price"]);
      if (!hasFact(input.facts, "constituent-or-methodology-context") && !hasFact(input.facts, "venue-source-coverage")) missing.push("constituent-or-methodology-context");
      break;
    case "fx_pair":
      requireFact("price", ["price"]);
      if (!hasFact(input.facts, "daily-reference") && !hasFact(input.facts, "venue-source-coverage")) missing.push("daily-reference");
      if (!hasFact(input.facts, "macro-context")) missing.push("macro-context");
      break;
    case "commodity":
      requireFact("spot-or-futures-price", ["price"]);
      if (!hasFact(input.facts, "volume-24h") && !hasFact(input.facts, "open-interest")) missing.push("volume-or-open-interest");
      if (!hasFact(input.facts, "contract-methodology") && !hasFact(input.facts, "venue-source-coverage")) missing.push("contract-methodology");
      break;
    case "real_estate":
      if (!hasFact(input.facts, "price") && !hasFact(input.facts, "market-cap")) missing.push("price-or-index-proxy");
      if (!hasFact(input.facts, "macro-reference") && !hasFact(input.facts, "venue-source-coverage")) missing.push("macro-reference");
      if (!hasFact(input.facts, "issuer-or-vehicle-context")) missing.push("issuer-or-vehicle-context");
      break;
    default:
      requireFact("price", ["price"]);
      missing.push("asset-family-confirmation");
      break;
  }

  if (!hasProviderQuorum) missing.push("independent-provider-quorum");
  return Array.from(new Set(missing));
}

function familyMismatchFlags(input: {
  symbol: string;
  assetClass: string | undefined;
  family: VlmVerdictAssetFamily;
  contractAddress?: string;
  facts: VlmFact[];
}) {
  const flags: string[] = [];
  const symbol = input.symbol.trim().toUpperCase();
  const assetClass = normalizeAssetClass(input.assetClass);

  if ((input.family === "equity" || input.family === "exchange_equity") && input.contractAddress) {
    flags.push("equity_like_asset_contains_contract_address");
  }
  if (EQUITY_SYMBOLS.has(symbol) && (assetClass === "crypto" || assetClass === "defi" || assetClass === "exchange_token")) {
    flags.push("equity_symbol_misclassified_as_crypto");
  }
  if (NATIVE_CRYPTO_SYMBOLS.has(symbol) && (assetClass === "stock" || assetClass === "etf" || assetClass === "index" || assetClass === "fx")) {
    flags.push("native_crypto_symbol_misclassified_as_real_market");
  }
  if (input.family !== "erc20_contract" && ["liquidity-usd", "holder-count", "top10-holder-percent", "sell-tax", "slippage-10k"].some((id) => hasFact(input.facts, id))) {
    flags.push("token_specific_facts_present_on_non_token_family");
  }
  if (input.family === "native_crypto" && input.contractAddress) {
    flags.push("native_crypto_has_contract_address_use_token_family");
  }
  return flags;
}

export function governVlmSourceVerdict(input: {
  symbol: string;
  assetClass: string | undefined;
  contractAddress?: string;
  chainId?: string;
  facts: VlmFact[];
  sourceArbitration: VlmSourceArbitration;
  deterministicScore: number;
  confidenceCap: number;
  dataQuality: "demo" | "partial" | "live";
  conflictCount: number;
}): VlmSourceVerdictGovernor {
  const family = classifyVlmVerdictAssetFamily(input);
  const requiredProofLanes = requiredProofLanesForVlmFamily(family);
  const missingProofLanes = missingRequiredProofLanes({ family, facts: input.facts, contractAddress: input.contractAddress, sourceArbitration: input.sourceArbitration });
  const mismatchFlags = familyMismatchFlags({ symbol: input.symbol, assetClass: input.assetClass, family, contractAddress: input.contractAddress, facts: input.facts });
  const reasons: string[] = [];
  const nextChecks: string[] = [];
  const blockedClaims = [
    "risk score as confidence score",
    "risk score as price direction forecast",
    "high risk verdict without independent-source proof",
    "asset-family inference across BTC/AAPL/ERC20 lanes",
    "token holder/liquidity claims on equity or FX packets",
    "issuer/fundamental claims on ERC20 packets without the correct lane",
  ];

  let cap = clamp(input.confidenceCap);
  if (input.dataQuality !== "live") {
    cap = Math.min(cap, input.dataQuality === "partial" ? 39 : 28);
    reasons.push(`Data quality ${input.dataQuality} keeps the verdict in a bounded prescreen band.`);
  }
  if (input.sourceArbitration.providerCount < 2 || input.sourceArbitration.evidenceQuorum.status !== "strong") {
    cap = Math.min(cap, 39);
    reasons.push("Two-provider evidence quorum is not strong; high-conviction verdicts are blocked.");
  }
  if (missingProofLanes.length > 0) {
    cap = Math.min(cap, missingProofLanes.length <= 2 ? 52 : 34);
    reasons.push(`Required proof lanes missing for ${family}: ${missingProofLanes.slice(0, 6).join(", ")}.`);
    nextChecks.push(`Collect missing ${family} proof lanes: ${missingProofLanes.slice(0, 6).join(", ")}.`);
  }
  if (mismatchFlags.length > 0) {
    cap = Math.min(cap, 24);
    reasons.push(`Asset-family mismatch detected: ${mismatchFlags.join(", ")}.`);
    nextChecks.push("Re-resolve the asset family before publishing or charging for a paid verdict.");
  }
  if (input.conflictCount > 0) {
    cap = Math.min(cap, 32);
    reasons.push("Conflict count is non-zero; the verdict requires operator review.");
  }

  const riskScore = clamp(input.deterministicScore, 0, 100);
  const confidenceScore = clamp(cap, 0, 100);
  const riskConfidenceDelta = Math.abs(riskScore - confidenceScore);
  if (riskScore >= 70 && confidenceScore < 45) {
    reasons.push("High deterministic risk is treated as review priority, not high-confidence proof.");
    nextChecks.push("Escalate high-risk/low-confidence packets to operator review instead of publishing a definitive conclusion.");
  }
  if (riskConfidenceDelta >= 35) {
    reasons.push("Large risk-confidence delta detected; public output must explain score/confidence separation.");
  }

  const status: VlmSourceVerdictGovernorStatus = mismatchFlags.length > 0
    ? "blocked"
    : input.conflictCount > 0 || (riskScore >= 70 && confidenceScore < 45)
      ? "operator_review"
      : confidenceScore < 40 || missingProofLanes.length > 0 || input.sourceArbitration.evidenceQuorum.status !== "strong"
        ? "conditional"
        : "publishable";

  if (status !== "publishable" && nextChecks.length === 0) {
    nextChecks.push("Refresh source evidence, replay the packet, and keep confidence capped until proof lanes are confirmed.");
  }

  return {
    id: PASS2785_SOURCE_VERDICT_GOVERNOR_ID,
    assetFamily: family,
    status,
    confidenceCap: Math.max(8, confidenceScore),
    riskScore,
    confidenceScore,
    riskConfidenceDelta,
    requiredProofLanes,
    missingProofLanes: missingProofLanes.map((item) => sanitizeVlmText(item, 100)).filter(Boolean),
    familyMismatchFlags: mismatchFlags,
    blockedClaims,
    reasons: reasons.slice(0, 12),
    nextChecks: nextChecks.slice(0, 8),
  };
}
