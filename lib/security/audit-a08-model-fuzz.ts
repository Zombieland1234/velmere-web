import { createHash } from "node:crypto";

export const PASS35_A6_A08_ENGINE_ID = "pass35-a6-model-based-fuzz-invariants" as const;

export type Pass35A6A08InputClass =
  | "SYNTHETIC_OFFLINE"
  | "CUSTOMER_SUPPLIED_UNVERIFIED"
  | "CUSTOMER_SUPPLIED_VERIFIED";

export type Pass35A6A08Variant =
  | "REFERENCE"
  | "MUTANT_UNAUTHORIZED_MINT"
  | "MUTANT_TRANSFER_INFLATES"
  | "MUTANT_BURN_SUPPLY_DRIFT";

export type Pass35A6A08Case = {
  schemaVersion: "velmere.pass35.audit-a6-a08-model-fuzz-case.v1";
  inputClass: Pass35A6A08InputClass;
  caseRef: string;
  observedAt: string;
  modelId: "ERC20_ACCOUNTING_MODEL_V1";
  implementationVariant: Pass35A6A08Variant;
  seedSha256: string;
  iterations: number;
  owner: string;
  actors: string[];
  initialBalances: Record<string, number>;
  initialTotalSupply: number;
  sourceModelBindingSha256: string;
  a07ExactTestReceiptSha256?: string | null;
};

type ModelState = { balances: Record<string, number>; totalSupply: number };
type Operation = {
  kind: "TRANSFER" | "MINT" | "BURN";
  caller: string;
  from: string | null;
  to: string | null;
  amount: number;
};
type InvariantFailure = { iteration: number; invariantId: string; operation: Operation; evidence: string };

const DIGEST = /^(?:sha256:)?[a-f0-9]{64}$/i;
const CASE_REF = /^AUD-[A-Z0-9-]{8,64}$/u;
const ACTOR = /^ACTOR_[A-Z0-9_]{2,48}$/u;
const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/u;
const MAX_AMOUNT = 1_000_000_000_000;

function stable(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stable(record[key])}`).join(",")}}`;
}
function sha256(value: string | Buffer): string { return `sha256:${createHash("sha256").update(value).digest("hex")}`; }
function digest(value: unknown): string | null {
  const text = String(value ?? "").trim().toLowerCase();
  if (!DIGEST.test(text)) return null;
  return text.startsWith("sha256:") ? text : `sha256:${text}`;
}
function cloneState(state: ModelState): ModelState { return { balances: { ...state.balances }, totalSupply: state.totalSupply }; }
function sumBalances(state: ModelState): number { return Object.values(state.balances).reduce((sum, value) => sum + value, 0); }
function sameState(left: ModelState, right: ModelState): boolean { return left.totalSupply === right.totalSupply && stable(left.balances) === stable(right.balances); }

function createPrng(seedSha256: string) {
  let state = Number.parseInt(seedSha256.replace(/^sha256:/u, "").slice(0, 8), 16) >>> 0;
  if (state === 0) state = 0x9e3779b9;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return state >>> 0;
  };
}

function fixedProbe(index: number, actors: string[], owner: string): Operation | null {
  const other = actors.find((actor) => actor !== owner) ?? owner;
  const third = actors.find((actor) => actor !== owner && actor !== other) ?? other;
  if (index === 0) return { kind: "MINT", caller: other, from: null, to: other, amount: 7 };
  if (index === 1) return { kind: "MINT", caller: owner, from: null, to: third, amount: 11 };
  if (index === 2) return { kind: "TRANSFER", caller: owner, from: owner, to: other, amount: 5 };
  if (index === 3) return { kind: "BURN", caller: third, from: third, to: null, amount: 3 };
  return null;
}

function randomOperation(next: () => number, state: ModelState, actors: string[], owner: string): Operation {
  const kindIndex = next() % 3;
  const caller = actors[next() % actors.length];
  const target = actors[next() % actors.length];
  const sourceBalance = state.balances[caller] ?? 0;
  const amountCap = Math.max(1, Math.min(1000, sourceBalance + 50));
  const amount = 1 + (next() % amountCap);
  if (kindIndex === 0) return { kind: "TRANSFER", caller, from: caller, to: target, amount };
  if (kindIndex === 1) return { kind: "MINT", caller: next() % 4 === 0 ? owner : caller, from: null, to: target, amount };
  return { kind: "BURN", caller, from: caller, to: null, amount };
}

