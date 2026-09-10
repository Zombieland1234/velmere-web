export type VlmReportContextDepth = "basic" | "pro" | "advanced";

export type VlmStandaloneProductId =
  | "shield"
  | "shield-pro"
  | "shield-map"
  | "real-markets"
  | "market-impact"
  | "whale-watch"
  | "angel"
  | "risk-indicator";

export type VlmStandaloneInsightState = "available" | "limited" | "withheld";

export type VlmEvidenceSourceClass =
  | "BLOCKCHAIN_DIRECT"
  | "PROVIDER"
  | "PUBLIC_REGULATOR"
  | "USER_SUPPLIED"
  | "VELMERE_DERIVED"
  | "SIMULATION"
  | "UNKNOWN";

export type VlmInsightEvidenceItem = {
  id: string;
  label: string;
  value: string | number | boolean | null;
  sourceClass: VlmEvidenceSourceClass;
  evidenceRefs: string[];
  observedAt: string | null;
};

export type VlmInsightStatement = {
  id: string;
  text: string;
  evidenceRefs: string[];
};

export type VlmStandaloneInsightContract = {
  schemaVersion: "velmere.standalone-insight.v1";
  productId: VlmStandaloneProductId;
  productClass: "STANDALONE_PRODUCT";
  reportContextDepth: VlmReportContextDepth;
  truthInvariantAcrossReportDepth: true;
  state: VlmStandaloneInsightState;
  facts: VlmInsightEvidenceItem[];
  calculations: VlmInsightEvidenceItem[];
  assumptions: VlmInsightStatement[];
  simulations: VlmInsightStatement[];
  conflicts: VlmInsightStatement[];
  missingProof: string[];
  limitations: string[];
  nextSafeActions: string[];
  prohibitedClaims: {
    buyOrSellInstruction: false;
    leverageInstruction: false;
    positionSizingInstruction: false;
    guaranteedOutcome: false;
    probabilityWithoutCalibration: false;
    paidTierChangesUnderlyingTruth: false;
  };
};

const DEPTH_LIMITS: Record<VlmReportContextDepth, {
  facts: number;
  calculations: number;
  assumptions: number;
  simulations: number;
  conflicts: number;
  missingProof: number;
  limitations: number;
  nextSafeActions: number;
}> = {
  basic: {
    facts: 4,
    calculations: 3,
    assumptions: 3,
    simulations: 2,
    conflicts: 2,
    missingProof: 4,
    limitations: 4,
    nextSafeActions: 3,
  },
  pro: {
    facts: 10,
    calculations: 10,
    assumptions: 7,
    simulations: 7,
    conflicts: 7,
    missingProof: 10,
    limitations: 10,
    nextSafeActions: 7,
  },
  advanced: {
    facts: 50,
    calculations: 50,
    assumptions: 50,
    simulations: 50,
    conflicts: 50,
    missingProof: 50,
    limitations: 50,
    nextSafeActions: 50,
  },
};

function cleanText(value: unknown, maximum = 320): string {
  return typeof value === "string"
    ? value.replace(/[<>\r\n]+/g, " ").replace(/\s+/g, " ").trim().slice(0, maximum)
    : "";
}

function uniqueText(values: readonly unknown[], maximum = 320): string[] {
  return Array.from(new Set(values.map((value) => cleanText(value, maximum)).filter(Boolean)));
}

function cleanEvidenceItem(item: VlmInsightEvidenceItem): VlmInsightEvidenceItem | null {
  const id = cleanText(item.id, 96);
  const label = cleanText(item.label, 180);
  if (!id || !label) return null;
  const value = typeof item.value === "number"
    ? (Number.isFinite(item.value) ? item.value : null)
    : typeof item.value === "boolean" || item.value === null
      ? item.value
      : cleanText(item.value, 500);
  return {
    id,
    label,
    value,
    sourceClass: item.sourceClass,
    evidenceRefs: uniqueText(item.evidenceRefs, 180).slice(0, 24),
    observedAt: item.observedAt && Number.isFinite(Date.parse(item.observedAt))
      ? new Date(item.observedAt).toISOString()
      : null,
  };
}

