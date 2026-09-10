export const PASS2368_CUSTOMER_SAFE_AUDIT_TIMELINE_ID = "customer-safe-audit-timeline" as const;

export type Pass2368AuditTimelineLocale = "pl" | "en" | "de";
export type Pass2368AuditTimelineStage =
  | "intake"
  | "verifying_access"
  | "access_verified"
  | "analysis_queue"
  | "report_ready"
  | "blocked"
  // Legacy compatibility only; normalized before customer output.
  | "verifying_payment"
  | "payment_verified"
  | "human_review_queue";

export type Pass2368AuditTimelineStepState = "done" | "active" | "locked" | "blocked";

export type Pass2368AuditTimelineStep = {
  id: "access_state" | "analysis_queue" | "report_ready";
  label: string;
  body: string;
  state: Pass2368AuditTimelineStepState;
  meta?: string;
};

export type Pass2368AuditTimeline = {
  passId: typeof PASS2368_CUSTOMER_SAFE_AUDIT_TIMELINE_ID;
  title: string;
  body: string;
  boundary: string;
  steps: Pass2368AuditTimelineStep[];
};

function normalizeLocale(locale: string): Pass2368AuditTimelineLocale {
  return locale === "pl" || locale === "de" || locale === "en" ? locale : "en";
}

function normalizeStage(stage: Pass2368AuditTimelineStage): Exclude<Pass2368AuditTimelineStage, "verifying_payment" | "payment_verified" | "human_review_queue"> {
  if (stage === "verifying_payment") return "verifying_access";
  if (stage === "payment_verified") return "access_verified";
  if (stage === "human_review_queue") return "analysis_queue";
  return stage;
}

const copy = {
  pl: {
    title: "Ścieżka analizy",
    body: "Basic jest darmowym ograniczonym prescreenem. Pro działa wyłącznie jako kontrolowana beta na zaproszenie z obowiązkową kontrolą jakości. Advanced nie jest na sprzedaż i nie zawiera human review.",
    boundary: "Pokazujemy tylko status i bezpieczne referencje. Nie pokazujemy surowych danych płatniczych, sekretów, wewnętrznych identyfikatorów ani instrukcji exploita.",
    accessLabel: "Dostęp do poziomu",
    accessBody: "Basic jest darmowy. Pro wymaga istniejącego zaproszenia. Advanced pozostaje niedostępny publicznie.",
    queueLabel: "Kolejka analizy",
    queueBody: "System przygotowuje automatyczne warstwy dowodowe. Status nie oznacza przydzielenia człowieka ani niezależnej certyfikacji.",
    reportLabel: "Raport informacyjny",
    reportBody: "Raport pojawia się dopiero po związaniu źródeł, integralności artefaktu i customer-safe redaction check.",
    verifying: "weryfikacja dostępu",
    verified: "dostęp zweryfikowany",
    intake: "Basic publiczny",
    queued: "kolejka analizy",
    ready: "gotowe do bezpiecznego podglądu",
    blocked: "zablokowane / brakuje dowodów",
    waiting: "oczekuje",
  },
  en: {
    title: "Analysis timeline",
    body: "Basic is a free limited prescreen. Pro is a controlled invitation-only beta with mandatory quality control. Advanced is not for sale and includes no human review.",
    boundary: "We show status and safe references only. We never expose raw payment data, secrets, internal identifiers, or exploit instructions.",
    accessLabel: "Tier access",
    accessBody: "Basic is free. Pro requires an existing invitation. Advanced remains unavailable to the public.",
    queueLabel: "Analysis queue",
    queueBody: "The system prepares automated evidence layers. This status does not mean a human reviewer or independent certification has been assigned.",
    reportLabel: "Informational report",
    reportBody: "The report appears only after source binding, artifact-integrity checks, and customer-safe redaction checks.",
    verifying: "access verification in progress",
    verified: "access verified",
    intake: "Basic public",
    queued: "analysis queue",
    ready: "ready for safe preview",
    blocked: "blocked / needs evidence",
    waiting: "waiting",
  },
  de: {
    title: "Analyse-Timeline",
    body: "Basic ist ein kostenloser begrenzter Prescreen. Pro ist eine kontrollierte Beta nur auf Einladung mit verpflichtender Qualitätsprüfung. Advanced ist nicht zum Verkauf und enthält kein Human Review.",
    boundary: "Wir zeigen nur Status und sichere Referenzen. Keine rohen Zahlungsdaten, Geheimnisse, internen Kennungen oder Exploit-Anleitungen.",
    accessLabel: "Tier-Zugang",
    accessBody: "Basic ist kostenlos. Pro benötigt eine bestehende Einladung. Advanced bleibt öffentlich nicht verfügbar.",
    queueLabel: "Analyse-Queue",
    queueBody: "Das System bereitet automatisierte Evidenzschichten vor. Dieser Status bedeutet weder Human Review noch unabhängige Zertifizierung.",
    reportLabel: "Informationsbericht",
    reportBody: "Der Bericht erscheint erst nach Source-Binding, Artefaktintegrität und customer-safe Redaction Check.",
    verifying: "Zugangsprüfung läuft",
    verified: "Zugang verifiziert",
    intake: "Basic öffentlich",
    queued: "Analyse-Queue",
    ready: "für sichere Vorschau bereit",
    blocked: "blockiert / Evidenz nötig",
    waiting: "wartet",
  },
} satisfies Record<Pass2368AuditTimelineLocale, Record<string, string>>;

