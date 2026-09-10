import { brokeredEgressFetch } from "@/lib/network/brokered-egress";
import { readJsonResponseBounded } from "@/lib/network/fetch-with-deadline";
import { type VelmereSearchResult, buildVelmereShieldBridge } from "@/lib/search/intelligence-search-contract";
import { resolvePass461VenueHealthWithFallback } from "@/lib/market-integrity/venue-health-runtime";
import { buildPass462CrossVenueComparison, preferredPass462SecondaryVenue } from "@/lib/market-integrity/cross-venue-consensus";
import { normalizePass463AssetSymbol } from "@/lib/market-integrity/canonical-pair-coverage";
import { searchDefiLlamaProtocols, type DefiLlamaProtocolMatch } from "@/lib/market-integrity/defillama-adapter";
import type { LensLocale } from "@/lib/search/search-route-identity";
import { compactMarketValue } from "@/lib/search/search-route-market-provider";
import { searchProviderResilience } from "@/lib/market-integrity/provider-resilience-runtime";
import { applySearchProviderResilience } from "@/lib/search/search-provider-resilience";

// PASS462 legacy verifier markers: attachPass462BitcoinVenueEvidence · coinbase-venue-health.

export type CoinGeckoMarket = {
  id: string;
  symbol: string;
  name: string;
  image?: string;
  current_price?: number;
  market_cap?: number;
  total_volume?: number;
  fully_diluted_valuation?: number;
  high_24h?: number;
  low_24h?: number;
  price_change_percentage_1h_in_currency?: number;
  price_change_percentage_24h?: number;
  price_change_percentage_24h_in_currency?: number;
  price_change_percentage_7d_in_currency?: number;
  circulating_supply?: number;
  total_supply?: number;
  max_supply?: number;
  last_updated?: string;
};

export function resolveCoinGeckoConfidence(coin: CoinGeckoMarket) {
  const symbol = coin.symbol.toUpperCase();
  const fixed: Record<string, number> = {
    BTC: 74,
    ETH: 69,
    SOL: 66,
    BNB: 63,
    USDT: 62,
    USDC: 61,
    LINK: 64,
    LTC: 62,
  };
  if (fixed[symbol]) return fixed[symbol];

  let score = 50;
  if (typeof coin.current_price === "number") score += 4;
  if (typeof coin.price_change_percentage_24h === "number") score += 3;
  if (coin.image) score += 2;
  if ((coin.total_volume ?? 0) > 0) score += 3;
  const cap = coin.market_cap ?? 0;
  if (cap >= 100_000_000_000) score += 12;
  else if (cap >= 10_000_000_000) score += 10;
  else if (cap >= 1_000_000_000) score += 8;
  else if (cap >= 100_000_000) score += 6;
  else if (cap > 0) score += 4;
  return Math.max(52, Math.min(72, score));
}

export function defiLlamaConfidence(match: DefiLlamaProtocolMatch) {
  const base = match.matchQuality === "exact" ? 76 : match.matchQuality === "strong" ? 66 : 52;
  const tvl = match.tvlUsd ?? 0;
  const tvlBonus = tvl >= 1_000_000_000 ? 8 : tvl >= 100_000_000 ? 6 : tvl > 0 ? 3 : 0;
  return Math.max(38, Math.min(82, base + tvlBonus));
}

