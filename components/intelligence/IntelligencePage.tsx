import Link from "next/link";
import {
  ArrowRight,
  Braces,
  Check,
  CircleCheck,
  Database,
  Fingerprint,
  Gauge,
  Layers3,
  LockKeyhole,
  ScanSearch,
  ShieldCheck,
  Waves,
} from "lucide-react";
import type { IntelligenceContent, IntelligenceLocale } from "@/lib/intelligence/intelligence-content";
import { getIntelligenceDepthCopy } from "@/lib/intelligence/intelligence-depth-content";
import type { PublicIntelligenceMetric } from "@/lib/intelligence/public-intelligence-metrics";
import type { IntelligenceTier } from "./IntelligenceInteractive";
import { IntelligenceHero3D } from "./IntelligenceHero3D";
import {
  AngelExperience,
  IntelligenceScrollMotion,
  LiquidityExperience,
  SqueezeExperience,
  TierDeck,
  type AngelExperienceCopy,
  type LiquidityExperienceCopy,
  type SqueezeExperienceCopy,
} from "./IntelligenceMotion";
import RiskMethodologyModal from "./RiskMethodologyModal";
import styles from "./IntelligenceLuxury.module.css";

type IntelligencePageProps = {
  locale: IntelligenceLocale;
  copy: IntelligenceContent;
  marketTiers: IntelligenceTier[];
  auditTiers: IntelligenceTier[];
  proofMetrics: PublicIntelligenceMetric[];
};

type TierNarrativeDetail = {
  summary: string;
  bestFor: string;
  deliverable: string;
  boundary: string;
};

type TierNarrativeCopy = {
  info: string;
  close: string;
  includes: string;
  bestFor: string;
  deliverable: string;
  boundary: string;
  details: {
    market: Record<IntelligenceTier["id"], TierNarrativeDetail>;
    audit: Record<IntelligenceTier["id"], TierNarrativeDetail>;
  };
};

type EditorialNarrative = {
  privateLabel: string;
  status: string;
  heroLine: string;
  heroAccent: string;
  heroObject: string;
  metricNote: string;
  metrics: Array<{ value: string; label: string }>;
  navLabel: string;
  nav: Array<{ label: string; href: string }>;
  systemEyebrow: string;
  systemTitle: string;
  systemIntro: string;
  technicalLabel: string;
  technical: string;
  humanLabel: string;
  human: string;
  inputLabel: string;
  outputLabel: string;
  packetLabel: string;
  packetTitle: string;
  packetDetail: string;
  inputs: Array<{ title: string; detail: string }>;
  outputs: Array<{ title: string; detail: string }>;
  oneTruth: string;
  decisionsEyebrow: string;
  decisionsTitle: string;
  decisionsIntro: string;
  decisions: Array<{ title: string; description: string }>;
  squeezeEyebrow: string;
  squeezeTitle: string;
  squeezeIntro: string;
  squeezePoints: string[];
  squeezeCopy: SqueezeExperienceCopy;
  liquidityEyebrow: string;
  liquidityTitle: string;
  liquidityIntro: string;
  liquidityPoints: string[];
  liquidityCopy: LiquidityExperienceCopy;
  angelEyebrow: string;
  angelTitle: string;
  angelIntro: string;
  angelPoints: string[];
  angelCopy: AngelExperienceCopy;
  productNote: string;
  tierEyebrow: string;
  tierTitle: string;
  tierIntro: string;
  tierModal: TierNarrativeCopy;
  reportEyebrow: string;
  reportTitle: string;
  reportIntro: string;
  reportBrowserCta: string;
  reportFields: string[];
  securityEyebrow: string;
  securityPrinciples: Array<{ title: string; detail: string }>;
  proofFootnote: string;
};

