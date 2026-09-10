import type { VelmereTier } from "@/lib/market-integrity/top1-risk-foundation";

export type Pass2816Surface =
  | "Shield"
  | "Real Markets"
  | "Shield Pro"
  | "PDF"
  | "Report Access"
  | "Community"
  | "VLM Brain";

export type Pass2816RuntimeState = "healthy" | "degraded" | "circuit_open";

export type Pass2816ProviderRunLedger = {
  schemaVersion: "pass2816_runtime_observability_ledger_v1";
  surface: Pass2816Surface;
  tier: VelmereTier;
  generatedAt: string;
  runtimeState: Pass2816RuntimeState;
  requestedUnits: number;
  sourceBoundUnits: number;
  skeletonOrMissingUnits: number;
  containedFailures: number;
  hardFailures: number;
  requestBudget: {
    serverUnitBudget: number;
    softTimeoutMs: number;
    retryAfterMs: number;
    maxConcurrentBatches: number;
    batchMode: "table" | "detail" | "report" | "community";
  };
  degradationPolicy: {
    customerVisibleState: "normal" | "missing_evidence_banner" | "read_only_locked";
    chartRule: string;
    pdfRule: string;
    claimRule: string;
  };
  counters: {
    sourceBoundRatio: number;
    missingEvidenceRatio: number;
    failureRatio: number;
  };
  releaseGate: {
    status: "pass" | "warn" | "block";
    reasons: string[];
  };
  operatorActions: string[];
};

export const PASS2816_RUNTIME_OBSERVABILITY_ACCEPTANCE_GATES = [
  "Provider timeout, abort or circuit-open state must produce missing evidence / skeleton UI, not a fake live chart.",
  "Real Markets and Shield table batches must expose source-bound vs skeleton chart counts for operator debugging.",
  "PDF renderers must read runtime observability before drawing charts or paid source bundles.",
  "Community moderation queue must expose safe counters without storing raw post body in public telemetry.",
  "Circuit-open provider state must never unlock Pro/Advanced evidence; it can only lower confidence or lock the paid receipt lane.",
  "Runtime observability is metadata only: no API secrets, raw provider response bodies, private notes or user PII.",
] as const;

function ratio(part: number, total: number) {
  if (!total) return 0;
  return Math.round((part / total) * 10000) / 100;
}

function runtimeStateFor(args: {
  requestedUnits: number;
  sourceBoundUnits: number;
  skeletonOrMissingUnits: number;
  containedFailures: number;
  hardFailures: number;
}): Pass2816RuntimeState {
  if (args.hardFailures > 0 || (args.requestedUnits > 0 && args.sourceBoundUnits === 0 && args.skeletonOrMissingUnits >= args.requestedUnits)) {
    return "circuit_open";
  }
  if (args.containedFailures > 0 || args.skeletonOrMissingUnits > 0) return "degraded";
  return "healthy";
}