function stateFor(step: Pass2368AuditTimelineStep["id"], rawStage: Pass2368AuditTimelineStage): Pass2368AuditTimelineStepState {
  const stage = normalizeStage(rawStage);
  if (stage === "blocked") return step === "report_ready" ? "blocked" : step === "access_state" ? "done" : "active";
  if (stage === "report_ready") return "done";
  if (stage === "analysis_queue") return step === "report_ready" ? "locked" : step === "analysis_queue" ? "active" : "done";
  if (stage === "access_verified") return step === "access_state" ? "done" : step === "analysis_queue" ? "active" : "locked";
  if (stage === "verifying_access") return step === "access_state" ? "active" : "locked";
  return step === "access_state" ? "active" : "locked";
}

export function buildPass2368CustomerSafeAuditTimeline(args: {
  locale: string;
  stage: Pass2368AuditTimelineStage;
  queueId?: string | null;
  accountMessageId?: string | null;
  paymentRail?: string | null;
  reportRoute?: string | null;
}): Pass2368AuditTimeline {
  const locale = normalizeLocale(args.locale);
  const labels = copy[locale];
  const stage = normalizeStage(args.stage);
  const accessMeta = stage === "intake" ? labels.intake : stage === "verifying_access" ? labels.verifying : labels.verified;
  const queueMeta = args.queueId || args.accountMessageId
    ? `${labels.queued}: ${args.queueId || args.accountMessageId}`
    : stateFor("analysis_queue", stage) === "locked"
      ? labels.waiting
      : labels.queued;
  const reportMeta = args.reportRoute
    ? labels.ready
    : stage === "blocked"
      ? labels.blocked
      : stateFor("report_ready", stage) === "locked"
        ? labels.waiting
        : labels.ready;

  return {
    passId: PASS2368_CUSTOMER_SAFE_AUDIT_TIMELINE_ID,
    title: labels.title,
    body: labels.body,
    boundary: labels.boundary,
    steps: [
      { id: "access_state", label: labels.accessLabel, body: labels.accessBody, state: stateFor("access_state", stage), meta: accessMeta },
      { id: "analysis_queue", label: labels.queueLabel, body: labels.queueBody, state: stateFor("analysis_queue", stage), meta: queueMeta },
      { id: "report_ready", label: labels.reportLabel, body: labels.reportBody, state: stateFor("report_ready", stage), meta: reportMeta },
    ],
  };
}
