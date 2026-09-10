import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { loadRealEvidenceContext, verifyPhysicalEvidenceFamilies } from "./pass36-real-evidence-physical-boundary.mjs";

export const A82_REVISION = "VELMERE_PASS36_A82R0_AUDIT_BASIC_PRO_ADVANCED_REAL_CONTRACT_MATRIX_AND_OFFICIAL_TOOL_EVIDENCE_BINDING";
const TIERS = ["basic", "pro", "advanced"];
const TOOLS = ["solc", "slither", "semgrep", "forge"];
const CLASSES = ["KNOWN_VULNERABILITY", "REMEDIATED_PAIR", "BENIGN_CONTROL", "PROXY_UPGRADE_GOVERNANCE", "ECONOMIC_BUSINESS_LOGIC"];
export const canonicalJson = (value) => Array.isArray(value)
  ? `[${value.map(canonicalJson).join(",")}]`
  : value && typeof value === "object"
    ? `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`
    : JSON.stringify(value);
export const sha256 = (value) => createHash("sha256").update(typeof value === "string" || Buffer.isBuffer(value) ? value : canonicalJson(value)).digest("hex");
const assert = (condition, code) => { if (!condition) throw new Error(code); };
const addressFrom = (seed) => `0x${sha256(seed).slice(0, 40)}`;
const reseal = (value) => { const core = structuredClone(value); delete core.integrity; return { ...core, integrity: { algorithm: "sha256", digest: sha256(core) } }; };
const tierFields = { basic: 8, pro: 16, advanced: 24 };
const tierEvidence = { basic: 3, pro: 7, advanced: 11 };

export function validateA82Policy(policy) {
  assert(policy?.revisionId === A82_REVISION, "a82_policy_revision");
  assert(policy?.requiredCaseCount === 50, "a82_policy_cases");
  assert(JSON.stringify(policy?.tiers) === JSON.stringify(TIERS), "a82_policy_tiers");
  assert(policy?.officialToolFamilies?.length === 4, "a82_policy_tools");
  assert(Object.values(policy?.caseClasses ?? {}).every((v) => v === 10), "a82_policy_classes");
  assert(policy?.fixtureDenominators?.semanticMutations === 1000, "a82_policy_mutations");
}

function toolReceipt(caseId, toolId, targetDigest) {
  return reseal({
    schemaVersion: "velmere.pass36.a82.fixture-tool-receipt.v1", caseId, toolId,
    officialBinaryClaimed: false, fixtureOnly: true, paidGateEligible: false,
    version: `fixture-${toolId}-1`, executableSha256: sha256(`${caseId}:${toolId}:exe`),
    configSha256: sha256(`${caseId}:${toolId}:config`), inputSha256: targetDigest,
    rawOutputSha256: sha256(`${caseId}:${toolId}:raw`), targetDigest,
  });
}
function caseCore(i, policy) {
  const caseId = `A82-FIX-${String(i + 1).padStart(3, "0")}`;
  const caseClass = CLASSES[Math.floor(i / 10)];
  const target = {
    chain: "fixture-evm", chainId: 31337, contractAddress: addressFrom(caseId), blockNumber: 100000 + i,
    sourceBundleSha256: sha256(`${caseId}:source`), deployedBytecodeSha256: sha256(`${caseId}:bytecode`),
    compilerSettingsSha256: sha256(`${caseId}:compiler`), librariesSha256: sha256(`${caseId}:libraries`),
  };
  const targetDigest = sha256(target);
  const vulnerable = caseClass !== "BENIGN_CONTROL" && i % 2 === 0;
  const findingIds = vulnerable ? [`A82-FAMILY-${String((i % 15) + 1).padStart(2, "0")}`] : [];
  const labels = reseal({
    schemaVersion: "velmere.pass36.a82.fixture-blind-label.v1", caseId, fixtureOnly: true,
    blindBeforeExecution: true, knownFindingIds: findingIds, knownFindingCount: findingIds.length,
    primaryOrganizationDigest: sha256(`${caseId}:reviewer-primary`), independentOrganizationDigest: sha256(`${caseId}:reviewer-independent`),
    conflictDeclared: false, reportDigest: sha256(`${caseId}:known-report`), issuedAt: policy.deterministicEpoch,
  });
  const tools = TOOLS.map((tool) => toolReceipt(caseId, tool, targetDigest));
  const tiers = TIERS.map((tier, tierIndex) => reseal({
    schemaVersion: "velmere.pass36.a82.fixture-tier-output.v1", caseId, tier,
    fixtureOnly: true, targetDigest, sourceBytecodeMatch: true, rightsApproved: false,
    materialFields: Array.from({ length: tierFields[tier] }, (_, n) => `field-${String(n + 1).padStart(2, "0")}`),
    evidenceFamilies: Array.from({ length: tierEvidence[tier] }, (_, n) => `evidence-${String(n + 1).padStart(2, "0")}`),
    scenarios: Array.from({ length: tierIndex + 1 }, (_, n) => `scenario-${n + 1}`),
    findingIds, analysisDecision: "FIXTURE_ONLY_NOT_FOR_SALE", humanReviewVerified: false,
    officialToolsExecuted: 0, paidGateEligible: false, liveProven: false, saleEnabled: false,
  }));
  return reseal({
    schemaVersion: "velmere.pass36.a82.fixture-case.v1", caseId, caseClass, fixtureOnly: true,
    target, targetDigest, sourceBytecodeMatch: true,
    rights: { fixtureOnly: true, benchmarkUseApproved: false, reportRedistributionApproved: false, derivedDataApproved: false },
    labels, tools, tiers, remediationPredecessorDigest: caseClass === "REMEDIATED_PAIR" ? sha256(`${caseId}:predecessor`) : null,
    qualifiedHumanReview: { fixtureOnly: true, verified: caseClass !== "BENIGN_CONTROL", independentSampleVerified: caseClass !== "BENIGN_CONTROL" },
    paidGateEligible: false, liveProven: false, saleEnabled: false,
  });
}

