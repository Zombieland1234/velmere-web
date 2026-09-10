import { canonicalJson } from "@/lib/security/canonical-json";
import { sha256Digest } from "@/lib/security/cryptographic-digest";

export const PASS4813_SUPPLY_CHAIN_POLICY_ID = "pass4813-reproducible-supply-chain-v1" as const;
export const PASS4813_SBOM_SCHEMA = "velmere.supply-chain-sbom.v1" as const;
export const PASS4813_VULNERABILITY_SNAPSHOT_SCHEMA = "velmere.vulnerability-snapshot.v1" as const;
export const PASS4813_SOURCE_MANIFEST_SCHEMA = "velmere.source-manifest.v1" as const;
export const PASS4813_BUILD_RECIPE_SCHEMA = "velmere.hermetic-build-recipe.v1" as const;
export const PASS4813_BUILD_RUN_SCHEMA = "velmere.hermetic-build-run-receipt.v1" as const;
export const PASS4813_PROVENANCE_SCHEMA = "velmere.reproducible-build-provenance.v1" as const;

const DIGEST = /^sha256:[a-f0-9]{64}$/;
const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9._:/@+-]{2,255}$/;
const EXACT_NODE_VERSION = "24.18.0";
const EXACT_NPM_VERSION = "11.16.0";
const DETERMINISTIC_BUILD_ID_PREFIX_LENGTH = 20;
const DETERMINISTIC_BUILD_ID = /^vlm-[a-f0-9]{20}$/;
const MAX_BUILD_DURATION_MS = 2 * 60 * 60 * 1_000;
const MAX_VULNERABILITY_SNAPSHOT_AGE_MS = 24 * 60 * 60 * 1_000;

export type CommercialCohortSbomComponent = {
  bomRef: string;
  name: string;
  version: string;
  packagePath: string;
  packageUrl: string;
  integrity: string;
  resolved: string;
  resolvedHost: string;
  license: string | null;
  development: boolean;
  optional: boolean;
  direct: boolean;
  dependencyNames: string[];
  componentDigest: string;
};

export type CommercialCohortLockfileSbom = {
  schemaVersion: typeof PASS4813_SBOM_SCHEMA;
  policyVersion: typeof PASS4813_SUPPLY_CHAIN_POLICY_ID;
  packageManager: `npm@${string}`;
  lockfileVersion: number;
  rootName: string;
  rootVersion: string;
  packageJsonDigest: string;
  packageLockDigest: string;
  componentCount: number;
  directComponentCount: number;
  productionComponentCount: number;
  licenseEvidenceCount: number;
  licenseCoverageBps: number;
  sha512IntegrityCount: number;
  sha512IntegrityCoverageBps: number;
  registryHosts: string[];
  registryHostRoot: string;
  componentRoot: string;
  dependencyGraphRoot: string;
  components: CommercialCohortSbomComponent[];
  sbomDigest: string;
};

export type CommercialCohortVulnerabilityFinding = {
  advisoryId: string;
  packageName: string;
  severity: "low" | "moderate" | "high" | "critical" | "unknown";
  range: string;
  vulnerableNodeCount: number;
  fixAvailable: boolean | "semver-major" | "unknown";
  findingDigest: string;
};

export type CommercialCohortVulnerabilitySnapshot = {
  schemaVersion: typeof PASS4813_VULNERABILITY_SNAPSHOT_SCHEMA;
  policyVersion: typeof PASS4813_SUPPLY_CHAIN_POLICY_ID;
  source: "npm-audit-json";
  generatedAt: string;
  expiresAt: string;
  packageLockDigest: string;
  sbomDigest: string;
  sourceReportDigest: string;
  findings: CommercialCohortVulnerabilityFinding[];
  findingRoot: string;
  counts: Record<"low" | "moderate" | "high" | "critical" | "unknown", number>;
  productionGatePassed: boolean;
  snapshotDigest: string;
};

export type CommercialCohortSourceManifestEntry = {
  path: string;
  size: number;
  mode: number;
  digest: string;
};

export type CommercialCohortSourceManifest = {
  schemaVersion: typeof PASS4813_SOURCE_MANIFEST_SCHEMA;
  policyVersion: typeof PASS4813_SUPPLY_CHAIN_POLICY_ID;
  exclusionPolicyId: "pass4813-active-source-v1";
  entries: CommercialCohortSourceManifestEntry[];
  fileCount: number;
  totalBytes: number;
  packageJsonDigest: string;
  packageLockDigest: string;
  sourcePackageDigest: string;
};

export type CommercialCohortBuildRecipe = {
  schemaVersion: typeof PASS4813_BUILD_RECIPE_SCHEMA;
  policyVersion: typeof PASS4813_SUPPLY_CHAIN_POLICY_ID;
  nodeVersion: typeof EXACT_NODE_VERSION;
  npmVersion: typeof EXACT_NPM_VERSION;
  packageManager: `npm@${typeof EXACT_NPM_VERSION}`;
  installCommand: "npm ci --ignore-scripts=false --fund=false --audit=false";
  verificationCommands: ["npm run verify:runtime-contract", "npm run typecheck", "npm run lint", "npm run build"];
  smokeCommand: "npm run start -- --hostname 127.0.0.1";
  cleanInstallRequired: true;
  lockfileOnly: true;
  sourceDateEpoch: number;
  networkPolicy: "acquisition-only-then-deny";
  buildIdStrategy: "source-package-digest-prefix-v1";
  buildIdPrefixLength: typeof DETERMINISTIC_BUILD_ID_PREFIX_LENGTH;
  environmentAllowlist: string[];
  buildOutputRoots: string[];
  recipeDigest: string;
};

