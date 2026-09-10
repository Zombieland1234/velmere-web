import { createHash } from "node:crypto";
import type { TokenRiskResult } from "./risk-types";
import { normalizePass2466DerivativesPair } from "./derivatives-squeeze-proof";
import { buildPass2467LiquidationStreamLocks, type Pass2467LiquidationSnapshot, type Pass2467VenueId } from "./liquidation-long-short-proof";

export type Pass2468LedgerState = "ready" | "watch" | "blocked" | "not_applicable";
export type Pass2468LiquidationSide = "long_liquidated" | "short_liquidated" | "mixed" | "unknown";

export type Pass2468CollectorEventInput = {
  venue?: string;
  symbol?: string;
  eventTime?: string | number;
  side?: string;
  price?: string | number;
  quantity?: string | number;
  notionalUsd?: string | number;
  rawStreamName?: string;
  sourceEventId?: string;
};

export type Pass2468SignedLiquidationSnapshot = {
  id: string;
  venue: Pass2467VenueId;
  label: string;
  symbol: string;
  state: "signed_snapshot" | "expired" | "invalid";
  observedAt: string;
  maxAgeSeconds: number;
  ageSeconds: number;
  eventCount: number;
  longLiquidationCount: number;
  shortLiquidationCount: number;
  mixedOrUnknownCount: number;
  totalNotionalUsd?: number;
  largestEventNotionalUsd?: number;
  dominantSide: Pass2468LiquidationSide;
  collectorId: string;
  sourceStreams: string[];
  signature: string;
  fingerprint: string;
  confirmedFields: string[];
  missingFields: string[];
  copyBoundary: string;
};

export type Pass2468LedgerLane = {
  id: "collector_ingest" | "snapshot_signature" | "max_age_gate" | "notional_aggregation" | "pass2467_unlock_bridge" | "surface_replay";
  label: string;
  state: Pass2468LedgerState;
  confirmedEvidence: string[];
  missingEvidence: string[];
  copyBoundary: string;
};

export type Pass2468LiquidationSnapshotLedger = {
  version: "liquidation-snapshot-ledger-v1";
  state: Pass2468LedgerState;
  query?: string;
  symbol?: string;
  normalizedPair?: string;
  score: number;
  collectorMode: "memory_fallback" | "signed_snapshot_required" | "not_applicable";
  confirmedSqueezeUnlockCandidate: boolean;
  snapshots: Pass2468SignedLiquidationSnapshot[];
  lanes: Pass2468LedgerLane[];
  pass2467LiquidationSnapshots: Pass2467LiquidationSnapshot[];
  ledgerFingerprint: string;
  advancedCopyRule: string;
  maxAgeRule: string;
  copyFirewall: string[];
  missingForWorldClass: string[];
  nextImplementationActions: string[];
  generatedAt: string;
};

type StoredSnapshot = Pass2468SignedLiquidationSnapshot;

const STORE = new Map<string, StoredSnapshot[]>();
const PASS2468_MAX_EVENTS = 60;
const DEFAULT_MAX_AGE_SECONDS = 180;
const VERSION = "liquidation-snapshot-ledger-v1" as const;

function finite(value: unknown): number | undefined {
  const parsed = typeof value === "string" ? Number(value) : value;
  return typeof parsed === "number" && Number.isFinite(parsed) ? parsed : undefined;
}

function round(value: number, digits = 2) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function unique(items: Array<string | null | undefined | false | 0>) {
  return Array.from(new Set(items.filter(Boolean) as string[]));
}

