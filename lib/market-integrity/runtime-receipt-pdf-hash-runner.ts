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

export const PASS2476_RUNTIME_RECEIPT_PDF_HASH_RUNNER_ID = "runtime-receipt-pdf-hash-runner-v1" as const;
// PASS2476 verifier phrase: PDF hash receipt runner captures Lens PDF preview/download evidence only from operator-provided PDF hashes. It never fabricates PDF parity and never makes customer UI show receipt tables.

export type Pass2476PdfHashRunnerMode = "dry_run" | "capture_pdf_hash";
export type Pass2476PdfHashRunnerState = "planned" | "partial" | "captured_pdf_hash" | "blocked";

export type Pass2476PdfHashMap = Record<string, string | undefined>;

export type Pass2476PdfHashRunnerCell = {
  cellId: string;
  assetSymbol: string;
  surface: Extract<Pass2470Surface, "pdf">;
  tier: Pass2470Tier;
  routePlan: string;
  cellFingerprint: string;
  runtimeReceiptFingerprint: string;
  pdfHashReceiptFingerprint: string;
  pdfHashProvided: boolean;
  pdfHashCaptureReady: boolean;
  wasAlreadyCaptured: boolean;
  capturedNow: boolean;
  blockedBy: string[];
};

export type Pass2476RuntimeReceiptPdfHashRunner = {
  version: typeof PASS2476_RUNTIME_RECEIPT_PDF_HASH_RUNNER_ID;
  state: Pass2476PdfHashRunnerState;
  mode: Pass2476PdfHashRunnerMode;
  query?: string;
  symbol?: string;
  expectedPdfHashCells: 60;
  plannedPdfHashReceiptCount: number;
  alreadyCapturedPdfHashReceiptCount: number;
  capturedNowPdfHashReceiptCount: number;
  capturedAfterRunPdfHashReceiptCount: number;
  pdfHashCoveragePercent: number;
  runtimeCapturedCoveragePercentAfterRun: number;
  completedCellCountAfterRun: number;
  canClaim180LiveOutputs: boolean;
  runnerFingerprint: string;
  captureStoreBefore: Pick<Pass2473RuntimeReceiptCaptureStore, "runtimeCapturedCoveragePercent" | "completedCellCount" | "distinctCapturedReceiptCount" | "canClaim180LiveOutputs" | "storageMode">;
  captureStoreAfter: Pick<Pass2473RuntimeReceiptCaptureStore, "runtimeCapturedCoveragePercent" | "completedCellCount" | "distinctCapturedReceiptCount" | "canClaim180LiveOutputs" | "storageMode">;
  tierPdfHashCoverage: Array<{
    tier: Pass2470Tier;
    planned: number;
    captured: number;
    coveragePercent: number;
  }>;
  cells: Pass2476PdfHashRunnerCell[];
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
  return value.replace(/[^a-zA-Z0-9:_-]/g, "").slice(0, 160).toUpperCase();
}

function isPdfSurface(surface: Pass2470Surface): surface is Extract<Pass2470Surface, "pdf"> {
  return surface === "pdf";
}

type Pass2476PdfRuntimeReceipt = Pass2472RuntimeReceipt & {
  surface: Extract<Pass2470Surface, "pdf">;
};

function isPdfRuntimeReceipt(receipt: Pass2472RuntimeReceipt): receipt is Pass2476PdfRuntimeReceipt {
  return isPdfSurface(receipt.surface) && receipt.requiredReceiptKinds.includes("pdf_hash");
}

function pickCaptureStore(store: Pass2473RuntimeReceiptCaptureStore): Pass2476RuntimeReceiptPdfHashRunner["captureStoreBefore"] {
  return {
    runtimeCapturedCoveragePercent: store.runtimeCapturedCoveragePercent,
    completedCellCount: store.completedCellCount,
    distinctCapturedReceiptCount: store.distinctCapturedReceiptCount,
    canClaim180LiveOutputs: store.canClaim180LiveOutputs,
    storageMode: store.storageMode,
  };
}

