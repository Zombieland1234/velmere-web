import { createHash } from "node:crypto";
import { parseStrictJsonText } from "./strict-json-boundary";
import { SUPPORTED_CHAINS } from "./evm-rpc-fetcher";

/** Acquisition is a node assertion, not independent consensus, a license, or proof of safety. */
export interface AuditRuntimeSnapshot {
  address: string;
  chainId: string;
  blockNumber: string;
  blockHash: string;
  blockTimestamp: string;
  observedAt: string;
  bytecode: string;
  bytecodeSha256: string;
  providerOrigin: string;
  binding: "EIP1898_BLOCK_HASH_REQUIRE_CANONICAL";
  independentlyVerified: false;
}
export type AuditRuntimeAcquisition =
  | { ok: true; snapshot: AuditRuntimeSnapshot }
  | { ok: false; error: string };

const quantity = /^0x(?:0|[1-9a-f][0-9a-f]*)$/;
const hash = /^0x[0-9a-f]{64}$/i;
const MAX_RESPONSE = 128 * 1024;
const MAX_RUNTIME_BYTES = 24 * 1024;

export const auditRuntimeAcquisitionDependencies = {
  fetch: (...args: Parameters<typeof fetch>) => fetch(...args),
};

/** No unpinned latest-code fallback, cache reuse, mixed-node snapshot or client RPC URL. */
export async function acquireAuditRuntimeSnapshot(
  addressInput: string,
  chainId: string,
  signal?: AbortSignal,
  budgetMs = 10_000,
): Promise<AuditRuntimeAcquisition> {
  const address = addressInput.toLowerCase();
  if (!/^0x[a-f0-9]{40}$/.test(address)) return { ok: false, error: "invalid_contract_address" };
  if (!Object.prototype.hasOwnProperty.call(SUPPORTED_CHAINS, chainId)) return { ok: false, error: "unsupported_chain_id" };
  if (!Number.isSafeInteger(budgetMs) || budgetMs < 1 || budgetMs > 30_000) return { ok: false, error: "invalid_acquisition_budget" };
  if (signal?.aborted) return { ok: false, error: "request_aborted" };
  const deadline = performance.now() + budgetMs;
  let lastError = "runtime_snapshot_unavailable";
  for (const url of SUPPORTED_CHAINS[chainId as keyof typeof SUPPORTED_CHAINS].rpcUrls) {
    if (signal?.aborted) return { ok: false, error: "request_aborted" };
    const remaining = deadline - performance.now();
    if (remaining <= 0) return { ok: false, error: "runtime_snapshot_timeout" };
    const controller = new AbortController();
    const abort = () => controller.abort();
    signal?.addEventListener("abort", abort, { once: true });
    const timer = setTimeout(abort, Math.min(3500, remaining));
    let sequence = 0;
    async function rpc(method: string, params: unknown[]): Promise<unknown> {
      if (controller.signal.aborted || performance.now() >= deadline) throw new Error("runtime_snapshot_timeout");
      const id = ++sequence;
      // Race dependencies too: a misbehaving adapter must not hold the caller forever.
      let interrupt: (() => void) | undefined;
      const onAbort = () => interrupt?.();
      controller.signal.addEventListener("abort", onAbort);
      async function bounded<T>(operation: Promise<T>): Promise<T> {
        try {
          return await new Promise<T>((resolve, reject) => {
            interrupt = () => reject(new Error("runtime_snapshot_timeout"));
            operation.then(resolve, reject);
            if (controller.signal.aborted || performance.now() >= deadline) interrupt();
          });
        } finally { interrupt = undefined; }
      }
      try {
        const fetching = auditRuntimeAcquisitionDependencies.fetch(url, {
          method: "POST", headers: { "content-type": "application/json" },
          body: JSON.stringify({ jsonrpc: "2.0", id, method, params }),
          redirect: "error", cache: "no-store", signal: controller.signal,
        });
        // Clean up a late response even if a controlled adapter ignored abort.
        void fetching.then(r => { if (controller.signal.aborted) void r.body?.cancel().catch(() => undefined); }, () => undefined);
        const response = await bounded(fetching);
        const cancelBody = () => { void response.body?.cancel().catch(() => undefined); };
        if (!response.ok || !response.body) { cancelBody(); throw new Error("rpc_http_failure"); }
        const declared = response.headers.get("content-length");
        if (declared !== null && (!/^\d+$/.test(declared) || !Number.isSafeInteger(Number(declared)) || Number(declared) > MAX_RESPONSE)) { cancelBody(); throw new Error("rpc_response_too_large"); }
        const reader = response.body.getReader();
        const bytes = new Uint8Array(MAX_RESPONSE);
        let used = 0;
        let completed = false;
        try {
          while (true) {
            if (controller.signal.aborted || performance.now() >= deadline) throw new Error("runtime_snapshot_timeout");
            const { done, value } = await bounded(reader.read());
            if (done) { completed = true; break; }
            if (!(value instanceof Uint8Array) || value.length > MAX_RESPONSE - used) throw new Error("rpc_response_too_large");
            bytes.set(value, used); used += value.length;
          }
        } finally {
          if (!completed) void reader.cancel().catch(() => undefined);
          reader.releaseLock();
        }
        if (controller.signal.aborted || performance.now() >= deadline) throw new Error("runtime_snapshot_timeout");
        if (declared !== null && Number(declared) !== used) throw new Error("rpc_content_length_mismatch");
        const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes.subarray(0, used));
        const decoded: unknown = parseStrictJsonText(text, { maxBytes: MAX_RESPONSE, maxDepth: 16, maxNodes: 8192, requireObject: true });
        if (!decoded || typeof decoded !== "object" || Array.isArray(decoded)) throw new Error("rpc_envelope_invalid");
        const row = decoded as Record<string, unknown>;
        if (row.jsonrpc !== "2.0" || row.id !== id || "error" in row || !("result" in row)) throw new Error("rpc_envelope_invalid");
        return row.result;
      } finally {
        controller.signal.removeEventListener("abort", onAbort);
      }
    }
    try {
      const observedChain = await rpc("eth_chainId", []);
      if (typeof observedChain !== "string" || !quantity.test(observedChain) || BigInt(observedChain) !== BigInt(chainId)) throw new Error("rpc_chain_mismatch");
      const block = await rpc("eth_getBlockByNumber", ["latest", false]);
      if (!block || typeof block !== "object" || Array.isArray(block)) throw new Error("rpc_block_invalid");
      const b = block as Record<string, unknown>;
      if (typeof b.number !== "string" || !quantity.test(b.number) || typeof b.hash !== "string" || !hash.test(b.hash) ||
          typeof b.timestamp !== "string" || !quantity.test(b.timestamp)) throw new Error("rpc_block_invalid");
      const timestamp = Number(BigInt(b.timestamp));
      if (!Number.isSafeInteger(timestamp) || timestamp <= 0 || timestamp * 1000 > Date.now() + 300_000) throw new Error("rpc_block_time_invalid");
      if (Date.now() - timestamp * 1000 > 15 * 60_000) throw new Error("rpc_block_stale_reverification_required");
      const blockHash = b.hash.toLowerCase();
      const bytecode = await rpc("eth_getCode", [address, { blockHash, requireCanonical: true }]);
      if (typeof bytecode !== "string" || !/^0x(?:[0-9a-f]{2})*$/i.test(bytecode)) throw new Error("rpc_runtime_invalid");
      if (bytecode === "0x") return { ok: false, error: "eoa_or_empty_code" };
      if (bytecode.length > 2 + MAX_RUNTIME_BYTES * 2) return { ok: false, error: "runtime_analysis_input_limit" };
      if (signal?.aborted || controller.signal.aborted || performance.now() >= deadline) throw new Error("runtime_snapshot_timeout");
      return { ok: true, snapshot: {
        address, chainId, blockNumber: b.number, blockHash,
        blockTimestamp: new Date(timestamp * 1000).toISOString(), observedAt: new Date().toISOString(),
        bytecode: bytecode.toLowerCase(), bytecodeSha256: `sha256:${createHash("sha256").update(Buffer.from(bytecode.slice(2), "hex")).digest("hex")}`,
        providerOrigin: new URL(url).origin, binding: "EIP1898_BLOCK_HASH_REQUIRE_CANONICAL", independentlyVerified: false,
      } };
    } catch (error) {
      const code = error instanceof Error ? error.message : "runtime_snapshot_unavailable";
      lastError = /^(rpc_|runtime_)/.test(code) ? code : "runtime_snapshot_unavailable";
    } finally {
      controller.abort(); clearTimeout(timer); signal?.removeEventListener("abort", abort);
    }
  }
  return { ok: false, error: signal?.aborted ? "request_aborted" : lastError };
}
