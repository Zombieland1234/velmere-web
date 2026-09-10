import type { RiskAgentAssessment, RiskLevel, TokenRiskResult, TokenRiskSignal } from "./risk-types";

export type ShieldEvidenceStatus = "confirmed" | "likely" | "unverified" | "red_flag" | "unknown";

export type ShieldOperatorLaneId = "supply" | "unlock" | "liquidity" | "holders" | "contract" | "social" | "evidence" | "data";

export type ShieldOperatorLane = {
  id: ShieldOperatorLaneId;
  label: string;
  status: ShieldEvidenceStatus;
  priority: number;
  reason: string;
  nextAction: string;
};

export type ShieldOperatorCaseFile = {
  caseId: string;
  symbol: string;
  riskLevel: RiskLevel;
  riskScore: number;
  confidence: number;
  evidenceStatus: ShieldEvidenceStatus;
  quickVerdict: string;
  dominantAgentLabel: string;
  primaryNextAction: string;
  lanes: ShieldOperatorLane[];
  blockers: string[];
  osintQueries: string[];
  operatorChecklist: string[];
  copyGuard: string;
};

const SIGNAL_LABELS: Record<string, string> = {
  supply_overhang: "supply overhang",
  fdv_marketcap_gap: "FDV / market-cap gap",
  very_thin_liquidity: "very thin liquidity",
  thin_liquidity: "thin liquidity",
  low_dex_liquidity: "low DEX liquidity",
  orderbook_slippage_risk: "slippage risk",
  orderbook_depth_collapse: "orderbook depth collapse",
  holder_concentration: "holder concentration",
  contract_privileges: "contract privileges",
  mint_risk: "mint permission",
  blacklist_risk: "blacklist permission",
  high_sell_tax: "sell-tax pressure",
  honeypot_risk: "honeypot review",
  volume_spike: "volume spike",
  wash_trading_risk: "wash-trading review",
  multi_timeframe_pump: "multi-timeframe pump",
  parabolic_24h_gain: "parabolic 24h gain",
  parabolic_7d_gain: "parabolic 7d gain",
  parabolic_30d_gain: "parabolic 30d gain",
  insufficient_data: "insufficient data",
};

function clamp(value: number, min = 0, max = 100) {
  return Math.min(max, Math.max(min, value));
}

function signalIds(result: TokenRiskResult) {
  return new Set(result.signals.map((signal) => signal.id));
}

function hasSignal(result: TokenRiskResult, ids: string[]) {
  const set = signalIds(result);
  return ids.some((id) => set.has(id as TokenRiskSignal["id"]));
}

function strongestAgent(result: TokenRiskResult): RiskAgentAssessment | undefined {
  return [...(result.agentAssessments ?? [])].sort((a, b) => b.score - a.score)[0];
}

function limitationIncludes(result: TokenRiskResult, terms: string[]) {
  const haystack = result.metaModel?.limitations?.join(" | ").toLowerCase() ?? "";
  return terms.some((term) => haystack.includes(term.toLowerCase()));
}

function statusFrom(priority: number, hasEvidence: boolean, hasMissing: boolean): ShieldEvidenceStatus {
  if (priority >= 85) return "red_flag";
  if (priority >= 60) return hasEvidence ? "likely" : "unverified";
  if (hasMissing) return "unknown";
  return hasEvidence ? "confirmed" : "unverified";
}

function lane(
  id: ShieldOperatorLaneId,
  label: string,
  priority: number,
  hasEvidence: boolean,
  hasMissing: boolean,
  reason: string,
  nextAction: string,
): ShieldOperatorLane {
  return {
    id,
    label,
    priority: Math.round(clamp(priority)),
    status: statusFrom(priority, hasEvidence, hasMissing),
    reason,
    nextAction,
  };
}

function topSignalLabels(result: TokenRiskResult) {
  return [...result.signals]
    .sort((a, b) => b.points - a.points)
    .slice(0, 4)
    .map((signal) => SIGNAL_LABELS[signal.id] ?? signal.id.replaceAll("_", " "));
}

function evidenceStatus(result: TokenRiskResult, confidence: number): ShieldEvidenceStatus {
  if (result.level === "critical") return "red_flag";
  if (confidence < 35 || hasSignal(result, ["insufficient_data"])) return "unknown";
  if (result.level === "high") return "likely";
  if (result.dataQuality === "live" && confidence >= 70) return "confirmed";
  return "unverified";
}

