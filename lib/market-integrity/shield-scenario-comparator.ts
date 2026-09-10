export type Pass507Lane = { id: string; score: number | null; status: string };

export type Pass507Scenario = {
  id: "baseline" | "stress" | "verified";
  score: number | null;
  confidenceDelta: number;
  label: string;
  explanation: string;
};

export type Pass507ScenarioComparator = {
  version: "shield-scenario-comparator";
  scenarios: Pass507Scenario[];
  spread: number | null;
  focusLaneId: string | null;
};

const labels = {
  pl: {
    baseline: "Stan bazowy",
    stress: "Scenariusz presji",
    verified: "Po potwierdzeniu braków",
    baselineBody: "Bieżący wynik z przekazanych źródeł.",
    stressBody: "Symulacja, gdy niepotwierdzone osie okazują się negatywne.",
    verifiedBody: "Potencjalny wynik po potwierdzeniu brakujących źródeł bez nowych czerwonych flag.",
  },
  de: {
    baseline: "Basisszenario",
    stress: "Stressszenario",
    verified: "Nach Verifikation",
    baselineBody: "Aktueller Wert aus den übergebenen Quellen.",
    stressBody: "Simulation, falls unbestätigte Achsen negativ ausfallen.",
    verifiedBody: "Möglicher Wert nach bestätigten Quellen ohne neue Red Flags.",
  },
  en: {
    baseline: "Baseline",
    stress: "Pressure scenario",
    verified: "After verification",
    baselineBody: "Current score from the supplied sources.",
    stressBody: "Simulation if unverified lanes resolve negatively.",
    verifiedBody: "Potential score after missing sources are verified with no new red flags.",
  },
} as const;

export function buildPass507ShieldScenarioComparator(
  locale: "pl" | "de" | "en",
  lanes: Pass507Lane[],
  overallRisk: number | null,
  confidenceScore: number,
): Pass507ScenarioComparator {
  const reviewCount = lanes.filter((lane) => !["confirmed", "likely"].includes(lane.status)).length;
  const highest = [...lanes]
    .filter((lane) => lane.score !== null)
    .sort((left, right) => (right.score ?? 0) - (left.score ?? 0))[0];
  const stressLift = Math.min(28, reviewCount * 4 + Math.round((highest?.score ?? 0) * 0.12));
  const verifiedDrop = Math.min(22, reviewCount * 3 + Math.round((100 - confidenceScore) * 0.08));
  const baseline = overallRisk === null ? null : Math.max(0, Math.min(100, Math.round(overallRisk)));
  const stress = baseline === null ? null : Math.max(0, Math.min(100, baseline + stressLift));
  const verified = baseline === null ? null : Math.max(0, Math.min(100, baseline - verifiedDrop));
  const c = labels[locale];
  return {
    version: "shield-scenario-comparator",
    scenarios: [
      { id: "baseline", score: baseline, confidenceDelta: 0, label: c.baseline, explanation: c.baselineBody },
      { id: "stress", score: stress, confidenceDelta: -Math.min(18, reviewCount * 3), label: c.stress, explanation: c.stressBody },
      { id: "verified", score: verified, confidenceDelta: Math.min(24, reviewCount * 4), label: c.verified, explanation: c.verifiedBody },
    ],
    spread: stress === null || verified === null ? null : stress - verified,
    focusLaneId: highest?.id ?? null,
  };
}
