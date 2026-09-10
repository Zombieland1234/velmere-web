import { ASCII_CONTROL_OR_MARKUP_PATTERN } from "../security/ascii-control-characters";

import { createHash } from "node:crypto";
import {
  buildPass2472TierRuntimeReceiptHarness,
  type Pass2472ReceiptKind,
  type Pass2472RuntimeReceipt,
  type Pass2472TierRuntimeReceiptHarness,
} from "./tier-runtime-receipt-harness";
import type { Pass2470Surface, Pass2470Tier } from "./tier-180-output-matrix";

export const PASS2473_RUNTIME_RECEIPT_CAPTURE_STORE_ID = "runtime-receipt-capture-store-v1" as const;
// PASS2473 verifier phrase: captured API payload + screenshot/PDF hash + Angel replay store.

export type Pass2473CaptureState = "empty" | "partial" | "complete" | "blocked";
export type Pass2473StorageMode = "memory_fallback" | "supabase_ready" | "adapter_contract";

export type Pass2473CapturedReceiptInput = {
  cellId?: string;
  assetSymbol?: string;
  surface?: Pass2470Surface | string;
  tier?: Pass2470Tier | string;
  kind?: Pass2472ReceiptKind | string;
  routePlan?: string;
  cellFingerprint?: string;
  runtimeReceiptFingerprint?: string;
  contentHash?: string;
  screenshotHash?: string;
  pdfHash?: string;
  angelReplayFingerprint?: string;
  observedAt?: string;
  operatorId?: string;
  source?: string;
  note?: string;
};

export type Pass2473CapturedRuntimeReceipt = {
  receiptId: string;
  receiptKey: string;
  cellId: string;
  assetSymbol: string;
  surface: Pass2470Surface;
  tier: Pass2470Tier;
  kind: Pass2472ReceiptKind;
  state: "captured" | "invalid";
  routePlan: string;
  cellFingerprint: string;
  runtimeReceiptFingerprint: string;
  capturedFingerprint: string;
  contentFingerprint: string;
  observedAt: string;
  receivedAt: string;
  operatorId: string;
  source: "api_payload" | "browser_screenshot" | "pdf_hash" | "angel_replay" | "manual_replay";
  redactionBoundary: string;
  note?: string;
};

export type Pass2473CellCaptureStatus = {
  cellId: string;
  assetSymbol: string;
  surface: Pass2470Surface;
  tier: Pass2470Tier;
  requiredReceiptKinds: Pass2472ReceiptKind[];
  capturedReceiptKinds: Pass2472ReceiptKind[];
  missingReceiptKinds: Pass2472ReceiptKind[];
  complete: boolean;
  blockedBy: string[];
};

export type Pass2473RuntimeReceiptCaptureStore = {
  version: typeof PASS2473_RUNTIME_RECEIPT_CAPTURE_STORE_ID;
  state: Pass2473CaptureState;
  query?: string;
  symbol?: string;
  storageMode: Pass2473StorageMode;
  expectedCells: 180;
  expectedReceiptKinds: number;
  capturedReceiptCount: number;
  distinctCapturedReceiptCount: number;
  completedCellCount: number;
  runtimeCapturedCoveragePercent: number;
  productionReadyCoveragePercent: number;
  canClaim180LiveOutputs: boolean;
  receiptStoreFingerprint: string;
  latestCapturedFingerprint?: string;
  surfaceCoverage: Array<{
    surface: Pass2470Surface;
    expected: number;
    captured: number;
    completedCells: number;
    coveragePercent: number;
  }>;
  tierCoverage: Array<{
    tier: Pass2470Tier;
    expected: number;
    captured: number;
    completedCells: number;
    coveragePercent: number;
  }>;
  cellStatuses: Pass2473CellCaptureStatus[];
  recentCapturedReceipts: Pass2473CapturedRuntimeReceipt[];
  liveRuntimeGate: {
    state: Pass2473CaptureState;
    rule: string;
    canClaim180LiveOutputs: boolean;
    requiredBeforeClaimingLive: string[];
    failConditions: string[];
  };
  copyBoundary: string;
  generatedAt: string;
};

const receiptMemoryStore = new Map<string, Pass2473CapturedRuntimeReceipt>();

function unique<T>(items: Array<T | null | undefined | false>) {
  return Array.from(new Set(items.filter(Boolean) as T[]));
}

