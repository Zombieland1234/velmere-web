import { createHash } from "node:crypto";
import { analyzeSolidityStructuredSignals } from "./solidity-structured-signal.mjs";
import type { SolidityCompilerAstEvidence } from "./solidity-compiler-ast-runtime.mjs";
import { buildAuditCompilerAstReviewLayer } from "./audit-compiler-ast-review-layer.mjs";
import type { AuditCompilerDeploymentBinding, AuditEip1967ProxyBinding } from "./audit-compiler-deployment-binding.mjs";
import { STRUCTURED_SIGNAL_CATALOG } from "./solidity-structured-finding-catalog.ts";
import { detectP78Erc2771MulticallContext } from "./erc2771-multicall-context-detector.ts";

export const PASS35_AUDIT_A01_A05_ENGINE_ID = "pass35-audit-a01-a05-engine" as const;

export type Pass35AuditSeverity = "critical" | "high" | "medium" | "low" | "informational";
export type Pass35AuditFindingState = "finding" | "observation" | "blocked";
export type Pass35AuditControlState =
  | "VERIFIED_LOCAL_STRUCTURE"
  | "VERIFIED_EXACT_BYTECODE"
  | "VERIFIED_METADATA_STRIPPED_BYTECODE"
  | "EXECUTED_LOCAL_HEURISTIC_NOT_BENCHMARKED"
  | "GENERATED_LOCAL_HEURISTIC_NOT_REVIEWED"
  | "BLOCKED_MISSING_OR_INVALID_INPUT";

export type Pass35AuditSourceFile = {
  path: string;
  content: string;
};

export type Pass35AuditAbiItem = {
  type?: string;
  name?: string;
  stateMutability?: string;
  inputs?: Array<{ name?: string; type?: string; components?: unknown[] }>;
  outputs?: Array<{ name?: string; type?: string; components?: unknown[] }>;
  anonymous?: boolean;
};

export type Pass35AuditA01A05Input = {
  schemaVersion: "velmere.pass35.audit-a01-a05-input.v1";
  inputClass: "SYNTHETIC_OFFLINE" | "CUSTOMER_SUPPLIED_UNVERIFIED" | "CUSTOMER_SUPPLIED_VERIFIED";
  caseRef: string;
  observedAt: string;
  chainId: string;
  chainName: string;
  contractAddress: string;
  projectName?: string;
  sourceFiles: Pass35AuditSourceFile[];
  abi: Pass35AuditAbiItem[] | { abi: Pass35AuditAbiItem[] };
  sourceProvenance: {
    provider: string;
    sourceReference: string;
    verifiedSource: boolean;
    observedAt: string;
    responseSha256: string;
  };
  compiler: {
    family: "solc" | "vyper" | "unknown";
    version: string;
    optimizerEnabled: boolean | null;
    optimizerRuns: number | null;
    evmVersion: string | null;
    viaIR: boolean | null;
    settings: Record<string, unknown>;
  };
  compiledRuntimeBytecode?: string | null;
  deployedRuntimeBytecode?: string | null;
  compilerAstEvidence?: SolidityCompilerAstEvidence | null;
  compilerDeploymentBinding?: AuditCompilerDeploymentBinding | null;
  compilerProxyBinding?: AuditEip1967ProxyBinding | null;
};

export type Pass35AuditEvidenceLocation = {
  lane: "source" | "abi" | "bytecode" | "compiler" | "provenance";
  reference: string;
  line?: number;
  pc?: number;
  excerptSha256: string;
};

export type Pass35AuditFinding = {
  findingId: string;
  familyId: "source_semantic_family" | "abi_bytecode_family" | "identity" | "reproducibility" | "threat_model" | "privilege_map";
  controls: Array<"A01" | "A02" | "A03" | "A04" | "A05">;
  state: Pass35AuditFindingState;
  severity: Pass35AuditSeverity;
  confidence: number;
  confidenceState?: "NOT_CALIBRATED" | "HEURISTIC_NON_PROBABILISTIC";
  title: string;
  description: string;
  evidence: Pass35AuditEvidenceLocation[];
  safeRemediation: string;
  limitations: string[];
};

export type Pass35AuditStaticFamilyReceipt = {
  familyId: "source_semantic_family" | "abi_bytecode_family";
  assuranceClass: "LOCAL_HEURISTIC_NOT_BENCHMARKED" | "LOCAL_COMPILER_AST_BOUNDED_BENCHMARKED";
  inputSha256: string;
  configurationSha256: string;
  rawOutputSha256: string;
  executedAt: string;
  status: "EXECUTED" | "BLOCKED";
  findingCount: number;
  severityCounts: Record<Pass35AuditSeverity, number>;
  paidGateEligible: false;
  independentExternalFamily: false;
  limitations: string[];
};

export type Pass35AuditA01A05Report = {
  schemaVersion: "velmere.pass35.audit-a01-a05-report.v1";
  engineId: typeof PASS35_AUDIT_A01_A05_ENGINE_ID;
  caseRef: string;
  inputClass: Pass35AuditA01A05Input["inputClass"];
  observedAt: string;
  target: {
    chainId: string;
    chainName: string;
    contractAddress: string;
    projectName: string | null;
  };
  inputIdentity: {
    sourceBundleSha256: string | null;
    abiSha256: string | null;
    compilerConfigurationSha256: string | null;
    compiledRuntimeBytecodeSha256: string | null;
    deployedRuntimeBytecodeSha256: string | null;
    provenanceResponseSha256: string | null;
    compilerAstEvidenceSha256?: string | null;
    compilerDeploymentBindingSha256?: string | null;
    compilerProxyBindingSha256?: string | null;
  };
  controls: Record<"A01" | "A02" | "A03" | "A04" | "A05", {
    state: Pass35AuditControlState;
    passEligible: boolean;
    blockers: string[];
    truthBoundary: string;
  }>;
  bytecodeComparison: {
    status: "EXACT_MATCH" | "MATCH_AFTER_SOLIDITY_METADATA_STRIP" | "MISMATCH" | "BLOCKED";
    compiledCoreSha256: string | null;
    deployedCoreSha256: string | null;
    compiledMetadataBytes: number | null;
    deployedMetadataBytes: number | null;
    firstMismatchByte: number | null;
    truthBoundary: string;
  };
  threatModel: {
    components: string[];
    trustBoundaries: string[];
    assets: string[];
    privilegedActors: string[];
    externalDependencies: string[];
    assumptions: string[];
    missingEvidence: string[];
  };
  privilegeMap: Array<{
    surface: string;
    evidenceLane: "source" | "abi";
    category: "owner" | "role" | "upgrade" | "mint" | "pause" | "denylist" | "fee" | "rescue" | "unknown";
    mutability: string;
    accessEvidence: string;
    confidence: number;
  }>;
  staticFamilies: Pass35AuditStaticFamilyReceipt[];
  findings: Pass35AuditFinding[];
  summary: {
    findings: number;
    severityCounts: Record<Pass35AuditSeverity, number>;
    sourceFiles: number;
    abiFunctions: number;
    bytecodeOpcodes: number;
    paidDeliveryAllowed: false;
    fullAuditClaimAllowed: false;
    humanReviewed: false;
    independentAssurance: false;
    nextRequiredControls: string[];
  };
  reportSha256: string;
  truthBoundary: string;
};

