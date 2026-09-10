/**
 * VELMÈRE DATA FRESHNESS ENGINE
 * 
 * Enforces rigorous temporal validity:
 * NO CURRENT DATA -> DO NOT CALL DATA CURRENT
 * 
 * States: LIVE, FRESH, AGING, STALE, UNAVAILABLE
 */

export type FreshnessStatus = "LIVE" | "FRESH" | "AGING" | "STALE" | "UNAVAILABLE";

export interface FreshnessMetadata {
  observedAt: string;
  sourceTimestamp: string | null;
  staleAfter: string;
  status: FreshnessStatus;
  ageSeconds: number;
  maxToleratedAgeSeconds: number;
  isStale: boolean;
}

export const FRESHNESS_POLICIES: Record<string, number> = {
  MARKET_TICK: 900, // 15 minutes
  BLOCKCHAIN_STATE: 86400, // 24 hours
  EXPLORER_VERIFICATION: 604800, // 7 days
  STATIC_BYTECODE: 2592000, // 30 days (requires recheck on proxy upgrade)
};

export function evaluateDataFreshness(
  sourceTimestamp: string | null | undefined,
  policy: keyof typeof FRESHNESS_POLICIES = "BLOCKCHAIN_STATE",
  currentTime: Date = new Date(),
): FreshnessMetadata {
  if (!sourceTimestamp) {
    return {
      observedAt: currentTime.toISOString(),
      sourceTimestamp: null,
      staleAfter: currentTime.toISOString(),
      status: "UNAVAILABLE",
      ageSeconds: Infinity,
      maxToleratedAgeSeconds: FRESHNESS_POLICIES[policy],
      isStale: true,
    };
  }

  const srcDate = new Date(sourceTimestamp);
  if (isNaN(srcDate.getTime())) {
    return {
      observedAt: currentTime.toISOString(),
      sourceTimestamp: null,
      staleAfter: currentTime.toISOString(),
      status: "UNAVAILABLE",
      ageSeconds: Infinity,
      maxToleratedAgeSeconds: FRESHNESS_POLICIES[policy],
      isStale: true,
    };
  }

  const ageMs = Math.max(0, currentTime.getTime() - srcDate.getTime());
  const ageSeconds = Math.floor(ageMs / 1000);
  const maxAge = FRESHNESS_POLICIES[policy];
  const staleAfter = new Date(srcDate.getTime() + maxAge * 1000).toISOString();

  let status: FreshnessStatus = "LIVE";
  if (ageSeconds > maxAge) {
    status = "STALE";
  } else if (ageSeconds > maxAge * 0.5) {
    status = "AGING";
  } else if (ageSeconds > 300) {
    status = "FRESH";
  } else {
    status = "LIVE";
  }

  return {
    observedAt: currentTime.toISOString(),
    sourceTimestamp: srcDate.toISOString(),
    staleAfter,
    status,
    ageSeconds,
    maxToleratedAgeSeconds: maxAge,
    isStale: status === "STALE",
  };
}
