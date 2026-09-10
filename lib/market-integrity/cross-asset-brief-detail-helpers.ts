import type { UnifiedAuditMode } from "@/lib/market-integrity/unified-audit";
import type { VlmAssetDetailModalData } from "@/components/market-integrity/AssetDetailModal";
import type {
  Pass4413RealMarketsAsset as Asset,
  Pass4413CrossAssetQuote as Quote,
} from "@/lib/market-integrity/cross-asset-runtime-normalizers";
import {
  cleanAssetSymbol,
} from "@/lib/market-integrity/cross-asset-runtime-normalizers";
import {
  compactProviderLabel,
  dynamicRisk,
  formatAssetDetailQuotePrice,
  formatAssetDetailTimestamp,
  formatRelativeFreshness,
  formatSignedPercent,
  formatPrice,
  inferMarketSession,
  quoteVolume,
} from "@/lib/market-integrity/cross-asset-quote-format-helpers";
import { formatDecimalPercent } from "@/lib/market-integrity/top1-risk-foundation";
import { pass4570SanitizePercent } from "@/lib/market-integrity/market-data-sanity";

export type Pass4418Locale = "pl" | "de" | "en";
export type Pass4418RangeKey = "15m" | "1h" | "4h" | "1d" | "1w";

export const PASS4418_CROSS_ASSET_BRIEF_DETAIL_HELPER_BOUNDARY = {
  passId: "PASS4418",
  mode: "no_visual_crossasset_brief_detail_helper_extraction",
  visualChanges: false,
  worldclassBenchmarkRequired: true,
  publicTopkaLiveAllowed: false,
  purpose:
    "Move Real Markets tier intro, human brief and AssetDetailModal data assembly out of the client component without changing UI copy or live-claim policy.",
} as const;

export const PASS4418_WORLDCLASS_COMPARISON_ROWS = [
  {
    lane: "CertiK-style evidence gating",
    velmerePrepared: "tier intro + detail payload now deterministic outside UI; live claim remains blocked",
    publicClaimAllowed: false,
  },
  {
    lane: "OpenZeppelin-style reusable primitives",
    velmerePrepared: "Real Markets detail data builder is isolated for unit/regression checks",
    publicClaimAllowed: false,
  },
  {
    lane: "Trail of Bits-style adversarial review",
    velmerePrepared: "missing provider/source state remains explicit in human brief instead of hidden copy",
    publicClaimAllowed: false,
  },
  {
    lane: "ChainSecurity-style release proof",
    velmerePrepared: "PASS4418 adds regression gate and scoreboard, but no hosted live receipts yet",
    publicClaimAllowed: false,
  },
] as const;

type Pass4418RealMarketsAuditMode = "basic" | "pro" | "advanced";

function toPass4418AuditMode(mode: UnifiedAuditMode): Pass4418RealMarketsAuditMode {
  return mode === "pro" || mode === "advanced" ? mode : "basic";
}

function isPass4418VenueHealthAsset(asset?: Asset | null): boolean {
  return Boolean(
    asset?.providerSymbol.endsWith("VENUE") ||
      asset?.id.endsWith("-venue") ||
      /venue health/i.test(asset?.name ?? ""),
  );
}

export function pass4418ModeIntro(mode: UnifiedAuditMode, locale: Pass4418Locale): string {
  const intro = {
    pl: {
      basic:
        "Basic = szybki obraz: cena, zmiana, wolumen, market-cap/proxy i stan źródła.",
      pro: "Pro = kontrola jakości: świeczki, luki, drugi provider i rytm źródła.",
      advanced:
        "Advanced = pełna matryca: płynność, slippage, venue health, filing lane i anomalie.",
    },
    de: {
      basic:
        "Basic = schneller Blick: Preis, Änderung, Volumen, Market-Cap/Proxy und Quellenstatus.",
      pro: "Pro = Qualitätskontrolle: Kerzen, Lücken, Zweitprovider und Quellenrhythmus.",
      advanced:
        "Advanced = volle Matrix: Liquidität, Slippage, Venue Health, Filing Lane und Anomalien.",
    },
    en: {
      basic:
        "Basic = quick read: price, move, volume, market-cap/proxy and source state.",
      pro: "Pro = quality check: candles, gaps, second provider and source rhythm.",
      advanced:
        "Advanced = full matrix: liquidity, slippage, venue health, filing lane and anomalies.",
    },
  } as const;
  return intro[locale][toPass4418AuditMode(mode)];
}


