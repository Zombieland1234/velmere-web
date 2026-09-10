import { publicApiError } from "@/lib/security/api-error-envelope";
import { searchCoinGeckoMarket } from "@/lib/market-integrity/coingecko";
import { analyzeDexScreenerToken } from "@/lib/market-integrity/dexscreener";
import { buildDefiLlamaSnapshotForResult } from "@/lib/market-integrity/defillama-adapter";
import { buildPass2454InstitutionalSourceRouter } from "@/lib/market-integrity/institutional-source-router";
import { buildSourceSynchronizationPacket } from "@/lib/market-integrity/source-synchronizer";
import { applyApiRateLimit, rejectOversizedUrl, sanitizeBoundedParam, securityJson } from "@/lib/security/api-guard";

type ErrorPayload = { mode: "error"; error: string };

export async function GET(request: Request) {
  const urlGuard = rejectOversizedUrl(request, 2_048);
  if (urlGuard) return urlGuard;
  const rateLimit = await applyApiRateLimit(request, { keyPrefix: "institutional-router", limit: 24, windowMs: 60_000 });
  if (!rateLimit.ok) return rateLimit.response;

  const { searchParams } = new URL(request.url);
  const query = sanitizeBoundedParam(searchParams.get("query"), { maxLength: 120, fallback: "" });
  const range = sanitizeBoundedParam(searchParams.get("range"), { maxLength: 12, fallback: "2y" });
  if (!query) return securityJson({ mode: "error", error: "Missing query" } satisfies ErrorPayload, { status: 400 });

  try {
    const marketRow = await searchCoinGeckoMarket(query);
    const result = marketRow?.result ?? await analyzeDexScreenerToken(query);
    const defiLlama = await buildDefiLlamaSnapshotForResult(result);
    const sourceSync = buildSourceSynchronizationPacket({ query, result, defiLlama });
    const institutionalRouter = buildPass2454InstitutionalSourceRouter({
      query,
      symbol: result?.token.symbol,
      sourceSync,
      reportEvidence: sourceSync.pass2453,
      chartRange: range,
      pointCount: result?.chart?.sevenDay?.length ?? 0,
      payloadFingerprint: sourceSync.pass2453?.canonicalEvidenceFingerprint,
    });

    return securityJson({
      mode: "institutional_router",
      query,
      symbol: result?.token.symbol,
      institutionalRouter,
      sourceSyncVersion: sourceSync.version,
      liveProviderCount: institutionalRouter.liveProviderCount,
      configuredProviderCount: institutionalRouter.configuredProviderCount,
      plannedProviderCount: institutionalRouter.plannedProviderCount,
      institutional100Locks: institutionalRouter.institutional100Locks,
      fieldRoutes: institutionalRouter.fieldRoutes,
      chartDataExpansionPlan: institutionalRouter.chartDataExpansionPlan,
      defillamaRoleUpgrade: institutionalRouter.defillamaRoleUpgrade,
      noFillerInstitutionalRule: institutionalRouter.noFillerInstitutionalRule,
      rateLimit: { remaining: rateLimit.remaining, resetAt: rateLimit.resetAt },
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    return publicApiError(error, { route: "/api/market-integrity/institutional-router", code: "institutional_router_request_failed", status: 502 });
  }
}
