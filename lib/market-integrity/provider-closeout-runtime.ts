import type { Pass2456SurfaceId } from "./runtime-parity-queue";
import type {
  Pass2457OperatorAction,
  Pass2457OperatorActionQueue,
  Pass2457ProviderCloseout,
} from "./operator-action-queue";
import type {
  VelmereSourceSyncLane,
  VelmereSourceSyncPacket,
} from "./source-sync-contract";
import type { Pass2453ReportEvidenceCapsule } from "./report-evidence-capsule";

type Pass2458SourceSyncPacket = VelmereSourceSyncPacket & {
  pass2453?: Pass2453ReportEvidenceCapsule;
  pass2457?: Pass2457OperatorActionQueue;
};

export type Pass2458CloseoutState = "ready" | "watch" | "blocked";
export type Pass2458RuntimeProviderStatus =
  | "live_observed"
  | "configured_needs_timestamp"
  | "planned_needs_adapter"
  | "missing_key_or_mapping"
  | "not_applicable";

export type Pass2458ProviderRuntimeLane = {
  provider: string;
  providerKey: string;
  status: Pass2458RuntimeProviderStatus;
  role: string;
  liveEvidenceFields: string[];
  lockedFields: string[];
  requiredEnvKeys: string[];
  requiredEndpoint: string;
  observedAt?: string;
  maxAgeSeconds: number;
  methodologyBoundary: string;
  closeoutAction: string;
  blocksSurfaces: Pass2456SurfaceId[];
  unlocks100: string[];
};

export type Pass2458ActionReplayStep = {
  actionId: string;
  priority: Pass2457OperatorAction["priority"];
  beforeState: Pass2457OperatorAction["state"];
  provider: string;
  evidenceToUnlock: string[];
  targetEndpoints: string[];
  targetSurfaces: Pass2456SurfaceId[];
  doneWhen: string[];
  customerSafeResult: string;
};

export type Pass2458ProviderCloseoutRuntime = {
  version: "provider-closeout-runtime-v1";
  state: Pass2458CloseoutState;
  score: number;
  query?: string;
  symbol?: string;
  canonicalEvidenceFingerprint: string;
  runtimeLanes: Pass2458ProviderRuntimeLane[];
  actionReplay: Pass2458ActionReplayStep[];
  liveObservedCount: number;
  configuredNeedingTimestampCount: number;
  plannedNeedingAdapterCount: number;
  missingKeyOrMappingCount: number;
  p0BlockedCount: number;
  p1WatchCount: number;
  hardLocks: string[];
  runtimeStatusSummary: string[];
  hundredPercentUnlocks: string[];
  nextWorldClassSequence: string[];
  noShortcutRule: string;
  generatedAt: string;
};

const KNOWN_PROVIDER_RUNTIME: Record<
  string,
  {
    requiredEnvKeys: string[];
    requiredEndpoint: string;
    maxAgeSeconds: number;
    defaultSurfaces: Pass2456SurfaceId[];
    unlocks100: string[];
  }
