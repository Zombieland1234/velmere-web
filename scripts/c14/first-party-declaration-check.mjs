import { execFileSync } from "node:child_process";
import path from "node:path";
import ts from "typescript";

const root = process.cwd();
const declarationPattern = /\.d\.(?:ts|mts|cts)$/u;
const trackedDeclarations = new Set(
  execFileSync("git", ["ls-files", "-z"], { encoding: "utf8" })
    .split("\0")
    .filter(Boolean)
    .filter((file) => declarationPattern.test(file))
    .map((file) => file.replaceAll("\\", "/")),
);

const configPath = path.join(root, "tsconfig.c14-all.json");
const configFile = ts.readConfigFile(configPath, ts.sys.readFile);
if (configFile.error) {
  console.error(ts.formatDiagnostics([configFile.error], {
    getCanonicalFileName: (file) => file,
    getCurrentDirectory: () => root,
    getNewLine: () => "\n",
  }));
  process.exit(1);
}

const parsed = ts.parseJsonConfigFileContent(
  configFile.config,
  ts.sys,
  root,
  { skipLibCheck: false, incremental: false, noEmit: true },
  configPath,
);

const program = ts.createProgram({
  rootNames: parsed.fileNames,
  options: parsed.options,
  projectReferences: parsed.projectReferences,
});
const allDiagnostics = ts.getPreEmitDiagnostics(program);
const firstPartyDeclarationDiagnostics = allDiagnostics.filter((diagnostic) => {
  if (!diagnostic.file) return false;
  const relative = path.relative(root, diagnostic.file.fileName).replaceAll("\\", "/");
  return trackedDeclarations.has(relative);
});

const result = {
  trackedFirstPartyDeclarationFiles: trackedDeclarations.size,
  firstPartyDeclarationDiagnostics: firstPartyDeclarationDiagnostics.length,
  dependencyDeclarationDiagnosticsIgnoredForThisFocusedGate:
    allDiagnostics.filter((diagnostic) => {
      if (!diagnostic.file) return false;
      const relative = path.relative(root, diagnostic.file.fileName).replaceAll("\\", "/");
      return relative.startsWith("node_modules/") && declarationPattern.test(relative);
    }).length,
};
console.log(JSON.stringify(result, null, 2));

if (firstPartyDeclarationDiagnostics.length > 0) {
  console.error(ts.formatDiagnosticsWithColorAndContext(firstPartyDeclarationDiagnostics, {
    getCanonicalFileName: (file) => file,
    getCurrentDirectory: () => root,
    getNewLine: () => "\n",
  }));
  process.exit(1);
}
