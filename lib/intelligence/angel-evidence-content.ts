import type { IntelligenceLocale } from "./intelligence-content";

export type AngelEvidenceQuestionId =
  | "confidence-cap"
  | "lane-moved"
  | "missing-evidence"
  | "downgrade"
  | "increase-confidence"
  | "human-review";

export type AngelEvidenceQuestion = {
  id: AngelEvidenceQuestionId;
  shortLabel: string;
  question: string;
  status: string;
  conclusion: string;
  evidence: string[];
  limitations: string;
  freshness: string;
  nextCheck: string;
};

export type AngelEvidenceCopy = {
  eyebrow: string;
  title: string;
  intro: string;
  selectorLabel: string;
  answerLabel: string;
  traceLabel: string;
  liveLabel: string;
  layerLabels: {
    conclusion: string;
    evidence: string;
    limitations: string;
    freshness: string;
    nextCheck: string;
  };
  questions: AngelEvidenceQuestion[];
};

const en: AngelEvidenceCopy = {
  eyebrow: "ANGEL · EVIDENCE Q&A",
  title: "Ask the conclusion. Inspect the path behind it.",
  intro: "Angel answers from the same evidence discipline as Velmère Intelligence. Every response separates what is supported, what remains limited and what should be checked next.",
  selectorLabel: "Questions Angel can answer",
  answerLabel: "Evidence-bound answer",
  traceLabel: "Answer structure",
  liveLabel: "Selected question",
  layerLabels: {
    conclusion: "Conclusion",
    evidence: "Evidence",
    limitations: "Limitations",
    freshness: "Freshness",
    nextCheck: "Next safe check",
  },
  questions: [
    {
      id: "confidence-cap",
      shortLabel: "Confidence cap",
      question: "Why is confidence capped?",
      status: "Evidence incomplete",
      conclusion: "Confidence is capped because the observed market signal is stronger than the available corroboration.",
      evidence: ["Price structure agrees across current market observations", "Liquidity context is present but not independently verified", "A second flow source is not available in the current packet"],
      limitations: "The conclusion can describe the observed direction, but it cannot claim broad cross-source confirmation.",
      freshness: "The primary market observation is current; one supporting evidence family is missing rather than stale.",
      nextCheck: "Add an independent flow source and verify the same observation inside the current market window.",
    },
    {
      id: "lane-moved",
      shortLabel: "Lane movement",
      question: "Which lane moved the result?",
      status: "Liquidity led",
      conclusion: "Liquidity and exit depth contributed the largest change to the result; price direction alone was not decisive.",
      evidence: ["Displayed depth weakened near the active price", "Estimated slippage widened for the reference order", "Price structure remained inside its prior range"],
      limitations: "The lane contribution explains the current result, not the cause of the underlying liquidity change.",
      freshness: "Depth and price observations were evaluated inside the same synchronized window.",
      nextCheck: "Compare venue depth and repeat the impact estimate before increasing execution size.",
    },
    {
      id: "missing-evidence",
      shortLabel: "Missing evidence",
      question: "What evidence is missing?",
      status: "One gap found",
      conclusion: "The packet is missing independently verified holder-flow evidence needed to strengthen the concentration interpretation.",
      evidence: ["Holder concentration is available from the primary source", "Exchange-flow context is only partially observed", "No corroborating wallet-label source is attached"],
      limitations: "Concentration can be reported, but intent and destination cannot be inferred responsibly.",
      freshness: "The available holder snapshot is current; the missing family has no timestamp because it was not supplied.",
      nextCheck: "Attach a second holder or wallet-label source before interpreting transfers as accumulation or exit pressure.",
    },
    {
      id: "downgrade",
      shortLabel: "Downgrade logic",
      question: "Why was the output downgraded?",
      status: "Depth reduced",
      conclusion: "The requested depth exceeded the verified evidence surface, so Velmère returned the strongest supportable result instead.",
      evidence: ["Core price and liquidity lanes passed verification", "Advanced provenance was incomplete", "The requested claim required evidence from an unavailable family"],
      limitations: "A downgraded result is narrower, not automatically safer or more positive.",
      freshness: "Verified inputs remain current; the downgrade is caused by coverage, not expired data.",
      nextCheck: "Supply the missing provenance record, then rerun the deeper analysis against the same asset context.",
    },
    {
      id: "increase-confidence",
      shortLabel: "Increase confidence",
      question: "What would increase confidence?",
      status: "Two checks available",
      conclusion: "Confidence would rise if the current signal were corroborated by an independent source and persisted across another observation window.",
      evidence: ["The primary signal is internally consistent", "Current source freshness is acceptable", "Cross-source agreement and persistence are not yet established"],
      limitations: "More data only helps when it is independent, relevant and recent; volume alone is not corroboration.",
      freshness: "The present packet is current enough to extend rather than restart the evidence path.",
      nextCheck: "Verify a second source now, then confirm whether the same structure remains after the next synchronized window.",
    },
    {
      id: "human-review",
      shortLabel: "Manual QA",
      question: "What requires manual QA?",
      status: "Escalation boundary",
      conclusion: "Contract authority and issuer-context ambiguity require review before the result can support a high-consequence decision.",
      evidence: ["A privileged authority is visible in the permission map", "The public source does not explain the operational purpose", "No verified governance record resolves the ambiguity"],
      limitations: "Automation can identify the boundary and evidence gap, but it should not invent motive or legal meaning.",
      freshness: "The permission observation is current; the explanatory governance record is absent.",
      nextCheck: "Escalate the authority record, governance documentation and owner context to a qualified reviewer.",
    },
  ],
};

