import {
  buildPass2195RuntimeUxBinding,
  type Pass2195Locale,
  type Pass2195RuntimeUxStateCode,
} from "@/lib/ui/runtime-ux-binding";

export const PASS2196_CUSTOMER_SAFE_STATUS_SURFACE_ID = "customer-safe-status-surface" as const;

export type Pass2196CustomerLocale = Pass2195Locale;

export type Pass2196CustomerSafeStateCode =
  | "build_proof_missing"
  | "advanced_unpaid_locked"
  | "advanced_checkout_error"
  | "advanced_ready"
  | "advanced_local_demo_notice"
  | "gemini_safe_fallback"
  | "provider_proof_missing"
  | "pdf_advanced_locked"
  | "order_status_safe"
  | "receipt_missing"
  | "legal_review_pending"
  | "visual_proof_pending";

export type Pass2196CustomerVisibleStatus =
  | "available"
  | "limited_preview"
  | "locked"
  | "manual_review"
  | "proof_needed"
  | "retry_needed";

export type Pass2196CustomerSurfaceTone = "calm" | "ready" | "locked" | "review" | "warning" | "error";

export type Pass2196CustomerAction =
  | "continue_free"
  | "open_checkout"
  | "retry"
  | "capture_receipt"
  | "contact_support"
  | "wait_for_review"
  | "start_analysis";

export type Pass2196CustomerSafeStatusSurface = {
  schemaVersion: typeof PASS2196_CUSTOMER_SAFE_STATUS_SURFACE_ID;
  stateCode: Pass2196CustomerSafeStateCode;
  customerVisibleStatus: Pass2196CustomerVisibleStatus;
  tone: Pass2196CustomerSurfaceTone;
  action: Pass2196CustomerAction;
  receiptCode: string;
  headline: string;
  body: string;
  actionLabel: string;
  customerCanSee: string[];
  customerCannotSee: string[];
  operatorTruth: string;
  hiddenTechnicalCodes: string[];
  linkedPass2195State?: Pass2195RuntimeUxStateCode;
  linkedPass2195Receipt?: string;
  safeForCustomerUi: true;
  noRawInternalStatusForCustomer: true;
  noPaidAdvancedLeak: true;
  dataAttribute: "data-pass2196-customer-safe-status";
};

type Copy = {
  headline: string;
  body: string;
  actionLabel: string;
  customerCanSee: string[];
  customerCannotSee: string[];
  operatorTruth: string;
};

type Blueprint = {
  customerVisibleStatus: Pass2196CustomerVisibleStatus;
  tone: Pass2196CustomerSurfaceTone;
  action: Pass2196CustomerAction;
  receiptCode: string;
  hiddenTechnicalCodes: string[];
  linkedPass2195State?: Pass2195RuntimeUxStateCode;
  copy: Record<Pass2196CustomerLocale, Copy>;
};

