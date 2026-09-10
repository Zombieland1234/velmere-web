import { buildDefiLlamaSnapshotForResult, type DefiLlamaRiskLane } from "./defillama-adapter";
import {
  fetchPass2466DerivativesSqueezeProof,
  type Pass2466DerivativesSqueezeProof,
} from "./derivatives-squeeze-proof";
import {
  fetchPass2467LiquidationLongShortProof,
  type Pass2467LiquidationLongShortProof,
} from "./liquidation-long-short-proof";
import type { TokenRiskResult } from "./risk-types";

export type CustomerSupplementarySourceEvidence = {
  defi: DefiLlamaRiskLane | null;
  squeeze: Pass2466DerivativesSqueezeProof | null;
  longShort: Pass2467LiquidationLongShortProof | null;
};

function settledValue<T>(result: PromiseSettledResult<T>): T | null {
  return result.status === "fulfilled" ? result.value : null;
}

export async function resolveCustomerSupplementarySourceEvidence(
  query: string,
  result: TokenRiskResult | null,
): Promise<CustomerSupplementarySourceEvidence> {
  const defiPromise =
    result && (result.token.assetClass === "crypto" || !result.token.assetClass)
      ? buildDefiLlamaSnapshotForResult(result)
      : Promise.resolve(null);
  const squeezePromise = fetchPass2466DerivativesSqueezeProof({
    query,
    symbol: result?.token.symbol,
    result,
  });
  const [defiSettled, squeezeSettled] = await Promise.allSettled([defiPromise, squeezePromise]);
  const squeeze = settledValue(squeezeSettled);
  if (!squeeze) {
    return { defi: settledValue(defiSettled), squeeze: null, longShort: null };
  }
  const [longShortSettled] = await Promise.allSettled([
    fetchPass2467LiquidationLongShortProof({
      query,
      symbol: result?.token.symbol,
      result,
      pass2466: squeeze,
    }),
  ]);
  return {
    defi: settledValue(defiSettled),
    squeeze,
    longShort: settledValue(longShortSettled),
  };
}
