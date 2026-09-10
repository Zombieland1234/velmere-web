export type IntelligenceLocale = "en" | "pl" | "de";

export type IntelligenceLane = {
  id: string;
  label: string;
  signal: string;
  description: string;
  evidence: string;
};

export type IntelligenceContent = {
  locale: IntelligenceLocale;
  hero: {
    eyebrow: string;
    title: string;
    intro: string;
    primary: string;
    secondary: string;
    legend: [string, string, string];
    proofLine: [string, string, string];
  };
  comparison: {
    eyebrow: string;
    title: string;
    intro: string;
    columns: Array<{ title: string; items: string[] }>;
  };
  engine: {
    eyebrow: string;
    title: string;
    intro: string;
    instruction: string;
    evidenceLabel: string;
    lanes: IntelligenceLane[];
  };
  triad: {
    eyebrow: string;
    title: string;
    intro: string;
    risk: { label: string; description: string };
    confidence: { label: string; description: string };
    uncertainty: { label: string; description: string };
    demoLabel: string;
    demoTitle: string;
    completeness: string;
    missing: string;
    demoNote: string;
  };
  pipeline: {
    eyebrow: string;
    title: string;
    intro: string;
    stages: string[];
    outcomes: string[];
  };
  products: {
    eyebrow: string;
    title: string;
    intro: string;
    items: Array<{ id: string; title: string; kicker: string; description: string; cta: string; href: string }>;
  };
  tiers: {
    eyebrow: string;
    title: string;
    intro: string;
    marketTab: string;
    auditTab: string;
    recommended: string;
    free: string;
    signalsLabel: string;
    capabilitiesLabel: string;
    marketFeatures: Record<"basic" | "pro" | "advanced", string[]>;
    auditFeatures: Record<"basic" | "pro" | "advanced", string[]>;
    auditNames: Record<"basic" | "pro" | "advanced", string>;
    note: string;
  };
  experience: {
    eyebrow: string;
    title: string;
    intro: string;
    moments: Array<{ title: string; description: string }>;
  };
  boundary: {
    eyebrow: string;
    title: string;
    intro: string;
    publicTitle: string;
    publicItems: string[];
    privateTitle: string;
    privateItems: string[];
    redacted: string;
  };
  proof: {
    eyebrow: string;
    title: string;
    intro: string;
    statuses: { engineered: string; sourceBound: string; pending: string };
    publication: string;
    receipt: string;
    note: string;
    architectureTitle: string;
    architecture: string[];
  };
  finalCta: {
    eyebrow: string;
    title: string;
    description: string;
    primary: string;
    secondary: string;
  };
};

