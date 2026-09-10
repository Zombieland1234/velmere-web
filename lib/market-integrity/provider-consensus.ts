import type { Pass458TruthAssetClass } from "./market-data-contract";

export type Pass460ConsensusState =
  | "aligned"
  | "watch"
  | "divergent"
  | "stale"
  | "single_source"
  | "unavailable";

export type Pass460FreshnessState = "fresh" | "aging" | "stale" | "missing";

export type Pass460ProviderConsensus = {
  version: "provider-consensus";
  state: Pass460ConsensusState;
  freshnessState: Pass460FreshnessState;
  freshnessSeconds: number | null;
  divergenceBps: number | null;
  divergenceThresholdBps: number;
  confidenceCap: number;
  primaryPrice: number | null;
  secondaryPrice: number | null;
  primaryLabel: string;
  secondaryLabel: string | null;
  notes: string[];
};

const POLICY: Record<
  Pass458TruthAssetClass,
  { ttlSeconds: number; divergenceBps: number }
> = {
  crypto: { ttlSeconds: 120, divergenceBps: 75 },
  stock: { ttlSeconds: 1_200, divergenceBps: 60 },
  index: { ttlSeconds: 1_200, divergenceBps: 40 },
  fx: { ttlSeconds: 300, divergenceBps: 25 },
  etf: { ttlSeconds: 1_200, divergenceBps: 50 },
  commodity: { ttlSeconds: 1_800, divergenceBps: 120 },
  real_estate: { ttlSeconds: 3_600, divergenceBps: 70 },
  exchange_equity: { ttlSeconds: 1_200, divergenceBps: 60 },
  venue_health: { ttlSeconds: 90, divergenceBps: 0 },
};

function finite(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function freshness(
  timestamp: number | null | undefined,
  ttlSeconds: number,
  nowSeconds: number,
) {
  if (!finite(timestamp)) return { state: "missing" as const, seconds: null };
  const seconds = Math.max(0, nowSeconds - timestamp);
  if (seconds <= ttlSeconds) return { state: "fresh" as const, seconds };
  if (seconds <= ttlSeconds * 3) return { state: "aging" as const, seconds };
  return { state: "stale" as const, seconds };
}

function divergenceBps(
  primary: number | null | undefined,
  secondary: number | null | undefined,
) {
  if (!finite(primary) || !finite(secondary) || primary <= 0 || secondary <= 0)
    return null;
  const midpoint = (primary + secondary) / 2;
  return midpoint > 0
    ? (Math.abs(primary - secondary) / midpoint) * 10_000
    : null;
}

export function buildPass460ProviderConsensus({
  assetClass,
  primaryPrice,
  secondaryPrice,
  sourceTimestamp,
  primaryLabel,
  secondaryLabel,
  nowSeconds = Math.floor(Date.now() / 1000),
}: {
  assetClass: Pass458TruthAssetClass;
  primaryPrice: number | null | undefined;
  secondaryPrice: number | null | undefined;
  sourceTimestamp: number | null | undefined;
  primaryLabel: string;
  secondaryLabel?: string | null;
  nowSeconds?: number;
}): Pass460ProviderConsensus {
  const policy = POLICY[assetClass];
  const age = freshness(sourceTimestamp, policy.ttlSeconds, nowSeconds);
  const divergence = divergenceBps(primaryPrice, secondaryPrice);
  const hasPrimary = finite(primaryPrice);
  const hasSecondary = finite(secondaryPrice);
  const notes: string[] = [];

  let state: Pass460ConsensusState = "unavailable";
  let confidenceCap = 20;

  if (!hasPrimary && !hasSecondary) {
    notes.push("No provider supplied a usable price.");
  } else if (age.state === "stale") {
    state = "stale";
    confidenceCap = 38;
    notes.push(
      `Source timestamp exceeds the ${policy.ttlSeconds}s freshness policy.`,
    );
  } else if (!hasPrimary || !hasSecondary || divergence === null) {
    state = "single_source";
    confidenceCap = age.state === "fresh" ? 68 : 55;
    notes.push(
      "Only one price lane is available; stronger wording remains blocked.",
    );
  } else if (divergence > policy.divergenceBps * 2) {
    state = "divergent";
    confidenceCap = 42;
    notes.push(
      `Provider prices diverge by ${divergence.toFixed(1)} bps, above the hard review gate.`,
    );
  } else if (divergence > policy.divergenceBps) {
    state = "watch";
    confidenceCap = 62;
    notes.push(
      `Provider prices diverge by ${divergence.toFixed(1)} bps and require review.`,
    );
  } else {
    state = "aligned";
    confidenceCap = age.state === "fresh" ? 90 : 76;
    notes.push(
      `Provider prices are within the ${policy.divergenceBps} bps class threshold.`,
    );
  }

  if (age.state === "missing") {
    confidenceCap = Math.min(confidenceCap, 52);
    notes.push(
      "No source timestamp is attached, so freshness cannot be verified.",
    );
  } else if (age.state === "aging") {
    confidenceCap = Math.min(confidenceCap, 70);
    notes.push("Source is aging and should be refreshed before publication.");
  }

  if (assetClass === "venue_health") {
    state = "unavailable";
    confidenceCap = 20;
    notes.splice(
      0,
      notes.length,
      "Venue health requires status, depth and websocket telemetry rather than price consensus.",
    );
  }

  return {
    version: "provider-consensus",
    state,
    freshnessState: age.state,
    freshnessSeconds: age.seconds,
    divergenceBps: divergence,
    divergenceThresholdBps: policy.divergenceBps,
    confidenceCap,
    primaryPrice: finite(primaryPrice) ? primaryPrice : null,
    secondaryPrice: finite(secondaryPrice) ? secondaryPrice : null,
    primaryLabel,
    secondaryLabel: hasSecondary
      ? secondaryLabel || "secondary provider"
      : null,
    notes,
  };
}

export const pass460ProviderConsensusContract = {
  id: "PASS460_PROVIDER_CONSENSUS",
  rules: [
    "A provider response is not enough: freshness and price agreement must be evaluated before strong AI wording.",
    "Divergence thresholds are asset-class aware; FX is tighter than crypto or commodity reference series.",
    "Single-source, stale and divergent snapshots cap confidence and remain visible in UI, PDF and Shield AI.",
    "Venue health never uses price consensus; it requires status, depth and websocket telemetry.",
  ],
};
