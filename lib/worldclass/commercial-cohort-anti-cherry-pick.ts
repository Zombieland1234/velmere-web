import { canonicalJson } from "@/lib/security/canonical-json";
import { sha256Digest } from "@/lib/security/cryptographic-digest";
import { constantTimeTextEqual, hmacSha256Digest } from "@/lib/security/portable-hmac-sha256";
import type {
  CommercialCohortCase,
  CommercialCohortLocale,
  CommercialCohortManifest,
  CommercialCohortProduct,
  CommercialCohortTier,
} from "@/lib/worldclass/commercial-cohort-types";

export const PASS4810_ANTI_CHERRY_PICK_POLICY_ID = "pass4810-precommitted-anti-cherry-pick-v1" as const;
export const PASS4810_SELECTION_PLAN_SCHEMA = "velmere.commercial-cohort-selection-plan.v1" as const;
export const PASS4810_TRANSPARENCY_LOG_SCHEMA = "velmere.commercial-cohort-capture-log.v1" as const;
export const PASS4810_ANTI_CHERRY_PICK_RECEIPT_SCHEMA = "velmere.commercial-cohort-anti-cherry-pick-receipt.v1" as const;

const DIGEST = /^sha256:[a-f0-9]{64}$/;
const ID = /^[a-zA-Z0-9][a-zA-Z0-9._:-]{5,159}$/;
const REQUIRED_COUNTS: Record<CommercialCohortProduct, number> = {
  audit: 50,
  shield: 50,
  real_markets: 50,
  pdf: 150,
};

export type CommercialCohortPopulationEntry = {
  schemaVersion: "velmere.commercial-cohort-population-entry.v1";
  entryId: string;
  product: CommercialCohortProduct;
  subjectId: string;
  assetClass: string;
  chain: string | null;
  tier: CommercialCohortTier;
  locale: CommercialCohortLocale;
  stratum: string;
  eligibilityDigest: string;
};

export type CommercialCohortSelectionQuota = {
  product: CommercialCohortProduct;
  stratum: string;
  count: number;
};

export type CommercialCohortRandomnessBeacon = {
  source: string;
  round: string;
  observedAt: string;
  valueDigest: string;
  receiptDigest: string;
};

export type CommercialCohortSelectedEntry = {
  entryId: string;
  entryDigest: string;
  product: CommercialCohortProduct;
  stratum: string;
  score: string;
  rank: number;
};

export type CommercialCohortSelectionPlanApproval = {
  schemaVersion: "velmere.commercial-cohort-selection-plan-approval.v1";
  approvedAt: string;
  approverIdDigest: string;
  signature: string;
};

export type CommercialCohortSelectionPlan = {
  schemaVersion: typeof PASS4810_SELECTION_PLAN_SCHEMA;
  policyVersion: typeof PASS4810_ANTI_CHERRY_PICK_POLICY_ID;
  selectionAlgorithm: "sha256_beacon_score_ascending_without_replacement_v1";
  planId: string;
  populationCapturedAt: string;
  createdAt: string;
  observationNotBefore: string;
  randomnessBeacon: CommercialCohortRandomnessBeacon;
  populationEntries: CommercialCohortPopulationEntry[];
  quotas: CommercialCohortSelectionQuota[];
  populationRoot: string;
  selectionSeed: string;
  selectedEntries: CommercialCohortSelectedEntry[];
  selectedEntryRoot: string;
  planDigest: string;
  operatorIdDigest: string;
  signature: string;
  approval?: CommercialCohortSelectionPlanApproval;
};

export type CommercialCohortCaptureLogEntry = {
  schemaVersion: "velmere.commercial-cohort-capture-log-entry.v1";
  sequence: number;
  eventType: "selection_plan_precommitted" | "case_captured" | "cohort_manifest_sealed";
  eventAt: string;
  caseId: string | null;
  payloadDigest: string;
  previousEntryDigest: string | null;
  previousLogRoot: string | null;
  entryDigest: string;
  logRoot: string;
  signature: string;
};

export type CommercialCohortCaptureLogWitness = {
  schemaVersion: "velmere.commercial-cohort-capture-log-witness.v1";
  witnessedAt: string;
  witnessIdDigest: string;
  signature: string;
};

export type CommercialCohortCaptureLog = {
  schemaVersion: typeof PASS4810_TRANSPARENCY_LOG_SCHEMA;
  policyVersion: typeof PASS4810_ANTI_CHERRY_PICK_POLICY_ID;
  generatedAt: string;
  planDigest: string;
  manifestDigest: string;
  caseRoot: string;
  caseBindingRoot: string;
  entryRoot: string;
  latestLogRoot: string;
  caseCount: number;
  entries: CommercialCohortCaptureLogEntry[];
  operatorIdDigest: string;
  logDigest: string;
  witness?: CommercialCohortCaptureLogWitness;
};

export type CommercialCohortAntiCherryPickApproval = {
  schemaVersion: "velmere.commercial-cohort-anti-cherry-pick-approval.v1";
  approvedAt: string;
  approverIdDigest: string;
  signature: string;
};

export type CommercialCohortAntiCherryPickReceipt = {
  schemaVersion: typeof PASS4810_ANTI_CHERRY_PICK_RECEIPT_SCHEMA;
  policyVersion: typeof PASS4810_ANTI_CHERRY_PICK_POLICY_ID;
  issuedAt: string;
  planCreatedAt: string;
  observationNotBefore: string;
  externalTimestampReceiptDigest: string;
  planDigest: string;
  populationRoot: string;
  selectedEntryRoot: string;
  manifestDigest: string;
  caseRoot: string;
  caseBindingRoot: string;
  transparencyLogDigest: string;
  transparencyLatestRoot: string;
  caseCounts: Record<CommercialCohortProduct, number>;
  precommitOperatorIdDigest: string;
  precommitApproverIdDigest: string;
  captureOperatorIdDigest: string;
  captureWitnessIdDigest: string;
  operatorIdDigest: string;
  signature: string;
  approval?: CommercialCohortAntiCherryPickApproval;
};

function clean(value: unknown, max = 240): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function parseDate(value: unknown, code: string): Date {
  const text = clean(value, 64);
  const date = new Date(text);
  if (!text || !Number.isFinite(date.getTime())) throw new Error(code);
  return date;
}

