export const ANALYSIS_TIERS = [
  { label: "Basic", meta: "quick read", durationSeconds: 10 },
  { label: "Pro", meta: "source depth", durationSeconds: 14 },
  { label: "Advanced", meta: "full matrix", durationSeconds: 20 },
] as const;

export type AnalysisTierLabel = (typeof ANALYSIS_TIERS)[number]["label"];

export type VlmServerEvidencePacket = {
  schemaVersion?: string;
  asset?: {
    id?: string;
    symbol?: string;
    name?: string;
    assetClass?: string;
  };
  observedAt?: string;
  depth?: "basic" | "pro" | "advanced";
  surface?: "shield" | "shield_pro" | "real_markets" | "shield_map" | "lens" | "angel";
  requestBinding?: {
    requestId?: string;
    query?: string;
    depth?: "basic" | "pro" | "advanced";
    surface?: "shield" | "shield_pro" | "real_markets" | "shield_map" | "lens" | "angel";
    issuedAt?: string;
  };
  confidenceCap?: number;
  sourceCount?: number;
  providerCount?: number;
  providers?: string[];
  factsWithValue?: number;
  missingFacts?: number;
  missingData?: string[];
  nextChecks?: string[];
  sourceHealth?: {
    evidenceQuorum?: string;
    integrity?: string;
    temporal?: string;
  };
  claimPolicy?: {
    publicRule?: string;
    noUnsupportedLiquidityClaims?: boolean;
    noHolderClaimsWithoutHolderData?: boolean;
    noContractClaimsWithoutContractData?: boolean;
  };
};

export type VlmServerEvidenceStatus = "idle" | "pending" | "verified" | "limited" | "gated";

export type VlmAnalysisRunState = {
  runId: string;
  assetKey: string;
  tier: AnalysisTierLabel;
  durationMs: number;
  startedAt: number;
  progress: number;
  complete: boolean;
  serverEvidenceStatus: VlmServerEvidenceStatus;
  serverEvidencePacket?: VlmServerEvidencePacket | null;
  serverEvidenceMessage?: string | null;
};

export const ANALYSIS_PHASES = [
  { key: "harvest", label: "Signal harvest", meta: "collecting market pulses" },
  { key: "fusion", label: "Source fusion", meta: "merging source context" },
  { key: "neural", label: "Neural mapping", meta: "building the VLM brain mesh" },
  { key: "synthesis", label: "Final synthesis", meta: "assembling the analysis output" },
] as const;
