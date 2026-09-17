import { Worker } from "node:worker_threads";
import path from "node:path";
import type { AuditExecutionOptions } from "./master-audit-orchestrator";
import type { FullAuditResultV2 } from "./types";

export const AUDIT_WORKER_BUDGET_MS = 3000;
export const AUDIT_WORKER_LIMITS = Object.freeze({ maxOldGenerationSizeMb: 128, maxYoungGenerationSizeMb: 16, stackSizeMb: 4 });

/** Internal supervisor: the worker factory is server-owned, never request input.
 * V8 heap limits do not limit ArrayBuffers/native allocations or the whole host.
 * This is CPU isolation of our trusted engine, NOT an untrusted-code sandbox.
 */
export function superviseAuditWorker(
  createWorker: () => Worker,
  signal?: AbortSignal,
  budgetMs = AUDIT_WORKER_BUDGET_MS,
): Promise<FullAuditResultV2> {
  if (!Number.isSafeInteger(budgetMs) || budgetMs < 1 || budgetMs > 10_000) return Promise.reject(new Error("runtime_worker_budget_invalid"));
  if (signal?.aborted) return Promise.reject(new Error("request_aborted"));
  const started = performance.now();
  return new Promise((resolve, reject) => {
    let worker: Worker;
    try { worker = createWorker(); }
    catch { reject(new Error("runtime_worker_unavailable")); return; }
    let finishing = false;
    const finish = (error: string | null, result?: FullAuditResultV2) => {
      if (finishing) return;
      finishing = true;
      clearTimeout(timer);
      signal?.removeEventListener("abort", abort);
      // Terminate before releasing the product concurrency reservation. Do not
      // leave an abandoned CPU task running after an HTTP timeout/abort.
      void worker.terminate().then(() => {
        if (error) reject(new Error(error));
        else if (signal?.aborted) reject(new Error("request_aborted"));
        else if (performance.now() - started >= budgetMs) reject(new Error("runtime_analysis_budget_exceeded"));
        else resolve(result!);
      }, () => reject(new Error("runtime_worker_termination_failed")));
    };
    const abort = () => finish("request_aborted");
    const timer = setTimeout(() => finish("runtime_analysis_budget_exceeded"), Math.max(1, budgetMs - (performance.now() - started)));
    worker.stdout?.resume(); worker.stderr?.resume();
    worker.once("error", () => finish("runtime_worker_failed"));
    worker.once("exit", () => { if (!finishing) finish("runtime_worker_exited_without_result"); });
    worker.once("message", (message: unknown) => {
      if (signal?.aborted) { finish("request_aborted"); return; }
      if (performance.now() - started >= budgetMs) { finish("runtime_analysis_budget_exceeded"); return; }
      if (!message || typeof message !== "object" || Array.isArray(message)) { finish("runtime_worker_message_invalid"); return; }
      const value = message as { kind?: unknown; result?: unknown };
      if (value.kind !== "result" || !value.result || typeof value.result !== "object" || Array.isArray(value.result)) {
        finish("runtime_analysis_failed"); return;
      }
      finish(null, value.result as FullAuditResultV2);
    });
    signal?.addEventListener("abort", abort, { once: true });
    // Abort can race the listener registration or synchronous worker creation.
    if (signal?.aborted) abort();
  });
}

export function executeAuditInWorker(options: AuditExecutionOptions, signal?: AbortSignal): Promise<FullAuditResultV2> {
  // Applies even to internal callers: the public pipeline has an additional
  // instruction/JUMPDEST complexity bound and its separate shared quota.
  if (!/^0x(?:[a-f0-9]{2})+$/i.test(options.bytecode) || options.bytecode.length > 2 + 24 * 1024 * 2 ||
      (options.sourceCode?.length ?? 0) > 500_000) return Promise.reject(new Error("runtime_analysis_input_limit"));
  const filename = path.join(process.cwd(), ".generated", "audit-engine-worker.cjs");
  return superviseAuditWorker(() => new Worker(filename, {
    workerData: options, resourceLimits: AUDIT_WORKER_LIMITS, execArgv: [],
    // Analysis needs no server credentials. Never inherit database/provider keys.
    env: { NODE_ENV: "production" }, stdout: true, stderr: true,
  }), signal);
}
