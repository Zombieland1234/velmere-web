import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";

const CONDITIONAL_EXPORT_PACKAGES = Object.freeze([
  Object.freeze({
    name: "@swc/helpers",
    requiredFiles: Object.freeze([
      "package.json",
      "esm/_interop_require_default.js",
      "esm/_interop_require_wildcard.js",
      "cjs/_interop_require_default.cjs",
      "cjs/_interop_require_wildcard.cjs",
    ]),
    reason: "Node 24 resolves the package's module-sync conditional export to ESM while Next output tracing may retain only the default CJS target.",
  }),
]);

function sha256File(file) {
  return createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

function assertPlainDirectory(file, label) {
  const stat = fs.lstatSync(file);
  if (stat.isSymbolicLink()) throw new Error(`${label} must not be a symlink`);
  if (!stat.isDirectory()) throw new Error(`${label} must be a directory`);
}

function copyTree(source, target, relative = "") {
  assertPlainDirectory(source, `runtime closure source:${relative || "."}`);
  fs.mkdirSync(target, { recursive: true });
  const entries = fs.readdirSync(source, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name));
  const files = [];
  for (const entry of entries) {
    const sourcePath = path.join(source, entry.name);
    const targetPath = path.join(target, entry.name);
    const rel = path.posix.join(relative.split(path.sep).join("/"), entry.name).replace(/^\//u, "");
    const stat = fs.lstatSync(sourcePath);
    if (stat.isSymbolicLink()) throw new Error(`runtime closure rejects symlink:${rel}`);
    if (stat.isDirectory()) {
      files.push(...copyTree(sourcePath, targetPath, rel));
      continue;
    }
    if (!stat.isFile()) throw new Error(`runtime closure rejects special file:${rel}`);
    const sourceSha256 = sha256File(sourcePath);
    let action = "COPIED";
    if (fs.existsSync(targetPath)) {
      const targetStat = fs.lstatSync(targetPath);
      if (targetStat.isSymbolicLink() || !targetStat.isFile()) throw new Error(`runtime closure target is not a plain file:${rel}`);
      action = sha256File(targetPath) === sourceSha256 ? "UNCHANGED" : "REPLACED";
    }
    fs.copyFileSync(sourcePath, targetPath);
    fs.chmodSync(targetPath, stat.mode & 0o777);
    const targetSha256 = sha256File(targetPath);
    if (targetSha256 !== sourceSha256) throw new Error(`runtime closure copy hash mismatch:${rel}`);
    files.push({ path: rel, bytes: stat.size, mode: stat.mode & 0o777, sha256: sourceSha256, action });
  }
  return files;
}

function packageLockRecord(root, packageName) {
  const lock = JSON.parse(fs.readFileSync(path.join(root, "package-lock.json"), "utf8"));
  return lock.packages?.[`node_modules/${packageName}`] ?? null;
}

export function closeStandaloneRuntime({ root, outputPath }) {
  const resolvedRoot = path.resolve(root);
  const resolvedOutput = path.resolve(outputPath);
  const relativeOutput = path.relative(resolvedRoot, resolvedOutput).split(path.sep).join("/");
  if (!relativeOutput.startsWith(".next-pass25-")) throw new Error("standalone runtime closure requires a safe PASS25 build output");
  const standaloneRoot = path.join(resolvedOutput, "standalone");
  assertPlainDirectory(standaloneRoot, "standalone root");
  const sourceBefore = CONDITIONAL_EXPORT_PACKAGES.map(({ name }) => {
    const source = path.join(resolvedRoot, "node_modules", ...name.split("/"));
    assertPlainDirectory(source, `source package:${name}`);
    return { name, source };
  });

  const packages = [];
  for (const descriptor of CONDITIONAL_EXPORT_PACKAGES) {
    const source = path.join(resolvedRoot, "node_modules", ...descriptor.name.split("/"));
    const target = path.join(standaloneRoot, "node_modules", ...descriptor.name.split("/"));
    const sourcePackageJson = JSON.parse(fs.readFileSync(path.join(source, "package.json"), "utf8"));
    const lockRecord = packageLockRecord(resolvedRoot, descriptor.name);
    if (!lockRecord) throw new Error(`lockfile record missing:${descriptor.name}`);
    if (lockRecord.version !== sourcePackageJson.version) throw new Error(`lock/source version mismatch:${descriptor.name}`);
    const files = copyTree(source, target);
    for (const required of descriptor.requiredFiles) {
      const requiredPath = path.join(target, ...required.split("/"));
      if (!fs.existsSync(requiredPath) || !fs.lstatSync(requiredPath).isFile()) {
        throw new Error(`runtime closure required file missing:${descriptor.name}/${required}`);
      }
    }
    packages.push({
      name: descriptor.name,
      version: sourcePackageJson.version,
      integrity: lockRecord.integrity ?? null,
      reason: descriptor.reason,
      source: path.relative(resolvedRoot, source).split(path.sep).join("/"),
      target: path.relative(resolvedRoot, target).split(path.sep).join("/"),
      fileCount: files.length,
      totalBytes: files.reduce((sum, row) => sum + row.bytes, 0),
      copied: files.filter((row) => row.action === "COPIED").length,
      replaced: files.filter((row) => row.action === "REPLACED").length,
      unchanged: files.filter((row) => row.action === "UNCHANGED").length,
      files,
    });
  }

  const assetSources = [
    {
      name: "nextStatic",
      source: path.join(resolvedOutput, "static"),
      target: path.join(standaloneRoot, path.basename(resolvedOutput), "static"),
      reason: "Next standalone does not copy browser CSS/JavaScript chunks automatically; the server must receive the exact build-bound static tree.",
    },
    {
      name: "public",
      source: path.join(resolvedRoot, "public"),
      target: path.join(standaloneRoot, "public"),
      reason: "Public browser assets are copied explicitly so the standalone runtime is complete and their bytes are recorded.",
    },
  ];
  const assets = assetSources.map((descriptor) => {
    assertPlainDirectory(descriptor.source, `runtime asset source:${descriptor.name}`);
    const files = copyTree(descriptor.source, descriptor.target);
    if (files.length === 0) throw new Error(`runtime asset source is empty:${descriptor.name}`);
    return {
      name: descriptor.name,
      reason: descriptor.reason,
      source: path.relative(resolvedRoot, descriptor.source).split(path.sep).join("/"),
      target: path.relative(resolvedRoot, descriptor.target).split(path.sep).join("/"),
      fileCount: files.length,
      totalBytes: files.reduce((sum, row) => sum + row.bytes, 0),
      copied: files.filter((row) => row.action === "COPIED").length,
      replaced: files.filter((row) => row.action === "REPLACED").length,
      unchanged: files.filter((row) => row.action === "UNCHANGED").length,
      files,
    };
  });

  return {
    schemaVersion: "velmere.standalone-runtime-closure.v2",
    status: "PASS",
    packages,
    assets,
    packageCount: packages.length,
    fileCount: packages.reduce((sum, row) => sum + row.fileCount, 0),
    totalBytes: packages.reduce((sum, row) => sum + row.totalBytes, 0),
    assetTreeCount: assets.length,
    assetFileCount: assets.reduce((sum, row) => sum + row.fileCount, 0),
    assetTotalBytes: assets.reduce((sum, row) => sum + row.totalBytes, 0),
    truthBoundary: "Exact lock-bound conditional-export packages, build-bound Next static chunks and public assets are copied into standalone output. Source bytes are read-only and every copied file is byte-verified.",
    sourcePackages: sourceBefore.map((row) => row.name),
  };
}