function pdfHashFingerprint(receipt: Pass2472RuntimeReceipt, pdfHash?: string) {
  return `PASS2476-PDF-${stableHash({
    cellId: receipt.cellId,
    routePlan: receipt.routePlan,
    cellFingerprint: receipt.cellFingerprint,
    runtimeReceiptFingerprint: receipt.runtimeReceiptFingerprint,
    kind: "pdf_hash",
    pdfHash: boundedHash(pdfHash) || "missing-operator-pdf-hash",
  })}`;
}

function currentPdfHashCaptured(store: Pass2473RuntimeReceiptCaptureStore, cellId: string) {
  const status = store.cellStatuses.find((cell) => cell.cellId === cellId);
  return Boolean(status?.capturedReceiptKinds.includes("pdf_hash"));
}

function pdfHashFor(cellId: string, pdfHashes?: Pass2476PdfHashMap | null) {
  if (!pdfHashes) return "";
  return boundedHash(pdfHashes[cellId]);
}

function coverageByTier(cells: Pass2476PdfHashRunnerCell[]) {
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

export function buildPass2476RuntimeReceiptPdfHashRunner(args: {
  query?: string;
  symbol?: string;
  harness?: Pass2472TierRuntimeReceiptHarness | null;
  mode?: Pass2476PdfHashRunnerMode;
  operatorId?: string;
  pdfHashes?: Pass2476PdfHashMap | null;
} = {}): Pass2476RuntimeReceiptPdfHashRunner {
  const harness = args.harness ?? buildPass2472TierRuntimeReceiptHarness({ query: args.query, symbol: args.symbol });
  const mode = args.mode ?? "dry_run";
  const captureBefore = buildPass2473RuntimeReceiptCaptureStore({ query: args.query, symbol: args.symbol, harness });
  const operatorId = args.operatorId ?? "pass2476-pdf-hash-runner";

  const pdfReceipts = harness.receipts.filter(isPdfRuntimeReceipt);
  const cells: Pass2476PdfHashRunnerCell[] = [];
  let capturedNowPdfHashReceiptCount = 0;

  for (const receipt of pdfReceipts) {
    const pdfHash = pdfHashFor(receipt.cellId, args.pdfHashes);
    const pdfHashProvided = Boolean(pdfHash);
    const pdfHashCaptureReady = receipt.requiredReceiptKinds.includes("pdf_hash") && receipt.state !== "blocked";
    const wasAlreadyCaptured = currentPdfHashCaptured(captureBefore, receipt.cellId);
    const fingerprint = pdfHashFingerprint(receipt, pdfHash);
    let capturedNow = false;
    const blockedBy = unique([
      receipt.surface !== "pdf" && "only PDF cells can receive pdf_hash receipts",
      receipt.state === "blocked" && "planned PDF cell is blocked by unresolved Advanced proof locks",
      wasAlreadyCaptured && "pdf_hash already captured before this runner pass",
      mode === "dry_run" && "dry_run: no PDF hash mutation requested",
      mode === "capture_pdf_hash" && !pdfHashProvided && "missing operator-provided pdfHash for this PDF cell",
    ]);

    if (mode === "capture_pdf_hash" && pdfHashCaptureReady && !wasAlreadyCaptured && pdfHashProvided) {
      const appended = appendPass2473RuntimeReceipt({
        cellId: receipt.cellId,
        assetSymbol: receipt.assetSymbol,
        surface: receipt.surface,
        tier: receipt.tier,
        kind: "pdf_hash",
        routePlan: receipt.routePlan,
        cellFingerprint: receipt.cellFingerprint,
        runtimeReceiptFingerprint: receipt.runtimeReceiptFingerprint,
        pdfHash,
        observedAt: new Date().toISOString(),
        operatorId,
        source: "pdf_hash",
        note: "PASS2476 captured only an operator-provided PDF preview/download hash fingerprint. Raw PDF bytes must stay outside the receipt store; API payload and Angel replay remain required.",
      }, harness);
      if (appended.ok) {
        capturedNow = true;
        capturedNowPdfHashReceiptCount += 1;
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
      pdfHashReceiptFingerprint: fingerprint,
      pdfHashProvided,
      pdfHashCaptureReady,
      wasAlreadyCaptured,
      capturedNow,
      blockedBy: blockedBy.slice(0, 6),
    });
  }

  const captureAfter = buildPass2473RuntimeReceiptCaptureStore({ query: args.query, symbol: args.symbol, harness });
  const plannedPdfHashReceiptCount = cells.filter((cell) => cell.pdfHashCaptureReady).length;
  const alreadyCapturedPdfHashReceiptCount = cells.filter((cell) => cell.wasAlreadyCaptured).length;
  const capturedAfterRunPdfHashReceiptCount = cells.filter((cell) => cell.wasAlreadyCaptured || cell.capturedNow).length;
  const pdfHashCoveragePercent = plannedPdfHashReceiptCount ? Math.round((capturedAfterRunPdfHashReceiptCount / plannedPdfHashReceiptCount) * 100) : 0;
  const state: Pass2476PdfHashRunnerState = plannedPdfHashReceiptCount === 0
    ? "blocked"
    : capturedAfterRunPdfHashReceiptCount === 0
      ? "planned"
      : capturedAfterRunPdfHashReceiptCount >= plannedPdfHashReceiptCount
        ? "captured_pdf_hash"
        : "partial";

  const stillMissing = unique([
    capturedAfterRunPdfHashReceiptCount < plannedPdfHashReceiptCount && "operator PDF preview/download hashes for all 60 PDF cells",
    "Angel replay fingerprints for PDF, Shield and Real Markets",
    "durable storage adapter for paid Advanced runtime claims",
    "full browser/PDF route replay in production-like environment",
  ]);

  return {
    version: PASS2476_RUNTIME_RECEIPT_PDF_HASH_RUNNER_ID,
    state,
    mode,
    query: args.query,
    symbol: args.symbol ?? harness.symbol,
    expectedPdfHashCells: 60,
    plannedPdfHashReceiptCount,
    alreadyCapturedPdfHashReceiptCount,
    capturedNowPdfHashReceiptCount,
    capturedAfterRunPdfHashReceiptCount,
    pdfHashCoveragePercent,
    runtimeCapturedCoveragePercentAfterRun: captureAfter.runtimeCapturedCoveragePercent,
    completedCellCountAfterRun: captureAfter.completedCellCount,
    canClaim180LiveOutputs: false,
    runnerFingerprint: `PASS2476-RUNNER-${stableHash({
      mode,
      query: args.query,
      symbol: args.symbol ?? harness.symbol,
      plannedPdfHashReceiptCount,
      capturedAfterRunPdfHashReceiptCount,
      runtimeCapturedCoveragePercentAfterRun: captureAfter.runtimeCapturedCoveragePercent,
      store: captureAfter.receiptStoreFingerprint,
    })}`,
    captureStoreBefore: pickCaptureStore(captureBefore),
    captureStoreAfter: pickCaptureStore(captureAfter),
    tierPdfHashCoverage: coverageByTier(cells),
    cells,
    nextRequiredReceipts: stillMissing,
    liveClaimGate: {
      canClaim180LiveOutputs: false,
      rule: "PASS2476 PDF hashes prove only PDF preview/download byte-output lineage. They never complete Shield/Real Markets browser parity or Angel replay by themselves.",
      stillMissing,
    },
    customerCopyBoundary: "Customer UI may show clean Basic/Pro/Advanced PDF results, not PDF hash receipt tables. Download status stays human-readable; PDF hash proof is operator/debug evidence only.",
    generatedAt: new Date().toISOString(),
  };
}
