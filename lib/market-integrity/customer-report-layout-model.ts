import { JSON_CONTROL_PATTERN } from "../security/ascii-control-characters";

import type { buildCustomerReportPayload } from "@/lib/market-integrity/customer-report-payload";
import { canonicalJson } from "@/lib/security/canonical-json";
import { sha256Digest } from "@/lib/security/cryptographic-digest";

export const PASS4819_CUSTOMER_REPORT_LAYOUT_MODEL_ID = "pass4819-customer-report-layout-model-v1" as const;

export type CustomerReportPayload = ReturnType<typeof buildCustomerReportPayload>;
export type CustomerReportLayoutRow = {
  id: string;
  label: string | null;
  value: string;
  kind: "heading" | "field" | "body" | "evidence" | "action" | "warning" | "spacer";
};
export type CustomerReportLayoutSection = {
  id: string;
  title: string;
  keepTogether: boolean;
  rows: CustomerReportLayoutRow[];
};
export type CustomerReportLayoutModel = {
  schemaVersion: typeof PASS4819_CUSTOMER_REPORT_LAYOUT_MODEL_ID;
  reportId: string;
  locale: CustomerReportPayload["locale"];
  requestedTier: CustomerReportPayload["tier"];
  deliveredTier: CustomerReportPayload["deliveryPolicy"]["visibleTier"];
  sectionOrder: string[];
  sections: CustomerReportLayoutSection[];
  normalizedTextDigest: string;
  layoutDigest: string;
};

const UNSAFE = /\b(seed phrase|api key|private key|guaranteed safe|contract is secure|debug payload|operator-only|raw payload|receipt token)\b/i;

