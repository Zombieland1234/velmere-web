import { canonicalJson } from "./canonical-json";
import { sha256Digest } from "./cryptographic-digest";
import {
  P78_ERC2771_MULTICALL_DETECTOR_ID,
  type P78Erc2771MulticallResult,
} from "./erc2771-multicall-context-detector";
import {
  extractP79Eip1167Implementation,
  findP79HistoricalDeploymentGroundTruthRecord,
  type P79HistoricalDeploymentGroundTruthRecord,
  verifyP79HistoricalDeploymentGroundTruthRecord,
} from "./audit-historical-deployment-ground-truth";

export const P79_DEPLOYMENT_CONTEXT_ADJUDICATOR_ID = "p79-deployment-context-adjudicator.v1" as const;

export type P79DeploymentContextClassification =
  | "NOT_APPLICABLE"
  | "BLOCKED_SOURCE_NOT_BOUND"
  | "HISTORICAL_DEPLOYMENT_BOUND_UPSTREAM_REPLAY";

export type P79HistoricalDeploymentContextAdjudication = {
  adjudicatorId: typeof P79_DEPLOYMENT_CONTEXT_ADJUDICATOR_ID;
  classification: P79DeploymentContextClassification;
  target: {
    chain: string;
    chainId?: string;
    contractAddress?: string;
  };
  sourceBinding: {
    detectorId?: string;
    classification?: string;
    sourceRiskSignalBound: boolean;
    evidenceRefCount: number;
    compositionContractCount: number;
    trustedForwarderConfigurationObserved: boolean;
    detectorExploitabilityProven: boolean;
    detectorCustomerFinalEligible: boolean;
    rawSourceIncluded: false;
    rawAbiIncluded: false;
  };
  deploymentBinding: null | {
    recordId: string;
    recordDigest: string;
    snapshotBlock: number;
    attackBlock: number;
    attackTransaction: string;
    proxyKind: "EIP_1167_COMPATIBLE_MINIMAL_PROXY";
    runtimeBytecodeDigest: string;
    implementationAddress: string;
    exactRuntimeObservedAtSnapshot: true;
    pinnedSourceCorpusAnchorCount: number;
    exactCompilationToRuntimeProven: false;
  };
  trustedForwarder: null | {
    address: string;
    state: "ACTIVE_AT_SNAPSHOT_FROM_PINNED_EXECUTION_TRACE";
    exactBlock: number;
    evidenceClass: "UPSTREAM_REPLAY_EXECUTION_PATH";
  };
  replay: {
    upstreamReplayProven: boolean;
    upstreamProfit?: string;
    pinnedCommit?: string;
    pinnedBlobSha?: string;
    independentVelmereReplayProven: false;
  };
  historicalFinding: {
    factEligible: boolean;
    severity: "critical" | "none";
    title?: string;
    customerLine?: string;
    proPdfLine?: string;
  };
  currentness: {
    historicalSnapshotOnly: boolean;
    currentRuntimeStateProven: false;
    currentTrustedForwarderStateProven: false;
    currentExploitabilityProven: false;
  };
  rights: {
    metadataOnly: true;
    rawSourceTraceStateRedistributed: false;
    customerRedistributionAuthorized: false;
  };
  blockers: string[];
  evidenceRefs: string[];
  confidence: number;
  customerFinalEligible: false;
  auditFinalPdfEligible: false;
  adjudicationDigest: string;
};

type UnsignedAdjudication = Omit<P79HistoricalDeploymentContextAdjudication, "adjudicationDigest">;

const NOT_APPLICABLE_BLOCKERS = ["no pinned historical deployment ground-truth record for this exact chain and address"];
const BLOCKED_SOURCE_BLOCKERS = [
  "verified source risk signal is not bound to this deployment record",
  "independent Velmere fork/replay is not present",
  "current multi-provider RPC state is not proven",
];
const HISTORICAL_BLOCKERS = [
  "independent Velmere fork/replay on an authorized archival RPC is not present",
  "current runtime bytecode and trusted-forwarder state require multi-provider RPC quorum",
  "current rights/currentness and immutable customer/PDF delivery bytes are not closed",
  "exact Windows release proof is withheld",
];

function cleanChain(value: unknown) {
  const chain = typeof value === "string" ? value.trim().toLowerCase().replace(/[\s_]+/g, "-").slice(0, 40) : "";
  return ["bsc", "bnb", "bnb-smart-chain", "binance-smart-chain", "56"].includes(chain) ? "bsc" : chain;
}

function cleanAddress(value: unknown) {
  const text = typeof value === "string" ? value.trim().toLowerCase() : "";
  return /^0x[a-f0-9]{40}$/.test(text) ? text : undefined;
}

