export const PASS36_R44P35_STANDALONE_TRUTH_ID =
  "pass36-a102r44p35-standalone-customer-truth" as const;

export type VlmCustomerLocale = "pl" | "en" | "de";
export type VlmReportContextDepth = "basic" | "pro" | "advanced";
export type VlmTruthState =
  | "CONFIRMED"
  | "LIMITED"
  | "CONFLICTED"
  | "STALE"
  | "SIMULATION_ONLY"
  | "WITHHELD"
  | "UNAVAILABLE";

export type VlmConfidenceClass =
  | "NOT_CALIBRATED"
  | "NO_BOUND_EVIDENCE"
  | "LIMITED_EVIDENCE"
  | "EVIDENCE_BOUND";

export type VlmEvidenceOrigin =
  | "BLOCKCHAIN_DIRECT"
  | "PROVIDER"
  | "PUBLIC_REGULATOR"
  | "USER_SUPPLIED"
  | "VELMERE_DERIVED"
  | "SIMULATION"
  | "FIXTURE"
  | "UNKNOWN";

export type VlmTruthReasonCode =
  | "NO_BOUND_EVIDENCE"
  | "MISSING_DATA"
  | "STALE_DATA"
  | "SOURCE_CONFLICT"
  | "SINGLE_SOURCE_ONLY"
  | "FIXTURE_ONLY"
  | "ORDER_BOOK_UNAVAILABLE"
  | "ORDER_BOOK_OUTCOME_MISSING"
  | "SIMULATION_NOT_FORECAST"
  | "LABEL_UNVERIFIED"
  | "LABEL_EXPIRED_OR_INVALID"
  | "TRANSFER_NOT_TRADE"
  | "CALIBRATION_MISSING"
  | "PROBABILITY_NOT_ALLOWED"
  | "CONTRACT_SCOPE_MISSING"
  | "PROVIDER_RIGHTS_UNVERIFIED"
  | "REAL_CUSTOMER_PROOF_MISSING"
  | "INDEPENDENT_REVIEW_MISSING"
  | "ENTITLEMENT_NOT_VERIFIED";

export type VlmTruthReasonSeverity = "INFO" | "WATCH" | "BLOCK";

export type VlmCustomerTruthReason = {
  code: VlmTruthReasonCode;
  severity: VlmTruthReasonSeverity;
  title: string;
  explanation: string;
  nextSafeAction: string;
};

export type VlmStandaloneCustomerTruthEnvelope = {
  schemaVersion: "velmere.standalone-customer-truth.v1";
  contractId: typeof PASS36_R44P35_STANDALONE_TRUTH_ID;
  productId: "market-impact" | "whale-watch" | "angel" | "risk-indicator";
  reportContextDepth: VlmReportContextDepth | null;
  reportContextChangesExplanationOnly: true;
  truthState: VlmTruthState;
  confidenceClass: VlmConfidenceClass;
  evidenceOrigins: VlmEvidenceOrigin[];
  facts: string[];
  calculations: string[];
  assumptions: string[];
  simulations: string[];
  conflicts: string[];
  missingProof: string[];
  limitations: string[];
  nextSafeCheck: string;
  probabilityClaimAllowed: boolean;
  investmentRecommendationAllowed: false;
  leverageRecommendationAllowed: false;
  guaranteedOutcomeClaimAllowed: false;
  customerSummary: string;
  reasonCards: VlmCustomerTruthReason[];
};