export function buildPass2816RuntimeObservabilityLedger(args: {
  surface: Pass2816Surface;
  tier?: VelmereTier;
  requestedUnits: number;
  sourceBoundUnits: number;
  skeletonOrMissingUnits: number;
  containedFailures?: number;
  hardFailures?: number;
  serverUnitBudget?: number;
  softTimeoutMs?: number;
  retryAfterMs?: number;
  maxConcurrentBatches?: number;
  batchMode?: Pass2816ProviderRunLedger["requestBudget"]["batchMode"];
  generatedAt?: string;
}): Pass2816ProviderRunLedger {
  const requestedUnits = Math.max(0, args.requestedUnits);
  const sourceBoundUnits = Math.max(0, Math.min(args.sourceBoundUnits, requestedUnits || args.sourceBoundUnits));
  const skeletonOrMissingUnits = Math.max(0, args.skeletonOrMissingUnits);
  const containedFailures = Math.max(0, args.containedFailures ?? 0);
  const hardFailures = Math.max(0, args.hardFailures ?? 0);
  const runtimeState = runtimeStateFor({ requestedUnits, sourceBoundUnits, skeletonOrMissingUnits, containedFailures, hardFailures });
  const reasons = [
    hardFailures > 0 ? `${hardFailures} hard failure(s) require blocking paid evidence` : null,
    runtimeState === "circuit_open" ? "no source-bound evidence available for requested runtime surface" : null,
    containedFailures > 0 ? `${containedFailures} provider failure(s) contained without route crash` : null,
    skeletonOrMissingUnits > 0 ? `${skeletonOrMissingUnits} unit(s) require missing evidence / skeleton rendering` : null,
  ].filter(Boolean) as string[];

  return {
    schemaVersion: "pass2816_runtime_observability_ledger_v1",
    surface: args.surface,
    tier: args.tier ?? "Basic",
    generatedAt: args.generatedAt ?? new Date().toISOString(),
    runtimeState,
    requestedUnits,
    sourceBoundUnits,
    skeletonOrMissingUnits,
    containedFailures,
    hardFailures,
    requestBudget: {
      serverUnitBudget: args.serverUnitBudget ?? Math.max(1, requestedUnits),
      softTimeoutMs: args.softTimeoutMs ?? 4800,
      retryAfterMs: args.retryAfterMs ?? 30000,
      maxConcurrentBatches: args.maxConcurrentBatches ?? 3,
      batchMode: args.batchMode ?? "report",
    },
    degradationPolicy: {
      customerVisibleState: runtimeState === "healthy" ? "normal" : runtimeState === "degraded" ? "missing_evidence_banner" : "read_only_locked",
      chartRule: "Render source-bound chart only with chart receipt; otherwise show neutral grey skeleton/unavailable state.",
      pdfRule: "PDF renderer must downgrade unavailable runtime data to missing evidence and block paid source bundle if integrity/runtime gate is not pass.",
      claimRule: "Runtime degraded/circuit-open state can never produce secure/safe/buy/sell claims; it only lowers confidence or locks paid evidence.",
    },
    counters: {
      sourceBoundRatio: ratio(sourceBoundUnits, requestedUnits),
      missingEvidenceRatio: ratio(skeletonOrMissingUnits, requestedUnits),
      failureRatio: ratio(containedFailures + hardFailures, requestedUnits || 1),
    },
    releaseGate: {
      status: hardFailures > 0 || runtimeState === "circuit_open" ? "block" : runtimeState === "degraded" ? "warn" : "pass",
      reasons,
    },
    operatorActions: [
      runtimeState === "healthy" ? "Continue normal receipt capture." : "Show visible missing-evidence state before verdict.",
      runtimeState === "circuit_open" ? "Keep Pro/Advanced paid evidence locked until a fresh source-bound receipt returns." : "Keep paid renderer tied to payload hash and source receipt root.",
      "Record only counters and hashes; never expose API secrets, raw provider bodies or private notes.",
    ],
  };
}

export function buildPass2816CommunityModerationObservability(args: {
  moderationState: "published" | "queued_for_review" | "blocked";
  bodyLength: number;
  tagCount: number;
  unsafeLinkBlocked?: boolean;
}) {
  const hardFailures = args.moderationState === "blocked" || args.unsafeLinkBlocked ? 1 : 0;
  return buildPass2816RuntimeObservabilityLedger({
    surface: "Community",
    tier: "Basic",
    requestedUnits: 1,
    sourceBoundUnits: args.moderationState === "published" ? 1 : 0,
    skeletonOrMissingUnits: args.moderationState === "queued_for_review" ? 1 : 0,
    containedFailures: args.moderationState === "queued_for_review" ? 1 : 0,
    hardFailures,
    serverUnitBudget: 8,
    softTimeoutMs: 1000,
    retryAfterMs: 60000,
    maxConcurrentBatches: 1,
    batchMode: "community",
  });
}
