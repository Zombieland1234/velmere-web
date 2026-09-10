import type { Pass2453ReportEvidenceCapsule } from "./report-evidence-capsule";
import type { Pass2454InstitutionalSourceRouter } from "./institutional-source-router";
import type { VelmereSourceSyncPacket } from "./source-sync-contract";
import type { Pass2449ChartOverlayReconciler } from "./chart-overlay-reconciler";

type Pass2455SourceSyncPacket = Omit<VelmereSourceSyncPacket, "pass2449"> & {
  pass2449?: Pass2449ChartOverlayReconciler;
  pass2453?: Pass2453ReportEvidenceCapsule;
  pass2454?: Pass2454InstitutionalSourceRouter;
};

export type Pass2455UiProofState = "ready" | "watch" | "blocked";
export type Pass2455UiChipStatus =
  "live" | "configured" | "planned" | "degraded" | "missing" | "not_applicable";

export type Pass2455ProviderChip = {
  id: string;
  label: string;
  status: Pass2455UiChipStatus;
  lane: string;
  tone: "good" | "watch" | "blocked" | "neutral";
  visibleLabel: string;
  tooltip: string;
  bestFor: string[];
  notFor: string[];
};

export type Pass2455FieldHeatmapCell = {
  field: string;
  state: Pass2455UiProofState;
  primaryProvider: string;
  secondaryProviders: string[];
  confirmedBy: string[];
  blockedBy: string[];
  visibleBadge: string;
  uiRule: string;
};

export type Pass2455ChartRangeBadge = {
  range: "30d" | "90d" | "1y" | "2y" | "5y" | "max";
  label: string;
  state: Pass2455UiProofState;
  targetPoints: number;
  minimumOverlays: string[];
  missingBeforeAdvanced: string[];
  uiRule: string;
};

export type Pass2455SurfaceProofContract = {
  surface:
    | "Shield"
    | "Real Markets"
    | "VLM Brain"
    | "Browser Preview"
    | "PDF Preview"
    | "PDF Download"
    | "Angel";
  state: Pass2455UiProofState;
  requiredFingerprint: string;
  visibleElements: string[];
  driftAction: string;
};

export type Pass2455UiProofStrip = {
  version: "ui-proof-strip-v1";
  state: Pass2455UiProofState;
  score: number;
  query?: string;
  symbol?: string;
  canonicalEvidenceFingerprint: string;
  providerChips: Pass2455ProviderChip[];
  fieldHeatmap: Pass2455FieldHeatmapCell[];
  chartRangeBadges: Pass2455ChartRangeBadge[];
  surfaceContracts: Pass2455SurfaceProofContract[];
  pdfHardLocks: string[];
  uiMountTargets: string[];
  angelReadoutOrder: string[];
  noFillerUiRule: string;
  generatedAt: string;
};

function unique(items: Array<string | false | null | undefined>) {
  return Array.from(new Set(items.filter(Boolean) as string[]));
}

