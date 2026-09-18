import { readFile, writeFile } from "node:fs/promises";
import { executeFullAuditV2 } from "../../lib/security/v2/master-audit-orchestrator";

const [sourcePath, artifactPath, outputPath = "artifacts/bounty/across-spokeperiphery-velmere.json"] = process.argv.slice(2);
if (!sourcePath || !artifactPath) {
  throw new Error("usage: tsx scripts/bounty/run-across-spokeperiphery.ts <source.sol> <artifact.json> [output.json]");
}

const sourceCode = await readFile(sourcePath, "utf8");
const artifact = JSON.parse(await readFile(artifactPath, "utf8"));
const rawBytecode =
  artifact?.deployedBytecode?.object ??
  artifact?.deployedBytecode ??
  artifact?.bytecode?.object ??
  artifact?.bytecode;

if (typeof rawBytecode !== "string" || rawBytecode.length < 16) {
  throw new Error("compiled_runtime_bytecode_missing");
}
const bytecode = rawBytecode.startsWith("0x") ? rawBytecode : `0x${rawBytecode}`;

const result = executeFullAuditV2({
  contractAddress: "0x0000000000000000000000000000000000000001",
  chainId: "1",
  bytecode,
  sourceCode,
  contractName: "AcrossSpokePoolPeriphery_CurrentSourceBuild",
  tier: "ADVANCED",
  fuzzIterations: 300,
});

const envelope = {
  schema: "velmere.bounty.across.spoke-pool-periphery.v1",
  generatedAt: new Date().toISOString(),
  target: {
    repository: "across-protocol/contracts",
    commit: process.env.ACROSS_SHA ?? "unknown",
    contract: "contracts/periphery/SpokePoolPeriphery.sol",
    mode: "SOURCE_BUILD_NOT_DEPLOYMENT_BOUND",
    bountyProgram: "Across Protocol",
  },
  engine: {
    velmereCommit: process.env.VELMERE_SHA ?? "unknown",
    auditTier: "ADVANCED",
  },
  result,
};

await writeFile(outputPath, JSON.stringify(envelope, null, 2));

const summary = result.findings.map((f: any) => ({
  id: f.id,
  title: f.title,
  severity: f.severity,
  confidence: f.confidence,
  status: f.status,
  category: f.category,
  evidenceClass: f.evidenceClass,
}));
console.log(JSON.stringify({
  snapshot: result.snapshot,
  scores: result.scores,
  cfgMetrics: result.cfgMetrics,
  findingCount: result.findings.length,
  findings: summary,
}, null, 2));