const pl: AngelEvidenceCopy = {
  eyebrow: "ANGEL · PYTANIA DO DOWODÓW",
  title: "Zapytaj o wniosek. Sprawdź ścieżkę, która za nim stoi.",
  intro: "Angel odpowiada według tej samej dyscypliny dowodowej co Velmère Intelligence. Każda odpowiedź oddziela to, co potwierdzone, od ograniczeń i następnego bezpiecznego kroku.",
  selectorLabel: "Pytania, na które Angel odpowiada",
  answerLabel: "Odpowiedź związana z dowodami",
  traceLabel: "Struktura odpowiedzi",
  liveLabel: "Wybrane pytanie",
  layerLabels: {
    conclusion: "Wniosek",
    evidence: "Dowody",
    limitations: "Ograniczenia",
    freshness: "Świeżość",
    nextCheck: "Następny bezpieczny krok",
  },
  questions: [
    {
      id: "confidence-cap",
      shortLabel: "Limit pewności",
      question: "Dlaczego pewność jest ograniczona?",
      status: "Niepełne dowody",
      conclusion: "Pewność jest ograniczona, ponieważ obserwowany sygnał rynkowy jest silniejszy niż dostępne potwierdzenie z niezależnych źródeł.",
      evidence: ["Struktura ceny jest zgodna w aktualnych obserwacjach rynku", "Kontekst płynności jest dostępny, ale nie został niezależnie potwierdzony", "W bieżącym pakiecie brakuje drugiego źródła przepływów"],
      limitations: "Wniosek może opisać obserwowany kierunek, ale nie może deklarować szerokiego potwierdzenia między źródłami.",
      freshness: "Główna obserwacja rynku jest aktualna; jednej rodziny dowodów brakuje, a nie jest przeterminowana.",
      nextCheck: "Dodaj niezależne źródło przepływów i potwierdź tę samą obserwację w bieżącym oknie rynku.",
    },
    {
      id: "lane-moved",
      shortLabel: "Zmiana toru",
      question: "Który tor zmienił wynik?",
      status: "Płynność prowadzi",
      conclusion: "Płynność i głębokość wyjścia najmocniej zmieniły wynik; sam kierunek ceny nie był rozstrzygający.",
      evidence: ["Widoczna głębokość osłabła blisko aktywnej ceny", "Szacowany slippage wzrósł dla referencyjnego zlecenia", "Struktura ceny pozostała we wcześniejszym zakresie"],
      limitations: "Wpływ toru wyjaśnia obecny wynik, ale nie przyczynę zmiany płynności.",
      freshness: "Głębokość i cena zostały ocenione w tym samym zsynchronizowanym oknie.",
      nextCheck: "Porównaj głębokość między miejscami obrotu i powtórz estymację wpływu przed zwiększeniem zlecenia.",
    },
    {
      id: "missing-evidence",
      shortLabel: "Brakujące dowody",
      question: "Jakich dowodów brakuje?",
      status: "Wykryto jedną lukę",
      conclusion: "W pakiecie brakuje niezależnie zweryfikowanych przepływów posiadaczy, które wzmocniłyby interpretację koncentracji.",
      evidence: ["Koncentracja posiadaczy jest dostępna ze źródła głównego", "Kontekst przepływów giełdowych jest tylko częściowy", "Nie dołączono drugiego źródła etykiet portfeli"],
      limitations: "Można raportować koncentrację, ale nie należy wnioskować o intencji ani kierunku transferu.",
      freshness: "Dostępny snapshot posiadaczy jest aktualny; brakująca rodzina nie ma timestampu, bo nie została dostarczona.",
      nextCheck: "Dołącz drugie źródło posiadaczy lub etykiet portfeli przed interpretacją transferów jako akumulacji albo presji wyjścia.",
    },
    {
      id: "downgrade",
      shortLabel: "Logika obniżenia",
      question: "Dlaczego wynik został obniżony?",
      status: "Zmniejszona głębokość",
      conclusion: "Żądana głębokość przekraczała zweryfikowany zakres dowodów, dlatego Velmère zwróciło najsilniejszy możliwy do obrony wynik.",
      evidence: ["Podstawowe tory ceny i płynności przeszły weryfikację", "Zaawansowane pochodzenie dowodów było niepełne", "Żądany wniosek wymagał niedostępnej rodziny dowodów"],
      limitations: "Obniżony wynik jest węższy, a nie automatycznie bezpieczniejszy ani bardziej pozytywny.",
      freshness: "Zweryfikowane dane są aktualne; obniżenie wynika z pokrycia, nie z przeterminowania.",
      nextCheck: "Dostarcz brakujący zapis pochodzenia i ponów głębszą analizę dla tego samego kontekstu aktywa.",
    },
    {
      id: "increase-confidence",
      shortLabel: "Wzrost pewności",
      question: "Co zwiększyłoby pewność?",
      status: "Dwie dostępne kontrole",
      conclusion: "Pewność wzrośnie, jeśli aktualny sygnał potwierdzi niezależne źródło i utrzyma się w kolejnym oknie obserwacji.",
      evidence: ["Główny sygnał jest wewnętrznie spójny", "Świeżość obecnych źródeł jest wystarczająca", "Nie potwierdzono jeszcze zgodności źródeł ani trwałości sygnału"],
      limitations: "Więcej danych pomaga tylko wtedy, gdy są niezależne, istotne i aktualne; sama liczba rekordów nie jest potwierdzeniem.",
      freshness: "Obecny pakiet jest na tyle aktualny, by rozszerzyć ścieżkę dowodów zamiast zaczynać ją od nowa.",
      nextCheck: "Zweryfikuj drugie źródło teraz, a potem sprawdź, czy struktura utrzyma się w kolejnym zsynchronizowanym oknie.",
    },
    {
      id: "human-review",
      shortLabel: "Przegląd człowieka",
      question: "Co wymaga przeglądu człowieka?",
      status: "Granica eskalacji",
      conclusion: "Niejasność uprawnień kontraktu i kontekstu emitenta wymaga przeglądu przed decyzją o wysokich konsekwencjach.",
      evidence: ["Mapa uprawnień pokazuje uprzywilejowaną władzę", "Źródło publiczne nie wyjaśnia jej celu operacyjnego", "Brak zweryfikowanego dokumentu governance, który rozstrzyga niejasność"],
      limitations: "Automatyzacja może wskazać granicę i lukę dowodową, ale nie powinna wymyślać motywu ani znaczenia prawnego.",
      freshness: "Obserwacja uprawnień jest aktualna; brakuje objaśniającego zapisu governance.",
      nextCheck: "Przekaż zapis uprawnień, dokumentację governance i kontekst właściciela wykwalifikowanemu recenzentowi.",
    },
  ],
};

