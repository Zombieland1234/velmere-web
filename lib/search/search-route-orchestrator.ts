import {
  projectPublicSearchSourceMetrics,
  searchVelmereIntelligence,
  type VelmereSearchMode,
} from "@/lib/search/intelligence-search-contract";
import {
  assertSearchCopyIsSafe,
  sanitizeSearchInput,
  velmereSearchSafetyBoundary,
} from "@/lib/search/intelligence-search-safety";
import {
  buildExactCryptoIdentityFallback,
  matchesExactCryptoIdentity,
  resolveExactCryptoIdentity,
} from "@/lib/search/exact-asset-identity";
import { resolvePass4646UniversalAssetIdentity } from "@/lib/market-integrity/universal-asset-identity";
import { pass463CanonicalPairCoverageContract } from "@/lib/market-integrity/canonical-pair-coverage";
import { pass466RealMarketLensContract } from "@/lib/search/real-market-lens";
import {
  allowedModes,
  resolveLensLocale,
  resolvePass2482ExactRealMarketSymbol,
  resolveSearchIntent,
} from "@/lib/search/search-route-identity";
import { loadPass466MarketMatches } from "@/lib/search/search-route-market-provider";
import { loadCoinGeckoMatches, loadDefiLlamaMatches } from "@/lib/search/search-route-crypto-provider";
import { jsonResponse, localizeResult, mergeResults } from "@/lib/search/search-route-response-policy";
import { issuePass4822LensSourceToken } from "@/lib/search/lens-source-token";
import {
  buildBrowserDeliveryPreflight,
  projectBrowserCustomerDelivery,
} from "@/lib/search/browser-delivery-policy";
import {
  buildR7BrowserEcbDeliveryBinding,
  inspectR7BrowserEcbDeliveryAuthority,
  type R7BrowserEcbDeliveryBinding,
} from "@/lib/search/browser-ecb-delivery-authority";
import {
  loadR7BrowserEcbReferenceResult,
  resolveR7BrowserEcbProviderSymbol,
} from "@/lib/search/search-route-ecb-provider";

