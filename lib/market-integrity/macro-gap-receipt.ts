import { sha256Token } from "@/lib/security/cryptographic-digest";
import type { Pass2449ChartOverlayReconciler } from "./chart-overlay-reconciler";
import type {
  Pass2460MacroChartIntegrityGate,
  Pass2460MacroChartState,
} from "./macro-chart-integrity-gate";
import type { Pass2456SurfaceId } from "./runtime-parity-queue";
import type { VelmereSourceSyncPacket } from "./source-sync-contract";
import type { Pass2453ReportEvidenceCapsule } from "./report-evidence-capsule";
import type { Pass2459SourceFreshnessDriftSentinel } from "./source-freshness-drift-sentinel";

type Pass2461SourceSyncPacket = Omit<VelmereSourceSyncPacket, "pass2449"> & {
  pass2449?: Pass2449ChartOverlayReconciler;
  pass2453?: Pass2453ReportEvidenceCapsule;
  pass2459?: Pass2459SourceFreshnessDriftSentinel;
  pass2460?: Pass2460MacroChartIntegrityGate;
};

export type Pass2461GapSeverity = "info" | "watch" | "critical";
export type Pass2461ReceiptState = "ready" | "watch" | "blocked";

export type Pass2461ChartGapMarker = {
  id: string;
  severity: Pass2461GapSeverity;
  label: string;
  surface: Pass2456SurfaceId | "chart_canvas" | "pdf_receipt";
  evidence: string;
  renderRule: string;
  blocksAdvanced: boolean;
};

export type Pass2461PdfChartReceipt = {
  state: Pass2461ReceiptState;
  previewHash: string;
  downloadHash: string;
  parityState: "same_hash" | "missing_hash" | "blocked_until_canonical_payload";
  requiredVisibleFields: string[];
  hardRejectReasons: string[];
  copyRule: string;
};

export type Pass2461SurfaceGapContract = {
  surface: Pass2456SurfaceId;
  state: Pass2461ReceiptState;
  requiredMarkers: string[];
  blockedBy: string[];
  visibleUiContract: string;
};

export type Pass2461MacroGapReceipt = {
  version: "macro-gap-receipt-v1";
  state: Pass2461ReceiptState;
  score: number;
  query?: string;
  symbol?: string;
  requestedRange: string;
  observedPointCount: number;
  requiredMinPoints: number;
  macroChartFingerprint: string;
  gapReceiptFingerprint: string;
  chartGapMarkers: Pass2461ChartGapMarker[];
  pdfChartReceipt: Pass2461PdfChartReceipt;
  surfaceContracts: Pass2461SurfaceGapContract[];
  visualRendererContract: string[];
  dataSyncLocks: string[];
  hundredPercentUnlocks: string[];
  nextWorldClassSequence: string[];
  noSmoothingRule: string;
  generatedAt: string;
};

const SURFACES: Pass2456SurfaceId[] = [
  "shield",
  "real_markets",
  "chart",
  "vlm_brain",
  "browser_preview",
  "pdf_preview",
  "pdf_download",
  "angel",
];

function unique(items: Array<string | false | null | undefined>) {
  return Array.from(new Set(items.filter(Boolean) as string[]));
}

function clamp(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function stableSerialize(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableSerialize).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value as Record<string, unknown>)
      .sort()
      .map(
        (key) =>
          `${JSON.stringify(key)}:${stableSerialize((value as Record<string, unknown>)[key])}`,
      )
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function smallHash(input: unknown) {
  return `pass2461-${sha256Token(stableSerialize(input), 24)}`;
}


function severityFromState(
  state: Pass2460MacroChartState | undefined,
  criticalWhenBlocked = true,
): Pass2461GapSeverity {
  if (state === "ready") return "info";
  if (state === "watch") return "watch";
  return criticalWhenBlocked ? "critical" : "watch";
}

