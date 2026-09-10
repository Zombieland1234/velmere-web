import type { VlmAssetDetailModalData } from "./contract";
import {
  timeframeConfig,
  type RemoteCandleSet,
  type VlmAssetTimeframe,
} from "./chart-model";
import {
  buildPass4408AssetDetailChartFetchUrl,
  formatPass4408RemoteTime,
  normalizePass4408ApiCandles,
} from "../../../lib/market-integrity/asset-detail-client-helpers";
import { AssetDetailRequestError, fetchAssetDetailJson } from "./network";
import { hasServerVerifiedKlineLiveGate } from "../live-truth";

type AssetDetailChartPayload = {
  mode?: "live_verified" | "live_partial" | "last_known_good" | "local_reference" | "conflict" | "live" | "stale" | "error";
  error?: string;
  source?: string;
  generatedAt?: string;
  freshness?: "source_timestamped" | "partial_not_live" | "last_known_good" | "local_reference_not_live" | "withheld" | "live";
  staleAgeMs?: number;
  snapshotReadMode?: "memory" | "supabase";
  providerErrors?: string[];
  verification?: {
    state?: "single_source" | "corroborated" | "divergence_warning" | "last_known_good";
    providerCount?: number;
    latestCloseSpreadPct?: number | null;
  };
  delivery?: {
    state?: "live_verified" | "live_partial" | "conflict";
    withholdCandles?: boolean;
    exactIdentity?: boolean;
    independentProviderCount?: number;
    goodProviderCount?: number;
    freshProviderCount?: number;
    blockers?: string[];
  };
  candles?: unknown;
  quotes?: Array<{
    candles?: unknown;
    source?: string;
    sourceTimestamp?: number | string | null;
  }>;
};

function verificationLabel(payload: AssetDetailChartPayload) {
  const staleMinutes = typeof payload.staleAgeMs === "number" && Number.isFinite(payload.staleAgeMs)
    ? Math.max(1, Math.round(payload.staleAgeMs / 60_000))
    : null;
  if (payload.freshness === "last_known_good") {
    return `${payload.snapshotReadMode === "supabase" ? "durable" : "memory"} last-known-good${staleMinutes ? ` · ${staleMinutes}m old` : ""}`;
  }
  if (payload.verification?.state === "corroborated") {
    return `${payload.verification.providerCount ?? 2} providers verified`;
  }
  if (payload.verification?.state === "divergence_warning") {
    return `provider spread ${payload.verification.latestCloseSpreadPct ?? "?"}%`;
  }
  if (payload.verification?.state === "single_source") return "single verified provider";
  return null;
}

export async function fetchVerifiedAssetDetailCandles(args: {
  data: VlmAssetDetailModalData;
  timeframe: VlmAssetTimeframe;
  signal?: AbortSignal;
}): Promise<RemoteCandleSet> {
  const config = timeframeConfig(args.timeframe);
  const rawUrl = buildPass4408AssetDetailChartFetchUrl(args.data, config);
  const url = rawUrl.includes("?") ? `${rawUrl}&live=true` : `${rawUrl}?live=true`;
  const { response, payload, contentType } = await fetchAssetDetailJson<AssetDetailChartPayload>(
    url,
    { cache: "no-store", headers: { "x-velmere-live": "true" } },
    { signal: args.signal },
  );

  if (!payload) {
    throw new AssetDetailRequestError(
      contentType ? "chart_fetch_non_json" : "chart_fetch_empty_response",
      response.status,
    );
  }
  if (!response.ok || payload.mode === "error") {
    throw new AssetDetailRequestError(payload.error || `chart_fetch_${response.status}`, response.status);
  }

  if (payload.mode === "conflict") {
    throw new AssetDetailRequestError("chart_provider_conflict", response.status);
  }

  const quote = payload.quotes?.[0];
  const candles = normalizePass4408ApiCandles(quote?.candles ?? payload.candles);
  if (candles.length < 8) throw new AssetDetailRequestError("chart_fetch_sparse", response.status);

  const liveVerified = hasServerVerifiedKlineLiveGate(payload);
  const freshness = payload.mode === "local_reference" || payload.freshness === "local_reference_not_live"
    ? "local_reference" as const
    : payload.mode === "last_known_good" || payload.freshness === "last_known_good"
      ? "last_known_good" as const
      : liveVerified
        ? "live_verified" as const
        : "partial_not_live" as const;

  return {
    candles,
    sourceLabel: quote?.source ?? payload.source ?? args.data.sourceLabel ?? null,
    sourceTimeLabel: formatPass4408RemoteTime(quote?.sourceTimestamp) ?? payload.generatedAt ?? args.data.sourceTimeLabel ?? null,
    verificationLabel: verificationLabel(payload),
    freshness,
    liveVerified,
    snapshotReadMode: payload.snapshotReadMode ?? null,
    staleAgeMs: typeof payload.staleAgeMs === "number" ? payload.staleAgeMs : null,
  };
}