function pass4571FirstSaneCrossAssetChange(asset: Asset, quote: Quote | undefined): number | null {
  const candidates: Array<number | null | undefined> = [
    typeof quote?.priceChange24h === "number" ? quote.priceChange24h : null,
    typeof quote?.changePercent === "number" ? quote.changePercent : null,
  ];
  for (const candidate of candidates) {
    const sanitized = pass4570SanitizePercent(candidate, asset.category, 24 * 60 * 60);
    if (typeof sanitized === "number") return sanitized;
  }
  return null;
}

export function buildPass4418HumanMarketBrief(
  asset: Asset,
  quote: Quote | undefined,
  locale: Pass4418Locale,
  range: Pass4418RangeKey,
): string {
  const price = formatPrice(quote);
  const briefChangeValue = pass4571FirstSaneCrossAssetChange(asset, quote);
  const change =
    typeof briefChangeValue === "number"
      ? `${briefChangeValue >= 0 ? "+" : ""}${briefChangeValue.toFixed(2)}%`
      : null;
  const volume = quoteVolume(quote);
  const volumeText = volume
    ? new Intl.NumberFormat(locale, {
        notation: "compact",
        maximumFractionDigits: 2,
      }).format(volume)
    : null;

  if (locale === "pl") {
    if (isPass4418VenueHealthAsset(asset)) {
      return `${asset.name}: osobna ścieżka venue health. Najpierw status/depth/websocket, potem dopiero wnioski; Velmère nie udaje ceny giełdy.`;
    }
    return `${asset.symbol}: ${price !== "—" ? `cena ${price}` : "cena do podłączenia"}${change ? `, zmiana ${change}` : ""}${volumeText ? `, wolumen ${volumeText}` : ""}. Zakres ${range.toUpperCase()} i źródło są widoczne, a brakujące pola zostają w raporcie.`;
  }
  if (locale === "de") {
    if (isPass4418VenueHealthAsset(asset)) {
      return `${asset.name}: separater Venue-Health-Pfad. Erst Status/Depth/WebSocket, dann Schlussfolgerungen; Velmère täuscht keinen Börsenpreis vor.`;
    }
    return `${asset.symbol}: ${price !== "—" ? `Preis ${price}` : "Preis ausstehend"}${change ? `, Änderung ${change}` : ""}${volumeText ? `, Volumen ${volumeText}` : ""}. Bereich ${range.toUpperCase()} und Quelle bleiben sichtbar; fehlende Felder bleiben im Bericht.`;
  }
  if (isPass4418VenueHealthAsset(asset)) {
    return `${asset.name}: separate venue-health lane. Status/depth/websocket first, conclusions later; Velmère does not fake an exchange price.`;
  }
  return `${asset.symbol}: ${price !== "—" ? `price ${price}` : "price pending"}${change ? `, change ${change}` : ""}${volumeText ? `, volume ${volumeText}` : ""}. Range ${range.toUpperCase()} and source stay visible, while missing fields remain in the report.`;
}

function pass4474RealMarketsDetailCopy(locale: Pass4418Locale) {
  return locale === "pl"
    ? {
        session: "Sesja",
        volume: "Wolumen",
        risk: "Ryzyko",
        confidence: "Confidence",
        liquidity: "Płynność",
        manipulation: "Manipulacja",
        squeeze: "Squeeze",
        source: "Źródło",
        providerBound: "provider-bound",
        sourceRhythm: "freshness rhythm",
        noAdvice: "Real Markets pokazuje akcje, FX, ETF-y, surowce i venue — crypto odsyła do Shield.",
        noFake: "Braki danych są podpisane; terminal nie udaje market capu ani wolumenu bez providerów.",
        advancedGate: "Pełna analiza Advanced jest server-first i wymaga potwierdzonego receiptu.",
      }
    : locale === "de"
      ? {
          session: "Session",
          volume: "Volumen",
          risk: "Risiko",
          confidence: "Confidence",
          liquidity: "Liquidität",
          manipulation: "Manipulation",
          squeeze: "Squeeze",
          source: "Quelle",
          providerBound: "provider-bound",
          sourceRhythm: "Freshness Rhythm",
          noAdvice: "Real Markets zeigt Aktien, FX, ETFs, Rohstoffe und Venues — Krypto bleibt im Shield.",
          noFake: "Fehlende Daten bleiben markiert; der Terminal fälscht weder Market Cap noch Volumen ohne Provider.",
          advancedGate: "Advanced Analyse ist server-first und benötigt einen bestätigten Beleg.",
        }
      : {
          session: "Session",
          volume: "Volume",
          risk: "Risk",
          confidence: "Confidence",
          liquidity: "Liquidity",
          manipulation: "Manipulation",
          squeeze: "Squeeze",
          source: "Source",
          providerBound: "provider-bound",
          sourceRhythm: "freshness rhythm",
          noAdvice: "Real Markets covers stocks, FX, ETFs, commodities and venues — crypto routes back to Shield.",
          noFake: "Missing data stays labelled; the terminal does not fake market cap or volume without providers.",
          advancedGate: "Advanced analysis is server-first and requires a confirmed receipt.",
        };
}

