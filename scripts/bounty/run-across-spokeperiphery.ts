import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { executeFullAuditV2 } from "../../lib/security/v2/master-audit-orchestrator";

const countBy = (values: Array<string | undefined>) =>
  values.reduce<Record<string, number>>((acc, value) => {
    const key = value || "unknown";
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});

async function main() {
  const args = process.argv.slice(2);
  const sourcePath = args[0];
  const artifactPath = args[1];
  const contractName = args.length >= 4 ? args[2] : "SpokePoolPeriphery";
  const outputPath = args.length >= 4
    ? args[3]
    : (args[2] ?? "artifacts/bounty/across-spokeperiphery-velmere.json");
  if (!sourcePath || !artifactPath) {
    throw new Error("usage: tsx scripts/bounty/run-across-spokeperiphery.ts <source.sol> <artifact.json> [contractName] [output.json]");
  }

  const sourceCode = await readFile(sourcePath, "utf8");
  const artifact = JSON.parse(await readFile(artifactPath, "utf8"));
  const rawBytecode =
    artifact?.deployedBytecode?.object ??
    artifact?.deployedBytecode ??
    artifact?.bytecode?.object ??
    artifact?.bytecode;

  if (typeof rawBytecode !== "string" || rawBytecode.length < 16) {
    console.log(JSON.stringify({
      schema: "velmere.bounty.public-aggregate.v1",
      contractName,
      contractName,
    sourcePath,
    targetCommit: process.env.ACROSS_SHA ?? "unknown",
      status: "SKIPPED_NO_RUNTIME_BYTECODE"
    }, null, 2));
    return;
  }
  const bytecode = rawBytecode.startsWith("0x") ? rawBytecode : `0x${rawBytecode}`;

  const result = executeFullAuditV2({
    contractAddress: "0x0000000000000000000000000000000000000001",
    chainId: "1",
    bytecode,
    sourceCode,
    contractName: `Across_${contractName}_CurrentSourceBuild`,
    tier: "ADVANCED",
    fuzzIterations: 300,
  });

  const envelope = {
    schema: "velmere.bounty.across.spoke-pool-periphery.v1",
    generatedAt: new Date().toISOString(),
    target: {
      repository: "across-protocol/contracts",
      commit: process.env.ACROSS_SHA ?? "unknown",
      contract: sourcePath,
      mode: "SOURCE_BUILD_NOT_DEPLOYMENT_BOUND",
      bountyProgram: "Across Protocol",
    },
    engine: {
      velmereCommit: process.env.VELMERE_SHA ?? "unknown",
      auditTier: "ADVANCED",
    },
    result,
  };

  const serialized = JSON.stringify(envelope, null, 2);
  await writeFile(outputPath, serialized);

  // Bounty-safe stdout: no titles, locations, descriptions, evidence, or PoC-like details.
  console.log(JSON.stringify({
    schema: "velmere.bounty.public-aggregate.v1",
    targetCommit: process.env.ACROSS_SHA ?? "unknown",
    resultDigestSha256: createHash("sha256").update(serialized).digest("hex"),
    findingCount: result.findings.length,
    severityCounts: countBy(result.findings.map((f: any) => f.severity)),
    categoryCounts: countBy(result.findings.map((f: any) => f.category)),
    evidenceClassCounts: countBy(result.findings.map((f: any) => f.evidenceClass)),
    statusCounts: countBy(result.findings.map((f: any) => f.status)),
    claimStateCounts: countBy(result.findings.map((f: any) => f.claimState)),
    analysisMethodCounts: countBy(result.findings.map((f: any) => f.analysisMethod)),
    confidenceCounts: countBy(result.findings.map((f: any) => f.confidence)),
    locationShapeCounts: {
      sourceOnly: result.findings.filter((f: any) => Boolean(f.sourceLocation) && !f.bytecodeOffset).length,
      bytecodeOnly: result.findings.filter((f: any) => !f.sourceLocation && Boolean(f.bytecodeOffset)).length,
      both: result.findings.filter((f: any) => Boolean(f.sourceLocation) && Boolean(f.bytecodeOffset)).length,
      neither: result.findings.filter((f: any) => !f.sourceLocation && !f.bytecodeOffset).length,
    },
    scores: result.scores,
    cfgMetrics: result.cfgMetrics,
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
