import { canonicalJson } from "./canonical-json";
import { sha256Digest } from "./cryptographic-digest";

export const P79_HISTORICAL_DEPLOYMENT_GROUND_TRUTH_ID = "p79-historical-deployment-ground-truth.v1" as const;
export const P79_DOMINOTT_RECORD_ID = "p79-bsc-dominott-34141659" as const;

export type P79HistoricalAnchorKind =
  | "state_snapshot"
  | "execution_trace"
  | "replay_poc_mirror"
  | "upstream_replay_poc"
  | "verified_source_metadata"
  | "verified_source_component";

export type P79HistoricalGroundTruthAnchor = {
  kind: P79HistoricalAnchorKind;
  repository: string;
  commit: string;
  path: string;
  blobSha: string;
  evidenceClass: string;
};

export type P79HistoricalDeploymentGroundTruthRecord = {
  schemaVersion: typeof P79_HISTORICAL_DEPLOYMENT_GROUND_TRUTH_ID;
  recordId: typeof P79_DOMINOTT_RECORD_ID;
  incident: {
    chain: "bsc";
    chainId: "56";
    targetAddress: string;
    victimPoolAddress: string;
    trustedForwarderAddress: string;
    snapshotBlock: number;
    attackBlock: number;
    attackTransaction: string;
    snapshotTimestamp: string;
  };
  deployment: {
    proxyKind: "EIP_1167_COMPATIBLE_MINIMAL_PROXY";
    runtimeBytecode: string;
    runtimeBytecodeDigest: string;
    implementationAddress: string;
    exactRuntimeObservedAtSnapshot: true;
  };
  verifiedSourceMetadata: {
    contractName: "TokenERC20";
    compilerVersion: "v0.8.12+commit.f00d7308";
    optimizerEnabled: true;
    optimizerRuns: 20;
    bindingClass: "PINNED_EXPLORER_VERIFIED_SOURCE_CORPUS_FOR_EXACT_TARGET";
    criticalSourceAnchorCount: 4;
    exactCompilationToRuntimeProven: false;
    rawSourceRedistributed: false;
    rawAbiRedistributed: false;
  };
  replay: {
    result: "PINNED_UPSTREAM_REPLAY_PASS";
    forkBlock: number;
    attackerProfitAsset: "WBNB";
    attackerProfitRaw: "4844466907837911894";
    attackerProfitDisplay: "4.844466907837911894 WBNB";
    trustedForwarderPathObserved: true;
    victimPoolBurnObserved: true;
    independentVelmereReplay: false;
  };
  anchors: P79HistoricalGroundTruthAnchor[];
  rightsBoundary: {
    mode: "DERIVED_METADATA_AND_PINNED_REFERENCES_ONLY";
    mirrorRepositoryLicense: "UNKNOWN_OR_UNASSERTED";
    upstreamRepositoryLicense: "APACHE-2.0_REPOSITORY_LEVEL_POC_FILE_UNLICENSED";
    rawSourceTraceStatePackaged: false;
    customerRedistributionAuthorized: false;
  };
  currentnessBoundary: {
    classification: "HISTORICAL_EXACT_BLOCK_ONLY";
    currentRuntimeStateProven: false;
    currentTrustedForwarderStateProven: false;
    currentExploitabilityProven: false;
  };
  recordDigest: string;
};

type UnsignedRecord = Omit<P79HistoricalDeploymentGroundTruthRecord, "recordDigest">;

const DOMINOTT_RUNTIME_BYTECODE = "0x363d3d373d3d3d363d73ae5be6d490c47c7417e91b7911d3a0ce3553438d5af43d82803e903d91602b57fd5bf300";

