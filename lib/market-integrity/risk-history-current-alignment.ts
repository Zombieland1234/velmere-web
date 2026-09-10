import {
  buildRiskHistorySnapshot,
  verifyRiskHistorySnapshot,
  type PublicCustomerRiskHistoryProjection,
} from "./risk-history-contract";
import { ASCII_CONTROL_PATTERN } from "@/lib/security/ascii-control-characters";
import type { TokenRiskResult } from "./risk-types";

export const RISK_HISTORY_CURRENT_OBSERVATION_SCHEMA = "velmere.risk-history-current-observation.v1" as const;
export const RISK_HISTORY_CURRENT_ALIGNMENT_SCHEMA = "velmere.risk-history-current-alignment.v1" as const;

export type RiskHistoryCurrentObservationBlocker =
  | "current_score_withheld"
  | "current_score_invalid"
  | "current_timestamp_invalid"
  | "current_snapshot_build_failed"
  | "current_snapshot_not_publishable"
  | "current_snapshot_invalid"
  | "current_score_snapshot_mismatch";

export type RiskHistoryCurrentObservation = {
  schemaVersion: typeof RISK_HISTORY_CURRENT_OBSERVATION_SCHEMA;
  status: "AVAILABLE" | "WITHHELD";
  score: number | null;
  snapshotScore: number | null;
  observedAt: string | null;
  canonicalAssetId: string | null;
  methodologyVersion: string | null;
  scoreVersion: string | null;
  evidenceVersion: string | null;
  comparabilityKey: string | null;
  blocker: RiskHistoryCurrentObservationBlocker | null;
};

export type RiskHistoryCurrentAlignmentState =
  | "CURRENT_WITHHELD"
  | "HISTORY_EMPTY"
  | "ALIGNED_SAME_OBSERVATION"
  | "CURRENT_NEWER_COMPARABLE"
  | "CURRENT_NEWER_NEW_SEGMENT"
  | "HISTORY_NEWER_THAN_CURRENT"
  | "IDENTITY_CONFLICT"
  | "SAME_OBSERVATION_CONFLICT";

export type RiskHistoryCurrentAlignment = {
  schemaVersion: typeof RISK_HISTORY_CURRENT_ALIGNMENT_SCHEMA;
  state: RiskHistoryCurrentAlignmentState;
  current: RiskHistoryCurrentObservation;
  latestHistory: {
    score: number;
    observedAt: string;
    methodologyVersion: string;
    scoreVersion: string;
    evidenceVersion: string;
    comparabilityKey: string;
    eventReference: string;
  } | null;
  currentDisplayAllowed: boolean;
  historyDisplayAllowed: boolean;
  sameComparableSegment: boolean | null;
  timeDeltaMs: number | null;
  scoreDelta: number | null;
  disclosureRequired: boolean;
};

function canonicalIso(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) && new Date(parsed).toISOString() === value;
}

function publishedScore(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 100
    ? Math.round(value * 100) / 100
    : null;
}


const CURRENT_OBSERVATION_FIELDS = new Set([
  "schemaVersion",
  "status",
  "score",
  "snapshotScore",
  "observedAt",
  "canonicalAssetId",
  "methodologyVersion",
  "scoreVersion",
  "evidenceVersion",
  "comparabilityKey",
  "blocker",
]);
const CURRENT_OBSERVATION_BLOCKERS = new Set<RiskHistoryCurrentObservationBlocker>([
  "current_score_withheld",
  "current_score_invalid",
  "current_timestamp_invalid",
  "current_snapshot_build_failed",
  "current_snapshot_not_publishable",
  "current_snapshot_invalid",
  "current_score_snapshot_mismatch",
]);
const DIGEST = /^sha256:[a-f0-9]{64}$/u;

function exactCurrentObservationKeys(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const keys = Object.keys(value);
  return keys.length === CURRENT_OBSERVATION_FIELDS.size
    && keys.every((key) => CURRENT_OBSERVATION_FIELDS.has(key));
}

function boundedText(value: unknown, max: number): value is string {
  return typeof value === "string"
    && value.length > 0
    && value.length <= max
    && value.trim() === value
    && !ASCII_CONTROL_PATTERN.test(value);
}

