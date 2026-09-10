import type { IntelligenceLocale } from "./intelligence-content";

export type IntelligenceScenario = {
  id: "collapse" | "short" | "long" | "whale" | "unlock" | "depeg" | "permissions" | "disagreement";
  title: string;
  signal: string;
  description: string;
  evidence: string;
};

export type IntelligenceDepthCopy = {
  scenarios: {
    eyebrow: string;
    title: string;
    intro: string;
    demo: string;
    observed: string;
    replay: string;
    items: IntelligenceScenario[];
  };
  pipeline: {
    replay: string;
    next: string;
    activeStage: string;
    outcomes: Array<{ title: string; description: string }>;
  };
  products: {
    selector: string;
    evidence: string;
    features: Record<string, string[]>;
  };
  report: {
    eyebrow: string;
    title: string;
    intro: string;
    stages: string[];
    packet: string;
    sourceSummary: string;
    findings: string;
    missing: string;
    version: string;
    timestamp: string;
    integrity: string;
    reviewState: string;
    deliveryState: string;
    sample: string;
  };
  brain: {
    eyebrow: string;
    title: string;
    intro: string;
    core: string;
    surfaces: string[];
    surfaceDetails: string[];
    inspect: string;
  };
};

const en: IntelligenceDepthCopy = {
  scenarios: {
    eyebrow: "DETECTION SCENARIO LAB",
    title: "Velmère reads behavior — not only numbers.",
    intro: "Each scenario combines several observable changes. The motion below explains the pattern; it does not claim a live detection.",
    demo: "Illustrative scenario",
    observed: "Evidence path",
    replay: "Replay scenario",
    items: [
      { id: "collapse", title: "Liquidity collapse", signal: "Rug-pull pattern", description: "Price structure breaks while displayed liquidity and exit depth deteriorate together.", evidence: "Price · liquidity · integrity" },
      { id: "short", title: "Short squeeze", signal: "Forced upward repricing", description: "Sideways structure accelerates as pressure imbalance and short covering reinforce the move.", evidence: "Momentum · derivatives · structure" },
      { id: "long", title: "Liquidation cascade", signal: "Long squeeze", description: "Weakening price cuts through successive levels as leverage and forced exits compound the decline.", evidence: "Leverage · levels · volatility" },
      { id: "whale", title: "Whale exit pressure", signal: "Concentration meets execution risk", description: "A concentrated holder routes size toward an exit while estimated market impact widens.", evidence: "Holders · flows · market impact" },
      { id: "unlock", title: "Supply unlock", signal: "Float shock", description: "Locked supply enters the tradable float and changes the available market structure.", evidence: "Supply · schedule · valuation" },
      { id: "depeg", title: "Stablecoin drift", signal: "Reserve confidence deterioration", description: "Price moves away from parity as redemption, backing or source confidence weakens.", evidence: "Parity · issuer · reserves" },
      { id: "permissions", title: "Permission escalation", signal: "Contract authority changed", description: "A privileged role gains the ability to mint, pause or redirect value and materially changes the trust boundary.", evidence: "Contract · authority · provenance" },
      { id: "disagreement", title: "Provider disagreement", signal: "Sources diverge", description: "Reputable providers report materially different price, supply or volume observations, so confidence falls until the evidence is corroborated.", evidence: "Provider A · provider B · freshness" },
    ],
  },
  pipeline: {
    replay: "Replay path",
    next: "Next stage",
    activeStage: "Current stage",
    outcomes: [
      { title: "Deliver", description: "Verified evidence supports the requested public output." },
      { title: "Redact", description: "The conclusion remains visible while protected methodology stays private." },
      { title: "Downgrade", description: "Evidence quality cannot support the requested analytical depth." },
      { title: "Block", description: "The available evidence cannot support a responsible conclusion." },
    ],
  },
  products: {
    selector: "Select a decision surface",
    evidence: "What the surface makes visible",
    features: {
      shield: ["Asset integrity lanes", "Liquidity and anomaly context", "Source-aware verdict"],
      markets: ["Cross-asset context", "Session and venue grammar", "Comparable market structure"],
      pro: ["Dense monitoring surface", "Ranked signals", "Monochrome evidence terminal"],
      audit: ["Contract intake", "Permission mapping", "Severity and review path"],
    },
  },
  report: {
    eyebrow: "REPORT JOURNEY",
    title: "Velmère does not end at the interface.",
    intro: "A result can become a traceable evidence packet, versioned report and protected delivery surface — without exposing private reasoning.",
    stages: ["Signal intake", "Source normalization", "Freshness verification", "Cross-source corroboration", "Evidence packet", "Findings synthesis", "Report assembly", "Versioned PDF", "Protected delivery"],
    packet: "Packet ID",
    sourceSummary: "Source summary",
    findings: "Findings",
    missing: "Missing evidence",
    version: "Version",
    timestamp: "Timestamp",
    integrity: "Integrity digest",
    reviewState: "Review state",
    deliveryState: "Delivery state",
    sample: "Illustrative sample — not a live report",
  },
  brain: {
    eyebrow: "ONE EVIDENCE CORE",
    title: "One evidence core. Multiple decision surfaces.",
    intro: "VLM Brain keeps the evidence discipline coherent. Angel turns that structure into questions users can actually ask.",
    core: "VLM Brain",
    surfaces: ["Shield", "Real Markets", "Shield Pro", "Market Impact", "Whale Watch", "Audits", "PDF", "Angel"],
    surfaceDetails: [
      "Unifies contract, liquidity, holder and market-structure evidence into an asset integrity surface.",
      "Relates cross-asset context, sessions and venue structure without collapsing unlike markets into one score.",
      "Turns the evidence core into a dense monitoring and prioritization surface for professional review.",
      "Estimates how order size can meet observed depth, with slippage and source limits kept visible.",
      "Maps holder concentration and observable transfers into flow context without inferring private intent.",
      "Connects permissions, authority, findings and provenance to a separate security-review workflow.",
      "Assembles versioned findings, missing evidence and integrity metadata into a protected report surface.",
      "Explains conclusions, confidence caps and missing evidence in natural-language questions and answers.",
    ],
    inspect: "Selected decision surface",
  },
};