function requiredDigest(value: unknown, code: string): string {
  const text = clean(value, 80).toLowerCase();
  if (!DIGEST.test(text)) throw new Error(code);
  return text;
}

function requiredId(value: unknown, code: string): string {
  const text = clean(value, 160);
  if (!ID.test(text)) throw new Error(code);
  return text;
}

function unique<T>(values: T[]): T[] {
  return Array.from(new Set(values));
}

function normalizePopulationEntry(input: CommercialCohortPopulationEntry): CommercialCohortPopulationEntry {
  if (!input || input.schemaVersion !== "velmere.commercial-cohort-population-entry.v1") throw new Error("cohort_population_entry_schema_invalid");
  const entryId = requiredId(input.entryId, "cohort_population_entry_id_invalid");
  const subjectId = clean(input.subjectId, 240);
  const assetClass = clean(input.assetClass, 80);
  const chain = input.chain === null ? null : clean(input.chain, 80) || null;
  const stratum = clean(input.stratum, 120);
  if (!subjectId || !assetClass || !stratum) throw new Error("cohort_population_identity_invalid");
  if (!(Object.keys(REQUIRED_COUNTS) as string[]).includes(input.product)) throw new Error("cohort_population_product_invalid");
  if (!( ["basic", "pro", "advanced"] as string[]).includes(input.tier)) throw new Error("cohort_population_tier_invalid");
  if (!( ["pl", "en", "de"] as string[]).includes(input.locale)) throw new Error("cohort_population_locale_invalid");
  return {
    schemaVersion: "velmere.commercial-cohort-population-entry.v1",
    entryId,
    product: input.product,
    subjectId,
    assetClass,
    chain,
    tier: input.tier,
    locale: input.locale,
    stratum,
    eligibilityDigest: requiredDigest(input.eligibilityDigest, "cohort_population_eligibility_digest_invalid"),
  };
}

function populationEntryDigest(entry: CommercialCohortPopulationEntry): string {
  return sha256Digest(canonicalJson(entry));
}

function normalizeQuota(input: CommercialCohortSelectionQuota): CommercialCohortSelectionQuota {
  const stratum = clean(input?.stratum, 120);
  const count = Number(input?.count);
  if (!(Object.keys(REQUIRED_COUNTS) as string[]).includes(input?.product) || !stratum || !Number.isInteger(count) || count < 1 || count > 10_000) {
    throw new Error("cohort_selection_quota_invalid");
  }
  return { product: input.product, stratum, count };
}

function normalizedBeacon(input: CommercialCohortRandomnessBeacon): CommercialCohortRandomnessBeacon {
  const source = clean(input?.source, 160);
  const round = clean(input?.round, 160);
  if (!source || !round || source.toLowerCase().includes("internal")) throw new Error("cohort_randomness_beacon_invalid");
  return {
    source,
    round,
    observedAt: parseDate(input.observedAt, "cohort_randomness_beacon_time_invalid").toISOString(),
    valueDigest: requiredDigest(input.valueDigest, "cohort_randomness_value_digest_invalid"),
    receiptDigest: requiredDigest(input.receiptDigest, "cohort_randomness_receipt_digest_invalid"),
  };
}

function computeSelection(args: {
  planId: string;
  populationEntries: CommercialCohortPopulationEntry[];
  quotas: CommercialCohortSelectionQuota[];
  selectionSeed: string;
}): CommercialCohortSelectedEntry[] {
  const selected: CommercialCohortSelectedEntry[] = [];
  for (const quota of args.quotas) {
    const candidates = args.populationEntries
      .filter((entry) => entry.product === quota.product && entry.stratum === quota.stratum)
      .map((entry) => {
        const entryDigest = populationEntryDigest(entry);
        const score = sha256Digest(canonicalJson({
          algorithm: "sha256_beacon_score_ascending_without_replacement_v1",
          planId: args.planId,
          selectionSeed: args.selectionSeed,
          entryDigest,
        }));
        return { entry, entryDigest, score };
      })
      .sort((left, right) => left.score.localeCompare(right.score) || left.entry.entryId.localeCompare(right.entry.entryId));
    if (candidates.length < quota.count) throw new Error(`cohort_selection_stratum_underfilled:${quota.product}:${quota.stratum}:${candidates.length}/${quota.count}`);
    candidates.slice(0, quota.count).forEach((candidate, index) => {
      selected.push({
        entryId: candidate.entry.entryId,
        entryDigest: candidate.entryDigest,
        product: quota.product,
        stratum: quota.stratum,
        score: candidate.score,
        rank: index + 1,
      });
    });
  }
  if (new Set(selected.map((entry) => entry.entryId)).size !== selected.length) throw new Error("cohort_selection_duplicate_entry");
  return selected.sort((left, right) => left.entryId.localeCompare(right.entryId));
}

function validateQuotaCoverage(quotas: CommercialCohortSelectionQuota[]): void {
  const keys = quotas.map((quota) => `${quota.product}:${quota.stratum}`);
  if (new Set(keys).size !== keys.length) throw new Error("cohort_selection_duplicate_quota");
  for (const product of Object.keys(REQUIRED_COUNTS) as CommercialCohortProduct[]) {
    const total = quotas.filter((quota) => quota.product === product).reduce((sum, quota) => sum + quota.count, 0);
    if (total !== REQUIRED_COUNTS[product]) throw new Error(`cohort_selection_required_count_mismatch:${product}:${total}/${REQUIRED_COUNTS[product]}`);
  }
}

function planPayload(plan: Omit<CommercialCohortSelectionPlan, "signature" | "approval">): string {
  return canonicalJson(plan);
}

function planApprovalPayload(plan: CommercialCohortSelectionPlan, approvedAt: string, approverIdDigest: string): string {
  return canonicalJson({
    schemaVersion: "velmere.commercial-cohort-selection-plan-approval.v1",
    policyVersion: plan.policyVersion,
    planDigest: plan.planDigest,
    primarySignature: plan.signature,
    approvedAt,
    approverIdDigest,
  });
}

