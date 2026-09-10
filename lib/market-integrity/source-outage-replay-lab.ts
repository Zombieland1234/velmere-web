import { sha256Token } from "../security/cryptographic-digest";
import type { Pass607ClaimSourceCompletenessGate } from "./claim-source-completeness-gate";
import type { Pass623AtomicClaimDecomposition } from "./atomic-claim-decomposition";

export type Pass644ReplayState = "live" | "partial" | "stale" | "fallback" | "offline";
export type Pass644Surface = "browser" | "pdf" | "shield" | "map" | "brain";

export type Pass644SourceOutageReplayLab = {
  version: "source-outage-replay-lab";
  state: "deterministic" | "review" | "blocked";
  currentEvidenceKey: string;
  scenarios: Array<{
    id: `outage-${Pass644ReplayState}`;
    sourceState: Pass644ReplayState;
    confidenceCap: number;
    claimPolicy: "retain" | "bound" | "last_known" | "fallback_only" | "block_current";
    expectedSurfaceDigest: string;
    surfaces: Record<Pass644Surface, {
      sourceState: Pass644ReplayState;
      confidenceCap: number;
      currentClaimAllowed: boolean;
      digest: string;
    }>;
  }>;
  consistencyFailures: string[];
  boundary: string;
};

const CAPS: Record<Pass644ReplayState, number> = {
  live: 92,
  partial: 70,
  stale: 52,
  fallback: 40,
  offline: 18,
};

function hash(value: string) {
  return sha256Token(value, 16);
}

function policyFor(state: Pass644ReplayState) {
  if (state === "live") return "retain" as const;
  if (state === "partial") return "bound" as const;
  if (state === "stale") return "last_known" as const;
  if (state === "fallback") return "fallback_only" as const;
  return "block_current" as const;
}

export function buildPass644SourceOutageReplayLab(input: {
  reportId: string;
  claimGate: Pass607ClaimSourceCompletenessGate;
  atomicClaims: Pass623AtomicClaimDecomposition;
}): Pass644SourceOutageReplayLab {
  const currentEvidenceKey = `VLM-EV-${hash([
    input.reportId,
    ...input.claimGate.sources.map((source) => `${source.sourceId}:${source.state}:${source.observedAt || "none"}`),
    ...input.atomicClaims.atoms.map((atom) => `${atom.atomId}:${atom.status}:${atom.confidenceCap}`),
  ].join("|"))}`;
  const surfaces: Pass644Surface[] = ["browser", "pdf", "shield", "map", "brain"];
  const scenarios = (["live", "partial", "stale", "fallback", "offline"] as const).map((sourceState) => {
    const confidenceCap = Math.min(input.claimGate.confidenceCap, CAPS[sourceState]);
    const currentClaimAllowed = sourceState === "live" || sourceState === "partial";
    const digest = `R-${hash(`${currentEvidenceKey}|${sourceState}|${confidenceCap}|${currentClaimAllowed}`)}`;
    return {
      id: `outage-${sourceState}` as const,
      sourceState,
      confidenceCap,
      claimPolicy: policyFor(sourceState),
      expectedSurfaceDigest: digest,
      surfaces: Object.fromEntries(
        surfaces.map((surface) => [surface, {
          sourceState,
          confidenceCap,
          currentClaimAllowed,
          digest,
        }]),
      ) as Pass644SourceOutageReplayLab["scenarios"][number]["surfaces"],
    };
  });
  const consistencyFailures = scenarios.flatMap((scenario) => {
    const digests = Object.values(scenario.surfaces).map((surface) => surface.digest);
    const states = Object.values(scenario.surfaces).map((surface) => surface.sourceState);
    return [
      ...(new Set(digests).size === 1 ? [] : [`${scenario.id}:surface_digest_mismatch`]),
      ...(new Set(states).size === 1 ? [] : [`${scenario.id}:source_state_mismatch`]),
    ];
  });
  return {
    version: "source-outage-replay-lab",
    state: consistencyFailures.length ? "blocked" : scenarios.length === 5 ? "deterministic" : "review",
    currentEvidenceKey,
    scenarios,
    consistencyFailures,
    boundary:
      "A provider outage changes state and confidence once in the shared ledger. Browser, PDF, Shield, Map and Brain replay that same receipt instead of inventing surface-specific truth.",
  };
}
