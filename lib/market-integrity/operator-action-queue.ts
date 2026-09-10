import type { Pass2454InstitutionalSourceRouter } from "./institutional-source-router";
import type { Pass2455UiProofStrip } from "./ui-proof-strip";
import type {
  Pass2456MissingProofQueueItem,
  Pass2456RuntimeParityQueue,
  Pass2456SurfaceId,
} from "./runtime-parity-queue";
import type { VelmereSourceSyncPacket } from "./source-sync-contract";
import type { Pass2453ReportEvidenceCapsule } from "./report-evidence-capsule";

type Pass2457SourceSyncPacket = VelmereSourceSyncPacket & {
  pass2453?: Pass2453ReportEvidenceCapsule;
  pass2454?: Pass2454InstitutionalSourceRouter;
  pass2455?: Pass2455UiProofStrip;
  pass2456?: Pass2456RuntimeParityQueue;
};

export type Pass2457OperatorActionState = "ready" | "watch" | "blocked";
export type Pass2457OperatorActionKind =
  | "provider_key"
  | "provider_adapter"
  | "second_overlay"
  | "chart_expansion"
  | "pdf_parity"
  | "browser_preview"
  | "vlm_brain_rail"
  | "angel_guard"
  | "ui_visibility"
  | "qa_replay";

export type Pass2457OperatorAction = {
  id: string;
  kind: Pass2457OperatorActionKind;
  priority: "P0" | "P1" | "P2";
  state: Pass2457OperatorActionState;
  title: string;
  reason: string;
  requiredProvider?: string;
  linkedField?: string;
  linkedSurfaces: Pass2456SurfaceId[];
  unlocks: string[];
  acceptanceCriteria: string[];
  safeCustomerCopy: string;
};

export type Pass2457ProviderCloseout = {
  provider: string;
  role: string;
  status: "live" | "configured" | "planned" | "missing";
  closeoutAction: string;
  evidenceUnlocked: string[];
  forbiddenShortcut: string;
};

export type Pass2457SurfaceHardWire = {
  surface: Pass2456SurfaceId;
  state: Pass2457OperatorActionState;
  requiredEndpoint: string;
  mustRender: string[];
  hardRejectWhen: string[];
  nextCodeTarget: string;
};

export type Pass2457OperatorActionQueue = {
  version: "operator-action-queue-v1";
  state: Pass2457OperatorActionState;
  score: number;
  query?: string;
  symbol?: string;
  canonicalEvidenceFingerprint: string;
  prioritizedActions: Pass2457OperatorAction[];
  providerCloseoutPlan: Pass2457ProviderCloseout[];
  surfaceHardWiring: Pass2457SurfaceHardWire[];
  hundredPercentChecklist: string[];
  worldClassSequence: string[];
  noSilentGreenRule: string;
  generatedAt: string;
};

function unique(items: Array<string | false | null | undefined>) {
  return Array.from(new Set(items.filter(Boolean) as string[]));
}

function clamp(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function worstState(
  states: Pass2457OperatorActionState[],
): Pass2457OperatorActionState {
  if (states.includes("blocked")) return "blocked";
  if (states.includes("watch")) return "watch";
  return "ready";
}

function normalizeProviderName(value?: string) {
  return (
    (value ?? "provider evidence").replace(/\s+/g, " ").trim().slice(0, 120) ||
    "provider evidence"
  );
}

function actionFromMissingProof(
  item: Pass2456MissingProofQueueItem,
): Pass2457OperatorAction {
  const isPdf = item.blockingSurfaces.some(
    (surface) => surface === "pdf_preview" || surface === "pdf_download",
  );
  const isChart = item.field.startsWith("chart_");
  const isBrain = item.blockingSurfaces.includes("vlm_brain");
  const priority =
    item.severity === "blocker"
      ? "P0"
      : item.severity === "watch"
        ? "P1"
        : "P2";
  const kind: Pass2457OperatorActionKind = isPdf
    ? "pdf_parity"
    : isChart
      ? "chart_expansion"
      : isBrain
        ? "vlm_brain_rail"
        : "provider_adapter";

  return {
    id: `close-${item.id}`.replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 96),
    kind,
    priority,
    state:
      item.severity === "blocker"
        ? "blocked"
        : item.severity === "watch"
          ? "watch"
          : "ready",
    title: `Close proof gap: ${item.field}`,
    reason: item.userVisibleCopy,
    requiredProvider: normalizeProviderName(item.providerNeeded),
    linkedField: item.field,
    linkedSurfaces: item.blockingSurfaces,
    unlocks: unique([
      isChart && "macro chart language",
      isPdf && "PDF preview/download parity",
      isBrain && "VLM Brain Advanced rail",
      "higher confidence cap",
      "customer-visible proof chip",
    ]),
    acceptanceCriteria: unique([
      `Provider lane visible: ${normalizeProviderName(item.providerNeeded)}`,
      "observedAt timestamp is present and within max-age policy",
      "canonicalEvidenceFingerprint is stable across source-sync, report-evidence, runtime-parity and UI proof strip",
      isPdf && "PDF preview and download use the same capsule hash",
      isChart &&
        "range badge shows points/gaps/overlay state before any macro conclusion",
      "Angel can summarize the limitation without inventing missing evidence",
    ]),
    safeCustomerCopy:
      "Some evidence is still missing, so Velmère keeps the conclusion limited and shows the missing proof instead of pretending certainty.",
  };
}