export function signCommercialCohortSelectionPlan(args: {
  planId: string;
  populationCapturedAt: Date;
  createdAt?: Date;
  observationNotBefore: Date;
  randomnessBeacon: CommercialCohortRandomnessBeacon;
  populationEntries: CommercialCohortPopulationEntry[];
  quotas: CommercialCohortSelectionQuota[];
  secret: string;
  operatorId: string;
}): CommercialCohortSelectionPlan {
  const secret = args.secret.trim();
  if (secret.length < 32) throw new Error("cohort_precommit_secret_too_short");
  const planId = requiredId(args.planId, "cohort_selection_plan_id_invalid");
  const operatorId = clean(args.operatorId, 200);
  if (!operatorId) throw new Error("cohort_precommit_operator_id_missing");
  const createdAt = args.createdAt ?? new Date();
  const populationCapturedAt = args.populationCapturedAt;
  const observationNotBefore = args.observationNotBefore;
  const beacon = normalizedBeacon(args.randomnessBeacon);
  const beaconAt = new Date(beacon.observedAt);
  if (populationCapturedAt.getTime() > beaconAt.getTime()) throw new Error("cohort_population_captured_after_beacon");
  if (beaconAt.getTime() > createdAt.getTime()) throw new Error("cohort_beacon_after_plan_creation");
  if (createdAt.getTime() + 60_000 > observationNotBefore.getTime()) throw new Error("cohort_plan_not_precommitted_before_observation");
  const populationEntries = args.populationEntries.map(normalizePopulationEntry).sort((left, right) => left.entryId.localeCompare(right.entryId));
  if (!populationEntries.length) throw new Error("cohort_population_missing");
  if (new Set(populationEntries.map((entry) => entry.entryId)).size !== populationEntries.length) throw new Error("cohort_population_duplicate_entry_id");
  const quotas = args.quotas.map(normalizeQuota).sort((left, right) => `${left.product}:${left.stratum}`.localeCompare(`${right.product}:${right.stratum}`));
  validateQuotaCoverage(quotas);
  const populationDigests = populationEntries.map(populationEntryDigest);
  const populationRoot = sha256Digest(canonicalJson(populationDigests));
  const selectionSeed = sha256Digest(canonicalJson({
    schemaVersion: "velmere.commercial-cohort-selection-seed.v1",
    planId,
    populationRoot,
    beaconSource: beacon.source,
    beaconRound: beacon.round,
    beaconValueDigest: beacon.valueDigest,
    beaconReceiptDigest: beacon.receiptDigest,
  }));
  const selectedEntries = computeSelection({ planId, populationEntries, quotas, selectionSeed });
  const selectedEntryRoot = sha256Digest(canonicalJson(selectedEntries));
  const core = {
    schemaVersion: PASS4810_SELECTION_PLAN_SCHEMA,
    policyVersion: PASS4810_ANTI_CHERRY_PICK_POLICY_ID,
    selectionAlgorithm: "sha256_beacon_score_ascending_without_replacement_v1",
    planId,
    populationCapturedAt: populationCapturedAt.toISOString(),
    createdAt: createdAt.toISOString(),
    observationNotBefore: observationNotBefore.toISOString(),
    randomnessBeacon: beacon,
    populationEntries,
    quotas,
    populationRoot,
    selectionSeed,
    selectedEntries,
    selectedEntryRoot,
  } as const;
  const planDigest = sha256Digest(canonicalJson(core));
  const unsigned = { ...core, planDigest, operatorIdDigest: sha256Digest(operatorId) } as const;
  return { ...unsigned, signature: hmacSha256Digest(secret, planPayload(unsigned)) };
}

export function approveCommercialCohortSelectionPlan(args: {
  plan: CommercialCohortSelectionPlan;
  primarySecret: string;
  approverSecret: string;
  approverId: string;
  approvedAt?: Date;
}): CommercialCohortSelectionPlan {
  const verification = verifyCommercialCohortSelectionPlan({
    plan: args.plan,
    secret: args.primarySecret,
    requireApproval: false,
    now: args.approvedAt ?? new Date(),
  });
  if (!verification.verified) throw new Error(`cohort_precommit_primary_invalid:${verification.blockers.join("|")}`);
  const approverSecret = args.approverSecret.trim();
  if (approverSecret.length < 32) throw new Error("cohort_precommit_approver_secret_too_short");
  if (constantTimeTextEqual(args.primarySecret.trim(), approverSecret)) throw new Error("cohort_precommit_secret_reused");
  const approvedAt = args.approvedAt ?? new Date();
  const createdAt = new Date(args.plan.createdAt);
  const observationNotBefore = new Date(args.plan.observationNotBefore);
  if (approvedAt.getTime() < createdAt.getTime() || approvedAt.getTime() + 30_000 > observationNotBefore.getTime()) throw new Error("cohort_precommit_approval_time_invalid");
  const approverId = clean(args.approverId, 200);
  if (!approverId) throw new Error("cohort_precommit_approver_id_missing");
  const approverIdDigest = sha256Digest(approverId);
  if (approverIdDigest === args.plan.operatorIdDigest) throw new Error("cohort_precommit_same_operator_and_approver");
  const approvedAtText = approvedAt.toISOString();
  const approval: CommercialCohortSelectionPlanApproval = {
    schemaVersion: "velmere.commercial-cohort-selection-plan-approval.v1",
    approvedAt: approvedAtText,
    approverIdDigest,
    signature: hmacSha256Digest(approverSecret, planApprovalPayload(args.plan, approvedAtText, approverIdDigest)),
  };
  return { ...args.plan, approval };
}