function buildMarkers(args: {
  sourceSync?: Pass2461SourceSyncPacket;
  macroGate?: Pass2460MacroChartIntegrityGate;
  chartOverlay?: Pass2449ChartOverlayReconciler;
  pointCount: number;
  requiredMinPoints: number;
  range: string;
  macroFingerprint: string;
}): Pass2461ChartGapMarker[] {
  const activeGate = args.macroGate?.activeRangeGate;
  const overlayState =
    args.chartOverlay?.state ?? args.sourceSync?.pass2449?.state;
  const freshnessState = args.sourceSync?.pass2459?.state;
  const pdfParityState = args.sourceSync?.pass2453?.pdfParityLock.state;
  const markers: Pass2461ChartGapMarker[] = [];

  if (args.pointCount < args.requiredMinPoints) {
    markers.push({
      id: "point_density_gap",
      severity: "critical",
      label: "Point density gap",
      surface: "chart_canvas",
      evidence: `${args.range} has ${args.pointCount}/${args.requiredMinPoints} required points`,
      renderRule:
        "Draw a visible vertical gap/coverage band and show the point counter before any trend wording.",
      blocksAdvanced: true,
    });
  }
  if (
    (activeGate?.missingProof ?? []).some((proof) =>
      proof.toLowerCase().includes("second"),
    )
  ) {
    markers.push({
      id: "second_overlay_missing",
      severity: "critical",
      label: "Second overlay missing",
      surface: "chart_canvas",
      evidence:
        "No confirmed Binance/GeckoTerminal/DEX liquidity overlay attached to the macro range.",
      renderRule:
        "Render the primary history line with an overlay-missing badge instead of a clean institutional chart state.",
      blocksAdvanced: true,
    });
  }
  if (freshnessState && freshnessState !== "ready") {
    markers.push({
      id: "freshness_lock",
      severity: severityFromState(freshnessState as Pass2460MacroChartState),
      label: "Freshness lock",
      surface: "chart_canvas",
      evidence: `Freshness drift state: ${freshnessState}`,
      renderRule:
        "Show observedAt/max-age chip next to the chart legend and lower copy strength if stale or missing.",
      blocksAdvanced: freshnessState === "blocked",
    });
  }
  if (pdfParityState && pdfParityState !== "ready") {
    markers.push({
      id: "pdf_parity_lock",
      severity: pdfParityState === "blocked" ? "critical" : "watch",
      label: "PDF parity lock",
      surface: "pdf_receipt",
      evidence: `PDF parity state: ${pdfParityState}; macro hash: ${args.macroFingerprint}`,
      renderRule:
        "PDF preview/download must print the same macroChartFingerprint and gap markers as the chart endpoint.",
      blocksAdvanced: pdfParityState === "blocked",
    });
  }
  if (overlayState && overlayState !== "ready") {
    markers.push({
      id: "overlay_reconciler_watch",
      severity: overlayState === "blocked" ? "critical" : "watch",
      label: "Overlay reconciler watch",
      surface: "chart_canvas",
      evidence: `Overlay state: ${overlayState}`,
      renderRule:
        "Keep overlay state visible in the legend; do not flatten provider disagreement into one smooth line.",
      blocksAdvanced: overlayState === "blocked",
    });
  }
  if (
    args.sourceSync?.pass2446DefiLlama?.mode &&
    args.sourceSync.pass2446DefiLlama.mode !== "unresolved"
  ) {
    markers.push({
      id: "defillama_context_boundary",
      severity: "info",
      label: "DefiLlama boundary",
      surface: "chart_canvas",
      evidence:
        "DefiLlama can annotate TVL/protocol/chain context, not price candles.",
      renderRule:
        "Render TVL as a separate context strip or annotation; never blend it into price OHLC.",
      blocksAdvanced: false,
    });
  }
  if (!markers.some((marker) => marker.id === "no_forecast_boundary")) {
    markers.push({
      id: "no_forecast_boundary",
      severity: "info",
      label: "No forecast boundary",
      surface: "chart_canvas",
      evidence: "Macro history is context only.",
      renderRule:
        "Every 2Y/5Y/MAX receipt must state that history is not a ROI, target price or trading instruction.",
      blocksAdvanced: false,
    });
  }
  return markers.slice(0, 12);
}

