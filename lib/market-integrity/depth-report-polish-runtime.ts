export type Pass448Locale = "pl" | "de" | "en";
export type Pass448DepthId = "basic" | "pro" | "advanced";

export type Pass448DepthTier = {
  id: Pass448DepthId;
  label: string;
  fieldCount: 10 | 14 | 20;
  promise: string;
  fields: string[];
  customerLine: string;
};

export type Pass448DepthReportContract = {
  version: "depth-report-polish-runtime";
  locale: Pass448Locale;
  symbol: string;
  headline: string;
  browserPromise: string;
  pdfForgeStages: string[];
  tiers: Pass448DepthTier[];
  missingPolicy: string;
  translationLock: "locale_controls_browser_preview_download_pdf";
  scrollLockMarkers: string[];
  sourceBoundaries: string[];
  uiMarkers: string[];
};

const copy = {
  pl: {
    headline: "Raport czytelny jak notatka analityka, nie debug z silnika",
    browserPromise: "Browser ma prowadzić użytkownika przez 4 etapy: rozpoznanie aktywa, zebranie źródeł, ludzki brief i gotowy PDF z podpisem Velmère.",
    pdfForgeStages: ["Rozpoznanie aktywa", "Źródła i braki", "Ludzki brief", "PDF z podpisem V"],
    tiers: [
      {
        id: "basic" as const,
        label: "Basic Analysis",
        fieldCount: 10 as const,
        promise: "Szybki obraz bez chaosu: najpierw cena i skala rynku, potem źródło i braki.",
        fields: ["cena", "kapitalizacja/proxy", "zmiana 24h", "wolumen", "waluta", "źródło", "timestamp", "confidence", "krótki brief", "następny krok"],
        customerLine: "Basic odpowiada na pytanie: co to jest, ile wynosi, jak świeże są dane i czego jeszcze nie wolno dopowiadać.",
      },
      {
        id: "pro" as const,
        label: "Pro Review",
        fieldCount: 14 as const,
        promise: "Pro pokazuje jakość danych: świeczki, drugi provider, luki i rytm źródeł.",
        fields: ["1h", "24h", "7d", "OHLC", "wolumen okna", "źródło świec", "drugi provider", "source rhythm", "luki", "spread/depth status", "issuer/contract lane", "venue lane", "red flags", "operator note"],
        customerLine: "Pro odpowiada na pytanie: czy wynik jest wsparty wystarczająco dobrze, żeby pokazać mocniejszą analizę.",
      },
      {
        id: "advanced" as const,
        label: "Advanced Analysis",
        fieldCount: 20 as const,
        promise: "Advanced to pełna matryca: nietypowe sygnały, płynność, poślizg, venue health, filing/contract i granica publicznej narracji.",
        fields: ["liquidity", "slippage", "depth", "orderbook", "venue health", "websocket cadence", "reconnect policy", "second-source divergence", "issuer/filing", "contract permissions", "holder/ownership", "unlock/vesting", "KOL/social", "volatility regime", "gap detector", "source lineage", "truth replay", "semantic drift", "PDF boundary", "operator next probe"],
        customerLine: "Advanced odpowiada na pytanie: jakie niestandardowe ryzyka lub braki musi jeszcze prześwietlić mózg Velmère.",
      },
    ],
    missingPolicy: "Nie pokazuj gołego unknown. Każdy brak tłumacz jako: czego brakuje, gdzie to powinno zostać sprawdzone i czy blokuje mocniejszy wniosek.",
    sourceBoundaries: [
      "CoinGecko/market data daje price, market cap i wolumen dla krypto, jeśli payload to zwróci.",
      "Binance/MEXC to osobne ścieżki świec, orderbooku i websocket cadence; nie udajemy, że to ten sam typ danych co kapitalizacja.",
      "DEX Screener zostaje lane dla tokenów/par DEX, nie zwykłą tabelą akcji.",
    ],
  },
  de: {
    headline: "Bericht wie Analysten-Notiz, nicht wie Engine-Debug",
    browserPromise: "Browser führt durch 4 Schritte: Asset erkennen, Quellen sammeln, menschliches Briefing und PDF mit Velmère-Signatur.",
    pdfForgeStages: ["Asset erkennen", "Quellen und Lücken", "Menschlicher Brief", "PDF mit V-Signatur"],
    tiers: [
      { id: "basic" as const, label: "Basic Analysis", fieldCount: 10 as const, promise: "Schneller Überblick: Preis, Marktgröße, Quelle und Lücken.", fields: ["Preis", "Market-Cap/Proxy", "24h", "Volumen", "Währung", "Quelle", "Zeitstempel", "Konfidenz", "Kurzbrief", "Nächster Schritt"], customerLine: "Basic zeigt, was sichtbar ist, wie frisch es ist und was nicht überinterpretiert werden darf." },
      { id: "pro" as const, label: "Pro Review", fieldCount: 14 as const, promise: "Pro zeigt Datenqualität: Kerzen, Zweitprovider, Lücken und Quellenrhythmus.", fields: ["1h", "24h", "7d", "OHLC", "Fenster-Volumen", "Kerzenquelle", "Zweitprovider", "Quellenrhythmus", "Lücken", "Spread/Depth", "Issuer/Contract", "Venue", "Red Flags", "Operator-Notiz"], customerLine: "Pro zeigt, ob die Daten stark genug für eine tiefere Analyse sind." },
      { id: "advanced" as const, label: "Advanced Analysis", fieldCount: 20 as const, promise: "Advanced öffnet Liquidität, Slippage, Venue Health, Filing/Contract und Narrativgrenzen.", fields: ["Liquidität", "Slippage", "Depth", "Orderbook", "Venue Health", "WebSocket Cadence", "Reconnect", "Second-Source Divergence", "Issuer/Filing", "Contract Permissions", "Holder", "Unlock/Vesting", "KOL/Social", "Volatilität", "Gap Detector", "Source Lineage", "Truth Replay", "Semantic Drift", "PDF Boundary", "Next Probe"], customerLine: "Advanced zeigt, welche ungewöhnlichen Risiken oder Lücken Velmère noch prüfen muss." },
    ],
    missingPolicy: "Kein rohes unknown. Jede Lücke erklärt, was fehlt, wo es geprüft wird und ob es stärkere Aussagen blockiert.",
    sourceBoundaries: ["CoinGecko liefert Krypto-Preis/Market-Cap/Volumen, wenn der Payload es enthält.", "Binance/MEXC bleiben eigene Candle/Orderbook/WebSocket-Lanes.", "DEX Screener bleibt für DEX-Token/Paare getrennt."],
  },
  en: {
    headline: "Report reads like an analyst note, not engine debug",
    browserPromise: "Browser guides through 4 steps: asset identity, source collection, human brief and signed Velmère PDF.",
    pdfForgeStages: ["Asset identity", "Sources and gaps", "Human brief", "PDF with V signature"],
    tiers: [
      { id: "basic" as const, label: "Basic Analysis", fieldCount: 10 as const, promise: "Fast read: price, market scale, source and gaps.", fields: ["price", "market cap/proxy", "24h", "volume", "currency", "source", "timestamp", "confidence", "short brief", "next step"], customerLine: "Basic shows what is visible, how fresh it is and what must not be overclaimed." },
      { id: "pro" as const, label: "Pro Review", fieldCount: 14 as const, promise: "Pro shows data quality: candles, second provider, gaps and source rhythm.", fields: ["1h", "24h", "7d", "OHLC", "window volume", "candle source", "second provider", "source rhythm", "gaps", "spread/depth", "issuer/contract", "venue", "red flags", "operator note"], customerLine: "Pro shows whether the data is strong enough for a deeper readout." },
      { id: "advanced" as const, label: "Advanced Analysis", fieldCount: 20 as const, promise: "Advanced opens liquidity, slippage, venue health, filing/contract and narrative boundaries.", fields: ["liquidity", "slippage", "depth", "orderbook", "venue health", "websocket cadence", "reconnect", "second-source divergence", "issuer/filing", "contract permissions", "holder", "unlock/vesting", "KOL/social", "volatility", "gap detector", "source lineage", "truth replay", "semantic drift", "PDF boundary", "next probe"], customerLine: "Advanced shows the unusual risks or gaps Velmère still needs to inspect." },
    ],
    missingPolicy: "No raw unknown. Every gap explains what is missing, where it should be checked and whether it blocks stronger wording.",
    sourceBoundaries: ["CoinGecko can provide crypto price, market cap and volume when the payload includes it.", "Binance/MEXC stay separate candle/orderbook/websocket lanes.", "DEX Screener stays separate for DEX tokens and pairs."],
  },
} as const;

