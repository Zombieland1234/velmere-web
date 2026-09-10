"use client";


import { readJsonResponseBounded } from "@/lib/network/fetch-with-deadline";
import {
  AlertTriangle,
  Check,
  CircleDashed,
  Clock3,
  ExternalLink,
  FileSearch,
  LockKeyhole,
  Plus,
  RefreshCw,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocale } from "next-intl";
import {
  forgetAuditCaseRef,
  normalizeAuditCaseRef,
  PASS4614_AUDIT_ACCOUNT_PORTAL_ID,
  PASS4614_AUDIT_CASE_REGISTRY_EVENT,
  readAuditCaseBookmarks,
  rememberAuditCaseRef,
  type AuditCaseBookmark,
  type AuditCaseBookmarkTier,
} from "@/lib/security/audit-case-client-registry";

type Locale = "pl" | "en" | "de";
type PortalState = "idle" | "loading" | "ready" | "not_found" | "unauthorized" | "unavailable" | "offline" | "error";
type AuditCaseStatus = "queued_basic_prescreen" | "awaiting_entitlement" | "checkout_pending" | "queued_paid_review" | "payment_blocked" | "access_revoked";
type QueueLane = "basic_prescreen" | "payment_verification" | "pro_review" | "advanced_automation" | "advanced_human_review" | "blocked";
type PaymentState = "not_required" | "awaiting" | "pending" | "verified" | "failed" | "expired" | "refunded" | "chargeback";
type HistoryEventType = "case_created" | "checkout_bound" | "payment_verified" | "queued_for_review" | "payment_blocked" | "access_revoked" | "analysis_started" | "analysis_completed" | "status_changed" | "migration_snapshot" | "reviewer_assigned" | "automation_claimed" | "review_requeued" | "review_dead_lettered" | "automation_completed";
type AuditHistoryEvent = { sequence: number; type: HistoryEventType; previousStatus: string | null; status: string; queueLane: QueueLane; paymentState: PaymentState; analysisStarted: boolean; reason: string | null; occurredAt: string; receiptHash: string; previousReceiptHash: string | null; origin: "native" | "migration_snapshot" | "memory_runtime_only" };
type ReviewState = "queued" | "assigned" | "leased" | "retry_wait" | "dead_letter" | "completed" | "revoked";
type ReviewMode = "basic_prescreen" | "pro_automation" | "advanced_automation";
type SlaState = "not_applicable" | "waiting_assignment" | "on_track" | "due_soon" | "breached" | "completed" | "revoked";

type AuditCasePayload = {
  passId: string;
  caseRef: string;
  tier: AuditCaseBookmarkTier;
  status: AuditCaseStatus;
  queueLane: QueueLane;
  paymentState: PaymentState;
  entitlementRequired: boolean;
  entitlementVerified: boolean;
  analysisStarted: boolean;
  checkoutBound: boolean;
  target: { kind: "contract" | "github" | "url"; hash: string };
  timestamps: {
    createdAt: string;
    updatedAt: string;
    entitlementVerifiedAt: string | null;
    blockedAt: string | null;
  };
  latestPaymentReceipt: { eventHash: string; reason: string; recordedAt: string } | null;
  durable: boolean;
  storageMode: string;
  boundary: string;
  review: {
    passId: string;
    available: boolean;
    processingMode: ReviewMode;
    state: ReviewState;
    humanReviewerAssigned: boolean;
    automationLeaseActive: boolean;
    attemptCount: number;
    maxAttempts: number;
    sla: { state: SlaState; dueAt: string | null; assignedAt: string | null; completedAt: string | null };
    boundary: string;
    error?: "review_orchestration_unavailable";
  };
  history: {
    passId: string;
    available: boolean;
    appendOnly: true;
    complete: boolean;
    truncated: boolean;
    totalEvents: number;
    mode: "supabase_durable" | "memory_runtime_only" | "unavailable";
    events: AuditHistoryEvent[];
    boundary: string;
    error?: "history_unavailable";
  };
};

type StatusEnvelope = {
  ok?: boolean;
  error?: string;
  case?: AuditCasePayload;
};

type TimelineTone = "done" | "active" | "pending" | "blocked";
type TimelineItem = { label: string; body: string; at?: string | null; tone: TimelineTone };