const en: IntelligenceContent = {
  locale: "en",
  hero: {
    eyebrow: "VELMÈRE INTELLIGENCE",
    title: "Risk is not a number. It is an evidence system.",
    intro:
      "Velmère connects market structure, liquidity, provenance and missing evidence into one legible decision surface — without pretending uncertainty does not exist.",
    primary: "Explore the system",
    secondary: "Open Shield",
    legend: ["Risk", "Confidence", "Evidence"],
    proofLine: ["Source-aware", "Asset-routed", "Confidence-capped"],
  },
  comparison: {
    eyebrow: "BEYOND A SCORE",
    title: "Not another score generator.",
    intro:
      "A single number compresses complexity. Intelligence preserves the evidence path that produced it.",
    columns: [
      { title: "Traditional surface", items: ["One score", "Opaque inputs", "False precision"] },
      { title: "Velmère intelligence", items: ["Asset-aware lanes", "Freshness and provenance", "Confidence caps"] },
      { title: "Decision surface", items: ["Readable verdict", "Visible evidence gaps", "Traceable output"] },
    ],
  },
  engine: {
    eyebrow: "THE RISK ENGINE",
    title: "How the engine thinks.",
    intro:
      "Eight analytical lanes converge on the same evidence core. Select a lane to inspect its signal, reasoning and proof boundary.",
    instruction: "Select or scroll through the analytical lanes",
    evidenceLabel: "Evidence boundary",
    lanes: [
      { id: "velocity", label: "Velocity & Repricing", signal: "Price response", description: "Measures how quickly the asset reprices and whether moves are orderly or discontinuous.", evidence: "Returns, ranges, gaps and time-aligned price observations." },
      { id: "liquidity", label: "Liquidity & Exit Depth", signal: "Exit capacity", description: "Tests whether displayed size can absorb execution without disproportionate price impact.", evidence: "Depth, spread, volume and venue-specific liquidity observations." },
      { id: "microstructure", label: "Market Microstructure", signal: "Trading quality", description: "Reads spread behavior, fragmentation, imbalance and short-horizon execution conditions.", evidence: "Order-book or venue observations only when the source supports them." },
      { id: "supply", label: "Supply, Float & Unlocks", signal: "Supply pressure", description: "Maps circulating supply, known emissions and unlock pressure without treating estimates as settled fact.", evidence: "Source-attributed supply records and explicitly dated schedules." },
      { id: "holders", label: "Holders & Concentration", signal: "Concentration", description: "Separates broad ownership from concentration that can amplify liquidity or governance risk.", evidence: "On-chain or filing-derived holder data with scope disclosed." },
      { id: "contract", label: "Contract & Permissions", signal: "Control surface", description: "Inspects upgradeability, privileged roles and permissions that can change the asset's behavior.", evidence: "Verified code, contract metadata and explicit permission traces." },
      { id: "evidence", label: "Evidence, Provenance & Freshness", signal: "Proof quality", description: "Caps confidence when sources are stale, conflicting, incomplete or unavailable.", evidence: "Source identity, timestamps, receipts and contradiction state." },
      { id: "context", label: "Asset-Specific Context", signal: "Correct model", description: "Routes a token, equity, ETF or index through the relevant model instead of one universal formula.", evidence: "Asset family, venue, jurisdiction and instrument structure." },
    ],
  },
  triad: {
    eyebrow: "A THREE-PART VERDICT",
    title: "Risk, confidence and uncertainty are different signals.",
    intro: "The interface keeps them separate so a confident risk view cannot be confused with incomplete evidence.",
    risk: { label: "Risk", description: "Estimated exposure under the available evidence." },
    confidence: { label: "Confidence", description: "How strongly the current evidence supports the verdict." },
    uncertainty: { label: "Uncertainty", description: "What remains missing, stale or contradictory." },
    demoLabel: "METHODOLOGY DEMONSTRATION",
    demoTitle: "Remove evidence. Watch confidence change.",
    completeness: "Evidence completeness",
    missing: "Missing evidence",
    demoNote: "Illustrative mechanics only — not a live asset assessment.",
  },
  pipeline: {
    eyebrow: "INTELLIGENCE PIPELINE",
    title: "Every output has a path.",
    intro: "The pipeline can deliver a result, reduce certainty, redact private internals or block an unsupported claim.",
    stages: ["Collect", "Normalize", "Verify freshness", "Classify asset", "Map evidence", "Score lanes", "Corroborate & cap", "Deliver or block"],
    outcomes: ["Deliver", "Redact", "Downgrade", "Block"],
  },
  products: {
    eyebrow: "PRODUCT SURFACES",
    title: "One intelligence language. Four distinct surfaces.",
    intro: "Each product reveals the same evidence discipline at a different depth and for a different job.",
    items: [
      { id: "shield", title: "Shield", kicker: "MARKET INTEGRITY", description: "Crypto and stablecoin intelligence with source-aware risk, liquidity and anomaly context.", cta: "Open Shield", href: "/market-integrity" },
      { id: "markets", title: "Real Markets", kicker: "CROSS-ASSET CONTEXT", description: "A unified surface for equities, ETFs, indices and other market instruments.", cta: "Open Real Markets", href: "/real-markets" },
      { id: "pro", title: "Shield Pro", kicker: "MONOCHROME TERMINAL", description: "A denser evidence terminal for comparing market conditions across a monitored universe.", cta: "Open Shield Pro", href: "/shield-pro" },
      { id: "audit", title: "Security Audits", kicker: "EVIDENCE REVIEW", description: "Automated prescreening and evidence analysis for contracts, permissions and evidence gaps.", cta: "Explore audits", href: "/security/audits" },
    ],
  },
  tiers: {
    eyebrow: "DEPTH, NOT HYPE",
    title: "Basic, Pro and Advanced reveal more evidence — not louder promises.",
    intro: "The page reads the existing Velmère tier policy, including current signal counts and prices.",
    marketTab: "Market intelligence",
    auditTab: "Security audits",
    recommended: "Recommended",
    free: "Free",
    signalsLabel: "signals",
    capabilitiesLabel: "capabilities",
    marketFeatures: {
      basic: [
        "10-signal public result",
        "Core asset identity and market context",
        "Risk, confidence and uncertainty summary",
        "Primary drivers and public-source coverage",
        "Missing-data visibility",
        "Limited PDF preview",
      ],
      pro: [
        "14-signal analysis",
        "Everything in Basic",
        "Deeper liquidity and market structure",
        "Source freshness and provider comparison",
        "Evidence assembly and full report",
        "PDF export with server-verified access",
      ],
      advanced: [
        "20-signal analysis",
        "Everything in Pro",
        "Advanced integrity and anomaly lanes",
        "Market Impact and Whale Watch",
        "Scenario analysis and provider disagreement",
        "Missing-proof ledger and review-required state",
        "Deepest configured report and PDF",
      ],
    },
    auditFeatures: {
      basic: ["Automated prescreen", "Contract and confidence scan", "Public summary"],
      pro: ["Deep evidence review", "Permissions and liquidity context", "Expanded report"],
      advanced: ["Human analyst verification", "Priority evidence review", "Private report"],
    },
    auditNames: { basic: "Automated prescreen", pro: "Deep evidence review", advanced: "Investigation-grade review" },
    note: "Paid access is unlocked by a verified server-side entitlement. Connecting a wallet alone is not proof of payment.",
  },
  experience: {
    eyebrow: "EXPERIENCE AS EVIDENCE",
    title: "Complexity can feel calm.",
    intro: "Velmère stages information in the order a careful analyst would ask for it — signal, reason, source, gap and action.",
    moments: [
      { title: "Orient", description: "Understand the asset and source state before reading a verdict." },
      { title: "Interrogate", description: "Move from the summary into the analytical lane that changed the result." },
      { title: "Verify", description: "Inspect source identity, freshness and missing evidence without leaving the surface." },
      { title: "Challenge", description: "Test the result against missing evidence, uncertainty and conflicting observations." },
      { title: "Decide responsibly", description: "Use a bounded, traceable output rather than an unsupported instruction." },
    ],
  },
  boundary: {
    eyebrow: "VISIBLE METHOD, PROTECTED CORE",
    title: "Transparent enough to verify. Private enough to defend.",
    intro: "We publish how the evidence system behaves without exposing operational logic that would make it easier to game.",
    publicTitle: "Public methodology",
    publicItems: ["Risk lane taxonomy", "Confidence and uncertainty rules", "Source and freshness expectations", "Tier boundaries and prices"],
    privateTitle: "Private core",
    privateItems: ["Exact model weights", "Abuse and manipulation defenses", "Private source routing", "Internal review heuristics"],
    redacted: "Protected intelligence core",
  },
  proof: {
    eyebrow: "VALIDATION & PROOF",
    title: "Claims should stop where evidence stops.",
    intro: "This surface publishes implementation state and source boundaries. It does not invent accuracy, customer or live-production metrics.",
    statuses: { engineered: "Engineered", sourceBound: "Source-bound", pending: "Live proof pending" },
    publication: "Published",
    receipt: "Public receipt",
    note: "No unsupported performance claims are included. A pending state remains visibly pending.",
    architectureTitle: "Live verification architecture",
    architecture: ["Public manifest", "Source receipt", "Freshness state", "Classification", "Customer-safe status"],
  },
  finalCta: {
    eyebrow: "ENTER THE SYSTEM",
    title: "See the evidence before you trust the number.",
    description: "Open Shield for the live market surface or continue into the methodology behind the system.",
    primary: "Open Shield",
    secondary: "Read risk methodology",
  },
};

