import type { IntelligenceLocale } from "./intelligence-content";

export type FlagshipMetric = {
  label: string;
  value: string;
  note: string;
};

export type LiquidityMode = {
  id: "normal" | "stressed" | "thin";
  label: string;
  description: string;
};

export type LiquidityExperiment = {
  id: "depth" | "slippage" | "concentration" | "flow" | "exit";
  label: string;
  description: string;
};

export type AuditDepthTier = {
  id: "basic" | "pro" | "advanced";
  label: string;
  kicker: string;
  description: string;
  capabilities: string[];
  evidenceLanes: string[];
  outcome: string;
};

export type AuditComparisonRow = {
  label: string;
  basic: string;
  pro: string;
  advanced: string;
};

export type MarketImpactScenario = {
  id: "measured" | "large" | "stress";
  label: string;
  amount: string;
  depth: string;
  impact: string;
  slippage: string;
  risk: string;
};

export type WhaleBand = {
  id: "top10" | "top50" | "top100";
  label: string;
  concentration: string;
  delta: string;
  interpretation: string;
};

export type WhaleTransfer = {
  from: string;
  to: string;
  amount: string;
  age: string;
};

export type IntelligenceFlagshipCopy = {
  common: {
    demonstration: string;
    illustrative: string;
    inspect: string;
  };
  liquidityLab: {
    eyebrow: string;
    title: string;
    intro: string;
    amountLabel: string;
    modeLabel: string;
    directionLabel: string;
    directions: [string, string];
    modes: LiquidityMode[];
    experimentLabel: string;
    experiments: LiquidityExperiment[];
    metrics: {
      spread: string;
      slippage: string;
      impact: string;
      consumed: string;
    };
    depthTitle: string;
    bid: string;
    ask: string;
    mid: string;
    scienceTitle: string;
    scienceSteps: Array<{ label: string; note: string }>;
    resultTitle: string;
    resultNotes: string[];
  };
  securityAudits: {
    eyebrow: string;
    title: string;
    intro: string;
    selectorLabel: string;
    tiers: AuditDepthTier[];
    evidenceTitle: string;
    evidenceNote: string;
    comparisonTitle: string;
    comparison: AuditComparisonRow[];
    reportLabel: string;
    boundaryLabel: string;
    statusTitle: string;
    states: string[];
  };
  impactWhale: {
    eyebrow: string;
    title: string;
    intro: string;
    tabs: [string, string];
    impact: {
      title: string;
      intro: string;
      selectorLabel: string;
      scenarios: MarketImpactScenario[];
      depthTitle: string;
      bids: string;
      asks: string;
      venuesTitle: string;
      venueHeaders: [string, string, string, string];
      venues: Array<[string, string, string, string]>;
      note: string;
    };
    whale: {
      title: string;
      intro: string;
      selectorLabel: string;
      bands: WhaleBand[];
      transfersTitle: string;
      transfers: WhaleTransfer[];
      flowTitle: string;
      flowMetrics: FlagshipMetric[];
      evidenceTitle: string;
      evidence: string[];
      note: string;
    };
  };
};

