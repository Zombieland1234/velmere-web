export type Pass612SourceState =
  | "live"
  | "partial"
  | "stale"
  | "fallback"
  | "offline";

export type Pass612TimestampKind = "provider" | "route" | "static" | "none";

export type Pass612SourceLayerInput = {
  id: string;
  label: string;
  provider?: string | null;
  backupProvider?: string | null;
  requestedState?: Pass612SourceState | null;
  observedAt?: string | number | null;
  timestampKind?: Pass612TimestampKind;
  recordCount?: number | null;
  expectedRecords?: number | null;
  loading?: boolean;
  error?: string | null;
  hasFallback?: boolean;
  detail?: string | null;
  freshnessBudgetSeconds?: number;
  required?: boolean;
};

export type Pass612SourceLayer = {
  id: string;
  label: string;
  provider: string;
  backupProvider: string | null;
  state: Pass612SourceState;
  observedAt: string | null;
  timestampKind: Pass612TimestampKind;
  ageSeconds: number | null;
  freshnessBudgetSeconds: number;
  coveragePercent: number;
  confidenceCap: number;
  detail: string;
  required: boolean;
  reason:
    | "provider_fresh"
    | "route_timestamp_only"
    | "insufficient_history"
    | "freshness_expired"
    | "fallback_active"
    | "loading_with_evidence"
    | "source_unavailable";
};

export type Pass612OneSourceStateContract = {
  version: "one-source-state-contract";
  generatedAt: string;
  aggregateState: Pass612SourceState;
  confidenceCap: number;
  layers: Pass612SourceLayer[];
  counts: Record<Pass612SourceState, number>;
  readyCount: number;
  totalCount: number;
  boundary: string;
};

const DEFAULT_BUDGET_SECONDS = 15 * 60;
const STATE_CAP: Record<Pass612SourceState, number> = {
  live: 92,
  partial: 72,
  stale: 56,
  fallback: 44,
  offline: 18,
};
const STATE_WEIGHT: Record<Pass612SourceState, number> = {
  live: 0,
  partial: 1,
  stale: 2,
  fallback: 3,
  offline: 4,
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function iso(value: string | number | null | undefined): string | null {
  if (value === null || value === undefined || value === "") return null;
  const timestamp = typeof value === "number" ? value : Date.parse(value);
  if (!Number.isFinite(timestamp)) return null;
  const normalized = timestamp < 10_000_000_000 ? timestamp * 1000 : timestamp;
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function normalizedCoverage(recordCount?: number | null, expectedRecords?: number | null) {
  if (!Number.isFinite(recordCount) || !recordCount || recordCount <= 0) return 0;
  if (!Number.isFinite(expectedRecords) || !expectedRecords || expectedRecords <= 0)
    return 100;
  return Math.round(clamp((recordCount / expectedRecords) * 100, 0, 100));
}

function resolveLayer(
  input: Pass612SourceLayerInput,
  nowMs: number,
): Pass612SourceLayer {
  const freshnessBudgetSeconds = Math.max(
    30,
    Math.round(input.freshnessBudgetSeconds ?? DEFAULT_BUDGET_SECONDS),
  );
  const observedAt = iso(input.observedAt);
  const timestampKind = input.timestampKind ?? (observedAt ? "route" : "none");
  const ageSeconds = observedAt
    ? Math.max(0, Math.round((nowMs - Date.parse(observedAt)) / 1000))
    : null;
  const coveragePercent = normalizedCoverage(
    input.recordCount,
    input.expectedRecords,
  );

  let state: Pass612SourceState;
  let reason: Pass612SourceLayer["reason"];

  if (input.loading && (coveragePercent > 0 || observedAt)) {
    state = "partial";
    reason = "loading_with_evidence";
  } else if (input.error && input.hasFallback) {
    state = "fallback";
    reason = "fallback_active";
  } else if (input.error) {
    state = "offline";
    reason = "source_unavailable";
  } else if (!observedAt && !input.provider && coveragePercent === 0) {
    state = input.hasFallback ? "fallback" : "offline";
    reason = input.hasFallback ? "fallback_active" : "source_unavailable";
  } else if (ageSeconds !== null && ageSeconds > freshnessBudgetSeconds) {
    state = "stale";
    reason = "freshness_expired";
  } else if (
    coveragePercent > 0 &&
    coveragePercent < 75 &&
    input.expectedRecords !== null &&
    input.expectedRecords !== undefined
  ) {
    state = "partial";
    reason = "insufficient_history";
  } else if (timestampKind !== "provider" && timestampKind !== "static") {
    state = input.requestedState === "fallback" ? "fallback" : "partial";
    reason = state === "fallback" ? "fallback_active" : "route_timestamp_only";
  } else {
    state = input.requestedState ?? "live";
    if (state === "live") reason = "provider_fresh";
    else if (state === "stale") reason = "freshness_expired";
    else if (state === "fallback") reason = "fallback_active";
    else if (state === "offline") reason = "source_unavailable";
    else reason = "insufficient_history";
  }

  const coveragePenalty = coveragePercent >= 90 ? 0 : coveragePercent >= 60 ? 6 : 12;
  const timestampPenalty = timestampKind === "provider" || timestampKind === "static" ? 0 : 8;
  const confidenceCap = clamp(
    STATE_CAP[state] - coveragePenalty - timestampPenalty,
    0,
    100,
  );

  return {
    id: input.id,
    label: input.label,
    provider: input.provider?.trim() || "source unavailable",
    backupProvider: input.backupProvider?.trim() || null,
    state,
    observedAt,
    timestampKind,
    ageSeconds,
    freshnessBudgetSeconds,
    coveragePercent,
    confidenceCap,
    detail: input.detail?.trim() || "No additional source detail.",
    required: input.required !== false,
    reason,
  };
}

export function buildPass612OneSourceStateContract(input: {
  generatedAt?: string | number;
  now?: string | number;
  layers: Pass612SourceLayerInput[];
}): Pass612OneSourceStateContract {
  const nowIso = iso(input.now ?? input.generatedAt ?? Date.now()) ?? new Date().toISOString();
  const nowMs = Date.parse(nowIso);
  const layers = input.layers.map((layer) => resolveLayer(layer, nowMs));
  const counts: Record<Pass612SourceState, number> = {
    live: 0,
    partial: 0,
    stale: 0,
    fallback: 0,
    offline: 0,
  };
  for (const layer of layers) counts[layer.state] += 1;
  const requiredLayers = layers.filter((layer) => layer.required);
  const scoredLayers = requiredLayers.length ? requiredLayers : layers;
  const aggregateState = scoredLayers.length
    ? scoredLayers.reduce((worst, layer) =>
        STATE_WEIGHT[layer.state] > STATE_WEIGHT[worst] ? layer.state : worst,
      "live" as Pass612SourceState)
    : "offline";
  const confidenceCap = scoredLayers.length
    ? Math.min(...scoredLayers.map((layer) => layer.confidenceCap))
    : 0;
  const readyCount = layers.filter(
    (layer) => layer.state === "live" || layer.state === "partial",
  ).length;

  return {
    version: "one-source-state-contract",
    generatedAt: nowIso,
    aggregateState,
    confidenceCap,
    layers,
    counts,
    readyCount,
    totalCount: layers.length,
    boundary:
      "The same live, partial, stale, fallback or offline state must travel with a source across the table, chart, modal, AI analysis and PDF. A route timestamp never upgrades evidence to provider-live.",
  };
}