function quickVerdict(result: TokenRiskResult, confidence: number) {
  const signals = topSignalLabels(result);
  const signalCopy = signals.length ? ` Dominant flags: ${signals.join(", ")}.` : " No dominant public flag is visible yet.";
  if (confidence < 35) return `Prescreen only. Evidence is incomplete, so missing data is treated as risk.${signalCopy}`;
  if (result.level === "critical") return `Critical anomaly cluster requires manual review before any conclusion.${signalCopy}`;
  if (result.level === "high") return `High-priority review. The move may be explainable, but exit depth, supply and source evidence must be verified.${signalCopy}`;
  if (result.level === "medium") return `Elevated review. Do not treat the token as clean until missing source lanes are resolved.${signalCopy}`;
  return `Current sources show a low-risk pre-screen, but this is not a clean certificate.${signalCopy} Missing sources still keep the case in review mode.`;
}

function buildLanes(result: TokenRiskResult, confidence: number): ShieldOperatorLane[] {
  const supplyFlags = hasSignal(result, ["supply_overhang", "fdv_marketcap_gap"]);
  const liquidityFlags = hasSignal(result, ["very_thin_liquidity", "thin_liquidity", "low_dex_liquidity", "market_volume_stress", "orderbook_slippage_risk", "orderbook_depth_collapse"]);
  const holderFlags = hasSignal(result, ["holder_concentration", "exchange_deposit_anomaly"]);
  const contractFlags = hasSignal(result, ["contract_privileges", "mint_risk", "blacklist_risk", "high_sell_tax", "honeypot_risk"]);
  const socialFlags = hasSignal(result, ["multi_timeframe_pump", "volume_spike", "wash_trading_risk", "parabolic_24h_gain", "parabolic_7d_gain", "parabolic_30d_gain"]);
  const missingSupply = limitationIncludes(result, ["supply", "vesting", "unlock"]);
  const missingLiquidity = limitationIncludes(result, ["liquidity", "orderbook", "slippage"]);
  const missingHolders = limitationIncludes(result, ["holder"]);
  const missingContract = limitationIncludes(result, ["contract", "tax"]);
  const missingSocial = limitationIncludes(result, ["KOL", "social", "promotion"]);
  const missingEvidence = limitationIncludes(result, ["source ledger", "OSINT", "manual review", "confidence"]);

  return [
    lane(
      "supply",
      "Supply / float",
      supplyFlags ? 78 : missingSupply ? 52 : 24,
      supplyFlags,
      missingSupply,
      supplyFlags ? "Supply or FDV gap is active in the score." : "Float evidence is not fully resolved.",
      "Verify circulating supply, max supply, FDV gap, vesting calendar and unlock cliffs.",
    ),
    lane(
      "unlock",
      "Unlock / vesting",
      missingSupply || supplyFlags ? 68 : 34,
      supplyFlags,
      missingSupply,
      missingSupply ? "Unlock evidence is incomplete and cannot be treated as neutral." : "No public unlock flag dominates this prescreen.",
      "Find team, investor, advisor, OTC and whale unlock schedule from current sources.",
    ),
    lane(
      "liquidity",
      "Liquidity / exits",
      liquidityFlags ? 82 : missingLiquidity ? 55 : 26,
      liquidityFlags,
      missingLiquidity,
      liquidityFlags ? "Exit-depth or slippage lane is active." : "Live depth still needs confirmation.",
      "Inspect DEX pool depth, CEX orderbook, slippage at 10k/50k/100k and volume quality.",
    ),
    lane(
      "holders",
      "Holders / clusters",
      holderFlags ? 76 : missingHolders ? 56 : 25,
      holderFlags,
      missingHolders,
      holderFlags ? "Holder concentration or exchange deposit proxy is active." : "Wallet labels need stronger source coverage.",
      "Separate CEX, LP, team, treasury, whale, retail and unknown wallets before judging distribution.",
    ),
    lane(
      "contract",
      "Contract controls",
      contractFlags ? 88 : missingContract ? 58 : 20,
      contractFlags,
      missingContract,
      contractFlags ? "Contract permission lane is active." : "Contract permissions are not fully proven clean.",
      "Check owner, proxy, mint, pause, blacklist, tax, honeypot and audit source labels.",
    ),
    lane(
      "social",
      "KOL / social",
      socialFlags ? 62 : missingSocial ? 49 : 19,
      socialFlags,
      missingSocial,
      socialFlags ? "Velocity/social review is needed around the move." : "Paid-promotion disclosure is not attached.",
      "Search KOL disclosures, allocation leaks, paid shill patterns and coordinated hype evidence.",
    ),
    lane(
      "evidence",
      "Evidence quality",
      confidence < 40 || missingEvidence ? 74 : 36,
      result.dataQuality === "live" && confidence >= 65,
      missingEvidence || confidence < 55,
      confidence < 40 ? "Confidence is too low for a clean conclusion." : "Evidence still needs source ledger and timestamps.",
      "Attach source ledger, timestamps, missing-data appendix and manual-review note before export.",
    ),
  ].sort((a, b) => b.priority - a.priority);
}

