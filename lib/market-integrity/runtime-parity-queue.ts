import type {
  Pass2453ReportEvidenceCapsule,
  Pass2453ReportState,
} from "./report-evidence-capsule";
import type {
  Pass2455ChartRangeBadge,
  Pass2455UiProofState,
  Pass2455UiProofStrip,
} from "./ui-proof-strip";
import type { VelmereSourceSyncPacket } from "./source-sync-contract";

type Pass2456SourceSyncPacket = VelmereSourceSyncPacket & {
  pass2453?: Pass2453ReportEvidenceCapsule;
  pass2455?: Pass2455UiProofStrip;
};

export type Pass2456RuntimeParityState = "ready" | "watch" | "blocked";
export type Pass2456SurfaceId =
  | "shield"
  | "real_markets"
  | "vlm_brain"
  | "browser_preview"
  | "pdf_preview"
  | "pdf_download"
  | "chart"
  | "angel";

export type Pass2456RuntimeSurfaceContract = {
  surface: Pass2456SurfaceId;
  state: Pass2456RuntimeParityState;
  canonicalEvidenceFingerprint: string;
  requiredInputs: string[];
  visibleProofElements: string[];
  hardRejectIfMissing: string[];
  runtimeRule: string;
};

export type Pass2456MissingProofQueueItem = {
  id: string;
  severity: "info" | "watch" | "blocker";
  field: string;
  providerNeeded: string;
  blockingSurfaces: Pass2456SurfaceId[];
  userVisibleCopy: string;
  operatorAction: string;
};

export type Pass2456PdfRuntimeParityLock = {
  state: Pass2456RuntimeParityState;
  hardReject: boolean;
  canonicalEvidenceFingerprint: string;
  requiredSameFingerprintSurfaces: Pass2456SurfaceId[];
  blockedBy: string[];
  previewRule: string;
  downloadRule: string;
};

export type Pass2456ChartRuntimeBadge = Pass2455ChartRangeBadge & {
  mustShowInUi: boolean;
  blockerLabel: string;
};

export type Pass2456RuntimeParityQueue = {
  version: "runtime-parity-queue-v1";
  state: Pass2456RuntimeParityState;
  score: number;
  query?: string;
  symbol?: string;
  canonicalEvidenceFingerprint: string;
  surfaceRuntimeContracts: Pass2456RuntimeSurfaceContract[];
  missingProofQueue: Pass2456MissingProofQueueItem[];
  pdfRuntimeParityLock: Pass2456PdfRuntimeParityLock;
  chartRuntimeBadges: Pass2456ChartRuntimeBadge[];
  brainRailContract: {
    state: Pass2456RuntimeParityState;
    requiredWidgets: string[];
    blockedBy: string[];
    rule: string;
  };
  browserPreviewContract: {
    state: Pass2456RuntimeParityState;
    requiredWidgets: string[];
    blockedBy: string[];
    rule: string;
  };
  angelReadoutOrder: string[];
  noSilentMismatchRule: string;
  generatedAt: string;
};

function unique(items: Array<string | false | null | undefined | 0>) {
  return Array.from(new Set(items.filter(Boolean) as string[]));
}

