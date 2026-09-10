import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  assertPass35ArtifactParity,
  buildPass35CanonicalPacket,
  type Pass35CanonicalClaim,
  type Pass35CanonicalPacket,
  type Pass35CanonicalPacketInput,
} from "./pass35-canonical-packet.ts";

export const A81_REVISION = "VELMERE_PASS36_A81R0_CANONICAL_BASIC_PRO_ADVANCED_MEGA_MATRIX_ORCHESTRATOR" as const;
const POLICY_SCHEMA = "velmere.pass36.a81.canonical-mega-matrix-orchestrator.v1" as const;
const RUNTIME_SCHEMA = "velmere.pass36.a81.canonical-mega-matrix-runtime.v1" as const;
const PROJECTION_SCHEMA = "velmere.pass36.a81.channel-projection.v1" as const;
const HEX64 = /^[a-f0-9]{64}$/u;
const TIERS = ["basic", "pro", "advanced"] as const;
const LOCALES = ["pl", "en", "de"] as const;
const CHANNELS = ["api", "ui", "preview", "pdf", "brain", "angel"] as const;

type Tier = typeof TIERS[number];
type Locale = typeof LOCALES[number];
type Channel = typeof CHANNELS[number];

type ProductTierRule = {
  requiredEvidenceFamilies?: string[];
  requiredFields?: string[];
  requiredScenarios?: string[];
  requiredSections?: string[];
};

type ProductSurfaceRule = {
  surfaceId: string;
  tiers?: Partial<Record<Tier, ProductTierRule>>;
};

type ProductTierContract = {
  surfaces?: ProductSurfaceRule[];
};

type CorpusCase = {
  id: string;
  surface: string;
  title: string;
  category: string;
  input: Record<string, unknown>;
  adversarialFlags: string[];
  evidencePolicy: {
    requiredFamilies: string[];
    freshnessPolicy: string;
    licenseRequired: boolean;
    conflictPolicy: string;
    missingPolicy: string;
  };
  expectedByTier: Record<Tier, {
    outcome: string;
    mustFailClosedOnMissingEvidence: boolean;
    requiresHumanReview: boolean;
    minSourceFamilies: number;
    requiredSections: string[];
  }>;
  localePolicy: {
    requiredLocales: string[];
    mustUseRequestedLocale: boolean;
    mustNotFallbackToEnglish: boolean;
  };
  fingerprint: string;
};

type CorpusDocument = {
  schemaVersion: string;
  counts?: {
    casesPerSurface?: number;
  };
  cases: CorpusCase[];
  corpusSha256: string;
};

type MatrixRow = {
  matrixId: string;
  caseId: string;
  surface: string;
  category: string;
  tier: Tier;
  locale: Locale;
  inputFingerprint: string;
  expectedOutcome: string;
  mustFailClosedOnMissingEvidence: boolean;
  requiresHumanReview: boolean;
  minSourceFamilies: number;
  requiredSections: string[];
  status: string;
  evidenceReceipt: null | string;
  matrixFingerprint: string;
};

type AdapterRow = {
  matrixId: string;
  caseId: string;
  surface: string;
  tier: Tier;
  locale: Locale;
  status: "passed" | "blocked";
  contractOk: boolean;
  deterministic: boolean;
  lineage?: boolean;
  lineageChecks?: boolean;
  safety?: boolean;
  evidenceFamilies?: number;
  outputSha256: string;
  outputReceiptSha256?: string;
  blockers?: string[];
  failureCodes?: string[];
};

type ModuleRule = {
  moduleId: string;
  sourceSurface: string;
  productSurfaceId: string | null;
  caseCount: number;
  classification: string;
};

type A81Policy = {
  schemaVersion: string;
  revisionId: string;
  parentRevisionId: string;
  deterministicEpoch: string;
  inputs: Record<string, { path: string; sha256: string }>;
  sourceSurfaces: string[];
  modules: ModuleRule[];
  tiers: Tier[];
  locales: Locale[];
  channels: Channel[];
  claimCountsByTier: Record<Tier, number>;
  minimumIncrementByUpgrade: { materialClaims: number; evidenceFamilies: number; scenarios: number };
  supplementalEvidenceFamilies: Record<Tier, string[]>;
  expectedDenominators: Record<string, number>;
  mutationFamilies: string[];
  requiredInvariants: string[];
  truthBoundary: string;
};

type Projection = {
  schemaVersion: typeof PROJECTION_SCHEMA;
  channel: Channel;
  matrixId: string;
  sourceMatrixId: string;
  moduleId: string;
  sourceSurface: string;
  rootCaseId: string;
  rootCaseHash: string;
  rootFactsHash: string;
  semanticFactsHash: string;
  tier: Tier;
  locale: Locale;
  packetId: string;
  packetHash: string;
  factsHash: string;
  sourceClaimIds: string[];
  outputClaimIds: string[];
  addsFacts: false;
  dropsFacts: false;
  adapterStatus: string;
  analysisDecision: string;
  deliveryDecision: "UNAVAILABLE_NOT_FOR_SALE";
  physicalPdfRendered: false;
  browserExecuted: false;
  modelExecuted: false;
  exactA80CandidateBound: false;
  customerPurchaseWorthinessProven: false;
  liveProven: false;
  saleEnabled: false;
  projectionDigestSha256: string;
};

