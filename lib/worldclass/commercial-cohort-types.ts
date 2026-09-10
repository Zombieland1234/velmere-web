export const PASS4809_COMMERCIAL_COHORT_POLICY_ID = "pass4809-commercial-cohort-policy-v1" as const;
export const PASS4809_COMMERCIAL_COHORT_SCHEMA = "velmere.commercial-cohort-manifest.v1" as const;
export const PASS4809_COMMERCIAL_COHORT_ATTESTATION_SCHEMA = "velmere.commercial-cohort-attestation.v1" as const;

export type CommercialCohortProduct = "audit" | "shield" | "real_markets" | "pdf";
export type CommercialCohortTier = "basic" | "pro" | "advanced";
export type CommercialCohortLocale = "pl" | "en" | "de";
export type CommercialCohortEvidenceClass = "live_provider" | "staging_replay" | "synthetic_fixture";

export type CommercialCohortCase = {
  schemaVersion: "velmere.commercial-cohort-case.v1";
  caseId: string;
  product: CommercialCohortProduct;
  tier: CommercialCohortTier;
  subjectId: string;
  assetClass: string;
  chain: string | null;
  locale: CommercialCohortLocale;
  evidenceClass: CommercialCohortEvidenceClass;
  runtimeVersion: string;
  providerConfigDigest: string;
  captureReceiptDigest: string;
  observedAt: string;
  outcomeObservedAt: string;
  providerUpstreamRoots: string[];
  inputDigest: string;
  outputDigest: string;
  groundTruthDigest: string;
  valueMetrics?: {
    basicUseful: boolean;
    proAddsMaterialEvidence: boolean;
    advancedAddsMaterialEvidence: boolean;
    advancedHumanReviewMaterial: boolean;
  };
  auditMetrics?: {
    truePositives: number;
    falsePositives: number;
    falseNegatives: number;
    severityAgreement: number;
    manualReviewed: boolean;
  };
  marketMetrics?: {
    quoteErrorBps: number;
    stale: boolean;
    conflictExpected: boolean;
    conflictSurfaced: boolean;
    rankingStable: boolean;
    sessionNormalized: boolean;
  };
  pdfMetrics?: {
    exactByteMatch: boolean;
    parserValid: boolean;
    unicodeRoundTrip: boolean;
    previewDataParity: boolean;
    deterministicRerender: boolean;
  };
};

export type CommercialCohortAggregate = {
  caseCount: number;
  uniqueSubjectCount: number;
  tierCounts: Record<CommercialCohortTier, number>;
  localeCounts: Record<CommercialCohortLocale, number>;
  assetClasses: string[];
  chains: string[];
  upstreamRoots: string[];
  evidenceClassCounts: Record<CommercialCohortEvidenceClass, number>;
  runtimeVersions: string[];
  providerConfigDigests: string[];
  value: {
    measuredCases: number;
    basicUsefulRate: number;
    proMaterialDeltaRate: number;
    advancedMaterialDeltaRate: number;
    advancedHumanReviewMaterialRate: number;
  };
  audit: {
    truthLabeledCases: number;
    manualReviewRate: number;
    precision: number;
    recall: number;
    falsePositiveRate: number;
    severityAgreementRate: number;
  };
  market: {
    measuredCases: number;
    quoteErrorP95Bps: number | null;
    staleRate: number;
    conflictDetectionRate: number;
    rankingStabilityRate: number;
    sessionNormalizationRate: number;
  };
  pdf: {
    measuredCases: number;
    exactByteMatchRate: number;
    parserValidRate: number;
    unicodeRoundTripRate: number;
    previewDataParityRate: number;
    deterministicRerenderRate: number;
  };
};

export type CommercialCohortManifest = {
  schemaVersion: typeof PASS4809_COMMERCIAL_COHORT_SCHEMA;
  policyVersion: typeof PASS4809_COMMERCIAL_COHORT_POLICY_ID;
  generatedAt: string;
  windowStart: string;
  windowEnd: string;
  caseRoot: string;
  caseDigests: string[];
  aggregateByProduct: Record<CommercialCohortProduct, CommercialCohortAggregate>;
  manifestDigest: string;
};
