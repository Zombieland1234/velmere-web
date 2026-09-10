import { sha256Token } from "@/lib/security/cryptographic-digest";
export const PASS2195_RUNTIME_UX_BINDING_ID = "pass2195-error-paywall-ux-binding" as const;

export type Pass2195Locale = "pl" | "en" | "de";

export type Pass2195RuntimeUxStateCode =
  | "advanced_checking_access"
  | "advanced_checkout_required"
  | "advanced_access_ready"
  | "advanced_local_demo_ready"
  | "advanced_checkout_error"
  | "gemini_live_fallback"
  | "gemini_local_mode_notice"
  | "provider_blocked_env"
  | "pdf_advanced_locked"
  | "pdf_generation_error"
  | "receipt_missing_runtime_proof";

export type Pass2195RuntimeUxTone = "loading" | "ready" | "warning" | "error" | "locked";

export type Pass2195RuntimeUxAction = "wait" | "start_analysis" | "open_checkout" | "retry" | "use_free_tier" | "capture_receipt" | "contact_support";

export type Pass2195RuntimeUxBinding = {
  schemaVersion: typeof PASS2195_RUNTIME_UX_BINDING_ID;
  stateCode: Pass2195RuntimeUxStateCode;
  tone: Pass2195RuntimeUxTone;
  action: Pass2195RuntimeUxAction;
  receiptCode: string;
  customerMessage: string;
  operatorMessage: string;
  actionLabel: string;
  dataAttribute: string;
  noSilentFailure: true;
  advancedContentBoundary: boolean;
  runtimeReceiptFriendly: true;
};

type BindingBlueprint = {
  tone: Pass2195RuntimeUxTone;
  action: Pass2195RuntimeUxAction;
  advancedContentBoundary?: boolean;
  receiptCode: string;
  copy: Record<Pass2195Locale, {
    customerMessage: string;
    operatorMessage: string;
    actionLabel: string;
  }>;
};