const BLUEPRINTS: Record<Pass2196CustomerSafeStateCode, Blueprint> = {
  build_proof_missing: {
    customerVisibleStatus: "proof_needed",
    tone: "review",
    action: "capture_receipt",
    receiptCode: "customer_safe_build_proof_needed",
    hiddenTechnicalCodes: ["BLOCKED_ENV", "PASS_STATIC_ONLY", "BLOCK_RUNTIME_PRODUCTION"],
    copy: {
      pl: {
        headline: "Ostatni test produkcyjny jest jeszcze do potwierdzenia",
        body: "Projekt ma gotową strukturę, ale finalny build i świeży test środowiska muszą zostać potwierdzone przed mocnym claimem produkcyjnym.",
        actionLabel: "Dodaj proof builda",
        customerCanSee: ["status gotowości", "co jest jeszcze do potwierdzenia", "bezpieczny następny krok"],
        customerCannotSee: ["surowe logi systemowe", "sekrety środowiska", "wewnętrzne komendy z kluczami"],
        operatorTruth: "Fresh npm ci/typecheck/build receipt is missing; do not raise readiness above the agreed ceiling.",
      },
      en: {
        headline: "The final production test still needs proof",
        body: "The project structure is ready, but the final build and environment test must be confirmed before strong production claims.",
        actionLabel: "Add build proof",
        customerCanSee: ["readiness status", "what still needs proof", "safe next step"],
        customerCannotSee: ["raw system logs", "environment secrets", "internal commands containing keys"],
        operatorTruth: "Fresh npm ci/typecheck/build receipt is missing; do not raise readiness above the agreed ceiling.",
      },
      de: {
        headline: "Der finale Produktionstest braucht noch einen Nachweis",
        body: "Die Projektstruktur ist bereit, aber Build und Umgebungstest müssen vor starken Produktionsaussagen bestätigt werden.",
        actionLabel: "Build-Nachweis hinzufügen",
        customerCanSee: ["Bereitschaftsstatus", "fehlende Nachweise", "sicherer nächster Schritt"],
        customerCannotSee: ["rohe Systemlogs", "Umgebungsgeheimnisse", "interne Befehle mit Schlüsseln"],
        operatorTruth: "Fresh npm ci/typecheck/build receipt is missing; do not raise readiness above the agreed ceiling.",
      },
    },
  },
  advanced_unpaid_locked: {
    customerVisibleStatus: "locked",
    tone: "locked",
    action: "continue_free",
    receiptCode: "customer_safe_advanced_not_for_sale",
    hiddenTechnicalCodes: ["advanced_checkout_required", "entitlement_missing", "wallet_connect_only_denied"],
    linkedPass2195State: "advanced_checkout_required",
    copy: {
      pl: {
        headline: "Advanced jest zablokowany do czasu potwierdzenia dostępu",
        body: "Advanced nie jest obecnie na sprzedaż. Użyj darmowego Basic; Pro jest dostępny wyłącznie w kontrolowanej becie na zaproszenie.",
        actionLabel: "Użyj Basic",
        customerCanSee: ["krótki preview", "powód blokady", "bezpieczny darmowy fallback"],
        customerCannotSee: ["pełny evidence ledger", "operator appendix", "proof capsule Advanced"],
        operatorTruth: "Advanced is NOT_FOR_SALE; legacy checkout state must not expose price, checkout, or Advanced evidence.",
      },
      en: {
        headline: "Advanced is locked until access is confirmed",
        body: "Advanced is not currently for sale. Use the free Basic prescreen; Pro is available only as a controlled invitation-only beta.",
        actionLabel: "Use Basic",
        customerCanSee: ["short preview", "lock reason", "safe free fallback"],
        customerCannotSee: ["full evidence ledger", "operator appendix", "Advanced proof capsule"],
        operatorTruth: "Advanced is NOT_FOR_SALE; legacy checkout state must not expose price, checkout, or Advanced evidence.",
      },
      de: {
        headline: "Advanced bleibt bis zur Zugangsbestätigung gesperrt",
        body: "Advanced ist derzeit nicht zum Verkauf. Nutze den kostenlosen Basic-Prescreen; Pro ist nur als kontrollierte Beta auf Einladung verfügbar.",
        actionLabel: "Basic nutzen",
        customerCanSee: ["kurze Vorschau", "Sperrgrund", "sicherer kostenloser Fallback"],
        customerCannotSee: ["vollständiges Evidence Ledger", "Operator-Anhang", "Advanced Proof Capsule"],
        operatorTruth: "Advanced is NOT_FOR_SALE; legacy checkout state must not expose price, checkout, or Advanced evidence.",
      },
    },
  },
  advanced_checkout_error: {
    customerVisibleStatus: "retry_needed",
    tone: "error",
    action: "retry",
    receiptCode: "customer_safe_advanced_checkout_retry",
    hiddenTechnicalCodes: ["advanced_checkout_error", "checkout_session_failed"],
    linkedPass2195State: "advanced_checkout_error",
    copy: {
      pl: {
        headline: "Historyczna ścieżka checkoutu jest wyłączona",
        body: "Advanced nie jest na sprzedaż. Wróć do darmowego Basic albo poproś o kontrolowaną betę Pro.",
        actionLabel: "Wróć do Basic",
        customerCanSee: ["czytelny błąd", "możliwość ponowienia", "bezpieczny fallback"],
        customerCannotSee: ["surowy błąd Stripe", "sekrety checkoutu", "płatną treść Advanced"],
        operatorTruth: "Checkout failure is visible and receipt-friendly; raw Stripe/provider payload must stay redacted.",
      },
      en: {
        headline: "The legacy checkout path is disabled",
        body: "Advanced is not for sale. Return to the free Basic prescreen or request controlled Pro beta access.",
        actionLabel: "Return to Basic",
        customerCanSee: ["clear error", "retry option", "safe fallback"],
        customerCannotSee: ["raw Stripe error", "checkout secrets", "paid Advanced content"],
        operatorTruth: "Checkout failure is visible and receipt-friendly; raw Stripe/provider payload must stay redacted.",
      },
      de: {
        headline: "Der historische Checkout-Pfad ist deaktiviert",
        body: "Advanced ist nicht zum Verkauf. Kehre zum kostenlosen Basic-Prescreen zurück oder frage den kontrollierten Pro-Beta-Zugang an.",
        actionLabel: "Zu Basic zurück",
        customerCanSee: ["klarer Fehler", "Wiederholen", "sicherer Fallback"],
        customerCannotSee: ["roher Stripe-Fehler", "Checkout-Geheimnisse", "bezahlter Advanced-Inhalt"],
        operatorTruth: "Checkout failure is visible and receipt-friendly; raw Stripe/provider payload must stay redacted.",
      },
    },
  },
  advanced_ready: {
    customerVisibleStatus: "available",
    tone: "ready",
    action: "start_analysis",
    receiptCode: "customer_safe_advanced_ready",
    hiddenTechnicalCodes: ["advanced_access_ready", "paid_entitlement_ok"],
    linkedPass2195State: "advanced_access_ready",
    copy: {
      pl: {
        headline: "Advanced jest gotowy do analizy",
        body: "Dostęp został potwierdzony. Pełniejsza analiza może ruszyć w zatwierdzonym trybie.",
        actionLabel: "Start Advanced",
        customerCanSee: ["pełniejszą analizę", "dowody w zakresie planu", "status potwierdzonego dostępu"],
        customerCannotSee: ["sekrety backendu", "wewnętrzne tokeny", "niezredagowane payloady"],
        operatorTruth: "Advanced access may start only when durable paid entitlement or local demo gate is explicit.",
      },
      en: {
        headline: "Advanced is ready for analysis",
        body: "Access has been confirmed. The deeper analysis can start in the approved mode.",
        actionLabel: "Start Advanced",
        customerCanSee: ["deeper analysis", "plan-scoped evidence", "confirmed access status"],
        customerCannotSee: ["backend secrets", "internal tokens", "unredacted payloads"],
        operatorTruth: "Advanced access may start only when durable paid entitlement or local demo gate is explicit.",
      },
      de: {
        headline: "Advanced ist bereit für die Analyse",
        body: "Der Zugang wurde bestätigt. Die tiefere Analyse kann im freigegebenen Modus starten.",
        actionLabel: "Advanced starten",
        customerCanSee: ["tiefere Analyse", "Nachweise im Planumfang", "bestätigter Zugangsstatus"],
        customerCannotSee: ["Backend-Geheimnisse", "interne Tokens", "unredigierte Payloads"],
        operatorTruth: "Advanced access may start only when durable paid entitlement or local demo gate is explicit.",
      },
    },
  },
  advanced_local_demo_notice: {
    customerVisibleStatus: "limited_preview",
    tone: "warning",
    action: "start_analysis",
    receiptCode: "customer_safe_advanced_local_demo_notice",
    hiddenTechnicalCodes: ["server_demo_entitlement_ready", "VELMERE_LOCAL_PAID_ACCESS_DEMO"],
    linkedPass2195State: "advanced_local_demo_ready",
    copy: {
      pl: {
        headline: "Advanced działa w lokalnym demo",
        body: "To jest tryb testowy. Produkcja nadal potrzebuje płatnego entitlement i receiptów.",
        actionLabel: "Start demo",
        customerCanSee: ["demo działania", "jasną granicę testu", "brak produkcyjnego claimu"],
        customerCannotSee: ["produkcyjnego statusu płatnego", "sekretów env", "fałszywego claimu paid"],
        operatorTruth: "Local demo must never be counted as production paid access.",
      },
      en: {
        headline: "Advanced is running in local demo",
        body: "This is a test mode. Production still needs paid entitlement and receipts.",
        actionLabel: "Start demo",
        customerCanSee: ["demo behavior", "clear test boundary", "no production claim"],
        customerCannotSee: ["production paid status", "environment secrets", "fake paid claim"],
        operatorTruth: "Local demo must never be counted as production paid access.",
      },
      de: {
        headline: "Advanced läuft im lokalen Demo-Modus",
        body: "Das ist ein Testmodus. Produktion braucht weiterhin bezahlte Entitlements und Receipts.",
        actionLabel: "Demo starten",
        customerCanSee: ["Demo-Verhalten", "klare Testgrenze", "keinen Produktionsclaim"],
        customerCannotSee: ["Produktions-Paid-Status", "Env-Geheimnisse", "falschen Paid-Claim"],
        operatorTruth: "Local demo must never be counted as production paid access.",
      },
    },
  },
  gemini_safe_fallback: {
    customerVisibleStatus: "limited_preview",
    tone: "warning",
    action: "continue_free",
    receiptCode: "customer_safe_gemini_fallback",
    hiddenTechnicalCodes: ["gemini_live_fallback", "local_mode", "provider_timeout"],
    linkedPass2195State: "gemini_live_fallback",
    copy: {
      pl: {
        headline: "Live AI jest chwilowo ograniczone",
        body: "Pokażę bezpieczny skrót i oznaczę brakujące dowody zamiast udawać pełną analizę.",
        actionLabel: "Pokaż skrót",
        customerCanSee: ["bezpieczny skrót", "missing proof", "co trzeba potwierdzić"],
        customerCannotSee: ["pełny live claim", "niezweryfikowaną analizę jako pewnik", "sekrety providera"],
        operatorTruth: "Fallback must be visible; no world-class Gemini claim without live PL/EN/DE receipts.",
      },
      en: {
        headline: "Live AI is temporarily limited",
        body: "I will show a safe brief and label missing proof instead of pretending a full analysis ran.",
        actionLabel: "Show brief",
        customerCanSee: ["safe brief", "missing proof", "what needs confirmation"],
        customerCannotSee: ["full live claim", "unverified analysis as fact", "provider secrets"],
        operatorTruth: "Fallback must be visible; no world-class Gemini claim without live PL/EN/DE receipts.",
      },
      de: {
        headline: "Live-KI ist vorübergehend eingeschränkt",
        body: "Ich zeige einen sicheren Kurzbericht und markiere fehlende Nachweise statt eine vollständige Analyse vorzutäuschen.",
        actionLabel: "Kurzbericht anzeigen",
        customerCanSee: ["sicheren Kurzbericht", "fehlende Nachweise", "nächste Prüfung"],
        customerCannotSee: ["vollen Live-Claim", "ungeprüfte Analyse als Fakt", "Provider-Geheimnisse"],
        operatorTruth: "Fallback must be visible; no world-class Gemini claim without live PL/EN/DE receipts.",
      },
    },
  },
  provider_proof_missing: {
    customerVisibleStatus: "proof_needed",
    tone: "review",
    action: "capture_receipt",
    receiptCode: "customer_safe_provider_proof_needed",
    hiddenTechnicalCodes: ["provider_blocked_env", "provider_order_fulfilment_BLOCKED_ENV"],
    linkedPass2195State: "provider_blocked_env",
    copy: {
      pl: {
        headline: "Fulfillment czeka na potwierdzenie providera",
        body: "Zamówienia nie są oznaczane jako produkcyjnie gotowe bez stock/order receiptów.",
        actionLabel: "Dodaj provider proof",
        customerCanSee: ["bezpieczny status zamówienia", "czy provider jest potwierdzony", "next step"],
        customerCannotSee: ["adres klienta", "raw provider payload", "provider token"],
        operatorTruth: "Provider/order readiness remains blocked until stock sync, draft order and retry queue receipts are captured.",
      },
      en: {
        headline: "Fulfillment is waiting for provider proof",
        body: "Orders are not marked production-ready without stock/order receipts.",
        actionLabel: "Add provider proof",
        customerCanSee: ["safe order status", "whether provider is confirmed", "next step"],
        customerCannotSee: ["customer address", "raw provider payload", "provider token"],
        operatorTruth: "Provider/order readiness remains blocked until stock sync, draft order and retry queue receipts are captured.",
      },
      de: {
        headline: "Fulfillment wartet auf Provider-Nachweis",
        body: "Bestellungen werden ohne Stock/Order-Receipts nicht als produktionsbereit markiert.",
        actionLabel: "Provider-Nachweis hinzufügen",
        customerCanSee: ["sicheren Bestellstatus", "Provider-Bestätigung", "nächsten Schritt"],
        customerCannotSee: ["Kundenadresse", "rohe Provider-Payload", "Provider-Token"],
        operatorTruth: "Provider/order readiness remains blocked until stock sync, draft order and retry queue receipts are captured.",
      },
    },
  },
  pdf_advanced_locked: {
    customerVisibleStatus: "locked",
    tone: "locked",
    action: "open_checkout",
    receiptCode: "customer_safe_pdf_advanced_locked",
    hiddenTechnicalCodes: ["pdf_advanced_locked", "advanced_pdf_entitlement_missing"],
    linkedPass2195State: "pdf_advanced_locked",
    copy: {
      pl: {
        headline: "Pełny PDF Advanced wymaga dostępu",
        body: "Preview zostaje bezpieczny, a pełny evidence appendix jest dostępny dopiero po potwierdzeniu planu.",
        actionLabel: "Odblokuj PDF",
        customerCanSee: ["bezpieczny preview", "podstawowe wnioski", "granice planu"],
        customerCannotSee: ["pełny appendix", "operator notes", "source-by-source ledger"],
        operatorTruth: "PDF preview/download parity must preserve Advanced entitlement boundary.",
      },
      en: {
        headline: "Full Advanced PDF requires access",
        body: "The preview stays safe, and the full evidence appendix is available only after plan confirmation.",
        actionLabel: "Unlock PDF",
        customerCanSee: ["safe preview", "basic conclusions", "plan boundaries"],
        customerCannotSee: ["full appendix", "operator notes", "source-by-source ledger"],
        operatorTruth: "PDF preview/download parity must preserve Advanced entitlement boundary.",
      },
      de: {
        headline: "Vollständiger Advanced-PDF benötigt Zugang",
        body: "Die Vorschau bleibt sicher; der vollständige Evidence-Anhang ist erst nach Planbestätigung verfügbar.",
        actionLabel: "PDF freischalten",
        customerCanSee: ["sichere Vorschau", "Basis-Schlussfolgerungen", "Plangrenzen"],
        customerCannotSee: ["vollen Anhang", "Operator-Notizen", "Source-by-Source Ledger"],
        operatorTruth: "PDF preview/download parity must preserve Advanced entitlement boundary.",
      },
    },
  },
  order_status_safe: {
    customerVisibleStatus: "manual_review",
    tone: "calm",
    action: "wait_for_review",
    receiptCode: "customer_safe_order_status_no_pii",
    hiddenTechnicalCodes: ["customer_safe_order_status_no_pii", "order_internal_timeline_redacted"],
    copy: {
      pl: {
        headline: "Status zamówienia jest pokazany bez danych wrażliwych",
        body: "Widzisz etap zamówienia, ale adres, payload providera i tokeny zostają po stronie bezpiecznej warstwy.",
        actionLabel: "Zobacz status",
        customerCanSee: ["order_received", "payment_confirmed", "fulfilment_pending", "manual_review", "shipped"],
        customerCannotSee: ["adres", "telefon", "email", "raw provider payload", "sekrety płatności"],
        operatorTruth: "Customer status surface must be no-PII and must not expose provider/Stripe internals.",
      },
      en: {
        headline: "Order status is shown without sensitive data",
        body: "You see the order stage, while address, provider payload and tokens stay behind the safe layer.",
        actionLabel: "View status",
        customerCanSee: ["order_received", "payment_confirmed", "fulfilment_pending", "manual_review", "shipped"],
        customerCannotSee: ["address", "phone", "email", "raw provider payload", "payment secrets"],
        operatorTruth: "Customer status surface must be no-PII and must not expose provider/Stripe internals.",
      },
      de: {
        headline: "Bestellstatus wird ohne sensible Daten gezeigt",
        body: "Du siehst den Bestellschritt; Adresse, Provider-Payload und Tokens bleiben in der sicheren Schicht.",
        actionLabel: "Status anzeigen",
        customerCanSee: ["order_received", "payment_confirmed", "fulfilment_pending", "manual_review", "shipped"],
        customerCannotSee: ["Adresse", "Telefon", "E-Mail", "rohe Provider-Payload", "Zahlungsgeheimnisse"],
        operatorTruth: "Customer status surface must be no-PII and must not expose provider/Stripe internals.",
      },
    },
  },
  receipt_missing: {
    customerVisibleStatus: "proof_needed",
    tone: "review",
    action: "capture_receipt",
    receiptCode: "customer_safe_runtime_receipt_missing",
    hiddenTechnicalCodes: ["receipt_missing_runtime_proof", "PASS_STATIC_ONLY"],
    linkedPass2195State: "receipt_missing_runtime_proof",
    copy: {
      pl: {
        headline: "Ten element ma kod, ale czeka na runtime proof",
        body: "Nie udajemy gotowości. Po dodaniu redacted receipt status może zostać podniesiony.",
        actionLabel: "Dodaj receipt",
        customerCanSee: ["uczciwy status", "brakujący dowód", "kolejny krok"],
        customerCannotSee: ["surowe sekrety", "niezweryfikowany claim", "pełne logi wewnętrzne"],
        operatorTruth: "Static pass cannot be promoted until redacted runtime receipt is ingested.",
      },
      en: {
        headline: "This feature has code, but needs runtime proof",
        body: "We do not fake readiness. After a redacted receipt is added, the status can be promoted.",
        actionLabel: "Add receipt",
        customerCanSee: ["honest status", "missing proof", "next step"],
        customerCannotSee: ["raw secrets", "unverified claim", "full internal logs"],
        operatorTruth: "Static pass cannot be promoted until redacted runtime receipt is ingested.",
      },
      de: {
        headline: "Dieses Feature hat Code, braucht aber Runtime-Nachweis",
        body: "Wir täuschen keine Bereitschaft vor. Nach einem redigierten Receipt kann der Status angehoben werden.",
        actionLabel: "Receipt hinzufügen",
        customerCanSee: ["ehrlichen Status", "fehlenden Nachweis", "nächsten Schritt"],
        customerCannotSee: ["rohe Geheimnisse", "ungeprüften Claim", "vollständige interne Logs"],
        operatorTruth: "Static pass cannot be promoted until redacted runtime receipt is ingested.",
      },
    },
  },
  legal_review_pending: {
    customerVisibleStatus: "manual_review",
    tone: "review",
    action: "wait_for_review",
    receiptCode: "customer_safe_legal_review_pending",
    hiddenTechnicalCodes: ["legal_owner_review", "manual_signoff_required"],
    copy: {
      pl: {
        headline: "Treści prawne czekają na finalny review",
        body: "Nie oznaczamy tego jako certyfikację ani poradę prawną. Wersja produkcyjna wymaga owner/lawyer sign-off.",
        actionLabel: "Oznacz do review",
        customerCanSee: ["draft status", "zakres review", "brak fake certyfikacji"],
        customerCannotSee: ["fałszywą gwarancję prawną", "niezatwierdzone claimy", "wewnętrzne checklisty z danymi"],
        operatorTruth: "Legal lane remains manual; no fake certification or legal overclaim allowed.",
      },
      en: {
        headline: "Legal content is waiting for final review",
        body: "We do not label this as certification or legal advice. Production requires owner/lawyer sign-off.",
        actionLabel: "Mark for review",
        customerCanSee: ["draft status", "review scope", "no fake certification"],
        customerCannotSee: ["false legal guarantee", "unapproved claims", "internal checklists with data"],
        operatorTruth: "Legal lane remains manual; no fake certification or legal overclaim allowed.",
      },
      de: {
        headline: "Rechtliche Inhalte warten auf finalen Review",
        body: "Dies ist keine Zertifizierung oder Rechtsberatung. Produktion benötigt Owner/Lawyer-Sign-off.",
        actionLabel: "Zum Review markieren",
        customerCanSee: ["Draft-Status", "Review-Umfang", "keine Fake-Zertifizierung"],
        customerCannotSee: ["falsche Rechtsgarantie", "nicht freigegebene Claims", "interne Checklisten mit Daten"],
        operatorTruth: "Legal lane remains manual; no fake certification or legal overclaim allowed.",
      },
    },
  },
  visual_proof_pending: {
    customerVisibleStatus: "proof_needed",
    tone: "review",
    action: "capture_receipt",
    receiptCode: "customer_safe_visual_proof_pending",
    hiddenTechnicalCodes: ["visual_mobile_receipts", "CODEX_VISUAL_MERGE_REQUIRED"],
    copy: {
      pl: {
        headline: "Visual proof czeka na screeny i test mobile",
        body: "Silnik może być mocny, ale claim topki wizualnej wymaga screenshotów, mobile i dostępności.",
        actionLabel: "Dodaj screeny",
        customerCanSee: ["status visual", "czy mobile jest potwierdzony", "czy modal działa"],
        customerCannotSee: ["sekrety środowiska", "niezweryfikowany claim topki", "raw audit tokeny"],
        operatorTruth: "Visual/mobile lane must be proven after Codex UI merge and preserved engine merge.",
      },
      en: {
        headline: "Visual proof is waiting for screenshots and mobile test",
        body: "The engine can be strong, but a world-class visual claim requires screenshots, mobile and accessibility proof.",
        actionLabel: "Add screenshots",
        customerCanSee: ["visual status", "whether mobile is confirmed", "whether modal behavior is proven"],
        customerCannotSee: ["environment secrets", "unverified world-class claim", "raw audit tokens"],
        operatorTruth: "Visual/mobile lane must be proven after Codex UI merge and preserved engine merge.",
      },
      de: {
        headline: "Visual Proof wartet auf Screenshots und Mobile-Test",
        body: "Der Engine kann stark sein, aber ein World-Class-Visual-Claim braucht Screenshots, Mobile und Accessibility-Nachweis.",
        actionLabel: "Screenshots hinzufügen",
        customerCanSee: ["Visual-Status", "Mobile-Bestätigung", "Modal-Nachweis"],
        customerCannotSee: ["Umgebungsgeheimnisse", "ungeprüfter World-Class-Claim", "rohe Audit-Tokens"],
        operatorTruth: "Visual/mobile lane must be proven after Codex UI merge and preserved engine merge.",
      },
    },
  },
};

