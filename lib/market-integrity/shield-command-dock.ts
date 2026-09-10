export type Pass500ShieldCommandDock = {
  version: "shield-command-dock";
  riskLaneId: string | null;
  stableLaneId: string | null;
  spread: number;
  readyLanes: number;
  reviewLanes: number;
  nextStep: string;
};

type Pass500Lane = {
  id: string;
  score: number | null;
  reviewPriority?: number;
  status: string;
};

export function buildPass500ShieldCommandDock(
  lanes: Pass500Lane[],
  nextStep: string | undefined,
): Pass500ShieldCommandDock {
  const scored = lanes.filter((lane) => lane.score !== null);
  const sorted = [...scored].sort(
    (left, right) => (right.score ?? 0) - (left.score ?? 0),
  );
  const stable = [...scored].sort(
    (left, right) => (left.score ?? 0) - (right.score ?? 0),
  )[0];
  return {
    version: "shield-command-dock",
    riskLaneId: sorted[0]?.id ?? null,
    stableLaneId: stable?.id ?? null,
    spread:
      sorted.length && stable
        ? Math.max(0, (sorted[0]?.score ?? 0) - (stable.score ?? 0))
        : 0,
    readyLanes: lanes.filter((lane) => lane.status === "confirmed" || lane.status === "likely").length,
    reviewLanes: lanes.filter((lane) => lane.status !== "confirmed" && lane.status !== "likely").length,
    nextStep: nextStep || "Verify the highest-risk lane before strengthening the conclusion.",
  };
}
