import { createHmac } from "node:crypto";
import { canonicalJson } from "../security/canonical-json";
import { sha256Hex } from "../security/cryptographic-digest";
import { canonicalProviderFamily, distinctProviderFamilies } from "./provider-family-identity";
import type {
  LargeActorAlert,
  LargeActorAssetClass,
  LargeActorCapability,
  LargeActorCapabilityReceipt,
  LargeActorEvent,
  LargeActorEvidenceStatus,
  LargeActorFlowWindow,
  LargeActorPosition,
  LargeActorWatchInput,
  LargeActorWatchPolicy,
  LargeActorWatchResult,
} from "./large-actor-watch-types";

const REQUIRED: Record<LargeActorAssetClass, LargeActorCapability[]> = {
  stock: ["institutional_positions", "insider_transactions", "block_trades"],
  real_estate: ["institutional_positions", "insider_transactions", "block_trades"],
  etf: ["etf_flows", "constituent_concentration", "block_trades"],
  index: ["constituent_concentration", "rebalancing_events", "block_trades"],
  fx: ["cot_positioning", "open_interest", "macro_flow"],
  commodity: ["cot_positioning", "open_interest", "inventory"],
};

const CAPABILITY_MAX_AGE_MS: Record<LargeActorCapability, number> = {
  institutional_positions: 120 * 24 * 60 * 60_000,
  insider_transactions: 90 * 24 * 60 * 60_000,
  block_trades: 7 * 24 * 60 * 60_000,
  etf_flows: 35 * 24 * 60 * 60_000,
  constituent_concentration: 120 * 24 * 60 * 60_000,
  cot_positioning: 14 * 24 * 60 * 60_000,
  open_interest: 7 * 24 * 60 * 60_000,
  inventory: 14 * 24 * 60 * 60_000,
  rebalancing_events: 60 * 24 * 60 * 60_000,
  macro_flow: 14 * 24 * 60 * 60_000,
};

const DEFAULT_POLICY: LargeActorWatchPolicy = {
  maximumReceiptAgeMs: 30 * 60_000,
  minimumProviderFamilies: 2,
  allowStaging: true,
  allowFixture: false,
};

const PLACEHOLDER_SECRET = /(changeme|replace|example|placeholder|secret123|test-secret|dummy)/i;