const pl: IntelligenceDepthCopy = {
  scenarios: {
    eyebrow: "LABORATORIUM DETEKCJI",
    title: "Velmère czyta zachowanie rynku — nie tylko liczby.",
    intro: "Każdy scenariusz łączy kilka obserwowalnych zmian. Ruch wyjaśnia wzorzec i nie udaje aktywnej detekcji live.",
    demo: "Scenariusz ilustracyjny",
    observed: "Ścieżka dowodowa",
    replay: "Odtwórz scenariusz",
    items: [
      { id: "collapse", title: "Załamanie płynności", signal: "Wzorzec rug pull", description: "Struktura ceny pęka, gdy jednocześnie zanika płynność i głębokość wyjścia.", evidence: "Cena · płynność · integralność" },
      { id: "short", title: "Short squeeze", signal: "Wymuszona ponowna wycena", description: "Ruch boczny przyspiesza, gdy nierównowaga presji i zamykanie shortów wzmacniają wzrost.", evidence: "Momentum · derywaty · struktura" },
      { id: "long", title: "Kaskada likwidacji", signal: "Long squeeze", description: "Słabnąca cena przebija kolejne poziomy, a dźwignia i wymuszone wyjścia pogłębiają spadek.", evidence: "Dźwignia · poziomy · zmienność" },
      { id: "whale", title: "Presja wyjścia wieloryba", signal: "Koncentracja i ryzyko wykonania", description: "Skoncentrowany portfel kieruje duży wolumen do wyjścia, a wpływ na rynek rośnie.", evidence: "Posiadacze · przepływy · market impact" },
      { id: "unlock", title: "Odblokowanie podaży", signal: "Szok wolnego obrotu", description: "Zablokowana podaż wchodzi do obrotu i zmienia dostępną strukturę rynku.", evidence: "Podaż · harmonogram · wycena" },
      { id: "depeg", title: "Odchylenie stablecoina", signal: "Spadek zaufania do rezerw", description: "Cena oddala się od parytetu, gdy słabnie wykup, zabezpieczenie albo wiarygodność źródeł.", evidence: "Parytet · emitent · rezerwy" },
      { id: "permissions", title: "Eskalacja uprawnień", signal: "Zmiana władzy nad kontraktem", description: "Uprzywilejowana rola zyskuje możliwość emisji, zatrzymania lub przekierowania wartości i zmienia granicę zaufania.", evidence: "Kontrakt · uprawnienia · pochodzenie" },
      { id: "disagreement", title: "Rozbieżność dostawców", signal: "Źródła nie są zgodne", description: "Wiarygodni dostawcy raportują istotnie różne obserwacje ceny, podaży lub wolumenu, dlatego pewność spada do czasu potwierdzenia dowodów.", evidence: "Dostawca A · dostawca B · świeżość" },
    ],
  },
  pipeline: {
    replay: "Odtwórz ścieżkę",
    next: "Następny etap",
    activeStage: "Aktywny etap",
    outcomes: [
      { title: "Dostarcz", description: "Zweryfikowane dowody wspierają żądany rezultat publiczny." },
      { title: "Ukryj", description: "Wniosek pozostaje widoczny, a chroniona metodologia pozostaje prywatna." },
      { title: "Obniż", description: "Jakość dowodów nie wspiera żądanej głębokości analizy." },
      { title: "Zablokuj", description: "Dostępne dowody nie pozwalają na odpowiedzialny wniosek." },
    ],
  },
  products: {
    selector: "Wybierz powierzchnię decyzji",
    evidence: "Co ta powierzchnia ujawnia",
    features: {
      shield: ["Tory integralności aktywa", "Płynność i anomalie", "Werdykt powiązany ze źródłami"],
      markets: ["Kontekst wielu klas aktywów", "Sesje i miejsca obrotu", "Porównywalna struktura rynku"],
      pro: ["Gęsty monitoring", "Ranking sygnałów", "Monochromatyczny terminal dowodowy"],
      audit: ["Przyjęcie kontraktu", "Mapa uprawnień", "Dotkliwość i ścieżka review"],
    },
  },
  report: {
    eyebrow: "PODRÓŻ RAPORTU",
    title: "Velmère nie kończy się na interfejsie.",
    intro: "Wynik może stać się śledzalnym pakietem dowodów, wersjonowanym raportem i chronioną dostawą — bez ujawniania prywatnej logiki.",
    stages: ["Przyjęcie sygnałów", "Normalizacja źródeł", "Weryfikacja świeżości", "Potwierdzenie między źródłami", "Pakiet dowodów", "Synteza ustaleń", "Składanie raportu", "Wersjonowany PDF", "Chroniona dostawa"],
    packet: "ID pakietu",
    sourceSummary: "Podsumowanie źródeł",
    findings: "Ustalenia",
    missing: "Brakujące dowody",
    version: "Wersja",
    timestamp: "Znacznik czasu",
    integrity: "Skrót integralności",
    reviewState: "Stan przeglądu",
    deliveryState: "Stan dostawy",
    sample: "Próbka ilustracyjna — nie jest raportem live",
  },
  brain: {
    eyebrow: "JEDEN RDZEŃ DOWODOWY",
    title: "Jeden rdzeń dowodowy. Wiele powierzchni decyzji.",
    intro: "VLM Brain utrzymuje wspólną dyscyplinę dowodową. Angel zamienia tę strukturę w pytania, które użytkownik może naprawdę zadać.",
    core: "VLM Brain",
    surfaces: ["Shield", "Real Markets", "Shield Pro", "Market Impact", "Whale Watch", "Audyty", "PDF", "Angel"],
    surfaceDetails: [
      "Łączy dowody z kontraktu, płynności, holderów i struktury rynku w powierzchni integralności aktywa.",
      "Zestawia kontekst wielu aktywów, sesje i strukturę miejsc obrotu bez spłaszczania różnych rynków do jednej liczby.",
      "Przekłada rdzeń dowodowy na gęstą powierzchnię monitoringu i priorytetyzacji dla profesjonalnego przeglądu.",
      "Szacuje, jak wielkość zlecenia spotyka obserwowaną głębokość, zachowując widoczne granice źródeł i poślizgu.",
      "Mapuje koncentrację holderów i obserwowalne transfery bez przypisywania prywatnej intencji.",
      "Łączy uprawnienia, władzę, ustalenia i proweniencję w osobnym procesie przeglądu bezpieczeństwa.",
      "Składa wersjonowane ustalenia, brakujące dowody i metadane integralności w chroniony raport.",
      "Wyjaśnia wnioski, limity pewności i brakujące dowody przez pytania i odpowiedzi w naturalnym języku.",
    ],
    inspect: "Wybrana powierzchnia decyzji",
  },
};