export function verifyCommercialCohortSelectionPlan(args: {
  plan: CommercialCohortSelectionPlan;
  secret: string | null;
  approverSecret?: string | null;
  requireApproval?: boolean;
  now?: Date;
}): { verified: boolean; primaryVerified: boolean; approvalVerified: boolean; blockers: string[] } {
  const blockers: string[] = [];
  const plan = args.plan;
  let primaryVerified = false;
  let approvalVerified = args.requireApproval === false;
  try {
    if (!plan || plan.schemaVersion !== PASS4810_SELECTION_PLAN_SCHEMA || plan.policyVersion !== PASS4810_ANTI_CHERRY_PICK_POLICY_ID) throw new Error("cohort_precommit_schema_invalid");
    if (plan.selectionAlgorithm !== "sha256_beacon_score_ascending_without_replacement_v1") blockers.push("cohort_selection_algorithm_invalid");
    const createdAt = parseDate(plan.createdAt, "cohort_precommit_created_at_invalid");
    const populationCapturedAt = parseDate(plan.populationCapturedAt, "cohort_population_captured_at_invalid");
    const observationNotBefore = parseDate(plan.observationNotBefore, "cohort_observation_start_invalid");
    const beacon = normalizedBeacon(plan.randomnessBeacon);
    const beaconAt = new Date(beacon.observedAt);
    if (populationCapturedAt.getTime() > beaconAt.getTime()) blockers.push("cohort_population_captured_after_beacon");
    if (beaconAt.getTime() > createdAt.getTime()) blockers.push("cohort_beacon_after_plan_creation");
    if (createdAt.getTime() + 60_000 > observationNotBefore.getTime()) blockers.push("cohort_plan_not_precommitted_before_observation");
    const now = args.now ?? new Date();
    if (createdAt.getTime() > now.getTime() + 60_000) blockers.push("cohort_precommit_created_in_future");
    const populationEntries = plan.populationEntries.map(normalizePopulationEntry).sort((left, right) => left.entryId.localeCompare(right.entryId));
    if (new Set(populationEntries.map((entry) => entry.entryId)).size !== populationEntries.length) blockers.push("cohort_population_duplicate_entry_id");
    const quotas = plan.quotas.map(normalizeQuota).sort((left, right) => `${left.product}:${left.stratum}`.localeCompare(`${right.product}:${right.stratum}`));
    validateQuotaCoverage(quotas);
    const populationRoot = sha256Digest(canonicalJson(populationEntries.map(populationEntryDigest)));
    if (populationRoot !== plan.populationRoot) blockers.push("cohort_population_root_invalid");
    const selectionSeed = sha256Digest(canonicalJson({
      schemaVersion: "velmere.commercial-cohort-selection-seed.v1",
      planId: plan.planId,
      populationRoot,
      beaconSource: beacon.source,
      beaconRound: beacon.round,
      beaconValueDigest: beacon.valueDigest,
      beaconReceiptDigest: beacon.receiptDigest,
    }));
    if (selectionSeed !== plan.selectionSeed) blockers.push("cohort_selection_seed_invalid");
    const selectedEntries = computeSelection({ planId: plan.planId, populationEntries, quotas, selectionSeed });
    if (canonicalJson(selectedEntries) !== canonicalJson(plan.selectedEntries)) blockers.push("cohort_selected_entries_invalid");
    const selectedEntryRoot = sha256Digest(canonicalJson(selectedEntries));
    if (selectedEntryRoot !== plan.selectedEntryRoot) blockers.push("cohort_selected_entry_root_invalid");
    const { planDigest, operatorIdDigest, signature, approval: _approval, ...core } = plan;
    const expectedPlanDigest = sha256Digest(canonicalJson(core));
    if (planDigest !== expectedPlanDigest) blockers.push("cohort_plan_digest_invalid");
    if (!DIGEST.test(operatorIdDigest)) blockers.push("cohort_precommit_operator_digest_invalid");
    if (!args.secret || args.secret.trim().length < 32) blockers.push("cohort_precommit_secret_missing");
    else {
      const unsigned = { ...core, planDigest, operatorIdDigest } as Omit<CommercialCohortSelectionPlan, "signature" | "approval">;
      const expected = hmacSha256Digest(args.secret.trim(), planPayload(unsigned));
      if (!DIGEST.test(signature) || !constantTimeTextEqual(signature, expected)) blockers.push("cohort_precommit_signature_invalid");
      else primaryVerified = true;
    }
    if (args.requireApproval !== false) {
      const approval = plan.approval;
      if (!approval) blockers.push("cohort_precommit_approval_missing");
      else if (!args.approverSecret || args.approverSecret.trim().length < 32) blockers.push("cohort_precommit_approver_secret_missing");
      else {
        const approvedAt = parseDate(approval.approvedAt, "cohort_precommit_approved_at_invalid");
        if (approvedAt.getTime() < createdAt.getTime() || approvedAt.getTime() + 30_000 > observationNotBefore.getTime()) blockers.push("cohort_precommit_approval_time_invalid");
        if (!DIGEST.test(approval.approverIdDigest) || approval.approverIdDigest === operatorIdDigest) blockers.push("cohort_precommit_approver_identity_invalid");
        const expected = hmacSha256Digest(args.approverSecret.trim(), planApprovalPayload(plan, approval.approvedAt, approval.approverIdDigest));
        if (!DIGEST.test(approval.signature) || !constantTimeTextEqual(approval.signature, expected)) blockers.push("cohort_precommit_approval_signature_invalid");
        else approvalVerified = true;
      }
    }
  } catch (error) {
    blockers.push(error instanceof Error ? error.message : "cohort_precommit_validation_failed");
  }
  const uniqueBlockers = unique(blockers).sort();
  return { verified: uniqueBlockers.length === 0 && primaryVerified && approvalVerified, primaryVerified, approvalVerified, blockers: uniqueBlockers };
}

function selectedPopulationById(plan: CommercialCohortSelectionPlan): Map<string, { selected: CommercialCohortSelectedEntry; entry: CommercialCohortPopulationEntry }> {
  const population = new Map(plan.populationEntries.map((entry) => [entry.entryId, entry]));
  return new Map(plan.selectedEntries.map((selected) => {
    const entry = population.get(selected.entryId);
    if (!entry) throw new Error("cohort_selected_population_entry_missing");
    return [selected.entryId, { selected, entry }];
  }));
}