export function verifyFixtureCase(row, _policy) {
  try {
    if (!row || row.integrity?.digest !== sha256(Object.fromEntries(Object.entries(row).filter(([k]) => k !== "integrity")))) return false;
    if (!row.fixtureOnly || !/^A82-FIX-\d{3}$/.test(row.caseId) || !CLASSES.includes(row.caseClass)) return false;
    if (!/^0x[0-9a-f]{40}$/.test(row.target?.contractAddress ?? "")) return false;
    if (row.targetDigest !== sha256(row.target) || row.sourceBytecodeMatch !== true) return false;
    if (row.rights?.benchmarkUseApproved !== false || row.paidGateEligible || row.liveProven || row.saleEnabled) return false;
    if (row.labels?.integrity?.digest !== sha256(Object.fromEntries(Object.entries(row.labels).filter(([k]) => k !== "integrity")))) return false;
    if (!row.labels.blindBeforeExecution || row.labels.primaryOrganizationDigest === row.labels.independentOrganizationDigest || row.labels.reportDigest !== sha256(`${row.caseId}:known-report`)) return false;
    if (!Array.isArray(row.tools) || row.tools.length !== 4 || new Set(row.tools.map((r) => r.toolId)).size !== 4) return false;
    for (const tool of row.tools) {
      if (!TOOLS.includes(tool.toolId) || !tool.fixtureOnly || tool.officialBinaryClaimed || tool.paidGateEligible) return false;
      if (tool.targetDigest !== row.targetDigest || tool.inputSha256 !== row.targetDigest) return false;
      if (!/^[0-9a-f]{64}$/.test(tool.executableSha256) || !/^[0-9a-f]{64}$/.test(tool.rawOutputSha256)) return false;
      const core = { ...tool }; delete core.integrity; if (tool.integrity?.digest !== sha256(core)) return false;
    }
    if (!Array.isArray(row.tiers) || row.tiers.length !== 3) return false;
    const byTier = Object.fromEntries(row.tiers.map((r) => [r.tier, r]));
    for (const tier of TIERS) {
      const out = byTier[tier]; if (!out || !out.fixtureOnly || out.targetDigest !== row.targetDigest || out.rightsApproved || out.paidGateEligible || out.liveProven || out.saleEnabled) return false;
      if (out.materialFields?.length !== tierFields[tier] || out.evidenceFamilies?.length !== tierEvidence[tier]) return false;
      if (out.officialToolsExecuted !== 0 || out.analysisDecision !== "FIXTURE_ONLY_NOT_FOR_SALE") return false;
      const core = { ...out }; delete core.integrity; if (out.integrity?.digest !== sha256(core)) return false;
    }
    const subset = (a, b) => a.every((v) => b.includes(v));
    if (!subset(byTier.basic.materialFields, byTier.pro.materialFields) || !subset(byTier.pro.materialFields, byTier.advanced.materialFields)) return false;
    if (!subset(byTier.basic.evidenceFamilies, byTier.pro.evidenceFamilies) || !subset(byTier.pro.evidenceFamilies, byTier.advanced.evidenceFamilies)) return false;
    if (row.caseClass === "REMEDIATED_PAIR" && !/^[0-9a-f]{64}$/.test(row.remediationPredecessorDigest ?? "")) return false;
    return true;
  } catch { return false; }
}