const pl: IntelligenceContent = {
  ...en,
  locale: "pl",
  hero: {
    eyebrow: "VELMÈRE INTELLIGENCE",
    title: "Ryzyko nie jest liczbą. Jest systemem dowodów.",
    intro: "Velmère łączy strukturę rynku, płynność, pochodzenie danych i brakujące dowody w jedną czytelną powierzchnię decyzyjną — bez udawania, że niepewność nie istnieje.",
    primary: "Poznaj system",
    secondary: "Otwórz Shield",
    legend: ["Ryzyko", "Pewność", "Dowody"],
    proofLine: ["Źródła powiązane", "Model właściwy dla aktywa", "Pewność ograniczona"],
  },
  comparison: {
    eyebrow: "WIĘCEJ NIŻ WYNIK",
    title: "To nie jest kolejny generator wyniku.",
    intro: "Jedna liczba kompresuje złożoność. Intelligence zachowuje ścieżkę dowodową, która do niej prowadzi.",
    columns: [
      { title: "Typowa powierzchnia", items: ["Jeden wynik", "Niejasne dane wejściowe", "Pozorna precyzja"] },
      { title: "Intelligence Velmère", items: ["Tory zależne od aktywa", "Świeżość i pochodzenie", "Limity pewności"] },
      { title: "Powierzchnia decyzji", items: ["Czytelny werdykt", "Widoczne luki dowodowe", "Śledzalny rezultat"] },
    ],
  },
  engine: {
    eyebrow: "SILNIK RYZYKA",
    title: "Jak myśli silnik.",
    intro: "Osiem torów analitycznych łączy się w jednym rdzeniu dowodowym. Wybierz tor, aby zobaczyć sygnał, rozumowanie i granicę dowodu.",
    instruction: "Wybierz albo przewiń tory analityczne",
    evidenceLabel: "Granica dowodu",
    lanes: [
      { id: "velocity", label: "Dynamika i ponowna wycena", signal: "Reakcja ceny", description: "Mierzy szybkość zmiany wyceny i rozróżnia uporządkowany ruch od nagłego uskoku.", evidence: "Stopy zwrotu, zakresy, luki i zsynchronizowane obserwacje ceny." },
      { id: "liquidity", label: "Płynność i głębokość wyjścia", signal: "Możliwość wyjścia", description: "Sprawdza, czy dostępna płynność przyjmie zlecenie bez nieproporcjonalnego wpływu na cenę.", evidence: "Głębokość, spread, wolumen i obserwacje właściwe dla danej giełdy." },
      { id: "microstructure", label: "Mikrostruktura rynku", signal: "Jakość handlu", description: "Czyta zachowanie spreadu, fragmentację, nierównowagę i krótkoterminowe warunki wykonania.", evidence: "Księga zleceń lub dane miejsca obrotu tylko wtedy, gdy źródło je wspiera." },
      { id: "supply", label: "Podaż, zasób w obrocie i odblokowania", signal: "Presja podaży", description: "Mapuje podaż w obiegu, znane emisje i odblokowania bez przedstawiania estymacji jako faktu.", evidence: "Dane podaży ze wskazanym źródłem i jawnie datowane harmonogramy." },
      { id: "holders", label: "Posiadacze i koncentracja", signal: "Koncentracja", description: "Oddziela szeroką własność od koncentracji mogącej wzmacniać ryzyko płynności lub kontroli.", evidence: "Dane on-chain lub z dokumentów, z jawnym zakresem." },
      { id: "contract", label: "Kontrakt i uprawnienia", signal: "Powierzchnia kontroli", description: "Sprawdza możliwość aktualizacji, role uprzywilejowane i uprawnienia zmieniające zachowanie aktywa.", evidence: "Zweryfikowany kod, metadane kontraktu i jawne ślady uprawnień." },
      { id: "evidence", label: "Dowody, pochodzenie i świeżość", signal: "Jakość dowodu", description: "Ogranicza pewność, gdy źródła są stare, sprzeczne, niepełne albo niedostępne.", evidence: "Tożsamość źródła, timestampy, receipts i stan sprzeczności." },
      { id: "context", label: "Kontekst właściwy dla aktywa", signal: "Właściwy model", description: "Kieruje token, akcję, ETF lub indeks do odpowiedniego modelu zamiast jednej uniwersalnej formuły.", evidence: "Klasa aktywa, miejsce obrotu, jurysdykcja i konstrukcja instrumentu." },
    ],
  },
  triad: {
    eyebrow: "WERDYKT W TRZECH WYMIARACH",
    title: "Ryzyko, pewność i niepewność to różne sygnały.",
    intro: "Interfejs rozdziela je, aby stanowczego wyniku ryzyka nie pomylić z niepełnymi dowodami.",
    risk: { label: "Ryzyko", description: "Szacowana ekspozycja przy dostępnych dowodach." },
    confidence: { label: "Pewność", description: "Siła, z jaką obecne dowody wspierają werdykt." },
    uncertainty: { label: "Niepewność", description: "To, czego nadal brakuje, co jest stare lub sprzeczne." },
    demoLabel: "DEMONSTRACJA METODOLOGII",
    demoTitle: "Usuń dowody. Zobacz, jak zmienia się pewność.",
    completeness: "Kompletność dowodów",
    missing: "Brakujące dowody",
    demoNote: "Wyłącznie demonstracja mechaniki — nie jest to ocena konkretnego aktywa.",
  },
  pipeline: {
    eyebrow: "PIPELINE INTELLIGENCE",
    title: "Każdy wynik ma swoją ścieżkę.",
    intro: "Proces może dostarczyć rezultat, obniżyć pewność, ukryć prywatny rdzeń albo zablokować niepopartą tezę.",
    stages: ["Zbierz", "Normalizuj", "Sprawdź świeżość", "Klasyfikuj aktywo", "Mapuj dowody", "Oceń tory", "Potwierdź i ogranicz", "Dostarcz lub zablokuj"],
    outcomes: ["Dostarcz", "Ukryj", "Obniż", "Zablokuj"],
  },
  products: {
    eyebrow: "POWIERZCHNIE PRODUKTOWE",
    title: "Jeden język analityczny. Cztery różne powierzchnie.",
    intro: "Każdy produkt pokazuje tę samą dyscyplinę dowodową z inną głębokością i dla innego zadania.",
    items: [
      { id: "shield", title: "Shield", kicker: "INTEGRALNOŚĆ RYNKU", description: "Intelligence dla krypto i stablecoinów z ryzykiem, płynnością i anomaliami powiązanymi ze źródłami.", cta: "Otwórz Shield", href: "/market-integrity" },
      { id: "markets", title: "Real Markets", kicker: "KONTEKST WIELU KLAS AKTYWÓW", description: "Jedna powierzchnia dla akcji, ETF-ów, indeksów i pozostałych instrumentów rynkowych.", cta: "Otwórz Real Markets", href: "/real-markets" },
      { id: "pro", title: "Shield Pro", kicker: "MONOCHROMATYCZNY TERMINAL", description: "Gęstszy terminal dowodowy do porównywania warunków na monitorowanym rynku.", cta: "Otwórz Shield Pro", href: "/shield-pro" },
      { id: "audit", title: "Audyty bezpieczeństwa", kicker: "PRZEGLĄD DOWODÓW", description: "Automatyczny przegląd wstępny i głębsza analiza człowieka dla kontraktów, uprawnień i luk dowodowych.", cta: "Zobacz audyty", href: "/security/audits" },
    ],
  },
  tiers: {
    ...en.tiers,
    eyebrow: "GŁĘBOKOŚĆ, NIE HYPE",
    title: "Basic, Pro i Advanced odsłaniają więcej dowodów — nie głośniejsze obietnice.",
    intro: "Strona czyta istniejącą politykę poziomów Velmère, w tym aktualne liczby sygnałów i ceny.",
    marketTab: "Intelligence rynkowe",
    auditTab: "Audyty bezpieczeństwa",
    recommended: "Polecany",
    free: "Darmowy",
    signalsLabel: "sygnałów",
    capabilitiesLabel: "obszary",
    marketFeatures: {
      basic: ["Publiczny wynik 10 sygnałów", "Tożsamość aktywa i podstawowy kontekst rynku", "Podsumowanie ryzyka, pewności i niepewności", "Główne czynniki i pokrycie źródeł publicznych", "Widoczność brakujących danych", "Ograniczony podgląd PDF"],
      pro: ["Analiza 14 sygnałów", "Wszystko z Basic", "Głębsza płynność i struktura rynku", "Świeżość źródeł i porównanie dostawców", "Składanie dowodów i pełny raport", "Eksport PDF z uprawnieniem zweryfikowanym po stronie serwera"],
      advanced: ["Analiza 20 sygnałów", "Wszystko z Pro", "Zaawansowane tory integralności i anomalii", "Market Impact i Whale Watch", "Analiza scenariuszy i rozbieżności dostawców", "Rejestr brakujących dowodów i stan review-required", "Najgłębszy skonfigurowany raport i PDF"],
    },
    auditFeatures: {
      basic: ["Automatyczny przegląd wstępny", "Skan kontraktu i pewności", "Publiczne podsumowanie"],
      pro: ["Głęboki przegląd dowodów", "Kontekst uprawnień i płynności", "Rozszerzony raport"],
      advanced: ["Weryfikacja analityka", "Priorytetowy przegląd dowodów", "Prywatny raport"],
    },
    auditNames: { basic: "Automatyczny przegląd wstępny", pro: "Głęboki przegląd dowodów", advanced: "Przegląd klasy dochodzeniowej" },
    note: "Płatny dostęp odblokowuje zweryfikowane po stronie serwera uprawnienie. Samo połączenie portfela nie jest dowodem płatności.",
  },
  experience: {
    eyebrow: "DOŚWIADCZENIE JAKO DOWÓD",
    title: "Złożoność może być spokojna.",
    intro: "Velmère układa informacje w kolejności, w której pytałby uważny analityk — sygnał, powód, źródło, luka i działanie.",
    moments: [
      { title: "Zorientuj się", description: "Poznaj aktywo i stan źródeł przed odczytaniem werdyktu." },
      { title: "Zapytaj", description: "Przejdź od podsumowania do toru, który zmienił rezultat." },
      { title: "Zweryfikuj", description: "Sprawdź tożsamość źródła, świeżość i luki bez opuszczania powierzchni." },
      { title: "Podważ", description: "Sprawdź wynik wobec brakujących dowodów, niepewności i sprzecznych obserwacji." },
      { title: "Zdecyduj odpowiedzialnie", description: "Korzystaj z ograniczonego i śledzalnego wyniku, nie z niepopartej instrukcji." },
    ],
  },
  boundary: {
    eyebrow: "JAWNA METODA, CHRONIONY RDZEŃ",
    title: "Wystarczająco transparentne, by zweryfikować. Wystarczająco prywatne, by chronić.",
    intro: "Publikujemy sposób zachowania systemu dowodowego, ale nie ujawniamy logiki operacyjnej ułatwiającej jego obejście.",
    publicTitle: "Publiczna metodologia",
    publicItems: ["Taksonomia torów ryzyka", "Reguły pewności i niepewności", "Wymagania źródeł i świeżości", "Granice poziomów i ceny"],
    privateTitle: "Prywatny rdzeń",
    privateItems: ["Dokładne wagi modeli", "Obrona przed manipulacją", "Prywatny routing źródeł", "Wewnętrzne heurystyki przeglądu"],
    redacted: "Chroniony rdzeń analityczny",
  },
  proof: {
    eyebrow: "WALIDACJA I DOWODY",
    title: "Teza powinna kończyć się tam, gdzie kończy się dowód.",
    intro: "Ta powierzchnia publikuje stan implementacji i granice źródeł. Nie wymyśla skuteczności, klientów ani metryk produkcyjnych.",
    statuses: { engineered: "Zaprojektowane", sourceBound: "Powiązane ze źródłem", pending: "Oczekuje na potwierdzenie działania na żywo" },
    publication: "Opublikowano",
    receipt: "Publiczne potwierdzenie",
    note: "Nie dodano niepopartych twierdzeń o skuteczności. Stan oczekujący pozostaje wyraźnie oczekujący.",
    architectureTitle: "Architektura weryfikacji live",
    architecture: ["Publiczny manifest", "Potwierdzenie źródła", "Stan świeżości", "Klasyfikacja", "Bezpieczny status klienta"],
  },
  finalCta: {
    eyebrow: "WEJDŹ DO SYSTEMU",
    title: "Zobacz dowody, zanim zaufasz liczbie.",
    description: "Otwórz Shield, aby przejść do rynku, albo poznaj metodologię stojącą za systemem.",
    primary: "Otwórz Shield",
    secondary: "Poznaj metodologię ryzyka",
  },
};