function bindSelectedCases(args: {
  plan: CommercialCohortSelectionPlan;
  cases: CommercialCohortCase[];
  manifest: CommercialCohortManifest;
}): { caseBindingRoot: string; bindingDigests: string[]; blockers: string[] } {
  const blockers: string[] = [];
  const selected = selectedPopulationById(args.plan);
  const orderedCases = [...args.cases].sort((left, right) => left.caseId.localeCompare(right.caseId));
  if (orderedCases.length !== args.plan.selectedEntries.length) blockers.push(`cohort_selected_case_count_mismatch:${orderedCases.length}/${args.plan.selectedEntries.length}`);
  if (args.manifest.caseDigests.length !== orderedCases.length) blockers.push("cohort_manifest_case_digest_count_mismatch");
  const caseIds = orderedCases.map((item) => item.caseId);
  if (new Set(caseIds).size !== caseIds.length) blockers.push("cohort_selected_case_id_duplicate");
  const bindingDigests: string[] = [];
  const observationNotBefore = new Date(args.plan.observationNotBefore).getTime();
  orderedCases.forEach((item, index) => {
    const selection = selected.get(item.caseId);
    if (!selection) {
      blockers.push(`cohort_unselected_case_present:${item.caseId}`);
      return;
    }
    const { entry, selected: selectedEntry } = selection;
    if (item.product !== entry.product || item.subjectId !== entry.subjectId || item.assetClass !== entry.assetClass || (item.chain ?? null) !== entry.chain || item.tier !== entry.tier || item.locale !== entry.locale) {
      blockers.push(`cohort_selected_case_identity_mismatch:${item.caseId}`);
    }
    if (new Date(item.observedAt).getTime() < observationNotBefore) blockers.push(`cohort_case_observed_before_precommit_window:${item.caseId}`);
    bindingDigests.push(sha256Digest(canonicalJson({
      schemaVersion: "velmere.commercial-cohort-case-selection-binding.v1",
      caseId: item.caseId,
      selectedEntryDigest: selectedEntry.entryDigest,
      selectionScore: selectedEntry.score,
      selectionRank: selectedEntry.rank,
      captureReceiptDigest: item.captureReceiptDigest,
      caseDigest: args.manifest.caseDigests[index] ?? null,
      observedAt: item.observedAt,
      outcomeObservedAt: item.outcomeObservedAt,
    })));
  });
  for (const selectedId of selected.keys()) {
    if (!caseIds.includes(selectedId)) blockers.push(`cohort_selected_case_omitted:${selectedId}`);
  }
  return {
    caseBindingRoot: sha256Digest(canonicalJson(bindingDigests)),
    bindingDigests,
    blockers: unique(blockers).sort(),
  };
}

function logEntryPayload(entry: Omit<CommercialCohortCaptureLogEntry, "signature">): string {
  return canonicalJson(entry);
}

function logWitnessPayload(log: CommercialCohortCaptureLog, witnessedAt: string, witnessIdDigest: string): string {
  return canonicalJson({
    schemaVersion: "velmere.commercial-cohort-capture-log-witness.v1",
    policyVersion: log.policyVersion,
    logDigest: log.logDigest,
    latestLogRoot: log.latestLogRoot,
    entryRoot: log.entryRoot,
    witnessedAt,
    witnessIdDigest,
  });
}

export function buildCommercialCohortCaptureLog(args: {
  plan: CommercialCohortSelectionPlan;
  cases: CommercialCohortCase[];
  manifest: CommercialCohortManifest;
  secret: string;
  operatorId: string;
  witnessSecret: string;
  witnessId: string;
  generatedAt?: Date;
}): CommercialCohortCaptureLog {
  const secret = args.secret.trim();
  const witnessSecret = args.witnessSecret.trim();
  if (secret.length < 32 || witnessSecret.length < 32) throw new Error("cohort_capture_log_secret_missing");
  if (constantTimeTextEqual(secret, witnessSecret)) throw new Error("cohort_capture_log_witness_secret_reused");
  const operatorId = clean(args.operatorId, 200);
  const witnessId = clean(args.witnessId, 200);
  if (!operatorId || !witnessId) throw new Error("cohort_capture_log_operator_missing");
  const operatorIdDigest = sha256Digest(operatorId);
  const witnessIdDigest = sha256Digest(witnessId);
  if (operatorIdDigest === witnessIdDigest) throw new Error("cohort_capture_log_same_operator_and_witness");
  const binding = bindSelectedCases(args);
  if (binding.blockers.length) throw new Error(`cohort_selection_coverage_invalid:${binding.blockers.join("|")}`);
  const generatedAt = args.generatedAt ?? new Date();
  const manifestAt = new Date(args.manifest.generatedAt);
  if (generatedAt.getTime() < manifestAt.getTime()) throw new Error("cohort_capture_log_before_manifest");
  const eventInputs: Array<{ eventType: CommercialCohortCaptureLogEntry["eventType"]; eventAt: string; caseId: string | null; payloadDigest: string }> = [
    { eventType: "selection_plan_precommitted", eventAt: args.plan.createdAt, caseId: null, payloadDigest: args.plan.planDigest },
    ...[...args.cases]
      .sort((left, right) => left.observedAt.localeCompare(right.observedAt) || left.caseId.localeCompare(right.caseId))
      .map((item, index) => ({
        eventType: "case_captured" as const,
        eventAt: item.observedAt,
        caseId: item.caseId,
        payloadDigest: sha256Digest(canonicalJson({
          schemaVersion: "velmere.commercial-cohort-capture-event-payload.v1",
          caseId: item.caseId,
          captureReceiptDigest: item.captureReceiptDigest,
          bindingDigest: binding.bindingDigests[[...args.cases].sort((a, b) => a.caseId.localeCompare(b.caseId)).findIndex((candidate) => candidate.caseId === item.caseId)] ?? null,
          orderedCaptureIndex: index,
        })),
      })),
    { eventType: "cohort_manifest_sealed", eventAt: args.manifest.generatedAt, caseId: null, payloadDigest: args.manifest.manifestDigest },
  ];
  let previousEntryDigest: string | null = null;
  let previousLogRoot: string | null = null;
  const entries = eventInputs.map((input, index): CommercialCohortCaptureLogEntry => {
    const leaf = {
      schemaVersion: "velmere.commercial-cohort-capture-log-entry.v1" as const,
      sequence: index + 1,
      eventType: input.eventType,
      eventAt: new Date(input.eventAt).toISOString(),
      caseId: input.caseId,
      payloadDigest: requiredDigest(input.payloadDigest, "cohort_capture_log_payload_digest_invalid"),
      previousEntryDigest,
      previousLogRoot,
    };
    const entryDigest = sha256Digest(canonicalJson(leaf));
    const logRoot = sha256Digest(canonicalJson({
      schemaVersion: "velmere.commercial-cohort-capture-log-root.v1",
      sequence: leaf.sequence,
      previousLogRoot,
      entryDigest,
    }));
    const unsigned = { ...leaf, entryDigest, logRoot };
    const entry = { ...unsigned, signature: hmacSha256Digest(secret, logEntryPayload(unsigned)) };
    previousEntryDigest = entryDigest;
    previousLogRoot = logRoot;
    return entry;
  });
  const entryRoot = sha256Digest(canonicalJson(entries.map((entry) => entry.entryDigest)));
  const core = {
    schemaVersion: PASS4810_TRANSPARENCY_LOG_SCHEMA,
    policyVersion: PASS4810_ANTI_CHERRY_PICK_POLICY_ID,
    generatedAt: generatedAt.toISOString(),
    planDigest: args.plan.planDigest,
    manifestDigest: args.manifest.manifestDigest,
    caseRoot: args.manifest.caseRoot,
    caseBindingRoot: binding.caseBindingRoot,
    entryRoot,
    latestLogRoot: entries.at(-1)?.logRoot ?? sha256Digest("empty"),
    caseCount: args.cases.length,
    entries,
    operatorIdDigest,
  } as const;
  const logDigest = sha256Digest(canonicalJson(core));
  const unsignedLog: CommercialCohortCaptureLog = { ...core, logDigest };
  const witnessedAt = new Date(Math.max(generatedAt.getTime(), manifestAt.getTime()) + 1).toISOString();
  const witness: CommercialCohortCaptureLogWitness = {
    schemaVersion: "velmere.commercial-cohort-capture-log-witness.v1",
    witnessedAt,
    witnessIdDigest,
    signature: hmacSha256Digest(witnessSecret, logWitnessPayload(unsignedLog, witnessedAt, witnessIdDigest)),
  };
  return { ...unsignedLog, witness };
}