function normalizeHex(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function normalizeAddress(value: unknown) {
  const text = normalizeHex(value);
  return /^0x[a-f0-9]{40}$/.test(text) ? text : "";
}

function normalizeTransaction(value: unknown) {
  const text = normalizeHex(value);
  return /^0x[a-f0-9]{64}$/.test(text) ? text : "";
}

export function extractP79Eip1167Implementation(runtimeBytecode: unknown): string | null {
  const code = normalizeHex(runtimeBytecode);
  const match = /^0x363d3d373d3d3d363d73([a-f0-9]{40})5af43d82803e903d91602b57fd5bf3(?:00)?$/.exec(code);
  return match ? `0x${match[1]}` : null;
}

function buildUnsignedDominoTtRecord(): UnsignedRecord {
  return {
    schemaVersion: P79_HISTORICAL_DEPLOYMENT_GROUND_TRUTH_ID,
    recordId: P79_DOMINOTT_RECORD_ID,
    incident: {
      chain: "bsc",
      chainId: "56",
      targetAddress: "0x0dabdc92af35615443412a336344c591faed3f90",
      victimPoolAddress: "0x4f34b914d687195a73318ccc58d56d242b4dccf6",
      trustedForwarderAddress: "0x7c4717039b89d5859c4fbb85edb19a6e2ce61171",
      snapshotBlock: 34_141_659,
      attackBlock: 34_141_660,
      attackTransaction: "0x1ee617cd739b1afcc673a180e60b9a32ad3ba856226a68e8748d58fcccc877a8",
      snapshotTimestamp: "2023-12-07T08:59:30.000Z",
    },
    deployment: {
      proxyKind: "EIP_1167_COMPATIBLE_MINIMAL_PROXY",
      runtimeBytecode: DOMINOTT_RUNTIME_BYTECODE,
      runtimeBytecodeDigest: sha256Digest(DOMINOTT_RUNTIME_BYTECODE),
      implementationAddress: "0xae5be6d490c47c7417e91b7911d3a0ce3553438d",
      exactRuntimeObservedAtSnapshot: true,
    },
    verifiedSourceMetadata: {
      contractName: "TokenERC20",
      compilerVersion: "v0.8.12+commit.f00d7308",
      optimizerEnabled: true,
      optimizerRuns: 20,
      bindingClass: "PINNED_EXPLORER_VERIFIED_SOURCE_CORPUS_FOR_EXACT_TARGET",
      criticalSourceAnchorCount: 4,
      exactCompilationToRuntimeProven: false,
      rawSourceRedistributed: false,
      rawAbiRedistributed: false,
    },
    replay: {
      result: "PINNED_UPSTREAM_REPLAY_PASS",
      forkBlock: 34_141_659,
      attackerProfitAsset: "WBNB",
      attackerProfitRaw: "4844466907837911894",
      attackerProfitDisplay: "4.844466907837911894 WBNB",
      trustedForwarderPathObserved: true,
      victimPoolBurnObserved: true,
      independentVelmereReplay: false,
    },
    anchors: [
      {
        kind: "state_snapshot",
        repository: "sanbir/evm-hack-registry",
        commit: "f33fc07accb9f91a2705e3ad67ddf034622e52b8",
        path: "2023-12-DominoTT_exp/anvil_state.json",
        blobSha: "6e63d0b7abd5b79304fb2051ce87d611c0a3769a",
        evidenceClass: "PINNED_HISTORICAL_STATE_MIRROR",
      },
      {
        kind: "execution_trace",
        repository: "sanbir/evm-hack-registry",
        commit: "f33fc07accb9f91a2705e3ad67ddf034622e52b8",
        path: "2023-12-DominoTT_exp/output.txt",
        blobSha: "b01104fc11658a69fa9fe3f24fe59898a8ff1317",
        evidenceClass: "PINNED_FOUNDRY_EXECUTION_TRACE",
      },
      {
        kind: "replay_poc_mirror",
        repository: "sanbir/evm-hack-registry",
        commit: "f33fc07accb9f91a2705e3ad67ddf034622e52b8",
        path: "2023-12-DominoTT_exp/test/DominoTT_exp.sol",
        blobSha: "54ae73b29cac77200e3ec20130f0b755cad6eb3b",
        evidenceClass: "PINNED_POC_MIRROR",
      },
      {
        kind: "upstream_replay_poc",
        repository: "SunWeb3Sec/DeFiHackLabs",
        commit: "ad353ba25fbb897c56d64c28ce92ee10ac68cad2",
        path: "src/test/2023-12/DominoTT_exp.sol",
        blobSha: "7a6de7e40df18964ccbfe5f81089a18b0be64a5a",
        evidenceClass: "PINNED_UPSTREAM_REPLAY_SOURCE",
      },
      {
        kind: "verified_source_metadata",
        repository: "sanbir/evm-hack-registry",
        commit: "f33fc07accb9f91a2705e3ad67ddf034622e52b8",
        path: "2023-12-DominoTT_exp/sources/TokenERC20_0DaBDC/_meta.json",
        blobSha: "3deb32daa01207e8883aa7ddab85bd0a81952758",
        evidenceClass: "PINNED_EXPLORER_VERIFIED_SOURCE_METADATA",
      },
      {
        kind: "verified_source_component",
        repository: "sanbir/evm-hack-registry",
        commit: "f33fc07accb9f91a2705e3ad67ddf034622e52b8",
        path: "2023-12-DominoTT_exp/sources/TokenERC20_0DaBDC/contracts_token_TokenERC20.sol",
        blobSha: "0a12f986ce8bbba57b655889f3f049729b47b764",
        evidenceClass: "PINNED_VERIFIED_SOURCE_PRIMARY_CONTRACT",
      },
      {
        kind: "verified_source_component",
        repository: "sanbir/evm-hack-registry",
        commit: "f33fc07accb9f91a2705e3ad67ddf034622e52b8",
        path: "2023-12-DominoTT_exp/sources/TokenERC20_0DaBDC/contracts_openzeppelin-presets_metatx_ERC2771ContextUpgradeable.sol",
        blobSha: "d0d8039614eb6b48ca2a20dac78823bbb17977d5",
        evidenceClass: "PINNED_VERIFIED_SOURCE_ERC2771_COMPONENT",
      },
      {
        kind: "verified_source_component",
        repository: "sanbir/evm-hack-registry",
        commit: "f33fc07accb9f91a2705e3ad67ddf034622e52b8",
        path: "2023-12-DominoTT_exp/sources/TokenERC20_0DaBDC/lib_openzeppelin-contracts-upgradeable_contracts_utils_MulticallUpgradeable.sol",
        blobSha: "bbdde89e3d4267717502c9e6e4b419ddcbd89bd3",
        evidenceClass: "PINNED_VERIFIED_SOURCE_MULTICALL_COMPONENT",
      },
    ],
    rightsBoundary: {
      mode: "DERIVED_METADATA_AND_PINNED_REFERENCES_ONLY",
      mirrorRepositoryLicense: "UNKNOWN_OR_UNASSERTED",
      upstreamRepositoryLicense: "APACHE-2.0_REPOSITORY_LEVEL_POC_FILE_UNLICENSED",
      rawSourceTraceStatePackaged: false,
      customerRedistributionAuthorized: false,
    },
    currentnessBoundary: {
      classification: "HISTORICAL_EXACT_BLOCK_ONLY",
      currentRuntimeStateProven: false,
      currentTrustedForwarderStateProven: false,
      currentExploitabilityProven: false,
    },
  };
}

function signRecord(unsigned: UnsignedRecord): P79HistoricalDeploymentGroundTruthRecord {
  return { ...unsigned, recordDigest: sha256Digest(canonicalJson(unsigned)) };
}

const DOMINOTT_RECORD = signRecord(buildUnsignedDominoTtRecord());
const DOMINOTT_UNSIGNED_CANONICAL = canonicalJson(unsignedRecord(DOMINOTT_RECORD));

function unsignedRecord(record: P79HistoricalDeploymentGroundTruthRecord): UnsignedRecord {
  const { recordDigest: _recordDigest, ...unsigned } = record;
  return unsigned;
}

function cloneRecord(record: P79HistoricalDeploymentGroundTruthRecord): P79HistoricalDeploymentGroundTruthRecord {
  return JSON.parse(JSON.stringify(record)) as P79HistoricalDeploymentGroundTruthRecord;
}

export function verifyP79HistoricalDeploymentGroundTruthRecord(value: unknown): value is P79HistoricalDeploymentGroundTruthRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  try {
    const record = value as P79HistoricalDeploymentGroundTruthRecord;
    if (record.schemaVersion !== P79_HISTORICAL_DEPLOYMENT_GROUND_TRUTH_ID || record.recordId !== P79_DOMINOTT_RECORD_ID) return false;
    if (normalizeAddress(record.incident.targetAddress) !== DOMINOTT_RECORD.incident.targetAddress) return false;
    if (normalizeAddress(record.incident.victimPoolAddress) !== DOMINOTT_RECORD.incident.victimPoolAddress) return false;
    if (normalizeAddress(record.incident.trustedForwarderAddress) !== DOMINOTT_RECORD.incident.trustedForwarderAddress) return false;
    if (normalizeTransaction(record.incident.attackTransaction) !== DOMINOTT_RECORD.incident.attackTransaction) return false;
    if (record.deployment.runtimeBytecodeDigest !== sha256Digest(normalizeHex(record.deployment.runtimeBytecode))) return false;
    if (extractP79Eip1167Implementation(record.deployment.runtimeBytecode) !== normalizeAddress(record.deployment.implementationAddress)) return false;
    if (!Array.isArray(record.anchors) || record.anchors.length !== 8) return false;
    if (record.anchors.some((anchor) => !/^[a-f0-9]{40}$/.test(anchor.blobSha) || !/^[a-f0-9]{40}$/.test(anchor.commit))) return false;
    const observedUnsigned = canonicalJson(unsignedRecord(record));
    if (observedUnsigned !== DOMINOTT_UNSIGNED_CANONICAL) return false;
    return record.recordDigest === DOMINOTT_RECORD.recordDigest
      && record.recordDigest === sha256Digest(observedUnsigned);
  } catch {
    return false;
  }
}

export function getP79HistoricalDeploymentGroundTruthRecords(): readonly P79HistoricalDeploymentGroundTruthRecord[] {
  return [cloneRecord(DOMINOTT_RECORD)];
}

export function findP79HistoricalDeploymentGroundTruthRecord(args: {
  chain?: string | null;
  contractAddress?: string | null;
}): P79HistoricalDeploymentGroundTruthRecord | null {
  const chain = String(args.chain ?? "").trim().toLowerCase().replace(/[\s_]+/g, "-");
  const normalizedChain = ["bsc", "bnb", "bnb-smart-chain", "binance-smart-chain", "56"].includes(chain) ? "bsc" : chain;
  const address = normalizeAddress(args.contractAddress);
  if (normalizedChain !== "bsc" || !address) return null;
  return address === DOMINOTT_RECORD.incident.targetAddress ? cloneRecord(DOMINOTT_RECORD) : null;
}
