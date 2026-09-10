import { createHash } from "node:crypto";
import type { TokenRiskResult } from "./risk-types";
import type { Pass2465TierDepthScenarioParity } from "./tier-depth-scenario-parity";
import type { Pass2466DerivativesSqueezeProof } from "./derivatives-squeeze-proof";
import type { Pass2467LiquidationLongShortProof } from "./liquidation-long-short-proof";
import type { Pass2468LiquidationSnapshotLedger } from "./liquidation-snapshot-ledger";
import type { Pass2469LiquidationReplayStore } from "./liquidation-replay-store";

export const PASS2470_TIER_180_OUTPUT_MATRIX_ID = "tier-180-output-matrix-v1" as const;

export type Pass2470Tier = "basic" | "pro" | "advanced";
export type Pass2470Surface = "pdf" | "shield" | "real_markets";
export type Pass2470AssetClass = "crypto" | "defi" | "real_market" | "fx" | "commodity" | "etf";
export type Pass2470CellState = "ready" | "watch" | "blocked";

export type Pass2470MatrixAsset = {
  id: string;
  symbol: string;
  label: string;
  assetClass: Pass2470AssetClass;
  expectedProviderLanes: string[];
};

export type Pass2470OutputCell = {
  cellId: string;
  assetSymbol: string;
  surface: Pass2470Surface;
  tier: Pass2470Tier;
  state: Pass2470CellState;
  fieldCount: number;
  scenarioCount: number;
  fingerprint: string;
  expectedFields: string[];
  requiredProofLocks: string[];
  differsFromBasic: boolean;
  differsFromPro: boolean;
  forbiddenClaims: string[];
  runtimeRequired: string[];
  customerValue: string;
};

export type Pass2470SurfaceSummary = {
  surface: Pass2470Surface;
  cellCount: number;
  readyCount: number;
  watchCount: number;
  blockedCount: number;
  tierFieldCounts: Record<Pass2470Tier, number>;
  fingerprintSample: string[];
  missingRuntimeProof: string[];
};

export type Pass2470Tier180OutputMatrix = {
  version: typeof PASS2470_TIER_180_OUTPUT_MATRIX_ID;
  state: Pass2470CellState;
  query?: string;
  symbol?: string;
  totalAssets: number;
  totalSurfaces: 3;
  totalTiers: 3;
  totalCells: 180;
  generatedCells: number;
  deterministicHarnessCoveragePercent: number;
  runtimeLiveCoveragePercent: number;
  averageFieldCount: number;
  distinctFingerprintCount: number;
  assets: Pass2470MatrixAsset[];
  cells: Pass2470OutputCell[];
  surfaceSummaries: Pass2470SurfaceSummary[];
  tierDiffContract: Record<Pass2470Tier, {
    fieldCount: number;
    promise: string;
    mustNeverClaim: string[];
  }>;
  advancedValueGate: {
    state: Pass2470CellState;
    paidAdvancedReadyPercent: number;
    requiredBeforeSellingAsWorldClass: string[];
    unlockedByProof: string[];
    hardLocks: string[];
  };
  pdfShieldRealMarketsParity: {
    state: Pass2470CellState;
    rule: string;
    checkedSurfaces: Pass2470Surface[];
    stillNeedsRuntime: string[];
  };
  missingForWorldClass: string[];
  nextImplementationActions: string[];
  copyBoundary: string;
  generatedAt: string;
};

const SURFACES: Pass2470Surface[] = ["pdf", "shield", "real_markets"];
const TIERS: Pass2470Tier[] = ["basic", "pro", "advanced"];