function buildProviderCloseoutPlan(args: {
  sourceSync?: Pass2457SourceSyncPacket;
  institutionalRouter?: Pass2454InstitutionalSourceRouter;
  uiProofStrip?: Pass2455UiProofStrip;
}): Pass2457ProviderCloseout[] {
  const lanes = args.sourceSync?.lanes ?? [];
  const activeFromLanes = lanes.map((lane) => ({
    provider: lane.label,
    role: lane.scope,
    status:
      lane.state === "confirmed"
        ? ("live" as const)
        : lane.state === "partial"
          ? ("configured" as const)
          : lane.state === "degraded"
            ? ("configured" as const)
            : ("missing" as const),
    closeoutAction: lane.missingFields.length
      ? `Close missing fields: ${lane.missingFields.slice(0, 4).join(", ")}.`
      : "Keep cadence and observedAt visible; no filler needed.",
    evidenceUnlocked: lane.confirmedFields.length
      ? lane.confirmedFields.slice(0, 6)
      : ["provider identity only"],
    forbiddenShortcut: lane.boundary,
  }));

  const plannedInstitutional: Pass2457ProviderCloseout[] = [
    {
      provider: "Coin Metrics",
      role: "institutional market/network reference lane for supply, market metrics and network context",
      status: "planned",
      closeoutAction:
        "Add env key + adapter before treating it as evidence; until then keep it as a planned overlay only.",
      evidenceUnlocked: [
        "institutional market cross-check",
        "network metrics overlay",
        "supply disagreement review",
      ],
      forbiddenShortcut:
        "A planned Coin Metrics lane cannot confirm live market, holder or TVL evidence without adapter output.",
    },
    {
      provider: "Kaiko",
      role: "institutional exchange liquidity/order-book/reference price overlay",
      status: "planned",
      closeoutAction:
        "Add licensed adapter and venue mapping before Advanced order-book/depth language.",
      evidenceUnlocked: [
        "cross-venue depth",
        "spread resilience",
        "liquidity shock context",
      ],
      forbiddenShortcut:
        "Do not infer order-book resilience from CoinGecko price or DEX liquidity snapshots.",
    },
    {
      provider: "Token Terminal / Artemis",
      role: "fundamentals lane: fees, revenue, active users and protocol financial comparables",
      status: "planned",
      closeoutAction:
        "Wire paid/keyed fundamentals adapter or keep fundamentals as missing proof.",
      evidenceUnlocked: [
        "fees/revenue fundamentals",
        "active users",
        "protocol comparables",
      ],
      forbiddenShortcut:
        "DefiLlama TVL alone cannot prove protocol revenue quality or user retention.",
    },
    {
      provider: "The Graph / Bitquery",
      role: "on-chain transfer, holder, pool and event graph lane",
      status: "planned",
      closeoutAction:
        "Add query templates + privacy-safe caching before holder/transfer claims.",
      evidenceUnlocked: [
        "holder concentration",
        "transfer graph",
        "pool event replay",
      ],
      forbiddenShortcut:
        "Never convert missing holder graph evidence into a fraud claim or a clean safety certificate.",
    },
    {
      provider: "L2BEAT",
      role: "L2 bridge/risk/security context for chain-specific assets",
      status: "planned",
      closeoutAction:
        "Add chain resolver and risk-context adapter before L2 security language.",
      evidenceUnlocked: [
        "L2 risk context",
        "bridge/security assumptions",
        "chain-specific warnings",
      ],
      forbiddenShortcut:
        "Chain TVL does not prove bridge risk or sequencer assumptions.",
    },
  ];

  const byProvider = new Map<string, Pass2457ProviderCloseout>();
  for (const item of [...activeFromLanes, ...plannedInstitutional]) {
    if (!byProvider.has(item.provider.toLowerCase()))
      byProvider.set(item.provider.toLowerCase(), item);
  }
  return Array.from(byProvider.values()).slice(0, 14);
}