function buildPdfReceipt(args: {
  macroFingerprint: string;
  gapFingerprint: string;
  markers: Pass2461ChartGapMarker[];
  macroGate?: Pass2460MacroChartIntegrityGate;
}): Pass2461PdfChartReceipt {
  const hardRejectReasons = unique([
    args.macroFingerprint === "missing-macro-fingerprint" &&
      "macroChartFingerprint missing",
    args.markers.some((marker) => marker.id === "point_density_gap") &&
      "point density marker must be visible in PDF",
    args.markers.some((marker) => marker.id === "second_overlay_missing") &&
      "second overlay marker must be visible in PDF",
    args.markers.some(
      (marker) =>
        marker.id === "freshness_lock" && marker.severity === "critical",
    ) && "freshness critical marker blocks PDF Advanced proof",
    args.macroGate?.state === "blocked" && "PASS2460 macro gate is blocked",
  ]).slice(0, 8);
  const parityState =
    args.macroFingerprint === "missing-macro-fingerprint"
      ? "missing_hash"
      : hardRejectReasons.length
        ? "blocked_until_canonical_payload"
        : "same_hash";
  return {
    state: hardRejectReasons.length
      ? "blocked"
      : args.markers.some((marker) => marker.severity === "watch")
        ? "watch"
        : "ready",
    previewHash: args.gapFingerprint,
    downloadHash: args.gapFingerprint,
    parityState,
    requiredVisibleFields: [
      "asset id / symbol",
      "range",
      "observed point count",
      "required minimum point count",
      "macroChartFingerprint",
      "gapReceiptFingerprint",
      "provider overlay state",
      "freshness state",
      "no-forecast boundary",
    ],
    hardRejectReasons,
    copyRule: hardRejectReasons.length
      ? "PDF preview/download must show the gap receipt and refuse Advanced macro wording until markers are resolved."
      : "PDF preview/download may show macro history only as historical context with the same gapReceiptFingerprint.",
  };
}

function surfaceContract(
  surface: Pass2456SurfaceId,
  markers: Pass2461ChartGapMarker[],
  pdf: Pass2461PdfChartReceipt,
): Pass2461SurfaceGapContract {
  const surfaceMarkers = markers.filter(
    (marker) =>
      marker.surface === surface ||
      marker.surface === "chart_canvas" ||
      (surface.startsWith("pdf") && marker.surface === "pdf_receipt"),
  );
  const pdfBlocks =
    (surface === "pdf_preview" || surface === "pdf_download") &&
    pdf.state === "blocked"
      ? pdf.hardRejectReasons
      : [];
  const blockedBy = unique([
    ...surfaceMarkers
      .filter((marker) => marker.blocksAdvanced)
      .map((marker) => `${marker.label}: ${marker.evidence}`),
    ...pdfBlocks,
  ] as Array<string | false | null | undefined>).slice(0, 8);
  return {
    surface,
    state: blockedBy.length
      ? "blocked"
      : surfaceMarkers.some((marker) => marker.severity === "watch")
        ? "watch"
        : "ready",
    requiredMarkers: unique(surfaceMarkers.map((marker) => marker.label)).slice(
      0,
      8,
    ),
    blockedBy,
    visibleUiContract:
      surface === "angel"
        ? "Angel must list the active gap markers before trend/context language."
        : surface.startsWith("pdf")
          ? "PDF must print the same gapReceiptFingerprint and marker list as chart/source-sync."
          : "Surface must show marker chips near the chart/proof rail; no hidden macro locks.",
  };
}

