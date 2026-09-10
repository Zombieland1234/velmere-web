import { createHash } from "node:crypto";

export type A100IncidentLocale = "pl" | "en" | "de";
export type A100IncidentNoticeKind = "investigating" | "resolved";
export type A100IncidentSeverity = "SEV1" | "SEV2" | "SEV3";

export type A100IncidentNoticeInput = {
  kind: A100IncidentNoticeKind;
  locale: A100IncidentLocale;
  severity: A100IncidentSeverity;
  incidentIdHash: string;
  recipientCohortHash: string;
  affectedSurfaceIds: string[];
  nextUpdateAt: string | null;
  recoveryValidated: boolean;
  dataLossAssessment: "NOT_ASSESSED" | "NO_EVIDENCE_OBSERVED" | "CONFIRMED_IMPACT";
};

export type A100IncidentNotice = {
  schemaVersion: "velmere.pass36.a100.customer-incident-notice.v1";
  kind: A100IncidentNoticeKind;
  locale: A100IncidentLocale;
  severity: A100IncidentSeverity;
  incidentIdHash: string;
  recipientCohortHash: string;
  affectedSurfaceIds: string[];
  claimIds: string[];
  title: string;
  body: string;
  nextUpdateAt: string | null;
  recoveryValidated: boolean;
  dataLossAssessment: A100IncidentNoticeInput["dataLossAssessment"];
  contentSha256: string;
  truthBoundary: string;
};

const HEX64 = /^[a-f0-9]{64}$/u;
const SAFE_SURFACE = /^[a-z0-9][a-z0-9._:-]{1,80}$/u;
const MAX_SURFACES = 24;
const MAX_BODY_CHARS = 1200;

const TITLES: Record<A100IncidentLocale, Record<A100IncidentNoticeKind, string>> = {
  pl: { investigating: "Badamy zakłócenie usługi", resolved: "Usługa została przywrócona" },
  en: { investigating: "We are investigating a service disruption", resolved: "Service has been restored" },
  de: { investigating: "Wir untersuchen eine Dienststörung", resolved: "Der Dienst wurde wiederhergestellt" },
};

function sha256(value: string) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function requireIsoOrNull(value: string | null) {
  if (value === null) return null;
  if (value.length > 64 || !Number.isFinite(Date.parse(value))) throw new Error("a100_notice_next_update_invalid");
  return value;
}

function normalizeSurfaces(values: string[]) {
  if (!Array.isArray(values) || values.length < 1 || values.length > MAX_SURFACES) throw new Error("a100_notice_surface_denominator_invalid");
  const normalized = values.map((value) => String(value).trim().toLowerCase());
  if (normalized.some((value) => !SAFE_SURFACE.test(value))) throw new Error("a100_notice_surface_invalid");
  const unique = [...new Set(normalized)].sort();
  if (unique.length !== normalized.length) throw new Error("a100_notice_surface_duplicate");
  return unique;
}