export function resolvePass448Locale(locale: string): Pass448Locale {
  return locale === "de" || locale === "en" ? locale : "pl";
}

export function buildPass448DepthReportContract(input: {
  locale: string;
  symbol?: string;
  sourceConfidence?: number;
  sourceCount?: number;
  missingDataCount?: number;
}): Pass448DepthReportContract {
  const locale = resolvePass448Locale(input.locale);
  const c = copy[locale];
  const sourceCount = input.sourceCount ?? 0;
  const missingDataCount = input.missingDataCount ?? 0;
  return {
    version: "depth-report-polish-runtime",
    locale,
    symbol: (input.symbol || "VLM").toUpperCase().slice(0, 20),
    headline: c.headline,
    browserPromise: c.browserPromise,
    pdfForgeStages: [...c.pdfForgeStages],
    tiers: c.tiers.map((tier) => ({ ...tier, fields: [...tier.fields] })),
    missingPolicy: c.missingPolicy,
    translationLock: "locale_controls_browser_preview_download_pdf",
    scrollLockMarkers: ["html-overflow-hidden", "body-fixed-scroll-restore", "modal-wheel-capture", "touchmove-guard"],
    sourceBoundaries: [...c.sourceBoundaries, `source_count=${sourceCount}`, `missing_count=${missingDataCount}`, `confidence=${Math.round(input.sourceConfidence ?? 0)}%`],
    uiMarkers: ["data-pass448-browser-stage-v", "data-pass448-pdf-a4-reader-v2", "data-pass448-realmarkets-depth-shell", "data-pass448-no-raw-unknown"],
  };
}

export function explainPass448Missing(locale: string, value: string) {
  const safeLocale = resolvePass448Locale(locale);
  const sentenceValue = value.trim().replace(/[.!?]+$/u, "");
  const clean = sentenceValue.toLowerCase();
  if (safeLocale === "pl") {
    if (clean.includes("provider") || clean.includes("źród")) return "Brak do uzupełnienia: potrzebny drugi niezależny provider przed mocniejszym wnioskiem.";
    if (clean.includes("timestamp") || clean.includes("fresh")) return "Brak do uzupełnienia: potrzebny świeży timestamp źródła.";
    if (clean.includes("depth") || clean.includes("orderbook")) return "Brak do uzupełnienia: potrzebna głębokość rynku/orderbook, nie tylko cena.";
    return `Brak do uzupełnienia: ${sentenceValue}.`;
  }
  if (safeLocale === "de") return `Ausstehend: ${sentenceValue}.`;
  return `Pending: ${sentenceValue}.`;
}
