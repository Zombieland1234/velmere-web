/**
 * Volume Semantics and Data Lineage Definition (zadanie.txt Section 22)
 *
 * Enforces explicit attribution and unambiguous classification between:
 * - GLOBAL AGGREGATED VOLUME (e.g. CoinGecko multi-venue 24h summation)
 * - VENUE VOLUME (e.g. Binance Spot BTC/USDT pair 24h volume)
 * - CONSOLIDATED EXCHANGE VOLUME (e.g. NYSE/NASDAQ session volume)
 *
 * For every volume display, provides:
 * 1. Scope (GLOBAL_AGGREGATED_VOLUME vs VENUE_VOLUME)
 * 2. Provider (e.g. CoinGecko, Binance Spot, Alpha Vantage)
 * 3. Aggregation Method (e.g. multi-venue summation, single-venue pair spot)
 * 4. Human-readable disclosure and badges across locales
 */

export type VolumeScope = "GLOBAL_AGGREGATED_VOLUME" | "VENUE_VOLUME";

export type VolumeSemantics = {
  scope: VolumeScope;
  scopeLabel: string;
  shortScopeLabel: string;
  provider: string;
  aggregationMethod: string;
  disclosure: string;
  observedAt?: string | null;
};

export type VolumeSemanticsOptions = {
  source?: string | null;
  venue?: string | null;
  provider?: string | null;
  feedSource?: string | null;
  assetClass?: string | null;
  observedAt?: string | null;
  locale?: "pl" | "en" | "de" | string;
};

function normalizeLocale(raw?: string | null): "pl" | "en" | "de" {
  if (raw === "de") return "de";
  if (raw === "en") return "en";
  return "pl";
}