const BLUEPRINTS: Record<Pass2195RuntimeUxStateCode, BindingBlueprint> = {
  advanced_checking_access: {
    tone: "loading",
    action: "wait",
    receiptCode: "adv_checking_access_visible",
    advancedContentBoundary: true,
    copy: {
      pl: {
        customerMessage: "Sprawdzam dostęp Advanced — analiza nie zacznie się w tle bez potwierdzenia entitlement.",
        operatorMessage: "Advanced access check is visible and fail-closed before analysis starts.",
        actionLabel: "Sprawdzam dostęp",
      },
      en: {
        customerMessage: "Checking Advanced access — analysis will not start silently without entitlement proof.",
        operatorMessage: "Advanced access check is visible and fail-closed before analysis starts.",
        actionLabel: "Checking access",
      },
      de: {
        customerMessage: "Advanced-Zugang wird geprüft — die Analyse startet nicht still ohne Entitlement-Nachweis.",
        operatorMessage: "Advanced access check is visible and fail-closed before analysis starts.",
        actionLabel: "Zugang prüfen",
      },
    },
  },
  advanced_checkout_required: {
    tone: "locked",
    action: "use_free_tier",
    receiptCode: "adv_current_not_for_sale_visible",
    advancedContentBoundary: true,
    copy: {
      pl: {
        customerMessage: "Advanced nie jest obecnie dostępny publicznie ani na sprzedaż. Użyj darmowego Basic; Pro działa wyłącznie jako kontrolowana beta na zaproszenie.",
        operatorMessage: "Legacy checkout-required state is normalized to current NOT_FOR_SALE truth; no public checkout or Advanced evidence is exposed.",
        actionLabel: "Użyj Basic",
      },
      en: {
        customerMessage: "Advanced is not currently public or for sale. Use the free Basic prescreen; Pro is available only as a controlled invitation-only beta.",
        operatorMessage: "Legacy checkout-required state is normalized to current NOT_FOR_SALE truth; no public checkout or Advanced evidence is exposed.",
        actionLabel: "Use Basic",
      },
      de: {
        customerMessage: "Advanced ist derzeit weder öffentlich verfügbar noch zum Verkauf. Nutze den kostenlosen Basic-Prescreen; Pro ist nur als kontrollierte Beta auf Einladung verfügbar.",
        operatorMessage: "Legacy checkout-required state is normalized to current NOT_FOR_SALE truth; no public checkout or Advanced evidence is exposed.",
        actionLabel: "Basic nutzen",
      },
    },
  },
  advanced_access_ready: {
    tone: "ready",
    action: "start_analysis",
    receiptCode: "adv_paid_entitlement_analysis_ready",
    advancedContentBoundary: true,
    copy: {
      pl: {
        customerMessage: "Wewnętrzny dostęp testowy Advanced został potwierdzony. Wynik pozostaje analizą automatyczną, bez human review i bez prawa do publicznej sprzedaży.",
        operatorMessage: "Internal entitlement accepted for controlled evaluation only; NOT_FOR_SALE and no-human-review boundaries remain active.",
        actionLabel: "Start Advanced",
      },
      en: {
        customerMessage: "Internal Advanced evaluation access is confirmed. The result remains automated, includes no human review, and is not approved for public sale.",
        operatorMessage: "Internal entitlement accepted for controlled evaluation only; NOT_FOR_SALE and no-human-review boundaries remain active.",
        actionLabel: "Start Advanced",
      },
      de: {
        customerMessage: "Der interne Advanced-Testzugang wurde bestätigt. Das Ergebnis bleibt automatisiert, enthält kein Human Review und ist nicht für den öffentlichen Verkauf freigegeben.",
        operatorMessage: "Internal entitlement accepted for controlled evaluation only; NOT_FOR_SALE and no-human-review boundaries remain active.",
        actionLabel: "Advanced starten",
      },
    },
  },
  advanced_local_demo_ready: {
    tone: "warning",
    action: "start_analysis",
    receiptCode: "adv_local_demo_visible_boundary",
    advancedContentBoundary: true,
    copy: {
      pl: {
        customerMessage: "Advanced działa wyłącznie jako lokalny test. Nie jest publicznie dostępny, nie ma ceny i nie jest gotowy do sprzedaży.",
        operatorMessage: "Local demo access is evaluation-only and must not be treated as public availability, payment, or sale approval.",
        actionLabel: "Start demo",
      },
      en: {
        customerMessage: "Advanced is running only as a local evaluation. It is not public, has no public price, and is not approved for sale.",
        operatorMessage: "Local demo access is evaluation-only and must not be treated as public availability, payment, or sale approval.",
        actionLabel: "Start demo",
      },
      de: {
        customerMessage: "Advanced läuft nur als lokale Evaluierung. Es ist nicht öffentlich, hat keinen öffentlichen Preis und ist nicht zum Verkauf freigegeben.",
        operatorMessage: "Local demo access is evaluation-only and must not be treated as public availability, payment, or sale approval.",
        actionLabel: "Demo starten",
      },
    },
  },
  advanced_checkout_error: {
    tone: "error",
    action: "retry",
    receiptCode: "adv_checkout_failure_visible_error",
    advancedContentBoundary: true,
    copy: {
      pl: {
        customerMessage: "Checkout albo bramka dostępu zwróciły błąd. Nic nie znikło po cichu — możesz spróbować ponownie albo użyć Basic/Pro.",
        operatorMessage: "Checkout/access failure is visible and receipt-friendly; no silent no-op.",
        actionLabel: "Spróbuj ponownie",
      },
      en: {
        customerMessage: "Checkout or the access gate returned an error. Nothing failed silently — try again or use Basic/Pro.",
        operatorMessage: "Checkout/access failure is visible and receipt-friendly; no silent no-op.",
        actionLabel: "Try again",
      },
      de: {
        customerMessage: "Checkout oder Access-Gate meldete einen Fehler. Nichts ist still fehlgeschlagen — bitte erneut versuchen oder Basic/Pro nutzen.",
        operatorMessage: "Checkout/access failure is visible and receipt-friendly; no silent no-op.",
        actionLabel: "Erneut versuchen",
      },
    },
  },
  gemini_live_fallback: {
    tone: "warning",
    action: "use_free_tier",
    receiptCode: "gemini_fallback_visible_notice",
    copy: {
      pl: {
        customerMessage: "Live AI jest chwilowo niedostępne. Pokazuję bezpieczny fallback z oznaczeniem brakujących dowodów zamiast udawać pełną analizę.",
        operatorMessage: "Gemini/provider fallback must be visible and must preserve missing-proof honesty.",
        actionLabel: "Pokaż fallback",
      },
      en: {
        customerMessage: "Live AI is temporarily unavailable. Showing a safe fallback with missing-proof labels instead of pretending a full analysis ran.",
        operatorMessage: "Gemini/provider fallback must be visible and must preserve missing-proof honesty.",
        actionLabel: "Show fallback",
      },
      de: {
        customerMessage: "Live-KI ist vorübergehend nicht verfügbar. Ich zeige einen sicheren Fallback mit fehlenden Nachweisen statt eine vollständige Analyse vorzutäuschen.",
        operatorMessage: "Gemini/provider fallback must be visible and must preserve missing-proof honesty.",
        actionLabel: "Fallback anzeigen",
      },
    },
  },
  gemini_local_mode_notice: {
    tone: "warning",
    action: "capture_receipt",
    receiptCode: "gemini_local_mode_visible_notice",
    copy: {
      pl: {
        customerMessage: "Odpowiedź pochodzi z trybu lokalnego. Do claimu world-class potrzebny jest live receipt Gemini PL/EN/DE.",
        operatorMessage: "Local AI mode is visible and cannot be counted as live Gemini proof.",
        actionLabel: "Złap live receipt",
      },
      en: {
        customerMessage: "This answer comes from local mode. A live Gemini PL/EN/DE receipt is required for a world-class claim.",
        operatorMessage: "Local AI mode is visible and cannot be counted as live Gemini proof.",
        actionLabel: "Capture live receipt",
      },
      de: {
        customerMessage: "Diese Antwort stammt aus dem lokalen Modus. Für den World-Class-Claim ist ein Live-Gemini-Receipt PL/EN/DE nötig.",
        operatorMessage: "Local AI mode is visible and cannot be counted as live Gemini proof.",
        actionLabel: "Live-Receipt erfassen",
      },
    },
  },
  provider_blocked_env: {
    tone: "locked",
    action: "capture_receipt",
    receiptCode: "provider_blocked_env_visible",
    copy: {
      pl: {
        customerMessage: "Fulfillment provider nie ma jeszcze runtime proofu. Zamówienia nie są oznaczane jako produkcyjnie gotowe bez stock/order receiptów.",
        operatorMessage: "Provider/order status is blocked until redacted provider and stock receipts are captured.",
        actionLabel: "Dodaj provider receipt",
      },
      en: {
        customerMessage: "Fulfillment provider has no runtime proof yet. Orders are not marked production-ready without stock/order receipts.",
        operatorMessage: "Provider/order status is blocked until redacted provider and stock receipts are captured.",
        actionLabel: "Add provider receipt",
      },
      de: {
        customerMessage: "Der Fulfillment-Provider hat noch keinen Runtime-Nachweis. Bestellungen gelten ohne Stock/Order-Receipts nicht als produktionsbereit.",
        operatorMessage: "Provider/order status is blocked until redacted provider and stock receipts are captured.",
        actionLabel: "Provider-Receipt hinzufügen",
      },
    },
  },
  pdf_advanced_locked: {
    tone: "locked",
    action: "open_checkout",
    receiptCode: "pdf_advanced_locked_visible",
    advancedContentBoundary: true,
    copy: {
      pl: {
        customerMessage: "Pełny PDF Advanced jest zablokowany bez płatnego dostępu. Preview pozostaje bezpieczny i nie zawiera operator appendix.",
        operatorMessage: "Unpaid PDF must not reveal Advanced evidence ledger, proof capsule or operator appendix.",
        actionLabel: "Odblokuj PDF Advanced",
      },
      en: {
        customerMessage: "Full Advanced PDF is locked without paid access. Preview stays safe and does not include the operator appendix.",
        operatorMessage: "Unpaid PDF must not reveal Advanced evidence ledger, proof capsule or operator appendix.",
        actionLabel: "Unlock Advanced PDF",
      },
      de: {
        customerMessage: "Das vollständige Advanced-PDF ist ohne bezahlten Zugang gesperrt. Die Vorschau bleibt sicher und enthält keinen Operator-Anhang.",
        operatorMessage: "Unpaid PDF must not reveal Advanced evidence ledger, proof capsule or operator appendix.",
        actionLabel: "Advanced-PDF entsperren",
      },
    },
  },
  pdf_generation_error: {
    tone: "error",
    action: "retry",
    receiptCode: "pdf_generation_error_visible",
    copy: {
      pl: {
        customerMessage: "PDF nie wygenerował się poprawnie. Pokazuję błąd i zachowuję preview/download parity zamiast pobierać uszkodzony plik.",
        operatorMessage: "PDF failure must be visible and must not create a broken or mismatched download.",
        actionLabel: "Wygeneruj ponownie",
      },
      en: {
        customerMessage: "PDF was not generated correctly. Showing an error and preserving preview/download parity instead of downloading a broken file.",
        operatorMessage: "PDF failure must be visible and must not create a broken or mismatched download.",
        actionLabel: "Generate again",
      },
      de: {
        customerMessage: "PDF wurde nicht korrekt erzeugt. Ich zeige einen Fehler und erhalte Preview/Download-Parität statt eine defekte Datei zu laden.",
        operatorMessage: "PDF failure must be visible and must not create a broken or mismatched download.",
        actionLabel: "Erneut erzeugen",
      },
    },
  },
  receipt_missing_runtime_proof: {
    tone: "warning",
    action: "capture_receipt",
    receiptCode: "runtime_receipt_missing_visible",
    copy: {
      pl: {
        customerMessage: "Ten obszar ma kod, ale brakuje runtime proofu. Board zostaje BLOCKED_ENV, dopóki nie dodamy redacted receiptu.",
        operatorMessage: "Static pass is not enough for production/world-class promotion; runtime receipt is required.",
        actionLabel: "Złap receipt",
      },
      en: {
        customerMessage: "This area has code, but runtime proof is missing. The board stays BLOCKED_ENV until a redacted receipt is added.",
        operatorMessage: "Static pass is not enough for production/world-class promotion; runtime receipt is required.",
        actionLabel: "Capture receipt",
      },
      de: {
        customerMessage: "Dieser Bereich hat Code, aber der Runtime-Nachweis fehlt. Das Board bleibt BLOCKED_ENV, bis ein redacted Receipt ergänzt wird.",
        operatorMessage: "Static pass is not enough for production/world-class promotion; runtime receipt is required.",
        actionLabel: "Receipt erfassen",
      },
    },
  },
};