function sign(unsigned: UnsignedAdjudication): P79HistoricalDeploymentContextAdjudication {
  return { ...unsigned, adjudicationDigest: sha256Digest(canonicalJson(unsigned)) };
}

function unsigned(value: P79HistoricalDeploymentContextAdjudication): UnsignedAdjudication {
  const { adjudicationDigest: _adjudicationDigest, ...rest } = value;
  return rest;
}

function isBoundP78SourceSignal(source: P78Erc2771MulticallResult | null | undefined): boolean {
  if (!source) return false;
  const evidenceKinds = new Set(source.evidence.map((item) => item.kind));
  return source.detectorId === P78_ERC2771_MULTICALL_DETECTOR_ID
    && source.classification === "SOURCE_PATTERN_RISK_SIGNAL"
    && source.sourcePatternDetected === true
    && source.mitigation === null
    && source.compositionContracts.length > 0
    && source.trustedForwarderConfigurationObserved === true
    && source.trustedForwarderRuntimeState === "UNKNOWN_RUNTIME_NOT_PROVEN"
    && source.exploitabilityProven === false
    && source.customerFinalEligibleFromDetector === false
    && evidenceKinds.has("composition")
    && evidenceKinds.has("multicall")
    && evidenceKinds.has("trusted_forwarder_configuration");
}

function base(args: {
  chain?: string | null;
  contractAddress?: string | null;
  source?: P78Erc2771MulticallResult | null;
}): Omit<UnsignedAdjudication, "classification" | "deploymentBinding" | "trustedForwarder" | "replay" | "historicalFinding" | "currentness" | "rights" | "blockers" | "evidenceRefs" | "confidence" | "customerFinalEligible" | "auditFinalPdfEligible"> {
  const untrustedSource = args.source as unknown as Record<string, unknown> | null | undefined;
  return {
    adjudicatorId: P79_DEPLOYMENT_CONTEXT_ADJUDICATOR_ID,
    target: {
      chain: cleanChain(args.chain) || "unknown",
      contractAddress: cleanAddress(args.contractAddress),
    },
    sourceBinding: {
      detectorId: args.source?.detectorId,
      classification: args.source?.classification,
      sourceRiskSignalBound: isBoundP78SourceSignal(args.source),
      evidenceRefCount: Math.max(0, Math.min(64, args.source?.evidence.length ?? 0)),
      compositionContractCount: Math.max(0, Math.min(32, args.source?.compositionContracts.length ?? 0)),
      trustedForwarderConfigurationObserved: args.source?.trustedForwarderConfigurationObserved === true,
      detectorExploitabilityProven: untrustedSource?.exploitabilityProven === true,
      detectorCustomerFinalEligible: untrustedSource?.customerFinalEligibleFromDetector === true,
      rawSourceIncluded: false,
      rawAbiIncluded: false,
    },
  };
}

function deploymentBinding(record: P79HistoricalDeploymentGroundTruthRecord): NonNullable<P79HistoricalDeploymentContextAdjudication["deploymentBinding"]> {
  const implementation = extractP79Eip1167Implementation(record.deployment.runtimeBytecode);
  return {
    recordId: record.recordId,
    recordDigest: record.recordDigest,
    snapshotBlock: record.incident.snapshotBlock,
    attackBlock: record.incident.attackBlock,
    attackTransaction: record.incident.attackTransaction,
    proxyKind: record.deployment.proxyKind,
    runtimeBytecodeDigest: record.deployment.runtimeBytecodeDigest,
    implementationAddress: implementation ?? record.deployment.implementationAddress,
    exactRuntimeObservedAtSnapshot: true,
    pinnedSourceCorpusAnchorCount: record.verifiedSourceMetadata.criticalSourceAnchorCount,
    exactCompilationToRuntimeProven: false,
  };
}

function trustedForwarder(record: P79HistoricalDeploymentGroundTruthRecord): NonNullable<P79HistoricalDeploymentContextAdjudication["trustedForwarder"]> {
  return {
    address: record.incident.trustedForwarderAddress,
    state: "ACTIVE_AT_SNAPSHOT_FROM_PINNED_EXECUTION_TRACE",
    exactBlock: record.incident.snapshotBlock,
    evidenceClass: "UPSTREAM_REPLAY_EXECUTION_PATH",
  };
}

function replay(record: P79HistoricalDeploymentGroundTruthRecord): P79HistoricalDeploymentContextAdjudication["replay"] {
  const upstream = record.anchors.find((anchor) => anchor.kind === "upstream_replay_poc");
  return {
    upstreamReplayProven: true,
    upstreamProfit: record.replay.attackerProfitDisplay,
    pinnedCommit: upstream?.commit,
    pinnedBlobSha: upstream?.blobSha,
    independentVelmereReplayProven: false,
  };
}

