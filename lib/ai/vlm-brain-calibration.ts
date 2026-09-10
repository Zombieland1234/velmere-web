export const VLM_BRAIN_CALIBRATION_VERSION = "velmere-vlm-calibration-2026.07.07-pass4627" as const;

/**
 * Canonical policy manifest for every confidence/status decision made by the
 * central VLM Brain kernel. Keep this object JSON-safe and deterministic.
 * PASS4622 verifies the exported SHA-256 against canonical key-sorted JSON.
 */
export const VLM_BRAIN_CALIBRATION_MANIFEST = {
  schemaVersion: "velmere.vlm.calibration.manifest.v1",
  version: VLM_BRAIN_CALIBRATION_VERSION,
  confidenceNormalization: {
    ratioMax: 1,
    percentMax: 100,
    rounding: "nearest_integer",
  },
  qualityCeilings: {
    strong: 94,
    medium: 78,
    weak: 48,
    missing: 0,
  },
  freshnessFactors: {
    fresh: 1,
    aging: 0.8,
    stale: 0.45,
    unknown: 0.65,
  },
  timestampPolicy: {
    maxFutureSkewMs: 5 * 60 * 1000,
    defaultProfile: "generic",
    // Compatibility mirrors for legacy consumers. The kernel resolves the
    // profile-specific thresholds below instead of applying one global age.
    freshMaxAgeMs: 15 * 60 * 1000,
    agingMaxAgeMs: 6 * 60 * 60 * 1000,
    invalidTimestampConfidence: 0,
    missingTimestampFreshness: "unknown",
  },
  freshnessProfiles: {
    generic: {
      freshMaxAgeMs: 15 * 60 * 1000,
      agingMaxAgeMs: 6 * 60 * 60 * 1000,
      description: "Fallback policy for evidence without a domain-specific profile.",
    },
    crypto_market: {
      freshMaxAgeMs: 2 * 60 * 1000,
      agingMaxAgeMs: 20 * 60 * 1000,
      description: "24/7 crypto quotes, candles, order-flow and exchange snapshots.",
    },
    equity_market: {
      freshMaxAgeMs: 20 * 60 * 1000,
      agingMaxAgeMs: 96 * 60 * 60 * 1000,
      description: "Equity and ETF snapshots with delayed feeds and closed-market weekends.",
    },
    fx_market: {
      freshMaxAgeMs: 10 * 60 * 1000,
      agingMaxAgeMs: 72 * 60 * 60 * 1000,
      description: "FX quotes with weekend closure tolerance.",
    },
    commodity_market: {
      freshMaxAgeMs: 30 * 60 * 1000,
      agingMaxAgeMs: 72 * 60 * 60 * 1000,
      description: "Metals, energy and commodity snapshots with exchange-session gaps.",
    },
    onchain: {
      freshMaxAgeMs: 15 * 60 * 1000,
      agingMaxAgeMs: 6 * 60 * 60 * 1000,
      description: "On-chain transfers, liquidity, holder and contract-state evidence.",
    },
    document: {
      freshMaxAgeMs: 30 * 24 * 60 * 60 * 1000,
      agingMaxAgeMs: 365 * 24 * 60 * 60 * 1000,
      description: "Research, filings, documentation and long-lived source records.",
    },
    audit_evidence: {
      freshMaxAgeMs: 14 * 24 * 60 * 60 * 1000,
      agingMaxAgeMs: 180 * 24 * 60 * 60 * 1000,
      description: "Repository snapshots, scanners, audit proofs and remediation evidence.",
    },
    product_import: {
      freshMaxAgeMs: 7 * 24 * 60 * 60 * 1000,
      agingMaxAgeMs: 90 * 24 * 60 * 60 * 1000,
      description: "Supplier imports, variants, mockups, size charts and truth profiles.",
    },
  },
  sourceCeilings: {
    one: 64,
    two: 82,
    threePlus: 92,
  },
  missingPenalties: {
    blocking: 12,
    nonBlocking: 5,
    max: 42,
  },
  coverageBlend: {
    base: 0.72,
    evidenceRatioWeight: 0.28,
  },
  statusRules: {
    readyMinSources: 2,
    readyMinConfidence: 62,
    blockingMissing: "blocked",
  },
  evidenceQualityBands: {
    strongMin: 78,
    mediumMin: 52,
    weakMin: 20,
  },
  independenceExcluded: ["derived", "operator"],
  sourceMetadataRequired: ["providerFamily", "independence", "sourceTimestamp"],
  sourceMetadataPolicy: {
    countOnlyExplicit: true,
    acceptedExternalIndependence: ["independent", "same_provider"],
    incompleteExternalEvidence: "exclude_from_source_count",
  },
  sessionPolicy: {
    closureDatesFormat: "YYYY-MM-DD",
    maxSessionLookbackDays: 400,
    defaultByFreshnessProfile: {
      generic: "none",
      crypto_market: "always_open",
      equity_market: "us_equity_regular",
      fx_market: "fx_week",
      commodity_market: "commodity_week",
      onchain: "always_open",
      document: "none",
      audit_evidence: "none",
      product_import: "none",
    },
    profiles: {
      none: { timezone: "UTC", weekdays: [], openMinute: 0, closeMinute: 1440, pausesFreshness: false },
      always_open: { timezone: "UTC", weekdays: [0, 1, 2, 3, 4, 5, 6], openMinute: 0, closeMinute: 1440, pausesFreshness: false },
      us_equity_regular: { timezone: "America/New_York", weekdays: [1, 2, 3, 4, 5], openMinute: 570, closeMinute: 960, pausesFreshness: true },
      fx_week: { timezone: "UTC", weekdays: [1, 2, 3, 4, 5], openMinute: 0, closeMinute: 1440, pausesFreshness: true },
      commodity_week: { timezone: "UTC", weekdays: [1, 2, 3, 4, 5], openMinute: 60, closeMinute: 1380, pausesFreshness: true },
    },
  },
  providerHealthPolicy: {
    degradedRatio: 1,
    breachedRatio: 2.5,
    percentileEvaluation: {
      percentile: "p95",
      minSamples: 5,
      strategy: "max_current_and_p95",
    },
    confidenceFactors: { healthy: 1, unknown: 1, degraded: 0.8, breached: 0.55, quarantined: 0 },
    defaultSlaMsByFreshnessProfile: {
      generic: 10000,
      crypto_market: 2500,
      equity_market: 5000,
      fx_market: 3500,
      commodity_market: 5000,
      onchain: 7000,
      document: 15000,
      audit_evidence: 30000,
      product_import: 30000,
    },
    quarantineThresholds: {
      clockSkewStreak: 2,
      invalidTimestampStreak: 2,
      slaBreachStreak: 5,
      failureStreak: 5,
    },
  },
  providerTelemetryPolicy: {
    schemaVersion: "velmere.vlm.provider-telemetry.policy.v1",
    retentionMs: 30 * 24 * 60 * 60 * 1000,
    maxSamplesPerProvider: 256,
    maxProviders: 128,
    persistence: {
      atomicRename: true,
      checksum: "sha256",
      fileMode: "0600",
    },
    streakResetOnHealthyObservation: true,
    quarantineStickyUntilOperatorRecovery: true,
  },
  findingConfidenceBoundedByKernelCap: true,
} as const;

/** SHA-256 of canonical, recursively key-sorted JSON for the manifest above. */
export const VLM_BRAIN_CALIBRATION_HASH =
  "28b844d31ef1382be3bc2f9fd5347342cef9b09d7d125af22bfd3f55668df562" as const;

export type VlmBrainCalibrationVersion = typeof VLM_BRAIN_CALIBRATION_VERSION;
export type VlmBrainCalibrationHash = typeof VLM_BRAIN_CALIBRATION_HASH;