function semanticMutations(row) {
  const mutations = [];
  const add = (id, edit) => { const m = structuredClone(row); edit(m); mutations.push({ id, value: reseal(m) }); };
  add("target-address", (m) => { m.target.contractAddress = addressFrom(`${m.caseId}:other`); });
  add("target-digest", (m) => { m.targetDigest = sha256("wrong"); });
  add("source-bytecode", (m) => { m.sourceBytecodeMatch = false; });
  add("rights", (m) => { m.rights.benchmarkUseApproved = true; });
  add("paid", (m) => { m.paidGateEligible = true; });
  add("live", (m) => { m.liveProven = true; });
  add("sale", (m) => { m.saleEnabled = true; });
  add("blind", (m) => { m.labels.blindBeforeExecution = false; m.labels = reseal(m.labels); });
  add("same-org", (m) => { m.labels.independentOrganizationDigest = m.labels.primaryOrganizationDigest; m.labels = reseal(m.labels); });
  add("label-report", (m) => { m.labels.reportDigest = "0".repeat(64); m.labels = reseal(m.labels); });
  add("missing-tool", (m) => { m.tools.pop(); });
  add("duplicate-tool", (m) => { m.tools[3].toolId = m.tools[0].toolId; m.tools[3] = reseal(m.tools[3]); });
  add("official-claim", (m) => { m.tools[0].officialBinaryClaimed = true; m.tools[0] = reseal(m.tools[0]); });
  add("tool-target", (m) => { m.tools[0].targetDigest = "1".repeat(64); m.tools[0] = reseal(m.tools[0]); });
  add("tool-input", (m) => { m.tools[0].inputSha256 = "2".repeat(64); m.tools[0] = reseal(m.tools[0]); });
  add("tier-fields", (m) => { m.tiers[1].materialFields = m.tiers[1].materialFields.slice(0, 8); m.tiers[1] = reseal(m.tiers[1]); });
  add("tier-evidence", (m) => { m.tiers[2].evidenceFamilies = m.tiers[2].evidenceFamilies.slice(0, 7); m.tiers[2] = reseal(m.tiers[2]); });
  add("tier-paid", (m) => { m.tiers[1].paidGateEligible = true; m.tiers[1] = reseal(m.tiers[1]); });
  add("tier-decision", (m) => { m.tiers[0].analysisDecision = "READY_FOR_SALE"; m.tiers[0] = reseal(m.tiers[0]); });
  add("fixture-off", (m) => { m.fixtureOnly = false; });
  return mutations;
}

export function runA82FixtureHarness(root, policyInput) {
  const policy = policyInput ?? JSON.parse(readFileSync(`${root}/config/pass36/a82-audit-real-contract-matrix-policy.json`, "utf8"));
  validateA82Policy(policy);
  const cases = Array.from({ length: 50 }, (_, i) => caseCore(i, policy));
  const classCounts = Object.fromEntries(CLASSES.map((c) => [c, cases.filter((r) => r.caseClass === c).length]));
  let mutationKilled = 0; const mutationFailures = [];
  for (const row of cases) for (const mutation of semanticMutations(row)) {
    if (!verifyFixtureCase(mutation.value, policy)) mutationKilled += 1; else mutationFailures.push(`${row.caseId}:${mutation.id}`);
  }
  const core = {
    schemaVersion: "velmere.pass36.a82.fixture-runtime.v1", revisionId: A82_REVISION, generatedAt: policy.deterministicEpoch,
    cases, denominators: { cases: cases.length, tierOutputs: cases.reduce((s, r) => s + r.tiers.length, 0), toolReceipts: cases.reduce((s, r) => s + r.tools.length, 0), sourceBytecodePairs: cases.length, blindLabelBundles: cases.length, semanticMutations: cases.length * 20, mutationKilled },
    classCounts, mutationFailures, claims: { realCasesFullyVerified: 0, officialToolExecutions: 0, rightsApprovedCases: 0, independentRealLabels: 0, customerAccuracyProven: false, paidGateEligible: false, liveProven: false, saleEnabled: false },
  };
  return reseal(core);
}

