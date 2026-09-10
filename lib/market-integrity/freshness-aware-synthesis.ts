import type { Pass607SourceManifestRow } from "./claim-source-completeness-gate";
import type {
  Pass623AtomicClaim,
  Pass623AtomicClaimDecomposition,
} from "./atomic-claim-decomposition";
import type { Pass624ProviderContradictionEngine } from "./provider-contradiction-engine";

export type Pass625Currentness = "current" | "last_known" | "unverified_current" | "not_applicable";

export type Pass625SynthesizedClaim = Pass623AtomicClaim & {
  currentness: Pass625Currentness;
  freshnessBudgetSeconds: number;
  ageSeconds: number | null;
  /** Evidence coverage after source freshness; not confidence. */
  sourceEvidenceCoverageCap: number;
  /** @deprecated Compatibility alias for sourceEvidenceCoverageCap. */
  sourceFreshnessCap: number;
  contradictionState: "aligned" | "watch" | "contradiction" | "insufficient";
  /** Evidence coverage after currentness and contradiction gates; not confidence. */
  synthesisEvidenceCoverageCap: number;
  /** @deprecated Compatibility alias for synthesisEvidenceCoverageCap. */
  synthesisConfidenceCap: number;
  currentnessReason: string;
};

export type Pass625FreshnessAwareSynthesis = {
  version: "freshness-aware-synthesis";
  assetClass: string;
  generatedAt: string;
  budgetSeconds: number;
  state: "current" | "mixed" | "stale" | "unverified";
  evidenceCoverageCap: number;
  /** @deprecated Compatibility alias for evidenceCoverageCap. */
  confidenceCap: number;
  currentFacts: Pass625SynthesizedClaim[];
  lastKnownFacts: Pass625SynthesizedClaim[];
  unverifiedCurrent: Pass625SynthesizedClaim[];
  notApplicable: Pass625SynthesizedClaim[];
  summary: string;
  boundary: string;
};

function clamp(value: number) {
  return Math.max(0, Math.min(100, Math.round(Number.isFinite(value) ? value : 0)));
}

function budgetFor(assetClass: string) {
  const normalized = assetClass.toLowerCase();
  if (normalized.includes("venue") || normalized.includes("crypto")) return 300;
  if (normalized.includes("fx")) return 129_600;
  if (normalized.includes("stock") || normalized.includes("equity")) return 1_800;
  if (normalized.includes("etf") || normalized.includes("commodity")) return 3_600;
  if (normalized.includes("reit") || normalized.includes("real_estate")) return 86_400;
  if (normalized.includes("filing")) return 2_592_000;
  if (normalized.includes("contract") || normalized.includes("document")) return 604_800;
  return 3_600;
}

