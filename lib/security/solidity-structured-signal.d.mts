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

export function analyzeSolidityStructuredSignals(source: string): SolidityStructuredSignalResult;