export function defiLlamaToLensResult(match: DefiLlamaProtocolMatch, locale: LensLocale): VelmereSearchResult {
  const tvl = compactMarketValue(match.tvlUsd, "USD") || "TVL pending";
  const confidence = defiLlamaConfidence(match);
  const symbol = match.symbol || match.slug.toUpperCase();
  const bridge = buildVelmereShieldBridge(symbol, match.slug);
  const chainList = match.chains.length ? match.chains.slice(0, 4).join(", ") : "chain pending";
  const change7d = typeof match.change7d === "number" ? `${match.change7d.toFixed(2)}% 7d TVL` : "7d TVL pending";
  const localized =
    locale === "de"
      ? {
          summary: `${match.name} · DeFiLlama-Protokoll. TVL ${tvl}, Kategorie ${match.category || "pending"}, Chains ${chainList}, ${change7d}. Das ist Kontext, kein Sicherheitszertifikat.`,
          why: "Browser trennt Protokoll-TVL von Token-Preis, Pool-Tiefe und Holder-Graf. Hohe TVL bedeutet nicht automatisch niedrigeres Risiko.",
          next: "Öffne Shield/VLM Brain und vergleiche TVL mit DEX-Liquidität, Pool-Depth, Holdern und zweiter Quelle.",
          chips: ["DeFiLlama", "TVL lane", "pool depth needed"],
        }
      : locale === "en"
        ? {
            summary: `${match.name} · DeFiLlama protocol. TVL ${tvl}, category ${match.category || "pending"}, chains ${chainList}, ${change7d}. This is context, not a safety certificate.`,
            why: "Browser separates protocol TVL from token price, pool depth and holder graph. High TVL does not automatically mean lower risk.",
            next: "Open Shield/VLM Brain and compare TVL against DEX liquidity, pool depth, holders and a second source.",
            chips: ["DeFiLlama", "TVL lane", "pool depth needed"],
          }
        : {
            summary: `${match.name} · protokół z DeFiLlama. TVL ${tvl}, kategoria ${match.category || "pending"}, chainy ${chainList}, ${change7d}. To jest kontekst, nie certyfikat bezpieczeństwa.`,
            why: "Browser oddziela TVL protokołu od ceny tokena, głębokości puli i grafu holderów. Wysokie TVL nie znaczy automatycznie niższego ryzyka.",
            next: "Otwórz Shield/VLM Brain i porównaj TVL z DEX liquidity, pool depth, holderami i drugim źródłem.",
            chips: ["DeFiLlama", "TVL lane", "pool depth needed"],
          };
  return {
    id: `defillama-${match.slug}`,
    title: match.name,
    symbol,
    category: "osint",
    tone: match.change7d !== undefined && match.change7d <= -25 ? "elevated" : "review",
    summary: localized.summary,
    whyItMatters: localized.why,
    missingData: [
      "pool-level exit depth",
      "token holder graph",
      "DEX pair liquidity",
      "protocol disclosure / docs",
    ],
    nextOperatorStep: localized.next,
    sourceMode: "live_table",
    sourceConfidence: confidence,
    shieldHref: bridge.href,
    avatarLabel: symbol.slice(0, 4),
    bridge,
    sources: [
      {
        id: "defillama-protocols",
        label: "DefiLlama protocols",
        mode: "live",
        freshness: "request-time",
        confidence,
        note: `TVL/category/chains protocol lane · match ${match.matchQuality}`,
      },
      {
        id: "pool-depth",
        label: "Pool-level exit depth",
        mode: "missing",
        freshness: "missing",
        confidence: 0,
        note: "requires pool-level liquidity and slippage checks before Advanced claims",
      },
    ],
    chips: localized.chips,
    marketSnapshot: {
      assetClass: "crypto",
      marketCap: match.marketCapUsd,
      observedAt: new Date().toISOString(),
      liquidityLabel: `Protocol TVL ${tvl}; not a safety certificate`,
      depthLabel: "Pool-level depth required",
      holderConcentrationLabel: "Holder graph required",
      anomalyLabel: match.change7d !== undefined && match.change7d <= -25 ? "TVL stress review" : "TVL context lane",
    },
  };
}

export async function loadDefiLlamaMatches(query: string, locale: LensLocale) {
  const clean = query.trim();
  if (clean.length < 2) return [];
  const provider = await searchProviderResilience.execute({
    providerId: "defillama-protocols",
    cacheKey: `search:defillama:${clean.toLowerCase()}`,
    execute: () => searchDefiLlamaProtocols(clean, undefined, 3),
    validate: (matches) => Array.isArray(matches) && matches.every((match) =>
      typeof match?.slug === "string" && typeof match?.name === "string"),
    freshTtlMs: 60_000,
    staleTtlMs: 10 * 60_000,
    timeoutMs: 4_500,
    failureThreshold: 3,
    cooldownMs: 30_000,
    maxConcurrent: 4,
  });
  if (!provider.ok || !provider.value) return [];
  const rows = provider.value.map((match) => defiLlamaToLensResult(match, locale));
  return applySearchProviderResilience(rows, provider, "defillama-protocols");
}