const COPY = {
  pl: {
    kicker: "PRYWATNE SPRAWY AUDYTOWE",
    title: "Status audytu.",
    body: "Sprawdzaj wyłącznie sprawy przypisane do tego konta. Portal pokazuje aktualny, zweryfikowany stan — bez prywatnego targetu, identyfikatorów Stripe i danych operatora.",
    addLabel: "Dodaj numer sprawy",
    placeholder: "AUD-XXXXXXXXXX",
    add: "Dodaj",
    invalid: "Wpisz poprawny numer w formacie AUD-…",
    empty: "Nie masz zapisanych numerów spraw.",
    emptyBody: "Po utworzeniu audytu numer zostanie zapisany na tym urządzeniu. Możesz też dodać go ręcznie.",
    newAudit: "Utwórz nowy audyt",
    savedCases: "Zapisane sprawy",
    remove: "Usuń z urządzenia",
    refresh: "Odśwież status",
    refreshing: "Sprawdzanie…",
    automatic: "Automatyczne odświeżanie aktywne",
    paused: "Automatyczne odświeżanie wstrzymane",
    lastChecked: "Ostatnie sprawdzenie",
    currentState: "Bieżący stan",
    plan: "Plan",
    queue: "Kolejka",
    payment: "Płatność",
    analysis: "Analiza",
    target: "Typ targetu",
    updated: "Aktualizacja",
    durable: "Trwały zapis",
    yes: "Tak",
    no: "Nie",
    timeline: "Potwierdzona historia sprawy",
    timelineNote: "Niezmienny, customer-safe łańcuch zdarzeń — nie pełna historia zdarzeń operatorskich. Bez prywatnego targetu, danych operatora i identyfikatorów płatności.",
    historyUnavailable: "Trwała historia jest chwilowo niedostępna. Poniżej pokazujemy wyłącznie bieżący snapshot — bez udawania pełnej osi czasu.",
    historyIncomplete: "Historia zaczyna się od jawnego snapshotu migracyjnego; wcześniejsze zdarzenia nie są dopisywane wstecz.",
    historyTruncated: "Pokazano najnowsze zdarzenia. Starsze wpisy pozostają w trwałym ledgerze.",
    privacyTitle: "Granica prywatności",
    privacyBody: "Przeglądarka zapisuje wyłącznie numer sprawy, opcjonalny plan i czas ostatniego odczytu. Pełny target pozostaje w prywatnym vaultcie po stronie serwera.",
    status: {
      queued_basic_prescreen: "Basic pre-screen w kolejce",
      awaiting_entitlement: "Oczekiwanie na dostęp",
      checkout_pending: "Weryfikacja checkoutu",
      queued_paid_review: "Płatny review w kolejce",
      payment_blocked: "Płatność zablokowana",
      access_revoked: "Dostęp cofnięty",
    },
    queueLabel: {
      basic_prescreen: "Basic pre-screen",
      payment_verification: "Weryfikacja płatności",
      pro_review: "Pro · review automatyczny",
      advanced_automation: "Advanced · analiza automatyczna",
      advanced_human_review: "Advanced · zapis legacy",
      blocked: "Zablokowana",
    },
    paymentLabel: {
      not_required: "Niewymagana",
      awaiting: "Oczekiwanie",
      pending: "W toku",
      verified: "Potwierdzona",
      failed: "Nieudana",
      expired: "Wygasła",
      refunded: "Zwrot",
      chargeback: "Chargeback",
    },
    analysisStarted: "Uruchomiona",
    analysisNotStarted: "Nieuruchomiona",
    loading: "Pobieramy status sprawy…",
    offline: "Brak połączenia. Zachowujemy ostatni potwierdzony status i spróbujemy ponownie po powrocie sieci.",
    unauthorized: "Sesja konta wygasła albo nie jest dostępna. Zaloguj się ponownie.",
    notFound: "Sprawa nie istnieje albo nie należy do tego konta.",
    unavailable: "Prywatny vault chwilowo nie odpowiada. Nie zmieniamy ostatniego potwierdzonego statusu.",
    genericError: "Nie udało się pobrać statusu. Spróbujemy ponownie z bezpiecznym opóźnieniem.",
    noSelection: "Wybierz sprawę z listy albo dodaj numer AUD-…",
    stages: {
      created: "Sprawa przyjęta",
      createdBody: "Numer sprawy został utworzony i przypisany do konta.",
      payment: "Weryfikacja dostępu",
      paymentBasic: "Plan Basic nie wymaga płatności.",
      paymentWaiting: "Dostęp nie został jeszcze potwierdzony.",
      paymentVerified: "Entitlement został potwierdzony po stronie serwera.",
      paymentBlocked: "Płatność nie została potwierdzona lub wygasła.",
      paymentRevoked: "Zwrot albo chargeback cofnął dostęp.",
      queue: "Kolejka audytowa",
      queueBasic: "Sprawa czeka na Basic pre-screen.",
      queuePro: "Sprawa czeka w kolejce Pro.",
      queueAdvanced: "Sprawa czeka na ręczną weryfikację Advanced.",
      queueWaiting: "Kolejka zostanie nadana po potwierdzeniu dostępu.",
      queueBlocked: "Sprawa nie może wejść do kolejki w obecnym stanie.",
      analysis: "Analiza",
      analysisStarted: "Analiza została jawnie uruchomiona przez bezpieczny workflow.",
      analysisWaiting: "Analiza nie wystartowała automatycznie.",
    },
    historyEvents: {
      case_created: ["Sprawa przyjęta", "Prywatny rekord sprawy został utworzony i przypisany do konta."],
      checkout_bound: ["Checkout przypisany", "Sprawa została atomowo powiązana z jedną sesją checkoutu."],
      payment_verified: ["Dostęp potwierdzony", "Serwer zweryfikował entitlement; sam powrót z checkoutu nie uruchomił analizy."],
      queued_for_review: ["Kolejka nadana", "Sprawa weszła do właściwej kolejki Basic, Pro albo Advanced."],
      payment_blocked: ["Płatność zablokowana", "Checkout wygasł albo płatność nie została potwierdzona."],
      access_revoked: ["Dostęp cofnięty", "Zwrot albo chargeback cofnął entitlement i zatrzymał analizę."],
      analysis_started: ["Analiza uruchomiona", "Bezpieczny workflow jawnie uruchomił analizę."],
      analysis_completed: ["Analiza zakończona", "Workflow zakończył etap analizy."],
      status_changed: ["Status zaktualizowany", "Trwały rekord sprawy przeszedł do nowego stanu."],
      migration_snapshot: ["Snapshot migracyjny", "To pierwszy potwierdzony snapshot istniejącej sprawy, a nie odtworzona historia."],
      reviewer_assigned: ["Reviewer przypisany", "Sprawa Advanced otrzymała ręcznego reviewera; jego tożsamość nie jest ujawniana w portalu."],
      automation_claimed: ["Proces automatyczny zarezerwowany", "Sprawa Pro została przejęta przez krótką, hashowaną dzierżawę workera."],
      review_requeued: ["Ponowienie zaplanowane", "Automatyczny review nie zakończył się i został bezpiecznie odłożony do ponowienia."],
      review_dead_lettered: ["Wymagana interwencja", "Limit automatycznych prób został wyczerpany; sprawa trafiła do prywatnej kolejki operatora."],
      automation_completed: ["Automatyczny review zakończony", "Worker zakończył etap automatycznego przetwarzania."],
    },
  },
  en: {
    kicker: "PRIVATE AUDIT CASES",
    title: "Audit status.",
    body: "Track only cases owned by this account. The portal shows the current verified state without exposing the private target, Stripe identifiers or operator data.",
    addLabel: "Add case reference",
    placeholder: "AUD-XXXXXXXXXX",
    add: "Add",
    invalid: "Enter a valid AUD-… reference.",
    empty: "No case references are saved.",
    emptyBody: "A reference is saved on this device after audit intake. You can also add it manually.",
    newAudit: "Create a new audit",
    savedCases: "Saved cases",
    remove: "Remove from device",
    refresh: "Refresh status",
    refreshing: "Checking…",
    automatic: "Automatic refresh active",
    paused: "Automatic refresh paused",
    lastChecked: "Last checked",
    currentState: "Current state",
    plan: "Plan",
    queue: "Queue",
    payment: "Payment",
    analysis: "Analysis",
    target: "Target type",
    updated: "Updated",
    durable: "Durable storage",
    yes: "Yes",
    no: "No",
    timeline: "Verified case history",
    timelineNote: "An immutable customer-safe event chain, not a complete operator event history. It excludes the private target, operator data and payment identifiers.",
    historyUnavailable: "Durable history is temporarily unavailable. Only the current snapshot is shown below; it is not presented as a complete timeline.",
    historyIncomplete: "History starts with an explicit migration snapshot; earlier events are not reconstructed retroactively.",
    historyTruncated: "The newest events are shown. Older entries remain in the durable ledger.",
    privacyTitle: "Privacy boundary",
    privacyBody: "The browser stores only the case reference, optional tier and last-seen time. The full target stays in the private server-side vault.",
    status: {
      queued_basic_prescreen: "Basic pre-screen queued",
      awaiting_entitlement: "Awaiting access",
      checkout_pending: "Checkout verification",
      queued_paid_review: "Paid review queued",
      payment_blocked: "Payment blocked",
      access_revoked: "Access revoked",
    },
    queueLabel: {
      basic_prescreen: "Basic pre-screen",
      payment_verification: "Payment verification",
      pro_review: "Pro · automated review",
      advanced_automation: "Advanced · automated analysis",
      advanced_human_review: "Advanced · legacy record",
      blocked: "Blocked",
    },
    paymentLabel: {
      not_required: "Not required",
      awaiting: "Awaiting",
      pending: "Pending",
      verified: "Verified",
      failed: "Failed",
      expired: "Expired",
      refunded: "Refunded",
      chargeback: "Chargeback",
    },
    analysisStarted: "Started",
    analysisNotStarted: "Not started",
    loading: "Retrieving the case status…",
    offline: "You are offline. The last verified status is preserved and polling resumes when the connection returns.",
    unauthorized: "The account session expired or is unavailable. Sign in again.",
    notFound: "The case does not exist or is not owned by this account.",
    unavailable: "The private vault is temporarily unavailable. The last verified state is not overwritten.",
    genericError: "Could not retrieve the status. The portal will retry with a safe delay.",
    noSelection: "Select a saved case or add an AUD-… reference.",
    stages: {
      created: "Case accepted",
      createdBody: "The case reference was created and bound to the account.",
      payment: "Access verification",
      paymentBasic: "Basic does not require payment.",
      paymentWaiting: "Access has not been verified yet.",
      paymentVerified: "The entitlement was verified server-side.",
      paymentBlocked: "Payment was not confirmed or expired.",
      paymentRevoked: "A refund or chargeback revoked access.",
      queue: "Audit queue",
      queueBasic: "The case is waiting for Basic pre-screen.",
      queuePro: "The case is waiting in the Pro queue.",
      queueAdvanced: "Advanced is not available for this case.",
      queueWaiting: "A queue lane is assigned after access verification.",
      queueBlocked: "The case cannot enter a queue in its current state.",
      analysis: "Analysis",
      analysisStarted: "Analysis was explicitly started by the secure workflow.",
      analysisWaiting: "Analysis did not start automatically.",
    },
    historyEvents: {
      case_created: ["Case accepted", "The private case record was created and bound to the account."],
      checkout_bound: ["Checkout bound", "The case was atomically bound to one checkout session."],
      payment_verified: ["Access verified", "The server verified the entitlement; returning from checkout did not start analysis."],
      queued_for_review: ["Queue assigned", "The case entered the correct Basic, Pro or Advanced queue."],
      payment_blocked: ["Payment blocked", "Checkout expired or payment was not confirmed."],
      access_revoked: ["Access revoked", "A refund or chargeback revoked entitlement and stopped analysis."],
      analysis_started: ["Analysis started", "The secure workflow explicitly started analysis."],
      analysis_completed: ["Analysis completed", "The workflow completed the analysis stage."],
      status_changed: ["Status updated", "The durable case record moved to a new state."],
      migration_snapshot: ["Migration snapshot", "This is the first verified snapshot of an existing case, not reconstructed history."],
      reviewer_assigned: ["Legacy verification record", "A legacy reviewer-assignment event was recorded; it does not indicate a current customer entitlement or included review."],
      automation_claimed: ["Automation reserved", "The Pro case was claimed through a short-lived hashed worker lease."],
      review_requeued: ["Retry scheduled", "Automated review did not complete and was safely queued for another attempt."],
      review_dead_lettered: ["Operator action required", "The automated retry limit was reached and the case moved to a private operator queue."],
      automation_completed: ["Automation completed", "The worker completed the automated processing stage."],
    },
  },
  de: {
    kicker: "PRIVATE AUDIT-FÄLLE",
    title: "Audit-Status.",
    body: "Verfolge nur Fälle dieses Kontos. Das Portal zeigt den aktuellen verifizierten Zustand, ohne privates Target, Stripe-IDs oder Operatordaten offenzulegen.",
    addLabel: "Fallreferenz hinzufügen",
    placeholder: "AUD-XXXXXXXXXX",
    add: "Hinzufügen",
    invalid: "Gültige AUD-… Referenz eingeben.",
    empty: "Keine Fallreferenzen gespeichert.",
    emptyBody: "Nach der Audit-Anfrage wird die Referenz auf diesem Gerät gespeichert. Sie kann auch manuell hinzugefügt werden.",
    newAudit: "Neues Audit erstellen",
    savedCases: "Gespeicherte Fälle",
    remove: "Vom Gerät entfernen",
    refresh: "Status aktualisieren",
    refreshing: "Prüfung…",
    automatic: "Automatische Aktualisierung aktiv",
    paused: "Automatische Aktualisierung pausiert",
    lastChecked: "Zuletzt geprüft",
    currentState: "Aktueller Zustand",
    plan: "Plan",
    queue: "Warteschlange",
    payment: "Zahlung",
    analysis: "Analyse",
    target: "Target-Typ",
    updated: "Aktualisiert",
    durable: "Dauerhafte Speicherung",
    yes: "Ja",
    no: "Nein",
    timeline: "Verifizierter Fallverlauf",
    timelineNote: "Eine unveränderliche, kundensichere Ereigniskette ohne privates Target, Operatordaten oder Zahlungs-IDs.",
    historyUnavailable: "Der dauerhafte Verlauf ist vorübergehend nicht verfügbar. Unten wird nur der aktuelle Snapshot gezeigt, nicht als vollständige Timeline.",
    historyIncomplete: "Der Verlauf beginnt mit einem expliziten Migrations-Snapshot; frühere Ereignisse werden nicht rückwirkend erfunden.",
    historyTruncated: "Die neuesten Ereignisse werden angezeigt. Ältere Einträge bleiben im dauerhaften Ledger.",
    privacyTitle: "Datenschutzgrenze",
    privacyBody: "Der Browser speichert nur Fallreferenz, optionalen Plan und letzte Sichtung. Das vollständige Target bleibt im privaten Server-Vault.",
    status: {
      queued_basic_prescreen: "Basic Pre-Screen eingereiht",
      awaiting_entitlement: "Access ausstehend",
      checkout_pending: "Checkout-Prüfung",
      queued_paid_review: "Bezahltes Review eingereiht",
      payment_blocked: "Zahlung blockiert",
      access_revoked: "Access widerrufen",
    },
    queueLabel: {
      basic_prescreen: "Basic Pre-Screen",
      payment_verification: "Zahlungsprüfung",
      pro_review: "Pro · automatisiertes Review",
      advanced_automation: "Advanced · automatisierte Analyse",
      advanced_human_review: "Advanced · Legacy-Datensatz",
      blocked: "Blockiert",
    },
    paymentLabel: {
      not_required: "Nicht erforderlich",
      awaiting: "Ausstehend",
      pending: "In Prüfung",
      verified: "Bestätigt",
      failed: "Fehlgeschlagen",
      expired: "Abgelaufen",
      refunded: "Erstattet",
      chargeback: "Chargeback",
    },
    analysisStarted: "Gestartet",
    analysisNotStarted: "Nicht gestartet",
    loading: "Fallstatus wird abgerufen…",
    offline: "Keine Verbindung. Der letzte verifizierte Status bleibt erhalten; Polling startet nach Rückkehr der Verbindung.",
    unauthorized: "Die Kontositzung ist abgelaufen oder nicht verfügbar. Bitte erneut anmelden.",
    notFound: "Der Fall existiert nicht oder gehört nicht zu diesem Konto.",
    unavailable: "Der private Vault ist vorübergehend nicht verfügbar. Der letzte verifizierte Status wird nicht überschrieben.",
    genericError: "Status konnte nicht abgerufen werden. Das Portal versucht es mit sicherer Verzögerung erneut.",
    noSelection: "Gespeicherten Fall wählen oder AUD-… Referenz hinzufügen.",
    stages: {
      created: "Fall angenommen",
      createdBody: "Die Fallreferenz wurde erstellt und dem Konto zugeordnet.",
      payment: "Access-Verifizierung",
      paymentBasic: "Basic erfordert keine Zahlung.",
      paymentWaiting: "Access wurde noch nicht bestätigt.",
      paymentVerified: "Das Entitlement wurde serverseitig bestätigt.",
      paymentBlocked: "Zahlung wurde nicht bestätigt oder ist abgelaufen.",
      paymentRevoked: "Erstattung oder Chargeback hat den Access widerrufen.",
      queue: "Audit-Warteschlange",
      queueBasic: "Der Fall wartet auf Basic Pre-Screen.",
      queuePro: "Der Fall wartet in der Pro-Warteschlange.",
      queueAdvanced: "Advanced ist für diesen Fall nicht verfügbar.",
      queueWaiting: "Die Warteschlange wird nach Access-Verifizierung zugewiesen.",
      queueBlocked: "Der Fall kann im aktuellen Zustand nicht eingereiht werden.",
      analysis: "Analyse",
      analysisStarted: "Die Analyse wurde ausdrücklich durch den sicheren Workflow gestartet.",
      analysisWaiting: "Die Analyse startete nicht automatisch.",
    },
    historyEvents: {
      case_created: ["Fall angenommen", "Der private Falldatensatz wurde erstellt und dem Konto zugeordnet."],
      checkout_bound: ["Checkout verknüpft", "Der Fall wurde atomar mit genau einer Checkout-Sitzung verknüpft."],
      payment_verified: ["Access bestätigt", "Der Server bestätigte das Entitlement; die Checkout-Rückkehr startete keine Analyse."],
      queued_for_review: ["Warteschlange zugewiesen", "Der Fall wurde der richtigen Basic-, Pro- oder Advanced-Warteschlange zugewiesen."],
      payment_blocked: ["Zahlung blockiert", "Checkout ist abgelaufen oder die Zahlung wurde nicht bestätigt."],
      access_revoked: ["Access widerrufen", "Erstattung oder Chargeback widerriefen das Entitlement und stoppten die Analyse."],
      analysis_started: ["Analyse gestartet", "Der sichere Workflow startete die Analyse ausdrücklich."],
      analysis_completed: ["Analyse abgeschlossen", "Der Workflow schloss die Analysephase ab."],
      status_changed: ["Status aktualisiert", "Der dauerhafte Falldatensatz wechselte in einen neuen Zustand."],
      migration_snapshot: ["Migrations-Snapshot", "Dies ist der erste bestätigte Snapshot eines bestehenden Falls, keine rekonstruierte Historie."],
      reviewer_assigned: ["Reviewer zugewiesen", "Der Advanced-Fall erhielt einen menschlichen Reviewer; dessen Identität wird im Portal nicht offengelegt."],
      automation_claimed: ["Automatisierung reserviert", "Der Pro-Fall wurde über eine kurzlebige, gehashte Worker-Lease übernommen."],
      review_requeued: ["Wiederholung geplant", "Das automatische Review wurde nicht abgeschlossen und sicher erneut eingereiht."],
      review_dead_lettered: ["Operator-Eingriff erforderlich", "Das Retry-Limit wurde erreicht; der Fall liegt in einer privaten Operator-Warteschlange."],
      automation_completed: ["Automatisierung abgeschlossen", "Der Worker schloss die automatische Verarbeitungsphase ab."],
    },
  },
} as const;

