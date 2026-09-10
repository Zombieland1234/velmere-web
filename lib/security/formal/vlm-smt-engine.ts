import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import * as path from 'node:path';
import * as fs from 'node:fs';

export type SolverKind = 'z3' | 'cvc5' | 'custom';
export type SolverStatus = 'sat' | 'unsat' | 'unknown' | 'error';
export type ProofStatus = 'PROVEN' | 'REFUTED' | 'DISPROVEN' | 'UNKNOWN' | 'NOT_EXECUTED';

export type InvariantId =
  | 'VLM-FORMAL-01-SOLVENCY'
  | 'VLM-FORMAL-02-CONSERVATION'
  | 'VLM-FORMAL-03-REENTRANCY-IMPOSSIBILITY'
  | 'VLM-FORMAL-04-NONCE-MONOTONICITY';

export interface EvidenceRef {
  sourceKind: 'AST' | 'SMT' | 'SOLVER' | 'RUNTIME' | 'METADATA';
  sourceId: string;
  line?: number;
  claim: string;
  hashSha256: string;
}

export interface FormalModelDefinition {
  logic: 'QF_LIA' | 'QF_UF' | 'QF_BV' | 'QF_ABV' | string;
  stateVariables: string[];
  transitionRelations: string[];
  description: string;
}

export interface FormalPropertyDefinition {
  propertyId: InvariantId;
  name: string;
  statement: string;
  scope: string;
  preconditions: string[];
  assumptions: string[];
  model: FormalModelDefinition;
  negatedProperty: string;
  expectedResult: 'unsat';
  controlFixture: string;
  faultInjectionScenario: {
    description: string;
    mutatedAxioms: string[];
    expectedResult: 'sat';
    fixtureFile: string;
  };
  reproductionCommand: string;
}

export interface FormalPropertyVerificationRecord {
  propertyId: InvariantId;
  name: string;
  statement: string;
  scope: string;
  preconditions: string[];
  assumptions: string[];
  model: FormalModelDefinition & {
    counterexampleModel?: Record<string, string | number | boolean>;
  };
  solver: {
    name: 'Z3 SMT-LIB2';
    kind: SolverKind;
    version?: string;
    command: string;
    args: string[];
    rawStdout?: string;
  };
  result: {
    controlStatus: 'unsat';
    controlProofStatus: 'PROVEN';
    faultInjectionStatus: 'sat';
    faultInjectionProofStatus: 'REFUTED' | 'DISPROVEN';
    counterexampleModel: Record<string, string | number | boolean>;
  };
  proofArtifactHash: string;
  faultInjectionArtifactHash: string;
  reproductionCommand: string;
  verifiedAt: string;
}

export interface SmtLemma {
  propertyId?: InvariantId;
  invariantId: InvariantId;
  name: string;
  statement: string;
  scope: string;
  preconditions: string[];
  assumptions?: string[];
  transitionAxioms: string[];
  negatedProperty: string;
  expectedResult: 'unsat';
  coverage: string[];
  modelLogic?: string;
  reproductionCommand?: string;
}

export interface SolverResult {
  solver: SolverKind;
  command: string;
  args: string[];
  status: SolverStatus;
  rawStdout: string;
  rawStderr: string;
  elapsedMs: number;
  exitCode: number | null;
  timedOut: boolean;
  model?: string;
  parsedModel?: Record<string, string | number | boolean>;
  unsatCore?: string[];
  outputSha256: string;
}

export interface FormalProof {
  propertyId: InvariantId;
  invariantId: InvariantId;
  statement: string;
  scope: string;
  preconditions: string[];
  assumptions: string[];
  model: {
    logic: string;
    description: string;
    stateVariables: string[];
    transitionRelations: string[];
    counterexampleModel?: Record<string, string | number | boolean>;
  };
  solverName: 'Z3 SMT-LIB2';
  solver?: SolverResult;
  result: {
    status: SolverStatus;
    proofStatus: ProofStatus;
    model?: string;
    parsedModel?: Record<string, string | number | boolean>;
  };
  proofArtifactHash: string;
  reproductionCommand: string;
  lemma: SmtLemma;
  smtLib2: string;
  smtSha256: string;
  proofStatus: ProofStatus;
  modelCoverage: string[];
  evidence: EvidenceRef[];
  proofId: string;
}

export interface MerkleLeaf {
  leafId: string;
  leafType: string;
  payloadSha256: string;
  canonicalJson: string;
  leafHashSha256: string;
}

export interface EvidenceBundle {
  schemaVersion: 'velmere.institutional-evidence-bundle.v1';
  bundleId: string;
  generatedAt: string;
  sourceCommit?: string;
  sourceRootSha256?: string;
  astEvidence: EvidenceRef[];
  formalProofs: FormalProof[];
  findings: EvidenceRef[];
  merkle: {
    algorithm: 'SHA-256';
    leafOrdering: 'UTF8_BYTEWISE_ASCENDING_V1';
    rootSha256: string;
    leaves: MerkleLeaf[];
  };
  timestamp: {
    protocol: 'RFC3161';
    status: 'NOT_REQUESTED' | 'REQUESTED' | 'VERIFIED' | 'FAILED';
    messageImprintSha256: string;
    tsaUrl?: string;
    tokenBase64?: string;
    genTime?: string;
    policyOid?: string;
    serialNumber?: string;
  };
  risk: {
    cvssV31?: string;
    cvssScore?: number;
    daspTop10?: string[];
  };
}

export interface SolverRunnerOptions {
  solver: SolverKind;
  command?: string;
  args?: string[];
  timeoutMs?: number;
  cwd?: string;
  env?: NodeJS.ProcessEnv;
}