export type CommercialCohortBuildRunReceipt = {
  schemaVersion: typeof PASS4813_BUILD_RUN_SCHEMA;
  policyVersion: typeof PASS4813_SUPPLY_CHAIN_POLICY_ID;
  builderId: string;
  builderClass: string;
  workspaceId: string;
  runnerNonce: string;
  isolated: true;
  nodeVersion: typeof EXACT_NODE_VERSION;
  npmVersion: typeof EXACT_NPM_VERSION;
  sourcePackageDigest: string;
  packageLockDigest: string;
  sbomDigest: string;
  vulnerabilitySnapshotDigest: string;
  buildRecipeDigest: string;
  deterministicBuildId: string;
  npmTreeDigest: string;
  toolchainProvenanceDigest: string;
  osImageDigest: string;
  builderIsolationReceiptDigest: string;
  networkIsolationReceiptDigest: string;
  commandLogRoot: string;
  cleanInstallExitCode: 0;
  runtimeContractExitCode: 0;
  typecheckExitCode: 0;
  lintExitCode: 0;
  buildExitCode: 0;
  smokeExitCode: 0;
  workspaceSourceDigestAfterBuild: string;
  networkAccessObservedAfterAcquisition: false;
  outputDigest: string;
  outputFileCount: number;
  outputBytes: number;
  startedAt: string;
  finishedAt: string;
  receiptDigest: string;
};

export type CommercialCohortReproducibleBuildProvenance = {
  schemaVersion: typeof PASS4813_PROVENANCE_SCHEMA;
  policyVersion: typeof PASS4813_SUPPLY_CHAIN_POLICY_ID;
  environment: "staging" | "production";
  audience: string;
  sourceManifestDigest: string;
  sourcePackageDigest: string;
  packageLockDigest: string;
  sbomDigest: string;
  vulnerabilitySnapshotDigest: string;
  buildRecipeDigest: string;
  deterministicBuildId: string;
  buildArtifactDigest: string;
  toolchainProvenanceDigest: string;
  builderCount: number;
  independentBuilderRoot: string;
  buildRunReceiptRoot: string;
  vulnerabilityGatePassed: true;
  reproducible: true;
  issuedAt: string;
  expiresAt: string;
  provenanceDigest: string;
};

export type CommercialCohortSupplyChainVerification = {
  verified: boolean;
  reproducible: boolean;
  vulnerabilityGatePassed: boolean;
  builderCount: number;
  buildArtifactDigest: string | null;
  provenanceDigest: string | null;
  blockers: string[];
};

type PackageLockEntry = {
  name?: unknown;
  version?: unknown;
  resolved?: unknown;
  integrity?: unknown;
  license?: unknown;
  dev?: unknown;
  optional?: unknown;
  dependencies?: unknown;
};

type PackageLock = {
  lockfileVersion?: unknown;
  packages?: unknown;
};

function clean(value: unknown, max = 4096): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function requiredId(value: unknown, code: string, max = 256): string {
  const text = clean(value, max);
  if (!SAFE_ID.test(text)) throw new Error(code);
  return text;
}

function requiredDigest(value: unknown, code: string): string {
  const text = clean(value, 80).toLowerCase();
  if (!DIGEST.test(text)) throw new Error(code);
  return text;
}


export function deriveCommercialCohortDeterministicBuildId(sourcePackageDigest: string): string {
  const digest = requiredDigest(sourcePackageDigest, "deterministic_build_id_source_digest_invalid");
  const buildId = `vlm-${digest.slice("sha256:".length, "sha256:".length + DETERMINISTIC_BUILD_ID_PREFIX_LENGTH)}`;
  if (!DETERMINISTIC_BUILD_ID.test(buildId)) throw new Error("deterministic_build_id_invalid");
  return buildId;
}

function parseDate(value: unknown, code: string): Date {
  const text = clean(value, 64);
  const date = new Date(text);
  if (!text || !Number.isFinite(date.getTime())) throw new Error(code);
  return date;
}

function safeInteger(value: unknown, code: string, min = 0, max = Number.MAX_SAFE_INTEGER): number {
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < min || number > max) throw new Error(code);
  return number;
}

