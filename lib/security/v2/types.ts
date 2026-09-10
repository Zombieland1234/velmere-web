/**
 * Velmère Security Engine V2 — Core Type Definitions
 *
 * Implements comprehensive data structures for AST, CFG, Taint Analysis,
 * Storage Dependencies, Invariants, Fuzzing, DeFi Economic Attacks,
 * Multi-dimensional Scoring, and Cryptographic Evidence Snapshots.
 */

export type SeverityLevel = "critical" | "high" | "medium" | "low" | "informational";
export type ConfidenceLevel = "certain" | "high" | "medium" | "low";
export type ExploitabilityLevel = "active_exploit" | "high" | "moderate" | "theoretical" | "none";

export type VerificationState =
  | "AUTOMATED"
  | "SIMULATED"
  | "FUZZ_VERIFIED"
  | "FORMALLY_VERIFIED"
  | "HUMAN_REVIEWED";

export interface EvmInstruction {
  pc: number;
  opcode: number;
  name: string;
  size: number;
  pushBytes?: number;
  pushValueHex?: string;
  pushValueBigInt?: bigint;
}

export interface BasicBlock {
  id: string;
  startPc: number;
  endPc: number;
  instructions: EvmInstruction[];
  predecessors: string[];
  successors: string[];
  terminalOpcode: string;
  hasCall: boolean;
  hasSstore: boolean;
  hasSload: boolean;
  hasDelegatecall: boolean;
  hasSelfdestruct: boolean;
  readsStorageSlots: Set<string>;
  writesStorageSlots: Set<string>;
  isReentrancyGuarded: boolean;
}

export interface ControlFlowGraph {
  blocks: Map<string, BasicBlock>;
  entryBlockId: string;
  totalInstructions: number;
  cyclomaticComplexity: number;
  unresolvedDynamicJumps: number;
}

export interface TaintSource {
  kind: "CALLDATA" | "CALLER" | "ORIGIN" | "EXTCODESIZE" | "RETURNDATA";
  instructionPc: number;
  label: string;
}

export interface TaintSink {
  kind: "SSTORE" | "SELFDESTRUCT" | "DELEGATECALL" | "CALL_VALUE" | "JUMP";
  instructionPc: number;
  taintedBy: TaintSource[];
}

export interface PrivilegeRole {
  roleId: string;
  name: string;
  adminRoleId?: string;
  members: string[];
  capabilities: string[];
}

export interface PrivilegeGraph {
  roles: Map<string, PrivilegeRole>;
  escalationPaths: Array<{
    fromRole: string;
    toRole: string;
    vector: string;
    exploitable: boolean;
  }>;
  hasRenounceHazard: boolean;
  hasDefaultAdminCentralization: boolean;
}

export interface OracleDependency {
  consumerFunction: string;
  oracleKind: "CHAINLINK" | "UNISWAP_V2_SPOT" | "UNISWAP_V3_TWAP" | "PYTH" | "CUSTOM";
  feedAddress?: string;
  hasStalenessCheck: boolean;
  hasHeartbeatCheck: boolean;
  hasRoundCheck: boolean;
  hasL2SequencerCheck: boolean;
  decimalPrecision: number;
  manipulationWindowSeconds: number;
  riskRating: SeverityLevel;
}

export interface DefiEconomicAttackSimulation {
  attackType:
    | "ERC4626_VAULT_INFLATION"
    | "FLASHLOAN_SPOT_MANIPULATION"
    | "SANDWICH_MEV_DRAIN"
    | "DONATION_ATTACK"
    | "REWARD_DISTORTION";
  classification: "SIMULATION / ESTIMATE / ASSUMPTIONS";
  targetContract: string;
  capitalRequiredUsd: number;
  estimatedProfitUsd: number;
  maximumLossUsd: number;
  priceImpactPercent: number;
  gasCostEstimatedGwei: number;
  attackSequence: Array<{
    step: number;
    action: string;
    caller: string;
    callTarget: string;
    valueEth: string;
    params: Record<string, unknown>;
  }>;
  requiredAssumptions: string[];
}

export interface InvariantDefinition {
  id: string;
  name: string;
  description: string;
  formalExpression: string;
  category:
    | "SUPPLY_CONSERVATION"
    | "SOLVENCY"
    | "BALANCE_MONOTONICITY"
    | "NO_UNAUTHORIZED_MINT"
    | "NO_UNAUTHORIZED_BURN"
    | "PAUSE_CONFINEMENT"
    | "REENTRANCY_ISOLATION";
  passed: boolean;
  counterexample?: {
    sequenceLength: number;
    trace: Array<{ step: number; action: string; caller: string; amount: string }>;
    violationEvidence: string;
  };
}

