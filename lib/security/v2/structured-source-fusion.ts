import type { StandardFindingV2, SeverityLevel, ConfidenceLevel } from "./types";
import { evidenceSha256 } from "./evidence-integrity";
import { analyzeSolidityStructuredSignals } from "../solidity-structured-signal.mjs";
import { STRUCTURED_SIGNAL_CATALOG } from "../solidity-structured-finding-catalog";

type StructuredFinding = ReturnType<typeof analyzeSolidityStructuredSignals>["findings"][number];

function severity(value: string): SeverityLevel {
  return value === "critical" || value === "high" || value === "medium" || value === "low"
    ? value
    : "informational";
}

function boundedConfidence(value: number): ConfidenceLevel {
  // This lane is explicitly heuristic and has no compiler-AST/path-feasibility
  // proof, so it must never self-promote to certain/high confidence.
  return value >= 75 ? "medium" : "low";
}

function taxonomyFor(category?: string): StandardFindingV2["taxonomy"] {
  switch (category) {
    case "reentrancy": return { cweId: "CWE-841", swcId: "SWC-107" };
    case "access_control": return { cweId: "CWE-284" };
    case "unchecked_low_level_calls": return { cweId: "CWE-252", swcId: "SWC-104" };
    case "arithmetic": return { cweId: "CWE-682" };
    case "front_running": return { cweId: "CWE-362" };
    case "denial_of_service": return { cweId: "CWE-400" };
    case "bad_randomness": return { cweId: "CWE-330", swcId: "SWC-120" };
    default: return { cweId: "CWE-682" };
  }
}

function findingId(signal: StructuredFinding): string {
  const normalized = signal.id.toUpperCase().replace(/[^A-Z0-9]+/g, "-");
  const aliases: Record<string, string> = {
    "TX-ORIGIN-AUTH": "TXORIGIN-AUTH",
    "UNGUARDED-INITIALIZE": "UNINITIALIZED-INITIALIZER",
  };
  return `VLM-SEC-STRUCTURED-${aliases[normalized] ?? normalized}`;
}

export function fuseStructuredSourceCandidates(
  contractAddress: string,
  sourceCode?: string,
): StandardFindingV2[] {
  if (!sourceCode?.trim()) return [];
  const analysis = analyzeSolidityStructuredSignals(sourceCode);
  const rows: StandardFindingV2[] = [];

  for (const signal of analysis.findings) {
    const definition = STRUCTURED_SIGNAL_CATALOG[signal.id];
    if (!definition || definition.state !== "finding") continue;
    const line = Number.isInteger(signal.line) && Number(signal.line) > 0 ? Number(signal.line) : 1;
    const evidencePayload = {
      analyzerClass: analysis.analyzerClass,
      signal,
      sourceSha256: evidenceSha256(sourceCode),
    };
    rows.push({
      findingId: findingId(signal),
      claimState: "HEURISTIC_CANDIDATE",
      analysisMethod: "STRUCTURED_SOURCE_HEURISTIC",
      limitations: [...analysis.limitations],
      title: `Heuristic candidate: ${definition.title}`,
      severity: severity(definition.severity),
      confidence: boundedConfidence(definition.confidence),
      exploitability: "theoretical",
      impact: `${definition.description} This is a review candidate, not a confirmed exploitable vulnerability.`,
      likelihood: "unverified",
      taxonomy: taxonomyFor(signal.category),
      affectedContract: contractAddress,
      affectedFunction: `source line ${line}`,
      sourceLocation: { file: "<submitted-source>", lineStart: line, lineEnd: line },
      executionPath: [analysis.analyzerClass, signal.id, `line:${line}`],
      stateDependencies: { storageSlotsRead: [], storageSlotsWritten: [] },
      attackScenario: "UNEXECUTED hypothesis. Correlate this source signal with compiler AST/IR, bytecode reachability and an adversarial test before treating it as exploitable.",
      proofOfConcept: {
        summary: "No exploit was executed. This candidate preserves a structured-source signal for downstream review.",
        sequence: [{ step: 1, actor: "Reviewer", call: `validate(${signal.id})`, expectation: "Confirm or reject with independent execution evidence" }],
      },
      evidence: {
        opcodeTraceExcerpt: "No opcode claim: structured source lane only",
        disassemblyContext: `${analysis.analyzerClass}; compilerAstCredit=false`,
        hashProof: evidenceSha256(JSON.stringify(evidencePayload)),
      },
      remediation: {
        strategy: definition.remediation,
        solidityPatchDiff: "",
        appliedSuccessfully: false,
        regressionPassed: false,
      },
      verificationState: "AUTOMATED",
    });
  }

  const unique = new Map<string, StandardFindingV2>();
  for (const row of rows) if (!unique.has(row.findingId)) unique.set(row.findingId, row);
  return [...unique.values()].sort((a, b) => a.findingId.localeCompare(b.findingId));
}
