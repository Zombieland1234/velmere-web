import { ASCII_CONTROL_PATTERN, JSON_CONTROL_NO_DELETE_PATTERN } from "./ascii-control-characters";
import { sha256Digest } from "./cryptographic-digest";
import { parseStrictJsonText } from "./strict-json-boundary";
import type { P78SourceFile } from "./erc2771-multicall-context-detector";

export const P78_VERIFIED_SOLIDITY_SOURCE_BUNDLE_ID = "p78-verified-solidity-source-bundle.v1" as const;

export type P78VerifiedSoliditySourceFormat =
  | "plain-solidity"
  | "standard-json"
  | "etherscan-double-brace-json"
  | "invalid";

export type P78VerifiedSoliditySourceBundle = {
  parserId: typeof P78_VERIFIED_SOLIDITY_SOURCE_BUNDLE_ID;
  valid: boolean;
  complete: boolean;
  format: P78VerifiedSoliditySourceFormat;
  files: P78SourceFile[];
  fileCount: number;
  totalContentBytes: number;
  sourceDigest: string | null;
  rejectionReason: string | null;
};

const MAX_RAW_SOURCE_BYTES = 2_000_000;
const MAX_SOURCE_FILES = 512;
const MAX_SINGLE_SOURCE_BYTES = 1_200_000;
const MAX_TOTAL_SOURCE_BYTES = 1_800_000;

function byteLength(value: string) {
  return new TextEncoder().encode(value).byteLength;
}

function cleanRaw(value: unknown) {
  if (typeof value !== "string") return "";
  return value.replace(JSON_CONTROL_NO_DELETE_PATTERN, " ").trim();
}

function sanitizePath(value: string, index: number) {
  const normalized = value
    .replace(/\\/g, "/")
    .replace(ASCII_CONTROL_PATTERN, "")
    .split("/")
    .filter((part) => part && part !== "." && part !== "..")
    .join("/")
    .slice(0, 240);
  return normalized || `verified-source-${String(index + 1).padStart(3, "0")}.sol`;
}

export function stripSolidityCommentsAndStrings(value: string) {
  return value
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/\/\/[^\n\r]*/g, " ")
    .replace(/"(?:\\.|[^"\\])*"/g, '""')
    .replace(/'(?:\\.|[^'\\])*'/g, "''");
}

function plausibleSoliditySource(path: string, content: string) {
  const stripped = stripSolidityCommentsAndStrings(content);
  if (/\.sol$/i.test(path) && /\bpragma\s+solidity\b|\bimport\b|\b(?:abstract\s+)?(?:contract|interface|library)\s+[A-Za-z_][A-Za-z0-9_]*/.test(stripped)) return true;
  return /\bpragma\s+solidity\b/.test(stripped) || /\b(?:abstract\s+)?(?:contract|interface|library)\s+[A-Za-z_][A-Za-z0-9_]*/.test(stripped);
}

function validatedFiles(rows: P78SourceFile[]) {
  if (rows.length === 0 || rows.length > MAX_SOURCE_FILES) return null;
  let totalContentBytes = 0;
  const files: P78SourceFile[] = [];
  for (let index = 0; index < rows.length; index += 1) {
    const content = typeof rows[index]?.content === "string" ? rows[index]!.content.replace(JSON_CONTROL_NO_DELETE_PATTERN, " ") : "";
    if (!content.trim()) continue;
    const contentBytes = byteLength(content);
    if (contentBytes > MAX_SINGLE_SOURCE_BYTES) return null;
    totalContentBytes += contentBytes;
    if (totalContentBytes > MAX_TOTAL_SOURCE_BYTES) return null;
    const path = sanitizePath(rows[index]!.path, index);
    if (!plausibleSoliditySource(path, content)) continue;
    files.push({ path, content });
  }
  return files.length > 0 ? { files, totalContentBytes } : null;
}