const narratives: Record<IntelligenceLocale, EditorialNarrative> = {
  pl: {
    privateLabel: "PRYWATNA INFRASTRUKTURA DECYZYJNA",
    status: "SYSTEM DOWODOWY / AKTYWNY",
    heroLine: "Ryzyko nie jest liczbą.",
    heroAccent: "Jest systemem dowodów.",
    heroObject: "KANONICZNY OBIEKT DOWODOWY",
    metricNote: "Architektura produktu — nie deklaracja skuteczności",
    metrics: [
      { value: "01", label: "wspólne źródło prawdy" },
      { value: "05", label: "oddzielnych wyników decyzji" },
      { value: "04", label: "domeny dowodowe" },
      { value: "03", label: "poziomy głębokości" },
    ],
    navLabel: "Rozdziały systemu Intelligence",
    nav: [
      { label: "System", href: "#system-map" },
      { label: "Rynek", href: "#scenario-lab" },
      { label: "Płynność", href: "#liquidity-lab" },
      { label: "Angel", href: "#vlm-brain" },
      { label: "Poziomy", href: "#intelligence-depth" },
      { label: "Raport", href: "#reports" },
    ],
    systemEyebrow: "01 / JEDEN MÓZG DOWODOWY",
    systemTitle: "Dane tworzą dowody. Dowody tworzą wynik.",
    systemIntro: "Velmère łączy rynek, wykonanie, koncentrację kapitału, kontrakt i kondycję źródeł w jeden wersjonowany pakiet. Każdy produkt czyta tę samą prawdę — pokazuje tylko właściwy dla siebie zakres.",
    technicalLabel: "TECHNICZNIE",
    technical: "Deterministyczny silnik ryzyka + orkiestracja dowodów + warstwa wyjaśnień AI + widoki zależne od poziomu + raporty powiązane skrótem SHA-256.",
    humanLabel: "PO LUDZKU",
    human: "Maszyna nie zgaduje. Najpierw porządkuje fakty, potem liczy wynik według reguł, a dopiero na końcu AI tłumaczy, co z niego wynika i czego nadal nie wiemy.",
    inputLabel: "WARSTWY DANYCH",
    outputLabel: "POWIERZCHNIE PRODUKTU",
    packetLabel: "WSPÓLNY RDZEŃ",
    packetTitle: "KANONICZNY\nPAKIET DOWODOWY",
    packetDetail: "Wersjonowany pakiet danych, źródeł, wyników, braków i reguł ujawnienia.",
    inputs: [
      { title: "Rynek", detail: "cena · wolumen · zmienność" },
      { title: "Wykonanie", detail: "głębokość · VWAP · poślizg" },
      { title: "Koncentracja", detail: "posiadacze · klastry · przepływy" },
      { title: "Kontrakt", detail: "kod · role · ustalenia" },
      { title: "Źródła", detail: "świeżość · rozbieżność · kondycja" },
    ],
    outputs: [
      { title: "Shield", detail: "analiza rynku krypto" },
      { title: "Real Markets", detail: "wiele klas aktywów" },
      { title: "Shield Pro", detail: "terminal" },
      { title: "Angel", detail: "pytania do dowodów" },
      { title: "Audyty bezpieczeństwa", detail: "przegląd" },
      { title: "Lens / PDF", detail: "raport i archiwum" },
    ],
    oneTruth: "Ten sam pakiet. Ten sam wynik bazowy. Inna głębokość dla właściwego zadania.",
    decisionsEyebrow: "02 / PIĘĆ WYNIKÓW ZAMIAST JEDNEJ OCENY",
    decisionsTitle: "Uczciwa decyzja potrzebuje więcej niż jednej liczby.",
    decisionsIntro: "Ryzyko, jakość dowodów i gotowość raportu nie są tym samym. Rozdzielamy je, aby brak informacji nigdy nie udawał ani bezpieczeństwa, ani potwierdzonego zagrożenia.",
    decisions: [
      { title: "Ryzyko", description: "Natężenie potwierdzonych negatywnych sygnałów." },
      { title: "Pewność", description: "Siła i spójność dowodów pod wnioskiem." },
      { title: "Niepewność", description: "Zakres brakujących, starych lub sprzecznych danych." },
      { title: "Priorytet kontroli", description: "Pilność dodatkowej weryfikacji niezależna od poziomu ryzyka." },
      { title: "Gotowość", description: "Gotowość analizy do bezpiecznego dostarczenia." },
    ],
    squeezeEyebrow: "03 / ZACHOWANIE RYNKU — LABORATORIUM SCENARIUSZY",
    squeezeTitle: "Cena pokazuje skutek. Sekwencja dowodów pokazuje przyczynę.",
    squeezeIntro: "Velmère nie określa każdego gwałtownego ruchu jako squeeze. Porównuje świece, wolumen, nierównowagę zleceń, głębokość i koncentrację, aby rozróżnić wymuszone pokrywanie pozycji, znikającą płynność i wyjście dużego posiadacza.",
    squeezePoints: [
      "Short i long squeeze wymagają kierunkowego wybicia potwierdzonego ekspansją wolumenu.",
      "Próżnia płynności opisuje ruch powstały po wycofaniu ofert, a nie po zwykłym wzroście popytu.",
      "Wyjście dużego gracza łączy koncentrację, przepływy na giełdy i realną głębokość wykonania.",
    ],
    squeezeCopy: {
      aria: "Interaktywne animacje świec dla czterech scenariuszy zachowania rynku",
      status: "SCENARIUSZ AKTYWNY",
      replay: "Odtwórz",
      selectLabel: "Wybierz scenariusz rynkowy",
      legend: ["Świece / kierunek", "Punkt zdarzenia", "Wolumen"],
      phasesLabel: "Sekwencja scenariusza",
      scenarios: [
        {
          id: "short", label: "Squeeze shortów", symbol: "BTC—PERP / 15M", zone: "KOMPRESJA", event: "WYMUSZONY ODKUP",
          headline: "Rosnąca cena zmusza shorty do odkupu.",
          description: "Ciasny zakres przechodzi w wybicie, wolumen rośnie, a przymusowe pokrywanie krótkich pozycji przyspiesza ruch. Sama zielona świeca nie wystarcza — liczy się kolejność i zgodność źródeł.",
          phases: ["Kompresja i rosnąca nierównowaga", "Wybicie potwierdzone wolumenem", "Pokrywanie shortów i ekspansja"],
          stats: [{ label: "TEMPO CENY", value: "+24,8%" }, { label: "WZROST WOLUMENU", value: "4,7×" }, { label: "STAN DOWODÓW", value: "POWIĄZANE ZE ŹRÓDŁEM" }],
        },
        {
          id: "long", label: "Squeeze longów", symbol: "ETH—PERP / 15M", zone: "SŁABE WSPARCIE", event: "WYMUSZONA SPRZEDAŻ",
          headline: "Utrata wsparcia uruchamia wymuszoną sprzedaż.",
          description: "Dźwignia działa w drugą stronę: płytkie odbicia nie odzyskują wsparcia, likwidacje zwiększają podaż, a czerwone świece przyspieszają wraz z wolumenem.",
          phases: ["Test i osłabienie wsparcia", "Kaskada likwidacji longów", "Delewarowanie i rozszerzenie spreadu"],
          stats: [{ label: "TEMPO SPADKU", value: "−21,4%" }, { label: "WZROST WOLUMENU", value: "5,1×" }, { label: "PRIORYTET KONTROLI", value: "WYSOKI" }],
        },
        {
          id: "vacuum", label: "Próżnia płynności", symbol: "SOL—USD / 5M", zone: "WYCOFANIE GŁĘBOKOŚCI", event: "LUKA CENOWA",
          headline: "Cena przeskakuje, bo oferty znikają z księgi.",
          description: "Ruch nie musi oznaczać ogromnego popytu. Gdy głębokość znika blisko ceny środkowej, nawet przeciętne zlecenie przechodzi przez kilka pasm i tworzy lukę cenową.",
          phases: ["Wycofanie ofert i wzrost spreadu", "Cienka księga przy cenie środkowej", "Luka i nieliniowy wpływ na rynek"],
          stats: [{ label: "ZMIANA GŁĘBOKOŚCI", value: "−68%" }, { label: "SPREAD", value: "3,9×" }, { label: "JAKOŚĆ REALIZACJI", value: "OBNIŻONA" }],
        },
        {
          id: "whale", label: "Wyjście dużego gracza", symbol: "TOKEN—USD / 30M", zone: "NAPŁYW NA GIEŁDĘ", event: "STRES WYJŚCIA",
          headline: "Koncentracja podaży spotyka ograniczoną głębokość.",
          description: "Duży transfer nabiera znaczenia dopiero po połączeniu etykiety portfela, napływu na giełdę, udziału w podaży i symulacji wyjścia po realnych poziomach księgi.",
          phases: ["Posiadacz lub klaster zwiększa napływ", "Pozycja zużywa kolejne pasma głębokości", "VWAP spada, a realizacja staje się częściowa"],
          stats: [{ label: "WYJŚCIE GŁÓWNEGO POSIADACZA", value: "8,4% PODAŻY" }, { label: "ZUŻYTA GŁĘBOKOŚĆ", value: "93%" }, { label: "UDZIAŁ REALIZACJI", value: "87%" }],
        },
      ],
    },
    liquidityEyebrow: "04 / PŁYNNOŚĆ I WPŁYW NA RYNEK",
    liquidityTitle: "Płynność nie jest cyfrą obok ceny. Jest możliwością wyjścia.",
    liquidityIntro: "Duży wolumen 24h nie mówi, po jakiej cenie naprawdę wykonasz zlecenie. Model przechodzi po poziomach księgi zleceń, liczy VWAP, udział realizacji i wpływ własnej transakcji na rynek.",
    liquidityPoints: [
      "Im większe zlecenie, tym więcej warstw płynności zostaje zużytych.",
      "Wpływ na rynek oddziela cenę ekranową od realnej ceny wykonania.",
      "Test wyjścia dużego gracza łączy wielkość pozycji z dostępną głębokością.",
    ],
    liquidityCopy: {
      aria: "Interaktywna wizualizacja płynności wylewającej się do głębokości rynku",
      status: "MODEL GŁĘBOKOŚCI / SCHEMAT",
      metrics: [
        { label: "CENA ODNIESIENIA", value: "PUNKT STARTOWY" },
        { label: "VWAP", value: "ŚCIEŻKA WYKONANIA" },
        { label: "UDZIAŁ REALIZACJI", value: "DOSTĘPNA CZĘŚĆ" },
        { label: "WPŁYW NA RYNEK", value: "ROŚNIE Z GŁĘBOKOŚCIĄ" },
      ],
      labels: { source: "STRUMIEŃ ZLECEŃ", book: "DOSTĘPNA GŁĘBOKOŚĆ", curve: "KRZYWA WPŁYWU", consumed: "PRZEJŚCIE PO KSIĘDZE", remaining: "POZOSTAŁA GŁĘBOKOŚĆ", reading: "ODCZYT MODELU" },
      bands: ["NAJLEPSZA OFERTA / 0–10 PB", "BLISKA KSIĘGA / 10–25 PB", "ŚRODKOWA GŁĘBOKOŚĆ / 25–50 PB", "GŁĘBOKI STRES / 50+ PB"],
      flowSteps: ["Zlecenie trafia na wiele giełd", "Najlepsze poziomy są wypełniane", "VWAP przesuwa się po księdze", "Wpływ rośnie, a realizacja może spaść"],
      reading: "Strumień pokazuje kolejność, nie kwotę: zlecenie pobiera najlepsze oferty, schodzi przez kolejne pasma głębokości, buduje VWAP i dopiero wtedy ujawnia realny koszt wyjścia.",
      caption: "Schemat wyjaśnia mechanikę wykonania — bez udawania aktualnego rynku ani rekomendacji inwestycyjnej.",
    },
    angelEyebrow: "05 / ANGEL — INTERFEJS DOWODOWY",
    angelTitle: "Zapytaj głębiej. Otrzymaj odpowiedź z granicą dowodu.",
    angelIntro: "Angel nie jest osobnym generatorem opinii. Rozmawia z tym samym pakietem, który zasila wynik, terminal i raport — dlatego potrafi wskazać źródło, pewność, brak oraz kolejny bezpieczny krok.",
    angelPoints: ["Odpowiedzi związane z konkretnym zakresem", "Widoczne dowody i brakujące potwierdzenia", "Bez wymyślonych źródeł ani liczb"],
    angelCopy: {
      aria: "Interaktywny podgląd asystenta Angel opartego na dowodach",
      status: "ANGEL / POWIĄZANY Z DOWODEM",
      scope: "PYTANIE DO PAKIETU",
      evidence: "DOWODY",
      confidence: "PEWNOŚĆ",
      missing: "BRAKUJĄCY DOWÓD",
      prompt: "Odpowiedź pokazuje dowody, granicę pewności i brakujący element — nie generuje nowego wyniku.",
      packet: "KANONICZNY PAKIET DOWODOWY",
      traceLabel: "AKTYWNY ŁAŃCUCH DOWODOWY",
      gateLabel: "BRAMKA ODPOWIEDZI",
      trace: [
        { label: "Rynek + wykonanie", state: "ŚWIEŻE" },
        { label: "Koncentracja", state: "NIEAKTUALNE" },
        { label: "Zgodność źródeł", state: "2 / 3" },
        { label: "Brakujący dowód", state: "01 OTWARTY" },
      ],
      questions: [
        {
          tab: "Ryzyko a pewność",
          question: "Dlaczego pewność spadła, mimo że ryzyko się nie zmieniło?",
          answer: "Nie pojawił się nowy potwierdzony sygnał negatywny. Spadła natomiast jakość podstawy dowodowej, dlatego ryzyko pozostaje stabilne, a pewność obniża się niezależnie.",
          evidence: ["Dwa źródła ceny pozostają zgodne", "Dane posiadaczy przekroczyły próg świeżości", "Dostawca głębokości nie odpowiedział w limicie"],
          confidence: "Wysoka / ograniczona świeżością",
          missing: "Aktualny obraz danych posiadaczy",
        },
        {
          tab: "Płynność wyjścia",
          question: "Czy płynność wystarczy na sprzedaż pozycji za 250 000 USD?",
          answer: "Bieżący model wskazuje pełne wypełnienie w scenariuszu bazowym, ale wpływ rośnie nieliniowo. Wynik powinien być ponownie sprawdzony tuż przed wykonaniem.",
          evidence: ["Księgi z dwóch niezależnych giełd", "Pełna realizacja w scenariuszu bazowym", "Rozbieżność spreadu pozostaje niska"],
          confidence: "Umiarkowanie wysoka",
          missing: "Zmiana głębokości po rozpoczęciu zlecenia",
        },
        {
          tab: "Gotowość raportu",
          question: "Co musi się wydarzyć, aby raport był gotowy?",
          answer: "Pakiet dowodów jest złożony, ale dostarczenie pozostaje zablokowane do czasu zamknięcia konfliktu źródeł i brakujących dowodów. Advanced nie jest obecnie na sprzedaż i nie zawiera weryfikacji człowieka ani zatwierdzenia operatora.",
          evidence: ["Identyfikator pakietu i skrót są utworzone", "Zakres został potwierdzony", "Otwarte braki są jawnie zapisane"],
          confidence: "Ograniczona przez brakujące dowody",
          missing: "Rozstrzygnięcie konfliktu + niezależne dowody",
        },
      ],
    },
    productNote: "Jedna dyscyplina dowodowa. Inna gęstość informacji dla rynku, terminala, rozmowy i audytu.",
    tierEyebrow: "07 / BASIC · PRO · ADVANCED",
    tierTitle: "Płacisz za głębię dowodów — nigdy za inną prawdę.",
    tierIntro: "Każdy poziom korzysta z tego samego kontraktu ryzyka. Basic daje szybką analizę wstępną, Pro pogłębia analizę automatyczną, a Advanced opisuje najszerszy automatyczny zakres dowodów. Advanced nie jest obecnie na sprzedaż i nie zawiera weryfikacji człowieka ani zatwierdzenia operatora.",
    tierModal: {
      info: "Informacje", close: "Zamknij", includes: "Pełny zakres", bestFor: "Najlepszy dla", deliverable: "Otrzymujesz", boundary: "Granica poziomu",
      details: {
        market: {
          basic: { summary: "Szybka, publiczna analiza wstępna tej samej bazowej prawdy o aktywie. Pokazuje najważniejsze wyniki i luki bez udawania pełnej analizy wykonania lub koncentracji.", bestFor: "Pierwsze sprawdzenie aktywa i decyzja, czy warto wejść głębiej.", deliverable: "Wynik 10 sygnałów, główne czynniki, ryzyko, pewność, niepewność i krótki podgląd PDF.", boundary: "Analiza wykonania jest reprezentatywna i ograniczona; koncentracja pozostaje skrócona lub zablokowana." },
          pro: { summary: "Głęboka analiza automatyczna rozszerzająca Basic o szerszy kontekst, świeżość źródeł, płynność, konflikty dostawców i pełny raport.", bestFor: "Analityków i inwestorów potrzebujących obrazu rynku powiązanego ze źródłami bez ręcznej weryfikacji.", deliverable: "14 sygnałów, pełniejszy obraz głębokości i wpływu, rejestr braków i konfliktów oraz pełny PDF Pro.", boundary: "To analiza automatyczna. Nie zawiera obowiązkowego zatwierdzenia człowieka ani najszerszego testu wyjścia." },
          advanced: { summary: "Najszersza dozwolona warstwa dowodów dla rynku: scenariusze stresowe, wpływ na rynek, obserwacja dużych posiadaczy, rozbieżności dostawców i proces weryfikacji.", bestFor: "Profesjonalnych decyzji o dużym nominale, koncentracji i złożonym ryzyku wykonania.", deliverable: "20 sygnałów, najgłębsza analiza wykonania i koncentracji, test wyjścia, pełny rejestr brakujących dowodów i rozbudowany PDF.", boundary: "Większa głębokość nie zmienia bazowego kontraktu ryzyka i nie usuwa niepewności wynikającej z brakujących danych." },
        },
        audit: {
          basic: { summary: "Darmowa, pasywna analiza wstępna publicznych danych, która wykrywa najważniejsze czerwone flagi i mówi, czego nadal nie udało się potwierdzić.", bestFor: "Szybkiej odpowiedzi: czy od razu widać coś groźnego i czy potrzebny jest głębszy audyt.", deliverable: "Identyfikacja celu, publiczne źródła, podstawowe uprawnienia, najważniejsze flagi, priorytet kontroli i krótki raport.", boundary: "Nie jest pełnym ręcznym audytem; brak dowodów przeciwnych może pozostawić ryzyko w stanie „Nieznane”." },
          pro: { summary: "Płatna, głęboka analiza automatyczna z kanonicznym pakietem kontraktu. Rozszerza Basic o kod i ABI, uprawnienia, posiadaczy, płynność, blokady, świeżość, konflikty oraz skrót integralności.", bestFor: "Projektów i kupujących potrzebujących szerokiej automatycznej mapy dowodów bez udawania podpisu człowieka.", deliverable: "Rozbudowany PDF Pro z ustaleniami, priorytetami, ograniczeniami, działaniami naprawczymi i powiązaniem SHA-256.", boundary: "Pro nie jest ręcznie podpisanym audytem. Konflikt wymagający osądu pozostaje jawny i może blokować gotowość." },
          advanced: { summary: "Najszerszy projektowany zakres automatycznej analizy i evidence packu. Nie jest obecnie oferowany klientom i nie obejmuje ręcznej weryfikacji, arbitrażu człowieka ani zatwierdzenia operatora.", bestFor: "Wewnętrznej oceny przyszłego workflow due diligence po niezależnym potwierdzeniu jakości, zakresu i operacji.", deliverable: "Projekt rozszerzonego evidence packu, porównania wersji, rejestr konfliktów i braków oraz model ponownej kontroli — bez obietnicy human review.", boundary: "NOT_FOR_SALE: brak publicznej ceny, checkoutu, human review, operator sign-off i customer delivery do czasu zamknięcia niezależnych bramek." },
        },
      },
    },
    reportEyebrow: "08 / LENS I RAPORTY DOWODOWE",
    reportTitle: "Raport, do którego można wrócić. Dowód, który można zweryfikować.",
    reportIntro: "PDF Velmère nie jest zrzutem ekranu wyniku ani długim tekstem AI. Wiąże tożsamość, zakres, źródła, ograniczenia, wersję pakietu i SHA-256 w jeden dokument sprawy.",
    reportBrowserCta: "Otwórz w Velmère Browser",
    reportFields: ["Tożsamość i zakres", "Ryzyko / pewność / niepewność", "Źródła i czas obserwacji", "Brakujące dowody", "Ograniczenia i działania naprawcze", "Identyfikator / wersja / SHA-256"],
    securityEyebrow: "09 / PUBLICZNA METODA · PRYWATNY RDZEŃ",
    securityPrinciples: [
      { title: "Dostarczenie blokowane domyślnie", detail: "Brak potwierdzenia blokuje dostarczenie zamiast udawać zgodę." },
      { title: "Uprawnienia po stronie serwera", detail: "Płatny dostęp powstaje i jest sprawdzany po stronie serwera." },
      { title: "Odporność źródeł", detail: "Świeżość, rozbieżność, brak odpowiedzi i niezależność dostawców wpływają na pewność." },
      { title: "Skróty i potwierdzenia", detail: "Wersja pakietu i raportu pozostawia weryfikowalny ślad integralności." },
    ],
    proofFootnote: "Statusy poniżej opisują publiczny stan implementacji. Nie są deklaracją skuteczności, liczby klientów ani wyniku inwestycyjnego.",
  },
  en: {
    privateLabel: "PRIVATE DECISION INFRASTRUCTURE",
    status: "EVIDENCE SYSTEM / ACTIVE",
    heroLine: "Risk is not a number.",
    heroAccent: "It is an evidence system.",
    heroObject: "CANONICAL EVIDENCE OBJECT",
    metricNote: "Product architecture — not a performance claim",
    metrics: [
      { value: "01", label: "shared source of truth" },
      { value: "05", label: "separate decision outputs" },
      { value: "04", label: "evidence domains" },
      { value: "03", label: "depth tiers" },
    ],
    navLabel: "Intelligence chapters",
    nav: [
      { label: "System", href: "#system-map" },
      { label: "Market", href: "#scenario-lab" },
      { label: "Liquidity", href: "#liquidity-lab" },
      { label: "Angel", href: "#vlm-brain" },
      { label: "Tiers", href: "#intelligence-depth" },
      { label: "Report", href: "#reports" },
    ],
    systemEyebrow: "01 / ONE EVIDENCE BRAIN",
    systemTitle: "Data becomes evidence. Evidence becomes a decision.",
    systemIntro: "Velmère connects market, execution, capital concentration, contract and source health into one versioned packet. Every product reads the same truth and reveals only the depth appropriate to its task.",
    technicalLabel: "TECHNICALLY",
    technical: "Deterministic risk engine + evidence orchestration + AI explanation layer + tier-bound projections + SHA-256-bound reports.",
    humanLabel: "IN PLAIN LANGUAGE",
    human: "The machine does not guess. It orders facts, calculates by rules, and only then lets AI explain what the result means and what remains unknown.",
    inputLabel: "DATA LAYERS",
    outputLabel: "PRODUCT SURFACES",
    packetLabel: "SHARED CORE",
    packetTitle: "CANONICAL\nEVIDENCE PACKET",
    packetDetail: "A versioned packet of data, sources, outputs, gaps and disclosure rules.",
    inputs: [
      { title: "Market", detail: "price · volume · volatility" },
      { title: "Execution", detail: "depth · VWAP · slippage" },
      { title: "Concentration", detail: "holders · clusters · flows" },
      { title: "Contract", detail: "code · roles · findings" },
      { title: "Sources", detail: "freshness · divergence · health" },
    ],
    outputs: [
      { title: "Shield", detail: "crypto intelligence" },
      { title: "Real Markets", detail: "cross-asset" },
      { title: "Shield Pro", detail: "terminal" },
      { title: "Angel", detail: "evidence Q&A" },
      { title: "Security Audits", detail: "review" },
      { title: "Lens / PDF", detail: "report and archive" },
    ],
    oneTruth: "The same packet. The same base result. Different depth for the right task.",
    decisionsEyebrow: "02 / FIVE OUTPUTS INSTEAD OF ONE SCORE",
    decisionsTitle: "An honest decision needs more than one number.",
    decisionsIntro: "Risk, evidence quality and report readiness are not interchangeable. We separate them so missing data can never impersonate safety or a confirmed threat.",
    decisions: [
      { title: "Risk", description: "Intensity of confirmed adverse signals." },
      { title: "Confidence", description: "Strength and consistency of evidence." },
      { title: "Uncertainty", description: "Missing, stale or conflicting information." },
      { title: "Review priority", description: "Urgency of additional review beyond risk." },
      { title: "Readiness", description: "Whether analysis is safe to deliver." },
    ],
    squeezeEyebrow: "03 / MARKET BEHAVIOR — SCENARIO LAB",
    squeezeTitle: "Price shows the outcome. The evidence sequence shows the cause.",
    squeezeIntro: "Velmère does not call every violent move a squeeze. It combines candles, volume, imbalance, depth and concentration to separate forced position covering, disappearing liquidity and a large-holder exit.",
    squeezePoints: ["Short and long squeezes need directional breaks confirmed by volume expansion.", "A liquidity vacuum is caused by withdrawn quotes, not ordinary demand alone.", "Whale exit stress joins concentration, exchange flows and executable depth."],
    squeezeCopy: {
      aria: "Interactive candle animations for four market-behavior scenarios",
      status: "SCENARIO ACTIVE",
      replay: "Replay",
      selectLabel: "Select a market scenario",
      legend: ["Candles / direction", "Evidence event", "Volume"],
      phasesLabel: "Scenario sequence",
      scenarios: [
        {
          id: "short", label: "Short squeeze", symbol: "BTC—PERP / 15M", zone: "COMPRESSION", event: "FORCED BUYING",
          headline: "A rising price forces shorts to buy back.",
          description: "A tight range breaks, volume expands and forced short covering accelerates the move. One green candle is not enough; sequence and source agreement matter.",
          phases: ["Compression and rising imbalance", "Volume-confirmed breakout", "Short covering and expansion"],
          stats: [{ label: "PRICE VELOCITY", value: "+24.8%" }, { label: "VOLUME EXPANSION", value: "4.7×" }, { label: "EVIDENCE STATE", value: "SOURCE—BOUND" }],
        },
        {
          id: "long", label: "Long squeeze", symbol: "ETH—PERP / 15M", zone: "WEAK SUPPORT", event: "FORCED SELLING",
          headline: "Lost support triggers forced selling.",
          description: "Leverage works in reverse: weak rebounds fail to reclaim support, liquidations add supply and red candles accelerate together with volume.",
          phases: ["Support test and deterioration", "Cascade of long liquidations", "Deleveraging and spread expansion"],
          stats: [{ label: "DOWNSIDE VELOCITY", value: "−21.4%" }, { label: "VOLUME EXPANSION", value: "5.1×" }, { label: "REVIEW PRIORITY", value: "HIGH" }],
        },
        {
          id: "vacuum", label: "Liquidity vacuum", symbol: "SOL—USD / 5M", zone: "DEPTH WITHDRAWAL", event: "PRICE GAP",
          headline: "Price jumps because quotes disappear.",
          description: "A move does not require overwhelming demand. When depth vanishes near the mid, an ordinary order can cross several bands and create a price gap.",
          phases: ["Quote withdrawal and wider spread", "Thin book around reference mid", "Gap and non-linear market impact"],
          stats: [{ label: "DEPTH CHANGE", value: "−68%" }, { label: "SPREAD", value: "3.9×" }, { label: "FILL QUALITY", value: "DEGRADED" }],
        },
        {
          id: "whale", label: "Whale exit", symbol: "TOKEN—USD / 30M", zone: "EXCHANGE INFLOW", event: "EXIT STRESS",
          headline: "Supply concentration meets limited depth.",
          description: "A large transfer matters only after joining wallet labels, exchange inflow, supply share and an exit simulation across real order-book levels.",
          phases: ["Holder or cluster increases inflow", "Position consumes successive depth bands", "VWAP falls and fill becomes partial"],
          stats: [{ label: "TOP HOLDER EXIT", value: "8.4% SUPPLY" }, { label: "DEPTH USED", value: "93%" }, { label: "FILL RATIO", value: "87%" }],
        },
      ],
    },
    liquidityEyebrow: "04 / LIQUIDITY & MARKET IMPACT",
    liquidityTitle: "Liquidity is not a number beside price. It is the ability to exit.",
    liquidityIntro: "A large 24h volume does not tell you the price at which an order can actually execute. The model walks the book and measures VWAP, fill ratio and your own market impact.",
    liquidityPoints: ["Larger orders consume more layers of available depth.", "Market Impact separates screen price from executable price.", "Whale exit stress connects holder size with real depth."],
    liquidityCopy: {
      aria: "Interactive visualization of liquidity pouring into market depth",
      status: "DEPTH MODEL / LIVE",
      metrics: [
        { label: "REFERENCE MID", value: "STARTING POINT" },
        { label: "VWAP", value: "EXECUTION PATH" },
        { label: "FILL RATIO", value: "AVAILABLE SHARE" },
        { label: "MARKET IMPACT", value: "GROWS WITH DEPTH" },
      ],
      labels: { source: "ORDER FLOW", book: "AVAILABLE DEPTH", curve: "IMPACT CURVE", consumed: "BOOK WALK", remaining: "SOURCE STATE", reading: "MODEL READING" },
      bands: ["BEST ASK / 0–10 BPS", "NEAR BOOK / 10–25 BPS", "MID DEPTH / 25–50 BPS", "STRESS DEPTH / 50+ BPS"],
      flowSteps: ["Order reaches multiple venues", "Best quotes are filled first", "VWAP walks through the book", "Impact rises and fill can fall"],
      reading: "The stream explains sequence, not notional: an order takes the best quotes, walks successive depth bands, forms VWAP and only then reveals the real cost of exit.",
      caption: "The diagram explains execution mechanics without pretending to be a live market or investment advice.",
    },
    angelEyebrow: "05 / ANGEL — EVIDENCE INTERFACE",
    angelTitle: "Ask deeper. Receive an answer with an evidence boundary.",
    angelIntro: "Angel is not an independent opinion generator. It speaks to the same packet behind the score, terminal and report, so every answer can expose its source, confidence, gap and next safe check.",
    angelPoints: ["Answers bound to a defined scope", "Visible evidence and missing proof", "No invented sources or numbers"],
    angelCopy: {
      aria: "Interactive preview of the evidence-bound Angel assistant",
      status: "ANGEL / EVIDENCE-BOUND",
      scope: "PACKET QUESTION",
      evidence: "EVIDENCE",
      confidence: "CONFIDENCE",
      missing: "MISSING PROOF",
      prompt: "The answer exposes evidence, confidence bounds and the missing item; it does not generate a new score.",
      packet: "CANONICAL EVIDENCE PACKET",
      traceLabel: "ACTIVE EVIDENCE CHAIN",
      gateLabel: "ANSWER GATE",
      trace: [
        { label: "Market + execution", state: "FRESH" },
        { label: "Concentration", state: "STALE" },
        { label: "Provider consensus", state: "2 / 3" },
        { label: "Missing evidence", state: "01 OPEN" },
      ],
      questions: [
        { tab: "Risk vs confidence", question: "Why did confidence fall while risk stayed unchanged?", answer: "No new confirmed adverse signal appeared. The evidence base weakened, so risk remains stable while confidence is reduced independently.", evidence: ["Two price sources remain aligned", "Holder data exceeded its freshness window", "Depth provider returned a timeout"], confidence: "High / freshness-bounded", missing: "Current holder snapshot" },
        { tab: "Exit liquidity", question: "Can liquidity absorb a USD 250,000 exit?", answer: "The current model indicates a full fill in the base scenario, but impact increases non-linearly. Recheck immediately before execution.", evidence: ["Books from two independent venues", "100% base-scenario fill ratio", "Low spread divergence"], confidence: "Moderately high", missing: "Future depth after execution begins" },
        { tab: "Report readiness", question: "What must happen before the report is ready?", answer: "The packet is assembled, but delivery remains blocked until the source conflict and missing evidence are resolved. Advanced is not currently for sale and includes no human review or operator sign-off.", evidence: ["Packet ID and digest created", "Scope confirmed", "Open evidence gaps recorded"], confidence: "Limited by missing evidence", missing: "Conflict resolution + independent evidence" },
      ],
    },
    productNote: "One evidence discipline. Different information density for market, terminal, conversation and audit.",
    tierEyebrow: "07 / BASIC · PRO · ADVANCED",
    tierTitle: "Pay for evidence depth — never for a different truth.",
    tierIntro: "Every tier uses the same risk contract. Basic is a fast prescreen, Pro deepens automated analysis, and Advanced describes the broadest automated evidence scope. Advanced is not currently for sale and includes no human review or operator sign-off.",
    tierModal: {
      info: "Information", close: "Close", includes: "Full scope", bestFor: "Best for", deliverable: "Deliverable", boundary: "Tier boundary",
      details: {
        market: {
          basic: { summary: "A fast public prescreen of the same underlying truth about an asset. It exposes the principal outputs and gaps without pretending to be full execution or concentration analysis.", bestFor: "A first asset check and deciding whether deeper evidence is warranted.", deliverable: "A 10-signal result, principal drivers, risk/confidence/uncertainty and a short PDF preview.", boundary: "Execution is representative and limited; concentration remains shortened or locked." },
          pro: { summary: "A deeper automated analysis extending Basic with source freshness, broader context, liquidity, provider conflicts and a complete report.", bestFor: "Analysts who need a source-aware market picture without mandatory manual review.", deliverable: "14 signals, fuller depth/impact, a gap and conflict ledger, and the complete Pro PDF.", boundary: "Automated analysis only; it does not include mandatory human sign-off or the broadest exit stress." },
          advanced: { summary: "The broadest permitted market evidence layer: stress scenarios, Market Impact, Whale Watch, provider disagreement and review workflow.", bestFor: "Professional decisions involving large notionals, concentration and complex execution risk.", deliverable: "20 signals, deepest execution and concentration context, exit stress, complete missing-proof ledger and expanded PDF.", boundary: "Greater depth never changes the base risk contract or removes uncertainty created by missing data." },
        },
        audit: {
          basic: { summary: "A free passive prescreen using public data to find principal red flags and disclose what could not be confirmed.", bestFor: "Answering whether an obvious danger is visible and whether deeper audit work is required.", deliverable: "Target identity, public sources, basic permissions, principal flags, review priority and a short report.", boundary: "Not a full manual audit; absent adverse evidence may leave risk as Unknown." },
          pro: { summary: "A paid deep automation layer with a canonical contract packet, adding code/ABI, permissions, holder/liquidity/lock context, freshness, conflicts and digest binding.", bestFor: "Projects and buyers needing a broad automated evidence map without a fabricated human signature.", deliverable: "An expanded Pro PDF with findings, priorities, limitations, remediation and SHA-256 binding.", boundary: "Pro is not manually signed. Conflicts requiring judgment stay visible and may block readiness." },
          advanced: { summary: "The broadest designed automated analysis and evidence-pack scope. It is not currently offered to customers and includes no human review, human arbitration or operator sign-off.", bestFor: "Internal evaluation of a future due-diligence workflow after independent quality, scope and operational gates are proven.", deliverable: "A proposed expanded evidence pack, version comparison, conflict and missing-proof registers, and a recheck model — without a human-review claim.", boundary: "NOT_FOR_SALE: no public price, checkout, human review, operator sign-off or customer delivery until independent gates are closed." },
        },
      },
    },
    reportEyebrow: "08 / LENS & EVIDENCE REPORTS",
    reportTitle: "A report you can revisit. Evidence you can verify.",
    reportIntro: "A Velmère PDF is not a score screenshot or a long AI essay. It binds identity, scope, sources, limitations, packet version and SHA-256 into one case document.",
    reportBrowserCta: "Open in Velmère Browser",
    reportFields: ["Identity & scope", "Risk / confidence / uncertainty", "Sources & timestamps", "Missing evidence", "Limitations & remediation", "Packet ID / version / SHA-256"],
    securityEyebrow: "09 / PUBLIC METHOD · PRIVATE CORE",
    securityPrinciples: [
      { title: "Fail-closed delivery", detail: "Missing confirmation blocks delivery instead of impersonating approval." },
      { title: "Server-side entitlement", detail: "Paid access is created and checked on the server." },
      { title: "Provider resilience", detail: "Freshness, divergence, timeout and family diversity affect confidence." },
      { title: "Digest & receipts", detail: "Packet and report versions leave a verifiable integrity trail." },
    ],
    proofFootnote: "The statuses below describe public implementation state. They are not claims of accuracy, customer count or investment performance.",
  },
  de: {
    privateLabel: "PRIVATE ENTSCHEIDUNGSINFRASTRUKTUR",
    status: "EVIDENZSYSTEM / AKTIV",
    heroLine: "Risiko ist keine Zahl.",
    heroAccent: "Es ist ein Evidenzsystem.",
    heroObject: "KANONISCHES EVIDENZOBJEKT",
    metricNote: "Produktarchitektur — keine Leistungsbehauptung",
    metrics: [
      { value: "01", label: "gemeinsame Wahrheitsquelle" },
      { value: "05", label: "getrennte Entscheidungssignale" },
      { value: "04", label: "Evidenzdomänen" },
      { value: "03", label: "Tiefenstufen" },
    ],
    navLabel: "Intelligence-Kapitel",
    nav: [
      { label: "System", href: "#system-map" },
      { label: "Markt", href: "#scenario-lab" },
      { label: "Liquidität", href: "#liquidity-lab" },
      { label: "Angel", href: "#vlm-brain" },
      { label: "Stufen", href: "#intelligence-depth" },
      { label: "Bericht", href: "#reports" },
    ],
    systemEyebrow: "01 / EIN EVIDENZKERN",
    systemTitle: "Daten werden Evidenz. Evidenz wird Entscheidung.",
    systemIntro: "Velmère verbindet Markt, Ausführung, Kapitalkonzentration, Contract und Quellenzustand in einem versionierten Paket. Jedes Produkt liest dieselbe Wahrheit und zeigt nur die passende Tiefe.",
    technicalLabel: "TECHNISCH",
    technical: "Deterministic Risk Engine + Evidence Orchestration + KI-Erklärungsebene + Tier-Projektionen + SHA-256-gebundene Berichte.",
    humanLabel: "EINFACH GESAGT",
    human: "Die Maschine rät nicht. Sie ordnet Fakten, rechnet nach Regeln und lässt KI erst dann Bedeutung, Grenzen und offene Fragen erklären.",
    inputLabel: "DATENEBENEN",
    outputLabel: "PRODUKTOBERFLÄCHEN",
    packetLabel: "GEMEINSAMER KERN",
    packetTitle: "CANONICAL\nEVIDENCE PACKET",
    packetDetail: "Ein versioniertes Paket aus Daten, Quellen, Ergebnissen, Lücken und Offenlegungsregeln.",
    inputs: [
      { title: "Markt", detail: "Preis · Volumen · Volatilität" },
      { title: "Ausführung", detail: "Tiefe · VWAP · Slippage" },
      { title: "Konzentration", detail: "Halter · Cluster · Flows" },
      { title: "Contract", detail: "Code · Rollen · Findings" },
      { title: "Quellen", detail: "Aktualität · Divergenz · Health" },
    ],
    outputs: [
      { title: "Shield", detail: "Crypto Intelligence" },
      { title: "Real Markets", detail: "Cross-Asset" },
      { title: "Shield Pro", detail: "Terminal" },
      { title: "Angel", detail: "Evidence Q&A" },
      { title: "Security Audits", detail: "Review" },
      { title: "Lens / PDF", detail: "Bericht und Archiv" },
    ],
    oneTruth: "Dasselbe Paket. Dasselbe Basisergebnis. Passende Tiefe für die Aufgabe.",
    decisionsEyebrow: "02 / FÜNF ERGEBNISSE STATT EINES SCORES",
    decisionsTitle: "Eine ehrliche Entscheidung braucht mehr als eine Zahl.",
    decisionsIntro: "Risiko, Evidenzqualität und Berichtsreife sind nicht austauschbar. Fehlende Daten dürfen weder Sicherheit noch eine bestätigte Bedrohung vortäuschen.",
    decisions: [
      { title: "Risk", description: "Intensität bestätigter negativer Signale." },
      { title: "Confidence", description: "Stärke und Konsistenz der Evidenz." },
      { title: "Uncertainty", description: "Fehlende, alte oder widersprüchliche Daten." },
      { title: "Review priority", description: "Dringlichkeit zusätzlicher Kontrolle." },
      { title: "Readiness", description: "Sichere Lieferbereitschaft der Analyse." },
    ],
    squeezeEyebrow: "03 / MARKET BEHAVIOR — SCENARIO LAB",
    squeezeTitle: "Der Preis zeigt die Wirkung. Die Evidenzsequenz zeigt die Ursache.",
    squeezeIntro: "Velmère nennt nicht jede heftige Bewegung einen Squeeze. Kerzen, Volumen, Imbalance, Tiefe und Konzentration trennen erzwungene Positionsauflösung, verschwindende Liquidität und Whale Exits.",
    squeezePoints: ["Short und Long Squeeze brauchen einen durch Volumen bestätigten Richtungsbruch.", "Ein Liquidity Vacuum entsteht durch zurückgezogene Quotes, nicht nur durch Nachfrage.", "Whale Exit Stress verbindet Konzentration, Exchange Flows und ausführbare Tiefe."],
    squeezeCopy: {
      aria: "Interaktive Kerzenanimationen für vier Marktverhaltensszenarien",
      status: "SZENARIO AKTIV",
      replay: "Wiederholen",
      selectLabel: "Marktszenario auswählen",
      legend: ["Kerzen / Richtung", "Evidenzereignis", "Volumen"],
      phasesLabel: "Szenarioabfolge",
      scenarios: [
        { id: "short", label: "Short Squeeze", symbol: "BTC—PERP / 15M", zone: "KOMPRESSION", event: "FORCED BUYING", headline: "Steigende Preise zwingen Shorts zum Rückkauf.", description: "Eine enge Range bricht, das Volumen steigt und erzwungenes Short Covering beschleunigt die Bewegung. Eine grüne Kerze allein reicht nicht.", phases: ["Kompression und steigende Imbalance", "Volumenbestätigter Ausbruch", "Short Covering und Expansion"], stats: [{ label: "PRICE VELOCITY", value: "+24,8%" }, { label: "VOLUME EXPANSION", value: "4,7×" }, { label: "EVIDENCE STATE", value: "SOURCE—BOUND" }] },
        { id: "long", label: "Long Squeeze", symbol: "ETH—PERP / 15M", zone: "SCHWACHER SUPPORT", event: "FORCED SELLING", headline: "Verlorener Support löst Zwangsverkäufe aus.", description: "Schwache Erholungen gewinnen den Support nicht zurück, Liquidationen erhöhen das Angebot und rote Kerzen beschleunigen zusammen mit dem Volumen.", phases: ["Support-Test und Abschwächung", "Kaskade von Long-Liquidationen", "Deleveraging und Spread-Ausweitung"], stats: [{ label: "DOWNSIDE VELOCITY", value: "−21,4%" }, { label: "VOLUME EXPANSION", value: "5,1×" }, { label: "REVIEW PRIORITY", value: "HIGH" }] },
        { id: "vacuum", label: "Liquidity Vacuum", symbol: "SOL—USD / 5M", zone: "DEPTH WITHDRAWAL", event: "PRICE GAP", headline: "Der Preis springt, weil Quotes verschwinden.", description: "Wenn Tiefe nahe dem Mid verschwindet, kann selbst ein gewöhnlicher Auftrag mehrere Bänder durchlaufen und eine Preislücke erzeugen.", phases: ["Quote-Rückzug und breiterer Spread", "Dünnes Buch um den Reference Mid", "Gap und nichtlinearer Market Impact"], stats: [{ label: "DEPTH CHANGE", value: "−68%" }, { label: "SPREAD", value: "3,9×" }, { label: "FILL QUALITY", value: "DEGRADED" }] },
        { id: "whale", label: "Whale Exit", symbol: "TOKEN—USD / 30M", zone: "EXCHANGE INFLOW", event: "EXIT STRESS", headline: "Angebotskonzentration trifft begrenzte Tiefe.", description: "Ein großer Transfer wird erst durch Wallet-Labels, Exchange Inflow, Angebotsanteil und eine Exit-Simulation über reale Orderbuchstufen aussagekräftig.", phases: ["Holder oder Cluster erhöht Inflow", "Position verbraucht mehrere Depth Bands", "VWAP fällt und Fill wird teilweise"], stats: [{ label: "TOP HOLDER EXIT", value: "8,4% SUPPLY" }, { label: "DEPTH USED", value: "93%" }, { label: "FILL RATIO", value: "87%" }] },
      ],
    },
    liquidityEyebrow: "04 / LIQUIDITY & MARKET IMPACT",
    liquidityTitle: "Liquidität ist keine Zahl neben dem Preis. Sie ist die Fähigkeit zum Exit.",
    liquidityIntro: "Hohes 24h-Volumen sagt nicht, zu welchem Preis ein Auftrag wirklich ausgeführt wird. Das Modell misst VWAP, Fill Ratio und den eigenen Market Impact.",
    liquidityPoints: ["Größere Aufträge verbrauchen mehr Tiefenschichten.", "Market Impact trennt Bildschirm- vom Ausführungspreis.", "Whale Exit Stress verbindet Holdergröße mit realer Tiefe."],
    liquidityCopy: {
      aria: "Interaktive Visualisierung von Liquidität und Markttiefe",
      status: "DEPTH MODEL / LIVE",
      metrics: [
        { label: "REFERENCE MID", value: "AUSGANGSPUNKT" },
        { label: "VWAP", value: "AUSFÜHRUNGSPFAD" },
        { label: "FILL RATIO", value: "VERFÜGBARER ANTEIL" },
        { label: "MARKET IMPACT", value: "STEIGT MIT DER TIEFE" },
      ],
      labels: { source: "AUFTRAGSFLUSS", book: "VERFÜGBARE TIEFE", curve: "IMPACT-KURVE", consumed: "BOOK WALK", remaining: "QUELLSTATUS", reading: "MODELL-LESEART" },
      bands: ["BEST ASK / 0–10 BPS", "NEAR BOOK / 10–25 BPS", "MID DEPTH / 25–50 BPS", "STRESS DEPTH / 50+ BPS"],
      flowSteps: ["Auftrag erreicht mehrere Venues", "Beste Quotes werden zuerst gefüllt", "VWAP wandert durch das Buch", "Impact steigt und Fill kann sinken"],
      reading: "Der Strom zeigt die Reihenfolge, nicht das Volumen: Ein Auftrag nimmt die besten Quotes, durchläuft weitere Tiefenbänder, bildet den VWAP und macht erst dann die realen Exit-Kosten sichtbar.",
      caption: "Das Diagramm erklärt Ausführungsmechanik, ohne Live-Markt oder Anlageberatung vorzutäuschen.",
    },
    angelEyebrow: "05 / ANGEL — EVIDENCE INTERFACE",
    angelTitle: "Tiefer fragen. Eine Antwort mit Evidenzgrenze erhalten.",
    angelIntro: "Angel ist kein unabhängiger Meinungsgenerator. Er spricht mit demselben Paket wie Score, Terminal und Bericht und zeigt Quelle, Confidence, Lücke und nächsten sicheren Check.",
    angelPoints: ["Antworten mit klarem Scope", "Sichtbare Evidenz und Missing Proof", "Keine erfundenen Quellen oder Zahlen"],
    angelCopy: {
      aria: "Interaktive Vorschau des evidenzgebundenen Angel-Assistenten",
      status: "ANGEL / EVIDENCE-BOUND",
      scope: "FRAGE AN DAS PAKET",
      evidence: "EVIDENZ",
      confidence: "CONFIDENCE",
      missing: "MISSING PROOF",
      prompt: "Die Antwort zeigt Evidenz, Konfidenzgrenze und die fehlende Information; sie erzeugt keinen neuen Score.",
      packet: "CANONICAL EVIDENCE PACKET",
      traceLabel: "AKTIVE EVIDENZKETTE",
      gateLabel: "ANTWORT-GATE",
      trace: [{ label: "Market + Execution", state: "FRESH" }, { label: "Concentration", state: "STALE" }, { label: "Provider Consensus", state: "2 / 3" }, { label: "Missing Evidence", state: "01 OPEN" }],
      questions: [
        { tab: "Risk vs Confidence", question: "Warum sank Confidence, obwohl Risk gleich blieb?", answer: "Kein neues bestätigtes negatives Signal erschien. Die Evidenzbasis wurde schwächer; deshalb bleibt Risk stabil, während Confidence separat sinkt.", evidence: ["Zwei Preisquellen bleiben konsistent", "Holder-Daten überschritten das Aktualitätsfenster", "Depth Provider meldete Timeout"], confidence: "Hoch / durch Aktualität begrenzt", missing: "Aktueller Holder-Snapshot" },
        { tab: "Exit-Liquidität", question: "Reicht die Liquidität für einen Exit von 250.000 USD?", answer: "Das Basisszenario zeigt vollständige Ausführung, aber der Impact steigt nichtlinear. Unmittelbar vor der Ausführung erneut prüfen.", evidence: ["Orderbücher zweier unabhängiger Venues", "100% Fill Ratio im Basisszenario", "Geringe Spread-Divergenz"], confidence: "Moderat hoch", missing: "Künftige Tiefe nach Ausführungsbeginn" },
        { tab: "Berichtsreife", question: "Was fehlt, bevor der Bericht bereit ist?", answer: "Das Paket ist erstellt, die Lieferung bleibt jedoch bis zur Lösung des Quellenkonflikts und der fehlenden Evidenz blockiert. Advanced ist derzeit nicht im Verkauf und enthält weder Human Review noch Operator Sign-off.", evidence: ["Packet ID und Digest erstellt", "Scope bestätigt", "Offene Evidenzlücken dokumentiert"], confidence: "Durch fehlende Evidenz begrenzt", missing: "Konfliktlösung + unabhängige Evidenz" },
      ],
    },
    productNote: "Eine Evidenzdisziplin. Andere Informationsdichte für Markt, Terminal, Dialog und Audit.",
    tierEyebrow: "07 / BASIC · PRO · ADVANCED",
    tierTitle: "Für Evidenztiefe zahlen — niemals für eine andere Wahrheit.",
    tierIntro: "Jede Stufe nutzt denselben Risk Contract. Basic bietet den Prescreen, Pro vertieft die Automation und Advanced beschreibt den breitesten automatisierten Evidenzumfang. Advanced ist derzeit nicht im Verkauf und enthält weder Human Review noch Operator Sign-off.",
    tierModal: {
      info: "Informationen", close: "Schließen", includes: "Vollständiger Umfang", bestFor: "Geeignet für", deliverable: "Lieferumfang", boundary: "Stufengrenze",
      details: {
        market: {
          basic: { summary: "Schneller öffentlicher Prescreen derselben Basiswahrheit über ein Asset mit den wichtigsten Ergebnissen und Lücken.", bestFor: "Erste Asset-Prüfung und Entscheidung über eine tiefere Analyse.", deliverable: "10 Signale, Haupttreiber, Risk/Confidence/Uncertainty und kurze PDF-Vorschau.", boundary: "Execution ist repräsentativ und begrenzt; Concentration bleibt verkürzt oder gesperrt." },
          pro: { summary: "Tiefe automatische Analyse mit Aktualität, Quellenvergleich, Liquidität, Konflikten und vollständigem Bericht.", bestFor: "Analysten, die einen source-aware Marktüberblick ohne Pflicht-Review brauchen.", deliverable: "14 Signale, tiefere Depth/Impact-Daten, Gap-Ledger und vollständiges Pro-PDF.", boundary: "Automatisiert; ohne obligatorisches menschliches Sign-off und breitesten Exit Stress." },
          advanced: { summary: "Breiteste Marktevidenz mit Stressszenarien, Market Impact, Whale Watch, Provider-Konflikten und Review-Workflow.", bestFor: "Professionelle Entscheidungen mit großem Nominal, Konzentration und komplexem Ausführungsrisiko.", deliverable: "20 Signale, tiefste Execution/Concentration, Exit Stress, Missing-Proof-Ledger und erweitertes PDF.", boundary: "Mehr Tiefe ändert weder den Risk Contract noch entfernt sie Unsicherheit durch fehlende Daten." },
        },
        audit: {
          basic: { summary: "Kostenloser passiver Prescreen öffentlicher Daten für zentrale Red Flags und sichtbare Evidenzlücken.", bestFor: "Schnelle Entscheidung, ob unmittelbare Gefahr sichtbar ist und ein tieferer Audit nötig wird.", deliverable: "Target-Identität, öffentliche Quellen, Basis-Permissions, Hauptflags, Review Priority und Kurzbericht.", boundary: "Kein vollständiger manueller Audit; ohne adverse Evidenz kann Risk Unknown bleiben." },
          pro: { summary: "Tiefer bezahlter Automat mit Canonical Contract Packet, Code/ABI, Permissions, Holder/Liquidity/Lock, Aktualität, Konflikten und Digest.", bestFor: "Breite automatische Evidenzprüfung ohne vorgetäuschte menschliche Signatur.", deliverable: "Erweitertes Pro-PDF mit Findings, Prioritäten, Limits, Remediation und SHA-256-Bindung.", boundary: "Nicht manuell signiert; Konflikte mit Urteilsbedarf bleiben sichtbar und können Readiness blockieren." },
          advanced: { summary: "Breitester geplanter Umfang automatisierter Analyse und Evidence Pack. Der Umfang wird derzeit nicht verkauft und enthält weder Human Review, menschliche Konfliktentscheidung noch Operator Sign-off.", bestFor: "Interne Bewertung eines künftigen Due-Diligence-Workflows nach unabhängiger Bestätigung von Qualität, Scope und Betrieb.", deliverable: "Entwurf eines erweiterten Evidence Packs, Versionsvergleich, Konflikt- und Missing-Proof-Register sowie Recheck-Modell — ohne Human-Review-Claim.", boundary: "NOT_FOR_SALE: kein öffentlicher Preis, Checkout, Human Review, Operator Sign-off oder Customer Delivery vor Schließung unabhängiger Gates." },
        },
      },
    },
    reportEyebrow: "08 / LENS & EVIDENCE REPORTS",
    reportTitle: "Ein Bericht, zu dem man zurückkehren kann. Evidenz, die prüfbar bleibt.",
    reportIntro: "Ein Velmère PDF ist weder Score-Screenshot noch langer KI-Text. Identität, Scope, Quellen, Grenzen, Paketversion und SHA-256 werden zu einem Falldokument verbunden.",
    reportBrowserCta: "Im Velmère Browser öffnen",
    reportFields: ["Identity & scope", "Risk / confidence / uncertainty", "Sources & timestamps", "Missing evidence", "Limitations & remediation", "Packet ID / version / SHA-256"],
    securityEyebrow: "09 / ÖFFENTLICHE METHODE · PRIVATER KERN",
    securityPrinciples: [
      { title: "Fail-closed delivery", detail: "Fehlende Bestätigung blockiert die Lieferung statt Zustimmung vorzutäuschen." },
      { title: "Server-side entitlement", detail: "Bezahlter Zugang entsteht und wird serverseitig geprüft." },
      { title: "Provider resilience", detail: "Aktualität, Divergenz, Timeout und Familienvielfalt beeinflussen Confidence." },
      { title: "Digest & receipts", detail: "Paket- und Berichtsversion hinterlassen eine prüfbare Integritätsspur." },
    ],
    proofFootnote: "Die folgenden Statuswerte beschreiben den öffentlichen Implementierungsstand — keine Aussage zu Genauigkeit, Kundenanzahl oder Anlageerfolg.",
  },
};

