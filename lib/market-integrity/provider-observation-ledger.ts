import { createHash } from "node:crypto";
import type { ProviderEvidenceTier } from "@/lib/market-integrity/provider-evidence-tier-policy";
import type { ProviderQuorumReconciliation } from "@/lib/market-integrity/provider-quorum-reconciliation";
import { runRegisteredServiceRoleRpc } from "@/lib/db/supabase-rpc-operation-registry";
import type { SupabaseRpcClient } from "@/lib/db/bounded-supabase-rpc";

export type ProviderObservationLedgerState = "stable" | "watch" | "anomalous" | "insufficient_history";
export type ProviderObservationDurability = "supabase" | "memory" | "unavailable";

type ObservationRow = {
  assetKeyHash: string;
  observationDigest: string;
  observedAt: number;
  state: ProviderQuorumReconciliation["state"];
  comparability: ProviderQuorumReconciliation["comparability"];
  selectedPrice: number | null;
  divergenceBps: number | null;
  confidenceCap: number;
  sourceCount: number;
};

export type ProviderObservationLedgerReceipt = {
  schemaVersion: "velmere.provider-observation-ledger.v1";
  durability: ProviderObservationDurability;
  persisted: boolean;
  deduplicated: boolean;
  sampleCount: number;
  stableSamples: number;
  anomalySamples: number;
  medianPrice: number | null;
  driftFromMedianBps: number | null;
  recentDivergenceBps: number | null;
  state: ProviderObservationLedgerState;
  maxHistoricalEvidenceTier: ProviderEvidenceTier;
  historicalEvidenceEligible: boolean;
  retentionLimit: number;
  receiptDigest: string;
  reasons: string[];
};

const RETENTION_LIMIT = 96;
const MIN_STABLE_SAMPLES = 3;
const MEMORY_KEY = Symbol.for("velmere.provider-observation-ledger.v1");

type MemoryRoot = Map<string, ObservationRow[]>;
function memoryRoot(): MemoryRoot {
  const root = globalThis as typeof globalThis & { [MEMORY_KEY]?: MemoryRoot };
  if (!root[MEMORY_KEY]) root[MEMORY_KEY] = new Map();
  return root[MEMORY_KEY]!;
}

function sha(value: string) { return createHash("sha256").update(value, "utf8").digest("hex"); }
function finitePositive(value: unknown): value is number { return typeof value === "number" && Number.isFinite(value) && value > 0; }
function median(values: number[]) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}
function bps(a: number, b: number) { return Math.abs(a - b) / Math.max(Math.abs(b), 1e-12) * 10_000; }