const de: IntelligenceContent = {
  ...en,
  locale: "de",
  hero: {
    eyebrow: "VELMÈRE INTELLIGENCE",
    title: "Risiko ist keine Zahl. Es ist ein Evidenzsystem.",
    intro: "Velmère verbindet Marktstruktur, Liquidität, Herkunft und fehlende Evidenz zu einer verständlichen Entscheidungsfläche — ohne Unsicherheit zu verschleiern.",
    primary: "System erkunden",
    secondary: "Shield öffnen",
    legend: ["Risiko", "Konfidenz", "Evidenz"],
    proofLine: ["Quellengebunden", "Asset-spezifisch", "Konfidenz begrenzt"],
  },
  comparison: {
    eyebrow: "MEHR ALS EIN SCORE",
    title: "Kein weiterer Bewertungsgenerator.",
    intro: "Eine Zahl komprimiert Komplexität. Intelligence bewahrt den Evidenzpfad, der zu ihr geführt hat.",
    columns: [
      { title: "Klassische Oberfläche", items: ["Eine Bewertung", "Undurchsichtige Eingaben", "Scheingenauigkeit"] },
      { title: "Velmère Intelligence", items: ["Wertpapierbezogene Bahnen", "Aktualität und Herkunft", "Konfidenzgrenzen"] },
      { title: "Entscheidungsfläche", items: ["Lesbares Urteil", "Sichtbare Evidenzlücken", "Nachvollziehbares Ergebnis"] },
    ],
  },
  engine: {
    eyebrow: "DIE RISIKO-ENGINE",
    title: "Wie das System denkt.",
    intro: "Acht analytische Bahnen laufen in einem Evidenzkern zusammen. Wähle eine Bahn, um Signal, Begründung und Evidenzgrenze zu prüfen.",
    instruction: "Analytische Bahnen wählen oder durchscrollen",
    evidenceLabel: "Evidenzgrenze",
    lanes: [
      { id: "velocity", label: "Dynamik & Neubewertung", signal: "Preisreaktion", description: "Misst, wie schnell ein Instrument neu bewertet wird und ob Bewegungen geordnet oder sprunghaft sind.", evidence: "Renditen, Spannen, Kurslücken und zeitlich abgeglichene Preisbeobachtungen." },
      { id: "liquidity", label: "Liquidität & Ausstiegstiefe", signal: "Ausstiegskapazität", description: "Prüft, ob die verfügbare Liquidität eine Ausführung ohne unverhältnismäßigen Preiseffekt aufnehmen kann.", evidence: "Tiefe, Spread, Volumen und venue-spezifische Liquiditätsbeobachtungen." },
      { id: "microstructure", label: "Marktmikrostruktur", signal: "Handelsqualität", description: "Liest Spread-Verhalten, Fragmentierung, Ungleichgewicht und kurzfristige Ausführungsbedingungen.", evidence: "Orderbuch- oder Venue-Daten nur, wenn die Quelle sie unterstützt." },
      { id: "supply", label: "Angebot, Float & Unlocks", signal: "Angebotsdruck", description: "Ordnet Umlaufmenge, bekannte Emissionen und Unlock-Druck ein, ohne Schätzungen als Fakten auszugeben.", evidence: "Quellengebundene Angebotsdaten und explizit datierte Zeitpläne." },
      { id: "holders", label: "Halter & Konzentration", signal: "Konzentration", description: "Trennt breite Eigentumsverteilung von Konzentration, die Liquiditäts- oder Kontrollrisiken verstärken kann.", evidence: "On-chain- oder filing-basierte Halterdaten mit offengelegtem Umfang." },
      { id: "contract", label: "Kontrakt & Berechtigungen", signal: "Kontrollfläche", description: "Prüft Aktualisierbarkeit, privilegierte Rollen und Berechtigungen, die das Instrument verändern können.", evidence: "Verifizierter Code, Kontraktmetadaten und explizite Berechtigungsspuren." },
      { id: "evidence", label: "Evidenz, Herkunft & Aktualität", signal: "Evidenzqualität", description: "Begrenzt Konfidenz, wenn Quellen veraltet, widersprüchlich, unvollständig oder nicht verfügbar sind.", evidence: "Quellenidentität, Zeitstempel, Receipts und Widerspruchsstatus." },
      { id: "context", label: "Instrumentenspezifischer Kontext", signal: "Richtiges Modell", description: "Leitet Token, Aktie, ETF oder Index durch das passende Modell statt durch eine Universalformel.", evidence: "Instrumentenklasse, Handelsplatz, Rechtsraum und Struktur." },
    ],
  },
  triad: {
    eyebrow: "EIN URTEIL IN DREI TEILEN",
    title: "Risiko, Konfidenz und Unsicherheit sind verschiedene Signale.",
    intro: "Die Oberfläche trennt sie, damit ein klares Risikourteil nicht mit unvollständiger Evidenz verwechselt wird.",
    risk: { label: "Risiko", description: "Geschätzte Exposition unter der verfügbaren Evidenz." },
    confidence: { label: "Konfidenz", description: "Wie stark die aktuelle Evidenz das Urteil stützt." },
    uncertainty: { label: "Unsicherheit", description: "Was noch fehlt, veraltet oder widersprüchlich ist." },
    demoLabel: "METHODIK-DEMONSTRATION",
    demoTitle: "Evidenz entfernen. Konfidenz beobachten.",
    completeness: "Vollständigkeit der Evidenz",
    missing: "Fehlende Evidenz",
    demoNote: "Nur eine Demonstration der Mechanik — keine Live-Assetbewertung.",
  },
  pipeline: {
    eyebrow: "INTELLIGENCE-PIPELINE",
    title: "Jedes Ergebnis hat einen Pfad.",
    intro: "Die Pipeline kann ein Ergebnis liefern, Konfidenz reduzieren, private Interna schwärzen oder eine unbelegte Aussage blockieren.",
    stages: ["Sammeln", "Normalisieren", "Aktualität prüfen", "Asset klassifizieren", "Evidenz zuordnen", "Bahnen bewerten", "Abgleichen & begrenzen", "Liefern oder blockieren"],
    outcomes: ["Liefern", "Schwärzen", "Herabstufen", "Blockieren"],
  },
  products: {
    eyebrow: "PRODUKTOBERFLÄCHEN",
    title: "Eine Intelligence-Sprache. Vier eigene Oberflächen.",
    intro: "Jedes Produkt zeigt dieselbe Evidenzdisziplin in einer anderen Tiefe und für eine andere Aufgabe.",
    items: [
      { id: "shield", title: "Shield", kicker: "MARKTINTEGRITÄT", description: "Intelligence für Krypto und Stablecoins mit quellengebundenem Risiko-, Liquiditäts- und Anomaliekontext.", cta: "Shield öffnen", href: "/market-integrity" },
      { id: "markets", title: "Real Markets", kicker: "ASSETKLASSENÜBERGREIFEND", description: "Eine gemeinsame Fläche für Aktien, ETFs, Indizes und weitere Marktinstrumente.", cta: "Real Markets öffnen", href: "/real-markets" },
      { id: "pro", title: "Shield Pro", kicker: "MONOCHROMES TERMINAL", description: "Ein dichteres Evidenzterminal zum Vergleich der Marktbedingungen in einem überwachten Universum.", cta: "Shield Pro öffnen", href: "/shield-pro" },
      { id: "audit", title: "Sicherheitsaudits", kicker: "EVIDENZPRÜFUNG", description: "Automatische Vorprüfung und tiefere menschliche Analyse für Kontrakte, Berechtigungen und Evidenzlücken.", cta: "Audits erkunden", href: "/security/audits" },
    ],
  },
  tiers: {
    ...en.tiers,
    eyebrow: "TIEFE STATT HYPE",
    title: "Basic, Pro und Advanced zeigen mehr Evidenz — keine lauteren Versprechen.",
    intro: "Die Seite nutzt die bestehende Velmère-Tier-Policy inklusive aktueller Signalanzahl und Preise.",
    marketTab: "Marktintelligenz",
    auditTab: "Sicherheitsaudits",
    recommended: "Empfohlen",
    free: "Kostenlos",
    signalsLabel: "Signale",
    capabilitiesLabel: "Bereiche",
    marketFeatures: {
      basic: ["Öffentliches 10-Signal-Ergebnis", "Asset-Identität und zentraler Marktkontext", "Risiko-, Konfidenz- und Unsicherheitsüberblick", "Haupttreiber und öffentliche Quellenabdeckung", "Sichtbare Datenlücken", "Begrenzte PDF-Vorschau"],
      pro: ["14-Signal-Analyse", "Alles aus Basic", "Tiefere Liquidität und Marktstruktur", "Quellenaktualität und Provider-Vergleich", "Evidenzaufbau und vollständiger Bericht", "PDF-Export mit serverseitig verifiziertem Zugriff"],
      advanced: ["20-Signal-Analyse", "Alles aus Pro", "Erweiterte Integritäts- und Anomaliebahnen", "Market Impact und Whale Watch", "Szenarioanalyse und Provider-Abweichung", "Missing-Proof-Ledger und Review-required-Status", "Tiefster konfigurierter Bericht und PDF"],
    },
    auditFeatures: {
      basic: ["Automatische Vorprüfung", "Kontrakt- und Konfidenzscan", "Öffentliche Zusammenfassung"],
      pro: ["Tiefe Evidenzprüfung", "Berechtigungs- und Liquiditätskontext", "Erweiterter Bericht"],
      advanced: ["Prüfung durch Analysten", "Priorisierte Evidenzprüfung", "Privater Bericht"],
    },
    auditNames: { basic: "Automatisches Prescreening", pro: "Tiefe Evidenzprüfung", advanced: "Prüfung auf Investigation-Niveau" },
    note: "Bezahlter Zugriff wird durch eine serverseitig verifizierte Berechtigung freigeschaltet. Eine Wallet-Verbindung allein ist kein Zahlungsnachweis.",
  },
  experience: {
    eyebrow: "EXPERIENCE ALS DIFFERENZIERUNG",
    title: "Komplexität kann ruhig wirken.",
    intro: "Velmère ordnet Informationen so, wie ein sorgfältiger Analyst fragen würde — Signal, Grund, Quelle, Lücke und Handlung.",
    moments: [
      { title: "Orientieren", description: "Asset und Quellenlage verstehen, bevor das Urteil gelesen wird." },
      { title: "Hinterfragen", description: "Von der Zusammenfassung zu der Bahn wechseln, die das Ergebnis verändert hat." },
      { title: "Verifizieren", description: "Quellenidentität, Aktualität und Lücken direkt auf der Oberfläche prüfen." },
      { title: "Prüfen", description: "Das Ergebnis gegen fehlende Evidenz, Unsicherheit und widersprüchliche Beobachtungen testen." },
      { title: "Verantwortlich entscheiden", description: "Ein begrenztes, nachvollziehbares Ergebnis statt einer unbelegten Anweisung nutzen." },
    ],
  },
  boundary: {
    eyebrow: "SICHTBARE METHODE, GESCHÜTZTER KERN",
    title: "Transparent genug zum Prüfen. Privat genug zum Schützen.",
    intro: "Wir veröffentlichen das Verhalten des Evidenzsystems, ohne operative Logik offenzulegen, die Manipulation erleichtern würde.",
    publicTitle: "Öffentliche Methodik",
    publicItems: ["Taxonomie der Risikobahnen", "Regeln für Konfidenz und Unsicherheit", "Quellen- und Aktualitätsanforderungen", "Tier-Grenzen und Preise"],
    privateTitle: "Privater Kern",
    privateItems: ["Exakte Modellgewichte", "Manipulationsabwehr", "Privates Quellenrouting", "Interne Prüfheuristiken"],
    redacted: "Geschützter Intelligence-Kern",
  },
  proof: {
    eyebrow: "VALIDIERUNG & NACHWEIS",
    title: "Behauptungen enden dort, wo Evidenz endet.",
    intro: "Diese Oberfläche veröffentlicht Implementierungsstatus und Quellengrenzen. Sie erfindet keine Genauigkeits-, Kunden- oder Live-Produktionsmetriken.",
    statuses: { engineered: "Implementiert", sourceBound: "Quellengebunden", pending: "Live-Nachweis ausstehend" },
    publication: "Veröffentlicht",
    receipt: "Öffentlicher Receipt",
    note: "Keine unbelegten Leistungsbehauptungen. Ein ausstehender Status bleibt sichtbar ausstehend.",
    architectureTitle: "Architektur der Live-Verifizierung",
    architecture: ["Öffentliches Manifest", "Quellen-Receipt", "Aktualitätsstatus", "Klassifizierung", "Kundensicherer Status"],
  },
  finalCta: {
    eyebrow: "DAS SYSTEM ÖFFNEN",
    title: "Evidenz sehen, bevor du der Zahl vertraust.",
    description: "Öffne Shield für die Marktoberfläche oder lies weiter in der Methodik hinter dem System.",
    primary: "Shield öffnen",
    secondary: "Risikomethodik lesen",
  },
};

export function resolveIntelligenceLocale(locale: string): IntelligenceLocale {
  return locale === "pl" || locale === "de" ? locale : "en";
}

export function getIntelligenceContent(locale: string): IntelligenceContent {
  const resolved = resolveIntelligenceLocale(locale);
  return resolved === "pl" ? pl : resolved === "de" ? de : en;
}
