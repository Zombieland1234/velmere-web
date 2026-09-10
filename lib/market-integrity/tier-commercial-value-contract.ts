import { createHash } from "node:crypto";
import type { TokenRiskResult } from "./risk-types";
import type { Pass2482AdvancedValueAudit } from "./advanced-value-audit";
import type { Pass2485PaidAdvancedReadinessFuse } from "./paid-advanced-readiness-fuse";
import type { Pass2487LiquidationReplayPaidCopyLock } from "./liquidation-replay-paid-copy-lock";
import type { Pass2488SupplyFilingProvenanceLock } from "./supply-filing-provenance-lock";

export const PASS2489_TIER_COMMERCIAL_VALUE_CONTRACT_ID = "tier-commercial-value-contract-v1" as const;

export type Pass2489TierId = "basic" | "pro" | "advanced";
export type Pass2489State = "paid_surface_ready" | "sell_as_missing_proof_map" | "qa_preview_only" | "blocked";
export type Pass2489AssetFamily = "crypto" | "real_market" | "unknown";
export type Pass2489CopyMode = "paid_verdict_allowed" | "sell_as_missing_proof_map_only" | "free_preview_only" | "blocked";

export type Pass2489TierRow = {
  tier: Pass2489TierId;
  fieldBudget: 10 | 14 | 20;
  customerPromise: string;
  visibleSections: string[];
  requiredProof: string[];
  currentlyMissing: string[];
  allowedCopy: string[];
  forbiddenCopy: string[];
  commercialValue: "public_value" | "research_value" | "premium_value_locked" | "premium_value_allowed";
};

export type Pass2489TierCommercialValueContract = {
  version: typeof PASS2489_TIER_COMMERCIAL_VALUE_CONTRACT_ID;
  state: Pass2489State;
  query?: string;
  symbol?: string;
  assetFamily: Pass2489AssetFamily;
  paidAdvancedAllowed: boolean;
  advancedWorthChargingForNow: boolean;
  advancedWorthChargingForMissingProofMap: boolean;
  advancedCopyMode: Pass2489CopyMode;
  customerValueScore: number;
  tierDifferentiationScore: number;
  paidVerdictBlockers: string[];
  userFacingVerdict: string;
  operatorVerdict: string;
  tierRows: Pass2489TierRow[];
  checkoutGuardrails: string[];
  surfaceCopyRules: string[];
  nextImplementationActions: string[];
  fingerprint: string;
  generatedAt: string;
};

function unique<T>(items: Array<T | false | null | undefined>) {
  return Array.from(new Set(items.filter(Boolean) as T[]));
}