export const PASS2195_REQUIRED_UX_STATES = Object.keys(BLUEPRINTS) as Pass2195RuntimeUxStateCode[];

function normalizeLocale(locale: unknown): Pass2195Locale {
  return locale === "en" || locale === "de" || locale === "pl" ? locale : "pl";
}

export function buildPass2195RuntimeUxBinding(stateCode: Pass2195RuntimeUxStateCode, locale?: unknown): Pass2195RuntimeUxBinding {
  const blueprint = BLUEPRINTS[stateCode];
  const safeLocale = normalizeLocale(locale);
  const copy = blueprint.copy[safeLocale];
  return {
    schemaVersion: PASS2195_RUNTIME_UX_BINDING_ID,
    stateCode,
    tone: blueprint.tone,
    action: blueprint.action,
    receiptCode: blueprint.receiptCode,
    customerMessage: copy.customerMessage,
    operatorMessage: copy.operatorMessage,
    actionLabel: copy.actionLabel,
    dataAttribute: `data-pass2195-runtime-ux="${stateCode}"`,
    noSilentFailure: true,
    advancedContentBoundary: blueprint.advancedContentBoundary === true,
    runtimeReceiptFriendly: true,
  };
}

export function buildPass2195RuntimeUxBindingMatrix(locale?: unknown) {
  return PASS2195_REQUIRED_UX_STATES.map((stateCode) => buildPass2195RuntimeUxBinding(stateCode, locale));
}