function resolveLocale(locale: unknown): Pass2196CustomerLocale {
  return locale === "en" || locale === "de" || locale === "pl" ? locale : "pl";
}

export function buildPass2196CustomerSafeStatusSurface(
  stateCode: Pass2196CustomerSafeStateCode,
  locale: Pass2196CustomerLocale = "pl",
): Pass2196CustomerSafeStatusSurface {
  const blueprint = BLUEPRINTS[stateCode];
  const resolvedLocale = resolveLocale(locale);
  const copy = blueprint.copy[resolvedLocale];
  const linkedPass2195 = blueprint.linkedPass2195State
    ? buildPass2195RuntimeUxBinding(blueprint.linkedPass2195State, resolvedLocale)
    : null;

  return {
    schemaVersion: PASS2196_CUSTOMER_SAFE_STATUS_SURFACE_ID,
    stateCode,
    customerVisibleStatus: blueprint.customerVisibleStatus,
    tone: blueprint.tone,
    action: blueprint.action,
    receiptCode: blueprint.receiptCode,
    headline: copy.headline,
    body: copy.body,
    actionLabel: copy.actionLabel,
    customerCanSee: copy.customerCanSee,
    customerCannotSee: copy.customerCannotSee,
    operatorTruth: copy.operatorTruth,
    hiddenTechnicalCodes: blueprint.hiddenTechnicalCodes,
    linkedPass2195State: blueprint.linkedPass2195State,
    linkedPass2195Receipt: linkedPass2195?.receiptCode,
    safeForCustomerUi: true,
    noRawInternalStatusForCustomer: true,
    noPaidAdvancedLeak: true,
    dataAttribute: "data-pass2196-customer-safe-status",
  };
}

