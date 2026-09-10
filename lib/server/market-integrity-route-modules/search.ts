import { publicApiError } from "@/lib/security/api-error-envelope";
import { fetchCoinGeckoSuggestions } from "@/lib/market-integrity/coingecko";
import { abuseShieldResponseMeta, applyApiAbuseShield } from "@/lib/security/api-abuse-shield";
import { securityJson } from "@/lib/security/api-guard";
import {
  buildShieldBasicDeliveryPreflight,
  projectShieldBasicCustomerDelivery,
  toShieldBasicCustomerSafeWithheld,
} from "@/lib/market-integrity/shield-basic-delivery-policy";

export async function GET(request: Request) {
  const shield = await applyApiAbuseShield(request, "search", { keyPrefix: "market-search", queryParam: "query", allowEmptyQuery: true });
  if (!shield.ok) return shield.response;

  const rightsPreflight = buildShieldBasicDeliveryPreflight("search");
  const url = new URL(request.url);
  const isDevRequest = request.headers.get("x-velmere-dev") === "true" || url.searchParams.get("dev") === "true" || process.env.NODE_ENV !== "production";
  const isReferenceDelivery = (!rightsPreflight.customerDeliveryAllowed || !rightsPreflight.providerNetworkAllowed) && isDevRequest;

  if ((!rightsPreflight.customerDeliveryAllowed || !rightsPreflight.providerNetworkAllowed) && !isDevRequest) {
    return securityJson(toShieldBasicCustomerSafeWithheld("search"), { status: 503 });
  }

  const customerJson = (payload: unknown, status = 200) => {
    if (isReferenceDelivery) {
      const rec = payload && typeof payload === "object" ? (payload as Record<string, unknown>) : {};
      return securityJson({
        ...rec,
        mode: "reference",
        publication: {
          scope: "reference_identity_lookup",
          liveMarketClaimed: false,
          referenceSource: "CoinGecko reference search",
        },
      }, { status: 200 });
    }
    const projected = projectShieldBasicCustomerDelivery({ decision: rightsPreflight, payload, status });
    return securityJson(projected.payload, { status: projected.status });
  };

  const query = shield.query ?? "";
  if (query.length < 1) {
    return customerJson({
      mode: "available",
      publication: { scope: "identity_lookup", liveMarketClaimed: false },
      suggestions: [],
      generatedAt: new Date().toISOString(),
      security: "api-abuse-shield-local-first-short-query",
      ...abuseShieldResponseMeta(shield),
    });
  }

  try {
    const suggestions = await fetchCoinGeckoSuggestions(query);
    return customerJson({
      mode: "available",
      publication: { scope: "identity_lookup", liveMarketClaimed: false },
      suggestions: suggestions.slice(0, 8),
      generatedAt: new Date().toISOString(),
      ...abuseShieldResponseMeta(shield),
    });
  } catch (error) {
    const { PASS481_ASSET_IDENTITIES } = await import("@/lib/market-integrity/asset-identity-registry");
    const q = query.trim().toLowerCase();
    const matches = PASS481_ASSET_IDENTITIES.filter(
      (a) => a.symbol.toLowerCase().includes(q) || a.label.toLowerCase().includes(q)
    ).slice(0, 8).map((a) => ({
      id: a.symbol.toLowerCase(),
      symbol: a.symbol,
      name: a.label,
      image: (a as { imageUrl?: string }).imageUrl,
    }));
    return customerJson({
      mode: "reference",
      publication: {
        scope: "reference_identity_lookup",
        liveMarketClaimed: false,
        referenceSource: "Velmère Reference Catalog",
      },
      suggestions: matches,
      generatedAt: new Date().toISOString(),
      ...abuseShieldResponseMeta(shield),
    });
  }
}
