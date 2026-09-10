import { createHash } from "node:crypto";
import type { TokenRiskResult, VelmereMarketAssetClass } from "./risk-types";
import type { Pass2465TierDepthScenarioParity, Pass2465ScenarioLane } from "./tier-depth-scenario-parity";
import type { Pass2470Surface, Pass2470Tier180OutputMatrix } from "./tier-180-output-matrix";
import type { Pass2476RuntimeReceiptPdfHashRunner } from "./runtime-receipt-pdf-hash-runner";
import type { Pass2483PremiumEvidenceBridge, Pass2483PremiumEvidenceLane } from "./premium-evidence-bridge";
import type { Pass2485PaidAdvancedReadinessFuse } from "./paid-advanced-readiness-fuse";
import type { Pass2487LiquidationReplayPaidCopyLock } from "./liquidation-replay-paid-copy-lock";
import type { Pass2488SupplyFilingProvenanceLock } from "./supply-filing-provenance-lock";

export const PASS2482_ADVANCED_VALUE_AUDIT_ID = "advanced-value-audit-v1" as const;
// PASS2483 bridge note: PASS2482 can upgrade only from real premium evidence lanes, not from layout/readability.
// PASS2482 verifier phrase: Advanced is paid-worthy only when it adds timestamped premium evidence, runtime receipts and source-bound missing-data honesty beyond Basic/Pro.

export type Pass2482AdvancedValueState = "paid_ready" | "qa_preview_only" | "watch" | "blocked";
export type Pass2482AssetFamily = "native_crypto" | "token_contract" | "real_market_stock" | "real_market_etf" | "real_market_other" | "unknown";
export type Pass2482SurfaceVerdict = {
  surface: Pass2470Surface | "browser" | "angel";
  state: Pass2482AdvancedValueState;
  advancedWorthinessScore: number;
  customerVerdict: string;
  readyEvidence: string[];
  missingEvidence: string[];
};
export type Pass2482RequiredLane = {
  id: string;
  label: string;
  appliesTo: Pass2482AssetFamily[];
  requiredForPaidAdvanced: boolean;
  state: "ready" | "watch" | "missing" | "not_applicable";
  currentEvidence: string[];
  missingEvidence: string[];
  copyRule: string;
};
export type Pass2482UploadedPdfAuditFinding = {
  asset: string;
  surface: "pdf" | "shield" | "real_markets";
  finding: string;
  implication: string;
};
export type Pass2482AdvancedValueAudit = {
  version: typeof PASS2482_ADVANCED_VALUE_AUDIT_ID;
  state: Pass2482AdvancedValueState;
  query?: string;
  symbol?: string;
  assetFamily: Pass2482AssetFamily;
  advancedWorthinessScore: number;
  paidAdvancedReady: boolean;
  canChargeForAdvancedConclusion: boolean;
  publicPricingCopyAllowed: boolean;
  customerVerdict: string;
  operatorVerdict: string;
  sourceEvidenceScore: number;
  runtimeReceiptScore: number;
  tierDifferenceScore: number;
  missingPenaltyScore: number;
  requiredLanes: Pass2482RequiredLane[];
  surfaceVerdicts: Pass2482SurfaceVerdict[];
  uploadedPdfAuditFindings: Pass2482UploadedPdfAuditFinding[];
  noFakePaidValueRules: string[];
  nextImplementationActions: string[];
  fingerprint: string;
  generatedAt: string;
};