function clean(value: unknown, max = 1200): string {
  return String(value ?? "")
    .normalize("NFC")
    .replace(JSON_CONTROL_PATTERN, " ")
    .replace(/[<>]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

function row(id: string, label: string | null, value: unknown, kind: CustomerReportLayoutRow["kind"] = "field"): CustomerReportLayoutRow | null {
  const text = clean(value);
  if ((!text && kind !== "spacer") || UNSAFE.test(text)) return null;
  return { id, label: label ? clean(label, 160) : null, value: text, kind };
}

function percent(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? `${value.toFixed(2)}%` : "—";
}

function copy(locale: CustomerReportPayload["locale"]) {
  if (locale === "pl") return {
    sections: { executive: "PODSUMOWANIE DECYZYJNE", coverage: "POKRYCIE I BRAKI DOWODOWE", sources: "ŹRÓDŁA I RECEIPTY", decisions: "ANALIZA I DZIAŁANIA", integrity: "INTEGRALNOŚĆ RAPORTU", methodology: "METODOLOGIA I OGRANICZENIA", review: "WERYFIKACJA ADVANCED" },
    labels: { reportId: "ID raportu", product: "Produkt", requestedTier: "Zamówiony poziom", visibleTier: "Dostarczony poziom", status: "Status komercyjny", asset: "Aktywo", family: "Klasa aktywa", generated: "Wygenerowano", validAsOf: "Stan danych na", expires: "Ważny do", risk: "Ryzyko", confidence: "Pewność", coverage: "Pokrycie", missing: "Brakujące krytyczne dowody", providerReceipts: "Receipty providerów", customerAction: "Działanie dla klienta", state: "Stan", evidence: "Dowody", actions: "Następne działania", source: "Źródło", freshness: "Świeżość", observedAt: "Zaobserwowano", digest: "Digest treści", executed: "Wykonane testy", unexecuted: "Niewykonane testy", methodology: "Metodologia", analyzer: "Wersja analizatora", dataWindow: "Okno danych", payloadDigest: "Digest payloadu", evidencePacket: "Hash pakietu dowodowego", reportHash: "Hash raportu", monitoring: "Monitoring", manualReview: "Manual review", advancedMode: "Tryb Advanced", automatedEvidence: "Automatyczne evidence" },
    state: { ready: "gotowe", watch: "obserwacja", blocked: "zablokowane", missing: "brak" },
    noSources: "Brak content-bound receiptów. Nazwa providera bez hasha odpowiedzi nie jest dowodem płatnym.",
    noDecisions: "Brak dodatkowych sekcji decyzyjnych dla dostarczonego poziomu.",
    advancedLocked: "Dodatek Advanced pozostaje zablokowany do czasu zweryfikowanego manual review związanego z tym samym payloadem.",
    advancedAutomatedLocked: "Automatyczny dossier Advanced pozostaje WITHHELD, dopóki exact requested-tier evidence, scenariusze i value gates nie przejdą. Opcjonalne human QA nie może go odblokować.",
    disclaimer: "Wynik opisuje ryzyko i jakość dowodów w zadanym zakresie. Nie oznacza certyfikatu bezpieczeństwa, gwarancji wyniku ani rekomendacji kupna lub sprzedaży.",
  } as const;
  if (locale === "de") return {
    sections: { executive: "ENTSCHEIDUNGSÜBERSICHT", coverage: "ABDECKUNG UND EVIDENZLÜCKEN", sources: "QUELLEN UND RECEIPTS", decisions: "ANALYSE UND MASSNAHMEN", integrity: "BERICHTSINTEGRITÄT", methodology: "METHODIK UND GRENZEN", review: "ADVANCED-PRÜFUNG" },
    labels: { reportId: "Berichts-ID", product: "Produkt", requestedTier: "Angeforderte Stufe", visibleTier: "Gelieferte Stufe", status: "Kommerzieller Status", asset: "Instrument", family: "Anlageklasse", generated: "Erstellt", validAsOf: "Datenstand", expires: "Gültig bis", risk: "Risiko", confidence: "Konfidenz", coverage: "Abdeckung", missing: "Fehlende kritische Evidenz", providerReceipts: "Provider-Receipts", customerAction: "Kundenaktion", state: "Status", evidence: "Evidenz", actions: "Nächste Schritte", source: "Quelle", freshness: "Aktualität", observedAt: "Beobachtet", digest: "Inhaltsdigest", executed: "Ausgeführte Tests", unexecuted: "Nicht ausgeführte Tests", methodology: "Methodik", analyzer: "Analyzer-Version", dataWindow: "Datenfenster", payloadDigest: "Payload-Digest", evidencePacket: "Evidenzpaket-Hash", reportHash: "Berichtshash", monitoring: "Monitoring", manualReview: "Manuelle Prüfung", advancedMode: "Advanced-Modus", automatedEvidence: "Automatisierte Evidenz" },
    state: { ready: "bereit", watch: "beobachten", blocked: "blockiert", missing: "fehlend" },
    noSources: "Keine content-bound Receipts. Ein Providername ohne Response-Hash ist kein bezahlbarer Nachweis.",
    noDecisions: "Für die gelieferte Stufe sind keine zusätzlichen Entscheidungsabschnitte verfügbar.",
    advancedLocked: "Der Advanced-Anhang bleibt gesperrt, bis eine verifizierte manuelle Prüfung an denselben Payload gebunden ist.",
    advancedAutomatedLocked: "Das automatisierte Advanced-Dossier bleibt WITHHELD, bis Evidenz, Szenarien und Value-Gates der exakt angeforderten Stufe erfüllt sind. Optionale menschliche QA kann es nicht freischalten.",
    disclaimer: "Das Ergebnis beschreibt Risiko und Evidenzqualität im geprüften Umfang. Es ist kein Sicherheitszertifikat, keine Ergebnisgarantie und keine Kauf- oder Verkaufsempfehlung.",
  } as const;
  return {
    sections: { executive: "EXECUTIVE DECISION SUMMARY", coverage: "COVERAGE AND MISSING EVIDENCE", sources: "SOURCES AND RECEIPTS", decisions: "ANALYSIS AND ACTIONS", integrity: "REPORT INTEGRITY", methodology: "METHODOLOGY AND LIMITS", review: "ADVANCED REVIEW" },
    labels: { reportId: "Report ID", product: "Product", requestedTier: "Requested tier", visibleTier: "Delivered tier", status: "Commercial status", asset: "Asset", family: "Asset family", generated: "Generated", validAsOf: "Valid as of", expires: "Expires", risk: "Risk", confidence: "Confidence", coverage: "Coverage", missing: "Missing critical evidence", providerReceipts: "Provider receipts", customerAction: "Customer action", state: "State", evidence: "Evidence", actions: "Next actions", source: "Source", freshness: "Freshness", observedAt: "Observed at", digest: "Content digest", executed: "Executed tests", unexecuted: "Unexecuted tests", methodology: "Methodology", analyzer: "Analyzer version", dataWindow: "Data window", payloadDigest: "Payload digest", evidencePacket: "Evidence packet hash", reportHash: "Report hash", monitoring: "Monitoring", manualReview: "Manual review", advancedMode: "Advanced mode", automatedEvidence: "Automated evidence" },
    state: { ready: "ready", watch: "watch", blocked: "blocked", missing: "missing" },
    noSources: "No content-bound receipts are available. A provider label without a response hash is not paid evidence.",
    noDecisions: "No additional decision sections are available for the delivered tier.",
    advancedLocked: "The Advanced appendix remains locked until a verified manual review is bound to the same payload.",
    advancedAutomatedLocked: "The automated Advanced dossier remains WITHHELD until exact requested-tier evidence, scenarios and value gates pass. Optional human QA cannot unlock it.",
    disclaimer: "The result describes risk and evidence quality within the tested scope. It is not a security certificate, outcome guarantee, or buy/sell recommendation.",
  } as const;
}

function compactRows(rows: Array<CustomerReportLayoutRow | null>): CustomerReportLayoutRow[] {
  return rows.filter((value): value is CustomerReportLayoutRow => Boolean(value));
}

export function buildCustomerReportLayoutModel(payload: CustomerReportPayload): CustomerReportLayoutModel {
  const c = copy(payload.locale);
  const envelope = payload.commercialEnvelope;
  const delivery = payload.deliveryPolicy;
  const sections: CustomerReportLayoutSection[] = [];
  const add = (id: string, title: string, rows: Array<CustomerReportLayoutRow | null>, keepTogether = false) => {
    const compact = compactRows(rows);
    if (compact.length) sections.push({ id, title, keepTogether, rows: compact });
  };

  add("executive", c.sections.executive, [
    row("report-id", c.labels.reportId, envelope.integrity.reportId), row("product", c.labels.product, envelope.productName),
    row("requested-tier", c.labels.requestedTier, payload.tier), row("delivered-tier", c.labels.visibleTier, delivery.visibleTier ?? "none"),
    row("status", c.labels.status, delivery.status), row("asset", c.labels.asset, `${payload.target.symbol} / ${payload.target.name}`),
    row("family", c.labels.family, payload.target.family), row("generated", c.labels.generated, payload.generatedAt),
    row("valid-as-of", c.labels.validAsOf, envelope.integrity.validAsOf), row("expires", c.labels.expires, envelope.integrity.expiresAt),
    row("risk", c.labels.risk, `${payload.summary.riskScore.toFixed(2)}/100 · ${payload.summary.gradeLabel}`),
    row("confidence", c.labels.confidence, percent(payload.summary.confidenceScore)), row("customer-action", c.labels.customerAction, envelope.decision.customerAction),
  ], true);

  add("coverage", c.sections.coverage, [
    row("coverage", c.labels.coverage, `${envelope.coverage.overall.toFixed(2)}% · ${envelope.coverage.completenessLabel}`),
    ...envelope.coverage.applicableDimensions.map((id) => row(`coverage-${id}`, id, percent(envelope.coverage.dimensions[id]))),
    row("missing-critical", c.labels.missing, envelope.coverage.missingCriticalEvidence),
    ...payload.missingEvidence.map((item, index) => row(`missing-${index + 1}`, `Missing ${index + 1}`, item, "warning")),
    ...payload.providerConflicts.map((item, index) => row(`conflict-${index + 1}`, `Conflict ${index + 1}`, item, "warning")),
  ]);

  const sourceRows: Array<CustomerReportLayoutRow | null> = [row("receipt-count", c.labels.providerReceipts, payload.receipts.length)];
  if (payload.receipts.length) {
    payload.receipts.forEach((receipt, index) => {
      sourceRows.push(row(`source-${index + 1}`, `${index + 1}. ${c.labels.source}`, `${receipt.provider} · ${receipt.sourceFamily} · ${receipt.evidenceState ?? "registry_only"}`, "heading"));
      sourceRows.push(row(`source-${index + 1}-observed`, c.labels.observedAt, receipt.observedAt));
      sourceRows.push(row(`source-${index + 1}-freshness`, c.labels.freshness, `${receipt.freshnessStatus} · ${receipt.ageSeconds}s`));
      sourceRows.push(row(`source-${index + 1}-digest`, c.labels.digest, receipt.payloadDigest ?? "not content-bound"));
    });
  } else sourceRows.push(row("no-sources", null, c.noSources, "warning"));
  payload.sourceBinding.unmappedObservedLabels.forEach((label, index) => sourceRows.push(row(`unmapped-${index + 1}`, `Unmapped source ${index + 1}`, label, "warning")));
  add("sources", c.sections.sources, sourceRows);

  const decisionRows: Array<CustomerReportLayoutRow | null> = [];
  if (!payload.decisionSections.length) decisionRows.push(row("no-decisions", null, c.noDecisions, "warning"));
  payload.decisionSections.forEach((section, index) => {
    decisionRows.push(row(`decision-${section.id}`, null, `${index + 1}. ${section.title}`, "heading"));
    decisionRows.push(row(`decision-${section.id}-state`, c.labels.state, c.state[section.state]));
    decisionRows.push(row(`decision-${section.id}-summary`, "Summary", section.summary, "body"));
    section.evidence.forEach((item, evidenceIndex) => decisionRows.push(row(`decision-${section.id}-evidence-${evidenceIndex + 1}`, `${c.labels.evidence} ${evidenceIndex + 1}`, item, "evidence")));
    section.actions.forEach((item, actionIndex) => decisionRows.push(row(`decision-${section.id}-action-${actionIndex + 1}`, `${c.labels.actions} ${actionIndex + 1}`, item, "action")));
  });
  add("decisions", c.sections.decisions, decisionRows);

  add("integrity", c.sections.integrity, [
    row("evidence-packet", c.labels.evidencePacket, envelope.integrity.evidencePacketHash), row("report-hash", c.labels.reportHash, envelope.integrity.reportHash),
    row("executed", c.labels.executed, envelope.integrity.executedTests.join(", ") || "none"), row("unexecuted", c.labels.unexecuted, envelope.integrity.unexecutedTests.join(", ") || "none"),
    row("data-window", c.labels.dataWindow, envelope.integrity.dataWindow),
  ]);

  add("methodology", c.sections.methodology, [
    row("methodology", c.labels.methodology, envelope.methodology.version), row("analyzer", c.labels.analyzer, envelope.methodology.analyzerVersion),
    ...envelope.methodology.standards.map((item, index) => row(`standard-${index + 1}`, `Standard ${index + 1}`, item)),
    row("disclaimer", null, c.disclaimer, "warning"),
  ]);

  if (payload.tier === "Advanced") {
    const automatedAdvanced = payload.advancedDeliveryMode === "automated";
    add("advanced-review", c.sections.review, [
      row("monitoring", c.labels.monitoring, `${envelope.monitoring.includedDays} days · ${envelope.monitoring.includedRechecks} recheck(s)`),
      automatedAdvanced
        ? row("advanced-mode", c.labels.advancedMode, "automated; optional human QA adds no release authority")
        : row("manual-review", c.labels.manualReview, delivery.manualReviewAppendixAllowed ? "verified and payload-bound" : "locked or pending"),
      automatedAdvanced
        ? row("advanced-automation", c.labels.automatedEvidence, delivery.status === "ready_paid" ? "exact requested-tier gates verified" : "WITHHELD")
        : null,
      automatedAdvanced
        ? delivery.status === "ready_paid" ? null : row("advanced-locked", null, c.advancedAutomatedLocked, "warning")
        : delivery.manualReviewAppendixAllowed ? null : row("advanced-locked", null, c.advancedLocked, "warning"),
    ], true);
  }

  const unsigned = {
    schemaVersion: PASS4819_CUSTOMER_REPORT_LAYOUT_MODEL_ID,
    reportId: payload.reportId,
    locale: payload.locale,
    requestedTier: payload.tier,
    deliveredTier: payload.deliveryPolicy.visibleTier,
    sectionOrder: sections.map((section) => section.id),
    sections,
  } as const;
  const normalizedText = sections.flatMap((section) => [section.title, ...section.rows.map((item) => `${item.label ? `${item.label}: ` : ""}${item.value}`)]);
  const normalizedTextDigest = sha256Digest(canonicalJson(normalizedText));
  return { ...unsigned, normalizedTextDigest, layoutDigest: sha256Digest(canonicalJson({ ...unsigned, normalizedTextDigest })) };
}

export function flattenCustomerReportLayoutModel(model: CustomerReportLayoutModel): string[] {
  return model.sections.flatMap((section) => [section.title, ...section.rows.map((item) => item.kind === "spacer" ? "" : `${item.label ? `${item.label}: ` : ""}${item.value}`), ""]);
}

export function verifyCustomerReportLayoutModel(payload: CustomerReportPayload, model: CustomerReportLayoutModel) {
  const rebuilt = buildCustomerReportLayoutModel(payload);
  return rebuilt.layoutDigest === model.layoutDigest && rebuilt.normalizedTextDigest === model.normalizedTextDigest && canonicalJson(rebuilt.sections) === canonicalJson(model.sections);
}
