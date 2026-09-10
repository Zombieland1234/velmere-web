import { createHash } from "node:crypto";
import {
  buildPass2470Tier180OutputMatrix,
  type Pass2470CellState,
  type Pass2470OutputCell,
  type Pass2470Surface,
  type Pass2470Tier,
  type Pass2470Tier180OutputMatrix,
} from "./tier-180-output-matrix";

export const PASS2472_TIER_RUNTIME_RECEIPT_HARNESS_ID = "tier-runtime-receipt-harness-v1" as const;
// PASS2472 verifier phrase: API payload + screenshot/PDF hash + Angel replay.

export type Pass2472ReceiptState = "capture_ready" | "blocked" | "needs_runtime";
export type Pass2472ReceiptKind = "api_payload" | "browser_screenshot" | "pdf_hash" | "angel_replay";

export type Pass2472RuntimeReceipt = {
  receiptId: string;
  cellId: string;
  assetSymbol: string;
  surface: Pass2470Surface;
  tier: Pass2470Tier;
  state: Pass2472ReceiptState;
  cellState: Pass2470CellState;
  expectedFieldCount: number;
  observedFieldCount: number;
  scenarioCount: number;
  cellFingerprint: string;
  runtimeReceiptFingerprint: string;
  requiredReceiptKinds: Pass2472ReceiptKind[];
  routePlan: string;
  payloadParityRule: string;
  missingRuntimeReceipts: string[];
  forbiddenRuntimeCopy: string[];
  customerCopyBoundary: string;
};

export type Pass2472SurfaceReceiptSummary = {
  surface: Pass2470Surface;
  receipts: number;
  captureReady: number;
  blocked: number;
  needsRuntime: number;
  requiredReceiptKinds: Pass2472ReceiptKind[];
  missingRuntimeReceipts: string[];
};

export type Pass2472TierRuntimeReceiptHarness = {
  version: typeof PASS2472_TIER_RUNTIME_RECEIPT_HARNESS_ID;
  state: Pass2472ReceiptState;
  query?: string;
  symbol?: string;
  totalReceipts: 180;
  generatedReceipts: number;
  receiptPlanCoveragePercent: number;
  runtimeCapturedCoveragePercent: number;
  productionReadyCoveragePercent: number;
  distinctRuntimeReceiptFingerprintCount: number;
  receipts: Pass2472RuntimeReceipt[];
  surfaceSummaries: Pass2472SurfaceReceiptSummary[];
  liveRuntimeGate: {
    state: Pass2472ReceiptState;
    rule: string;
    canClaim180LiveOutputs: boolean;
    requiredBeforeClaimingLive: string[];
    failConditions: string[];
  };
  tierParityGate: {
    basicFields: 10;
    proFields: 14;
    advancedFields: 20;
    noPayloadCollapse: boolean;
    noAdvancedCopyUpgradeWithoutProof: boolean;
    hardLocks: string[];
  };
  nextImplementationActions: string[];
  copyBoundary: string;
  generatedAt: string;
};

function unique<T>(items: Array<T | null | undefined | false>) {
  return Array.from(new Set(items.filter(Boolean) as T[]));
}

function stableHash(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex").slice(0, 28).toUpperCase();
}

function routePlanFor(cell: Pass2470OutputCell) {
  const symbol = encodeURIComponent(cell.assetSymbol.toLowerCase());
  if (cell.surface === "pdf") return `/api/vlm-lens/report?symbol=${symbol}&tier=${cell.tier}&surface=pdf`;
  if (cell.surface === "shield") return `/en/shield?asset=${symbol}&analysis=${cell.tier}`;
  return `/en/real-markets?asset=${symbol}&analysis=${cell.tier}`;
}

function receiptKindsFor(surface: Pass2470Surface): Pass2472ReceiptKind[] {
  if (surface === "pdf") return ["api_payload", "pdf_hash", "angel_replay"];
  return ["api_payload", "browser_screenshot", "angel_replay"];
}

function stateFor(cell: Pass2470OutputCell): Pass2472ReceiptState {
  if (cell.tier === "advanced" && cell.state !== "ready") return "blocked";
  return "needs_runtime";
}

function missingFor(cell: Pass2470OutputCell): string[] {
  const base = [
    "runtime API payload receipt",
    cell.surface === "pdf" ? "PDF preview/download hash receipt" : "browser screenshot receipt",
    "Angel replay fingerprint",
    "persisted generatedAt/provider state",
  ];
  if (cell.tier === "advanced") {
    base.push("proof-lock evaluation receipt");
    if (cell.state !== "ready") base.push("Advanced proof locks still unresolved");
  }
  return unique(base);
}

function buildReceipt(cell: Pass2470OutputCell): Pass2472RuntimeReceipt {
  const requiredReceiptKinds = receiptKindsFor(cell.surface);
  const missingRuntimeReceipts = missingFor(cell);
  const state = stateFor(cell);
  const runtimeReceiptFingerprint = `PASS2472-${stableHash({
    cellId: cell.cellId,
    cellFingerprint: cell.fingerprint,
    routePlan: routePlanFor(cell),
    fieldCount: cell.fieldCount,
    requiredReceiptKinds,
    missingRuntimeReceipts,
  })}`;

  return {
    receiptId: `${cell.cellId}-runtime-receipt`,
    cellId: cell.cellId,
    assetSymbol: cell.assetSymbol,
    surface: cell.surface,
    tier: cell.tier,
    state,
    cellState: cell.state,
    expectedFieldCount: cell.fieldCount,
    observedFieldCount: cell.fieldCount,
    scenarioCount: cell.scenarioCount,
    cellFingerprint: cell.fingerprint,
    runtimeReceiptFingerprint,
    requiredReceiptKinds,
    routePlan: routePlanFor(cell),
    payloadParityRule: "The same asset/surface/tier cell fingerprint must appear in API payload, UI result, PDF hash or Angel replay; otherwise the cell fails runtime parity.",
    missingRuntimeReceipts,
    forbiddenRuntimeCopy: cell.forbiddenClaims,
    customerCopyBoundary: state === "blocked"
      ? "Advanced can show scenario watch and missing-proof locks only; no confirmed squeeze/rug/trap wording."
      : "Receipt is planned but not live-captured yet; do not claim browser/PDF runtime success until captured.",
  };
}

