import { buildWhaleWatchCustomerTruth } from "./whale-watch-customer-truth";
import { createHmac } from "node:crypto";
import { canonicalJson } from "../security/canonical-json";
import { sha256Hex } from "../security/cryptographic-digest";
import { buildMarketImpactAnalysis } from "./market-impact-engine";
import { canonicalProviderFamily, distinctProviderFamilies } from "./provider-family-identity";
import { verifyWalletLabelRegistryArtifact } from "./wallet-label-registry";
import {
  deduplicateCanonicalWhaleTransfers,
  hasCanonicalWhaleEventIdentityClaim,
} from "./whale-watch-onchain-event-identity";
import type {
  HolderCategory,
  WhaleCapability,
  WhaleCapabilityReceipt,
  WhaleConcentrationSummary,
  WhaleEvidenceStatus,
  WhaleExitStressResult,
  WhaleFlowWindow,
  WhaleHolderSnapshot,
  WhaleTransferEvent,
  WhaleWatchAlert,
  WhaleWatchInput,
  WhaleWatchPolicy,
  WhaleWatchResult,
} from "./whale-watch-types";

const REQUIRED_CAPABILITIES: WhaleCapability[] = [
  "holder_distribution",
  "wallet_labels",
  "transfer_history",
];

const DEFAULT_POLICY: WhaleWatchPolicy = {
  maximumHolderAgeMs: 6 * 60 * 60_000,
  maximumTransferAgeMs: 30 * 24 * 60 * 60_000,
  maximumReceiptAgeMs: 30 * 60_000,
  minimumProviderFamilies: 2,
  minimumHolderCoveragePercent: 50,
  minimumVerifiedLabelCoveragePercent: 30,
  minimumClusterCoveragePercent: 15,
  minimumWalletLabelConfidencePercent: 50,
  allowStaging: true,
  allowFixture: false,
  exitStressFractions: [0.05, 0.1, 0.25],
};

const EXCLUDED_FROM_ADJUSTED = new Set<HolderCategory>([
  "exchange",
  "custody",
  "bridge",
  "liquidity_pool",
  "burn",
  "contract",
]);

const EXCHANGE_LIKE = new Set<HolderCategory>(["exchange", "custody"]);
const TREASURY_LIKE = new Set<HolderCategory>(["treasury", "team"]);
const WHALE_LIKE = new Set<HolderCategory>(["private_whale", "treasury", "team"]);
const PLACEHOLDER_SECRET = /(changeme|replace|example|placeholder|secret123|test-secret|dummy)/i;