function clamp(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function normalizeState(
  state?: Pass2455UiProofState | Pass2453ReportState,
): Pass2456RuntimeParityState {
  if (state === "ready" || state === "watch" || state === "blocked")
    return state;
  return "blocked";
}

function worstState(
  states: Pass2456RuntimeParityState[],
): Pass2456RuntimeParityState {
  if (states.includes("blocked")) return "blocked";
  if (states.includes("watch")) return "watch";
  return "ready";
}

function queueItem(args: {
  id: string;
  severity: Pass2456MissingProofQueueItem["severity"];
  field: string;
  providerNeeded: string;
  blockingSurfaces: Pass2456SurfaceId[];
  userVisibleCopy: string;
  operatorAction: string;
}): Pass2456MissingProofQueueItem {
  return args;
}

function buildQueue(args: {
  uiProofStrip?: Pass2455UiProofStrip;
  reportEvidence?: Pass2453ReportEvidenceCapsule;
  sourceSync?: Pass2456SourceSyncPacket;
}): Pass2456MissingProofQueueItem[] {
  const strip = args.uiProofStrip;
  const report = args.reportEvidence;
  const items: Pass2456MissingProofQueueItem[] = [];

  for (const cell of strip?.fieldHeatmap ?? []) {
    if (cell.state === "blocked") {
      items.push(
        queueItem({
          id: `field-${cell.field}`,
          severity: "blocker",
          field: cell.field,
          providerNeeded:
            unique([cell.primaryProvider, ...cell.secondaryProviders]).join(
              " + ",
            ) || "field provider",
          blockingSurfaces: [
            "vlm_brain",
            "browser_preview",
            "pdf_preview",
            "pdf_download",
            "angel",
          ],
          userVisibleCopy: `${cell.field} is blocked until ${cell.primaryProvider} evidence and the required secondary lane are visible.`,
          operatorAction: `Attach ${cell.primaryProvider} observedAt/fingerprint and resolve: ${cell.blockedBy.slice(0, 3).join("; ") || "missing secondary provider"}.`,
        }),
      );
    } else if (cell.state === "watch") {
      items.push(
        queueItem({
          id: `field-watch-${cell.field}`,
          severity: "watch",
          field: cell.field,
          providerNeeded:
            unique([cell.primaryProvider, ...cell.secondaryProviders]).join(
              " + ",
            ) || "field provider",
          blockingSurfaces: ["vlm_brain", "pdf_preview", "angel"],
          userVisibleCopy: `${cell.field} is on watch; keep copy calm and show source limitations.`,
          operatorAction: `Promote ${cell.field} only after secondary confirmation and timestamp freshness are visible.`,
        }),
      );
    }
  }

  for (const badge of strip?.chartRangeBadges ?? []) {
    if (badge.state === "blocked") {
      items.push(
        queueItem({
          id: `chart-${badge.range}`,
          severity: "blocker",
          field: `chart_${badge.range}`,
          providerNeeded: badge.minimumOverlays.join(" + "),
          blockingSurfaces: [
            "chart",
            "vlm_brain",
            "browser_preview",
            "pdf_preview",
            "pdf_download",
          ],
          userVisibleCopy: `${badge.label} macro chart needs point-count, gaps and a second-provider overlay before regime language.`,
          operatorAction: `Add overlay or downgrade copy: ${badge.missingBeforeAdvanced.slice(0, 3).join("; ") || "missing macro overlay"}.`,
        }),
      );
    }
  }

  for (const lock of strip?.pdfHardLocks ?? []) {
    items.push(
      queueItem({
        id: `pdf-${lock
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "")
          .slice(0, 48)}`,
        severity: "blocker",
        field: "pdf_parity",
        providerNeeded: "canonical evidence capsule + matching fingerprint",
        blockingSurfaces: ["browser_preview", "pdf_preview", "pdf_download"],
        userVisibleCopy: lock,
        operatorAction:
          "Regenerate Browser/PDF from the canonical report-evidence capsule and expose the fingerprint in the receipt.",
      }),
    );
  }

  for (const surface of report?.surfaceContracts ?? []) {
    if (surface.state === "blocked") {
      items.push(
        queueItem({
          id: `surface-${surface.surface}`,
          severity: "blocker",
          field: `surface_${surface.surface}`,
          providerNeeded: surface.requiredPayloadKeys.join(" + "),
          blockingSurfaces: [surface.surface as Pass2456SurfaceId],
          userVisibleCopy: `${surface.surface} cannot present Advanced report copy until its canonical payload keys are visible.`,
          operatorAction:
            surface.blockedBy.slice(0, 4).join("; ") || surface.parityRule,
        }),
      );
    }
  }

  const deduped = new Map<string, Pass2456MissingProofQueueItem>();
  for (const item of items)
    if (!deduped.has(item.id)) deduped.set(item.id, item);
  return Array.from(deduped.values()).slice(0, 24);
}

function buildSurfaceContracts(args: {
  fingerprint: string;
  uiProofStrip?: Pass2455UiProofStrip;
  missingQueue: Pass2456MissingProofQueueItem[];
}): Pass2456RuntimeSurfaceContract[] {
  const surfaces: Pass2456SurfaceId[] = [
    "shield",
    "real_markets",
    "vlm_brain",
    "browser_preview",
    "pdf_preview",
    "pdf_download",
    "chart",
    "angel",
  ];
  return surfaces.map((surface) => {
    const blockers = args.missingQueue.filter(
      (item) =>
        item.severity === "blocker" && item.blockingSurfaces.includes(surface),
    );
    const watches = args.missingQueue.filter(
      (item) =>
        item.severity === "watch" && item.blockingSurfaces.includes(surface),
    );
    const state: Pass2456RuntimeParityState = blockers.length
      ? "blocked"
      : watches.length || args.uiProofStrip?.state === "watch"
        ? "watch"
        : "ready";
    const isPdf = surface === "pdf_preview" || surface === "pdf_download";
    return {
      surface,
      state,
      canonicalEvidenceFingerprint: args.fingerprint,
      requiredInputs: unique([
        "canonicalEvidenceFingerprint",
        "provider chips",
        "field heatmap",
        "confidence cap",
        "missing-proof queue",
        isPdf && "PDF payload hash",
        surface === "chart" && "chart range badges",
      ]),
      visibleProofElements: unique([
        "source badge",
        "observedAt badge",
        "provider status chips",
        "blocked fields count",
        "chart range proof",
        isPdf && "preview/download same-hash receipt",
      ]),
      hardRejectIfMissing: blockers
        .map((item) => item.userVisibleCopy)
        .slice(0, 6),
      runtimeRule: isPdf
        ? "Hard reject PDF preview/download when the fingerprint differs or a blocking proof queue item targets PDF."
        : "Render a visible missing-proof warning before any strong conclusion if the canonical fingerprint or queue is not visible.",
    };
  });
}

export function buildPass2456RuntimeParityQueue(args: {
  query?: string;
  symbol?: string;
  sourceSync?: Pass2456SourceSyncPacket;
  uiProofStrip?: Pass2455UiProofStrip;
  reportEvidence?: Pass2453ReportEvidenceCapsule;
  payloadFingerprint?: string;
}): Pass2456RuntimeParityQueue {
  const sourceSync = args.sourceSync;
  const uiProofStrip = args.uiProofStrip ?? sourceSync?.pass2455;
  const reportEvidence = args.reportEvidence ?? sourceSync?.pass2453;
  const fingerprint =
    args.payloadFingerprint ??
    uiProofStrip?.canonicalEvidenceFingerprint ??
    reportEvidence?.canonicalEvidenceFingerprint ??
    `vlm-runtime-missing-fingerprint-${args.query ?? args.symbol ?? sourceSync?.query ?? "unknown"}`;

  const missingProofQueue = buildQueue({
    uiProofStrip,
    reportEvidence,
    sourceSync,
  });
  const surfaceRuntimeContracts = buildSurfaceContracts({
    fingerprint,
    uiProofStrip,
    missingQueue: missingProofQueue,
  });
  const pdfSurfaceStates = surfaceRuntimeContracts
    .filter(
      (surface) =>
        surface.surface === "pdf_preview" || surface.surface === "pdf_download",
    )
    .map((surface) => surface.state);
  const pdfBlockedBy = unique([
    ...missingProofQueue
      .filter(
        (item) =>
          item.blockingSurfaces.includes("pdf_preview") ||
          item.blockingSurfaces.includes("pdf_download"),
      )
      .map((item) => item.userVisibleCopy),
    reportEvidence?.pdfParityLock.blockedBy?.length &&
      `report capsule PDF locks: ${reportEvidence.pdfParityLock.blockedBy.slice(0, 3).join("; ")}`,
    fingerprint.includes("missing") && "missing canonical fingerprint",
  ]).slice(0, 12);

  const chartRuntimeBadges: Pass2456ChartRuntimeBadge[] = (
    uiProofStrip?.chartRangeBadges ?? []
  ).map((badge) => ({
    ...badge,
    mustShowInUi:
      badge.state !== "ready" || ["2y", "5y", "max"].includes(badge.range),
    blockerLabel:
      badge.state === "ready"
        ? "ready"
        : (badge.missingBeforeAdvanced[0] ??
          "second-provider overlay required"),
  }));

  const brainBlockers = missingProofQueue
    .filter((item) => item.blockingSurfaces.includes("vlm_brain"))
    .map((item) => item.userVisibleCopy)
    .slice(0, 8);
  const browserBlockers = missingProofQueue
    .filter((item) => item.blockingSurfaces.includes("browser_preview"))
    .map((item) => item.userVisibleCopy)
    .slice(0, 8);

  const pdfRuntimeParityLock: Pass2456PdfRuntimeParityLock = {
    state: worstState(
      pdfSurfaceStates.length
        ? pdfSurfaceStates
        : [
            normalizeState(reportEvidence?.pdfParityLock.state),
            normalizeState(uiProofStrip?.state),
          ],
    ),
    hardReject: pdfBlockedBy.length > 0,
    canonicalEvidenceFingerprint: fingerprint,
    requiredSameFingerprintSurfaces: [
      "browser_preview",
      "pdf_preview",
      "pdf_download",
      "vlm_brain",
      "angel",
    ],
    blockedBy: pdfBlockedBy,
    previewRule:
      "PDF preview must read the canonical report evidence capsule and display the same fingerprint before showing Advanced sections.",
    downloadRule:
      "PDF download must use the same canonicalEvidenceFingerprint as preview; otherwise regenerate and block download with a visible reason.",
  };

  const brainRailContract = {
    state: brainBlockers.length
      ? ("blocked" as const)
      : uiProofStrip?.state === "ready"
        ? ("ready" as const)
        : ("watch" as const),
    requiredWidgets: [
      "provider chips",
      "field heatmap",
      "risk calibration",
      "missing-proof queue",
      "PDF parity badge",
    ],
    blockedBy: brainBlockers,
    rule: "The VLM Brain right rail must show proof widgets before full Advanced narrative appears.",
  };

  const browserPreviewContract = {
    state:
      browserBlockers.length || pdfRuntimeParityLock.hardReject
        ? ("blocked" as const)
        : uiProofStrip?.state === "ready"
          ? ("ready" as const)
          : ("watch" as const),
    requiredWidgets: [
      "canonical fingerprint",
      "provider chips",
      "missing-proof queue",
      "PDF lock state",
      "locale parity",
    ],
    blockedBy: unique([
      ...browserBlockers,
      ...pdfRuntimeParityLock.blockedBy,
    ]).slice(0, 10),
    rule: "Browser preview and PDF must be generated from the same evidence capsule, locale and fingerprint.",
  };

  const blockerCount = missingProofQueue.filter(
    (item) => item.severity === "blocker",
  ).length;
  const watchCount = missingProofQueue.filter(
    (item) => item.severity === "watch",
  ).length;
  const score = clamp(
    (uiProofStrip?.score ?? reportEvidence?.score ?? 40) -
      blockerCount * 4 -
      watchCount * 2 -
      (pdfRuntimeParityLock.hardReject ? 8 : 0),
  );
  const state: Pass2456RuntimeParityState =
    blockerCount >= 4 || pdfRuntimeParityLock.hardReject
      ? "blocked"
      : watchCount || score < 82
        ? "watch"
        : "ready";

  return {
    version: "runtime-parity-queue-v1",
    state,
    score,
    query: args.query ?? sourceSync?.query,
    symbol: args.symbol ?? sourceSync?.symbol,
    canonicalEvidenceFingerprint: fingerprint,
    surfaceRuntimeContracts,
    missingProofQueue,
    pdfRuntimeParityLock,
    chartRuntimeBadges,
    brainRailContract,
    browserPreviewContract,
    angelReadoutOrder: [
      "runtime parity state/score",
      "canonical evidence fingerprint",
      "PDF hard reject state",
      "missing-proof queue blockers",
      "surface runtime contracts",
      "Brain/Browser required widgets",
      "safe conclusion without filler",
    ],
    noSilentMismatchRule:
      "If two surfaces show different fingerprints, ranges, provider chips or missing-proof queue states, the stronger surface must downgrade copy and show the mismatch instead of hiding it.",
    generatedAt: new Date().toISOString(),
  };
}