export default function IntelligencePage({ locale, copy, marketTiers, auditTiers, proofMetrics }: IntelligencePageProps) {
  const localized = (href: string) => `/${locale}${href}`;
  const narrative = narratives[locale];
  const depthCopy = getIntelligenceDepthCopy(locale);
  const outcomeIcons = [ShieldCheck, Gauge, ScanSearch, Layers3, CircleCheck];
  const productIcons = [ShieldCheck, Waves, Gauge, Braces];
  const proofStatus = (status: PublicIntelligenceMetric["status"]) => status === "engineered"
    ? copy.proof.statuses.engineered
    : status === "source_bound"
      ? copy.proof.statuses.sourceBound
      : copy.proof.statuses.pending;

  return (
    <main className={styles.page} data-intelligence-page="velmere-evidence-intelligence">
      <IntelligenceScrollMotion />

      <section className={styles.hero} aria-labelledby="intelligence-title">
        <div className={styles.heroBackdrop} aria-hidden="true" />
        <div className={styles.heroShell}>
          <div className={styles.heroTopline}>
            <span>{narrative.privateLabel}</span>
            <span>EUROPE / {locale.toUpperCase()} / INTELLIGENCE 01</span>
          </div>
          <div className={styles.heroGrid}>
            <div className={styles.heroCopy}>
              <span className={styles.eyebrow}>{copy.hero.eyebrow}</span>
              <h1 id="intelligence-title">{narrative.heroLine}<em>{narrative.heroAccent}</em></h1>
              <p>{copy.hero.intro}</p>
              <div className={styles.heroActions}>
                <a href="#system-map" className={styles.primaryButton}>{copy.hero.primary}<ArrowRight size={16} /></a>
                <Link href={localized("/market-integrity")} className={styles.secondaryButton}>{copy.hero.secondary}<ArrowRight size={15} /></Link>
              </div>
              <div className={styles.heroProofLine}>
                {copy.hero.proofLine.map((item) => <span key={item}><i />{item}</span>)}
              </div>
            </div>
            <div className={styles.heroStage}>
              <IntelligenceHero3D legend={copy.hero.legend} statusLabel={narrative.status} />
              <span className={styles.heroObjectLabel}>{narrative.heroObject}</span>
            </div>
          </div>
          <div className={styles.heroMetrics} aria-label={narrative.metricNote}>
            {narrative.metrics.map((metric) => <div key={metric.label}><strong>{metric.value}</strong><span>{metric.label}</span></div>)}
            <small>{narrative.metricNote}</small>
          </div>
        </div>
      </section>

      <section id="system-map" className={`${styles.chapter} ${styles.systemChapter}`}>
        <div className={styles.chapterIndex} aria-hidden="true">01</div>
        <header className={styles.editorialHeader} data-reveal>
          <span>{narrative.systemEyebrow}</span>
          <h2>{narrative.systemTitle}</h2>
          <p>{narrative.systemIntro}</p>
        </header>

        <div className={styles.systemStatement} data-reveal>
          <article><span>{narrative.technicalLabel}</span><p>{narrative.technical}</p></article>
          <i />
          <article><span>{narrative.humanLabel}</span><p>{narrative.human}</p></article>
        </div>

        <div id="output-path" className={styles.architectureMap} data-reveal>
          <div className={styles.architectureColumn}>
            <span>{narrative.inputLabel}</span>
            <ol>
              {narrative.inputs.map((item, index) => (
                <li key={item.title}><small>0{index + 1}</small><div><b>{item.title}</b><em>{item.detail}</em></div><i /></li>
              ))}
            </ol>
          </div>
          <div className={styles.packetCore}>
            <div className={styles.packetOrbit} aria-hidden="true"><i /><i /><i /></div>
            <Fingerprint size={31} />
            <span>{narrative.packetLabel}</span>
            <h3>{narrative.packetTitle.split("\n").map((line) => <span key={line}>{line}</span>)}</h3>
            <p>{narrative.packetDetail}</p>
            <small>PACKET ID · VERSION · SHA—256</small>
          </div>
          <div className={`${styles.architectureColumn} ${styles.architectureOutput}`}>
            <span>{narrative.outputLabel}</span>
            <ol>
              {narrative.outputs.map((item, index) => (
                <li key={item.title}><i /><small>0{index + 1}</small><div><b>{item.title}</b><em>{item.detail}</em></div></li>
              ))}
            </ol>
          </div>
          <footer><Database size={16} /><span>{narrative.oneTruth}</span><b>ONE SOURCE OF TRUTH / 01</b></footer>
        </div>
      </section>

      <section id="risk-engine" className={`${styles.chapter} ${styles.decisionChapter}`}>
        <header className={styles.splitHeader} data-reveal>
          <div><span>{narrative.decisionsEyebrow}</span><h2>{narrative.decisionsTitle}</h2></div>
          <p>{narrative.decisionsIntro}</p>
        </header>
        <div className={styles.decisionGrid} data-reveal>
          {narrative.decisions.map((item, index) => {
            const Icon = outcomeIcons[index];
            return (
              <article key={item.title} data-highlight={index === 0 ? "true" : "false"}>
                <div><small>0{index + 1}</small><Icon size={19} /></div>
                <h3>{item.title}</h3>
                <p>{item.description}</p>
                <i />
              </article>
            );
          })}
        </div>
      </section>

      <section id="scenario-lab" className={`${styles.chapter} ${styles.marketChapter}`}>
        <div className={styles.featureGrid}>
          <header className={styles.featureCopy} data-reveal>
            <span>{narrative.squeezeEyebrow}</span>
            <h2>{narrative.squeezeTitle}</h2>
            <p>{narrative.squeezeIntro}</p>
            <ul>{narrative.squeezePoints.map((item) => <li key={item}><i />{item}</li>)}</ul>
          </header>
          <div data-reveal><SqueezeExperience copy={narrative.squeezeCopy} /></div>
        </div>
      </section>

      <section id="liquidity-lab" className={`${styles.chapter} ${styles.liquidityChapter}`}>
        <div id="impact-whale" className={styles.featureGrid}>
          <header className={styles.featureCopy} data-reveal>
            <span>{narrative.liquidityEyebrow}</span>
            <h2>{narrative.liquidityTitle}</h2>
            <p>{narrative.liquidityIntro}</p>
            <ul>{narrative.liquidityPoints.map((item) => <li key={item}><i />{item}</li>)}</ul>
          </header>
          <div data-reveal><LiquidityExperience copy={narrative.liquidityCopy} /></div>
        </div>
      </section>

      <section id="vlm-brain" className={`${styles.chapter} ${styles.angelChapter}`}>
        <header className={styles.splitHeader} data-reveal>
          <div><span>{narrative.angelEyebrow}</span><h2>{narrative.angelTitle}</h2></div>
          <div className={styles.angelIntro}><p>{narrative.angelIntro}</p><ul>{narrative.angelPoints.map((item) => <li key={item}><Check size={13} />{item}</li>)}</ul></div>
        </header>
        <div id="angel-evidence" data-reveal><AngelExperience copy={narrative.angelCopy} /></div>
      </section>

      <section id="product-surfaces" className={`${styles.chapter} ${styles.productChapter}`}>
        <header className={styles.splitHeader} data-reveal>
          <div><span>06 / {copy.products.eyebrow}</span><h2>{copy.products.title}</h2></div>
          <p>{narrative.productNote}</p>
        </header>
        <div className={styles.productGrid} data-reveal>
          {copy.products.items.map((item, index) => {
            const Icon = productIcons[index];
            return (
              <Link key={item.id} href={localized(item.href)} className={styles.productCard} data-product={item.id}>
                <div className={styles.productCardVisual}><Icon size={26} /><i /><i /><i /></div>
                <div className={styles.productCardTopline}><small>0{index + 1}</small><span>{item.kicker}</span></div>
                <h3>{item.title}</h3>
                <p>{item.description}</p>
                <b>{item.cta}<ArrowRight size={15} /></b>
              </Link>
            );
          })}
        </div>
      </section>

      <section id="intelligence-depth" className={`${styles.chapter} ${styles.tierChapter}`}>
        <header className={styles.centerHeader} data-reveal>
          <span>{narrative.tierEyebrow}</span>
          <h2>{narrative.tierTitle}</h2>
          <p>{narrative.tierIntro}</p>
        </header>
        <div data-reveal>
          <TierDeck
            copy={{
              marketTab: copy.tiers.marketTab,
              auditTab: copy.tiers.auditTab,
              recommended: copy.tiers.recommended,
              signals: copy.tiers.signalsLabel,
              ...narrative.tierModal,
              note: copy.tiers.note,
            }}
            marketTiers={marketTiers}
            auditTiers={auditTiers}
            marketFeatures={copy.tiers.marketFeatures}
            auditFeatures={copy.tiers.auditFeatures}
          />
        </div>
      </section>

      <section id="reports" className={`${styles.chapter} ${styles.reportChapter}`}>
        <div className={styles.reportGrid}>
          <div className={styles.reportVisual} data-reveal aria-hidden="true">
            <div className={styles.reportShadow} />
            <div className={styles.reportSheet} data-sheet="back" />
            <div className={styles.reportSheet} data-sheet="middle" />
            <div className={styles.reportCover}>
              <div className={styles.reportBrand}><span>VELMÈRE</span><small>INTELLIGENCE</small></div>
              <span className={styles.reportEdition}>EVIDENCE REPORT / 07</span>
              <h3>ORION CAPITAL<br />RISK ASSESSMENT</h3>
              <div className={styles.reportAsset}><span>ASSET / SCOPE</span><b>BTC · MARKET & EXECUTION</b></div>
              <div className={styles.reportRadar}><i /><i /><i /><b>42</b></div>
              <dl>
                <div><dt>RISK</dt><dd>MODERATE</dd></div>
                <div><dt>CONFIDENCE</dt><dd>HIGH</dd></div>
                <div><dt>READINESS</dt><dd>VERIFIED</dd></div>
              </dl>
              <div className={styles.reportDigest}><Fingerprint size={12} />SHA—256 / 7F3A…91C8</div>
            </div>
          </div>
          <div className={styles.reportCopy} data-reveal>
            <span>{narrative.reportEyebrow}</span>
            <h2>{narrative.reportTitle}</h2>
            <p>{narrative.reportIntro}</p>
            <ul>{narrative.reportFields.map((field) => <li key={field}><Check size={14} />{field}</li>)}</ul>
            <Link href={localized("/search")} className={styles.secondaryButton}>{narrative.reportBrowserCta}<ArrowRight size={15} /></Link>
            <div className={styles.reportMeta}>
              <div><strong>{String(depthCopy.report.stages.length).padStart(2, "0")}</strong><span>HANDOFF STAGES</span></div>
              <div><strong>03</strong><span>LANGUAGES</span></div>
              <div><strong>256</strong><span>BIT DIGEST</span></div>
            </div>
          </div>
        </div>
      </section>

      <section id="assurance" className={`${styles.chapter} ${styles.securityChapter}`}>
        <header className={styles.splitHeader} data-reveal>
          <div><span>{narrative.securityEyebrow}</span><h2>{copy.boundary.title}</h2></div>
          <p>{copy.boundary.intro}</p>
        </header>
        <div className={styles.boundaryGrid} data-reveal>
          <article>
            <ShieldCheck size={22} />
            <span>PUBLIC / METHOD</span>
            <h3>{copy.boundary.publicTitle}</h3>
            <ul>{copy.boundary.publicItems.map((item) => <li key={item}><Check size={13} />{item}</li>)}</ul>
          </article>
          <article data-private="true">
            <LockKeyhole size={22} />
            <span>PRIVATE / CORE</span>
            <h3>{copy.boundary.privateTitle}</h3>
            <ul>{copy.boundary.privateItems.map((item) => <li key={item}><i />{item}</li>)}</ul>
            <small>{copy.boundary.redacted}</small>
          </article>
        </div>
        <div className={styles.securityPrinciples} data-reveal>
          {narrative.securityPrinciples.map((item, index) => <article key={item.title}><small>0{index + 1}</small><h3>{item.title}</h3><p>{item.detail}</p></article>)}
        </div>
      </section>

      <section className={`${styles.chapter} ${styles.proofChapter}`}>
        <header className={styles.centerHeader} data-reveal>
          <span>10 / {copy.proof.eyebrow}</span>
          <h2>{copy.proof.title}</h2>
          <p>{copy.proof.intro}</p>
        </header>
        <div className={styles.proofManifest} data-reveal>
          <div className={styles.proofManifestTopline}><span>PUBLIC EVIDENCE MANIFEST</span><small>{copy.proof.publication} · 2026—07—16</small></div>
          {proofMetrics.map((metric, index) => (
            <article key={metric.id} data-status={metric.status}>
              <small>0{index + 1}</small>
              <div><span>{metric.label[locale]}</span><b>{metric.receiptId}</b></div>
              <strong>{metric.value[locale]}</strong>
              <em><i />{proofStatus(metric.status)}</em>
            </article>
          ))}
        </div>
        <p className={styles.proofFootnote}>{narrative.proofFootnote}</p>
      </section>

      <section className={styles.finalCta}>
        <div className={styles.finalOrbit} aria-hidden="true"><i /><i /><i /></div>
        <span>{copy.finalCta.eyebrow}</span>
        <h2>{copy.finalCta.title}</h2>
        <p>{copy.finalCta.description}</p>
        <div>
          <Link href={localized("/market-integrity")} className={styles.primaryButton}>{copy.finalCta.primary}<ArrowRight size={16} /></Link>
          <RiskMethodologyModal locale={locale} label={copy.finalCta.secondary} />
        </div>
        <small>VELMÈRE / EVIDENCE BEFORE CONCLUSIONS</small>
      </section>
    </main>
  );
}
