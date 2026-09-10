import { canonicalJson } from "../security/canonical-json";
import { sha256Hex } from "../security/cryptographic-digest";
import { fetchServerOwnedWhaleEvidence, verifyServerOwnedWhaleEvidenceIntegrity, type ServerOwnedWhaleEvidence } from "./server-owned-market-intelligence-providers";
import { buildWhaleWatchAnalysis, verifyWhaleWatchResultIntegrity } from "./whale-watch-engine";
import { buildWhaleWatchTierPacket, verifyWhaleWatchTierPacket, type WhaleWatchTierPacket } from "./market-impact-whale-tier-runtime";
import { verifyWalletLabelRegistryArtifact, type WalletLabelRegistryArtifact } from "./wallet-label-registry";
import type { MarketAssetBindingArtifact } from "./market-asset-binding";
import type { MarketImpactVenueSnapshot } from "./market-impact-types";
import type { WhaleCapabilityReceipt, WhaleEvidenceStatus, WhaleHolderSnapshot, WhaleTransferEvent, WhaleWatchResult } from "./whale-watch-types";

export const PASS35_A12_PUBLIC_WHALE_RUNTIME_ID = "pass35-a12-public-whale-runtime-v1" as const;
export type PublicWhaleExecutionMode = "PUBLIC_NETWORK" | "INJECTED_FIXTURE";

export interface Pass35A12PublicWhaleRuntime {
  schemaVersion: "velmere.pass35.public-whale-runtime.v1";
  runtimeId: typeof PASS35_A12_PUBLIC_WHALE_RUNTIME_ID;
  assetKey: string;
  generatedAt: string;
  executionMode: PublicWhaleExecutionMode;
  sourceEvidence: ServerOwnedWhaleEvidence;
  verifiedLabelArtifactCount: number;
  rejectedLabelArtifactCount: number;
  labelCoveragePercent: number;
  result: WhaleWatchResult | null;
  tierPackets: {
    basic: WhaleWatchTierPacket | null;
    pro: WhaleWatchTierPacket | null;
    advanced: WhaleWatchTierPacket | null;
  };
  blockers: string[];
  liveClaimed: boolean;
  realPublicWhaleExecution: boolean;
  sellEnabled: false;
  paidDeliveryEligible: false;
  truthBoundary: string;
  integrity: { algorithm: "sha256"; digest: string };
}

function normalizedStatus(mode: PublicWhaleExecutionMode, status: WhaleEvidenceStatus): WhaleEvidenceStatus {
  return mode === "INJECTED_FIXTURE" ? "verified_fixture" : status;
}

function unsigned(value: Pass35A12PublicWhaleRuntime): Omit<Pass35A12PublicWhaleRuntime, "integrity"> {
  const { integrity: _integrity, ...rest } = value;
  return rest;
}

function labelHolderRows(args: {
  holders: WhaleHolderSnapshot[];
  artifacts: WalletLabelRegistryArtifact[];
  secret: string;
  assetKey: string;
  now: Date;
  mode: PublicWhaleExecutionMode;
}) {
  const verified = new Map<string, WalletLabelRegistryArtifact>();
  let rejected = 0;
  for (const artifact of args.artifacts) {
    const check = verifyWalletLabelRegistryArtifact({
      artifact,
      secret: args.secret,
      now: args.now,
      expected: { assetKey: args.assetKey },
      minimumConfidencePercent: 50,
    });
    if (!check.ok) {
      rejected += 1;
      continue;
    }
    const holderId = check.artifact.payload.holderId.toLowerCase();
    const current = verified.get(holderId);
    if (!current || check.artifact.payload.confidencePercent > current.payload.confidencePercent) {
      verified.set(holderId, check.artifact);
    }
  }
  const holders = args.holders.map((row) => {
    const artifact = verified.get(row.holderId.toLowerCase());
    return artifact ? {
      ...row,
      category: artifact.payload.category,
      clusterId: artifact.payload.clusterId,
      labelVerified: true,
      providerFamily: artifact.payload.providerFamily,
      sourceDigest: artifact.payload.sourceDigest,
      status: normalizedStatus(args.mode, row.status),
    } : { ...row, category: row.category ?? "unknown", labelVerified: false, status: normalizedStatus(args.mode, row.status) };
  });
  return { holders, verified, rejected };
}

