/**
 * Velmère Audit Engineering Architecture V2
 * Security Engine Registry & Resolver
 */

import { CanonicalAssetIdentity, SecurityAuditEngine } from "./types";
import { EvmContractEngine } from "./evm-contract-engine";
import { NativeChainEngine } from "./native-chain-engine";
import { MarketAssetEngine } from "./market-asset-engine";

export * from "./types";
export * from "./evm-contract-engine";
export * from "./native-chain-engine";
export * from "./market-asset-engine";

const evmEngine = new EvmContractEngine();
const nativeEngine = new NativeChainEngine();
const marketEngine = new MarketAssetEngine();

const ENGINES: SecurityAuditEngine[] = [
  marketEngine,
  nativeEngine,
  evmEngine,
];

export function resolveSecurityEngine(asset: CanonicalAssetIdentity): SecurityAuditEngine {
  for (const engine of ENGINES) {
    if (engine.matches(asset)) {
      return engine;
    }
  }
  return evmEngine;
}
