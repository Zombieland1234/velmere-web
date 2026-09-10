import { resolveAnalysis } from "@/lib/market-integrity/vlm-route-analysis";
import { renderLensPdfWorkerPayload, validateLensPdfWorkerPayload } from "@/lib/search/lens-pdf-worker";
import {
  renderProAuditPdfWorkerPayload,
  validateProAuditPdfWorkerPayload,
  type ProAuditPdfWorkerPayload,
} from "@/lib/security/pro-audit-pdf/render-pro-audit-pdf";
import type { DurableComputationKind } from "@/lib/jobs/durable-computation-replay";

export type VlmWorkerPayload = {
  schemaVersion: "velmere.vlm-worker-payload.v1";
  query: string;
  locale: "pl" | "en" | "de";
  depth: "basic" | "pro" | "advanced";
  surface: "shield" | "shield_pro" | "real_markets" | "shield_map" | "lens" | "angel";
  prompt: string | null;
};

export type DurableWorkerExecution =
  | { encoding: "json"; value: unknown; maxResultBytes: number }
  | { encoding: "binary"; value: Uint8Array; maxResultBytes: number };

export const DURABLE_WORKER_CAPABLE_KINDS: readonly DurableComputationKind[] = [
  "vlm_analysis",
  "lens_pdf_render",
  "audit_pdf_render",
] as const;

export function validateVlmWorkerPayload(value: unknown): VlmWorkerPayload {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("durable_worker_payload_invalid");
  const payload = value as Record<string, unknown>;
  const query = typeof payload.query === "string" ? payload.query.trim() : "";
  const prompt = payload.prompt === null ? null : typeof payload.prompt === "string" ? payload.prompt.trim() : null;
  if (payload.schemaVersion !== "velmere.vlm-worker-payload.v1") throw new Error("durable_worker_payload_schema_invalid");
  if (query.length < 1 || query.length > 180) throw new Error("durable_worker_query_invalid");
  if (prompt !== null && prompt.length > 800) throw new Error("durable_worker_prompt_invalid");
  if (payload.locale !== "pl" && payload.locale !== "en" && payload.locale !== "de") throw new Error("durable_worker_locale_invalid");
  if (payload.depth !== "basic" && payload.depth !== "pro" && payload.depth !== "advanced") throw new Error("durable_worker_depth_invalid");
  if (!( ["shield", "shield_pro", "real_markets", "shield_map", "lens", "angel"] as unknown[]).includes(payload.surface)) {
    throw new Error("durable_worker_surface_invalid");
  }
  return {
    schemaVersion: "velmere.vlm-worker-payload.v1",
    query,
    prompt,
    locale: payload.locale,
    depth: payload.depth,
    surface: payload.surface as VlmWorkerPayload["surface"],
  };
}

export async function executeRegisteredDurableComputation(
  kind: DurableComputationKind,
  value: unknown,
): Promise<DurableWorkerExecution> {
  if (kind === "vlm_analysis") {
    const payload = validateVlmWorkerPayload(value);
    const result = await resolveAnalysis(payload.query, {
      locale: payload.locale,
      depth: payload.depth,
      surface: payload.surface,
      prompt: payload.prompt || undefined,
    });
    return { encoding: "json", value: result, maxResultBytes: 3 * 1024 * 1024 };
  }
  if (kind === "lens_pdf_render") {
    const payload = validateLensPdfWorkerPayload(value);
    return { encoding: "binary", value: renderLensPdfWorkerPayload(payload), maxResultBytes: 4 * 1024 * 1024 };
  }
  if (kind === "audit_pdf_render") {
    const payload: ProAuditPdfWorkerPayload = validateProAuditPdfWorkerPayload(value);
    return { encoding: "binary", value: await renderProAuditPdfWorkerPayload(payload), maxResultBytes: 4 * 1024 * 1024 };
  }
  throw new Error("durable_worker_kind_not_executable");
}