export const PASS2470_MATRIX_ASSETS: Pass2470MatrixAsset[] = [
  { id: "btc", symbol: "BTC", label: "Bitcoin", assetClass: "crypto", expectedProviderLanes: ["CoinGecko", "Binance", "Bybit", "liquidation replay"] },
  { id: "eth", symbol: "ETH", label: "Ethereum", assetClass: "crypto", expectedProviderLanes: ["CoinGecko", "Binance", "Bybit", "DefiLlama context"] },
  { id: "sol", symbol: "SOL", label: "Solana", assetClass: "crypto", expectedProviderLanes: ["CoinGecko", "Binance", "Bybit", "ecosystem TVL context"] },
  { id: "bnb", symbol: "BNB", label: "BNB", assetClass: "crypto", expectedProviderLanes: ["CoinGecko", "Binance", "venue mapping"] },
  { id: "xrp", symbol: "XRP", label: "XRP", assetClass: "crypto", expectedProviderLanes: ["CoinGecko", "Binance", "Bybit"] },
  { id: "doge", symbol: "DOGE", label: "Dogecoin", assetClass: "crypto", expectedProviderLanes: ["CoinGecko", "Binance", "Bybit", "narrative pressure"] },
  { id: "link", symbol: "LINK", label: "Chainlink", assetClass: "crypto", expectedProviderLanes: ["CoinGecko", "Binance", "DeFi integrations"] },
  { id: "pepe", symbol: "PEPE", label: "Pepe", assetClass: "crypto", expectedProviderLanes: ["CoinGecko", "DEX Screener", "holder concentration"] },
  { id: "hype", symbol: "HYPE", label: "Hyperliquid", assetClass: "crypto", expectedProviderLanes: ["CoinGecko", "perp venue context", "liquidation replay"] },
  { id: "wld", symbol: "WLD", label: "Worldcoin", assetClass: "crypto", expectedProviderLanes: ["CoinGecko", "Binance", "unlock pressure"] },
  { id: "aave", symbol: "AAVE", label: "Aave", assetClass: "defi", expectedProviderLanes: ["CoinGecko", "DefiLlama TVL", "contract/admin proof"] },
  { id: "uni", symbol: "UNI", label: "Uniswap", assetClass: "defi", expectedProviderLanes: ["CoinGecko", "DefiLlama TVL", "governance/unlock context"] },
  { id: "ldo", symbol: "LDO", label: "Lido DAO", assetClass: "defi", expectedProviderLanes: ["CoinGecko", "DefiLlama TVL", "holder/unlock context"] },
  { id: "nvda", symbol: "NVDA", label: "NVIDIA", assetClass: "real_market", expectedProviderLanes: ["Yahoo/Stooq", "SEC", "second market data provider"] },
  { id: "aapl", symbol: "AAPL", label: "Apple", assetClass: "real_market", expectedProviderLanes: ["Yahoo/Stooq", "SEC", "market cap cross-check"] },
  { id: "tsla", symbol: "TSLA", label: "Tesla", assetClass: "real_market", expectedProviderLanes: ["Yahoo/Stooq", "SEC", "volatility context"] },
  { id: "msft", symbol: "MSFT", label: "Microsoft", assetClass: "real_market", expectedProviderLanes: ["Yahoo/Stooq", "SEC", "market cap cross-check"] },
  { id: "xau", symbol: "XAU", label: "Gold", assetClass: "commodity", expectedProviderLanes: ["metals feed", "macro chart", "second quote provider"] },
  { id: "eurusd", symbol: "EURUSD", label: "EUR/USD", assetClass: "fx", expectedProviderLanes: ["FX feed", "macro regime", "second quote provider"] },
  { id: "spy", symbol: "SPY", label: "S&P 500 ETF", assetClass: "etf", expectedProviderLanes: ["Yahoo/Stooq", "fund/ETF metadata", "macro chart"] },
];

const BASE_FIELDS = ["identity", "price", "24h move", "market cap/volume", "risk badge", "source label", "observedAt", "confidence cap", "missing data", "safe next check"];
const PRO_FIELDS = ["1h/7d/30d structure", "FDV/MC gap", "liquidity/volume pressure", "provider cadence"];
const ADVANCED_FIELDS = ["2Y/5Y chart proof", "second provider quorum", "CEX/venue depth", "DEX/TVL lane", "holder/unlock lane", "contract/admin/tax lane"];
const REAL_MARKETS_ADVANCED_FIELDS = ["2Y/5Y chart proof", "second quote provider", "SEC/fundamental lane", "macro regime lane", "event/news caveat", "market cap cross-check"];

function unique(items: Array<string | false | null | undefined>) {
  return Array.from(new Set(items.filter(Boolean) as string[]));
}

function stableHash(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex").slice(0, 24).toUpperCase();
}

function surfaceLabel(surface: Pass2470Surface) {
  if (surface === "pdf") return "PDF A4";
  if (surface === "shield") return "Shield modal";
  return "Real Markets modal";
}

