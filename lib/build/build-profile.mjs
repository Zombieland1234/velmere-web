import path from "node:path";

export const BUILD_PROFILE_NAMES = Object.freeze(["conservative", "balanced", "throughput"]);

export const BUILD_PROFILE_DEFAULTS = Object.freeze({
  conservative: Object.freeze({
    cpus: 1,
    webpackBuildWorker: false,
    webpackMemoryOptimizations: true,
    workerThreads: false,
    parallelServerCompiles: false,
    parallelServerBuildTraces: false,
    turbopackMemoryLimit: 1363148800,
  }),
  balanced: Object.freeze({
    cpus: 2,
    webpackBuildWorker: false,
    webpackMemoryOptimizations: true,
    workerThreads: false,
    parallelServerCompiles: false,
    parallelServerBuildTraces: false,
    turbopackMemoryLimit: 2147483648,
  }),
  throughput: Object.freeze({
    cpus: 4,
    webpackBuildWorker: true,
    webpackMemoryOptimizations: false,
    workerThreads: false,
    parallelServerCompiles: true,
    parallelServerBuildTraces: true,
    turbopackMemoryLimit: 3221225472,
  }),
});

const SAFE_TOKEN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/u;
const SAFE_SCOPE = /^(?:webpack|turbopack)$/u;
const SAFE_DIST_DIR = /^\.next-pass25-(?:webpack|turbopack)$/u;
const SHA256 = /^[a-f0-9]{64}$/u;

function optionalTrimmed(value) {
  if (value === undefined || value === null) return null;
  const result = String(value).trim();
  return result.length > 0 ? result : null;
}

function fail(message) {
  throw new Error(`PASS25 build configuration rejected: ${message}`);
}

function optionalBoolean(value, fallback) {
  const raw = optionalTrimmed(value);
  if (raw === null) return fallback;
  if (raw === "true" || raw === "1") return true;
  if (raw === "false" || raw === "0") return false;
  fail("VELMERE_RUNTIME_OUTPUT_STANDALONE must be true/false or 1/0");
}

function optionalMemoryLimit(value, fallback) {
  const raw = optionalTrimmed(value);
  if (raw === null) return fallback;
  if (!/^\d+$/u.test(raw)) fail("VELMERE_TURBOPACK_MEMORY_LIMIT_BYTES must be an integer");
  const parsed = Number(raw);
  if (!Number.isSafeInteger(parsed) || parsed < 268435456 || parsed > 4294967296) {
    fail("VELMERE_TURBOPACK_MEMORY_LIMIT_BYTES must be between 268435456 and 4294967296");
  }
  return parsed;
}

export function resolveBuildProfile(environment = process.env) {
  const requested = optionalTrimmed(environment.VELMERE_BUILD_PROFILE) ?? "balanced";
  if (!Object.hasOwn(BUILD_PROFILE_DEFAULTS, requested)) {
    fail(`unsupported VELMERE_BUILD_PROFILE=${JSON.stringify(requested)}`);
  }
  const defaults = BUILD_PROFILE_DEFAULTS[requested];
  const rawCpuOverride = optionalTrimmed(environment.VELMERE_BUILD_CPUS);
  let cpus = defaults.cpus;
  if (rawCpuOverride !== null) {
    if (!/^\d+$/u.test(rawCpuOverride)) fail("VELMERE_BUILD_CPUS must be an integer from 1 to 4");
    cpus = Number(rawCpuOverride);
    if (!Number.isSafeInteger(cpus) || cpus < 1 || cpus > 4) {
      fail("VELMERE_BUILD_CPUS must be an integer from 1 to 4");
    }
  }
  const selected = { ...defaults, cpus };
  if (!selected.webpackBuildWorker && (selected.parallelServerCompiles || selected.parallelServerBuildTraces)) {
    fail(`profile ${requested} enables parallel server work while webpackBuildWorker is disabled`);
  }
  return Object.freeze({ name: requested, ...selected });
}

