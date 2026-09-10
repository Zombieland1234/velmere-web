"use client";

import { readJsonResponseBounded } from "@/lib/network/fetch-with-deadline";
import { useEffect, useState, type MouseEvent } from "react";
import {
  CheckCircle2,
  Database,
  Download,
  ExternalLink,
  FileSearch,
  LifeBuoy,
  MessageSquareText,
  ReceiptText,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { useLocale } from "next-intl";
import type { VlmAuditAccountMessage } from "@/lib/security/vlm-audit-product";
import {
  PASS4808_MAX_PAID_AUDIT_PDF_BYTES,
  assertSameOriginPaidAuditPdfPath,
  parsePaidAuditPdfTokenEnvelope,
  verifyPaidAuditPdfBytes,
} from "@/lib/security/client-audit-pdf-integrity";
import { triggerClientPdfDownload } from "@/lib/security/client-pdf-blob-boundary";

type PublicAuditDeliveryMode = "durable" | "ephemeral";
type PaidPdfUiState = "idle" | "issuing" | "verifying" | "done" | "error";

type AuditAccountMessageEnvelope = VlmAuditAccountMessage & {
  deliveryStatus?: string;
  customerStatus?: string;
  pdfRoute?: string;
  publicReportRoute?: string;
  reviewLevel?: string;
  auditReference?: string;
  projectName?: string;
  contractAddress?: string;
  canonicalCustomerSnapshot?: {
    snapshotDigest?: string;
    pdfArtifact?: {
      pdfDigest?: string;
      pdfByteLength?: number;
      renderPlanDigest?: string;
      pageCount?: number;
    };
  };
  customerSafeReport?: {
    title?: string;
    summary?: string;
    status?: string;
    pdfRoute?: string;
    publicReportRoute?: string;
    sections?: string[];
  };
  deliveryReceipt?: {
    receiptId?: string;
    integrityToken?: string;
    deliveredAt?: string;
    status?: string;
    customerSafeLinks?: {
      customerReportRoute?: string;
      safePdfPacketRoute?: string;
    };
  };
};

type AuditMessagesApiResponse = {
  schemaVersion: "velmere.public-audit-account-messages.v2";
  ok: true;
  deliveryMode: PublicAuditDeliveryMode;
  messages: AuditAccountMessageEnvelope[];
};

const copy = {
  pl: {
    eyebrow: "Velmère Audit",
    title: "Wiadomości audytowe",
    body: "Tutaj trafiają potwierdzone zgłoszenia, status analizy i materiały gotowe do odbioru. Basic pozostaje ograniczonym prescreenem, Pro jest dostępny wyłącznie w kontrolowanej becie, a Advanced nie jest obecnie w sprzedaży.",
    empty: "Brak nowych wiadomości audytowych.",
    status: "status",
    eta: "termin",
    request: "identyfikator zgłoszenia",
    access: "dostęp",
    analysis: "analiza",
    report: "raport",
    ready: "gotowe",
    waiting: "oczekuje",
    notRequired: "niewymagane",
    delivery: "dostawa",
    durable: "trwała dostawa serwerowa",
    ephemeral: "tymczasowa dostawa deweloperska",
    integrity: "integralność",
    deliveredAt: "dostarczono",
    reportSummary: "Podsumowanie raportu",
    nextSteps: "Następne kroki",
    customerReport: "Otwórz raport",
    safePdf: "Pobierz bezpieczny PDF",
    receipt: "Potwierdzenie dostawy",
    support: "Przekazanie do wsparcia",
    secureDownload: "Bezpieczny PDF jest wydawany dopiero po weryfikacji konta, entitlementu, referencji audytu i skrótu artefaktu.",
    issuing: "Wydawanie tokenu…",
    verifying: "Weryfikacja pliku…",
    downloaded: "PDF zweryfikowany i pobrany",
    unavailable: "Pobieranie jest zablokowane do czasu kompletnego potwierdzenia dostawy.",
  },
  en: {
    eyebrow: "Velmère Audit",
    title: "Audit messages",
    body: "Confirmed requests, analysis status and delivery-ready materials appear here. Basic remains a bounded prescreen, Pro is invitation-only controlled beta, and Advanced is not currently for sale.",
    empty: "No new audit messages.",
    status: "status",
    eta: "eta",
    request: "request id",
    access: "access",
    analysis: "analysis",
    report: "report",
    ready: "ready",
    waiting: "waiting",
    notRequired: "not required",
    delivery: "delivery",
    durable: "durable server delivery",
    ephemeral: "ephemeral development delivery",
    integrity: "integrity",
    deliveredAt: "delivered",
    reportSummary: "Report summary",
    nextSteps: "Next steps",
    customerReport: "Open report",
    safePdf: "Download safe PDF",
    receipt: "Delivery receipt",
    support: "Support handoff",
    secureDownload: "A paid PDF is issued only after account, entitlement, audit-reference and artifact-digest verification.",
    issuing: "Issuing token…",
    verifying: "Verifying file…",
    downloaded: "PDF verified and downloaded",
    unavailable: "Download remains blocked until the delivery receipt is complete.",
  },
  de: {
    eyebrow: "Velmère Audit",
    title: "Audit-Nachrichten",
    body: "Bestätigte Anfragen, Analysestatus und auslieferungsbereite Unterlagen erscheinen hier. Basic bleibt ein begrenzter Pre-Screen, Pro ist eine kontrollierte Beta nur auf Einladung und Advanced wird derzeit nicht verkauft.",
    empty: "Keine neuen Audit-Nachrichten.",
    status: "Status",
    eta: "Termin",
    request: "Anfrage-ID",
    access: "Zugang",
    analysis: "Analyse",
    report: "Bericht",
    ready: "bereit",
    waiting: "wartet",
    notRequired: "nicht erforderlich",
    delivery: "Auslieferung",
    durable: "dauerhafte Server-Auslieferung",
    ephemeral: "temporäre Entwicklungs-Auslieferung",
    integrity: "Integrität",
    deliveredAt: "ausgeliefert",
    reportSummary: "Berichtszusammenfassung",
    nextSteps: "Nächste Schritte",
    customerReport: "Bericht öffnen",
    safePdf: "Sichere PDF herunterladen",
    receipt: "Auslieferungsbeleg",
    support: "Support-Übergabe",
    secureDownload: "Eine bezahlte PDF wird erst nach Prüfung von Konto, Entitlement, Audit-Referenz und Artefakt-Hash ausgegeben.",
    issuing: "Token wird ausgegeben…",
    verifying: "Datei wird geprüft…",
    downloaded: "PDF geprüft und heruntergeladen",
    unavailable: "Der Download bleibt bis zum vollständigen Auslieferungsbeleg gesperrt.",
  },
} as const;

function resolveLocale(locale: string): keyof typeof copy {
  return locale === "pl" || locale === "de" || locale === "en" ? locale : "en";
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function safeString(value: unknown, max = 2000): string | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value.replace(/[\p{Cc}]/gu, " ").trim();
  return normalized ? normalized.slice(0, max) : undefined;
}

function safeNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function safeStrings(value: unknown, maxItems = 32): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => safeString(entry, 1000))
    .filter((entry): entry is string => Boolean(entry))
    .slice(0, maxItems);
}