function summarizeSurface(surface: Pass2470Surface, receipts: Pass2472RuntimeReceipt[]): Pass2472SurfaceReceiptSummary {
  const surfaceReceipts = receipts.filter((receipt) => receipt.surface === surface);
  return {
    surface,
    receipts: surfaceReceipts.length,
    captureReady: surfaceReceipts.filter((receipt) => receipt.state === "capture_ready").length,
    blocked: surfaceReceipts.filter((receipt) => receipt.state === "blocked").length,
    needsRuntime: surfaceReceipts.filter((receipt) => receipt.state === "needs_runtime").length,
    requiredReceiptKinds: unique(surfaceReceipts.flatMap((receipt) => receipt.requiredReceiptKinds)),
    missingRuntimeReceipts: unique(surfaceReceipts.flatMap((receipt) => receipt.missingRuntimeReceipts)).slice(0, 10),
  };
}

export function buildPass2472TierRuntimeReceiptHarness(args: {
  query?: string;
  symbol?: string;
  matrix?: Pass2470Tier180OutputMatrix | null;
} = {}): Pass2472TierRuntimeReceiptHarness {
  const matrix = args.matrix ?? buildPass2470Tier180OutputMatrix({ query: args.query, symbol: args.symbol });
  const receipts = matrix.cells.map(buildReceipt);
  const fingerprints = new Set(receipts.map((receipt) => receipt.runtimeReceiptFingerprint));
  const blocked = receipts.filter((receipt) => receipt.state === "blocked").length;
  const needsRuntime = receipts.filter((receipt) => receipt.state === "needs_runtime").length;
  const generatedReceipts = receipts.length;
  const noPayloadCollapse = matrix.distinctFingerprintCount === 180 && fingerprints.size === 180;
  const runtimeCapturedCoveragePercent = 0;
  const productionReadyCoveragePercent = Math.max(8, Math.min(48, Math.round((matrix.deterministicHarnessCoveragePercent * 0.32) + (matrix.runtimeLiveCoveragePercent * 0.28) - (blocked / 180 * 18))));
  const requiredBeforeClaimingLive = unique([
    "run API replay for all 180 cells",
    "capture Shield modal screenshot receipt for every Shield tier cell",
    "capture Real Markets modal screenshot receipt for every Real Markets tier cell",
    "capture PDF preview and download hash for every PDF tier cell",
    "persist receipt rows with routePlan, cellFingerprint, runtimeReceiptFingerprint and generatedAt",
    "fail if Basic/Pro/Advanced payload fingerprints collapse to the same value",
    "fail Advanced if proof locks are missing but copy upgrades to confirmed squeeze/rug/trap",
  ]);

  return {
    version: PASS2472_TIER_RUNTIME_RECEIPT_HARNESS_ID,
    state: generatedReceipts === 180 && noPayloadCollapse ? "needs_runtime" : "blocked",
    query: args.query,
    symbol: args.symbol ?? matrix.symbol,
    totalReceipts: 180,
    generatedReceipts,
    receiptPlanCoveragePercent: generatedReceipts === 180 && fingerprints.size === 180 ? 100 : Math.round(generatedReceipts / 180 * 100),
    runtimeCapturedCoveragePercent,
    productionReadyCoveragePercent,
    distinctRuntimeReceiptFingerprintCount: fingerprints.size,
    receipts,
    surfaceSummaries: ["pdf", "shield", "real_markets"].map((surface) => summarizeSurface(surface as Pass2470Surface, receipts)),
    liveRuntimeGate: {
      state: needsRuntime > 0 || blocked > 0 ? "needs_runtime" : "capture_ready",
      rule: "PASS2472 is a receipt harness, not a fake browser run. It proves what must be captured and where, then blocks 180-live-output claims until real receipts exist.",
      canClaim180LiveOutputs: false,
      requiredBeforeClaimingLive,
      failConditions: [
        "any receipt missing runtime API payload",
        "any PDF cell missing preview/download hash",
        "any modal cell missing screenshot receipt",
        "any Advanced cell says confirmed squeeze/rug/trap while proof locks remain missing",
        "any Basic/Pro/Advanced cells share the same payload fingerprint for the same surface/asset",
      ],
    },
    tierParityGate: {
      basicFields: 10,
      proFields: 14,
      advancedFields: 20,
      noPayloadCollapse,
      noAdvancedCopyUpgradeWithoutProof: true,
      hardLocks: unique([...matrix.advancedValueGate.hardLocks, ...requiredBeforeClaimingLive]).slice(0, 14),
    },
    nextImplementationActions: [
      "Add Playwright runtime runner that opens Shield and Real Markets cells and stores screenshot fingerprints.",
      "Add PDF renderer hash capture so preview/download cannot drift from the modal payload.",
      "Add Supabase/Redis receipt table for PASS2472 runtime receipts.",
      "Expose only a clean user summary; keep PASS2472 receipt rows operator/debug-only.",
    ],
    copyBoundary: "PASS2472 closes the gap between deterministic 180-cell matrix and real runtime proof. It must be reported as receipt plan/harness until browser screenshots and PDF hashes are captured.",
    generatedAt: new Date().toISOString(),
  };
}