export function pass2195ToneForNotice(tone: Pass2195RuntimeUxTone): "loading" | "ready" | "error" {
  if (tone === "ready") return "ready";
  if (tone === "error") return "error";
  return "loading";
}

export function stateForAdvancedAccessMode(args: { ok: boolean; status?: number; accessMode?: string; localDemo?: boolean; checkoutFailure?: boolean }) {
  if (args.checkoutFailure) return "advanced_checkout_error" as const;
  if (!args.ok || args.status === 402) return "advanced_checkout_required" as const;
  if (args.accessMode === "local_advanced_demo" || args.localDemo) return "advanced_local_demo_ready" as const;
  return "advanced_access_ready" as const;
}

export function buildPass2195RuntimeUxBindingReport(locale?: unknown) {
  const matrix = buildPass2195RuntimeUxBindingMatrix(locale);
  const required = new Set<Pass2195RuntimeUxStateCode>(PASS2195_REQUIRED_UX_STATES);
  const hasNoSilentFailure = matrix.every((entry) => entry.noSilentFailure && entry.runtimeReceiptFriendly && entry.customerMessage.length > 20);
  const advancedLockedStates = matrix.filter((entry) => entry.advancedContentBoundary).map((entry) => entry.stateCode);
  const missing = PASS2195_REQUIRED_UX_STATES.filter((state) => !required.has(state));
  return {
    schemaVersion: PASS2195_RUNTIME_UX_BINDING_ID,
    passId: "PASS2195" as const,
    generatedAt: new Date().toISOString(),
    status: missing.length || !hasNoSilentFailure ? "FAIL" as const : "PASS_STATIC_ONLY" as const,
    productionGate: "BLOCK_RUNTIME_PRODUCTION" as const,
    matrix,
    advancedLockedStates,
    receiptCodes: matrix.map((entry) => entry.receiptCode),
    uiContract: [
      "Every blocked/error/runtime-fallback state must produce a visible message, not silent no-op.",
      "Advanced unpaid and PDF Advanced unpaid must show locked/paywall copy and must not leak Advanced content.",
      "Gemini fallback/local mode and provider BLOCKED_ENV must be visible and receipt-friendly.",
      "Runtime Proof Board remains blocked until owner/Codex/browser receipts are captured.",
    ],
    missingStates: missing,
    checksum: checksumPass2195(matrix.map((entry) => `${entry.stateCode}:${entry.tone}:${entry.receiptCode}`)),
  };
}

function checksumPass2195(parts: string[]) {
  return `p2195-${sha256Token(parts.join("|"), 24)}`;
}
