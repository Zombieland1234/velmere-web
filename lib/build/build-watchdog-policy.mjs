import path from "node:path";
import { safeBuildOutputPath } from "./build-profile.mjs";

const PATTERNS = Object.freeze({
  config: [
    /Cannot access .* before initialization/iu,
    /Invalid next\.config/iu,
    /Unrecognized key\(s\).*next\.config/iu,
    /Failed to load next\.config/iu,
  ],
  dependency: [
    /ERR_MODULE_NOT_FOUND/iu,
    /Cannot find (?:module|package)/iu,
    /Module not found/iu,
  ],
  oom: [
    /heap out of memory/iu,
    /Allocation failed - JavaScript heap/iu,
    /\bENOMEM\b/iu,
    /out of memory/iu,
  ],
  disk: [
    /\bENOSPC\b/iu,
    /no space left on device/iu,
  ],
  typecheck: [
    /Type error:/iu,
    /Failed to compile[\s\S]{0,500}TypeScript/iu,
  ],
  compile: [
    /Failed to compile/iu,
    /Build failed because of webpack errors/iu,
  ],
});

function matchesAny(text, patterns) {
  return patterns.some((pattern) => pattern.test(text));
}

export function classifyBuildResult({
  exitCode,
  signal,
  timedOut = false,
  stalled = false,
  spawnError = null,
  sourceImmutable = true,
  logText = "",
  outputContractOk = false,
}) {
  if (!sourceImmutable) return "FAIL_SOURCE_MUTATION";
  if (spawnError) return "FAIL_SPAWN";
  if (matchesAny(logText, PATTERNS.oom) || signal === "SIGABRT") return "FAIL_OOM";
  if (matchesAny(logText, PATTERNS.disk)) return "FAIL_DISK";
  if (matchesAny(logText, PATTERNS.config)) return "FAIL_CONFIG";
  if (matchesAny(logText, PATTERNS.dependency)) return "FAIL_DEPENDENCY";
  if (matchesAny(logText, PATTERNS.typecheck)) return "FAIL_TYPECHECK";
  if (stalled) return "FAIL_STALL";
  if (timedOut) return "FAIL_TIMEOUT";
  if (matchesAny(logText, PATTERNS.compile)) return "FAIL_COMPILE";
  if (exitCode !== 0) return "FAIL";
  if (!outputContractOk) return "FAIL_OUTPUT_CONTRACT";
  return "PASS";
}

export function assertSafeBuildOutput(root, distDir) {
  const absolute = safeBuildOutputPath(root, distDir);
  const relative = path.relative(path.resolve(root), absolute).split(path.sep).join("/");
  if (!relative.startsWith(".next-pass25-")) throw new Error("unsafe PASS25 build output");
  return { absolute, relative };
}

export function expectedBuildOutputContract(root, distDir, buildId) {
  const { absolute, relative } = assertSafeBuildOutput(root, distDir);
  return {
    absolute,
    relative,
    buildId,
    buildIdPath: path.join(absolute, "BUILD_ID"),
    routesManifestPath: path.join(absolute, "routes-manifest.json"),
    requiredServerManifestPath: path.join(absolute, "server", "app-paths-manifest.json"),
    standalonePath: path.join(absolute, "standalone"),
    standaloneServerPath: path.join(absolute, "standalone", "server.js"),
    standaloneNextBootstrapPath: path.join(absolute, "standalone", "node_modules", "next", "dist", "server", "next.js"),
    standaloneStartServerPath: path.join(absolute, "standalone", "node_modules", "next", "dist", "server", "lib", "start-server.js"),
    standaloneSwcInteropDefaultPath: path.join(absolute, "standalone", "node_modules", "@swc", "helpers", "esm", "_interop_require_default.js"),
    standaloneSwcInteropWildcardPath: path.join(absolute, "standalone", "node_modules", "@swc", "helpers", "esm", "_interop_require_wildcard.js"),
    standaloneBuildIdPath: path.join(absolute, "standalone", distDir, "BUILD_ID"),
    standaloneStaticPath: path.join(absolute, "standalone", distDir, "static"),
    standalonePublicPath: path.join(absolute, "standalone", "public"),
  };
}
