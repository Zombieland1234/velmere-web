import type { Pass608MissingSourceAppendix } from "./missing-source-appendix";
import type { Pass622SourceRegistry } from "./source-registry";
import type { Pass624ProviderContradictionEngine } from "./provider-contradiction-engine";
import type { Pass625FreshnessAwareSynthesis } from "./freshness-aware-synthesis";

export type Pass626CheckTask = {
  taskId: `T${string}`;
  rank: number;
  action: string;
  reason: string;
  linkedClaimIds: string[];
  providerIds: string[];
  internalRoute: string | null;
  impact: "high" | "medium" | "low";
  effort: "low" | "medium" | "high";
  availability: "ready" | "configuration_required" | "unavailable";
  score: number;
  completionEvidence: string;
};

export type Pass626HumanNextCheckPlanner = {
  version: "human-next-check-planner";
  locale: "pl" | "de" | "en";
  state: "clear" | "action_required" | "blocked";
  tasks: Pass626CheckTask[];
  primaryAction: Pass626CheckTask | null;
  deferredCount: number;
  genericActionCount: number;
  boundary: string;
};

function localeOf(value: string): "pl" | "de" | "en" {
  return value === "de" || value === "en" ? value : "pl";
}

function clean(value: string, max = 260) {
  return value.replace(/\s+/g, " ").trim().slice(0, max);
}

function impactWeight(impact: "high" | "medium" | "low") {
  return impact === "high" ? 100 : impact === "medium" ? 66 : 36;
}

function effortFor(action: string): "low" | "medium" | "high" {
  const normalized = action.toLowerCase();
  if (/filing|holder|unlock|reserve|orderbook|depth|slippage|on-chain|onchain/.test(normalized)) return "high";
  if (/second|provider|compare|porówn|vergleich|refresh|snapshot|timestamp/.test(normalized)) return "medium";
  return "low";
}

function actionCopy(locale: "pl" | "de" | "en", kind: "contradiction" | "freshness" | "source") {
  const copy = {
    pl: {
      contradiction: "Pobierz oba snapshoty dla tej samej chwili, porównaj jednostkę i zachowaj oba wyniki w lineage.",
      freshness: "Odśwież wskazane źródło i zapisz provider timestamp przed ponowną syntezą.",
      source: "Dołącz niezależne źródło z timestampem i ponownie przelicz limit pewności claimu.",
    },
    de: {
      contradiction: "Beide Snapshots für denselben Zeitpunkt abrufen, Einheit vergleichen und beide Ergebnisse im Lineage behalten.",
      freshness: "Die angegebene Quelle aktualisieren und den Provider-Zeitstempel vor der neuen Synthese speichern.",
      source: "Unabhängige Quelle mit Zeitstempel anbinden und die Konfidenzgrenze des Claims neu berechnen.",
    },
    en: {
      contradiction: "Fetch both snapshots for the same observation window, compare the unit, and retain both results in lineage.",
      freshness: "Refresh the named source and store the provider timestamp before synthesizing again.",
      source: "Attach an independent timestamped source and recompute the claim confidence cap.",
    },
  } as const;
  return copy[locale][kind];
}

function completionCopy(locale: "pl" | "de" | "en", route: string | null) {
  const routeLabel = route || "source receipt";
  if (locale === "de") return `Fertig, wenn Wert, Provider-Zeitstempel und Receipt in ${routeLabel} gespeichert sind.`;
  if (locale === "en") return `Complete when the value, provider timestamp, and receipt are stored in ${routeLabel}.`;
  return `Gotowe, gdy wartość, provider timestamp i receipt są zapisane w ${routeLabel}.`;
}