const REVIEW_COPY = {
  pl: { title: "Orkiestracja review", mode: { basic_prescreen: "Basic · pre-screen", pro_automation: "Pro · automatyzacja", advanced_automation: "Advanced · automatyzacja" }, state: { queued: "W kolejce", assigned: "Legacy verification record", leased: "Worker aktywny", retry_wait: "Oczekiwanie na retry", dead_letter: "Interwencja operatora", completed: "Zakończone", revoked: "Cofnięte" }, reviewer: "Legacy verifier", assigned: "Zapis istnieje", unassigned: "Brak zapisu", attempts: "Próby", sla: "SLA", slaState: { not_applicable: "Niedotyczy", waiting_assignment: "Czeka na przypisanie", on_track: "W terminie", due_soon: "Termin blisko", breached: "Przekroczone", completed: "Zakończone", revoked: "Cofnięte" }, unavailable: "Status orkiestracji chwilowo niedostępny." },
  en: { title: "Review orchestration", mode: { basic_prescreen: "Basic · pre-screen", pro_automation: "Pro · automation", advanced_automation: "Advanced · automation" }, state: { queued: "Queued", assigned: "Legacy verification record", leased: "Worker active", retry_wait: "Waiting for retry", dead_letter: "Operator action", completed: "Completed", revoked: "Revoked" }, reviewer: "Legacy verifier", assigned: "Record present", unassigned: "No record", attempts: "Attempts", sla: "SLA", slaState: { not_applicable: "Not applicable", waiting_assignment: "Waiting assignment", on_track: "On track", due_soon: "Due soon", breached: "Breached", completed: "Completed", revoked: "Revoked" }, unavailable: "Review orchestration is temporarily unavailable." },
  de: { title: "Review-Orchestrierung", mode: { basic_prescreen: "Basic · Pre-Screen", pro_automation: "Pro · Automatisierung", advanced_automation: "Advanced · Automatisierung" }, state: { queued: "Eingereiht", assigned: "Legacy-Prüfdatensatz", leased: "Worker aktiv", retry_wait: "Wartet auf Retry", dead_letter: "Operator-Eingriff", completed: "Abgeschlossen", revoked: "Widerrufen" }, reviewer: "Legacy-Prüfer", assigned: "Datensatz vorhanden", unassigned: "Kein Datensatz", attempts: "Versuche", sla: "SLA", slaState: { not_applicable: "Nicht zutreffend", waiting_assignment: "Wartet auf Zuweisung", on_track: "Im Zeitplan", due_soon: "Termin naht", breached: "Überschritten", completed: "Abgeschlossen", revoked: "Widerrufen" }, unavailable: "Review-Orchestrierung ist vorübergehend nicht verfügbar." },
} as const;