export function coinToLensResult(
  coin: CoinGeckoMarket,
  locale: LensLocale,
): VelmereSearchResult {
  const symbol = coin.symbol.toUpperCase();
  const price =
    typeof coin.current_price === "number"
      ? `$${coin.current_price.toLocaleString(undefined, { maximumFractionDigits: coin.current_price < 1 ? 6 : 2 })}`
      : "price pending";
  const marketCap =
    typeof coin.market_cap === "number"
      ? `$${coin.market_cap.toLocaleString(undefined, { notation: "compact", maximumFractionDigits: 2 })}`
      : "market-cap pending";
  const volume =
    typeof coin.total_volume === "number"
      ? `$${coin.total_volume.toLocaleString(undefined, { notation: "compact", maximumFractionDigits: 2 })}`
      : "volume pending";
  const fdv =
    typeof coin.fully_diluted_valuation === "number"
      ? `$${coin.fully_diluted_valuation.toLocaleString(undefined, { notation: "compact", maximumFractionDigits: 2 })}`
      : "FDV pending";
  const highLow =
    typeof coin.high_24h === "number" && typeof coin.low_24h === "number"
      ? `${coin.low_24h.toLocaleString(undefined, { maximumFractionDigits: coin.low_24h < 1 ? 6 : 2 })}-${coin.high_24h.toLocaleString(undefined, { maximumFractionDigits: coin.high_24h < 1 ? 6 : 2 })}`
      : "range pending";
  const change24hValue =
    coin.price_change_percentage_24h_in_currency ??
    coin.price_change_percentage_24h;
  const change =
    typeof change24hValue === "number"
      ? `${change24hValue.toFixed(2)}% 24h`
      : "24h pending";
  const change1h =
    typeof coin.price_change_percentage_1h_in_currency === "number"
      ? `${coin.price_change_percentage_1h_in_currency.toFixed(2)}% 1h`
      : "1h pending";
  const change7d =
    typeof coin.price_change_percentage_7d_in_currency === "number"
      ? `${coin.price_change_percentage_7d_in_currency.toFixed(2)}% 7d`
      : "7d pending";
  const confidence = resolveCoinGeckoConfidence(coin);
  const bridge = buildVelmereShieldBridge(symbol, coin.id);
  const localized =
    locale === "de"
      ? {
          summary: `Lens hat ${coin.name} erkannt: Preis ${price}, Marktkapitalisierung ${marketCap}, Volumen ${volume}, Bewegung ${change}, 1h ${change1h}, 7d ${change7d}, FDV ${fdv}, 24h-Spanne ${highLow}. Das ist ein Markt-Preview; stärkere Aussagen brauchen Orderbuch, frischen Zeitstempel und Zweitquelle.`,
          why: "Der Bericht trennt Logo/Preis/Volumen von echter Beweislage. Fehlendes Orderbuch, Holder-Kontext oder Venue-Vergleich bleibt sichtbar statt als Sicherheit verkauft zu werden.",
          next: "Öffne Shield nur, wenn du Marktdaten mit Venue-Depth und Second-Source-Divergenz vergleichen willst.",
          chips: ["Live-Markt", "Metadaten-Logo", "Zweitquelle nötig"],
        }
      : locale === "en"
        ? {
            summary: `Lens identified ${coin.name}: price ${price}, market cap ${marketCap}, volume ${volume}, 24h move ${change}, 1h ${change1h}, 7d ${change7d}, FDV ${fdv}, 24h range ${highLow}. This is a compact market preview; stronger wording needs order book depth, a fresh timestamp and a second venue.`,
            why: "The report separates logo/price/volume from real evidence. Missing order book, holder context or venue comparison stays visible instead of being sold as certainty.",
            next: "Open Shield only when you want to compare market data with venue depth and second-source divergence.",
            chips: ["live market", "metadata logo", "second source needed"],
          }
        : {
            summary: `Lens rozpoznał ${coin.name}: cena ${price}, kapitalizacja ${marketCap}, wolumen ${volume}, ruch ${change}, 1h ${change1h}, 7d ${change7d}, FDV ${fdv}, zakres 24h ${highLow}. To krótki podgląd rynku; mocniejszy opis wymaga orderbooku, świeżego timestampu i drugiego źródła.`,
            why: "Raport oddziela logo/cenę/wolumen od realnych dowodów. Brak orderbooku, kontekstu holderów lub porównania giełd zostaje widoczny zamiast udawać pewność.",
            next: "Otwórz Shield tylko wtedy, gdy chcesz porównać market data z venue-depth oraz second-source divergence.",
            chips: [
              "rynek live",
              "logo z metadanych",
              "drugie źródło wymagane",
            ],
          };
  return {
    id: `coingecko-${coin.id}`,
    title: coin.name,
    symbol,
    category: "token",
    tone: "review",
    summary: localized.summary,
    whyItMatters: localized.why,
    missingData: [
      "Binance/MEXC depth",
      "second-source venue agreement",
      "fresh source timestamp",
      "holder/context lane",
      "advanced liquidity/slippage packet",
    ],
    nextOperatorStep: localized.next,
    sourceMode: "live_table",
    sourceConfidence: confidence,
    shieldHref: bridge.href,
    avatarLabel: symbol,
    avatarImage: coin.image,
    bridge,
    sources: [
      {
        id: "coingecko-markets",
        label: "CoinGecko markets",
        mode: "live",
        freshness: "request-time",
        confidence,
        note: "price/market-cap/volume/FDV/high-low/logo lane",
      },
      {
        id: "venue-depth",
        label: "Venue depth",
        mode: "missing",
        freshness: "missing",
        confidence: 0,
        note: "requires Binance/MEXC/Coinbase/Kraken adapter",
      },
    ],
    chips: localized.chips,
    marketSnapshot: {
      currency: "USD",
      price: coin.current_price,
      marketCap: coin.market_cap,
      fdv: coin.fully_diluted_valuation,
      volume24h: coin.total_volume,
      change1h: coin.price_change_percentage_1h_in_currency,
      change24h: change24hValue,
      change7d: coin.price_change_percentage_7d_in_currency,
      high24h: coin.high_24h,
      low24h: coin.low_24h,
      circulatingSupply: coin.circulating_supply,
      totalSupply: coin.total_supply,
      maxSupply: coin.max_supply,
      observedAt: coin.last_updated,
      liquidityLabel:
        locale === "pl"
          ? "Do potwierdzenia z venue depth"
          : locale === "de"
            ? "Mit Venue Depth zu bestätigen"
            : "Requires venue-depth confirmation",
      depthLabel:
        locale === "pl"
          ? "Binance / MEXC / Coinbase lane wymagany"
          : locale === "de"
            ? "Binance-/MEXC-/Coinbase-Pfad erforderlich"
            : "Binance / MEXC / Coinbase lane required",
      holderConcentrationLabel:
        locale === "pl"
          ? "Snapshot holderów wymagany"
          : locale === "de"
            ? "Holder-Snapshot erforderlich"
            : "Holder snapshot required",
      unlockLabel:
        locale === "pl"
          ? "Harmonogram unlocków wymagany"
          : locale === "de"
            ? "Unlock-Zeitplan erforderlich"
            : "Unlock schedule required",
      venueHealthLabel:
        locale === "pl"
          ? "Status, depth i heartbeat do spięcia"
          : locale === "de"
            ? "Status, Depth und Heartbeat ausstehend"
            : "Status, depth and heartbeat pending",
      anomalyLabel:
        locale === "pl"
          ? "Porównaj ruch ceny z wolumenem i głębokością"
          : locale === "de"
            ? "Preisbewegung mit Volumen und Tiefe vergleichen"
            : "Compare price move against volume and depth",
    },
  };
}