export function buildPass2461MacroGapReceipt(args: {
  query?: string;
  symbol?: string;
  requestedRange?: string;
  pointCount?: number;
  sourceSync?: Pass2461SourceSyncPacket;
  chartOverlay?: Pass2449ChartOverlayReconciler;
  macroGate?: Pass2460MacroChartIntegrityGate;
  payloadFingerprint?: string;
}): Pass2461MacroGapReceipt {
  const macroGate = args.macroGate ?? args.sourceSync?.pass2460;
  const chartOverlay = args.chartOverlay ?? args.sourceSync?.pass2449;
  const requestedRange = (
    args.requestedRange ??
    macroGate?.requestedRange ??
    chartOverlay?.range ??
    "2y"
  ).toLowerCase();
  const activeRangeGate = macroGate?.activeRangeGate;
  const observedPointCount = Math.max(
    0,
    Math.floor(
      args.pointCount ??
        activeRangeGate?.observedPointCount ??
        chartOverlay?.windowContract.actualPoints ??
        0,
    ),
  );
  const requiredMinPoints =
    activeRangeGate?.requiredMinPoints ??
    (requestedRange === "5y"
      ? 520
      : requestedRange === "max"
        ? 730
        : requestedRange === "2y"
          ? 365
          : 120);
  const macroChartFingerprint =
    macroGate?.macroChartFingerprint ??
    args.payloadFingerprint ??
    "missing-macro-fingerprint";
  const markers = buildMarkers({
    sourceSync: args.sourceSync,
    macroGate,
    chartOverlay,
    pointCount: observedPointCount,
    requiredMinPoints,
    range: requestedRange,
    macroFingerprint: macroChartFingerprint,
  });
  const gapReceiptFingerprint = smallHash({
    macroChartFingerprint,
    requestedRange,
    observedPointCount,
    requiredMinPoints,
    markers: markers.map((marker) => [
      marker.id,
      marker.severity,
      marker.blocksAdvanced,
    ]),
  });
  const pdfChartReceipt = buildPdfReceipt({
    macroFingerprint: macroChartFingerprint,
    gapFingerprint: gapReceiptFingerprint,
    markers,
    macroGate,
  });
  const surfaceContracts = SURFACES.map((surface) =>
    surfaceContract(surface, markers, pdfChartReceipt),
  );
  const criticalMarkers = markers.filter(
    (marker) => marker.severity === "critical",
  ).length;
  const watchMarkers = markers.filter(
    (marker) => marker.severity === "watch",
  ).length;
  const blockedSurfaces = surfaceContracts.filter(
    (surface) => surface.state === "blocked",
  ).length;
  const state: Pass2461ReceiptState =
    pdfChartReceipt.state === "blocked" || criticalMarkers || blockedSurfaces
      ? "blocked"
      : watchMarkers
        ? "watch"
        : "ready";
  const dataSyncLocks = unique([
    ...markers
      .filter((marker) => marker.blocksAdvanced)
      .map((marker) => `${marker.id}: ${marker.evidence}`),
    ...pdfChartReceipt.hardRejectReasons.map((reason) => `pdf: ${reason}`),
  ]).slice(0, 12);
  const score = clamp(
    72 -
      criticalMarkers * 14 -
      watchMarkers * 6 -
      blockedSurfaces * 3 +
      Math.min(20, (observedPointCount / Math.max(1, requiredMinPoints)) * 20),
  );

  return {
    version: "macro-gap-receipt-v1",
    state,
    score,
    query: args.query ?? args.sourceSync?.query,
    symbol: args.symbol ?? args.sourceSync?.symbol,
    requestedRange,
    observedPointCount,
    requiredMinPoints,
    macroChartFingerprint,
    gapReceiptFingerprint,
    chartGapMarkers: markers,
    pdfChartReceipt,
    surfaceContracts,
    visualRendererContract: [
      "Render point-density, second-overlay, freshness and PDF-parity markers directly on the chart proof rail.",
      "Gap markers must be visible in Shield, Real Markets, VLM Brain, Browser Preview, PDF preview/download and Angel.",
      "DefiLlama TVL markers must be drawn as separate context annotations, never as price candles.",
      "Each marker must include severity, evidence sentence, render rule and Advanced blocking state.",
    ],
    dataSyncLocks,
    hundredPercentUnlocks: [
      "2Y/5Y/MAX charts show point count, required minimum and gap markers before macro copy.",
      "PDF preview and download share the same gapReceiptFingerprint.",
      "Angel can no longer summarize macro history without listing marker state first.",
      "Chart canvas uses visible lock markers instead of silent missing data.",
      "TVL/protocol overlays stay separate from OHLC candles.",
    ],
    nextWorldClassSequence: [
      "Mount PASS2461 marker list inside Browser Preview and PDF preview/download templates.",
      "Add real chart gap detection from CoinGecko market_chart/range timestamps, not only point-count checks.",
      "Render DEX Screener/GeckoTerminal/Binance overlay badges in the chart legend with observedAt/max-age chips.",
      "Persist gapReceiptFingerprint in the audit receipt vault for replay.",
      "Start PASS2462: timestamp-gap detector + canonical chart resampling ledger.",
    ],
    noSmoothingRule:
      "Missing macro points, missing second overlays or stale timestamps must be rendered as visible gap markers; Velmère must not smooth them into a clean-looking institutional chart.",
    generatedAt: new Date().toISOString(),
  };
}