function applyOperation(state: ModelState, operation: Operation, owner: string, variant: Pass35A6A08Variant) {
  const before = cloneState(state);
  let applied = false;
  let rejection = null as string | null;
  if (operation.kind === "TRANSFER") {
    const from = operation.from!;
    const to = operation.to!;
    if ((state.balances[from] ?? 0) < operation.amount) rejection = "INSUFFICIENT_BALANCE";
    else {
      state.balances[from] -= operation.amount;
      state.balances[to] = (state.balances[to] ?? 0) + operation.amount + (variant === "MUTANT_TRANSFER_INFLATES" ? 1 : 0);
      applied = true;
    }
  } else if (operation.kind === "MINT") {
    const authorized = operation.caller === owner;
    if (!authorized && variant !== "MUTANT_UNAUTHORIZED_MINT") rejection = "UNAUTHORIZED";
    else {
      const to = operation.to!;
      state.balances[to] = (state.balances[to] ?? 0) + operation.amount;
      state.totalSupply += operation.amount;
      applied = true;
    }
  } else {
    const from = operation.from!;
    if ((state.balances[from] ?? 0) < operation.amount) rejection = "INSUFFICIENT_BALANCE";
    else {
      state.balances[from] -= operation.amount;
      if (variant !== "MUTANT_BURN_SUPPLY_DRIFT") state.totalSupply -= operation.amount;
      applied = true;
    }
  }
  return { before, after: cloneState(state), applied, rejection };
}

function validateInput(input: Pass35A6A08Case): string[] {
  const blockers: string[] = [];
  const add = (ok: unknown, code: string) => { if (!ok) blockers.push(code); };
  add(input?.schemaVersion === "velmere.pass35.audit-a6-a08-model-fuzz-case.v1", "a6_a08_schema_invalid");
  add(["SYNTHETIC_OFFLINE", "CUSTOMER_SUPPLIED_UNVERIFIED", "CUSTOMER_SUPPLIED_VERIFIED"].includes(input?.inputClass), "a6_a08_input_class_invalid");
  add(CASE_REF.test(String(input?.caseRef ?? "")), "a6_a08_case_ref_invalid");
  add(ISO.test(String(input?.observedAt ?? "")), "a6_a08_observed_at_invalid");
  add(input?.modelId === "ERC20_ACCOUNTING_MODEL_V1", "a6_a08_model_id_invalid");
  add(["REFERENCE", "MUTANT_UNAUTHORIZED_MINT", "MUTANT_TRANSFER_INFLATES", "MUTANT_BURN_SUPPLY_DRIFT"].includes(input?.implementationVariant), "a6_a08_variant_invalid");
  add(digest(input?.seedSha256) !== null, "a6_a08_seed_invalid");
  add(Number.isInteger(input?.iterations) && input.iterations >= 100 && input.iterations <= 50_000, "a6_a08_iterations_invalid");
  add(Array.isArray(input?.actors) && input.actors.length >= 3 && input.actors.length <= 16, "a6_a08_actors_invalid");
  const actorSet = new Set(input?.actors ?? []);
  add(actorSet.size === (input?.actors ?? []).length && [...actorSet].every((actor) => ACTOR.test(String(actor))), "a6_a08_actor_ids_invalid");
  add(actorSet.has(input?.owner), "a6_a08_owner_invalid");
  const balanceEntries = Object.entries(input?.initialBalances ?? {});
  add(balanceEntries.length === actorSet.size && balanceEntries.every(([actor, value]) => actorSet.has(actor) && Number.isSafeInteger(value) && value >= 0 && value <= MAX_AMOUNT), "a6_a08_balances_invalid");
  add(Number.isSafeInteger(input?.initialTotalSupply) && input.initialTotalSupply >= 0 && input.initialTotalSupply <= MAX_AMOUNT, "a6_a08_total_supply_invalid");
  add(balanceEntries.reduce((sum, [, value]) => sum + value, 0) === input?.initialTotalSupply, "a6_a08_initial_supply_mismatch");
  add(digest(input?.sourceModelBindingSha256) !== null, "a6_a08_source_model_binding_invalid");
  if (input?.a07ExactTestReceiptSha256 != null) add(digest(input.a07ExactTestReceiptSha256) !== null, "a6_a08_a07_receipt_invalid");
  return [...new Set(blockers)].sort();
}

