export type Pass492Lane = {
  id: string;
  score: number | null;
  reviewPriority?: number;
  status: string;
  headline: string;
  body: string;
  nextStep: string;
};

export type Pass492ShieldLaneFocus = {
  version: "shield-lane-focus";
  activeId: string;
  active: Pass492Lane | null;
  strongestId: string | null;
  previousId: string | null;
  nextId: string | null;
  scoreBand: "calm" | "watch" | "high";
  checksum: string;
};

function checksum(value: string) {
  let result = 0;
  for (let index = 0; index < value.length; index += 1) result = (result * 31 + value.charCodeAt(index)) >>> 0;
  return result.toString(16).padStart(8, "0");
}

export function buildPass492ShieldLaneFocus(lanes: Pass492Lane[], requestedId?: string | null): Pass492ShieldLaneFocus {
  const strongest = lanes.length
    ? [...lanes].sort(
        (a, b) =>
          (b.reviewPriority ?? b.score ?? 0) -
          (a.reviewPriority ?? a.score ?? 0),
      )[0]
    : null;
  const active = lanes.find((lane) => lane.id === requestedId) ?? strongest ?? null;
  const index = active ? lanes.findIndex((lane) => lane.id === active.id) : -1;
  const previousId = index >= 0 && lanes.length ? lanes[(index - 1 + lanes.length) % lanes.length]?.id ?? null : null;
  const nextId = index >= 0 && lanes.length ? lanes[(index + 1) % lanes.length]?.id ?? null : null;
  const scoreBand =
    !active || active.score === null
      ? "watch"
      : active.score < 35
        ? "calm"
        : active.score < 65
          ? "watch"
          : "high";
  return {
    version: "shield-lane-focus",
    activeId: active?.id ?? "",
    active,
    strongestId: strongest?.id ?? null,
    previousId,
    nextId,
    scoreBand,
    checksum: checksum(lanes.map((lane) => `${lane.id}:${lane.score}:${lane.status}`).join("|")),
  };
}
