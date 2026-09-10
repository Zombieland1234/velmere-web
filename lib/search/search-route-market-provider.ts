import {
  buildVelmereShieldBridge,
  type VelmereSearchResult,
} from "@/lib/search/intelligence-search-contract";
import {
  resolvePass459AlphaVantageSnapshot,
  type Pass459AlphaVantageSnapshot,
  type Pass459ProviderAssetClass,
} from "@/lib/market-integrity/alpha-vantage-provider";
import {
  isPass466ExactMarketMatch,
  searchPass466LensMarkets,
  type Pass466LensMarketRow,
} from "@/lib/search/real-market-lens";
import type { LensLocale, SearchIntent } from "@/lib/search/search-route-identity";

export function compactMarketValue(
  value: number | null | undefined,
  currency = "USD",
) {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  try {
    return new Intl.NumberFormat("en", {
      style: "currency",
      currency,
      notation: Math.abs(value) >= 1_000_000 ? "compact" : "standard",
      maximumFractionDigits: Math.abs(value) < 1 ? 6 : 2,
    }).format(value);
  } catch {
    return new Intl.NumberFormat("en", {
      notation: Math.abs(value) >= 1_000_000 ? "compact" : "standard",
      maximumFractionDigits: Math.abs(value) < 1 ? 6 : 2,
    }).format(value);
  }
}

export function marketClassLabel(row: Pass466LensMarketRow, locale: LensLocale) {
  const labels = {
    pl: { stock: "akcja", etf: "ETF", real_estate: "REIT / nieruchomości" },
    de: { stock: "Aktie", etf: "ETF", real_estate: "REIT / Immobilien" },
    en: { stock: "stock", etf: "ETF", real_estate: "REIT / real estate" },
  } as const;
  return labels[locale][row.assetClass];
}

export function providerClass(row: Pass466LensMarketRow): Pass459ProviderAssetClass {
  return row.assetClass;
}

export function marketTone(row: Pass466LensMarketRow): VelmereSearchResult["tone"] {
  return row.riskPressure >= 58
    ? "elevated"
    : row.riskPressure >= 38
      ? "review"
      : "calm";
}

export function marketResultCopy(
  row: Pass466LensMarketRow,
  locale: LensLocale,
  snapshot: Pass459AlphaVantageSnapshot | null,
) {
  const label = marketClassLabel(row, locale);
  const currency = snapshot?.currency || "USD";
  const price = compactMarketValue(snapshot?.currentPrice, currency);
  const marketCap = compactMarketValue(snapshot?.marketCap, currency);
  const netAssets = compactMarketValue(
    snapshot?.fundamentals.netAssets,
    currency,
  );
  const quality = snapshot?.fundamentals.quality;
  const sec = snapshot?.fundamentals.secXbrl;
  const primarySize = row.assetClass === "stock" ? marketCap : netAssets;
  const sizeLabel = row.assetClass === "stock" ? "market cap" : "net assets";
  const sourceState = snapshot?.state || "catalog_only";
  if (locale === "pl") {
    return {
      summary: `${row.name} (${row.symbol}) · ${label}. ${price ? `Cena ${price}. ` : ""}${primarySize ? `${sizeLabel} ${primarySize}. ` : ""}Stan źródła: ${sourceState}. ${quality ? `Jakość fundamentals ${quality.qualityScore}/100, limit pokrycia dowodów ${quality.confidenceCap}%. ` : ""}${sec ? `SEC/XBRL: ${sec.state}, pokrycie ${sec.conceptCoverageScore}/100.` : "Pełne SEC/XBRL wymaga trybu detail i konfiguracji źródła."}`,
      why: "Lens oddziela bieżące notowanie, dane fundamentalne, świeżość sprawozdania i drugie źródło SEC. Brak któregokolwiek poziomu obniża pokrycie dowodów zamiast tworzyć neutralne zero.",
      next:
        snapshot?.state === "source_bound"
          ? "Sprawdź waterfall pokrycia dowodów, najnowszy filing i rozbieżności Alpha Vantage ↔ SEC przed mocniejszym wnioskiem."
          : "Skonfiguruj ALPHA_VANTAGE_API_KEY i SEC_USER_AGENT, a następnie ponów szczegółowy skan instrumentu.",
    };
  }
  if (locale === "de") {
    return {
      summary: `${row.name} (${row.symbol}) · ${label}. ${price ? `Preis ${price}. ` : ""}${primarySize ? `${sizeLabel} ${primarySize}. ` : ""}Quellenstatus: ${sourceState}. ${quality ? `Fundamentals-Qualität ${quality.qualityScore}/100, Evidenzabdeckungsgrenze ${quality.confidenceCap}%. ` : ""}${sec ? `SEC/XBRL: ${sec.state}, Abdeckung ${sec.conceptCoverageScore}/100.` : "Vollständiges SEC/XBRL benötigt Detailmodus und konfigurierte Quellen."}`,
      why: "Lens trennt laufende Notierung, Fundamentals, Filing-Frische und die SEC-Zweitquelle. Fehlende Ebenen senken die Evidenzabdeckung, statt ein neutrales Nullfeld zu erzeugen.",
      next:
        snapshot?.state === "source_bound"
          ? "Prüfe den Evidenzabdeckungs-Wasserfall, das neueste Filing und Alpha-Vantage↔SEC-Abweichungen vor einer stärkeren Aussage."
          : "ALPHA_VANTAGE_API_KEY und SEC_USER_AGENT konfigurieren und den Detail-Scan erneut ausführen.",
    };
  }
  return {
    summary: `${row.name} (${row.symbol}) · ${label}. ${price ? `Price ${price}. ` : ""}${primarySize ? `${sizeLabel} ${primarySize}. ` : ""}Source state: ${sourceState}. ${quality ? `Fundamental quality ${quality.qualityScore}/100, evidence-coverage ceiling ${quality.confidenceCap}%. ` : ""}${sec ? `SEC/XBRL: ${sec.state}, coverage ${sec.conceptCoverageScore}/100.` : "Full SEC/XBRL requires detail mode and configured sources."}`,
    why: "Lens separates the current quote, fundamentals, filing freshness and the SEC second source. A missing layer lowers evidence coverage instead of becoming a neutral zero.",
    next:
      snapshot?.state === "source_bound"
        ? "Review the evidence-coverage waterfall, latest filing and Alpha Vantage ↔ SEC differences before stronger wording."
        : "Configure ALPHA_VANTAGE_API_KEY and SEC_USER_AGENT, then rerun the committed detail scan.",
  };
}

