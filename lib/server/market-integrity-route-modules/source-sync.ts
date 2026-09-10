import { NextResponse } from "next/server";
import { searchCoinGeckoMarket } from "@/lib/market-integrity/coingecko";
import { buildCustomerSourceSyncPayload } from "@/lib/market-integrity/customer-source-sync";
import { analyzeDexScreenerToken } from "@/lib/market-integrity/dexscreener";
import { resolveRealMarketVlmRiskResult } from "@/lib/market-integrity/real-market-vlm-adapter";
import { shouldForceNonCryptoRealMarket } from "@/lib/market-integrity/real-market-query-policy";
import { resolveCustomerSupplementarySourceEvidence } from "@/lib/market-integrity/customer-source-sync-runtime";
import type { TokenRiskResult } from "@/lib/market-integrity/risk-types";
import {
  applyApiRateLimit,
  rejectOversizedUrl,
  sanitizeBoundedParam,
  securityJson,
} from "@/lib/security/api-guard";
import { withExpensiveRouteBudget } from "@/lib/security/expensive-route-concurrency-budget";

async function resolveRiskResult(query: string): Promise<TokenRiskResult | null> {
  if (shouldForceNonCryptoRealMarket(query)) return resolveRealMarketVlmRiskResult(query);
  const market = await searchCoinGeckoMarket(query);
  if (market?.result) return market.result;
  return analyzeDexScreenerToken(query);
}

async function handleSourceSyncGet(request: Request) {
  const urlGuard = rejectOversizedUrl(request, 2_048);
  if (urlGuard) return urlGuard;
  const rateLimit = await applyApiRateLimit(request, { keyPrefix: "source-sync", limit: 24, windowMs: 60_000 });
  if (!rateLimit.ok) return rateLimit.response;

  const { searchParams } = new URL(request.url);
  const query = sanitizeBoundedParam(searchParams.get("query"), { maxLength: 120, fallback: "" });
  if (!query) return NextResponse.json({ mode: "error", error: "missing_query" }, { status: 400 });

  try {
    const result = await resolveRiskResult(query);
    const supplementary = await resolveCustomerSupplementarySourceEvidence(query, result);
    const payload = buildCustomerSourceSyncPayload({ query, result, ...supplementary });
    return securityJson(payload, {
      status: 200,
      headers: {
        "x-velmere-source-sync-mode": "customer-compact-v2",
        "x-velmere-proof-runtime": "archived-offline",
        "x-ratelimit-remaining": String(rateLimit.remaining),
        "x-ratelimit-reset": String(rateLimit.resetAt),
      },
    });
  } catch {
    return securityJson(
      { mode: "error", error: "source_sync_unavailable" },
      { status: 502, headers: { "retry-after": "15" } },
    );
  }
}

export async function GET(request: Request) {
  return withExpensiveRouteBudget(request, "source_sync_get", () => handleSourceSyncGet(request));
}