function parsePublicAuditMessage(value: unknown): AuditAccountMessageEnvelope | null {
  const raw = asRecord(value);
  if (!raw) return null;

  const id = safeString(raw.id, 180);
  const title = safeString(raw.title, 300);
  const body = safeString(raw.body, 8000);
  const status = safeString(raw.status, 80);
  const packageLabel = safeString(raw.packageLabel, 220);
  const requestId = safeString(raw.requestId, 180);
  const createdAt = safeString(raw.createdAt, 100);
  const eta = safeString(raw.eta, 160);
  const accountRoute = safeString(raw.accountRoute, 400);
  const allowedStatuses = new Set([
    "received",
    "queued",
    "payment_pending",
    "human_review",
    "analysis_queue",
    "ready",
    "needs_evidence",
  ]);
  if (!id || !title || !body || !status || !packageLabel || !requestId || !createdAt || !eta || !accountRoute || !allowedStatuses.has(status)) {
    return null;
  }

  const report = asRecord(raw.customerSafeReport);
  const snapshot = asRecord(raw.canonicalCustomerSnapshot);
  const pdfArtifact = asRecord(snapshot?.pdfArtifact);
  const receipt = asRecord(raw.deliveryReceipt);
  const links = asRecord(receipt?.customerSafeLinks);

  return {
    id,
    title,
    body,
    status: status as VlmAuditAccountMessage["status"],
    packageLabel,
    requestId,
    createdAt,
    eta,
    accountRoute,
    nextSteps: safeStrings(raw.nextSteps, 24),
    deliveryStatus: safeString(raw.deliveryStatus, 80),
    customerStatus: safeString(raw.customerStatus, 80),
    pdfRoute: safeString(raw.pdfRoute, 500),
    publicReportRoute: safeString(raw.publicReportRoute, 500),
    reviewLevel: safeString(raw.reviewLevel, 120),
    auditReference: safeString(raw.auditReference, 120),
    projectName: safeString(raw.projectName, 240),
    contractAddress: safeString(raw.contractAddress, 240),
    customerSafeReport: report ? {
      title: safeString(report.title, 300),
      summary: safeString(report.summary, 6000),
      status: safeString(report.status, 80),
      pdfRoute: safeString(report.pdfRoute, 500),
      publicReportRoute: safeString(report.publicReportRoute, 500),
      sections: safeStrings(report.sections, 40),
    } : undefined,
    canonicalCustomerSnapshot: snapshot ? {
      snapshotDigest: safeString(snapshot.snapshotDigest, 100),
      pdfArtifact: pdfArtifact ? {
        pdfDigest: safeString(pdfArtifact.pdfDigest, 100),
        pdfByteLength: safeNumber(pdfArtifact.pdfByteLength),
        renderPlanDigest: safeString(pdfArtifact.renderPlanDigest, 100),
        pageCount: safeNumber(pdfArtifact.pageCount),
      } : undefined,
    } : undefined,
    deliveryReceipt: receipt ? {
      receiptId: safeString(receipt.receiptId, 180),
      integrityToken: safeString(receipt.integrityToken, 120),
      deliveredAt: safeString(receipt.deliveredAt, 100),
      status: safeString(receipt.status, 80),
      customerSafeLinks: links ? {
        customerReportRoute: safeString(links.customerReportRoute, 500),
        safePdfPacketRoute: safeString(links.safePdfPacketRoute, 500),
      } : undefined,
    } : undefined,
  };
}

