export const ANALYZER_CLASS: "STRUCTURED_TOKEN_CONTROL_FLOW_V3_STATE_AWARE_NOT_COMPILER_AST";

export type StructuredSignalFinding = {
  id: string;
  category?: string;
  line?: number;
  interactionKind?: string;
  effectKind?: string;
  modifier?: string;
};

export type SolidityStructuredSignalResult = {
  analyzerClass: typeof ANALYZER_CLASS;
  signals: string[];
  findings: StructuredSignalFinding[];
  compilerAstCredit: false;
  limitations: string[];
};

export type ReentrancyGuardCoverageRow = {
  contractName: string;
  functionName: string;
  line: number;
  guarded: boolean;
  interactionKind: string;
  effectKind: string;
};

export type ReentrancyGuardCoverage = {
  analyzerClass: typeof ANALYZER_CLASS;
  supportedPaths: number;
  guardedPaths: number;
  unguardedPaths: number;
  allSupportedPathsGuarded: boolean;
  rows: ReentrancyGuardCoverageRow[];
  limitations: string[];
};

export function stripCommentsAndStrings(source: string): string;
export function analyzeReentrancyGuardCoverage(source: string): ReentrancyGuardCoverage;
export function analyzeSolidityStructuredSignals(source: string): SolidityStructuredSignalResult;
