const SAFE_INHERITED_NAMES = new Set([
  "CI",
  "LANG",
  "LC_ALL",
  "PATH",
  "SOURCE_DATE_EPOCH",
  "SYSTEMROOT",
  "TEMP",
  "TERM",
  "TMP",
  "TMPDIR",
  "TZ",
]);

const SAFE_INHERITED_PREFIXES = [
  "NEXT_PUBLIC_",
  "VELMERE_BUILD_",
  "VELMERE_CHECKPOINT_",
  "VELMERE_RUNTIME_",
  "VELMERE_TURBOPACK_",
];

const FORBIDDEN_NAME = /(?:SECRET|TOKEN|PASSWORD|PRIVATE|CREDENTIAL|COOKIE|AUTHORIZATION|SERVICE_ROLE|DATABASE_URL|REDIS_URL)/iu;
const A60_RUNTIME_PROBE_NAME = "VELMERE_A60_RUNTIME_PROBE_SHA256";
const SHA256_HEX = /^[a-f0-9]{64}$/u;

function safeInheritedName(name) {
  if (FORBIDDEN_NAME.test(name)) return false;
  return SAFE_INHERITED_NAMES.has(name)
    || SAFE_INHERITED_PREFIXES.some((prefix) => name.startsWith(prefix));
}

export function sanitizedBuildEnvironment(parentEnv = process.env, overrides = {}) {
  const env = {};
  const inheritedKeys = [];
  const droppedSensitiveKeys = [];
  for (const [name, value] of Object.entries(parentEnv)) {
    if (value === undefined) continue;
    if (safeInheritedName(name)) {
      env[name] = value;
      inheritedKeys.push(name);
    } else if (FORBIDDEN_NAME.test(name)) {
      droppedSensitiveKeys.push(name);
    }
  }
  for (const [name, value] of Object.entries(overrides)) {
    if (value === undefined) continue;
    if (FORBIDDEN_NAME.test(name)) {
      throw new Error(`build_environment_override_forbidden:${name}`);
    }
    if (name === A60_RUNTIME_PROBE_NAME && !SHA256_HEX.test(String(value))) {
      throw new Error("build_environment_a60_runtime_probe_invalid");
    }
    env[name] = String(value);
  }
  return {
    env,
    receipt: {
      schemaVersion: "velmere.pass36.a93.sanitized-build-environment.v1",
      inheritedKeys: inheritedKeys.sort(),
      droppedSensitiveKeyCount: droppedSensitiveKeys.length,
      droppedSensitiveKeyNamesSha256: createHash("sha256")
        .update(droppedSensitiveKeys.sort().join("\n"))
        .digest("hex"),
      parentValueDisclosure: false,
      boundary:
        "Build children receive only an explicit system/public/build-control allowlist. Secret-like parent names and all parent values outside that allowlist are withheld.",
    },
  };
}
import { createHash } from "node:crypto";