function summarize(rows: ObservationRow[], durability: ProviderObservationDurability, persisted: boolean, deduplicated: boolean): ProviderObservationLedgerReceipt {
  const recent = rows.slice(-12);
  const prices = recent.map((row) => row.selectedPrice).filter(finitePositive);
  const medianPrice = median(prices);
  const latest = recent.at(-1) ?? null;
  const driftFromMedianBps = latest && finitePositive(latest.selectedPrice) && medianPrice ? bps(latest.selectedPrice, medianPrice) : null;
  const recentDivergenceBps = latest?.divergenceBps ?? null;
  const stableSamples = recent.filter((row) => row.state === "aligned" && row.comparability === "exact_window" && row.confidenceCap >= 80).length;
  const anomalySamples = recent.filter((row) => row.state === "divergent" || row.comparability === "not_comparable").length;
  const reasons: string[] = [];
  let state: ProviderObservationLedgerState = "insufficient_history";
  if (recent.length < MIN_STABLE_SAMPLES) reasons.push(`At least ${MIN_STABLE_SAMPLES} observations are required for historical confirmation.`);
  else if ((driftFromMedianBps ?? 0) > 1_000 || anomalySamples >= 2 || (recentDivergenceBps ?? 0) > 500) {
    state = "anomalous";
    reasons.push("Recent provider history contains material drift, repeated divergence or a non-comparable observation.");
  } else if (stableSamples < MIN_STABLE_SAMPLES || anomalySamples > 0) {
    state = "watch";
    reasons.push("Provider history exists but does not yet contain three stable exact-window samples.");
  } else {
    state = "stable";
    reasons.push("At least three recent exact-window aligned observations support historical consistency.");
  }
  const historicalEvidenceEligible = state === "stable" && durability === "supabase" && persisted;
  const maxHistoricalEvidenceTier: ProviderEvidenceTier = historicalEvidenceEligible ? "Advanced" : state === "stable" || state === "watch" ? "Pro" : "Basic";
  if (durability !== "supabase") reasons.push("Memory history is useful for local safety but cannot authorize durable Advanced evidence.");
  const receiptDigest = sha(JSON.stringify({ durability, persisted, sampleCount: recent.length, stableSamples, anomalySamples, medianPrice, driftFromMedianBps, recentDivergenceBps, state, maxHistoricalEvidenceTier }));
  return {
    schemaVersion: "velmere.provider-observation-ledger.v1",
    durability,
    persisted,
    deduplicated,
    sampleCount: recent.length,
    stableSamples,
    anomalySamples,
    medianPrice,
    driftFromMedianBps,
    recentDivergenceBps,
    state,
    maxHistoricalEvidenceTier,
    historicalEvidenceEligible,
    retentionLimit: RETENTION_LIMIT,
    receiptDigest,
    reasons: reasons.slice(0, 6),
  };
}

export async function recordProviderObservation(input: {
  assetKey: string;
  quorum: ProviderQuorumReconciliation;
  observedAt?: number;
  rpcClientOverride?: SupabaseRpcClient | null;
  forceMemory?: boolean;
}): Promise<ProviderObservationLedgerReceipt> {
  const assetKeyHash = sha(input.assetKey.trim().toUpperCase());
  const observedAt = input.observedAt ?? Math.floor(Date.now() / 1000);
  const row: ObservationRow = {
    assetKeyHash,
    observationDigest: input.quorum.observationDigest,
    observedAt,
    state: input.quorum.state,
    comparability: input.quorum.comparability,
    selectedPrice: input.quorum.selectedPrice,
    divergenceBps: input.quorum.divergenceBps,
    confidenceCap: input.quorum.confidenceCap,
    sourceCount: input.quorum.sourceCount,
  };
  const bucket = memoryRoot().get(assetKeyHash) ?? [];
  const duplicate = bucket.some((item) => item.observationDigest === row.observationDigest);
  if (!duplicate) bucket.push(row);
  bucket.sort((a, b) => a.observedAt - b.observedAt);
  if (bucket.length > RETENTION_LIMIT) bucket.splice(0, bucket.length - RETENTION_LIMIT);
  memoryRoot().set(assetKeyHash, bucket);

  if (input.forceMemory) return summarize(bucket, "memory", true, duplicate);
  try {
    const result = await runRegisteredServiceRoleRpc({
      operation: "provider_observation_record",
      args: {
        p_asset_key_hash: assetKeyHash,
        p_observation_digest: row.observationDigest,
        p_observed_at: new Date(observedAt * 1000).toISOString(),
        p_state: row.state,
        p_comparability: row.comparability,
        p_selected_price: row.selectedPrice,
        p_divergence_bps: row.divergenceBps,
        p_confidence_cap: row.confidenceCap,
        p_source_count: row.sourceCount,
      },
      clientOverride: input.rpcClientOverride,
    });
    const data = Array.isArray(result.data) ? result.data[0] : result.data;
    const durableRows = data && typeof data === "object" && Array.isArray((data as { recent?: unknown[] }).recent)
      ? ((data as { recent: ObservationRow[] }).recent)
      : bucket;
    return summarize(durableRows, "supabase", true, Boolean((data as { deduplicated?: boolean } | null)?.deduplicated ?? duplicate));
  } catch {
    return summarize(bucket, "memory", true, duplicate);
  }
}

export function resetProviderObservationMemoryForTests() { memoryRoot().clear(); }