const de: AngelEvidenceCopy = {
  eyebrow: "ANGEL · EVIDENZ Q&A",
  title: "Fragen Sie nach dem Ergebnis. Prüfen Sie den Pfad dahinter.",
  intro: "Angel antwortet mit derselben Evidenzdisziplin wie Velmère Intelligence. Jede Antwort trennt belegte Aussagen, Grenzen und den nächsten sicheren Prüfschritt.",
  selectorLabel: "Fragen, die Angel beantworten kann",
  answerLabel: "Evidenzgebundene Antwort",
  traceLabel: "Antwortstruktur",
  liveLabel: "Ausgewählte Frage",
  layerLabels: {
    conclusion: "Schlussfolgerung",
    evidence: "Evidenz",
    limitations: "Grenzen",
    freshness: "Aktualität",
    nextCheck: "Nächster sicherer Check",
  },
  questions: [
    {
      id: "confidence-cap",
      shortLabel: "Konfidenzgrenze",
      question: "Warum ist die Konfidenz begrenzt?",
      status: "Evidenz unvollständig",
      conclusion: "Die Konfidenz ist begrenzt, weil das beobachtete Marktsignal stärker ist als seine unabhängige Bestätigung.",
      evidence: ["Die Preisstruktur stimmt in den aktuellen Marktbeobachtungen überein", "Liquiditätskontext ist vorhanden, aber nicht unabhängig bestätigt", "Im aktuellen Paket fehlt eine zweite Flow-Quelle"],
      limitations: "Die beobachtete Richtung kann beschrieben werden, aber nicht als breit quellenübergreifend bestätigt gelten.",
      freshness: "Die primäre Marktbeobachtung ist aktuell; eine Evidenzfamilie fehlt, statt veraltet zu sein.",
      nextCheck: "Eine unabhängige Flow-Quelle ergänzen und dieselbe Beobachtung im aktuellen Marktfenster bestätigen.",
    },
    {
      id: "lane-moved",
      shortLabel: "Lane-Beitrag",
      question: "Welche Lane hat das Ergebnis bewegt?",
      status: "Liquidität führt",
      conclusion: "Liquidität und Ausstiegstiefe haben das Ergebnis am stärksten verändert; die Preisrichtung allein war nicht entscheidend.",
      evidence: ["Sichtbare Tiefe nahm nahe am aktiven Preis ab", "Geschätzter Slippage stieg für die Referenzorder", "Die Preisstruktur blieb in ihrer vorherigen Spanne"],
      limitations: "Der Lane-Beitrag erklärt das Ergebnis, nicht die Ursache der Liquiditätsänderung.",
      freshness: "Tiefe und Preis wurden im selben synchronisierten Fenster bewertet.",
      nextCheck: "Venue-Tiefe vergleichen und den Market Impact vor einer größeren Order erneut schätzen.",
    },
    {
      id: "missing-evidence",
      shortLabel: "Fehlende Evidenz",
      question: "Welche Evidenz fehlt?",
      status: "Eine Lücke gefunden",
      conclusion: "Unabhängig verifizierte Holder-Flows fehlen, um die Konzentrationsinterpretation zu stärken.",
      evidence: ["Holder-Konzentration liegt von der Primärquelle vor", "Exchange-Flow-Kontext ist nur teilweise beobachtet", "Keine zweite Wallet-Label-Quelle ist beigefügt"],
      limitations: "Konzentration kann berichtet werden, Absicht und Ziel der Transfers jedoch nicht verantwortbar abgeleitet werden.",
      freshness: "Der Holder-Snapshot ist aktuell; die fehlende Familie hat keinen Timestamp, weil sie nicht geliefert wurde.",
      nextCheck: "Eine zweite Holder- oder Wallet-Label-Quelle ergänzen, bevor Transfers als Akkumulation oder Exit Pressure interpretiert werden.",
    },
    {
      id: "downgrade",
      shortLabel: "Downgrade-Logik",
      question: "Warum wurde die Ausgabe herabgestuft?",
      status: "Tiefe reduziert",
      conclusion: "Die angeforderte Tiefe überstieg die verifizierte Evidenzfläche; Velmère lieferte daher das stärkste belegbare Ergebnis.",
      evidence: ["Kern-Lanes für Preis und Liquidität bestanden die Prüfung", "Erweiterte Provenienz war unvollständig", "Die gewünschte Aussage erforderte eine nicht verfügbare Evidenzfamilie"],
      limitations: "Eine herabgestufte Ausgabe ist enger, nicht automatisch sicherer oder positiver.",
      freshness: "Verifizierte Eingaben sind aktuell; der Downgrade beruht auf Abdeckung, nicht auf veralteten Daten.",
      nextCheck: "Den fehlenden Provenienznachweis ergänzen und die tiefere Analyse im selben Asset-Kontext erneut ausführen.",
    },
    {
      id: "increase-confidence",
      shortLabel: "Konfidenz erhöhen",
      question: "Was würde die Konfidenz erhöhen?",
      status: "Zwei Checks möglich",
      conclusion: "Die Konfidenz steigt, wenn eine unabhängige Quelle das Signal bestätigt und es ein weiteres Beobachtungsfenster besteht.",
      evidence: ["Das Primärsignal ist intern konsistent", "Die Quellenaktualität ist ausreichend", "Quellenübereinstimmung und Persistenz sind noch nicht belegt"],
      limitations: "Mehr Daten helfen nur, wenn sie unabhängig, relevant und aktuell sind; Datenmenge allein ist keine Bestätigung.",
      freshness: "Das aktuelle Paket ist aktuell genug, um den Evidenzpfad zu erweitern statt neu zu beginnen.",
      nextCheck: "Jetzt eine zweite Quelle prüfen und im nächsten synchronisierten Fenster die Struktur erneut bestätigen.",
    },
    {
      id: "human-review",
      shortLabel: "Manual QA",
      question: "Was erfordert menschliche Prüfung?",
      status: "Eskalationsgrenze",
      conclusion: "Mehrdeutige Contract-Autorität und Emittentenkontext erfordern Prüfung vor einer folgenreichen Entscheidung.",
      evidence: ["Die Berechtigungskarte zeigt privilegierte Autorität", "Die öffentliche Quelle erklärt ihren operativen Zweck nicht", "Kein verifizierter Governance-Nachweis löst die Mehrdeutigkeit auf"],
      limitations: "Automatisierung kann Grenze und Evidenzlücke markieren, sollte aber weder Motiv noch Rechtsbedeutung erfinden.",
      freshness: "Die Berechtigungsbeobachtung ist aktuell; der erklärende Governance-Nachweis fehlt.",
      nextCheck: "Berechtigungsnachweis, Governance-Dokumentation und Owner-Kontext an eine qualifizierte Prüfstelle eskalieren.",
    },
  ],
};

export function getAngelEvidenceCopy(locale: IntelligenceLocale): AngelEvidenceCopy {
  return locale === "pl" ? pl : locale === "de" ? de : en;
}