function labelTransfers(transfers: WhaleTransferEvent[], labels: Map<string, WalletLabelRegistryArtifact>, mode: PublicWhaleExecutionMode) {
  return transfers.map((row) => ({
    ...row,
    fromCategory: row.fromHolderId ? labels.get(row.fromHolderId.toLowerCase())?.payload.category ?? row.fromCategory ?? "unknown" : row.fromCategory,
    toCategory: row.toHolderId ? labels.get(row.toHolderId.toLowerCase())?.payload.category ?? row.toCategory ?? "unknown" : row.toCategory,
    status: normalizedStatus(mode, row.status),
  }));
}

function normalizeReceipts(receipts: WhaleCapabilityReceipt[], mode: PublicWhaleExecutionMode): WhaleCapabilityReceipt[] {
  return receipts.map((row) => ({ ...row, status: normalizedStatus(mode, row.status) }));
}

export async function runPass35A12PublicWhaleRuntime(args: {
  assetKey: string;
  bindingArtifact: MarketAssetBindingArtifact;
  bindingSecret: string;
  walletLabelArtifacts: WalletLabelRegistryArtifact[];
  walletLabelSecret: string;
  redactionSecret: string;
  marketImpactSnapshots: MarketImpactVenueSnapshot[];
  fallbackPriceUsd?: number | null;
  fetchImpl?: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
  now?: Date;
}): Promise<Pass35A12PublicWhaleRuntime> {
  const now = args.now ?? new Date();
  const mode: PublicWhaleExecutionMode = args.fetchImpl ? "INJECTED_FIXTURE" : "PUBLIC_NETWORK";
  const sourceEvidence = await fetchServerOwnedWhaleEvidence({
    assetKey: args.assetKey,
    bindingArtifact: args.bindingArtifact,
    bindingSecret: args.bindingSecret,
    fallbackPriceUsd: args.fallbackPriceUsd,
    fetchImpl: args.fetchImpl,
    now,
    bypassCache: true,
  });
  if (!verifyServerOwnedWhaleEvidenceIntegrity(sourceEvidence)) throw new Error("a12_whale_source_integrity_invalid");

  const labeled = labelHolderRows({
    holders: sourceEvidence.holders,
    artifacts: args.walletLabelArtifacts,
    secret: args.walletLabelSecret,
    assetKey: sourceEvidence.assetKey,
    now,
    mode,
  });
  const transfers = labelTransfers(sourceEvidence.transfers, labeled.verified, mode);
  const capabilityReceipts = normalizeReceipts(sourceEvidence.capabilityReceipts, mode);
  if (labeled.verified.size > 0) {
    capabilityReceipts.push({
      capability: "wallet_labels",
      providerFamily: Array.from(labeled.verified.values())[0]?.payload.providerFamily ?? "signed_registry",
      observedAt: now.toISOString(),
      status: mode === "INJECTED_FIXTURE" ? "verified_fixture" : "verified_live",
      recordCount: labeled.verified.size,
      coverageComplete: false,
      sourceDigest: sha256Hex(canonicalJson(Array.from(labeled.verified.values()).map((row) => row.payloadDigest).sort())),
    });
  }

  const blockers = new Set(sourceEvidence.blockers.filter((row) => row !== "verified_wallet_label_registry_required"));
  if (labeled.verified.size === 0) blockers.add("verified_wallet_label_registry_required");
  if (!sourceEvidence.totalSupply) blockers.add("verified_total_supply_required");
  if (!sourceEvidence.priceUsd) blockers.add("verified_usd_price_required");
  if (labeled.holders.length === 0) blockers.add("holder_distribution_required");
  if (transfers.length === 0) blockers.add("transfer_history_required");

  let result: WhaleWatchResult | null = null;
  let basic: WhaleWatchTierPacket | null = null;
  let pro: WhaleWatchTierPacket | null = null;
  let advanced: WhaleWatchTierPacket | null = null;
  if (sourceEvidence.totalSupply && sourceEvidence.priceUsd && labeled.holders.length > 0 && transfers.length > 0) {
    result = buildWhaleWatchAnalysis({
      assetKey: sourceEvidence.assetKey,
      totalSupply: sourceEvidence.totalSupply,
      priceUsd: sourceEvidence.priceUsd,
      holders: labeled.holders,
      transfers,
      capabilityReceipts,
      marketImpactSnapshots: args.marketImpactSnapshots.map((row) => ({ ...row, status: mode === "INJECTED_FIXTURE" ? "verified_fixture" : row.status })),
      redactionSecret: args.redactionSecret,
      walletLabelArtifacts: Array.from(labeled.verified.values()),
      walletLabelVerificationSecret: args.walletLabelSecret,
      now,
      policy: {
        allowFixture: mode === "INJECTED_FIXTURE",
        allowStaging: true,
        minimumProviderFamilies: 2,
        minimumHolderCoveragePercent: 50,
        minimumVerifiedLabelCoveragePercent: 30,
        minimumClusterCoveragePercent: 15,
      },
    });
    if (!verifyWhaleWatchResultIntegrity(result)) throw new Error("a12_whale_result_integrity_invalid");
    basic = buildWhaleWatchTierPacket(result, "basic");
    pro = buildWhaleWatchTierPacket(result, "pro");
    advanced = buildWhaleWatchTierPacket(result, "advanced");
    if (![basic, pro, advanced].every(verifyWhaleWatchTierPacket)) throw new Error("a12_whale_tier_integrity_invalid");
  }

  const liveClaimed = mode === "PUBLIC_NETWORK" && blockers.size === 0 && result?.evidenceStatus === "verified_live";
  const core: Omit<Pass35A12PublicWhaleRuntime, "integrity"> = {
    schemaVersion: "velmere.pass35.public-whale-runtime.v1",
    runtimeId: PASS35_A12_PUBLIC_WHALE_RUNTIME_ID,
    assetKey: sourceEvidence.assetKey,
    generatedAt: now.toISOString(),
    executionMode: mode,
    sourceEvidence,
    verifiedLabelArtifactCount: labeled.verified.size,
    rejectedLabelArtifactCount: labeled.rejected,
    labelCoveragePercent: labeled.holders.length > 0 ? Math.round((labeled.holders.filter((row) => row.labelVerified).length / labeled.holders.length) * 10_000) / 100 : 0,
    result,
    tierPackets: { basic, pro, advanced },
    blockers: Array.from(blockers).sort(),
    liveClaimed,
    realPublicWhaleExecution: liveClaimed,
    sellEnabled: false,
    paidDeliveryEligible: false,
    truthBoundary: "Public explorer/RPC inputs, signed token bindings and signed wallet labels can power Whale Watch without paid feeds. Injected fetches are fixture proof. A point-in-time public-network result does not prove continuous coverage, beneficial ownership, intent, uptime, customer value or paid readiness.",
  };
  return { ...core, integrity: { algorithm: "sha256", digest: sha256Hex(canonicalJson(core)) } };
}

export function verifyPass35A12PublicWhaleRuntime(value: Pass35A12PublicWhaleRuntime): boolean {
  try {
    if (value.schemaVersion !== "velmere.pass35.public-whale-runtime.v1" || value.runtimeId !== PASS35_A12_PUBLIC_WHALE_RUNTIME_ID) return false;
    if (!/^[a-f0-9]{64}$/.test(value.integrity.digest) || value.integrity.digest !== sha256Hex(canonicalJson(unsigned(value)))) return false;
    if (!verifyServerOwnedWhaleEvidenceIntegrity(value.sourceEvidence)) return false;
    if (value.result && !verifyWhaleWatchResultIntegrity(value.result)) return false;
    if (![value.tierPackets.basic, value.tierPackets.pro, value.tierPackets.advanced].filter(Boolean).every((row) => verifyWhaleWatchTierPacket(row!))) return false;
    if (value.executionMode === "INJECTED_FIXTURE" && (value.liveClaimed || value.realPublicWhaleExecution)) return false;
    return value.sellEnabled === false && value.paidDeliveryEligible === false;
  } catch {
    return false;
  }
}