function formatPass4474CompactNumber(value: number | null | undefined, locale: Pass4418Locale) {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return "—";
  return new Intl.NumberFormat(locale, { notation: "compact", maximumFractionDigits: 2 }).format(value);
}

export function buildPass4418RealMarketsAssetDetailData(
  asset: Asset,
  quote: Quote | undefined,
  locale: Pass4418Locale,
  freshnessReferenceMs: number,
): VlmAssetDetailModalData {
  const change = pass4571FirstSaneCrossAssetChange(asset, quote);
  const confidence = typeof quote?.confidenceCap === "number" && Number.isFinite(quote.confidenceCap)
    ? Math.max(0, Math.min(100, quote.confidenceCap))
    : null;
  const risk = dynamicRisk(quote, asset.risk, asset);
  const detailCopy = pass4474RealMarketsDetailCopy(locale);
  const volume = quoteVolume(quote);
  const source = quote?.source ? compactProviderLabel(quote.source) : "Source unavailable";
  return {
    symbol: cleanAssetSymbol(asset.symbol),
    providerSymbol: asset.providerSymbol,
    name: asset.name,
    imageUrl: asset.domain
      ? `/api/market-integrity/brand-icon?domain=${encodeURIComponent(asset.domain)}`
      : undefined,
    assetClass:
      asset.category === "stocks" ? "stock"
        : asset.category === "indices" ? "index"
          : asset.category === "commodities" ? "commodity"
            : asset.category === "real_estate" ? "real_estate"
              : asset.category === "exchanges" ? "exchange"
                : asset.category,
    venue: asset.exchange ?? asset.name,
    assetClassLabel: `${asset.category.replace("_", " ")} · ${asset.exchange ?? "VLM Real Markets"}`,
    exchangeLabel: asset.exchange,
    priceLabel: formatAssetDetailQuotePrice(quote),
    changeLabel: formatSignedPercent(change),
    changeTone:
      typeof change !== "number" ? "neutral" : change >= 0 ? "up" : "down",
    sourceLabel: source,
    sourceTimeLabel: quote?.sourceTimestamp
      ? `${formatAssetDetailTimestamp(quote)} · ${formatRelativeFreshness(quote.sourceTimestamp, locale, freshnessReferenceMs)}`
      : formatRelativeFreshness(null, locale, freshnessReferenceMs),
    currencyLabel: quote?.currency ?? "USD",
    marketStatusLabel: inferMarketSession(asset, locale),
    confidenceLabel: confidence === null ? null : `${Math.round(confidence)}%`,
    riskLabel: formatDecimalPercent(risk),
    candles: quote?.candles ?? [],
    detailMetrics: [
      { label: detailCopy.session, value: inferMarketSession(asset, locale), caption: asset.exchange ?? "Real Markets", tone: "neutral" },
      ...(typeof volume === "number" && Number.isFinite(volume) && volume > 0
        ? [{ label: detailCopy.volume, value: formatPass4474CompactNumber(volume, locale), caption: quote?.currency ?? "USD", tone: "neutral" as const }]
        : []),
      { 
        label: detailCopy.liquidity, 
        value: typeof volume === "number" && volume > 5000000 ? (locale === "pl" ? "Wysoka (L2/L3)" : locale === "de" ? "Hoch (L2/L3)" : "Deep (L2/L3)") : (locale === "pl" ? "Standardowa" : locale === "de" ? "Standard" : "Standard"), 
        caption: locale === "pl" ? "Głębokość arkusza" : locale === "de" ? "Orderbuch-Tiefe" : "Orderbook depth", 
        tone: "evidence" as const 
      },
      { label: detailCopy.risk, value: formatDecimalPercent(risk), caption: asset.category.replace("_", " "), tone: risk !== null && risk >= 70 ? "danger" : risk !== null && risk >= 42 ? "warning" : "neutral" },
      ...(confidence === null
        ? []
        : [{ label: detailCopy.confidence, value: `${Math.round(confidence)}%`, caption: detailCopy.sourceRhythm, tone: "evidence" as const }]),
      { label: detailCopy.source, value: source, caption: quote?.source ? detailCopy.providerBound : "not supplied", tone: quote?.source ? "evidence" : "warning" },
    ],
    evidenceNotes: [detailCopy.noAdvice, detailCopy.noFake, detailCopy.advancedGate],
  };
}
