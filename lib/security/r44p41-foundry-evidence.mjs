import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

export const R44P41_REVISION = "VELMERE_PASS36_A102R44P41_ACTION_REQUIRED_OFFICIAL_FOUNDRY_INVARIANTS_ANVIL_RAW_RPC_EXACT_OFFLINE_FULL_LINUX_RELEASE_NO_LIVE_CREDIT";

const EXPECTED_FAMILIES = new Map([
  ["vault-solvency", "R44P41_VAULT_INSOLVENT"],
  ["supply-cap", "R44P41_SUPPLY_CAP_BROKEN"],
  ["owner-integrity", "R44P41_OWNER_TAKEOVER"],
  ["bridge-replay", "R44P41_BRIDGE_REPLAY"],
  ["pause-bypass", "R44P41_PAUSE_BYPASS"],
  ["blacklist-bypass", "R44P41_BLACKLIST_BYPASS"],
  ["fee-cap", "R44P41_FEE_CAP_BROKEN"],
  ["minimum-quorum", "R44P41_LOW_QUORUM"],
]);

export const sha256File = (filePath) => crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");

export function validateR44P41ReceiptCore(receipt) {
  const rows = [];
  const check = (id, passed, detail = null) => rows.push({ id, passed: Boolean(passed), detail });
  check("schema", receipt?.schemaVersion === "velmere.pass36.a102r44p41.foundry-invariant-campaign.v1");
  check("revision", receipt?.revisionId === R44P41_REVISION, receipt?.revisionId);
  check("status", receipt?.status === "PASS_R44P41_OFFICIAL_FOUNDRY_INVARIANT_CAMPAIGN", receipt?.status);
  check("classification", receipt?.classification === "OFFICIAL_FOUNDRY_LOCAL_INVARIANT_FUZZ_REPLAY_AND_ANVIL_RAW_RPC_ONLY");
  check("source-binding", receipt?.sourceBinding?.revisionId === R44P41_REVISION && /^[0-9a-f]{64}$/.test(receipt?.sourceBinding?.manifestSha256 ?? "") && /^[0-9a-f]{64}$/.test(receipt?.sourceBinding?.sourceAggregateSha256 ?? ""));
  check("forge", receipt?.toolchain?.forge?.version?.includes("Version: 1.7.1") && receipt?.toolchain?.forge?.sha256 === "4f77da0810de94325734855d0ad58d70640aa8a5b2a837608ddf8c26da34355c");
  check("cast", receipt?.toolchain?.cast?.version?.includes("Version: 1.7.1") && receipt?.toolchain?.cast?.sha256 === "ccd95a4607ca3ebfcb88bb90e7235cdb7f0564f5f1afa17478d5fccabbb222cb");
  check("anvil", receipt?.toolchain?.anvil?.version?.includes("Version: 1.7.1") && receipt?.toolchain?.anvil?.sha256 === "10c1c727d6c1de973aeb160e59875b9a9a23464d6e74149ee8abb30b3500311b");
  check("solc", receipt?.toolchain?.solc?.version?.includes("0.8.24+commit.e11b9ed9") && receipt?.toolchain?.solc?.sha256 === "fb03a29a517452b9f12bcf459ef37d0a543765bb3bbc911e70a87d6a37c30d5f");
  const families = receipt?.campaign?.families ?? [];
  check("family-count", families.length === EXPECTED_FAMILIES.size, families.length);
  check("family-id-set", families.length === EXPECTED_FAMILIES.size && families.every((row) => EXPECTED_FAMILIES.get(row.familyId) === row.expectedFailureReason));
  for (const family of families) {
    const expectedReason = EXPECTED_FAMILIES.get(family.familyId);
    check(`family:${family.familyId}:reason`, Boolean(expectedReason) && family.expectedFailureReason === expectedReason);
    check(`family:${family.familyId}:risk-repetitions`, family.riskRuns?.length === 2 && family.riskRuns.every((row) => row.exitCode !== 0 && row.expectedFailureObserved === true && row.sequenceShape?.length > 0));
    check(`family:${family.familyId}:control-repetitions`, family.controlRuns?.length === 2 && family.controlRuns.every((row) => row.exitCode === 0 && row.passed === true && row.metrics?.runs >= 256 && row.metrics?.calls > 0));
    check(`family:${family.familyId}:repeatable`, family.repeatable === true && JSON.stringify(family.riskRuns?.[0]?.sequenceShape) === JSON.stringify(family.riskRuns?.[1]?.sequenceShape));
  }
  check("risk-summary", receipt?.campaign?.riskExpectedFailuresObserved === 8);
  check("control-summary", receipt?.campaign?.controlsPassed === 8);
  check("repeatability-summary", receipt?.campaign?.repeatableFamilies === 8);
  check("risk-replays", receipt?.campaign?.riskReplaysPassed === 8 && receipt?.campaign?.replays?.[0]?.passed === true);
  check("control-replays", receipt?.campaign?.controlReplaysPassed === 8 && receipt?.campaign?.replays?.[1]?.passed === true);
  check("anvil-classification", receipt?.localAnvil?.classification === "LOCAL_ANVIL_RAW_RPC_ONLY" && receipt?.localAnvil?.chainId === 31341);
  check("anvil-deployments", receipt?.localAnvil?.deployments?.length === 2 && receipt.localAnvil.deployments.every((row) => row.exactRuntimeBytecodeMatch === true && /^0x[0-9a-fA-F]{40}$/.test(row.address) && /^0x[0-9a-fA-F]{64}$/.test(row.transactionHash)));
  const executions = receipt?.localAnvil?.executions ?? [];
  const risk = executions.find((row) => row.contract === "RiskVault");
  const control = executions.find((row) => row.contract === "ControlVault");
  check("anvil-risk-replay", risk?.riskExpected === true && risk?.expectedRelationObserved === true && risk.finalBalanceWei < risk.finalLiabilitiesWei);
  check("anvil-control-replay", control?.riskExpected === false && control?.expectedRelationObserved === true && control.finalBalanceWei === control.finalLiabilitiesWei);
  check("artifact-index", Array.isArray(receipt?.artifactIndex) && receipt.artifactIndex.length >= 50 && receipt.artifactIndex.every((row) => typeof row.path === "string" && Number.isInteger(row.byteLength) && /^[0-9a-f]{64}$/.test(row.sha256)));
  check("checks", receipt?.checks?.failed === 0 && receipt?.checks?.passed === receipt?.checks?.total && receipt?.checks?.rows?.every((row) => row.passed === true));
  check("positive-credits", receipt?.credits?.officialFoundryExecutionCredit === true && receipt?.credits?.localInvariantCredit === true && receipt?.credits?.replayableCounterexampleCredit === true && receipt?.credits?.localAnvilRawRpcCredit === true);
  check("no-external-promotion", receipt?.credits?.forkReplayCredit === false && receipt?.credits?.realChainCredit === false && receipt?.credits?.independentGroundTruthCredit === false && receipt?.credits?.independentReviewerCredit === false && receipt?.credits?.customerCredit === false && receipt?.credits?.saleCredit === false && receipt?.credits?.liveCredit === false && receipt?.credits?.worldClassCredit === false);
  return rows;
}

export function verifyArtifactIndex(receipt, root) {
  const rows = [];
  const check = (id, passed, detail = null) => rows.push({ id, passed: Boolean(passed), detail });
  const seen = new Set();
  for (const entry of receipt.artifactIndex ?? []) {
    const normalized = path.posix.normalize(entry.path);
    check(`path:${entry.path}`, normalized === entry.path && !normalized.startsWith("../") && !path.posix.isAbsolute(normalized));
    check(`unique:${entry.path}`, !seen.has(entry.path));
    seen.add(entry.path);
    const absolute = path.join(root, ...entry.path.split("/"));
    const stat = fs.lstatSync(absolute);
    check(`regular:${entry.path}`, stat.isFile() && !stat.isSymbolicLink());
    check(`size:${entry.path}`, stat.size === entry.byteLength, { actual: stat.size, expected: entry.byteLength });
    check(`sha:${entry.path}`, sha256File(absolute) === entry.sha256);
  }
  return rows;
}
