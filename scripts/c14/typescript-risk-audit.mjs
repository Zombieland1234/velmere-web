import { execFileSync } from "node:child_process";
import fs from "node:fs";
import ts from "typescript";

const argv = process.argv.slice(2);
const jsonArg = argv.find((arg) => arg.startsWith("--json="));
const jsonPath = jsonArg ? jsonArg.slice("--json=".length) : null;
const files = execFileSync("git", ["ls-files", "-z"], { encoding: "utf8" })
  .split("\0")
  .filter(Boolean)
  .filter((file) => /\.(?:ts|tsx|mts|cts)$/u.test(file));

const regexPatterns = {
  tsIgnore: /@ts-ignore\b/gu,
  tsExpectError: /@ts-expect-error\b/gu,
  doubleUnknownAssertion: /\bas\s+unknown\s+as\b/gu,
  jsonParseAssertion: /JSON\.parse\([^\n;]*\)\s+as\s+[A-Za-z_{[(]/gu,
  nonNullAssertion: /[A-Za-z0-9_$\])\]}]!(?=[.\[,;):?]|\s*$)/gmu,
  unknownAnnotation: /:\s*unknown\b/gu,
};

const categories = [...Object.keys(regexPatterns), "explicitAny"];
const byPattern = Object.fromEntries(categories.map((key) => [key, []]));

function pushHit(name, file, line, lines) {
  byPattern[name].push({
    file,
    line,
    sample: lines[line - 1]?.trim().slice(0, 220) ?? "",
  });
}

for (const file of files) {
  const text = fs.readFileSync(file, "utf8");
  const lines = text.split(/\r?\n/u);

  for (const [name, regex] of Object.entries(regexPatterns)) {
    regex.lastIndex = 0;
    let match;
    while ((match = regex.exec(text)) !== null) {
      const line = text.slice(0, match.index).split("\n").length;
      pushHit(name, file, line, lines);
      if (match[0].length === 0) regex.lastIndex += 1;
    }
  }

  const scriptKind = file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const sourceFile = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, scriptKind);
  const visit = (node) => {
    if (node.kind === ts.SyntaxKind.AnyKeyword) {
      const start = node.getStart(sourceFile);
      const line = sourceFile.getLineAndCharacterOfPosition(start).line + 1;
      pushHit("explicitAny", file, line, lines);
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
}

const auditBoundaryPrefixes = [
  "app/api/",
  "supabase/functions/",
  "lib/account/",
  "lib/admin/",
  "lib/auth/",
  "lib/commerce/",
  "lib/db/",
  "lib/jobs/",
  "lib/market-integrity/",
  "lib/orders/",
  "lib/payments/",
  "lib/search/",
  "lib/security/",
  "lib/server/",
  "lib/verify/",
];
const hardGateBoundaryPrefixes = [
  "app/api/",
  "supabase/functions/",
  "lib/auth/",
  "lib/db/",
  "lib/security/",
  "lib/commerce/",
];

function hitsForPrefixes(prefixes) {
  const scopedFiles = new Set(files.filter((file) => prefixes.some((prefix) => file.startsWith(prefix))));
  return Object.fromEntries(
    Object.entries(byPattern).map(([name, hits]) => [name, hits.filter((hit) => scopedFiles.has(hit.file))]),
  );
}

const boundaryHits = hitsForPrefixes(auditBoundaryPrefixes);
const hardGateBoundaryHits = hitsForPrefixes(hardGateBoundaryPrefixes);

const report = {
  trackedTypeScriptFiles: files.length,
  totals: Object.fromEntries(Object.entries(byPattern).map(([name, hits]) => [name, hits.length])),
  boundaryPrefixes: auditBoundaryPrefixes,
  boundaryTotals: Object.fromEntries(Object.entries(boundaryHits).map(([name, hits]) => [name, hits.length])),
  hardGateBoundaryPrefixes,
  hardGateBoundaryTotals: Object.fromEntries(Object.entries(hardGateBoundaryHits).map(([name, hits]) => [name, hits.length])),
  tsIgnore: byPattern.tsIgnore,
  tsExpectError: byPattern.tsExpectError,
  explicitAny: byPattern.explicitAny,
  doubleUnknownAssertion: byPattern.doubleUnknownAssertion,
  jsonParseAssertion: byPattern.jsonParseAssertion,
  boundaryExplicitAny: boundaryHits.explicitAny,
  hardGateBoundaryExplicitAny: hardGateBoundaryHits.explicitAny,
  boundaryUnknownAnnotation: boundaryHits.unknownAnnotation,
};

const rendered = JSON.stringify(report, null, 2);
console.log(rendered);
if (jsonPath) fs.writeFileSync(jsonPath, rendered + "\n");

const hardFailures = [];
if (byPattern.tsIgnore.length > 0) hardFailures.push("@ts-ignore is not permitted");
if (byPattern.tsExpectError.length > 0) hardFailures.push("@ts-expect-error requires an explicit C14 review before admission");
if (hardGateBoundaryHits.explicitAny.length > 0) {
  hardFailures.push("explicit any is not permitted on API/Edge/auth/db/security/commerce hard-gate boundaries");
}

if (hardFailures.length > 0) {
  console.error("C14 type-risk gate failed:");
  for (const failure of hardFailures) console.error(`- ${failure}`);
  process.exit(1);
}