const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;
const DIGEST = /^(?:sha256:)?[a-f0-9]{64}$/i;
const ADDRESS = /^0x[a-f0-9]{40}$/i;
const CASE_REF = /^AUD-[A-Z0-9-]{8,48}$/;
const SOURCE_PATH = /^(?!\/)(?!.*(?:^|\/)\.\.(?:\/|$))[A-Za-z0-9_.@+\-/]{1,240}$/;
const HEX_BYTECODE = /^0x(?:[a-f0-9]{2})+$/i;
const SOLC_VERSION = /^v?\d+\.\d+\.\d+(?:\+commit\.[a-f0-9]{8})?$/i;
const MAX_SOURCE_FILES = 256;
const MAX_SOURCE_BYTES = 4 * 1024 * 1024;
const ENGINE_CONFIG = {
  schemaVersion: "velmere.pass35.audit-a01-a05-engine-config.v1",
  sourceFamily: "source-semantic-structured-control-flow-v3-state-aware",
  abiBytecodeFamily: "abi-surface-and-push-aware-opcode-v1",
  metadataStrip: "solidity-cbor-length-suffix-strict-v1",
  noSelectorHashFallback: true,
  paidGateEligible: false,
};

function sha256(value: string | Buffer) {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function stable(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stable(record[key])}`).join(",")}}`;
}

function normalizeDigest(value: unknown): string | null {
  const text = String(value ?? "").trim().toLowerCase();
  if (!DIGEST.test(text)) return null;
  return text.startsWith("sha256:") ? text : `sha256:${text}`;
}

function normalizeSourcePath(value: unknown): string | null {
  const text = String(value ?? "").replaceAll("\\", "/").replace(/^\.\//, "");
  if (!SOURCE_PATH.test(text) || text.includes("//") || text.includes("\u0000")) return null;
  return text;
}

function normalizeLineEndings(value: unknown): string {
  return String(value ?? "").replace(/\r\n?/g, "\n");
}

function canonicalAbiType(item: { type?: string; components?: unknown[] }): string {
  const raw = String(item.type ?? "").trim();
  if (!raw.startsWith("tuple")) return raw || "unknown";
  const suffix = raw.slice("tuple".length);
  const components = Array.isArray(item.components) ? item.components : [];
  return `(${components.map((component) => canonicalAbiType((component ?? {}) as { type?: string; components?: unknown[] })).join(",")})${suffix}`;
}

function parseAbi(value: Pass35AuditA01A05Input["abi"]): { items: Pass35AuditAbiItem[]; canonical: string; blockers: string[] } {
  const blockers: string[] = [];
  const items = Array.isArray(value) ? value : Array.isArray(value?.abi) ? value.abi : [];
  if (!Array.isArray(items) || items.length === 0) blockers.push("a01_abi_missing_or_empty");
  const normalized = items.map((item) => ({
    type: String(item?.type ?? "").trim(),
    name: typeof item?.name === "string" ? item.name.trim() : undefined,
    stateMutability: typeof item?.stateMutability === "string" ? item.stateMutability.trim() : undefined,
    inputs: Array.isArray(item?.inputs) ? item.inputs.map((entry) => ({ name: String(entry?.name ?? ""), type: canonicalAbiType(entry ?? {}) })) : [],
    outputs: Array.isArray(item?.outputs) ? item.outputs.map((entry) => ({ name: String(entry?.name ?? ""), type: canonicalAbiType(entry ?? {}) })) : [],
    anonymous: item?.anonymous === true,
  })).sort((left, right) => stable(left).localeCompare(stable(right)));
  for (const [index, item] of normalized.entries()) {
    if (!item.type) blockers.push(`a01_abi_item_type_missing:${index}`);
    if (item.type === "function" && (!item.name || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(item.name))) blockers.push(`a01_abi_function_name_invalid:${index}`);
  }
  return { items, canonical: stable(normalized), blockers: [...new Set(blockers)].sort() };
}

function canonicalSourceBundle(sourceFiles: Pass35AuditSourceFile[]): {
  files: Array<{ path: string; content: string; sha256: string }>;
  canonical: string;
  blockers: string[];
} {
  const blockers: string[] = [];
  if (!Array.isArray(sourceFiles) || sourceFiles.length === 0) blockers.push("a01_source_bundle_empty");
  if (sourceFiles.length > MAX_SOURCE_FILES) blockers.push("a01_source_file_count_exceeded");
  const seen = new Set<string>();
  let totalBytes = 0;
  const files: Array<{ path: string; content: string; sha256: string }> = [];
  for (const [index, file] of (sourceFiles ?? []).entries()) {
    const sourcePath = normalizeSourcePath(file?.path);
    if (!sourcePath) {
      blockers.push(`a01_source_path_invalid:${index}`);
      continue;
    }
    if (seen.has(sourcePath)) blockers.push(`a01_source_path_duplicate:${sourcePath}`);
    seen.add(sourcePath);
    const content = normalizeLineEndings(file?.content);
    if (!content.trim()) blockers.push(`a01_source_empty:${sourcePath}`);
    totalBytes += Buffer.byteLength(content);
    files.push({ path: sourcePath, content, sha256: sha256(content) });
  }
  if (totalBytes > MAX_SOURCE_BYTES) blockers.push("a01_source_bytes_exceeded");
  files.sort((a, b) => a.path.localeCompare(b.path));
  const canonical = files.map((file) => `FILE:${file.path}\nSHA256:${file.sha256}\nBYTES:${Buffer.byteLength(file.content)}\n${file.content}`).join("\n---VELMERE-SOURCE-BOUNDARY---\n");
  return { files, canonical, blockers: [...new Set(blockers)].sort() };
}

function normalizeBytecode(value: unknown): string | null {
  const text = String(value ?? "").trim().toLowerCase();
  if (!HEX_BYTECODE.test(text) || text.length < 6) return null;
  return text;
}

function stripSolidityMetadata(bytecode: string | null): { core: string | null; metadataBytes: number | null; stripped: boolean } {
  if (!bytecode) return { core: null, metadataBytes: null, stripped: false };
  const hex = bytecode.slice(2);
  if (hex.length < 6) return { core: bytecode, metadataBytes: 0, stripped: false };
  const metadataBytes = Number.parseInt(hex.slice(-4), 16);
  const totalBytes = hex.length / 2;
  const startByte = totalBytes - metadataBytes - 2;
  if (!Number.isInteger(metadataBytes) || metadataBytes < 2 || startByte < 1) return { core: bytecode, metadataBytes: 0, stripped: false };
  const firstMetadataByte = Number.parseInt(hex.slice(startByte * 2, startByte * 2 + 2), 16);
  const cborMapLike = firstMetadataByte >= 0xa0 && firstMetadataByte <= 0xbf;
  if (!cborMapLike) return { core: bytecode, metadataBytes: 0, stripped: false };
  return { core: `0x${hex.slice(0, startByte * 2)}`, metadataBytes, stripped: true };
}

function firstMismatchByte(left: string | null, right: string | null): number | null {
  if (!left || !right) return null;
  const a = left.slice(2);
  const b = right.slice(2);
  const max = Math.min(a.length, b.length) / 2;
  for (let index = 0; index < max; index += 1) if (a.slice(index * 2, index * 2 + 2) !== b.slice(index * 2, index * 2 + 2)) return index;
  return a.length === b.length ? null : max;
}

function stripCommentsAndStringsPreserveLines(source: string): string {
  let output = "";
  let state: "code" | "line" | "block" | "single" | "double" = "code";
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    const next = source[index + 1];
    if (state === "code") {
      if (char === "/" && next === "/") { output += "  "; state = "line"; index += 1; continue; }
      if (char === "/" && next === "*") { output += "  "; state = "block"; index += 1; continue; }
      if (char === "'") { output += " "; state = "single"; continue; }
      if (char === '"') { output += " "; state = "double"; continue; }
      output += char;
      continue;
    }
    if (state === "line") {
      if (char === "\n") { output += "\n"; state = "code"; } else output += " ";
      continue;
    }
    if (state === "block") {
      if (char === "*" && next === "/") { output += "  "; state = "code"; index += 1; }
      else output += char === "\n" ? "\n" : " ";
      continue;
    }
    if (state === "single" || state === "double") {
      if (char === "\\") { output += " "; if (next) { output += next === "\n" ? "\n" : " "; index += 1; } continue; }
      if ((state === "single" && char === "'") || (state === "double" && char === '"')) { output += " "; state = "code"; }
      else output += char === "\n" ? "\n" : " ";
    }
  }
  return output;
}