export function verifyRiskHistoryCurrentObservation(value: unknown): value is RiskHistoryCurrentObservation {
  if (!exactCurrentObservationKeys(value)
      || value.schemaVersion !== RISK_HISTORY_CURRENT_OBSERVATION_SCHEMA
      || (value.status !== "AVAILABLE" && value.status !== "WITHHELD")) return false;

  if (value.status === "WITHHELD") {
    return value.score === null
      && value.snapshotScore === null
      && value.observedAt === null
      && value.canonicalAssetId === null
      && value.methodologyVersion === null
      && value.scoreVersion === null
      && value.evidenceVersion === null
      && value.comparabilityKey === null
      && typeof value.blocker === "string"
      && CURRENT_OBSERVATION_BLOCKERS.has(value.blocker as RiskHistoryCurrentObservationBlocker);
  }

  return typeof value.score === "number"
    && Number.isFinite(value.score)
    && value.score >= 0
    && value.score <= 100
    && typeof value.snapshotScore === "number"
    && Number.isInteger(value.snapshotScore)
    && value.snapshotScore >= 0
    && value.snapshotScore <= 100
    && Math.round(value.score) === value.snapshotScore
    && canonicalIso(value.observedAt)
    && boundedText(value.canonicalAssetId, 256)
    && boundedText(value.methodologyVersion, 160)
    && typeof value.scoreVersion === "string"
    && DIGEST.test(value.scoreVersion)
    && boundedText(value.evidenceVersion, 120)
    && typeof value.comparabilityKey === "string"
    && DIGEST.test(value.comparabilityKey)
    && value.blocker === null;
}

function withheld(blocker: RiskHistoryCurrentObservationBlocker): RiskHistoryCurrentObservation {
  return {
    schemaVersion: RISK_HISTORY_CURRENT_OBSERVATION_SCHEMA,
    status: "WITHHELD",
    score: null,
    snapshotScore: null,
    observedAt: null,
    canonicalAssetId: null,
    methodologyVersion: null,
    scoreVersion: null,
    evidenceVersion: null,
    comparabilityKey: null,
    blocker,
  };
}

/**
 * Rebuild the exact versioned observation that Risk History would store for the
 * currently published table score. This prevents the UI from comparing a raw
 * number with a history event while silently ignoring identity, timestamp,
 * methodology or evidence-version drift.
 */
export function buildRiskHistoryCurrentObservation(args: {
  assetId: string;
  result: TokenRiskResult;
  publishedScore: number | null;
}): RiskHistoryCurrentObservation {
  if (args.publishedScore === null) return withheld("current_score_withheld");
  const score = publishedScore(args.publishedScore);
  if (score === null) return withheld("current_score_invalid");
  if (!canonicalIso(args.result.generatedAt)) return withheld("current_timestamp_invalid");

  let snapshot;
  try {
    snapshot = buildRiskHistorySnapshot({
      assetId: args.assetId,
      result: args.result,
      observedAt: args.result.generatedAt,
    });
  } catch {
    return withheld("current_snapshot_build_failed");
  }
  if (!verifyRiskHistorySnapshot(snapshot)) return withheld("current_snapshot_invalid");
  if (!snapshot.customerPublishable || snapshot.publicationState !== "PUBLIC") {
    return withheld("current_snapshot_not_publishable");
  }
  if (Math.round(score) !== snapshot.score) return withheld("current_score_snapshot_mismatch");

  return {
    schemaVersion: RISK_HISTORY_CURRENT_OBSERVATION_SCHEMA,
    status: "AVAILABLE",
    score,
    snapshotScore: snapshot.score,
    observedAt: snapshot.timestamp,
    canonicalAssetId: snapshot.canonicalAssetId,
    methodologyVersion: snapshot.methodologyVersion,
    scoreVersion: snapshot.scoreVersion,
    evidenceVersion: snapshot.evidenceVersion,
    comparabilityKey: snapshot.comparabilityKey,
    blocker: null,
  };
}

function latestHistoryRow(history: PublicCustomerRiskHistoryProjection["history"]) {
  return history.at(-1) ?? null;
}

/**
 * Cross-product truth adjudication between the live table score and the latest
 * immutable/public Risk History observation. A newer or conflicting value is
 * never silently relabelled as the other one.
 */