function round(value: number, digits = 4): number {
  if (!Number.isFinite(value)) return 0;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function statusAllowed(status: LargeActorEvidenceStatus, policy: LargeActorWatchPolicy): boolean {
  if (status === "verified_live") return true;
  if (status === "verified_staging") return policy.allowStaging;
  return policy.allowFixture;
}

function statusRank(status: LargeActorEvidenceStatus): number {
  return status === "verified_live" ? 3 : status === "verified_staging" ? 2 : 1;
}

function choosePreferred<T extends { status: LargeActorEvidenceStatus; observedAt: string }>(left: T, right: T): T {
  const rank = statusRank(right.status) - statusRank(left.status);
  if (rank !== 0) return rank > 0 ? right : left;
  const leftTime = Date.parse(left.observedAt);
  const rightTime = Date.parse(right.observedAt);
  return Number.isFinite(rightTime) && (!Number.isFinite(leftTime) || rightTime > leftTime) ? right : left;
}

function validDigest(value: string | undefined): boolean {
  return Boolean(value && /^(?:sha256:)?[a-f0-9]{64}$/i.test(value.trim()));
}

function fresh(timestamp: string, nowMs: number, maxAgeMs: number): boolean {
  const parsed = Date.parse(timestamp);
  return Number.isFinite(parsed) && parsed <= nowMs + 60_000 && nowMs - parsed <= maxAgeMs;
}

function policyFrom(input?: Partial<LargeActorWatchPolicy>): LargeActorWatchPolicy {
  const value = { ...DEFAULT_POLICY, ...(input ?? {}) };
  return {
    ...value,
    maximumReceiptAgeMs: Math.max(60_000, Math.min(24 * 60 * 60_000, Math.trunc(value.maximumReceiptAgeMs))),
    minimumProviderFamilies: Math.max(1, Math.min(8, Math.trunc(value.minimumProviderFamilies))),
  };
}

function dedupePositions(rows: LargeActorPosition[]): LargeActorPosition[] {
  const map = new Map<string, LargeActorPosition>();
  for (const row of rows) {
    const actorId = row.actorId.trim().toLowerCase().slice(0, 220);
    if (!actorId) continue;
    const key = `${row.capability}:${actorId}`;
    const candidate = { ...row, actorId };
    const current = map.get(key);
    map.set(key, current ? choosePreferred(current, candidate) : candidate);
  }
  return Array.from(map.values());
}

function dedupeEvents(rows: LargeActorEvent[]): LargeActorEvent[] {
  const map = new Map<string, LargeActorEvent>();
  for (const row of rows) {
    const eventId = row.eventId.trim().toLowerCase().slice(0, 220);
    if (!eventId) continue;
    const candidate = { ...row, eventId };
    const current = map.get(eventId);
    map.set(eventId, current ? choosePreferred(current, candidate) : candidate);
  }
  return Array.from(map.values());
}

function receiptBacked(args: {
  receipt: LargeActorCapabilityReceipt;
  positions: LargeActorPosition[];
  events: LargeActorEvent[];
}): boolean {
  const family = canonicalProviderFamily(args.receipt.providerFamily);
  if (!family) return false;
  const actualCount = args.positions.filter((row) => row.capability === args.receipt.capability && canonicalProviderFamily(row.providerFamily) === family).length +
    args.events.filter((row) => row.capability === args.receipt.capability && canonicalProviderFamily(row.providerFamily) === family).length;
  if (actualCount === 0) return args.receipt.recordCount === 0 && args.receipt.coverageComplete;
  return args.receipt.recordCount >= actualCount;
}

function selectReceipts(args: {
  receipts: LargeActorCapabilityReceipt[];
  required: LargeActorCapability[];
  positions: LargeActorPosition[];
  events: LargeActorEvent[];
  nowMs: number;
  policy: LargeActorWatchPolicy;
}): LargeActorCapabilityReceipt[] {
  const map = new Map<LargeActorCapability, LargeActorCapabilityReceipt>();
  for (const receipt of args.receipts) {
    if (!args.required.includes(receipt.capability)) continue;
    if (!statusAllowed(receipt.status, args.policy)) continue;
    if (!fresh(receipt.observedAt, args.nowMs, args.policy.maximumReceiptAgeMs)) continue;
    if (!Number.isInteger(receipt.recordCount) || receipt.recordCount < 0 || !validDigest(receipt.sourceDigest)) continue;
    if (!receiptBacked({ receipt, positions: args.positions, events: args.events })) continue;
    const current = map.get(receipt.capability);
    map.set(receipt.capability, current ? choosePreferred(current, receipt) : receipt);
  }
  return Array.from(map.values());
}

function actorRef(secret: string, assetKey: string, actorId: string): string {
  const normalized = secret.trim();
  if (normalized.length < 32 || PLACEHOLDER_SECRET.test(normalized)) throw new Error("large_actor_redaction_secret_too_weak");
  return createHmac("sha256", normalized)
    .update(`velmere.large-actor-watch.v1:${assetKey}:${actorId}`)
    .digest("hex")
    .slice(0, 24);
}

function flowWindow(id: LargeActorFlowWindow["window"], durationMs: number, rows: LargeActorEvent[], nowMs: number): LargeActorFlowWindow {
  const selected = rows.filter((row) => nowMs - Date.parse(row.observedAt) <= durationMs);
  let buyOrInflowUsd = 0;
  let sellOrOutflowUsd = 0;
  let longPressureUsd = 0;
  let shortPressureUsd = 0;
  for (const row of selected) {
    const amount = Math.max(0, row.amountUsd);
    if (["buy", "inflow", "increase"].includes(row.direction)) buyOrInflowUsd += amount;
    if (["sell", "outflow", "decrease"].includes(row.direction)) sellOrOutflowUsd += amount;
    if (row.direction === "long") longPressureUsd += amount;
    if (row.direction === "short") shortPressureUsd += amount;
  }
  return {
    window: id,
    eventCount: selected.length,
    buyOrInflowUsd: round(buyOrInflowUsd, 2),
    sellOrOutflowUsd: round(sellOrOutflowUsd, 2),
    netFlowUsd: round(buyOrInflowUsd - sellOrOutflowUsd, 2),
    longPressureUsd: round(longPressureUsd, 2),
    shortPressureUsd: round(shortPressureUsd, 2),
  };
}

function alerts(args: { concentration: LargeActorWatchResult["concentration"]; flow24h: LargeActorFlowWindow; blockers: string[] }): LargeActorAlert[] {
  const result: LargeActorAlert[] = [];
  if (args.concentration.top10Percent > 60) {
    result.push({ id: "top10_concentration_critical", severity: "critical", confidencePercent: 92, title: "Reported large-actor concentration is extreme", evidence: [`top10=${args.concentration.top10Percent}%`] });
  } else if (args.concentration.top10Percent > 35) {
    result.push({ id: "top10_concentration_high", severity: "high", confidencePercent: 86, title: "Reported large-actor concentration is elevated", evidence: [`top10=${args.concentration.top10Percent}%`] });
  }
  if (args.flow24h.netFlowUsd < -10_000_000) {
    result.push({ id: "large_actor_net_outflow", severity: "high", confidencePercent: 80, title: "Large-actor net flow is materially negative", evidence: [`net_flow_24h_usd=${args.flow24h.netFlowUsd}`] });
  }
  if (args.flow24h.shortPressureUsd > args.flow24h.longPressureUsd * 1.5 && args.flow24h.shortPressureUsd > 1_000_000) {
    result.push({ id: "short_pressure", severity: "watch", confidencePercent: 76, title: "Reported short pressure exceeds long pressure", evidence: [`short=${args.flow24h.shortPressureUsd}`, `long=${args.flow24h.longPressureUsd}`] });
  }
  if (args.blockers.length > 0) {
    result.push({ id: "evidence_gap", severity: "watch", confidencePercent: 98, title: "Large Actor Watch is limited by evidence gaps", evidence: args.blockers.slice(0, 8) });
  }
  if (result.length === 0) result.push({ id: "no_material_alert", severity: "info", confidencePercent: 72, title: "No material large-actor alert detected within the verified scope", evidence: ["This is not a guarantee or investment advice."] });
  return result;
}

export function buildLargeActorWatch(input: LargeActorWatchInput): LargeActorWatchResult {
  const policy = policyFrom(input.policy);
  const now = input.now ?? new Date();
  const nowMs = now.getTime();
  if (!Number.isFinite(nowMs)) throw new Error("invalid_now");
  const assetKey = input.assetKey.trim().toUpperCase().replace(/\s+/g, "").slice(0, 120);
  if (!assetKey) throw new Error("missing_asset_key");
  const required = REQUIRED[input.assetClass];
  if (!required) throw new Error("unsupported_asset_class");

  const positions = dedupePositions(input.positions).filter((row) =>
    required.includes(row.capability) && statusAllowed(row.status, policy) && fresh(row.observedAt, nowMs, CAPABILITY_MAX_AGE_MS[row.capability]) &&
    (row.ownershipPercent === undefined || (Number.isFinite(row.ownershipPercent) && row.ownershipPercent >= 0)) &&
    (row.marketValueUsd === undefined || (Number.isFinite(row.marketValueUsd) && row.marketValueUsd >= 0)) &&
    (row.notionalUsd === undefined || (Number.isFinite(row.notionalUsd) && row.notionalUsd >= 0)),
  );
  const events = dedupeEvents(input.events).filter((row) =>
    required.includes(row.capability) && statusAllowed(row.status, policy) && fresh(row.observedAt, nowMs, CAPABILITY_MAX_AGE_MS[row.capability]) && Number.isFinite(row.amountUsd) && row.amountUsd >= 0,
  );
  const receipts = selectReceipts({ receipts: input.capabilityReceipts, required, positions, events, nowMs, policy });
  const coveredCapabilities = required.filter((capability) => receipts.some((receipt) => receipt.capability === capability));
  const providerFamilies = distinctProviderFamilies(receipts.map((receipt) => receipt.providerFamily));
  const ownership = positions.map((row) => row.ownershipPercent).filter((value): value is number => typeof value === "number" && Number.isFinite(value)).sort((a, b) => b - a);
  const sum = (count: number) => ownership.slice(0, count).reduce((total, value) => total + value, 0);
  const reportedOwnershipPercent = ownership.reduce((total, value) => total + value, 0);
  const concentration = {
    top1Percent: round(sum(1)),
    top5Percent: round(sum(5)),
    top10Percent: round(sum(10)),
    reportedOwnershipPercent: round(reportedOwnershipPercent),
  };
  const blockers: string[] = [];
  for (const capability of required) if (!coveredCapabilities.includes(capability)) blockers.push(`missing_capability:${capability}`);
  if (providerFamilies.length < policy.minimumProviderFamilies) blockers.push("independent_provider_family_count_below_threshold");
  if (reportedOwnershipPercent > 100.5) blockers.push("reported_ownership_exceeds_100_percent");
  const receiptStatuses = new Set(receipts.map((receipt) => receipt.status));
  if (receiptStatuses.has("verified_fixture")) blockers.push("fixture_evidence_not_eligible_for_advanced");

  const flowWindows = [
    flowWindow("24h", 24 * 60 * 60_000, events, nowMs),
    flowWindow("7d", 7 * 24 * 60 * 60_000, events, nowMs),
    flowWindow("30d", 30 * 24 * 60 * 60_000, events, nowMs),
  ];
  const actorRefs = positions
    .sort((a, b) => (b.ownershipPercent ?? 0) - (a.ownershipPercent ?? 0) || (b.marketValueUsd ?? 0) - (a.marketValueUsd ?? 0))
    .slice(0, 20)
    .map((row) => ({
      actorRef: actorRef(input.redactionSecret, assetKey, row.actorId),
      actorType: row.actorType,
      ownershipPercent: typeof row.ownershipPercent === "number" ? round(row.ownershipPercent) : null,
      marketValueUsd: typeof row.marketValueUsd === "number" ? round(row.marketValueUsd, 2) : null,
    }));
  const evidenceStatus: LargeActorWatchResult["evidenceStatus"] = receipts.length === 0
    ? "unavailable"
    : receiptStatuses.has("verified_fixture")
      ? "fixture_only"
      : receiptStatuses.has("verified_staging")
        ? "verified_staging"
        : "verified_live";
  const core = {
    schemaVersion: "velmere.large-actor-watch.v1" as const,
    assetKey,
    assetClass: input.assetClass,
    generatedAt: now.toISOString(),
    evidenceStatus,
    advancedReady: blockers.length === 0,
    requiredCapabilities: required,
    coveredCapabilities,
    providerFamilies,
    positionCount: positions.length,
    eventCount: events.length,
    concentration,
    flowWindows,
    actorRefs,
    alerts: alerts({ concentration, flow24h: flowWindows[0], blockers }),
    missingEvidence: blockers,
    blockers,
  };
  return { ...core, evidenceDigest: sha256Hex(canonicalJson(core)) };
}

export function verifyLargeActorWatchIntegrity(result: LargeActorWatchResult): boolean {
  const { evidenceDigest, ...core } = result;
  return /^[a-f0-9]{64}$/.test(evidenceDigest) && sha256Hex(canonicalJson(core)) === evidenceDigest;
}
