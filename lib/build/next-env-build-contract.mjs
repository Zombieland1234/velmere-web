import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

export function expectedNextEnvForDistDir(distDir) {
  if (!/^\.next-pass25-(?:webpack|turbopack)$/u.test(distDir)) {
    throw new Error(`managed_next_env_invalid_dist_dir:${distDir}`);
  }
  return [
    '/// <reference types="next" />',
    '/// <reference types="next/image-types/global" />',
    `import "./${distDir}/types/routes.d.ts";`,
    "",
    "// NOTE: This file should not be edited",
    "// see https://nextjs.org/docs/app/api-reference/config/typescript for more information.",
    "",
  ].join("\n");
}

export function stageManagedNextEnv(root, distDir) {
  const filePath = path.join(root, "next-env.d.ts");
  if (!fs.existsSync(filePath)) throw new Error("managed_next_env_missing_canonical_file");
  const original = fs.readFileSync(filePath);
  const expected = Buffer.from(expectedNextEnvForDistDir(distDir), "utf8");
  fs.writeFileSync(filePath, expected, { mode: 0o644 });
  return {
    filePath,
    original,
    expected,
    originalSha256: sha256(original),
    stagedSha256: sha256(expected),
  };
}

export function inspectManagedNextEnv(state) {
  const observed = fs.existsSync(state.filePath) ? fs.readFileSync(state.filePath) : null;
  return {
    exists: observed !== null,
    expectedSha256: state.stagedSha256,
    observedSha256: observed ? sha256(observed) : null,
    exactExpectedContent: observed ? observed.equals(state.expected) : false,
  };
}

export function restoreManagedNextEnv(state) {
  const temporary = `${state.filePath}.${process.pid}.restore.tmp`;
  fs.writeFileSync(temporary, state.original, { mode: 0o644 });
  fs.renameSync(temporary, state.filePath);
  const restored = fs.readFileSync(state.filePath);
  return {
    restored: restored.equals(state.original),
    restoredSha256: sha256(restored),
    originalSha256: state.originalSha256,
  };
}