export function executeModelFuzzInvariants(input: Pass35A6A08Case) {
  const blockers = validateInput(input);
  const seed = digest(input?.seedSha256) ?? `sha256:${"0".repeat(64)}`;
  const state: ModelState = { balances: { ...(input?.initialBalances ?? {}) }, totalSupply: input?.initialTotalSupply ?? 0 };
  const next = createPrng(seed);
  const failures: InvariantFailure[] = [];
  let invariantChecks = 0;
  let appliedCount = 0;
  let rejectedCount = 0;
  const trace = [] as Array<{ iteration: number; operation: Operation; applied: boolean; rejection: string | null; stateSha256: string }>;

  if (!blockers.length) {
    for (let iteration = 0; iteration < input.iterations; iteration += 1) {
      const operation = fixedProbe(iteration, input.actors, input.owner) ?? randomOperation(next, state, input.actors, input.owner);
      const result = applyOperation(state, operation, input.owner, input.implementationVariant);
      if (result.applied) appliedCount += 1; else rejectedCount += 1;
      const addFailure = (invariantId: string, ok: boolean, evidence: string) => {
        invariantChecks += 1;
        if (!ok && failures.length < 50) failures.push({ iteration, invariantId, operation, evidence });
      };
      addFailure("INV_TOTAL_SUPPLY_EQUALS_BALANCE_SUM", sumBalances(result.after) === result.after.totalSupply, `balanceSum=${sumBalances(result.after)} totalSupply=${result.after.totalSupply}`);
      addFailure("INV_NON_NEGATIVE_BALANCES", Object.values(result.after.balances).every((value) => Number.isSafeInteger(value) && value >= 0), "all balances must be non-negative safe integers");
      if (operation.kind === "MINT" && operation.caller !== input.owner) {
        addFailure("INV_UNAUTHORIZED_MINT_NO_STATE_CHANGE", sameState(result.before, result.after), `unauthorized mint applied=${result.applied}`);
      }
      if (operation.kind === "TRANSFER" && result.applied) {
        addFailure("INV_TRANSFER_DOES_NOT_CHANGE_SUPPLY", result.before.totalSupply === result.after.totalSupply, `before=${result.before.totalSupply} after=${result.after.totalSupply}`);
      }
      if (operation.kind === "MINT" && operation.caller === input.owner && result.applied) {
        addFailure("INV_OWNER_MINT_SUPPLY_DELTA", result.after.totalSupply - result.before.totalSupply === operation.amount, `expectedDelta=${operation.amount} actualDelta=${result.after.totalSupply - result.before.totalSupply}`);
      }
      if (operation.kind === "BURN" && result.applied) {
        addFailure("INV_BURN_SUPPLY_DELTA", result.before.totalSupply - result.after.totalSupply === operation.amount, `expectedDelta=${operation.amount} actualDelta=${result.before.totalSupply - result.after.totalSupply}`);
      }
      trace.push({ iteration, operation, applied: result.applied, rejection: result.rejection, stateSha256: sha256(stable(result.after)) });
    }
  }

  const status = blockers.length ? "BLOCKED" : failures.length ? "FAILED_INVARIANT" : "VERIFIED_LOCAL_MODEL_FUZZ";
  const core = {
    schemaVersion: "velmere.pass35.audit-a6-a08-model-fuzz-receipt.v1",
    engineId: PASS35_A6_A08_ENGINE_ID,
    familyId: "property_fuzz_invariant" as const,
    caseRef: input?.caseRef ?? null,
    inputClass: input?.inputClass ?? null,
    modelId: input?.modelId ?? null,
    implementationVariant: input?.implementationVariant ?? null,
    seedSha256: seed,
    iterations: input?.iterations ?? null,
    actorCount: Array.isArray(input?.actors) ? input.actors.length : 0,
    sourceModelBindingSha256: digest(input?.sourceModelBindingSha256),
    a07ExactTestReceiptSha256: digest(input?.a07ExactTestReceiptSha256),
    execution: {
      status,
      assuranceClass: "LOCAL_STATE_MODEL_NOT_EVM",
      realCaseExecution: false,
      paidGateEligible: false,
      fullAuditClaimAllowed: false,
      promotionAllowed: false,
    },
    operationCount: trace.length,
    appliedCount,
    rejectedCount,
    invariantChecks,
    invariantFailureCount: failures.length,
    invariantFailureIds: [...new Set(failures.map((failure) => failure.invariantId))].sort(),
    firstFailures: failures.slice(0, 10),
    finalStateSha256: sha256(stable(state)),
    operationTraceSha256: sha256(stable(trace)),
    blockers,
    limitations: [
      "This runner fuzzes a deterministic accounting state model, not deployed EVM bytecode or Solidity execution.",
      "Model success does not prove implementation equivalence, branch coverage, reentrancy safety, external-call behavior or fork-state correctness.",
      "A08 paid-gate credit requires real compiled-contract fuzz/invariant execution, benchmark and reviewer adjudication.",
    ],
    truthBoundary: "A6 model fuzz may prove local model invariants and mutation-detection capability only. It cannot be promoted to EVM, customer, paid, independent or full-audit evidence.",
  };
  return { ...core, receiptSha256: sha256(stable(core)) };
}
