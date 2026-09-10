import { ASCII_CONTROL_OR_MARKUP_PATTERN } from "./ascii-control-characters";

import { canonicalJson } from "@/lib/security/canonical-json";
import { sha256Digest } from "@/lib/security/cryptographic-digest";
import type { Pass2572AuditProviderRuntimeReport } from "@/lib/security/audit-provider-runtime-client";
import {
  buildAuditProviderEvidenceDimensions,
  PASS4809_AUDIT_PROVIDER_EVIDENCE_DIMENSIONS_ID,
} from "@/lib/security/audit-provider-evidence-dimensions";
import type { Pass2576AuditPermissionParserReport } from "@/lib/security/audit-permission-parser";
import type { Pass2577AuditLiquidityHolderLockRiskReport } from "@/lib/security/audit-liquidity-holder-lock-risk";
import type { AuditPublicSourceReceiptReport } from "@/lib/security/audit-public-source-receipts";
import {
  buildCustomerSafeAuditProviderRightsSummary,
  evaluateAuditProviderRightsCurrentness,
  type AuditProviderRightsRegistry,
} from "@/lib/security/audit-provider-rights-currentness";
import type { AuditTierId } from "@/lib/security/audit-tier-contract";

export const LEGACY_PASS4807_AUDIT_EVIDENCE_RECEIPT_PACKET_ID = "pass4807-audit-evidence-receipt-packet-v1" as const;
export const P89_PASS4809_AUDIT_EVIDENCE_RECEIPT_PACKET_ID = "pass4809-audit-evidence-receipt-packet-v2" as const;
export const PASS4809_AUDIT_EVIDENCE_RECEIPT_PACKET_ID = "pass4827-audit-evidence-receipt-packet-v3" as const;

export type AuditEvidenceReceiptRoots = {
  providerResponseRoot: string;
  publicSourceRoot: string;
  sourceAbiRoot: string;
  proxyImplementationRoot: string;
  permissionRoot: string;
  holderLiquidityRoot: string;
  conflictArbitrationRoot: string;
  /** Required by P89+ packets; absent only from frozen P88-and-earlier snapshots. */
  liveExecutionRoot?: string;
  /** Required by P90+ packets; binds customer eligibility separately from technical execution. */
  providerRightsCurrentnessRoot?: string;
  aggregateRoot: string;
};

export type AuditEvidenceReceiptPacket = {
  schemaVersion: typeof PASS4809_AUDIT_EVIDENCE_RECEIPT_PACKET_ID;
  generatedAt: string;
  target: { contractAddress: string | null; chain: string };
  upstreamTruth: {
    evidenceDimensionVersion: typeof PASS4809_AUDIT_PROVIDER_EVIDENCE_DIMENSIONS_ID;
    strictLaneCount: number;
    successfulLiveLaneCount: number;
    successfulLiveProviderIds: string[];
    duplicateStrictLanesRejected: number;
    duplicateLiveLanesRejected: number;
    independentUpstreamRoots: string[];
    correlationGroups: string[];
    strictQuorumMet: boolean;
  };
  customerEligibility: ReturnType<typeof buildCustomerSafeAuditProviderRightsSummary>;
  counts: {
    providerReceipts: number;
    successfulLiveProviderExecutions: number;
    publicSourceReceipts: number;
    sourceAbiReceipts: number;
    proxyImplementationSignals: number;
    permissionSignals: number;
    holderLiquiditySignals: number;
    conflicts: number;
  };
  roots: AuditEvidenceReceiptRoots;
  missing: string[];
};

function clean(value: unknown, max = 500) {
  return typeof value === "string"
    ? value.replace(ASCII_CONTROL_OR_MARKUP_PATTERN, " ").replace(/\s+/g, " ").trim().slice(0, max)
    : "";
}

function root(value: unknown) {
  return sha256Digest(canonicalJson(value));
}

