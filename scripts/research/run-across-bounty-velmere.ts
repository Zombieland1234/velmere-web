import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { executeFullAuditV2 } from "../../lib/security/v2/master-audit-orchestrator";

type Target = {
  name: string;
  contractRef: string;
  sourcePath: string;
  address: string;
  chainId: string;
};

const acrossDir = resolve(process.env.ACROSS_REPO_DIR ?? "targets/across");
const outputDir = resolve("artifacts/research/across-bounty-20260918");

const targets: Target[] = [
  {
    name: "HubPool",
    contractRef: "contracts/hub-pool/HubPool.sol:HubPool",
    sourcePath: "contracts/hub-pool/HubPool.sol",
    address: "0x0000000000000000000000000000000000000001",
    chainId: "1",
  },
  {
    name: "AcrossConfigStore",
    contractRef: "contracts/hub-pool/AcrossConfigStore.sol:AcrossConfigStore",
    sourcePath: "contracts/hub-pool/AcrossConfigStore.sol",
    address: "0x0000000000000000000000000000000000000002",
    chainId: "1",
  },
  {
    name: "Arbitrum_SpokePool",
    contractRef: "contracts/spoke-pools/Arbitrum_SpokePool.sol:Arbitrum_SpokePool",
    sourcePath: "contracts/spoke-pools/Arbitrum_SpokePool.sol",
    address: "0x0000000000000000000000000000000000000003",
    chainId: "42161",
  },
  {
    name: "OP_SpokePool",
    contractRef: "contracts/spoke-pools/OP_SpokePool.sol:OP_SpokePool",
    sourcePath: "contracts/spoke-pools/OP_SpokePool.sol",
    address: "0x0000000000000000000000000000000000000004",
    chainId: "10",
  },
  {
    name: "SpokePoolPeriphery",
    contractRef: "contracts/periphery/SpokePoolPeriphery.sol:SpokePoolPeriphery",
    sourcePath: "contracts/periphery/SpokePoolPeriphery.sol",
    address: "0x0000000000000000000000000000000000000005",
    chainId: "1",
  },
  {
    name: "PermissionedMulticallHandler",
    contractRef: "contracts/handlers/PermissionedMulticallHandler.sol:PermissionedMulticallHandler",
    sourcePath: "contracts/handlers/PermissionedMulticallHandler.sol",
    address: "0x0000000000000000000000000000000000000006",
    chainId: "1",
  },
  {
    name: "Router_Adapter",
    contractRef: "contracts/chain-adapters/Router_Adapter.sol:Router_Adapter",
    sourcePath: "contracts/chain-adapters/Router_Adapter.sol",
    address: "0x0000000000000000000000000000000000000007",
    chainId: "1",
  },
  {
    name: "AdminWithdrawManager",
    contractRef: "contracts/periphery/counterfactual/AdminWithdrawManager.sol:AdminWithdrawManager",
    sourcePath: "contracts/periphery/counterfactual/AdminWithdrawManager.sol",
    address: "0x0000000000000000000000000000000000000008",
    chainId: "1",
  },
  {
    name: "CounterfactualBeacon",
    contractRef: "contracts/periphery/counterfactual/CounterfactualBeacon.sol:CounterfactualBeacon",
    sourcePath: "contracts/periphery/counterfactual/CounterfactualBeacon.sol",
    address: "0x0000000000000000000000000000000000000009",
    chainId: "1",
  },
  {
    name: "CounterfactualDeposit",
    contractRef: "contracts/periphery/counterfactual/CounterfactualDeposit.sol:CounterfactualDeposit",
    sourcePath: "contracts/periphery/counterfactual/CounterfactualDeposit.sol",
    address: "0x000000000000000000000000000000000000000a",
    chainId: "1",
  },
  {
    name: "CounterfactualDepositCCTP",
    contractRef: "contracts/periphery/counterfactual/CounterfactualDepositCCTP.sol:CounterfactualDepositCCTP",
    sourcePath: "contracts/periphery/counterfactual/CounterfactualDepositCCTP.sol",
    address: "0x000000000000000000000000000000000000000b",
    chainId: "1",
  },
  {
    name: "CounterfactualDepositFactory",
    contractRef: "contracts/periphery/counterfactual/CounterfactualDepositFactory.sol:CounterfactualDepositFactory",
    sourcePath: "contracts/periphery/counterfactual/CounterfactualDepositFactory.sol",
    address: "0x000000000000000000000000000000000000000c",
    chainId: "1",
  },
  {
    name: "CounterfactualDepositOFT",
    contractRef: "contracts/periphery/counterfactual/CounterfactualDepositOFT.sol:CounterfactualDepositOFT",
    sourcePath: "contracts/periphery/counterfactual/CounterfactualDepositOFT.sol",
    address: "0x000000000000000000000000000000000000000d",
    chainId: "1",
  },
  {
    name: "CounterfactualDepositSpokePool",
    contractRef: "contracts/periphery/counterfactual/CounterfactualDepositSpokePool.sol:CounterfactualDepositSpokePool",
    sourcePath: "contracts/periphery/counterfactual/CounterfactualDepositSpokePool.sol",
    address: "0x000000000000000000000000000000000000000e",
    chainId: "1",
  },
  {
    name: "CounterfactualDepositVanillaCCTP",
    contractRef: "contracts/periphery/counterfactual/CounterfactualDepositVanillaCCTP.sol:CounterfactualDepositVanillaCCTP",
    sourcePath: "contracts/periphery/counterfactual/CounterfactualDepositVanillaCCTP.sol",
    address: "0x000000000000000000000000000000000000000f",
    chainId: "1",
  },
  {
    name: "HyperCoreFlowExecutor",
    contractRef: "contracts/periphery/mintburn/HyperCoreFlowExecutor.sol:HyperCoreFlowExecutor",
    sourcePath: "contracts/periphery/mintburn/HyperCoreFlowExecutor.sol",
    address: "0x0000000000000000000000000000000000000010",
    chainId: "999",
  },
  {
    name: "SwapHandler",
    contractRef: "contracts/periphery/mintburn/SwapHandler.sol:SwapHandler",
    sourcePath: "contracts/periphery/mintburn/SwapHandler.sol",
    address: "0x0000000000000000000000000000000000000011",
    chainId: "999",
  },
  {
    name: "Tron_SpokePoolPeriphery",
    contractRef: "contracts/periphery/Tron_SpokePoolPeriphery.sol:Tron_SpokePoolPeriphery",
    sourcePath: "contracts/periphery/Tron_SpokePoolPeriphery.sol",
    address: "0x0000000000000000000000000000000000000012",
    chainId: "728126428",
  },
  {
    name: "Ethereum_SpokePool",
    contractRef: "contracts/spoke-pools/Ethereum_SpokePool.sol:Ethereum_SpokePool",
    sourcePath: "contracts/spoke-pools/Ethereum_SpokePool.sol",
    address: "0x0000000000000000000000000000000000000013",
    chainId: "1",
  },
  {
    name: "Lens_SpokePool",
    contractRef: "contracts/spoke-pools/Lens_SpokePool.sol:Lens_SpokePool",
    sourcePath: "contracts/spoke-pools/Lens_SpokePool.sol",
    address: "0x0000000000000000000000000000000000000014",
    chainId: "232",
  },
  {
    name: "ZkSync_SpokePool",
    contractRef: "contracts/spoke-pools/ZkSync_SpokePool.sol:ZkSync_SpokePool",
    sourcePath: "contracts/spoke-pools/ZkSync_SpokePool.sol",
    address: "0x0000000000000000000000000000000000000015",
    chainId: "324",
  },
  {
    name: "Cher_SpokePool",
    contractRef: "contracts/spoke-pools/Cher_SpokePool.sol:Cher_SpokePool",
    sourcePath: "contracts/spoke-pools/Cher_SpokePool.sol",
    address: "0x0000000000000000000000000000000000000016",
    chainId: "999",
  },
];

