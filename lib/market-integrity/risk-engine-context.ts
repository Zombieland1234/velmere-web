import type { DataBackboneValidationResult } from "./data-backbone";
import type { TokenRiskInput } from "./risk-types";
import {
  detectAssetProfile,
  finiteNumber,
  inspectDataConsistency,
  resolveInputAssetClass,
} from "./risk-engine-profile";

export type RiskEngineContext = {
  validation: DataBackboneValidationResult<TokenRiskInput>;
  validationWarnings: string[];
  safeInput: TokenRiskInput;
  profile: ReturnType<typeof detectAssetProfile>;
  assetClass: ReturnType<typeof resolveInputAssetClass>;
  consistency: ReturnType<typeof inspectDataConsistency>;
  currentPrice?: number;
  athPrice?: number;
  marketCap?: number;
  fdv?: number;
  liquidityUsd?: number;
  volume24h?: number;
  averageVolume7d?: number;
  priceChange1h?: number;
  priceChange6h?: number;
  priceChange24h?: number;
  priceChange7d?: number;
  priceChange14d?: number;
  priceChange30d?: number;
  buys24h?: number;
  sells24h?: number;
  circulatingSupply?: number;
  totalSupply?: number;
  maxSupply?: number;
  supplyReference?: number;
};

export function buildRiskEngineContext(
  input: TokenRiskInput,
  validation: DataBackboneValidationResult<TokenRiskInput>,
): RiskEngineContext {
  if (!validation.ok) {
    throw new Error("risk_engine_input_validation_failed");
  }
  const validationWarnings = validation.warnings;
  const safeInput = validation.data;
  const profile = detectAssetProfile(safeInput);
  const assetClass = resolveInputAssetClass(safeInput);
  const currentPrice = finiteNumber(safeInput.currentPrice);
  const athPrice = finiteNumber(safeInput.athPrice);
  const marketCap = finiteNumber(safeInput.marketCap);
  const fdv = finiteNumber(safeInput.fdv);
  const liquidityUsd = finiteNumber(safeInput.liquidityUsd);
  const volume24h = finiteNumber(safeInput.volume24h);
  const averageVolume7d = finiteNumber(safeInput.averageVolume7d);
  const priceChange1h = finiteNumber(safeInput.priceChange1h);
  const priceChange6h = finiteNumber(safeInput.priceChange6h);
  const priceChange24h = finiteNumber(safeInput.priceChange24h);
  const priceChange7d = finiteNumber(safeInput.priceChange7d);
  const priceChange14d = finiteNumber(safeInput.priceChange14d);
  const priceChange30d = finiteNumber(safeInput.priceChange30d);
  const buys24h = finiteNumber(safeInput.buys24h);
  const sells24h = finiteNumber(safeInput.sells24h);
  const circulatingSupply = finiteNumber(safeInput.circulatingSupply);
  const totalSupply = finiteNumber(safeInput.totalSupply);
  const maxSupply = finiteNumber(safeInput.maxSupply);
  const consistency = inspectDataConsistency(safeInput);
  const supplyReference =
    maxSupply !== undefined && maxSupply > 0
      ? maxSupply
      : totalSupply !== undefined && totalSupply > 0
        ? totalSupply
        : undefined;

  return {
    validation,
    validationWarnings,
    safeInput,
    profile,
    assetClass,
    consistency,
    currentPrice,
    athPrice,
    marketCap,
    fdv,
    liquidityUsd,
    volume24h,
    averageVolume7d,
    priceChange1h,
    priceChange6h,
    priceChange24h,
    priceChange7d,
    priceChange14d,
    priceChange30d,
    buys24h,
    sells24h,
    circulatingSupply,
    totalSupply,
    maxSupply,
    supplyReference,
  };
}