const copy: Record<IntelligenceLocale, IntelligenceFlagshipCopy> = {
  en: {
    common: {
      demonstration: "Deterministic demonstration",
      illustrative: "Illustrative interface — not a live execution recommendation.",
      inspect: "Inspect depth",
    },
    liquidityLab: {
      eyebrow: "Signature liquidity laboratory",
      title: "See where an order meets the market.",
      intro: "A controlled view of book depth, expected slippage and exit pressure. Change the order and market regime to see how the same notional can produce a different outcome.",
      amountLabel: "Simulated order size",
      modeLabel: "Market regime",
      directionLabel: "Direction",
      directions: ["Buy", "Sell"],
      modes: [
        { id: "normal", label: "Normal depth", description: "Balanced layers with continuous liquidity." },
        { id: "stressed", label: "Stressed", description: "Wider spread and faster depth consumption." },
        { id: "thin", label: "Thin book", description: "Sparse layers expose nonlinear slippage." },
      ],
      experimentLabel: "Laboratory experiment",
      experiments: [
        { id: "depth", label: "Depth profile", description: "Observe how bid and ask layers gather around the midpoint." },
        { id: "slippage", label: "Slippage pour", description: "Follow an illustrative order as it consumes successive book layers." },
        { id: "concentration", label: "Concentration", description: "Reveal where apparently deep liquidity is clustered into fragile pockets." },
        { id: "flow", label: "Smart flow", description: "Trace directional pressure through the available depth without inferring intent." },
        { id: "exit", label: "Exit pressure", description: "Compare order size with the bounded path available for an exit." },
      ],
      metrics: {
        spread: "Effective spread",
        slippage: "Estimated slippage",
        impact: "Mid-price impact",
        consumed: "Liquidity consumed",
      },
      depthTitle: "Aggregated depth profile",
      bid: "Bid depth",
      ask: "Ask depth",
      mid: "Mid price",
      scienceTitle: "From notional to evidence",
      scienceSteps: [
        { label: "Sample depth", note: "Read available layers around the midpoint." },
        { label: "Route order", note: "Move the order through deterministic book levels." },
        { label: "Measure pressure", note: "Compare consumed depth, spread and displacement." },
        { label: "Qualify result", note: "Keep uncertainty visible beside the estimate." },
      ],
      resultTitle: "What the laboratory explains",
      resultNotes: [
        "The same order can be routine in one regime and destabilizing in another.",
        "Liquidity is a path through the book, not a single volume number.",
        "An estimate remains bounded by source quality and observed depth.",
      ],
    },
    securityAudits: {
      eyebrow: "Security audit depth",
      title: "Three review depths. One evidence discipline.",
      intro: "Security Audits are a separate investigative surface. Select a depth to see how permissions, authority context, findings and provenance expand without turning uncertainty into certainty.",
      selectorLabel: "Choose security audit depth",
      tiers: [
        {
          id: "basic",
          label: "Basic Audit",
          kicker: "Public-source prescreen",
          description: "A concise first pass for visible permissions, obvious red flags and missing-evidence boundaries.",
          capabilities: ["Core permission checks", "Initial red-flag detection", "Severity snapshot", "Confidence snapshot", "Concise report surface"],
          evidenceLanes: ["Contract", "Authority", "Public sources"],
          outcome: "A fast, source-aware prescreen with explicit limits.",
        },
        {
          id: "pro",
          label: "Pro Audit",
          kicker: "Expanded evidence review",
          description: "A broader review of contract authority, structured findings and traceable evidence relationships.",
          capabilities: ["Expanded permission map", "Authority context", "Structured findings", "Broader evidence review", "Deeper report receipts"],
          evidenceLanes: ["Contract", "Authority", "Liquidity", "Holders", "Sources"],
          outcome: "A deeper technical view with stronger finding-to-source traceability.",
        },
        {
          id: "advanced",
          label: "Advanced Audit",
          kicker: "Investigation-grade surface",
          description: "The deepest configured path for provenance, anomaly context and review-required escalation.",
          capabilities: ["Advanced anomaly lanes", "Richer provenance", "Cross-context review", "Review-required path", "Strongest report depth"],
          evidenceLanes: ["Contract", "Authority", "Liquidity", "Holders", "Anomalies", "Manual QA"],
          outcome: "The broadest evidence surface, with escalation when the data cannot support closure.",
        },
      ],
      evidenceTitle: "Evidence map",
      evidenceNote: "The diagram illustrates review scope; it does not imply that every source is available for every asset.",
      comparisonTitle: "What changes with depth",
      comparison: [
        { label: "Permission review", basic: "Core", pro: "Expanded", advanced: "Deep context" },
        { label: "Authority mapping", basic: "Visible roles", pro: "Role graph", advanced: "Role + escalation" },
        { label: "Finding structure", basic: "Snapshot", pro: "Structured", advanced: "Investigation-grade" },
        { label: "Evidence provenance", basic: "Source list", pro: "Traceable", advanced: "Cross-context" },
        { label: "Review-required logic", basic: "Boundary", pro: "Flagged", advanced: "Escalation path" },
        { label: "Report depth", basic: "Concise", pro: "Expanded", advanced: "Deepest configured" },
      ],
      reportLabel: "Report surface",
      boundaryLabel: "Evidence boundary",
      statusTitle: "Bounded review states",
      states: ["Evidence collecting", "Automated review", "Review required", "Reviewer pending", "Approved", "Delivery ready", "Blocked"],
    },
    impactWhale: {
      eyebrow: "Execution and concentration intelligence",
      title: "Price is only the visible edge.",
      intro: "Market Impact explains the path through liquidity. Whale Watch adds concentration and large-wallet context. Together they show how structure can amplify an otherwise ordinary move.",
      tabs: ["Market Impact", "Whale Watch"],
      impact: {
        title: "Execution pressure simulator",
        intro: "Select a deterministic scenario to compare depth consumed, estimated displacement and venue conditions.",
        selectorLabel: "Choose market impact scenario",
        scenarios: [
          { id: "measured", label: "Measured order", amount: "1.0M", depth: "1.2%", impact: "−0.05%", slippage: "5.2 bps", risk: "Low" },
          { id: "large", label: "Large order", amount: "10.0M", depth: "8.7%", impact: "−0.42%", slippage: "44.0 bps", risk: "Moderate" },
          { id: "stress", label: "Stress order", amount: "50.0M", depth: "43.3%", impact: "−1.93%", slippage: "212.1 bps", risk: "High" },
        ],
        depthTitle: "Depth profile",
        bids: "Bids",
        asks: "Asks",
        venuesTitle: "Illustrative venue comparison",
        venueHeaders: ["Venue", "Available depth", "Est. impact", "Condition"],
        venues: [
          ["Venue A", "42.6M", "−0.36%", "Balanced"],
          ["Venue B", "28.1M", "−0.48%", "Moderate"],
          ["Venue C", "18.7M", "−0.67%", "Stressed"],
        ],
        note: "Scenario values are fixed product demonstrations, not live liquidity or an execution recommendation.",
      },
      whale: {
        title: "Concentration and transfer context",
        intro: "Explore how holder concentration and large transfers can change the interpretation of market pressure.",
        selectorLabel: "Choose holder concentration band",
        bands: [
          { id: "top10", label: "Top 10 wallets", concentration: "24.38%", delta: "+0.72% / 7d", interpretation: "A narrow group can materially influence near-term supply." },
          { id: "top50", label: "Top 50 wallets", concentration: "41.67%", delta: "+1.31% / 7d", interpretation: "Concentration is rising across the largest holder cohort." },
          { id: "top100", label: "Top 100 wallets", concentration: "54.92%", delta: "+1.85% / 7d", interpretation: "More than half of illustrated supply sits inside the tracked cohort." },
        ],
        transfersTitle: "Illustrative large transfers",
        transfers: [
          { from: "0xA1b2…C9F8", to: "0x7dE4…9B12", amount: "12,450", age: "2h" },
          { from: "0x6F3a…8D77", to: "0xC2b4…E1F0", amount: "7,860", age: "4h" },
          { from: "0x9B7e…3A21", to: "0x3cD1…A6B9", amount: "5,250", age: "6h" },
        ],
        flowTitle: "24h flow context",
        flowMetrics: [
          { label: "Net flow", value: "+28.5K", note: "Illustrative units" },
          { label: "Inflow", value: "89.1K", note: "Illustrative units" },
          { label: "Outflow", value: "60.6K", note: "Illustrative units" },
          { label: "Active transfers", value: "284", note: "Demonstration count" },
        ],
        evidenceTitle: "Evidence and interpretation",
        evidence: ["Concentration trend", "Exchange-directed flow", "Large-wallet movement", "Source freshness boundary"],
        note: "Wallet examples are synthetic and shown only to explain the product interaction.",
      },
    },
  },
  pl: {
    common: {
      demonstration: "Deterministyczna demonstracja",
      illustrative: "Interfejs poglądowy — nie jest rekomendacją wykonania transakcji.",
      inspect: "Sprawdź głębokość",
    },
    liquidityLab: {
      eyebrow: "Sygnaturowe laboratorium płynności",
      title: "Zobacz, gdzie zlecenie spotyka rynek.",
      intro: "Kontrolowany obraz głębokości, oczekiwanego poślizgu i presji wyjścia. Zmień wielkość zlecenia oraz reżim rynku, aby zobaczyć, dlaczego ten sam nominał może dawać zupełnie inny wynik.",
      amountLabel: "Symulowana wielkość zlecenia",
      modeLabel: "Reżim rynku",
      directionLabel: "Kierunek",
      directions: ["Kupno", "Sprzedaż"],
      modes: [
        { id: "normal", label: "Normalna głębokość", description: "Zrównoważone warstwy i ciągła płynność." },
        { id: "stressed", label: "Napięty rynek", description: "Szerszy spread i szybsze zużycie głębokości." },
        { id: "thin", label: "Cienki arkusz", description: "Rzadkie warstwy ujawniają nieliniowy poślizg." },
      ],
      experimentLabel: "Eksperyment laboratoryjny",
      experiments: [
        { id: "depth", label: "Profil głębokości", description: "Obserwuj, jak warstwy bid i ask gromadzą się wokół ceny środkowej." },
        { id: "slippage", label: "Przepływ poślizgu", description: "Śledź ilustracyjne zlecenie zużywające kolejne warstwy arkusza." },
        { id: "concentration", label: "Koncentracja", description: "Ujawnij, gdzie pozornie głęboka płynność skupia się w kruchych kieszeniach." },
        { id: "flow", label: "Smart flow", description: "Śledź kierunkową presję w dostępnej głębokości bez przypisywania intencji." },
        { id: "exit", label: "Presja wyjścia", description: "Porównaj wielkość zlecenia z ograniczoną ścieżką dostępną do wyjścia." },
      ],
      metrics: {
        spread: "Efektywny spread",
        slippage: "Szacowany poślizg",
        impact: "Wpływ na cenę mid",
        consumed: "Zużyta płynność",
      },
      depthTitle: "Zagregowany profil głębokości",
      bid: "Głębokość bid",
      ask: "Głębokość ask",
      mid: "Cena mid",
      scienceTitle: "Od nominału do dowodu",
      scienceSteps: [
        { label: "Próbkuj głębokość", note: "Odczytaj warstwy dostępne wokół ceny środkowej." },
        { label: "Poprowadź zlecenie", note: "Przeprowadź zlecenie przez deterministyczne poziomy." },
        { label: "Zmierz presję", note: "Porównaj zużytą głębokość, spread i przesunięcie." },
        { label: "Określ wynik", note: "Pozostaw niepewność widoczną obok estymacji." },
      ],
      resultTitle: "Co wyjaśnia laboratorium",
      resultNotes: [
        "To samo zlecenie może być rutynowe w jednym reżimie i destabilizujące w drugim.",
        "Płynność to ścieżka przez arkusz, a nie pojedyncza liczba wolumenu.",
        "Estymację zawsze ogranicza jakość źródeł i obserwowana głębokość.",
      ],
    },
    securityAudits: {
      eyebrow: "Głębokość audytu bezpieczeństwa",
      title: "Trzy poziomy przeglądu. Jedna dyscyplina dowodowa.",
      intro: "Security Audits to osobna powierzchnia dochodzeniowa. Wybierz głębokość, aby zobaczyć, jak rozwijają się uprawnienia, kontekst władzy, ustalenia i proweniencja — bez zamieniania niepewności w pewność.",
      selectorLabel: "Wybierz głębokość audytu bezpieczeństwa",
      tiers: [
        {
          id: "basic",
          label: "Audyt Basic",
          kicker: "Prescreen źródeł publicznych",
          description: "Zwięzły pierwszy przegląd widocznych uprawnień, oczywistych sygnałów ostrzegawczych i granic brakujących dowodów.",
          capabilities: ["Podstawowe kontrole uprawnień", "Wstępne czerwone flagi", "Migawka severity", "Migawka confidence", "Zwięzły raport"],
          evidenceLanes: ["Kontrakt", "Uprawnienia", "Źródła publiczne"],
          outcome: "Szybki prescreen z jawnymi ograniczeniami źródeł.",
        },
        {
          id: "pro",
          label: "Audyt Pro",
          kicker: "Rozszerzony przegląd dowodów",
          description: "Szerszy przegląd władzy kontraktowej, ustrukturyzowanych ustaleń oraz relacji pomiędzy dowodami.",
          capabilities: ["Rozszerzona mapa uprawnień", "Kontekst authority", "Ustrukturyzowane findings", "Szerszy przegląd dowodów", "Głębsze receipts raportu"],
          evidenceLanes: ["Kontrakt", "Uprawnienia", "Płynność", "Holderzy", "Źródła"],
          outcome: "Głębszy widok techniczny z mocniejszą ścieżką ustalenie–źródło.",
        },
        {
          id: "advanced",
          label: "Audyt Advanced",
          kicker: "Powierzchnia dochodzeniowa",
          description: "Najgłębsza skonfigurowana ścieżka proweniencji, kontekstu anomalii i eskalacji wymagającej przeglądu.",
          capabilities: ["Zaawansowane pasma anomalii", "Bogatsza proweniencja", "Przegląd cross-context", "Ścieżka review-required", "Najgłębszy raport"],
          evidenceLanes: ["Kontrakt", "Uprawnienia", "Płynność", "Holderzy", "Anomalie", "Przegląd człowieka"],
          outcome: "Najszersza powierzchnia dowodowa z eskalacją, gdy dane nie wystarczają do zamknięcia sprawy.",
        },
      ],
      evidenceTitle: "Mapa dowodów",
      evidenceNote: "Diagram pokazuje zakres przeglądu; nie oznacza dostępności każdego źródła dla każdego aktywa.",
      comparisonTitle: "Co zmienia się wraz z głębokością",
      comparison: [
        { label: "Przegląd uprawnień", basic: "Podstawowy", pro: "Rozszerzony", advanced: "Głęboki kontekst" },
        { label: "Mapa authority", basic: "Widoczne role", pro: "Graf ról", advanced: "Role + eskalacja" },
        { label: "Struktura ustaleń", basic: "Migawka", pro: "Ustrukturyzowana", advanced: "Dochodzeniowa" },
        { label: "Proweniencja dowodów", basic: "Lista źródeł", pro: "Traceable", advanced: "Cross-context" },
        { label: "Logika review-required", basic: "Granica", pro: "Oznaczona", advanced: "Ścieżka eskalacji" },
        { label: "Głębokość raportu", basic: "Zwięzła", pro: "Rozszerzona", advanced: "Najgłębsza skonfigurowana" },
      ],
      reportLabel: "Powierzchnia raportu",
      boundaryLabel: "Granica dowodowa",
      statusTitle: "Ograniczone stany przeglądu",
      states: ["Zbieranie dowodów", "Przegląd automatyczny", "Wymagany przegląd", "Oczekiwanie na reviewera", "Zatwierdzono", "Gotowe do dostawy", "Zablokowano"],
    },
    impactWhale: {
      eyebrow: "Inteligencja wykonania i koncentracji",
      title: "Cena to tylko widoczna krawędź.",
      intro: "Market Impact wyjaśnia drogę przez płynność. Whale Watch dodaje kontekst koncentracji i dużych portfeli. Razem pokazują, jak struktura może wzmocnić pozornie zwykły ruch.",
      tabs: ["Market Impact", "Whale Watch"],
      impact: {
        title: "Symulator presji wykonania",
        intro: "Wybierz deterministyczny scenariusz i porównaj zużytą głębokość, szacowane przesunięcie i warunki venue.",
        selectorLabel: "Wybierz scenariusz wpływu na rynek",
        scenarios: [
          { id: "measured", label: "Kontrolowane zlecenie", amount: "1,0 mln", depth: "1,2%", impact: "−0,05%", slippage: "5,2 bps", risk: "Niskie" },
          { id: "large", label: "Duże zlecenie", amount: "10,0 mln", depth: "8,7%", impact: "−0,42%", slippage: "44,0 bps", risk: "Umiarkowane" },
          { id: "stress", label: "Zlecenie stresowe", amount: "50,0 mln", depth: "43,3%", impact: "−1,93%", slippage: "212,1 bps", risk: "Wysokie" },
        ],
        depthTitle: "Profil głębokości",
        bids: "Bids",
        asks: "Asks",
        venuesTitle: "Poglądowe porównanie venue",
        venueHeaders: ["Venue", "Dostępna głębokość", "Szac. wpływ", "Warunek"],
        venues: [
          ["Venue A", "42,6 mln", "−0,36%", "Zrównoważone"],
          ["Venue B", "28,1 mln", "−0,48%", "Umiarkowane"],
          ["Venue C", "18,7 mln", "−0,67%", "Napięte"],
        ],
        note: "Wartości są stałą demonstracją produktu, a nie bieżącą płynnością ani rekomendacją wykonania.",
      },
      whale: {
        title: "Kontekst koncentracji i transferów",
        intro: "Sprawdź, jak koncentracja holderów i duże transfery mogą zmieniać interpretację presji rynkowej.",
        selectorLabel: "Wybierz pasmo koncentracji holderów",
        bands: [
          { id: "top10", label: "Top 10 portfeli", concentration: "24,38%", delta: "+0,72% / 7d", interpretation: "Wąska grupa może istotnie wpływać na krótkoterminową podaż." },
          { id: "top50", label: "Top 50 portfeli", concentration: "41,67%", delta: "+1,31% / 7d", interpretation: "Koncentracja rośnie w największej kohorcie holderów." },
          { id: "top100", label: "Top 100 portfeli", concentration: "54,92%", delta: "+1,85% / 7d", interpretation: "Ponad połowa poglądowej podaży znajduje się w śledzonej kohorcie." },
        ],
        transfersTitle: "Poglądowe duże transfery",
        transfers: [
          { from: "0xA1b2…C9F8", to: "0x7dE4…9B12", amount: "12 450", age: "2h" },
          { from: "0x6F3a…8D77", to: "0xC2b4…E1F0", amount: "7 860", age: "4h" },
          { from: "0x9B7e…3A21", to: "0x3cD1…A6B9", amount: "5 250", age: "6h" },
        ],
        flowTitle: "Kontekst przepływu 24h",
        flowMetrics: [
          { label: "Net flow", value: "+28,5K", note: "Jednostki poglądowe" },
          { label: "Inflow", value: "89,1K", note: "Jednostki poglądowe" },
          { label: "Outflow", value: "60,6K", note: "Jednostki poglądowe" },
          { label: "Aktywne transfery", value: "284", note: "Liczba demonstracyjna" },
        ],
        evidenceTitle: "Dowody i interpretacja",
        evidence: ["Trend koncentracji", "Przepływ w kierunku giełd", "Ruch dużych portfeli", "Granica świeżości źródeł"],
        note: "Przykłady portfeli są syntetyczne i służą wyłącznie pokazaniu interakcji produktu.",
      },
    },
  },
  de: {
    common: {
      demonstration: "Deterministische Demonstration",
      illustrative: "Illustrative Oberfläche — keine Ausführungsempfehlung.",
      inspect: "Tiefe prüfen",
    },
    liquidityLab: {
      eyebrow: "Signatur-Liquiditätslabor",
      title: "Sehen Sie, wo eine Order auf den Markt trifft.",
      intro: "Eine kontrollierte Ansicht von Orderbuchtiefe, erwartetem Slippage und Exit-Druck. Ändern Sie Ordergröße und Marktregime, um zu sehen, warum derselbe Nominalwert zu einem anderen Ergebnis führen kann.",
      amountLabel: "Simulierte Ordergröße",
      modeLabel: "Marktregime",
      directionLabel: "Richtung",
      directions: ["Kauf", "Verkauf"],
      modes: [
        { id: "normal", label: "Normale Tiefe", description: "Ausgewogene Schichten mit kontinuierlicher Liquidität." },
        { id: "stressed", label: "Angespannt", description: "Breiterer Spread und schnellerer Tiefenverbrauch." },
        { id: "thin", label: "Dünnes Orderbuch", description: "Lückenhafte Schichten zeigen nichtlineares Slippage." },
      ],
      experimentLabel: "Laborexperiment",
      experiments: [
        { id: "depth", label: "Tiefenprofil", description: "Beobachten Sie, wie Bid- und Ask-Schichten den Mittelpunkt umgeben." },
        { id: "slippage", label: "Slippage-Fluss", description: "Verfolgen Sie eine illustrative Order durch aufeinanderfolgende Buchschichten." },
        { id: "concentration", label: "Konzentration", description: "Zeigen Sie, wo scheinbare Tiefe in fragilen Taschen konzentriert ist." },
        { id: "flow", label: "Smart Flow", description: "Verfolgen Sie Richtungsdruck durch verfügbare Tiefe, ohne Absicht zu unterstellen." },
        { id: "exit", label: "Exit-Druck", description: "Vergleichen Sie Ordergröße mit dem begrenzten Pfad für einen Ausstieg." },
      ],
      metrics: {
        spread: "Effektiver Spread",
        slippage: "Geschätztes Slippage",
        impact: "Mid-Price-Impact",
        consumed: "Verbrauchte Liquidität",
      },
      depthTitle: "Aggregiertes Tiefenprofil",
      bid: "Bid-Tiefe",
      ask: "Ask-Tiefe",
      mid: "Mid-Preis",
      scienceTitle: "Vom Nominalwert zum Beleg",
      scienceSteps: [
        { label: "Tiefe erfassen", note: "Verfügbare Schichten um den Mittelpunkt lesen." },
        { label: "Order routen", note: "Die Order durch deterministische Buchstufen führen." },
        { label: "Druck messen", note: "Verbrauchte Tiefe, Spread und Verschiebung vergleichen." },
        { label: "Ergebnis qualifizieren", note: "Unsicherheit neben der Schätzung sichtbar halten." },
      ],
      resultTitle: "Was das Labor erklärt",
      resultNotes: [
        "Dieselbe Order kann in einem Regime normal und in einem anderen destabilisierend sein.",
        "Liquidität ist ein Pfad durch das Orderbuch, keine einzelne Volumenzahl.",
        "Jede Schätzung bleibt durch Quellenqualität und beobachtete Tiefe begrenzt.",
      ],
    },
    securityAudits: {
      eyebrow: "Tiefe der Sicherheitsaudits",
      title: "Drei Prüftiefen. Eine Evidenzdisziplin.",
      intro: "Security Audits sind eine eigenständige Untersuchungsoberfläche. Wählen Sie eine Tiefe und sehen Sie, wie Berechtigungen, Authority-Kontext, Findings und Provenienz wachsen — ohne Unsicherheit als Gewissheit darzustellen.",
      selectorLabel: "Tiefe des Sicherheitsaudits wählen",
      tiers: [
        {
          id: "basic",
          label: "Basic Audit",
          kicker: "Public-Source-Prescreen",
          description: "Ein kompakter erster Blick auf sichtbare Berechtigungen, offensichtliche Warnsignale und Evidenzgrenzen.",
          capabilities: ["Kernprüfungen der Berechtigungen", "Erste Warnsignale", "Severity-Snapshot", "Confidence-Snapshot", "Kompakte Berichtsebene"],
          evidenceLanes: ["Contract", "Authority", "Öffentliche Quellen"],
          outcome: "Ein schneller, quellenbewusster Prescreen mit klaren Grenzen.",
        },
        {
          id: "pro",
          label: "Pro Audit",
          kicker: "Erweiterte Evidenzprüfung",
          description: "Eine breitere Prüfung von Contract-Authority, strukturierten Findings und nachvollziehbaren Evidenzbeziehungen.",
          capabilities: ["Erweiterte Permission Map", "Authority-Kontext", "Strukturierte Findings", "Breitere Evidenzprüfung", "Tiefere Report-Receipts"],
          evidenceLanes: ["Contract", "Authority", "Liquidität", "Holder", "Quellen"],
          outcome: "Eine tiefere technische Sicht mit stärkerer Finding-zu-Quelle-Nachvollziehbarkeit.",
        },
        {
          id: "advanced",
          label: "Advanced Audit",
          kicker: "Investigation-Grade-Oberfläche",
          description: "Der tiefste konfigurierte Pfad für Provenienz, Anomaliekontext und Review-required-Eskalation.",
          capabilities: ["Erweiterte Anomalie-Lanes", "Reichere Provenienz", "Cross-Context-Review", "Review-required-Pfad", "Tiefste Berichtsebene"],
          evidenceLanes: ["Contract", "Authority", "Liquidität", "Holder", "Anomalien", "Manual QA"],
          outcome: "Die breiteste Evidenzoberfläche mit Eskalation, wenn Daten keinen Abschluss tragen.",
        },
      ],
      evidenceTitle: "Evidenzkarte",
      evidenceNote: "Das Diagramm zeigt den Prüfumfang; es behauptet nicht, dass jede Quelle für jedes Asset verfügbar ist.",
      comparisonTitle: "Was sich mit der Tiefe ändert",
      comparison: [
        { label: "Berechtigungsprüfung", basic: "Kern", pro: "Erweitert", advanced: "Tiefer Kontext" },
        { label: "Authority Mapping", basic: "Sichtbare Rollen", pro: "Rollengraph", advanced: "Rollen + Eskalation" },
        { label: "Finding-Struktur", basic: "Snapshot", pro: "Strukturiert", advanced: "Investigation-grade" },
        { label: "Evidenz-Provenienz", basic: "Quellenliste", pro: "Nachvollziehbar", advanced: "Cross-context" },
        { label: "Review-required-Logik", basic: "Grenze", pro: "Markiert", advanced: "Eskalationspfad" },
        { label: "Berichtstiefe", basic: "Kompakt", pro: "Erweitert", advanced: "Tiefste konfigurierte" },
      ],
      reportLabel: "Berichtsoberfläche",
      boundaryLabel: "Evidenzgrenze",
      statusTitle: "Begrenzte Prüfzustände",
      states: ["Evidenz wird gesammelt", "Automatisierte Prüfung", "Prüfung erforderlich", "Reviewer ausstehend", "Freigegeben", "Zustellbereit", "Blockiert"],
    },
    impactWhale: {
      eyebrow: "Execution- und Konzentrationsintelligenz",
      title: "Der Preis ist nur die sichtbare Kante.",
      intro: "Market Impact erklärt den Weg durch die Liquidität. Whale Watch ergänzt Konzentrations- und Large-Wallet-Kontext. Zusammen zeigen sie, wie Struktur eine gewöhnliche Bewegung verstärken kann.",
      tabs: ["Market Impact", "Whale Watch"],
      impact: {
        title: "Simulator für Ausführungsdruck",
        intro: "Wählen Sie ein deterministisches Szenario und vergleichen Sie Tiefenverbrauch, geschätzte Verschiebung und Venue-Bedingungen.",
        selectorLabel: "Market-Impact-Szenario wählen",
        scenarios: [
          { id: "measured", label: "Kontrollierte Order", amount: "1,0 Mio.", depth: "1,2%", impact: "−0,05%", slippage: "5,2 bps", risk: "Niedrig" },
          { id: "large", label: "Große Order", amount: "10,0 Mio.", depth: "8,7%", impact: "−0,42%", slippage: "44,0 bps", risk: "Moderat" },
          { id: "stress", label: "Stress-Order", amount: "50,0 Mio.", depth: "43,3%", impact: "−1,93%", slippage: "212,1 bps", risk: "Hoch" },
        ],
        depthTitle: "Tiefenprofil",
        bids: "Bids",
        asks: "Asks",
        venuesTitle: "Illustrativer Venue-Vergleich",
        venueHeaders: ["Venue", "Verfügbare Tiefe", "Gesch. Impact", "Zustand"],
        venues: [
          ["Venue A", "42,6 Mio.", "−0,36%", "Ausgewogen"],
          ["Venue B", "28,1 Mio.", "−0,48%", "Moderat"],
          ["Venue C", "18,7 Mio.", "−0,67%", "Angespannt"],
        ],
        note: "Die Werte sind feste Produktdemonstrationen, keine Live-Liquidität und keine Ausführungsempfehlung.",
      },
      whale: {
        title: "Konzentrations- und Transferkontext",
        intro: "Sehen Sie, wie Holder-Konzentration und große Transfers die Interpretation von Marktdruck verändern können.",
        selectorLabel: "Holder-Konzentrationsband wählen",
        bands: [
          { id: "top10", label: "Top 10 Wallets", concentration: "24,38%", delta: "+0,72% / 7T", interpretation: "Eine enge Gruppe kann das kurzfristige Angebot wesentlich beeinflussen." },
          { id: "top50", label: "Top 50 Wallets", concentration: "41,67%", delta: "+1,31% / 7T", interpretation: "Die Konzentration steigt in der größten Holder-Kohorte." },
          { id: "top100", label: "Top 100 Wallets", concentration: "54,92%", delta: "+1,85% / 7T", interpretation: "Mehr als die Hälfte des illustrativen Angebots liegt in der beobachteten Kohorte." },
        ],
        transfersTitle: "Illustrative große Transfers",
        transfers: [
          { from: "0xA1b2…C9F8", to: "0x7dE4…9B12", amount: "12.450", age: "2h" },
          { from: "0x6F3a…8D77", to: "0xC2b4…E1F0", amount: "7.860", age: "4h" },
          { from: "0x9B7e…3A21", to: "0x3cD1…A6B9", amount: "5.250", age: "6h" },
        ],
        flowTitle: "24h-Flow-Kontext",
        flowMetrics: [
          { label: "Net flow", value: "+28,5K", note: "Illustrative Einheiten" },
          { label: "Inflow", value: "89,1K", note: "Illustrative Einheiten" },
          { label: "Outflow", value: "60,6K", note: "Illustrative Einheiten" },
          { label: "Aktive Transfers", value: "284", note: "Demonstrationszahl" },
        ],
        evidenceTitle: "Evidenz und Interpretation",
        evidence: ["Konzentrationstrend", "Börsengerichteter Flow", "Large-Wallet-Bewegung", "Grenze der Quellenfrische"],
        note: "Die Wallet-Beispiele sind synthetisch und dienen nur zur Erklärung der Produktinteraktion.",
      },
    },
  },
};

export function getIntelligenceFlagshipCopy(locale: IntelligenceLocale): IntelligenceFlagshipCopy {
  return copy[locale];
}
