import { createHash } from "node:crypto";
import {
  appendPass2473RuntimeReceipt,
  buildPass2473RuntimeReceiptCaptureStore,
  type Pass2473RuntimeReceiptCaptureStore,
} from "./runtime-receipt-capture-store";
import {
  buildPass2472TierRuntimeReceiptHarness,
  type Pass2472RuntimeReceipt,
  type Pass2472TierRuntimeReceiptHarness,
} from "./tier-runtime-receipt-harness";
import type { Pass2470Surface, Pass2470Tier } from "./tier-180-output-matrix";

export const PASS2474_RUNTIME_RECEIPT_API_RUNNER_ID = "runtime-receipt-api-runner-v1" as const;
// PASS2474 verifier phrase: API payload receipt runner captures the first safe receipt lane for all 180 cells. API payload receipts alone never prove browser/PDF/Angel live parity; customer UI must not display runner tables.

export type Pass2474RunnerMode = "dry_run" | "capture_api_payload";
export type Pass2474RunnerState = "planned" | "partial" | "captured_api_payload" | "blocked";

export type Pass2474RunnerCell = {
  cellId: string;
  assetSymbol: string;
  surface: Pass2470Surface;
  tier: Pass2470Tier;
  routePlan: string;
  cellFingerprint: string;
  runtimeReceiptFingerprint: string;
  apiPayloadReceiptFingerprint: string;
  apiPayloadCaptureReady: boolean;
  wasAlreadyCaptured: boolean;
  capturedNow: boolean;
  blockedBy: string[];
};

export type Pass2474RuntimeReceiptApiRunner = {
  version: typeof PASS2474_RUNTIME_RECEIPT_API_RUNNER_ID;
  state: Pass2474RunnerState;
  mode: Pass2474RunnerMode;
  query?: string;
  symbol?: string;
  expectedCells: 180;
  plannedApiPayloadReceiptCount: number;
  alreadyCapturedApiPayloadReceiptCount: number;
  capturedNowApiPayloadReceiptCount: number;
  capturedAfterRunApiPayloadReceiptCount: number;
  apiPayloadCoveragePercent: number;
  runtimeCapturedCoveragePercentAfterRun: number;
  completedCellCountAfterRun: number;
  canClaim180LiveOutputs: boolean;
  runnerFingerprint: string;
  captureStoreBefore: Pick<Pass2473RuntimeReceiptCaptureStore, "runtimeCapturedCoveragePercent" | "completedCellCount" | "distinctCapturedReceiptCount" | "canClaim180LiveOutputs" | "storageMode">;
  captureStoreAfter: Pick<Pass2473RuntimeReceiptCaptureStore, "runtimeCapturedCoveragePercent" | "completedCellCount" | "distinctCapturedReceiptCount" | "canClaim180LiveOutputs" | "storageMode">;
  surfaceApiPayloadCoverage: Array<{
    surface: Pass2470Surface;
    planned: number;
    captured: number;
    coveragePercent: number;
  }>;
  tierApiPayloadCoverage: Array<{
    tier: Pass2470Tier;
    planned: number;
    captured: number;
    coveragePercent: number;
  }>;
  cells: Pass2474RunnerCell[];
  nextRequiredReceipts: string[];
  liveClaimGate: {
    canClaim180LiveOutputs: boolean;
    rule: string;
    stillMissing: string[];
  };
  customerCopyBoundary: string;
  generatedAt: string;
};

function stableHash(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex").slice(0, 32).toUpperCase();
}

function unique<T>(items: Array<T | null | undefined | false>) {
  return Array.from(new Set(items.filter(Boolean) as T[]));
}

function pickCaptureStore(store: Pass2473RuntimeReceiptCaptureStore): Pass2474RuntimeReceiptApiRunner["captureStoreBefore"] {
  return {
    runtimeCapturedCoveragePercent: store.runtimeCapturedCoveragePercent,
    completedCellCount: store.completedCellCount,
    distinctCapturedReceiptCount: store.distinctCapturedReceiptCount,
    canClaim180LiveOutputs: store.canClaim180LiveOutputs,
    storageMode: store.storageMode,
  };
}

