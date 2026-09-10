import { createHash } from "node:crypto";
import type { TokenRiskResult, VelmereMarketAssetClass } from "./risk-types";
import type { Pass2468LiquidationSnapshotLedger } from "./liquidation-snapshot-ledger";
import type { Pass2469LiquidationReplayStore } from "./liquidation-replay-store";
import type { Pass2485PaidAdvancedReadinessFuse } from "./paid-advanced-readiness-fuse";
import type { Pass2486DerivativesPaidReadinessBridge } from "./derivatives-paid-readiness-bridge";

export const PASS2487_LIQUIDATION_REPLAY_PAID_COPY_LOCK_ID = "liquidation-replay-paid-copy-lock-v1" as const;

export type Pass2487CopyLockState = "paid_copy_allowed" | "runtime_watch" | "blocked" | "not_applicable";
export type Pass2487LaneState = "ready" | "watch" | "blocked" | "not_applicable";

export type Pass2487ReplayCopyLane = {
  id: "collector_snapshot" | "replay_fingerprint" | "two_venue_replay" | "durable_storage" | "paid_copy_lock" | "surface_parity";
  label: string;
  state: Pass2487LaneState;
  readyEvidence: string[];
  missingEvidence: string[];
  copyBoundary: string;
  operatorAction: string;
};

export type Pass2487LiquidationReplayPaidCopyLock = {
  version: typeof PASS2487_LIQUIDATION_REPLAY_PAID_COPY_LOCK_ID;
  state: Pass2487CopyLockState;
  query?: string;
  symbol?: string;
  normalizedPair?: string;
  assetFamily: "crypto" | "real_market" | "unknown";
  replayRuntimeReady: boolean;
  twoVenueReplayReady: boolean;
  durableReplayReady: boolean;
  paidCopyAllowed: boolean;
  confirmedSqueezeCopyAllowedAfterReplay: boolean;
  replayReadinessScore: number;
  freshReplayCount: number;
  signedSnapshotCount: number;
  replayVenueCount: number;
  latestReplayFingerprint?: string;
  latestLedgerFingerprint?: string;
  lanes: Pass2487ReplayCopyLane[];
  hardLocks: string[];
  customerVerdict: string;
  operatorVerdict: string;
  noOverclaimRules: string[];
  nextImplementationActions: string[];
  fingerprint: string;
  generatedAt: string;
};

function unique<T>(items: Array<T | false | null | undefined>) {
  return Array.from(new Set(items.filter(Boolean) as T[]));
}

function hash(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex").slice(0, 32).toUpperCase();
}

