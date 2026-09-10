export type Pass624ObservationKind =
  | "price"
  | "percentage"
  | "fundamental"
  | "filing"
  | "timestamp"
  | "text";

export type Pass624Observation = {
  fieldId: string;
  sourceId: string;
  kind: Pass624ObservationKind;
  value: number | string | null;
  unit?: string | null;
  observedAt?: string | null;
  confidenceCap?: number;
};

export type Pass624Comparison = {
  id: string;
  fieldId: string;
  leftSourceId: string;
  rightSourceId: string;
  kind: Pass624ObservationKind;
  state: "aligned" | "watch" | "contradiction" | "insufficient";
  numericDivergencePercent: number | null;
  divergenceBps: number | null;
  timestampDeltaSeconds: number | null;
  preferredSourceId: string | null;
  confidenceCap: number;
  reason: string;
};

export type Pass624ProviderContradictionEngine = {
  version: "provider-contradiction-engine";
  assetClass: string;
  generatedAt: string;
  observations: Pass624Observation[];
  comparisons: Pass624Comparison[];
  contradictions: number;
  watches: number;
  aligned: number;
  unresolvedFields: string[];
  state: "aligned" | "watch" | "contradiction" | "insufficient";
  confidenceCap: number;
  boundary: string;
};

function clamp(value: number) {
  return Math.max(0, Math.min(100, Math.round(Number.isFinite(value) ? value : 0)));
}