export function verifyCommercialCohortCaptureLog(args: {
  log: CommercialCohortCaptureLog;
  plan: CommercialCohortSelectionPlan;
  cases: CommercialCohortCase[];
  manifest: CommercialCohortManifest;
  secret: string | null;
  witnessSecret: string | null;
}): { verified: boolean; primaryVerified: boolean; witnessVerified: boolean; blockers: string[] } {
  const blockers: string[] = [];
  let primaryVerified = false;
  let witnessVerified = false;
  try {
    const { log, plan, manifest } = args;
    if (!log || log.schemaVersion !== PASS4810_TRANSPARENCY_LOG_SCHEMA || log.policyVersion !== PASS4810_ANTI_CHERRY_PICK_POLICY_ID) throw new Error("cohort_capture_log_schema_invalid");
    if (log.planDigest !== plan.planDigest || log.manifestDigest !== manifest.manifestDigest || log.caseRoot !== manifest.caseRoot) blockers.push("cohort_capture_log_binding_invalid");
    const binding = bindSelectedCases({ plan, cases: args.cases, manifest });
    blockers.push(...binding.blockers);
    if (log.caseBindingRoot !== binding.caseBindingRoot) blockers.push("cohort_case_binding_root_invalid");
    if (log.caseCount !== args.cases.length) blockers.push("cohort_capture_log_case_count_invalid");
    if (!args.secret || args.secret.trim().length < 32) blockers.push("cohort_capture_log_secret_missing");
    let previousEntryDigest: string | null = null;
    let previousLogRoot: string | null = null;
    const caseEvents = new Set<string>();
    log.entries.forEach((entry, index) => {
      if (entry.sequence !== index + 1 || entry.previousEntryDigest !== previousEntryDigest || entry.previousLogRoot !== previousLogRoot) blockers.push(`cohort_capture_log_chain_gap:${index + 1}`);
      const leaf = {
        schemaVersion: "velmere.commercial-cohort-capture-log-entry.v1" as const,
        sequence: entry.sequence,
        eventType: entry.eventType,
        eventAt: new Date(entry.eventAt).toISOString(),
        caseId: entry.caseId,
        payloadDigest: requiredDigest(entry.payloadDigest, "cohort_capture_log_payload_digest_invalid"),
        previousEntryDigest: entry.previousEntryDigest,
        previousLogRoot: entry.previousLogRoot,
      };
      const expectedEntryDigest = sha256Digest(canonicalJson(leaf));
      const expectedLogRoot = sha256Digest(canonicalJson({ schemaVersion: "velmere.commercial-cohort-capture-log-root.v1", sequence: entry.sequence, previousLogRoot, entryDigest: expectedEntryDigest }));
      if (entry.entryDigest !== expectedEntryDigest || entry.logRoot !== expectedLogRoot) blockers.push(`cohort_capture_log_digest_invalid:${entry.sequence}`);
      if (args.secret) {
        const unsigned = { ...leaf, entryDigest: expectedEntryDigest, logRoot: expectedLogRoot };
        const expectedSignature = hmacSha256Digest(args.secret.trim(), logEntryPayload(unsigned));
        if (!DIGEST.test(entry.signature) || !constantTimeTextEqual(entry.signature, expectedSignature)) blockers.push(`cohort_capture_log_signature_invalid:${entry.sequence}`);
      }
      if (entry.eventType === "case_captured") {
        if (!entry.caseId || caseEvents.has(entry.caseId)) blockers.push(`cohort_capture_log_duplicate_case_event:${entry.caseId ?? "missing"}`);
        else caseEvents.add(entry.caseId);
      }
      previousEntryDigest = expectedEntryDigest;
      previousLogRoot = expectedLogRoot;
    });
    if (log.entries[0]?.eventType !== "selection_plan_precommitted" || log.entries[0]?.payloadDigest !== plan.planDigest) blockers.push("cohort_capture_log_precommit_entry_invalid");
    const finalEntry = log.entries.at(-1);
    if (finalEntry?.eventType !== "cohort_manifest_sealed" || finalEntry.payloadDigest !== manifest.manifestDigest) blockers.push("cohort_capture_log_manifest_entry_invalid");
    for (const selected of plan.selectedEntries) if (!caseEvents.has(selected.entryId)) blockers.push(`cohort_capture_log_selected_case_missing:${selected.entryId}`);
    if (caseEvents.size !== plan.selectedEntries.length) blockers.push("cohort_capture_log_case_event_count_invalid");
    const expectedEntryRoot = sha256Digest(canonicalJson(log.entries.map((entry) => entry.entryDigest)));
    if (log.entryRoot !== expectedEntryRoot || log.latestLogRoot !== finalEntry?.logRoot) blockers.push("cohort_capture_log_root_invalid");
    const { logDigest, witness: _witness, ...core } = log;
    if (logDigest !== sha256Digest(canonicalJson(core))) blockers.push("cohort_capture_log_digest_invalid");
    primaryVerified = !blockers.some((item) => item.includes("capture_log") || item.includes("case_binding") || item.includes("selected_case"));
    if (!log.witness) blockers.push("cohort_capture_log_witness_missing");
    else if (!args.witnessSecret || args.witnessSecret.trim().length < 32) blockers.push("cohort_capture_log_witness_secret_missing");
    else {
      if (!DIGEST.test(log.witness.witnessIdDigest) || log.witness.witnessIdDigest === log.operatorIdDigest) blockers.push("cohort_capture_log_witness_identity_invalid");
      const expected = hmacSha256Digest(args.witnessSecret.trim(), logWitnessPayload(log, log.witness.witnessedAt, log.witness.witnessIdDigest));
      if (!DIGEST.test(log.witness.signature) || !constantTimeTextEqual(log.witness.signature, expected)) blockers.push("cohort_capture_log_witness_signature_invalid");
      else witnessVerified = true;
    }
  } catch (error) {
    blockers.push(error instanceof Error ? error.message : "cohort_capture_log_validation_failed");
  }
  const uniqueBlockers = unique(blockers).sort();
  return { verified: uniqueBlockers.length === 0 && primaryVerified && witnessVerified, primaryVerified, witnessVerified, blockers: uniqueBlockers };
}