export function resolveVolumeSemantics(options: VolumeSemanticsOptions = {}): VolumeSemantics {
  const locale = normalizeLocale(options.locale);
  const sourceStr = `${options.source || ""} ${options.venue || ""} ${options.provider || ""} ${options.feedSource || ""}`.toLowerCase();
  const assetClass = (options.assetClass || "crypto").toLowerCase();

  const isBinance = sourceStr.includes("binance");
  const isSingleVenue = isBinance || sourceStr.includes("coinbase") || sourceStr.includes("kraken") || sourceStr.includes("mexc") || sourceStr.includes("venue");
  const isTraditionalMarket = assetClass === "stock" || assetClass === "etf" || assetClass === "equity" || assetClass === "commodity" || assetClass === "real_estate";

  if (isTraditionalMarket) {
    if (locale === "pl") {
      return {
        scope: "VENUE_VOLUME",
        scopeLabel: "VENUE VOLUME (Consolidated Exchange)",
        shortScopeLabel: "WOLUMEN GIEŁDOWY",
        provider: options.provider || "Exchange Consolidated (NYSE/NASDAQ)",
        aggregationMethod: "Oficjalny skonsolidowany wolumen sesyjny raportowany przez giełdę macierzystą",
        disclosure: "Wolumen sesyjny z oficjalnych arkuszy giełdowych. Obejmuje wyłącznie transakcje zrealizowane w regulowanym obrocie giełdowym.",
        observedAt: options.observedAt,
      };
    }
    if (locale === "de") {
      return {
        scope: "VENUE_VOLUME",
        scopeLabel: "VENUE VOLUME (Consolidated Exchange)",
        shortScopeLabel: "BÖRSENVOLUMEN",
        provider: options.provider || "Exchange Consolidated (NYSE/NASDAQ)",
        aggregationMethod: "Offizielles konsolidiertes Sitzungsvolumen der Primärbörse",
        disclosure: "Sitzungsvolumen aus offiziellen Börsenbüchern. Beschränkt auf regulierten Börsenhandel.",
        observedAt: options.observedAt,
      };
    }
    return {
      scope: "VENUE_VOLUME",
      scopeLabel: "VENUE VOLUME (Consolidated Exchange)",
      shortScopeLabel: "VENUE VOLUME",
      provider: options.provider || "Exchange Consolidated (NYSE/NASDAQ)",
      aggregationMethod: "Official consolidated session volume reported by primary exchanges",
      disclosure: "Session volume from official exchange tape. Represents executed trades on regulated venues only.",
      observedAt: options.observedAt,
    };
  }

  if (isSingleVenue) {
    const venueName = isBinance ? "Binance Spot" : (options.provider || options.venue || "Single Venue");
    if (locale === "pl") {
      return {
        scope: "VENUE_VOLUME",
        scopeLabel: `VENUE VOLUME (${venueName})`,
        shortScopeLabel: "VENUE VOLUME",
        provider: venueName,
        aggregationMethod: `Pojedyncza giełda — wolumen kwotowany 24h dla pary spot (${venueName})`,
        disclosure: `Wolumen z pojedynczego arkusza zleceń (${venueName}). Nie reprezentuje łącznego obrotu światowego ze wszystkich giełd.`,
        observedAt: options.observedAt,
      };
    }
    if (locale === "de") {
      return {
        scope: "VENUE_VOLUME",
        scopeLabel: `VENUE VOLUME (${venueName})`,
        shortScopeLabel: "VENUE VOLUME",
        provider: venueName,
        aggregationMethod: `Einzelbörse — 24h-Quote-Volumen für das Spot-Paar (${venueName})`,
        disclosure: `Volumen aus einem einzelnen Orderbuch (${venueName}). Repräsentiert nicht den weltweiten Gesamtumsatz über alle Börsen.`,
        observedAt: options.observedAt,
      };
    }
    return {
      scope: "VENUE_VOLUME",
      scopeLabel: `VENUE VOLUME (${venueName})`,
      shortScopeLabel: "VENUE VOLUME",
      provider: venueName,
      aggregationMethod: `Single-venue spot pair 24h quote volume (${venueName})`,
      disclosure: `Single-venue orderbook volume (${venueName}). Does not represent total global turnover across all exchanges.`,
      observedAt: options.observedAt,
    };
  }

  // Default for crypto aggregator feeds (CoinGecko multi-venue reference)
  if (locale === "pl") {
    return {
      scope: "GLOBAL_AGGREGATED_VOLUME",
      scopeLabel: "GLOBAL AGGREGATED VOLUME (CoinGecko)",
      shortScopeLabel: "GLOBAL AGGREGATE",
      provider: "CoinGecko (Multi-venue aggregate)",
      aggregationMethod: "Suma wolumenów 24h ze wszystkich raportujących giełd spot z wagami wiarygodności",
      disclosure: "Globalnie zagregowany wolumen 24h z ponad 100 giełd krypto (CoinGecko). Reprezentuje łączny obrót rynkowy, a nie pojedynczy arkusz zleceń.",
      observedAt: options.observedAt,
    };
  }
  if (locale === "de") {
    return {
      scope: "GLOBAL_AGGREGATED_VOLUME",
      scopeLabel: "GLOBAL AGGREGATED VOLUME (CoinGecko)",
      shortScopeLabel: "GLOBAL AGGREGATE",
      provider: "CoinGecko (Multi-Venue-Aggregat)",
      aggregationMethod: "24h-Volumensummierung über alle meldenden Spot-Börsen mit Vertrauensgewichtung",
      disclosure: "Global aggregiertes 24h-Volumen über mehr als 100 Krypto-Börsen (CoinGecko). Repräsentiert den Gesamtmarktumsatz, nicht ein einzelnes Orderbuch.",
      observedAt: options.observedAt,
    };
  }
  return {
    scope: "GLOBAL_AGGREGATED_VOLUME",
    scopeLabel: "GLOBAL AGGREGATED VOLUME (CoinGecko)",
    shortScopeLabel: "GLOBAL AGGREGATE",
    provider: "CoinGecko (Multi-venue aggregate)",
    aggregationMethod: "Multi-venue 24h volume summation across reporting spot exchanges with trust scoring",
    disclosure: "Global 24h volume aggregated across 100+ vetted reporting crypto exchanges (CoinGecko). Reflects total cross-market turnover, not a single venue orderbook.",
    observedAt: options.observedAt,
  };
}