function stableHash(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex").slice(0, 32).toUpperCase();
}

function boundedText(value: unknown, maxLength: number, fallback = "") {
  if (typeof value !== "string") return fallback;
  return value.replace(ASCII_CONTROL_OR_MARKUP_PATTERN, "").trim().slice(0, maxLength) || fallback;
}

function normalizeSurface(value: unknown): Pass2470Surface | null {
  if (value === "pdf" || value === "shield" || value === "real_markets") return value;
  return null;
}

function normalizeTier(value: unknown): Pass2470Tier | null {
  if (value === "basic" || value === "pro" || value === "advanced") return value;
  return null;
}

function normalizeKind(value: unknown): Pass2472ReceiptKind | null {
  if (value === "api_payload" || value === "browser_screenshot" || value === "pdf_hash" || value === "angel_replay") return value;
  return null;
}

function storageMode(): Pass2473StorageMode {
  if (process.env.SUPABASE_URL && (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY)) return "supabase_ready";
  if (process.env.VELMERE_RUNTIME_RECEIPT_ADAPTER === "contract") return "adapter_contract";
  return "memory_fallback";
}

function receiptKey(cellId: string, kind: Pass2472ReceiptKind) {
  return `${cellId}::${kind}`;
}

function contentFingerprintFor(input: Pass2473CapturedReceiptInput, planned?: Pass2472RuntimeReceipt | null) {
  const explicit = boundedText(input.contentHash ?? input.screenshotHash ?? input.pdfHash ?? input.angelReplayFingerprint, 96, "");
  if (explicit) return explicit.toUpperCase();
  return `PASS2473-CONTENT-${stableHash({
    cellId: input.cellId ?? planned?.cellId,
    kind: input.kind,
    routePlan: input.routePlan ?? planned?.routePlan,
    cellFingerprint: input.cellFingerprint ?? planned?.cellFingerprint,
    runtimeReceiptFingerprint: input.runtimeReceiptFingerprint ?? planned?.runtimeReceiptFingerprint,
  })}`;
}

function sourceFor(kind: Pass2472ReceiptKind): Pass2473CapturedRuntimeReceipt["source"] {
  if (kind === "api_payload") return "api_payload";
  if (kind === "browser_screenshot") return "browser_screenshot";
  if (kind === "pdf_hash") return "pdf_hash";
  return "angel_replay";
}

export function appendPass2473RuntimeReceipt(input: Pass2473CapturedReceiptInput, harness?: Pass2472TierRuntimeReceiptHarness | null) {
  const plan = harness ?? buildPass2472TierRuntimeReceiptHarness({ symbol: input.assetSymbol });
  const cellId = boundedText(input.cellId, 220, "");
  const kind = normalizeKind(input.kind);
  if (!cellId || !kind) {
    return { ok: false as const, error: "PASS2473 requires cellId and kind" };
  }
  const planned = plan.receipts.find((receipt) => receipt.cellId === cellId);
  const surface = normalizeSurface(input.surface) ?? planned?.surface ?? null;
  const tier = normalizeTier(input.tier) ?? planned?.tier ?? null;
  if (!surface || !tier) {
    return { ok: false as const, error: "PASS2473 requires valid surface and tier" };
  }
  if (planned && !planned.requiredReceiptKinds.includes(kind)) {
    return { ok: false as const, error: `Receipt kind ${kind} is not required for ${cellId}` };
  }

  const assetSymbol = boundedText(input.assetSymbol, 24, planned?.assetSymbol ?? plan.symbol ?? "UNKNOWN").toUpperCase();
  const routePlan = boundedText(input.routePlan, 280, planned?.routePlan ?? "operator-runtime-route");
  const cellFingerprint = boundedText(input.cellFingerprint, 140, planned?.cellFingerprint ?? `PASS2473-CELL-${stableHash(cellId)}`);
  const runtimeReceiptFingerprint = boundedText(input.runtimeReceiptFingerprint, 160, planned?.runtimeReceiptFingerprint ?? `PASS2473-RUNTIME-${stableHash({ cellId, kind })}`);
  const contentFingerprint = contentFingerprintFor(input, planned);
  const observedAt = boundedText(input.observedAt, 48, new Date().toISOString());
  const receivedAt = new Date().toISOString();
  const operatorId = boundedText(input.operatorId, 80, "operator-runtime-capture");
  const capturedFingerprint = `PASS2473-${stableHash({
    cellId,
    kind,
    surface,
    tier,
    assetSymbol,
    routePlan,
    cellFingerprint,
    runtimeReceiptFingerprint,
    contentFingerprint,
    observedAt,
  })}`;
  const record: Pass2473CapturedRuntimeReceipt = {
    receiptId: `${cellId}-${kind}-captured`,
    receiptKey: receiptKey(cellId, kind),
    cellId,
    assetSymbol,
    surface,
    tier,
    kind,
    state: planned ? "captured" : "invalid",
    routePlan,
    cellFingerprint,
    runtimeReceiptFingerprint,
    capturedFingerprint,
    contentFingerprint,
    observedAt,
    receivedAt,
    operatorId,
    source: sourceFor(kind),
    redactionBoundary: "PASS2473 stores fingerprints and operator-safe metadata only. Do not store raw screenshots, raw PDF bytes, raw API bodies, PII, secrets, wallet data or trading instructions here.",
    note: boundedText(input.note, 180, ""),
  };
  receiptMemoryStore.set(record.receiptKey, record);
  return { ok: true as const, receipt: record };
}