function parseAuditMessagesApiResponse(value: unknown): AuditMessagesApiResponse | null {
  const raw = asRecord(value);
  if (
    !raw
    || raw.schemaVersion !== "velmere.public-audit-account-messages.v2"
    || raw.ok !== true
    || (raw.deliveryMode !== "durable" && raw.deliveryMode !== "ephemeral")
    || !Array.isArray(raw.messages)
  ) return null;

  const messages = raw.messages
    .map(parsePublicAuditMessage)
    .filter((message): message is AuditAccountMessageEnvelope => Boolean(message));
  if (messages.length !== raw.messages.length) return null;

  return {
    schemaVersion: "velmere.public-audit-account-messages.v2",
    ok: true,
    deliveryMode: raw.deliveryMode,
    messages,
  };
}

function isPaidAudit(message: AuditAccountMessageEnvelope) {
  const label = `${message.packageLabel ?? ""} ${message.reviewLevel ?? ""}`.toLowerCase();
  return /(^|[^a-z])(pro|advanced)([^a-z]|$)/u.test(label)
    || message.status === "payment_pending";
}

function hasImmutableCustomerSnapshot(message: AuditAccountMessageEnvelope) {
  return /^sha256:[a-f0-9]{64}$/iu.test(
    message.canonicalCustomerSnapshot?.snapshotDigest ?? "",
  );
}

function reportIsReady(message: AuditAccountMessageEnvelope) {
  return hasImmutableCustomerSnapshot(message)
    && (
      message.deliveryStatus === "ready_for_download"
      || message.customerStatus === "ready"
      || message.customerStatus === "delivered"
      || message.customerSafeReport?.status === "ready"
      || message.customerSafeReport?.status === "delivered"
    );
}

function hasCustomerSafeReceipt(message: AuditAccountMessageEnvelope) {
  return Boolean(
    message.deliveryReceipt?.receiptId
    && message.deliveryReceipt?.integrityToken
    && reportIsReady(message),
  );
}

function hasSecurePaidAuditPdfBinding(message: AuditAccountMessageEnvelope) {
  return isPaidAudit(message)
    && /^AUD-[A-Z0-9-]{6,32}$/u.test(message.auditReference?.toUpperCase() ?? "");
}