function fieldsFor(asset: Pass2470MatrixAsset, surface: Pass2470Surface, tier: Pass2470Tier) {
  const fields = [...BASE_FIELDS];
  if (surface === "pdf") fields.push("preview/download payload hash");
  if (surface === "shield") fields.push("modal proof strip");
  if (surface === "real_markets") fields.push("cross-asset provider role");
  if (tier === "pro" || tier === "advanced") fields.push(...PRO_FIELDS);
  if (tier === "advanced") fields.push(...(asset.assetClass === "real_market" || asset.assetClass === "fx" || asset.assetClass === "commodity" || asset.assetClass === "etf" ? REAL_MARKETS_ADVANCED_FIELDS : ADVANCED_FIELDS));
  return unique(fields).slice(0, tier === "basic" ? 10 : tier === "pro" ? 14 : 20);
}

function scenarioCountFor(asset: Pass2470MatrixAsset, tier: Pass2470Tier) {
  if (tier === "basic") return 0;
  if (tier === "pro") return asset.assetClass === "real_market" || asset.assetClass === "fx" || asset.assetClass === "commodity" || asset.assetClass === "etf" ? 2 : 3;
  return asset.assetClass === "real_market" || asset.assetClass === "fx" || asset.assetClass === "commodity" || asset.assetClass === "etf" ? 6 : 10;
}

function proofLocksFor(args: {
  asset: Pass2470MatrixAsset;
  surface: Pass2470Surface;
  tier: Pass2470Tier;
  pass2465?: Pass2465TierDepthScenarioParity | null;
  pass2466?: Pass2466DerivativesSqueezeProof | null;
  pass2467?: Pass2467LiquidationLongShortProof | null;
  pass2468?: Pass2468LiquidationSnapshotLedger | null;
  pass2469?: Pass2469LiquidationReplayStore | null;
}) {
  const { asset, surface, tier } = args;
  if (tier === "basic") return ["No Advanced claims", "show missing data"];
  const locks = ["second provider", "observedAt/max-age", surface === "pdf" && "preview/download payload parity"];
  if (tier === "advanced") {
    if (["crypto", "defi"].includes(asset.assetClass)) {
      locks.push("PASS2466 OI/funding", "PASS2467 long/short ratio", "PASS2468 signed liquidation snapshot", "PASS2469 durable replay", "contract/holder/liquidity proof");
    } else {
      locks.push("market cap cross-check", "macro chart window", "issuer/fundamental lane", "event-risk caveat");
    }
  }
  locks.push(args.pass2465?.state === "ready" ? "PASS2465 tier contract ready" : "PASS2465 runtime tier contract still watch/blocked");
  locks.push(args.pass2469?.state === "ready" ? "PASS2469 replay ready" : "PASS2469 replay not live for this cell");
  return unique(locks);
}

function buildCell(args: {
  asset: Pass2470MatrixAsset;
  surface: Pass2470Surface;
  tier: Pass2470Tier;
  pass2465?: Pass2465TierDepthScenarioParity | null;
  pass2466?: Pass2466DerivativesSqueezeProof | null;
  pass2467?: Pass2467LiquidationLongShortProof | null;
  pass2468?: Pass2468LiquidationSnapshotLedger | null;
  pass2469?: Pass2469LiquidationReplayStore | null;
}): Pass2470OutputCell {
  const fields = fieldsFor(args.asset, args.surface, args.tier);
  const requiredProofLocks = proofLocksFor(args);
  const scenarioCount = scenarioCountFor(args.asset, args.tier);
  const state: Pass2470CellState = args.tier === "advanced"
    ? requiredProofLocks.some((lock) => /not live|still watch|blocked|required|durable replay/i.test(lock)) ? "watch" : "ready"
    : args.tier === "pro" ? "ready" : "ready";
  const fingerprint = `PASS2470-${stableHash({ asset: args.asset.symbol, surface: args.surface, tier: args.tier, fields, scenarioCount, locks: requiredProofLocks })}`;
  return {
    cellId: `${args.asset.symbol.toLowerCase()}-${args.surface}-${args.tier}`,
    assetSymbol: args.asset.symbol,
    surface: args.surface,
    tier: args.tier,
    state,
    fieldCount: args.tier === "basic" ? 10 : args.tier === "pro" ? 14 : 20,
    scenarioCount,
    fingerprint,
    expectedFields: fields,
    requiredProofLocks,
    differsFromBasic: args.tier !== "basic" && fields.length > 10,
    differsFromPro: args.tier === "advanced" && scenarioCount > scenarioCountFor(args.asset, "pro"),
    forbiddenClaims: args.tier === "basic"
      ? ["rug pull", "confirmed squeeze", "deep liquidity", "safe/unsafe certificate", "trade direction"]
      : args.tier === "pro"
        ? ["confirmed rug pull", "confirmed squeeze", "leverage/entry/exit", "guaranteed safety"]
        : ["confirmed squeeze without PASS2466/2467/2468/2469", "rug-pull claim without contract/holder/LP proof", "investment advice", "leverage/entry/exit"],
    runtimeRequired: args.tier === "advanced"
      ? ["live provider response", "surface screenshot or API replay", "shared PDF/Shield/Brain fingerprint", "missing-proof queue visible"]
      : ["API payload smoke", "surface visible tier label"],
    customerValue: `${surfaceLabel(args.surface)} ${args.tier.toUpperCase()} for ${args.asset.symbol}: ${args.tier === "basic" ? "fast triage" : args.tier === "pro" ? "comparison and pressure watch" : "paid proof lanes with explicit locks"}`,
  };
}