function clamp(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function stableHash(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function normalizeVenue(venue?: string): Pass2467VenueId | undefined {
  const clean = (venue ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
  if (clean.includes("binance") || clean.includes("usdm") || clean.includes("fstream")) return "binance_usdm";
  if (clean.includes("bybit") || clean.includes("linear")) return "bybit_linear";
  return undefined;
}

function inferLiquidationSide(raw?: string): Pass2468LiquidationSide {
  const side = (raw ?? "").toLowerCase();
  if (side.includes("long_liquidated") || side.includes("long liquidated") || side.includes("sell")) return "long_liquidated";
  if (side.includes("short_liquidated") || side.includes("short liquidated") || side.includes("buy")) return "short_liquidated";
  if (side.includes("mixed")) return "mixed";
  return "unknown";
}

function dominantSide(longCount: number, shortCount: number, unknownCount: number): Pass2468LiquidationSide {
  if (longCount > shortCount && longCount > unknownCount) return "long_liquidated";
  if (shortCount > longCount && shortCount > unknownCount) return "short_liquidated";
  if (longCount || shortCount) return "mixed";
  return "unknown";
}

function labelForVenue(venue: Pass2467VenueId) {
  return venue === "binance_usdm" ? "Binance USDⓈ-M liquidation collector snapshot" : "Bybit Linear liquidation collector snapshot";
}

function streamForVenue(venue: Pass2467VenueId, pair: string) {
  return venue === "binance_usdm" ? `${pair.toLowerCase()}@forceOrder` : `bybit:linear:${pair}:liquidation-event-collector`;
}

function asIso(value?: string | number) {
  if (value === undefined || value === null || value === "") return new Date().toISOString();
  const numeric = finite(value);
  const date = numeric !== undefined ? new Date(numeric > 10_000_000_000 ? numeric : numeric * 1000) : new Date(value);
  if (Number.isNaN(date.getTime())) return new Date().toISOString();
  return date.toISOString();
}

function snapshotId(pair: string, venue: Pass2467VenueId, observedAt: string, fingerprint: string) {
  return `pass2468_${venue}_${pair}_${observedAt}_${fingerprint.slice(0, 12)}`.toLowerCase().replace(/[^a-z0-9_]+/g, "_").slice(0, 120);
}

export function buildPass2468SignedLiquidationSnapshot(args: {
  query?: string;
  symbol?: string;
  venue?: string;
  collectorId?: string;
  maxAgeSeconds?: number;
  events?: Pass2468CollectorEventInput[];
  now?: Date;
}): Pass2468SignedLiquidationSnapshot {
  const pair = normalizePass2466DerivativesPair(args.symbol ?? args.query ?? args.events?.[0]?.symbol);
  if (!pair) throw new Error("PASS2468 requires a normalized crypto perpetual pair, for example BTCUSDT.");
  const venue = normalizeVenue(args.venue ?? args.events?.[0]?.venue) ?? "binance_usdm";
  const now = args.now ?? new Date();
  const maxAgeSeconds = Math.max(30, Math.min(900, Math.round(args.maxAgeSeconds ?? DEFAULT_MAX_AGE_SECONDS)));
  const events = (args.events ?? []).slice(0, PASS2468_MAX_EVENTS);
  const observedAt = events.length ? events.map((event) => asIso(event.eventTime)).sort().pop()! : now.toISOString();
  const observedMs = new Date(observedAt).getTime();
  const ageSeconds = Math.max(0, Math.floor((now.getTime() - observedMs) / 1000));
  const values = events.map((event) => {
    const price = finite(event.price);
    const quantity = finite(event.quantity);
    const explicitNotional = finite(event.notionalUsd);
    return explicitNotional ?? (price !== undefined && quantity !== undefined ? Math.abs(price * quantity) : undefined);
  });
  const totalNotionalUsd = values.some((value) => value !== undefined) ? round(values.reduce((sum: number, value) => sum + Math.max(0, value ?? 0), 0), 2) : undefined;
  const largestEventNotionalUsd = values.some((value) => value !== undefined) ? round(Math.max(...values.map((value) => Math.max(0, value ?? 0))), 2) : undefined;
  const sides = events.map((event) => inferLiquidationSide(event.side));
  const longLiquidationCount = sides.filter((side) => side === "long_liquidated").length;
  const shortLiquidationCount = sides.filter((side) => side === "short_liquidated").length;
  const mixedOrUnknownCount = sides.filter((side) => side === "mixed" || side === "unknown").length;
  const sourceStreams = unique([streamForVenue(venue, pair), ...events.map((event) => event.rawStreamName)]);
  const collectorId = (args.collectorId ?? `velmere-${venue}-collector`).replace(/[^a-zA-Z0-9:_-]/g, "").slice(0, 96) || "velmere-collector";
  const signaturePayload = {
    version: VERSION,
    venue,
    pair,
    observedAt,
    eventCount: events.length,
    longLiquidationCount,
    shortLiquidationCount,
    mixedOrUnknownCount,
    totalNotionalUsd,
    largestEventNotionalUsd,
    sourceStreams,
    collectorId,
  };
  const signature = stableHash(signaturePayload);
  const fingerprint = `PASS2468-${signature.slice(0, 24).toUpperCase()}`;
  const missingFields = unique([
    !events.length && "liquidation event batch",
    totalNotionalUsd === undefined && "notionalUsd aggregation",
    sides.every((side) => side === "unknown") && "liquidation side classification",
    ageSeconds > maxAgeSeconds && "fresh max-age snapshot",
  ]);
  return {
    id: snapshotId(pair, venue, observedAt, signature),
    venue,
    label: labelForVenue(venue),
    symbol: pair,
    state: missingFields.length === 0 ? "signed_snapshot" : ageSeconds > maxAgeSeconds ? "expired" : "invalid",
    observedAt,
    maxAgeSeconds,
    ageSeconds,
    eventCount: events.length,
    longLiquidationCount,
    shortLiquidationCount,
    mixedOrUnknownCount,
    totalNotionalUsd,
    largestEventNotionalUsd,
    dominantSide: dominantSide(longLiquidationCount, shortLiquidationCount, mixedOrUnknownCount),
    collectorId,
    sourceStreams,
    signature,
    fingerprint,
    confirmedFields: unique([
      "collector snapshot signed",
      `${events.length} liquidation events normalized`,
      totalNotionalUsd !== undefined && `notional aggregation $${totalNotionalUsd}`,
      largestEventNotionalUsd !== undefined && `largest liquidation $${largestEventNotionalUsd}`,
      sourceStreams.length && `source stream ${sourceStreams[0]}`,
    ]),
    missingFields,
    copyBoundary: "PASS2468 snapshot proves collected liquidation events only. It still cannot become leverage, entry or exit advice.",
  };
}

export function recordPass2468LiquidationSnapshot(snapshot: Pass2468SignedLiquidationSnapshot) {
  const key = snapshot.symbol.toUpperCase();
  const current = STORE.get(key) ?? [];
  const next = [snapshot, ...current.filter((item) => item.id !== snapshot.id)].slice(0, 24);
  STORE.set(key, next);
  return snapshot;
}

export function ingestPass2468LiquidationEvents(args: {
  query?: string;
  symbol?: string;
  venue?: string;
  collectorId?: string;
  maxAgeSeconds?: number;
  events?: Pass2468CollectorEventInput[];
  now?: Date;
}) {
  return recordPass2468LiquidationSnapshot(buildPass2468SignedLiquidationSnapshot(args));
}

export function getPass2468StoredSnapshots(pair?: string) {
  if (!pair) return [];
  return (STORE.get(pair.toUpperCase()) ?? []).slice();
}

function buildPass2467Snapshots(pair: string, snapshots: Pass2468SignedLiquidationSnapshot[]): Pass2467LiquidationSnapshot[] {
  const base = buildPass2467LiquidationStreamLocks(pair);
  return base.map((lock) => {
    const matched = snapshots.find((snapshot) => snapshot.venue === lock.venue && snapshot.state === "signed_snapshot");
    if (!matched) return lock;
    return {
      ...lock,
      state: "collector_attached",
      observedAt: matched.observedAt,
      confirmedFields: unique([
        ...lock.confirmedFields,
        ...matched.confirmedFields,
        `PASS2468 signed snapshot ${matched.fingerprint}`,
        `dominant side ${matched.dominantSide}`,
      ]),
      missingFields: unique([
        ...matched.missingFields,
        "second venue liquidation snapshot if only one venue attached",
        "durable storage outside memory fallback",
      ]),
      copyBoundary: "PASS2468 collector snapshot is attached, but confirmed squeeze still needs PASS2466 ready state and two-venue long/short ratio agreement.",
    };
  });
}

function buildLanes(args: {
  snapshots: Pass2468SignedLiquidationSnapshot[];
  pair?: string;
}): Pass2468LedgerLane[] {
  const valid = args.snapshots.filter((snapshot) => snapshot.state === "signed_snapshot");
  const eventCount = valid.reduce((sum, snapshot) => sum + snapshot.eventCount, 0);
  const hasNotional = valid.some((snapshot) => snapshot.totalNotionalUsd !== undefined);
  const hasFresh = valid.some((snapshot) => snapshot.ageSeconds <= snapshot.maxAgeSeconds);
  return [
    {
      id: "collector_ingest",
      label: "Liquidation collector ingest",
      state: valid.length ? "ready" : args.pair ? "watch" : "not_applicable",
      confirmedEvidence: valid.map((snapshot) => `${snapshot.label}:${snapshot.eventCount} events`).slice(0, 4),
      missingEvidence: valid.length ? [] : ["POST signed liquidation event batch from Binance forceOrder or approved Bybit collector"],
      copyBoundary: "Collector ingest is a proof lane, not a trading signal.",
    },
    {
      id: "snapshot_signature",
      label: "Snapshot signature / fingerprint",
      state: valid.some((snapshot) => snapshot.signature) ? "ready" : "blocked",
      confirmedEvidence: valid.map((snapshot) => snapshot.fingerprint).slice(0, 4),
      missingEvidence: valid.some((snapshot) => snapshot.signature) ? [] : ["deterministic signature over normalized events"],
      copyBoundary: "Every surface must replay the same fingerprint before quoting the liquidation lane.",
    },
    {
      id: "max_age_gate",
      label: "Max-age freshness gate",
      state: hasFresh ? "ready" : valid.length ? "blocked" : "watch",
      confirmedEvidence: valid.map((snapshot) => `${snapshot.label}: age ${snapshot.ageSeconds}s / max ${snapshot.maxAgeSeconds}s`).slice(0, 4),
      missingEvidence: hasFresh ? [] : ["fresh snapshot inside max-age window"],
      copyBoundary: "Expired liquidation snapshots can be archived but cannot unlock confirmed current squeeze copy.",
    },
    {
      id: "notional_aggregation",
      label: "Side + notional aggregation",
      state: eventCount && hasNotional ? "ready" : eventCount ? "watch" : "blocked",
      confirmedEvidence: valid.map((snapshot) => `${snapshot.dominantSide}; notional ${snapshot.totalNotionalUsd ?? "missing"}; largest ${snapshot.largestEventNotionalUsd ?? "missing"}`).slice(0, 4),
      missingEvidence: hasNotional ? [] : ["price × quantity or notionalUsd per event"],
      copyBoundary: "Aggregation may describe liquidation pressure only; it must not predict price direction as certainty.",
    },
    {
      id: "pass2467_unlock_bridge",
      label: "PASS2467 collector unlock bridge",
      state: valid.length && hasFresh ? "ready" : "blocked",
      confirmedEvidence: valid.length && hasFresh ? ["PASS2467 liquidation snapshot can be marked collector_attached"] : [],
      missingEvidence: valid.length && hasFresh ? [] : ["fresh signed liquidation snapshot required before PASS2467 collector_attached"],
      copyBoundary: "PASS2468 can unlock only the liquidation-collector part of PASS2467, not a full squeeze claim by itself.",
    },
    {
      id: "surface_replay",
      label: "Shield / PDF / Brain / Angel replay",
      state: valid.length ? "watch" : "blocked",
      confirmedEvidence: valid.length ? ["fingerprint available for surface replay"] : [],
      missingEvidence: ["render fingerprint in Shield", "render fingerprint in PDF Advanced", "render fingerprint in Angel context", "store durable replay receipt"],
      copyBoundary: "Advanced paid output must show the same snapshot id/fingerprint everywhere or downgrade to pressure/watch.",
    },
  ];
}

export function buildPass2468LiquidationSnapshotLedger(args: {
  query?: string;
  symbol?: string;
  result?: TokenRiskResult | null;
  snapshots?: Pass2468SignedLiquidationSnapshot[];
  now?: Date;
}): Pass2468LiquidationSnapshotLedger {
  const now = args.now ?? new Date();
  const pair = normalizePass2466DerivativesPair(args.symbol ?? args.result?.token.symbol ?? args.query);
  const assetClass = args.result?.token.assetClass ?? "crypto";
  const applicable = Boolean(pair && !args.result?.token.tokenAddress && (assetClass === "crypto" || assetClass === "unknown" || assetClass === undefined));
  if (!applicable) {
    return {
      version: VERSION,
      state: "not_applicable",
      query: args.query,
      symbol: args.symbol ?? args.result?.token.symbol,
      normalizedPair: pair,
      score: 0,
      collectorMode: "not_applicable",
      confirmedSqueezeUnlockCandidate: false,
      snapshots: [],
      lanes: [],
      pass2467LiquidationSnapshots: [],
      ledgerFingerprint: "PASS2468-NOT-APPLICABLE",
      advancedCopyRule: "Crypto liquidation snapshot ledger applies only when a mapped perpetual pair exists.",
      maxAgeRule: "No max-age rule for non-applicable assets.",
      copyFirewall: ["No crypto squeeze wording for non-applicable assets"],
      missingForWorldClass: ["perpetual venue mapping"],
      nextImplementationActions: ["Map this asset to a real derivatives venue before enabling liquidation proof."],
      generatedAt: now.toISOString(),
    };
  }
  const snapshots = (args.snapshots ?? getPass2468StoredSnapshots(pair)).map((snapshot) => {
    const ageSeconds = Math.max(0, Math.floor((now.getTime() - new Date(snapshot.observedAt).getTime()) / 1000));
    return {
      ...snapshot,
      ageSeconds,
      state: ageSeconds <= snapshot.maxAgeSeconds && snapshot.eventCount > 0 && snapshot.signature ? "signed_snapshot" as const : ageSeconds > snapshot.maxAgeSeconds ? "expired" as const : "invalid" as const,
    };
  });
  const valid = snapshots.filter((snapshot) => snapshot.state === "signed_snapshot");
  const lanes = buildLanes({ snapshots, pair });
  const readyLanes = lanes.filter((lane) => lane.state === "ready").length;
  const watchLanes = lanes.filter((lane) => lane.state === "watch").length;
  const score = clamp(18 + readyLanes * 12 + watchLanes * 5 + valid.length * 10);
  const state: Pass2468LedgerState = valid.length ? "ready" : pair ? "watch" : "blocked";
  const normalizedPair = pair ?? (String(args.symbol ?? args.result?.token.symbol ?? args.query ?? "UNKNOWN").toUpperCase().replace(/[^A-Z0-9.-]/g, "").slice(0, 32) || "UNKNOWN");
  const pass2467LiquidationSnapshots = buildPass2467Snapshots(normalizedPair, valid);
  const ledgerFingerprint = valid.length
    ? `PASS2468-${stableHash(valid.map((snapshot) => snapshot.fingerprint)).slice(0, 24).toUpperCase()}`
    : `PASS2468-${normalizedPair}-MISSING-SNAPSHOT`;
  const missingForWorldClass = unique([
    ...lanes.flatMap((lane) => lane.missingEvidence.map((item) => `${lane.label}: ${item}`)),
    valid.length < 1 && "fresh signed liquidation snapshot",
    valid.length < 2 && "second venue liquidation snapshot",
    "durable storage adapter instead of memory fallback",
    "collector daemon process / WebSocket worker",
    "surface replay in PDF/Shield/Brain/Angel",
  ]).slice(0, 14);
  return {
    version: VERSION,
    state,
    query: args.query,
    symbol: args.symbol ?? args.result?.token.symbol,
    normalizedPair: pair,
    score,
    collectorMode: valid.length ? "memory_fallback" : "signed_snapshot_required",
    confirmedSqueezeUnlockCandidate: valid.length > 0,
    snapshots,
    lanes,
    pass2467LiquidationSnapshots,
    ledgerFingerprint,
    advancedCopyRule: "PASS2468 can only unlock the liquidation-proof component. Advanced still needs PASS2466 ready state and PASS2467 two-venue ratio before confirmed squeeze wording.",
    maxAgeRule: `Only snapshots with ageSeconds <= maxAgeSeconds are allowed to influence current Advanced squeeze wording. Default max-age is ${DEFAULT_MAX_AGE_SECONDS}s.`,
    copyFirewall: [
      "Do not fabricate liquidation events when collector is missing.",
      "Do not say confirmed squeeze from a single venue snapshot alone.",
      "Do not hide expired snapshot state in Advanced.",
      "Do not provide leverage, entry, exit, liquidation target or trading instructions.",
    ],
    missingForWorldClass,
    nextImplementationActions: [
      "Run a server-side WebSocket worker for Binance forceOrder and approved Bybit liquidation/event feed.",
      "Persist snapshots in Redis/Supabase with max-age and fingerprint replay.",
      "Render PASS2468 ledgerFingerprint next to PASS2467 in Shield Advanced and PDF Advanced.",
      "Add operator replay board for collector health and stale snapshot alerts.",
    ],
    generatedAt: now.toISOString(),
  };
}
