import type { VlmBrainOutput, VlmDepth, VlmLocale, VlmSurface } from "./vlm-contract";
import type { VlmAnalysisReceipt } from "./vlm-analysis-receipt";
import type { VlmCanonicalFactPacket } from "./vlm-fact-packet";
import type { VlmTierDifferentiationContract } from "./vlm-tier-differentiation";
import { boundedNumber, sanitizeIdentifier, sanitizeVlmText, stableHash } from "./vlm-security";

export const PASS2786_EVIDENCE_CAPSULE_SCHEMA_ID = "pass2786-evidence-capsule-schema-v1" as const;

export type VlmEvidenceCapsuleSupportState = "confirmed" | "missing" | "weak" | "stale" | "conflict" | "internal";

export type VlmEvidenceCapsuleRow = {
  rowId: string;
  lane: string;
  label: string;
  value: string | number | null;
  sourceIds: string[];
  freshness: "fresh" | "aging" | "stale" | "unknown";
  supportState: VlmEvidenceCapsuleSupportState;
  evidenceWeight: number;
};

export type VlmEvidenceCapsuleSourceLineage = {
  sourceId: string;
  provider: string;
  label: string;
  observedAt: string | null;
  quality: number;
  usedByFactIds: string[];
  freshness: "fresh" | "aging" | "stale" | "unknown";
};

export type VlmEvidenceCapsuleContradictionRow = {
  rowId: string;
  description: string;
  sourceIds: string[];
  severity: "watch" | "review" | "block";
};

export type VlmEvidenceCapsule = {
  schemaVersion: typeof PASS2786_EVIDENCE_CAPSULE_SCHEMA_ID;
  capsuleId: string;
  replayId: string;
  traceId: string;
  generatedAt: string;
  locale: VlmLocale;
  depth: VlmDepth;
  surface: VlmSurface;
  asset: VlmCanonicalFactPacket["asset"];
  status: VlmCanonicalFactPacket["verdictGovernor"]["status"];
  riskScore: number;
  confidenceScore: number;
  confidenceCap: number;
  riskConfidenceDelta: number;
  receiptHash: string;
  contextHash: string;
  sourceLineage: VlmEvidenceCapsuleSourceLineage[];
  auditEvidenceRows: VlmEvidenceCapsuleRow[];
  contradictionRows: VlmEvidenceCapsuleContradictionRow[];
  missingProof: string[];
  nextChecks: string[];
  exportPolicy: {
    access: VlmTierDifferentiationContract["access"];
    requiresServerReceipt: boolean;
    maxEvidenceRows: number;
    maxSources: number;
    includesProofCapsule: boolean;
    includesOperatorAppendix: boolean;
    proCannotLeakAdvanced: boolean;
    publicRule: string;
  };
  integrity: {
    sourceQuorum: VlmCanonicalFactPacket["sourceArbitration"]["evidenceQuorum"]["status"];
    sourceIntegrity: VlmCanonicalFactPacket["sourceArbitration"]["sourceIntegrity"]["status"];
    temporalConsistency: VlmCanonicalFactPacket["sourceArbitration"]["temporalConsistency"]["status"];
    outputHashBound: string;
    factsHashBound: string;
    sourcesHashBound: string;
  };
};

function sourceFreshness(observedAt: string | null): "fresh" | "aging" | "stale" | "unknown" {
  if (!observedAt) return "unknown";
  const time = Date.parse(observedAt);
  if (!Number.isFinite(time)) return "unknown";
  const age = Date.now() - time;
  if (age < 0) return "unknown";
  if (age <= 15 * 60_000) return "fresh";
  if (age <= 6 * 60 * 60_000) return "aging";
  return "stale";
}

function rowSupportState(args: {
  value: string | number | null;
  sourceIds: string[];
  freshness: "fresh" | "aging" | "stale" | "unknown";
  weakFactIds: string[];
  factId: string;
  conflictSourceIds: Set<string>;
}): VlmEvidenceCapsuleSupportState {
  if (args.value === null || args.value === "") return "missing";
  if (args.conflictSourceIds.size && args.sourceIds.some((sourceId) => args.conflictSourceIds.has(sourceId))) return "conflict";
  if (args.weakFactIds.includes(args.factId)) return "weak";
  if (args.freshness === "stale") return "stale";
  if (args.sourceIds.length === 0 || args.sourceIds.every((sourceId) => sourceId === "internal:risk-engine")) return "internal";
  return "confirmed";
}

