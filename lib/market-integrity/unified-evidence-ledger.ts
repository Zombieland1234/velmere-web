import { sha256Token } from "@/lib/security/cryptographic-digest";
import type { Pass607ClaimSourceCompletenessGate } from "./claim-source-completeness-gate";
import type { Pass610ReaderDownloadParityManifest } from "./reader-download-parity-manifest";
import type { Pass623AtomicClaimDecomposition } from "./atomic-claim-decomposition";
import type { Pass625FreshnessAwareSynthesis } from "./freshness-aware-synthesis";
import type { Pass626HumanNextCheckPlanner } from "./human-next-check-planner";

export type Pass646Surface = "browser" | "pdf" | "shield" | "map" | "brain" | "real_markets";

export type Pass646UnifiedEvidenceLedger = {
  version: "unified-evidence-ledger";
  state: "locked" | "review" | "blocked";
  reportId: string;
  snapshotId: string;
  locale: "pl" | "de" | "en";
  depth: "basic" | "pro" | "advanced";
  generatedAt: string;
  sourceLedger: Array<{
    sourceId: `S${string}`;
    label: string;
    state: string;
    observedAt: string | null;
    freshnessState: string;
    confidenceCap: number;
  }>;
  claimLedger: Array<{
    atomId: `A${string}`;
    fieldId: string;
    statement: string;
    currentness: "current" | "last_known" | "unverified_current" | "not_applicable";
    sourceIds: Array<`S${string}`>;
    observedAt: string | null;
    confidenceCap: number;
    blockers: string[];
  }>;
  surfaceHandoff: Record<Pass646Surface, {
    reportId: string;
    snapshotId: string;
    manifestKey: string;
    depth: "basic" | "pro" | "advanced";
    locale: "pl" | "de" | "en";
    evidenceKey: string;
  }>;
  primaryNextAction: string | null;
  duplicateSourceIds: string[];
  duplicateAtomIds: string[];
  orphanClaimIds: string[];
  evidenceKey: string;
  boundary: string;
};

function hash(value: string) {
  return sha256Token(value, 24);
}

function duplicates(values: string[]) {
  const counts = new Map<string, number>();
  for (const value of values) counts.set(value, (counts.get(value) || 0) + 1);
  return Array.from(counts.entries()).filter(([, count]) => count > 1).map(([value]) => value);
}

export function buildPass646UnifiedEvidenceLedger(input: {
  reportId: string;
  generatedAt: string;
  parity: Pass610ReaderDownloadParityManifest;
  claimGate: Pass607ClaimSourceCompletenessGate;
  atomicClaims: Pass623AtomicClaimDecomposition;
  synthesis: Pass625FreshnessAwareSynthesis;
  planner: Pass626HumanNextCheckPlanner;
}): Pass646UnifiedEvidenceLedger {
  const sourceLedger = input.claimGate.sources.map((source) => ({
    sourceId: source.sourceId,
    label: source.label,
    state: source.state,
    observedAt: source.observedAt,
    freshnessState: source.freshnessState,
    confidenceCap: source.confidenceCap,
  }));
  const synthesized = new Map(
    [
      ...input.synthesis.currentFacts,
      ...input.synthesis.lastKnownFacts,
      ...input.synthesis.unverifiedCurrent,
      ...input.synthesis.notApplicable,
    ].map((claim) => [claim.atomId, claim]),
  );
  const claimLedger = input.atomicClaims.atoms.map((atom) => {
    const current = synthesized.get(atom.atomId);
    return {
      atomId: atom.atomId,
      fieldId: atom.fieldId,
      statement: atom.statement,
      currentness: current?.currentness ?? (atom.kind === "not_applicable" ? "not_applicable" : "unverified_current"),
      sourceIds: [...atom.sourceIds],
      observedAt: current?.observedAt ?? atom.observedAt,
      confidenceCap: current?.synthesisConfidenceCap ?? atom.confidenceCap,
      blockers: [...atom.blockers],
    };
  });
  const sourceIds = sourceLedger.map((source) => source.sourceId);
  const atomIds = claimLedger.map((claim) => claim.atomId);
  const sourceSet = new Set(sourceIds);
  const orphanClaimIds = claimLedger
    .filter((claim) => claim.sourceIds.some((sourceId) => !sourceSet.has(sourceId)))
    .map((claim) => claim.atomId);
  const duplicateSourceIds = duplicates(sourceIds);
  const duplicateAtomIds = duplicates(atomIds);
  const snapshotId = `VLM-SNAP-${hash([
    input.reportId,
    input.generatedAt,
    ...sourceLedger.map((source) => `${source.sourceId}:${source.observedAt || "none"}:${source.state}`),
  ].join("|"))}`;
  const evidenceKey = `VLM-LEDGER-${hash([
    snapshotId,
    input.parity.manifestKey,
    ...claimLedger.map((claim) => `${claim.atomId}:${claim.currentness}:${claim.confidenceCap}:${claim.sourceIds.join(",")}`),
  ].join("|"))}`;
  const surfaces: Pass646Surface[] = ["browser", "pdf", "shield", "map", "brain", "real_markets"];
  const surfaceHandoff = Object.fromEntries(
    surfaces.map((surface) => [surface, {
      reportId: input.reportId,
      snapshotId,
      manifestKey: input.parity.manifestKey,
      depth: input.parity.depth,
      locale: input.parity.locale,
      evidenceKey,
    }]),
  ) as Pass646UnifiedEvidenceLedger["surfaceHandoff"];
  const blocked = duplicateSourceIds.length || duplicateAtomIds.length || orphanClaimIds.length;
  const state: Pass646UnifiedEvidenceLedger["state"] = blocked
    ? "blocked"
    : input.parity.state === "locked" && input.claimGate.state !== "blocked"
      ? "locked"
      : "review";
  return {
    version: "unified-evidence-ledger",
    state,
    reportId: input.reportId,
    snapshotId,
    locale: input.parity.locale,
    depth: input.parity.depth,
    generatedAt: input.generatedAt,
    sourceLedger,
    claimLedger,
    surfaceHandoff,
    primaryNextAction: input.planner.primaryAction?.action ?? null,
    duplicateSourceIds,
    duplicateAtomIds,
    orphanClaimIds,
    evidenceKey,
    boundary:
      "Every surface receives the same report ID, snapshot ID, manifest key, locale, analysis depth and evidence key. Handoff may change layout, never evidence identity or confidence limits.",
  };
}