function antiCherryReceiptPayload(receipt: Omit<CommercialCohortAntiCherryPickReceipt, "signature" | "approval">): string {
  return canonicalJson(receipt);
}

function antiCherryApprovalPayload(receipt: CommercialCohortAntiCherryPickReceipt, approvedAt: string, approverIdDigest: string): string {
  return canonicalJson({
    schemaVersion: "velmere.commercial-cohort-anti-cherry-pick-approval.v1",
    policyVersion: receipt.policyVersion,
    planDigest: receipt.planDigest,
    manifestDigest: receipt.manifestDigest,
    transparencyLogDigest: receipt.transparencyLogDigest,
    primarySignature: receipt.signature,
    approvedAt,
    approverIdDigest,
  });
}

function productCounts(cases: CommercialCohortCase[]): Record<CommercialCohortProduct, number> {
  return {
    audit: cases.filter((item) => item.product === "audit").length,
    shield: cases.filter((item) => item.product === "shield").length,
    real_markets: cases.filter((item) => item.product === "real_markets").length,
    pdf: cases.filter((item) => item.product === "pdf").length,
  };
}

export function signCommercialCohortAntiCherryPickReceipt(args: {
  plan: CommercialCohortSelectionPlan;
  log: CommercialCohortCaptureLog;
  cases: CommercialCohortCase[];
  manifest: CommercialCohortManifest;
  secret: string;
  operatorId: string;
  issuedAt?: Date;
}): CommercialCohortAntiCherryPickReceipt {
  const secret = args.secret.trim();
  if (secret.length < 32) throw new Error("cohort_anti_cherry_pick_secret_too_short");
  const operatorId = clean(args.operatorId, 200);
  if (!operatorId) throw new Error("cohort_anti_cherry_pick_operator_missing");
  if (!args.plan.approval || !args.log.witness) throw new Error("cohort_anti_cherry_pick_dual_control_artifacts_missing");
  const issuedAt = args.issuedAt ?? new Date();
  if (issuedAt.getTime() < new Date(args.log.generatedAt).getTime()) throw new Error("cohort_anti_cherry_pick_issued_before_log");
  const unsigned = {
    schemaVersion: PASS4810_ANTI_CHERRY_PICK_RECEIPT_SCHEMA,
    policyVersion: PASS4810_ANTI_CHERRY_PICK_POLICY_ID,
    issuedAt: issuedAt.toISOString(),
    planCreatedAt: args.plan.createdAt,
    observationNotBefore: args.plan.observationNotBefore,
    externalTimestampReceiptDigest: args.plan.randomnessBeacon.receiptDigest,
    planDigest: args.plan.planDigest,
    populationRoot: args.plan.populationRoot,
    selectedEntryRoot: args.plan.selectedEntryRoot,
    manifestDigest: args.manifest.manifestDigest,
    caseRoot: args.manifest.caseRoot,
    caseBindingRoot: args.log.caseBindingRoot,
    transparencyLogDigest: args.log.logDigest,
    transparencyLatestRoot: args.log.latestLogRoot,
    caseCounts: productCounts(args.cases),
    precommitOperatorIdDigest: args.plan.operatorIdDigest,
    precommitApproverIdDigest: args.plan.approval.approverIdDigest,
    captureOperatorIdDigest: args.log.operatorIdDigest,
    captureWitnessIdDigest: args.log.witness.witnessIdDigest,
    operatorIdDigest: sha256Digest(operatorId),
  } as const;
  return { ...unsigned, signature: hmacSha256Digest(secret, antiCherryReceiptPayload(unsigned)) };
}

export function approveCommercialCohortAntiCherryPickReceipt(args: {
  receipt: CommercialCohortAntiCherryPickReceipt;
  primarySecret: string;
  approverSecret: string;
  approverId: string;
  manifest: CommercialCohortManifest;
  approvedAt?: Date;
}): CommercialCohortAntiCherryPickReceipt {
  const verified = verifyCommercialCohortAntiCherryPickReceipt({
    receipt: args.receipt,
    manifest: args.manifest,
    secret: args.primarySecret,
    requireApproval: false,
  });
  if (!verified.verified) throw new Error(`cohort_anti_cherry_pick_primary_invalid:${verified.blockers.join("|")}`);
  const approverSecret = args.approverSecret.trim();
  if (approverSecret.length < 32) throw new Error("cohort_anti_cherry_pick_approver_secret_too_short");
  if (constantTimeTextEqual(args.primarySecret.trim(), approverSecret)) throw new Error("cohort_anti_cherry_pick_secret_reused");
  const approverId = clean(args.approverId, 200);
  if (!approverId) throw new Error("cohort_anti_cherry_pick_approver_missing");
  const approverIdDigest = sha256Digest(approverId);
  if (approverIdDigest === args.receipt.operatorIdDigest) throw new Error("cohort_anti_cherry_pick_same_operator_and_approver");
  const approvedAt = args.approvedAt ?? new Date();
  if (approvedAt.getTime() < new Date(args.receipt.issuedAt).getTime()) throw new Error("cohort_anti_cherry_pick_approval_time_invalid");
  const approvedAtText = approvedAt.toISOString();
  const approval: CommercialCohortAntiCherryPickApproval = {
    schemaVersion: "velmere.commercial-cohort-anti-cherry-pick-approval.v1",
    approvedAt: approvedAtText,
    approverIdDigest,
    signature: hmacSha256Digest(approverSecret, antiCherryApprovalPayload(args.receipt, approvedAtText, approverIdDigest)),
  };
  return { ...args.receipt, approval };
}