function customerReportRoute(message: AuditAccountMessageEnvelope, locale: string) {
  if (!hasImmutableCustomerSnapshot(message)) return "#";
  const provided = message.deliveryReceipt?.customerSafeLinks?.customerReportRoute
    ?? message.customerSafeReport?.publicReportRoute
    ?? message.publicReportRoute;
  if (provided?.startsWith("/")) return provided;
  const id = encodeURIComponent(message.id || message.requestId);
  return `/${locale}/security/audits/customer-report/${id}`;
}

function safePdfRoute(message: AuditAccountMessageEnvelope, locale: string) {
  if (!hasCustomerSafeReceipt(message) || isPaidAudit(message)) return "#";
  const provided = message.deliveryReceipt?.customerSafeLinks?.safePdfPacketRoute
    ?? message.customerSafeReport?.pdfRoute
    ?? message.pdfRoute;
  if (provided?.startsWith("/")) return provided;
  const id = encodeURIComponent(message.id || message.requestId);
  return `/api/security/audit-watch/customer-safe-report?id=${id}&locale=${locale}&format=pdf-safe`;
}

function deliveryReceiptRoute(message: AuditAccountMessageEnvelope, locale: string) {
  const receiptId = encodeURIComponent(message.deliveryReceipt?.receiptId || "missing");
  return `/${locale}/security/audits/delivery-receipt/${receiptId}`;
}

function supportHandoffRoute(message: AuditAccountMessageEnvelope, locale: string) {
  const receiptId = encodeURIComponent(message.deliveryReceipt?.receiptId || "missing");
  return `/${locale}/security/audits/support-handoff/${receiptId}`;
}

function paidAccessState(message: AuditAccountMessageEnvelope) {
  const state = `${message.deliveryReceipt?.status ?? ""} ${message.deliveryStatus ?? ""} ${message.customerStatus ?? ""} ${message.status ?? ""}`.toLowerCase();
  if (state.includes("chargeback") || state.includes("dispute")) return "chargeback";
  if (state.includes("refund")) return "refunded";
  if (state.includes("revoked") || state.includes("expired")) return "revoked";
  if (hasCustomerSafeReceipt(message)) return "verified";
  return "pending";
}

function statusTone(done: boolean) {
  return done
    ? "border-emerald-300/[0.14] bg-emerald-300/[0.04] text-emerald-100"
    : "border-white/[0.10] bg-white/[0.025] text-white/[0.46]";
}