function formatDate(value: string | null | undefined, locale: Locale) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  const language = locale === "pl" ? "pl-PL" : locale === "de" ? "de-DE" : "en-GB";
  return new Intl.DateTimeFormat(language, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function isTerminal(status: AuditCaseStatus | undefined) {
  return status === "payment_blocked" || status === "access_revoked";
}

function buildSnapshotTimeline(data: AuditCasePayload, t: (typeof COPY)[Locale]): TimelineItem[] {
  const paymentBlocked = data.status === "payment_blocked";
  const revoked = data.status === "access_revoked";
  const paymentDone = !data.entitlementRequired || data.entitlementVerified;
  const queueActive = data.status === "queued_basic_prescreen" || data.status === "queued_paid_review";
  const paymentBody = !data.entitlementRequired ? t.stages.paymentBasic : revoked ? t.stages.paymentRevoked : paymentBlocked ? t.stages.paymentBlocked : data.entitlementVerified ? t.stages.paymentVerified : t.stages.paymentWaiting;
  const queueBody = data.queueLane === "basic_prescreen" ? t.stages.queueBasic : data.queueLane === "pro_review" ? t.stages.queuePro : (data.queueLane === "advanced_automation" || data.queueLane === "advanced_human_review") ? t.stages.queueAdvanced : data.queueLane === "blocked" ? t.stages.queueBlocked : t.stages.queueWaiting;
  return [
    { label: t.stages.created, body: t.stages.createdBody, at: data.timestamps.createdAt, tone: "done" },
    { label: t.stages.payment, body: paymentBody, at: data.timestamps.entitlementVerifiedAt ?? data.timestamps.blockedAt, tone: revoked || paymentBlocked ? "blocked" : paymentDone ? "done" : "active" },
    { label: t.stages.queue, body: queueBody, at: queueActive ? data.timestamps.updatedAt : null, tone: data.queueLane === "blocked" ? "blocked" : queueActive ? "active" : "pending" },
    { label: t.stages.analysis, body: data.analysisStarted ? t.stages.analysisStarted : t.stages.analysisWaiting, tone: data.analysisStarted ? "active" : revoked || paymentBlocked ? "blocked" : "pending" },
  ];
}

function buildTimeline(data: AuditCasePayload, t: (typeof COPY)[Locale]): TimelineItem[] {
  if (!data.history?.available || !data.history.events.length) return buildSnapshotTimeline(data, t);
  return data.history.events.map((event) => {
    const copy = t.historyEvents[event.type];
    const blocked = event.type === "payment_blocked" || event.type === "access_revoked";
    const active = event.type === "queued_for_review" || event.type === "analysis_started" || event.type === "reviewer_assigned" || event.type === "automation_claimed" || event.type === "review_requeued";
    return { label: copy[0], body: copy[1], at: event.occurredAt, tone: blocked ? "blocked" : active ? "active" : "done" };
  });
}

function TimelineIcon({ tone }: { tone: TimelineTone }) {
  if (tone === "done") return <Check className="h-4 w-4" aria-hidden="true" />;
  if (tone === "blocked") return <AlertTriangle className="h-4 w-4" aria-hidden="true" />;
  if (tone === "active") return <RefreshCw className="h-4 w-4" aria-hidden="true" />;
  return <CircleDashed className="h-4 w-4" aria-hidden="true" />;
}

export default function AuditCasesPortalClient() {
  const rawLocale = useLocale();
  const locale: Locale = rawLocale === "pl" || rawLocale === "de" ? rawLocale : "en";
  const t = COPY[locale];
  const [bookmarks, setBookmarks] = useState<AuditCaseBookmark[]>([]);
  const [selectedRef, setSelectedRef] = useState("");
  const [input, setInput] = useState("");
  const [inputTouched, setInputTouched] = useState(false);
  const [portalState, setPortalState] = useState<PortalState>("idle");
  const [status, setStatus] = useState<AuditCasePayload | null>(null);
  const [etag, setEtag] = useState("");
  const [lastCheckedAt, setLastCheckedAt] = useState<string | null>(null);
  const [retryAttempt, setRetryAttempt] = useState(0);
  const abortRef = useRef<AbortController | null>(null);
  const requestSequenceRef = useRef(0);
  const selectedRefRef = useRef("");
  const statusTierRef = useRef<AuditCaseBookmarkTier | undefined>(undefined);

  const syncBookmarks = useCallback(() => {
    const next = readAuditCaseBookmarks();
    setBookmarks(next);
    setSelectedRef((current) => current || next[0]?.caseRef || "");
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const queryRef = normalizeAuditCaseRef(params.get("caseRef"));
    if (queryRef) rememberAuditCaseRef(queryRef);
    const initialSyncTimer = window.setTimeout(syncBookmarks, 0);
    const onRegistry = () => syncBookmarks();
    window.addEventListener(PASS4614_AUDIT_CASE_REGISTRY_EVENT, onRegistry);
    return () => {
      window.clearTimeout(initialSyncTimer);
      window.removeEventListener(PASS4614_AUDIT_CASE_REGISTRY_EVENT, onRegistry);
    };
  }, [syncBookmarks]);

  useEffect(() => {
    selectedRefRef.current = selectedRef;
    statusTierRef.current = undefined;
    const resetTimer = window.setTimeout(() => {
      setStatus(null);
      setEtag("");
      setLastCheckedAt(null);
      setRetryAttempt(0);
      setPortalState(selectedRef ? "loading" : "idle");
    }, 0);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("tab", "audits");
      if (selectedRef) url.searchParams.set("caseRef", selectedRef);
      else url.searchParams.delete("caseRef");
      window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
    }
    return () => window.clearTimeout(resetTimer);
  }, [selectedRef]);

  const fetchStatus = useCallback(async (reason: "initial" | "poll" | "manual" | "online") => {
    const caseRef = normalizeAuditCaseRef(selectedRefRef.current);
    if (!caseRef) return;
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      setPortalState("offline");
      return;
    }
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const sequence = ++requestSequenceRef.current;
    if (reason === "manual" || reason === "initial") setPortalState("loading");
    try {
      const response = await fetch(`/api/security/audit-case/status?caseRef=${encodeURIComponent(caseRef)}`, {
        method: "GET",
        credentials: "same-origin",
        cache: "no-store",
        headers: etag ? { "if-none-match": etag } : undefined,
        signal: controller.signal,
      });
      if (controller.signal.aborted || sequence !== requestSequenceRef.current || selectedRefRef.current !== caseRef) return;
      const checkedAt = new Date().toISOString();
      if (response.status === 304) {
        setLastCheckedAt(checkedAt);
        setPortalState("ready");
        setRetryAttempt(0);
        rememberAuditCaseRef(caseRef, { lastSeenAt: checkedAt, tier: statusTierRef.current });
        return;
      }
      const payload = await readJsonResponseBounded<StatusEnvelope>(response, 2 * 1024 * 1024).catch(() => ({} as StatusEnvelope));
      if (!response.ok || !payload.ok || !payload.case) {
        if (response.status === 401) setPortalState("unauthorized");
        else if (response.status === 404) setPortalState("not_found");
        else if (response.status === 503) setPortalState("unavailable");
        else setPortalState("error");
        setLastCheckedAt(checkedAt);
        setRetryAttempt((current) => Math.min(current + 1, 4));
        return;
      }
      const nextEtag = response.headers.get("etag");
      if (nextEtag) setEtag(nextEtag);
      statusTierRef.current = payload.case.tier;
      setStatus(payload.case);
      setLastCheckedAt(checkedAt);
      setPortalState("ready");
      setRetryAttempt(0);
      rememberAuditCaseRef(payload.case.caseRef, {
        tier: payload.case.tier,
        lastSeenAt: checkedAt,
      });
    } catch {
      if (controller.signal.aborted || sequence !== requestSequenceRef.current) return;
      setPortalState(typeof navigator !== "undefined" && navigator.onLine === false ? "offline" : "error");
      setRetryAttempt((current) => Math.min(current + 1, 4));
    }
  }, [etag]);

  useEffect(() => {
    if (!selectedRef) return undefined;
    const initialFetchTimer = window.setTimeout(() => {
      void fetchStatus("initial");
    }, 0);
    return () => {
      window.clearTimeout(initialFetchTimer);
      abortRef.current?.abort();
    };
  }, [fetchStatus, selectedRef]);

  useEffect(() => {
    if (!selectedRef || portalState === "unauthorized" || portalState === "not_found" || isTerminal(status?.status)) return undefined;
    const baseDelay = portalState === "ready" ? 20_000 : Math.min(15_000 * Math.max(1, retryAttempt), 60_000);
    const timer = window.setTimeout(() => {
      if (document.visibilityState === "visible" && navigator.onLine !== false) void fetchStatus("poll");
    }, baseDelay);
    return () => window.clearTimeout(timer);
  }, [fetchStatus, portalState, retryAttempt, selectedRef, status?.status]);

  useEffect(() => {
    const onOnline = () => {
      if (selectedRefRef.current) void fetchStatus("online");
    };
    const onOffline = () => setPortalState("offline");
    const onVisibility = () => {
      if (document.visibilityState === "visible" && selectedRefRef.current && navigator.onLine !== false) void fetchStatus("online");
    };
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [fetchStatus]);

  const normalizedInput = normalizeAuditCaseRef(input);
  const addCase = () => {
    setInputTouched(true);
    if (!normalizedInput) return;
    rememberAuditCaseRef(normalizedInput);
    setSelectedRef(normalizedInput);
    setInput("");
    setInputTouched(false);
  };

  const timeline = useMemo(() => status ? buildTimeline(status, t) : [], [status, t]);
  const stateMessage = portalState === "loading"
    ? t.loading
    : portalState === "offline"
      ? t.offline
      : portalState === "unauthorized"
        ? t.unauthorized
        : portalState === "not_found"
          ? t.notFound
          : portalState === "unavailable"
            ? t.unavailable
            : portalState === "error"
              ? t.genericError
              : !selectedRef
                ? t.noSelection
                : "";
  const pollingActive = Boolean(selectedRef && !isTerminal(status?.status) && portalState !== "unauthorized" && portalState !== "not_found");

  return (
    <section
      className="mt-7"
      data-pass4614-audit-account-portal={PASS4614_AUDIT_ACCOUNT_PORTAL_ID}
      data-portal-state={portalState}
      data-selected-case={selectedRef || "none"}
    >
      <header className="rounded-[1.75rem] border border-cyan-200/[0.13] bg-[linear-gradient(135deg,rgba(103,232,249,0.05),rgba(255,255,255,0.018),rgba(0,0,0,0.22))] p-5 md:p-7">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-cyan-100/[0.74]">{t.kicker}</p>
            <h2 className="mt-3 font-serif text-[clamp(2.4rem,5vw,4.7rem)] leading-[0.9] tracking-[-0.05em] text-white">{t.title}</h2>
            <p className="mt-4 text-sm leading-7 text-white/[0.56]">{t.body}</p>
          </div>
          <a href={`/${locale}/security/audits`} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-white/[0.12] bg-white/[0.04] px-5 font-mono text-[10px] uppercase tracking-[0.16em] text-white/[0.76] transition hover:bg-white/[0.08]">
            {t.newAudit}<ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
          </a>
        </div>

        <div className="mt-6 grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto]">
          <label className="flex min-h-12 items-center gap-3 rounded-xl border border-white/[0.11] bg-black/[0.28] px-4 focus-within:border-cyan-100/[0.34]">
            <FileSearch className="h-4 w-4 text-white/[0.42]" aria-hidden="true" />
            <span className="sr-only">{t.addLabel}</span>
            <input
              value={input}
              onChange={(event) => {
                setInput(event.target.value.toUpperCase());
                setInputTouched(false);
              }}
              onBlur={() => setInputTouched(Boolean(input))}
              onKeyDown={(event) => {
                if (event.key === "Enter") addCase();
              }}
              placeholder={t.placeholder}
              autoCapitalize="characters"
              autoComplete="off"
              spellCheck={false}
              className="min-w-0 flex-1 bg-transparent font-mono text-xs tracking-[0.12em] text-white outline-none placeholder:text-white/[0.24]"
            />
          </label>
          <button
            type="button"
            onClick={addCase}
            disabled={!normalizedInput}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-white px-5 font-mono text-[10px] uppercase tracking-[0.16em] text-black transition disabled:cursor-not-allowed disabled:opacity-35"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />{t.add}
          </button>
        </div>
        {inputTouched && input && !normalizedInput ? <p className="mt-2 text-xs text-amber-100/[0.82]">{t.invalid}</p> : null}
      </header>

      <div className="mt-4 grid gap-4 xl:grid-cols-[18rem_minmax(0,1fr)]">
        <aside className="rounded-[1.5rem] border border-white/[0.10] bg-black/[0.22] p-3">
          <div className="flex items-center justify-between px-2 py-2">
            <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-white/[0.38]">{t.savedCases}</p>
            <span className="rounded-full border border-white/[0.10] px-2 py-1 font-mono text-[9px] text-white/[0.44]">{bookmarks.length}</span>
          </div>
          {bookmarks.length ? (
            <div className="mt-1 grid gap-2">
              {bookmarks.map((bookmark) => {
                const active = bookmark.caseRef === selectedRef;
                return (
                  <div key={bookmark.caseRef} className="group grid grid-cols-[minmax(0,1fr)_2.5rem] gap-1">
                    <button
                      type="button"
                      onClick={() => setSelectedRef(bookmark.caseRef)}
                      aria-current={active ? "true" : undefined}
                      className={`min-w-0 rounded-xl border px-3 py-3 text-left transition ${active ? "border-cyan-100/[0.22] bg-cyan-200/[0.055]" : "border-white/[0.08] bg-white/[0.018] hover:bg-white/[0.04]"}`}
                    >
                      <span className="block truncate font-mono text-[10px] tracking-[0.08em] text-white/[0.78]">{bookmark.caseRef}</span>
                      <span className="mt-1 block text-[10px] text-white/[0.36]">{bookmark.tier ? bookmark.tier.toUpperCase() : "—"}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        forgetAuditCaseRef(bookmark.caseRef);
                        if (bookmark.caseRef === selectedRef) setSelectedRef(bookmarks.find((item) => item.caseRef !== bookmark.caseRef)?.caseRef || "");
                      }}
                      aria-label={`${t.remove}: ${bookmark.caseRef}`}
                      title={t.remove}
                      className="flex items-center justify-center rounded-xl border border-white/[0.08] text-white/[0.28] transition hover:border-red-200/[0.18] hover:text-red-100/[0.76]"
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-white/[0.10] px-4 py-6 text-center">
              <p className="text-sm text-white/[0.68]">{t.empty}</p>
              <p className="mt-2 text-xs leading-6 text-white/[0.38]">{t.emptyBody}</p>
            </div>
          )}
        </aside>

        <div className="min-w-0 rounded-[1.5rem] border border-white/[0.10] bg-black/[0.22] p-4 md:p-6">
          <div className="flex flex-col gap-3 border-b border-white/[0.08] pb-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-white/[0.36]">{t.currentState}</p>
              <p className="mt-2 truncate font-mono text-sm tracking-[0.08em] text-white/[0.84]">{selectedRef || "—"}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 font-mono text-[9px] uppercase tracking-[0.14em] ${pollingActive ? "border-cyan-100/[0.16] bg-cyan-200/[0.035] text-cyan-100/[0.72]" : "border-white/[0.10] text-white/[0.40]"}`}>
                <Clock3 className="h-3.5 w-3.5" aria-hidden="true" />{pollingActive ? t.automatic : t.paused}
              </span>
              <button
                type="button"
                onClick={() => void fetchStatus("manual")}
                disabled={!selectedRef || portalState === "loading"}
                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full border border-white/[0.12] bg-white/[0.035] px-4 font-mono text-[9px] uppercase tracking-[0.14em] text-white/[0.72] transition hover:bg-white/[0.07] disabled:opacity-35"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${portalState === "loading" ? "animate-spin" : ""}`} aria-hidden="true" />
                {portalState === "loading" ? t.refreshing : t.refresh}
              </button>
            </div>
          </div>

          {stateMessage ? (
            <div className="mt-5 flex items-start gap-3 rounded-xl border border-white/[0.09] bg-white/[0.018] p-4" role="status" aria-live="polite">
              {portalState === "loading" ? <RefreshCw className="mt-0.5 h-4 w-4 animate-spin text-cyan-100/[0.72]" /> : portalState === "offline" || portalState === "unavailable" || portalState === "error" ? <AlertTriangle className="mt-0.5 h-4 w-4 text-amber-100/[0.72]" /> : <LockKeyhole className="mt-0.5 h-4 w-4 text-white/[0.44]" />}
              <p className="text-sm leading-7 text-white/[0.56]">{stateMessage}</p>
            </div>
          ) : null}

          {status ? (
            <>
              <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-xl border border-white/[0.09] bg-white/[0.018] p-4">
                  <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-white/[0.34]">{t.plan}</p>
                  <p className="mt-2 text-sm text-white/[0.82]">{status.tier.toUpperCase()}</p>
                </div>
                <div className="rounded-xl border border-white/[0.09] bg-white/[0.018] p-4">
                  <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-white/[0.34]">{t.queue}</p>
                  <p className="mt-2 text-sm text-white/[0.82]">{t.queueLabel[status.queueLane]}</p>
                </div>
                <div className="rounded-xl border border-white/[0.09] bg-white/[0.018] p-4">
                  <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-white/[0.34]">{t.payment}</p>
                  <p className="mt-2 text-sm text-white/[0.82]">{t.paymentLabel[status.paymentState]}</p>
                </div>
                <div className="rounded-xl border border-white/[0.09] bg-white/[0.018] p-4">
                  <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-white/[0.34]">{t.analysis}</p>
                  <p className="mt-2 text-sm text-white/[0.82]">{status.analysisStarted ? t.analysisStarted : t.analysisNotStarted}</p>
                </div>
              </div>

              <section className="mt-3 rounded-xl border border-white/[0.09] bg-white/[0.018] p-4" aria-label={REVIEW_COPY[locale].title}>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-white/[0.34]">{REVIEW_COPY[locale].title}</p>
                    <p className="mt-2 text-sm text-white/[0.78]">{REVIEW_COPY[locale].mode[status.review.processingMode]} · {REVIEW_COPY[locale].state[status.review.state]}</p>
                  </div>
                  {!status.review.available ? <p className="text-xs text-amber-100/[0.66]">{REVIEW_COPY[locale].unavailable}</p> : null}
                </div>
                <dl className="mt-4 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-lg border border-white/[0.07] bg-black/[0.16] p-3">
                    <dt className="font-mono text-[9px] uppercase tracking-[0.16em] text-white/[0.32]">{REVIEW_COPY[locale].reviewer}</dt>
                    <dd className="mt-2 text-xs text-white/[0.68]">{status.review.humanReviewerAssigned ? REVIEW_COPY[locale].assigned : REVIEW_COPY[locale].unassigned}</dd>
                  </div>
                  <div className="rounded-lg border border-white/[0.07] bg-black/[0.16] p-3">
                    <dt className="font-mono text-[9px] uppercase tracking-[0.16em] text-white/[0.32]">{REVIEW_COPY[locale].attempts}</dt>
                    <dd className="mt-2 text-xs text-white/[0.68]">{status.review.attemptCount} / {status.review.maxAttempts}</dd>
                  </div>
                  <div className="rounded-lg border border-white/[0.07] bg-black/[0.16] p-3">
                    <dt className="font-mono text-[9px] uppercase tracking-[0.16em] text-white/[0.32]">{REVIEW_COPY[locale].sla}</dt>
                    <dd className="mt-2 text-xs text-white/[0.68]">{REVIEW_COPY[locale].slaState[status.review.sla.state]}{status.review.sla.dueAt ? ` · ${formatDate(status.review.sla.dueAt, locale)}` : ""}</dd>
                  </div>
                </dl>
              </section>

              <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
                <section className="rounded-xl border border-white/[0.09] bg-white/[0.018] p-4 md:p-5">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-white/[0.36]">{t.timeline}</p>
                      <p className="mt-2 text-xs leading-6 text-white/[0.42]">{t.timelineNote}</p>
                      {!status.history.available ? <p className="mt-2 text-xs leading-6 text-amber-100/[0.62]">{t.historyUnavailable}</p> : !status.history.complete ? <p className="mt-2 text-xs leading-6 text-amber-100/[0.62]">{t.historyIncomplete}</p> : status.history.truncated ? <p className="mt-2 text-xs leading-6 text-white/[0.38]">{t.historyTruncated}</p> : null}
                    </div>
                    <ShieldCheck className="h-5 w-5 text-cyan-100/[0.58]" aria-hidden="true" />
                  </div>
                  <ol className="mt-5 grid gap-3">
                    {timeline.map((item) => (
                      <li key={item.label} className="grid grid-cols-[2rem_minmax(0,1fr)] gap-3">
                        <span data-tone={item.tone} className="flex h-8 w-8 items-center justify-center rounded-full border border-white/[0.10] bg-black/[0.24] text-white/[0.58] data-[tone=active]:border-cyan-100/[0.22] data-[tone=active]:text-cyan-100/[0.80] data-[tone=blocked]:border-amber-100/[0.20] data-[tone=blocked]:text-amber-100/[0.80] data-[tone=done]:text-white/[0.82]">
                          <TimelineIcon tone={item.tone} />
                        </span>
                        <div className="border-b border-white/[0.07] pb-3 last:border-0">
                          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                            <p className="text-sm text-white/[0.78]">{item.label}</p>
                            {item.at ? <time className="font-mono text-[9px] text-white/[0.34]">{formatDate(item.at, locale)}</time> : null}
                          </div>
                          <p className="mt-1 text-xs leading-6 text-white/[0.43]">{item.body}</p>
                        </div>
                      </li>
                    ))}
                  </ol>
                </section>

                <aside className="grid content-start gap-3">
                  <div className="rounded-xl border border-cyan-100/[0.14] bg-cyan-200/[0.035] p-4">
                    <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-cyan-100/[0.58]">{t.status[status.status]}</p>
                    <p className="mt-3 text-xs leading-6 text-white/[0.52]">{status.caseRef}</p>
                  </div>
                  <dl className="rounded-xl border border-white/[0.09] bg-white/[0.018] p-4 text-xs">
                    <div className="flex items-center justify-between gap-4 border-b border-white/[0.07] py-2">
                      <dt className="text-white/[0.38]">{t.target}</dt><dd className="text-white/[0.68]">{status.target.kind}</dd>
                    </div>
                    <div className="flex items-center justify-between gap-4 border-b border-white/[0.07] py-2">
                      <dt className="text-white/[0.38]">{t.updated}</dt><dd className="text-right text-white/[0.68]">{formatDate(status.timestamps.updatedAt, locale)}</dd>
                    </div>
                    <div className="flex items-center justify-between gap-4 py-2">
                      <dt className="text-white/[0.38]">{t.durable}</dt><dd className="text-white/[0.68]">{status.durable ? t.yes : t.no}</dd>
                    </div>
                  </dl>
                  <div className="rounded-xl border border-white/[0.09] bg-white/[0.018] p-4">
                    <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-white/[0.34]">{t.lastChecked}</p>
                    <p className="mt-2 text-xs text-white/[0.58]">{formatDate(lastCheckedAt, locale)}</p>
                  </div>
                </aside>
              </div>
            </>
          ) : null}

          <div className="mt-5 flex items-start gap-3 rounded-xl border border-white/[0.08] bg-black/[0.18] p-4">
            <LockKeyhole className="mt-0.5 h-4 w-4 shrink-0 text-white/[0.38]" aria-hidden="true" />
            <div>
              <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-white/[0.42]">{t.privacyTitle}</p>
              <p className="mt-2 text-xs leading-6 text-white/[0.38]">{t.privacyBody}</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
