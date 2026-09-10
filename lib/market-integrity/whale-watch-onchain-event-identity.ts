import { canonicalJson } from "../security/canonical-json";
import { sha256Hex } from "../security/cryptographic-digest";
import { canonicalProviderFamily, distinctProviderFamilies } from "./provider-family-identity";
import type {
  WhaleEvidenceStatus,
  WhaleTransferEvent,
  WhaleTransferFinality,
  WhaleTransferReorgState,
} from "./whale-watch-types";

const ADDRESS = /^0x[a-f0-9]{40}$/u;
const HASH32 = /^0x[a-f0-9]{64}$/u;
const SOURCE_DIGEST = /^(?:sha256:)?[a-f0-9]{64}$/u;
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

export interface CanonicalWhaleEventIdentity {
  chainId: string;
  contractAddress: string;
  txHash: string;
  logIndex: number;
}

export interface CanonicalWhaleTransferDeduplication {
  transfers: WhaleTransferEvent[];
  blockers: string[];
  duplicatesDropped: number;
  rejectedCount: number;
}

type InspectedTransfer = {
  identity: CanonicalWhaleEventIdentity;
  eventId: string;
  event: WhaleTransferEvent | null;
  blocker: string | null;
  explicitReorg: boolean;
};

function safeInteger(value: unknown): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : null;
}

function normalizedChainId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  const match = /^eip155:(0|[1-9][0-9]{0,31})$/u.exec(normalized);
  return match ? `eip155:${match[1]}` : null;
}

function normalizedAddress(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  return ADDRESS.test(normalized) ? normalized : null;
}

function normalizedHash(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  return HASH32.test(normalized) ? normalized : null;
}

function normalizedDigest(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  return SOURCE_DIGEST.test(normalized) ? normalized.replace(/^sha256:/u, "") : null;
}

function normalizedStatus(value: unknown): WhaleEvidenceStatus | null {
  return value === "verified_live" || value === "verified_staging" || value === "verified_fixture" ? value : null;
}

function normalizedFinality(value: unknown): WhaleTransferFinality | null {
  return value === "unconfirmed" || value === "confirmed" || value === "finalized" ? value : null;
}

function normalizedReorgState(value: unknown): WhaleTransferReorgState | null {
  return value === "canonical" || value === "reorged" || value === "unresolved" ? value : null;
}

function identityFrom(event: WhaleTransferEvent): CanonicalWhaleEventIdentity | null {
  const chainId = normalizedChainId(event.chainId);
  const contractAddress = normalizedAddress(event.contractAddress);
  const txHash = normalizedHash(event.txHash);
  const logIndex = safeInteger(event.logIndex);
  return chainId && contractAddress && txHash && logIndex !== null
    ? { chainId, contractAddress, txHash, logIndex }
    : null;
}

export function hasCanonicalWhaleEventIdentityClaim(event: WhaleTransferEvent): boolean {
  return event.chainId !== undefined || event.contractAddress !== undefined || event.txHash !== undefined || event.logIndex !== undefined ||
    event.blockNumber !== undefined || event.blockHash !== undefined || event.confirmations !== undefined || event.finality !== undefined ||
    event.reorgState !== undefined;
}

export function canonicalWhaleEventId(identity: CanonicalWhaleEventIdentity): string {
  const normalized = {
    chainId: normalizedChainId(identity.chainId),
    contractAddress: normalizedAddress(identity.contractAddress),
    txHash: normalizedHash(identity.txHash),
    logIndex: safeInteger(identity.logIndex),
  };
  if (!normalized.chainId || !normalized.contractAddress || !normalized.txHash || normalized.logIndex === null) {
    throw new Error("whale_transfer_identity_invalid");
  }
  return `evm-log:${sha256Hex(canonicalJson(normalized))}`;
}