function buildBody(input: Omit<A100IncidentNoticeInput, "affectedSurfaceIds"> & { affectedSurfaceIds: string[] }) {
  const surfaces = input.affectedSurfaceIds.join(", ");
  if (input.kind === "investigating") {
    if (input.locale === "pl") return `Wykryliśmy zakłócenie obejmujące: ${surfaces}. Dostęp do funkcji płatnych może być czasowo ograniczony, gdy prowadzimy analizę i bezpieczne przywracanie. Nie potwierdzamy na tym etapie pełnego zakresu wpływu ani braku utraty danych.${input.nextUpdateAt ? ` Kolejna aktualizacja jest planowana nie później niż ${input.nextUpdateAt}.` : " Kolejna aktualizacja zostanie opublikowana po uzyskaniu zweryfikowanych informacji."}`;
    if (input.locale === "de") return `Wir haben eine Störung erkannt, die folgende Bereiche betrifft: ${surfaces}. Der Zugriff auf kostenpflichtige Funktionen kann während der Untersuchung und sicheren Wiederherstellung vorübergehend eingeschränkt sein. Zu diesem Zeitpunkt bestätigen wir weder den vollständigen Umfang der Auswirkungen noch, dass kein Datenverlust eingetreten ist.${input.nextUpdateAt ? ` Das nächste Update ist spätestens für ${input.nextUpdateAt} geplant.` : " Ein weiteres Update folgt, sobald verifizierte Informationen vorliegen."}`;
    return `We detected a disruption affecting: ${surfaces}. Access to paid functionality may be temporarily restricted while we investigate and restore service safely. At this stage, we do not confirm the full impact or claim that no data was lost.${input.nextUpdateAt ? ` The next update is planned no later than ${input.nextUpdateAt}.` : " Another update will be published when verified information is available."}`;
  }
  if (!input.recoveryValidated) throw new Error("a100_notice_resolved_without_validated_recovery");
  const assessment = input.dataLossAssessment === "CONFIRMED_IMPACT"
    ? (input.locale === "pl" ? "Potwierdzono wpływ na dane; szczegóły i wymagane działania zostaną przekazane właściwym odbiorcom." : input.locale === "de" ? "Eine Auswirkung auf Daten wurde bestätigt; Einzelheiten und erforderliche Maßnahmen werden den betroffenen Empfängern mitgeteilt." : "Data impact was confirmed; details and required actions will be provided to affected recipients.")
    : input.dataLossAssessment === "NO_EVIDENCE_OBSERVED"
      ? (input.locale === "pl" ? "W przeprowadzonych kontrolach nie zaobserwowano dowodów utraty danych, ale nie jest to gwarancja absolutna." : input.locale === "de" ? "Bei den durchgeführten Prüfungen wurden keine Hinweise auf Datenverlust festgestellt; dies ist jedoch keine absolute Garantie." : "The completed checks found no evidence of data loss, but this is not an absolute guarantee.")
      : (input.locale === "pl" ? "Ocena wpływu na dane nie została jeszcze zakończona." : input.locale === "de" ? "Die Bewertung möglicher Datenauswirkungen ist noch nicht abgeschlossen." : "The data-impact assessment is not yet complete.");
  if (input.locale === "pl") return `Funkcje objęte incydentem zostały przywrócone i przeszły zadeklarowane kontrole stanu: ${surfaces}. ${assessment} Monitoring i analiza przyczyn nadal trwają.`;
  if (input.locale === "de") return `Die betroffenen Funktionen wurden wiederhergestellt und haben die vorgesehenen Zustandsprüfungen bestanden: ${surfaces}. ${assessment} Überwachung und Ursachenanalyse werden fortgesetzt.`;
  return `The affected functionality has been restored and passed the declared state checks: ${surfaces}. ${assessment} Monitoring and root-cause analysis are continuing.`;
}

export function buildA100CustomerIncidentNotice(input: A100IncidentNoticeInput): A100IncidentNotice {
  if (!HEX64.test(input.incidentIdHash) || !HEX64.test(input.recipientCohortHash)) throw new Error("a100_notice_identity_digest_invalid");
  if (!(["pl", "en", "de"] as const).includes(input.locale)) throw new Error("a100_notice_locale_invalid");
  if (!(["investigating", "resolved"] as const).includes(input.kind)) throw new Error("a100_notice_kind_invalid");
  if (!(["SEV1", "SEV2", "SEV3"] as const).includes(input.severity)) throw new Error("a100_notice_severity_invalid");
  if (!(["NOT_ASSESSED", "NO_EVIDENCE_OBSERVED", "CONFIRMED_IMPACT"] as const).includes(input.dataLossAssessment)) throw new Error("a100_notice_data_loss_assessment_invalid");
  const affectedSurfaceIds = normalizeSurfaces(input.affectedSurfaceIds);
  const nextUpdateAt = requireIsoOrNull(input.nextUpdateAt);
  if (input.kind === "investigating" && input.recoveryValidated) throw new Error("a100_notice_investigating_recovery_invalid");
  const title = TITLES[input.locale][input.kind];
  const body = buildBody({ ...input, affectedSurfaceIds, nextUpdateAt });
  if (body.length > MAX_BODY_CHARS) throw new Error("a100_notice_body_too_long");
  const forbidden = /(?:zero risk|fully safe|completely safe|guaranteed|no data loss|kein datenverlust garantiert|brak utraty danych gwarantowany|100% safe)/iu;
  if (forbidden.test(`${title}\n${body}`)) throw new Error("a100_notice_false_safety_claim");
  const claimIds = input.kind === "investigating"
    ? ["incident.detected", "paid.access.may_be_restricted", "impact.not_yet_fully_confirmed", "data_loss.not_yet_confirmed"]
    : ["service.restored", "recovery.validation.completed", `data_loss.${input.dataLossAssessment.toLowerCase()}`, "monitoring.continues"];
  const core = {
    schemaVersion: "velmere.pass36.a100.customer-incident-notice.v1" as const,
    kind: input.kind,
    locale: input.locale,
    severity: input.severity,
    incidentIdHash: input.incidentIdHash,
    recipientCohortHash: input.recipientCohortHash,
    affectedSurfaceIds,
    claimIds,
    title,
    body,
    nextUpdateAt,
    recoveryValidated: input.recoveryValidated,
    dataLossAssessment: input.dataLossAssessment,
    truthBoundary: "Customer-safe incident copy states only the validated lifecycle status, affected declared surfaces and bounded data-impact assessment. It is not legal advice, an SLA, a guarantee of safety or proof that no data was lost.",
  };
  return Object.freeze({ ...core, contentSha256: sha256(canonicalJson(core)) });
}
