export type Pass513VerificationLane = {
  id: string;
  score: number | null;
  status: string;
  nextStep: string;
  label: string;
};

export type Pass513VerificationItem = {
  id: string;
  rank: number;
  label: string;
  riskScore: number | null;
  uncertainty: number;
  informationGain: number;
  expectedConfidenceLift: number;
  action: string;
  state: "critical" | "high" | "normal";
};

export type Pass513ShieldVerificationQueue = {
  version: "shield-verification-queue";
  items: Pass513VerificationItem[];
  totalExpectedLift: number;
  boundary: string;
};

const boundary = {
  pl: "Priorytet oznacza możliwy przyrost jakości dowodów, a nie przewidywany ruch ceny.",
  de: "Die Priorität beschreibt den möglichen Evidenzgewinn, nicht eine erwartete Preisbewegung.",
  en: "Priority describes potential evidence gain, not an expected price move.",
} as const;

export function buildPass513ShieldVerificationQueue(
  locale: "pl" | "de" | "en",
  lanes: Pass513VerificationLane[],
  confidenceScore: number,
): Pass513ShieldVerificationQueue {
  const items = lanes
    .map((lane) => {
      const uncertainty = lane.status === "unknown" ? 100 : lane.status === "red_flag" ? 88 : lane.status === "unverified" ? 76 : lane.status === "likely" ? 38 : 18;
      const adverseEvidence = lane.score ?? 0;
      const informationGain = Math.round((adverseEvidence * 0.58) + (uncertainty * 0.42));
      const expectedConfidenceLift = Math.max(1, Math.min(18, Math.round((informationGain / 100) * Math.max(6, 100 - confidenceScore) * 0.32)));
      return {
        id: lane.id,
        rank: 0,
        label: lane.label,
        riskScore: lane.score,
        uncertainty,
        informationGain,
        expectedConfidenceLift,
        action: lane.nextStep,
        state: informationGain >= 75 ? "critical" : informationGain >= 55 ? "high" : "normal",
      } satisfies Pass513VerificationItem;
    })
    .sort((left, right) => right.informationGain - left.informationGain)
    .slice(0, 4)
    .map((item, index) => ({ ...item, rank: index + 1 }));

  return {
    version: "shield-verification-queue",
    items,
    totalExpectedLift: Math.min(30, items.reduce((sum, item) => sum + item.expectedConfidenceLift, 0)),
    boundary: boundary[locale],
  };
}