function buildSurfaceHardWiring(
  runtimeParity?: Pass2456RuntimeParityQueue,
): Pass2457SurfaceHardWire[] {
  const contracts = runtimeParity?.surfaceRuntimeContracts ?? [];
  const bySurface = new Map(
    contracts.map((contract) => [contract.surface, contract]),
  );
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
    const contract = bySurface.get(surface);
    const isPdf = surface === "pdf_preview" || surface === "pdf_download";
    const isBrowser = surface === "browser_preview";
    const isBrain = surface === "vlm_brain";
    const isChart = surface === "chart";
    return {
      surface,
      state: contract?.state ?? "blocked",
      requiredEndpoint: isChart
        ? "/api/market-integrity/chart + /api/market-integrity/chart-overlay"
        : isPdf || isBrowser
          ? "/api/market-integrity/report-evidence + /api/market-integrity/runtime-parity"
          : isBrain
            ? "/api/market-integrity/tier-proof + /api/market-integrity/runtime-parity"
            : "/api/market-integrity/source-sync + /api/market-integrity/ui-proof-strip",
      mustRender: unique([
        "canonicalEvidenceFingerprint",
        "provider chips",
        "missing-proof queue count",
        "confidence cap",
        isChart && "range badges 30D/90D/1Y/2Y/5Y/MAX",
        (isPdf || isBrowser) && "PDF/Browser parity lock",
        isBrain && "tier evidence rail",
      ]),
      hardRejectWhen: contract?.hardRejectIfMissing?.length
        ? contract.hardRejectIfMissing.slice(0, 5)
        : [
            "canonicalEvidenceFingerprint missing",
            "provider lane state hidden",
            "surface cannot show missing proof",
          ],
      nextCodeTarget: isPdf
        ? "PDF generator/preview must reject when pdfRuntimeParityLock.hardReject is true."
        : isBrowser
          ? "Browser preview must show runtimeParityQueue.missingProofQueue before download."
          : isBrain
            ? "VLM Brain right rail must render tier evidence + missing proof queue."
            : isChart
              ? "Chart UI must show range badges and overlay state for macro ranges."
              : "Modal/table strip must keep proof chips visible above conclusions.",
    };
  });
}