function historicalFinding(record: P79HistoricalDeploymentGroundTruthRecord): P79HistoricalDeploymentContextAdjudication["historicalFinding"] {
  return {
    factEligible: true,
    severity: "critical",
    title: "Historical deployment-bound ERC2771 + Multicall exploit",
    customerLine: `Historical incident confirmed for this exact BSC address at block ${record.incident.attackBlock}: a trusted-forwarder + Multicall context-confusion path was replayed against the snapshot at block ${record.incident.snapshotBlock}. This does not prove current exploitability.`,
    proPdfLine: `historicalDeployment=${record.incident.targetAddress}; snapshotBlock=${record.incident.snapshotBlock}; attackBlock=${record.incident.attackBlock}; attackTx=${record.incident.attackTransaction}; proxy=${record.deployment.proxyKind}; implementation=${record.deployment.implementationAddress}; trustedForwarder=${record.incident.trustedForwarderAddress}; upstreamReplay=PASS; profit=${record.replay.attackerProfitDisplay}; independentVelmereReplay=false; currentExploitabilityProven=false`,
  };
}

function evidenceRefs(record: P79HistoricalDeploymentGroundTruthRecord) {
  return record.anchors.map((anchor) => `${anchor.kind}:${anchor.repository}@${anchor.commit}:${anchor.blobSha}`);
}

function immutableBoundaries(recordExists: boolean) {
  return {
    currentness: {
      historicalSnapshotOnly: recordExists,
      currentRuntimeStateProven: false as const,
      currentTrustedForwarderStateProven: false as const,
      currentExploitabilityProven: false as const,
    },
    rights: {
      metadataOnly: true as const,
      rawSourceTraceStateRedistributed: false as const,
      customerRedistributionAuthorized: false as const,
    },
    customerFinalEligible: false as const,
    auditFinalPdfEligible: false as const,
  };
}

export function buildP79HistoricalDeploymentContextAdjudication(args: {
  chain?: string | null;
  contractAddress?: string | null;
  sourceContextIntegrity?: P78Erc2771MulticallResult | null;
}): P79HistoricalDeploymentContextAdjudication {
  const source = args.sourceContextIntegrity ?? null;
  const common = base({ chain: args.chain, contractAddress: args.contractAddress, source });
  const record = findP79HistoricalDeploymentGroundTruthRecord({ chain: args.chain, contractAddress: args.contractAddress });

  if (!record || !verifyP79HistoricalDeploymentGroundTruthRecord(record)) {
    return sign({
      ...common,
      classification: "NOT_APPLICABLE",
      deploymentBinding: null,
      trustedForwarder: null,
      replay: { upstreamReplayProven: false, independentVelmereReplayProven: false },
      historicalFinding: { factEligible: false, severity: "none" },
      ...immutableBoundaries(false),
      blockers: [...NOT_APPLICABLE_BLOCKERS],
      evidenceRefs: [],
      confidence: 0,
    });
  }

  const boundDeployment = deploymentBinding(record);
  const boundForwarder = trustedForwarder(record);
  const boundReplay = replay(record);
  const boundEvidenceRefs = evidenceRefs(record);

  if (!common.sourceBinding.sourceRiskSignalBound) {
    return sign({
      ...common,
      target: { ...common.target, chain: record.incident.chain, chainId: record.incident.chainId },
      classification: "BLOCKED_SOURCE_NOT_BOUND",
      deploymentBinding: boundDeployment,
      trustedForwarder: boundForwarder,
      replay: boundReplay,
      historicalFinding: { factEligible: false, severity: "none" },
      ...immutableBoundaries(true),
      blockers: [...BLOCKED_SOURCE_BLOCKERS],
      evidenceRefs: boundEvidenceRefs,
      confidence: 54,
    });
  }

  return sign({
    ...common,
    target: { ...common.target, chain: record.incident.chain, chainId: record.incident.chainId },
    classification: "HISTORICAL_DEPLOYMENT_BOUND_UPSTREAM_REPLAY",
    deploymentBinding: boundDeployment,
    trustedForwarder: boundForwarder,
    replay: boundReplay,
    historicalFinding: historicalFinding(record),
    ...immutableBoundaries(true),
    blockers: [...HISTORICAL_BLOCKERS],
    evidenceRefs: boundEvidenceRefs,
    confidence: 92,
  });
}