function clamp(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function hash(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex").slice(0, 32).toUpperCase();
}

function normalizeSymbol(value?: string) {
  return String(value ?? "").trim().toUpperCase().replace(/[^A-Z0-9.-]/g, "").slice(0, 32);
}

function resolveFamily(result?: TokenRiskResult | null, pass2488?: Pass2488SupplyFilingProvenanceLock | null, symbol?: string): Pass2489AssetFamily {
  if (pass2488?.assetFamily === "crypto" || pass2488?.assetFamily === "real_market") return pass2488.assetFamily;
  const assetClass = result?.token.assetClass;
  if (assetClass === "stock" || assetClass === "etf" || assetClass === "index" || assetClass === "fx" || assetClass === "commodity" || assetClass === "real_estate" || assetClass === "exchange_equity") return "real_market";
  const normalized = normalizeSymbol(symbol || result?.token.symbol);
  if (assetClass === "crypto" || result?.token.chainId || result?.token.tokenAddress || result?.token.pairAddress || result?.token.dexId) return "crypto";
  if (["BTC", "ETH", "SOL", "BNB", "XRP", "DOGE", "ADA", "AVAX", "DOT", "LINK", "PEPE", "LTC", "TRX"].includes(normalized)) return "crypto";
  return "unknown";
}

function premiumLocks(args: {
  assetFamily: Pass2489AssetFamily;
  pass2482?: Pass2482AdvancedValueAudit | null;
  pass2485?: Pass2485PaidAdvancedReadinessFuse | null;
  pass2487?: Pass2487LiquidationReplayPaidCopyLock | null;
  pass2488?: Pass2488SupplyFilingProvenanceLock | null;
}) {
  return unique([
    ...(args.pass2482?.requiredLanes
      ?.filter((lane) => lane.requiredForPaidAdvanced && lane.state !== "ready")
      .map((lane) => `${lane.label}: ${lane.state}`) ?? []),
    ...(args.pass2485?.hardBlockers ?? []),
    args.assetFamily === "crypto" && args.pass2487 && !args.pass2487.paidCopyAllowed && "liquidation replay paid-copy lock not ready",
    ...(args.pass2487?.hardLocks ?? []),
    args.pass2488 && !args.pass2488.paidProvenanceAllowed && "supply/filing provenance lock not ready",
    ...(args.pass2488?.hardLocks ?? []),
    !args.pass2482 && "PASS2482 Advanced value audit missing",
    !args.pass2485 && "PASS2485 paid Advanced fuse missing",
    !args.pass2488 && "PASS2488 supply/filing provenance lock missing",
  ]).slice(0, 20);
}

function buildTierRows(args: {
  assetFamily: Pass2489AssetFamily;
  paidAdvancedAllowed: boolean;
  locks: string[];
}): Pass2489TierRow[] {
  const advancedCryptoProof = ["spot orderbook/slippage", "OI/funding", "long-short ratio", "liquidation replay", "supply/holder/unlock provenance", "PDF/Brain/Angel parity"];
  const advancedRealProof = ["independent second quote", "provider timestamp", "SEC/CIK identity", "XBRL/fundamental freshness", "ETF holdings if applicable", "PDF/Brain/Angel parity"];
  const advancedProof = args.assetFamily === "real_market" ? advancedRealProof : advancedCryptoProof;
  const advancedMissing = args.locks.length ? args.locks : args.paidAdvancedAllowed ? [] : ["premium evidence locks not fully attached"];
  return [
    {
      tier: "basic",
      fieldBudget: 10,
      customerPromise: "Fast public read: identity, price context, visible source label, confidence cap and one next safe action.",
      visibleSections: ["identity", "price", "24h move", "market cap", "volume", "risk score", "source label", "confidence cap", "missing-data badge", "next safe action"],
      requiredProof: ["one market/source lane", "visible timestamp when available", "no-advice copy boundary"],
      currentlyMissing: [],
      allowedCopy: ["quick snapshot", "what is visible", "what is missing"],
      forbiddenCopy: ["complete audit", "paid Advanced conclusion", "entry/exit or leverage wording"],
      commercialValue: "public_value",
    },
    {
      tier: "pro",
      fieldBudget: 14,
      customerPromise: "Comparison layer: source quality, method, chart quality, contradictions and confidence waterfall.",
      visibleSections: ["Basic sections", "1h/7d/30d", "range", "source quality", "second-source status", "methodology", "chart gaps", "contradictions", "confidence waterfall", "operator next step", "provider age", "PDF preview status", "locale status", "safe summary"],
      requiredProof: ["second-source status", "methodology explanation", "chart/source freshness disclosure"],
      currentlyMissing: [],
      allowedCopy: ["source comparison", "data-quality context", "limited contradiction scan"],
      forbiddenCopy: ["holder/depth/fundamental proof when not attached", "paid verdict", "guaranteed safety"],
      commercialValue: "research_value",
    },
    {
      tier: "advanced",
      fieldBudget: 20,
      customerPromise: args.paidAdvancedAllowed
        ? "Paid deep proof: premium lanes are attached and copy may present a paid evidence verdict within source limits."
        : "Premium missing-proof map: Advanced shows exactly which paid-grade proof lanes are ready, watch or blocked before any verdict.",
      visibleSections: ["Pro sections", "premium lane status", "orderbook/second quote", "derivatives or filings", "supply/holders or fundamentals", "scenario locks", "runtime receipts", "PDF parity", "Angel parity", "hard blockers", "paid CTA state", "evidence fingerprint", "source freshness", "confidence cap", "operator actions", "contradiction radar", "customer boundary", "safe conclusion", "export status", "review receipt"],
      requiredProof: advancedProof,
      currentlyMissing: advancedMissing,
      allowedCopy: args.paidAdvancedAllowed ? ["source-bound paid verdict", "premium evidence depth", "blocked/unblocked lane reasons"] : ["missing-proof map", "QA preview", "which lanes block paid verdict"],
      forbiddenCopy: ["worth buying because text is longer", "confirmed squeeze without replay", "fundamental certainty without filings", "investment advice"],
      commercialValue: args.paidAdvancedAllowed ? "premium_value_allowed" : "premium_value_locked",
    },
  ];
}

export function buildPass2489TierCommercialValueContract(args: {
  query?: string;
  symbol?: string;
  result?: TokenRiskResult | null;
  pass2482?: Pass2482AdvancedValueAudit | null;
  pass2485?: Pass2485PaidAdvancedReadinessFuse | null;
  pass2487?: Pass2487LiquidationReplayPaidCopyLock | null;
  pass2488?: Pass2488SupplyFilingProvenanceLock | null;
}): Pass2489TierCommercialValueContract {
  const assetFamily = resolveFamily(args.result, args.pass2488, args.symbol);
  const cryptoReplayReady = assetFamily !== "crypto" || Boolean(args.pass2487?.paidCopyAllowed);
  const paidAdvancedAllowed = Boolean(args.pass2482?.canChargeForAdvancedConclusion && args.pass2485?.paidAdvancedAllowed && args.pass2488?.paidProvenanceAllowed && cryptoReplayReady);
  const locks = premiumLocks({ assetFamily, pass2482: args.pass2482, pass2485: args.pass2485, pass2487: args.pass2487, pass2488: args.pass2488 });
  const advancedWorthChargingForMissingProofMap = !paidAdvancedAllowed && Boolean(args.pass2482 || args.pass2485 || args.pass2488) && locks.length > 0;
  const state: Pass2489State = paidAdvancedAllowed
    ? "paid_surface_ready"
    : advancedWorthChargingForMissingProofMap
      ? "sell_as_missing_proof_map"
      : args.pass2482 || args.pass2485 || args.pass2488
        ? "qa_preview_only"
        : "blocked";
  const customerValueScore = clamp(
    (args.pass2482?.advancedWorthinessScore ?? 0) * 0.3 +
    (args.pass2485?.readinessScore ?? 0) * 0.25 +
    (args.pass2488?.provenanceScore ?? 0) * 0.2 +
    (args.pass2487?.replayReadinessScore ?? (assetFamily === "crypto" ? 0 : 60)) * 0.15 +
    (paidAdvancedAllowed ? 10 : advancedWorthChargingForMissingProofMap ? 6 : 0),
  );
  const tierDifferentiationScore = clamp(70 + (args.pass2482 ? 8 : 0) + (args.pass2485 ? 8 : 0) + (args.pass2488 ? 8 : 0) + (paidAdvancedAllowed ? 6 : 0));
  const advancedCopyMode: Pass2489CopyMode = paidAdvancedAllowed
    ? "paid_verdict_allowed"
    : advancedWorthChargingForMissingProofMap
      ? "sell_as_missing_proof_map_only"
      : state === "qa_preview_only"
        ? "free_preview_only"
        : "blocked";
  const tierRows = buildTierRows({ assetFamily, paidAdvancedAllowed, locks });
  const userFacingVerdict = paidAdvancedAllowed
    ? "Advanced is worth charging for as a source-bound paid evidence verdict, while still avoiding investment advice or safety guarantees."
    : advancedWorthChargingForMissingProofMap
      ? "Advanced is not ready as a final paid verdict, but can be positioned as a premium missing-proof map if the checkout copy says exactly that."
      : "Advanced should stay in QA/free preview until the premium evidence contract is mounted.";
  const operatorVerdict = paidAdvancedAllowed
    ? "Allow paid CTA and paid verdict copy only with visible PASS2489 fingerprint and PASS2482/2485/2488 gates."
    : "Downgrade Advanced CTA to QA preview or missing-proof map; do not sell it as a finished verdict.";
  return {
    version: PASS2489_TIER_COMMERCIAL_VALUE_CONTRACT_ID,
    state,
    query: args.query,
    symbol: normalizeSymbol(args.symbol || args.result?.token.symbol),
    assetFamily,
    paidAdvancedAllowed,
    advancedWorthChargingForNow: paidAdvancedAllowed,
    advancedWorthChargingForMissingProofMap,
    advancedCopyMode,
    customerValueScore,
    tierDifferentiationScore,
    paidVerdictBlockers: locks,
    userFacingVerdict,
    operatorVerdict,
    tierRows,
    checkoutGuardrails: [
      "Checkout copy must say paid verdict only when paidAdvancedAllowed=true.",
      "If advancedCopyMode=sell_as_missing_proof_map_only, sell clarity about missing proof, not a final market/security verdict.",
      "Basic and Pro must stay useful and honest; paid Advanced value comes from evidence lanes, not hidden magic.",
      "Wallet connect is identity/context only; entitlement must be server-side.",
    ],
    surfaceCopyRules: [
      "Shield, Real Markets, VLM Brain, Lens PDF and Angel must show the same Advanced copy mode.",
      "PDF/preview/download must reuse the same payload and fingerprint before paid language is allowed.",
      "If any required premium lane is blocked, state the blocker in the customer UI instead of filling with narrative.",
      "No ROI, no guaranteed safety, no trade instruction and no confirmed squeeze without replay proof.",
    ],
    nextImplementationActions: paidAdvancedAllowed
      ? ["Attach entitlement ledger and paid receipt to PASS2489", "Capture runtime browser/PDF/Angel parity receipts", "Add customer-facing export receipt"]
      : ["Rename CTA to Advanced missing-proof map until paidAdvancedAllowed=true", "Hydrate blocked premium lanes before selling final verdict", "Add side-by-side Basic/Pro/Advanced value matrix above purchase"],
    fingerprint: hash({
      version: PASS2489_TIER_COMMERCIAL_VALUE_CONTRACT_ID,
      symbol: normalizeSymbol(args.symbol || args.result?.token.symbol),
      assetFamily,
      paidAdvancedAllowed,
      advancedCopyMode,
      locks: locks.slice(0, 12),
      tierRows: tierRows.map((row) => [row.tier, row.fieldBudget, row.commercialValue, row.currentlyMissing.length]),
    }),
    generatedAt: new Date().toISOString(),
  };
}