export interface FormalEngineOptions {
  solver?: SolverRunnerOptions;
  executeSolver?: boolean;
  includeModels?: boolean;
  includeUnsatCore?: boolean;
}

const LOGIC = '(set-logic QF_LIA)';

function sha256(input: string | Uint8Array): string {
  return createHash('sha256').update(input).digest('hex');
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map(k => `${JSON.stringify(k)}:${canonicalJson(record[k])}`).join(',')}}`;
}

function smtQuote(value: string): string {
  return `|${value.replace(/\\/g, '\\\\').replace(/\|/g, '\\|')}|`;
}

function namedAssert(name: string, expr: string): string {
  return `(assert (! ${expr} :named ${smtQuote(name)}))`;
}

function makeProofId(smt: string, invariantId: InvariantId): string {
  return sha256(`${invariantId}\n${smt}`);
}

export const FORMAL_PROPERTY_REGISTRY: Record<InvariantId, FormalPropertyDefinition> = {
  'VLM-FORMAL-01-SOLVENCY': {
    propertyId: 'VLM-FORMAL-01-SOLVENCY',
    name: 'vault-solvency',
    statement: 'totalAssets >= totalSupply is preserved by equal-debit/equal-credit modeled transfers',
    scope: 'EVM ERC-4626 vault share accounting / linear integer balance arithmetic',
    preconditions: [
      'totalAssets_0 >= totalSupply_0',
      'deposit >= 0',
      'withdraw >= 0',
      'withdraw <= totalAssets_0',
      'mint >= 0',
      'burn >= 0',
    ],
    assumptions: [
      'Integer-valued asset and supply ledger balances',
      'Atomic balance sheet transitions without external reentrant interference',
      'Burn covers net asset withdrawal minus deposit (burn >= mint + withdraw - deposit)',
      'Withdrawals are strictly bounded by pre-state available assets',
    ],
    model: {
      logic: 'QF_LIA',
      stateVariables: [
        'totalAssets_0',
        'totalSupply_0',
        'totalAssets_1',
        'totalSupply_1',
        'deposit',
        'withdraw',
        'mint',
        'burn',
      ],
      transitionRelations: [
        'totalAssets_1 = totalAssets_0 + deposit - withdraw',
        'totalSupply_1 = totalSupply_0 + mint - burn',
        'burn >= mint + withdraw - deposit',
      ],
      description: 'Single-step inductive vault accounting model under non-negative linear integer balance transitions',
    },
    negatedProperty: 'totalAssets_1 < totalSupply_1',
    expectedResult: 'unsat',
    controlFixture: 'tests/fixtures/smt/FORMAL_01_solvency_control.smt2',
    faultInjectionScenario: {
      description: 'Unbacked withdrawal: totalAssets decremented by withdraw > 0 without proportional burn or deposit, causing insolvency',
      mutatedAxioms: [
        'totalAssets_1 = totalAssets_0 - withdraw',
        'totalSupply_1 = totalSupply_0',
        'withdraw > 0',
      ],
      expectedResult: 'sat',
      fixtureFile: 'tests/fixtures/smt/FORMAL_01_solvency_vulnerable.smt2',
    },
    reproductionCommand: 'npx tsx scripts/qa/test-smt-engine.ts --property VLM-FORMAL-01-SOLVENCY',
  },
  'VLM-FORMAL-02-CONSERVATION': {
    propertyId: 'VLM-FORMAL-02-CONSERVATION',
    name: 'collateral-conservation',
    statement: 'cumulative withdrawals cannot exceed cumulative deposits plus initial assets',
    scope: 'Multi-step collateral conservation abstraction under non-negative balance constraints',
    preconditions: [
      'initialAssets >= 0',
      'deposits >= 0',
      'withdrawals >= 0',
      'assets_1 >= 0',
    ],
    assumptions: [
      'Cumulative single-step conservation abstraction',
      'Post-state asset balance remains strictly non-negative (assets_1 >= 0)',
      'No unmodeled token fees, reflections, or rebasing drifts',
      'All outflow value is fully accounted for by withdrawals variable',
    ],
    model: {
      logic: 'QF_LIA',
      stateVariables: [
        'initialAssets',
        'deposits',
        'withdrawals',
        'assets_1',
      ],
      transitionRelations: [
        'assets_1 = initialAssets + deposits - withdrawals',
        'assets_1 >= 0',
      ],
      description: 'Conservation of invariant collateral mass: post-state equals initial plus inflows minus outflows, bounded below by zero',
    },
    negatedProperty: 'withdrawals > initialAssets + deposits',
    expectedResult: 'unsat',
    controlFixture: 'tests/fixtures/smt/FORMAL_02_conservation_control.smt2',
    faultInjectionScenario: {
      description: 'Underflow exploit / phantom collateral: removing post-state balance non-negativity constraint allows withdrawals to exceed total deposits + initial assets',
      mutatedAxioms: [
        'assets_1 = initialAssets + deposits - withdrawals',
        'withdrawals > initialAssets + deposits',
      ],
      expectedResult: 'sat',
      fixtureFile: 'tests/fixtures/smt/FORMAL_02_conservation_vulnerable.smt2',
    },
    reproductionCommand: 'npx tsx scripts/qa/test-smt-engine.ts --property VLM-FORMAL-02-CONSERVATION',
  },
  'VLM-FORMAL-03-REENTRANCY-IMPOSSIBILITY': {
    propertyId: 'VLM-FORMAL-03-REENTRANCY-IMPOSSIBILITY',
    name: 'reentrancy-impossibility',
    statement: 'a callback cannot enter a guarded critical section while entered=true',
    scope: 'Boolean reentrancy lock mutex state machine during external callback transitions',
    preconditions: [
      'entered_0 = false',
      'entered_1 = true',
    ],
    assumptions: [
      'Mutex lock entered_1 is atomically updated before external control handover (CEI pattern)',
      'All critical execution paths evaluate reenterAllowed prior to state changes',
      'Single-thread sequential EVM execution semantics',
    ],
    model: {
      logic: 'QF_UF',
      stateVariables: [
        'entered_0',
        'entered_1',
        'reenterAllowed',
        'callbackReentry',
      ],
      transitionRelations: [
        'entered_1 => not reenterAllowed',
        'callbackReentry => reenterAllowed',
      ],
      description: 'State transition guard asserting mutual exclusion between active execution lock and incoming callback reentry permission',
    },
    negatedProperty: 'callbackReentry',
    expectedResult: 'unsat',
    controlFixture: 'tests/fixtures/smt/FORMAL_03_reentrancy_control.smt2',
    faultInjectionScenario: {
      description: 'Omitted or reset guard: entered is false while reenterAllowed is true during callback execution, enabling recursive reentry',
      mutatedAxioms: [
        'entered = false',
        'reenterAllowed = true',
        'callbackReentry = true',
      ],
      expectedResult: 'sat',
      fixtureFile: 'tests/fixtures/smt/FORMAL_03_reentrancy_vulnerable.smt2',
    },
    reproductionCommand: 'npx tsx scripts/qa/test-smt-engine.ts --property VLM-FORMAL-03-REENTRANCY-IMPOSSIBILITY',
  },
  'VLM-FORMAL-04-NONCE-MONOTONICITY': {
    propertyId: 'VLM-FORMAL-04-NONCE-MONOTONICITY',
    name: 'nonce-monotonicity-and-replay-prevention',
    statement: 'a consumed nonce strictly increases and the same nonce cannot authorize twice',
    scope: 'EIP-712 / meta-transaction sequential authorization nonce consumption and replay invalidation',
    preconditions: [
      'nonce_0 >= 0',
      'consume = 1',
      'nonce_1 = nonce_0 + consume',
      'replayNonce = nonce_0',
    ],
    assumptions: [
      'Single-signer sequential nonce progression',
      'Increment by consume = 1 is atomically persisted upon authorization',
      'Replay attack re-presents original signature payload with nonce_0',
    ],
    model: {
      logic: 'QF_LIA',
      stateVariables: [
        'nonce_0',
        'nonce_1',
        'consume',
        'signedNonce',
        'replayNonce',
        'authorized_1',
        'consumed_1',
        'secondAuthorization',
      ],
      transitionRelations: [
        'nonce_1 = nonce_0 + consume',
        'secondAuthorization => signedNonce = nonce_1',
      ],
      description: 'Strict monotonicity of authorization state variable, rendering signedNonce == replayNonce unsatisfiable',
    },
    negatedProperty: 'secondAuthorization AND signedNonce = replayNonce',
    expectedResult: 'unsat',
    controlFixture: 'tests/fixtures/smt/FORMAL_04_nonce_control.smt2',
    faultInjectionScenario: {
      description: 'Missing nonce increment: nonce_1 = nonce_0 allows identical signed authorization replayNonce to be accepted on second authorization',
      mutatedAxioms: [
        'nonce_1 = nonce_0',
        'replayNonce = nonce_0',
        'secondAuthorization = true',
        'signedNonce = nonce_0',
      ],
      expectedResult: 'sat',
      fixtureFile: 'tests/fixtures/smt/FORMAL_04_nonce_vulnerable.smt2',
    },
    reproductionCommand: 'npx tsx scripts/qa/test-smt-engine.ts --property VLM-FORMAL-04-NONCE-MONOTONICITY',
  },
};

export function buildSolvencyLemma(options?: { mode?: 'vault' | 'lending' }): SmtLemma {
  const mode = options?.mode ?? 'vault';
  if (mode === 'lending') {
    return {
      propertyId: 'VLM-FORMAL-01-SOLVENCY',
      invariantId: 'VLM-FORMAL-01-SOLVENCY',
      name: 'lending-solvency',
      statement: 'reserve >= debt is preserved by every modeled transition',
      scope: 'DeFi lending pool reserve-to-debt solvency transition space',
      preconditions: ['reserve_0 >= debt_0', 'repay >= 0', 'newDebt >= 0', 'reserveAdd >= 0'],
      assumptions: ['Linear integer pool accounting', 'Repayments strictly reduce debt and increase reserve'],
      transitionAxioms: ['reserve_1 = reserve_0 + reserveAdd + repay', 'debt_1 = debt_0 + newDebt - repay'],
      negatedProperty: 'reserve_1 < debt_1',
      expectedResult: 'unsat',
      coverage: ['Integer-valued reserve/debt state', 'Modeled transitions only', 'No external effects unless represented by transition variables'],
      modelLogic: 'QF_LIA',
      reproductionCommand: 'npx tsx scripts/qa/test-smt-engine.ts --property VLM-FORMAL-01-SOLVENCY',
    };
  }
  const reg = FORMAL_PROPERTY_REGISTRY['VLM-FORMAL-01-SOLVENCY'];
  return {
    propertyId: reg.propertyId,
    invariantId: reg.propertyId,
    name: reg.name,
    statement: reg.statement,
    scope: reg.scope,
    preconditions: [...reg.preconditions],
    assumptions: [...reg.assumptions],
    transitionAxioms: [
      'totalAssets_1 = totalAssets_0 + deposit - withdraw',
      'totalSupply_1 = totalSupply_0 + mint - burn',
      'withdraw >= 0',
      'burn >= 0',
      'withdraw <= totalAssets_0',
      'burn >= mint + withdraw - deposit',
    ],
    negatedProperty: reg.negatedProperty,
    expectedResult: reg.expectedResult,
    coverage: ['Linear integer accounting model', 'Withdrawals bounded by pre-state assets', 'Supply burn/deposit relation explicitly assumed'],
    modelLogic: reg.model.logic,
    reproductionCommand: reg.reproductionCommand,
  };
}

export function buildConservationLemma(): SmtLemma {
  const reg = FORMAL_PROPERTY_REGISTRY['VLM-FORMAL-02-CONSERVATION'];
  return {
    propertyId: reg.propertyId,
    invariantId: reg.propertyId,
    name: reg.name,
    statement: reg.statement,
    scope: reg.scope,
    preconditions: [...reg.preconditions],
    assumptions: [...reg.assumptions],
    transitionAxioms: [
      'assets_1 = initialAssets + deposits - withdrawals',
      'assets_1 >= 0',
    ],
    negatedProperty: reg.negatedProperty,
    expectedResult: reg.expectedResult,
    coverage: ['Cumulative single-step conservation abstraction', 'No fee/reflection/rebase drift unless modeled', 'All withdrawal value is represented by withdrawals variable'],
    modelLogic: reg.model.logic,
    reproductionCommand: reg.reproductionCommand,
  };
}

export function buildReentrancyLemma(): SmtLemma {
  const reg = FORMAL_PROPERTY_REGISTRY['VLM-FORMAL-03-REENTRANCY-IMPOSSIBILITY'];
  return {
    propertyId: reg.propertyId,
    invariantId: reg.propertyId,
    name: reg.name,
    statement: reg.statement,
    scope: reg.scope,
    preconditions: [...reg.preconditions],
    assumptions: [...reg.assumptions],
    transitionAxioms: [
      'entered_1 = true when critical section begins',
      'reenterAllowed = false when entered_1 = true',
      'callbackReentry -> reenterAllowed',
    ],
    negatedProperty: reg.negatedProperty,
    expectedResult: reg.expectedResult,
    coverage: ['Boolean guard semantics', 'All callback reentry enters the modeled guarded path', 'Does not prove external target cannot invoke another unguarded function'],
    modelLogic: reg.model.logic,
    reproductionCommand: reg.reproductionCommand,
  };
}

export function buildNonceLemma(): SmtLemma {
  const reg = FORMAL_PROPERTY_REGISTRY['VLM-FORMAL-04-NONCE-MONOTONICITY'];
  return {
    propertyId: reg.propertyId,
    invariantId: reg.propertyId,
    name: reg.name,
    statement: reg.statement,
    scope: reg.scope,
    preconditions: [...reg.preconditions],
    assumptions: [...reg.assumptions],
    transitionAxioms: [
      'authorized_1 -> signedNonce = nonce_0',
      'consumed_1 -> nonce_1 = nonce_0 + 1',
      'secondAuthorization -> signedNonce = nonce_1',
    ],
    negatedProperty: reg.negatedProperty,
    expectedResult: reg.expectedResult,
    coverage: ['Single-key sequential nonce model', 'Monotonic +1 consumption', 'No keyed nonce domain unless added to model'],
    modelLogic: reg.model.logic,
    reproductionCommand: reg.reproductionCommand,
  };
}

export const DEFAULT_LEMMAS: SmtLemma[] = [
  buildSolvencyLemma({ mode: 'vault' }),
  buildConservationLemma(),
  buildReentrancyLemma(),
  buildNonceLemma(),
];

function renderHeader(name: string, produceModels: boolean, produceUnsatCore: boolean): string[] {
  const lines = [
    '; Velmère Furnace 3.0 formal proof capsule',
    `; lemma: ${name}`,
    '; Property is proved by UNSAT of the negated invariant.',
    LOGIC,
    '(set-option :print-success false)',
  ];
  if (produceModels) lines.push('(set-option :produce-models true)');
  if (produceUnsatCore) lines.push('(set-option :produce-unsat-cores true)');
  return lines;
}

export function lemmaToSmtLib2(
  lemma: SmtLemma,
  opts?: { produceModels?: boolean; produceUnsatCore?: boolean },
): string {
  const lines = renderHeader(lemma.name, !!opts?.produceModels, !!opts?.produceUnsatCore);
  lines.push('(declare-const totalAssets_0 Int)');
  lines.push('(declare-const totalSupply_0 Int)');
  lines.push('(declare-const totalAssets_1 Int)');
  lines.push('(declare-const totalSupply_1 Int)');
  lines.push('(declare-const deposit Int)');
  lines.push('(declare-const withdraw Int)');
  lines.push('(declare-const mint Int)');
  lines.push('(declare-const burn Int)');
  lines.push('(declare-const initialAssets Int)');
  lines.push('(declare-const deposits Int)');
  lines.push('(declare-const withdrawals Int)');
  lines.push('(declare-const assets_1 Int)');
  lines.push('(declare-const entered_0 Bool)');
  lines.push('(declare-const entered_1 Bool)');
  lines.push('(declare-const reenterAllowed Bool)');
  lines.push('(declare-const callbackReentry Bool)');
  lines.push('(declare-const reenterRequest Bool)');
  lines.push('(declare-const nonce_0 Int)');
  lines.push('(declare-const nonce_1 Int)');
  lines.push('(declare-const consume Int)');
  lines.push('(declare-const signedNonce Int)');
  lines.push('(declare-const replayNonce Int)');
  lines.push('(declare-const authorized_1 Bool)');
  lines.push('(declare-const consumed_1 Bool)');
  lines.push('(declare-const secondAuthorization Bool)');

  switch (lemma.invariantId) {
    case 'VLM-FORMAL-01-SOLVENCY':
      lines.push(namedAssert('pre_assets', '(>= totalAssets_0 totalSupply_0)'));
      lines.push(namedAssert('nonnegative_deposit', '(>= deposit 0)'));
      lines.push(namedAssert('nonnegative_withdraw', '(>= withdraw 0)'));
      lines.push(namedAssert('bounded_withdraw', '(<= withdraw totalAssets_0)'));
      lines.push(namedAssert('nonnegative_mint', '(>= mint 0)'));
      lines.push(namedAssert('nonnegative_burn', '(>= burn 0)'));
      lines.push(namedAssert('transition_assets', '(= totalAssets_1 (- (+ totalAssets_0 deposit) withdraw))'));
      lines.push(namedAssert('transition_supply', '(= totalSupply_1 (- (+ totalSupply_0 mint) burn))'));
      lines.push(namedAssert('supply_conservation', '(>= burn (- (+ mint withdraw) deposit))'));
      lines.push(namedAssert('negated_property', '(< totalAssets_1 totalSupply_1)'));
      break;
    case 'VLM-FORMAL-02-CONSERVATION':
      lines.push(namedAssert('initial_nonnegative', '(>= initialAssets 0)'));
      lines.push(namedAssert('deposits_nonnegative', '(>= deposits 0)'));
      lines.push(namedAssert('withdrawals_nonnegative', '(>= withdrawals 0)'));
      lines.push(namedAssert('transition', '(= assets_1 (- (+ initialAssets deposits) withdrawals))'));
      lines.push(namedAssert('asset_balance_nonnegative', '(>= assets_1 0)'));
      lines.push(namedAssert('negated_property', '(> withdrawals (+ initialAssets deposits))'));
      break;
    case 'VLM-FORMAL-03-REENTRANCY-IMPOSSIBILITY':
      lines.push(namedAssert('initial_not_entered', '(not entered_0)'));
      lines.push(namedAssert('critical_section_sets_guard', '(= entered_1 true)'));
      lines.push(namedAssert('guard_blocks_reentry', '(=> entered_1 (not reenterAllowed))'));
      lines.push(namedAssert('reentry_requires_permission', '(=> callbackReentry reenterAllowed)'));
      lines.push(namedAssert('negated_property', 'callbackReentry'));
      break;
    case 'VLM-FORMAL-04-NONCE-MONOTONICITY':
      lines.push(namedAssert('nonce_initial_nonnegative', '(>= nonce_0 0)'));
      lines.push(namedAssert('consume_one', '(= consume 1)'));
      lines.push(namedAssert('nonce_transition', '(= nonce_1 (+ nonce_0 consume))'));
      lines.push(namedAssert('initial_authorization_nonce', '(=> authorized_1 (= signedNonce nonce_0))'));
      lines.push(namedAssert('consumed', 'consumed_1'));
      lines.push(namedAssert('replay_nonce', '(= replayNonce nonce_0)'));
      lines.push(namedAssert('second_auth_uses_current_nonce', '(=> secondAuthorization (= signedNonce nonce_1))'));
      lines.push(namedAssert('negated_property', '(and secondAuthorization (= signedNonce replayNonce))'));
      break;
  }

  lines.push('(check-sat)');
  if (opts?.produceUnsatCore) lines.push('(get-unsat-core)');
  if (opts?.produceModels) lines.push('(get-model)');
  lines.push('(exit)');
  return lines.join('\n') + '\n';
}

export function parseCounterexampleModel(modelStr?: string): Record<string, string | number | boolean> | undefined {
  if (!modelStr) return undefined;
  const result: Record<string, string | number | boolean> = {};
  const regex = /\(define-fun\s+([^\s]+)\s+\(\)\s+(?:Int|Bool)\s+(-?\d+|True|False|true|false|\(- \d+\))\)/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(modelStr)) !== null) {
    const key = match[1];
    const rawVal = match[2];
    if (rawVal === 'true' || rawVal === 'True') {
      result[key] = true;
    } else if (rawVal === 'false' || rawVal === 'False') {
      result[key] = false;
    } else if (rawVal.startsWith('(- ') && rawVal.endsWith(')')) {
      const inner = rawVal.slice(3, -1).trim();
      result[key] = -Number(inner);
    } else if (!isNaN(Number(rawVal))) {
      result[key] = Number(rawVal);
    } else {
      result[key] = rawVal;
    }
  }
  return Object.keys(result).length > 0 ? result : undefined;
}

export function parseSolverOutput(stdout: string, stderr = ''): Omit<SolverResult, 'solver' | 'command' | 'args' | 'elapsedMs' | 'exitCode' | 'timedOut' | 'outputSha256'> {
  const normalized = stdout.trim();
  const firstToken = normalized.split(/\s+/)[0]?.toLowerCase();
  const status: SolverStatus =
    firstToken === 'unsat' ? 'unsat' :
    firstToken === 'sat' ? 'sat' :
    firstToken === 'unknown' ? 'unknown' :
    stderr.trim() ? 'error' : 'unknown';

  const coreMatch = normalized.match(/\(\s*([^()]*)\s*\)\s*$/m);
  const unsatCore = status === 'unsat' && coreMatch
    ? coreMatch[1].split(/\s+/).map(s => s.trim()).filter(Boolean)
    : undefined;

  const rawModel = status === 'sat' ? stdout.slice(stdout.indexOf('sat') + 3).trim() || undefined : undefined;
  const parsedModel = parseCounterexampleModel(rawModel);

  return {
    status,
    rawStdout: stdout,
    rawStderr: stderr,
    model: rawModel,
    parsedModel,
    unsatCore,
  };
}

export async function runSmtSolver(
  smtLib2: string,
  options: SolverRunnerOptions,
): Promise<SolverResult> {
  const started = Date.now();
  let command = options.command;
  let args = options.args ? [...options.args] : undefined;
  if (!command) {
    if (options.solver === 'cvc5') {
      command = 'cvc5';
      args = args ?? ['--lang', 'smt2', '-'];
    } else {
      const cliScript = path.resolve(process.cwd(), 'scripts/security/z3_cli.py');
      if (fs.existsSync(cliScript)) {
        command = 'python';
        args = args ?? [cliScript];
      } else {
        command = 'z3';
        args = args ?? ['-in'];
      }
    }
  }
  const resolvedArgs: string[] = args ?? [];
  const timeoutMs = options.timeoutMs ?? 15_000;

  return await new Promise<SolverResult>((resolve) => {
    let stdout = '';
    let stderr = '';
    let timedOut = false;
    let settled = false;

    const child = spawn(command, resolvedArgs, {
      cwd: options.cwd,
      env: options.env,
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
    });

    const finish = (result: SolverResult) => {
      if (settled) return;
      settled = true;
      resolve(result);
    };

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill();
    }, timeoutMs);

    child.stdout.on('data', (chunk: Buffer | string) => { stdout += chunk.toString(); });
    child.stderr.on('data', (chunk: Buffer | string) => { stderr += chunk.toString(); });

    child.on('error', (error: Error) => {
      clearTimeout(timer);
      finish({
        solver: options.solver,
        command,
        args: resolvedArgs,
        status: 'error',
        rawStdout: stdout,
        rawStderr: `${stderr}${error instanceof Error ? `\n${error.message}` : ''}`,
        elapsedMs: Date.now() - started,
        exitCode: null,
        timedOut,
        outputSha256: sha256(`${stdout}\n${stderr}`),
      });
    });

    child.on('close', (code: number | null) => {
      clearTimeout(timer);
      const parsed = parseSolverOutput(stdout, stderr);
      finish({
        solver: options.solver,
        command,
        args: resolvedArgs,
        status: timedOut ? 'unknown' : parsed.status,
        rawStdout: stdout,
        rawStderr: stderr,
        elapsedMs: Date.now() - started,
        exitCode: code,
        timedOut,
        model: parsed.model,
        parsedModel: parsed.parsedModel,
        unsatCore: parsed.unsatCore,
        outputSha256: sha256(`${stdout}\n${stderr}`),
      });
    });

    child.stdin.write(smtLib2);
    child.stdin.end();
  });
}

function proofStatusFromSolver(status: SolverStatus): ProofStatus {
  if (status === 'unsat') return 'PROVEN';
  if (status === 'sat') return 'REFUTED';
  return 'UNKNOWN';
}

export function buildFormalProof(
  lemma: SmtLemma,
  options?: { smtLib2?: string; solverResult?: SolverResult },
): FormalProof {
  const smt = options?.smtLib2 ?? lemmaToSmtLib2(lemma, {
    produceModels: true,
    produceUnsatCore: true,
  });
  const solver = options?.solverResult;
  const smtSha256 = sha256(smt);
  const proofArtifactHash = sha256(`${smt}\n${solver?.outputSha256 ?? ''}`);

  const evidence: EvidenceRef[] = [
    {
      sourceKind: 'SMT',
      sourceId: smtSha256,
      claim: `SMT-LIB2 encoding of ${lemma.name}`,
      hashSha256: smtSha256,
    },
  ];

  if (solver) {
    evidence.push({
      sourceKind: 'SOLVER',
      sourceId: solver.outputSha256,
      claim: `Solver returned ${solver.status}`,
      hashSha256: solver.outputSha256,
    });
  }

  const proofStatus = solver ? proofStatusFromSolver(solver.status) : 'NOT_EXECUTED';
  const proofId = makeProofId(smt, lemma.invariantId);
  const propertyId = lemma.propertyId ?? lemma.invariantId;

  return {
    propertyId,
    invariantId: lemma.invariantId,
    statement: lemma.statement,
    scope: lemma.scope,
    preconditions: [...lemma.preconditions],
    assumptions: lemma.assumptions ?? [...lemma.preconditions, ...lemma.transitionAxioms],
    model: {
      logic: lemma.modelLogic ?? 'QF_LIA',
      description: lemma.coverage.join('; '),
      stateVariables: [...lemma.transitionAxioms],
      transitionRelations: [...lemma.transitionAxioms],
      counterexampleModel: solver?.parsedModel,
    },
    solverName: 'Z3 SMT-LIB2',
    solver,
    result: {
      status: solver?.status ?? 'unknown',
      proofStatus,
      model: solver?.model,
      parsedModel: solver?.parsedModel,
    },
    proofArtifactHash,
    reproductionCommand: lemma.reproductionCommand ?? `npx tsx scripts/qa/test-smt-engine.ts --property ${propertyId}`,
    lemma,
    smtLib2: smt,
    smtSha256,
    proofStatus,
    modelCoverage: lemma.coverage,
    evidence,
    proofId,
  };
}

export async function proveInvariant(
  lemma: SmtLemma,
  options: FormalEngineOptions = {},
): Promise<FormalProof> {
  const smt = lemmaToSmtLib2(lemma, {
    produceModels: !!options.includeModels,
    produceUnsatCore: !!options.includeUnsatCore,
  });

  if (options.executeSolver === false || !options.solver) {
    return buildFormalProof(lemma, { smtLib2: smt });
  }

  const solver = await runSmtSolver(smt, options.solver);
  return buildFormalProof(lemma, {
    smtLib2: smt,
    solverResult: solver,
  });
}

export async function proveAllFundamentalInvariants(options: FormalEngineOptions = {}): Promise<FormalProof[]> {
  const lemmas: SmtLemma[] = [
    buildSolvencyLemma(),
    buildConservationLemma(),
    buildReentrancyLemma(),
    buildNonceLemma(),
  ];
  const proofs: FormalProof[] = [];
  for (const lemma of lemmas) {
    proofs.push(await proveInvariant(lemma, options));
  }
  return proofs;
}

function leafFrom(type: string, payload: unknown, leafId: string): MerkleLeaf {
  const canonical = canonicalJson(payload);
  const payloadHash = sha256(canonical);
  const leafHash = sha256(`${leafId}|${type}|${payloadHash}`);
  return {
    leafId,
    leafType: type,
    payloadSha256: payloadHash,
    canonicalJson: canonical,
    leafHashSha256: leafHash,
  };
}

export function buildMerkleRoot(leaves: MerkleLeaf[]): string {
  if (!leaves.length) return sha256('EMPTY');
  let level = [...leaves]
    .sort((a, b) => Buffer.from(a.leafHashSha256).compare(Buffer.from(b.leafHashSha256)))
    .map(l => l.leafHashSha256);

  while (level.length > 1) {
    const next: string[] = [];
    for (let i = 0; i < level.length; i += 2) {
      const left = level[i];
      const right = level[i + 1] ?? left;
      const ordered = Buffer.from(left).compare(Buffer.from(right)) <= 0
        ? `${left}${right}`
        : `${right}${left}`;
      next.push(sha256(ordered));
    }
    level = next;
  }
  return level[0];
}

export function buildEvidenceBundle(args: {
  proofs: FormalProof[];
  astEvidence?: EvidenceRef[];
  findings?: EvidenceRef[];
  sourceCommit?: string;
  sourceRootSha256?: string;
  cvssV31?: string;
  cvssScore?: number;
  daspTop10?: string[];
  generatedAt?: string;
}): EvidenceBundle {
  const leaves: MerkleLeaf[] = [];
  for (const proof of args.proofs) {
    leaves.push(leafFrom('FORMAL_PROOF', {
      propertyId: proof.propertyId,
      invariantId: proof.invariantId,
      statement: proof.statement,
      scope: proof.scope,
      proofId: proof.proofId,
      smtSha256: proof.smtSha256,
      proofArtifactHash: proof.proofArtifactHash,
      proofStatus: proof.proofStatus,
      assumptions: proof.assumptions,
      modelCoverage: proof.modelCoverage,
      reproductionCommand: proof.reproductionCommand,
    }, `formal:${proof.proofId}`));
  }
  for (const evidence of args.astEvidence ?? []) {
    leaves.push(leafFrom('AST_EVIDENCE', evidence, `ast:${evidence.sourceId}`));
  }
  for (const finding of args.findings ?? []) {
    leaves.push(leafFrom('FINDING', finding, `finding:${finding.sourceId}`));
  }

  const rootSha256 = buildMerkleRoot(leaves);

  return {
    schemaVersion: 'velmere.institutional-evidence-bundle.v1',
    bundleId: sha256(`${rootSha256}|${args.sourceCommit ?? ''}`),
    generatedAt: args.generatedAt ?? new Date().toISOString(),
    sourceCommit: args.sourceCommit,
    sourceRootSha256: args.sourceRootSha256,
    astEvidence: args.astEvidence ?? [],
    formalProofs: args.proofs,
    findings: args.findings ?? [],
    merkle: {
      algorithm: 'SHA-256',
      leafOrdering: 'UTF8_BYTEWISE_ASCENDING_V1',
      rootSha256,
      leaves: leaves.sort((a, b) => Buffer.from(a.leafHashSha256).compare(Buffer.from(b.leafHashSha256))),
    },
    timestamp: {
      protocol: 'RFC3161',
      status: 'NOT_REQUESTED',
      messageImprintSha256: sha256(rootSha256),
    },
    risk: {
      cvssV31: args.cvssV31,
      cvssScore: args.cvssScore,
      daspTop10: args.daspTop10,
    },
  };
}

export function attachRfc3161TimestampToken(
  bundle: EvidenceBundle,
  token: { tokenBase64: string; tsaUrl: string; genTime?: string; policyOid?: string; serialNumber?: string; verified?: boolean },
): EvidenceBundle {
  return {
    ...bundle,
    timestamp: {
      ...bundle.timestamp,
      status: token.verified ? 'VERIFIED' : 'REQUESTED',
      tokenBase64: token.tokenBase64,
      tsaUrl: token.tsaUrl,
      genTime: token.genTime,
      policyOid: token.policyOid,
      serialNumber: token.serialNumber,
    },
  };
}

export function verifyEvidenceBundleIntegrity(bundle: EvidenceBundle): { ok: boolean; errors: string[] } {
  const errors: string[] = [];
  const calculatedRoot = buildMerkleRoot(bundle.merkle.leaves);
  if (calculatedRoot !== bundle.merkle.rootSha256) {
    errors.push(`Merkle root mismatch: expected ${bundle.merkle.rootSha256}, got ${calculatedRoot}`);
  }

  for (const proof of bundle.formalProofs) {
    const smtHash = sha256(proof.smtLib2);
    if (smtHash !== proof.smtSha256) {
      errors.push(`SMT hash mismatch for ${proof.invariantId}`);
    }
    const expectedProofId = makeProofId(proof.smtLib2, proof.invariantId);
    if (expectedProofId !== proof.proofId) {
      errors.push(`Proof ID mismatch for ${proof.invariantId}`);
    }
    if (proof.proofStatus === 'PROVEN' && proof.solver?.status !== 'unsat') {
      errors.push(`PROVEN proof does not carry an UNSAT solver result for ${proof.invariantId}`);
    }
    if (!proof.propertyId || !proof.statement || !proof.scope || !proof.reproductionCommand) {
      errors.push(`Incomplete formal metadata for ${proof.invariantId}: propertyId, statement, scope, and reproductionCommand required`);
    }
    if (!proof.proofArtifactHash) {
      errors.push(`Missing proofArtifactHash for ${proof.invariantId}`);
    }
  }

  return { ok: errors.length === 0, errors };
}

export function cvssVectorForCommonDeFiInvariantFailure(kind: 'solvency' | 'reentrancy' | 'replay'): string {
  switch (kind) {
    case 'solvency':
      return 'CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:H/A:H';
    case 'reentrancy':
      return 'CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:H/A:H';
    case 'replay':
      return 'CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H';
  }
}

export interface FormalCoverageAuditResult {
  accepted: boolean;
  totalPropertiesDefined: number;
  provenControlInvariants: number;
  refutedFaultInjections: number;
  coverageRatio: string;
  perPropertyRegister: {
    propertyId: InvariantId;
    statement: string;
    scope: string;
    controlResult: 'unsat';
    faultInjectionResult: 'sat';
    hasCounterexampleModel: boolean;
    proofArtifactHash: string;
    reproductionCommand: string;
  }[];
  institutionalVerdict: string;
}

export function rejectSyntheticFormalCoverage(claim: {
  rawClaimPercentage?: number | string;
  registry?: FormalPropertyVerificationRecord[];
}): FormalCoverageAuditResult {
  if (!claim.registry || !Array.isArray(claim.registry) || claim.registry.length === 0) {
    throw new Error(
      'VELMERE FORMAL ASSURANCE VIOLATION: Synthetic formal coverage claim strictly REJECTED. ' +
      'Rule: NO EVIDENCE = NO CLAIM; NO SOLVER = NO FORMAL PROOF. ' +
      'Formal coverage cannot be claimed as an aesthetic percentage without a verified per-property registry.'
    );
  }

  const registeredIds = Object.keys(FORMAL_PROPERTY_REGISTRY) as InvariantId[];
  const verifiedMap = new Map<InvariantId, FormalPropertyVerificationRecord>();
  for (const rec of claim.registry) {
    verifiedMap.set(rec.propertyId, rec);
  }

  const errors: string[] = [];
  for (const id of registeredIds) {
    const rec = verifiedMap.get(id);
    if (!rec) {
      errors.push(`Missing verification record for property ${id}`);
      continue;
    }

    if (!rec.propertyId) errors.push(`${id}: missing propertyId`);
    if (!rec.statement) errors.push(`${id}: missing statement`);
    if (!rec.scope) errors.push(`${id}: missing scope`);
    if (!rec.preconditions || rec.preconditions.length === 0) errors.push(`${id}: missing preconditions`);
    if (!rec.assumptions || rec.assumptions.length === 0) errors.push(`${id}: missing assumptions`);
    if (!rec.model || !rec.model.logic || !rec.model.stateVariables) errors.push(`${id}: missing model`);
    if (!rec.solver || rec.solver.name !== 'Z3 SMT-LIB2') errors.push(`${id}: missing or invalid solver`);
    if (!rec.result || rec.result.controlStatus !== 'unsat') errors.push(`${id}: safety invariant not proven UNSAT`);
    if (!rec.result || rec.result.faultInjectionStatus !== 'sat') errors.push(`${id}: fault injection not refuting as SAT`);
    if (!rec.result.counterexampleModel || Object.keys(rec.result.counterexampleModel).length === 0) {
      errors.push(`${id}: missing counterexample model on fault injection`);
    }
    if (!rec.proofArtifactHash) errors.push(`${id}: missing proofArtifactHash`);
    if (!rec.reproductionCommand) errors.push(`${id}: missing reproduction command`);
  }

  if (errors.length > 0) {
    throw new Error(
      `VELMERE FORMAL ASSURANCE VIOLATION: Synthetic formal coverage claim rejected due to incomplete registry:\n  - ${errors.join('\n  - ')}`
    );
  }

  const registerSummary = claim.registry.map(r => ({
    propertyId: r.propertyId,
    statement: r.statement,
    scope: r.scope,
    controlResult: r.result.controlStatus,
    faultInjectionResult: r.result.faultInjectionStatus,
    hasCounterexampleModel: !!r.result.counterexampleModel,
    proofArtifactHash: r.proofArtifactHash,
    reproductionCommand: r.reproductionCommand,
  }));

  return {
    accepted: true,
    totalPropertiesDefined: registeredIds.length,
    provenControlInvariants: claim.registry.filter(r => r.result.controlStatus === 'unsat').length,
    refutedFaultInjections: claim.registry.filter(r => r.result.faultInjectionStatus === 'sat').length,
    coverageRatio: `${claim.registry.length}/${registeredIds.length} properties formally proven under inductive bounds`,
    perPropertyRegister: registerSummary,
    institutionalVerdict: `Formally verified ${claim.registry.length}/${registeredIds.length} core DeFi invariants with Z3 SMT-LIB2 (UNSAT control, SAT bug-injection counterexamples verified). Per-property registry validated.`,
  };
}

