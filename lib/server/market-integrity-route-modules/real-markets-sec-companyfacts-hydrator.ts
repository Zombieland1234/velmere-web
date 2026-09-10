import { publicApiError } from "@/lib/security/api-error-envelope";
import { NextResponse } from "next/server";
import { searchCoinGeckoMarket } from "@/lib/market-integrity/coingecko";
import { analyzeDexScreenerToken } from "@/lib/market-integrity/dexscreener";
import { resolveRealMarketVlmRiskResult } from "@/lib/market-integrity/real-market-vlm-adapter";
import { shouldForceNonCryptoRealMarket } from "@/lib/market-integrity/real-market-query-policy";
import { buildDefiLlamaSnapshotForResult } from "@/lib/market-integrity/defillama-adapter";
import { fetchPass2466DerivativesSqueezeProof } from "@/lib/market-integrity/derivatives-squeeze-proof";
import { fetchPass2467LiquidationLongShortProof } from "@/lib/market-integrity/liquidation-long-short-proof";
import { hydratePass2484RuntimePremiumEvidence } from "@/lib/market-integrity/runtime-premium-evidence-hydrator";
import { buildSourceSynchronizationPacket } from "@/lib/market-integrity/source-synchronizer";
import { buildPass2503RealMarketsSecCompanyfactsHydrator } from "@/lib/market-integrity/real-markets-sec-companyfacts-hydrator";
import { applyApiRateLimit, rejectOversizedUrl, sanitizeBoundedParam, securityJson } from "@/lib/security/api-guard";

type ErrorPayload = { mode: "error"; error: string };

export async function GET(request: Request) {
  const urlGuard = rejectOversizedUrl(request, 2_048);
  if (urlGuard) return urlGuard;
  const rateLimit = await applyApiRateLimit(request, { keyPrefix: "pass2503-sec-companyfacts", limit: 18, windowMs: 60_000 });
  if (!rateLimit.ok) return rateLimit.response;

  const { searchParams } = new URL(request.url);
  const query = sanitizeBoundedParam(searchParams.get("query"), { maxLength: 120, fallback: "" });
  if (!query) return NextResponse.json<ErrorPayload>({ mode: "error", error: "Missing query" }, { status: 400 });

  try {
    const realMarketResult = shouldForceNonCryptoRealMarket(query, "core_equity") ? await resolveRealMarketVlmRiskResult(query) : null;
    const marketRow = realMarketResult ? null : await searchCoinGeckoMarket(query);
    const resolvedResult = realMarketResult ?? marketRow?.result ?? await analyzeDexScreenerToken(query);
    const { result, hydration: pass2484Hydration } = await hydratePass2484RuntimePremiumEvidence({ query, result: resolvedResult });
    const defiLlama = await buildDefiLlamaSnapshotForResult(result);
    const derivativesSqueeze = await fetchPass2466DerivativesSqueezeProof({ query, symbol: result?.token.symbol, result });
    const liquidationLongShort = await fetchPass2467LiquidationLongShortProof({ query, symbol: result?.token.symbol, result, pass2466: derivativesSqueeze });
    const sourceSync = buildSourceSynchronizationPacket({ query, result, defiLlama, derivativesSqueeze, liquidationLongShort, pass2484Hydration });
    const pass2503 = sourceSync.pass2503 ?? buildPass2503RealMarketsSecCompanyfactsHydrator({
      query,
      symbol: result?.token.symbol,
      result,
      pass2488: sourceSync.pass2488,
      pass2502: sourceSync.pass2502,
    });

    return securityJson({
      mode: pass2503.state,
      result,
      pass2503,
      realMarketsSecCompanyfactsHydrator: pass2503,
      secHydrationAllowed: pass2503.secHydrationAllowed,
      paidFilingCopyAllowed: pass2503.paidFilingCopyAllowed,
      endpoints: pass2503.endpoints,
      hardLocks: pass2503.hardLocks,
      sourceSync: { pass2488: sourceSync.pass2488, pass2502: sourceSync.pass2502, pass2503 },
      operatorRule: pass2503.operatorRule,
    });
  } catch (error) {
    return publicApiError(error, {
      route: "/api/market-integrity/real-markets-sec-companyfacts-hydrator",
      code: "sec_companyfacts_hydrator_failed",
      status: 500,
    });
  }
}
