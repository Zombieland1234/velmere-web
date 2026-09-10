import { publicApiError } from "@/lib/security/api-error-envelope";
import {
  pass461VenueHealthContract,
  resolvePass461VenueHealthWithFallback,
} from "@/lib/market-integrity/venue-health-runtime";
import {
  buildPass462CrossVenueComparison,
  pass462CrossVenueConsensusContract,
  preferredPass462SecondaryVenue,
} from "@/lib/market-integrity/cross-venue-consensus";
import {
  normalizePass463AssetSymbol,
  pass463CanonicalPairCoverageContract,
} from "@/lib/market-integrity/canonical-pair-coverage";
import { applyApiRateLimit, rejectOversizedUrl, securityJson } from "@/lib/security/api-guard";
import { withExpensiveRouteBudget } from "@/lib/security/expensive-route-concurrency-budget";

const SUPPORTED_VENUES = ["binance", "mexc", "coinbase"] as const;
const ALLOWED_QUERY_KEYS = new Set(["venue", "compare", "asset", "symbol"]);
const SAFE_ASSET = /^[A-Za-z0-9_-]{1,24}$/u;

function validateQueryShape(url: URL) {
  const keys = Array.from(url.searchParams.keys());
  const unsupported = Array.from(new Set(keys.filter((key) => !ALLOWED_QUERY_KEYS.has(key))));
  const duplicate = Array.from(ALLOWED_QUERY_KEYS).filter((key) => url.searchParams.getAll(key).length > 1);
  const aliasConflict = url.searchParams.has("asset") && url.searchParams.has("symbol");
  return unsupported.length || duplicate.length || aliasConflict
    ? { ok: false as const, unsupported, duplicate, aliasConflict }
    : { ok: true as const };
}

async function handleVenueHealth(
  requested: (typeof SUPPORTED_VENUES)[number],
  compare: string,
  assetSymbol: string,
) {
  try {
    const defaultComparison = preferredPass462SecondaryVenue(
      requested,
      assetSymbol,
    );
    const comparisonVenue = compare
      ? compare as (typeof SUPPORTED_VENUES)[number]
      : defaultComparison;
    const [snapshot, secondary] = await Promise.all([
      resolvePass461VenueHealthWithFallback(requested, assetSymbol),
      comparisonVenue
        ? resolvePass461VenueHealthWithFallback(comparisonVenue, assetSymbol)
        : Promise.resolve(null),
    ]);
    const comparison = snapshot
      ? buildPass462CrossVenueComparison(snapshot, secondary)
      : null;
    return securityJson({
      ok: Boolean(snapshot),
      generatedAt: new Date().toISOString(),
      contract: pass461VenueHealthContract,
      crossVenueContract: pass462CrossVenueConsensusContract,
      pairCoverageContract: pass463CanonicalPairCoverageContract,
      assetSymbol,
      snapshot,
      secondary,
      comparison,
      providerBudget: {
        schemaVersion: "velmere.venue-health-provider-budget.a90.v1",
        sameVenueAssetSingleFlight: true,
        providerDeadlineMs: 3_750,
        providerMaximumResponseBytes: 512 * 1024,
      },
    });
  } catch (error) {
    return publicApiError(error, {
      route: "/api/market-integrity/venue-health",
      code: "venue_health_probe_failed",
      status: 502,
    });
  }
}

export async function GET(request: Request) {
  const urlGuard = rejectOversizedUrl(request, 2_048);
  if (urlGuard) return urlGuard;
  const url = new URL(request.url);
  const queryShape = validateQueryShape(url);
  if (!queryShape.ok) {
    return securityJson({
      ok: false,
      error: "unsupported_duplicate_or_shadowed_query_parameter",
      unsupported: queryShape.unsupported,
      duplicate: queryShape.duplicate,
      aliasConflict: queryShape.aliasConflict,
    }, { status: 400 });
  }

  const requested = (url.searchParams.get("venue") || "").toLowerCase();
  if (!SUPPORTED_VENUES.includes(requested as (typeof SUPPORTED_VENUES)[number])) {
    return securityJson(
      {
        ok: false,
        error: "unsupported_venue",
        supported: SUPPORTED_VENUES,
        contract: pass461VenueHealthContract,
      },
      { status: 400 },
    );
  }

  const compare = (url.searchParams.get("compare") || "").toLowerCase();
  if (compare && (
    !SUPPORTED_VENUES.includes(compare as (typeof SUPPORTED_VENUES)[number])
    || compare === requested
  )) {
    return securityJson({
      ok: false,
      error: compare === requested ? "comparison_venue_must_differ" : "unsupported_comparison_venue",
      supported: SUPPORTED_VENUES,
    }, { status: 400 });
  }

  const rawAsset = url.searchParams.get("asset") ?? url.searchParams.get("symbol") ?? "BTC";
  if (!SAFE_ASSET.test(rawAsset)) {
    return securityJson({ ok: false, error: "invalid_asset_symbol" }, { status: 400 });
  }
  const assetSymbol = normalizePass463AssetSymbol(rawAsset);

  const rateLimit = await applyApiRateLimit(request, {
    keyPrefix: "venue-health",
    limit: 18,
    windowMs: 60_000,
  });
  if (!rateLimit.ok) return rateLimit.response;

  return withExpensiveRouteBudget(request, "venue_health_get", () => handleVenueHealth(
    requested as (typeof SUPPORTED_VENUES)[number],
    compare,
    assetSymbol,
  ));
}