function inspectTransfer(input: WhaleTransferEvent): InspectedTransfer | null {
  const identity = identityFrom(input);
  if (!identity) return null;
  const eventId = canonicalWhaleEventId(identity);
  const blockNumber = safeInteger(input.blockNumber);
  const blockHash = normalizedHash(input.blockHash);
  const confirmations = safeInteger(input.confirmations);
  const finality = normalizedFinality(input.finality);
  const reorgState = normalizedReorgState(input.reorgState);
  const tokenDecimals = safeInteger(input.tokenDecimals);
  const providerFamily = typeof input.providerFamily === "string" ? canonicalProviderFamily(input.providerFamily) : "";
  const status = normalizedStatus(input.status);
  const sourceDigest = normalizedDigest(input.sourceDigest);
  const fromHolderId = normalizedAddress(input.fromHolderId);
  const toHolderId = normalizedAddress(input.toHolderId);
  const observedAtMs = Date.parse(input.observedAt);
  const amountBase = input.amountBase;

  let blocker: string | null = null;
  if (blockNumber === null || !blockHash) blocker = "whale_transfer_block_identity_invalid";
  else if (confirmations === null || !finality || !reorgState) blocker = "whale_transfer_finality_identity_invalid";
  else if (tokenDecimals === null || tokenDecimals > 36) blocker = "whale_transfer_token_decimals_invalid";
  else if (!fromHolderId || !toHolderId) blocker = "whale_transfer_participant_invalid";
  else if (!Number.isFinite(amountBase) || amountBase <= 0) blocker = "whale_transfer_amount_invalid";
  else if (input.amountUsd !== undefined && (!Number.isFinite(input.amountUsd) || input.amountUsd < 0)) blocker = "whale_transfer_usd_amount_invalid";
  else if (!Number.isFinite(observedAtMs)) blocker = "whale_transfer_observed_at_invalid";
  else if (!providerFamily || !status || !sourceDigest) blocker = "whale_transfer_provenance_invalid";
  else if (reorgState === "reorged") blocker = "whale_transfer_reorged";
  else if (reorgState !== "canonical") blocker = "whale_transfer_reorg_unresolved";
  else if (confirmations === 0 || finality === "unconfirmed") blocker = "whale_transfer_not_confirmed";

  if (blocker || blockNumber === null || !blockHash || confirmations === null || !finality || !reorgState || tokenDecimals === null || !fromHolderId || !toHolderId || !providerFamily || !status || !sourceDigest) {
    return { identity, eventId, event: null, blocker: blocker ?? "whale_transfer_identity_invalid", explicitReorg: reorgState === "reorged" };
  }

  const providerFamilies = distinctProviderFamilies([
    providerFamily,
    ...(Array.isArray(input.providerFamilies) ? input.providerFamilies.filter((value): value is string => typeof value === "string") : []),
  ]);
  const sourceDigests = Array.from(new Set([
    sourceDigest,
    ...(Array.isArray(input.sourceDigests) ? input.sourceDigests.map(normalizedDigest).filter((value): value is string => Boolean(value)) : []),
  ])).sort();
  const kind = fromHolderId === ZERO_ADDRESS ? "mint" as const : toHolderId === ZERO_ADDRESS ? "burn" as const : "transfer" as const;
  return {
    identity,
    eventId,
    blocker: null,
    explicitReorg: false,
    event: {
      ...input,
      eventId,
      ...identity,
      blockNumber,
      blockHash,
      confirmations,
      finality,
      reorgState,
      tokenDecimals,
      observedAt: new Date(observedAtMs).toISOString(),
      amountBase,
      fromHolderId,
      toHolderId,
      fromCategory: input.fromCategory ?? "unknown",
      toCategory: input.toCategory ?? "unknown",
      kind,
      providerFamily,
      providerFamilies,
      status,
      sourceDigest,
      sourceDigests,
    },
  };
}

function statusRank(value: WhaleEvidenceStatus): number {
  return value === "verified_live" ? 3 : value === "verified_staging" ? 2 : 1;
}

function finalityRank(value: WhaleTransferFinality): number {
  return value === "finalized" ? 2 : value === "confirmed" ? 1 : 0;
}

function preferred(left: WhaleTransferEvent, right: WhaleTransferEvent): WhaleTransferEvent {
  const statusDelta = statusRank(right.status) - statusRank(left.status);
  if (statusDelta !== 0) return statusDelta > 0 ? right : left;
  const finalityDelta = finalityRank(right.finality ?? "unconfirmed") - finalityRank(left.finality ?? "unconfirmed");
  if (finalityDelta !== 0) return finalityDelta > 0 ? right : left;
  const confirmationDelta = (right.confirmations ?? 0) - (left.confirmations ?? 0);
  if (confirmationDelta !== 0) return confirmationDelta > 0 ? right : left;
  return Date.parse(right.observedAt) > Date.parse(left.observedAt) ? right : left;
}

function samePhysicalPayload(left: WhaleTransferEvent, right: WhaleTransferEvent): boolean {
  return left.blockNumber === right.blockNumber && left.blockHash === right.blockHash &&
    left.fromHolderId === right.fromHolderId && left.toHolderId === right.toHolderId &&
    left.amountBase === right.amountBase && left.tokenDecimals === right.tokenDecimals && left.kind === right.kind;
}

export function deduplicateCanonicalWhaleTransfers(events: readonly WhaleTransferEvent[]): CanonicalWhaleTransferDeduplication {
  const groups = new Map<string, InspectedTransfer[]>();
  const blockers = new Set<string>();
  let rejectedCount = 0;
  for (const event of events) {
    const inspected = inspectTransfer(event);
    if (!inspected) {
      blockers.add("whale_transfer_canonical_identity_required");
      rejectedCount += 1;
      continue;
    }
    const rows = groups.get(inspected.eventId) ?? [];
    rows.push(inspected);
    groups.set(inspected.eventId, rows);
    if (inspected.blocker) {
      blockers.add(inspected.blocker);
      rejectedCount += 1;
    }
  }

  const transfers: WhaleTransferEvent[] = [];
  let duplicatesDropped = 0;
  for (const rows of groups.values()) {
    if (rows.some((row) => row.explicitReorg)) {
      blockers.add("whale_transfer_reorg_conflict");
      continue;
    }
    const eligible = rows.flatMap((row) => row.event ? [row.event] : []);
    if (eligible.length === 0) continue;
    const reference = eligible[0];
    if (eligible.some((row) => !samePhysicalPayload(reference, row))) {
      blockers.add("whale_transfer_physical_log_conflict");
      rejectedCount += eligible.length;
      continue;
    }
    let selected = eligible.reduce(preferred);
    const providerFamilies = distinctProviderFamilies(eligible.flatMap((row) => row.providerFamilies ?? [row.providerFamily]));
    const sourceDigests = Array.from(new Set(eligible.flatMap((row) => row.sourceDigests ?? (row.sourceDigest ? [row.sourceDigest] : [])))).sort();
    selected = { ...selected, providerFamilies, sourceDigests };
    transfers.push(selected);
    duplicatesDropped += Math.max(0, eligible.length - 1);
  }
  transfers.sort((left, right) => right.observedAt.localeCompare(left.observedAt) || left.eventId.localeCompare(right.eventId));
  return {
    transfers,
    blockers: Array.from(blockers).sort(),
    duplicatesDropped,
    rejectedCount,
  };
}