const COPY: Record<VlmCustomerLocale, Record<VlmTruthReasonCode, Omit<VlmCustomerTruthReason, "code">>> = {
  pl: {
    NO_BOUND_EVIDENCE: {
      severity: "BLOCK",
      title: "Brak powiązanych dowodów",
      explanation: "Wynik nie ma wystarczającego, sprawdzalnego powiązania ze źródłami.",
      nextSafeAction: "Dodaj lub odśwież źródło z timestampem, identyfikatorem i hashem payloadu.",
    },
    MISSING_DATA: {
      severity: "WATCH",
      title: "Brakujące dane",
      explanation: "Część potrzebnych pól jest niedostępna, więc wniosek ma ograniczony zakres.",
      nextSafeAction: "Uzupełnij brakujące pola albo pozostaw wynik jawnie wstrzymany.",
    },
    STALE_DATA: {
      severity: "WATCH",
      title: "Dane są nieaktualne",
      explanation: "Timestamp przekracza dozwolone okno świeżości.",
      nextSafeAction: "Pobierz świeży snapshot i porównaj go z poprzednim wynikiem.",
    },
    SOURCE_CONFLICT: {
      severity: "BLOCK",
      title: "Źródła są sprzeczne",
      explanation: "Co najmniej dwa źródła podają wartości, których nie można bezpiecznie uzgodnić.",
      nextSafeAction: "Pokaż rozbieżność per źródło i wykonaj niezależny check przed publikacją wniosku.",
    },
    SINGLE_SOURCE_ONLY: {
      severity: "WATCH",
      title: "Tylko jedno źródło",
      explanation: "Wynik opiera się na jednej rodzinie źródeł i nie ma niezależnego potwierdzenia.",
      nextSafeAction: "Dodaj drugą niezależną rodzinę źródeł lub obniż zakres twierdzenia.",
    },
    FIXTURE_ONLY: {
      severity: "BLOCK",
      title: "Tylko dane testowe",
      explanation: "Wynik pochodzi z fixture albo symulowanego środowiska, nie z bieżącego rynku.",
      nextSafeAction: "Zastąp fixture świeżym, legalnym snapshotem albo pokaż wyłącznie tryb demonstracyjny.",
    },
    ORDER_BOOK_UNAVAILABLE: {
      severity: "BLOCK",
      title: "Brak order booka",
      explanation: "Nie można wiarygodnie oszacować wpływu zlecenia bez głębokości rynku.",
      nextSafeAction: "Dostarcz świeży L2 order book lub podpisany snapshot klienta.",
    },
    ORDER_BOOK_OUTCOME_MISSING: {
      severity: "WATCH",
      title: "Brak porównania z realnym wykonaniem",
      explanation: "Model nie został jeszcze porównany z faktycznie zrealizowanym poślizgiem.",
      nextSafeAction: "Zapisz przewidywanie przed wykonaniem i porównaj je z późniejszym fill receipt.",
    },
    SIMULATION_NOT_FORECAST: {
      severity: "INFO",
      title: "Symulacja, nie prognoza",
      explanation: "Wynik opisuje zachowanie modelu przy danych założeniach, a nie przyszły wynik rynku.",
      nextSafeAction: "Pokaż założenia, niepewność i warunki, przy których symulacja traci ważność.",
    },
    LABEL_UNVERIFIED: {
      severity: "WATCH",
      title: "Etykieta portfela niezweryfikowana",
      explanation: "Adres nie ma aktualnego, podpisanego dowodu przypisania do podmiotu.",
      nextSafeAction: "Pokaż UNCLASSIFIED i wymagaj podpisanego artefaktu etykiety przed atrybucją.",
    },
    LABEL_EXPIRED_OR_INVALID: {
      severity: "BLOCK",
      title: "Etykieta wygasła albo jest nieważna",
      explanation: "Artefakt etykiety nie spełnia reguł podpisu, czasu lub źródła.",
      nextSafeAction: "Odrzuć etykietę i przyjmij wyłącznie nowy, poprawnie podpisany artefakt.",
    },
    TRANSFER_NOT_TRADE: {
      severity: "INFO",
      title: "Transfer nie dowodzi transakcji",
      explanation: "Przeniesienie aktywów nie oznacza automatycznie kupna, sprzedaży ani intencji rynkowej.",
      nextSafeAction: "Sprawdź destination label, order book, transakcje giełdowe i dalszy przepływ środków.",
    },
    CALIBRATION_MISSING: {
      severity: "BLOCK",
      title: "Brak kalibracji",
      explanation: "Wskaźnik nie ma zamkniętego, prospektywnego okna wyników dla twierdzeń probabilistycznych.",
      nextSafeAction: "Pozostaw opisowy poziom ryzyka i rozpocznij prerejestrowane okno kalibracyjne.",
    },
    PROBABILITY_NOT_ALLOWED: {
      severity: "BLOCK",
      title: "Prawdopodobieństwo niedozwolone",
      explanation: "Dostępne dowody nie pozwalają publikować liczbowej szansy zdarzenia.",
      nextSafeAction: "Pokaż czynniki ryzyka, braki danych i opisowy poziom zamiast procentu.",
    },
    CONTRACT_SCOPE_MISSING: {
      severity: "WATCH",
      title: "Brak zakresu kontraktu",
      explanation: "Nie można przypisać ryzyka kontraktowego do aktywa bez dokładnego chain/address scope.",
      nextSafeAction: "Potwierdź sieć, adres i bytecode przed wnioskiem o uprawnieniach kontraktu.",
    },
    PROVIDER_RIGHTS_UNVERIFIED: {
      severity: "BLOCK",
      title: "Prawa do danych niepotwierdzone",
      explanation: "Dane mogą być technicznie dostępne, ale nie mają potwierdzonego zakresu komercyjnego użycia.",
      nextSafeAction: "Ukryj pole w produkcie płatnym albo uzyskaj zatwierdzenie praw i retencji.",
    },
    REAL_CUSTOMER_PROOF_MISSING: {
      severity: "WATCH",
      title: "Brak dowodu od klientów",
      explanation: "Nie wykonano jeszcze realnego testu zrozumienia, użyteczności ani gotowości do zapłaty.",
      nextSafeAction: "Uruchom prerejestrowaną kohortę klientów i zachowaj wyniki bez selekcji wygodnych przypadków.",
    },
    INDEPENDENT_REVIEW_MISSING: {
      severity: "WATCH",
      title: "Brak niezależnego review",
      explanation: "Wynik nie został zweryfikowany przez niezależnego specjalistę poza systemem, który go wygenerował.",
      nextSafeAction: "Przekaż pełny blind bundle do co najmniej dwóch niezależnych reviewerów.",
    },
    ENTITLEMENT_NOT_VERIFIED: {
      severity: "BLOCK",
      title: "Dostęp niepotwierdzony",
      explanation: "Serwer nie potwierdził uprawnienia do płatnej zawartości.",
      nextSafeAction: "Pozostaw tylko bezpieczny preview i ponów serwerową weryfikację entitlementu.",
    },
  },
  en: {
    NO_BOUND_EVIDENCE: { severity: "BLOCK", title: "No bound evidence", explanation: "The result is not sufficiently tied to verifiable sources.", nextSafeAction: "Add or refresh a source with a timestamp, identifier and payload hash." },
    MISSING_DATA: { severity: "WATCH", title: "Missing data", explanation: "Required fields are unavailable, so the conclusion has limited scope.", nextSafeAction: "Complete the missing fields or keep the conclusion explicitly withheld." },
    STALE_DATA: { severity: "WATCH", title: "Data is stale", explanation: "The observation timestamp exceeds the permitted freshness window.", nextSafeAction: "Fetch a fresh snapshot and compare it with the previous result." },
    SOURCE_CONFLICT: { severity: "BLOCK", title: "Sources conflict", explanation: "At least two sources provide values that cannot be safely reconciled.", nextSafeAction: "Expose the disagreement per source and run an independent check before publication." },
    SINGLE_SOURCE_ONLY: { severity: "WATCH", title: "Single source only", explanation: "The result relies on one source family without independent confirmation.", nextSafeAction: "Add a second independent source family or narrow the claim." },
    FIXTURE_ONLY: { severity: "BLOCK", title: "Test data only", explanation: "The result comes from a fixture or simulated environment, not the current market.", nextSafeAction: "Replace the fixture with a fresh, legally usable snapshot or keep demo-only wording." },
    ORDER_BOOK_UNAVAILABLE: { severity: "BLOCK", title: "Order book unavailable", explanation: "Order impact cannot be estimated reliably without market depth.", nextSafeAction: "Provide a fresh L2 order book or a signed client snapshot." },
    ORDER_BOOK_OUTCOME_MISSING: { severity: "WATCH", title: "No realized-outcome comparison", explanation: "The model has not been compared with actual realized slippage.", nextSafeAction: "Record the prediction before execution and compare it with a later fill receipt." },
    SIMULATION_NOT_FORECAST: { severity: "INFO", title: "Simulation, not forecast", explanation: "The result describes model behavior under stated assumptions, not a future market outcome.", nextSafeAction: "Show assumptions, uncertainty and invalidation conditions." },
    LABEL_UNVERIFIED: { severity: "WATCH", title: "Wallet label unverified", explanation: "The address lacks a current signed attribution artifact.", nextSafeAction: "Display UNCLASSIFIED and require a signed label artifact before attribution." },
    LABEL_EXPIRED_OR_INVALID: { severity: "BLOCK", title: "Wallet label expired or invalid", explanation: "The label artifact fails signature, time or source checks.", nextSafeAction: "Reject the label and accept only a newly signed valid artifact." },
    TRANSFER_NOT_TRADE: { severity: "INFO", title: "Transfer is not trade proof", explanation: "Moving assets does not by itself prove a buy, sale or market intent.", nextSafeAction: "Check destination labels, exchange trades, order books and subsequent fund flows." },
    CALIBRATION_MISSING: { severity: "BLOCK", title: "Calibration missing", explanation: "The indicator has no closed prospective outcome window for probability claims.", nextSafeAction: "Keep a descriptive risk level and start a preregistered calibration window." },
    PROBABILITY_NOT_ALLOWED: { severity: "BLOCK", title: "Probability claim not allowed", explanation: "The available evidence does not support a numerical event probability.", nextSafeAction: "Show risk factors, missing data and a descriptive level instead of a percentage." },
    CONTRACT_SCOPE_MISSING: { severity: "WATCH", title: "Contract scope missing", explanation: "Contract risk cannot be attached to an asset without exact chain and address scope.", nextSafeAction: "Confirm network, address and bytecode before discussing contract privileges." },
    PROVIDER_RIGHTS_UNVERIFIED: { severity: "BLOCK", title: "Provider rights unverified", explanation: "Data may be technically available but commercial-use rights are not confirmed.", nextSafeAction: "Hide the paid field or obtain approved rights and retention terms." },
    REAL_CUSTOMER_PROOF_MISSING: { severity: "WATCH", title: "No real customer proof", explanation: "Comprehension, utility and willingness-to-pay have not been tested with real customers.", nextSafeAction: "Run a preregistered customer cohort and retain all results." },
    INDEPENDENT_REVIEW_MISSING: { severity: "WATCH", title: "Independent review missing", explanation: "The result has not been checked by a specialist outside the generating system.", nextSafeAction: "Send a complete blind bundle to at least two independent reviewers." },
    ENTITLEMENT_NOT_VERIFIED: { severity: "BLOCK", title: "Entitlement not verified", explanation: "The server has not confirmed access to paid content.", nextSafeAction: "Keep only a safe preview and repeat server-side entitlement verification." },
  },
  de: {
    NO_BOUND_EVIDENCE: { severity: "BLOCK", title: "Keine gebundene Evidenz", explanation: "Das Ergebnis ist nicht ausreichend an überprüfbare Quellen gebunden.", nextSafeAction: "Quelle mit Zeitstempel, Kennung und Payload-Hash ergänzen oder aktualisieren." },
    MISSING_DATA: { severity: "WATCH", title: "Fehlende Daten", explanation: "Erforderliche Felder fehlen; die Aussage bleibt daher begrenzt.", nextSafeAction: "Fehlende Felder ergänzen oder die Aussage sichtbar zurückhalten." },
    STALE_DATA: { severity: "WATCH", title: "Daten sind veraltet", explanation: "Der Beobachtungszeitpunkt liegt außerhalb des zulässigen Frischefensters.", nextSafeAction: "Neuen Snapshot abrufen und mit dem vorherigen Ergebnis vergleichen." },
    SOURCE_CONFLICT: { severity: "BLOCK", title: "Quellen widersprechen sich", explanation: "Mindestens zwei Quellen liefern nicht sicher vereinbare Werte.", nextSafeAction: "Abweichung je Quelle zeigen und vor Veröffentlichung unabhängig prüfen." },
    SINGLE_SOURCE_ONLY: { severity: "WATCH", title: "Nur eine Quelle", explanation: "Das Ergebnis stützt sich auf eine Quellenfamilie ohne unabhängige Bestätigung.", nextSafeAction: "Zweite unabhängige Quellenfamilie ergänzen oder die Aussage einschränken." },
    FIXTURE_ONLY: { severity: "BLOCK", title: "Nur Testdaten", explanation: "Das Ergebnis stammt aus einem Fixture oder einer Simulation, nicht vom aktuellen Markt.", nextSafeAction: "Fixture durch einen frischen rechtlich nutzbaren Snapshot ersetzen oder Demo-Status zeigen." },
    ORDER_BOOK_UNAVAILABLE: { severity: "BLOCK", title: "Orderbuch fehlt", explanation: "Ohne Markttiefe lässt sich der Markteinfluss nicht verlässlich schätzen.", nextSafeAction: "Frisches L2-Orderbuch oder signierten Kundensnapshot bereitstellen." },
    ORDER_BOOK_OUTCOME_MISSING: { severity: "WATCH", title: "Kein Vergleich mit realer Ausführung", explanation: "Das Modell wurde noch nicht mit realisiertem Slippage verglichen.", nextSafeAction: "Prognose vor Ausführung speichern und später mit Fill-Receipt vergleichen." },
    SIMULATION_NOT_FORECAST: { severity: "INFO", title: "Simulation, keine Prognose", explanation: "Das Ergebnis beschreibt Modellverhalten unter Annahmen, nicht den künftigen Markt.", nextSafeAction: "Annahmen, Unsicherheit und Ungültigkeitsbedingungen zeigen." },
    LABEL_UNVERIFIED: { severity: "WATCH", title: "Wallet-Label nicht verifiziert", explanation: "Für die Adresse fehlt ein aktuelles signiertes Zuordnungsartefakt.", nextSafeAction: "UNCLASSIFIED anzeigen und vor Zuordnung ein signiertes Label verlangen." },
    LABEL_EXPIRED_OR_INVALID: { severity: "BLOCK", title: "Wallet-Label abgelaufen oder ungültig", explanation: "Das Label besteht Signatur-, Zeit- oder Quellenprüfung nicht.", nextSafeAction: "Label verwerfen und nur ein neues gültig signiertes Artefakt akzeptieren." },
    TRANSFER_NOT_TRADE: { severity: "INFO", title: "Transfer ist kein Handelsbeweis", explanation: "Eine Verschiebung beweist weder Kauf noch Verkauf noch Marktabsicht.", nextSafeAction: "Ziel-Label, Börsenhandel, Orderbuch und Folgetransfers prüfen." },
    CALIBRATION_MISSING: { severity: "BLOCK", title: "Kalibrierung fehlt", explanation: "Für Wahrscheinlichkeitsaussagen fehlt ein abgeschlossenes prospektives Outcome-Fenster.", nextSafeAction: "Beschreibendes Risiko beibehalten und preregistrierte Kalibrierung starten." },
    PROBABILITY_NOT_ALLOWED: { severity: "BLOCK", title: "Wahrscheinlichkeitsaussage nicht zulässig", explanation: "Die Evidenz trägt keine numerische Ereigniswahrscheinlichkeit.", nextSafeAction: "Risikofaktoren, Datenlücken und beschreibendes Niveau statt Prozent zeigen." },
    CONTRACT_SCOPE_MISSING: { severity: "WATCH", title: "Contract-Scope fehlt", explanation: "Ohne exakte Chain- und Adressbindung darf kein Contract-Risiko zugeordnet werden.", nextSafeAction: "Netzwerk, Adresse und Bytecode vor Privilegien-Claim bestätigen." },
    PROVIDER_RIGHTS_UNVERIFIED: { severity: "BLOCK", title: "Provider-Rechte ungeklärt", explanation: "Daten sind eventuell technisch verfügbar, aber kommerzielle Rechte sind nicht bestätigt.", nextSafeAction: "Bezahltes Feld ausblenden oder Rechte und Retention freigeben lassen." },
    REAL_CUSTOMER_PROOF_MISSING: { severity: "WATCH", title: "Kein echter Kundennachweis", explanation: "Verständnis, Nutzen und Zahlungsbereitschaft wurden nicht mit echten Kunden geprüft.", nextSafeAction: "Präregistrierte Kundengruppe testen und alle Ergebnisse behalten." },
    INDEPENDENT_REVIEW_MISSING: { severity: "WATCH", title: "Unabhängiges Review fehlt", explanation: "Das Ergebnis wurde nicht außerhalb des erzeugenden Systems geprüft.", nextSafeAction: "Vollständiges Blind-Bundle an mindestens zwei unabhängige Reviewer senden." },
    ENTITLEMENT_NOT_VERIFIED: { severity: "BLOCK", title: "Berechtigung nicht bestätigt", explanation: "Der Server hat den Zugriff auf bezahlte Inhalte nicht bestätigt.", nextSafeAction: "Nur sichere Vorschau zeigen und serverseitige Prüfung wiederholen." },
  },
};

