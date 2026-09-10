import type { VelmereSearchMode } from "@/lib/search/intelligence-search-contract";
import type { LensReportDepth } from "@/lib/search/lens-report";

export const PASS4416_LENS_LOCALE_COPY_BOUNDARY = {
  passId: "PASS4416",
  mode: "no_visual_browser_lens_locale_copy_extraction",
  visualChanges: false,
  purpose:
    "Move Browser/Lens locale copy, PDF depth order and command prompt copy out of VelmereIntelligenceSearchClient without changing rendered UI text.",
  publicTopkaLiveAllowed: false,
} as const;

export const PASS4416_LENS_PDF_DEPTH_ORDER = ["basic", "pro", "advanced"] as const satisfies readonly LensReportDepth[];
export const PASS4416_LENS_SEARCH_MODES = [
  "all",
  "token",
  "market",
  "contract",
  "velmere",
  "osint",
] as const satisfies readonly VelmereSearchMode[];

export const PASS4416_LENS_LOCALE_COPY = {
  pl: {
    placeholder: "Szukaj instrumentu, tokena lub kontraktu...",
    scan: "Skanuj",
    modes: {
      all: "Wszystko",
      token: "Tokeny",
      market: "Rynki",
      contract: "Kontrakty",
      velmere: "Velmère",
      osint: "OSINT",
    },
    loading: "Szukam w źródłach...",
    error: "Nie udało się pobrać wyników. Spróbuj ponownie.",
    preview: "Podgląd PDF",
    download: "Pobierz PDF",
    accountSaveVerified: "Zweryfikowano zapis exact PDF w Twoim koncie",
    accountOpen: "Otwórz zapis w koncie",
    receiptSaved: "Zarejestrowano potwierdzenie w bieżącej karcie",
    receiptBoundary:
      "Potwierdza kliknięcie pobierania, nie zapis pliku przez system.",
    downloadHelper:
      "Jeśli plik nie pojawi się w Pobranych, sprawdź pasek pobierania przeglądarki albo zapisz raport PDF z otwartego podglądu.",
    receiptHistoryTitle: "Historia PDF",
    receiptHistoryEmpty: "Brak potwierdzeń PDF w pamięci bieżącej karty.",
    receiptHistoryShow: "Pokaż pełną historię",
    receiptHistoryHide: "Ukryj historię",
    receiptHistoryBoundary:
      "Receipty istnieją wyłącznie w pamięci bieżącej karty, są zredagowane i nie zawierają treści raportu.",
    keyboardQa: "Keyboard QA: Tab, Enter, Space i Escape aktywne",
    close: "Zamknij",
    source: "Źródło",
    confidence: "Pokrycie danych",
    checked: "Co sprawdzono",
    missing: "Brakujące dane",
    next: "Następny krok",
    sources: "Źródła",
    shield: "Otwórz Shield",
    orbit: "Otwórz Shield Map",
    emptyTitle: "Velmère Lens PDF Capsule",
    emptyBody:
      "Wpisz token, kontrakt albo temat. Lens buduje krótki raport człowieczym językiem: brief, źródła, brakujące dane i następny krok operatora.",
    afterResultTitle: "Teraz wybierz zakres raportu PDF",
    afterResultBody:
      "Wynik znajduje się wyżej. Basic jest bieżącym publicznym zakresem. Pro i Advanced są zwracane tylko wtedy, gdy entitlement oraz bramka commercial-readiness przejdą; w przeciwnym razie pozostaje Basic.",
    forgeTitle: "Generowanie PDF Velmère",
    forgeSteps: [
      "Tożsamość instrumentu",
      "Źródła i luki",
      "Ludzki brief",
      "Podpis Velmère",
    ],
    pdfDepthPrompt: "Wybierz zakres PDF",
    pdfDepthLock: "Zakres wybierasz przed generowaniem",
    pdfDepthLabels: { basic: "Basic", pro: "Pro", advanced: "Advanced" },
    pdfDepthDescriptions: {
      basic:
        "Szybka decyzja: trend 1h/24h/7d, skala rynku, świeżość źródła, najważniejszy brak i jeden następny krok.",
      pro: "Zakres płatny tylko po entitlement i commercial-readiness; jeśli gate przejdzie, może rozszerzyć Basic o dodatkowe warstwy źródłowe i scenariusze.",
      advanced:
        "Zakres płatny tylko po entitlement i pełnej bramce dowodowej; bez tego nie jest publikowany jako gotowy raport Advanced.",
    },
    depthTitle: "Warstwy analizy",
    depth: [
      "Basic: sytuacja teraz, kluczowe liczby, pokrycie danych i następny krok",
      "Pro: świece, podaż/FDV, płynność, drugie źródło i scenariusz",
      "Advanced: orderbook, holderzy, unlocki, kontrakt/KOL, blockery i plan dowodowy",
    ],
  },
  de: {
    placeholder: "Instrument, Token oder Contract suchen...",
    scan: "Scannen",
    modes: {
      all: "Alles",
      token: "Token",
      market: "Märkte",
      contract: "Contracts",
      velmere: "Velmère",
      osint: "OSINT",
    },
    loading: "Quellen werden durchsucht...",
    error: "Ergebnisse konnten nicht geladen werden.",
    preview: "PDF Vorschau",
    download: "PDF laden",
    accountSaveVerified: "Exact-PDF-Speicherung in deinem Konto verifiziert",
    accountOpen: "Gespeicherten Bericht im Konto öffnen",
    receiptSaved: "Download-Startbeleg im aktuellen Tab registriert",
    receiptBoundary:
      "Bestätigt den Download-Klick, nicht die Speicherung durch das Betriebssystem.",
    downloadHelper:
      "Wenn die Datei nicht im Download-Ordner erscheint, prüfe die Browser-Downloadleiste oder speichere den PDF-Report aus der Vorschau.",
    receiptHistoryTitle: "PDF-Historie",
    receiptHistoryEmpty: "Keine PDF-Belege im Speicher des aktuellen Tabs.",
    receiptHistoryShow: "Vollständige Historie anzeigen",
    receiptHistoryHide: "Historie ausblenden",
    receiptHistoryBoundary:
      "Belege existieren nur im Speicher des aktuellen Tabs, sind redigiert und enthalten keinen Berichtstext.",
    keyboardQa: "Keyboard QA: Tab, Enter, Space und Escape aktiv",
    close: "Schließen",
    source: "Quelle",
    confidence: "Datenabdeckung",
    checked: "Geprüft",
    missing: "Fehlende Daten",
    next: "Nächster Schritt",
    sources: "Quellen",
    shield: "Shield öffnen",
    orbit: "Shield Map öffnen",
    emptyTitle: "Velmère Lens PDF Capsule",
    emptyBody:
      "Gib Token, Contract oder Thema ein. Lens erstellt einen kurzen Bericht in menschlicher Sprache: Briefing, Quellen, fehlende Daten und nächsten Operator-Schritt.",
    afterResultTitle: "Jetzt den PDF-Umfang wählen",
    afterResultBody:
      "Das Ergebnis steht oben. Basic ist der aktuelle öffentliche Umfang. Pro und Advanced werden nur ausgegeben, wenn Entitlement und Commercial-Readiness bestehen; andernfalls bleibt Basic.",
    forgeTitle: "Velmère PDF wird erzeugt",
    forgeSteps: [
      "Instrument-Identität",
      "Quellen und Lücken",
      "Menschlicher Kurzbericht",
      "Velmère Signatur",
    ],
    pdfDepthPrompt: "PDF-Tiefe wählen",
    pdfDepthLock: "Tiefe vor der Generierung wählen",
    pdfDepthLabels: { basic: "Basic", pro: "Pro", advanced: "Advanced" },
    pdfDepthDescriptions: {
      basic:
        "Schnelle Entscheidung: 1h/24h/7d-Trend, Marktgröße, Quellenfrische, wichtigste Lücke und nächster Schritt.",
      pro: "Kostenpflichtiger Umfang nur nach Entitlement und Commercial-Readiness; bei bestandenem Gate kann Basic um zusätzliche Quellen- und Szenarioebenen erweitert werden.",
      advanced:
        "Kostenpflichtiger Umfang nur nach Entitlement und vollständigem Evidenz-Gate; ohne dieses Gate wird kein verkaufsbereiter Advanced-Bericht veröffentlicht.",
    },
    depthTitle: "Analyse-Ebenen",
    depth: [
      "Basic: aktuelle Lage, Kernzahlen, Datenabdeckung und nächster Schritt",
      "Pro: Kerzen, Supply/FDV, Liquidität, Zweitquelle und Szenario",
      "Advanced: Orderbook, Holder, Unlocks, Contract/KOL, Blocker und Evidenzplan",
    ],
  },
  en: {
    placeholder: "Search instrument, token or contract...",
    scan: "Scan",
    modes: {
      all: "All",
      token: "Tokens",
      market: "Markets",
      contract: "Contracts",
      velmere: "Velmère",
      osint: "OSINT",
    },
    loading: "Searching sources...",
    error: "Results could not be loaded.",
    preview: "PDF preview",
    download: "Download PDF",
    accountSaveVerified: "Exact PDF save verified in your account",
    accountOpen: "Open the saved report in your account",
    receiptSaved: "Download-start receipt registered for this tab",
    receiptBoundary:
      "Confirms the download click, not that the operating system saved the file.",
    downloadHelper:
      "If the file does not appear in Downloads, check the browser download bar or save the PDF from the open preview.",
    receiptHistoryTitle: "PDF history",
    receiptHistoryEmpty: "No PDF receipts in the current tab memory.",
    receiptHistoryShow: "Show full history",
    receiptHistoryHide: "Hide history",
    receiptHistoryBoundary:
      "Receipts exist only in current-tab memory, are redacted and contain no report content.",
    keyboardQa: "Keyboard QA: Tab, Enter, Space and Escape active",
    close: "Close",
    source: "Source",
    confidence: "Data coverage",
    checked: "What was checked",
    missing: "Missing data",
    next: "Next step",
    sources: "Sources",
    shield: "Open Shield",
    orbit: "Open Shield Map",
    emptyTitle: "Velmère Lens PDF Capsule",
    emptyBody:
      "Enter a token, contract or topic. Lens builds a short human report: brief, sources, missing data and the next operator step.",
    afterResultTitle: "Now choose the PDF depth",
    afterResultBody:
      "The result is shown above. Basic is the current public scope. Pro and Advanced are returned only when entitlement and commercial-readiness gates pass; otherwise the flow remains on Basic.",
    forgeTitle: "Generating Velmère PDF",
    forgeSteps: [
      "Instrument identity",
      "Sources and gaps",
      "Human brief",
      "Velmère signature",
    ],
    pdfDepthPrompt: "Choose PDF depth",
    pdfDepthLock: "Choose the depth before generation",
    pdfDepthLabels: { basic: "Basic", pro: "Pro", advanced: "Advanced" },
    pdfDepthDescriptions: {
      basic:
        "Fast decision: 1h/24h/7d trend, market scale, source freshness, the key gap and one next action.",
      pro: "Paid scope only after entitlement and commercial-readiness; if the gate passes, it may extend Basic with additional source and scenario layers.",
      advanced:
        "Paid scope only after entitlement and the full evidence gate; without that gate no sell-ready Advanced report is published.",
    },
    depthTitle: "Analysis layers",
    depth: [
      "Basic: current situation, core numbers, data coverage and next action",
      "Pro: candles, supply/FDV, liquidity, second source and scenario",
      "Advanced: orderbook, holders, unlocks, contract/KOL, blockers and evidence plan",
    ],
  },
} as const;


export type Pass4416LensLocale = keyof typeof PASS4416_LENS_LOCALE_COPY;
export type Pass4416LensCopy = (typeof PASS4416_LENS_LOCALE_COPY)[Pass4416LensLocale];

export function buildPass4416LensCommandPrompts(locale: Pass4416LensLocale): readonly string[] {
  if (locale === "pl") {
    return [
      "Od czego zaczynamy?",
      "Wpisz token, kontrakt albo temat.",
      "Sprawdź źródła bez chaosu.",
    ] as const;
  }
  if (locale === "de") {
    return [
      "Womit beginnen wir?",
      "Token, Contract oder Thema eingeben.",
      "Quellen ruhig prüfen.",
    ] as const;
  }
  return [
    "Where should we begin?",
    "Enter a token, contract or topic.",
    "Check evidence without noise.",
  ] as const;
}