export function buildPass626HumanNextCheckPlanner(input: {
  locale: string;
  depth: "basic" | "pro" | "advanced";
  assetClass: string;
  appendix: Pass608MissingSourceAppendix;
  registry: Pass622SourceRegistry;
  contradiction: Pass624ProviderContradictionEngine;
  synthesis: Pass625FreshnessAwareSynthesis;
}): Pass626HumanNextCheckPlanner {
  const locale = localeOf(input.locale);
  const supportingProviders = input.registry.publicProviders.filter((provider) =>
    provider.assetClasses.some(
      (assetClass) =>
        assetClass === input.assetClass ||
        assetClass === "market" ||
        input.assetClass.includes(assetClass),
    ),
  );
  const primaryProvider = supportingProviders.find(
    (provider) => !provider.requiresConfiguration,
  ) || supportingProviders[0];
  const availability: Pass626CheckTask["availability"] = !primaryProvider
    ? "unavailable"
    : primaryProvider.requiresConfiguration
      ? "configuration_required"
      : "ready";
  const providerIds = supportingProviders.slice(0, 2).map((provider) => provider.id);
  const internalRoute = primaryProvider?.internalRoutes[0] || null;
  const candidates: Array<Omit<Pass626CheckTask, "taskId" | "rank" | "score" | "completionEvidence"> & { scoreSeed: number }> = [];

  for (const entry of input.appendix.entries) {
    const effort = effortFor(entry.nextCheck);
    const availabilityBonus = availability === "ready" ? 18 : availability === "configuration_required" ? 5 : -25;
    const effortPenalty = effort === "high" ? 22 : effort === "medium" ? 10 : 3;
    candidates.push({
      action: clean(entry.nextCheck),
      reason: clean(`${entry.reason} · confidence penalty ${entry.confidencePenalty}`),
      linkedClaimIds: [...entry.linkedClaimIds],
      providerIds,
      internalRoute,
      impact: entry.impact,
      effort,
      availability,
      scoreSeed: impactWeight(entry.impact) + availabilityBonus - effortPenalty,
    });
  }

  for (const comparison of input.contradiction.comparisons.filter(
    (item) => item.state === "contradiction" || item.state === "watch",
  )) {
    const impact = comparison.state === "contradiction" ? "high" : "medium";
    candidates.push({
      action: actionCopy(locale, "contradiction"),
      reason: clean(`${comparison.fieldId}: ${comparison.reason}`),
      linkedClaimIds: [],
      providerIds: [comparison.leftSourceId, comparison.rightSourceId],
      internalRoute,
      impact,
      effort: "medium",
      availability,
      scoreSeed: impactWeight(impact) + (availability === "ready" ? 18 : 0) - 10,
    });
  }

  for (const claim of [
    ...input.synthesis.lastKnownFacts,
    ...input.synthesis.unverifiedCurrent,
  ]) {
    const kind = claim.currentness === "last_known" ? "freshness" : "source";
    const impact: "high" | "medium" = claim.status === "blocked" ? "high" : "medium";
    candidates.push({
      action: actionCopy(locale, kind),
      reason: clean(`${claim.statement} · ${claim.currentnessReason}`),
      linkedClaimIds: [claim.atomId],
      providerIds: claim.sourceIds.length ? [...claim.sourceIds] : providerIds,
      internalRoute,
      impact,
      effort: "medium",
      availability,
      scoreSeed: impactWeight(impact) + (availability === "ready" ? 18 : 0) - 10,
    });
  }

  const seen = new Set<string>();
  const ranked = candidates
    .filter((candidate) => {
      const key = `${candidate.action.toLowerCase()}|${candidate.linkedClaimIds.join(",")}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((left, right) => right.scoreSeed - left.scoreSeed);
  const limit = input.depth === "basic" ? 3 : input.depth === "pro" ? 5 : 7;
  const tasks = ranked.slice(0, limit).map<Pass626CheckTask>((candidate, index) => ({
    taskId: `T${String(index + 1).padStart(2, "0")}`,
    rank: index + 1,
    action: candidate.action,
    reason: candidate.reason,
    linkedClaimIds: candidate.linkedClaimIds,
    providerIds: candidate.providerIds,
    internalRoute: candidate.internalRoute,
    impact: candidate.impact,
    effort: candidate.effort,
    availability: candidate.availability,
    score: Math.max(0, Math.min(100, Math.round(candidate.scoreSeed))),
    completionEvidence: completionCopy(locale, candidate.internalRoute),
  }));
  const genericActionCount = tasks.filter((task) =>
    /check more|sprawdź więcej|mehr daten prüfen|verify more data/i.test(task.action),
  ).length;
  const state = !tasks.length
    ? "clear"
    : tasks.every((task) => task.availability === "unavailable")
      ? "blocked"
      : "action_required";

  return {
    version: "human-next-check-planner",
    locale,
    state,
    tasks,
    primaryAction: tasks[0] || null,
    deferredCount: Math.max(0, ranked.length - tasks.length),
    genericActionCount,
    boundary:
      "Every gap ends in one concrete, verifiable action ranked by decision impact, effort and source availability. The planner never emits a generic 'check more data' instruction.",
  };
}
