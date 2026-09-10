import { sha256Token } from "@/lib/security/cryptographic-digest";
import type { Pass2456SurfaceId } from "./runtime-parity-queue";
import type {
  Pass2458ProviderCloseoutRuntime,
  Pass2458ProviderRuntimeLane,
} from "./provider-closeout-runtime";
import type {
  VelmereSourceSyncLane,
  VelmereSourceSyncPacket,
} from "./source-sync-contract";
import type { Pass2453ReportEvidenceCapsule } from "./report-evidence-capsule";

type Pass2459SourceSyncPacket = VelmereSourceSyncPacket & {
  pass2453?: Pass2453ReportEvidenceCapsule;
  pass2458?: Pass2458ProviderCloseoutRuntime;
};

export type Pass2459FreshnessDriftState = "ready" | "watch" | "blocked";
export type Pass2459ProviderFreshnessStatus =
  | "fresh_live"
  | "stale_live"
  | "timestamp_missing"
  | "planned_not_live"
  | "mapping_missing"
  | "not_applicable";

export type Pass2459FreshnessLane = {
  provider: string;
  providerKey: string;
  status: Pass2459ProviderFreshnessStatus;
  observedAt?: string;
  maxAgeSeconds: number;
  ageSeconds?: number;
  driftSeverity: "none" | "P2" | "P1" | "P0";
  liveEvidenceFields: string[];
  lockedFields: string[];
  impactedSurfaces: Pass2456SurfaceId[];
  freshnessReceipt: string;
  nextAction: string;
  customerSafeCopy: string;
};

export type Pass2459SurfaceFreshnessContract = {
  surface: Pass2456SurfaceId;
  state: Pass2459FreshnessDriftState;
  requiredBeforeGreen: string[];
  currentLocks: string[];
  copyRule: string;
};