export function buildPass2196CustomerSafeStatusSurfaceReport(locale: Pass2196CustomerLocale = "pl") {
  const states = (Object.keys(BLUEPRINTS) as Pass2196CustomerSafeStateCode[]).map((stateCode) =>
    buildPass2196CustomerSafeStatusSurface(stateCode, locale),
  );

  return {
    schemaVersion: PASS2196_CUSTOMER_SAFE_STATUS_SURFACE_ID,
    passId: "PASS2196" as const,
    generatedAt: new Date().toISOString(),
    status: "PASS_STATIC_ONLY" as const,
    productionGate: "BLOCK_RUNTIME_PRODUCTION" as const,
    states,
    receiptsRequiredForRuntimePromotion: [
      "customer_safe_advanced_locked_checkout screenshot",
      "customer_safe_advanced_checkout_retry screenshot",
      "customer_safe_gemini_fallback screenshot",
      "customer_safe_provider_proof_needed screenshot",
      "customer_safe_pdf_advanced_locked screenshot",
      "customer_safe_order_status_no_pii screenshot",
    ],
    customerSafetyRules: [
      "Never show raw BLOCKED_ENV/PASS_STATIC_ONLY codes as customer-facing copy.",
      "Never expose paid Advanced evidence to unpaid users.",
      "Never expose provider, Stripe, Supabase or Gemini secrets in customer surfaces.",
      "Customer copy should explain next steps calmly, while operatorTruth keeps the exact internal reason.",
    ],
  };
}