export interface FuzzCampaignResult {
  engine: "Velmère-PropertyFuzzer-V2";
  iterationsExecuted: number;
  uniqueSequencesExplored: number;
  invariantsChecked: number;
  invariantsViolated: number;
  fuzzSeed: string;
  durationMs: number;
  failures: Array<{
    invariantId: string;
    minimalReproductionSequence: string[];
    evidence: string;
  }>;
}

export interface FormalAssuranceResult {
  propertyId: string;
  specification: string;
  proven: boolean;
  status: "FORMALLY_VERIFIED" | "COUNTEREXAMPLE_FOUND" | "BOUND_EXCEEDED";
  solver: "Bounded-EVM-SMT-Checker";
  statement: string;
}

export interface StandardFindingV2 {
  findingId: string;
  title: string;
  severity: SeverityLevel;
  confidence: ConfidenceLevel;
  exploitability: ExploitabilityLevel;
  impact: string;
  likelihood: string;
  taxonomy: {
    swcId?: string;
    cweId: string;
    eeaSvsLevel?: "S" | "M" | "Q";
    owaspScsvsCategory?: string;
  };
  affectedContract: string;
  affectedFunction: string;
  sourceLocation?: {
    file: string;
    lineStart: number;
    lineEnd: number;
  };
  bytecodeOffset?: {
    pcStart: number;
    pcEnd: number;
  };
  executionPath: string[];
  stateDependencies: {
    storageSlotsRead: string[];
    storageSlotsWritten: string[];
  };
  attackScenario: string;
  proofOfConcept: {
    summary: string;
    sequence: Array<{ step: number; actor: string; call: string; expectation: string }>;
    rawPoCSolidity?: string;
  };
  evidence: {
    opcodeTraceExcerpt: string;
    disassemblyContext: string;
    hashProof: string;
  };
  remediation: {
    strategy: string;
    solidityPatchDiff: string;
    appliedSuccessfully?: boolean;
    regressionPassed?: boolean;
  };
  verificationState: VerificationState;
}

export interface MultiDimensionalScoreV2 {
  securityRisk: number; // 0 (safest) to 100 (highest risk)
  centralizationRisk: number;
  upgradeRisk: number;
  oracleRisk: number;
  economicRisk: number;
  codeQualityRisk: number;
  operationalRisk: number;
  overallScore: number;
  assessmentConfidence: number; // 0 to 100%
}

export interface AuditSnapshotId {
  snapshotDigest: string; // SHA-256 over all constituent hashes
  contractAddress: string;
  chainId: string;
  blockNumber: number;
  bytecodeSha256: string;
  sourceCodeSha256?: string;
  compilerVersion?: string;
  engineVersion: "Velmère-V2.4.0";
  timestamp: string;
}

export interface FullAuditResultV2 {
  snapshot: AuditSnapshotId;
  contractProfile: {
    name: string;
    symbol?: string;
    isProxy: boolean;
    proxyType?: "ERC1967_TRANSPARENT" | "UUPS" | "BEACON" | "DIAMOND" | "MINIMAL" | "NONE";
    implementationAddress?: string;
    standardConformance: {
      erc20: boolean;
      eip2612: boolean;
      erc4626: boolean;
      erc721: boolean;
      erc1155: boolean;
      nonStandardQuirks: string[];
    };
  };
  scores: MultiDimensionalScoreV2;
  findings: StandardFindingV2[];
  cfgMetrics: {
    blockCount: number;
    instructionCount: number;
    cyclomaticComplexity: number;
  };
  economicSimulations: DefiEconomicAttackSimulation[];
  fuzzResults: FuzzCampaignResult;
  invariants: InvariantDefinition[];
  formalAssurance: FormalAssuranceResult[];
  patchValidation: {
    totalPatchesTested: number;
    patchesPassingRegression: number;
  };
  auditTier: "BASIC" | "PRO" | "ADVANCED";
  timings: {
    disassemblyMs: number;
    cfgMs: number;
    dataflowMs: number;
    detectorsMs: number;
    fuzzingMs: number;
    simulationMs: number;
    pdfMs: number;
    totalExecutionMs: number;
  };
}