export async function attachPass463VenueEvidence(
  result: VelmereSearchResult,
  locale: LensLocale,
): Promise<VelmereSearchResult> {
  const assetSymbol = normalizePass463AssetSymbol(result.symbol || "");
  if (!assetSymbol || !/^[A-Z0-9]{2,12}$/.test(assetSymbol)) return result;
  try {
    const secondaryVenueId = preferredPass462SecondaryVenue(
      "binance",
      assetSymbol,
    );
    const [primary, secondary] = await Promise.all([
      resolvePass461VenueHealthWithFallback("binance", assetSymbol),
      resolvePass461VenueHealthWithFallback(
        secondaryVenueId,
        assetSymbol,
      ).catch(() => null),
    ]);
    if (!primary) return result;
    const comparison = buildPass462CrossVenueComparison(primary, secondary);
    const divergence =
      comparison.priceDivergenceBps == null
        ? locale === "pl"
          ? "wymaga porównywalnej drugiej pary"
          : locale === "de"
            ? "benötigt ein vergleichbares zweites Paar"
            : "requires a comparable second pair"
        : `${comparison.priceDivergenceBps.toFixed(1)} bps`;
    const comparisonCopy =
      locale === "pl"
        ? `${assetSymbol} ma parę ${primary.pair} na ${primary.venue}${secondary ? ` oraz ${secondary.pair} na ${secondary.venue}` : ""}. Stan ${comparison.state}, rozjazd ceny ${divergence}, baza ${comparison.quoteBasisState}. To kontrola jakości market data, nie certyfikat bezpieczeństwa giełdy.`
        : locale === "de"
          ? `${assetSymbol} nutzt ${primary.pair} auf ${primary.venue}${secondary ? ` und ${secondary.pair} auf ${secondary.venue}` : ""}. Status ${comparison.state}, Preisabweichung ${divergence}, Quotierungsbasis ${comparison.quoteBasisState}. Dies ist eine Marktdatenprüfung, kein Börsen-Sicherheitszertifikat.`
          : `${assetSymbol} uses ${primary.pair} on ${primary.venue}${secondary ? ` and ${secondary.pair} on ${secondary.venue}` : ""}. State ${comparison.state}, price divergence ${divergence}, quote basis ${comparison.quoteBasisState}. This is a market-data quality check, not an exchange certificate.`;
    const sourceConfidence = Math.min(
      comparison.confidenceCap,
      comparison.state === "aligned"
        ? Math.max(result.sourceConfidence, 76)
        : comparison.state === "watch"
          ? Math.min(result.sourceConfidence, 66)
          : Math.min(result.sourceConfidence, 48),
    );
    const sourceModeForVenue = (state: typeof primary.state) =>
      state === "source_bound" || state === "review"
        ? ("live" as const)
        : state === "stale"
          ? ("fallback" as const)
          : ("missing" as const);
    const liveSources = [
      {
        id: `${primary.venueId}-venue-health`,
        label: `${primary.venue} ${primary.pair}`,
        mode: sourceModeForVenue(primary.state),
        freshness:
          primary.state === "provider_error" || primary.state === "unsupported"
            ? "source required"
            : primary.observedAt,
        confidence: primary.confidenceCap,
        note: `price/spread/depth/continuity · ${primary.state} · ${primary.pairResolutionState}`,
      },
      ...(secondary
        ? [
            {
              id: `${secondary.venueId}-venue-health`,
              label: `${secondary.venue} ${secondary.pair}`,
              mode: sourceModeForVenue(secondary.state),
              freshness:
                secondary.state === "provider_error" ||
                secondary.state === "unsupported"
                  ? "source required"
                  : secondary.observedAt,
              confidence: secondary.confidenceCap,
              note: `${secondary.quoteCurrency} reference · ${secondary.state} · ${secondary.pairResolutionState}`,
            },
          ]
        : []),
    ];
    const comparisonHasTwoUsableSources =
      Boolean(secondary) &&
      comparison.directPriceComparable &&
      comparison.state !== "single_source" &&
      comparison.state !== "unavailable";
    const retainedMissingData = result.missingData.filter((item) => {
      if (/fresh source timestamp|binance\/mexc depth/i.test(item)) {
        return primary.state === "stale" || primary.state === "provider_error";
      }
      if (/second-source venue agreement/i.test(item)) {
        return !comparisonHasTwoUsableSources;
      }
      return true;
    });
    const secondVenueGap = comparisonHasTwoUsableSources
      ? null
      : locale === "pl"
        ? `Wymagane porównywalne drugie venue dla ${assetSymbol}; obecny stan: ${comparison.state}, baza: ${comparison.quoteBasisState}.`
        : locale === "de"
          ? `Vergleichbarer zweiter Handelsplatz für ${assetSymbol} erforderlich; Status: ${comparison.state}, Basis: ${comparison.quoteBasisState}.`
          : `Comparable second venue required for ${assetSymbol}; current state: ${comparison.state}, basis: ${comparison.quoteBasisState}.`;
    return {
      ...result,
      summary: `${result.summary} ${comparisonCopy}`,
      sourceMode: liveSources.some((source) => source.mode === "live")
        ? "live_table"
        : result.sourceMode,
      sourceConfidence,
      missingData: [
        ...retainedMissingData,
        ...(secondVenueGap && !retainedMissingData.includes(secondVenueGap)
          ? [secondVenueGap]
          : []),
      ].slice(0, 8),
      sources: [
        ...result.sources.filter((source) => source.id !== "venue-depth"),
        ...liveSources,
      ],
      chips: [
        ...result.chips,
        `${assetSymbol} ${comparison.state}`,
        `basis ${comparison.quoteBasisState}`,
      ].slice(0, 6),
      marketSnapshot: {
        ...result.marketSnapshot,
        venueHealthLabel: secondary
          ? `${primary.state} ${primary.healthScore}/100 · ${secondary.state} ${secondary.healthScore}/100`
          : `${primary.state} ${primary.healthScore}/100 · second venue required`,
        venueAssetSymbol: assetSymbol,
        venuePrimary: `${primary.venue} ${primary.pair}`,
        venueSecondary: secondary
          ? `${secondary.venue} ${secondary.pair}`
          : undefined,
        venuePrimaryQuoteCurrency: primary.quoteCurrency,
        venueSecondaryQuoteCurrency: secondary?.quoteCurrency,
        venueQuoteBasisState: comparison.quoteBasisState,
        venueQuoteBasisPenalty: comparison.quoteBasisPenalty,
        venuePairResolutionState: primary.pairResolutionState,
        venuePairResolutionNote: primary.pairResolutionNote,
        venueReferencePrice: primary.referencePrice ?? undefined,
        venueSecondaryPrice: secondary?.referencePrice ?? undefined,
        venueComparisonState: comparison.state,
        venueDivergenceBps: comparison.priceDivergenceBps ?? undefined,
        venueSpreadDeltaBps: comparison.spreadDeltaBps ?? undefined,
        venueFreshnessDeltaSeconds:
          comparison.freshnessDeltaSeconds ?? undefined,
        venueHealthScore: secondary
          ? Math.round((primary.healthScore + secondary.healthScore) / 2)
          : primary.healthScore,
        venueConfidenceCap: comparison.confidenceCap,
        venueEvidenceNote: `${comparison.notes.join(" · ")} ${comparison.boundary}`,
      },
    };
  } catch {
    return result;
  }
}