function lineForOffset(value: string, offset: number) {
  return value.slice(0, offset).split("\n").length;
}

function evidenceLocation(lane: Pass35AuditEvidenceLocation["lane"], reference: string, excerpt: string, line?: number, pc?: number): Pass35AuditEvidenceLocation {
  return { lane, reference, ...(line === undefined ? {} : { line }), ...(pc === undefined ? {} : { pc }), excerptSha256: sha256(excerpt) };
}

function findingId(family: string, reference: string, title: string) {
  return `A3-${createHash("sha256").update(`${family}|${reference}|${title}`).digest("hex").slice(0, 16).toUpperCase()}`;
}

function makeFinding(input: Omit<Pass35AuditFinding, "findingId"> & { referenceSeed: string }): Pass35AuditFinding {
  const { referenceSeed, ...rest } = input;
  return { findingId: findingId(rest.familyId, referenceSeed, rest.title), ...rest };
}

function severityCounts(findings: Pass35AuditFinding[]): Record<Pass35AuditSeverity, number> {
  const result: Record<Pass35AuditSeverity, number> = { critical: 0, high: 0, medium: 0, low: 0, informational: 0 };
  for (const finding of findings) result[finding.severity] += 1;
  return result;
}

function runSourceSemanticFamily(files: Array<{ path: string; content: string }>, observedAt: string, compilerAstEvidence?: SolidityCompilerAstEvidence | null, compilerDeploymentBinding?: AuditCompilerDeploymentBinding | null, compilerProxyBinding?: AuditEip1967ProxyBinding | null): { findings: Pass35AuditFinding[]; receipt: Pass35AuditStaticFamilyReceipt; compilerAstVerified: boolean } {
  const findings: Pass35AuditFinding[] = [];
  const compilerAstLayer = compilerAstEvidence
    ? buildAuditCompilerAstReviewLayer({ evidence: compilerAstEvidence, sourceFiles: files, deploymentBinding: compilerDeploymentBinding, proxyBinding: compilerProxyBinding })
    : null;
  const compilerAstVerified = compilerAstLayer?.accepted === true;
  if (compilerAstLayer && compilerAstVerified) {
    for (const astFinding of compilerAstLayer.findings) {
      findings.push(makeFinding({
        referenceSeed: astFinding.referenceSeed,
        familyId: "source_semantic_family",
        controls: ["A05"],
        state: "finding",
        severity: astFinding.severity,
        confidence: 0,
        confidenceState: "NOT_CALIBRATED",
        title: astFinding.title,
        description: astFinding.description,
        evidence: [evidenceLocation("compiler", `compiler-ast:${astFinding.sourcePath}:${astFinding.astNodeId ?? "unknown"}`, astFinding.excerpt || astFinding.ruleId, astFinding.line)],
        safeRemediation: astFinding.safeRemediation,
        limitations: ["findingConfidence=NOT_CALIBRATED", ...astFinding.limitations],
      }));
    }
  }
  const erc2771Multicall = detectP78Erc2771MulticallContext(files);
  if (erc2771Multicall.classification === "SOURCE_PATTERN_RISK_SIGNAL") {
    const sourceEvidence = erc2771Multicall.evidence
      .filter((entry) => entry.kind === "composition" || entry.kind === "multicall")
      .slice(0, 4)
      .map((entry) => evidenceLocation("source", entry.path, entry.excerpt || entry.kind, entry.line));
    findings.push(makeFinding({
      referenceSeed: `p78-erc2771-multicall:${erc2771Multicall.compositionContracts.join(",")}:${sourceEvidence.map((entry) => `${entry.reference}:${entry.line ?? 0}`).join("|")}`,
      familyId: "source_semantic_family",
      controls: ["A03", "A04", "A05"],
      state: "finding",
      severity: "high",
      confidence: 0,
      confidenceState: "NOT_CALIBRATED",
      title: "ERC2771 + Multicall forwarded-context spoofing risk pattern",
      description: "The verified source bundle composes ERC2771 context handling with a self-delegatecall multicall path without a detected sender-propagation patch or the bounded contract-caller guard. This is a high-priority source risk signal, not proof that the deployed contract is exploitable.",
      evidence: sourceEvidence,
      safeRemediation: "Use a reviewed multicall implementation that preserves the effective forwarded sender for each delegated subcall (or an equivalent validated mitigation), then verify exact deployed bytecode, trusted-forwarder state, affected privileges and fork/replay behavior.",
      limitations: [
        ...erc2771Multicall.limitations,
        "findingConfidence=NOT_CALIBRATED",
        "Known historical ground truth must remain separate from deployment-specific exploitability adjudication.",
      ],
    }));
  }

  const surfaceRules: Array<{
    id: string;
    pattern: RegExp;
    severity: Pass35AuditSeverity;
    state: Pass35AuditFindingState;
    confidence: number;
    title: string;
    description: string;
    remediation: string;
  }> = [
    { id: "callcode", pattern: /\bcallcode\s*\(/g, severity: "high", state: "finding", confidence: 96, title: "Legacy callcode surface", description: "CALLCODE-style behavior is legacy and can create unsafe execution-context assumptions.", remediation: "Remove legacy callcode behavior and use a reviewed architecture with explicit storage and caller semantics." },
    { id: "assembly", pattern: /\bassembly\s*\{/g, severity: "medium", state: "observation", confidence: 82, title: "Inline assembly requires manual review", description: "Inline assembly bypasses several Solidity safety checks and needs instruction-level review.", remediation: "Minimize the block, document invariants, add exact tests and review memory, storage and call semantics manually." },
    { id: "unchecked", pattern: /\bunchecked\s*\{/g, severity: "low", state: "observation", confidence: 78, title: "Unchecked arithmetic block", description: "Arithmetic overflow checks are disabled in this block and correctness depends on explicit bounds.", remediation: "Document the bound and add boundary, fuzz and invariant tests for every unchecked operation." },
  ];
  for (const file of files) {
    const stripped = stripCommentsAndStringsPreserveLines(file.content);
    for (const rule of surfaceRules) {
      rule.pattern.lastIndex = 0;
      for (const match of stripped.matchAll(rule.pattern)) {
        const offset = match.index ?? 0;
        const line = lineForOffset(stripped, offset);
        const excerpt = file.content.split("\n")[line - 1]?.trim().slice(0, 240) ?? rule.id;
        findings.push(makeFinding({
          referenceSeed: `${file.path}:${line}:${rule.id}`,
          familyId: "source_semantic_family",
          controls: ["A05"],
          state: rule.state,
          severity: rule.severity,
          confidence: rule.confidence,
          title: rule.title,
          description: rule.description,
          evidence: [evidenceLocation("source", file.path, excerpt, line)],
          safeRemediation: rule.remediation,
          limitations: ["Local lexical review surface; no path feasibility proof and no human adjudication."],
        }));
      }
    }

    const structured = analyzeSolidityStructuredSignals(file.content);
    for (const signal of structured.findings ?? []) {
      const definition = STRUCTURED_SIGNAL_CATALOG[signal.id];
      if (!definition) continue;
      const line = Number.isInteger(signal.line) && Number(signal.line) > 0 ? Number(signal.line) : 1;
      const excerpt = file.content.split("\n")[line - 1]?.trim().slice(0, 240) || signal.id;
      findings.push(makeFinding({
        referenceSeed: `${file.path}:${line}:structured:${signal.id}`,
        familyId: "source_semantic_family",
        controls: ["A05"],
        state: (definition.state === "not_applicable" || definition.state === "not_observed") ? "observation" : definition.state,
        severity: definition.severity === "info" ? "informational" : definition.severity,
        confidence: definition.confidence,
        title: definition.title,
        description: definition.description,
        evidence: [evidenceLocation("source", file.path, excerpt, line)],
        safeRemediation: definition.remediation,
        limitations: [
          "Structured-token and bounded control-flow heuristic; not a complete solc AST or exploitability proof.",
          "Requires external-tool correlation or human adjudication before customer-facing vulnerability claims.",
        ],
      }));
    }
  }

  const unique = new Map<string, Pass35AuditFinding>();
  for (const finding of findings) {
    const key = `${finding.familyId}|${finding.title}|${finding.evidence[0]?.reference}|${finding.evidence[0]?.line ?? 0}`;
    if (!unique.has(key)) unique.set(key, finding);
  }
  findings.length = 0;
  findings.push(...unique.values());
  findings.sort((a, b) => a.findingId.localeCompare(b.findingId));
  const raw = stable(findings);
  return {
    findings,
    receipt: {
      familyId: "source_semantic_family",
      assuranceClass: compilerAstVerified ? "LOCAL_COMPILER_AST_BOUNDED_BENCHMARKED" : "LOCAL_HEURISTIC_NOT_BENCHMARKED",
      inputSha256: sha256(stable(files.map((file) => ({ path: file.path, sha256: sha256(file.content) })))),
      configurationSha256: sha256(stable({ ...ENGINE_CONFIG, family: "source", compilerAstEvidenceSha256: compilerAstVerified ? compilerAstEvidence?.evidenceSha256 ?? null : null })),
      rawOutputSha256: sha256(raw),
      executedAt: observedAt,
      status: files.length ? "EXECUTED" : "BLOCKED",
      findingCount: findings.length,
      severityCounts: severityCounts(findings),
      paidGateEligible: false,
      independentExternalFamily: false,
      limitations: [
        "No Slither/Mythril/other external analyzer binary was executed by this family.",
        compilerAstVerified
          ? "Exact solc compiler AST and IR evidence was bound for a bounded rule set; rule completeness, path feasibility and exploitability remain unproven."
          : compilerAstEvidence
            ? `Compiler AST evidence was supplied but rejected: ${(compilerAstLayer?.failedChecks ?? []).map((row) => row.id).join(",") || "unknown verification failure"}.`
            : "No compiler AST evidence was supplied; the source lane falls back to bounded structured-token heuristics.",
        "Independent benchmark, exploitability confirmation and qualified review remain missing.",
      ],
    },
    compilerAstVerified,
  };
}

type Opcode = { pc: number; opcode: number; name: string };
const OPCODE_NAMES: Record<number, string> = {
  0xf0: "CREATE", 0xf1: "CALL", 0xf2: "CALLCODE", 0xf4: "DELEGATECALL", 0xf5: "CREATE2", 0xfa: "STATICCALL", 0xff: "SELFDESTRUCT",
};

function disassembleControlOpcodes(bytecode: string | null): { allCount: number; relevant: Opcode[] } {
  if (!bytecode) return { allCount: 0, relevant: [] };
  const bytes = Buffer.from(bytecode.slice(2), "hex");
  const relevant: Opcode[] = [];
  let allCount = 0;
  for (let pc = 0; pc < bytes.length; pc += 1) {
    const opcode = bytes[pc];
    allCount += 1;
    if (opcode >= 0x60 && opcode <= 0x7f) { pc += opcode - 0x5f; continue; }
    if (OPCODE_NAMES[opcode]) relevant.push({ pc, opcode, name: OPCODE_NAMES[opcode] });
  }
  return { allCount, relevant };
}

function privilegeCategory(name: string): Pass35AuditA01A05Report["privilegeMap"][number]["category"] {
  const normalized = name.toLowerCase();
  if (/upgrade|implementation|proxy|beacon/.test(normalized)) return "upgrade";
  if (/owner|ownership/.test(normalized)) return "owner";
  if (/role|admin/.test(normalized)) return "role";
  if (/mint|supply|burn/.test(normalized)) return "mint";
  if (/pause|freeze|trading/.test(normalized)) return "pause";
  if (/blacklist|blocklist|denylist|allowlist|whitelist/.test(normalized)) return "denylist";
  if (/fee|tax/.test(normalized)) return "fee";
  if (/rescue|sweep|recover|emergencywithdraw/.test(normalized)) return "rescue";
  return "unknown";
}

function abiSignature(item: Pass35AuditAbiItem) {
  const inputs = Array.isArray(item.inputs) ? item.inputs.map((input) => canonicalAbiType(input ?? {})).join(",") : "";
  return `${String(item.name ?? "unknown")}(${inputs})`;
}

function runAbiBytecodeFamily(abiItems: Pass35AuditAbiItem[], deployedCore: string | null, observedAt: string): {
  findings: Pass35AuditFinding[];
  privilegeMap: Pass35AuditA01A05Report["privilegeMap"];
  opcodeCount: number;
  receipt: Pass35AuditStaticFamilyReceipt;
} {
  const findings: Pass35AuditFinding[] = [];
  const privilegeMap: Pass35AuditA01A05Report["privilegeMap"] = [];
  const functions = abiItems.filter((item) => item?.type === "function" && typeof item.name === "string");
  for (const item of functions) {
    const signature = abiSignature(item);
    const category = privilegeCategory(signature);
    if (category === "unknown") continue;
    const mutability = String(item.stateMutability ?? "unknown");
    privilegeMap.push({
      surface: signature,
      evidenceLane: "abi",
      category,
      mutability,
      accessEvidence: "ABI exposes the callable surface but does not prove caller authorization.",
      confidence: 86,
    });
    const severity: Pass35AuditSeverity = category === "upgrade" || category === "owner" || category === "role" ? "high" : "medium";
    findings.push(makeFinding({
      referenceSeed: `abi:${signature}`,
      familyId: "abi_bytecode_family",
      controls: ["A04", "A05"],
      state: "observation",
      severity,
      confidence: 86,
      title: `Privileged ABI surface: ${signature}`,
      description: `The ABI exposes a ${category} control surface. ABI presence does not prove who can call it or whether delay/multisig controls exist.`,
      evidence: [evidenceLocation("abi", signature, stable(item))],
      safeRemediation: "Bind the function to source-level authorization, owner/role state, proxy administration and operational controls before rating it safe.",
      limitations: ["ABI-only observation; caller permissions and implementation behavior require source/state evidence."],
    }));
  }
  const disassembly = disassembleControlOpcodes(deployedCore);
  for (const opcode of disassembly.relevant) {
    const severity: Pass35AuditSeverity = opcode.name === "SELFDESTRUCT" || opcode.name === "CALLCODE" ? "high" : opcode.name === "DELEGATECALL" ? "high" : "medium";
    findings.push(makeFinding({
      referenceSeed: `bytecode:${opcode.pc}:${opcode.name}`,
      familyId: "abi_bytecode_family",
      controls: opcode.name === "DELEGATECALL" ? ["A03", "A04", "A05"] : ["A03", "A05"],
      state: "observation",
      severity,
      confidence: 98,
      title: `${opcode.name} opcode present in deployed runtime`,
      description: `${opcode.name} was found by push-aware bytecode traversal at program counter ${opcode.pc}. Presence alone does not prove exploitability.`,
      evidence: [evidenceLocation("bytecode", `pc:${opcode.pc}`, `${opcode.opcode.toString(16).padStart(2, "0")}:${opcode.name}`, undefined, opcode.pc)],
      safeRemediation: "Trace reachable callers and targets, verify authorization and state assumptions, then add path, invariant and fork tests.",
      limitations: ["Opcode presence only; no control-flow graph or path feasibility analysis."],
    }));
  }
  findings.sort((a, b) => a.findingId.localeCompare(b.findingId));
  privilegeMap.sort((a, b) => a.surface.localeCompare(b.surface));
  return {
    findings,
    privilegeMap,
    opcodeCount: disassembly.allCount,
    receipt: {
      familyId: "abi_bytecode_family",
      assuranceClass: "LOCAL_HEURISTIC_NOT_BENCHMARKED",
      inputSha256: sha256(stable({ abi: abiItems, deployedCore })),
      configurationSha256: sha256(stable({ ...ENGINE_CONFIG, family: "abi-bytecode" })),
      rawOutputSha256: sha256(stable({ findings, privilegeMap, relevantOpcodes: disassembly.relevant })),
      executedAt: observedAt,
      status: abiItems.length || deployedCore ? "EXECUTED" : "BLOCKED",
      findingCount: findings.length,
      severityCounts: severityCounts(findings),
      paidGateEligible: false,
      independentExternalFamily: false,
      limitations: [
        "Independent code path and input lane from the source family, but not an independent external assurance provider.",
        "No control-flow graph, symbolic execution, state snapshot or exploitability adjudication.",
      ],
    },
  };
}

function sourcePrivilegeMap(files: Array<{ path: string; content: string }>): Pass35AuditA01A05Report["privilegeMap"] {
  const result: Pass35AuditA01A05Report["privilegeMap"] = [];
  const functionPattern = /\bfunction\s+([A-Za-z_][A-Za-z0-9_]*)\s*\([^)]*\)\s*([^{;]*)/g;
  for (const file of files) {
    const source = stripCommentsAndStringsPreserveLines(file.content);
    for (const match of source.matchAll(functionPattern)) {
      const name = match[1];
      const category = privilegeCategory(name);
      if (category === "unknown") continue;
      const tail = match[2].replace(/\s+/g, " ").trim();
      const accessTokens = tail.match(/\b(?:onlyOwner|onlyRole\s*\([^)]*\)|auth|authorized|admin|governance|initializer|reinitializer)\b/gi) ?? [];
      result.push({
        surface: name,
        evidenceLane: "source",
        category,
        mutability: /\bview\b/.test(tail) ? "view" : /\bpure\b/.test(tail) ? "pure" : /\bpayable\b/.test(tail) ? "payable" : "nonpayable_or_unknown",
        accessEvidence: accessTokens.length ? `Observed modifiers/tokens: ${accessTokens.join(", ")}` : "No recognized access-control token in the function header; manual resolution required.",
        confidence: accessTokens.length ? 82 : 62,
      });
    }
  }
  return result.sort((a, b) => `${a.surface}|${a.evidenceLane}`.localeCompare(`${b.surface}|${b.evidenceLane}`));
}

function buildThreatModel(files: Array<{ path: string; content: string }>, abiItems: Pass35AuditAbiItem[], privilegeMap: Pass35AuditA01A05Report["privilegeMap"], opcodeNames: string[]) {
  const combined = files.map((file) => file.content).join("\n");
  const functions = abiItems.filter((item) => item.type === "function").map((item) => String(item.name ?? ""));
  const components = new Set<string>(["deployed EVM runtime", "customer-supplied source bundle", "ABI/public call surface"]);
  const trustBoundaries = new Set<string>(["external caller -> contract", "privileged actor -> protected function", "off-chain source/ABI provenance -> audit engine"]);
  const assets = new Set<string>();
  const dependencies = new Set<string>();
  if (/\b(?:IERC20|ERC20|token|balanceOf|transferFrom)\b/i.test(combined) || functions.some((name) => /transfer|approve|balance|supply/i.test(name))) assets.add("token balances and allowances");
  if (/\b(?:vault|deposit|withdraw|shares?|assets?)\b/i.test(combined)) assets.add("deposited assets and accounting shares");
  if (/\b(?:mint|burn|totalSupply)\b/i.test(combined)) assets.add("token supply integrity");
  if (/\b(?:oracle|priceFeed|latestRoundData)\b/i.test(combined)) dependencies.add("external price oracle");
  if (/\b(?:router|pair|factory|swap)\b/i.test(combined)) dependencies.add("DEX/router liquidity dependency");
  if (/\b(?:bridge|messenger|crossDomain)\b/i.test(combined)) dependencies.add("bridge or cross-domain messenger");
  if (opcodeNames.includes("DELEGATECALL") || /\b(?:proxy|implementation|upgradeTo)\b/i.test(combined)) {
    components.add("proxy/implementation execution boundary");
    trustBoundaries.add("proxy storage -> implementation code");
    dependencies.add("upgrade administrator and implementation lifecycle");
  }
  if (opcodeNames.some((name) => name === "CALL" || name === "STATICCALL") || /\.call\s*(?:\{|\()/i.test(combined)) trustBoundaries.add("contract -> external callee/callback");
  const privilegedActors = [...new Set(privilegeMap.map((row) => row.category).filter((category) => category !== "unknown").map((category) => `${category} controller`))].sort();
  return {
    components: [...components].sort(),
    trustBoundaries: [...trustBoundaries].sort(),
    assets: [...assets].sort(),
    privilegedActors,
    externalDependencies: [...dependencies].sort(),
    assumptions: [
      "Source files and ABI are treated as evidence inputs, not as proof that they match deployed runtime until A02 passes.",
      "Heuristic findings indicate review surfaces and do not establish exploitability or absence of vulnerabilities.",
    ],
    missingEvidence: [
      "runtime state and storage-slot reads",
      "deployment transaction and constructor arguments",
      "reachable call graph and path feasibility",
      "property/invariant registry and execution",
      "fork/replay at an exact chain block",
      "qualified manual business-logic review",
    ],
  };
}

export function executePass35AuditA01A05(input: Pass35AuditA01A05Input): Pass35AuditA01A05Report {
  const source = canonicalSourceBundle(Array.isArray(input?.sourceFiles) ? input.sourceFiles : []);
  const abi = parseAbi(input?.abi ?? []);
  const a01Blockers = [...source.blockers, ...abi.blockers];
  if (input?.schemaVersion !== "velmere.pass35.audit-a01-a05-input.v1") a01Blockers.push("a01_input_schema_invalid");
  if (!CASE_REF.test(String(input?.caseRef ?? ""))) a01Blockers.push("a01_case_ref_invalid");
  if (!ISO.test(String(input?.observedAt ?? ""))) a01Blockers.push("a01_observed_at_invalid");
  if (!/^\d+$/.test(String(input?.chainId ?? ""))) a01Blockers.push("a01_chain_id_invalid");
  if (!String(input?.chainName ?? "").trim()) a01Blockers.push("a01_chain_name_missing");
  if (!ADDRESS.test(String(input?.contractAddress ?? ""))) a01Blockers.push("a01_contract_address_invalid");
  if (!String(input?.sourceProvenance?.provider ?? "").trim()) a01Blockers.push("a01_provenance_provider_missing");
  if (!String(input?.sourceProvenance?.sourceReference ?? "").trim()) a01Blockers.push("a01_provenance_reference_missing");
  if (!ISO.test(String(input?.sourceProvenance?.observedAt ?? ""))) a01Blockers.push("a01_provenance_observed_at_invalid");
  const provenanceDigest = normalizeDigest(input?.sourceProvenance?.responseSha256);
  if (!provenanceDigest) a01Blockers.push("a01_provenance_digest_invalid");
  if (input?.inputClass === "CUSTOMER_SUPPLIED_VERIFIED" && input?.sourceProvenance?.verifiedSource !== true) a01Blockers.push("a01_verified_input_without_verified_source");
  if (!input?.compiler || !["solc", "vyper", "unknown"].includes(input.compiler.family)) a01Blockers.push("a01_compiler_family_invalid");
  if (input?.compiler?.family === "solc" && !SOLC_VERSION.test(String(input.compiler.version ?? ""))) a01Blockers.push("a01_solc_version_invalid");
  if (!input?.compiler?.version?.trim()) a01Blockers.push("a01_compiler_version_missing");
  if (input?.compiler?.optimizerRuns !== null && (!Number.isInteger(input?.compiler?.optimizerRuns) || Number(input.compiler.optimizerRuns) < 0)) a01Blockers.push("a01_optimizer_runs_invalid");
  const uniqueA01Blockers = [...new Set(a01Blockers)].sort();

  const compiled = normalizeBytecode(input?.compiledRuntimeBytecode);
  const deployed = normalizeBytecode(input?.deployedRuntimeBytecode);
  const compiledStripped = stripSolidityMetadata(compiled);
  const deployedStripped = stripSolidityMetadata(deployed);
  const a02Blockers: string[] = [];
  if (!compiled) a02Blockers.push("a02_compiled_runtime_bytecode_missing_or_invalid");
  if (!deployed) a02Blockers.push("a02_deployed_runtime_bytecode_missing_or_invalid");
  let comparisonStatus: Pass35AuditA01A05Report["bytecodeComparison"]["status"] = "BLOCKED";
  if (compiled && deployed) {
    if (compiled === deployed) comparisonStatus = "EXACT_MATCH";
    else if (compiledStripped.core && deployedStripped.core && compiledStripped.core === deployedStripped.core && (compiledStripped.stripped || deployedStripped.stripped)) comparisonStatus = "MATCH_AFTER_SOLIDITY_METADATA_STRIP";
    else { comparisonStatus = "MISMATCH"; a02Blockers.push("a02_runtime_bytecode_mismatch"); }
  }

  const sourceFamily = runSourceSemanticFamily(source.files, input.observedAt, input.compilerAstEvidence, input.compilerDeploymentBinding, input.compilerProxyBinding);
  const abiBytecodeFamily = runAbiBytecodeFamily(abi.items, deployedStripped.core ?? deployed, input.observedAt);
  const sourcePrivileges = sourcePrivilegeMap(source.files);
  const privilegeMap = [...sourcePrivileges, ...abiBytecodeFamily.privilegeMap]
    .filter((row, index, rows) => rows.findIndex((candidate) => stable(candidate) === stable(row)) === index)
    .sort((a, b) => `${a.surface}|${a.evidenceLane}`.localeCompare(`${b.surface}|${b.evidenceLane}`));
  const opcodeNames = abiBytecodeFamily.findings.filter((finding) => finding.evidence.some((entry) => entry.lane === "bytecode")).map((finding) => finding.title.split(" ")[0]);
  const threatModel = buildThreatModel(source.files, abi.items, privilegeMap, opcodeNames);

  const findings: Pass35AuditFinding[] = [];
  if (uniqueA01Blockers.length) findings.push(makeFinding({
    referenceSeed: uniqueA01Blockers.join("|"), familyId: "identity", controls: ["A01"], state: "blocked", severity: "high", confidence: 100,
    title: "A01 identity and provenance gate blocked", description: `Identity binding is incomplete: ${uniqueA01Blockers.join(", ")}.`,
    evidence: [], safeRemediation: "Provide a valid source bundle, ABI, compiler settings, target identity and provider-bound provenance receipt.", limitations: ["No downstream audit conclusion is safe while identity binding is blocked."],
  }));
  if (a02Blockers.length) findings.push(makeFinding({
    referenceSeed: a02Blockers.join("|"), familyId: "reproducibility", controls: ["A02"], state: "blocked", severity: "high", confidence: 100,
    title: "A02 deployed bytecode reproducibility gate blocked", description: `Runtime bytecode binding is incomplete or mismatched: ${a02Blockers.join(", ")}.`,
    evidence: [], safeRemediation: "Compile with exact version/settings/libraries and compare the runtime bytecode to the deployed contract before delivery.", limitations: ["This engine verifies supplied bytecode; it does not invoke solc or fetch chain bytecode by itself."],
  }));
  findings.push(...sourceFamily.findings, ...abiBytecodeFamily.findings);
  findings.sort((a, b) => a.findingId.localeCompare(b.findingId));

  const a01Passed = uniqueA01Blockers.length === 0;
  const a02Passed = a02Blockers.length === 0 && (comparisonStatus === "EXACT_MATCH" || comparisonStatus === "MATCH_AFTER_SOLIDITY_METADATA_STRIP");
  const a03Executable = source.files.length > 0 || abi.items.length > 0 || Boolean(deployed);
  const a04Executable = privilegeMap.length > 0 || (source.files.length > 0 && abi.items.length > 0);
  const a05Executable = sourceFamily.receipt.status === "EXECUTED" && abiBytecodeFamily.receipt.status === "EXECUTED";
  const identity = {
    sourceBundleSha256: source.canonical ? sha256(source.canonical) : null,
    abiSha256: abi.canonical ? sha256(abi.canonical) : null,
    compilerConfigurationSha256: input?.compiler ? sha256(stable(input.compiler)) : null,
    compiledRuntimeBytecodeSha256: compiled ? sha256(Buffer.from(compiled.slice(2), "hex")) : null,
    deployedRuntimeBytecodeSha256: deployed ? sha256(Buffer.from(deployed.slice(2), "hex")) : null,
    provenanceResponseSha256: provenanceDigest,
    compilerAstEvidenceSha256: sourceFamily.compilerAstVerified ? input.compilerAstEvidence?.evidenceSha256 ?? null : null,
    compilerDeploymentBindingSha256: sourceFamily.compilerAstVerified ? input.compilerDeploymentBinding?.bindingSha256 ?? null : null,
    compilerProxyBindingSha256: sourceFamily.compilerAstVerified ? input.compilerProxyBinding?.proxyBindingSha256 ?? null : null,
  };
  const controls: Pass35AuditA01A05Report["controls"] = {
    A01: {
      state: a01Passed ? "VERIFIED_LOCAL_STRUCTURE" : "BLOCKED_MISSING_OR_INVALID_INPUT",
      passEligible: a01Passed && input.inputClass === "CUSTOMER_SUPPLIED_VERIFIED",
      blockers: uniqueA01Blockers,
      truthBoundary: "Validates exact input structure, digests and provenance fields. It does not independently verify the explorer/provider or customer rights.",
    },
    A02: {
      state: comparisonStatus === "EXACT_MATCH" ? "VERIFIED_EXACT_BYTECODE" : comparisonStatus === "MATCH_AFTER_SOLIDITY_METADATA_STRIP" ? "VERIFIED_METADATA_STRIPPED_BYTECODE" : "BLOCKED_MISSING_OR_INVALID_INPUT",
      passEligible: a02Passed && input.inputClass === "CUSTOMER_SUPPLIED_VERIFIED",
      blockers: [...new Set(a02Blockers)].sort(),
      truthBoundary: "Compares supplied runtime bytecodes exactly or after strict Solidity CBOR metadata stripping. It does not execute the compiler or resolve immutables/libraries automatically.",
    },
    A03: {
      state: a03Executable ? "GENERATED_LOCAL_HEURISTIC_NOT_REVIEWED" : "BLOCKED_MISSING_OR_INVALID_INPUT",
      passEligible: false,
      blockers: a03Executable ? ["a03_manual_architecture_and_business_logic_review_missing"] : ["a03_input_missing"],
      truthBoundary: "Produces a deterministic preliminary threat model; qualified human architecture review remains mandatory.",
    },
    A04: {
      state: a04Executable ? "GENERATED_LOCAL_HEURISTIC_NOT_REVIEWED" : "BLOCKED_MISSING_OR_INVALID_INPUT",
      passEligible: false,
      blockers: a04Executable ? ["a04_runtime_role_state_and_manual_authorization_review_missing"] : ["a04_privilege_input_missing"],
      truthBoundary: "Maps source/ABI privilege surfaces but cannot prove current on-chain role holders, multisig, timelock or hidden implementation behavior.",
    },
    A05: {
      state: a05Executable ? "EXECUTED_LOCAL_HEURISTIC_NOT_BENCHMARKED" : "BLOCKED_MISSING_OR_INVALID_INPUT",
      passEligible: false,
      blockers: a05Executable ? [
        "a05_external_analyzer_binaries_not_executed",
        sourceFamily.compilerAstVerified ? "a05_compiler_ast_rule_set_bounded" : "a05_compiler_ast_evidence_missing_or_invalid",
        "a05_real_frozen_benchmark_missing",
        "a05_independent_adjudication_missing",
      ] : ["a05_family_input_missing"],
      truthBoundary: sourceFamily.compilerAstVerified
        ? "The source lane includes exact compiler AST/IR-bound findings for a bounded rule set plus structured-token fallback. It still does not prove complete recall, path feasibility, exploitability or independent assurance."
        : "Two separate local code paths execute over source and ABI/bytecode lanes. They are not substitutes for compiler AST, two validated external analyzer families or independent assurance.",
    },
  };

  const core: Omit<Pass35AuditA01A05Report, "reportSha256"> = {
    schemaVersion: "velmere.pass35.audit-a01-a05-report.v1",
    engineId: PASS35_AUDIT_A01_A05_ENGINE_ID,
    caseRef: input.caseRef,
    inputClass: input.inputClass,
    observedAt: input.observedAt,
    target: { chainId: String(input.chainId ?? ""), chainName: String(input.chainName ?? ""), contractAddress: String(input.contractAddress ?? ""), projectName: input.projectName?.trim() || null },
    inputIdentity: identity,
    controls,
    bytecodeComparison: {
      status: comparisonStatus,
      compiledCoreSha256: compiledStripped.core ? sha256(Buffer.from(compiledStripped.core.slice(2), "hex")) : null,
      deployedCoreSha256: deployedStripped.core ? sha256(Buffer.from(deployedStripped.core.slice(2), "hex")) : null,
      compiledMetadataBytes: compiledStripped.metadataBytes,
      deployedMetadataBytes: deployedStripped.metadataBytes,
      firstMismatchByte: comparisonStatus === "MISMATCH" ? firstMismatchByte(compiledStripped.core, deployedStripped.core) : null,
      truthBoundary: "A match proves equality of supplied runtime bytecode under the stated normalization only; source compilation and chain retrieval remain separate evidence lanes.",
    },
    threatModel,
    privilegeMap,
    staticFamilies: [sourceFamily.receipt, abiBytecodeFamily.receipt],
    findings,
    summary: {
      findings: findings.length,
      severityCounts: severityCounts(findings),
      sourceFiles: source.files.length,
      abiFunctions: abi.items.filter((item) => item.type === "function").length,
      bytecodeOpcodes: abiBytecodeFamily.opcodeCount,
      paidDeliveryAllowed: false,
      fullAuditClaimAllowed: false,
      humanReviewed: false,
      independentAssurance: false,
      nextRequiredControls: [
        "external pinned static analyzer family 1",
        "independent external static analyzer family 2",
        "symbolic/path analysis where applicable",
        "per-case unit/integration tests",
        "property/fuzz/invariant execution",
        "fork/replay at exact state",
        "manual architecture and business-logic review",
        "real frozen benchmark and independent adjudication",
      ],
    },
    truthBoundary: "PASS35 A3 executes deterministic local A01-A05 controls and two heuristic static lanes. It is synthetic/offline when run on fixtures, never authorizes sale, never proves a full audit and never replaces external analyzers, fuzz/fork execution, manual QA, staging, LIVE or customer evidence.",
  };
  return { ...core, reportSha256: sha256(stable(core)) };
}
