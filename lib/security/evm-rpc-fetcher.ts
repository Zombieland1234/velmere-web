/**
 * Live On-Chain EVM RPC Bytecode Fetcher
 *
 * Reliably fetches deployed runtime bytecode from public blockchain RPC nodes
 * with automatic endpoint failover, strict timeouts, and bounded memory caching.
 */

import { fetchWithDeadline, readJsonResponseBounded } from "../network/fetch-with-deadline";

export type SupportedChainId = "1" | "56" | "42161" | "137" | "8453" | "10" | "43114";

export interface ChainRpcConfig {
  chainId: SupportedChainId;
  chainName: string;
  nativeSymbol: string;
  rpcUrls: string[];
}

export const SUPPORTED_CHAINS: Record<SupportedChainId, ChainRpcConfig> = {
  "1": {
    chainId: "1",
    chainName: "Ethereum Mainnet",
    nativeSymbol: "ETH",
    rpcUrls: [
      "https://ethereum.publicnode.com",
      "https://1rpc.io/eth",
      "https://eth.drpc.org",
      "https://eth-mainnet.public.blastapi.io",
    ],
  },
  "56": {
    chainId: "56",
    chainName: "BNB Smart Chain (BSC)",
    nativeSymbol: "BNB",
    rpcUrls: [
      "https://bsc-dataseed.binance.org",
      "https://bsc-dataseed1.defibit.io",
      "https://bsc-dataseed1.ninicoin.io",
      "https://1rpc.io/bnb",
    ],
  },
  "42161": {
    chainId: "42161",
    chainName: "Arbitrum One",
    nativeSymbol: "ETH",
    rpcUrls: [
      "https://arb1.arbitrum.io/rpc",
      "https://1rpc.io/arb",
      "https://arbitrum.drpc.org",
    ],
  },
  "137": {
    chainId: "137",
    chainName: "Polygon POS",
    nativeSymbol: "POL",
    rpcUrls: [
      "https://polygon-bor-rpc.publicnode.com",
      "https://1rpc.io/matic",
      "https://polygon.drpc.org",
    ],
  },
  "8453": {
    chainId: "8453",
    chainName: "Base",
    nativeSymbol: "ETH",
    rpcUrls: [
      "https://mainnet.base.org",
      "https://1rpc.io/base",
      "https://base.drpc.org",
    ],
  },
  "10": {
    chainId: "10",
    chainName: "Optimism",
    nativeSymbol: "ETH",
    rpcUrls: [
      "https://mainnet.optimism.io",
      "https://1rpc.io/op",
      "https://optimism.drpc.org",
    ],
  },
  "43114": {
    chainId: "43114",
    chainName: "Avalanche C-Chain",
    nativeSymbol: "AVAX",
    rpcUrls: [
      "https://api.avax.network/ext/bc/C/rpc",
      "https://1rpc.io/avax/c",
      "https://avalanche.drpc.org",
    ],
  },
};

// In-memory cache for on-chain bytecode (5-minute TTL)
interface CacheEntry {
  bytecode: string;
  fetchedAt: number;
}
const BYTECODE_CACHE = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 5 * 60 * 1000;
const MAX_CACHED_BYTECODES = 256;
const MAX_BYTECODE_HEX_LENGTH = 2 + 2 * 128 * 1024;

export interface FetchBytecodeResult {
  ok: boolean;
  bytecode?: string;
  source: "cache" | "live_rpc" | "eoa_no_code" | "rpc_failed";
  chainId: string;
  chainName: string;
  latencyMs: number;
  error?: string;
}

/**
 * Fetches on-chain deployed runtime bytecode for a smart contract address.
 */
