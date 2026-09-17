import { applyApiRateLimit, securityJson } from "./api-guard";

/** One bucket across JSON/PDF/SSR, and a separate per-isolate concurrency bound.
 * The existing durable adapter refuses production when trusted identity/storage
 * is unavailable. The local cap is not a distributed/global concurrency proof.
 */
export const customerRuntimeResourceDependencies = { rateLimit: applyApiRateLimit };
let active = 0;
const LOCAL_LIMIT = 2;
export async function reserveCustomerRuntimeRequest(request: Request): Promise<
  { ok: true; release: () => void } | { ok: false; response: Response }
> {
  if (request.signal.aborted) return { ok: false, response: securityJson({ ok: false, error: "request_aborted" }, { status: 400 }) };
  try {
    const rate = await customerRuntimeResourceDependencies.rateLimit(request, {
      keyPrefix: "customer-runtime-analysis-v1", limit: 6, windowMs: 60_000,
      quotaPath: "/customer-runtime-analysis",
    });
    if (!rate.ok) return { ok: false, response: rate.response };
  } catch {
    return { ok: false, response: securityJson({ ok: false, error: "runtime_rate_limit_unavailable" }, { status: 503, headers: { "retry-after": "60" } }) };
  }
  if (request.signal.aborted) return { ok: false, response: securityJson({ ok: false, error: "request_aborted" }, { status: 400 }) };
  if (active >= LOCAL_LIMIT) return { ok: false, response: securityJson({ ok: false, error: "runtime_capacity_busy" }, { status: 503, headers: { "retry-after": "10" } }) };
  active += 1;
  let released = false;
  return { ok: true, release: () => { if (!released) { released = true; active -= 1; } } };
}
