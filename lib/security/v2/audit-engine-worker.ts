/** Built into a self-contained Node worker. It analyzes trusted engine code and
 * untrusted bytecode as DATA; it never evaluates submitted JavaScript/Solidity.
 */
import { parentPort, workerData } from "node:worker_threads";
import { executeFullAuditV2, type AuditExecutionOptions } from "./master-audit-orchestrator";
if (!parentPort) throw new Error("runtime_worker_port_unavailable");
try {
  const result = executeFullAuditV2(workerData as AuditExecutionOptions);
  parentPort.postMessage({ kind: "result", result });
} catch {
  // Do not expose raw input, stack traces or any server environment material.
  parentPort.postMessage({ kind: "error", code: "runtime_analysis_failed" });
}