function clamp(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function statusTone(
  status: Pass2455UiChipStatus,
): Pass2455ProviderChip["tone"] {
  if (status === "live") return "good";
  if (status === "configured" || status === "degraded") return "watch";
  if (status === "missing") return "blocked";
  return "neutral";
}

function normalizeProviderStatus(
  status: string | undefined,
): Pass2455UiChipStatus {
  if (
    status === "live" ||
    status === "configured" ||
    status === "planned" ||
    status === "not_applicable"
  )
    return status;
  if (status === "missing_key") return "missing";
  return "planned";
}

function routeStateToBadge(state: Pass2455UiProofState, provider: string) {
  if (state === "ready") return `Ready · ${provider}`;
  if (state === "watch") return `Watch · ${provider}`;
  return `Blocked · ${provider}`;
}

function buildChartBadges(
  router?: Pass2454InstitutionalSourceRouter,
  pointCount?: number,
): Pass2455ChartRangeBadge[] {
  const expansionBlockers = router?.chartDataExpansionPlan.blockedBy ?? [
    "source router missing",
    "second provider overlay missing",
  ];
  const overlays = router?.chartDataExpansionPlan.requiredOverlays ?? [
    "CoinGecko market_chart/OHLC",
    "Binance/CEX klines",
    "GeckoTerminal pool OHLCV",
  ];
  const ranges: Array<Pass2455ChartRangeBadge["range"]> = [
    "30d",
    "90d",
    "1y",
    "2y",
    "5y",
    "max",
  ];
  const targets: Record<Pass2455ChartRangeBadge["range"], number> = {
    "30d": 180,
    "90d": 260,
    "1y": 365,
    "2y": 520,
    "5y": 620,
    max: 620,
  };
  return ranges.map((range) => {
    const targetPoints = targets[range];
    const enoughPoints =
      (pointCount ?? 0) >=
      Math.min(targetPoints, range === "30d" ? 120 : targetPoints);
    const isMacro = range === "2y" || range === "5y" || range === "max";
    const state: Pass2455UiProofState =
      enoughPoints && !expansionBlockers.length
        ? "ready"
        : enoughPoints || (!isMacro && expansionBlockers.length <= 2)
          ? "watch"
          : "blocked";
    return {
      range,
      label: range.toUpperCase(),
      state,
      targetPoints,
      minimumOverlays: overlays.slice(0, isMacro ? 4 : 3),
      missingBeforeAdvanced: expansionBlockers.slice(0, 6),
      uiRule: isMacro
        ? "Macro chart badge must show point count, gap state, source and second-provider overlay before regime language."
        : "Short-window chart badge must not be reused as 2Y/5Y/MAX proof.",
    };
  });
}

function buildSurfaceContracts(
  fingerprint: string,
  reportEvidence?: Pass2453ReportEvidenceCapsule,
): Pass2455SurfaceProofContract[] {
  const reportReady = reportEvidence?.state === "ready";
  const surfaces: Pass2455SurfaceProofContract["surface"][] = [
    "Shield",
    "Real Markets",
    "VLM Brain",
    "Browser Preview",
    "PDF Preview",
    "PDF Download",
    "Angel",
  ];
  return surfaces.map((surface) => ({
    surface,
    state: reportReady ? "watch" : "blocked",
    requiredFingerprint: fingerprint,
    visibleElements: [
      "provider chips",
      "confidence cap",
      "missing proof badge",
      "chart range badge",
      "PDF parity fingerprint",
    ],
    driftAction: surface.includes("PDF")
      ? "Hard reject stale PDF render and regenerate from canonical evidence capsule."
      : "Show a visible drift warning if the surface fingerprint differs from the canonical capsule.",
  }));
}

export function buildPass2455UiProofStrip(args: {
  query?: string;
  symbol?: string;
  sourceSync?: Pass2455SourceSyncPacket;
  institutionalRouter?: Pass2454InstitutionalSourceRouter;
  reportEvidence?: Pass2453ReportEvidenceCapsule;
  chartRange?: string;
  pointCount?: number;
  payloadFingerprint?: string;
}): Pass2455UiProofStrip {
  const sourceSync = args.sourceSync;
  const router = args.institutionalRouter ?? sourceSync?.pass2454;
  const reportEvidence = args.reportEvidence ?? sourceSync?.pass2453;
  const fingerprint =
    args.payloadFingerprint ??
    reportEvidence?.canonicalEvidenceFingerprint ??
    `vlm-missing-fingerprint-${args.query ?? args.symbol ?? "unknown"}`;
  const pointCount =
    args.pointCount ?? sourceSync?.pass2449?.windowContract.actualPoints ?? 0;

  const providerChips: Pass2455ProviderChip[] = (router?.providers ?? []).map(
    (provider) => {
      const status = normalizeProviderStatus(provider.status);
      return {
        id: provider.id,
        label: provider.label,
        status,
        lane: provider.lane,
        tone: statusTone(status),
        visibleLabel: `${provider.label}: ${status.replace("_", " ")}`,
        tooltip: provider.copyBoundary,
        bestFor: provider.bestFor.slice(0, 6),
        notFor: provider.notFor.slice(0, 5),
      };
    },
  );

  const fieldHeatmap: Pass2455FieldHeatmapCell[] = (
    router?.fieldRoutes ?? []
  ).map((field) => ({
    field: field.field,
    state: field.state,
    primaryProvider: field.primaryProvider,
    secondaryProviders: field.secondaryProviders,
    confirmedBy: field.confirmedBy,
    blockedBy: field.blockedBy,
    visibleBadge: routeStateToBadge(field.state, field.primaryProvider),
    uiRule: field.uiRule,
  }));

  const chartRangeBadges = buildChartBadges(router, pointCount);
  const surfaceContracts = buildSurfaceContracts(fingerprint, reportEvidence);
  const blockedHeatmap = fieldHeatmap.filter(
    (field) => field.state === "blocked",
  ).length;
  const liveProviders = providerChips.filter(
    (chip) => chip.status === "live",
  ).length;
  const blockedRanges = chartRangeBadges.filter(
    (badge) => badge.state === "blocked",
  ).length;
  const pdfHardLocks = unique([
    reportEvidence?.pdfParityLock.state !== "ready" &&
      "PDF preview/download parity not ready",
    fingerprint.includes("missing") && "canonical evidence fingerprint missing",
    blockedHeatmap > 0 && `${blockedHeatmap} field routes blocked`,
    blockedRanges > 0 &&
      `${blockedRanges} chart ranges blocked before Advanced PDF`,
    !providerChips.some(
      (chip) => chip.id === "defillama" && chip.status === "live",
    ) && "DefiLlama lane not live for TVL/protocol context",
  ]).slice(0, 8);

  const score = clamp(
    (router?.score ?? 40) +
      liveProviders * 3 -
      blockedHeatmap * 5 -
      blockedRanges * 4 -
      pdfHardLocks.length * 3,
  );
  const state: Pass2455UiProofState =
    pdfHardLocks.length >= 4 || score < 45
      ? "blocked"
      : pdfHardLocks.length || score < 78
        ? "watch"
        : "ready";

  return {
    version: "ui-proof-strip-v1",
    state,
    score,
    query: args.query ?? sourceSync?.query,
    symbol: args.symbol ?? sourceSync?.symbol,
    canonicalEvidenceFingerprint: fingerprint,
    providerChips,
    fieldHeatmap,
    chartRangeBadges,
    surfaceContracts,
    pdfHardLocks,
    uiMountTargets: [
      "AssetDetailModal top risk strip",
      "TokenRiskModal source tab",
      "Real Markets modal right rail",
      "VLM Brain source rail",
      "Browser preview footer",
      "PDF preview/download receipt",
      "Angel context capsule",
    ],
    angelReadoutOrder: [
      "state/score",
      "provider chips live/configured/planned",
      "blocked field routes",
      "chart range badges",
      "PDF hard locks",
      "safe tier conclusion",
    ],
    noFillerUiRule:
      "Every visible chip must map to a provider, timestamp/fingerprint or explicit missing proof. UI polish cannot hide a missing evidence lane.",
    generatedAt: new Date().toISOString(),
  };
}

export function buildPass2455ChartUiProofStrip(args: {
  id?: string;
  symbol?: string;
  range?: string;
  pointCount?: number;
  institutionalRouter?: Pass2454InstitutionalSourceRouter;
  reportEvidence?: Pass2453ReportEvidenceCapsule;
  payloadFingerprint?: string;
}) {
  return buildPass2455UiProofStrip({
    query: args.id,
    symbol: args.symbol,
    institutionalRouter: args.institutionalRouter,
    reportEvidence: args.reportEvidence,
    chartRange: args.range,
    pointCount: args.pointCount,
    payloadFingerprint: args.payloadFingerprint,
  });
}