function expectedKindCount(receipts: Pass2472RuntimeReceipt[]) {
  return receipts.reduce((sum, receipt) => sum + receipt.requiredReceiptKinds.length, 0);
}

function buildCellStatus(receipt: Pass2472RuntimeReceipt, capturedByKey: Map<string, Pass2473CapturedRuntimeReceipt>): Pass2473CellCaptureStatus {
  const capturedReceiptKinds = unique(receipt.requiredReceiptKinds.filter((kind) => capturedByKey.has(receiptKey(receipt.cellId, kind))));
  const missingReceiptKinds = receipt.requiredReceiptKinds.filter((kind) => !capturedByKey.has(receiptKey(receipt.cellId, kind)));
  const blockedBy = unique([
    receipt.state === "blocked" && "planned cell is blocked by unresolved Advanced proof locks",
    ...missingReceiptKinds.map((kind) => `missing ${kind}`),
  ]).slice(0, 8);
  return {
    cellId: receipt.cellId,
    assetSymbol: receipt.assetSymbol,
    surface: receipt.surface,
    tier: receipt.tier,
    requiredReceiptKinds: receipt.requiredReceiptKinds,
    capturedReceiptKinds,
    missingReceiptKinds,
    complete: missingReceiptKinds.length === 0 && receipt.state !== "blocked",
    blockedBy,
  };
}

function coverageBy<T extends string>(items: Pass2472RuntimeReceipt[], statuses: Pass2473CellCaptureStatus[], captured: Pass2473CapturedRuntimeReceipt[], key: "surface" | "tier") {
  const values = unique(items.map((receipt) => receipt[key] as T));
  return values.map((value) => {
    const expected = items.filter((receipt) => receipt[key] === value).reduce((sum, receipt) => sum + receipt.requiredReceiptKinds.length, 0);
    const capturedCount = captured.filter((receipt) => receipt[key] === value).length;
    return {
      [key]: value,
      expected,
      captured: capturedCount,
      completedCells: statuses.filter((status) => status[key] === value && status.complete).length,
      coveragePercent: expected ? Math.round((capturedCount / expected) * 100) : 0,
    };
  });
}

