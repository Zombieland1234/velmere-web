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

export const PASS2475_RUNTIME_RECEIPT_BROWSER_RUNNER_ID = "runtime-receipt-browser-runner-v1" as const;
// PASS2475 verifier phrase: browser screenshot receipt runner captures Shield and Real Markets UI evidence only from operator-provided screenshot hashes. It never fabricates screenshots and never makes customer UI show receipt tables.

export type Pass2475BrowserRunnerMode = "dry_run" | "capture_browser_screenshot";
export type Pass2475BrowserRunnerState = "planned" | "partial" | "captured_browser_screenshot" | "blocked";

export type Pass2475ScreenshotHashMap = Record<string, string | undefined>;

export type Pass2475BrowserRunnerCell = {
  cellId: string;
  assetSymbol: string;
  surface: Extract<Pass2470Surface, "shield" | "real_markets">;
  tier: Pass2470Tier;
  routePlan: string;
  cellFingerprint: string;
  runtimeReceiptFingerprint: string;
  browserScreenshotReceiptFingerprint: string;
  screenshotHashProvided: boolean;
  browserScreenshotCaptureReady: boolean;
  wasAlreadyCaptured: boolean;
  capturedNow: boolean;
  blockedBy: string[];
};

export type Pass2475RuntimeReceiptBrowserRunner = {
  version: typeof PASS2475_RUNTIME_RECEIPT_BROWSER_RUNNER_ID;
  state: Pass2475BrowserRunnerState;
  mode: Pass2475BrowserRunnerMode;
  query?: string;
  symbol?: string;
  expectedBrowserScreenshotCells: 120;
  plannedBrowserScreenshotReceiptCount: number;
  alreadyCapturedBrowserScreenshotReceiptCount: number;
  capturedNowBrowserScreenshotReceiptCount: number;
  capturedAfterRunBrowserScreenshotReceiptCount: number;
  browserScreenshotCoveragePercent: number;
  runtimeCapturedCoveragePercentAfterRun: number;
  completedCellCountAfterRun: number;
  canClaim180LiveOutputs: boolean;
  runnerFingerprint: string;
  captureStoreBefore: Pick<Pass2473RuntimeReceiptCaptureStore, "runtimeCapturedCoveragePercent" | "completedCellCount" | "distinctCapturedReceiptCount" | "canClaim180LiveOutputs" | "storageMode">;
  captureStoreAfter: Pick<Pass2473RuntimeReceiptCaptureStore, "runtimeCapturedCoveragePercent" | "completedCellCount" | "distinctCapturedReceiptCount" | "canClaim180LiveOutputs" | "storageMode">;
  surfaceBrowserScreenshotCoverage: Array<{
    surface: Extract<Pass2470Surface, "shield" | "real_markets">;
    planned: number;
    captured: number;
    coveragePercent: number;
  }>;
  tierBrowserScreenshotCoverage: Array<{
    tier: Pass2470Tier;
    planned: number;
    captured: number;
    coveragePercent: number;
  }>;
  cells: Pass2475BrowserRunnerCell[];
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

function boundedHash(value: unknown) {
  if (typeof value !== "string") return "";
  return value.replace(/[^a-zA-Z0-9:_-]/g, "").slice(0, 140).toUpperCase();
}

function isBrowserSurface(surface: Pass2470Surface): surface is Extract<Pass2470Surface, "shield" | "real_markets"> {
  return surface === "shield" || surface === "real_markets";
}

type Pass2475BrowserRuntimeReceipt = Pass2472RuntimeReceipt & {
  surface: Extract<Pass2470Surface, "shield" | "real_markets">;
};

function isBrowserRuntimeReceipt(receipt: Pass2472RuntimeReceipt): receipt is Pass2475BrowserRuntimeReceipt {
  return isBrowserSurface(receipt.surface) && receipt.requiredReceiptKinds.includes("browser_screenshot");
}

function pickCaptureStore(store: Pass2473RuntimeReceiptCaptureStore): Pass2475RuntimeReceiptBrowserRunner["captureStoreBefore"] {
  return {
    runtimeCapturedCoveragePercent: store.runtimeCapturedCoveragePercent,
    completedCellCount: store.completedCellCount,
    distinctCapturedReceiptCount: store.distinctCapturedReceiptCount,
    canClaim180LiveOutputs: store.canClaim180LiveOutputs,
    storageMode: store.storageMode,
  };
}

function browserScreenshotFingerprint(receipt: Pass2472RuntimeReceipt, screenshotHash?: string) {
  return `PASS2475-SCREEN-${stableHash({
    cellId: receipt.cellId,
    routePlan: receipt.routePlan,
    cellFingerprint: receipt.cellFingerprint,
    runtimeReceiptFingerprint: receipt.runtimeReceiptFingerprint,
    kind: "browser_screenshot",
    screenshotHash: boundedHash(screenshotHash) || "missing-operator-screenshot-hash",
  })}`;
}

function currentBrowserScreenshotCaptured(store: Pass2473RuntimeReceiptCaptureStore, cellId: string) {
  const status = store.cellStatuses.find((cell) => cell.cellId === cellId);
  return Boolean(status?.capturedReceiptKinds.includes("browser_screenshot"));
}

function screenshotHashFor(cellId: string, screenshotHashes?: Pass2475ScreenshotHashMap | null) {
  if (!screenshotHashes) return "";
  return boundedHash(screenshotHashes[cellId]);
}

function coverageBySurface(cells: Pass2475BrowserRunnerCell[]) {
  const values: Array<Extract<Pass2470Surface, "shield" | "real_markets">> = ["shield", "real_markets"];
  return values.map((surface) => {
    const planned = cells.filter((cell) => cell.surface === surface).length;
    const captured = cells.filter((cell) => cell.surface === surface && (cell.wasAlreadyCaptured || cell.capturedNow)).length;
    return {
      surface,
      planned,
      captured,
      coveragePercent: planned ? Math.round((captured / planned) * 100) : 0,
    };
  });
}

function coverageByTier(cells: Pass2475BrowserRunnerCell[]) {
  const values: Pass2470Tier[] = ["basic", "pro", "advanced"];
  return values.map((tier) => {
    const planned = cells.filter((cell) => cell.tier === tier).length;
    const captured = cells.filter((cell) => cell.tier === tier && (cell.wasAlreadyCaptured || cell.capturedNow)).length;
    return {
      tier,
      planned,
      captured,
      coveragePercent: planned ? Math.round((captured / planned) * 100) : 0,
    };
  });
}

export function buildPass2475RuntimeReceiptBrowserRunner(args: {
  query?: string;
  symbol?: string;
  harness?: Pass2472TierRuntimeReceiptHarness | null;
  mode?: Pass2475BrowserRunnerMode;
  operatorId?: string;
  screenshotHashes?: Pass2475ScreenshotHashMap | null;
} = {}): Pass2475RuntimeReceiptBrowserRunner {
  const harness = args.harness ?? buildPass2472TierRuntimeReceiptHarness({ query: args.query, symbol: args.symbol });
  const mode = args.mode ?? "dry_run";
  const captureBefore = buildPass2473RuntimeReceiptCaptureStore({ query: args.query, symbol: args.symbol, harness });
  const operatorId = args.operatorId ?? "pass2475-browser-screenshot-runner";

  const browserReceipts = harness.receipts.filter(isBrowserRuntimeReceipt);
  const cells: Pass2475BrowserRunnerCell[] = [];
  let capturedNowBrowserScreenshotReceiptCount = 0;

  for (const receipt of browserReceipts) {
    const screenshotHash = screenshotHashFor(receipt.cellId, args.screenshotHashes);
    const screenshotHashProvided = Boolean(screenshotHash);
    const browserScreenshotCaptureReady = receipt.requiredReceiptKinds.includes("browser_screenshot") && receipt.state !== "blocked";
    const wasAlreadyCaptured = currentBrowserScreenshotCaptured(captureBefore, receipt.cellId);
    const fingerprint = browserScreenshotFingerprint(receipt, screenshotHash);
    let capturedNow = false;
    const blockedBy = unique([
      receipt.state === "blocked" && "planned cell is blocked by unresolved Advanced proof locks",
      wasAlreadyCaptured && "browser_screenshot already captured before this runner pass",
      mode === "dry_run" && "dry_run: no browser screenshot mutation requested",
      mode === "capture_browser_screenshot" && !screenshotHashProvided && "missing operator-provided screenshotHash for this cell",
    ]);

    if (mode === "capture_browser_screenshot" && browserScreenshotCaptureReady && !wasAlreadyCaptured && screenshotHashProvided) {
      const appended = appendPass2473RuntimeReceipt({
        cellId: receipt.cellId,
        assetSymbol: receipt.assetSymbol,
        surface: receipt.surface,
        tier: receipt.tier,
        kind: "browser_screenshot",
        routePlan: receipt.routePlan,
        cellFingerprint: receipt.cellFingerprint,
        runtimeReceiptFingerprint: receipt.runtimeReceiptFingerprint,
        screenshotHash,
        observedAt: new Date().toISOString(),
        operatorId,
        source: "browser_screenshot",
        note: "PASS2475 captured only an operator-provided browser_screenshot fingerprint. Raw screenshots must stay outside the receipt store; PDF hash and Angel replay remain required.",
      }, harness);
      if (appended.ok) {
        capturedNow = true;
        capturedNowBrowserScreenshotReceiptCount += 1;
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
      browserScreenshotReceiptFingerprint: fingerprint,
      screenshotHashProvided,
      browserScreenshotCaptureReady,
      wasAlreadyCaptured,
      capturedNow,
      blockedBy: blockedBy.slice(0, 6),
    });
  }

  const captureAfter = buildPass2473RuntimeReceiptCaptureStore({ query: args.query, symbol: args.symbol, harness });
  const plannedBrowserScreenshotReceiptCount = cells.filter((cell) => cell.browserScreenshotCaptureReady).length;
  const alreadyCapturedBrowserScreenshotReceiptCount = cells.filter((cell) => cell.wasAlreadyCaptured).length;
  const capturedAfterRunBrowserScreenshotReceiptCount = captureAfter.cellStatuses.filter((cell) => cell.capturedReceiptKinds.includes("browser_screenshot")).length;
  const browserScreenshotCoveragePercent = plannedBrowserScreenshotReceiptCount ? Math.round((capturedAfterRunBrowserScreenshotReceiptCount / plannedBrowserScreenshotReceiptCount) * 100) : 0;
  const state: Pass2475BrowserRunnerState = captureAfter.canClaim180LiveOutputs
    ? "captured_browser_screenshot"
    : capturedAfterRunBrowserScreenshotReceiptCount === 0
      ? "planned"
      : browserScreenshotCoveragePercent >= 100
        ? "captured_browser_screenshot"
        : "partial";
  const runnerFingerprint = `PASS2475-${stableHash({
    mode,
    symbol: args.symbol ?? harness.symbol,
    plannedBrowserScreenshotReceiptCount,
    alreadyCapturedBrowserScreenshotReceiptCount,
    capturedNowBrowserScreenshotReceiptCount,
    capturedAfterRunBrowserScreenshotReceiptCount,
    runtimeCapturedCoveragePercentAfterRun: captureAfter.runtimeCapturedCoveragePercent,
    completedCellCountAfterRun: captureAfter.completedCellCount,
    storageMode: captureAfter.storageMode,
  })}`;

  return {
    version: PASS2475_RUNTIME_RECEIPT_BROWSER_RUNNER_ID,
    state,
    mode,
    query: args.query,
    symbol: args.symbol ?? harness.symbol,
    expectedBrowserScreenshotCells: 120,
    plannedBrowserScreenshotReceiptCount,
    alreadyCapturedBrowserScreenshotReceiptCount,
    capturedNowBrowserScreenshotReceiptCount,
    capturedAfterRunBrowserScreenshotReceiptCount,
    browserScreenshotCoveragePercent,
    runtimeCapturedCoveragePercentAfterRun: captureAfter.runtimeCapturedCoveragePercent,
    completedCellCountAfterRun: captureAfter.completedCellCount,
    canClaim180LiveOutputs: captureAfter.canClaim180LiveOutputs,
    runnerFingerprint,
    captureStoreBefore: pickCaptureStore(captureBefore),
    captureStoreAfter: pickCaptureStore(captureAfter),
    surfaceBrowserScreenshotCoverage: coverageBySurface(cells),
    tierBrowserScreenshotCoverage: coverageByTier(cells),
    cells,
    nextRequiredReceipts: unique([
      "api_payload receipts for all 180 cells via PASS2474",
      "pdf_hash receipts for PDF preview/download cells",
      "angel_replay receipts for all 180 cells",
      "durable storage for captured screenshot fingerprints",
      "browser screenshot capture must be produced by real browser runner, not fabricated hashes",
    ]),
    liveClaimGate: {
      canClaim180LiveOutputs: captureAfter.canClaim180LiveOutputs,
      rule: "PASS2475 can capture Shield and Real Markets screenshot fingerprints only when an operator/browser runner provides screenshotHash per cell. It never fabricates screenshots and never completes PDF or Angel lanes.",
      stillMissing: unique(captureAfter.liveRuntimeGate.requiredBeforeClaimingLive).slice(0, 10),
    },
    customerCopyBoundary: "PASS2475 is operator/debug infrastructure. Customer UI may show clean Basic/Pro/Advanced results, not screenshot receipt tables. Do not claim 180 live parity until API, screenshot/PDF hash and Angel replay receipts are all captured and durable.",
    generatedAt: new Date().toISOString(),
  };
}