function osintQueries(result: TokenRiskResult, lanes: ShieldOperatorLane[]) {
  const symbol = result.token.symbol || result.token.name;
  const name = result.token.name || result.token.symbol;
  const base = `${name} ${symbol}`.trim();
  const queries = [
    `${base} tokenomics circulating supply total supply FDV unlock vesting`,
    `${base} team investor advisor OTC unlock schedule cliff`,
    `${base} contract owner mint pause blacklist tax honeypot audit`,
    `${base} holders top wallets team treasury LP CEX concentration`,
    `${base} market maker buyback KOL paid promotion disclosure allegations`,
  ];

  for (const laneItem of lanes.slice(0, 2)) {
    if (laneItem.id === "liquidity") queries.unshift(`${base} liquidity depth slippage orderbook volume spike wash trading`);
    if (laneItem.id === "contract") queries.unshift(`${base} contract permissions proxy blacklist mint tax audit`);
    if (laneItem.id === "social") queries.unshift(`${base} KOL shill paid promotion undisclosed allocation`);
    if (laneItem.id === "supply" || laneItem.id === "unlock") queries.unshift(`${base} low float FDV unlock vesting tokenomics`);
  }

  return Array.from(new Set(queries)).slice(0, 6);
}

function blockers(result: TokenRiskResult, lanes: ShieldOperatorLane[]) {
  const active = lanes
    .filter((laneItem) => laneItem.status === "red_flag" || laneItem.status === "unknown")
    .map((laneItem) => `${laneItem.label}: ${laneItem.reason}`);
  const limitations = (result.metaModel?.limitations ?? [])
    .filter((item) => /missing|unavailable|manual|confidence|not verified|source/i.test(item))
    .slice(0, 5);
  return Array.from(new Set([...active, ...limitations])).slice(0, 7);
}

function checklist(result: TokenRiskResult, lanes: ShieldOperatorLane[]) {
  const primary = lanes.slice(0, 4).map((laneItem) => laneItem.nextAction);
  return Array.from(new Set([
    ...primary,
    "Do not use buy/sell language; keep anomaly/review wording.",
    "Mark every strong claim as confirmed, likely, unverified, red flag or unknown.",
    "Final verdict requires fresh web OSINT plus current market data.",
    result.level === "low" ? "Low pre-screen means the current source set did not show a strong flag; it does not prove safety." : "Escalate only after evidence ledger is attached.",
  ])).slice(0, 7);
}

export function buildShieldOperatorCaseFile(result: TokenRiskResult): ShieldOperatorCaseFile {
  const confidence = Math.round((result.confidence ?? 0.35) * 100);
  const dominantAgent = strongestAgent(result);
  const lanes = buildLanes(result, confidence);
  const status = evidenceStatus(result, confidence);
  const primaryLane = lanes[0];
  const caseSeed = `${result.token.marketId ?? result.token.symbol}-${result.generatedAt ?? "runtime"}`
    .replace(/[^a-z0-9-]/gi, "-")
    .replace(/-+/g, "-")
    .slice(0, 56)
    .toUpperCase();

  return {
    caseId: `VLM-${caseSeed}`,
    symbol: result.token.symbol,
    riskLevel: result.level,
    riskScore: result.score,
    confidence,
    evidenceStatus: status,
    quickVerdict: quickVerdict(result, confidence),
    dominantAgentLabel: dominantAgent?.label ?? result.metaModel?.dominantAgent ?? "Data uncertainty",
    primaryNextAction: primaryLane?.nextAction ?? "Attach the source ledger, resolve missing data and rerun the prescreen.",
    lanes,
    blockers: blockers(result, lanes),
    osintQueries: osintQueries(result, lanes),
    operatorChecklist: checklist(result, lanes),
    copyGuard: "Not financial advice. Algorithmic risk flag only. Manual review required before escalation.",
  };
}
