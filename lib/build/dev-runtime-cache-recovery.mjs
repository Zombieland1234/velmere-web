import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export const A42_DEV_RUNTIME_REVISION = "VELMERE_PASS35_A42_DEV_RUNTIME_CACHE_RECOVERY";
export const A42_CONTRACT_RELATIVE_PATH = "config/pass35/a42-dev-runtime-cache-recovery.json";
export const A42_CACHE_MARKER_RELATIVE_PATH = ".velmere/dev-runtime/cache-marker.json";

const DEFAULT_SOURCE_JSON_LIMIT = 32 * 1024 * 1024;
const DEFAULT_GENERATED_JSON_LIMIT = 16 * 1024 * 1024;
const GENERATED_JSON_EXTENSIONS = new Set([".json", ".webmanifest"]);

function normalizeRelativePath(value) {
  return String(value ?? "").replaceAll("\\", "/").replace(/^\.\//u, "");
}

function assertInsideRoot(root, target) {
  const resolvedRoot = path.resolve(root);
  const resolvedTarget = path.resolve(target);
  const relative = path.relative(resolvedRoot, resolvedTarget);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`A42 refused path outside project root: ${resolvedTarget}`);
  }
  return resolvedTarget;
}

function generatedNextDirectory(root) {
  const resolvedRoot = path.resolve(root);
  const target = path.resolve(resolvedRoot, ".next");
  if (path.dirname(target) !== resolvedRoot || path.basename(target) !== ".next") {
    throw new Error("A42 refused unsafe generated Next path");
  }
  return target;
}