function normalizePath(value: unknown): string {
  const text = clean(value, 2048).replace(/\\/g, "/").replace(/^\.\//, "");
  if (!text || text.startsWith("/") || text.includes("\0") || text.split("/").some((part) => part === ".." || part === "")) {
    throw new Error("source_manifest_path_invalid");
  }
  return text;
}

function packageNameFromPath(packagePath: string, entry: PackageLockEntry): string {
  const explicit = clean(entry.name, 256);
  if (explicit) return explicit;
  const marker = "/node_modules/";
  const normalized = packagePath.replace(/\\/g, "/");
  const index = normalized.lastIndexOf(marker);
  const tail = index >= 0 ? normalized.slice(index + marker.length) : normalized.replace(/^node_modules\//, "");
  if (tail.startsWith("@")) {
    const [scope, name] = tail.split("/");
    return name ? `${scope}/${name}` : tail;
  }
  return tail.split("/")[0] ?? tail;
}

function packageUrl(name: string, version: string): string {
  const encoded = name.startsWith("@")
    ? `${encodeURIComponent(name.split("/")[0] ?? name)}/${encodeURIComponent(name.split("/")[1] ?? "")}`
    : encodeURIComponent(name);
  return `pkg:npm/${encoded}@${encodeURIComponent(version)}`;
}

function normalizeResolvedPackageUrl(value: unknown): { url: string; host: string } {
  const text = clean(value, 2048);
  let url: URL;
  try { url = new URL(text); } catch { throw new Error("sbom_component_resolved_url_invalid"); }
  if (url.protocol !== "https:" || !url.hostname || url.username || url.password || url.hash) throw new Error("sbom_component_resolved_url_invalid");
  return { url: url.toString(), host: url.hostname.toLowerCase() };
}

function normalizePackageIntegrity(value: unknown): string {
  const text = clean(value, 1024);
  if (!/^sha512-[A-Za-z0-9+/]+={0,2}$/.test(text)) throw new Error("sbom_component_integrity_not_sha512");
  return text;
}

function normalizeSeverity(value: unknown): CommercialCohortVulnerabilityFinding["severity"] {
  const text = clean(value, 32).toLowerCase();
  return text === "low" || text === "moderate" || text === "high" || text === "critical" ? text : "unknown";
}

function normalizeFixAvailable(value: unknown): CommercialCohortVulnerabilityFinding["fixAvailable"] {
  if (value === true || value === false) return value;
  if (value && typeof value === "object" && Boolean((value as { isSemVerMajor?: unknown }).isSemVerMajor)) return "semver-major";
  return "unknown";
}

function withDigest<T extends Record<string, unknown>, K extends string>(core: T, key: K): T & Record<K, string> {
  return { ...core, [key]: sha256Digest(canonicalJson(core)) } as T & Record<K, string>;
}

export function buildCommercialCohortLockfileSbom(args: {
  packageJsonText: string;
  packageLockText: string;
}): CommercialCohortLockfileSbom {
  const packageJsonText = String(args.packageJsonText ?? "");
  const packageLockText = String(args.packageLockText ?? "");
  const packageJson = JSON.parse(packageJsonText) as Record<string, unknown>;
  const lock = JSON.parse(packageLockText) as PackageLock;
  const lockfileVersion = safeInteger(lock.lockfileVersion, "sbom_lockfile_version_invalid", 3, 3);
  if (!lock.packages || typeof lock.packages !== "object" || Array.isArray(lock.packages)) throw new Error("sbom_lock_packages_invalid");
  const packageEntries = Object.entries(lock.packages as Record<string, PackageLockEntry>);
  const root = (lock.packages as Record<string, PackageLockEntry>)[""] ?? {};
  const rootName = clean(packageJson.name ?? root.name, 256);
  const rootVersion = clean(packageJson.version ?? root.version, 64);
  if (!rootName || !rootVersion) throw new Error("sbom_root_identity_invalid");
  const directNames = new Set<string>();
  for (const field of ["dependencies", "devDependencies", "optionalDependencies", "peerDependencies"] as const) {
    const record = packageJson[field];
    if (record && typeof record === "object" && !Array.isArray(record)) Object.keys(record as Record<string, unknown>).forEach((name) => directNames.add(name));
  }
  const components = packageEntries
    .filter(([packagePath]) => packagePath !== "")
    .map(([rawPath, entry]) => {
      const packagePath = normalizePath(rawPath);
      const name = packageNameFromPath(packagePath, entry);
      const version = clean(entry.version, 128);
      const integrity = normalizePackageIntegrity(entry.integrity);
      const resolvedMaterial = normalizeResolvedPackageUrl(entry.resolved);
      const resolved = resolvedMaterial.url;
      const resolvedHost = resolvedMaterial.host;
      if (!name || !version) throw new Error(`sbom_component_material_missing:${packagePath}`);
      const license = clean(entry.license, 256) || null;
      const dependencyNames = entry.dependencies && typeof entry.dependencies === "object" && !Array.isArray(entry.dependencies)
        ? Object.keys(entry.dependencies as Record<string, unknown>).sort()
        : [];
      const directPath = `node_modules/${name}`;
      const core = {
        bomRef: `${packageUrl(name, version)}?package_path=${encodeURIComponent(packagePath)}`,
        name,
        version,
        packagePath,
        packageUrl: packageUrl(name, version),
        integrity,
        resolved,
        resolvedHost,
        license,
        development: entry.dev === true,
        optional: entry.optional === true,
        direct: directNames.has(name) && packagePath === directPath,
        dependencyNames,
      };
      return withDigest(core, "componentDigest") as CommercialCohortSbomComponent;
    })
    .sort((left, right) => left.packagePath.localeCompare(right.packagePath));
  const componentRoot = sha256Digest(canonicalJson(components.map((item) => item.componentDigest)));
  const dependencyGraphRoot = sha256Digest(canonicalJson(components.map((item) => ({ bomRef: item.bomRef, dependencies: item.dependencyNames }))));
  const licenseEvidenceCount = components.filter((item) => Boolean(item.license)).length;
  const sha512IntegrityCount = components.filter((item) => item.integrity.startsWith("sha512-")).length;
  const registryHosts = Array.from(new Set(components.map((item) => item.resolvedHost))).sort();
  const core = {
    schemaVersion: PASS4813_SBOM_SCHEMA,
    policyVersion: PASS4813_SUPPLY_CHAIN_POLICY_ID,
    packageManager: `npm@${EXACT_NPM_VERSION}` as const,
    lockfileVersion,
    rootName,
    rootVersion,
    packageJsonDigest: sha256Digest(packageJsonText),
    packageLockDigest: sha256Digest(packageLockText),
    componentCount: components.length,
    directComponentCount: components.filter((item) => item.direct).length,
    productionComponentCount: components.filter((item) => !item.development).length,
    licenseEvidenceCount,
    licenseCoverageBps: components.length ? Math.floor((licenseEvidenceCount * 10_000) / components.length) : 0,
    sha512IntegrityCount,
    sha512IntegrityCoverageBps: components.length ? Math.floor((sha512IntegrityCount * 10_000) / components.length) : 0,
    registryHosts,
    registryHostRoot: sha256Digest(canonicalJson(registryHosts)),
    componentRoot,
    dependencyGraphRoot,
    components,
  };
  return withDigest(core, "sbomDigest") as CommercialCohortLockfileSbom;
}

export function verifyCommercialCohortLockfileSbom(args: {
  sbom: CommercialCohortLockfileSbom;
  packageJsonText: string;
  packageLockText: string;
}): string[] {
  const blockers: string[] = [];
  try {
    const rebuilt = buildCommercialCohortLockfileSbom({ packageJsonText: args.packageJsonText, packageLockText: args.packageLockText });
    if (canonicalJson(rebuilt) !== canonicalJson(args.sbom)) blockers.push("sbom_not_reproducible_from_lockfile");
    if (args.sbom.componentCount < 1) blockers.push("sbom_components_empty");
    if (args.sbom.licenseCoverageBps < 8_000) blockers.push(`sbom_license_coverage_below_floor:${args.sbom.licenseCoverageBps}/8000`);
    if (args.sbom.sha512IntegrityCoverageBps !== 10_000) blockers.push(`sbom_sha512_integrity_coverage_incomplete:${args.sbom.sha512IntegrityCoverageBps}/10000`);
    if (!args.sbom.registryHosts.length) blockers.push("sbom_registry_hosts_empty");
  } catch (error) {
    blockers.push(error instanceof Error ? error.message : "sbom_verification_failed");
  }
  return Array.from(new Set(blockers)).sort();
}

export function buildCommercialCohortVulnerabilitySnapshot(args: {
  auditReportText: string;
  packageLockDigest: string;
  sbomDigest: string;
  generatedAt: Date;
  expiresAt: Date;
}): CommercialCohortVulnerabilitySnapshot {
  const generatedAt = args.generatedAt;
  const expiresAt = args.expiresAt;
  if (!Number.isFinite(generatedAt.getTime()) || !Number.isFinite(expiresAt.getTime()) || expiresAt.getTime() <= generatedAt.getTime() || expiresAt.getTime() - generatedAt.getTime() > MAX_VULNERABILITY_SNAPSHOT_AGE_MS) {
    throw new Error("vulnerability_snapshot_window_invalid");
  }
  const reportText = String(args.auditReportText ?? "");
  const report = JSON.parse(reportText) as { auditReportVersion?: unknown; vulnerabilities?: unknown };
  if (safeInteger(report.auditReportVersion, "vulnerability_audit_report_version_invalid", 2, 2) !== 2) throw new Error("vulnerability_audit_report_version_invalid");
  if (!report.vulnerabilities || typeof report.vulnerabilities !== "object" || Array.isArray(report.vulnerabilities)) throw new Error("vulnerability_report_shape_invalid");
  const findings: CommercialCohortVulnerabilityFinding[] = [];
  for (const [packageName, raw] of Object.entries(report.vulnerabilities as Record<string, Record<string, unknown>>)) {
    const severity = normalizeSeverity(raw.severity);
    const range = clean(raw.range, 512) || "unknown";
    const nodes = Array.isArray(raw.nodes) ? raw.nodes.map((item) => clean(item, 512)).filter(Boolean) : [];
    const via = Array.isArray(raw.via) ? raw.via : [];
    const advisoryIds = via
      .map((item) => typeof item === "object" && item && !Array.isArray(item)
        ? clean((item as Record<string, unknown>).source ?? (item as Record<string, unknown>).url ?? (item as Record<string, unknown>).title, 512)
        : clean(item, 512))
      .filter(Boolean);
    const ids = advisoryIds.length ? advisoryIds : [`npm-audit:${packageName}:${severity}:${range}`];
    for (const advisoryId of Array.from(new Set(ids)).sort()) {
      const core = {
        advisoryId,
        packageName: requiredId(packageName, "vulnerability_package_name_invalid"),
        severity,
        range,
        vulnerableNodeCount: nodes.length,
        fixAvailable: normalizeFixAvailable(raw.fixAvailable),
      };
      findings.push(withDigest(core, "findingDigest") as CommercialCohortVulnerabilityFinding);
    }
  }
  findings.sort((left, right) => left.packageName.localeCompare(right.packageName) || left.advisoryId.localeCompare(right.advisoryId));
  const counts = { low: 0, moderate: 0, high: 0, critical: 0, unknown: 0 };
  findings.forEach((item) => { counts[item.severity] += 1; });
  const core = {
    schemaVersion: PASS4813_VULNERABILITY_SNAPSHOT_SCHEMA,
    policyVersion: PASS4813_SUPPLY_CHAIN_POLICY_ID,
    source: "npm-audit-json" as const,
    generatedAt: generatedAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
    packageLockDigest: requiredDigest(args.packageLockDigest, "vulnerability_package_lock_digest_invalid"),
    sbomDigest: requiredDigest(args.sbomDigest, "vulnerability_sbom_digest_invalid"),
    sourceReportDigest: sha256Digest(reportText),
    findings,
    findingRoot: sha256Digest(canonicalJson(findings.map((item) => item.findingDigest))),
    counts,
    productionGatePassed: counts.critical === 0 && counts.high === 0 && counts.unknown === 0,
  };
  return withDigest(core, "snapshotDigest") as CommercialCohortVulnerabilitySnapshot;
}

export function buildCommercialCohortSourceManifest(args: {
  entries: CommercialCohortSourceManifestEntry[];
  packageJsonDigest: string;
  packageLockDigest: string;
}): CommercialCohortSourceManifest {
  const seen = new Set<string>();
  const entries = (args.entries ?? []).map((entry) => {
    const normalized = {
      path: normalizePath(entry.path),
      size: safeInteger(entry.size, "source_manifest_size_invalid", 0, 2 ** 40),
      mode: safeInteger(entry.mode, "source_manifest_mode_invalid", 0, 0o777),
      digest: requiredDigest(entry.digest, "source_manifest_digest_invalid"),
    };
    if (seen.has(normalized.path)) throw new Error(`source_manifest_duplicate_path:${normalized.path}`);
    seen.add(normalized.path);
    return normalized;
  }).sort((left, right) => left.path.localeCompare(right.path));
  if (!entries.length) throw new Error("source_manifest_empty");
  const packageJsonDigest = requiredDigest(args.packageJsonDigest, "source_manifest_package_json_digest_invalid");
  const packageLockDigest = requiredDigest(args.packageLockDigest, "source_manifest_package_lock_digest_invalid");
  const byPath = new Map(entries.map((item) => [item.path, item]));
  if (byPath.get("package.json")?.digest !== packageJsonDigest) throw new Error("source_manifest_package_json_binding_invalid");
  if (byPath.get("package-lock.json")?.digest !== packageLockDigest) throw new Error("source_manifest_package_lock_binding_invalid");
  const core = {
    schemaVersion: PASS4813_SOURCE_MANIFEST_SCHEMA,
    policyVersion: PASS4813_SUPPLY_CHAIN_POLICY_ID,
    exclusionPolicyId: "pass4813-active-source-v1" as const,
    entries,
    fileCount: entries.length,
    totalBytes: entries.reduce((sum, item) => sum + item.size, 0),
    packageJsonDigest,
    packageLockDigest,
  };
  return withDigest(core, "sourcePackageDigest") as CommercialCohortSourceManifest;
}

export function buildCommercialCohortBuildRecipe(args: {
  sourceDateEpoch: number;
  environmentAllowlist?: string[];
  buildOutputRoots?: string[];
}): CommercialCohortBuildRecipe {
  const environmentAllowlist = Array.from(new Set((args.environmentAllowlist ?? [
    "CI", "HOME", "LANG", "LC_ALL", "NODE_ENV", "PATH", "SOURCE_DATE_EPOCH", "TZ",
  ]).map((item) => {
    const key = clean(item, 128);
    if (!/^[A-Z][A-Z0-9_]{1,127}$/.test(key)) throw new Error("build_recipe_environment_key_invalid");
    return key;
  }))).sort();
  const buildOutputRoots = Array.from(new Set((args.buildOutputRoots ?? [".next", "public"]).map((item) => normalizePath(item)))).sort();
  const core = {
    schemaVersion: PASS4813_BUILD_RECIPE_SCHEMA,
    policyVersion: PASS4813_SUPPLY_CHAIN_POLICY_ID,
    nodeVersion: EXACT_NODE_VERSION,
    npmVersion: EXACT_NPM_VERSION,
    packageManager: `npm@${EXACT_NPM_VERSION}` as const,
    installCommand: "npm ci --ignore-scripts=false --fund=false --audit=false" as const,
    verificationCommands: ["npm run verify:runtime-contract", "npm run typecheck", "npm run lint", "npm run build"] as const,
    smokeCommand: "npm run start -- --hostname 127.0.0.1" as const,
    cleanInstallRequired: true as const,
    lockfileOnly: true as const,
    sourceDateEpoch: safeInteger(args.sourceDateEpoch, "build_recipe_source_date_epoch_invalid", 1, 4_102_444_800),
    networkPolicy: "acquisition-only-then-deny" as const,
    buildIdStrategy: "source-package-digest-prefix-v1" as const,
    buildIdPrefixLength: DETERMINISTIC_BUILD_ID_PREFIX_LENGTH,
    environmentAllowlist,
    buildOutputRoots,
  };
  return withDigest(core, "recipeDigest") as CommercialCohortBuildRecipe;
}

export function finalizeCommercialCohortBuildRunReceipt(input: Omit<CommercialCohortBuildRunReceipt, "schemaVersion" | "policyVersion" | "receiptDigest">): CommercialCohortBuildRunReceipt {
  const startedAt = parseDate(input.startedAt, "build_run_started_at_invalid");
  const finishedAt = parseDate(input.finishedAt, "build_run_finished_at_invalid");
  if (finishedAt.getTime() <= startedAt.getTime() || finishedAt.getTime() - startedAt.getTime() > MAX_BUILD_DURATION_MS) throw new Error("build_run_duration_invalid");
  if (input.nodeVersion !== EXACT_NODE_VERSION || input.npmVersion !== EXACT_NPM_VERSION) throw new Error("build_run_toolchain_invalid");
  const core = {
    schemaVersion: PASS4813_BUILD_RUN_SCHEMA,
    policyVersion: PASS4813_SUPPLY_CHAIN_POLICY_ID,
    builderId: requiredId(input.builderId, "build_run_builder_id_invalid"),
    builderClass: requiredId(input.builderClass, "build_run_builder_class_invalid"),
    workspaceId: requiredId(input.workspaceId, "build_run_workspace_id_invalid"),
    runnerNonce: requiredId(input.runnerNonce, "build_run_nonce_invalid"),
    isolated: true as const,
    nodeVersion: EXACT_NODE_VERSION,
    npmVersion: EXACT_NPM_VERSION,
    sourcePackageDigest: requiredDigest(input.sourcePackageDigest, "build_run_source_digest_invalid"),
    packageLockDigest: requiredDigest(input.packageLockDigest, "build_run_lock_digest_invalid"),
    sbomDigest: requiredDigest(input.sbomDigest, "build_run_sbom_digest_invalid"),
    vulnerabilitySnapshotDigest: requiredDigest(input.vulnerabilitySnapshotDigest, "build_run_vulnerability_digest_invalid"),
    buildRecipeDigest: requiredDigest(input.buildRecipeDigest, "build_run_recipe_digest_invalid"),
    deterministicBuildId: clean(input.deterministicBuildId, 64),
    npmTreeDigest: requiredDigest(input.npmTreeDigest, "build_run_npm_tree_digest_invalid"),
    toolchainProvenanceDigest: requiredDigest(input.toolchainProvenanceDigest, "build_run_toolchain_provenance_digest_invalid"),
    osImageDigest: requiredDigest(input.osImageDigest, "build_run_os_image_digest_invalid"),
    builderIsolationReceiptDigest: requiredDigest(input.builderIsolationReceiptDigest, "build_run_builder_isolation_digest_invalid"),
    networkIsolationReceiptDigest: requiredDigest(input.networkIsolationReceiptDigest, "build_run_network_isolation_digest_invalid"),
    commandLogRoot: requiredDigest(input.commandLogRoot, "build_run_command_log_root_invalid"),
    cleanInstallExitCode: input.cleanInstallExitCode === 0 ? 0 as const : (() => { throw new Error("build_run_clean_install_failed"); })(),
    runtimeContractExitCode: input.runtimeContractExitCode === 0 ? 0 as const : (() => { throw new Error("build_run_runtime_contract_failed"); })(),
    typecheckExitCode: input.typecheckExitCode === 0 ? 0 as const : (() => { throw new Error("build_run_typecheck_failed"); })(),
    lintExitCode: input.lintExitCode === 0 ? 0 as const : (() => { throw new Error("build_run_lint_failed"); })(),
    buildExitCode: input.buildExitCode === 0 ? 0 as const : (() => { throw new Error("build_run_build_failed"); })(),
    smokeExitCode: input.smokeExitCode === 0 ? 0 as const : (() => { throw new Error("build_run_smoke_failed"); })(),
    workspaceSourceDigestAfterBuild: requiredDigest(input.workspaceSourceDigestAfterBuild, "build_run_post_source_digest_invalid"),
    networkAccessObservedAfterAcquisition: input.networkAccessObservedAfterAcquisition === false ? false as const : (() => { throw new Error("build_run_network_access_observed"); })(),
    outputDigest: requiredDigest(input.outputDigest, "build_run_output_digest_invalid"),
    outputFileCount: safeInteger(input.outputFileCount, "build_run_output_file_count_invalid", 1, 10_000_000),
    outputBytes: safeInteger(input.outputBytes, "build_run_output_bytes_invalid", 1, 2 ** 50),
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
  };
  if (core.workspaceSourceDigestAfterBuild !== core.sourcePackageDigest) throw new Error("build_run_source_mutated");
  const expectedBuildId = deriveCommercialCohortDeterministicBuildId(core.sourcePackageDigest);
  if (core.deterministicBuildId !== expectedBuildId || !DETERMINISTIC_BUILD_ID.test(core.deterministicBuildId)) throw new Error("build_run_deterministic_build_id_mismatch");
  return withDigest(core, "receiptDigest") as CommercialCohortBuildRunReceipt;
}

export function buildCommercialCohortReproducibleBuildProvenance(args: {
  environment: "staging" | "production";
  audience: string;
  sourceManifest: CommercialCohortSourceManifest;
  sbom: CommercialCohortLockfileSbom;
  vulnerabilitySnapshot: CommercialCohortVulnerabilitySnapshot;
  buildRecipe: CommercialCohortBuildRecipe;
  buildRuns: CommercialCohortBuildRunReceipt[];
  issuedAt: Date;
  expiresAt: Date;
}): CommercialCohortReproducibleBuildProvenance {
  const issuedAt = args.issuedAt;
  const expiresAt = args.expiresAt;
  if (!Number.isFinite(issuedAt.getTime()) || !Number.isFinite(expiresAt.getTime()) || expiresAt.getTime() <= issuedAt.getTime() || expiresAt.getTime() - issuedAt.getTime() > 24 * 60 * 60 * 1_000) {
    throw new Error("supply_chain_provenance_window_invalid");
  }
  const vulnerabilityExpiry = parseDate(args.vulnerabilitySnapshot.expiresAt, "vulnerability_snapshot_expires_at_invalid");
  if (vulnerabilityExpiry.getTime() < expiresAt.getTime()) throw new Error("supply_chain_provenance_outlives_vulnerability_snapshot");
  if (!args.vulnerabilitySnapshot.productionGatePassed) throw new Error("supply_chain_vulnerability_gate_failed");
  if (args.sbom.packageLockDigest !== args.sourceManifest.packageLockDigest || args.vulnerabilitySnapshot.packageLockDigest !== args.sbom.packageLockDigest) throw new Error("supply_chain_lockfile_binding_invalid");
  if (args.vulnerabilitySnapshot.sbomDigest !== args.sbom.sbomDigest) throw new Error("supply_chain_sbom_binding_invalid");
  if (args.buildRuns.length < 2 || args.buildRuns.length > 8) throw new Error("supply_chain_builder_quorum_invalid");
  const builderIds = new Set<string>();
  const workspaceIds = new Set<string>();
  const nonces = new Set<string>();
  const outputDigests = new Set<string>();
  const toolchainDigests = new Set<string>();
  const deterministicBuildIds = new Set<string>();
  const expectedDeterministicBuildId = deriveCommercialCohortDeterministicBuildId(args.sourceManifest.sourcePackageDigest);
  if (args.buildRecipe.buildIdStrategy !== "source-package-digest-prefix-v1" || args.buildRecipe.buildIdPrefixLength !== DETERMINISTIC_BUILD_ID_PREFIX_LENGTH) throw new Error("supply_chain_build_id_recipe_invalid");
  const normalizedRuns = args.buildRuns.map((run) => {
    const finalized = finalizeCommercialCohortBuildRunReceipt(run);
    if (builderIds.has(finalized.builderId)) throw new Error("supply_chain_builder_reused");
    if (workspaceIds.has(finalized.workspaceId)) throw new Error("supply_chain_workspace_reused");
    if (nonces.has(finalized.runnerNonce)) throw new Error("supply_chain_runner_nonce_reused");
    builderIds.add(finalized.builderId);
    workspaceIds.add(finalized.workspaceId);
    nonces.add(finalized.runnerNonce);
    outputDigests.add(finalized.outputDigest);
    toolchainDigests.add(finalized.toolchainProvenanceDigest);
    deterministicBuildIds.add(finalized.deterministicBuildId);
    if (finalized.sourcePackageDigest !== args.sourceManifest.sourcePackageDigest) throw new Error("supply_chain_build_source_mismatch");
    if (finalized.packageLockDigest !== args.sbom.packageLockDigest) throw new Error("supply_chain_build_lockfile_mismatch");
    if (finalized.sbomDigest !== args.sbom.sbomDigest) throw new Error("supply_chain_build_sbom_mismatch");
    if (finalized.vulnerabilitySnapshotDigest !== args.vulnerabilitySnapshot.snapshotDigest) throw new Error("supply_chain_build_vulnerability_mismatch");
    if (finalized.buildRecipeDigest !== args.buildRecipe.recipeDigest) throw new Error("supply_chain_build_recipe_mismatch");
    if (finalized.deterministicBuildId !== expectedDeterministicBuildId) throw new Error("supply_chain_build_id_mismatch");
    return finalized;
  }).sort((left, right) => left.builderId.localeCompare(right.builderId));
  if (outputDigests.size !== 1) throw new Error("supply_chain_build_not_reproducible");
  if (toolchainDigests.size !== 1) throw new Error("supply_chain_toolchain_provenance_mismatch");
  if (deterministicBuildIds.size !== 1 || !deterministicBuildIds.has(expectedDeterministicBuildId)) throw new Error("supply_chain_deterministic_build_id_mismatch");
  const buildArtifactDigest = normalizedRuns[0]!.outputDigest;
  const core = {
    schemaVersion: PASS4813_PROVENANCE_SCHEMA,
    policyVersion: PASS4813_SUPPLY_CHAIN_POLICY_ID,
    environment: args.environment,
    audience: requiredId(args.audience, "supply_chain_audience_invalid"),
    sourceManifestDigest: args.sourceManifest.sourcePackageDigest,
    sourcePackageDigest: args.sourceManifest.sourcePackageDigest,
    packageLockDigest: args.sbom.packageLockDigest,
    sbomDigest: args.sbom.sbomDigest,
    vulnerabilitySnapshotDigest: args.vulnerabilitySnapshot.snapshotDigest,
    buildRecipeDigest: args.buildRecipe.recipeDigest,
    deterministicBuildId: expectedDeterministicBuildId,
    buildArtifactDigest,
    toolchainProvenanceDigest: normalizedRuns[0]!.toolchainProvenanceDigest,
    builderCount: normalizedRuns.length,
    independentBuilderRoot: sha256Digest(canonicalJson(normalizedRuns.map((run) => ({ builderId: run.builderId, builderClass: run.builderClass, workspaceId: run.workspaceId, runnerNonce: run.runnerNonce, osImageDigest: run.osImageDigest, builderIsolationReceiptDigest: run.builderIsolationReceiptDigest, networkIsolationReceiptDigest: run.networkIsolationReceiptDigest })))),
    buildRunReceiptRoot: sha256Digest(canonicalJson(normalizedRuns.map((run) => run.receiptDigest))),
    vulnerabilityGatePassed: true as const,
    reproducible: true as const,
    issuedAt: issuedAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
  };
  return withDigest(core, "provenanceDigest") as CommercialCohortReproducibleBuildProvenance;
}

export function verifyCommercialCohortReproducibleBuildProvenance(args: {
  provenance: CommercialCohortReproducibleBuildProvenance;
  sourceManifest: CommercialCohortSourceManifest;
  sbom: CommercialCohortLockfileSbom;
  vulnerabilitySnapshot: CommercialCohortVulnerabilitySnapshot;
  buildRecipe: CommercialCohortBuildRecipe;
  buildRuns: CommercialCohortBuildRunReceipt[];
  expectedEnvironment: "staging" | "production";
  expectedAudience: string;
  now?: Date;
}): CommercialCohortSupplyChainVerification {
  const blockers: string[] = [];
  let rebuilt: CommercialCohortReproducibleBuildProvenance | null = null;
  try {
    const now = args.now ?? new Date();
    const issuedAt = parseDate(args.provenance.issuedAt, "supply_chain_provenance_issued_at_invalid");
    const expiresAt = parseDate(args.provenance.expiresAt, "supply_chain_provenance_expires_at_invalid");
    if (now.getTime() < issuedAt.getTime() - 60_000) blockers.push("supply_chain_provenance_not_active");
    if (now.getTime() >= expiresAt.getTime()) blockers.push("supply_chain_provenance_expired");
    if (args.provenance.environment !== args.expectedEnvironment || args.provenance.audience !== args.expectedAudience) blockers.push("supply_chain_provenance_identity_mismatch");
    rebuilt = buildCommercialCohortReproducibleBuildProvenance({
      environment: args.provenance.environment,
      audience: args.provenance.audience,
      sourceManifest: args.sourceManifest,
      sbom: args.sbom,
      vulnerabilitySnapshot: args.vulnerabilitySnapshot,
      buildRecipe: args.buildRecipe,
      buildRuns: args.buildRuns,
      issuedAt,
      expiresAt,
    });
    if (canonicalJson(rebuilt) !== canonicalJson(args.provenance)) blockers.push("supply_chain_provenance_digest_or_content_mismatch");
  } catch (error) {
    blockers.push(error instanceof Error ? error.message : "supply_chain_provenance_verification_failed");
  }
  const uniqueBlockers = Array.from(new Set(blockers.filter(Boolean))).sort();
  return {
    verified: uniqueBlockers.length === 0 && Boolean(rebuilt),
    reproducible: uniqueBlockers.length === 0 && Boolean(rebuilt?.reproducible),
    vulnerabilityGatePassed: uniqueBlockers.length === 0 && Boolean(rebuilt?.vulnerabilityGatePassed),
    builderCount: rebuilt?.builderCount ?? 0,
    buildArtifactDigest: rebuilt?.buildArtifactDigest ?? null,
    provenanceDigest: rebuilt?.provenanceDigest ?? null,
    blockers: uniqueBlockers,
  };
}

export const PASS4813_REQUIRED_NODE_VERSION = EXACT_NODE_VERSION;
export const PASS4813_REQUIRED_NPM_VERSION = EXACT_NPM_VERSION;
