"use client";

import { Download, Eye, LoaderCircle, ShieldCheck } from "lucide-react";
import { useLocale } from "next-intl";
import { useRef, useState } from "react";
import { readJsonResponseBounded } from "@/lib/network/fetch-with-deadline";

type ExportMetadata = {
  schemaVersion: "velmere.public-account-data-export.v1";
  exportId: string;
  payloadSha256: string;
  byteLength: number;
  generatedAt: string;
  availableUntil: string;
  previewRoute: string;
  downloadRoute: string;
  legalDsrCompleteness: false;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DIGEST = /^sha256:[a-f0-9]{64}$/;

const copy = {
  en: {
    kicker: "Account data",
    title: "Private data export",
    body: "Create one account-bound JSON snapshot. Preview and download use the same stored bytes and expire after 24 hours.",
    request: "Create export",
    retry: "Retry request",
    working: "Preparing export…",
    ready: "Your private export is ready.",
    preview: "Preview exact JSON",
    download: "Download exact JSON",
    unavailable: "The export could not be prepared. Check the active verified session and try again.",
    legal: "This technical export does not claim legal DSAR completeness. Retention and legal scope still require the privacy review.",
    digest: "SHA-256",
    expires: "Available until",
  },
  pl: {
    kicker: "Dane konta",
    title: "Prywatny eksport danych",
    body: "Utwórz jeden snapshot JSON przypisany do konta. Podgląd i pobranie używają tych samych zapisanych bajtów i wygasają po 24 godzinach.",
    request: "Utwórz eksport",
    retry: "Ponów żądanie",
    working: "Przygotowuję eksport…",
    ready: "Prywatny eksport jest gotowy.",
    preview: "Podejrzyj dokładny JSON",
    download: "Pobierz dokładny JSON",
    unavailable: "Nie udało się przygotować eksportu. Sprawdź aktywną zweryfikowaną sesję i spróbuj ponownie.",
    legal: "To eksport techniczny, a nie deklaracja kompletności prawnej DSAR. Retencja i zakres prawny nadal wymagają przeglądu prywatności.",
    digest: "SHA-256",
    expires: "Dostępny do",
  },
  de: {
    kicker: "Kontodaten",
    title: "Privater Datenexport",
    body: "Erstelle einen kontogebundenen JSON-Snapshot. Vorschau und Download verwenden dieselben gespeicherten Bytes und laufen nach 24 Stunden ab.",
    request: "Export erstellen",
    retry: "Anfrage wiederholen",
    working: "Export wird vorbereitet…",
    ready: "Dein privater Export ist bereit.",
    preview: "Exaktes JSON ansehen",
    download: "Exaktes JSON laden",
    unavailable: "Der Export konnte nicht erstellt werden. Prüfe die aktive verifizierte Sitzung und versuche es erneut.",
    legal: "Dieser technische Export beansprucht keine rechtliche DSAR-Vollständigkeit. Aufbewahrung und Rechtsumfang benötigen weiterhin die Datenschutzprüfung.",
    digest: "SHA-256",
    expires: "Verfügbar bis",
  },
} as const;

function parseMetadata(value: unknown): ExportMetadata | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  if (row.schemaVersion !== "velmere.public-account-data-export.v1"
      || typeof row.exportId !== "string" || !UUID.test(row.exportId)
      || typeof row.payloadSha256 !== "string" || !DIGEST.test(row.payloadSha256)
      || !Number.isSafeInteger(row.byteLength) || Number(row.byteLength) < 2 || Number(row.byteLength) > 8 * 1024 * 1024
      || typeof row.generatedAt !== "string" || !Number.isFinite(Date.parse(row.generatedAt))
      || typeof row.availableUntil !== "string" || !Number.isFinite(Date.parse(row.availableUntil))
      || typeof row.previewRoute !== "string" || !row.previewRoute.startsWith("/api/account/data-export?")
      || typeof row.downloadRoute !== "string" || !row.downloadRoute.startsWith("/api/account/data-export?")
      || row.legalDsrCompleteness !== false) return null;
  return row as ExportMetadata;
}

