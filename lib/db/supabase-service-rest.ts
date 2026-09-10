import { hasSupabaseServiceRoleConfig } from "./supabase-config";
import { brokeredConfiguredOriginFetch } from "../network/brokered-egress";

export const VELMERE_SUPABASE_SERVICE_REST_BOUNDARY =
  "velmere-supabase-service-rest-v1: narrowly scoped server-only PostgREST adapter; service-role credentials never enter client bundles or response bodies" as const;

export type SupabaseServiceRestConfig = {
  baseUrl: string;
  serviceRoleKey: string;
};

function resolveConfiguredUrl() {
  const raw = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
  if (!raw) return null;
  try {
    const parsed = new URL(raw);
    const productionLike = process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production";
    if (productionLike && parsed.protocol !== "https:") return null;
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;
    if (
      parsed.username ||
      parsed.password ||
      parsed.port ||
      (parsed.pathname !== "/" && parsed.pathname !== "") ||
      parsed.search ||
      parsed.hash
    ) return null;
    parsed.pathname = "/";
    return parsed.origin;
  } catch {
    return null;
  }
}

export function getSupabaseServiceRestConfig(): SupabaseServiceRestConfig | null {
  if (!hasSupabaseServiceRoleConfig()) return null;
  const baseUrl = resolveConfiguredUrl();
  const serviceRoleKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  if (!baseUrl || !serviceRoleKey) return null;
  return { baseUrl, serviceRoleKey };
}

function normalizeTimeoutMs(value: number | undefined) {
  if (!Number.isFinite(value)) return 2_200;
  return Math.max(50, Math.min(10_000, Math.round(value as number)));
}

export async function supabaseServiceRestRequest(
  pathAndQuery: string,
  init: RequestInit = {},
  timeoutMs?: number,
): Promise<Response | null> {
  const config = getSupabaseServiceRestConfig();
  if (!config) return null;
  const path = pathAndQuery.startsWith("/") ? pathAndQuery : `/${pathAndQuery}`;
  const headers = new Headers(init.headers);
  headers.set("apikey", config.serviceRoleKey);
  headers.set("authorization", `Bearer ${config.serviceRoleKey}`);
  if (init.body !== undefined && !headers.has("content-type")) headers.set("content-type", "application/json");
  if (!headers.has("accept")) headers.set("accept", "application/json");

  const controller = new AbortController();
  const upstreamSignal = init.signal;
  const relayAbort = () => controller.abort(upstreamSignal?.reason);
  if (upstreamSignal?.aborted) relayAbort();
  else upstreamSignal?.addEventListener("abort", relayAbort, { once: true });
  const timeout = setTimeout(
    () => controller.abort(new Error("supabase_service_rest_timeout")),
    normalizeTimeoutMs(timeoutMs),
  );

  try {
    return await brokeredConfiguredOriginFetch(`${config.baseUrl}/rest/v1${path}`, {
      ...init,
      headers,
      signal: controller.signal,
      cache: "no-store",
      redirect: "manual",
    }, {
      configuredProfile: "supabase",
      operation: "supabase_service_rest",
      timeoutMs: normalizeTimeoutMs(timeoutMs),
      maxRequestBytes: 1_048_576,
      maxResponseBytes: 8_388_608,
    });
  } finally {
    clearTimeout(timeout);
    upstreamSignal?.removeEventListener("abort", relayAbort);
  }
}
