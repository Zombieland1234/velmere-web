import { sha256Token } from "../security/cryptographic-digest";
import type { Pass478HumanEvidenceBrief } from "./human-evidence-brief";
import type {
  Pass607ClaimSourceCompletenessGate,
  Pass607ClaimState,
} from "./claim-source-completeness-gate";

export type Pass623AtomicClaimKind = "fact" | "hypothesis" | "boundary" | "not_applicable";

export type Pass623AtomicClaim = {
  atomId: `A${string}`;
  fieldId: string;
  statement: string;
  meaning: string;
  kind: Pass623AtomicClaimKind;
  status: Pass607ClaimState;
  sourceIds: Array<`S${string}`>;
  observedAt: string | null;
  confidenceCap: number;
  blockers: string[];
  immutableKey: string;
};

export type Pass623AtomicClaimDecomposition = {
  version: "atomic-claim-decomposition";
  reportId: string;
  generatedAt: string;
  atoms: Pass623AtomicClaim[];
  factCount: number;
  hypothesisCount: number;
  blockedCount: number;
  duplicateAtomIds: string[];
  state: "atomic" | "review" | "blocked";
  manifestKey: string;
  boundary: string;
};

function clean(value: string, max: number) {
  return value.replace(/\s+/g, " ").trim().slice(0, max);
}

function stableHash(value: string) {
  return sha256Token(value, 16);
}

function kindFor(status: Pass607ClaimState): Pass623AtomicClaimKind {
  if (status === "confirmed") return "fact";
  if (status === "not_applicable") return "not_applicable";
  if (status === "blocked") return "boundary";
  return "hypothesis";
}

export function buildPass623AtomicClaimDecomposition(input: {
  reportId: string;
  generatedAt: string;
  brief: Pass478HumanEvidenceBrief;
  claimGate: Pass607ClaimSourceCompletenessGate;
}): Pass623AtomicClaimDecomposition {
  const reportId = clean(input.reportId || "velmere-report", 96);
  const generated = new Date(input.generatedAt);
  const generatedAt = Number.isNaN(generated.getTime())
    ? new Date(0).toISOString()
    : generated.toISOString();
  const sourceTimes = new Map(
    input.claimGate.sources.map((source) => [source.sourceId, source.observedAt]),
  );
  const atoms = input.claimGate.claims.map<Pass623AtomicClaim>((claim, index) => {
    const briefClaim =
      input.brief.claims.find((candidate) => candidate.id === claim.fieldId) ||
      input.brief.claims[index];
    const identity = [
      reportId,
      claim.fieldId,
      clean(claim.label, 120).toLowerCase(),
    ].join("|");
    const observedCandidates = claim.sourceIds
      .map((sourceId) => sourceTimes.get(sourceId))
      .filter((value): value is string => Boolean(value))
      .sort();
    return {
      atomId: `A${stableHash(identity).toUpperCase()}`,
      fieldId: claim.fieldId,
      statement: clean(`${claim.label}: ${claim.value}`, 280),
      meaning: clean(briefClaim?.meaning || "", 320),
      kind: kindFor(claim.state),
      status: claim.state,
      sourceIds: [...claim.sourceIds],
      observedAt: observedCandidates.at(-1) || null,
      confidenceCap: Math.max(0, Math.min(100, Math.round(claim.confidenceCap))),
      blockers: Array.from(new Set(claim.blockers)),
      immutableKey: `${reportId}:${claim.fieldId}:${stableHash(identity)}`,
    };
  });
  const atomCounts = new Map<string, number>();
  for (const atom of atoms) {
    atomCounts.set(atom.atomId, (atomCounts.get(atom.atomId) || 0) + 1);
  }
  const duplicateAtomIds = Array.from(atomCounts.entries())
    .filter(([, count]) => count > 1)
    .map(([id]) => id);
  const blockedCount = atoms.filter(
    (atom) => atom.status === "blocked" || atom.kind === "boundary",
  ).length;
  const state = duplicateAtomIds.length
    ? "blocked"
    : blockedCount
      ? "review"
      : "atomic";
  const manifestKey = `pass623-${stableHash(
    atoms
      .map(
        (atom) =>
          `${atom.atomId}:${atom.kind}:${atom.status}:${atom.sourceIds.join(",")}:${atom.confidenceCap}`,
      )
      .join("|"),
  )}`;

  return {
    version: "atomic-claim-decomposition",
    reportId,
    generatedAt,
    atoms,
    factCount: atoms.filter((atom) => atom.kind === "fact").length,
    hypothesisCount: atoms.filter((atom) => atom.kind === "hypothesis").length,
    blockedCount,
    duplicateAtomIds,
    state,
    manifestKey,
    boundary:
      "Each atom contains one statement only. Facts, hypotheses, limitations and next checks remain separate so a polished paragraph cannot hide mixed evidence states.",
  };
}
