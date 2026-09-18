import { execFileSync } from "node:child_process";
import path from "node:path";

const root = process.cwd();
const sourcePattern = /\.(?:ts|tsx|mts|cts)$/u;
const tracked = execFileSync("git", ["ls-files", "-z"], { encoding: "utf8" })
  .split("\0")
  .filter(Boolean)
  .filter((file) => sourcePattern.test(file))
  .map((file) => file.replaceAll("\\", "/"))
  .sort();

const tsc = path.join(root, "node_modules", ".bin", process.platform === "win32" ? "tsc.cmd" : "tsc");
const output = execFileSync(tsc, ["-p", "tsconfig.c14-all.json", "--listFilesOnly", "--pretty", "false"], {
  cwd: root,
  encoding: "utf8",
  maxBuffer: 64 * 1024 * 1024,
});
const compiled = new Set(
  output
    .split(/\r?\n/u)
    .filter(Boolean)
    .map((file) => path.resolve(file))
    .filter((file) => file === root || file.startsWith(root + path.sep))
    .map((file) => path.relative(root, file).replaceAll("\\", "/")),
);

const missing = tracked.filter((file) => !compiled.has(file));
const compiledTypeScript = [...compiled].filter((file) => sourcePattern.test(file));
const compiledFirstPartyTypeScript = compiledTypeScript
  .filter((file) => !file.startsWith("node_modules/"))
  .filter((file) => !file.startsWith(".next/"));
const unexpected = compiledFirstPartyTypeScript
  .filter((file) => !tracked.includes(file))
  .sort();

console.log(JSON.stringify({
  trackedTypeScriptFiles: tracked.length,
  compilerProgramTrackedTypeScriptFiles: tracked.filter((file) => compiled.has(file)).length,
  compilerProgramFirstPartyTypeScriptFiles: compiledFirstPartyTypeScript.length,
  compilerProgramTypeScriptFilesIncludingDependencies: compiledTypeScript.length,
  missingTrackedTypeScriptFiles: missing,
  generatedOrUntrackedFirstPartyTypeScriptFiles: unexpected,
}, null, 2));

if (missing.length > 0) {
  console.error("C14 TypeScript coverage gate failed: tracked TypeScript files are missing from tsconfig.c14-all.json.");
  process.exit(1);
}