function clamp(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function normalizeSymbol(value?: string) {
  return String(value ?? "").trim().toUpperCase().replace(/[^A-Z0-9.-]/g, "").slice(0, 32);
}

function assetFamily(result?: TokenRiskResult | null, symbol?: string): Pass2487LiquidationReplayPaidCopyLock["assetFamily"] {
  const assetClass: VelmereMarketAssetClass | undefined = result?.token.assetClass;
  if (assetClass === "stock" || assetClass === "etf" || assetClass === "index" || assetClass === "fx" || assetClass === "commodity" || assetClass === "real_estate" || assetClass === "exchange_equity") return "real_market";
  const normalized = normalizeSymbol(symbol || result?.token.symbol);
  if (assetClass === "crypto" || result?.token.chainId || result?.token.tokenAddress || result?.token.pairAddress || result?.token.dexId) return "crypto";
  if (["BTC", "ETH", "SOL", "BNB", "XRP", "DOGE", "ADA", "AVAX", "DOT", "LINK", "PEPE", "LTC", "TRX"].includes(normalized)) return "crypto";
  return "unknown";
}

type Pass2487OptionalText = string | false | null | undefined;

type Pass2487ReplayCopyLaneInput = Omit<Pass2487ReplayCopyLane, "readyEvidence" | "missingEvidence"> & {
  readyEvidence: Pass2487OptionalText[];
  missingEvidence: Pass2487OptionalText[];
};

function lane(args: Pass2487ReplayCopyLaneInput): Pass2487ReplayCopyLane {
  return {
    ...args,
    readyEvidence: unique(args.readyEvidence).slice(0, 10),
    missingEvidence: unique(args.missingEvidence).slice(0, 12),
  };
}

function latestFingerprint(pass2469?: Pass2469LiquidationReplayStore | null) {
  return pass2469?.latestReplayFingerprint || pass2469?.records?.[0]?.replayFingerprint;
}

export function buildPass2487LiquidationReplayPaidCopyLock(args: {
  query?: string;
  symbol?: string;
  result?: TokenRiskResult | null;
  pass2468?: Pass2468LiquidationSnapshotLedger | null;
  pass2469?: Pass2469LiquidationReplayStore | null;
  pass2485?: Pass2485PaidAdvancedReadinessFuse | null;
  pass2486?: Pass2486DerivativesPaidReadinessBridge | null;
  now?: Date;
} = {}): Pass2487LiquidationReplayPaidCopyLock {
  const now = args.now ?? new Date();
  const symbol = normalizeSymbol(args.symbol || args.result?.token.symbol || args.query);
  const family = assetFamily(args.result, symbol);
  const crypto = family === "crypto";
  const signedSnapshots = (args.pass2468?.snapshots ?? []).filter((snapshot) => snapshot.state === "signed_snapshot");
  const freshReplays = (args.pass2469?.records ?? []).filter((record) => record.state === "fresh");
  const freshReplayCount = args.pass2469?.freshReplayCount ?? freshReplays.length;
  const signedSnapshotCount = signedSnapshots.length;
  const replayVenueCount = args.pass2469?.venueCount ?? new Set(freshReplays.map((record) => record.venue)).size;
  const twoVenueReplayReady = Boolean(args.pass2469?.twoVenueReplayReady || replayVenueCount >= 2);
  const durableReplayReady = args.pass2469?.storageMode === "supabase_ready";
  const replayFingerprint = latestFingerprint(args.pass2469);
  const ledgerFingerprint = args.pass2469?.latestLedgerFingerprint || args.pass2468?.ledgerFingerprint;
  const replayRuntimeReady = crypto && signedSnapshotCount > 0 && freshReplayCount > 0 && Boolean(replayFingerprint);
  const derivativeBridgeAllowed = Boolean(args.pass2486?.confirmedSqueezeCopyAllowed && args.pass2486?.paidAdvancedAllowedAfterDerivativeBridge);
  const paidFuseAllowed = Boolean(args.pass2485?.paidAdvancedAllowed);
  const confirmedSqueezeCopyAllowedAfterReplay = replayRuntimeReady && twoVenueReplayReady && derivativeBridgeAllowed;
  const paidCopyAllowed = confirmedSqueezeCopyAllowedAfterReplay && durableReplayReady && paidFuseAllowed;

  const lanes: Pass2487ReplayCopyLane[] = [
    lane({
      id: "collector_snapshot",
      label: "Signed liquidation collector snapshot",
      state: !crypto ? "not_applicable" : signedSnapshotCount > 0 ? "ready" : args.pass2468?.state === "watch" ? "watch" : "blocked",
      readyEvidence: [
        args.pass2468?.state && `PASS2468 ${args.pass2468.state}:${args.pass2468.score}/100`,
        signedSnapshotCount > 0 && `${signedSnapshotCount} signed snapshot(s)`,
        args.pass2468?.ledgerFingerprint && `ledger ${args.pass2468.ledgerFingerprint}`,
      ],
      missingEvidence: [
        crypto && signedSnapshotCount < 1 && "fresh signed liquidation snapshot",
        crypto && signedSnapshotCount < 2 && "second venue signed liquidation snapshot",
        crypto && "collector daemon / WebSocket worker receipt",
      ],
      copyBoundary: "Signed liquidation snapshots prove collected events only; they do not create leverage, entry or exit instructions.",
      operatorAction: "Keep PASS2468 visible and stale-aware; do not strengthen copy from expired or synthetic liquidation data.",
    }),
    lane({
      id: "replay_fingerprint",
      label: "Replay fingerprint and max-age",
      state: !crypto ? "not_applicable" : freshReplayCount > 0 && replayFingerprint ? "ready" : args.pass2469?.replayCount ? "watch" : "blocked",
      readyEvidence: [
        args.pass2469?.state && `PASS2469 ${args.pass2469.state}`,
        freshReplayCount > 0 && `${freshReplayCount} fresh replay(s)`,
        replayFingerprint && `latest ${replayFingerprint}`,
      ],
      missingEvidence: [
        crypto && freshReplayCount < 1 && "fresh replay inside max-age",
        crypto && !replayFingerprint && "latest replayFingerprint",
        crypto && "replay lookup by symbol/fingerprint across surfaces",
      ],
      copyBoundary: "Current copy must downgrade to historical pressure when the replay is missing or expired.",
      operatorAction: "Surface replayFingerprint beside the Advanced result and store it with PDF/Angel receipt payloads.",
    }),
    lane({
      id: "two_venue_replay",
      label: "Two-venue liquidation replay",
      state: !crypto ? "not_applicable" : twoVenueReplayReady ? "ready" : freshReplayCount > 0 ? "watch" : "blocked",
      readyEvidence: [
        replayVenueCount > 0 && `${replayVenueCount} replay venue(s)`,
        twoVenueReplayReady && "two-venue replay ready",
      ],
      missingEvidence: [
        crypto && !twoVenueReplayReady && "fresh replay from second derivatives venue",
        crypto && "venue disagreement display if liquidation sides diverge",
      ],
      copyBoundary: "Single-venue replay can support watch context, not confirmed squeeze language.",
      operatorAction: "Add second approved venue collector before any squeeze copy can become confirmed.",
    }),
    lane({
      id: "durable_storage",
      label: "Durable replay persistence",
      state: !crypto ? "not_applicable" : durableReplayReady ? "ready" : freshReplayCount > 0 ? "watch" : "blocked",
      readyEvidence: [
        args.pass2469?.storageMode && `storage ${args.pass2469.storageMode}`,
        durableReplayReady && "Supabase replay persistence ready",
      ],
      missingEvidence: [
        crypto && !durableReplayReady && "Supabase/Redis durable replay persistence",
        crypto && "server-side entitlement/replay bundle stored for paid access",
      ],
      copyBoundary: "Memory fallback is QA only; paid Advanced needs replayable durable evidence.",
      operatorAction: "Run the replay table migration and store every paid Advanced proof bundle server-side.",
    }),
    lane({
      id: "paid_copy_lock",
      label: "Paid copy lock: PASS2485 + PASS2486 + replay",
      state: !crypto ? "not_applicable" : paidCopyAllowed ? "ready" : replayRuntimeReady || args.pass2485 || args.pass2486 ? "watch" : "blocked",
      readyEvidence: [
        args.pass2485?.state && `PASS2485 ${args.pass2485.state}:${args.pass2485.readinessScore}/100`,
        args.pass2486?.state && `PASS2486 ${args.pass2486.state}:${args.pass2486.bridgeScore}/100`,
        paidCopyAllowed && "paidCopyAllowed=true",
      ],
      missingEvidence: [
        crypto && !paidFuseAllowed && "PASS2485 paidAdvancedAllowed=true",
        crypto && !derivativeBridgeAllowed && "PASS2486 confirmedSqueezeCopyAllowed + paid bridge",
        crypto && !replayRuntimeReady && "fresh liquidation replay runtime",
        crypto && !durableReplayReady && "durable replay storage",
      ],
      copyBoundary: "Paid copy follows the strictest lock; if any part is missing, sell only QA preview / missing-proof map.",
      operatorAction: "Use PASS2487 as the final derivatives copy gate after PASS2485/PASS2486.",
    }),
    lane({
      id: "surface_parity",
      label: "Surface parity: Shield, PDF, Brain, Angel",
      state: !crypto ? "not_applicable" : replayFingerprint && ledgerFingerprint ? "watch" : "blocked",
      readyEvidence: [
        replayFingerprint && `replay ${replayFingerprint}`,
        ledgerFingerprint && `ledger ${ledgerFingerprint}`,
      ],
      missingEvidence: [
        crypto && "render replay/ledger fingerprint in Shield Advanced",
        crypto && "render replay/ledger fingerprint in PDF Advanced",
        crypto && "render replay/ledger fingerprint in VLM Brain and Angel",
        crypto && "operator test proving same payload across surfaces",
      ],
      copyBoundary: "If any surface cannot replay the same fingerprint, all customer copy must downgrade.",
      operatorAction: "Add PASS2487 fingerprint to source-sync, modal strip, PDF headers and Angel context.",
    }),
  ];

  const required = lanes.filter((item) => item.state !== "not_applicable");
  const ready = required.filter((item) => item.state === "ready").length;
  const watch = required.filter((item) => item.state === "watch").length;
  const blocked = required.filter((item) => item.state === "blocked").length;
  const replayReadinessScore = clamp((ready / Math.max(1, required.length)) * 72 + (watch / Math.max(1, required.length)) * 22 - blocked * 9 + (args.pass2468?.score ?? 0) * 0.03 + (args.pass2486?.bridgeScore ?? 0) * 0.03);
  const hardLocks = unique(required.filter((item) => item.state !== "ready").flatMap((item) => item.missingEvidence.map((missing) => `${item.label}: ${missing}`))).slice(0, 18);
  const state: Pass2487CopyLockState = !crypto
    ? family === "real_market" ? "not_applicable" : "blocked"
    : paidCopyAllowed
      ? "paid_copy_allowed"
      : replayRuntimeReady || ready > 0 || watch >= 2
        ? "runtime_watch"
        : "blocked";
  const fingerprint = `PASS2487-${hash({ query: args.query, symbol, family, state, replayReadinessScore, replayFingerprint, ledgerFingerprint, lanes: lanes.map((item) => [item.id, item.state]) })}`;

  return {
    version: PASS2487_LIQUIDATION_REPLAY_PAID_COPY_LOCK_ID,
    state,
    query: args.query,
    symbol,
    normalizedPair: args.pass2469?.normalizedPair || args.pass2468?.normalizedPair || args.pass2486?.normalizedPair,
    assetFamily: family,
    replayRuntimeReady,
    twoVenueReplayReady,
    durableReplayReady,
    paidCopyAllowed,
    confirmedSqueezeCopyAllowedAfterReplay,
    replayReadinessScore,
    freshReplayCount,
    signedSnapshotCount,
    replayVenueCount,
    latestReplayFingerprint: replayFingerprint,
    latestLedgerFingerprint: ledgerFingerprint,
    lanes,
    hardLocks,
    customerVerdict: !crypto
      ? "PASS2487 is only for crypto liquidation replay copy; Real Markets uses quote/filing/fundamental proof gates."
      : paidCopyAllowed
        ? "Advanced derivatives copy may reference replayed liquidation evidence, still without trading instructions or certainty."
        : "Advanced derivatives copy must stay pressure/watch or missing-proof map until fresh two-venue durable replay and PASS2485/PASS2486 locks are ready.",
    operatorVerdict: paidCopyAllowed
      ? "Paid Advanced derivatives copy can use replay fingerprints, but every surface must show the same PASS2487 fingerprint."
      : `Do not allow paid/confirmed squeeze copy yet. Close locks: ${hardLocks.slice(0, 5).join(" · ") || "liquidation replay lock missing"}.`,
    noOverclaimRules: [
      "Do not say confirmed squeeze unless PASS2487 paidCopyAllowed=true and PASS2486 confirmedSqueezeCopyAllowed=true.",
      "Do not use liquidation data for leverage, entry, exit or liquidation-target advice.",
      "Memory replay is QA only; paid Advanced needs durable replay persistence.",
      "Single-venue replay is watch context only.",
      "The same replayFingerprint and ledgerFingerprint must be visible in Shield, PDF, Brain and Angel.",
    ],
    nextImplementationActions: unique([
      crypto && !twoVenueReplayReady && "Attach a second approved liquidation venue replay before confirmed squeeze copy.",
      crypto && !durableReplayReady && "Persist PASS2469 replay records in Supabase/Redis instead of memory fallback.",
      crypto && !replayFingerprint && "Render latest replayFingerprint in Advanced proof strip and PDF header.",
      crypto && !paidFuseAllowed && "Keep PASS2485 paidAdvancedAllowed=false until all paid lanes are replayable.",
      crypto && !derivativeBridgeAllowed && "Keep PASS2486 confirmed squeeze copy blocked until derivatives bridge is ready.",
      crypto && "Add operator replay parity test: API payload, modal, PDF preview/download and Angel answer must share PASS2487 fingerprint.",
    ]).slice(0, 10),
    fingerprint,
    generatedAt: now.toISOString(),
  };
}