function truncate(value: string | undefined, max = 50) {
  if (!value) return "—";
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

export default function AuditAccountMessagesClient() {
  const locale = resolveLocale(useLocale());
  const t = copy[locale];
  const [messages, setMessages] = useState<AuditAccountMessageEnvelope[]>([]);
  const [deliveryMode, setDeliveryMode] = useState<PublicAuditDeliveryMode>("ephemeral");
  const [paidPdfState, setPaidPdfState] = useState<Record<string, { state: PaidPdfUiState; error?: string }>>({});

  useEffect(() => {
    let disposed = false;
    const refresh = () => {
      void fetch(`/api/account/audit-messages?locale=${locale}&limit=24`, {
        cache: "no-store",
        credentials: "same-origin",
      })
        .then((response) => response.ok
          ? readJsonResponseBounded<unknown>(response, 2 * 1024 * 1024)
          : null)
        .then((value) => {
          const payload = parseAuditMessagesApiResponse(value);
          if (disposed || !payload) return;
          setMessages(payload.messages);
          setDeliveryMode(payload.deliveryMode);
        })
        .catch(() => undefined);
    };

    refresh();
    window.addEventListener("velmere:audit-message", refresh as EventListener);
    const interval = window.setInterval(refresh, 15_000);
    return () => {
      disposed = true;
      window.clearInterval(interval);
      window.removeEventListener("velmere:audit-message", refresh as EventListener);
    };
  }, [locale]);

  const setPdfState = (messageId: string, state: PaidPdfUiState, error?: string) => {
    setPaidPdfState((previous) => ({ ...previous, [messageId]: { state, error } }));
  };

  const downloadSecurePaidAuditPdf = async (message: AuditAccountMessageEnvelope) => {
    const messageId = message.id || message.requestId;
    const auditCaseRef = message.auditReference?.toUpperCase() ?? "";
    if (!hasCustomerSafeReceipt(message)) {
      setPdfState(messageId, "error", "customer_safe_receipt_required");
      return;
    }
    if (!hasSecurePaidAuditPdfBinding(message)) {
      setPdfState(messageId, "error", "paid_audit_case_binding_required");
      return;
    }
    if (["issuing", "verifying"].includes(paidPdfState[messageId]?.state ?? "")) return;

    try {
      setPdfState(messageId, "issuing");
      const tokenResponse = await fetch("/api/security/audit-watch/pro-pdf/token", {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({ auditCaseRef, locale }),
      });
      const tokenPayload = await readJsonResponseBounded<unknown>(tokenResponse, 512 * 1024).catch(() => null);
      const issued = parsePaidAuditPdfTokenEnvelope(tokenPayload);
      if (!tokenResponse.ok || !issued || issued.reportBinding.auditCaseRef !== auditCaseRef) {
        throw new Error(
          tokenPayload && typeof tokenPayload === "object" && "error" in tokenPayload && typeof tokenPayload.error === "string"
            ? tokenPayload.error
            : "paid_audit_pdf_token_invalid",
        );
      }

      const safePath = assertSameOriginPaidAuditPdfPath(issued.downloadPath, window.location.origin);
      if (!safePath) throw new Error("paid_audit_pdf_download_path_invalid");

      setPdfState(messageId, "verifying");
      const pdfResponse = await fetch(safePath, {
        method: "GET",
        credentials: "same-origin",
        cache: "no-store",
        headers: { authorization: `Bearer ${issued.token}`, accept: "application/pdf" },
      });
      if (!pdfResponse.ok) {
        const failure = await readJsonResponseBounded<unknown>(pdfResponse, 256 * 1024).catch(() => null);
        throw new Error(
          failure && typeof failure === "object" && "error" in failure && typeof failure.error === "string"
            ? failure.error
            : "paid_audit_pdf_download_failed",
        );
      }

      const declaredLength = Number(pdfResponse.headers.get("content-length") ?? "0");
      if (Number.isFinite(declaredLength) && declaredLength > PASS4808_MAX_PAID_AUDIT_PDF_BYTES) {
        throw new Error("paid_audit_pdf_too_large");
      }
      const bytes = new Uint8Array(await pdfResponse.arrayBuffer());
      const integrity = await verifyPaidAuditPdfBytes({
        bytes,
        expectedDigest: issued.canonicalPreview.expectedPdf.digest,
        expectedByteLength: issued.canonicalPreview.expectedPdf.byteLength,
        responseDigest: pdfResponse.headers.get("x-velmere-audit-pdf-digest"),
        contentType: pdfResponse.headers.get("content-type"),
      });
      if (!integrity.ok) throw new Error(integrity.error);

      const requestLabel = (message.requestId || issued.reportId || "velmere-audit")
        .replace(/[^a-zA-Z0-9_-]+/gu, "-")
        .slice(0, 80);
      triggerClientPdfDownload({
        bytes,
        filenameStem: `${requestLabel}-velmere-${issued.reportBinding.tier}-audit`,
      });
      setPdfState(messageId, "done");
    } catch (error) {
      setPdfState(
        messageId,
        "error",
        error instanceof Error ? error.message : "paid_audit_pdf_download_failed",
      );
    }
  };

  const handlePdfClick = (event: MouseEvent<HTMLAnchorElement>, message: AuditAccountMessageEnvelope) => {
    if (!hasCustomerSafeReceipt(message)) {
      event.preventDefault();
      return;
    }
    if (isPaidAudit(message)) {
      event.preventDefault();
      void downloadSecurePaidAuditPdf(message);
    }
  };

  return (
    <div
      className="mt-7 grid gap-4"
      data-audit-account-messages="customer-safe-v2"
      data-delivery-mode={deliveryMode}
    >
      <section className="rounded-2xl border border-cyan-200/[0.14] bg-cyan-200/[0.035] p-6">
        <div className="flex items-center gap-2 text-velmere-gold">
          <MessageSquareText className="h-5 w-5" />
          <p className="font-mono text-[10px] uppercase tracking-[0.2em]">{t.eyebrow}</p>
        </div>
        <h2 className="mt-4 text-3xl tracking-[-0.04em] text-white">{t.title}</h2>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-velmere-muted">{t.body}</p>
        <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-white/[0.10] bg-black/[0.18] px-3 py-2 font-mono text-[9px] uppercase tracking-[0.14em] text-white/[0.42]">
          {deliveryMode === "durable"
            ? <Database className="h-3.5 w-3.5 text-cyan-100" />
            : <RefreshCw className="h-3.5 w-3.5 text-white/[0.36]" />}
          {deliveryMode === "durable" ? t.durable : t.ephemeral}
        </div>
      </section>

      {messages.length === 0 ? (
        <div className="rounded-2xl border border-white/[0.10] bg-black/[0.20] p-6 text-sm text-velmere-muted">
          {t.empty}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {messages.map((message) => {
            const paidAudit = isPaidAudit(message);
            const ready = reportIsReady(message);
            const receiptReady = hasCustomerSafeReceipt(message);
            const pdfState = paidPdfState[message.id || message.requestId] ?? { state: "idle" as const };
            const pdfHref = paidAudit ? "#" : safePdfRoute(message, locale);
            const accessState = paidAccessState(message);
            const analysisReady = ["analysis_queue", "ready_for_download"].includes(message.deliveryStatus ?? "")
              || ["ready", "delivered"].includes(message.customerStatus ?? "");

            return (
              <article
                key={message.id}
                className="rounded-2xl border border-white/[0.10] bg-black/[0.20] p-5"
                data-audit-message-state={message.customerStatus ?? message.deliveryStatus ?? message.status}
              >
                <div className="flex items-center justify-between gap-3">
                  <FileSearch className="h-5 w-5 text-cyan-100" />
                  <span className="rounded-full border border-white/[0.10] bg-white/[0.025] px-3 py-1.5 font-mono text-[9px] uppercase tracking-[0.14em] text-white/[0.48]">
                    {message.packageLabel}
                  </span>
                </div>
                <h3 className="mt-4 text-xl font-semibold tracking-[-0.03em] text-white">{message.title}</h3>
                <p className="mt-3 text-sm leading-7 text-velmere-muted">{message.body}</p>

                <div className="mt-5 grid gap-2 md:grid-cols-3">
                  {[
                    { label: t.status, value: message.customerStatus ?? message.deliveryStatus ?? message.status },
                    { label: t.eta, value: message.eta },
                    { label: t.request, value: message.requestId },
                  ].map((row) => (
                    <div key={row.label} className="rounded-xl border border-white/[0.08] bg-white/[0.025] p-3">
                      <p className="font-mono text-[8px] uppercase tracking-[0.16em] text-white/[0.32]">{row.label}</p>
                      <p className="mt-1 truncate text-xs text-white/[0.68]">{row.value}</p>
                    </div>
                  ))}
                </div>

                <div className="mt-4 grid gap-2 md:grid-cols-3">
                  {[
                    { label: t.access, done: !paidAudit || accessState === "verified", value: paidAudit ? accessState : t.notRequired },
                    { label: t.analysis, done: analysisReady, value: analysisReady ? t.ready : t.waiting },
                    { label: t.report, done: ready, value: ready ? t.ready : t.waiting },
                  ].map((step) => (
                    <div key={step.label} className={`rounded-xl border p-3 ${statusTone(step.done)}`}>
                      <div className="flex items-center gap-2">
                        {step.done ? <CheckCircle2 className="h-4 w-4" /> : <RefreshCw className="h-4 w-4" />}
                        <p className="font-mono text-[8px] uppercase tracking-[0.16em]">{step.label}</p>
                      </div>
                      <p className="mt-2 truncate text-xs">{step.value}</p>
                    </div>
                  ))}
                </div>

                {message.customerSafeReport ? (
                  <section className="mt-4 rounded-xl border border-emerald-300/[0.14] bg-emerald-300/[0.045] p-4">
                    <div className="flex items-center gap-2 text-emerald-100">
                      <ShieldCheck className="h-4 w-4" />
                      <p className="font-mono text-[9px] uppercase tracking-[0.16em]">{t.reportSummary}</p>
                    </div>
                    <p className="mt-3 text-xs leading-6 text-white/[0.58]">
                      {message.customerSafeReport.summary ?? message.customerSafeReport.title}
                    </p>
                  </section>
                ) : null}

                {message.deliveryReceipt?.receiptId ? (
                  <section className="mt-4 rounded-xl border border-cyan-200/[0.14] bg-cyan-300/[0.035] p-4">
                    <div className="flex items-center gap-2 text-cyan-100">
                      <ReceiptText className="h-4 w-4" />
                      <p className="font-mono text-[9px] uppercase tracking-[0.16em]">{t.delivery}</p>
                    </div>
                    <div className="mt-3 grid gap-2 md:grid-cols-2">
                      <p className="truncate rounded-lg border border-white/[0.07] bg-black/[0.16] px-3 py-2 font-mono text-[9px] uppercase tracking-[0.12em] text-white/[0.42]">
                        {t.receipt}: {truncate(message.deliveryReceipt.receiptId)}
                      </p>
                      <p className="truncate rounded-lg border border-white/[0.07] bg-black/[0.16] px-3 py-2 font-mono text-[9px] uppercase tracking-[0.12em] text-white/[0.42]">
                        {t.integrity}: {truncate(message.deliveryReceipt.integrityToken)}
                      </p>
                      <p className="truncate rounded-lg border border-white/[0.07] bg-black/[0.16] px-3 py-2 font-mono text-[9px] uppercase tracking-[0.12em] text-white/[0.42] md:col-span-2">
                        {t.deliveredAt}: {message.deliveryReceipt.deliveredAt ?? "—"}
                      </p>
                    </div>
                  </section>
                ) : null}

                <p className="mt-4 text-[11px] leading-5 text-white/[0.46]">
                  {paidAudit ? t.secureDownload : receiptReady ? "" : t.unavailable}
                </p>
                {pdfState.state !== "idle" ? (
                  <p className={`mt-2 text-[11px] ${pdfState.state === "error" ? "text-rose-200" : "text-cyan-100"}`}>
                    {pdfState.state === "issuing" ? t.issuing
                      : pdfState.state === "verifying" ? t.verifying
                        : pdfState.state === "done" ? t.downloaded
                          : pdfState.error ?? t.unavailable}
                  </p>
                ) : null}

                <div className="mt-4 flex flex-wrap gap-2">
                  <a
                    href={pdfHref}
                    aria-disabled={!receiptReady}
                    tabIndex={receiptReady ? 0 : -1}
                    onClick={(event) => handlePdfClick(event, message)}
                    className="inline-flex items-center gap-2 rounded-full border border-white/[0.12] bg-black/[0.18] px-3 py-2 text-[10px] uppercase tracking-[0.12em] text-white/[0.66]"
                  >
                    <Download className="h-3.5 w-3.5" /> {t.safePdf}
                  </a>
                  <a
                    href={ready ? customerReportRoute(message, locale) : "#"}
                    aria-disabled={!ready}
                    tabIndex={ready ? 0 : -1}
                    onClick={(event) => { if (!ready) event.preventDefault(); }}
                    className="inline-flex items-center gap-2 rounded-full border border-white/[0.12] bg-black/[0.18] px-3 py-2 text-[10px] uppercase tracking-[0.12em] text-white/[0.66]"
                  >
                    <ExternalLink className="h-3.5 w-3.5" /> {t.customerReport}
                  </a>
                  {message.deliveryReceipt?.receiptId ? (
                    <>
                      <a
                        href={deliveryReceiptRoute(message, locale)}
                        className="inline-flex items-center gap-2 rounded-full border border-white/[0.12] bg-black/[0.18] px-3 py-2 text-[10px] uppercase tracking-[0.12em] text-white/[0.66]"
                      >
                        <ReceiptText className="h-3.5 w-3.5" /> {t.receipt}
                      </a>
                      <a
                        href={supportHandoffRoute(message, locale)}
                        className="inline-flex items-center gap-2 rounded-full border border-cyan-200/[0.14] bg-cyan-300/[0.045] px-3 py-2 text-[10px] uppercase tracking-[0.12em] text-cyan-100"
                      >
                        <LifeBuoy className="h-3.5 w-3.5" /> {t.support}
                      </a>
                    </>
                  ) : null}
                </div>

                {message.nextSteps.length > 0 ? (
                  <section className="mt-4 rounded-xl border border-velmere-gold/[0.12] bg-velmere-gold/[0.04] p-4">
                    <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-velmere-gold">{t.nextSteps}</p>
                    <div className="mt-3 grid gap-2">
                      {message.nextSteps.map((step) => (
                        <p key={step} className="text-xs leading-6 text-white/[0.54]">{step}</p>
                      ))}
                    </div>
                  </section>
                ) : null}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