export function validateBuildScope(value) {
  const scope = optionalTrimmed(value);
  if (scope === null) return null;
  if (!SAFE_SCOPE.test(scope)) fail(`unsupported build scope ${JSON.stringify(scope)}`);
  return scope;
}

export function validateRuntimeDistDir(value, scope) {
  const configured = optionalTrimmed(value);
  if (scope === null) {
    if (configured !== null) fail("VELMERE_RUNTIME_DIST_DIR requires VELMERE_RUNTIME_BUILD_SCOPE");
    return null;
  }
  const distDir = configured ?? `.next-pass25-${scope}`;
  if (path.isAbsolute(distDir) || distDir.includes("\\") || distDir.includes("\0")) {
    fail("VELMERE_RUNTIME_DIST_DIR must be a portable relative path");
  }
  const normalized = path.posix.normalize(distDir);
  if (normalized !== distDir || normalized.startsWith("../") || normalized.includes("/../") || normalized === "." || normalized === "..") {
    fail("VELMERE_RUNTIME_DIST_DIR contains unsafe path traversal or normalization");
  }
  const expected = `.next-pass25-${scope}`;
  if (!SAFE_DIST_DIR.test(distDir) || distDir !== expected) {
    fail(`VELMERE_RUNTIME_DIST_DIR must equal ${expected}`);
  }
  return distDir;
}

export function validateBuildId(value) {
  const buildId = optionalTrimmed(value);
  if (buildId === null) return null;
  if (!SAFE_TOKEN.test(buildId)) fail("build ID must use 1-80 safe ASCII token characters");
  return buildId;
}

export function validateCheckpointSha(value) {
  const sha = optionalTrimmed(value);
  if (sha === null) return null;
  const normalized = sha.toLowerCase();
  if (!SHA256.test(normalized)) fail("VELMERE_CHECKPOINT_SOURCE_SHA256 must be exactly 64 lowercase hexadecimal characters");
  return normalized;
}

export function resolveBuildSettings(environment = process.env) {
  const profile = resolveBuildProfile(environment);
  const runtimeBuildScope = validateBuildScope(environment.VELMERE_RUNTIME_BUILD_SCOPE);
  const runtimeDistDir = validateRuntimeDistDir(environment.VELMERE_RUNTIME_DIST_DIR, runtimeBuildScope);
  const explicitBuildId = validateBuildId(environment.VELMERE_RUNTIME_BUILD_ID);
  const checkpointSha = validateCheckpointSha(environment.VELMERE_CHECKPOINT_SOURCE_SHA256);
  if (explicitBuildId !== null && runtimeBuildScope === null) {
    fail("VELMERE_RUNTIME_BUILD_ID requires VELMERE_RUNTIME_BUILD_SCOPE");
  }
  const runtimeBuildId = explicitBuildId ?? (checkpointSha ? `vlm-${checkpointSha.slice(0, 20)}` : null);
  const outputStandalone = optionalBoolean(environment.VELMERE_RUNTIME_OUTPUT_STANDALONE, runtimeBuildScope !== null);
  const turbopackMemoryLimit = optionalMemoryLimit(environment.VELMERE_TURBOPACK_MEMORY_LIMIT_BYTES, profile.turbopackMemoryLimit);
  if (runtimeBuildScope === null && outputStandalone) fail("standalone output requires VELMERE_RUNTIME_BUILD_SCOPE");
  return Object.freeze({
    profile,
    runtimeBuildScope,
    runtimeDistDir,
    runtimeBuildId,
    outputStandalone,
    turbopackMemoryLimit,
  });
}

export function safeBuildOutputPath(root, distDir) {
  const scope = distDir === ".next-pass25-webpack"
    ? "webpack"
    : distDir === ".next-pass25-turbopack"
      ? "turbopack"
      : null;
  const validated = validateRuntimeDistDir(distDir, validateBuildScope(scope));
  if (!validated) fail("a PASS25 build output directory is required");
  const resolvedRoot = path.resolve(root);
  const absolute = path.resolve(resolvedRoot, validated);
  if (path.dirname(absolute) !== resolvedRoot) fail("build output must be a direct child of the project root");
  return absolute;
}