const de: IntelligenceDepthCopy = {
  scenarios: {
    eyebrow: "DETECTION SCENARIO LAB",
    title: "Velmère liest Marktverhalten — nicht nur Zahlen.",
    intro: "Jedes Szenario verbindet mehrere beobachtbare Veränderungen. Die Bewegung erklärt das Muster und behauptet keine Live-Erkennung.",
    demo: "Illustratives Szenario",
    observed: "Evidenzpfad",
    replay: "Szenario wiederholen",
    items: [
      { id: "collapse", title: "Liquiditätskollaps", signal: "Rug-Pull-Muster", description: "Die Preisstruktur bricht, während Liquidität und Ausstiegstiefe gleichzeitig verschwinden.", evidence: "Preis · Liquidität · Integrität" },
      { id: "short", title: "Short Squeeze", signal: "Erzwungene Aufwertung", description: "Eine Seitwärtsphase beschleunigt, wenn Druckungleichgewicht und Short-Covering den Anstieg verstärken.", evidence: "Momentum · Derivate · Struktur" },
      { id: "long", title: "Liquidationskaskade", signal: "Long Squeeze", description: "Ein schwächerer Preis durchbricht Ebenen, während Hebel und erzwungene Ausstiege den Fall verstärken.", evidence: "Hebel · Ebenen · Volatilität" },
      { id: "whale", title: "Whale Exit Pressure", signal: "Konzentration trifft Ausführungsrisiko", description: "Ein konzentrierter Halter bewegt Größe zum Ausstieg, während der Markteinfluss steigt.", evidence: "Halter · Flows · Market Impact" },
      { id: "unlock", title: "Supply Unlock", signal: "Float-Schock", description: "Gesperrtes Angebot gelangt in den handelbaren Float und verändert die Marktstruktur.", evidence: "Angebot · Zeitplan · Bewertung" },
      { id: "depeg", title: "Stablecoin-Abweichung", signal: "Sinkendes Reservevertrauen", description: "Der Preis entfernt sich von der Parität, wenn Rücknahme, Deckung oder Quellenvertrauen nachlassen.", evidence: "Parität · Emittent · Reserven" },
      { id: "permissions", title: "Rechte-Eskalation", signal: "Veränderte Contract-Autorität", description: "Eine privilegierte Rolle erhält Mint-, Pause- oder Umleitungsrechte und verändert damit die Vertrauensgrenze.", evidence: "Contract · Autorität · Herkunft" },
      { id: "disagreement", title: "Provider-Abweichung", signal: "Quellen widersprechen sich", description: "Seriöse Anbieter melden wesentlich unterschiedliche Preis-, Angebots- oder Volumenbeobachtungen; die Konfidenz sinkt bis zur Bestätigung.", evidence: "Provider A · Provider B · Aktualität" },
    ],
  },
  pipeline: {
    replay: "Pfad wiederholen",
    next: "Nächste Stufe",
    activeStage: "Aktive Stufe",
    outcomes: [
      { title: "Liefern", description: "Verifizierte Evidenz stützt die angeforderte öffentliche Ausgabe." },
      { title: "Schwärzen", description: "Die Schlussfolgerung bleibt sichtbar, die geschützte Methodik privat." },
      { title: "Herabstufen", description: "Die Evidenzqualität trägt die angeforderte Analysetiefe nicht." },
      { title: "Blockieren", description: "Die verfügbare Evidenz trägt keine verantwortbare Schlussfolgerung." },
    ],
  },
  products: {
    selector: "Entscheidungsfläche wählen",
    evidence: "Was diese Fläche sichtbar macht",
    features: {
      shield: ["Asset-Integritätsbahnen", "Liquiditäts- und Anomaliekontext", "Quellengebundenes Urteil"],
      markets: ["Assetklassenübergreifender Kontext", "Sitzungs- und Venue-Logik", "Vergleichbare Marktstruktur"],
      pro: ["Dichte Überwachung", "Gerankte Signale", "Monochromes Evidenzterminal"],
      audit: ["Contract Intake", "Berechtigungskarte", "Schweregrad und Review-Pfad"],
    },
  },
  report: {
    eyebrow: "REPORT JOURNEY",
    title: "Velmère endet nicht an der Oberfläche.",
    intro: "Ein Ergebnis kann zu einem nachvollziehbaren Evidenzpaket, versionierten Bericht und geschützter Zustellung werden — ohne private Logik offenzulegen.",
    stages: ["Signalaufnahme", "Quellennormalisierung", "Aktualitätsprüfung", "Quellenübergreifende Bestätigung", "Evidenzpaket", "Befundsynthese", "Berichtserstellung", "Versioniertes PDF", "Geschützte Zustellung"],
    packet: "Paket-ID",
    sourceSummary: "Quellenübersicht",
    findings: "Feststellungen",
    missing: "Fehlende Evidenz",
    version: "Version",
    timestamp: "Zeitstempel",
    integrity: "Integritätsdigest",
    reviewState: "Prüfstatus",
    deliveryState: "Zustellstatus",
    sample: "Illustratives Beispiel — kein Live-Bericht",
  },
  brain: {
    eyebrow: "EIN EVIDENZKERN",
    title: "Ein Evidenzkern. Mehrere Entscheidungsflächen.",
    intro: "VLM Brain hält die Evidenzdisziplin konsistent. Angel übersetzt diese Struktur in Fragen, die Nutzer wirklich stellen können.",
    core: "VLM Brain",
    surfaces: ["Shield", "Real Markets", "Shield Pro", "Market Impact", "Whale Watch", "Audits", "PDF", "Angel"],
    surfaceDetails: [
      "Vereint Contract-, Liquiditäts-, Holder- und Marktstrukturevidenz in einer Asset-Integritätsoberfläche.",
      "Verknüpft Asset-Kontext, Sessions und Venue-Struktur, ohne unterschiedliche Märkte auf eine Zahl zu reduzieren.",
      "Übersetzt den Evidenzkern in eine dichte Monitoring- und Priorisierungsfläche für professionelle Prüfung.",
      "Schätzt, wie Ordergröße auf beobachtete Tiefe trifft, während Slippage und Quellengrenzen sichtbar bleiben.",
      "Ordnet Holder-Konzentration und beobachtbare Transfers ein, ohne private Absichten zu unterstellen.",
      "Verbindet Berechtigungen, Authority, Findings und Provenienz mit einem getrennten Security-Review-Pfad.",
      "Baut versionierte Findings, fehlende Evidenz und Integritätsmetadaten zu einem geschützten Bericht zusammen.",
      "Erklärt Schlüsse, Confidence-Grenzen und fehlende Evidenz in natürlichsprachlichen Fragen und Antworten.",
    ],
    inspect: "Gewählte Entscheidungsfläche",
  },
};

export function getIntelligenceDepthCopy(locale: IntelligenceLocale): IntelligenceDepthCopy {
  return locale === "pl" ? pl : locale === "de" ? de : en;
}