export function verifyCommercialCohortAntiCherryPickReceipt(args: {
  receipt: CommercialCohortAntiCherryPickReceipt;
  manifest: CommercialCohortManifest;
  secret: string | null;
  approverSecret?: string | null;
  requireApproval?: boolean;
  now?: Date;
}): {
  verified: boolean;
  primaryVerified: boolean;
  approvalVerified: boolean;
  precommitBound: boolean;
  transparencyBound: boolean;
  blockers: string[];
} {
  const blockers: string[] = [];
  let primaryVerified = false;
  let approvalVerified = args.requireApproval === false;
  let precommitBound = false;
  let transparencyBound = false;
  try {
    const receipt = args.receipt;
    const manifest = args.manifest;
    if (!receipt || receipt.schemaVersion !== PASS4810_ANTI_CHERRY_PICK_RECEIPT_SCHEMA || receipt.policyVersion !== PASS4810_ANTI_CHERRY_PICK_POLICY_ID) throw new Error("cohort_anti_cherry_pick_schema_invalid");
    const planCreatedAt = parseDate(receipt.planCreatedAt, "cohort_anti_cherry_pick_plan_time_invalid");
    const observationNotBefore = parseDate(receipt.observationNotBefore, "cohort_anti_cherry_pick_observation_time_invalid");
    const issuedAt = parseDate(receipt.issuedAt, "cohort_anti_cherry_pick_issued_at_invalid");
    const windowStart = parseDate(manifest.windowStart, "cohort_manifest_window_start_invalid");
    const generatedAt = parseDate(manifest.generatedAt, "cohort_manifest_generated_at_invalid");
    if (planCreatedAt.getTime() + 60_000 > observationNotBefore.getTime() || observationNotBefore.getTime() > windowStart.getTime()) blockers.push("cohort_anti_cherry_pick_chronology_invalid");
    if (issuedAt.getTime() < generatedAt.getTime()) blockers.push("cohort_anti_cherry_pick_issued_before_manifest");
    const now = args.now ?? new Date();
    if (issuedAt.getTime() > now.getTime() + 60_000) blockers.push("cohort_anti_cherry_pick_issued_in_future");
    for (const field of [
      receipt.externalTimestampReceiptDigest,
      receipt.planDigest,
      receipt.populationRoot,
      receipt.selectedEntryRoot,
      receipt.manifestDigest,
      receipt.caseRoot,
      receipt.caseBindingRoot,
      receipt.transparencyLogDigest,
      receipt.transparencyLatestRoot,
      receipt.precommitOperatorIdDigest,
      receipt.precommitApproverIdDigest,
      receipt.captureOperatorIdDigest,
      receipt.captureWitnessIdDigest,
      receipt.operatorIdDigest,
    ]) requiredDigest(field, "cohort_anti_cherry_pick_digest_invalid");
    if (receipt.manifestDigest !== manifest.manifestDigest || receipt.caseRoot !== manifest.caseRoot) blockers.push("cohort_anti_cherry_pick_manifest_binding_invalid");
    for (const product of Object.keys(REQUIRED_COUNTS) as CommercialCohortProduct[]) {
      if (receipt.caseCounts?.[product] !== REQUIRED_COUNTS[product]) blockers.push(`cohort_anti_cherry_pick_case_count_invalid:${product}:${receipt.caseCounts?.[product] ?? "missing"}/${REQUIRED_COUNTS[product]}`);
    }
    if (receipt.precommitOperatorIdDigest === receipt.precommitApproverIdDigest) blockers.push("cohort_anti_cherry_pick_precommit_dual_control_invalid");
    if (receipt.captureOperatorIdDigest === receipt.captureWitnessIdDigest) blockers.push("cohort_anti_cherry_pick_capture_dual_control_invalid");
    precommitBound = !blockers.some((item) => item.includes("chronology") || item.includes("precommit") || item.includes("externalTimestamp") || item.includes("case_count"));
    transparencyBound = !blockers.some((item) => item.includes("transparency") || item.includes("capture") || item.includes("manifest_binding"));
    if (!args.secret || args.secret.trim().length < 32) blockers.push("cohort_anti_cherry_pick_secret_missing");
    else {
      const { signature, approval: _approval, ...unsigned } = receipt;
      const expected = hmacSha256Digest(args.secret.trim(), antiCherryReceiptPayload(unsigned));
      if (!DIGEST.test(signature) || !constantTimeTextEqual(signature, expected)) blockers.push("cohort_anti_cherry_pick_signature_invalid");
      else primaryVerified = true;
    }
    if (args.requireApproval !== false) {
      const approval = receipt.approval;
      if (!approval) blockers.push("cohort_anti_cherry_pick_approval_missing");
      else if (!args.approverSecret || args.approverSecret.trim().length < 32) blockers.push("cohort_anti_cherry_pick_approver_secret_missing");
      else {
        if (!DIGEST.test(approval.approverIdDigest) || approval.approverIdDigest === receipt.operatorIdDigest) blockers.push("cohort_anti_cherry_pick_approver_identity_invalid");
        const approvedAt = parseDate(approval.approvedAt, "cohort_anti_cherry_pick_approved_at_invalid");
        if (approvedAt.getTime() < issuedAt.getTime()) blockers.push("cohort_anti_cherry_pick_approval_time_invalid");
        const expected = hmacSha256Digest(args.approverSecret.trim(), antiCherryApprovalPayload(receipt, approval.approvedAt, approval.approverIdDigest));
        if (!DIGEST.test(approval.signature) || !constantTimeTextEqual(approval.signature, expected)) blockers.push("cohort_anti_cherry_pick_approval_signature_invalid");
        else approvalVerified = true;
      }
    }
  } catch (error) {
    blockers.push(error instanceof Error ? error.message : "cohort_anti_cherry_pick_validation_failed");
  }
  const uniqueBlockers = unique(blockers).sort();
  return {
    verified: uniqueBlockers.length === 0 && primaryVerified && approvalVerified && precommitBound && transparencyBound,
    primaryVerified,
    approvalVerified,
    precommitBound,
    transparencyBound,
    blockers: uniqueBlockers,
  };
}