function sha256(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

export function loadA42Contract(root = process.cwd()) {
  const filePath = assertInsideRoot(root, path.join(root, A42_CONTRACT_RELATIVE_PATH));
  const contract = JSON.parse(fs.readFileSync(filePath, "utf8"));
  if (contract?.revisionId !== A42_DEV_RUNTIME_REVISION) {
    throw new Error(`A42 contract revision mismatch: ${contract?.revisionId ?? "missing"}`);
  }
  return contract;
}

export function computeContractFingerprint(contract) {
  const stable = {
    schemaVersion: contract?.schemaVersion ?? null,
    revisionId: contract?.revisionId ?? null,
    parentRevisionId: contract?.parentRevisionId ?? null,
    runtime: contract?.runtime ?? null,
    cachePolicy: contract?.cachePolicy ?? null,
    criticalFiles: Object.fromEntries(Object.entries(contract?.criticalFiles ?? {}).sort(([a], [b]) => a.localeCompare(b))),
  };
  return sha256(JSON.stringify(stable));
}

export function inspectJsonText(text, label = "json") {
  try {
    JSON.parse(String(text));
    return { ok: true, label };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const positionMatch = message.match(/position\s+(\d+)/iu);
    const position = positionMatch ? Number(positionMatch[1]) : null;
    const source = String(text);
    const contextStart = Number.isInteger(position) ? Math.max(0, position - 48) : 0;
    const contextEnd = Number.isInteger(position) ? Math.min(source.length, position + 96) : Math.min(source.length, 144);
    return {
      ok: false,
      label,
      error: message,
      position,
      context: source.slice(contextStart, contextEnd),
    };
  }
}

function listJsonFiles(targetPath, { generated = false } = {}, output = []) {
  if (!fs.existsSync(targetPath)) return output;
  const metadata = fs.lstatSync(targetPath);
  if (metadata.isSymbolicLink()) return output;
  if (metadata.isFile()) {
    const extension = path.extname(targetPath).toLowerCase();
    if (GENERATED_JSON_EXTENSIONS.has(extension) || (generated && extension === ".map")) output.push(targetPath);
    return output;
  }
  if (!metadata.isDirectory()) return output;

  for (const entry of fs.readdirSync(targetPath, { withFileTypes: true })) {
    if (entry.isSymbolicLink()) continue;
    if (entry.isDirectory() && [".git", "node_modules", ".velmere"].includes(entry.name)) continue;
    listJsonFiles(path.join(targetPath, entry.name), { generated }, output);
  }
  return output;
}

export function findInvalidJsonFiles(root, targets, { generated = false, maximumBytes = generated ? DEFAULT_GENERATED_JSON_LIMIT : DEFAULT_SOURCE_JSON_LIMIT } = {}) {
  const rows = [];
  for (const target of targets ?? []) {
    const absoluteTarget = assertInsideRoot(root, path.join(root, normalizeRelativePath(target)));
    const files = listJsonFiles(absoluteTarget, { generated }, []);
    for (const filePath of files) {
      const stat = fs.statSync(filePath);
      if (stat.size > maximumBytes) {
        rows.push({
          label: normalizeRelativePath(path.relative(root, filePath)),
          error: `json_file_exceeds_bound:${stat.size}>${maximumBytes}`,
          position: null,
          context: "",
        });
        continue;
      }
      const inspected = inspectJsonText(fs.readFileSync(filePath, "utf8"), normalizeRelativePath(path.relative(root, filePath)));
      if (!inspected.ok) rows.push(inspected);
    }
  }
  return rows;
}

export function verifyCriticalFiles(root, criticalFiles = {}) {
  const checks = [];
  const failures = [];
  for (const [relativePathRaw, expectedRaw] of Object.entries(criticalFiles).sort(([a], [b]) => a.localeCompare(b))) {
    const relativePath = normalizeRelativePath(relativePathRaw);
    const expected = String(expectedRaw).toLowerCase();
    const absolutePath = assertInsideRoot(root, path.join(root, relativePath));
    if (!fs.existsSync(absolutePath) || !fs.statSync(absolutePath).isFile()) {
      const row = { relativePath, ok: false, reason: "missing", expected, actual: null };
      checks.push(row);
      failures.push(row);
      continue;
    }
    const actual = sha256(fs.readFileSync(absolutePath));
    const row = { relativePath, ok: actual === expected, reason: actual === expected ? null : "sha256_mismatch", expected, actual };
    checks.push(row);
    if (!row.ok) failures.push(row);
  }
  return { ok: failures.length === 0, checks, failures };
}

export function cacheMarkerPath(root) {
  return assertInsideRoot(root, path.join(root, A42_CACHE_MARKER_RELATIVE_PATH));
}

export function readCacheMarker(root) {
  const filePath = cacheMarkerPath(root);
  if (!fs.existsSync(filePath)) return { ok: false, reason: "missing", value: null, filePath };
  try {
    const value = JSON.parse(fs.readFileSync(filePath, "utf8"));
    return { ok: true, value, filePath };
  } catch (error) {
    return { ok: false, reason: "malformed", error: error instanceof Error ? error.message : String(error), value: null, filePath };
  }
}

export function writeCacheMarker(root, contract, extra = {}) {
  const filePath = cacheMarkerPath(root);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const value = {
    schemaVersion: "velmere.pass35.a42.dev-cache-marker.v1",
    revisionId: A42_DEV_RUNTIME_REVISION,
    sourceFingerprint: computeContractFingerprint(contract),
    writtenAt: new Date().toISOString(),
    ...extra,
  };
  const temporaryPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  fs.renameSync(temporaryPath, filePath);
  return { filePath, value };
}

function removeGeneratedNextDirectory(root) {
  const nextDirectory = generatedNextDirectory(root);
  if (!fs.existsSync(nextDirectory)) return false;
  fs.rmSync(nextDirectory, { recursive: true, force: true, maxRetries: 5, retryDelay: 150 });
  return true;
}

export function prepareDevRuntimeCache({ root = process.cwd(), contract = loadA42Contract(root), forceClear = false } = {}) {
  const nextDirectory = generatedNextDirectory(root);
  const nextExists = fs.existsSync(nextDirectory);
  const marker = readCacheMarker(root);
  const expectedFingerprint = computeContractFingerprint(contract);
  const reasons = [];

  if (forceClear) reasons.push("explicit_clean_start");
  if (nextExists && contract?.cachePolicy?.clearOnMissingMarker && !marker.ok) {
    reasons.push(marker.reason === "malformed" ? "cache_marker_malformed" : "cache_marker_missing");
  }
  if (nextExists && marker.ok && contract?.cachePolicy?.clearOnRevisionMismatch && marker.value?.revisionId !== A42_DEV_RUNTIME_REVISION) {
    reasons.push("cache_revision_mismatch");
  }
  if (nextExists && marker.ok && contract?.cachePolicy?.clearOnFingerprintMismatch && marker.value?.sourceFingerprint !== expectedFingerprint) {
    reasons.push("cache_source_fingerprint_mismatch");
  }

  if (nextExists && contract?.cachePolicy?.clearOnMalformedGeneratedJson) {
    const malformed = findInvalidJsonFiles(root, [".next"], {
      generated: true,
      maximumBytes: contract?.cachePolicy?.maximumGeneratedJsonBytes ?? DEFAULT_GENERATED_JSON_LIMIT,
    });
    for (const row of malformed.slice(0, 20)) reasons.push(`malformed_generated_json:${row.label}`);
  }

  const uniqueReasons = [...new Set(reasons)];
  const cacheCleared = uniqueReasons.length > 0 ? removeGeneratedNextDirectory(root) : false;
  const written = writeCacheMarker(root, contract, {
    cacheCleared,
    reasons: uniqueReasons,
  });

  return {
    schemaVersion: "velmere.pass35.a42.dev-cache-preparation.v1",
    revisionId: A42_DEV_RUNTIME_REVISION,
    cacheDirectory: nextDirectory,
    cacheExisted: nextExists,
    cacheCleared,
    reasons: uniqueReasons,
    markerPath: written.filePath,
    sourceFingerprint: expectedFingerprint,
  };
}