export function buildAuditEvidenceReceiptPacket(input: {
  providerRuntime: Pass2572AuditProviderRuntimeReport;
  publicSources: AuditPublicSourceReceiptReport;
  permissionParser: Pass2576AuditPermissionParserReport;
  liquidityHolderRisk: Pass2577AuditLiquidityHolderLockRiskReport;
  tier?: AuditTierId;
  rightsRegistry?: AuditProviderRightsRegistry;
  evaluatedAt?: string;
}): AuditEvidenceReceiptPacket {
  const dimensions = buildAuditProviderEvidenceDimensions(input.providerRuntime.lanes);
  const rightsCurrentness = evaluateAuditProviderRightsCurrentness({
    lanes: input.providerRuntime.lanes,
    tier: input.tier ?? "basic",
    ...(input.rightsRegistry ? { registry: input.rightsRegistry } : {}),
    ...(input.evaluatedAt ? { now: input.evaluatedAt } : {}),
  });
  const customerEligibility = buildCustomerSafeAuditProviderRightsSummary(rightsCurrentness);
  const strictLanes = dimensions.strictLanes;
  const successfulLiveLanes = dimensions.successfulLiveLanes;
  const providerReceipts = strictLanes.map((lane) => ({
    laneId: lane.id,
    providerId: lane.lineage.providerId,
    providerFamily: lane.providerFamily ?? null,
    upstreamRoot: lane.lineage.upstreamRoot,
    correlationGroup: lane.lineage.correlationGroup,
    identity: lane.identity,
    receipt: lane.receipt,
    evidence: lane.evidence,
  }));
  const successfulLiveReceipts = successfulLiveLanes.map((lane) => ({
    laneId: lane.id,
    providerId: lane.lineage.providerId,
    providerFamily: lane.providerFamily ?? null,
    upstreamRoot: lane.lineage.upstreamRoot,
    correlationGroup: lane.lineage.correlationGroup,
    state: lane.state,
    identityVerification: lane.identity?.verification ?? "unverified",
    identityMatched: lane.identity?.matched === true,
    receipt: lane.receipt,
  }));
  const publicSourceReceipts = input.publicSources.receipts
    .filter((receipt) => receipt.contentBound)
    .map((receipt) => ({
      kind: receipt.kind,
      receiptDigest: receipt.receiptDigest,
      bodyDigest: receipt.bodyDigest,
      finalUrlHash: receipt.finalUrlHash,
      contentType: receipt.contentType,
      identity: receipt.identity,
      freshness: receipt.freshness,
      scopeSignals: receipt.scopeSignals,
      licenseSignals: receipt.licenseSignals,
    }));
  const explorerReceipts = strictLanes
    .filter((lane) => lane.providerFamily === "block_explorer")
    .map((lane) => ({ laneId: lane.id, receipt: lane.receipt, evidence: lane.evidence }));
  const sourcePublicReceipts = publicSourceReceipts.filter((receipt) =>
    receipt.scopeSignals.some((signal) => signal === "source-code" || signal === "smart-contract-audit"),
  );
  const sourceAbiReceipts = [...explorerReceipts, ...sourcePublicReceipts];
  const proxyImplementationSignals = [
    ...strictLanes
      .filter((lane) => lane.providerFamily === "block_explorer")
      .flatMap((lane) => lane.evidence.filter((item) => /proxy|implementation/i.test(item)).map((item) => ({ laneId: lane.id, item }))),
    ...input.permissionParser.signals
      .filter((signal) => signal.category === "upgrade_proxy")
      .map((signal) => ({ id: signal.id, state: signal.state, severity: signal.severity, evidence: signal.evidence, missing: signal.missing })),
  ];
  const permissionSignals = input.permissionParser.signals.map((signal) => ({
    id: signal.id,
    category: signal.category,
    state: signal.state,
    severity: signal.severity,
    evidence: signal.evidence,
    missing: signal.missing,
  }));
  const holderLiquiditySignals = input.liquidityHolderRisk.signals.map((signal) => ({
    id: signal.id,
    area: signal.area,
    state: signal.state,
    severity: signal.severity,
    sourceFamilies: signal.sourceFamilies,
    evidence: signal.evidence,
    missing: signal.missing,
  }));

  const upstreamGroups = new Map<string, string[]>();
  for (const lane of input.providerRuntime.lanes) {
    const rows = upstreamGroups.get(lane.lineage.upstreamRoot) ?? [];
    rows.push(lane.id);
    upstreamGroups.set(lane.lineage.upstreamRoot, rows);
  }
  const conflicts = [
    Array.from(upstreamGroups.entries())
      .filter(([, lanes]) => lanes.length > 1)
      .map(([upstreamRoot, lanes]) => ({ type: "correlated_lanes", upstreamRoot, lanes: lanes.sort() })),
    input.providerRuntime.lanes
      .filter((lane) => lane.state === "confirmed" && lane.identity?.matched !== true)
      .map((lane) => ({ type: "confirmed_without_identity", laneId: lane.id })),
    input.publicSources.receipts
      .filter((receipt) => receipt.contentBound && receipt.identity.requestedAddress && !receipt.identity.exactAddressPresent)
      .map((receipt) => ({ type: "public_source_identity_unproven", kind: receipt.kind, receiptDigest: receipt.receiptDigest })),
  ].flat();

  const rootsWithoutAggregate = {
    providerResponseRoot: root(providerReceipts),
    publicSourceRoot: input.publicSources.summary.aggregateRoot,
    sourceAbiRoot: root(sourceAbiReceipts),
    proxyImplementationRoot: root(proxyImplementationSignals),
    permissionRoot: root(permissionSignals),
    holderLiquidityRoot: root(holderLiquiditySignals),
    conflictArbitrationRoot: root(conflicts),
    liveExecutionRoot: root(successfulLiveReceipts),
    providerRightsCurrentnessRoot: root({
      rightsCurrentnessDigest: rightsCurrentness.rightsCurrentnessDigest,
      customerEligibility,
      resolutionDigests: rightsCurrentness.resolutions.map((row) => row.resolutionSha256).sort(),
    }),
  };
  const aggregateRoot = root({
    schemaVersion: PASS4809_AUDIT_EVIDENCE_RECEIPT_PACKET_ID,
    target: input.providerRuntime.target,
    roots: rootsWithoutAggregate,
  });
  const independentUpstreamRoots = dimensions.independentUpstreamRoots;
  const correlationGroups = Array.from(new Set(strictLanes.map((lane) => lane.lineage.correlationGroup))).sort();
  const missing = [
    independentUpstreamRoots.length < 2 ? `independent_upstream_roots:${independentUpstreamRoots.length}/2` : null,
    sourceAbiReceipts.length === 0 ? "source_abi_receipt_missing" : null,
    proxyImplementationSignals.length === 0 ? "proxy_implementation_binding_missing" : null,
    permissionSignals.every((signal) => signal.state === "unknown" || signal.state === "blocked") ? "permission_evidence_missing" : null,
    holderLiquiditySignals.every((signal) => signal.state === "missing" || signal.state === "blocked" || signal.state === "not_run") ? "holder_liquidity_evidence_missing" : null,
    !rightsCurrentness.commercialUseReady ? "provider_rights_currentness_not_ready" : null,
    rightsCurrentness.blockedFieldIds.length ? `customer_field_rights_or_currentness_blocked:${rightsCurrentness.blockedFieldIds.length}` : null,
    ...input.publicSources.missing.slice(0, 8),
  ].filter((item): item is string => Boolean(item)).map((item) => clean(item, 300)).filter(Boolean);

  return {
    schemaVersion: PASS4809_AUDIT_EVIDENCE_RECEIPT_PACKET_ID,
    generatedAt: new Date().toISOString(),
    target: {
      contractAddress: input.providerRuntime.target.contractAddress?.toLowerCase() ?? null,
      chain: input.providerRuntime.target.chain,
    },
    upstreamTruth: {
      evidenceDimensionVersion: PASS4809_AUDIT_PROVIDER_EVIDENCE_DIMENSIONS_ID,
      strictLaneCount: strictLanes.length,
      successfulLiveLaneCount: successfulLiveLanes.length,
      successfulLiveProviderIds: dimensions.successfulLiveProviderIds,
      duplicateStrictLanesRejected: dimensions.duplicateStrictLanesRejected,
      duplicateLiveLanesRejected: dimensions.duplicateLiveLanesRejected,
      independentUpstreamRoots,
      correlationGroups,
      strictQuorumMet: independentUpstreamRoots.length >= 2,
    },
    customerEligibility,
    counts: {
      providerReceipts: providerReceipts.length,
      successfulLiveProviderExecutions: successfulLiveReceipts.length,
      publicSourceReceipts: publicSourceReceipts.length,
      sourceAbiReceipts: sourceAbiReceipts.length,
      proxyImplementationSignals: proxyImplementationSignals.length,
      permissionSignals: permissionSignals.length,
      holderLiquiditySignals: holderLiquiditySignals.length,
      conflicts: conflicts.length,
    },
    roots: { ...rootsWithoutAggregate, aggregateRoot },
    missing: missing.slice(0, 24),
  };
}