export function verifyA82FixtureRuntime(runtime, policy, expectedDigest) {
  try {
    validateA82Policy(policy);
    const core = { ...runtime }; delete core.integrity;
    if (runtime.integrity?.digest !== sha256(core) || (expectedDigest && runtime.integrity.digest !== expectedDigest)) return false;
    if (runtime.revisionId !== A82_REVISION || runtime.cases?.length !== 50) return false;
    if (new Set(runtime.cases.map((r) => r.caseId)).size !== 50 || new Set(runtime.cases.map((r) => r.target.contractAddress)).size !== 50) return false;
    if (!runtime.cases.every((r) => verifyFixtureCase(r, policy))) return false;
    if (!CLASSES.every((c) => runtime.classCounts?.[c] === 10)) return false;
    if (runtime.denominators?.tierOutputs !== 150 || runtime.denominators?.toolReceipts !== 200 || runtime.denominators?.semanticMutations !== 1000 || runtime.denominators?.mutationKilled !== 1000) return false;
    if (runtime.mutationFailures?.length !== 0) return false;
    return runtime.claims?.realCasesFullyVerified === 0 && runtime.claims?.officialToolExecutions === 0 && runtime.claims?.paidGateEligible === false && runtime.claims?.liveProven === false && runtime.claims?.saleEnabled === false;
  } catch { return false; }
}

export function evaluateA82RealIntake(index, policy) {
  validateA82Policy(policy);
  assert(index?.revisionId === A82_REVISION && index?.slots?.length === 50, "a82_intake_denominator");
  const uniqueSlots = new Set(index.slots.map((r) => r.slotId)); assert(uniqueSlots.size === 50, "a82_intake_duplicates");
  const classCounts = Object.fromEntries(CLASSES.map((c) => [c, index.slots.filter((r) => r.caseClass === c).length]));
  assert(CLASSES.every((c) => classCounts[c] === 10), "a82_intake_class_counts");
  const context = loadRealEvidenceContext(process.cwd());
  const requiredFamilies = [
    "exact_chain_and_address", "provider_bound_deployed_bytecode", "exact_source_bundle",
    "compiler_version_settings_and_libraries", "source_to_bytecode_match", "benchmark_and_report_rights",
    "blind_known_finding_labels", "independent_adjudication", "official_tool_solc", "official_tool_slither",
    "official_tool_semgrep", "official_tool_forge", "tier_output_basic", "tier_output_pro", "tier_output_advanced",
    "false_positive_ledger", "false_negative_ledger", "remediation_and_retest_receipt", "raw_evidence_redaction",
  ];
  const physicalRows = new Set(index.slots.filter((row) => verifyPhysicalEvidenceFamilies(row, {
    context,
    expectedSubjectId: row.slotId,
    requiredFamilies,
    minimumIndependentOrganizations: 2,
  }).verified).map((row) => row.slotId));
  const assigned = index.slots.filter((r) => r.contractAddress).length;
  const uniqueAssigned = new Set(index.slots.filter((r) => r.contractAddress).map((r) => `${String(r.chainId ?? "").toLowerCase()}:${String(r.contractAddress).toLowerCase()}`)).size;
  const ready = index.slots.filter((r) => r.evidenceReady === true && physicalRows.has(r.slotId)).length;
  const rights = index.slots.filter((r) => r.rightsApproved === true && physicalRows.has(r.slotId)).length;
  const tools = physicalRows.size * 4;
  const tierOutputs = physicalRows.size * 3;
  const decision = assigned === 50 && uniqueAssigned === 50 && ready === 50 && rights === 50 && tools === 200 && tierOutputs === 150
    ? "READY_FOR_INDEPENDENT_ADJUDICATION_NOT_SALE"
    : "BLOCKED_REAL_CASE_EVIDENCE";
  return { requiredCases: 50, assignedRealIdentities: assigned, evidenceReady: ready, rightsApproved: rights, officialToolReceipts: tools, realTierOutputs: tierOutputs, decision, classCounts };
}
