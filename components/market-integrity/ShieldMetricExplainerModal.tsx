"use client";

import { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Activity, AlertTriangle, CheckCircle2, ChevronRight, HelpCircle, Shield, Sliders, Sparkles, X } from "lucide-react";
import BodyPortal from "@/components/ui/BodyPortal";
import { useModalScrollLock } from "@/components/ui/useModalScrollLock";

export type MetricExplainerId =
  | "markets"
  | "integrity"
  | "market-cap"
  | "volume"
  | "risk"
  | "coverage"
  | "confidence"
  | "avg-change"
  | "active-instruments";

type MetricDetail = {
  title: string;
  category: string;
  shortDesc: string;
  definition: string;
  methodology: string;
  thresholds?: Array<{ label: string; range: string; tone: "positive" | "warning" | "danger" | "neutral"; desc: string }>;
  practicalUse: string;
  whyTrust: string;
};

const METRIC_DETAILS: Record<"pl" | "en" | "de", Record<MetricExplainerId, MetricDetail>> = {
  pl: {
    markets: {
      title: "Monitorowane rynki",
      category: "Infrastruktura rynkowa",
      shortDesc: "Łączna liczba zweryfikowanych instrumentów objętych aktywnym nadzorem.",
      definition: "Wskaźnik reprezentuje całkowitą liczbę instrumentów kryptowalutowych, dla których Velmère aktywnie śledzi kwotowania, orderbooki oraz strukturę przepływu kapitału w czasie rzeczywistym.",
      methodology: "Kwotowania są agregowane bezpośrednio z oficjalnych połączeń websocket/REST od akredytowanych dostawców giełdowych (m.in. Coinbase, Binance, Kraken, OKX). Kafelek uwzględnia wyłącznie instrumenty, które przeszły testy antyspoofingowe.",
      practicalUse: "Pozwala inwestorowi szybko zweryfikować, jak szeroki koszyk aktywów stanowi bazę statystyczną dla bieżącego stanu rynku.",
      whyTrust: "Brak syntetycznych lub fikcyjnych instrumentów — każdy rynek powiązany jest z ujawnionym, zweryfikowanym identyfikatorem giełdowym.",
    },
    integrity: {
      title: "Integralność rynkowa (średnia)",
      category: "Jakość mikrostruktury",
      shortDesc: "Średnia odporność monitorowanego rynku na manipulacje i anomalie (0–100).",
      definition: "Kompleksowa ocena czystości rynku i organiczności wolumenu w skali 0–100 punktów. Wyższy wynik oznacza rynek o zdrowej płynności, głębokim arkuszu zleceń i minimalnym ryzyku sztucznych interwencji.",
      methodology: "Wyliczana jako dynamiczne odwrócenie zagregowanego wektora ryzyka manipulacyjnego (100 - Composite Risk Score). Uwzględnia 14 parametrów mikrostrukturalnych, w tym asymetrię zleceń (depth imbalance), gęstość spreadu bid-ask oraz korelacje wolumenowo-cenowe.",
      thresholds: [
        { label: "Wysoka integralność", range: "75–100", tone: "positive", desc: "Rynek organiczny, wysoka głębokość, znikome ryzyko spoofingu." },
        { label: "Standardowa płynność", range: "50–74", tone: "neutral", desc: "Typowa dynamika głównych aktywów krypto; umiarkowana zmienność spreadu." },
        { label: "Podwyższona czujność", range: "30–49", tone: "warning", desc: "Wykryto klastry podejrzanych zleceń lub nagłe wahania wolumenu." },
        { label: "Rynek zniekształcony", range: "0–29", tone: "danger", desc: "Wysokie prawdopodobieństwo wash tradingu, sztuczna płynność lub dump." },
      ],
      practicalUse: "Umożliwia natychmiastowe odróżnienie instrumentów o rzeczywistym popycie od rynków podatnych na manipulacje.",
      whyTrust: "Matematyczny model behawioralny skalibrowany na danych historycznych manipulacji rynkowych.",
    },
    "market-cap": {
      title: "Kapitalizacja w feedzie",
      category: "Wycena makroekonomiczna",
      shortDesc: "Zagregowana wartość rynkowa zweryfikowanych instrumentów w obiegu.",
      definition: "Łączna kapitalizacja rynkowa wszystkich instrumentów aktualnie przetwarzanych w terminalu Velmère Shield Pro.",
      methodology: "Suma iloczynów aktualnej ceny rynkowej spot oraz zweryfikowanej podaży w obiegu (circulating supply) potwierdzonej z rejestrów on-chain i API instytucjonalnych.",
      practicalUse: "Daje precyzyjny punkt odniesienia do analizy alokacji kapitału pomiędzy czołowymi aktywami a segmentem średnich i małych tokenów.",
      whyTrust: "Wyklucza zablokowane i nierozdystrybuowane pule tokenów deweloperów z oficjalnego wyniku circulating market cap.",
    },
    volume: {
      title: "Wolumen 24h — Zakres i metodologia",
      category: "Płynność i obrót",
      shortDesc: "Jasne rozróżnienie: GLOBAL AGGREGATED VOLUME vs VENUE VOLUME z podaniem providera i metody agregacji.",
      definition: "Całkowity obrót kapitałowy instrumentem zarejestrowany w ciągu ostatnich 24 godzin. System Velmère rygorystycznie rozróżnia wolumen zagregowany globalnie od wolumenu z pojedynczej giełdy.",
      methodology: "W zależności od aktywnego feedu: (1) GLOBAL AGGREGATED VOLUME (CoinGecko) — suma wolumenów 24h z ponad 100 raportujących giełd z wagami zaufania; (2) VENUE VOLUME (Binance Spot) — wolumen z pojedynczego arkusza zleceń pary spot kwotowanej do USDT; (3) VENUE VOLUME (Giełdy tradycyjne) — oficjalny wolumen sesyjny raportowany przez giełdę (NYSE/NASDAQ).",
      thresholds: [
        { label: "Wysoka płynność globalna", range: "> 100M USD", tone: "positive", desc: "Głęboki obrót na wielu giełdach, minimalny poślizg cenowy." },
        { label: "Standardowa płynność", range: "10M–100M USD", tone: "neutral", desc: "Wystarczający obrót dla standardowych transakcji rynkowych." },
        { label: "Ograniczona płynność", range: "1M–10M USD", tone: "warning", desc: "Zwiększona podatność na poślizg przy większych zleceniach." },
        { label: "Niska płynność / Ryzyko", range: "< 1M USD", tone: "danger", desc: "Płytki rynek, ryzyko manipulacji i problemów z wyjściem z pozycji." },
      ],
      practicalUse: "Pozwala natychmiast odróżnić rzeczywisty globalny popyt od sztucznego wolumenu generowanego na pojedynczej giełdzie (wash trading).",
      whyTrust: "Pełna przejrzystość metryki — interfejs i raporty PDF zawsze ujawniają scope (GLOBAL AGGREGATED vs VENUE), dostawcę danych oraz metodę agregacji.",
    },
    risk: {
      title: "Ryzyko manipulacji (średnia)",
      category: "Bezpieczeństwo i nadzór",
      shortDesc: "Zagregowana miara podatności rynków na manipulacje cenowe (0–100, niżej = bezpieczniej).",
      definition: "Syntetyczny indeks ryzyka w skali 0–100 mierzący prawdopodobieństwo wystąpienia sztucznych anomalii cenowych, wash tradingu, layering czy rug-pulli płynności.",
      methodology: "Analiza rozkładu zleceń arkusza L2, współczynnik illiquidity Amihuda, wskaźniki koncentracji adresów on-chain oraz odchylenia cenowe pomiędzy niezależnymi giełdami.",
      thresholds: [
        { label: "Minimalne ryzyko (Institutional)", range: "0–25%", tone: "positive", desc: "Głęboki orderbook, wysoka dywersyfikacja, stabilne kwotowania." },
        { label: "Umiarkowane ryzyko (Standard)", range: "26–50%", tone: "neutral", desc: "Typowa zmienność rynku kryptowalut, płynność wystarczająca." },
        { label: "Podwyższone ryzyko (Alert)", range: "51–75%", tone: "warning", desc: "Anomalie w przepływach kapitału, ryzyko wymuszonych likwidacji." },
        { label: "Krytyczne ryzyko (Hazard)", range: "76–100%", tone: "danger", desc: "Ekstremalna asymetria, płytki arkusz, ryzyko nagłego wycofania płynności." },
      ],
      practicalUse: "Pozwala na świadome zarządzanie wielkością pozycji (position sizing) i dostosowywanie marginesów bezpieczeństwa transakcji.",
      whyTrust: "Algorytmy Velmère testowane w warunkach rzeczywistych zatorów rynkowych i skrajnej zmienności.",
    },
    coverage: {
      title: "Pokrycie dowodami",
      category: "Weryfikowalność danych",
      shortDesc: "Odsetek instrumentów posiadających pełne, wieloźródłowe potwierdzenie danych.",
      definition: "Odsetek instrumentów w katalogu, dla których dostępne są twarde dowody rynkowe (dane spot, L2 orderbook, tick history) bez polegania na estymacjach jednorazowych.",
      methodology: "Współczynnik: (Liczba instrumentów o statusie LIVE z co najmniej 2 niezależnych źródeł / Wszystkie monitorowane instrumenty) * 100%.",
      thresholds: [
        { label: "Pełne pokrycie", range: "90–100%", tone: "positive", desc: "Dane w pełni skorelowane i potwierdzone krzyżowo w wielu źródłach." },
        { label: "Wysokie pokrycie", range: "70–89%", tone: "neutral", desc: "Większość aktywów spełnia kryteria podwójnej weryfikacji." },
        { label: "Częściowe pokrycie", range: "< 70%", tone: "warning", desc: "Część danych opiera się na pojedynczych źródłach; zalecana ostrożność." },
      ],
      practicalUse: "Informuje analityka, z jak dużą pewnością może ufać zagregowanym wskaźnikom rynkowym.",
      whyTrust: "Jawne reguły — wskaźnik natychmiast sygnalizuje jakiekolwiek opóźnienia u zewnętrznych dostawców.",
    },
    confidence: {
      title: "Pewność dowodów (średnia)",
      category: "Kalibracja statystyczna",
      shortDesc: "Matematyczna pewność modeli analitycznych i spójność sygnałów (0–100).",
      definition: "Wskaźnik zbieżności i stabilności sygnałów analitycznych Velmère. Ocenia stopień, w jakim kwotowania z różnych źródeł są spójne i wolne od opóźnień sieciowych.",
      methodology: "Mierzony na bazie rozrzutu cenowego (bid-ask spread divergence) pomiędzy źródłami, opóźnień sieciowych (latency jitter) oraz spójności wolumenu w krótkich oknach czasowych.",
      practicalUse: "Daje klarowną wskazówkę co do dokładności wyznaczonych poziomów ryzyka przed podjęciem kluczowych decyzji handlowych.",
      whyTrust: "Brak ukrytych założeń — spadek spójności między giełdami natychmiast obniża wynik pewności.",
    },
    "avg-change": {
      title: "Średnia zmiana (24H)",
      category: "Dynamika rynkowa",
      shortDesc: "Średnia ważona zmiana cenowa monitorowanego koszyka aktywów w ciągu ostatniej doby.",
      definition: "Wskaźnik odzwierciedla ogólny kierunek i siłę trendu rynkowego w przekroju 24 godzin.",
      methodology: "Średnia arytmetyczna lub wolumenowa zmian procentowych w odniesieniu do ceny otwarcia z godziny 00:00 UTC.",
      practicalUse: "Szybka orientacja w nastrojach rynkowych (risk-on vs risk-off).",
      whyTrust: "Obliczana wyłącznie na podstawie zweryfikowanych transakcji spot.",
    },
    "active-instruments": {
      title: "Aktywne instrumenty",
      category: "Status feedu",
      shortDesc: "Liczba monet z nieprzerwaną transmisją ticków w ciągu ostatnich 60 sekund.",
      definition: "Wskaźnik liveness — potwierdza, ile instrumentów przesyła aktualne kwotowania bez opóźnień.",
      methodology: "Weryfikacja stempla czasowego ostatniego ticku: tick musi mieścić się w dopuszczalnym oknie świeżości.",
      practicalUse: "Gwarantuje, że terminal prezentuje dane na żywo, a nie archiwalne snapshoty.",
      whyTrust: "System automatycznie oznacza instrumenty jako 'STALE', gdy sygnał zostanie przerwany.",
    },
  },
  en: {
    markets: {
      title: "Markets Monitored",
      category: "Market Infrastructure",
      shortDesc: "Total count of verified crypto instruments actively tracked.",
      definition: "Represents the total number of cryptocurrency instruments for which Velmère actively tracks quotes, orderbooks, and liquidity structure in real time.",
      methodology: "Quotes are aggregated directly via official websocket/REST feeds from accredited exchange providers (including Coinbase, Binance, Kraken, OKX). Markets with suspicious wash trading patterns are excluded.",
      practicalUse: "Allows investors and analysts to verify the statistical sample breadth underpinning overall market metrics.",
      whyTrust: "Zero synthetic or phantom instruments — every market is bound to a verified exchange identifier.",
    },
    integrity: {
      title: "Market Integrity Score (avg)",
      category: "Microstructure Health",
      shortDesc: "Average resilience of monitored markets against manipulation (0–100).",
      definition: "A composite benchmark of market health and organic order flow scored 0–100. Higher scores denote healthy liquidity, deep books, and minimal manipulative distortion.",
      methodology: "Computed as the inverse of the manipulation risk vector (100 - Composite Risk Score). Synthesizes 14 microstructure parameters including depth imbalance, bid-ask spread stability, and volume-price correlation.",
      thresholds: [
        { label: "High Integrity", range: "75–100", tone: "positive", desc: "Organic market, deep orderbooks, minimal spoofing risk." },
        { label: "Standard Liquidity", range: "50–74", tone: "neutral", desc: "Typical crypto market dynamics; normal spread volatility." },
        { label: "Heightened Vigilance", range: "30–49", tone: "warning", desc: "Clusters of suspicious orders or sudden volume shifts detected." },
        { label: "Distorted Market", range: "0–29", tone: "danger", desc: "High probability of wash trading, artificial depth, or dump exposure." },
      ],
      practicalUse: "Enables immediate differentiation between genuine demand and artificially pumped tokens.",
      whyTrust: "Algorithmic behavioral model calibrated against historical flash crashes and market anomalies.",
    },
    "market-cap": {
      title: "Market Cap in Feed",
      category: "Macro Valuation",
      shortDesc: "Aggregated market capitalization of verified assets in circulation.",
      definition: "The total market valuation across all actively processed instruments in the Velmère Shield Pro terminal.",
      methodology: "Sum of spot prices multiplied by verified circulating supply cross-checked with on-chain registries and institutional feeds.",
      practicalUse: "Serves as an institutional macro benchmark for liquidity allocation across crypto sectors.",
      whyTrust: "Locked team tokens and unvested reserves are excluded from circulating supply calculation.",
    },
    volume: {
      title: "24h Volume — Scope & Methodology",
      category: "Liquidity & Turnover",
      shortDesc: "Strict distinction: GLOBAL AGGREGATED VOLUME vs VENUE VOLUME with disclosed provider and aggregation method.",
      definition: "Total turnover recorded for an instrument over the rolling 24-hour window. Velmère enforces explicit attribution between multi-venue aggregate volume and single-exchange venue volume.",
      methodology: "Driven by the active feed: (1) GLOBAL AGGREGATED VOLUME (CoinGecko) — 24h summation across 100+ vetted exchanges with trust-score weighting; (2) VENUE VOLUME (Binance Spot) — single-pair orderbook turnover quoted against USDT; (3) VENUE VOLUME (Traditional Markets) — consolidated session volume reported by primary exchanges (NYSE/NASDAQ).",
      thresholds: [
        { label: "High Global Liquidity", range: "> $100M", tone: "positive", desc: "Deep multi-venue books with minimal execution slippage." },
        { label: "Standard Liquidity", range: "$10M–$100M", tone: "neutral", desc: "Sufficient depth for institutional and retail executions." },
        { label: "Restricted Liquidity", range: "$1M–$10M", tone: "warning", desc: "Moderate execution slippage on large block orders." },
        { label: "Low Liquidity / Risk", range: "< $1M", tone: "danger", desc: "Thin orderbook, vulnerability to spoofing and exit congestion." },
      ],
      practicalUse: "Differentiates true worldwide market demand from isolated single-venue volume spikes and wash trading.",
      whyTrust: "Zero ambiguity — every table, modal, and PDF report explicitly tags the volume scope, source provider, and aggregation method.",
    },
    risk: {
      title: "Manipulation Risk (avg)",
      category: "Security & Surveillance",
      shortDesc: "Aggregated exposure to price manipulation (0–100, lower = safer).",
      definition: "A synthetic risk index scored 0–100 measuring vulnerability to orderbook spoofing, wash trading, front-running, and sudden liquidity drains.",
      methodology: "L2 orderbook depth skew analysis, Amihud illiquidity ratios, on-chain address clustering, and inter-exchange divergence metrics.",
      thresholds: [
        { label: "Minimal Risk (Institutional)", range: "0–25%", tone: "positive", desc: "Deep books, diverse participation, stable quotes." },
        { label: "Moderate Risk (Standard)", range: "26–50%", tone: "neutral", desc: "Standard crypto volatility, sufficient exit liquidity." },
        { label: "Elevated Risk (Alert)", range: "51–75%", tone: "warning", desc: "Abnormal capital flow detected, potential liquidation cascades." },
        { label: "Critical Risk (Hazard)", range: "76–100%", tone: "danger", desc: "Severe asymmetry, shallow books, high exit-slippage risk." },
      ],
      practicalUse: "Directly guides capital allocation, max position sizing, and slippage tolerance parameters.",
      whyTrust: "Stress-tested against severe liquidity crunches and de-pegging episodes.",
    },
    coverage: {
      title: "Evidence Coverage",
      category: "Data Verifiability",
      shortDesc: "Percentage of instruments with corroborated multi-source proof.",
      definition: "Proportion of assets with comprehensive market evidence (spot quotes, L2 books, historical ticks) without reliance on synthetic proxies.",
      methodology: "Formula: (Verified LIVE instruments backed by 2+ independent sources / Total instruments) * 100%.",
      thresholds: [
        { label: "Full Coverage", range: "90–100%", tone: "positive", desc: "Data thoroughly corroborated across independent sources." },
        { label: "Substantial Coverage", range: "70–89%", tone: "neutral", desc: "Majority of assets satisfy dual-verification standards." },
        { label: "Partial Coverage", range: "< 70%", tone: "warning", desc: "Some instruments rely on single feeds; exercise prudence." },
      ],
      practicalUse: "Provides immediate visibility into data completeness before committing analytical models.",
      whyTrust: "Completely transparent — automatically registers any external upstream outages.",
    },
    confidence: {
      title: "Evidence Confidence (avg)",
      category: "Statistical Calibration",
      shortDesc: "Mathematical model confidence and signal consistency (0–100).",
      definition: "Measures agreement and statistical resilience across Velmère's intelligence models, evaluating how cleanly multi-exchange feeds align.",
      methodology: "Derived from bid-ask spread divergence between exchanges, network latency jitter, and tick interval variance.",
      practicalUse: "Guides execution confidence; prevents automated trades during inter-exchange quote desynchronization.",
      whyTrust: "No black boxes — feed divergence immediately compresses confidence metrics.",
    },
    "avg-change": {
      title: "Avg 24H Change",
      category: "Market Momentum",
      shortDesc: "Weighted average 24-hour price change across the active market basket.",
      definition: "Reflects broad market directional momentum and sentiment over a rolling 24-hour cycle.",
      methodology: "Calculated from confirmed spot trade prints benchmarked against the 00:00 UTC opening price.",
      practicalUse: "Fast assessment of macro risk-on vs risk-off market regimes.",
      whyTrust: "Built strictly on confirmed spot executions.",
    },
    "active-instruments": {
      title: "Active Instruments",
      category: "Feed Liveness",
      shortDesc: "Number of tokens transmitting unbroken tick telemetry in the last 60 seconds.",
      definition: "Telemetry health metric validating how many instruments are actively streaming quotes without latency lag.",
      methodology: "Evaluates the timestamp delta of the latest tick against the freshness SLA threshold.",
      practicalUse: "Guarantees that decisions are driven by live streaming data rather than stale caches.",
      whyTrust: "Automated failover tags any delayed asset as 'STALE' within seconds.",
    },
  },
  de: {
    markets: {
      title: "Beobachtete Märkte",
      category: "Marktinfrastruktur",
      shortDesc: "Gesamtzahl der verifizierten Krypto-Instrumente unter aktiver Beobachtung.",
      definition: "Zeigt die Gesamtzahl der Krypto-Instrumente, für die Velmère Notierungen, Orderbücher und Liquiditätsflüsse in Echtzeit überwacht.",
      methodology: "Notierungen werden direkt über offizielle WebSocket-/REST-Schnittstellen zugelassener Börsenanbieter (Coinbase, Binance, Kraken, OKX) aggregiert.",
      practicalUse: "Ermöglicht Investoren die sofortige Einschätzung der statistischen Breite der Marktanalyse.",
      whyTrust: "Keine Phantom-Märkte — jedes Instrument ist an einen verifizierten Börsen-Identifikator gebunden.",
    },
    integrity: {
      title: "Marktintegrität (Ø)",
      category: "Mikrostruktur-Qualität",
      shortDesc: "Durchschnittliche Widerstandsfähigkeit der Märkte gegen Manipulationen (0–100).",
      definition: "Ganzheitliche Bewertung der Marktgesundheit und organischen Liquidität auf einer Skala von 0 bis 100. Höhere Werte signalisieren stabile Märkte.",
      methodology: "Berechnet als Umkehrung des Manipulationsrisiko-Vektors (100 - Composite Risk Score). Berücksichtigt 14 Mikrostruktur-Parameter.",
      thresholds: [
        { label: "Hohe Integrität", range: "75–100", tone: "positive", desc: "Organischer Markt, tiefe Orderbücher, minimales Spoofing-Risiko." },
        { label: "Standard-Liquidität", range: "50–74", tone: "neutral", desc: "Normale Marktdynamik; typische Krypto-Volatilität." },
        { label: "Erhöhte Wachsamkeit", range: "30–49", tone: "warning", desc: "Auffällige Order-Cluster oder plötzliche Volumensprünge." },
        { label: "Verzerrter Markt", range: "0–29", tone: "danger", desc: "Hohes Risiko von Wash Trading oder Liquiditätsabzug." },
      ],
      practicalUse: "Ermöglicht die sofortige Unterscheidung zwischen echter Nachfrage und künstlicher Marktverzerrung.",
      whyTrust: "Mathematisches Verhaltensmodell, kalibriert an historischen Marktanomalien.",
    },
    "market-cap": {
      title: "Marktkapitalisierung im Feed",
      category: "Makro-Bewertung",
      shortDesc: "Aggregierte Marktkapitalisierung verifizierter Vermögenswerte im Umlauf.",
      definition: "Gesamte Marktkapitalisierung aller im Velmère Shield Pro Terminal erfassten Instrumente.",
      methodology: "Summe aus aktuellen Spot-Preisen multipliziert mit dem verifizierten Umlaufangebot (Circulating Supply).",
      practicalUse: "Dient als institutioneller Referenzpunkt für die globale Liquiditätsverteilung.",
      whyTrust: "Gesperrte Entwickler-Token sind von der Berechnung des Umlaufangebots ausgeschlossen.",
    },
    volume: {
      title: "24h-Volumen — Geltungsbereich & Methodik",
      category: "Liquidität & Umsatz",
      shortDesc: "Strikte Unterscheidung: GLOBAL AGGREGATED VOLUME vs. VENUE VOLUME mit Angabe des Providers und der Aggregationsmethode.",
      definition: "Gesamter gemessener Kapitalumsatz eines Instruments über das rollierende 24-Stunden-Zeitfenster. Velmère unterscheidet verbindlich zwischen plattformübergreifend aggregiertem und einzelbörsenbezogenem Volumen.",
      methodology: "Abhängig vom aktiven Datenfeed: (1) GLOBAL AGGREGATED VOLUME (CoinGecko) — 24h-Summierung über mehr als 100 geprüfte Börsen mit Vertrauensgewichtung; (2) VENUE VOLUME (Binance Spot) — isoliertes Spot-Orderbuchvolumen gegen USDT; (3) VENUE VOLUME (Traditionelle Märkte) — konsolidiertes Sitzungsvolumen offizieller Börsen (NYSE/NASDAQ).",
      thresholds: [
        { label: "Hohe globale Liquidität", range: "> 100 Mio. USD", tone: "positive", desc: "Tiefe multilaterale Orderbücher, minimaler Slippage." },
        { label: "Standard-Liquidität", range: "10–100 Mio. USD", tone: "neutral", desc: "Ausreichende Tiefe für standardmäßige Ausführungen." },
        { label: "Eingeschränkte Liquidität", range: "1–10 Mio. USD", tone: "warning", desc: "Spürbarer Slippage bei größeren Orderblöcken." },
        { label: "Geringe Liquidität / Risiko", range: "< 1 Mio. USD", tone: "danger", desc: "Dünnes Orderbuch, erhöhtes Risiko von Manipulationen." },
      ],
      practicalUse: "Ermöglicht die sofortige Erkennung, ob Handelsvolumen aus weltweiter Marktnachfrage oder isolierten Einzelbörsen-Aktivitäten resultiert.",
      whyTrust: "Maximale Transparenz — Tabellen, Detaildialoge und PDF-Berichte weisen stets Geltungsbereich (Scope), Provider und Aggregationsmethode aus.",
    },
    risk: {
      title: "Manipulationsrisiko (Ø)",
      category: "Sicherheit & Aufsicht",
      shortDesc: "Aggregierte Anfälligkeit für Preismanipulationen (0–100, niedriger = sicherer).",
      definition: "Synthetischer Risikoindex zur Messung der Wahrscheinlichkeit künstlicher Preisverzerrungen, Wash Trading und Liquiditätsengpässe.",
      methodology: "L2-Orderbuch-Asymmetrie, Amihud-Illiquiditätsraten, On-Chain-Adresskonzentration und Börsendivergenzen.",
      thresholds: [
        { label: "Minimales Risiko", range: "0–25%", tone: "positive", desc: "Tiefe Bücher, breite Streuung, stabile Notierungen." },
        { label: "Moderates Risiko", range: "26–50%", tone: "neutral", desc: "Standard-Marktdynamik, ausreichende Ausstiegsliquidität." },
        { label: "Erhöhtes Risiko", range: "51–75%", tone: "warning", desc: "Ungewöhnliche Kapitalflüsse, Risiko erzwungener Liquidationen." },
        { label: "Kritisches Risiko", range: "76–100%", tone: "danger", desc: "Hohe Asymmetrie, flaches Orderbuch, hohes Slippage-Risiko." },
      ],
      practicalUse: "Steuert Positionsgrößen und maximale Slippage-Toleranzen im Risikomanagement.",
      whyTrust: "Unter Extrembedingungen realer Marktvolatilität erprobt.",
    },
    coverage: {
      title: "Evidenzabdeckung",
      category: "Daten-Verifizierbarkeit",
      shortDesc: "Prozentsatz der Instrumente mit bestätigten Multi-Source-Nachweisen.",
      definition: "Anteil der Instrumente im Katalog, für die verifizierte Nachweise ohne synthetische Schätzungen vorliegen.",
      methodology: "Verhältnis von LIVE-bestätigten Instrumenten aus 2+ Quellen zur Gesamtzahl der Märkte * 100%.",
      practicalUse: "Zeigt die Vollständigkeit der Datengrundlage vor analytischen Entscheidungen an.",
      whyTrust: "Vollständig transparent — spiegelt vorgelagerte Ausfälle sofort wider.",
    },
    confidence: {
      title: "Evidenzvertrauen (Ø)",
      category: "Statistische Kalibrierung",
      shortDesc: "Mathematisches Modellvertrauen und Signalkonsistenz (0–100).",
      definition: "Bewertet die Übereinstimmung der Modelle und Daten feeds über mehrere Handelsplätze hinweg.",
      methodology: "Gemessen anhand von Spread-Divergenzen, Latenzschwankungen und Tick-Konsistenz.",
      practicalUse: "Verhindert Ausführungen bei Datenasynchronität zwischen Börsen.",
      whyTrust: "Keine Black Box — Abweichungen zwischen Börsen senken sofort den Vertrauenswert.",
    },
    "avg-change": {
      title: "Ø 24H-Änderung",
      category: "Marktmomentum",
      shortDesc: "Gewichtete durchschnittliche 24-Stunden-Preisentwicklung des Marktes.",
      definition: "Spiegelt das Gesamtmomentum und die Risikoneigung im 24-Stunden-Fenster wider.",
      methodology: "Ermittelt anhand bestätigter Spot-Preise im Vergleich zu 00:00 UTC.",
      practicalUse: "Schnelle Einschätzung von Risk-On- vs. Risk-Off-Phasen.",
      whyTrust: "Ausschließlich auf geprüften Spot-Trades aufgebaut.",
    },
    "active-instruments": {
      title: "Aktive Instrumente",
      category: "Feed-Lebendigkeit",
      shortDesc: "Anzahl der Token mit kontinuierlicher Datenübertragung in den letzten 60 Sekunden.",
      definition: "Bestätigt, wie viele Instrumente ohne Latenzverzögerung Daten liefern.",
      methodology: "Prüfung des letzten Zeitstempels gegen das Frische-SLA.",
      practicalUse: "Stellt sicher, dass Entscheidungen auf Live-Daten statt Caches basieren.",
      whyTrust: "Automatisches Failover markiert verzögerte Assets innerhalb von Sekunden als 'STALE'.",
    },
  },
};