function clamp(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function unique<T>(items: Array<T | false | null | undefined>) {
  return Array.from(new Set(items.filter(Boolean) as T[]));
}

function stableHash(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex").slice(0, 32).toUpperCase();
}

function normalizeSymbol(value?: string) {
  return String(value ?? "").trim().toUpperCase().replace(/[^A-Z0-9._/-]/g, "").slice(0, 24);
}

function resolveAssetFamily(result?: TokenRiskResult | null, symbol?: string): Pass2482AssetFamily {
  const normalized = normalizeSymbol(symbol || result?.token.symbol);
  const assetClass: VelmereMarketAssetClass | undefined = result?.token.assetClass;
  if (assetClass === "stock" || assetClass === "exchange_equity") return "real_market_stock";
  if (assetClass === "etf" || ["SPY", "QQQ", "VOO", "GLD", "VNQ"].includes(normalized)) return "real_market_etf";
  if (assetClass === "fx" || assetClass === "commodity" || assetClass === "real_estate" || assetClass === "index") return "real_market_other";
  if (result?.token.tokenAddress || result?.token.chainId || result?.token.pairAddress || result?.token.dexId) return "token_contract";
  if (["BTC", "ETH", "SOL", "BNB", "XRP", "DOGE", "ADA", "AVAX", "DOT", "LINK"].includes(normalized)) return "native_crypto";
  if (assetClass === "crypto") return "native_crypto";
  return "unknown";
}

function laneEvidence(lanes: Pass2465ScenarioLane[] | undefined, id: string) {
  const lane = lanes?.find((item) => item.id === id);
  return {
    state: lane?.state,
    current: lane?.currentEvidence ?? [],
    missing: lane?.missingEvidence ?? [],
  };
}

function laneState(current: string[], missing: string[], required: boolean): Pass2482RequiredLane["state"] {
  if (!required) return "not_applicable";
  if (current.length >= 2 && missing.length <= 2) return "ready";
  if (current.length >= 1) return "watch";
  return "missing";
}

function bridgeLane(bridge: Pass2483PremiumEvidenceBridge | null | undefined, id: Pass2483PremiumEvidenceLane["id"]) {
  return bridge?.lanes.find((lane) => lane.id === id);
}

function bridgeToLaneState(lane: Pass2483PremiumEvidenceLane | undefined, required: boolean): Pass2482RequiredLane["state"] | undefined {
  if (!required) return "not_applicable";
  if (!lane || lane.state === "not_applicable") return undefined;
  if (lane.state === "ready" && !lane.paidAdvancedBlocker) return "ready";
  if (lane.state === "ready" || lane.state === "watch") return "watch";
  return "missing";
}

function mergeBridgeEvidence(base: string[], lane?: Pass2483PremiumEvidenceLane) {
  return unique([...(lane?.confirmedEvidence ?? []), ...base]).slice(0, 8);
}

function mergeBridgeMissing(base: string[], lane?: Pass2483PremiumEvidenceLane) {
  return unique([...(lane?.missingEvidence ?? []), ...base]).slice(0, 10);
}

function baseLanes(args: {
  family: Pass2482AssetFamily;
  pass2465?: Pass2465TierDepthScenarioParity | null;
  pass2476?: Pass2476RuntimeReceiptPdfHashRunner | null;
  pass2483?: Pass2483PremiumEvidenceBridge | null;
}): Pass2482RequiredLane[] {
  const family = args.family;
  const scenarioLanes = args.pass2465?.scenarioLanes;
  const depth = laneEvidence(scenarioLanes, "cex_depth_imbalance");
  const squeeze = laneEvidence(scenarioLanes, "long_short_squeeze");
  const exit = laneEvidence(scenarioLanes, "liquidity_exit_squeeze");
  const holderUnlock = laneEvidence(scenarioLanes, "holder_unlock_pressure");
  const trap = laneEvidence(scenarioLanes, "rug_pull_trap");
  const cryptoFamily = family === "native_crypto" || family === "token_contract";
  const tokenContract = family === "token_contract";
  const realMarket = family === "real_market_stock" || family === "real_market_etf" || family === "real_market_other";
  const pdfHashReady = (args.pass2476?.pdfHashCoveragePercent ?? 0) >= 70;
  const runtimeReady = (args.pass2476?.runtimeCapturedCoveragePercentAfterRun ?? 0) >= 70;
  const bridge = args.pass2483;
  const orderbookBridge = bridgeLane(bridge, "crypto_orderbook_slippage_receipt");
  const derivativesBridge = bridgeLane(bridge, "crypto_derivatives_receipt");
  const longShortBridge = bridgeLane(bridge, "crypto_long_short_liquidation_receipt");
  const holderBridge = bridgeLane(bridge, "crypto_holder_supply_receipt");
  const realSecondBridge = bridgeLane(bridge, "real_market_second_provider_timestamp");
  const realFilingBridge = bridgeLane(bridge, "real_market_fundamental_filing_receipt");
  const runtimeBridge = bridgeLane(bridge, "runtime_surface_receipt");

  return [
    {
      id: "source_ledger_timestamp",
      label: "Timestamped source ledger",
      appliesTo: ["native_crypto", "token_contract", "real_market_stock", "real_market_etf", "real_market_other", "unknown"],
      requiredForPaidAdvanced: true,
      state: args.pass2465?.state === "ready" || args.pass2465?.state === "watch" ? "watch" : "missing",
      currentEvidence: unique([
        bridge && `PASS2483 premium bridge ${bridge.state}:${bridge.premiumEvidenceScore}/100`,
        args.pass2465?.score !== undefined && `tier depth score ${args.pass2465.score}/100`,
        args.pass2465?.pdfTierDifferentiationLock?.state && `PDF tier lock ${args.pass2465.pdfTierDifferentiationLock.state}`,
      ]),
      missingEvidence: unique([
        ...(bridge?.paidBlockers.slice(0, 3) ?? []),
        (args.pass2465?.score ?? 0) < 80 && "source ceiling below paid Advanced threshold",
        args.pass2465?.pdfTierDifferentiationLock?.state !== "ready" && "PDF preview/download tier lock not ready",
      ]),
      copyRule: "Advanced may say only what the timestamped ledger supports. A high layout score is not paid evidence.",
    },
    {
      id: "orderbook_slippage",
      label: "Orderbook, spread and 10k slippage",
      appliesTo: ["native_crypto", "token_contract"],
      requiredForPaidAdvanced: cryptoFamily,
      state: bridgeToLaneState(orderbookBridge, cryptoFamily) ?? laneState(unique([...depth.current, ...exit.current]), unique([...depth.missing, ...exit.missing, "10k slippage simulation required"]), cryptoFamily),
      currentEvidence: mergeBridgeEvidence(unique([...depth.current, ...exit.current]), orderbookBridge),
      missingEvidence: mergeBridgeMissing(unique([...depth.missing, ...exit.missing, "real spread", "bid/ask depth", "buy/sell 10k slippage"]), orderbookBridge).slice(0, 8),
      copyRule: "No liquidity-quality claim without venue depth and slippage receipts.",
    },
    {
      id: "derivatives_long_short_liquidations",
      label: "Funding, open interest, long/short and liquidations",
      appliesTo: ["native_crypto", "token_contract"],
      requiredForPaidAdvanced: cryptoFamily,
      state: bridgeToLaneState(longShortBridge, cryptoFamily) ?? bridgeToLaneState(derivativesBridge, cryptoFamily) ?? laneState(squeeze.current, squeeze.missing, cryptoFamily),
      currentEvidence: mergeBridgeEvidence(mergeBridgeEvidence(squeeze.current, derivativesBridge), longShortBridge),
      missingEvidence: mergeBridgeMissing(unique([...squeeze.missing, "funding rate", "open interest", "long/short ratio", "liquidation snapshot"]), longShortBridge ?? derivativesBridge).slice(0, 8),
      copyRule: "Squeeze is a pressure lane, not a trade signal. Missing derivatives keep Advanced in watch mode.",
    },
    {
      id: "holders_supply_unlocks",
      label: "Holders, supply and unlock pressure",
      appliesTo: ["native_crypto", "token_contract"],
      requiredForPaidAdvanced: cryptoFamily,
      state: bridgeToLaneState(holderBridge, cryptoFamily) ?? laneState(holderUnlock.current, holderUnlock.missing, cryptoFamily),
      currentEvidence: mergeBridgeEvidence(holderUnlock.current, holderBridge),
      missingEvidence: mergeBridgeMissing(unique([...holderUnlock.missing, "holder concentration snapshot", "unlock/emission schedule"]), holderBridge).slice(0, 8),
      copyRule: "Supply pressure must be shown as missing/watch unless the holder/unlock snapshot is attached.",
    },
    {
      id: "contract_admin_lp_tax",
      label: "Contract admin, LP lock and tax/honeypot",
      appliesTo: ["token_contract"],
      requiredForPaidAdvanced: tokenContract,
      state: laneState(trap.current, trap.missing, tokenContract),
      currentEvidence: trap.current.slice(0, 6),
      missingEvidence: unique([...trap.missing, "verified source", "owner/admin permissions", "LP lock", "tax/honeypot scan"]).slice(0, 8),
      copyRule: "Native BTC/SOL-style assets must not receive fake ERC20 admin claims; contract-token assets need this lane before paid Advanced verdicts.",
    },
    {
      id: "real_market_second_provider",
      label: "Real Markets second provider and timestamp",
      appliesTo: ["real_market_stock", "real_market_etf", "real_market_other"],
      requiredForPaidAdvanced: realMarket,
      state: bridgeToLaneState(realSecondBridge, realMarket) ?? (realMarket ? "missing" : "not_applicable"),
      currentEvidence: mergeBridgeEvidence([], realSecondBridge),
      missingEvidence: realMarket ? mergeBridgeMissing(["independent second quote provider", "observedAt timestamp", "quote/chart parity", "source cadence receipt"], realSecondBridge) : [],
      copyRule: "A Real Markets Advanced report is not sellable when Yahoo/Stooq/SEC timestamps are missing or only catalog rows exist.",
    },
    {
      id: "real_market_fundamentals_filings",
      label: "Filings, fundamentals, earnings/news context",
      appliesTo: ["real_market_stock", "real_market_etf"],
      requiredForPaidAdvanced: family === "real_market_stock" || family === "real_market_etf",
      state: bridgeToLaneState(realFilingBridge, family === "real_market_stock" || family === "real_market_etf") ?? (family === "real_market_stock" || family === "real_market_etf" ? "missing" : "not_applicable"),
      currentEvidence: mergeBridgeEvidence([], realFilingBridge),
      missingEvidence: family === "real_market_stock" || family === "real_market_etf" ? mergeBridgeMissing(["SEC/XBRL or issuer facts", "filing freshness", "earnings/calendar risk", "sector/ETF exposure", "news/filings source lane"], realFilingBridge) : [],
      copyRule: "Stocks/ETFs need fundamentals and filing freshness; token-style DEX/holder wording is forbidden.",
    },
    {
      id: "runtime_receipts",
      label: "Runtime receipt proof for paid Advanced",
      appliesTo: ["native_crypto", "token_contract", "real_market_stock", "real_market_etf", "real_market_other", "unknown"],
      requiredForPaidAdvanced: true,
      state: bridgeToLaneState(runtimeBridge, true) ?? (runtimeReady && pdfHashReady ? "ready" : (args.pass2476 ? "watch" : "missing")),
      currentEvidence: mergeBridgeEvidence(unique([
        args.pass2476 && `PDF hash coverage ${args.pass2476.pdfHashCoveragePercent}%`,
        args.pass2476 && `runtime captured ${args.pass2476.runtimeCapturedCoveragePercentAfterRun}%`,
        args.pass2476?.state && `runner ${args.pass2476.state}`,
      ]), runtimeBridge),
      missingEvidence: mergeBridgeMissing(unique([
        !runtimeReady && "API payload + browser screenshot + Angel replay receipts",
        !pdfHashReady && "operator PDF preview/download hashes",
        "durable production storage for paid entitlement evidence",
      ]), runtimeBridge),
      copyRule: "Do not call Advanced a paid completed analysis until receipts prove the same data across Shield, Real Markets, PDF and Angel.",
    },
  ];
}

function surfaceVerdicts(args: {
  family: Pass2482AssetFamily;
  score: number;
  state: Pass2482AdvancedValueState;
  lanes: Pass2482RequiredLane[];
  pass2470?: Pass2470Tier180OutputMatrix | null;
}): Pass2482SurfaceVerdict[] {
  const missing = args.lanes.flatMap((lane) => lane.requiredForPaidAdvanced && lane.state !== "ready" ? lane.missingEvidence.slice(0, 2) : []);
  const ready = args.lanes.flatMap((lane) => lane.state === "ready" || lane.state === "watch" ? lane.currentEvidence.slice(0, 2) : []);
  const bySurface = new Map(args.pass2470?.surfaceSummaries.map((surface) => [surface.surface, surface]) ?? []);
  const baseSurfaces: Pass2470Surface[] = ["pdf", "shield", "real_markets"];
  return baseSurfaces.map((surface) => {
    const summary = bySurface.get(surface);
    const surfaceScore = clamp(args.score + (summary ? Math.round(((summary.readyCount - summary.blockedCount) / Math.max(1, summary.cellCount)) * 8) : -5));
    return {
      surface,
      state: args.state,
      advancedWorthinessScore: surfaceScore,
      customerVerdict: args.state === "paid_ready"
        ? `${surface} Advanced can be sold as source-bound depth, not as certainty.`
        : `${surface} Advanced should stay QA/demo or clearly bounded until the missing premium lanes are attached.`,
      readyEvidence: unique([...(ready.slice(0, 6)), summary && `${summary.readyCount}/${summary.cellCount} deterministic cells ready`]),
      missingEvidence: unique([...(missing.slice(0, 8)), ...(summary?.missingRuntimeProof.slice(0, 3) ?? [])]),
    };
  });
}

function uploadedPdfFindings(family: Pass2482AssetFamily, symbol?: string): Pass2482UploadedPdfAuditFinding[] {
  const normalized = normalizeSymbol(symbol);
  const crypto = family === "native_crypto" || family === "token_contract" || ["BTC", "SOL"].includes(normalized);
  const real = family === "real_market_stock" || family === "real_market_etf" || ["NVDA", "AAPL", "SPY"].includes(normalized);
  return [
    crypto && {
      asset: normalized || "BTC/SOL",
      surface: "pdf" as const,
      finding: "Uploaded BTC/SOL PDFs already show Basic/Pro/Advanced field-count separation, but Advanced still names missing orderbook/slippage, holder/context and derivatives/liquidation lanes.",
      implication: "Good for honest QA preview; not enough for a paid premium conclusion unless those lanes become timestamped numeric evidence.",
    },
    real && {
      asset: normalized || "NVDA/AAPL/SPY",
      surface: "real_markets" as const,
      finding: "Uploaded NVDA/SPY Real Markets PDFs show timestamp required / source ledger limited / 0 confirmed claim-source gate in several tiers.",
      implication: "Advanced should explicitly downgrade itself until second quote, filing/fundamentals and source cadence are attached.",
    },
    {
      asset: normalized || "all",
      surface: "shield" as const,
      finding: "Advanced value must be judged by proof depth, not by longer text, visual polish or a 20-field label.",
      implication: "If a lane is missing, the UI should sell clarity about missing proof, not a stronger verdict.",
    },
  ].filter(Boolean) as Pass2482UploadedPdfAuditFinding[];
}

export function buildPass2482AdvancedValueAudit(args: {
  query?: string;
  symbol?: string;
  result?: TokenRiskResult | null;
  pass2465?: Pass2465TierDepthScenarioParity | null;
  pass2470?: Pass2470Tier180OutputMatrix | null;
  pass2476?: Pass2476RuntimeReceiptPdfHashRunner | null;
  pass2483?: Pass2483PremiumEvidenceBridge | null;
  pass2485?: Pass2485PaidAdvancedReadinessFuse | null;
  pass2487?: Pass2487LiquidationReplayPaidCopyLock | null;
  pass2488?: Pass2488SupplyFilingProvenanceLock | null;
} = {}): Pass2482AdvancedValueAudit {
  const symbol = normalizeSymbol(args.symbol || args.result?.token.symbol);
  const family = resolveAssetFamily(args.result, symbol);
  const lanes = baseLanes({ family, pass2465: args.pass2465, pass2476: args.pass2476, pass2483: args.pass2483 });
  const required = lanes.filter((lane) => lane.requiredForPaidAdvanced);
  const readyCount = required.filter((lane) => lane.state === "ready").length;
  const watchCount = required.filter((lane) => lane.state === "watch").length;
  const missingCount = required.filter((lane) => lane.state === "missing").length;
  const sourceEvidenceScore = clamp(args.pass2465?.score ?? 0);
  const runtimeReceiptScore = clamp(Math.min(args.pass2476?.pdfHashCoveragePercent ?? 0, args.pass2476?.runtimeCapturedCoveragePercentAfterRun ?? 0));
  const tierDifferenceScore = clamp(args.pass2470?.deterministicHarnessCoveragePercent ?? (args.pass2465 ? 60 : 0));
  const cryptoFamily = family === "native_crypto" || family === "token_contract";
  const pass2487BlocksCryptoPaidCopy = cryptoFamily && !args.pass2487?.paidCopyAllowed;
  const pass2488BlocksProvenance = !args.pass2488?.paidProvenanceAllowed;
  const missingPenaltyScore = clamp((missingCount * 14) + Math.max(0, required.length - readyCount - watchCount) * 10 + (args.pass2483?.paidBlockers.length ? 8 : 0) + (args.pass2485?.hardBlockers.length ? 10 : 0) + (pass2487BlocksCryptoPaidCopy ? 10 : 0) + (pass2488BlocksProvenance ? 10 : 0));
  const bridgeScore = args.pass2483?.premiumEvidenceScore ?? 0;
  const advancedWorthinessScore = clamp((sourceEvidenceScore * 0.28) + (runtimeReceiptScore * 0.22) + (tierDifferenceScore * 0.2) + (bridgeScore * 0.18) + ((readyCount / Math.max(1, required.length)) * 12) - missingPenaltyScore);
  const paidAdvancedReady = advancedWorthinessScore >= 82 && missingCount === 0 && runtimeReceiptScore >= 70 && Boolean(args.pass2483?.paidAdvancedConclusionAllowed) && Boolean(args.pass2485?.paidAdvancedAllowed) && Boolean(args.pass2488?.paidProvenanceAllowed) && (!cryptoFamily || Boolean(args.pass2487?.paidCopyAllowed));
  const state: Pass2482AdvancedValueState = paidAdvancedReady
    ? "paid_ready"
    : sourceEvidenceScore <= 15 || missingCount >= Math.ceil(required.length * 0.7)
      ? "blocked"
      : tierDifferenceScore >= 70 || sourceEvidenceScore >= 45
        ? "qa_preview_only"
        : "watch";
  const customerVerdict = paidAdvancedReady
    ? "Advanced is worth charging for as source-bound depth, with missing-data boundaries still visible."
    : "Advanced is not yet a paid conclusion. It can be a QA/demo preview or a paid missing-proof map only if the UI clearly says which premium lanes are missing.";
  const operatorVerdict = paidAdvancedReady
    ? "Keep payment entitlement server-side and preserve all proof locks."
    : `Close the premium evidence lanes before marketing Advanced as worth buying: orderbook/slippage, derivatives/liquidations, holder/supply or filings/second-provider, plus runtime receipts. PASS2483=${args.pass2483?.state ?? "missing"}:${args.pass2483?.premiumEvidenceScore ?? 0}/100; PASS2485=${args.pass2485?.state ?? "missing"}:${args.pass2485?.readinessScore ?? 0}/100; PASS2487=${args.pass2487?.state ?? "missing"}:${args.pass2487?.replayReadinessScore ?? 0}/100; PASS2488=${args.pass2488?.state ?? "missing"}:${args.pass2488?.provenanceScore ?? 0}/100.`;
  const surface = surfaceVerdicts({ family, score: advancedWorthinessScore, state, lanes, pass2470: args.pass2470 });
  const findings = uploadedPdfFindings(family, symbol);
  const fingerprint = `PASS2482-${stableHash({ query: args.query, symbol, family, state, advancedWorthinessScore, lanes: lanes.map((lane) => [lane.id, lane.state]) })}`;
  return {
    version: PASS2482_ADVANCED_VALUE_AUDIT_ID,
    state,
    query: args.query,
    symbol,
    assetFamily: family,
    advancedWorthinessScore,
    paidAdvancedReady,
    canChargeForAdvancedConclusion: paidAdvancedReady,
    publicPricingCopyAllowed: paidAdvancedReady,
    customerVerdict,
    operatorVerdict,
    sourceEvidenceScore,
    runtimeReceiptScore,
    tierDifferenceScore,
    missingPenaltyScore,
    requiredLanes: lanes,
    surfaceVerdicts: surface,
    uploadedPdfAuditFindings: findings,
    noFakePaidValueRules: [
      "Advanced may be sold only as deeper evidence, never as investment advice or certainty.",
      "If orderbook/slippage, derivatives, holders/unlocks or filings are missing, show them as locked lanes, not hidden gaps.",
      "Real Markets must never show token scam lanes for stocks/ETFs; crypto must never show stock filing claims.",
      "Wallet connect is identity/context only. Paid Advanced requires server-side entitlement and proof receipts.",
      "PDF preview and download must share the same payload, selected tier and Advanced value decision.",
    ],
    nextImplementationActions: unique([
      "Mount PASS2482 decision strip in Shield/Real Markets/PDF preview before the Advanced button looks sellable.",
      "PASS2483 premium bridge must be visible in Shield/Real Markets/PDF/Angel: paid Advanced is proof-depth only when premium lanes are attached.",
      "PASS2485 paid Advanced fuse must be true before CTA or copy can imply Advanced is worth buying as a completed paid verdict.",
      cryptoFamily ? "PASS2487 liquidation replay paid-copy lock must be true before crypto Advanced can use confirmed squeeze/derivatives paid copy." : null,
      "PASS2488 supply/holder or SEC/XBRL/fundamental provenance must be true before Advanced can be sold as paid-ready.",
      family === "native_crypto" || family === "token_contract" ? "Attach real orderbook spread/depth + 10k slippage + derivatives/funding/OI/long-short/liquidation receipts." : null,
      family === "token_contract" ? "Attach contract/admin/tax/LP lock and holder concentration receipts before rug-pull/trap copy strengthens." : null,
      family === "real_market_stock" || family === "real_market_etf" ? "Attach second quote provider, observedAt, SEC/XBRL/fundamentals and event/news lane before selling Real Markets Advanced." : null,
      "Capture runtime API payload, browser screenshot, PDF hash and Angel replay receipts in durable storage before claiming 180 live outputs.",
      "Keep Basic useful and free; make Pro a real comparison tier; make Advanced a proof-depth tier, not longer text.",
    ]),
    fingerprint,
    generatedAt: new Date().toISOString(),
  };
}