function round(value: number, digits = 6): number {
  if (!Number.isFinite(value)) return 0;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function normalizeAssetKey(value: string): string {
  return value.trim().toUpperCase().replace(/\s+/g, "").slice(0, 120);
}

function normalizedPolicy(input?: Partial<WhaleWatchPolicy>): WhaleWatchPolicy {
  const policy = { ...DEFAULT_POLICY, ...(input ?? {}) };
  const exitStressFractions = Array.from(new Set(
    policy.exitStressFractions
      .filter((value) => Number.isFinite(value) && value > 0 && value <= 1)
      .map((value) => round(value, 6)),
  )).sort((a, b) => a - b).slice(0, 8);
  if (exitStressFractions.length === 0) exitStressFractions.push(...DEFAULT_POLICY.exitStressFractions);
  return {
    ...policy,
    maximumHolderAgeMs: Math.max(60_000, Math.min(7 * 24 * 60 * 60_000, Math.trunc(policy.maximumHolderAgeMs))),
    maximumTransferAgeMs: Math.max(60_000, Math.min(365 * 24 * 60 * 60_000, Math.trunc(policy.maximumTransferAgeMs))),
    maximumReceiptAgeMs: Math.max(60_000, Math.min(24 * 60 * 60_000, Math.trunc(policy.maximumReceiptAgeMs))),
    minimumProviderFamilies: Math.max(1, Math.min(8, Math.trunc(policy.minimumProviderFamilies))),
    minimumHolderCoveragePercent: Math.max(1, Math.min(100, policy.minimumHolderCoveragePercent)),
    minimumVerifiedLabelCoveragePercent: Math.max(0, Math.min(100, policy.minimumVerifiedLabelCoveragePercent)),
    minimumClusterCoveragePercent: Math.max(0, Math.min(100, policy.minimumClusterCoveragePercent)),
    minimumWalletLabelConfidencePercent: Math.max(0, Math.min(100, policy.minimumWalletLabelConfidencePercent)),
    exitStressFractions,
  };
}

function statusAllowed(status: WhaleEvidenceStatus, policy: WhaleWatchPolicy): boolean {
  if (status === "verified_live") return true;
  if (status === "verified_staging") return policy.allowStaging;
  return policy.allowFixture;
}

function statusRank(status: WhaleEvidenceStatus): number {
  if (status === "verified_live") return 3;
  if (status === "verified_staging") return 2;
  return 1;
}

function choosePreferred<T extends { status: WhaleEvidenceStatus; observedAt: string }>(left: T, right: T): T {
  const statusDelta = statusRank(right.status) - statusRank(left.status);
  if (statusDelta !== 0) return statusDelta > 0 ? right : left;
  const leftTime = Date.parse(left.observedAt);
  const rightTime = Date.parse(right.observedAt);
  if (Number.isFinite(rightTime) && (!Number.isFinite(leftTime) || rightTime > leftTime)) return right;
  return left;
}

function normalizeHolderId(value: string): string {
  return value.trim().toLowerCase().slice(0, 220);
}

function deduplicateHolders(holders: WhaleHolderSnapshot[]): WhaleHolderSnapshot[] {
  const selected = new Map<string, WhaleHolderSnapshot>();
  for (const holder of holders) {
    const holderId = normalizeHolderId(holder.holderId);
    if (!holderId) continue;
    const candidate = { ...holder, holderId };
    const existing = selected.get(holderId);
    selected.set(holderId, existing ? choosePreferred(existing, candidate) : candidate);
  }
  return Array.from(selected.values());
}

function deduplicateTransfers(events: WhaleTransferEvent[]): { transfers: WhaleTransferEvent[]; blockers: string[] } {
  const canonical = events.filter(hasCanonicalWhaleEventIdentityClaim);
  const canonicalResult = deduplicateCanonicalWhaleTransfers(canonical);
  const selected = new Map<string, WhaleTransferEvent>();
  let nonFixtureWithoutIdentity = 0;
  for (const event of events.filter((row) => !hasCanonicalWhaleEventIdentityClaim(row))) {
    if (event.status !== "verified_fixture") {
      nonFixtureWithoutIdentity += 1;
      continue;
    }
    const eventId = typeof event.eventId === "string" ? event.eventId.trim().toLowerCase().slice(0, 220) : "";
    if (!eventId) continue;
    const candidate = { ...event, eventId };
    const existing = selected.get(eventId);
    selected.set(eventId, existing ? choosePreferred(existing, candidate) : candidate);
  }
  const blockers = new Set(canonicalResult.blockers);
  if (nonFixtureWithoutIdentity > 0) blockers.add("whale_transfer_canonical_identity_required");
  return {
    transfers: [...canonicalResult.transfers, ...selected.values()],
    blockers: Array.from(blockers).sort(),
  };
}

interface WalletLabelRegistryState {
  holders: WhaleHolderSnapshot[];
  transfers: WhaleTransferEvent[];
  verifiedArtifactCount: number;
  registryDigest: string;
  claimedLabelCount: number;
  errors: string[];
}

function applyWalletLabelRegistry(args: {
  assetKey: string;
  holders: WhaleHolderSnapshot[];
  transfers: WhaleTransferEvent[];
  artifacts: NonNullable<WhaleWatchInput["walletLabelArtifacts"]>;
  secret?: string;
  now: Date;
  policy: WhaleWatchPolicy;
}): WalletLabelRegistryState {
  const errors = new Set<string>();
  const claimedLabelCount = args.holders.filter((holder) => holder.labelVerified).length;
  const verifiedArtifacts = args.artifacts.flatMap((artifact) => {
    if (!args.secret?.trim()) {
      errors.add("wallet_label_registry_secret_missing");
      return [];
    }
    const verdict = verifyWalletLabelRegistryArtifact({
      artifact,
      secret: args.secret,
      now: args.now,
      expected: { assetKey: args.assetKey },
      minimumConfidencePercent: args.policy.minimumWalletLabelConfidencePercent,
    });
    if (!verdict.ok) {
      errors.add(verdict.error);
      return [];
    }
    return [verdict.artifact];
  });

  const byHolder = new Map<string, typeof verifiedArtifacts>();
  for (const artifact of verifiedArtifacts) {
    const holderId = normalizeHolderId(artifact.payload.holderId);
    const rows = byHolder.get(holderId) ?? [];
    if (!rows.some((row) => row.payloadDigest === artifact.payloadDigest)) rows.push(artifact);
    byHolder.set(holderId, rows);
  }

  const verifiedByHolder = new Map<string, (typeof verifiedArtifacts)[number]>();
  const holders = args.holders.map((holder) => {
    const holderId = normalizeHolderId(holder.holderId);
    const candidates = byHolder.get(holderId) ?? [];
    const matching = candidates.filter((artifact) =>
      artifact.payload.category === holder.category &&
      artifact.payload.providerFamily === canonicalProviderFamily(holder.providerFamily) &&
      artifact.payload.sourceDigest === String(holder.sourceDigest ?? "").trim().toLowerCase().replace(/^sha256:/, "") &&
      artifact.payload.clusterId === (holder.clusterId?.trim().toLowerCase().slice(0, 180) || undefined),
    );
    const identities = new Set(matching.map((artifact) => canonicalJson({
      category: artifact.payload.category,
      clusterId: artifact.payload.clusterId,
      providerFamily: artifact.payload.providerFamily,
      sourceDigest: artifact.payload.sourceDigest,
    })));
    if (identities.size > 1 || candidates.length > 1 && matching.length !== candidates.length) {
      errors.add("wallet_label_registry_conflict");
    }
    const selected = matching.sort((left, right) =>
      right.payload.confidencePercent - left.payload.confidencePercent ||
      Date.parse(right.payload.issuedAt) - Date.parse(left.payload.issuedAt),
    )[0];
    if (!selected) {
      if (holder.labelVerified) errors.add("unsigned_or_invalid_wallet_label_claim");
      return { ...holder, holderId, category: "unknown" as const, labelVerified: false, clusterId: undefined };
    }
    verifiedByHolder.set(holderId, selected);
    return {
      ...holder,
      holderId,
      category: selected.payload.category,
      labelVerified: true,
      clusterId: selected.payload.clusterId,
      providerFamily: selected.payload.providerFamily,
      sourceDigest: selected.payload.sourceDigest,
    };
  });

  const transfers = args.transfers.map((event) => {
    const from = event.fromHolderId ? verifiedByHolder.get(normalizeHolderId(event.fromHolderId)) : undefined;
    const to = event.toHolderId ? verifiedByHolder.get(normalizeHolderId(event.toHolderId)) : undefined;
    return {
      ...event,
      fromCategory: from?.payload.category ?? "unknown",
      toCategory: to?.payload.category ?? "unknown",
    };
  });
  const payloadDigests = Array.from(new Set(verifiedByHolder.values()))
    .map((artifact) => artifact.payloadDigest)
    .sort();
  return {
    holders,
    transfers,
    verifiedArtifactCount: payloadDigests.length,
    registryDigest: sha256Hex(canonicalJson(payloadDigests)),
    claimedLabelCount,
    errors: Array.from(errors).sort(),
  };
}

function isFresh(timestamp: string, nowMs: number, maximumAgeMs: number): boolean {
  const parsed = Date.parse(timestamp);
  return Number.isFinite(parsed) && parsed <= nowMs + 60_000 && nowMs - parsed <= maximumAgeMs;
}

function validDigest(value: string | undefined): boolean {
  if (!value) return false;
  return /^(?:sha256:)?[a-f0-9]{64}$/i.test(value.trim());
}

function canonicalShare(holder: WhaleHolderSnapshot, totalSupply: number): number {
  return totalSupply > 0 ? Math.max(0, (holder.balance / totalSupply) * 100) : 0;
}

interface AggregatedHolder {
  internalId: string;
  balance: number;
  sharePercent: number;
  category: HolderCategory;
  labelVerified: boolean;
  clusterVerified: boolean;
  status: WhaleEvidenceStatus;
}

function aggregateVerifiedClusters(holders: WhaleHolderSnapshot[], totalSupply: number): AggregatedHolder[] {
  const grouped = new Map<string, WhaleHolderSnapshot[]>();
  for (const holder of holders) {
    const clusterId = holder.labelVerified && holder.clusterId?.trim()
      ? `cluster:${holder.clusterId.trim().toLowerCase().slice(0, 180)}`
      : `holder:${holder.holderId}`;
    const rows = grouped.get(clusterId) ?? [];
    rows.push(holder);
    grouped.set(clusterId, rows);
  }
  return Array.from(grouped.entries()).map(([internalId, rows]) => {
    const balance = rows.reduce((sum, row) => sum + row.balance, 0);
    const categories = new Set(rows.map((row) => row.category));
    const best = rows.reduce((left, right) => choosePreferred(left, right));
    return {
      internalId,
      balance,
      sharePercent: totalSupply > 0 ? (balance / totalSupply) * 100 : 0,
      category: categories.size === 1 ? rows[0].category : "unknown",
      labelVerified: rows.every((row) => row.labelVerified),
      clusterVerified: internalId.startsWith("cluster:"),
      status: best.status,
    };
  });
}

function gini(values: number[]): number {
  const positives = values.filter((value) => Number.isFinite(value) && value >= 0).sort((a, b) => a - b);
  const total = positives.reduce((sum, value) => sum + value, 0);
  if (positives.length === 0 || total <= 0) return 0;
  let weighted = 0;
  for (let index = 0; index < positives.length; index += 1) {
    weighted += (2 * (index + 1) - positives.length - 1) * positives[index];
  }
  return Math.max(0, Math.min(1, weighted / (positives.length * total)));
}

function concentrationSummary(holders: AggregatedHolder[]): WhaleConcentrationSummary {
  const shares = holders
    .map((holder) => holder.sharePercent)
    .filter((share) => Number.isFinite(share) && share > 0)
    .sort((a, b) => b - a);
  const sumTop = (count: number) => shares.slice(0, count).reduce((sum, share) => sum + share, 0);
  const hhi = shares.reduce((sum, share) => sum + (share / 100) ** 2, 0) * 10_000;
  return {
    top1Percent: round(sumTop(1), 4),
    top5Percent: round(sumTop(5), 4),
    top10Percent: round(sumTop(10), 4),
    hhi: round(hhi, 4),
    gini: round(gini(shares), 6),
  };
}

function receiptMateriallyBacked(args: {
  receipt: WhaleCapabilityReceipt;
  holders: WhaleHolderSnapshot[];
  transfers: WhaleTransferEvent[];
}): boolean {
  const family = canonicalProviderFamily(args.receipt.providerFamily);
  if (!family) return false;
  if (args.receipt.capability === "holder_distribution") {
    return args.holders.some((holder) => canonicalProviderFamily(holder.providerFamily) === family);
  }
  if (args.receipt.capability === "wallet_labels") {
    return args.holders.some((holder) => holder.labelVerified && canonicalProviderFamily(holder.providerFamily) === family);
  }
  return args.receipt.recordCount === 0 && args.receipt.coverageComplete
    ? true
    : args.transfers.some((event) => (event.providerFamilies ?? [event.providerFamily])
      .some((providerFamily) => typeof providerFamily === "string" && canonicalProviderFamily(providerFamily) === family));
}

function validCapabilityReceipts(args: {
  receipts: WhaleCapabilityReceipt[];
  holders: WhaleHolderSnapshot[];
  transfers: WhaleTransferEvent[];
  nowMs: number;
  policy: WhaleWatchPolicy;
}): WhaleCapabilityReceipt[] {
  const selected = new Map<WhaleCapability, WhaleCapabilityReceipt>();
  for (const receipt of args.receipts) {
    if (!REQUIRED_CAPABILITIES.includes(receipt.capability)) continue;
    if (!statusAllowed(receipt.status, args.policy)) continue;
    if (!isFresh(receipt.observedAt, args.nowMs, args.policy.maximumReceiptAgeMs)) continue;
    if (!Number.isInteger(receipt.recordCount) || receipt.recordCount < 0 || !validDigest(receipt.sourceDigest)) continue;
    if (!receiptMateriallyBacked({ receipt, holders: args.holders, transfers: args.transfers })) continue;
    const existing = selected.get(receipt.capability);
    selected.set(receipt.capability, existing ? choosePreferred(existing, receipt) : receipt);
  }
  return Array.from(selected.values());
}

function transferAmountUsd(event: WhaleTransferEvent, priceUsd: number): number {
  if (Number.isFinite(event.amountUsd) && Number(event.amountUsd) >= 0) return Number(event.amountUsd);
  return Math.max(0, event.amountBase * priceUsd);
}

function flowWindow(args: {
  id: WhaleFlowWindow["window"];
  durationMs: number;
  events: WhaleTransferEvent[];
  nowMs: number;
  priceUsd: number;
}): WhaleFlowWindow {
  const rows = args.events.filter((event) => args.nowMs - Date.parse(event.observedAt) <= args.durationMs);
  const result: WhaleFlowWindow = {
    window: args.id,
    eventCount: rows.length,
    exchangeInflowUsd: 0,
    exchangeOutflowUsd: 0,
    netExchangeFlowUsd: 0,
    treasuryToExchangeUsd: 0,
    treasuryDistributionUsd: 0,
    bridgeFlowUsd: 0,
    liquidityAddedUsd: 0,
    liquidityRemovedUsd: 0,
    mintedUsd: 0,
    burnedUsd: 0,
    whaleTransferUsd: 0,
  };
  for (const event of rows) {
    const amountUsd = transferAmountUsd(event, args.priceUsd);
    const fromCategory = event.fromCategory ?? "unknown";
    const toCategory = event.toCategory ?? "unknown";
    const kind = event.kind ?? "transfer";
    if (kind === "mint") result.mintedUsd += amountUsd;
    else if (kind === "burn") result.burnedUsd += amountUsd;
    else if (kind === "bridge" || fromCategory === "bridge" || toCategory === "bridge") result.bridgeFlowUsd += amountUsd;
    else if (kind === "liquidity_add") result.liquidityAddedUsd += amountUsd;
    else if (kind === "liquidity_remove") result.liquidityRemovedUsd += amountUsd;

    const intoExchange = EXCHANGE_LIKE.has(toCategory) && !EXCHANGE_LIKE.has(fromCategory);
    const outOfExchange = EXCHANGE_LIKE.has(fromCategory) && !EXCHANGE_LIKE.has(toCategory);
    if (intoExchange) result.exchangeInflowUsd += amountUsd;
    if (outOfExchange) result.exchangeOutflowUsd += amountUsd;
    if (TREASURY_LIKE.has(fromCategory) && EXCHANGE_LIKE.has(toCategory)) result.treasuryToExchangeUsd += amountUsd;
    if (TREASURY_LIKE.has(fromCategory) && !EXCHANGE_LIKE.has(toCategory)) result.treasuryDistributionUsd += amountUsd;
    if (WHALE_LIKE.has(fromCategory) || WHALE_LIKE.has(toCategory)) result.whaleTransferUsd += amountUsd;
  }
  result.netExchangeFlowUsd = result.exchangeInflowUsd - result.exchangeOutflowUsd;
  for (const key of Object.keys(result) as Array<keyof WhaleFlowWindow>) {
    if (typeof result[key] === "number" && key !== "eventCount") {
      (result[key] as number) = round(result[key] as number, 2);
    }
  }
  return result;
}

function redactedHolderRef(secret: string, assetKey: string, internalId: string): string {
  const normalized = secret.trim();
  if (normalized.length < 32 || PLACEHOLDER_SECRET.test(normalized)) {
    throw new Error("whale_watch_redaction_secret_too_weak");
  }
  return createHmac("sha256", normalized)
    .update(`velmere.whale-watch.v1:${assetKey}:${internalId}`)
    .digest("hex")
    .slice(0, 24);
}

function alertRows(args: {
  adjusted: WhaleConcentrationSummary;
  flows24h: WhaleFlowWindow;
  holderCoveragePercent: number;
  labelCoveragePercent: number;
  marketCapUsd: number;
}): WhaleWatchAlert[] {
  const alerts: WhaleWatchAlert[] = [];
  if (args.adjusted.top10Percent >= 60) {
    alerts.push({
      id: "adjusted_top10_critical",
      severity: "critical",
      confidencePercent: 92,
      title: "Adjusted top-10 concentration is extreme",
      evidence: [`adjusted_top10=${round(args.adjusted.top10Percent, 2)}%`],
    });
  } else if (args.adjusted.top10Percent >= 35) {
    alerts.push({
      id: "adjusted_top10_high",
      severity: "high",
      confidencePercent: 86,
      title: "Adjusted top-10 concentration is elevated",
      evidence: [`adjusted_top10=${round(args.adjusted.top10Percent, 2)}%`],
    });
  }
  const ratio = args.marketCapUsd > 0 ? args.flows24h.netExchangeFlowUsd / args.marketCapUsd : 0;
  if (ratio >= 0.01) {
    alerts.push({
      id: "net_exchange_inflow_high",
      severity: ratio >= 0.03 ? "critical" : "high",
      confidencePercent: 82,
      title: "Net exchange inflow is material relative to market value",
      evidence: [`net_exchange_flow_24h_usd=${round(args.flows24h.netExchangeFlowUsd, 2)}`, `market_cap_ratio=${round(ratio * 100, 3)}%`],
    });
  }
  if (args.flows24h.treasuryToExchangeUsd > args.marketCapUsd * 0.0025) {
    alerts.push({
      id: "treasury_to_exchange",
      severity: "high",
      confidencePercent: 88,
      title: "Treasury or team funds moved toward an exchange",
      evidence: [`treasury_to_exchange_24h_usd=${round(args.flows24h.treasuryToExchangeUsd, 2)}`],
    });
  }
  if (args.flows24h.liquidityRemovedUsd > args.marketCapUsd * 0.0025) {
    alerts.push({
      id: "liquidity_removed",
      severity: "high",
      confidencePercent: 88,
      title: "Material liquidity removal detected",
      evidence: [`liquidity_removed_24h_usd=${round(args.flows24h.liquidityRemovedUsd, 2)}`],
    });
  }
  if (args.holderCoveragePercent < 50 || args.labelCoveragePercent < 30) {
    alerts.push({
      id: "coverage_uncertainty",
      severity: "watch",
      confidencePercent: 95,
      title: "Holder or label coverage is insufficient for a strong whale conclusion",
      evidence: [
        `holder_coverage=${round(args.holderCoveragePercent, 2)}%`,
        `verified_label_coverage=${round(args.labelCoveragePercent, 2)}%`,
      ],
    });
  }
  if (alerts.length === 0) {
    alerts.push({
      id: "no_material_whale_alert",
      severity: "info",
      confidencePercent: 75,
      title: "No material whale alert was detected within the verified scope",
      evidence: ["This is not a guarantee of safety."],
    });
  }
  return alerts;
}

function emptyConcentration(): WhaleConcentrationSummary {
  return { top1Percent: 0, top5Percent: 0, top10Percent: 0, hhi: 0, gini: 0 };
}

function oldestObservedAt(rows: ReadonlyArray<{ observedAt: string }>): string | null {
  const timestamps = rows.map((row) => Date.parse(row.observedAt)).filter(Number.isFinite);
  return timestamps.length > 0 ? new Date(Math.min(...timestamps)).toISOString() : null;
}

export function buildWhaleWatchAnalysis(input: WhaleWatchInput): WhaleWatchResult {
  const policy = normalizedPolicy(input.policy);
  const now = input.now ?? new Date();
  const nowMs = now.getTime();
  if (!Number.isFinite(nowMs)) throw new Error("invalid_now");
  const assetKey = normalizeAssetKey(input.assetKey);
  if (!assetKey) throw new Error("missing_asset_key");
  if (!Number.isFinite(input.totalSupply) || input.totalSupply <= 0) throw new Error("invalid_total_supply");
  if (!Number.isFinite(input.priceUsd) || input.priceUsd <= 0) throw new Error("invalid_price_usd");
  const generatedAt = now.toISOString();

  const labelRegistry = applyWalletLabelRegistry({
    assetKey,
    holders: input.holders,
    transfers: input.transfers,
    artifacts: input.walletLabelArtifacts ?? [],
    secret: input.walletLabelVerificationSecret,
    now,
    policy,
  });
  const holderCandidates = deduplicateHolders(labelRegistry.holders).filter((holder) =>
    Number.isFinite(holder.balance) && holder.balance > 0 &&
    statusAllowed(holder.status, policy) &&
    isFresh(holder.observedAt, nowMs, policy.maximumHolderAgeMs),
  );
  const transferIdentity = deduplicateTransfers(labelRegistry.transfers);
  const transferCandidates = transferIdentity.transfers.filter((event) =>
    Number.isFinite(event.amountBase) && event.amountBase >= 0 &&
    statusAllowed(event.status, policy) &&
    isFresh(event.observedAt, nowMs, policy.maximumTransferAgeMs),
  );
  const receipts = validCapabilityReceipts({
    receipts: input.capabilityReceipts,
    holders: holderCandidates,
    transfers: transferCandidates,
    nowMs,
    policy,
  });
  const aggregated = aggregateVerifiedClusters(holderCandidates, input.totalSupply);
  const rawConcentration = concentrationSummary(aggregated);
  const adjustedRows = aggregated.filter((holder) => !EXCLUDED_FROM_ADJUSTED.has(holder.category));
  const adjustedConcentration = concentrationSummary(adjustedRows);
  const totalObservedBalance = aggregated.reduce((sum, holder) => sum + holder.balance, 0);
  const holderCoveragePercent = Math.min(100, (totalObservedBalance / input.totalSupply) * 100);
  const verifiedLabelBalance = aggregated.filter((holder) => holder.labelVerified).reduce((sum, holder) => sum + holder.balance, 0);
  const clusterBalance = aggregated.filter((holder) => holder.clusterVerified).reduce((sum, holder) => sum + holder.balance, 0);
  const verifiedLabelCoveragePercent = totalObservedBalance > 0 ? (verifiedLabelBalance / totalObservedBalance) * 100 : 0;
  const verifiedLabelHolderCount = aggregated.filter((holder) => holder.labelVerified && holder.category !== "unknown").length;
  const unclassifiedHolderCount = aggregated.length - verifiedLabelHolderCount;
  const clusterCoveragePercent = totalObservedBalance > 0 ? (clusterBalance / totalObservedBalance) * 100 : 0;
  const flowWindows = [
    flowWindow({ id: "24h", durationMs: 24 * 60 * 60_000, events: transferCandidates, nowMs, priceUsd: input.priceUsd }),
    flowWindow({ id: "7d", durationMs: 7 * 24 * 60 * 60_000, events: transferCandidates, nowMs, priceUsd: input.priceUsd }),
    flowWindow({ id: "30d", durationMs: 30 * 24 * 60 * 60_000, events: transferCandidates, nowMs, priceUsd: input.priceUsd }),
  ];

  const blockers: string[] = [...labelRegistry.errors, ...transferIdentity.blockers];
  const suppliedShareMismatch = holderCandidates.some((holder) =>
    Number.isFinite(holder.sharePercent) && Math.abs(Number(holder.sharePercent) - canonicalShare(holder, input.totalSupply)) > 2,
  );
  if (suppliedShareMismatch) blockers.push("holder_share_percent_mismatch");
  if (rawConcentration.top10Percent > 100.5 || holderCoveragePercent > 100.5) blockers.push("holder_concentration_exceeds_total_supply");
  for (const capability of REQUIRED_CAPABILITIES) {
    if (!receipts.some((receipt) => receipt.capability === capability)) blockers.push(`missing_capability_receipt:${capability}`);
  }
  const providerFamilies = distinctProviderFamilies(receipts.map((receipt) => receipt.providerFamily));
  if (providerFamilies.length < policy.minimumProviderFamilies) blockers.push("independent_provider_family_count_below_threshold");
  if (holderCoveragePercent < policy.minimumHolderCoveragePercent) blockers.push("holder_coverage_below_threshold");
  if (verifiedLabelCoveragePercent < policy.minimumVerifiedLabelCoveragePercent) blockers.push("verified_wallet_label_coverage_below_threshold");
  if (clusterCoveragePercent < policy.minimumClusterCoveragePercent) blockers.push("verified_cluster_coverage_below_threshold");
  if (holderCandidates.length === 0) blockers.push("holder_distribution_unavailable");
  if (labelRegistry.claimedLabelCount > labelRegistry.verifiedArtifactCount) {
    blockers.push("wallet_label_artifact_coverage_below_claimed_labels");
  }

  const exitTargets = adjustedRows
    .filter((holder) => holder.labelVerified && WHALE_LIKE.has(holder.category))
    .sort((a, b) => b.balance - a.balance)
    .slice(0, 3)
    .flatMap((holder) => policy.exitStressFractions.map((fraction) => ({
      holder,
      fraction,
      notionalUsd: holder.balance * fraction * input.priceUsd,
    })))
    .filter((row) => Number.isFinite(row.notionalUsd) && row.notionalUsd > 0);
  const impactNotionals = Array.from(new Set(exitTargets.map((row) => round(row.notionalUsd, 2)))).sort((a, b) => a - b);
  const marketImpact = input.marketImpactSnapshots && impactNotionals.length > 0
    ? buildMarketImpactAnalysis({
        assetKey,
        snapshots: input.marketImpactSnapshots,
        now,
        locale: input.locale,
        reportContextDepth: input.reportContextDepth,
        policy: {
          notionalUsdGrid: impactNotionals,
          allowFixture: policy.allowFixture,
          allowStaging: policy.allowStaging,
        },
      })
    : null;
  if (!marketImpact) blockers.push("holder_exit_market_impact_unavailable");
  else if (!marketImpact.advancedReady) blockers.push("holder_exit_market_impact_not_advanced_ready");

  const holderExitStress: WhaleExitStressResult[] = exitTargets.map((target) => {
    const requested = round(target.notionalUsd, 2);
    const execution = marketImpact?.executions.find((row) =>
      row.side === "sell" && Math.abs(row.requestedNotionalUsd - requested) < 0.011,
    ) ?? null;
    return {
      holderRef: redactedHolderRef(input.redactionSecret, assetKey, target.holder.internalId),
      category: target.holder.category,
      holderSharePercent: round(target.holder.sharePercent, 4),
      fractionOfHolderBalance: target.fraction,
      notionalUsd: requested,
      execution,
    };
  });

  const receiptStatuses = new Set(receipts.map((receipt) => receipt.status));
  if (receiptStatuses.has("verified_fixture")) blockers.push("fixture_evidence_not_eligible_for_advanced");
  const evidenceStatus: WhaleWatchResult["evidenceStatus"] = receipts.length === 0
    ? "unavailable"
    : receiptStatuses.has("verified_fixture")
      ? "fixture_only"
      : receiptStatuses.has("verified_staging")
        ? "verified_staging"
        : "verified_live";
  const marketCapUsd = input.totalSupply * input.priceUsd;
  const alerts = alertRows({
    adjusted: adjustedConcentration,
    flows24h: flowWindows[0],
    holderCoveragePercent,
    labelCoveragePercent: verifiedLabelCoveragePercent,
    marketCapUsd,
  });
  const core = {
    schemaVersion: "velmere.whale-watch.v1" as const,
    assetKey,
    generatedAt,
    sourceObservationTimes: {
      holderDistribution: oldestObservedAt(holderCandidates),
      transferHistory: oldestObservedAt(transferCandidates),
      capabilityReceipts: oldestObservedAt(receipts),
    },
    evidenceStatus,
    advancedReady: blockers.length === 0,
    providerFamilies,
    holderCount: aggregated.length,
    transferCount: transferCandidates.length,
    holderCoveragePercent: round(holderCoveragePercent, 4),
    verifiedLabelCoveragePercent: round(verifiedLabelCoveragePercent, 4),
    clusterCoveragePercent: round(clusterCoveragePercent, 4),
    verifiedWalletLabelArtifactCount: labelRegistry.verifiedArtifactCount,
    walletLabelRegistryDigest: labelRegistry.registryDigest,
    rawConcentration: rawConcentration.top10Percent > 100.5 ? emptyConcentration() : rawConcentration,
    adjustedConcentration,
    flowWindows,
    alerts,
    holderExitStress,
    missingEvidence: blockers,
    blockers,
    customerTruth: buildWhaleWatchCustomerTruth({
      locale: input.locale,
      reportContextDepth: input.reportContextDepth,
      evidenceStatus,
      providerFamilies,
      holderCount: aggregated.length,
      verifiedLabelHolderCount,
      unclassifiedHolderCount,
      verifiedLabelArtifactCount: labelRegistry.verifiedArtifactCount,
      transferCount: transferCandidates.length,
      flowWindows,
      alerts,
      blockers,
      labelErrors: labelRegistry.errors,
    }),
  };
  return { ...core, evidenceDigest: sha256Hex(canonicalJson(core)) };
}

export function verifyWhaleWatchResultIntegrity(result: WhaleWatchResult): boolean {
  const { evidenceDigest, ...core } = result;
  return /^[a-f0-9]{64}$/.test(evidenceDigest) && sha256Hex(canonicalJson(core)) === evidenceDigest;
}