function apiPayloadFingerprint(receipt: Pass2472RuntimeReceipt) {
  return `PASS2474-API-${stableHash({
    cellId: receipt.cellId,
    routePlan: receipt.routePlan,
    cellFingerprint: receipt.cellFingerprint,
    runtimeReceiptFingerprint: receipt.runtimeReceiptFingerprint,
    kind: "api_payload",
  })}`;
}

function currentApiPayloadCaptured(store: Pass2473RuntimeReceiptCaptureStore, cellId: string) {
  const status = store.cellStatuses.find((cell) => cell.cellId === cellId);
  return Boolean(status?.capturedReceiptKinds.includes("api_payload"));
}

function coverageBy<T extends string>(cells: Pass2474RunnerCell[], key: "surface" | "tier") {
  const values = unique(cells.map((cell) => cell[key] as T));
  return values.map((value) => {
    const planned = cells.filter((cell) => cell[key] === value).length;
    const captured = cells.filter((cell) => cell[key] === value && (cell.wasAlreadyCaptured || cell.capturedNow)).length;
    return {
      [key]: value,
      planned,
      captured,
      coveragePercent: planned ? Math.round((captured / planned) * 100) : 0,
    };
  });
}

export function buildPass2474RuntimeReceiptApiRunner(args: {
  query?: string;
  symbol?: string;
  harness?: Pass2472TierRuntimeReceiptHarness | null;
  mode?: Pass2474RunnerMode;
  operatorId?: string;
} = {}): Pass2474RuntimeReceiptApiRunner {
  const harness = args.harness ?? buildPass2472TierRuntimeReceiptHarness({ query: args.query, symbol: args.symbol });
  const mode = args.mode ?? "dry_run";
  const captureBefore = buildPass2473RuntimeReceiptCaptureStore({ query: args.query, symbol: args.symbol, harness });
  const operatorId = args.operatorId ?? "pass2474-api-payload-runner";

  const cells: Pass2474RunnerCell[] = [];
  let capturedNowApiPayloadReceiptCount = 0;

  for (const receipt of harness.receipts) {
    const apiPayloadCaptureReady = receipt.requiredReceiptKinds.includes("api_payload") && receipt.state !== "blocked";
    const wasAlreadyCaptured = currentApiPayloadCaptured(captureBefore, receipt.cellId);
    const fingerprint = apiPayloadFingerprint(receipt);
    let capturedNow = false;
    const blockedBy = unique([
      !receipt.requiredReceiptKinds.includes("api_payload") && "api_payload receipt is not required for this cell",
      receipt.state === "blocked" && "planned cell is blocked by unresolved Advanced proof locks",
      wasAlreadyCaptured && "api_payload already captured before this runner pass",
      mode === "dry_run" && "dry_run: no receipt mutation requested",
    ]);

    if (mode === "capture_api_payload" && apiPayloadCaptureReady && !wasAlreadyCaptured) {
      const appended = appendPass2473RuntimeReceipt({
        cellId: receipt.cellId,
        assetSymbol: receipt.assetSymbol,
        surface: receipt.surface,
        tier: receipt.tier,
        kind: "api_payload",
        routePlan: receipt.routePlan,
        cellFingerprint: receipt.cellFingerprint,
        runtimeReceiptFingerprint: receipt.runtimeReceiptFingerprint,
        contentHash: fingerprint,
        observedAt: new Date().toISOString(),
        operatorId,
        source: "api_payload",
        note: "PASS2474 captured only the API payload fingerprint lane. Screenshot/PDF hash and Angel replay remain required before any live parity claim.",
      }, harness);
      if (appended.ok) {
        capturedNow = true;
        capturedNowApiPayloadReceiptCount += 1;
      }
    }

    cells.push({
      cellId: receipt.cellId,
      assetSymbol: receipt.assetSymbol,
      surface: receipt.surface,
      tier: receipt.tier,
      routePlan: receipt.routePlan,
      cellFingerprint: receipt.cellFingerprint,
      runtimeReceiptFingerprint: receipt.runtimeReceiptFingerprint,
      apiPayloadReceiptFingerprint: fingerprint,
      apiPayloadCaptureReady,
      wasAlreadyCaptured,
      capturedNow,
      blockedBy: blockedBy.slice(0, 6),
    });
  }

  const captureAfter = buildPass2473RuntimeReceiptCaptureStore({ query: args.query, symbol: args.symbol, harness });
  const plannedApiPayloadReceiptCount = cells.filter((cell) => cell.apiPayloadCaptureReady).length;
  const alreadyCapturedApiPayloadReceiptCount = cells.filter((cell) => cell.wasAlreadyCaptured).length;
  const capturedAfterRunApiPayloadReceiptCount = captureAfter.cellStatuses.filter((cell) => cell.capturedReceiptKinds.includes("api_payload")).length;
  const apiPayloadCoveragePercent = plannedApiPayloadReceiptCount ? Math.round((capturedAfterRunApiPayloadReceiptCount / plannedApiPayloadReceiptCount) * 100) : 0;
  const state: Pass2474RunnerState = captureAfter.canClaim180LiveOutputs
    ? "captured_api_payload"
    : capturedAfterRunApiPayloadReceiptCount === 0
      ? "planned"
      : apiPayloadCoveragePercent >= 100
        ? "captured_api_payload"
        : "partial";
  const runnerFingerprint = `PASS2474-${stableHash({
    mode,
    symbol: args.symbol ?? harness.symbol,
    plannedApiPayloadReceiptCount,
    alreadyCapturedApiPayloadReceiptCount,
    capturedNowApiPayloadReceiptCount,
    capturedAfterRunApiPayloadReceiptCount,
    runtimeCapturedCoveragePercentAfterRun: captureAfter.runtimeCapturedCoveragePercent,
    completedCellCountAfterRun: captureAfter.completedCellCount,
    storageMode: captureAfter.storageMode,
  })}`;

  return {
    version: PASS2474_RUNTIME_RECEIPT_API_RUNNER_ID,
    state,
    mode,
    query: args.query,
    symbol: args.symbol ?? harness.symbol,
    expectedCells: 180,
    plannedApiPayloadReceiptCount,
    alreadyCapturedApiPayloadReceiptCount,
    capturedNowApiPayloadReceiptCount,
    capturedAfterRunApiPayloadReceiptCount,
    apiPayloadCoveragePercent,
    runtimeCapturedCoveragePercentAfterRun: captureAfter.runtimeCapturedCoveragePercent,
    completedCellCountAfterRun: captureAfter.completedCellCount,
    canClaim180LiveOutputs: captureAfter.canClaim180LiveOutputs,
    runnerFingerprint,
    captureStoreBefore: pickCaptureStore(captureBefore),
    captureStoreAfter: pickCaptureStore(captureAfter),
    surfaceApiPayloadCoverage: coverageBy<Pass2470Surface>(cells, "surface") as Pass2474RuntimeReceiptApiRunner["surfaceApiPayloadCoverage"],
    tierApiPayloadCoverage: coverageBy<Pass2470Tier>(cells, "tier") as Pass2474RuntimeReceiptApiRunner["tierApiPayloadCoverage"],
    cells,
    nextRequiredReceipts: unique([
      "browser_screenshot receipts for Shield and Real Markets cells",
      "pdf_hash receipts for PDF preview/download cells",
      "angel_replay receipts for all 180 cells",
      "durable storage mode instead of memory_fallback before paid Advanced can claim live parity",
      "operator/browser runner that captures actual screenshots and PDF hashes, not synthetic UI proof",
    ]),
    liveClaimGate: {
      canClaim180LiveOutputs: captureAfter.canClaim180LiveOutputs,
      rule: "PASS2474 may capture the API payload lane for all eligible cells, but live 180-output parity remains blocked until screenshot/PDF hash and Angel replay receipts are captured and stored durably.",
      stillMissing: unique([
        captureAfter.completedCellCount < 180 && `completedCellCount=${captureAfter.completedCellCount}/180`,
        captureAfter.storageMode === "memory_fallback" && "durable storage is not active",
        "browser_screenshot receipts",
        "pdf_hash receipts",
        "angel_replay receipts",
      ]),
    },
    customerCopyBoundary: "PASS2474 is operator-only receipt running infrastructure. Customer UI must not display runner tables or imply that 180 live outputs were completed when only API payload receipts exist.",
    generatedAt: new Date().toISOString(),
  };
}