export function buildPass2457OperatorActionQueue(args: {
  query?: string;
  symbol?: string;
  sourceSync?: Pass2457SourceSyncPacket;
  runtimeParity?: Pass2456RuntimeParityQueue;
  uiProofStrip?: Pass2455UiProofStrip;
  institutionalRouter?: Pass2454InstitutionalSourceRouter;
}): Pass2457OperatorActionQueue {
  const runtimeParity = args.runtimeParity ?? args.sourceSync?.pass2456;
  const uiProofStrip = args.uiProofStrip ?? args.sourceSync?.pass2455;
  const institutionalRouter =
    args.institutionalRouter ?? args.sourceSync?.pass2454;
  const fingerprint =
    runtimeParity?.canonicalEvidenceFingerprint ??
    uiProofStrip?.canonicalEvidenceFingerprint ??
    args.sourceSync?.pass2453?.canonicalEvidenceFingerprint ??
    "missing-fingerprint";

  const missingActions = (runtimeParity?.missingProofQueue ?? []).map(
    actionFromMissingProof,
  );
  const pdfAction: Pass2457OperatorAction[] = runtimeParity
    ?.pdfRuntimeParityLock?.hardReject
    ? [
        {
          id: "pdf-hard-reject-closeout",
          kind: "pdf_parity",
          priority: "P0",
          state: "blocked",
          title: "Wire PDF hard reject to the actual preview/download flow",
          reason:
            runtimeParity.pdfRuntimeParityLock.blockedBy
              .slice(0, 4)
              .join("; ") ||
            "PDF hard reject is active until proof parity is visible.",
          requiredProvider: "canonical report evidence capsule",
          linkedField: "pdf_parity",
          linkedSurfaces: ["browser_preview", "pdf_preview", "pdf_download"],
          unlocks: [
            "paid PDF trust",
            "Browser preview parity",
            "download receipt",
          ],
          acceptanceCriteria: [
            "PDF preview refuses Advanced language when hardReject=true",
            "PDF download and preview show the same canonicalEvidenceFingerprint",
            "Customer sees missing proof instead of a silent failure",
          ],
          safeCustomerCopy:
            "PDF is not generated as a confident Advanced report until the same evidence capsule is visible in preview and download.",
        },
      ]
    : [];

  const chartAction: Pass2457OperatorAction[] = (
    runtimeParity?.chartRuntimeBadges ?? []
  )
    .filter((badge) => badge.state !== "ready")
    .slice(0, 4)
    .map((badge) => ({
      id: `chart-range-closeout-${badge.range}`,
      kind: "chart_expansion" as const,
      priority: badge.state === "blocked" ? ("P0" as const) : ("P1" as const),
      state:
        badge.state === "blocked" ? ("blocked" as const) : ("watch" as const),
      title: `Close chart proof for ${badge.label}`,
      reason: badge.blockerLabel,
      requiredProvider: badge.minimumOverlays.join(" + "),
      linkedField: `chart_${badge.range}`,
      linkedSurfaces: [
        "chart",
        "vlm_brain",
        "browser_preview",
        "pdf_preview",
        "pdf_download",
      ],
      unlocks: [
        "macro range label",
        "long-history PDF chart",
        "regime context without prediction",
      ],
      acceptanceCriteria: [
        "point count is displayed",
        "gap/continuity state is displayed",
        "second overlay requirement is visible",
        "macro copy remains non-predictive",
      ],
      safeCustomerCopy:
        "Long-range chart context is available only when coverage, gap and overlay quality are visible.",
    }));

  const actionMap = new Map<string, Pass2457OperatorAction>();
  for (const action of [...pdfAction, ...chartAction, ...missingActions]) {
    if (!actionMap.has(action.id)) actionMap.set(action.id, action);
  }
  const prioritizedActions = Array.from(actionMap.values())
    .sort(
      (a, b) =>
        ({ P0: 0, P1: 1, P2: 2 })[a.priority] -
        { P0: 0, P1: 1, P2: 2 }[b.priority],
    )
    .slice(0, 30);

  const providerCloseoutPlan = buildProviderCloseoutPlan({
    sourceSync: args.sourceSync,
    institutionalRouter,
    uiProofStrip,
  });
  const surfaceHardWiring = buildSurfaceHardWiring(runtimeParity);
  const blockers = prioritizedActions.filter(
    (action) => action.state === "blocked",
  ).length;
  const watches = prioritizedActions.filter(
    (action) => action.state === "watch",
  ).length;
  const liveProviders = providerCloseoutPlan.filter(
    (provider) =>
      provider.status === "live" || provider.status === "configured",
  ).length;
  const plannedProviders = providerCloseoutPlan.filter(
    (provider) =>
      provider.status === "planned" || provider.status === "missing",
  ).length;
  const surfaceReady = surfaceHardWiring.filter(
    (surface) => surface.state === "ready",
  ).length;
  const state = worstState([
    blockers ? "blocked" : "ready",
    watches ? "watch" : "ready",
    surfaceReady < surfaceHardWiring.length ? "watch" : "ready",
  ]);
  const score = clamp(
    42 +
      surfaceReady * 4 +
      liveProviders * 3 -
      blockers * 5 -
      watches * 2 -
      plannedProviders,
  );

  return {
    version: "operator-action-queue-v1",
    state,
    score,
    query: args.query ?? args.sourceSync?.query,
    symbol: args.symbol ?? args.sourceSync?.symbol,
    canonicalEvidenceFingerprint: fingerprint,
    prioritizedActions,
    providerCloseoutPlan,
    surfaceHardWiring,
    hundredPercentChecklist: [
      "Every numeric field has provider + observedAt + max-age policy.",
      "Every Advanced conclusion has at least one primary provider and one methodology-compatible secondary lane.",
      "Browser preview, PDF preview and PDF download share the same canonicalEvidenceFingerprint.",
      "2Y/5Y/MAX charts show point count, gaps and overlay state before any regime language.",
      "VLM Brain right rail displays missing proof, confidence cap and tier value receipt.",
      "Angel follows source/methodology/provenance/risk-calibration order and never fills missing proof with prose.",
      "Planned institutional providers are visibly planned until adapter + key + timestamp are live.",
    ],
    worldClassSequence: [
      "P0: hard-wire Browser/PDF/Brain to runtime-parity and reject silent drift.",
      "P0: close provider timestamp gaps for price, volume, market cap, liquidity, TVL and chart fields.",
      "P1: add second overlay lanes for macro chart and liquidity/depth.",
      "P1: expose operator action queue in admin/operator console and customer-safe proof strip.",
      "P2: activate institutional providers only with explicit env keys, adapters and no-shortcut methodology rules.",
    ],
    noSilentGreenRule:
      "A surface may not show a green/ready state unless its provider chips, canonical fingerprint and missing-proof queue are visible to the user or operator.",
    generatedAt: new Date().toISOString(),
  };
}