function containsForbiddenPrivateField(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  if (Array.isArray(value)) return value.some(containsForbiddenPrivateField);
  const forbidden = new Set(["runtimeBytecode", "sourceText", "abiText", "traceText", "stateJson", "rawSource", "rawAbi"]);
  return Object.entries(value as Record<string, unknown>).some(([key, item]) => forbidden.has(key) || containsForbiddenPrivateField(item));
}

function same(value: unknown, expected: unknown) {
  return canonicalJson(value) === canonicalJson(expected);
}

export function verifyP79HistoricalDeploymentContextAdjudication(value: unknown): value is P79HistoricalDeploymentContextAdjudication {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  try {
    const result = value as P79HistoricalDeploymentContextAdjudication;
    if (result.adjudicatorId !== P79_DEPLOYMENT_CONTEXT_ADJUDICATOR_ID) return false;
    if (result.customerFinalEligible !== false || result.auditFinalPdfEligible !== false) return false;
    if (result.replay.independentVelmereReplayProven !== false) return false;
    if (result.currentness.currentRuntimeStateProven !== false || result.currentness.currentTrustedForwarderStateProven !== false || result.currentness.currentExploitabilityProven !== false) return false;
    if (result.rights.metadataOnly !== true || result.rights.rawSourceTraceStateRedistributed !== false || result.rights.customerRedistributionAuthorized !== false) return false;
    if (result.sourceBinding.rawSourceIncluded !== false || result.sourceBinding.rawAbiIncluded !== false) return false;
    if (result.sourceBinding.detectorExploitabilityProven || result.sourceBinding.detectorCustomerFinalEligible) return false;
    if (containsForbiddenPrivateField(result)) return false;

    if (result.classification === "HISTORICAL_DEPLOYMENT_BOUND_UPSTREAM_REPLAY") {
      const record = findP79HistoricalDeploymentGroundTruthRecord({ chain: result.target.chain, contractAddress: result.target.contractAddress });
      if (!record || !verifyP79HistoricalDeploymentGroundTruthRecord(record)) return false;
      if (result.target.chain !== record.incident.chain || result.target.chainId !== record.incident.chainId || result.target.contractAddress !== record.incident.targetAddress) return false;
      if (!result.sourceBinding.sourceRiskSignalBound
        || result.sourceBinding.detectorId !== P78_ERC2771_MULTICALL_DETECTOR_ID
        || result.sourceBinding.classification !== "SOURCE_PATTERN_RISK_SIGNAL"
        || result.sourceBinding.evidenceRefCount < 3
        || result.sourceBinding.compositionContractCount < 1
        || !result.sourceBinding.trustedForwarderConfigurationObserved) return false;
      if (!same(result.deploymentBinding, deploymentBinding(record))) return false;
      if (!same(result.trustedForwarder, trustedForwarder(record))) return false;
      if (!same(result.replay, replay(record))) return false;
      if (!same(result.historicalFinding, historicalFinding(record))) return false;
      if (!same(result.evidenceRefs, evidenceRefs(record)) || !same(result.blockers, HISTORICAL_BLOCKERS)) return false;
      if (!result.replay.upstreamReplayProven || result.confidence !== 92 || !result.currentness.historicalSnapshotOnly) return false;
    } else if (result.classification === "BLOCKED_SOURCE_NOT_BOUND") {
      const record = findP79HistoricalDeploymentGroundTruthRecord({ chain: result.target.chain, contractAddress: result.target.contractAddress });
      if (!record || !verifyP79HistoricalDeploymentGroundTruthRecord(record)) return false;
      if (result.sourceBinding.sourceRiskSignalBound || result.historicalFinding.factEligible || result.historicalFinding.severity !== "none") return false;
      if (!same(result.deploymentBinding, deploymentBinding(record)) || !same(result.trustedForwarder, trustedForwarder(record)) || !same(result.replay, replay(record))) return false;
      if (!same(result.evidenceRefs, evidenceRefs(record)) || !same(result.blockers, BLOCKED_SOURCE_BLOCKERS)) return false;
      if (result.confidence !== 54 || !result.currentness.historicalSnapshotOnly) return false;
    } else if (result.classification === "NOT_APPLICABLE") {
      if (result.deploymentBinding !== null || result.trustedForwarder !== null || result.historicalFinding.factEligible || result.historicalFinding.severity !== "none") return false;
      if (result.replay.upstreamReplayProven || result.evidenceRefs.length !== 0 || !same(result.blockers, NOT_APPLICABLE_BLOCKERS)) return false;
      if (result.confidence !== 0 || result.currentness.historicalSnapshotOnly) return false;
    } else {
      return false;
    }

    return result.adjudicationDigest === sha256Digest(canonicalJson(unsigned(result)));
  } catch {
    return false;
  }
}