function evidenceWeight(state: VlmEvidenceCapsuleSupportState, freshness: VlmEvidenceCapsuleRow["freshness"], quality: number) {
  const stateBase: Record<VlmEvidenceCapsuleSupportState, number> = {
    confirmed: 86,
    internal: 54,
    weak: 38,
    stale: 30,
    conflict: 18,
    missing: 0,
  };
  const freshnessPenalty = freshness === "fresh" ? 0 : freshness === "aging" ? 8 : freshness === "stale" ? 22 : 14;
  return Math.round(boundedNumber(Math.min(stateBase[state], quality || stateBase[state]) - freshnessPenalty, 0, 100, 0));
}

function tierLimits(depth: VlmDepth) {
  if (depth === "advanced") return { rows: 20, sources: 16, missing: 16, next: 12, contradictions: 10 };
  if (depth === "pro") return { rows: 10, sources: 8, missing: 10, next: 6, contradictions: 4 };
  return { rows: 5, sources: 4, missing: 6, next: 4, contradictions: 2 };
}

export function buildVlmEvidenceCapsule(input: {
  packet: VlmCanonicalFactPacket;
  output: VlmBrainOutput;
  receipt: VlmAnalysisReceipt;
  depth: VlmDepth;
  surface: VlmSurface;
  locale: VlmLocale;
  tierContract: VlmTierDifferentiationContract;
}): VlmEvidenceCapsule {
  const limit = tierLimits(input.depth);
  const packet = input.packet;
  const sourceById = new Map(packet.sources.map((source) => [source.id, source]));
  const usedByFact = new Map<string, string[]>();
  for (const fact of packet.facts) {
    for (const sourceId of fact.sourceIds) {
      const list = usedByFact.get(sourceId) ?? [];
      list.push(fact.id);
      usedByFact.set(sourceId, Array.from(new Set(list)));
    }
  }
  const conflictSourceIds = new Set(packet.conflicts.flatMap((conflict) => conflict.sourceIds));
  const weakFactIds = packet.sourceArbitration.evidenceQuorum.weakFactIds;
  const sourceLineage = packet.sources.slice(0, limit.sources).map((source) => ({
    sourceId: source.id,
    provider: sanitizeVlmText(source.provider, 100),
    label: sanitizeVlmText(source.label, 180),
    observedAt: source.observedAt,
    quality: Math.round(boundedNumber(source.quality, 0, 100, 0)),
    usedByFactIds: (usedByFact.get(source.id) ?? []).slice(0, 12),
    freshness: sourceFreshness(source.observedAt),
  }));

  const auditEvidenceRows = packet.facts.slice(0, limit.rows).map((fact, index) => {
    const rowFreshness = fact.freshness;
    const state = rowSupportState({
      value: fact.value,
      sourceIds: fact.sourceIds,
      freshness: rowFreshness,
      weakFactIds,
      factId: fact.id,
      conflictSourceIds,
    });
    const averageQuality = fact.sourceIds.length
      ? fact.sourceIds.reduce((sum: number, sourceId: string) => sum + (sourceById.get(sourceId)?.quality ?? 0), 0) / fact.sourceIds.length
      : state === "internal" ? 54 : 0;
    return {
      rowId: sanitizeIdentifier(`evr:${input.receipt.traceId}:${index + 1}:${fact.id}`, `evr:${index + 1}`, 140),
      lane: sanitizeIdentifier(fact.id, `fact-${index + 1}`, 100),
      label: sanitizeVlmText(fact.label, 180),
      value: fact.value,
      sourceIds: fact.sourceIds.slice(0, 8),
      freshness: rowFreshness,
      supportState: state,
      evidenceWeight: evidenceWeight(state, rowFreshness, averageQuality),
    } satisfies VlmEvidenceCapsuleRow;
  });

  const contradictionRows = packet.conflicts.slice(0, limit.contradictions).map((conflict, index) => ({
    rowId: sanitizeIdentifier(`ctr:${input.receipt.traceId}:${index + 1}`, `ctr:${index + 1}`, 120),
    description: sanitizeVlmText(conflict.description, 500),
    sourceIds: conflict.sourceIds.slice(0, 8),
    severity: packet.verdictGovernor.status === "blocked" ? "block" : packet.verdictGovernor.status === "operator_review" ? "review" : "watch",
  } satisfies VlmEvidenceCapsuleContradictionRow));

  const missingProof = Array.from(new Set([
    ...packet.verdictGovernor.missingProofLanes,
    ...packet.missingData,
    ...input.output.missingData,
  ].map((item) => sanitizeVlmText(item, 260)).filter(Boolean))).slice(0, limit.missing);
  const nextChecks = Array.from(new Set([
    ...packet.nextChecks,
    ...input.output.nextChecks,
  ].map((item) => sanitizeVlmText(item, 320)).filter(Boolean))).slice(0, limit.next);

  const contextHash = stableHash({
    asset: packet.asset,
    depth: input.depth,
    surface: input.surface,
    locale: input.locale,
    receiptId: input.receipt.receiptId,
    factsHash: input.receipt.factsHash,
    sourcesHash: input.receipt.sourcesHash,
    packetHash: input.receipt.packetHash,
    outputHash: input.receipt.outputHash,
  });
  const replayId = `vlmreplay_${stableHash({ receiptId: input.receipt.receiptId, contextHash }).slice(0, 20)}`;
  const receiptHash = stableHash({
    receiptId: input.receipt.receiptId,
    traceId: input.receipt.traceId,
    factsHash: input.receipt.factsHash,
    sourcesHash: input.receipt.sourcesHash,
    packetHash: input.receipt.packetHash,
    outputHash: input.receipt.outputHash,
    policyHash: input.receipt.policyHash,
    signing: input.receipt.signing,
    keyId: input.receipt.keyId,
  });
  const capsuleId = `vlmcap_${stableHash({ replayId, contextHash, depth: input.depth, sourceLineage, auditEvidenceRows, contradictionRows, missingProof }).slice(0, 24)}`;

  return {
    schemaVersion: PASS2786_EVIDENCE_CAPSULE_SCHEMA_ID,
    capsuleId,
    replayId,
    traceId: input.receipt.traceId,
    generatedAt: input.output.generatedAt,
    locale: input.locale,
    depth: input.depth,
    surface: input.surface,
    asset: packet.asset,
    status: packet.verdictGovernor.status,
    riskScore: packet.verdictGovernor.riskScore,
    confidenceScore: packet.verdictGovernor.confidenceScore,
    confidenceCap: Math.min(packet.confidenceCap, input.output.confidence),
    riskConfidenceDelta: packet.verdictGovernor.riskConfidenceDelta,
    receiptHash,
    contextHash,
    sourceLineage,
    auditEvidenceRows,
    contradictionRows,
    missingProof,
    nextChecks,
    exportPolicy: {
      access: input.tierContract.access,
      requiresServerReceipt: input.depth !== "basic",
      maxEvidenceRows: limit.rows,
      maxSources: limit.sources,
      includesProofCapsule: input.tierContract.pdfBudget.includesProofCapsule,
      includesOperatorAppendix: input.tierContract.pdfBudget.includesAppendix,
      proCannotLeakAdvanced: input.depth === "pro",
      publicRule: "One capsule feeds Brain, Angel, PDF and Audit. Unsupported claims must become missingProof rows, not confident conclusions.",
    },
    integrity: {
      sourceQuorum: packet.sourceArbitration.evidenceQuorum.status,
      sourceIntegrity: packet.sourceArbitration.sourceIntegrity.status,
      temporalConsistency: packet.sourceArbitration.temporalConsistency.status,
      outputHashBound: input.receipt.outputHash,
      factsHashBound: input.receipt.factsHash,
      sourcesHashBound: input.receipt.sourcesHash,
    },
  };
}