function parseTime(value: string | null | undefined) {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function sourceRows(
  atom: Pass623AtomicClaim,
  manifest: Pass607SourceManifestRow[],
) {
  return atom.sourceIds
    .map((sourceId) => manifest.find((source) => source.sourceId === sourceId))
    .filter((source): source is Pass607SourceManifestRow => Boolean(source));
}

function claimContradiction(
  atom: Pass623AtomicClaim,
  contradictions: Pass624ProviderContradictionEngine,
) {
  const matches = contradictions.comparisons.filter(
    (comparison) => comparison.fieldId === atom.fieldId,
  );
  if (matches.some((comparison) => comparison.state === "contradiction")) return "contradiction" as const;
  if (matches.some((comparison) => comparison.state === "watch")) return "watch" as const;
  if (matches.length && matches.every((comparison) => comparison.state === "aligned")) return "aligned" as const;
  return "insufficient" as const;
}

function summaryFor(
  locale: "pl" | "de" | "en",
  state: Pass625FreshnessAwareSynthesis["state"],
  current: number,
  lastKnown: number,
  unverified: number,
) {
  const values = {
    pl: {
      current: `${current} faktów jest bieżących w budżecie świeżości.`,
      mixed: `${current} faktów jest bieżących, ${lastKnown} pozostaje ostatnim znanym stanem, a ${unverified} wymaga potwierdzenia.`,
      stale: `Dostępne fakty są ostatnim znanym stanem; bieżący obraz nie został potwierdzony.`,
      unverified: `Bieżący stan nie ma wystarczającego źródła, timestampu albo zgodności providerów.`,
    },
    de: {
      current: `${current} Fakten liegen innerhalb des Aktualitätsbudgets.`,
      mixed: `${current} Fakten sind aktuell, ${lastKnown} bleiben letzter bekannter Stand und ${unverified} brauchen Bestätigung.`,
      stale: `Die verfügbaren Fakten sind nur der letzte bekannte Stand; der aktuelle Zustand ist nicht bestätigt.`,
      unverified: `Der aktuelle Zustand besitzt keine ausreichende Quelle, keinen Zeitstempel oder keine Provider-Übereinstimmung.`,
    },
    en: {
      current: `${current} facts are inside the freshness budget.`,
      mixed: `${current} facts are current, ${lastKnown} remain last-known, and ${unverified} require confirmation.`,
      stale: `Available facts are last-known only; the current state is not confirmed.`,
      unverified: `The current state lacks a sufficient source, timestamp, or provider agreement.`,
    },
  } as const;
  return values[locale][state];
}

export function buildPass625FreshnessAwareSynthesis(input: {
  locale?: string;
  assetClass: string;
  generatedAt: string;
  atomicClaims: Pass623AtomicClaimDecomposition;
  sourceManifest: Pass607SourceManifestRow[];
  contradiction: Pass624ProviderContradictionEngine;
}): Pass625FreshnessAwareSynthesis {
  const locale = input.locale === "de" || input.locale === "en" ? input.locale : "pl";
  const generatedMs = parseTime(input.generatedAt) ?? 0;
  const budgetSeconds = budgetFor(input.assetClass);
  const claims = input.atomicClaims.atoms.map<Pass625SynthesizedClaim>((atom) => {
    const linkedSources = sourceRows(atom, input.sourceManifest);
    const times = linkedSources
      .map((source) => parseTime(source.observedAt))
      .filter((value): value is number => value !== null);
    const newest = times.length ? Math.max(...times) : parseTime(atom.observedAt);
    const ageSeconds = newest === null || generatedMs === 0
      ? null
      : Math.max(0, Math.round((generatedMs - newest) / 1000));
    const sourceEvidenceCoverageCap = linkedSources.length
      ? Math.min(...linkedSources.map((source) => source.evidenceCoverageCap))
      : 0;
    const contradictionState = claimContradiction(atom, input.contradiction);
    let currentness: Pass625Currentness;
    let currentnessReason: string;
    if (atom.kind === "not_applicable") {
      currentness = "not_applicable";
      currentnessReason = "The field is outside the applicable evidence scope.";
    } else if (
      atom.status === "blocked" ||
      atom.kind === "boundary" ||
      contradictionState === "contradiction" ||
      linkedSources.length === 0 ||
      ageSeconds === null
    ) {
      currentness = "unverified_current";
      currentnessReason = contradictionState === "contradiction"
        ? "Provider contradiction blocks a current factual statement."
        : "The current state lacks a complete source-and-timestamp path.";
    } else if (ageSeconds > budgetSeconds) {
      currentness = "last_known";
      currentnessReason = "The observation is valid only as the last known fact outside the freshness budget.";
    } else if (atom.kind === "fact" && contradictionState !== "watch") {
      currentness = "current";
      currentnessReason = "The fact is source-linked, timestamped and inside the asset-class freshness budget.";
    } else {
      currentness = "unverified_current";
      currentnessReason = "The value is recent but remains bounded, hypothetical or under provider review.";
    }
    const currentnessCap = currentness === "current"
      ? 92
      : currentness === "last_known"
        ? 58
        : currentness === "unverified_current"
          ? 42
          : 100;
    const contradictionCap = contradictionState === "aligned"
      ? 92
      : contradictionState === "watch"
        ? 68
        : contradictionState === "contradiction"
          ? 38
          : 64;
    return {
      ...atom,
      currentness,
      freshnessBudgetSeconds: budgetSeconds,
      ageSeconds,
      sourceEvidenceCoverageCap,
      sourceFreshnessCap: sourceEvidenceCoverageCap,
      contradictionState,
      synthesisEvidenceCoverageCap: Math.min(
        atom.confidenceCap,
        sourceEvidenceCoverageCap || currentnessCap,
        currentnessCap,
        contradictionCap,
      ),
      synthesisConfidenceCap: Math.min(
        atom.confidenceCap,
        sourceEvidenceCoverageCap || currentnessCap,
        currentnessCap,
        contradictionCap,
      ),
      currentnessReason,
    };
  });
  const currentFacts = claims.filter((claim) => claim.currentness === "current");
  const lastKnownFacts = claims.filter((claim) => claim.currentness === "last_known");
  const unverifiedCurrent = claims.filter(
    (claim) => claim.currentness === "unverified_current",
  );
  const notApplicable = claims.filter(
    (claim) => claim.currentness === "not_applicable",
  );
  const state: Pass625FreshnessAwareSynthesis["state"] = currentFacts.length && !lastKnownFacts.length && !unverifiedCurrent.length
    ? "current"
    : currentFacts.length
      ? "mixed"
      : lastKnownFacts.length
        ? "stale"
        : "unverified";
  const scored = claims.filter((claim) => claim.currentness !== "not_applicable");
  const evidenceCoverageCap = scored.length
    ? Math.min(...scored.map((claim) => claim.synthesisEvidenceCoverageCap))
    : 0;
  const confidenceCap = evidenceCoverageCap;

  return {
    version: "freshness-aware-synthesis",
    assetClass: input.assetClass,
    generatedAt: new Date(generatedMs || 0).toISOString(),
    budgetSeconds,
    state,
    evidenceCoverageCap: clamp(evidenceCoverageCap),
    confidenceCap: clamp(confidenceCap),
    currentFacts,
    lastKnownFacts,
    unverifiedCurrent,
    notApplicable,
    summary: summaryFor(
      locale,
      state,
      currentFacts.length,
      lastKnownFacts.length,
      unverifiedCurrent.length,
    ),
    boundary:
      "Old observations may remain visible as last-known facts, but they cannot increase evidence coverage for the current verdict. Current and last-known states are never merged into one sentence. This synthesis does not publish calibrated confidence.",
  };
}