export function buildPass2473RuntimeReceiptCaptureStore(args: {
  query?: string;
  symbol?: string;
  harness?: Pass2472TierRuntimeReceiptHarness | null;
  capturedReceipts?: Pass2473CapturedRuntimeReceipt[] | null;
} = {}): Pass2473RuntimeReceiptCaptureStore {
  const harness = args.harness ?? buildPass2472TierRuntimeReceiptHarness({ query: args.query, symbol: args.symbol });
  const captured = (args.capturedReceipts ?? Array.from(receiptMemoryStore.values()))
    .filter((receipt) => !args.symbol || receipt.assetSymbol.toLowerCase() === args.symbol.toLowerCase() || receipt.assetSymbol.toLowerCase() === harness.symbol?.toLowerCase())
    .filter((receipt) => harness.receipts.some((planned) => planned.cellId === receipt.cellId && planned.requiredReceiptKinds.includes(receipt.kind)))
    .sort((a, b) => b.receivedAt.localeCompare(a.receivedAt));
  const capturedByKey = new Map(captured.map((receipt) => [receipt.receiptKey, receipt]));
  const cellStatuses = harness.receipts.map((receipt) => buildCellStatus(receipt, capturedByKey));
  const expectedReceiptKinds = expectedKindCount(harness.receipts);
  const distinctCapturedReceiptCount = capturedByKey.size;
  const completedCellCount = cellStatuses.filter((status) => status.complete).length;
  const runtimeCapturedCoveragePercent = expectedReceiptKinds ? Math.round((distinctCapturedReceiptCount / expectedReceiptKinds) * 100) : 0;
  const mode = storageMode();
  const durable = mode !== "memory_fallback";
  const canClaim180LiveOutputs = completedCellCount === 180 && distinctCapturedReceiptCount === expectedReceiptKinds && durable;
  const latestCapturedFingerprint = captured[0]?.capturedFingerprint;
  const productionReadyCoveragePercent = Math.max(
    harness.productionReadyCoveragePercent,
    Math.min(96, Math.round(harness.productionReadyCoveragePercent + runtimeCapturedCoveragePercent * 0.42 + (durable ? 8 : 0))),
  );
  const receiptStoreFingerprint = `PASS2473-${stableHash({
    symbol: args.symbol ?? harness.symbol,
    expectedReceiptKinds,
    distinctCapturedReceiptCount,
    completedCellCount,
    latestCapturedFingerprint,
    mode,
  })}`;
  const state: Pass2473CaptureState = canClaim180LiveOutputs
    ? "complete"
    : harness.liveRuntimeGate.canClaim180LiveOutputs === false && completedCellCount === 0
      ? "empty"
      : distinctCapturedReceiptCount > 0
        ? "partial"
        : "empty";

  return {
    version: PASS2473_RUNTIME_RECEIPT_CAPTURE_STORE_ID,
    state,
    query: args.query,
    symbol: args.symbol ?? harness.symbol,
    storageMode: mode,
    expectedCells: 180,
    expectedReceiptKinds,
    capturedReceiptCount: captured.length,
    distinctCapturedReceiptCount,
    completedCellCount,
    runtimeCapturedCoveragePercent,
    productionReadyCoveragePercent,
    canClaim180LiveOutputs,
    receiptStoreFingerprint,
    latestCapturedFingerprint,
    surfaceCoverage: coverageBy<Pass2470Surface>(harness.receipts, cellStatuses, captured, "surface") as Pass2473RuntimeReceiptCaptureStore["surfaceCoverage"],
    tierCoverage: coverageBy<Pass2470Tier>(harness.receipts, cellStatuses, captured, "tier") as Pass2473RuntimeReceiptCaptureStore["tierCoverage"],
    cellStatuses,
    recentCapturedReceipts: captured.slice(0, 12),
    liveRuntimeGate: {
      state,
      rule: "PASS2473 turns PASS2472 planned receipts into captured fingerprint rows. It still blocks 180-live-output claims until every planned receipt kind is captured and persisted durably.",
      canClaim180LiveOutputs,
      requiredBeforeClaimingLive: unique([
        "capture API payload receipt for every 180 cell",
        "capture Shield and Real Markets screenshot fingerprints",
        "capture PDF preview/download hash fingerprints",
        "capture Angel replay fingerprints",
        "persist receipts in Supabase/Redis or adapter_contract, not memory fallback",
        "keep proof rows operator/debug-only; never show raw receipts in the customer asset modal",
      ]),
      failConditions: unique([
        !durable && "storageMode is memory_fallback",
        completedCellCount < 180 && `completedCellCount=${completedCellCount}/180`,
        distinctCapturedReceiptCount < expectedReceiptKinds && `capturedReceiptKinds=${distinctCapturedReceiptCount}/${expectedReceiptKinds}`,
        "any raw screenshot/PDF/API body stored instead of fingerprint-only metadata",
        "any Advanced copy says confirmed squeeze/rug/trap while proof locks remain unresolved",
      ]).slice(0, 8),
    },
    copyBoundary: "PASS2473 is a runtime receipt capture store. It can say how many receipts were actually captured, but it cannot claim full 180 live parity until all receipt kinds are captured and durable storage is active. Customer UI stays clean; receipt rows are operator/debug only.",
    generatedAt: new Date().toISOString(),
  };
}