function command(command: string, args: string[], cwd: string): string {
  return execFileSync(command, args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    maxBuffer: 64 * 1024 * 1024,
  }).trim();
}

function countBy<T extends string>(items: T[]): Record<T, number> {
  return items.reduce((acc, item) => {
    acc[item] = (acc[item] ?? 0) + 1;
    return acc;
  }, {} as Record<T, number>);
}

async function main(): Promise<void> {
  await mkdir(outputDir, { recursive: true });

  const acrossSha = command("git", ["rev-parse", "HEAD"], acrossDir);
  const velmereSha = command("git", ["rev-parse", "HEAD"], process.cwd());

  const rows: Array<Record<string, unknown>> = [];

  for (const target of targets) {
    try {
      const sourceCode = await readFile(resolve(acrossDir, target.sourcePath), "utf8");
      const bytecode = command("forge", ["inspect", target.contractRef, "deployedBytecode"], acrossDir);

      if (!/^0x[0-9a-fA-F]+$/.test(bytecode) || bytecode.length < 18) {
        rows.push({
          target,
          status: "SKIPPED_NON_CONCRETE_BYTECODE",
          bytecodePreview: bytecode.slice(0, 120),
        });
        continue;
      }

      const result = executeFullAuditV2({
        contractAddress: target.address,
        chainId: target.chainId,
        bytecode,
        sourceCode,
        contractName: target.name,
        tier: "ADVANCED",
        fuzzIterations: 300,
      });

      const severityCounts = countBy(result.findings.map((finding) => finding.severity));
      const claimStateCounts = countBy(
        result.findings.map((finding) => finding.claimState ?? "DETECTOR_FINDING"),
      );

      const priorityCandidates = result.findings.filter(
        (finding) =>
          finding.claimState !== "HEURISTIC_CANDIDATE" &&
          (finding.severity === "critical" || finding.severity === "high") &&
          (finding.confidence === "certain" || finding.confidence === "high"),
      );

      rows.push({
        target,
        status: "ANALYZED",
        sourceSha256: createHash("sha256").update(sourceCode).digest("hex"),
        bytecodeSha256: createHash("sha256").update(bytecode).digest("hex"),
        bytecodeLengthBytes: (bytecode.length - 2) / 2,
        severityCounts,
        claimStateCounts,
        priorityCandidateCount: priorityCandidates.length,
        priorityCandidates,
        result,
      });
    } catch (error) {
      rows.push({
        target,
        status: "ERROR",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const payload = {
    schema: "velmere.research.across-bounty.v1",
    generatedAt: new Date().toISOString(),
    authorizationBasis: "Across public bug bounty; local/static analysis only; no production exploitation",
    acrossRepository: "across-protocol/contracts",
    acrossSha,
    velmereRepository: "Zombieland1234/velmere-web",
    velmereSha,
    engineBoundary: {
      targetBytecodeExecutedByFuzzer: false,
      fuzzingScope: "SYNTHETIC_BALANCE_MODEL_NOT_TARGET_BYTECODE",
      formalSolverExecuted: false,
      findingsAreBountyReadyByDefault: false,
    },
    targets: rows,
  };

  await writeFile(
    resolve(outputDir, "velmere-across-results.json"),
    JSON.stringify(payload, null, 2),
    "utf8",
  );

  const analyzed = rows.filter((row) => row.status === "ANALYZED");
  const totalPriority = analyzed.reduce(
    (sum, row) => sum + Number(row.priorityCandidateCount ?? 0),
    0,
  );

  const md = [
    "# Velmère × Across — bounty research pass",
    "",
    `- Across SHA: \`${acrossSha}\``,
    `- Velmère SHA: \`${velmereSha}\``,
    `- Targets analyzed: ${analyzed.length}/${targets.length}`,
    `- High/Critical detector candidates requiring manual validation: ${totalPriority}`,
    "",
    "## Safety / evidence boundary",
    "",
    "This run performs local compilation and static/CFG/source analysis only.",
    "It does not send transactions, call production RPC endpoints, move funds, access user data, or attempt live exploitation.",
    "Velmère's current V2 fuzz campaign is a synthetic balance model and does not execute target bytecode; therefore no finding is treated as bounty-ready without independent reproduction.",
    "",
    "## Target summary",
    "",
    "| Target | Status | Critical | High | Medium | Low | Informational | Priority candidates |",
    "|---|---:|---:|---:|---:|---:|---:|---:|",
    ...rows.map((row) => {
      const target = row.target as Target;
      const counts = (row.severityCounts ?? {}) as Record<string, number>;
      return `| ${target.name} | ${row.status} | ${counts.critical ?? 0} | ${counts.high ?? 0} | ${counts.medium ?? 0} | ${counts.low ?? 0} | ${counts.informational ?? 0} | ${row.priorityCandidateCount ?? 0} |`;
    }),
    "",
    "## Next triage rule",
    "",
    "Only High/Critical detector findings with high/certain confidence advance to manual source review and a local Foundry reproduction. Heuristic-only findings remain leads, not vulnerability claims.",
    "",
  ].join("\n");

  await writeFile(resolve(outputDir, "SUMMARY.md"), md, "utf8");
  console.log(md);

}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exitCode = 1;
});