async function handleR7BrowserEcbSearch(args: {
  query: string;
  mode: VelmereSearchMode;
  locale: ReturnType<typeof resolveLensLocale>;
  nowMs: number;
}) {
  // This physical receipt check is deliberately before the provider call. The
  // broker independently requires a single-use ECB capability for every
  // request/retry; this route additionally refuses to start when customer
  // delivery authority is not current.
  const authority = inspectR7BrowserEcbDeliveryAuthority(args.nowMs);
  if (!authority.ready) {
    const denied = projectBrowserCustomerDelivery({
      decision: buildBrowserDeliveryPreflight("search", undefined, args.nowMs),
      payload: null,
      nowMs: args.nowMs,
    });
    return jsonResponse(denied.payload, denied.status);
  }

  const loaded = await loadR7BrowserEcbReferenceResult({
    query: args.query,
    locale: args.locale,
    now: new Date(args.nowMs),
  });
  if (!loaded.ok) {
    return jsonResponse({
      schemaVersion: "velmere.r7.browser-reference-unavailable.v1",
      ok: false,
      mode: "unavailable",
      availability: loaded.availability,
      error: "browser_reference_data_unavailable",
      reason: "The official dated reference is unavailable or outside its approved currentness boundary.",
      results: [],
      liveClaimed: false,
      retryAfter: null,
    }, 503);
  }

  const result = projectPublicSearchSourceMetrics(loaded.result);
  const reference = result.officialReferenceSnapshot;
  if (!reference || reference.responseSha256 !== loaded.responseSha256) {
    return jsonResponse({
      schemaVersion: "velmere.r7.browser-reference-unavailable.v1",
      ok: false,
      mode: "unavailable",
      availability: "UNAVAILABLE",
      error: "browser_reference_delivery_binding_unavailable",
      reason: "The official response could not be bound to its dated customer artifact.",
      results: [],
      liveClaimed: false,
      retryAfter: null,
    }, 503);
  }
  let deliveryBinding: R7BrowserEcbDeliveryBinding;
  try {
    deliveryBinding = buildR7BrowserEcbDeliveryBinding({
      referenceDate: reference.referenceDate,
      responseSha256: reference.responseSha256,
      nowMs: args.nowMs,
    });
  } catch {
    return jsonResponse({
      schemaVersion: "velmere.r7.browser-reference-unavailable.v1",
      ok: false,
      mode: "unavailable",
      availability: "STALE",
      error: "browser_reference_delivery_binding_unavailable",
      reason: "The official dated reference is outside its bounded customer-delivery window.",
      results: [],
      liveClaimed: false,
      retryAfter: null,
    }, 503);
  }
  const deliveryPreflight = buildBrowserDeliveryPreflight("search", deliveryBinding, args.nowMs);
  const initialDelivery = projectBrowserCustomerDelivery({
    decision: deliveryPreflight,
    payload: null,
    nowMs: args.nowMs,
  });
  if (!initialDelivery.allowed) return jsonResponse(initialDelivery.payload, initialDelivery.status);
  const response = {
    query: args.query,
    requestedMode: args.mode,
    results: [result],
    generatedAt: loaded.generatedAt,
    productionBoundary: "Official unchanged ECB EUR reference statistic. Reference-only, dated and non-executable; no intraday, market-price, risk or paid-value claim.",
  };
  const safety = assertSearchCopyIsSafe(JSON.stringify(response));
  if (!safety.ok) {
    return jsonResponse({ ok: false, mode: "blocked", reason: safety.reason, boundary: velmereSearchSafetyBoundary }, 400);
  }
  const issued = issuePass4822LensSourceToken({
    result,
    locale: args.locale,
    deliveryBinding,
    nowMs: args.nowMs,
  });
  if (!issued.ok) {
    return jsonResponse({
      schemaVersion: "velmere.r7.browser-reference-unavailable.v1",
      ok: false,
      mode: "unavailable",
      availability: "UNAVAILABLE",
      error: "browser_reference_delivery_token_unavailable",
      reason: "The result could not be bound to the protected report route.",
      results: [],
      liveClaimed: false,
      retryAfter: null,
    }, 503);
  }
  const customerPayload = {
    ok: true,
    boundary: velmereSearchSafetyBoundary,
    ...response,
    results: [{
      ...result,
      lensSourceToken: issued.token,
      lensSourceTokenExpiresAt: issued.expiresAt,
    }],
    mode: "velmere_intelligence_search_preview",
    liveClaimed: false,
    deliveryClass: "ECB_OFFICIAL_REFERENCE_BASIC",
    attribution: "Source: ECB statistics.",
    pass4822LensSourceBinding: {
      schemaVersion: "pass4822-lens-source-binding-v1",
      ready: true,
      failure: null,
      tokenizedResultCount: 1,
      rule: "The exact result and its bounded delivery authority are server-signed for the Lens preview and Basic PDF route.",
    },
  };
  const projected = projectBrowserCustomerDelivery({
    decision: deliveryPreflight,
    payload: customerPayload,
    nowMs: args.nowMs,
  });
  return jsonResponse(projected.payload, projected.status);
}

