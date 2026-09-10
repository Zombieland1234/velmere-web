import { readJsonResponseBounded } from "@/lib/network/fetch-with-deadline";
import { brokeredEgressFetch } from "@/lib/network/brokered-egress";
import { buildUniversalAssetMarketMatrix } from "@/lib/market-integrity/universal-asset-market-matrix";
import {
  normalizeTwelveDataSearchItem,
  type RealMarketSearchResult,
  type TwelveDataSymbolSearchItem,
} from "@/lib/market-integrity/real-market-search";
import { filterPass617PublicRealMarketsRows } from "@/lib/market-integrity/real-markets-noncrypto-taxonomy";
import { buildPass621MarketSearchResolution } from "@/lib/market-integrity/market-search-exactness";
import { applyApiAbuseShield } from "@/lib/security/api-abuse-shield";
import { securityJson } from "@/lib/security/api-guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function localResults(): RealMarketSearchResult[] {
  return filterPass617PublicRealMarketsRows(buildUniversalAssetMarketMatrix().rows).map((row) => ({
    id: `velmere:${row.id}`,
    symbol: row.symbol,
    name: row.name,
    assetClass: row.assetClass,
    exchange: row.priceLane,
    country: "Velmère reference",
    currency: row.assetClass === "fx" ? row.symbol.split("/")[1] ?? "" : "USD",
    provider: "velmere_matrix",
    providerState: "curated_reference",
  }));
}

function mergeResults(
  local: RealMarketSearchResult[],
  provider: RealMarketSearchResult[],
  query: string,
) {
  const unique = new Map<string, RealMarketSearchResult>();
  for (const item of [...provider, ...local]) {
    const key = `${item.symbol}:${item.exchange}`.toLowerCase();
    if (!unique.has(key)) unique.set(key, item);
  }
  const publicRows = filterPass617PublicRealMarketsRows(Array.from(unique.values()));
  return buildPass621MarketSearchResolution(query, publicRows, 24);
}

export async function GET(request: Request) {
  const shield = await applyApiAbuseShield(request, "search", {
    keyPrefix: "real-markets-search",
    queryParam: "q",
    allowEmptyQuery: false,
  });
  if (!shield.ok) return shield.response;

  const query = (shield.query ?? "").trim();
  const local = localResults();
  const apiKey = process.env.TWELVE_DATA_API_KEY;
  let providerResults: RealMarketSearchResult[] = [];
  let providerMode: "catalog_live" | "curated_reference" = "curated_reference";

  if (apiKey && query.length >= 2) {
    const params = new URLSearchParams({
      symbol: query,
      outputsize: "32",
      apikey: apiKey,
    });
    try {
      const response = await brokeredEgressFetch(
        `https://api.twelvedata.com/symbol_search?${params.toString()}`,
        {
          headers: { accept: "application/json" },
          next: { revalidate: 60 * 60 * 6 },
        } as RequestInit & { next: { revalidate: number } },
        { profile: "twelve_data", operation: "twelve_data_symbol_search", timeoutMs: 8_000 },
      );
      if (response.ok) {
        const payload = await readJsonResponseBounded<{
          data?: TwelveDataSymbolSearchItem[];
        }>(response, 1_000_000);
        providerResults = filterPass617PublicRealMarketsRows(
          (payload.data ?? [])
            .map(normalizeTwelveDataSearchItem)
            .filter((item): item is RealMarketSearchResult => Boolean(item)),
        );
        if (providerResults.length) providerMode = "catalog_live";
      }
    } catch {
      providerResults = [];
    }
  }

  const resolution = mergeResults(local, providerResults, query);

  return securityJson({
    ok: true,
    query,
    providerMode,
    results: resolution.ranked.map((entry) => entry.item),
    resolution: {
      autoOpen: resolution.autoOpen,
      exactSymbol: resolution.exact?.symbol ?? null,
      requiresExplicitSelection: resolution.requiresExplicitSelection,
      ambiguousExactCount: resolution.ambiguousExactCount,
    },
    boundary:
      "Instrument discovery only. Price, filing and second-source lanes require separate timestamped providers.",
  });
}