function parseTime(value: string | null | undefined) {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function numberValue(value: number | string | null) {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string") return null;
  const normalized = value.replace(/[^0-9+\-.,eE]/g, "").replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function priceThresholdBps(assetClass: string) {
  const normalized = assetClass.toLowerCase();
  if (normalized.includes("fx")) return 12;
  if (normalized.includes("etf")) return 45;
  if (normalized.includes("stock") || normalized.includes("equity")) return 60;
  if (normalized.includes("commodity")) return 55;
  if (normalized.includes("reit") || normalized.includes("real_estate")) return 75;
  if (normalized.includes("venue") || normalized.includes("crypto")) return 90;
  return 70;
}

function timestampThresholdSeconds(assetClass: string) {
  const normalized = assetClass.toLowerCase();
  if (normalized.includes("venue") || normalized.includes("crypto")) return 120;
  if (normalized.includes("fx")) return 43_200;
  if (
    normalized.includes("stock") ||
    normalized.includes("equity") ||
    normalized.includes("etf") ||
    normalized.includes("commodity")
  ) return 1_800;
  if (normalized.includes("reit") || normalized.includes("real_estate")) return 86_400;
  return 3_600;
}

function preferredSource(left: Pass624Observation, right: Pass624Observation) {
  const leftTime = parseTime(left.observedAt);
  const rightTime = parseTime(right.observedAt);
  if (leftTime !== null && rightTime !== null && leftTime !== rightTime) {
    return leftTime > rightTime ? left.sourceId : right.sourceId;
  }
  const leftCap = clamp(left.confidenceCap ?? 0);
  const rightCap = clamp(right.confidenceCap ?? 0);
  if (leftCap === rightCap) return null;
  return leftCap > rightCap ? left.sourceId : right.sourceId;
}

function comparePair(
  assetClass: string,
  left: Pass624Observation,
  right: Pass624Observation,
  index: number,
): Pass624Comparison {
  const leftTime = parseTime(left.observedAt);
  const rightTime = parseTime(right.observedAt);
  const timestampDeltaSeconds =
    leftTime !== null && rightTime !== null
      ? Math.round(Math.abs(leftTime - rightTime) / 1000)
      : null;
  const preferredSourceId = preferredSource(left, right);
  const baseCap = Math.min(
    clamp(left.confidenceCap ?? 100),
    clamp(right.confidenceCap ?? 100),
  );
  const leftNumber = numberValue(left.value);
  const rightNumber = numberValue(right.value);
  let state: Pass624Comparison["state"] = "insufficient";
  let numericDivergencePercent: number | null = null;
  let divergenceBps: number | null = null;
  let reason = "Not enough comparable provider data.";

  if (left.kind !== right.kind || left.unit !== right.unit) {
    state = "watch";
    reason = "Provider values use different kinds or units and remain visibly unresolved.";
  } else if (left.kind === "filing" || left.kind === "text") {
    const leftText = String(left.value ?? "").trim().toLowerCase();
    const rightText = String(right.value ?? "").trim().toLowerCase();
    if (!leftText || !rightText) {
      state = "insufficient";
      reason = "At least one provider is missing a comparable value.";
    } else if (leftText === rightText) {
      state = "aligned";
      reason = "Providers expose the same normalized filing or text value.";
    } else {
      state = "contradiction";
      reason = "Providers expose different filing or text values; neither value is hidden.";
    }
  } else if (leftNumber !== null && rightNumber !== null) {
    const denominator = Math.max(Math.abs(leftNumber), Math.abs(rightNumber), 1e-9);
    numericDivergencePercent = Math.abs(leftNumber - rightNumber) / denominator * 100;
    divergenceBps = numericDivergencePercent * 100;
    const thresholdBps = left.kind === "price"
      ? priceThresholdBps(assetClass)
      : left.kind === "timestamp"
        ? timestampThresholdSeconds(assetClass) * 100
        : left.kind === "percentage"
          ? 75
          : 200;
    const metric = left.kind === "timestamp"
      ? timestampDeltaSeconds ?? Number.POSITIVE_INFINITY
      : divergenceBps;
    const threshold = left.kind === "timestamp"
      ? timestampThresholdSeconds(assetClass)
      : thresholdBps;
    if (metric <= threshold) {
      state = "aligned";
      reason = "Provider divergence remains inside the asset-class threshold.";
    } else if (metric <= threshold * 2) {
      state = "watch";
      reason = "Provider divergence exceeds the alignment threshold but remains inside the review band.";
    } else {
      state = "contradiction";
      reason = "Provider divergence exceeds the deterministic contradiction threshold.";
    }
  }

  const stateCap = state === "aligned" ? 92 : state === "watch" ? 68 : state === "contradiction" ? 38 : 44;
  return {
    id: `PC${String(index + 1).padStart(2, "0")}`,
    fieldId: left.fieldId,
    leftSourceId: left.sourceId,
    rightSourceId: right.sourceId,
    kind: left.kind,
    state,
    numericDivergencePercent:
      numericDivergencePercent === null
        ? null
        : Number(numericDivergencePercent.toFixed(4)),
    divergenceBps:
      divergenceBps === null ? null : Number(divergenceBps.toFixed(2)),
    timestampDeltaSeconds,
    preferredSourceId,
    confidenceCap: Math.min(baseCap, stateCap),
    reason,
  };
}

export function buildPass624ProviderContradictionEngine(input: {
  assetClass: string;
  generatedAt?: string | number;
  observations: Pass624Observation[];
}): Pass624ProviderContradictionEngine {
  const observations = input.observations.map((observation) => ({
    ...observation,
    fieldId: observation.fieldId.trim().slice(0, 96),
    sourceId: observation.sourceId.trim().slice(0, 96),
    unit: observation.unit?.trim().slice(0, 32) || null,
    observedAt: observation.observedAt || null,
    confidenceCap: clamp(observation.confidenceCap ?? 100),
  }));
  const byField = new Map<string, Pass624Observation[]>();
  for (const observation of observations) {
    const bucket = byField.get(observation.fieldId) || [];
    bucket.push(observation);
    byField.set(observation.fieldId, bucket);
  }
  const comparisons: Pass624Comparison[] = [];
  for (const fieldObservations of Array.from(byField.values())) {
    for (let leftIndex = 0; leftIndex < fieldObservations.length; leftIndex += 1) {
      for (
        let rightIndex = leftIndex + 1;
        rightIndex < fieldObservations.length;
        rightIndex += 1
      ) {
        comparisons.push(
          comparePair(
            input.assetClass,
            fieldObservations[leftIndex],
            fieldObservations[rightIndex],
            comparisons.length,
          ),
        );
      }
    }
  }
  const contradictions = comparisons.filter((item) => item.state === "contradiction").length;
  const watches = comparisons.filter((item) => item.state === "watch").length;
  const aligned = comparisons.filter((item) => item.state === "aligned").length;
  const unresolvedFields = Array.from(byField.entries())
    .filter(([, values]) => values.length < 2)
    .map(([fieldId]) => fieldId);
  const state: Pass624ProviderContradictionEngine["state"] = contradictions
    ? "contradiction"
    : watches
      ? "watch"
      : comparisons.length && aligned === comparisons.length
        ? "aligned"
        : "insufficient";
  const confidenceCap = comparisons.length
    ? Math.min(...comparisons.map((comparison) => comparison.confidenceCap))
    : 44;
  const generated = input.generatedAt ? new Date(input.generatedAt) : new Date();

  return {
    version: "provider-contradiction-engine",
    assetClass: input.assetClass,
    generatedAt: Number.isNaN(generated.getTime())
      ? new Date(0).toISOString()
      : generated.toISOString(),
    observations,
    comparisons,
    contradictions,
    watches,
    aligned,
    unresolvedFields,
    state,
    confidenceCap,
    boundary:
      "Provider conflicts stay visible. A fresher or higher-confidence source may become the display anchor, but it never erases the contradictory observation or upgrades the claim to consensus.",
  };
}
