import {
  marketIntegritySourceFreshnessRules,
  type MarketIntegritySourceLane,
  type SourceAdapterMode,
} from "./live-source-adapter-contract";

export type SourceAdapterCacheDecision = "fresh" | "stale" | "expired" | "missing";

export type SourceAdapterEnvelope<TPayload = Record<string, unknown>> = {
  lane: MarketIntegritySourceLane;
  adapterId: string;
  mode: SourceAdapterMode;
  receivedAt: string;
  expiresAt: string;
  staleAt: string;
  ttlSeconds: number;
  staleAfterSeconds: number;
  payload: TPayload;
  redactedPayload: Record<string, unknown>;
  cacheDecision: SourceAdapterCacheDecision;
  storageWritePerformed: false;
  productionBoundary: string;
};

export type SourceAdapterPreviewInput = {
  lane: MarketIntegritySourceLane;
  adapterId?: string;
  receivedAt?: string;
  payload?: Record<string, unknown>;
  mode?: SourceAdapterMode;
};

const allowedPayloadKeys = new Set([
  "price",
  "volume24h",
  "marketCap",
  "rank",
  "candles",
  "spreadPercent",
  "bidDepthUsd",
  "askDepthUsd",
  "holderCount",
  "top10HolderPercent",
  "chainId",
  "tokenAddress",
  "owner",
  "proxy",
  "mint",
  "pause",
  "blacklist",
  "tax",
  "unlockDate",
  "sourceUrl",
  "sourceTitle",
  "confidence",
]);

const blockedPayloadKeyPattern = /token|secret|seed|phrase|private|password|authorization|signature|bearer|cookie|email/i;

function isoAddSeconds(iso: string, seconds: number) {
  return new Date(new Date(iso).getTime() + seconds * 1000).toISOString();
}

export function redactSourcePayload(payload: Record<string, unknown> = {}) {
  const safe: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(payload)) {
    if (!allowedPayloadKeys.has(key)) continue;
    if (blockedPayloadKeyPattern.test(key)) continue;

    if (typeof value === "string") {
      safe[key] = value
        .replace(/0x[a-fA-F0-9]{16,}/g, "0x…redacted")
        .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "email:redacted")
        .slice(0, 220);
      continue;
    }

    if (typeof value === "number" && Number.isFinite(value)) {
      safe[key] = value;
      continue;
    }

    if (typeof value === "boolean") {
      safe[key] = value;
      continue;
    }

    if (Array.isArray(value)) {
      safe[key] = value.slice(0, 80).map((entry) => {
        if (typeof entry === "number" || typeof entry === "boolean") return entry;
        if (typeof entry === "string") return entry.slice(0, 120);
        if (entry && typeof entry === "object") return "[object:redacted]";
        return null;
      });
    }
  }
  return safe;
}

export function getSourceFreshnessRule(lane: MarketIntegritySourceLane) {
  return marketIntegritySourceFreshnessRules.find((rule) => rule.lane === lane) ?? marketIntegritySourceFreshnessRules[0];
}

export function getSourceCacheDecision(receivedAtIso?: string, now = new Date()): SourceAdapterCacheDecision {
  if (!receivedAtIso) return "missing";
  const receivedAt = new Date(receivedAtIso).getTime();
  if (!Number.isFinite(receivedAt)) return "missing";
  const laneAgeSeconds = Math.max(0, Math.floor((now.getTime() - receivedAt) / 1000));
  if (laneAgeSeconds <= 300) return "fresh";
  if (laneAgeSeconds <= 1800) return "stale";
  return "expired";
}

export function createSourceAdapterEnvelope<TPayload extends Record<string, unknown> = Record<string, unknown>>(
  input: SourceAdapterPreviewInput,
): SourceAdapterEnvelope<TPayload> {
  const rule = getSourceFreshnessRule(input.lane);
  const receivedAt = input.receivedAt ?? new Date().toISOString();
  const redactedPayload = redactSourcePayload(input.payload ?? {});
  const cacheDecision = getSourceCacheDecision(receivedAt);
  const mode = input.mode ?? (cacheDecision === "expired" || cacheDecision === "missing" ? "fallback" : "partial");

  return {
    lane: input.lane,
    adapterId: input.adapterId ?? `velmere-${input.lane}-adapter-preview`,
    mode,
    receivedAt,
    expiresAt: isoAddSeconds(receivedAt, rule.targetTtlSeconds),
    staleAt: isoAddSeconds(receivedAt, rule.staleAfterSeconds),
    ttlSeconds: rule.targetTtlSeconds,
    staleAfterSeconds: rule.staleAfterSeconds,
    payload: (input.payload ?? {}) as TPayload,
    redactedPayload,
    cacheDecision,
    storageWritePerformed: false,
    productionBoundary:
      "Preview envelope only. Production source snapshots require a server adapter, durable storage, source id, timestamp and review-safe wording.",
  };
}

export function createDemoSourceSnapshotBundle(now = new Date()) {
  const receivedAt = now.toISOString();
  const olderReceivedAt = new Date(now.getTime() - 1000 * 60 * 42).toISOString();

  return {
    schemaVersion: "velmere-market-integrity-source-bundle-v1",
    mode: "preview_only",
    generatedAt: receivedAt,
    storageWritePerformed: false,
    snapshots: [
      createSourceAdapterEnvelope({
        lane: "market",
        adapterId: "preview-market-table",
        receivedAt,
        mode: "partial",
        payload: { price: 66769, volume24h: 57080000000, marketCap: 1340000000000, rank: 1, confidence: 63 },
      }),
      createSourceAdapterEnvelope({
        lane: "candles",
        adapterId: "preview-candle-provider",
        receivedAt,
        mode: "partial",
        payload: { candles: 104, sourceTitle: "preview OHLCV", confidence: 58 },
      }),
      createSourceAdapterEnvelope({
        lane: "orderbook",
        adapterId: "preview-orderbook-missing",
        receivedAt: olderReceivedAt,
        mode: "missing",
        payload: { confidence: 0 },
      }),
      createSourceAdapterEnvelope({
        lane: "holders",
        adapterId: "preview-holder-missing",
        receivedAt: olderReceivedAt,
        mode: "missing",
        payload: { confidence: 0 },
      }),
      createSourceAdapterEnvelope({
        lane: "contract",
        adapterId: "preview-contract-missing",
        receivedAt: olderReceivedAt,
        mode: "missing",
        payload: { confidence: 0 },
      }),
      createSourceAdapterEnvelope({
        lane: "osint",
        adapterId: "preview-osint-blocked",
        receivedAt: olderReceivedAt,
        mode: "blocked",
        payload: { sourceTitle: "manual review required", confidence: 0 },
      }),
    ],
    productionBoundary:
      "Diagnostic bundle only. Missing/fallback lanes must stay visible and cannot be treated as verified evidence.",
  };
}

export function summarizeSourceSnapshotBundle(bundle = createDemoSourceSnapshotBundle()) {
  const snapshots = bundle.snapshots;
  const freshOrPartial = snapshots.filter((snapshot) => snapshot.mode === "live" || snapshot.mode === "partial").length;
  const blockedOrMissing = snapshots.filter((snapshot) => snapshot.mode === "blocked" || snapshot.mode === "missing").length;
  const expired = snapshots.filter((snapshot) => snapshot.cacheDecision === "expired").length;

  return {
    total: snapshots.length,
    freshOrPartial,
    blockedOrMissing,
    expired,
    storageWritePerformed: false,
    nextCriticalStep:
      snapshots.find((snapshot) => snapshot.mode === "missing" || snapshot.mode === "blocked")?.lane ??
      "monitor",
  };
}
