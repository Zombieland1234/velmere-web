import type { Pass513ShieldVerificationQueue } from "./shield-verification-queue";

export type Pass521ShieldLane = {
  id: string;
  label: string;
  score: number | null;
  status: string;
  headline: string;
  body: string;
  nextStep: string;
};

export type Pass521ShieldEvidenceDrilldown = {
  version: "shield-evidence-drilldown";
  activeId: string | null;
  label: string;
  score: number | null;
  status: string;
  evidenceState: "supported" | "limited" | "missing" | "conflict";
  whyItMatters: string;
  whatIsKnown: string;
  whatIsMissing: string;
  nextVerification: string;
  expectedConfidenceLift: number;
  relatedLaneIds: string[];
  boundary: string;
};

export function buildPass521ShieldEvidenceDrilldown(
  locale: "pl" | "de" | "en",
  lanes: Pass521ShieldLane[],
  activeId: string | null,
  queue: Pass513ShieldVerificationQueue,
): Pass521ShieldEvidenceDrilldown {
  const lane =
    lanes.find((item) => item.id === activeId) ||
    [...lanes].sort((a, b) => (b.score ?? -1) - (a.score ?? -1))[0];
  if (!lane) {
    return {
      version: "shield-evidence-drilldown",
      activeId: null,
      label: "—",
      score: 0,
      status: "unknown",
      evidenceState: "missing",
      whyItMatters: "No lane is available.",
      whatIsKnown: "No source-bound evidence was attached.",
      whatIsMissing: "A valid Shield lane payload is required.",
      nextVerification: "Load a source-bound investigation.",
      expectedConfidenceLift: 0,
      relatedLaneIds: [],
      boundary: "The drill-down never creates evidence for an absent lane.",
    };
  }
  const queued = queue.items.find((item) => item.id === lane.id);
  const state: Pass521ShieldEvidenceDrilldown["evidenceState"] = lane.status === "confirmed"
    ? "supported"
    : lane.status === "red_flag"
      ? "conflict"
      : lane.status === "unknown"
        ? "missing"
        : "limited";
  const localized = {
    pl: {
      known: state === "supported" ? "Oś ma potwierdzony sygnał wejściowy." : "Oś ma częściowy sygnał lub ocenę wymagającą kontroli.",
      missing: state === "missing" ? "Brakuje źródła wystarczającego do oceny tej osi." : "Nadal brakuje drugiego źródła lub aktualnego potwierdzenia.",
      boundary: "Drill-down wyjaśnia stan dowodów; nie jest rekomendacją transakcyjną ani prognozą ceny.",
    },
    de: {
      known: state === "supported" ? "Die Achse besitzt ein bestätigtes Eingangssignal." : "Die Achse enthält ein Teil- oder Prüfsignal.",
      missing: state === "missing" ? "Eine ausreichende Quelle für diese Achse fehlt." : "Eine Zweitquelle oder aktuelle Bestätigung fehlt weiterhin.",
      boundary: "Der Drill-down erklärt den Evidenzstatus; er ist weder Handelsaufforderung noch Preisprognose.",
    },
    en: {
      known: state === "supported" ? "The lane has a confirmed input signal." : "The lane has a partial or review-state signal.",
      missing: state === "missing" ? "No sufficient source is attached for this lane." : "A second source or current confirmation is still required.",
      boundary: "The drill-down explains evidence state; it is not a trading recommendation or price forecast.",
    },
  }[locale];
  const related = [...lanes]
    .filter((item) => item.id !== lane.id)
    .sort(
      (left, right) =>
        Math.abs((right.score ?? 0) - (lane.score ?? 0)) -
        Math.abs((left.score ?? 0) - (lane.score ?? 0)),
    )
    .slice(0, 2)
    .map((item) => item.id);
  return {
    version: "shield-evidence-drilldown",
    activeId: lane.id,
    label: lane.label,
    score: lane.score,
    status: lane.status,
    evidenceState: state,
    whyItMatters: lane.headline,
    whatIsKnown: `${localized.known} ${lane.body}`,
    whatIsMissing: localized.missing,
    nextVerification: lane.nextStep,
    expectedConfidenceLift: queued?.expectedConfidenceLift ?? 0,
    relatedLaneIds: related,
    boundary: localized.boundary,
  };
}
