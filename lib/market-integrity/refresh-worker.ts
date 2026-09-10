import { searchCoinGeckoMarket } from "./coingecko";
import { analyzeDexScreenerToken } from "./dexscreener";
import { resolveRealMarketVlmRiskResult } from "./real-market-vlm-adapter";
import {
  buildPass4653ContinuitySnapshot,
  persistPass4653ContinuitySnapshot,
  readPass4653ContinuitySnapshot,
} from "./continuous-evidence-availability";
import {
  buildPass4653InstrumentMetadataSnapshot,
  persistPass4653InstrumentMetadataSnapshot,
} from "./instrument-metadata-cache";
import {
  completePass4653RefreshTarget,
  type Pass4653RefreshTarget,
} from "./refresh-registry";
import { attachPass4644ProviderReceipts, isPass4644CommerciallyFreshReceipt } from "./provider-evidence-receipt";
import type { TokenRiskResult } from "./risk-types";

export type Pass4653RefreshOutcome = {
  schemaVersion: "pass4653_refresh_outcome_v1";
  targetKey: string;
  requestedIdentity: string;
  surface: Pass4653RefreshTarget["surface"];
  success: boolean;
  persistenceMode: string | null;
  readBackVerified: boolean;
  receiptCount: number;
  snapshotHash: string | null;
  errorCode: string | null;
  nextRefreshAt: string;
};

function mergeCryptoResults(primary: TokenRiskResult | null, secondary: TokenRiskResult | null) {
  if (!primary) return secondary;
  if (!secondary) return primary;
  const merged: TokenRiskResult = {
    ...primary,
    metrics: { ...secondary.metrics, ...primary.metrics },
    signals: Array.from(new Map((secondary.signals ?? []).concat(primary.signals ?? []).map((signal) => [signal.id, signal])).values()),
    dataSources: Array.from(new Set([...(primary.dataSources ?? []), ...(secondary.dataSources ?? [])])),
    limitations: Array.from(new Set([...(primary.limitations ?? []), ...(secondary.limitations ?? [])])),
  };
  attachPass4644ProviderReceipts(merged, [
    ...(primary.providerEvidenceReceipts ?? []),
    ...(secondary.providerEvidenceReceipts ?? []),
  ]);
  return merged;
}

async function fetchLiveResult(target: Pass4653RefreshTarget): Promise<TokenRiskResult | null> {
  if (target.surface === "real_markets") {
    return resolveRealMarketVlmRiskResult(target.requestedIdentity).catch(() => null);
  }
  if (target.surface === "crypto") {
    const [coinGecko, dex] = await Promise.allSettled([
      searchCoinGeckoMarket(target.requestedIdentity),
      analyzeDexScreenerToken(target.requestedIdentity),
    ]);
    const market = coinGecko.status === "fulfilled" ? coinGecko.value?.result ?? null : null;
    const dexResult = dex.status === "fulfilled" ? dex.value : null;
    return mergeCryptoResults(market, dexResult);
  }
  // Contract audits have a separate expensive execution policy and are not
  // background-refreshed through the market worker. Their receipt ledger stays
  // demand-bound and fail-closed.
  return null;
}

export async function executePass4653RefreshTarget(
  target: Pass4653RefreshTarget,
  now: Date = new Date(),
): Promise<Pass4653RefreshOutcome> {
  let success = false;
  let persistenceMode: string | null = null;
  let readBackVerified = false;
  let receiptCount = 0;
  let snapshotHash: string | null = null;
  let errorCode: string | null = null;

  try {
    if (target.surface === "contract_audit") {
      errorCode = "contract_audit_refresh_requires_demand_execution";
    } else {
      const result = await fetchLiveResult(target);
      receiptCount = result?.providerEvidenceReceipts?.filter((receipt) => isPass4644CommerciallyFreshReceipt(receipt, now)).length ?? 0;
      if (!result || receiptCount === 0) {
        errorCode = "provider_result_without_fresh_receipts";
      } else {
        const previousSnapshot = await readPass4653ContinuitySnapshot({
          requestedIdentity: target.requestedIdentity,
          surface: target.surface,
        });
        const snapshot = buildPass4653ContinuitySnapshot({
          requestedIdentity: target.requestedIdentity,
          surface: target.surface,
          result,
          previousSnapshot,
          storedAt: now,
        });
        if (!snapshot) {
          errorCode = "continuity_snapshot_not_buildable";
        } else {
          const persistence = await persistPass4653ContinuitySnapshot(snapshot);
          persistenceMode = persistence.mode;
          readBackVerified = persistence.readBackVerified;
          snapshotHash = snapshot.snapshotHash;
          success = persistence.readBackVerified;
          if (target.surface === "real_markets") {
            const metadataSnapshot = buildPass4653InstrumentMetadataSnapshot({
              requestedIdentity: target.requestedIdentity,
              surface: "real_markets",
              result,
              storedAt: now,
            });
            if (metadataSnapshot) {
              const metadataPersistence = await persistPass4653InstrumentMetadataSnapshot(metadataSnapshot);
              success = success && metadataPersistence.readBackVerified;
              if (!metadataPersistence.readBackVerified) {
                errorCode = metadataPersistence.blockers[0] ?? "instrument_metadata_readback_failed";
              }
            } else {
              success = false;
              errorCode = "instrument_metadata_snapshot_not_buildable";
            }
          }
          if (!success && !errorCode) errorCode = persistence.blockers[0] ?? "continuity_readback_failed";
        }
      }
    }
  } catch (error) {
    errorCode = `refresh_exception:${error instanceof Error ? error.name : "unknown"}`;
  }

  const updated = await completePass4653RefreshTarget({
    target,
    success,
    errorCode,
    now,
  });

  return {
    schemaVersion: "pass4653_refresh_outcome_v1",
    targetKey: target.targetKey,
    requestedIdentity: target.requestedIdentity,
    surface: target.surface,
    success,
    persistenceMode,
    readBackVerified,
    receiptCount,
    snapshotHash,
    errorCode,
    nextRefreshAt: updated.nextRefreshAt,
  };
}
