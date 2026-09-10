import crypto from "node:crypto";
import {
  analyzeSolidityCompilerOutputAst,
  LEGACY_UNCHECKED_MULTIPLICATION_ECONOMIC_SINK_RULE_ID,
} from "./solidity-compiler-ast-runtime.mjs";

export const LEGACY_COMPILER_EVALUATION_SCHEMA = "velmere.pass36.r44p43.legacy-compiler-evaluation.v1";
export const LEGACY_COMPILER_PROFILE = "EXACT_SOLC_JS_STANDARD_JSON_COMPACT_AST";

const SOURCE_PATH = /^(?!\/)(?!.*(?:^|\/)\.\.(?:\/|$))[A-Za-z0-9_.@+\-/]{1,260}$/u;

function stable(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stable(value[key])}`).join(",")}}`;
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function normalizeSources(sourceFiles) {
  if (!Array.isArray(sourceFiles) || sourceFiles.length === 0) throw new Error("legacy_source_bundle_required");
  const seen = new Set();
  const rows = sourceFiles.map((row, index) => {
    const sourcePath = String(row?.path ?? "").replace(/^\.\//u, "");
    if (!SOURCE_PATH.test(sourcePath) || sourcePath.includes("\\") || sourcePath.includes("//")) throw new Error(`legacy_source_path_invalid:${index}`);
    if (seen.has(sourcePath)) throw new Error(`legacy_source_path_duplicate:${sourcePath}`);
    seen.add(sourcePath);
    const content = String(row?.content ?? "").replace(/\r\n?/gu, "\n");
    if (!content) throw new Error(`legacy_source_empty:${sourcePath}`);
    return { path: sourcePath, content, byteLength: Buffer.byteLength(content), sha256: sha256(content) };
  }).sort((left, right) => Buffer.from(left.path).compare(Buffer.from(right.path)));
  return {
    rows,
    sourceBundleSha256: sha256(stable(rows.map(({ path, content }) => ({ path, content })))),
    sourceBytes: rows.reduce((sum, row) => sum + row.byteLength, 0),
  };
}

export function buildLegacyCompilerInput(sourceFiles) {
  const normalized = normalizeSources(sourceFiles);
  return {
    normalized,
    input: {
      language: "Solidity",
      sources: Object.fromEntries(normalized.rows.map((row) => [row.path, { content: row.content }])),
      settings: {
        optimizer: { enabled: false, runs: 200 },
        outputSelection: {
          "*": {
            "": ["ast"],
            "*": ["abi", "evm.bytecode.object", "evm.deployedBytecode.object"],
          },
        },
      },
    },
  };
}

export function compileLegacyStandardJson({ solc, sourceFiles, expectedVersion }) {
  if (!solc || typeof solc.version !== "function") throw new Error("legacy_solc_adapter_invalid");
  const compilerVersion = String(solc.version());
  const expectedPrefix = `${String(expectedVersion)}+commit.`;
  if (!compilerVersion.startsWith(expectedPrefix)) throw new Error(`legacy_solc_version_mismatch:${compilerVersion}:${expectedPrefix}`);
  const { normalized, input } = buildLegacyCompilerInput(sourceFiles);
  const inputJson = JSON.stringify(input);
  let outputRaw;
  let api;
  if (typeof solc.compileStandardWrapper === "function") {
    api = "compileStandardWrapper";
    outputRaw = solc.compileStandardWrapper(inputJson);
  } else if (typeof solc.compileStandard === "function") {
    api = "compileStandard";
    outputRaw = solc.compileStandard(inputJson);
  } else if (typeof solc.compile === "function") {
    api = "compile";
    outputRaw = solc.compile(inputJson);
  } else {
    return {
      status: "WITHHELD_STANDARD_JSON_UNAVAILABLE",
      compilerVersion,
      expectedVersion: String(expectedVersion),
      api: "UNAVAILABLE",
      normalized,
      inputSha256: sha256(inputJson),
      output: null,
      outputRaw: null,
      diagnostics: [],
      blockers: ["legacy_standard_json_api_unavailable"],
    };
  }
  let output;
  try {
    output = typeof outputRaw === "string" ? JSON.parse(outputRaw) : outputRaw;
  } catch {
    return {
      status: "WITHHELD_COMPILER_OUTPUT_NOT_JSON",
      compilerVersion,
      expectedVersion: String(expectedVersion),
      api,
      normalized,
      inputSha256: sha256(inputJson),
      output: null,
      outputRaw: String(outputRaw ?? ""),
      diagnostics: [],
      blockers: ["legacy_compiler_output_not_json"],
    };
  }
  const diagnostics = Array.isArray(output?.errors) ? output.errors.map((row) => ({
    severity: String(row?.severity ?? "unknown"),
    type: String(row?.type ?? "unknown"),
    message: String(row?.message ?? ""),
    formattedMessageSha256: sha256(String(row?.formattedMessage ?? row?.message ?? "")),
  })) : [];
  const compilerErrors = diagnostics.filter((row) => row.severity === "error");
  const astMissing = normalized.rows.filter((row) => !output?.sources?.[row.path]?.ast?.nodeType).map((row) => row.path);
  const status = compilerErrors.length
    ? "WITHHELD_COMPILATION_ERROR"
    : astMissing.length
      ? "WITHHELD_COMPACT_AST_UNAVAILABLE"
      : "EXECUTED";
  return {
    status,
    compilerVersion,
    expectedVersion: String(expectedVersion),
    api,
    normalized,
    inputSha256: sha256(inputJson),
    output,
    outputRaw: String(outputRaw ?? ""),
    outputSha256: sha256(String(outputRaw ?? "")),
    diagnostics,
    blockers: [
      ...compilerErrors.map((row) => `solc_error:${row.type}`),
      ...astMissing.map((sourcePath) => `compact_ast_unavailable:${sourcePath}`),
    ].sort(),
  };
}

export function evaluateLegacyCompilerCase({
  solc,
  sourceFiles,
  expectedVersion,
  caseId,
  category,
  expectedRuleIds = [],
  observedAt = "2026-08-10T00:00:00.000Z",
}) {
  const compiled = compileLegacyStandardJson({ solc, sourceFiles, expectedVersion });
  const supportedCategory = Array.isArray(expectedRuleIds) && expectedRuleIds.length > 0;
  let astEvidence = null;
  if (compiled.status === "EXECUTED") {
    astEvidence = analyzeSolidityCompilerOutputAst({
      compilerOutput: compiled.output,
      sourceFiles,
      compilerVersion: compiled.compilerVersion,
      expectedCompilerVersionPrefix: `${String(expectedVersion)}+commit.`,
      observedAt,
      profile: LEGACY_COMPILER_PROFILE,
    });
  }
  const observedRuleIds = [...new Set((astEvidence?.findings ?? []).map((row) => String(row.ruleId)))].sort();
  const matchedRuleIds = expectedRuleIds.filter((ruleId) => observedRuleIds.includes(ruleId)).sort();
  const legacyMultiplicationEvaluation = astEvidence?.ruleEvaluations?.find((row) => row.ruleId === LEGACY_UNCHECKED_MULTIPLICATION_ECONOMIC_SINK_RULE_ID) ?? null;
  const expectsLegacyMultiplication = expectedRuleIds.includes(LEGACY_UNCHECKED_MULTIPLICATION_ECONOMIC_SINK_RULE_ID);
  let resultStatus;
  if (!supportedCategory) resultStatus = "UNSUPPORTED_DETECTOR_FAMILY";
  else if (compiled.status !== "EXECUTED") resultStatus = compiled.status;
  else if (expectsLegacyMultiplication && legacyMultiplicationEvaluation?.status === "NOT_APPLICABLE_SOLC_0_8_OR_LATER") resultStatus = "NOT_APPLICABLE_MODERN_COMPILER";
  else if (expectsLegacyMultiplication && legacyMultiplicationEvaluation?.status !== "EVALUATED_LEGACY_COMPILER") resultStatus = "WITHHELD_LEGACY_MULTIPLICATION_RULE_NOT_EVALUATED";
  else resultStatus = matchedRuleIds.length > 0 ? "SUPPORTED_SIGNAL_DETECTED" : "SUPPORTED_SIGNAL_MISSED";
  const core = {
    schemaVersion: LEGACY_COMPILER_EVALUATION_SCHEMA,
    profile: LEGACY_COMPILER_PROFILE,
    caseId: String(caseId),
    category: String(category),
    expectedVersion: String(expectedVersion),
    compilerVersion: compiled.compilerVersion,
    compilerApi: compiled.api,
    resultStatus,
    supportedCategory,
    expectedRuleIds: [...expectedRuleIds].sort(),
    observedRuleIds,
    matchedRuleIds,
    legacyMultiplicationEvaluation,
    inputIdentity: {
      sourceFiles: compiled.normalized.rows.length,
      sourceBytes: compiled.normalized.sourceBytes,
      sourceBundleSha256: compiled.normalized.sourceBundleSha256,
      standardJsonInputSha256: compiled.inputSha256,
    },
    compilation: {
      status: compiled.status,
      outputSha256: compiled.outputSha256 ?? null,
      diagnosticCount: compiled.diagnostics.length,
      blockers: compiled.blockers,
    },
    findingCount: astEvidence?.findings?.length ?? 0,
    findings: astEvidence?.findings ?? [],
    compilerOutputAstEvidenceSha256: astEvidence?.evidenceSha256 ?? null,
    creditBoundary: {
      publicPinnedCorpusCredit: true,
      legacyCompilerAstCredit: compiled.status === "EXECUTED",
      supportedCategoryRecallEligible: supportedCategory && compiled.status === "EXECUTED",
      legacyUncheckedMultiplicationEconomicSinkEvaluationCredit: legacyMultiplicationEvaluation?.status === "EVALUATED_LEGACY_COMPILER",
      broadArithmeticCoverageCredit: false,
      independentGroundTruthCredit: false,
      formalPrecisionCredit: false,
      formalFalsePositiveRateCredit: false,
      severityAccuracyCredit: false,
      realProtocolCredit: false,
      customerCredit: false,
      saleCredit: false,
      liveCredit: false,
      worldClassCredit: false,
    },
    limitations: [
      "The label is public corpus metadata, not a sealed two-reviewer adjudication created for this execution.",
      "Cases without an exact available compiler or compact AST are withheld and do not become safe results.",
      "A matched bounded signal is not exploitability, reachability or severity proof.",
      "The legacy multiplication family covers only exact pre-0.8 compiler AST, unsigned external-parameter taint and enumerated economic sinks; broad arithmetic coverage is not claimed.",
    ],
  };
  return { ...core, evidenceSha256: sha256(stable(core)) };
}

export function verifyLegacyCompilerCase(value) {
  return Boolean(value
    && value.schemaVersion === LEGACY_COMPILER_EVALUATION_SCHEMA
    && typeof value.caseId === "string"
    && typeof value.compilerVersion === "string"
    && Array.isArray(value.observedRuleIds)
    && Array.isArray(value.matchedRuleIds)
    && (value.legacyMultiplicationEvaluation === null || value.legacyMultiplicationEvaluation?.broadArithmeticCoverageCredit === false)
    && value.creditBoundary?.broadArithmeticCoverageCredit === false
    && value.creditBoundary?.independentGroundTruthCredit === false
    && value.creditBoundary?.formalPrecisionCredit === false
    && value.creditBoundary?.formalFalsePositiveRateCredit === false
    && value.creditBoundary?.saleCredit === false
    && value.creditBoundary?.liveCredit === false
    && /^[a-f0-9]{64}$/u.test(String(value.evidenceSha256 ?? "")));
}