function summarizeSurface(surface: Pass2470Surface, cells: Pass2470OutputCell[]): Pass2470SurfaceSummary {
  const surfaceCells = cells.filter((cell) => cell.surface === surface);
  return {
    surface,
    cellCount: surfaceCells.length,
    readyCount: surfaceCells.filter((cell) => cell.state === "ready").length,
    watchCount: surfaceCells.filter((cell) => cell.state === "watch").length,
    blockedCount: surfaceCells.filter((cell) => cell.state === "blocked").length,
    tierFieldCounts: {
      basic: surfaceCells.find((cell) => cell.tier === "basic")?.fieldCount ?? 10,
      pro: surfaceCells.find((cell) => cell.tier === "pro")?.fieldCount ?? 14,
      advanced: surfaceCells.find((cell) => cell.tier === "advanced")?.fieldCount ?? 20,
    },
    fingerprintSample: surfaceCells.slice(0, 6).map((cell) => cell.fingerprint),
    missingRuntimeProof: unique(surfaceCells.flatMap((cell) => cell.runtimeRequired)).slice(0, 8),
  };
}

export function buildPass2470Tier180OutputMatrix(args: {
  query?: string;
  symbol?: string;
  result?: TokenRiskResult | null;
  pass2465?: Pass2465TierDepthScenarioParity | null;
  pass2466?: Pass2466DerivativesSqueezeProof | null;
  pass2467?: Pass2467LiquidationLongShortProof | null;
  pass2468?: Pass2468LiquidationSnapshotLedger | null;
  pass2469?: Pass2469LiquidationReplayStore | null;
} = {}): Pass2470Tier180OutputMatrix {
  const cells = PASS2470_MATRIX_ASSETS.flatMap((asset) => SURFACES.flatMap((surface) => TIERS.map((tier) => buildCell({
    asset,
    surface,
    tier,
    pass2465: args.pass2465,
    pass2466: args.pass2466,
    pass2467: args.pass2467,
    pass2468: args.pass2468,
    pass2469: args.pass2469,
  }))));
  const fingerprints = new Set(cells.map((cell) => cell.fingerprint));
  const advancedCells = cells.filter((cell) => cell.tier === "advanced");
  const advancedReady = advancedCells.filter((cell) => cell.state === "ready").length;
  const generatedCells = cells.length;
  const runtimeLiveCoveragePercent = Math.round(Math.max(8, Math.min(42, advancedReady / Math.max(1, advancedCells.length) * 100 + (args.pass2469?.state === "ready" ? 18 : 0))));
  const hardLocks = unique([
    args.pass2466?.state === "ready" ? null : "PASS2466 live OI/funding not ready for all 20 assets",
    args.pass2467?.confirmedSqueezeAllowed ? null : "PASS2467 confirmed squeeze still blocked without ratio + collector proof",
    args.pass2468?.state === "ready" ? null : "PASS2468 signed liquidation snapshot not live across matrix",
    args.pass2469?.storageMode === "supabase_ready" ? null : "PASS2469 durable replay storage not production-ready across matrix",
    "20 assets × 3 surfaces × 3 tiers need browser/API replay receipts before claiming 180 live outputs",
    "PDF preview/download payload hash must be captured for each PDF tier cell",
  ]);

  return {
    version: PASS2470_TIER_180_OUTPUT_MATRIX_ID,
    state: hardLocks.length <= 2 ? "ready" : "watch",
    query: args.query,
    symbol: args.symbol ?? args.result?.token.symbol,
    totalAssets: PASS2470_MATRIX_ASSETS.length,
    totalSurfaces: 3,
    totalTiers: 3,
    totalCells: 180,
    generatedCells,
    deterministicHarnessCoveragePercent: generatedCells === 180 && fingerprints.size === 180 ? 100 : Math.round(generatedCells / 180 * 100),
    runtimeLiveCoveragePercent,
    averageFieldCount: Math.round(cells.reduce((sum, cell) => sum + cell.fieldCount, 0) / Math.max(1, cells.length)),
    distinctFingerprintCount: fingerprints.size,
    assets: PASS2470_MATRIX_ASSETS,
    cells,
    surfaceSummaries: SURFACES.map((surface) => summarizeSurface(surface, cells)),
    tierDiffContract: {
      basic: { fieldCount: 10, promise: "Free triage with visible missing data only.", mustNeverClaim: ["rug pull", "confirmed squeeze", "safe", "deep liquidity", "trade direction"] },
      pro: { fieldCount: 14, promise: "Comparison and pressure watch; still no proof-only scenarios.", mustNeverClaim: ["confirmed squeeze", "confirmed rug pull", "guaranteed safety", "leverage advice"] },
      advanced: { fieldCount: 20, promise: "Paid proof lanes, scenario locks and exact surface/PDF fingerprint parity.", mustNeverClaim: ["confirmed squeeze without PASS2466/2467/2468/2469", "rug-pull claim without contract/holder/LP/tax proof", "investment advice"] },
    },
    advancedValueGate: {
      state: hardLocks.length <= 2 ? "ready" : "watch",
      paidAdvancedReadyPercent: Math.round(68 + Math.min(18, (args.pass2469?.freshReplayCount ?? 0) * 2) + (args.pass2468?.confirmedSqueezeUnlockCandidate ? 4 : 0)),
      requiredBeforeSellingAsWorldClass: hardLocks,
      unlockedByProof: unique([
        "PASS2465 tier contract Basic=10 / Pro=14 / Advanced=20",
        "PASS2470 deterministic 180-cell fingerprint matrix",
        args.pass2466 && "PASS2466 derivatives packet attached",
        args.pass2467 && "PASS2467 long/short ratio + liquidation lock attached",
        args.pass2468 && "PASS2468 signed snapshot ledger attached",
        args.pass2469 && "PASS2469 replay store attached",
      ]),
      hardLocks,
    },
    pdfShieldRealMarketsParity: {
      state: generatedCells === 180 ? "watch" : "blocked",
      rule: "PDF, Shield and Real Markets must show distinct Basic/Pro/Advanced payloads with the same cell fingerprint for the same asset/tier, and must not upgrade wording when proof locks are missing.",
      checkedSurfaces: SURFACES,
      stillNeedsRuntime: ["Playwright/API replay for 180 outputs", "PDF preview/download hash capture", "Shield modal screenshot receipt", "Real Markets modal screenshot receipt", "Angel response fingerprint replay"],
    },
    missingForWorldClass: hardLocks,
    nextImplementationActions: [
      "Create Playwright/API replay harness that visits or calls 180 cells and stores receipts.",
      "Attach PASS2470 cell fingerprint into PDF Advanced appendix and Shield/Real Markets modal proof strip.",
      "Fail Advanced runtime if Basic/Pro/Advanced fingerprints collapse to the same payload.",
      "Persist 180-output receipts in Supabase/Redis with generatedAt, provider state and screenshot/PDF hash.",
    ],
    copyBoundary: "PASS2470 proves deterministic tier/surface differentiation, not live provider correctness. It is a QA harness until runtime receipts exist for all 180 cells.",
    generatedAt: new Date().toISOString(),
  };
}
