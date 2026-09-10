export const P78_ERC2771_MULTICALL_DETECTOR_ID = "p78-erc2771-multicall-context-detector.v1" as const;

export type P78SourceFile = { path: string; content: string };
export type P78Erc2771MulticallClassification =
  | "SOURCE_PATTERN_RISK_SIGNAL"
  | "MITIGATED_SOURCE_PATTERN"
  | "NO_MATCH";
export type P78Erc2771MulticallMitigation =
  | "FORWARDED_SENDER_PROPAGATION"
  | "CONTRACT_CALLER_GUARD"
  | null;

export type P78Erc2771MulticallEvidence = {
  path: string;
  line: number;
  kind: "composition" | "multicall" | "mitigation" | "trusted_forwarder_configuration";
  excerpt: string;
};

export type P78Erc2771MulticallResult = {
  detectorId: typeof P78_ERC2771_MULTICALL_DETECTOR_ID;
  classification: P78Erc2771MulticallClassification;
  sourcePatternDetected: boolean;
  mitigation: P78Erc2771MulticallMitigation;
  compositionContracts: string[];
  trustedForwarderConfigurationObserved: boolean;
  trustedForwarderRuntimeState: "UNKNOWN_RUNTIME_NOT_PROVEN";
  exploitabilityProven: false;
  customerFinalEligibleFromDetector: false;
  evidence: P78Erc2771MulticallEvidence[];
  limitations: string[];
};

function stripCommentsAndStringsPreserveLines(source: string): string {
  let out = "";
  let index = 0;
  let state: "code" | "line" | "block" | "string" = "code";
  let quote = "";
  while (index < source.length) {
    const char = source[index];
    const next = source[index + 1] ?? "";
    if (state === "code") {
      if (char === "/" && next === "/") {
        out += "  "; index += 2; state = "line"; continue;
      }
      if (char === "/" && next === "*") {
        out += "  "; index += 2; state = "block"; continue;
      }
      if (char === '"' || char === "'") {
        quote = char; out += " "; index += 1; state = "string"; continue;
      }
      out += char; index += 1; continue;
    }
    if (state === "line") {
      if (char === "\n") { out += "\n"; state = "code"; } else out += " ";
      index += 1; continue;
    }
    if (state === "block") {
      if (char === "*" && next === "/") { out += "  "; index += 2; state = "code"; continue; }
      out += char === "\n" ? "\n" : " "; index += 1; continue;
    }
    if (char === "\\") {
      out += "  "; index += Math.min(2, source.length - index); continue;
    }
    if (char === quote) { out += " "; index += 1; state = "code"; continue; }
    out += char === "\n" ? "\n" : " "; index += 1;
  }
  return out;
}

function lineForOffset(value: string, offset: number): number {
  return value.slice(0, Math.max(0, offset)).split("\n").length;
}

function excerptAt(source: string, line: number): string {
  return source.split(/\r?\n/)[Math.max(0, line - 1)]?.trim().slice(0, 240) || "";
}

function firstMatch(files: P78SourceFile[], pattern: RegExp): { file: P78SourceFile; index: number; match: RegExpExecArray } | null {
  for (const file of files) {
    const stripped = stripCommentsAndStringsPreserveLines(file.content);
    pattern.lastIndex = 0;
    const match = pattern.exec(stripped);
    if (match) return { file, index: match.index, match };
  }
  return null;
}