export async function fetchOnChainBytecode(
  contractAddress: string,
  chainId: string = "56",
): Promise<FetchBytecodeResult> {
  const t0 = performance.now();
  const address = contractAddress.toLowerCase().trim();

  // An unsupported identity must never silently select a different chain.
  if (!Object.prototype.hasOwnProperty.call(SUPPORTED_CHAINS, chainId)) {
    return { ok: false, source: "rpc_failed", chainId, chainName: "Unsupported chain", latencyMs: performance.now() - t0, error: "unsupported_chain_id" };
  }
  const targetChainId = chainId as SupportedChainId;
  const chainConfig = SUPPORTED_CHAINS[targetChainId];

  if (!/^0x[a-f0-9]{40}$/.test(address)) {
    return {
      ok: false,
      source: "rpc_failed",
      chainId: targetChainId,
      chainName: chainConfig.chainName,
      latencyMs: performance.now() - t0,
      error: "invalid_contract_address",
    };
  }

  // Check cache
  const cacheKey = `${targetChainId}:${address}`;
  const cached = BYTECODE_CACHE.get(cacheKey);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return {
      ok: true,
      bytecode: cached.bytecode,
      source: "cache",
      chainId: targetChainId,
      chainName: chainConfig.chainName,
      latencyMs: performance.now() - t0,
    };
  }

  // Iterate RPC endpoints with fast deadline
  for (const rpcUrl of chainConfig.rpcUrls) {
    try {
      const response = await fetchWithDeadline(
        rpcUrl,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "User-Agent": "Velmere-Audit-Engine/2.0",
          },
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: 1,
            method: "eth_getCode",
            params: [address, "latest"],
          }),
        },
        { timeoutMs: 3000, operation: `rpc_eth_getCode_${targetChainId}` },
      );

      if (!response.ok) continue;
      type RpcResponse = { jsonrpc?: string; id?: unknown; result?: unknown; error?: unknown };
      const data = await readJsonResponseBounded<RpcResponse>(response, 1024 * 1024);

      if (data && data.jsonrpc === "2.0" && data.id === 1 && data.error === undefined && typeof data.result === "string") {
        const rawCode = data.result;
        // EIP-1474 DATA is 0x-prefixed and uses exactly two digits per byte.
        // A valid-looking HTTP error or malformed RPC result cannot enter cache.
        if (rawCode.length > MAX_BYTECODE_HEX_LENGTH || !/^0x(?:[0-9a-fA-F]{2})*$/.test(rawCode)) continue;
        // "0x" or empty indicates non-contract (EOA) or selfdestructed contract
        if (rawCode === "0x") {
          return {
            ok: false,
            source: "eoa_no_code",
            chainId: targetChainId,
            chainName: chainConfig.chainName,
            latencyMs: performance.now() - t0,
            error: "eoa_or_empty_code",
          };
        }

        // Bounded cache: evict expired records, then the oldest inserted entry.
        // This is not an LRU or an assertion that chain state is current.
        for (const [key, entry] of BYTECODE_CACHE) {
          if (Date.now() - entry.fetchedAt >= CACHE_TTL_MS) BYTECODE_CACHE.delete(key);
        }
        if (!BYTECODE_CACHE.has(cacheKey) && BYTECODE_CACHE.size >= MAX_CACHED_BYTECODES) {
          const oldestKey = BYTECODE_CACHE.keys().next().value;
          if (oldestKey !== undefined) BYTECODE_CACHE.delete(oldestKey);
        }
        BYTECODE_CACHE.set(cacheKey, {
          bytecode: rawCode,
          fetchedAt: Date.now(),
        });

        return {
          ok: true,
          bytecode: rawCode,
          source: "live_rpc",
          chainId: targetChainId,
          chainName: chainConfig.chainName,
          latencyMs: performance.now() - t0,
        };
      }
    } catch {
      // Continue to next fallback RPC endpoint
    }
  }

  return {
    ok: false,
    source: "rpc_failed",
    chainId: targetChainId,
    chainName: chainConfig.chainName,
    latencyMs: performance.now() - t0,
    error: "all_rpc_endpoints_unreachable",
  };
}