> = {
  coingecko: {
    requiredEnvKeys: ["COINGECKO_DEMO_API_KEY or COINGECKO_PRO_API_KEY"],
    requiredEndpoint:
      "/api/market-integrity/chart + /api/market-integrity/source-sync",
    maxAgeSeconds: 180,
    defaultSurfaces: [
      "shield",
      "real_markets",
      "chart",
      "vlm_brain",
      "browser_preview",
      "pdf_preview",
      "pdf_download",
      "angel",
    ],
    unlocks100: [
      "price",
      "market cap",
      "volume",
      "2Y/5Y/MAX chart history",
      "market metadata",
    ],
  },
  dexscreener: {
    requiredEnvKeys: ["public API; optional cache key"],
    requiredEndpoint:
      "/api/market-integrity/source-sync + /api/market-integrity/chart-overlay",
    maxAgeSeconds: 120,
    defaultSurfaces: [
      "shield",
      "chart",
      "vlm_brain",
      "browser_preview",
      "pdf_preview",
      "pdf_download",
      "angel",
    ],
    unlocks100: [
      "DEX pair liquidity",
      "FDV",
      "pair volume",
      "pool address bridge to GeckoTerminal",
    ],
  },
  geckoterminal: {
    requiredEnvKeys: ["GECKOTERMINAL_API_KEY if rate-limited/pro plan is used"],
    requiredEndpoint:
      "/api/market-integrity/geckoterminal + /api/market-integrity/chart-overlay",
    maxAgeSeconds: 240,
    defaultSurfaces: [
      "chart",
      "vlm_brain",
      "browser_preview",
      "pdf_preview",
      "pdf_download",
      "angel",
    ],
    unlocks100: [
      "pool OHLCV",
      "DEX candle overlay",
      "pool-level continuity",
      "second DEX overlay",
    ],
  },
  binance: {
    requiredEnvKeys: [
      "public market data; optional BINANCE_API_KEY for higher limits",
    ],
    requiredEndpoint: "/api/market-integrity/klines + order-book depth adapter",
    maxAgeSeconds: 120,
    defaultSurfaces: [
      "shield",
      "chart",
      "vlm_brain",
      "browser_preview",
      "pdf_preview",
      "pdf_download",
      "angel",
    ],
    unlocks100: [
      "CEX OHLCV",
      "venue-specific depth",
      "spread/depth replay",
      "CEX second overlay",
    ],
  },
  defillama: {
    requiredEnvKeys: [
      "DEFILLAMA_PRO_API_KEY optional; public endpoints for supported lanes",
    ],
    requiredEndpoint:
      "/api/market-integrity/source-sync + DefiLlama expansion lanes",
    maxAgeSeconds: 600,
    defaultSurfaces: [
      "shield",
      "real_markets",
      "vlm_brain",
      "browser_preview",
      "pdf_preview",
      "pdf_download",
      "angel",
    ],
    unlocks100: [
      "TVL",
      "protocol category",
      "chain TVL",
      "fees/revenue/yields/stablecoin context when available",
    ],
  },
  bitquery: {
    requiredEnvKeys: ["BITQUERY_API_KEY"],
    requiredEndpoint: "planned: holder/transfer/pool event graph adapter",
    maxAgeSeconds: 900,
    defaultSurfaces: [
      "shield",
      "vlm_brain",
      "browser_preview",
      "pdf_preview",
      "pdf_download",
      "angel",
    ],
    unlocks100: [
      "holder graph",
      "transfer graph",
      "pool event replay",
      "wash-trade review signals",
    ],
  },
  l2beat: {
    requiredEnvKeys: ["L2BEAT_API_BASE or manual review source"],
    requiredEndpoint: "planned: L2 risk/security context adapter",
    maxAgeSeconds: 3600,
    defaultSurfaces: [
      "real_markets",
      "vlm_brain",
      "browser_preview",
      "pdf_preview",
      "pdf_download",
      "angel",
    ],
    unlocks100: [
      "L2 TVS vs DeFi TVL separation",
      "bridge/security assumptions",
      "rollup risk context",
    ],
  },
  "token terminal": {
    requiredEnvKeys: ["TOKEN_TERMINAL_API_KEY"],
    requiredEndpoint: "planned: fundamentals metrics adapter",
    maxAgeSeconds: 3600,
    defaultSurfaces: [
      "real_markets",
      "vlm_brain",
      "browser_preview",
      "pdf_preview",
      "pdf_download",
      "angel",
    ],
    unlocks100: ["fees", "revenue", "active users", "financial comparables"],
  },
  artemis: {
    requiredEnvKeys: ["ARTEMIS_API_KEY"],
    requiredEndpoint: "planned: user/activity/fundamentals adapter",
    maxAgeSeconds: 3600,
    defaultSurfaces: [
      "real_markets",
      "vlm_brain",
      "browser_preview",
      "pdf_preview",
      "pdf_download",
      "angel",
    ],
    unlocks100: [
      "active addresses/users",
      "chain/protocol activity",
      "fundamentals overlay",
    ],
  },
  "coin metrics": {
    requiredEnvKeys: ["COIN_METRICS_API_KEY"],
    requiredEndpoint: "planned: institutional asset/network metrics adapter",
    maxAgeSeconds: 900,
    defaultSurfaces: [
      "shield",
      "real_markets",
      "chart",
      "vlm_brain",
      "browser_preview",
      "pdf_preview",
      "pdf_download",
      "angel",
    ],
    unlocks100: [
      "reference market metrics",
      "network metrics",
      "supply disagreement review",
    ],
  },
  kaiko: {
    requiredEnvKeys: ["KAIKO_API_KEY"],
    requiredEndpoint: "planned: exchange order-book/depth adapter",
    maxAgeSeconds: 120,
    defaultSurfaces: [
      "chart",
      "vlm_brain",
      "browser_preview",
      "pdf_preview",
      "pdf_download",
      "angel",
    ],
    unlocks100: [
      "order-book depth",
      "spread",
      "slippage",
      "venue liquidity shock context",
    ],
  },
  messari: {
    requiredEnvKeys: ["MESSARI_API_KEY"],
    requiredEndpoint: "planned: asset/market/on-chain/news/unlocks adapter",
    maxAgeSeconds: 900,
    defaultSurfaces: [
      "real_markets",
      "vlm_brain",
      "browser_preview",
      "pdf_preview",
      "pdf_download",
      "angel",
    ],
    unlocks100: [
      "market/on-chain data",
      "news/research context",
      "token unlocks",
      "stablecoin/protocol overlays",
    ],
  },
  "the graph": {
    requiredEnvKeys: ["THE_GRAPH_API_KEY or subgraph endpoint allowlist"],
    requiredEndpoint: "planned: protocol-specific subgraph adapter",
    maxAgeSeconds: 900,
    defaultSurfaces: [
      "shield",
      "vlm_brain",
      "browser_preview",
      "pdf_preview",
      "pdf_download",
      "angel",
    ],
    unlocks100: [
      "protocol event history",
      "pool events",
      "governance/on-chain context",
    ],
  },
};