export default function AccountDataExportPanel() {
  const locale = useLocale();
  const t = copy[locale === "pl" || locale === "de" ? locale : "en"];
  const [status, setStatus] = useState<"idle" | "working" | "error" | "ready">("idle");
  const [metadata, setMetadata] = useState<ExportMetadata | null>(null);
  const pendingIdempotencyKey = useRef<string | null>(null);

  async function requestExport() {
    if (status === "working") return;
    setStatus("working");
    setMetadata(null);
    try {
      if (!pendingIdempotencyKey.current) {
        pendingIdempotencyKey.current = `account-export-${crypto.randomUUID()}`;
      }
      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), 20_000);
      let response: Response;
      try {
        response = await fetch("/api/account/data-export", {
          method: "POST",
          credentials: "same-origin",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ idempotencyKey: pendingIdempotencyKey.current }),
          signal: controller.signal,
        });
      } finally {
        window.clearTimeout(timeout);
      }
      const payload = await readJsonResponseBounded<unknown>(response, 64 * 1024);
      const parsed = response.ok ? parseMetadata(payload) : null;
      if (!parsed) throw new Error("account_export_unavailable");
      pendingIdempotencyKey.current = null;
      setMetadata(parsed);
      setStatus("ready");
    } catch {
      // Keep the idempotency key after an uncertain network outcome. A retry
      // can recover the exact durable snapshot instead of creating a second one.
      setStatus("error");
    }
  }

  return (
    <section className="rounded-2xl border border-cyan-200/[0.16] bg-cyan-200/[0.035] p-5 md:col-span-2" aria-labelledby="account-data-export-title">
      <div className="flex items-start gap-3">
        <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-velmere-gold" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-velmere-gold">{t.kicker}</p>
          <h2 id="account-data-export-title" className="mt-3 text-2xl text-velmere-ivory">{t.title}</h2>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-velmere-muted">{t.body}</p>
          <p className="mt-3 max-w-3xl text-xs leading-6 text-white/[0.42]">{t.legal}</p>

          <div className="mt-5" aria-live="polite">
            {status === "ready" && metadata ? (
              <div className="rounded-xl border border-emerald-300/[0.16] bg-emerald-300/[0.035] p-4">
                <p className="text-sm text-emerald-100">{t.ready}</p>
                <dl className="mt-3 grid gap-2 font-mono text-[10px] text-white/[0.48]">
                  <div className="min-w-0"><dt className="inline text-white/[0.32]">{t.digest}: </dt><dd className="inline break-all">{metadata.payloadSha256}</dd></div>
                  <div><dt className="inline text-white/[0.32]">{t.expires}: </dt><dd className="inline">{new Date(metadata.availableUntil).toLocaleString(locale)}</dd></div>
                </dl>
                <div className="mt-4 flex flex-wrap gap-3">
                  <a href={metadata.previewRoute} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center gap-2 rounded-full border border-white/[0.14] px-4 font-mono text-[10px] uppercase tracking-[0.14em] text-white/[0.72]">
                    <Eye className="h-4 w-4" aria-hidden="true" />{t.preview}
                  </a>
                  <a href={metadata.downloadRoute} className="inline-flex min-h-11 items-center gap-2 rounded-full border border-velmere-gold/[0.28] px-4 font-mono text-[10px] uppercase tracking-[0.14em] text-velmere-gold">
                    <Download className="h-4 w-4" aria-hidden="true" />{t.download}
                  </a>
                </div>
              </div>
            ) : null}
            {status === "error" ? <p className="text-sm leading-6 text-amber-100">{t.unavailable}</p> : null}
          </div>

          <button type="button" onClick={requestExport} disabled={status === "working"} className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-full border border-white/[0.14] px-5 font-mono text-[10px] uppercase tracking-[0.16em] text-white/[0.72] disabled:cursor-wait disabled:opacity-50">
            {status === "working" ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Download className="h-4 w-4" aria-hidden="true" />}
            {status === "working" ? t.working : status === "error" ? t.retry : t.request}
          </button>
        </div>
      </div>
    </section>
  );
}
