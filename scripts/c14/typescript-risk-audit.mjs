import { execFileSync } from "node:child_process";
import fs from "node:fs";

const argv = process.argv.slice(2);
const jsonArg = argv.find((arg) => arg.startsWith("--json="));
const jsonPath = jsonArg ? jsonArg.slice("--json=".length) : null;
const files = execFileSync("git", ["ls-files", "-z"], { encoding: "utf8" })
  .split("\0")
  .filter(Boolean)
  .filter((file) => /\.(?:ts|tsx|mts|cts)$/u.test(file));

const patterns = {
  tsIgnore: /@ts-ignore\b/gu,
  tsExpectError: /@ts-expect-error\b/gu,
  explicitAny: /(?:\bas\s+any\b|:\s*any\b|<any>|\bany\[\])/gu,
  doubleUnknownAssertion: /\bas\s+unknown\s+as\b/gu,
  jsonParseAssertion: /JSON\.parse\([^\n;]*\)\s+as\s+[A-Za-z_{[(]/gu,
  nonNullAssertion: /[A-Za-z0-9_$\])\]}]!(?=[.\[,;):?]|\s*$)/gmu,
  unknownAnnotation: /:\s*unknown\b/gu,
};

const byPattern = Object.fromEntries(Object.keys(patterns).map((key) => [key, []]));
for (const file of files) {
  const text = fs.readFileSync(file, "utf8");
  const lines = text.split(/\r?\n/u);
  for (const [name, regex] of Object.entries(patterns)) {
    regex.lastIndex = 0;
    let match;
    while ((match = regex.exec(text)) !== null) {
      const line = text.slice(0, match.index).split("\n").length;
      byPattern[name].push({ file, line, sample: lines[line - 1]?.trim().slice(0, 220) ?? "" });
      if (match[0].length === 0) regex.lastIndex += 1;
    }
  }
}

const boundaryPrefixes = ["app/api/", "supabase/functions/", "lib/api/", "lib/auth/", "lib/db/", "lib/security/", "lib/commerce/"];
const boundaryFiles = new Set(files.filter((file) => boundaryPrefixes.some((prefix) => file.startsWith(prefix))));
const boundaryHits = {};
for (const [name, hits] of Object.entries(byPattern)) {
  boundaryHits[name] = hits.filter((hit) => boundaryFiles.has(hit.file));
}
const report = {
  trackedTypeScriptFiles: files.length,
  totals: Object.fromEntries(Object.entries(byPattern).map(([name, hits]) => [name, hits.length])),
  boundaryTotals: Object.fromEntries(Object.entries(boundaryHits).map(([name, hits]) => [name, hits.length])),
  tsIgnore: byPattern.tsIgnore,
  tsExpectError: byPattern.tsExpectError,
  doubleUnknownAssertion: byPattern.doubleUnknownAssertion,
  jsonParseAssertion: byPattern.jsonParseAssertion,
  boundaryExplicitAny: boundaryHits.explicitAny,
  boundaryUnknownAnnotation: boundaryHits.unknownAnnotation,
};

const rendered = JSON.stringify(report, null, 2);
console.log(rendered);
if (jsonPath) fs.writeFileSync(jsonPath, rendered + "\n");

const hardFailures = [];
if (byPattern.tsIgnore.length > 0) hardFailures.push("@ts-ignore is not permitted");
if (byPattern.tsExpectError.length > 0) hardFailures.push("@ts-expect-error requires an explicit C14 review before admission");
if (boundaryHits.explicitAny.length > 0) hardFailures.push("explicit any is not permitted on critical API/auth/db/security/commerce/Edge boundaries");

if (hardFailures.length > 0) {
  console.error("C14 type-risk gate failed:");
  for (const failure of hardFailures) console.error(`- ${failure}`);
  process.exit(1);
}