export type Pass2459SourceFreshnessDriftSentinel = {
  version: "source-freshness-drift-sentinel-v1";
  state: Pass2459FreshnessDriftState;
  score: number;
  query?: string;
  symbol?: string;
  range?: string;
  canonicalEvidenceFingerprint: string;
  freshnessFingerprint: string;
  lanes: Pass2459FreshnessLane[];
  surfaceContracts: Pass2459SurfaceFreshnessContract[];
  freshLiveCount: number;
  staleLiveCount: number;
  timestampMissingCount: number;
  plannedNotLiveCount: number;
  mappingMissingCount: number;
  p0DriftCount: number;
  hardLocks: string[];
  driftTraps: string[];
  hundredPercentUnlocks: string[];
  nextWorldClassSequence: string[];
  noSilentFreshnessRule: string;
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

function providerKey(value?: string) {
  const normalized = String(value ?? "").toLowerCase();
  if (normalized.includes("coingecko")) return "coingecko";
  if (normalized.includes("dex screener") || normalized.includes("dexscreener"))
    return "dexscreener";
  if (
    normalized.includes("geckoterminal") ||
    normalized.includes("gecko terminal")
  )
    return "geckoterminal";
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
  return `pass2459-${sha256Token(stableSerialize(input), 24)}`;
}

function ageSeconds(observedAt?: string) {
  if (!observedAt) return undefined;
  const parsed = Date.parse(observedAt);
  if (!Number.isFinite(parsed)) return undefined;
  return Math.max(0, Math.floor((Date.now() - parsed) / 1000));
}

function matchingSourceLane(
  runtimeLane: Pass2458ProviderRuntimeLane,
  sourceSync?: Pass2459SourceSyncPacket,
): VelmereSourceSyncLane | undefined {
  const key = runtimeLane.providerKey || providerKey(runtimeLane.provider);
  return sourceSync?.lanes.find(
    (lane) => providerKey(lane.label) === key || providerKey(lane.id) === key,
  );
}

function statusFromLane(
  runtimeLane: Pass2458ProviderRuntimeLane,
  age?: number,
): Pass2459ProviderFreshnessStatus {
  if (runtimeLane.status === "not_applicable") return "not_applicable";
  if (runtimeLane.status === "missing_key_or_mapping") return "mapping_missing";
  if (runtimeLane.status === "planned_needs_adapter") return "planned_not_live";
  if (runtimeLane.status === "configured_needs_timestamp")
    return "timestamp_missing";
  if (!runtimeLane.observedAt) return "timestamp_missing";
  if (age !== undefined && age > runtimeLane.maxAgeSeconds) return "stale_live";
  return "fresh_live";
}

function severity(
  status: Pass2459ProviderFreshnessStatus,
  surfaces: Pass2456SurfaceId[],
): Pass2459FreshnessLane["driftSeverity"] {
  if (status === "fresh_live" || status === "not_applicable") return "none";
  const touchesCustomerReport = surfaces.some(
    (surface) =>
      surface === "pdf_download" ||
      surface === "pdf_preview" ||
      surface === "browser_preview" ||
      surface === "vlm_brain",
  );
  if (
    status === "mapping_missing" ||
    (status === "stale_live" && touchesCustomerReport)
  )
    return "P0";
  if (status === "timestamp_missing" || status === "planned_not_live")
    return "P1";
  return "P2";
}

function buildFreshnessLane(
  runtimeLane: Pass2458ProviderRuntimeLane,
  sourceSync?: Pass2459SourceSyncPacket,
): Pass2459FreshnessLane {
  const activeLane = matchingSourceLane(runtimeLane, sourceSync);
  const observedAt = runtimeLane.observedAt ?? activeLane?.observedAt;
  const age = ageSeconds(observedAt);
  const status = statusFromLane({ ...runtimeLane, observedAt }, age);
  const driftSeverity = severity(status, runtimeLane.blocksSurfaces);
  const ageLabel =
    age === undefined
      ? "no age receipt"
      : `${age}s old / max ${runtimeLane.maxAgeSeconds}s`;
  const nextAction =
    status === "fresh_live"
      ? "Keep observedAt/max-age visible and reuse this same freshness receipt across Shield, Brain, Browser and PDF."
      : status === "stale_live"
        ? "Refresh provider adapter before any Advanced/report conclusion; show stale badge until new observedAt arrives."
        : status === "timestamp_missing"
          ? "Add observedAt and max-age receipt to this provider response; configured is not enough for green status."
          : status === "planned_not_live"
            ? "Finish adapter/key/mapping and keep this as an operator task, not customer proof."
            : status === "mapping_missing"
              ? "Add provider key or mapping before this lane can unlock any 100% field."
              : "Keep lane out of score unless the asset class requires it.";
  return {
    provider: runtimeLane.provider,
    providerKey: runtimeLane.providerKey,
    status,
    observedAt,
    maxAgeSeconds: runtimeLane.maxAgeSeconds,
    ageSeconds: age,
    driftSeverity,
    liveEvidenceFields: unique([
      ...(activeLane?.confirmedFields ?? []),
      ...runtimeLane.liveEvidenceFields,
    ]).slice(0, 12),
    lockedFields: unique([
      ...(activeLane?.missingFields ?? []),
      ...runtimeLane.lockedFields,
    ]).slice(0, 12),
    impactedSurfaces: runtimeLane.blocksSurfaces,
    freshnessReceipt:
      status === "fresh_live"
        ? `fresh · ${ageLabel}`
        : `${status.replace(/_/g, " ")} · ${ageLabel}`,
    nextAction,
    customerSafeCopy:
      status === "fresh_live"
        ? `${runtimeLane.provider} is fresh for its allowed methodology lane.`
        : `${runtimeLane.provider} cannot be treated as fresh proof yet; Velmère should show the missing freshness reason instead of smoothing it over.`,
  };
}

function contractForSurface(
  surface: Pass2456SurfaceId,
  lanes: Pass2459FreshnessLane[],
): Pass2459SurfaceFreshnessContract {
  const impacted = lanes.filter((lane) =>
    lane.impactedSurfaces.includes(surface),
  );
  const locks = unique(
    impacted.flatMap((lane) => [
      lane.status !== "fresh_live" &&
        lane.status !== "not_applicable" &&
        `${lane.provider}: ${lane.freshnessReceipt}`,
    ]),
  ).slice(0, 8);
  const p0 = impacted.some((lane) => lane.driftSeverity === "P0");
  const state: Pass2459FreshnessDriftState = p0
    ? "blocked"
    : locks.length
      ? "watch"
      : "ready";
  return {
    surface,
    state,
    requiredBeforeGreen: [
      "same canonicalEvidenceFingerprint",
      "provider observedAt visible",
      "provider max-age visible",
      "no planned provider displayed as live evidence",
      "freshness receipt appears before Advanced/report conclusion",
    ],
    currentLocks: locks,
    copyRule:
      state === "ready"
        ? "Surface can show fresh-proof copy for allowed fields only."
        : "Surface must show freshness lock and downgrade conclusion strength until receipts are current.",
  };
}

function stateFrom(
  lanes: Pass2459FreshnessLane[],
  p0: number,
): Pass2459FreshnessDriftState {
  if (p0 > 0 || lanes.some((lane) => lane.status === "mapping_missing"))
    return "blocked";
  if (
    lanes.some(
      (lane) =>
        lane.status === "stale_live" ||
        lane.status === "timestamp_missing" ||
        lane.status === "planned_not_live",
    )
  )
    return "watch";
  return "ready";
}

export function buildPass2459SourceFreshnessDriftSentinel(args: {
  query?: string;
  symbol?: string;
  range?: string;
  sourceSync?: Pass2459SourceSyncPacket;
  providerCloseoutRuntime?: Pass2458ProviderCloseoutRuntime;
}): Pass2459SourceFreshnessDriftSentinel {
  const providerCloseoutRuntime =
    args.providerCloseoutRuntime ?? args.sourceSync?.pass2458;
  const runtimeLanes = providerCloseoutRuntime?.runtimeLanes ?? [];
  const lanes = runtimeLanes.map((lane) =>
    buildFreshnessLane(lane, args.sourceSync),
  );
  const surfaceContracts = SURFACES.map((surface) =>
    contractForSurface(surface, lanes),
  );
  const freshLiveCount = lanes.filter(
    (lane) => lane.status === "fresh_live",
  ).length;
  const staleLiveCount = lanes.filter(
    (lane) => lane.status === "stale_live",
  ).length;
  const timestampMissingCount = lanes.filter(
    (lane) => lane.status === "timestamp_missing",
  ).length;
  const plannedNotLiveCount = lanes.filter(
    (lane) => lane.status === "planned_not_live",
  ).length;
  const mappingMissingCount = lanes.filter(
    (lane) => lane.status === "mapping_missing",
  ).length;
  const p0DriftCount =
    lanes.filter((lane) => lane.driftSeverity === "P0").length +
    surfaceContracts.filter((surface) => surface.state === "blocked").length;
  const state = stateFrom(lanes, p0DriftCount);
  const score = clamp(
    50 +
      freshLiveCount * 5 -
      staleLiveCount * 8 -
      timestampMissingCount * 4 -
      plannedNotLiveCount * 3 -
      mappingMissingCount * 8 -
      p0DriftCount * 3,
  );
  const hardLocks = unique([
    staleLiveCount > 0 &&
      `${staleLiveCount} live provider lane(s) are stale past max-age`,
    timestampMissingCount > 0 &&
      `${timestampMissingCount} configured/live lane(s) missing observedAt`,
    plannedNotLiveCount > 0 &&
      `${plannedNotLiveCount} planned lane(s) still need adapter/key before proof`,
    mappingMissingCount > 0 &&
      `${mappingMissingCount} lane(s) missing key/mapping`,
    p0DriftCount > 0 && `${p0DriftCount} P0 freshness/surface drift lock(s)`,
    !providerCloseoutRuntime?.canonicalEvidenceFingerprint &&
      "canonicalEvidenceFingerprint missing before freshness parity",
  ]).slice(0, 12);
  const canonicalEvidenceFingerprint =
    providerCloseoutRuntime?.canonicalEvidenceFingerprint ??
    args.sourceSync?.pass2453?.canonicalEvidenceFingerprint ??
    "missing-fingerprint";
  const freshnessFingerprint = smallHash({
    canonicalEvidenceFingerprint,
    lanes: lanes.map((lane) => ({
      provider: lane.providerKey,
      status: lane.status,
      observedAt: lane.observedAt,
      maxAgeSeconds: lane.maxAgeSeconds,
    })),
  });

  return {
    version: "source-freshness-drift-sentinel-v1",
    state,
    score,
    query:
      args.query ?? args.sourceSync?.query ?? providerCloseoutRuntime?.query,
    symbol:
      args.symbol ?? args.sourceSync?.symbol ?? providerCloseoutRuntime?.symbol,
    range: args.range,
    canonicalEvidenceFingerprint,
    freshnessFingerprint,
    lanes,
    surfaceContracts,
    freshLiveCount,
    staleLiveCount,
    timestampMissingCount,
    plannedNotLiveCount,
    mappingMissingCount,
    p0DriftCount,
    hardLocks,
    driftTraps: [
      "Same evidence fingerprint but different provider observedAt across Shield/PDF/Angel must be shown as drift.",
      "A 2Y/5Y/MAX chart without range-specific freshness receipt is macro context blocked, not Advanced proof.",
      "DefiLlama TVL freshness cannot prove price, holders, order-book depth or contract safety.",
      "GeckoTerminal pool OHLCV freshness cannot replace CoinGecko market cap/supply history.",
      "DEX Screener liquidity snapshot freshness cannot prove long-horizon regime without chart overlay continuity.",
    ],
    hundredPercentUnlocks: [
      "Every provider lane has status + observedAt/max-age before green UI copy.",
      "Every customer surface receives the same freshnessFingerprint and currentLocks list.",
      "Every stale/configured/planned provider becomes a visible operator action, not hidden prose.",
      "PDF preview/download hard-reject when freshness fingerprint drifts from Browser/VLM Brain.",
      "Advanced conclusions require fresh live lanes or explicit not-applicable boundaries.",
    ],
    nextWorldClassSequence: [
      "Wire PASS2459 freshnessFingerprint into Browser preview and PDF download payload headers.",
      "Persist per-provider observedAt snapshots so stale drift can be compared across sessions.",
      "Add operator filter: stale live, timestamp missing, planned not live, mapping missing.",
      "Add visual surface badges for Shield, Real Markets, VLM Brain, Browser, PDF and Angel.",
      "After freshness state is ready, start PASS2460 persistent snapshot diff and regression replay.",
    ],
    noSilentFreshnessRule:
      "A provider can be live but not fresh enough for Advanced. Green UI copy is allowed only when provider status, observedAt, max-age, methodology boundary and surface freshness contract are all visible.",
    generatedAt: new Date().toISOString(),
  };
}