export function marketRowToLensResult(
  row: Pass466LensMarketRow,
  locale: LensLocale,
  snapshot: Pass459AlphaVantageSnapshot | null,
): VelmereSearchResult {
  const quality = snapshot?.fundamentals.quality;
  const sec = snapshot?.fundamentals.secXbrl;
  const sourceBound = snapshot?.state === "source_bound";
  const confidenceCandidates = [
    sourceBound ? 86 : 56,
    row.confidenceFloor,
    quality?.confidenceCap ?? 100,
    sec?.confidenceCap ?? 100,
  ];
  const sourceConfidence = Math.max(
    24,
    Math.min(...confidenceCandidates.filter(Number.isFinite)),
  );
  const localized = marketResultCopy(row, locale, snapshot);
  const classLabel = marketClassLabel(row, locale);
  const providerMissing =
    snapshot?.missingReason ||
    (locale === "pl"
      ? "Kluczowy provider nie został uruchomiony w sugestii."
      : locale === "de"
        ? "Der Keyed Provider wurde in der Vorschlagsansicht nicht ausgeführt."
        : "The keyed provider was not executed in suggestion mode.");
  const missingData = [
    !sourceBound ? providerMissing : null,
    !sec || sec.state === "sec_required"
      ? locale === "pl"
        ? "SEC Companyfacts/XBRL i bezpośredni filing wymagane"
        : locale === "de"
          ? "SEC Companyfacts/XBRL und direkter Filing-Link erforderlich"
          : "SEC Companyfacts/XBRL and a direct filing link required"
      : null,
    quality?.state === "partial" || quality?.state === "source_required"
      ? locale === "pl"
        ? "pełny cash flow, bilans i komplet czterech kwartałów wymagany"
        : locale === "de"
          ? "vollständiger Cashflow, Bilanz und vier Quartale erforderlich"
          : "complete cash flow, balance sheet and four-quarter history required"
      : null,
  ].filter((item): item is string => Boolean(item));
  const providerSource = snapshot
    ? {
        id: "alpha-vantage-detail",
        label: snapshot.source,
        mode: sourceBound ? ("live" as const) : ("fallback" as const),
        freshness: snapshot.sourceTimestamp
          ? new Date(snapshot.sourceTimestamp * 1000).toISOString()
          : "source required",
        confidence: sourceBound ? sourceConfidence : 32,
        confidenceCalibrated: false,
        note: snapshot.missingReason || snapshot.providerFunctions.join(" · "),
      }
    : null;
  const secSource = sec?.filingUrl
    ? {
        id: "sec-filing",
        label: `${sec.filingForm || "SEC filing"} · ${sec.filingDate || "date required"}`,
        mode: "live" as const,
        freshness: sec.filingDate || "source required",
        confidence: sec.confidenceCap,
        confidenceCalibrated: false,
        note: sec.filingUrl,
      }
    : null;
  return {
    id: `market-${row.assetClass}-${row.symbol.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
    title: row.name,
    symbol: row.symbol,
    category: "market",
    tone: marketTone(row),
    summary: localized.summary,
    whyItMatters: localized.why,
    missingData: missingData.length
      ? missingData
      : [
          locale === "pl"
            ? "sprawdź najnowszy filing i drugi provider"
            : locale === "de"
              ? "neuestes Filing und Zweitprovider prüfen"
              : "review latest filing and second provider",
        ],
    nextOperatorStep: localized.next,
    sourceMode: sourceBound ? "live_table" : "table",
    sourceConfidence,
    sourceConfidenceCalibrated: false,
    shieldHref: buildVelmereShieldBridge(row.symbol, row.id).href,
    avatarLabel: row.glyph,
    bridge: buildVelmereShieldBridge(row.symbol, row.id),
    sources: [
      {
        id: "real-markets-catalog",
        label: `Velmère Real Markets · ${classLabel}`,
        mode: "table",
        freshness: "catalog",
        confidence: Math.min(72, row.confidenceFloor),
        confidenceCalibrated: false,
        note: row.proofOrDisclosureLane,
      },
      ...(providerSource ? [providerSource] : []),
      ...(secSource ? [secSource] : []),
    ],
    chips: [
      classLabel,
      snapshot?.state || "catalog",
      quality ? `quality ${quality.qualityScore}/100` : "fundamentals pending",
      sec ? `SEC ${sec.state}` : "SEC required",
    ],
    marketSnapshot: {
      assetClass: row.assetClass,
      currency: snapshot?.currency || "USD",
      price: snapshot?.currentPrice ?? undefined,
      marketCap: snapshot?.marketCap ?? undefined,
      volume24h: snapshot?.volume24h ?? undefined,
      change24h: snapshot?.changePercent ?? undefined,
      high24h: snapshot?.high24h ?? undefined,
      low24h: snapshot?.low24h ?? undefined,
      observedAt: snapshot?.sourceTimestamp
        ? new Date(snapshot.sourceTimestamp * 1000).toISOString()
        : undefined,
      providerState: snapshot?.state,
      providerFunctions: snapshot?.providerFunctions,
      providerExchange: snapshot?.exchange || undefined,
      fundamentalState: quality?.state,
      fundamentalQualityScore: quality?.qualityScore,
      fundamentalConfidenceCap: quality?.confidenceCap,
      fundamentalFilingDate:
        sec?.filingDate || quality?.filingDate || undefined,
      fundamentalFilingUrl: sec?.filingUrl || undefined,
      fundamentalFilingForm:
        sec?.filingForm || quality?.filingForm || undefined,
      fundamentalSecState: sec?.state,
      fundamentalSecCoverage: sec?.conceptCoverageScore,
      fundamentalFilingAgeDays: quality?.filingAgeDays ?? undefined,
      fundamentalReportedPeriodEnd: quality?.reportedPeriodEnd || undefined,
      fundamentalFreeCashFlowTtm: quality?.freeCashFlowTtm ?? undefined,
      fundamentalNetDebtToEbitda: quality?.netDebtToEbitda ?? undefined,
      fundamentalCurrentRatio: quality?.currentRatio ?? undefined,
      fundamentalRevenueTtm:
        quality?.revenueTtm ?? snapshot?.fundamentals.revenueTtm ?? undefined,
      fundamentalProfitMargin: snapshot?.fundamentals.profitMargin ?? undefined,
      fundamentalPeRatio: snapshot?.fundamentals.peRatio ?? undefined,
      fundamentalExpenseRatio: snapshot?.fundamentals.expenseRatio ?? undefined,
      fundamentalNetAssets: snapshot?.fundamentals.netAssets ?? undefined,
      fundamentalTopHoldings: snapshot?.fundamentals.topHoldings
        .slice(0, 5)
        .map(
          (holding) =>
            `${holding.symbol || holding.description}${holding.weight == null ? "" : ` ${holding.weight}%`}`,
        ),
      etfTop10Concentration: quality?.etf.concentrationTop10 ?? undefined,
      etfEffectiveHoldings: quality?.etf.effectiveHoldings ?? undefined,
      etfBenchmarkSymbol: quality?.etf.benchmarkSymbol || undefined,
      etfOverlapPercent: quality?.etf.overlapPercent ?? undefined,
      fundamentalBoundary: quality?.boundary || sec?.boundary,
      anomalyLabel:
        sec?.flags.slice(0, 2).join(" · ") ||
        quality?.flags.slice(0, 2).join(" · "),
    },
  };
}

export async function loadPass466MarketMatches(
  query: string,
  locale: LensLocale,
  intent: SearchIntent,
) {
  const rows = searchPass466LensMarkets(query, 12);
  if (!rows.length) return [];
  if (
    intent === "detail" &&
    rows.length === 1 &&
    isPass466ExactMarketMatch(rows[0], query)
  ) {
    try {
      const snapshot = await resolvePass459AlphaVantageSnapshot({
        symbol: rows[0].symbol,
        assetClass: providerClass(rows[0]),
      });
      return [marketRowToLensResult(rows[0], locale, snapshot)];
    } catch {
      return [marketRowToLensResult(rows[0], locale, null)];
    }
  }
  return rows.map((row) => marketRowToLensResult(row, locale, null));
}
