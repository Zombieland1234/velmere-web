import {
  Activity,
  ArrowRight,
  ArrowUpRight,
  Clock3,
  Database,
  FileSearch,
  Fingerprint,
  GitBranch,
  KeyRound,
  LockKeyhole,
  Radar,
  RadioTower,
  ScanSearch,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { Link } from "@/navigation";
import {
  buildSecurityTrustSnapshot,
  resolveSecurityTrustLocale,
  securityTrustPillars,
} from "@/lib/security/security-trust-copy";
import styles from "./SecurityTrustPage.module.css";

// Public Security explains customer protections. Operator deployment details stay private.
const copy = {
  pl: {
    eyebrow: "Velmère Security",
    title: "Bezpieczeństwo, które da się wyjaśnić.",
    subtitle: "Velmère oddziela tożsamość, sekrety, dane rynkowe i raporty. Użytkownik widzi źródło oraz braki danych, a prywatne informacje nie trafiają do publicznego wyniku.",
    commandTitle: "Warstwa zaufania systemu",
    commandBody:
      "Ta powierzchnia spina konto, Shield Map, AI review i eksport raportów. Każdy etap ma własną granicę: co wolno pokazać publicznie, co wymaga źródła i co pozostaje wewnątrz chronionego systemu.",
    metrics: [
      ["Tożsamość", "sesja oddzielona od portfela"],
      ["Shield", "źródło przy każdym wniosku"],
      ["Raport", "redakcja przed eksportem"],
    ],
    mapCardBody: "Otwórz mapę ryzyka i sprawdź luki źródeł, poziom pewności oraz następne kroki.",
    exportCardTitle: "Browser i PDF",
    exportCardBody: "Raport zachowuje te same źródła, redakcję i granice co analiza na ekranie.",
    routesTitle: "Jak porusza się zaufanie",
    routes: [
      ["Konto i logowanie", "Sesja konta nie przejmuje roli portfela, a odzyskiwanie dostępu pozostaje jawne i ludzkie."],
      ["Shield i AI", "Silnik pokazuje pewność, czas obserwacji i brakujące dane zamiast udawać ostateczny wyrok."],
      ["Browser i PDF", "Dowody mogą przejść do pakietu przeglądu i eksportu dopiero po redakcji oraz kontroli granic."],
    ],
    section: "Jak chronimy Velmère",
    architecture: "Velmère Defense Architecture",
    architectureTitle: "Nazwane warstwy ochrony. Publiczny efekt, prywatna mechanika.",
    architectureBody: "Każda warstwa ma konkretną odpowiedzialność i widoczny efekt. Nie publikujemy progów detekcji, reguł korelacji, konfiguracji dostawców ani wag scoringu.",
    active: "aktywna warstwa",
    controlled: "kontrolowany preview",
    privateTitle: "Czego nie ujawniamy",
    productionBoundaryLabel: "Granica produkcyjna",
    privateBody: "Nie publikujemy konfiguracji infrastruktury, sekretów dostawców, tokenów API, surowych logów, reguł wykrywania nadużyć ani szczegółów, które ułatwiałyby obejście zabezpieczeń.",
    boundary: "Publiczna strona opisuje model ochrony. Szczegóły konfiguracji i wyniki testów pozostają w kontrolowanym audycie technicznym.",
    aiBridgeTitle: "AI, Browser i PDF mówią jednym językiem",
    aiBridgeBody:
      "Wniosek z analizy, ślad w Browserze i raport eksportowy nie mogą opowiadać trzech różnych historii. Velmère pilnuje wspólnego ID sprawy, wspólnego źródła i tej samej granicy redakcji.",
    aiBridgeCards: [
      ["Ciągłość źródeł", "Ten sam stan źródeł powinien być widoczny w Shield, Brain, Browser replay i eksporcie."],
      ["Granica eksportu", "PDF pozostaje podglądem, dopóki źródła, redakcja i odtworzenie sprawy nie są zgodne."],
      ["Kontrola człowieka", "Jeśli pewność jest sztucznie wysoka albo brakuje danych, sprawa wraca do ręcznej weryfikacji."],
    ],
    protections: [
      ["Podpis zamiast sekretu", "Portfel potwierdza kontrolę podpisem. Velmère nie prosi o seed phrase ani prywatny klucz.", Fingerprint],
      ["Sekrety po stronie serwera", "Klucze dostawców i konfiguracja środowiska nie są osadzane w publicznym interfejsie.", KeyRound],
      ["Ograniczanie nadużyć", "Wrażliwe endpointy otrzymują limity, walidację wejścia i kontrolowany zakres zapytań.", Activity],
      ["Źródło obok wniosku", "Analizy pokazują dostawcę, timestamp, confidence i brakujące dane zamiast fikcyjnej pewności.", RadioTower],
      ["Redakcja przed eksportem", "Raport publiczny usuwa sekrety, wewnętrzne identyfikatory i surowe dane diagnostyczne.", LockKeyhole],
      ["Oddzielne warstwy danych", "Rynek, tożsamość, płatność i audyt mają osobne kontrakty oraz ograniczone uprawnienia.", Database],
    ],
    innovations: [
      ["Aegis Request Mesh", "ochrona publicznego ruchu", "Klasyfikuje podejrzane żądania, ogranicza kosztowne ścieżki API i zatrzymuje nieprawidłowe wejście przed analizą.", "active", Activity],
      ["Obsidian Secret Boundary", "izolacja sekretów", "Oddziela publiczny interfejs od kluczy dostawców, konfiguracji środowiska i uprawnień administracyjnych.", "active", KeyRound],
      ["Proofline Source Ledger", "źródło przy każdym wniosku", "Wiąże wynik AI ze źródłem, czasem obserwacji, stanem świeżości i brakującymi polami.", "active", RadioTower],
      ["Veil Export Firewall", "bezpieczny PDF i eksport", "Redaguje dane wewnętrzne, prywatne identyfikatory, sekrety i surowe payloady przed utworzeniem raportu.", "active", LockKeyhole],
      ["Sentinel Replay Chain", "ciąg zdarzeń bezpieczeństwa", "Porządkuje blokady, limity, fallbacki i zdarzenia administracyjne w ślad do późniejszego review.", "controlled", Database],
      ["Human Override Protocol", "kontrola nad pewnością AI", "Nakłada limity pewności przy brakujących źródłach i kieruje niejednoznaczne przypadki do ręcznej weryfikacji.", "active", Fingerprint],
    ],
  },
  de: {
    eyebrow: "Velmère Security",
    title: "Sicherheit, die sich erklären lässt.",
    subtitle: "Velmère trennt Identität, Secrets, Marktdaten und Reports. Nutzer sehen Quellen und Datenlücken; private Informationen gelangen nicht in öffentliche Ergebnisse.",
    commandTitle: "Systemischer Trust-Layer",
    commandBody:
      "Diese Fläche verbindet Account, Shield Map, AI-Review und Report-Export. Jeder Schritt hat eine eigene Grenze: was öffentlich sichtbar sein darf, was eine Quelle braucht und was innerhalb des geschützten Systems bleibt.",
    metrics: [
      ["Identität", "Session getrennt vom Wallet"],
      ["Shield", "Quelle an jedem Befund"],
      ["Bericht", "Redaktion vor Export"],
    ],
    mapCardBody: "Öffne die Risikokarte und prüfe Quellenlücken, Konfidenz und nächste Schritte.",
    exportCardTitle: "Browser und PDF",
    exportCardBody: "Der Report behält dieselben Quellen, Redaktionsregeln und Grenzen wie die Analyse auf dem Bildschirm.",
    routesTitle: "Wie Vertrauen durch das System läuft",
    routes: [
      ["Account und Login", "Die Account-Session ersetzt keine Wallet-Aktion, und Recovery bleibt explizit und menschlich."],
      ["Shield und KI", "Die Engine zeigt Konfidenz, Beobachtungszeit und Datenlücken statt eines falschen Endurteils."],
      ["Browser und PDF", "Evidenz darf erst nach Redaktion und Boundary-Checks in Review-Pakete und Exporte übergehen."],
    ],
    section: "So schützen wir Velmère",
    architecture: "Velmère Defense Architecture",
    architectureTitle: "Benannte Schutzschichten. Öffentliche Wirkung, private Mechanik.",
    architectureBody: "Jede Schicht hat eine klare Verantwortung und sichtbare Wirkung. Erkennungsschwellen, Korrelationsregeln, Provider-Konfiguration und Scoring-Gewichte bleiben privat.",
    active: "aktive Schicht",
    controlled: "kontrolliertes Preview",
    privateTitle: "Was wir nicht offenlegen",
    productionBoundaryLabel: "Produktionsgrenze",
    privateBody: "Wir veröffentlichen keine Infrastrukturkonfiguration, Provider-Secrets, API-Tokens, Raw Logs, Abuse-Regeln oder Details, die eine Umgehung erleichtern.",
    boundary: "Diese Seite beschreibt das Schutzmodell. Konfigurationsdetails und Testergebnisse bleiben im kontrollierten technischen Audit.",
    aiBridgeTitle: "KI, Browser und PDF sprechen dieselbe Sprache",
    aiBridgeBody:
      "Eine Analyse, ein Browser-Trace und ein Exportbericht dürfen nicht drei verschiedene Wahrheiten erzählen. Velmère hält Case-ID, Source-State und Redaktionsgrenze über alle Flächen hinweg konsistent.",
    aiBridgeCards: [
      ["Quellenkontinuität", "Derselbe Quellenzustand muss in Shield, Brain, Browser Replay und Export sichtbar bleiben."],
      ["Exportgrenze", "PDF bleibt Vorschau, bis Quellen, Redaktion und Replay übereinstimmen."],
      ["Menschliche Kontrolle", "Wenn Konfidenz künstlich hoch ist oder Daten fehlen, geht der Fall zurück in manuelle Prüfung."],
    ],
    protections: [
      ["Signatur statt Secret", "Die Wallet bestätigt Kontrolle per Signatur. Velmère fragt nie nach Seed Phrase oder Private Key.", Fingerprint],
      ["Serverseitige Secrets", "Provider-Schlüssel und Umgebungsdaten werden nicht in das öffentliche Interface eingebettet.", KeyRound],
      ["Missbrauch begrenzen", "Sensible Endpoints erhalten Limits, Input-Validierung und kontrollierte Query-Grenzen.", Activity],
      ["Quelle neben dem Befund", "Analysen zeigen Provider, Timestamp, Confidence und fehlende Daten statt falscher Gewissheit.", RadioTower],
      ["Redaktion vor Export", "Öffentliche Reports entfernen Secrets, interne Kennungen und rohe Diagnosedaten.", LockKeyhole],
      ["Getrennte Datenebenen", "Markt, Identität, Zahlung und Audit nutzen getrennte Verträge und begrenzte Rechte.", Database],
    ],
    innovations: [
      ["Aegis Request Mesh", "Schutz des öffentlichen Traffics", "Klassifiziert verdächtige Requests, begrenzt teure API-Pfade und stoppt ungültige Eingaben vor der Analyse.", "active", Activity],
      ["Obsidian Secret Boundary", "Secret-Isolation", "Trennt das öffentliche Interface von Provider-Schlüsseln, Umgebungsdaten und administrativen Rechten.", "active", KeyRound],
      ["Proofline Source Ledger", "Quelle an jedem Befund", "Verknüpft AI-Ergebnisse mit Quelle, Beobachtungszeit, Aktualität und fehlenden Feldern.", "active", RadioTower],
      ["Veil Export Firewall", "sicheres PDF und Export", "Redigiert interne Daten, private Kennungen, Secrets und Raw Payloads vor der Reporterstellung.", "active", LockKeyhole],
      ["Sentinel Replay Chain", "Security Event Chain", "Ordnet Blocks, Limits, Fallbacks und Admin-Ereignisse für spätere Reviews.", "controlled", Database],
      ["Human Override Protocol", "Kontrolle der AI-Konfidenz", "Begrenzt Konfidenz bei fehlenden Quellen und routet uneindeutige Fälle in manuelle Prüfung.", "active", Fingerprint],
    ],
  },
  en: {
    eyebrow: "Velmère Security",
    title: "Security that can be explained.",
    subtitle: "Velmère separates identity, secrets, market data and reports. Users see sources and data gaps while private information stays out of public output.",
    commandTitle: "System trust layer",
    commandBody:
      "This surface ties together account access, Shield Map, AI review and report export. Each step has a boundary: what may be public, what requires source proof and what remains inside the protected system.",
    metrics: [
      ["Identity", "session separated from wallet"],
      ["Shield", "a source beside each finding"],
      ["PDF", "redaction before export"],
    ],
    mapCardBody: "Open the risk map and inspect source gaps, confidence and the next checks.",
    exportCardTitle: "Browser and PDF",
    exportCardBody: "The report keeps the same sources, redaction rules and boundaries as the on-screen analysis.",
    routesTitle: "How trust moves through the system",
    routes: [
      ["Account and login", "The account session does not take over wallet authority, and recovery stays explicit and human."],
      ["Shield and AI", "The engine shows confidence, timestamp and missing data instead of a false final verdict."],
      ["Browser and PDF", "Evidence can move into review packets and export only after redaction and boundary checks."],
    ],
    section: "How Velmère is protected",
    architecture: "Velmère Defense Architecture",
    architectureTitle: "Named protection layers. Public effect, private mechanics.",
    architectureBody: "Each layer has a precise responsibility and visible outcome. Detection thresholds, correlation rules, provider configuration and scoring weights remain private.",
    active: "active layer",
    controlled: "controlled preview",
    privateTitle: "What we do not disclose",
    productionBoundaryLabel: "Production boundary",
    privateBody: "We do not publish infrastructure configuration, provider secrets, API tokens, raw logs, abuse-detection rules or details that would make controls easier to bypass.",
    boundary: "This page describes the protection model. Configuration detail and test evidence remain in a controlled technical audit.",
    aiBridgeTitle: "AI, Browser and PDF speak the same language",
    aiBridgeBody:
      "An analysis result, a browser trace and an exported report cannot tell three different stories. Velmère keeps a shared case ID, shared source state and the same redaction boundary across surfaces.",
    aiBridgeCards: [
      ["Source continuity", "The same source state should remain visible in Shield, Brain, browser replay and export."],
      ["Export boundary", "PDF stays preview-only until sources, redaction and replay agree."],
      ["Human override", "If confidence looks inflated or data is missing, the case routes back to manual review."],
    ],
    protections: [
      ["Sign instead of disclosing", "A wallet proves control with a signature. Velmère never asks for a seed phrase or private key.", Fingerprint],
      ["Server-side secrets", "Provider keys and environment configuration are not embedded in the public interface.", KeyRound],
      ["Abuse controls", "Sensitive endpoints receive rate limits, input validation and bounded query scope.", Activity],
      ["A source beside each finding", "Analysis exposes provider, timestamp, confidence and missing data instead of false certainty.", RadioTower],
      ["Redaction before export", "Public reports remove secrets, internal identifiers and raw diagnostic payloads.", LockKeyhole],
      ["Separated data layers", "Market, identity, payment and audit use distinct contracts and limited permissions.", Database],
    ],
    innovations: [
      ["Aegis Request Mesh", "public traffic defense", "Classifies suspicious requests, constrains expensive API paths and stops invalid input before analysis.", "active", Activity],
      ["Obsidian Secret Boundary", "secret isolation", "Separates the public interface from provider keys, environment configuration and administrative privileges.", "active", KeyRound],
      ["Proofline Source Ledger", "a source beside every finding", "Binds AI output to its source, observation time, freshness state and missing fields.", "active", RadioTower],
      ["Veil Export Firewall", "safe PDF and export", "Redacts internal data, private identifiers, secrets and raw payloads before a report is created.", "active", LockKeyhole],
      ["Sentinel Replay Chain", "security event continuity", "Organizes blocks, limits, fallbacks and administrative events into a trail for later review.", "controlled", Database],
      ["Human Override Protocol", "AI confidence control", "Caps confidence when sources are missing and routes ambiguous cases to manual verification.", "active", Fingerprint],
    ],
  },
} as const;

const auditWatchTeaser = {
  pl: {
    label: "Velmère Audit Watch",
    body: "Weryfikuj publiczne audyty, scope, adres kontraktu, zmiany po audycie i claimy projektu bez custody i bez porad inwestycyjnych.",
  },
  en: {
    label: "Velmère Audit Watch",
    body: "Verify public audits, scope, contract address, post-audit changes and project claims without custody or investment advice.",
  },
  de: {
    label: "Velmère Audit Watch",
    body: "Prüfe öffentliche Audits, Scope, Contract-Adresse, Änderungen nach dem Audit und Projekt-Claims ohne Custody oder Anlageberatung.",
  },
} as const;

const securityIntelligenceCopy = {
  pl: {
    heroPrimary: "Zobacz Security Intelligence",
    heroSecondary: "Uruchom audyt",
    eyebrow: "Security Intelligence / 01",
    title: "Każdy sygnał musi przejść drogę od źródła do dowodu.",
    body: "Security Intelligence łączy pochodzenie danych, świeżość, rozbieżności i brakujące dowody. Wynik nie przechodzi dalej tylko dlatego, że wygląda przekonująco — musi spełnić jawne granice pewności i gotowości.",
    contract: "Publiczny kontrakt decyzyjny",
    contractState: "źródła → polityka → werdykt",
    signalLabel: "Macierz jakości dowodów",
    signalState: "stan decyzji / bez danych live",
    signals: [
      ["Pochodzenie", "Powiązane", "Każdy wniosek zachowuje źródło, zakres i czas obserwacji.", "verified"],
      ["Świeżość", "Kontrolowana", "Stare obserwacje obniżają pewność zamiast znikać z widoku.", "watch"],
      ["Rozbieżność", "Do przeglądu", "Niezgodne źródła uruchamiają arbitraż, nie uśrednianie na siłę.", "review"],
      ["Brakujący dowód", "Blokuje gotowość", "Brak danych nigdy nie staje się zerowym ryzykiem.", "blocked"],
    ],
    flowLabel: "Łańcuch decyzji",
    flowTitle: "Cztery bramki przed publicznym wynikiem.",
    flow: [
      ["Ustal zakres", "Tożsamość celu, klasa aktywa i uprawniony zakres analizy."],
      ["Zbuduj quorum", "Niezależne rodziny źródeł, świeżość i konflikty dostawców."],
      ["Zastosuj granice", "Pewność, niepewność i missing proof ograniczają język wniosku."],
      ["Zapisz ślad", "Wersja pakietu, digest i receipt pozwalają odtworzyć decyzję."],
    ],
    layersEyebrow: "Architektura warstwowa / 07",
    layersTitle: "Nie jeden magiczny zamek. Siedem niezależnych granic.",
    layersBody: "Warstwy są rozdzielone, aby błąd jednego elementu nie dawał automatycznie dostępu do całego systemu. Publicznie pokazujemy skutek ochrony, nie parametry ułatwiające jej obejście.",
    layers: [
      ["Szyfrowany transport", "HTTPS, HSTS i bezpieczny kanał dla danych w ruchu."],
      ["Walidacja serwerowa", "Zakres, format i uprawnienia są sprawdzane przed analizą."],
      ["Strażnik wniosków AI", "Model nie może podnieść pewności ponad jakość dowodów."],
      ["Kontrola nadużyć", "Limity i koszt zapytania chronią wrażliwe ścieżki."],
      ["Granica pochodzenia", "Żądania wrażliwe respektują reguły same-origin i kontekst sesji."],
      ["Rejestr integralności", "Zdarzenia i raporty zachowują wersję, digest oraz kolejność."],
      ["Dostarczenie fail-closed", "Brak zgody, płatności lub dowodu blokuje eksport zamiast go pozorować."],
    ],
    boundaryNote: "To opis architektury produktu, nie gwarancja braku ryzyka ani deklaracja skuteczności środowiska produkcyjnego.",
    ctaTitle: "Sprawdź system na konkretnym przypadku.",
    ctaBody: "Przejdź do Intelligence, aby zobaczyć model dowodowy, albo uruchom audyt bezpieczeństwa dla projektu, repozytorium lub kontraktu.",
    ctaIntelligence: "Otwórz Intelligence",
    ctaAudit: "Przejdź do audytów",
  },
  en: {
    heroPrimary: "Explore Security Intelligence",
    heroSecondary: "Start an audit",
    eyebrow: "Security Intelligence / 01",
    title: "Every signal must travel from source to evidence.",
    body: "Security Intelligence connects provenance, freshness, disagreement and missing proof. A result does not move forward because it looks persuasive — it must pass explicit confidence and readiness boundaries.",
    contract: "Public decision contract",
    contractState: "sources → policy → verdict",
    signalLabel: "Evidence quality matrix",
    signalState: "decision state / no live data",
    signals: [
      ["Provenance", "Source-bound", "Every finding retains its source, scope and observation time.", "verified"],
      ["Freshness", "Controlled", "Stale observations lower confidence instead of disappearing.", "watch"],
      ["Divergence", "Review", "Conflicting sources trigger arbitration, not forced averaging.", "review"],
      ["Missing proof", "Blocks readiness", "Missing data never becomes zero risk.", "blocked"],
    ],
    flowLabel: "Decision chain",
    flowTitle: "Four gates before a public result.",
    flow: [
      ["Bind scope", "Target identity, asset class and the authorized analysis boundary."],
      ["Build quorum", "Independent source families, freshness and provider conflicts."],
      ["Apply boundaries", "Confidence, uncertainty and missing proof constrain the claim."],
      ["Preserve the trace", "Packet version, digest and receipt make the decision replayable."],
    ],
    layersEyebrow: "Layered architecture / 07",
    layersTitle: "Not one magic lock. Seven independent boundaries.",
    layersBody: "Layers remain separated so one component failure does not automatically expose the entire system. We publish the protective outcome, not bypass-enabling parameters.",
    layers: [
      ["Encrypted transport", "HTTPS, HSTS and a protected channel for data in motion."],
      ["Server validation", "Scope, format and authority are checked before analysis."],
      ["AI claim guard", "The model cannot raise confidence above evidence quality."],
      ["Abuse controls", "Limits and request cost protect sensitive paths."],
      ["Origin boundary", "Sensitive requests respect same-origin rules and session context."],
      ["Integrity ledger", "Events and reports retain version, digest and sequence."],
      ["Fail-closed delivery", "Missing consent, payment or proof blocks export instead of simulating success."],
    ],
    boundaryNote: "This describes product architecture, not a guarantee of zero risk or a production performance claim.",
    ctaTitle: "Test the system on a concrete case.",
    ctaBody: "Open Intelligence to inspect the evidence model, or start a security audit for a project, repository or contract.",
    ctaIntelligence: "Open Intelligence",
    ctaAudit: "Go to audits",
  },
  de: {
    heroPrimary: "Security Intelligence entdecken",
    heroSecondary: "Audit starten",
    eyebrow: "Security Intelligence / 01",
    title: "Jedes Signal muss den Weg von der Quelle zur Evidenz durchlaufen.",
    body: "Security Intelligence verbindet Herkunft, Aktualität, Abweichungen und fehlende Evidenz. Ein Ergebnis wird nicht freigegeben, weil es überzeugend wirkt — es muss explizite Konfidenz- und Readiness-Grenzen erfüllen.",
    contract: "Öffentlicher Entscheidungsvertrag",
    contractState: "Quellen → Policy → Ergebnis",
    signalLabel: "Matrix der Evidenzqualität",
    signalState: "Entscheidungsstatus / keine Live-Daten",
    signals: [
      ["Herkunft", "Quellengebunden", "Jeder Befund behält Quelle, Scope und Beobachtungszeit.", "verified"],
      ["Aktualität", "Kontrolliert", "Veraltete Beobachtungen senken die Konfidenz, statt zu verschwinden.", "watch"],
      ["Abweichung", "Prüfung", "Widersprüchliche Quellen lösen Arbitration aus, kein erzwungenes Mittel.", "review"],
      ["Fehlende Evidenz", "Blockiert Readiness", "Fehlende Daten werden niemals zu null Risiko.", "blocked"],
    ],
    flowLabel: "Entscheidungskette",
    flowTitle: "Vier Gates vor einem öffentlichen Ergebnis.",
    flow: [
      ["Scope binden", "Zielidentität, Asset-Klasse und autorisierte Analysegrenze."],
      ["Quorum bilden", "Unabhängige Quellenfamilien, Aktualität und Provider-Konflikte."],
      ["Grenzen anwenden", "Konfidenz, Unsicherheit und fehlende Evidenz begrenzen den Claim."],
      ["Spur erhalten", "Packet-Version, Digest und Receipt machen die Entscheidung reproduzierbar."],
    ],
    layersEyebrow: "Schichtarchitektur / 07",
    layersTitle: "Nicht ein magisches Schloss. Sieben unabhängige Grenzen.",
    layersBody: "Die Schichten bleiben getrennt, damit ein Fehler nicht automatisch das ganze System öffnet. Öffentlich zeigen wir die Schutzwirkung, nicht Parameter zum Umgehen der Kontrollen.",
    layers: [
      ["Verschlüsselter Transport", "HTTPS, HSTS und ein geschützter Kanal für bewegte Daten."],
      ["Server-Validierung", "Scope, Format und Berechtigung werden vor der Analyse geprüft."],
      ["KI-Claim-Guard", "Das Modell kann Konfidenz nicht über die Evidenzqualität anheben."],
      ["Abuse-Kontrollen", "Limits und Request-Kosten schützen sensible Pfade."],
      ["Origin-Grenze", "Sensible Requests respektieren Same-Origin-Regeln und Session-Kontext."],
      ["Integritätsledger", "Ereignisse und Reports behalten Version, Digest und Reihenfolge."],
      ["Fail-closed Delivery", "Fehlende Zustimmung, Zahlung oder Evidenz blockiert den Export."],
    ],
    boundaryNote: "Dies beschreibt die Produktarchitektur, nicht Nullrisiko oder garantierte Produktionsleistung.",
    ctaTitle: "Prüfe das System an einem konkreten Fall.",
    ctaBody: "Öffne Intelligence für das Evidenzmodell oder starte einen Security Audit für Projekt, Repository oder Contract.",
    ctaIntelligence: "Intelligence öffnen",
    ctaAudit: "Zu den Audits",
  },
} as const;

const SECURITY_SIGNAL_ICONS = [RadioTower, Clock3, GitBranch, ShieldAlert] as const;
const SECURITY_FLOW_ICONS = [Fingerprint, Database, ShieldCheck, FileSearch] as const;
const SECURITY_LAYER_ICONS = [LockKeyhole, ScanSearch, Sparkles, Activity, Radar, Database, ShieldCheck] as const;

// PASS188 marker: World-class direction, honest delivery.
export default function SecurityTrustPage({ locale }: { locale: string }) {
  const safeLocale = resolveSecurityTrustLocale(locale);
  const c = copy[safeLocale];
  const snapshot = buildSecurityTrustSnapshot(safeLocale);
  const publicPillarCount = securityTrustPillars.length;
  const auditTeaser = auditWatchTeaser[safeLocale];
  const securityIntelligence = securityIntelligenceCopy[safeLocale];
  return (
    <main
      className={`${styles.page} velmere-public-page min-h-screen px-5 pb-24 pt-28 text-white md:px-10 md:pt-36`}
      data-pass2007-security="solid-trust-cyan-no-row-lines"
      data-pass317-public-launch-surface="security"
      data-pass318-security-public-note="true"
    >
      <section className="mx-auto max-w-6xl">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_22rem] lg:items-end">
          <div className="max-w-4xl">
            <p className="inline-flex items-center gap-2 rounded-full border border-velmere-gold/[0.20] bg-velmere-gold/[0.07] px-3 py-2 font-mono text-[9px] uppercase tracking-[0.17em] text-velmere-gold">
              <ShieldCheck className="h-4 w-4" />
              {c.eyebrow}
            </p>
            <h1 className="mt-6 font-serif text-5xl leading-none tracking-[-0.055em] md:text-7xl">{c.title}</h1>
            <p className="mt-6 max-w-3xl text-base leading-8 text-white/[0.60]">{c.subtitle}</p>
            <div className={styles.heroActions}>
              <a href="#security-intelligence" className={styles.heroActionPrimary}>
                {securityIntelligence.heroPrimary}
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </a>
              <Link href="/security/audits" className={styles.heroActionSecondary}>
                {securityIntelligence.heroSecondary}
                <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </div>
            <div className="pass2007-security-command mt-6 rounded-[1.5rem] border border-white/[0.08] bg-[#090b0e] p-5">
              <div className="flex items-center gap-2 text-cyan-100/[0.76]">
                <Sparkles className="h-4 w-4" />
                <p className="font-mono text-[10px] uppercase tracking-[0.18em]">{c.commandTitle}</p>
              </div>
              <p className="mt-4 max-w-3xl text-sm leading-7 text-white/[0.66]">{c.commandBody}</p>
              <div className="mt-5 grid gap-3 md:grid-cols-3">
                {c.metrics.map(([title, body]) => (
                  <div key={title} className="velmere-readout-card rounded-2xl p-4">
                    <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-white/[0.38]">{title}</p>
                    <p className="mt-2 text-xs leading-6 text-white/[0.58]">{body}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="grid gap-3">
            <Link href="/market-integrity" className="velmere-interaction-pulse group rounded-[1.5rem] border border-cyan-200/[0.12] bg-cyan-300/[0.04] p-4 transition hover:border-cyan-200/[0.24] hover:bg-cyan-300/[0.08]">
              <div className="flex items-center justify-between gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-full border border-cyan-200/[0.18] bg-cyan-300/[0.08] text-cyan-100">
                  <Radar className="h-4 w-4" />
                </span>
                <ArrowUpRight className="h-4 w-4 text-cyan-100/70 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </div>
              <p className="mt-4 font-mono text-[9px] uppercase tracking-[0.16em] text-cyan-100/[0.72]">Velmère Shield</p>
              <p className="mt-2 text-sm leading-6 text-white/[0.62]">{c.mapCardBody}</p>
            </Link>
            <Link
              href="/security/audits"
              className="group rounded-[1.5rem] border border-velmere-gold/[0.14] bg-velmere-gold/[0.055] p-4 transition hover:border-velmere-gold/[0.28] hover:bg-velmere-gold/[0.09]"
              data-pass1494-security-audit-watch-link="public-audit-verification"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-full border border-velmere-gold/[0.18] bg-velmere-gold/[0.08] text-velmere-gold">
                  <FileSearch className="h-4 w-4" />
                </span>
                <ArrowUpRight className="h-4 w-4 text-velmere-gold/70 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </div>
              <p className="mt-4 font-mono text-[9px] uppercase tracking-[0.16em] text-velmere-gold">{auditTeaser.label}</p>
              <p className="mt-2 text-sm leading-6 text-white/[0.62]">{auditTeaser.body}</p>
            </Link>
            <div className="velmere-readout-card rounded-[1.5rem] p-4">
              <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-velmere-gold">{c.exportCardTitle}</p>
              <p className="mt-2 text-sm leading-6 text-white/[0.58]">{c.exportCardBody}</p>
            </div>
          </div>
        </div>

        <section className="mt-8">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-velmere-gold">{c.routesTitle}</p>
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            {c.routes.map(([title, body]) => (
              <article key={title} className="velmere-premium-tile velmere-readout-card rounded-[1.5rem] p-5 shadow-velmere-card">
                <h2 className="text-lg font-semibold tracking-[-0.025em] text-white">{title}</h2>
                <p className="mt-3 text-sm leading-7 text-white/[0.52]">{body}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="security-intelligence" className={styles.intelligence} aria-labelledby="security-intelligence-title">
          <div className={styles.intelligenceHeader}>
            <div>
              <p className={styles.kicker}>{securityIntelligence.eyebrow}</p>
              <h2 id="security-intelligence-title" className={styles.intelligenceTitle}>{securityIntelligence.title}</h2>
            </div>
            <div>
              <p className={styles.intelligenceLead}>{securityIntelligence.body}</p>
              <p className={styles.publicContract}>
                <i aria-hidden="true" />
                <span>{securityIntelligence.contract} · {securityIntelligence.contractState}</span>
              </p>
            </div>
          </div>

          <div className={styles.intelligenceGrid}>
            <article className={styles.signalBoard} aria-label={securityIntelligence.signalLabel}>
              <div className={styles.panelTopline}>
                <span className={styles.panelLabel}>{securityIntelligence.signalLabel}</span>
                <span>{securityIntelligence.signalState}</span>
              </div>
              <div className={styles.signalList}>
                {securityIntelligence.signals.map(([title, state, body, tone], index) => {
                  const Icon = SECURITY_SIGNAL_ICONS[index] ?? ShieldCheck;
                  return (
                    <div key={title} className={styles.signalRow} data-tone={tone}>
                      <span className={styles.signalIcon}><Icon className="h-4 w-4" aria-hidden="true" /></span>
                      <span className={styles.signalCopy}>
                        <strong>{title}</strong>
                        <small>{body}</small>
                      </span>
                      <span className={styles.signalState}>{state}</span>
                    </div>
                  );
                })}
              </div>
            </article>

            <article className={styles.flowPanel}>
              <p className={styles.panelLabel}>{securityIntelligence.flowLabel}</p>
              <h3>{securityIntelligence.flowTitle}</h3>
              <div className={styles.flowGrid}>
                {securityIntelligence.flow.map(([title, body], index) => {
                  const Icon = SECURITY_FLOW_ICONS[index] ?? ShieldCheck;
                  return (
                    <div key={title} className={styles.flowStep}>
                      <div className={styles.flowStepTop}>
                        <span>{String(index + 1).padStart(2, "0")}</span>
                        <Icon className="h-4 w-4" aria-hidden="true" />
                      </div>
                      <strong>{title}</strong>
                      <p>{body}</p>
                    </div>
                  );
                })}
              </div>
            </article>
          </div>

          <div className={styles.layerBlock}>
            <div className={styles.layerHeading}>
              <div>
                <p className={styles.layerEyebrow}>{securityIntelligence.layersEyebrow}</p>
                <h3>{securityIntelligence.layersTitle}</h3>
              </div>
              <p>{securityIntelligence.layersBody}</p>
            </div>
            <div className={styles.layerGrid}>
              {securityIntelligence.layers.map(([title, body], index) => {
                const Icon = SECURITY_LAYER_ICONS[index] ?? ShieldCheck;
                return (
                  <article key={title} className={styles.layerCard}>
                    <span>
                      {String(index + 1).padStart(2, "0")}
                      <Icon className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <strong>{title}</strong>
                    <p>{body}</p>
                  </article>
                );
              })}
            </div>
            <p className={styles.boundaryNote}>{securityIntelligence.boundaryNote}</p>
          </div>
        </section>

        <section className="mt-14">
          <h2 className="font-mono text-[10px] uppercase tracking-[0.18em] text-velmere-gold">{c.section}</h2>
          <div className="pass2007-security-protections mt-5 grid gap-3 md:grid-cols-2">
            {c.protections.map(([title, body, Icon]) => (
              <article key={title} className="grid gap-4 rounded-[1.25rem] border border-white/[0.07] bg-[#090b0e] p-5 md:grid-cols-[3rem_1fr] md:items-start md:p-6">
                <span className="grid h-10 w-10 place-items-center rounded-full border border-cyan-200/[0.14] bg-cyan-300/[0.04] text-cyan-100/[0.78]">
                  <Icon className="h-4 w-4" />
                </span>
                <div>
                  <h3 className="text-base font-semibold">{title}</h3>
                  <p className="mt-2 text-sm leading-7 text-white/[0.52]">{body}</p>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="mt-16">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-cyan-200">{c.architecture}</p>
          <div className="mt-4 grid gap-4 md:grid-cols-[minmax(0,.8fr)_minmax(0,1.2fr)] md:items-end">
            <h2 className="font-serif text-4xl leading-[0.98] tracking-[-0.05em] md:text-6xl">{c.architectureTitle}</h2>
            <p className="max-w-2xl text-sm leading-7 text-white/[0.52]">{c.architectureBody}</p>
          </div>
          <div className="mt-7 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {c.innovations.map(([name, label, body, status, Icon]) => (
              <article key={name} className="velmere-premium-tile velmere-interaction-pulse group velmere-readout-card rounded-[1.6rem] p-5 transition hover:border-cyan-200/[0.20] hover:bg-cyan-300/[0.035]">
                <div className="flex items-start justify-between gap-4">
                  <span className="grid h-11 w-11 place-items-center rounded-full border border-cyan-200/[0.14] bg-cyan-300/[0.05] text-cyan-100">
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className={`rounded-full border px-2.5 py-1 font-mono text-[8px] uppercase tracking-[0.13em] ${status === "active" ? "border-emerald-300/[0.16] bg-emerald-300/[0.05] text-emerald-200" : "border-amber-300/[0.16] bg-amber-300/[0.05] text-amber-200"}`}>
                    {status === "active" ? c.active : c.controlled}
                  </span>
                </div>
                <p className="mt-7 font-mono text-[9px] uppercase tracking-[0.16em] text-velmere-gold">{label}</p>
                <h3 className="mt-2 text-xl font-semibold tracking-[-0.025em] text-white">{name}</h3>
                <p className="mt-3 text-sm leading-7 text-white/[0.50]">{body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="mt-8 grid gap-5 rounded-[1.7rem] border border-cyan-200/[0.12] bg-cyan-300/[0.035] p-6 md:grid-cols-[minmax(12rem,.65fr)_minmax(0,1.35fr)] md:p-8">
          <div>
            <LockKeyhole className="h-5 w-5 text-cyan-200" />
            <h2 className="mt-4 font-serif text-3xl tracking-[-0.04em]">{c.privateTitle}</h2>
          </div>
          <div>
            <p className="text-sm leading-7 text-white/[0.56]">{c.privateBody}</p>
            <p className="mt-4 border-t border-white/[0.08] pt-4 text-xs leading-6 text-white/[0.36]">{c.boundary}</p>
          </div>
        </section>

        <section className="mt-8 rounded-[1.7rem] border border-velmere-gold/[0.14] bg-[linear-gradient(145deg,rgba(212,175,55,.06),rgba(255,255,255,.02),rgba(0,0,0,.18))] p-6 md:p-8">
          <div className="grid gap-5 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:items-start">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-velmere-gold">{c.aiBridgeTitle}</p>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-white/[0.60]">{c.aiBridgeBody}</p>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              {c.aiBridgeCards.map(([title, body]) => (
                <div key={title} className="rounded-2xl border border-white/[0.10] bg-black/[0.18] p-4">
                  <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-white/[0.40]">{title}</p>
                  <p className="mt-2 text-xs leading-6 text-white/[0.56]">{body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mt-8 rounded-[1.7rem] border border-white/[0.08] bg-white/[0.025] p-5 md:p-7" data-security-trust-pillars={publicPillarCount}>
          {/* PASS188 marker: Production boundary */}
          <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-velmere-gold">
            {c.productionBoundaryLabel}
          </p>
          <p className="mt-3 text-xs leading-6 text-white/[0.48]">
            {snapshot.productionBoundary}
          </p>
        </section>

        <section className={styles.closingCta}>
          <div>
            <h2>{securityIntelligence.ctaTitle}</h2>
            <p>{securityIntelligence.ctaBody}</p>
          </div>
          <div className={styles.closingActions}>
            <Link href="/intelligence" className={styles.heroActionPrimary}>
              {securityIntelligence.ctaIntelligence}
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
            <Link href="/security/audits" className={styles.heroActionSecondary}>
              {securityIntelligence.ctaAudit}
              <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        </section>

      </section>
    </main>
  );
}

/* PASS2271 public security surface: customer-safe trust copy, no operator control panel in public render. */