export function alignRiskHistoryCurrentObservation(args: {
  current: RiskHistoryCurrentObservation;
  historyAssetCanonicalId: string | null;
  history: PublicCustomerRiskHistoryProjection["history"];
}): RiskHistoryCurrentAlignment {
  const current = verifyRiskHistoryCurrentObservation(args.current)
    ? args.current
    : withheld("current_snapshot_invalid");
  const latest = latestHistoryRow(args.history);
  const latestHistory = latest ? {
    score: latest.score,
    observedAt: latest.observedAt,
    methodologyVersion: latest.methodologyVersion,
    scoreVersion: latest.scoreVersion,
    evidenceVersion: latest.evidenceVersion,
    comparabilityKey: latest.comparabilityKey,
    eventReference: latest.eventReference,
  } : null;

  if (current.status !== "AVAILABLE") {
    return {
      schemaVersion: RISK_HISTORY_CURRENT_ALIGNMENT_SCHEMA,
      state: "CURRENT_WITHHELD",
      current: current,
      latestHistory,
      currentDisplayAllowed: false,
      historyDisplayAllowed: latestHistory !== null,
      sameComparableSegment: null,
      timeDeltaMs: null,
      scoreDelta: null,
      disclosureRequired: true,
    };
  }

  if (!latestHistory) {
    return {
      schemaVersion: RISK_HISTORY_CURRENT_ALIGNMENT_SCHEMA,
      state: "HISTORY_EMPTY",
      current: current,
      latestHistory: null,
      currentDisplayAllowed: true,
      historyDisplayAllowed: false,
      sameComparableSegment: null,
      timeDeltaMs: null,
      scoreDelta: null,
      disclosureRequired: true,
    };
  }

  const currentTime = Date.parse(current.observedAt!);
  const historyTime = Date.parse(latestHistory.observedAt);
  const timeDeltaMs = currentTime - historyTime;
  const scoreDelta = Math.round(((current.score ?? 0) - latestHistory.score) * 100) / 100;
  const sameComparableSegment = current.comparabilityKey === latestHistory.comparabilityKey
    && current.methodologyVersion === latestHistory.methodologyVersion
    && current.scoreVersion === latestHistory.scoreVersion
    && current.evidenceVersion === latestHistory.evidenceVersion;

  if (!args.historyAssetCanonicalId || current.canonicalAssetId !== args.historyAssetCanonicalId) {
    return {
      schemaVersion: RISK_HISTORY_CURRENT_ALIGNMENT_SCHEMA,
      state: "IDENTITY_CONFLICT",
      current: current,
      latestHistory,
      currentDisplayAllowed: false,
      historyDisplayAllowed: true,
      sameComparableSegment,
      timeDeltaMs,
      scoreDelta,
      disclosureRequired: true,
    };
  }

  if (timeDeltaMs === 0) {
    const scoreEquivalent = current.snapshotScore === latestHistory.score;
    const state = scoreEquivalent && sameComparableSegment
      ? "ALIGNED_SAME_OBSERVATION"
      : "SAME_OBSERVATION_CONFLICT";
    return {
      schemaVersion: RISK_HISTORY_CURRENT_ALIGNMENT_SCHEMA,
      state,
      current: current,
      latestHistory,
      currentDisplayAllowed: state === "ALIGNED_SAME_OBSERVATION",
      historyDisplayAllowed: true,
      sameComparableSegment,
      timeDeltaMs,
      scoreDelta,
      disclosureRequired: state !== "ALIGNED_SAME_OBSERVATION",
    };
  }

  if (timeDeltaMs > 0) {
    return {
      schemaVersion: RISK_HISTORY_CURRENT_ALIGNMENT_SCHEMA,
      state: sameComparableSegment ? "CURRENT_NEWER_COMPARABLE" : "CURRENT_NEWER_NEW_SEGMENT",
      current: current,
      latestHistory,
      currentDisplayAllowed: true,
      historyDisplayAllowed: true,
      sameComparableSegment,
      timeDeltaMs,
      scoreDelta,
      disclosureRequired: true,
    };
  }

  return {
    schemaVersion: RISK_HISTORY_CURRENT_ALIGNMENT_SCHEMA,
    state: "HISTORY_NEWER_THAN_CURRENT",
    current: current,
    latestHistory,
    currentDisplayAllowed: false,
    historyDisplayAllowed: true,
    sameComparableSegment,
    timeDeltaMs,
    scoreDelta,
    disclosureRequired: true,
  };
}