function cleanStatement(item: VlmInsightStatement): VlmInsightStatement | null {
  const id = cleanText(item.id, 96);
  const text = cleanText(item.text, 500);
  if (!id || !text) return null;
  return {
    id,
    text,
    evidenceRefs: uniqueText(item.evidenceRefs, 180).slice(0, 24),
  };
}

export function buildVlmStandaloneInsightContract(args: {
  productId: VlmStandaloneProductId;
  reportContextDepth: VlmReportContextDepth;
  state: VlmStandaloneInsightState;
  facts?: VlmInsightEvidenceItem[];
  calculations?: VlmInsightEvidenceItem[];
  assumptions?: VlmInsightStatement[];
  simulations?: VlmInsightStatement[];
  conflicts?: VlmInsightStatement[];
  missingProof?: string[];
  limitations?: string[];
  nextSafeActions?: string[];
}): VlmStandaloneInsightContract {
  const limits = DEPTH_LIMITS[args.reportContextDepth];
  const facts = (args.facts ?? []).map(cleanEvidenceItem).filter((row): row is VlmInsightEvidenceItem => Boolean(row));
  const calculations = (args.calculations ?? []).map(cleanEvidenceItem).filter((row): row is VlmInsightEvidenceItem => Boolean(row));
  const assumptions = (args.assumptions ?? []).map(cleanStatement).filter((row): row is VlmInsightStatement => Boolean(row));
  const simulations = (args.simulations ?? []).map(cleanStatement).filter((row): row is VlmInsightStatement => Boolean(row));
  const conflicts = (args.conflicts ?? []).map(cleanStatement).filter((row): row is VlmInsightStatement => Boolean(row));
  return {
    schemaVersion: "velmere.standalone-insight.v1",
    productId: args.productId,
    productClass: "STANDALONE_PRODUCT",
    reportContextDepth: args.reportContextDepth,
    truthInvariantAcrossReportDepth: true,
    state: args.state,
    facts: facts.slice(0, limits.facts),
    calculations: calculations.slice(0, limits.calculations),
    assumptions: assumptions.slice(0, limits.assumptions),
    simulations: simulations.slice(0, limits.simulations),
    conflicts: conflicts.slice(0, limits.conflicts),
    missingProof: uniqueText(args.missingProof ?? [], 260).slice(0, limits.missingProof),
    limitations: uniqueText(args.limitations ?? [], 360).slice(0, limits.limitations),
    nextSafeActions: uniqueText(args.nextSafeActions ?? [], 360).slice(0, limits.nextSafeActions),
    prohibitedClaims: {
      buyOrSellInstruction: false,
      leverageInstruction: false,
      positionSizingInstruction: false,
      guaranteedOutcome: false,
      probabilityWithoutCalibration: false,
      paidTierChangesUnderlyingTruth: false,
    },
  };
}

export function verifyVlmStandaloneInsightContract(value: VlmStandaloneInsightContract): boolean {
  if (value.schemaVersion !== "velmere.standalone-insight.v1") return false;
  if (value.productClass !== "STANDALONE_PRODUCT" || value.truthInvariantAcrossReportDepth !== true) return false;
  if (!(["basic", "pro", "advanced"] as const).includes(value.reportContextDepth)) return false;
  if (!(["available", "limited", "withheld"] as const).includes(value.state)) return false;
  if (Object.values(value.prohibitedClaims).some((allowed) => allowed !== false)) return false;
  const allEvidence = [...value.facts, ...value.calculations];
  if (allEvidence.some((row) => !row.id || !row.label || !Array.isArray(row.evidenceRefs))) return false;
  const allStatements = [...value.assumptions, ...value.simulations, ...value.conflicts];
  if (allStatements.some((row) => !row.id || !row.text || !Array.isArray(row.evidenceRefs))) return false;
  return true;
}