function parseStandardJson(raw: string, format: "standard-json" | "etherscan-double-brace-json") {
  let parsed: unknown;
  try {
    parsed = parseStrictJsonText(raw, {
      maxBytes: MAX_RAW_SOURCE_BYTES,
      maxDepth: 48,
      maxNodes: 100_000,
      requireObject: true,
    });
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
  const record = parsed as Record<string, unknown>;
  if (typeof record.language === "string" && record.language.trim().toLowerCase() !== "solidity") return null;
  const sources = record.sources;
  if (!sources || typeof sources !== "object" || Array.isArray(sources)) return null;
  const entries = Object.entries(sources as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b));
  if (entries.length === 0 || entries.length > MAX_SOURCE_FILES) return null;
  const rows: P78SourceFile[] = [];
  for (const [path, value] of entries) {
    if (!value || typeof value !== "object" || Array.isArray(value)) continue;
    const content = (value as { content?: unknown }).content;
    if (typeof content !== "string") continue;
    rows.push({ path, content });
  }
  const validated = validatedFiles(rows);
  return validated ? { ...validated, format } : null;
}

export function parseVerifiedSoliditySourceBundle(value: unknown): P78VerifiedSoliditySourceBundle {
  const raw = cleanRaw(value);
  const sourceDigest = raw ? sha256Digest(raw) : null;
  if (!raw) {
    return {
      parserId: P78_VERIFIED_SOLIDITY_SOURCE_BUNDLE_ID,
      valid: false,
      complete: false,
      format: "invalid",
      files: [],
      fileCount: 0,
      totalContentBytes: 0,
      sourceDigest,
      rejectionReason: "source_missing",
    };
  }
  if (byteLength(raw) > MAX_RAW_SOURCE_BYTES) {
    return {
      parserId: P78_VERIFIED_SOLIDITY_SOURCE_BUNDLE_ID,
      valid: false,
      complete: false,
      format: "invalid",
      files: [],
      fileCount: 0,
      totalContentBytes: 0,
      sourceDigest,
      rejectionReason: "source_exceeds_private_parser_boundary",
    };
  }

  const doubleBrace = raw.startsWith("{{") && raw.endsWith("}}")
    ? parseStandardJson(raw.slice(1, -1), "etherscan-double-brace-json")
    : null;
  const standard = doubleBrace ?? (raw.startsWith("{") ? parseStandardJson(raw, "standard-json") : null);
  if (standard) {
    return {
      parserId: P78_VERIFIED_SOLIDITY_SOURCE_BUNDLE_ID,
      valid: true,
      complete: true,
      format: standard.format,
      files: standard.files,
      fileCount: standard.files.length,
      totalContentBytes: standard.totalContentBytes,
      sourceDigest,
      rejectionReason: null,
    };
  }

  const plain = validatedFiles([{ path: "verified-source.sol", content: raw }]);
  if (plain) {
    return {
      parserId: P78_VERIFIED_SOLIDITY_SOURCE_BUNDLE_ID,
      valid: true,
      complete: true,
      format: "plain-solidity",
      files: plain.files,
      fileCount: plain.files.length,
      totalContentBytes: plain.totalContentBytes,
      sourceDigest,
      rejectionReason: null,
    };
  }

  return {
    parserId: P78_VERIFIED_SOLIDITY_SOURCE_BUNDLE_ID,
    valid: false,
    complete: false,
    format: "invalid",
    files: [],
    fileCount: 0,
    totalContentBytes: 0,
    sourceDigest,
    rejectionReason: "source_not_valid_solidity_or_supported_standard_json",
  };
}

export function buildVerifiedSolidityAnalysisCorpus(bundle: P78VerifiedSoliditySourceBundle, maxBytes = 1_600_000) {
  if (!bundle.valid || bundle.files.length === 0 || !Number.isSafeInteger(maxBytes) || maxBytes <= 0) {
    return { corpus: "", complete: false };
  }
  let usedBytes = 0;
  const chunks: string[] = [];
  for (const file of bundle.files) {
    const stripped = stripSolidityCommentsAndStrings(file.content);
    const chunk = `\n${stripped}`;
    const chunkBytes = byteLength(chunk);
    if (usedBytes + chunkBytes > maxBytes) return { corpus: chunks.join("\n"), complete: false };
    chunks.push(chunk);
    usedBytes += chunkBytes;
  }
  return { corpus: chunks.join("\n"), complete: bundle.complete };
}