export function summarizeVlmEvidenceCapsule(capsule: VlmEvidenceCapsule) {
  const confirmedRows = capsule.auditEvidenceRows.filter((row) => row.supportState === "confirmed").length;
  const missingRows = capsule.auditEvidenceRows.filter((row) => row.supportState === "missing").length;
  const weakRows = capsule.auditEvidenceRows.filter((row) => row.supportState === "weak" || row.supportState === "stale" || row.supportState === "conflict").length;
  return {
    schemaVersion: capsule.schemaVersion,
    capsuleId: capsule.capsuleId,
    replayId: capsule.replayId,
    depth: capsule.depth,
    status: capsule.status,
    sourceLineageRows: capsule.sourceLineage.length,
    evidenceRows: capsule.auditEvidenceRows.length,
    confirmedRows,
    weakRows,
    missingRows,
    missingProofRows: capsule.missingProof.length,
    confidenceCap: capsule.confidenceCap,
    riskConfidenceDelta: capsule.riskConfidenceDelta,
    exportPolicy: capsule.exportPolicy,
  };
}

// PASS2786 markers: evidence capsule schema · sourceLineage · auditEvidenceRows · contradictionRows · missingProof · nextChecks · confidenceCap · receiptHash · contextHash · replayId · Brain Angel PDF Audit shared proof payload