function compositionMatches(files: P78SourceFile[]) {
  const rows: Array<{ file: P78SourceFile; contractName: string; index: number; trustedIndex: number | null }> = [];
  const contractPattern = /\bcontract\s+([A-Za-z_][A-Za-z0-9_]*)\s+is\s+([^{]{0,4000})\{/g;
  for (const file of files) {
    const stripped = stripCommentsAndStringsPreserveLines(file.content);
    contractPattern.lastIndex = 0;
    for (const match of stripped.matchAll(contractPattern)) {
      const inheritance = match[2] ?? "";
      if (!/\bERC2771Context(?:Upgradeable|Logic)?\b/.test(inheritance) || !/\bMulticall\b/.test(inheritance)) continue;
      const trustedPattern = /(?:__ERC2771Context_init\s*\(|ERC2771Context\s*\([^)]*trustedForwarder|_trustedForwarders?\b)/g;
      trustedPattern.lastIndex = 0;
      const trusted = trustedPattern.exec(stripped);
      rows.push({
        file,
        contractName: match[1],
        index: match.index ?? 0,
        trustedIndex: trusted?.index ?? null,
      });
    }
  }
  return rows;
}

export function detectP78Erc2771MulticallContext(files: P78SourceFile[]): P78Erc2771MulticallResult {
  const safeFiles = Array.isArray(files)
    ? files.filter((file) => typeof file?.path === "string" && typeof file?.content === "string")
    : [];
  const compositions = compositionMatches(safeFiles);
  const directMitigation = firstMatch(
    safeFiles,
    /abi\.encodePacked\s*\(\s*data\s*\[\s*i\s*\]\s*,\s*sender\s*\)/g,
  );
  const helperMitigation = firstMatch(
    safeFiles,
    /functionDelegateCall[\s\S]{0,1800}?require\s*\([^;\n]{0,500}!\s*isContract\s*\(\s*msg\.sender\s*\)/g,
  );
  const rawDelegate = firstMatch(
    safeFiles,
    /(?:functionDelegateCall\s*\(\s*address\s*\(\s*this\s*\)\s*,\s*data\s*\[\s*i\s*\]\s*\)|address\s*\(\s*this\s*\)\.delegatecall\s*\(\s*data\s*\[\s*i\s*\]\s*\))/g,
  );

  const evidence: P78Erc2771MulticallEvidence[] = [];
  for (const row of compositions) {
    const line = lineForOffset(stripCommentsAndStringsPreserveLines(row.file.content), row.index);
    evidence.push({ path: row.file.path, line, kind: "composition", excerpt: excerptAt(row.file.content, line) });
    if (row.trustedIndex !== null) {
      const trustedLine = lineForOffset(stripCommentsAndStringsPreserveLines(row.file.content), row.trustedIndex);
      evidence.push({ path: row.file.path, line: trustedLine, kind: "trusted_forwarder_configuration", excerpt: excerptAt(row.file.content, trustedLine) });
    }
  }
  if (rawDelegate) {
    const line = lineForOffset(stripCommentsAndStringsPreserveLines(rawDelegate.file.content), rawDelegate.index);
    evidence.push({ path: rawDelegate.file.path, line, kind: "multicall", excerpt: excerptAt(rawDelegate.file.content, line) });
  }
  const mitigationSource = directMitigation ?? helperMitigation;
  if (mitigationSource) {
    const line = lineForOffset(stripCommentsAndStringsPreserveLines(mitigationSource.file.content), mitigationSource.index);
    evidence.push({ path: mitigationSource.file.path, line, kind: "mitigation", excerpt: excerptAt(mitigationSource.file.content, line) });
  }

  const sourcePatternDetected = compositions.length > 0 && Boolean(rawDelegate);
  const mitigation: P78Erc2771MulticallMitigation = directMitigation
    ? "FORWARDED_SENDER_PROPAGATION"
    : helperMitigation
      ? "CONTRACT_CALLER_GUARD"
      : null;
  const classification: P78Erc2771MulticallClassification = !sourcePatternDetected
    ? "NO_MATCH"
    : mitigation
      ? "MITIGATED_SOURCE_PATTERN"
      : "SOURCE_PATTERN_RISK_SIGNAL";

  return {
    detectorId: P78_ERC2771_MULTICALL_DETECTOR_ID,
    classification,
    sourcePatternDetected,
    mitigation,
    compositionContracts: [...new Set(compositions.map((row) => row.contractName))].sort(),
    trustedForwarderConfigurationObserved: compositions.some((row) => row.trustedIndex !== null),
    trustedForwarderRuntimeState: "UNKNOWN_RUNTIME_NOT_PROVEN",
    exploitabilityProven: false,
    customerFinalEligibleFromDetector: false,
    evidence,
    limitations: [
      "This detector classifies a cross-file source pattern and known source-level mitigations; it does not prove current deployed bytecode or storage state.",
      "A valid trusted-forwarder runtime configuration is required for the historical vulnerability condition and must be verified independently at an exact block.",
      "Exploitability, affected privileges, severity escalation and customer FINAL require deployment-bound runtime evidence and independent adjudication.",
    ],
  };
}