export type A81Runtime = {
  schemaVersion: typeof RUNTIME_SCHEMA;
  revisionId: typeof A81_REVISION;
  parentRevisionId: string;
  generatedAt: string;
  inputs: Record<string, { path: string; sha256: string }>;
  denominators: {
    uniqueBaseCases: number;
    sourceMatrixRows: number;
    sourceAdapterRows: number;
    moduleCases: number;
    packetRows: number;
    channelProjections: number;
    mutationDenominator: number;
    mutationKilled: number;
  };
  coverage: {
    modules: Record<string, { sourceCases: number; packetRows: number; channelProjections: number }>;
    sourceSurfaces: Record<string, number>;
    tiers: Record<Tier, number>;
    locales: Record<Locale, number>;
    channels: Record<Channel, number>;
    adapterStatus: Record<string, number>;
    analysisDecision: Record<string, number>;
  };
  claimCounts: Record<Tier, { packets: number; claimsPerPacket: number; totalClaims: number }>;
  invariants: {
    adapterCoverageFailures: number;
    moduleCoverageFailures: number;
    rootIdentityFailures: number;
    crossLocaleFactsFailures: number;
    crossChannelParityFailures: number;
    tierMonotonicityFailures: number;
    tierEvidenceDeltaFailures: number;
    tierScenarioDeltaFailures: number;
    truthBoundaryFailures: number;
    mutationSurvivors: number;
  };
  rows: Array<{
    matrixId: string;
    sourceMatrixId: string;
    moduleId: string;
    sourceSurface: string;
    rootCaseId: string;
    rootCaseHash: string;
    rootFactsHash: string;
    semanticFactsHash: string;
    tier: Tier;
    locale: Locale;
    packetId: string;
    packetHash: string;
    factsHash: string;
    claimCount: number;
    evidenceFamilyCount: number;
    scenarioCount: number;
    adapterStatus: string;
    analysisDecision: string;
    projectionAggregateSha256: string;
    rowDigestSha256: string;
  }>;
  syntheticAdapterRowsOrchestrated: number;
  canonicalProviderBoundOutputsExecuted: 0;
  physicalCustomerPdfOutputsExecuted: 0;
  browserRunsExecuted: 0;
  modelRunsExecuted: 0;
  exactA80CandidateBound: false;
  customerPurchaseWorthinessProven: false;
  liveProven: false;
  saleEnabled: false;
  worldClassProven: false;
  truthBoundary: string;
  integrity: { algorithm: "sha256"; digest: string };
};

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    const object = value as Record<string, unknown>;
    return `{${Object.keys(object).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(object[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function sha256(value: unknown): string {
  const input = Buffer.isBuffer(value) ? value : Buffer.from(typeof value === "string" ? value : canonicalJson(value));
  return createHash("sha256").update(input).digest("hex");
}

function fileSha256(filePath: string): string {
  return sha256(readFileSync(filePath));
}

function readJson<T>(filePath: string): T {
  return JSON.parse(readFileSync(filePath, "utf8")) as T;
}

function readJsonl<T>(filePath: string): T[] {
  return readFileSync(filePath, "utf8").split(/\r?\n/u).filter(Boolean).map((line) => JSON.parse(line) as T);
}

function unique<T>(values: readonly T[]): T[] {
  return [...new Set(values)];
}

function sorted(values: readonly string[]): string[] {
  return [...values].sort((left, right) => left.localeCompare(right, "en"));
}

function assertCondition(condition: unknown, code: string): asserts condition {
  if (!condition) throw new Error(code);
}

function verifyFileBinding(root: string, binding: { path: string; sha256: string }, key: string): void {
  const observed = fileSha256(path.join(root, binding.path));
  if (observed !== binding.sha256) throw new Error(`a81_input_hash_mismatch:${key}:${observed}`);
}

function validatePolicy(policy: A81Policy): void {
  assertCondition(policy.schemaVersion === POLICY_SCHEMA, "a81_policy_schema_invalid");
  assertCondition(policy.revisionId === A81_REVISION, "a81_policy_revision_invalid");
  assertCondition(policy.modules.length === 10, "a81_policy_module_count_invalid");
  assertCondition(new Set(policy.modules.map((row) => row.moduleId)).size === policy.modules.length, "a81_policy_module_duplicate");
  assertCondition(JSON.stringify(policy.tiers) === JSON.stringify(TIERS), "a81_policy_tiers_invalid");
  assertCondition(JSON.stringify(policy.locales) === JSON.stringify(LOCALES), "a81_policy_locales_invalid");
  assertCondition(JSON.stringify(policy.channels) === JSON.stringify(CHANNELS), "a81_policy_channels_invalid");
  assertCondition(policy.mutationFamilies.length === 8, "a81_policy_mutation_family_count_invalid");
  assertCondition(policy.requiredInvariants.length >= 12, "a81_policy_invariants_incomplete");
  for (const [key, binding] of Object.entries(policy.inputs)) {
    assertCondition(typeof binding.path === "string" && HEX64.test(binding.sha256), `a81_policy_input_invalid:${key}`);
  }
}

function buildAdapterMap(rows: AdapterRow[]): Map<string, AdapterRow> {
  const map = new Map<string, AdapterRow>();
  for (const row of rows) {
    if (map.has(row.matrixId)) throw new Error(`a81_adapter_duplicate:${row.matrixId}`);
    if (!HEX64.test(row.outputSha256)) throw new Error(`a81_adapter_output_hash_invalid:${row.matrixId}`);
    if (row.contractOk !== true || row.deterministic !== true || (row.lineage !== true && row.lineageChecks !== true)) {
      throw new Error(`a81_adapter_contract_invalid:${row.matrixId}`);
    }
    map.set(row.matrixId, row);
  }
  return map;
}

function productSurface(productContract: ProductTierContract, surfaceId: string | null): ProductSurfaceRule | null {
  if (!surfaceId) return null;
  const surface = productContract.surfaces?.find((row) => row.surfaceId === surfaceId);
  if (!surface) throw new Error(`a81_product_surface_missing:${surfaceId}`);
  return surface;
}

function tierSpec(policy: A81Policy, module: ModuleRule, tier: Tier, corpusCase: CorpusCase, productContract: ProductTierContract): {
  fields: string[];
  evidenceFamilies: string[];
  scenarios: string[];
  sections: string[];
} {
  const surface = productSurface(productContract, module.productSurfaceId);
  const tierContract = surface?.tiers?.[tier] ?? null;
  const expected = corpusCase.expectedByTier[tier];
  const baseEvidence = tierContract?.requiredEvidenceFamilies ?? corpusCase.evidencePolicy.requiredFamilies;
  const inheritedEvidence: string[] = [];
  if (tier !== "basic") inheritedEvidence.push(...policy.supplementalEvidenceFamilies.basic);
  if (tier === "advanced") inheritedEvidence.push(...policy.supplementalEvidenceFamilies.pro);
  const evidenceFamilies = unique([
    ...baseEvidence,
    ...inheritedEvidence,
    ...policy.supplementalEvidenceFamilies[tier],
  ]);
  const fields = unique([
    ...(tierContract?.requiredFields ?? []),
    ...expected.requiredSections.map((section) => `section:${section}`),
    `module:${module.moduleId}`,
    `case:${corpusCase.category}`,
  ]);
  const scenarios = unique([
    ...(tierContract?.requiredScenarios ?? []),
    ...(tier === "pro" ? ["cross_channel_parity"] : []),
    ...(tier === "advanced" ? ["contradiction_and_provenance_replay"] : []),
  ]);
  const sections = unique([...(tierContract?.requiredSections ?? []), ...expected.requiredSections]);
  return { fields, evidenceFamilies, scenarios, sections };
}

function rootFacts(corpusCase: CorpusCase): Record<string, unknown> {
  return {
    caseId: corpusCase.id,
    surface: corpusCase.surface,
    category: corpusCase.category,
    input: corpusCase.input,
    adversarialFlags: sorted(corpusCase.adversarialFlags ?? []),
    evidencePolicy: corpusCase.evidencePolicy,
    expectedByTier: corpusCase.expectedByTier,
    fingerprint: corpusCase.fingerprint,
  };
}

function buildClaimBlueprint(args: {
  policy: A81Policy;
  module: ModuleRule;
  tier: Tier;
  corpusCase: CorpusCase;
  adapter: AdapterRow;
  productContract: ProductTierContract;
}): { claims: Pass35CanonicalClaim[]; evidenceFamilies: string[]; scenarios: string[]; semanticFactsHash: string } {
  const { policy, module, tier, corpusCase, adapter, productContract } = args;
  const spec = tierSpec(policy, module, tier, corpusCase, productContract);
  const desired = policy.claimCountsByTier[tier];
  const coreSlots = [
    ["fact.case_identity", "FACT", `Case ${corpusCase.id} is bound to fingerprint ${corpusCase.fingerprint}.`],
    ["fact.module_scope", "FACT", `Module ${module.moduleId} derives from source surface ${module.sourceSurface}.`],
    ["fact.adapter_status", "FACT", `Source adapter status is ${adapter.status} and remains fail-closed.`],
    ["fact.evidence_policy", "FACT", `Evidence policy is ${corpusCase.evidencePolicy.missingPolicy}.`],
    ["limitation.synthetic_only", "LIMITATION", "This matrix row uses frozen synthetic adapter evidence only."],
    ["limitation.no_live", "LIMITATION", "No LIVE, staging or production behavior is proven."],
    ["not_tested.real_provider", "NOT_TESTED", "Real provider execution is not part of A81."],
    ["not_tested.customer_value", "NOT_TESTED", "Customer comprehension and purchase-worthiness are not tested in A81."],
  ] as const;
  const claims: Pass35CanonicalClaim[] = coreSlots.map(([claimId, kind, text], index) => ({
    claimId,
    kind,
    text,
    severity: kind === "FACT" ? "info" : null,
    confidence: kind === "FACT" ? 0.98 : null,
    evidenceIds: [`${module.moduleId}.evidence.${spec.evidenceFamilies[index % spec.evidenceFamilies.length]}`],
  }));
  const addTierClaims = (prefix: "pro" | "advanced", count: number, offset: number) => {
    for (let index = 0; index < count; index += 1) {
      const field = spec.fields[(offset + index) % spec.fields.length] ?? `${prefix}_field_${index + 1}`;
      const scenario = spec.scenarios[index % Math.max(1, spec.scenarios.length)] ?? `${prefix}_scenario`;
      const family = spec.evidenceFamilies[(offset + index) % spec.evidenceFamilies.length];
      claims.push({
        claimId: `finding.${prefix}.${String(index + 1).padStart(2, "0")}`,
        kind: "FINDING",
        text: `${prefix.toUpperCase()} increment binds ${field} to scenario ${scenario}.`,
        severity: prefix === "advanced" && index % 4 === 0 ? "medium" : "low",
        confidence: prefix === "advanced" ? 0.84 : 0.88,
        evidenceIds: [`${module.moduleId}.evidence.${family}`],
      });
    }
  };
  if (tier === "pro" || tier === "advanced") addTierClaims("pro", policy.minimumIncrementByUpgrade.materialClaims, 0);
  if (tier === "advanced") addTierClaims("advanced", policy.minimumIncrementByUpgrade.materialClaims, policy.minimumIncrementByUpgrade.materialClaims);
  if (claims.length !== desired) throw new Error(`a81_claim_count_invalid:${module.moduleId}:${tier}:${claims.length}/${desired}`);
  const semanticFactsHash = sha256(claims.map((claim) => ({ claimId: claim.claimId, kind: claim.kind, severity: claim.severity, confidence: claim.confidence, evidenceIds: claim.evidenceIds })));
  return { claims, evidenceFamilies: spec.evidenceFamilies, scenarios: spec.scenarios, semanticFactsHash };
}

function buildPacket(args: {
  policy: A81Policy;
  policyHash: string;
  module: ModuleRule;
  tier: Tier;
  locale: Locale;
  corpusCase: CorpusCase;
  matrixRow: MatrixRow;
  adapter: AdapterRow;
  productContract: ProductTierContract;
  productContractHash: string;
  corpusHash: string;
}): {
  packet: Pass35CanonicalPacket;
  rootCaseHash: string;
  rootFactsHash: string;
  semanticFactsHash: string;
  evidenceFamilies: string[];
  scenarios: string[];
  analysisDecision: string;
} {
  const { policy, policyHash, module, tier, locale, corpusCase, matrixRow, adapter, productContract, productContractHash, corpusHash } = args;
  const rootCaseHash = sha256(`a81-root-case:${corpusCase.id}`);
  const rootFactsHash = sha256(rootFacts(corpusCase));
  const blueprint = buildClaimBlueprint({ policy, module, tier, corpusCase, adapter, productContract });
  const evidenceIds = unique(blueprint.claims.flatMap((claim) => [...claim.evidenceIds]));
  const provenance = evidenceIds.map((fieldId, index) => ({
    fieldId,
    providerId: `synthetic_adapter_${module.sourceSurface}`,
    providerFamily: blueprint.evidenceFamilies[index % blueprint.evidenceFamilies.length],
    observedAt: policy.deterministicEpoch,
    maxAgeMs: 86400000,
    rightsState: "UNVERIFIED" as const,
    sourceReceiptSha256: sha256(`${adapter.outputSha256}:${fieldId}:${matrixRow.matrixFingerprint}`),
  }));
  const contradictions = corpusCase.adversarialFlags.includes("conflicting_sources") ? [`material_source_conflict:${corpusCase.id}`] : [];
  const missingProof = unique([
    "real_provider_execution",
    "verified_a80_candidate",
    "provider_rights",
    "customer_value",
    ...(adapter.status === "blocked" ? ["source_adapter_blocker_resolution"] : []),
    ...(module.moduleId === "audit_evm" && tier === "advanced" ? ["qualified_human_review"] : []),
  ]);
  const analysisDecision = adapter.status === "blocked" || contradictions.length > 0 ? "ABSTAIN_SYNTHETIC" : "READY_OFFLINE_SYNTHETIC";
  const packetInput: Pass35CanonicalPacketInput = {
    productCellId: `${module.moduleId}.${tier}.${locale}.a81`,
    skuId: `${module.moduleId}_${tier}_a81_not_for_sale`,
    tier,
    releaseId: A81_REVISION,
    sourceSha256: corpusHash,
    artifactSha256: adapter.outputSha256,
    configSha256: policyHash,
    accountIdHash: sha256("a81-non-customer-account"),
    caseIdHash: rootCaseHash,
    providerHashes: [sha256(`adapter:${module.sourceSurface}`), sha256(`adapter-status:${adapter.status}`)],
    dataHashes: unique([rootFactsHash, adapter.outputSha256]),
    modelHash: module.moduleId === "brain" || module.moduleId === "angel" ? sha256(`synthetic-model:${module.moduleId}`) : null,
    promptHash: module.moduleId === "brain" || module.moduleId === "angel" ? sha256(corpusCase.input) : null,
    reviewerHashes: [],
    policyHashes: [policyHash, productContractHash],
    provenance,
    claims: blueprint.claims,
    contradictions,
    missingProof,
    methodology: unique(["canonical_packet_projection", "cross_channel_parity", `module:${module.moduleId}`, `tier:${tier}`]),
    uncertainty: "Synthetic adapter evidence cannot establish real-world accuracy, customer value, LIVE behavior or sale readiness.",
    abstained: analysisDecision === "ABSTAIN_SYNTHETIC",
    humanReview: { required: false, completed: false, reviewerIdHash: null, conflictDeclarationSha256: null },
    commercialRefs: { paymentReceiptHash: null, entitlementIdHash: null, deliveryReceiptHash: null, refundPolicyVersion: "blocked-no-charge-a81" },
    packetState: "ORIGINAL",
    fallbackReason: null,
    supersedesPacketHash: null,
    createdAt: policy.deterministicEpoch,
    validUntil: "2026-07-28T13:00:00.000Z",
    invalidationTriggers: ["source_change", "adapter_change", "rights_change", "tier_contract_change", "a80_candidate_change"],
  };
  const packet = buildPass35CanonicalPacket(packetInput);
  return {
    packet,
    rootCaseHash,
    rootFactsHash,
    semanticFactsHash: blueprint.semanticFactsHash,
    evidenceFamilies: blueprint.evidenceFamilies,
    scenarios: blueprint.scenarios,
    analysisDecision,
  };
}

function projectionCore(args: {
  channel: Channel;
  matrixId: string;
  sourceMatrixId: string;
  module: ModuleRule;
  corpusCase: CorpusCase;
  tier: Tier;
  locale: Locale;
  packet: Pass35CanonicalPacket;
  rootCaseHash: string;
  rootFactsHash: string;
  semanticFactsHash: string;
  adapter: AdapterRow;
  analysisDecision: string;
}): Omit<Projection, "projectionDigestSha256"> {
  const claimIds = sorted(args.packet.claims.map((claim) => claim.claimId));
  return {
    schemaVersion: PROJECTION_SCHEMA,
    channel: args.channel,
    matrixId: args.matrixId,
    sourceMatrixId: args.sourceMatrixId,
    moduleId: args.module.moduleId,
    sourceSurface: args.module.sourceSurface,
    rootCaseId: args.corpusCase.id,
    rootCaseHash: args.rootCaseHash,
    rootFactsHash: args.rootFactsHash,
    semanticFactsHash: args.semanticFactsHash,
    tier: args.tier,
    locale: args.locale,
    packetId: args.packet.packetId,
    packetHash: args.packet.packetHash,
    factsHash: args.packet.factsHash,
    sourceClaimIds: claimIds,
    outputClaimIds: claimIds,
    addsFacts: false,
    dropsFacts: false,
    adapterStatus: args.adapter.status,
    analysisDecision: args.analysisDecision,
    deliveryDecision: "UNAVAILABLE_NOT_FOR_SALE",
    physicalPdfRendered: false,
    browserExecuted: false,
    modelExecuted: false,
    exactA80CandidateBound: false,
    customerPurchaseWorthinessProven: false,
    liveProven: false,
    saleEnabled: false,
  };
}

function buildProjection(args: Parameters<typeof projectionCore>[0]): Projection {
  const core = projectionCore(args);
  return { ...core, projectionDigestSha256: sha256(core) };
}

function resealProjection(projection: Projection): Projection {
  const { projectionDigestSha256: _discarded, ...core } = projection;
  return { ...core, projectionDigestSha256: sha256(core) };
}

function verifyProjection(projection: Projection, expected: {
  channel: Channel;
  matrixId: string;
  sourceMatrixId: string;
  moduleId: string;
  sourceSurface: string;
  rootCaseId: string;
  rootCaseHash: string;
  rootFactsHash: string;
  semanticFactsHash: string;
  tier: Tier;
  locale: Locale;
  packet: Pass35CanonicalPacket;
  adapterStatus: string;
  analysisDecision: string;
}): boolean {
  try {
    const claimIds = sorted(expected.packet.claims.map((claim) => claim.claimId));
    if (projection.schemaVersion !== PROJECTION_SCHEMA) return false;
    if (projection.channel !== expected.channel || projection.matrixId !== expected.matrixId || projection.sourceMatrixId !== expected.sourceMatrixId) return false;
    if (projection.moduleId !== expected.moduleId || projection.sourceSurface !== expected.sourceSurface || projection.rootCaseId !== expected.rootCaseId) return false;
    if (projection.rootCaseHash !== expected.rootCaseHash || projection.rootFactsHash !== expected.rootFactsHash || projection.semanticFactsHash !== expected.semanticFactsHash) return false;
    if (projection.tier !== expected.tier || projection.locale !== expected.locale) return false;
    if (projection.packetId !== expected.packet.packetId || projection.packetHash !== expected.packet.packetHash || projection.factsHash !== expected.packet.factsHash) return false;
    if (JSON.stringify(projection.sourceClaimIds) !== JSON.stringify(claimIds) || JSON.stringify(projection.outputClaimIds) !== JSON.stringify(claimIds)) return false;
    if (projection.addsFacts || projection.dropsFacts) return false;
    if (projection.adapterStatus !== expected.adapterStatus || projection.analysisDecision !== expected.analysisDecision) return false;
    if (projection.deliveryDecision !== "UNAVAILABLE_NOT_FOR_SALE") return false;
    if (projection.physicalPdfRendered || projection.browserExecuted || projection.modelExecuted || projection.exactA80CandidateBound) return false;
    if (projection.customerPurchaseWorthinessProven || projection.liveProven || projection.saleEnabled) return false;
    const { projectionDigestSha256, ...core } = projection;
    return projectionDigestSha256 === sha256(core);
  } catch {
    return false;
  }
}

function countMap<T extends string>(keys: readonly T[]): Record<T, number> {
  return Object.fromEntries(keys.map((key) => [key, 0])) as Record<T, number>;
}

function expectedAdapterRows(policy: A81Policy): number {
  return policy.expectedDenominators.sourceAdapterRows;
}

function adapterRowCount(rows: AdapterRow[]): number {
  return rows.length;
}

function validateCorpus(corpus: CorpusDocument, policy: A81Policy): Map<string, CorpusCase[]> {
  assertCondition(corpus.cases.length === policy.expectedDenominators.uniqueBaseCases, `a81_corpus_count:${corpus.cases.length}`);
  assertCondition(corpus.counts?.casesPerSurface === 50, "a81_corpus_cases_per_surface_invalid");
  const grouped = new Map<string, CorpusCase[]>();
  for (const row of corpus.cases) {
    const list = grouped.get(row.surface) ?? [];
    list.push(row);
    grouped.set(row.surface, list);
  }
  for (const surface of policy.sourceSurfaces) assertCondition(grouped.get(surface)?.length === 50, `a81_corpus_surface_count:${surface}:${grouped.get(surface)?.length ?? 0}`);
  return grouped;
}

function verifyRuntimeIntegrity(runtime: A81Runtime): boolean {
  try {
    if (runtime.schemaVersion !== RUNTIME_SCHEMA || runtime.revisionId !== A81_REVISION) return false;
    const { integrity, ...core } = runtime;
    return integrity.algorithm === "sha256" && integrity.digest === sha256(core);
  } catch {
    return false;
  }
}

export function runA81CanonicalMegaMatrix(root: string, policyInput?: A81Policy): A81Runtime {
  const policyPath = path.join(root, "config/pass36/a81-canonical-mega-matrix-orchestrator.json");
  const policy = policyInput ?? readJson<A81Policy>(policyPath);
  validatePolicy(policy);
  for (const [key, binding] of Object.entries(policy.inputs)) verifyFileBinding(root, binding, key);

  const corpus = readJson<CorpusDocument>(path.join(root, policy.inputs.corpus.path));
  const sourceMatrixRows = readJsonl<MatrixRow>(path.join(root, policy.inputs.matrix.path));
  const marketRows = readJsonl<AdapterRow>(path.join(root, policy.inputs.marketAdapterIndex.path));
  const auditRows = readJsonl<AdapterRow>(path.join(root, policy.inputs.auditLensAdapterIndex.path));
  const brainRows = readJsonl<AdapterRow>(path.join(root, policy.inputs.brainAngelAdapterIndex.path));
  const adapterRows = [...marketRows, ...auditRows, ...brainRows];
  const productContract = readJson<ProductTierContract>(path.join(root, policy.inputs.productTierContract.path));
  const policyHash = sha256(policy);
  const corpusHash = policy.inputs.corpus.sha256;
  const productContractHash = policy.inputs.productTierContract.sha256;

  const corpusBySurface = validateCorpus(corpus, policy);
  assertCondition(sourceMatrixRows.length === policy.expectedDenominators.sourceMatrixRows, `a81_source_matrix_count:${sourceMatrixRows.length}`);
  assertCondition(adapterRowCount(adapterRows) === expectedAdapterRows(policy), `a81_adapter_row_count:${adapterRows.length}`);
  const sourceMatrixMap = new Map(sourceMatrixRows.map((row) => [row.matrixId, row]));
  assertCondition(sourceMatrixMap.size === sourceMatrixRows.length, "a81_source_matrix_duplicate");
  const adapterMap = buildAdapterMap(adapterRows);
  assertCondition(adapterMap.size === sourceMatrixRows.length, `a81_adapter_unique_count:${adapterMap.size}`);
  let adapterCoverageFailures = 0;
  for (const row of sourceMatrixRows) {
    const adapter = adapterMap.get(row.matrixId);
    if (!adapter || adapter.caseId !== row.caseId || adapter.surface !== row.surface || adapter.tier !== row.tier || adapter.locale !== row.locale) adapterCoverageFailures += 1;
  }

  const moduleCoverage = Object.fromEntries(policy.modules.map((module) => [module.moduleId, { sourceCases: 0, packetRows: 0, channelProjections: 0 }])) as Record<string, { sourceCases: number; packetRows: number; channelProjections: number }>;
  const sourceSurfaceCounts: Record<string, number> = Object.fromEntries(policy.sourceSurfaces.map((surface) => [surface, corpusBySurface.get(surface)?.length ?? 0]));
  const tierCounts = countMap(TIERS);
  const localeCounts = countMap(LOCALES);
  const channelCounts = countMap(CHANNELS);
  const adapterStatusCounts: Record<string, number> = {};
  const decisionCounts: Record<string, number> = {};
  const claimCounts: Record<Tier, { packets: number; claimsPerPacket: number; totalClaims: number }> = {
    basic: { packets: 0, claimsPerPacket: policy.claimCountsByTier.basic, totalClaims: 0 },
    pro: { packets: 0, claimsPerPacket: policy.claimCountsByTier.pro, totalClaims: 0 },
    advanced: { packets: 0, claimsPerPacket: policy.claimCountsByTier.advanced, totalClaims: 0 },
  };
  const rows: A81Runtime["rows"] = [];
  const rootHashByCase = new Map<string, string>();
  const localeFactsGroups = new Map<string, Set<string>>();
  const tierGroups = new Map<string, Map<Tier, { claimIds: string[]; evidenceFamilies: string[]; scenarios: string[] }>>();
  let moduleCases = 0;
  let projections = 0;
  let mutationDenominator = 0;
  let mutationKilled = 0;
  let moduleCoverageFailures = 0;
  let rootIdentityFailures = 0;
  let crossChannelParityFailures = 0;
  let truthBoundaryFailures = 0;

  for (const policyModule of policy.modules) {
    const cases = corpusBySurface.get(policyModule.sourceSurface) ?? [];
    moduleCoverage[policyModule.moduleId].sourceCases = cases.length;
    if (cases.length !== policyModule.caseCount) moduleCoverageFailures += 1;
    moduleCases += cases.length;
    for (const corpusCase of cases) {
      const rootHash = sha256(`a81-root-case:${corpusCase.id}`);
      const priorRootHash = rootHashByCase.get(corpusCase.id);
      if (priorRootHash && priorRootHash !== rootHash) rootIdentityFailures += 1;
      rootHashByCase.set(corpusCase.id, rootHash);
      for (const tier of TIERS) {
        for (const locale of LOCALES) {
          const sourceMatrixId = `${corpusCase.id}::${tier}::${locale}`;
          const sourceMatrix = sourceMatrixMap.get(sourceMatrixId);
          const adapter = adapterMap.get(sourceMatrixId);
          if (!sourceMatrix || !adapter) throw new Error(`a81_source_row_missing:${sourceMatrixId}`);
          const matrixId = `${policyModule.moduleId}::${corpusCase.id}::${tier}::${locale}`;
          const built = buildPacket({
            policy,
            policyHash,
            module: policyModule,
            tier,
            locale,
            corpusCase,
            matrixRow: sourceMatrix,
            adapter,
            productContract,
            productContractHash,
            corpusHash,
          });
          const packet = built.packet;
          const claimIds = sorted(packet.claims.map((claim) => claim.claimId));
          const projectionRows = CHANNELS.map((channel) => buildProjection({
            channel,
            matrixId,
            sourceMatrixId,
            module: policyModule,
            corpusCase,
            tier,
            locale,
            packet,
            rootCaseHash: built.rootCaseHash,
            rootFactsHash: built.rootFactsHash,
            semanticFactsHash: built.semanticFactsHash,
            adapter,
            analysisDecision: built.analysisDecision,
          }));
          try {
            assertPass35ArtifactParity(packet, projectionRows.map((projection) => ({ channel: projection.channel, packetId: projection.packetId, packetHash: projection.packetHash, factsHash: projection.factsHash })));
          } catch {
            crossChannelParityFailures += 1;
          }
          for (const projection of projectionRows) {
            if (!verifyProjection(projection, {
              channel: projection.channel,
              matrixId,
              sourceMatrixId,
              moduleId: policyModule.moduleId,
              sourceSurface: policyModule.sourceSurface,
              rootCaseId: corpusCase.id,
              rootCaseHash: built.rootCaseHash,
              rootFactsHash: built.rootFactsHash,
              semanticFactsHash: built.semanticFactsHash,
              tier,
              locale,
              packet,
              adapterStatus: adapter.status,
              analysisDecision: built.analysisDecision,
            })) crossChannelParityFailures += 1;
            channelCounts[projection.channel] += 1;
          }
          const mutationBase = projectionRows[0];
          const mutationCases: Projection[] = [
            resealProjection({ ...mutationBase, packetHash: sha256("mutated-packet") }),
            resealProjection({ ...mutationBase, factsHash: sha256("mutated-facts") }),
            resealProjection({ ...mutationBase, outputClaimIds: [...mutationBase.outputClaimIds, "invented.claim"] }),
            resealProjection({ ...mutationBase, outputClaimIds: mutationBase.outputClaimIds.slice(1) }),
            resealProjection({ ...mutationBase, tier: tier === "basic" ? "pro" : "basic" }),
            resealProjection({ ...mutationBase, saleEnabled: true as any }),
            resealProjection({ ...mutationBase, adapterStatus: mutationBase.adapterStatus === "blocked" ? "passed" : "blocked" }),
            resealProjection({ ...mutationBase, analysisDecision: mutationBase.analysisDecision === "ABSTAIN_SYNTHETIC" ? "READY_OFFLINE_SYNTHETIC" : "ABSTAIN_SYNTHETIC" }),
          ];
          for (const mutant of mutationCases) {
            mutationDenominator += 1;
            const killed = !verifyProjection(mutant, {
              channel: mutationBase.channel,
              matrixId,
              sourceMatrixId,
              moduleId: policyModule.moduleId,
              sourceSurface: policyModule.sourceSurface,
              rootCaseId: corpusCase.id,
              rootCaseHash: built.rootCaseHash,
              rootFactsHash: built.rootFactsHash,
              semanticFactsHash: built.semanticFactsHash,
              tier,
              locale,
              packet,
              adapterStatus: adapter.status,
              analysisDecision: built.analysisDecision,
            });
            if (killed) mutationKilled += 1;
          }
          const projectionAggregateSha256 = sha256(projectionRows.map((projection) => projection.projectionDigestSha256));
          const rowCore = {
            matrixId,
            sourceMatrixId,
            moduleId: policyModule.moduleId,
            sourceSurface: policyModule.sourceSurface,
            rootCaseId: corpusCase.id,
            rootCaseHash: built.rootCaseHash,
            rootFactsHash: built.rootFactsHash,
            semanticFactsHash: built.semanticFactsHash,
            tier,
            locale,
            packetId: packet.packetId,
            packetHash: packet.packetHash,
            factsHash: packet.factsHash,
            claimCount: packet.claims.length,
            evidenceFamilyCount: built.evidenceFamilies.length,
            scenarioCount: built.scenarios.length,
            adapterStatus: adapter.status,
            analysisDecision: built.analysisDecision,
            projectionAggregateSha256,
          };
          rows.push({ ...rowCore, rowDigestSha256: sha256(rowCore) });
          moduleCoverage[policyModule.moduleId].packetRows += 1;
          moduleCoverage[policyModule.moduleId].channelProjections += CHANNELS.length;
          projections += CHANNELS.length;
          tierCounts[tier] += 1;
          localeCounts[locale] += 1;
          adapterStatusCounts[adapter.status] = (adapterStatusCounts[adapter.status] ?? 0) + 1;
          decisionCounts[built.analysisDecision] = (decisionCounts[built.analysisDecision] ?? 0) + 1;
          claimCounts[tier].packets += 1;
          claimCounts[tier].totalClaims += packet.claims.length;
          const localeKey = `${policyModule.moduleId}:${corpusCase.id}:${tier}`;
          const factsSet = localeFactsGroups.get(localeKey) ?? new Set<string>();
          factsSet.add(packet.factsHash);
          localeFactsGroups.set(localeKey, factsSet);
          const tierKey = `${policyModule.moduleId}:${corpusCase.id}:${locale}`;
          const tierMap = tierGroups.get(tierKey) ?? new Map<Tier, { claimIds: string[]; evidenceFamilies: string[]; scenarios: string[] }>();
          tierMap.set(tier, { claimIds, evidenceFamilies: sorted(built.evidenceFamilies), scenarios: sorted(built.scenarios) });
          tierGroups.set(tierKey, tierMap);
          if (projectionRows.some((projection) => projection.saleEnabled || projection.liveProven || projection.customerPurchaseWorthinessProven || projection.exactA80CandidateBound || projection.physicalPdfRendered || projection.browserExecuted || projection.modelExecuted)) truthBoundaryFailures += 1;
        }
      }
    }
  }

  let crossLocaleFactsFailures = 0;
  for (const factsSet of localeFactsGroups.values()) if (factsSet.size !== 1) crossLocaleFactsFailures += 1;
  let tierMonotonicityFailures = 0;
  let tierEvidenceDeltaFailures = 0;
  let tierScenarioDeltaFailures = 0;
  for (const tierMap of tierGroups.values()) {
    const basic = tierMap.get("basic");
    const pro = tierMap.get("pro");
    const advanced = tierMap.get("advanced");
    if (!basic || !pro || !advanced) {
      tierMonotonicityFailures += 1;
      continue;
    }
    const basicSet = new Set(basic.claimIds);
    const proSet = new Set(pro.claimIds);
    const advancedSet = new Set(advanced.claimIds);
    if (![...basicSet].every((value) => proSet.has(value)) || ![...proSet].every((value) => advancedSet.has(value))) tierMonotonicityFailures += 1;
    if (proSet.size - basicSet.size < policy.minimumIncrementByUpgrade.materialClaims || advancedSet.size - proSet.size < policy.minimumIncrementByUpgrade.materialClaims) tierMonotonicityFailures += 1;
    const basicEvidence = new Set(basic.evidenceFamilies);
    const proEvidence = new Set(pro.evidenceFamilies);
    const advancedEvidence = new Set(advanced.evidenceFamilies);
    const proDelta = [...proEvidence].filter((value) => !basicEvidence.has(value)).length;
    const advancedDelta = [...advancedEvidence].filter((value) => !proEvidence.has(value)).length;
    if (proDelta < policy.minimumIncrementByUpgrade.evidenceFamilies || advancedDelta < policy.minimumIncrementByUpgrade.evidenceFamilies) tierEvidenceDeltaFailures += 1;
    const basicScenarios = new Set(basic.scenarios);
    const proScenarios = new Set(pro.scenarios);
    const advancedScenarios = new Set(advanced.scenarios);
    const proScenarioDelta = [...proScenarios].filter((value) => !basicScenarios.has(value)).length;
    const advancedScenarioDelta = [...advancedScenarios].filter((value) => !proScenarios.has(value)).length;
    if (proScenarioDelta < policy.minimumIncrementByUpgrade.scenarios || advancedScenarioDelta < policy.minimumIncrementByUpgrade.scenarios) tierScenarioDeltaFailures += 1;
  }

  const runtimeCore: Omit<A81Runtime, "integrity"> = {
    schemaVersion: RUNTIME_SCHEMA,
    revisionId: A81_REVISION,
    parentRevisionId: policy.parentRevisionId,
    generatedAt: policy.deterministicEpoch,
    inputs: policy.inputs,
    denominators: {
      uniqueBaseCases: corpus.cases.length,
      sourceMatrixRows: sourceMatrixRows.length,
      sourceAdapterRows: adapterRows.length,
      moduleCases,
      packetRows: rows.length,
      channelProjections: projections,
      mutationDenominator,
      mutationKilled,
    },
    coverage: {
      modules: moduleCoverage,
      sourceSurfaces: sourceSurfaceCounts,
      tiers: tierCounts,
      locales: localeCounts,
      channels: channelCounts,
      adapterStatus: adapterStatusCounts,
      analysisDecision: decisionCounts,
    },
    claimCounts,
    invariants: {
      adapterCoverageFailures,
      moduleCoverageFailures,
      rootIdentityFailures,
      crossLocaleFactsFailures,
      crossChannelParityFailures,
      tierMonotonicityFailures,
      tierEvidenceDeltaFailures,
      tierScenarioDeltaFailures,
      truthBoundaryFailures,
      mutationSurvivors: mutationDenominator - mutationKilled,
    },
    rows,
    syntheticAdapterRowsOrchestrated: rows.length,
    canonicalProviderBoundOutputsExecuted: 0,
    physicalCustomerPdfOutputsExecuted: 0,
    browserRunsExecuted: 0,
    modelRunsExecuted: 0,
    exactA80CandidateBound: false,
    customerPurchaseWorthinessProven: false,
    liveProven: false,
    saleEnabled: false,
    worldClassProven: false,
    truthBoundary: policy.truthBoundary,
  };
  const runtime: A81Runtime = { ...runtimeCore, integrity: { algorithm: "sha256", digest: sha256(runtimeCore) } };
  if (!verifyRuntimeIntegrity(runtime)) throw new Error("a81_runtime_integrity_internal_failure");
  return runtime;
}

export function verifyA81CanonicalMegaMatrix(runtime: A81Runtime, policy: A81Policy, expectedIntegrityDigest?: string): boolean {
  try {
    validatePolicy(policy);
    if (!verifyRuntimeIntegrity(runtime)) return false;
    if (expectedIntegrityDigest !== undefined && runtime.integrity.digest !== expectedIntegrityDigest) return false;
    const expected = policy.expectedDenominators;
    if (runtime.denominators.uniqueBaseCases !== expected.uniqueBaseCases) return false;
    if (runtime.denominators.sourceMatrixRows !== expected.sourceMatrixRows || runtime.denominators.sourceAdapterRows !== expected.sourceAdapterRows) return false;
    if (runtime.denominators.moduleCases !== expected.moduleCases || runtime.denominators.packetRows !== expected.packetRows) return false;
    if (runtime.denominators.channelProjections !== expected.channelProjections || runtime.denominators.mutationDenominator !== expected.mutationDenominator) return false;
    if (runtime.denominators.mutationKilled !== runtime.denominators.mutationDenominator) return false;
    if (runtime.rows.length !== expected.packetRows || new Set(runtime.rows.map((row) => row.matrixId)).size !== runtime.rows.length) return false;
    const expectedModuleIds = new Set(policy.modules.map((row) => row.moduleId));
    const recomputedModules: A81Runtime["coverage"]["modules"] = Object.fromEntries(policy.modules.map((module) => [module.moduleId, { sourceCases: 0, packetRows: 0, channelProjections: 0 }]));
    const moduleCases = new Map<string, Set<string>>();
    const recomputedTiers = countMap(TIERS);
    const recomputedLocales = countMap(LOCALES);
    const recomputedAdapterStatus: Record<string, number> = {};
    const recomputedDecision: Record<string, number> = {};
    const recomputedClaims: Record<Tier, number> = { basic: 0, pro: 0, advanced: 0 };
    for (const row of runtime.rows) {
      if (!expectedModuleIds.has(row.moduleId)) return false;
      if (!TIERS.includes(row.tier) || !LOCALES.includes(row.locale)) return false;
      if (row.matrixId !== `${row.moduleId}::${row.rootCaseId}::${row.tier}::${row.locale}`) return false;
      if (row.sourceMatrixId !== `${row.rootCaseId}::${row.tier}::${row.locale}`) return false;
      if (![row.rootCaseHash, row.rootFactsHash, row.semanticFactsHash, row.packetHash, row.factsHash, row.projectionAggregateSha256, row.rowDigestSha256].every((value) => HEX64.test(value))) return false;
      const { rowDigestSha256, ...rowCore } = row;
      if (rowDigestSha256 !== sha256(rowCore)) return false;
      if (row.claimCount !== policy.claimCountsByTier[row.tier]) return false;
      if (row.evidenceFamilyCount < 1 || row.scenarioCount < 0) return false;
      const caseSet = moduleCases.get(row.moduleId) ?? new Set<string>();
      caseSet.add(row.rootCaseId);
      moduleCases.set(row.moduleId, caseSet);
      recomputedModules[row.moduleId].packetRows += 1;
      recomputedModules[row.moduleId].channelProjections += CHANNELS.length;
      recomputedTiers[row.tier] += 1;
      recomputedLocales[row.locale] += 1;
      recomputedAdapterStatus[row.adapterStatus] = (recomputedAdapterStatus[row.adapterStatus] ?? 0) + 1;
      recomputedDecision[row.analysisDecision] = (recomputedDecision[row.analysisDecision] ?? 0) + 1;
      recomputedClaims[row.tier] += row.claimCount;
    }
    for (const policyModule of policy.modules) {
      recomputedModules[policyModule.moduleId].sourceCases = moduleCases.get(policyModule.moduleId)?.size ?? 0;
    }
    if (canonicalJson(recomputedModules) !== canonicalJson(runtime.coverage.modules)) return false;
    if (canonicalJson(recomputedTiers) !== canonicalJson(runtime.coverage.tiers)) return false;
    if (canonicalJson(recomputedLocales) !== canonicalJson(runtime.coverage.locales)) return false;
    if (canonicalJson(recomputedAdapterStatus) !== canonicalJson(runtime.coverage.adapterStatus)) return false;
    if (canonicalJson(recomputedDecision) !== canonicalJson(runtime.coverage.analysisDecision)) return false;
    for (const tier of TIERS) {
      if (runtime.claimCounts[tier].packets !== recomputedTiers[tier]) return false;
      if (runtime.claimCounts[tier].totalClaims !== recomputedClaims[tier]) return false;
    }
    if (Object.values(runtime.invariants).some((value) => value !== 0)) return false;
    if (Object.values(runtime.coverage.modules).some((row) => row.sourceCases !== 50 || row.packetRows !== 450 || row.channelProjections !== 2700)) return false;
    if (Object.values(runtime.coverage.tiers).some((value) => value !== 1500)) return false;
    if (Object.values(runtime.coverage.locales).some((value) => value !== 1500)) return false;
    if (Object.values(runtime.coverage.channels).some((value) => value !== 4500)) return false;
    if (runtime.claimCounts.basic.claimsPerPacket !== 8 || runtime.claimCounts.pro.claimsPerPacket !== 16 || runtime.claimCounts.advanced.claimsPerPacket !== 24) return false;
    if (runtime.canonicalProviderBoundOutputsExecuted !== 0 || runtime.physicalCustomerPdfOutputsExecuted !== 0 || runtime.browserRunsExecuted !== 0 || runtime.modelRunsExecuted !== 0) return false;
    if (runtime.exactA80CandidateBound || runtime.customerPurchaseWorthinessProven || runtime.liveProven || runtime.saleEnabled || runtime.worldClassProven) return false;
    return true;
  } catch {
    return false;
  }
}

export const A81_CHANNELS = CHANNELS;
export const A81_TIERS = TIERS;
export const A81_LOCALES = LOCALES;