export function uniqueVlmTruthStrings(values: readonly (string | null | undefined)[], maximum = 12): string[] {
  return Array.from(new Set(values
    .map((value) => String(value ?? "").replace(/\s+/g, " ").trim())
    .filter(Boolean)))
    .slice(0, maximum);
}

export function buildVlmCustomerTruthReason(
  code: VlmTruthReasonCode,
  locale: VlmCustomerLocale = "en",
): VlmCustomerTruthReason {
  return { code, ...COPY[locale][code] };
}

export function buildVlmCustomerTruthReasons(
  codes: readonly VlmTruthReasonCode[],
  locale: VlmCustomerLocale = "en",
  maximum = 6,
): VlmCustomerTruthReason[] {
  return Array.from(new Set(codes)).slice(0, maximum).map((code) => buildVlmCustomerTruthReason(code, locale));
}

export function resolveVlmTruthState(args: {
  unavailable?: boolean;
  fixtureOnly?: boolean;
  simulationOnly?: boolean;
  stale?: boolean;
  conflicted?: boolean;
  blockingReasons?: number;
  evidenceCount?: number;
}): VlmTruthState {
  if (args.unavailable) return "UNAVAILABLE";
  if (args.fixtureOnly || args.simulationOnly) return "SIMULATION_ONLY";
  if (args.conflicted) return "CONFLICTED";
  if (args.stale) return "STALE";
  if ((args.blockingReasons ?? 0) > 0) return "WITHHELD";
  if ((args.evidenceCount ?? 0) <= 1) return "LIMITED";
  return "CONFIRMED";
}

export function resolveVlmConfidenceClass(args: {
  calibrated?: boolean;
  evidenceCount?: number;
  verified?: boolean;
}): VlmConfidenceClass {
  if (args.calibrated) return "EVIDENCE_BOUND";
  if (!args.verified || (args.evidenceCount ?? 0) === 0) return "NO_BOUND_EVIDENCE";
  if ((args.evidenceCount ?? 0) < 2) return "LIMITED_EVIDENCE";
  return "NOT_CALIBRATED";
}
