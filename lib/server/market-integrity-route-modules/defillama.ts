import { buildDefiLlamaRiskLane } from "@/lib/market-integrity/defillama-adapter";
import { applyApiRateLimit, rejectOversizedUrl, sanitizeBoundedParam, securityJson } from "@/lib/security/api-guard";

export async function GET(request: Request) {
  const urlGuard = rejectOversizedUrl(request, 2_048);
  if (urlGuard) return urlGuard;
  const rateLimit = await applyApiRateLimit(request, { keyPrefix: "defillama-lane", limit: 30, windowMs: 60_000 });
  if (!rateLimit.ok) return rateLimit.response;

  const { searchParams } = new URL(request.url);
  const query = sanitizeBoundedParam(searchParams.get("query"), { maxLength: 96, fallback: "" });
  if (!query) return securityJson({ mode: "error", error: "Missing query" }, { status: 400 });

  const lane = await buildDefiLlamaRiskLane(query);
  return securityJson({
    mode: lane.mode,
    provider: lane.provider,
    lane,
    rateLimit: { remaining: rateLimit.remaining, resetAt: rateLimit.resetAt },
    generatedAt: new Date().toISOString(),
  }, { status: lane.mode === "degraded" ? 502 : 200 });
}