export default function ShieldMetricExplainerModal({
  metricId,
  locale,
  onClose,
}: {
  metricId: string;
  locale: "pl" | "en" | "de";
  onClose: () => void;
}) {
  const modalRef = useRef<HTMLDivElement>(null);
  const safeLocale = locale === "pl" || locale === "de" ? locale : "en";
  const dict = METRIC_DETAILS[safeLocale];
  const info = dict[metricId as MetricExplainerId] ?? dict.integrity;

  useModalScrollLock(true);

  // Strict scroll lock on document body & html
  useEffect(() => {
    const originalBodyOverflow = document.body.style.overflow;
    const originalHtmlOverflow = document.documentElement.style.overflow;
    const originalBodyTouch = document.body.style.touchAction;

    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    document.body.style.touchAction = "none";

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = originalBodyOverflow;
      document.documentElement.style.overflow = originalHtmlOverflow;
      document.body.style.touchAction = originalBodyTouch;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  return (
    <BodyPortal>
      <div
        className="fixed inset-0 z-[1500] grid place-items-center bg-black/85 p-4 backdrop-blur-xl animate-in fade-in duration-200 select-none"
        style={{ overscrollBehavior: "contain", touchAction: "none" }}
        onWheel={(e) => {
          if (e.target === e.currentTarget) {
            e.preventDefault();
            e.stopPropagation();
          }
        }}
        onPointerDown={(event) => {
          if (event.target === event.currentTarget) onClose();
        }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="metric-explainer-title"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 16 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          ref={modalRef}
          data-modal-scroll-region="true"
          className="relative max-h-[88vh] w-full max-w-4xl lg:max-w-5xl overflow-y-auto rounded-[2rem] border border-white/[0.14] bg-[#07090c]/98 p-6 text-white shadow-[0_25px_70px_rgba(0,0,0,0.85)] md:p-8 backdrop-blur-2xl select-text"
          style={{ overscrollBehavior: "contain", touchAction: "pan-y" }}
        >
          {/* Top Ambient Glow */}
          <div className="pointer-events-none absolute -top-24 left-1/2 h-48 w-96 -translate-x-1/2 rounded-full bg-[#c7a35b]/15 blur-3xl" />

          {/* Header */}
          <div className="relative z-10 flex items-start justify-between gap-4 border-b border-white/[0.08] pb-5">
            <div>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-[#c7a35b]/30 bg-[#c7a35b]/10 px-3 py-1 font-mono text-[9px] font-bold uppercase tracking-[0.18em] text-[#dfc89e]">
                  <Sparkles className="h-3 w-3 text-[#c7a35b]" />
                  {info.category} · Velmère Methodology
                </span>
              </div>
              <h2 id="metric-explainer-title" className="mt-2 font-serif text-2xl font-light text-white md:text-3xl tracking-tight">
                {info.title}
              </h2>
              <p className="mt-1.5 text-xs text-white/[0.60] leading-relaxed max-w-lg">
                {info.shortDesc}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-white/[0.12] bg-white/[0.04] text-white/[0.60] transition hover:border-[#c7a35b] hover:bg-white/[0.08] hover:text-white"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Body Sections - Wide Responsive Grid */}
          <div className="relative z-10 mt-6 grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-white/[0.80] leading-relaxed">
            {/* Definition */}
            <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4.5 transition hover:border-white/[0.14]">
              <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-[#dfc89e]">
                <HelpCircle className="h-3.5 w-3.5 text-[#c7a35b]" />
                <span>{safeLocale === "pl" ? "Co oznacza ta metryka?" : safeLocale === "de" ? "Was bedeutet diese Metrik?" : "What does this metric mean?"}</span>
              </div>
              <p className="mt-2.5 text-xs text-white/[0.85] leading-relaxed">
                {info.definition}
              </p>
            </div>

            {/* Methodology / How it's calculated */}
            <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4.5 transition hover:border-white/[0.14]">
              <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-cyan-200">
                <Sliders className="h-3.5 w-3.5 text-cyan-400" />
                <span>{safeLocale === "pl" ? "Jak Velmère to oblicza?" : safeLocale === "de" ? "Wie wird das berechnet?" : "How Velmère calculates this"}</span>
              </div>
              <p className="mt-2.5 text-xs text-white/[0.85] leading-relaxed">
                {info.methodology}
              </p>
            </div>

            {/* Thresholds if available */}
            {info.thresholds && info.thresholds.length > 0 ? (
              <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4.5 md:col-span-2">
                <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-cyan-200">
                  <Activity className="h-3.5 w-3.5 text-cyan-400" />
                  <span>{safeLocale === "pl" ? "Skala i progi interpretacji" : safeLocale === "de" ? "Skala & Schwellenwerte" : "Scale & Interpretation Thresholds"}</span>
                </div>
                <div className="mt-3 grid gap-2.5 md:grid-cols-2">
                  {info.thresholds.map((t) => (
                    <div
                      key={t.label}
                      className="rounded-xl border border-white/[0.06] bg-black/50 p-3 text-[11px]"
                    >
                      <div className="flex items-center justify-between">
                        <strong className="font-medium text-white/95">{t.label}</strong>
                        <span className="font-mono text-[10px] text-cyan-200 bg-cyan-950/40 px-2 py-0.5 rounded border border-cyan-800/30">
                          {t.range}
                        </span>
                      </div>
                      <p className="mt-1.5 text-[10px] text-white/[0.55] leading-normal">{t.desc}</p>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {/* Practical Investor Use */}
            <div className="rounded-2xl border border-[#c7a35b]/20 bg-[#c7a35b]/[0.03] p-4.5">
              <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-[#dfc89e]">
                <Shield className="h-3.5 w-3.5 text-[#c7a35b]" />
                <span>{safeLocale === "pl" ? "Zastosowanie w praktyce (dla inwestora/audytora)" : safeLocale === "de" ? "Praktische Anwendung" : "Practical Takeaway for Investors & Auditors"}</span>
              </div>
              <p className="mt-2 text-xs text-[#dfc89e]/90 leading-relaxed">
                {info.practicalUse}
              </p>
            </div>

            {/* Why trust */}
            <div className="rounded-2xl border border-emerald-500/[0.20] bg-emerald-500/[0.03] p-4.5">
              <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-emerald-300">
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span>{safeLocale === "pl" ? "Gwarancja rzetelności danych" : safeLocale === "de" ? "Garantie der Datenintegrität" : "Data Integrity Guarantee"}</span>
              </div>
              <p className="mt-2 text-xs text-emerald-100/[0.85] leading-relaxed">
                {info.whyTrust}
              </p>
            </div>
          </div>

          {/* Footer */}
          <div className="relative z-10 mt-6 flex justify-end border-t border-white/[0.08] pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-[#c7a35b]/40 bg-gradient-to-r from-[#c7a35b]/20 to-[#b9822d]/20 px-6 py-2.5 font-mono text-xs font-semibold uppercase tracking-wider text-[#dfc89e] transition hover:border-[#c7a35b] hover:bg-[#c7a35b]/30 shadow-md"
            >
              {safeLocale === "pl" ? "Rozumiem" : safeLocale === "de" ? "Verstanden" : "Understood"}
            </button>
          </div>
        </motion.div>
      </div>
    </BodyPortal>
  );
}