function unique(items: Array<string | false | null | undefined>) {
  return Array.from(new Set(items.filter(Boolean) as string[]));
}

function clamp(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function providerKey(value: string) {
  const normalized = value.toLowerCase();
  if (normalized.includes("coingecko")) return "coingecko";
  if (normalized.includes("dex screener")) return "dexscreener";
  if (normalized.includes("geckoterminal")) return "geckoterminal";
  if (normalized.includes("binance")) return "binance";
  if (normalized.includes("defillama")) return "defillama";
  if (normalized.includes("bitquery")) return "bitquery";
  if (normalized.includes("l2beat")) return "l2beat";
  if (normalized.includes("token terminal")) return "token terminal";
  if (normalized.includes("artemis")) return "artemis";
  if (normalized.includes("coin metrics")) return "coin metrics";
  if (normalized.includes("kaiko")) return "kaiko";
  if (normalized.includes("messari")) return "messari";
  if (normalized.includes("the graph")) return "the graph";
  return (
    normalized.replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") ||
    "unknown-provider"
  );
}

function statusFromCloseout(
  closeout: Pass2457ProviderCloseout,
  lane?: VelmereSourceSyncLane,
): Pass2458RuntimeProviderStatus {
  if (lane?.state === "not_applicable") return "not_applicable";
  if (
    (closeout.status === "live" || lane?.state === "confirmed") &&
    (lane?.observedAt || closeout.status === "live")
  ) {
    return lane?.observedAt ? "live_observed" : "configured_needs_timestamp";
  }
  if (
    closeout.status === "configured" ||
    lane?.state === "partial" ||
    lane?.state === "degraded"
  )
    return "configured_needs_timestamp";
  if (closeout.status === "planned") return "planned_needs_adapter";
  return "missing_key_or_mapping";
}

function buildLane(
  closeout: Pass2457ProviderCloseout,
  sourceSync?: Pass2458SourceSyncPacket,
): Pass2458ProviderRuntimeLane {
  const key = providerKey(closeout.provider);
  const activeLane = sourceSync?.lanes.find(
    (lane) => providerKey(lane.label) === key || providerKey(lane.id) === key,
  );
  const known = KNOWN_PROVIDER_RUNTIME[key] ?? {
    requiredEnvKeys: ["provider-specific key or public adapter mapping"],
    requiredEndpoint: "provider-specific adapter endpoint",
    maxAgeSeconds: 900,
    defaultSurfaces: [
      "vlm_brain",
      "browser_preview",
      "pdf_preview",
      "pdf_download",
      "angel",
    ] as Pass2456SurfaceId[],
    unlocks100: closeout.evidenceUnlocked,
  };
  const status = statusFromCloseout(closeout, activeLane);
  const lockedFields = unique([
    ...closeout.evidenceUnlocked.filter(
      (field) =>
        !activeLane?.confirmedFields.some((confirmed) =>
          confirmed
            .toLowerCase()
            .includes(field.toLowerCase().split(" ")[0] ?? field.toLowerCase()),
        ),
    ),
    ...(activeLane?.missingFields ?? []),
  ]).slice(0, 10);
  return {
    provider: closeout.provider,
    providerKey: key,
    status,
    role: activeLane?.scope ?? closeout.role,
    liveEvidenceFields: unique([
      ...(activeLane?.confirmedFields ?? []),
      ...closeout.evidenceUnlocked.filter(() => status === "live_observed"),
    ]).slice(0, 10),
    lockedFields,
    requiredEnvKeys: known.requiredEnvKeys,
    requiredEndpoint: known.requiredEndpoint,
    observedAt: activeLane?.observedAt,
    maxAgeSeconds: known.maxAgeSeconds,
    methodologyBoundary: activeLane?.boundary ?? closeout.forbiddenShortcut,
    closeoutAction:
      status === "live_observed"
        ? "Keep observedAt, max-age and surface fingerprint visible; do not overstate beyond methodology boundary."
        : closeout.closeoutAction,
    blocksSurfaces: known.defaultSurfaces,
    unlocks100: unique([
      ...known.unlocks100,
      ...closeout.evidenceUnlocked,
    ]).slice(0, 12),
  };
}

function buildActionReplay(
  action: Pass2457OperatorAction,
): Pass2458ActionReplayStep {
  const targetEndpoints = unique([
    action.kind === "chart_expansion" && "/api/market-integrity/chart",
    action.kind === "chart_expansion" && "/api/market-integrity/chart-overlay",
    action.kind === "pdf_parity" && "/api/market-integrity/report-evidence",
    action.kind === "pdf_parity" && "/api/market-integrity/runtime-parity",
    action.kind === "browser_preview" &&
      "/api/market-integrity/report-evidence",
    action.kind === "vlm_brain_rail" && "/api/market-integrity/tier-proof",
    action.kind === "provider_adapter" &&
      "/api/market-integrity/provider-closeout-runtime",
    action.kind === "provider_key" &&
      "/api/market-integrity/provider-closeout-runtime",
    action.kind === "second_overlay" && "/api/market-integrity/chart-overlay",
    action.kind === "angel_guard" && "/api/angel",
    action.kind === "qa_replay" &&
      "/api/market-integrity/provider-closeout-runtime",
    "/api/market-integrity/source-sync",
  ]).slice(0, 6);
  return {
    actionId: action.id,
    priority: action.priority,
    beforeState: action.state,
    provider: action.requiredProvider ?? "provider/methodology runtime",
    evidenceToUnlock: action.unlocks,
    targetEndpoints,
    targetSurfaces: action.linkedSurfaces,
    doneWhen: unique([
      ...action.acceptanceCriteria,
      "provider-closeout-runtime changes from missing/planned/configured to live_observed or documented watch",
      "action replay is visible in operator rail and customer-safe missing proof copy",
    ]).slice(0, 8),
    customerSafeResult: action.safeCustomerCopy,
  };
}

function stateFrom(
  statuses: Pass2458RuntimeProviderStatus[],
  p0: number,
): Pass2458CloseoutState {
  if (p0 > 0 || statuses.includes("missing_key_or_mapping")) return "blocked";
  if (
    statuses.includes("planned_needs_adapter") ||
    statuses.includes("configured_needs_timestamp")
  )
    return "watch";
  return "ready";
}

export function buildPass2458ProviderCloseoutRuntime(args: {
  query?: string;
  symbol?: string;
  sourceSync?: Pass2458SourceSyncPacket;
  operatorActionQueue?: Pass2457OperatorActionQueue;
}): Pass2458ProviderCloseoutRuntime {
  const operatorActionQueue =
    args.operatorActionQueue ?? args.sourceSync?.pass2457;
  const closeouts = operatorActionQueue?.providerCloseoutPlan ?? [];
  const runtimeLanes = closeouts.map((closeout) =>
    buildLane(closeout, args.sourceSync),
  );
  const actionReplay = (operatorActionQueue?.prioritizedActions ?? [])
    .slice(0, 18)
    .map(buildActionReplay);
  const liveObservedCount = runtimeLanes.filter(
    (lane) => lane.status === "live_observed",
  ).length;
  const configuredNeedingTimestampCount = runtimeLanes.filter(
    (lane) => lane.status === "configured_needs_timestamp",
  ).length;
  const plannedNeedingAdapterCount = runtimeLanes.filter(
    (lane) => lane.status === "planned_needs_adapter",
  ).length;
  const missingKeyOrMappingCount = runtimeLanes.filter(
    (lane) => lane.status === "missing_key_or_mapping",
  ).length;
  const p0BlockedCount = actionReplay.filter(
    (action) => action.priority === "P0" && action.beforeState === "blocked",
  ).length;
  const p1WatchCount = actionReplay.filter(
    (action) => action.priority === "P1",
  ).length;
  const statuses = runtimeLanes.map((lane) => lane.status);
  const state = stateFrom(statuses, p0BlockedCount);
  const score = clamp(
    44 +
      liveObservedCount * 5 +
      configuredNeedingTimestampCount * 2 -
      plannedNeedingAdapterCount * 2 -
      missingKeyOrMappingCount * 4 -
      p0BlockedCount * 5 -
      p1WatchCount,
  );
  const hardLocks = unique([
    p0BlockedCount > 0 &&
      `${p0BlockedCount} P0 operator action(s) still block world-class closeout`,
    configuredNeedingTimestampCount > 0 &&
      `${configuredNeedingTimestampCount} provider lane(s) need observedAt/max-age receipts`,
    plannedNeedingAdapterCount > 0 &&
      `${plannedNeedingAdapterCount} institutional lane(s) are planned, not proof`,
    missingKeyOrMappingCount > 0 &&
      `${missingKeyOrMappingCount} provider lane(s) need key/adapter/mapping`,
    !operatorActionQueue?.canonicalEvidenceFingerprint &&
      "canonicalEvidenceFingerprint missing",
  ]);

  return {
    version: "provider-closeout-runtime-v1",
    state,
    score,
    query: args.query ?? args.sourceSync?.query,
    symbol: args.symbol ?? args.sourceSync?.symbol,
    canonicalEvidenceFingerprint:
      operatorActionQueue?.canonicalEvidenceFingerprint ??
      args.sourceSync?.pass2453?.canonicalEvidenceFingerprint ??
      "missing-fingerprint",
    runtimeLanes,
    actionReplay,
    liveObservedCount,
    configuredNeedingTimestampCount,
    plannedNeedingAdapterCount,
    missingKeyOrMappingCount,
    p0BlockedCount,
    p1WatchCount,
    hardLocks,
    runtimeStatusSummary: [
      `${liveObservedCount} live observed lane(s)`,
      `${configuredNeedingTimestampCount} configured lane(s) still need timestamp/max-age`,
      `${plannedNeedingAdapterCount} planned lane(s) still need adapter/key`,
      `${p0BlockedCount} P0 action replay blocker(s)`,
    ],
    hundredPercentUnlocks: [
      "Every provider closeout has live/configured/planned/missing state with no silent green.",
      "Every provider lane lists env key, endpoint, max-age, observedAt and methodology boundary.",
      "Every P0/P1 action maps to target endpoints, surfaces and done-when criteria.",
      "Browser/PDF/VLM Brain/Angel can replay action -> evidence unlocked -> surface updated.",
      "Institutional sources remain planned until their adapter, key and observedAt are present.",
    ],
    nextWorldClassSequence: [
      "Wire PASS2458 actionReplay into Browser Preview and PDF preview/download rails.",
      "Add keyed live adapters one-by-one: CoinGecko range, GeckoTerminal pool, DefiLlama expanded lanes, then Bitquery/L2BEAT/Token Terminal/Kaiko/Messari as budget allows.",
      "Add QA replay endpoint that compares before/after provider closeout for the same query.",
      "Add operator console filter: P0 only, provider key needed, adapter needed, surface drift, chart macro lock.",
      "After closeout state reaches ready, start polish pass for micro-copy, mobile layout and report readability.",
    ],
    noShortcutRule:
      "Provider closeout is runtime evidence only when adapter/key/mapping/observedAt/max-age are present; planned or configured lanes must remain visible tasks, never hidden proof.",
    generatedAt: new Date().toISOString(),
  };
}