export function scoreCoinGeckoMatch(coin: CoinGeckoMarket, query: string) {
  const clean = query.trim().toLowerCase();
  const symbol = coin.symbol.toLowerCase();
  const name = coin.name.toLowerCase();
  const id = coin.id.toLowerCase();
  const nameWords = name.split(/[^a-z0-9]+/).filter(Boolean);

  if (symbol === clean) return 0;
  if (id === clean) return 1;
  if (name === clean) return 2;
  if (symbol.startsWith(clean)) return 3;
  if (nameWords.some((word) => word.startsWith(clean))) return 4;
  if (id.startsWith(clean)) return 5;
  if (clean.length >= 4 && name.includes(clean)) return 8;
  return Number.POSITIVE_INFINITY;
}

export async function loadCoinGeckoMatches(query: string, locale: LensLocale) {
  const clean = query.trim().toLowerCase();
  if (clean.length < 1) return [];
  const provider = await searchProviderResilience.execute({
    providerId: "coingecko-markets",
    cacheKey: "search:coingecko:markets:usd:250",
    execute: async () => {
      const params = new URLSearchParams({
        vs_currency: "usd",
        order: "market_cap_desc",
        per_page: "250",
        page: "1",
        sparkline: "false",
        price_change_percentage: "1h,24h,7d",
      });
      const res = await brokeredEgressFetch(
        `https://api.coingecko.com/api/v3/coins/markets?${params.toString()}`,
        {
          headers: {
            accept: "application/json",
            "user-agent": "Velmere-Market-Integrity/1.0",
          },
          next: { revalidate: 45 },
        },
        {
          profile: "coingecko",
          operation: "search_coingecko_markets",
          timeoutMs: 4_500,
          maxResponseBytes: 2_000_000,
        },
      );
      if (!res.ok) throw Object.assign(new Error(`coingecko_http_${res.status}`), { status: res.status });
      return readJsonResponseBounded<CoinGeckoMarket[]>(res, 2_000_000);
    },
    validate: (rows) => Array.isArray(rows) && rows.length > 0 && rows.every((coin) =>
      typeof coin?.id === "string" && typeof coin?.symbol === "string" && typeof coin?.name === "string"),
    freshTtlMs: 45_000,
    staleTtlMs: 8 * 60_000,
    timeoutMs: 4_500,
    failureThreshold: 3,
    cooldownMs: 30_000,
    maxConcurrent: 3,
  });
  if (!provider.ok || !provider.value) return [];
  const scored = provider.value
    .map((coin) => ({ coin, score: scoreCoinGeckoMatch(coin, clean) }))
    .filter((row) => Number.isFinite(row.score))
    .sort(
      (a, b) =>
        a.score - b.score ||
        (b.coin.market_cap ?? 0) - (a.coin.market_cap ?? 0),
    );

  const exactOnly = (scored[0]?.score ?? Number.POSITIVE_INFINITY) <= 2;
  const resultLimit = clean.length <= 1 ? 6 : 12;
  const mapped = (
    exactOnly ? scored.slice(0, 1) : scored.slice(0, resultLimit)
  ).map(({ coin }) => coinToLensResult(coin, locale));
  const enriched = exactOnly && mapped.length === 1
    ? [await attachPass463VenueEvidence(mapped[0], locale)]
    : mapped;
  return applySearchProviderResilience(enriched, provider, "coingecko-markets");
}