async function handleSearchGetInternal(request: Request, nowMs: number) {
  const url = new URL(request.url);
  const query = sanitizeSearchInput(url.searchParams.get("q") ?? "");
  const rawMode = url.searchParams.get("mode") ?? "all";
  const mode = allowedModes.has(rawMode as VelmereSearchMode)
    ? (rawMode as VelmereSearchMode)
    : "all";
  const locale = resolveLensLocale(url.searchParams.get("locale"));
  const intent = resolveSearchIntent(url.searchParams.get("intent"));
  const r7EcbProviderSymbol = resolveR7BrowserEcbProviderSymbol(query);
  if (r7EcbProviderSymbol && (mode === "all" || mode === "market")) {
    return handleR7BrowserEcbSearch({ query, mode, locale, nowMs });
  }
  const deliveryPreflight = buildBrowserDeliveryPreflight("search");
  const pass2482ExactRealMarketSymbol = resolvePass2482ExactRealMarketSymbol(query);
  const pass2482ExactRealMarketQuery = Boolean(pass2482ExactRealMarketSymbol) && (mode === "all" || mode === "market");
  const pass4642ExactCryptoIdentity = resolveExactCryptoIdentity(query);
  const pass4642ExactCryptoQuery = Boolean(pass4642ExactCryptoIdentity) &&
    (mode === "all" || mode === "token" || mode === "contract");
  const response = pass2482ExactRealMarketQuery || pass4642ExactCryptoQuery
    ? {
        query,
        mode,
        results: [],
        generatedAt: new Date(nowMs).toISOString(),
        productionBoundary: pass2482ExactRealMarketQuery
          ? "PASS2482 exact Real Markets alias lock: market aliases cannot be downgraded to token/OSINT suggestions."
          : "PASS4642 exact crypto identity lock: a symbol query cannot be replaced by a similarly named token, ETF or market row.",
      }
    : searchVelmereIntelligence(query, mode);
  const marketMatches =
    !pass4642ExactCryptoQuery && (mode === "all" || mode === "market")
      ? await loadPass466MarketMatches(pass2482ExactRealMarketSymbol ?? query, locale, pass2482ExactRealMarketQuery ? "detail" : intent)
      : [];
  const liveMatches =
    !pass2482ExactRealMarketQuery && (mode === "all" || mode === "token" || mode === "contract")
      ? await loadCoinGeckoMatches(query, locale)
      : [];
  const defiLlamaMatches =
    !pass2482ExactRealMarketQuery && !pass4642ExactCryptoQuery && (mode === "all" || mode === "token" || mode === "osint")
      ? await loadDefiLlamaMatches(query, locale)
      : [];
  const pass4646LiveCryptoIdentity = !pass2482ExactRealMarketQuery && liveMatches.length
    ? resolvePass4646UniversalAssetIdentity(
        { query, surface: "shield" },
        liveMatches.map((item) => ({
          provider: "coingecko",
          providerId: item.id,
          symbol: item.symbol,
          name: item.title,
          assetClass: "crypto" as const,
        })),
      )
    : null;
  if (pass4642ExactCryptoQuery && pass4642ExactCryptoIdentity) {
    const exactLiveMatch = liveMatches.find((item) =>
      matchesExactCryptoIdentity(item, pass4642ExactCryptoIdentity),
    );
    response.results = [
      exactLiveMatch ?? buildExactCryptoIdentityFallback(pass4642ExactCryptoIdentity, locale),
    ];
    response.productionBoundary =
      `PASS4642 exact crypto identity lock: ${pass4642ExactCryptoIdentity.symbol} cannot resolve to another token, ETF or market instrument.`;
  } else if (pass4646LiveCryptoIdentity?.status === "resolved" && pass4646LiveCryptoIdentity.selected?.providerId) {
    const exactProviderMatch = liveMatches.find((item) => item.id === pass4646LiveCryptoIdentity.selected?.providerId);
    response.results = exactProviderMatch ? [exactProviderMatch] : [];
    response.productionBoundary =
      "PASS4646 provider-catalog identity lock: exact live crypto symbols are resolved from provider identity, not a hardcoded ticker list.";
  } else if (pass4646LiveCryptoIdentity?.status === "ambiguous") {
    response.results = liveMatches.slice(0, 3);
    response.productionBoundary =
      "PASS4646 collision boundary: the ticker maps to multiple provider identities, so no result is auto-selected without an explicit provider id, chain or contract address.";
  } else if (pass2482ExactRealMarketQuery && marketMatches.length) {
    response.results = marketMatches.slice(0, 3);
    response.productionBoundary =
      "PASS2482 exact Real Markets alias lock: AAPL/NVDA/SPY-style queries stay in Real Markets and do not surface token/OSINT fallback rows.";
  } else if (marketMatches.length || liveMatches.length || defiLlamaMatches.length) {
    response.results = mergeResults(
      [...marketMatches, ...liveMatches, ...defiLlamaMatches],
      mode === "market" ? [] : response.results,
    );
    response.productionBoundary =
      "Lens łączy katalog Real Markets, tokeny i DeFiLlama TVL/protocol lane. Sugestie pozostają lekkie, a szczegóły mogą korzystać z dodatkowych źródeł rynkowych, sprawozdawczych i DeFi.";
  }
  response.results = response.results
    .map(projectPublicSearchSourceMetrics)
    .map((item) => localizeResult(item, locale));
  // Copy safety is evaluated on the human-readable payload before opaque signed
  // transport tokens are attached. Random Base64URL bytes are not customer copy
  // and must not create false positives or hide a real copy-policy failure.
  const safety = assertSearchCopyIsSafe(JSON.stringify(response));

  if (!safety.ok) {
    return jsonResponse(
      {
        ok: false,
        mode: "blocked",
        reason: safety.reason,
        boundary: velmereSearchSafetyBoundary,
      },
      400,
    );
  }


  let lensSourceTokenFailure: string | null = null;
  response.results = response.results.map((item) => {
    const issued = issuePass4822LensSourceToken({ result: item, locale });
    if (!issued.ok) {
      lensSourceTokenFailure = issued.error;
      return item;
    }
    return {
      ...item,
      lensSourceToken: issued.token,
      lensSourceTokenExpiresAt: issued.expiresAt,
    };
  });

  const customerPayload = {
    ok: true,
    boundary: velmereSearchSafetyBoundary,
    ...response,
    mode: "velmere_intelligence_search_preview",
    pass463PairCoverage: pass463CanonicalPairCoverageContract,
    pass466RealMarketLens: pass466RealMarketLensContract,
    pass2482ExactRealMarketAliasLock: {
      enabled: true,
      matchedSymbol: pass2482ExactRealMarketSymbol,
      exactAliasQuery: pass2482ExactRealMarketQuery,
      rule: "Exact AAPL/NVDA/SPY-style aliases cannot be displaced by token, DeFiLlama or OSINT fallback rows.",
    },
    pass4642ExactCryptoIdentityLock: {
      enabled: true,
      matchedSymbol: pass4642ExactCryptoIdentity?.symbol ?? null,
      matchedId: pass4642ExactCryptoIdentity?.id ?? null,
      exactCryptoQuery: pass4642ExactCryptoQuery,
      rule: "Exact crypto symbols such as LINK and UNI cannot be displaced by BNB, EWU or any other similarly scored result.",
    },
    pass4822LensSourceBinding: {
      schemaVersion: "pass4822-lens-source-binding-v1",
      ready: lensSourceTokenFailure === null,
      failure: lensSourceTokenFailure,
      tokenizedResultCount: response.results.filter((item) => Boolean(item.lensSourceToken)).length,
      rule: "Lens report generation accepts only a server-signed search-result token or a later server-signed render token; browser-supplied full reports are not authoritative.",
    },
  };
  if (!deliveryPreflight.customerDeliveryAllowed) {
    return jsonResponse({
      ...customerPayload,
      ok: true,
      mode: "velmere_intelligence_search_preview",
      liveClaimed: false,
      deliveryClass: "REFERENCE_METADATA",
      rightsState: "LIVE_QUOTES_WITHHELD",
      rightsReason: "Customer-display and export rights for third-party live quotes are unverified; reference identity and evidence bridge are active.",
    }, 200);
  }
  const projected = projectBrowserCustomerDelivery({
    decision: deliveryPreflight,
    payload: customerPayload,
  });
  return jsonResponse(projected.payload, projected.status);
}

export async function handleSearchGet(request: Request) {
  return handleSearchGetInternal(request, Date.now());
}

/** Test-only deterministic clock. No request header/query can select this path. */
export async function handleSearchGetWithR7TestClock(request: Request, nowMs: number) {
  if (process.env.NODE_ENV === "production") throw new Error("r7_test_clock_disabled_in_production");
  if (!Number.isFinite(nowMs)) throw new Error("r7_test_clock_invalid");
  return handleSearchGetInternal(request, nowMs);
}
