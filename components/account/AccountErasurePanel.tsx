"use client";

import { AlertTriangle, LoaderCircle, RotateCcw, UserRoundX } from "lucide-react";
import { useLocale } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { readJsonResponseBounded } from "@/lib/network/fetch-with-deadline";

type ErasureMetadata = {
  schemaVersion: "velmere.public-account-erasure-request.v1";
  requestId: string;
  status: "SESSION_REVOCATION_PENDING" | "POLICY_BLOCKED" | "CANCELLED";
  requestedAt: string;
  cancelledAt: string | null;
  export: { exportId: string; payloadSha256: string; generatedAt: string };
  sessionRevocation: "PENDING" | "CONFIRMED";
  executionEligible: false;
  executionBlocker: string;
  dataDeleted: false;
  legalDeletionClaimed: false;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SHA256 = /^sha256:[a-f0-9]{64}$/;

const copy = {
  en: {
    kicker: "Account lifecycle",
    title: "Account deletion request",
    body: "Create a private data export first. A request revokes your current session families, but it does not delete data until an owner/legal-approved retention and legal-hold policy exists.",
    noDelete: "No data deletion is currently executed or claimed.",
    request: "Request account deletion",
    confirm: "Confirm request and sign out",
    cancel: "Cancel request",
    working: "Securing request…",
    ready: "Request recorded. Sessions were revoked; deletion remains policy-blocked.",
    pending: "Request recorded, but complete session revocation still requires a retry after signing in again.",
    cancelled: "The deletion request is cancelled.",
    unavailable: "The request could not be completed. Create a current account export, sign in again, and retry.",
    blocker: "Current blocker",
    export: "Bound export",
  },
  pl: {
    kicker: "Cykl życia konta",
    title: "Wniosek o usunięcie konta",
    body: "Najpierw utwórz prywatny eksport danych. Wniosek unieważnia bieżące rodziny sesji, ale nie usuwa danych, dopóki nie istnieje zatwierdzona przez ownera i prawnika polityka retencji oraz legal hold.",
    noDelete: "Obecnie żadne dane nie są usuwane ani przedstawiane jako usunięte.",
    request: "Poproś o usunięcie konta",
    confirm: "Potwierdź wniosek i wyloguj",
    cancel: "Anuluj wniosek",
    working: "Zabezpieczam wniosek…",
    ready: "Wniosek zapisano. Sesje unieważniono; usunięcie pozostaje zablokowane polityką.",
    pending: "Wniosek zapisano, ale pełne unieważnienie sesji wymaga ponowienia po ponownym zalogowaniu.",
    cancelled: "Wniosek o usunięcie został anulowany.",
    unavailable: "Nie udało się zakończyć żądania. Utwórz aktualny eksport konta, zaloguj się ponownie i spróbuj jeszcze raz.",
    blocker: "Aktualny blocker",
    export: "Powiązany eksport",
  },
  de: {
    kicker: "Kontolebenszyklus",
    title: "Antrag auf Kontolöschung",
    body: "Erstelle zuerst einen privaten Datenexport. Der Antrag widerruft aktuelle Sitzungsfamilien, löscht aber keine Daten, solange keine von Owner und Rechtsprüfung freigegebene Aufbewahrungs- und Legal-Hold-Regel besteht.",
    noDelete: "Derzeit werden keine Daten gelöscht oder als gelöscht ausgewiesen.",
    request: "Kontolöschung anfordern",
    confirm: "Antrag bestätigen und abmelden",
    cancel: "Antrag stornieren",
    working: "Antrag wird gesichert…",
    ready: "Antrag gespeichert. Sitzungen wurden widerrufen; die Löschung bleibt richtlinienbedingt gesperrt.",
    pending: "Antrag gespeichert; der vollständige Sitzungswiderruf muss nach erneuter Anmeldung wiederholt werden.",
    cancelled: "Der Löschantrag wurde storniert.",
    unavailable: "Der Antrag konnte nicht abgeschlossen werden. Erstelle einen aktuellen Kontoexport, melde dich erneut an und versuche es wieder.",
    blocker: "Aktuelle Sperre",
    export: "Gebundener Export",
  },
} as const;

function parseMetadata(value: unknown): ErasureMetadata | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  const boundExport = row.export;
  if (!boundExport || typeof boundExport !== "object" || Array.isArray(boundExport)) return null;
  const exported = boundExport as Record<string, unknown>;
  if (row.schemaVersion !== "velmere.public-account-erasure-request.v1"
      || typeof row.requestId !== "string" || !UUID.test(row.requestId)
      || !["SESSION_REVOCATION_PENDING", "POLICY_BLOCKED", "CANCELLED"].includes(String(row.status))
      || typeof row.requestedAt !== "string" || !Number.isFinite(Date.parse(row.requestedAt))
      || (row.cancelledAt !== null && (typeof row.cancelledAt !== "string" || !Number.isFinite(Date.parse(row.cancelledAt))))
      || typeof exported.exportId !== "string" || !UUID.test(exported.exportId)
      || typeof exported.payloadSha256 !== "string" || !SHA256.test(exported.payloadSha256)
      || typeof exported.generatedAt !== "string" || !Number.isFinite(Date.parse(exported.generatedAt))
      || !["PENDING", "CONFIRMED"].includes(String(row.sessionRevocation))
      || row.executionEligible !== false
      || typeof row.executionBlocker !== "string" || row.executionBlocker.length > 80
      || row.dataDeleted !== false
      || row.legalDeletionClaimed !== false) return null;
  return row as unknown as ErasureMetadata;
}

export default function AccountErasurePanel() {
  const locale = useLocale();
  const t = copy[locale === "pl" || locale === "de" ? locale : "en"];
  const [status, setStatus] = useState<"loading" | "idle" | "confirm" | "working" | "ready" | "error">("loading");
  const [metadata, setMetadata] = useState<ErasureMetadata | null>(null);
  const requestKey = useRef<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 8_000);
    void fetch("/api/account/erasure", {
      credentials: "same-origin",
      signal: controller.signal,
      headers: { accept: "application/json" },
    }).then(async (response) => {
      if (response.status === 404) {
        setStatus("idle");
        return;
      }
      const parsed = response.ok ? parseMetadata(await readJsonResponseBounded<unknown>(response, 32 * 1024)) : null;
      if (!parsed) throw new Error("account_erasure_status_unavailable");
      setMetadata(parsed);
      setStatus("ready");
    }).catch(() => setStatus("idle")).finally(() => window.clearTimeout(timeout));
    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, []);

  async function post(body: Record<string, string>) {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 20_000);
    try {
      const response = await fetch("/api/account/erasure", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      const parsed = response.ok ? parseMetadata(await readJsonResponseBounded<unknown>(response, 32 * 1024)) : null;
      if (!parsed) throw new Error("account_erasure_unavailable");
      setMetadata(parsed);
      setStatus("ready");
    } catch {
      setStatus("error");
    } finally {
      window.clearTimeout(timeout);
    }
  }

  async function requestErasure() {
    if (status !== "confirm") {
      setStatus("confirm");
      return;
    }
    setStatus("working");
    if (!requestKey.current) requestKey.current = `account-erasure-${crypto.randomUUID()}`;
    await post({
      action: "request",
      idempotencyKey: requestKey.current,
      confirmation: "DELETE MY ACCOUNT",
    });
  }

  async function cancelErasure() {
    if (!metadata || metadata.status === "CANCELLED") return;
    setStatus("working");
    await post({
      action: "cancel",
      requestId: metadata.requestId,
      confirmation: "CANCEL ACCOUNT DELETION",
    });
  }

  const message = metadata?.status === "CANCELLED"
    ? t.cancelled
    : metadata?.status === "SESSION_REVOCATION_PENDING"
      ? t.pending
      : t.ready;

  return (
    <section className="rounded-2xl border border-red-300/[0.16] bg-red-300/[0.025] p-5 md:col-span-2" aria-labelledby="account-erasure-title">
      <div className="flex items-start gap-3">
        <UserRoundX className="mt-0.5 h-5 w-5 shrink-0 text-red-200" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-red-200">{t.kicker}</p>
          <h2 id="account-erasure-title" className="mt-3 text-2xl text-velmere-ivory">{t.title}</h2>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-velmere-muted">{t.body}</p>
          <p className="mt-3 flex max-w-3xl items-start gap-2 text-xs leading-6 text-amber-100">
            <AlertTriangle className="mt-1 h-3.5 w-3.5 shrink-0" aria-hidden="true" />{t.noDelete}
          </p>

          <div className="mt-5" aria-live="polite">
            {status === "ready" && metadata ? (
              <div className="rounded-xl border border-white/[0.10] bg-black/[0.16] p-4">
                <p className="text-sm leading-6 text-white/[0.72]">{message}</p>
                <dl className="mt-3 grid gap-2 font-mono text-[10px] text-white/[0.46]">
                  <div><dt className="inline text-white/[0.30]">{t.blocker}: </dt><dd className="inline break-all">{metadata.executionBlocker}</dd></div>
                  <div><dt className="inline text-white/[0.30]">{t.export}: </dt><dd className="inline break-all">{metadata.export.payloadSha256}</dd></div>
                </dl>
              </div>
            ) : null}
            {status === "confirm" ? <p className="text-sm leading-6 text-red-100">{t.noDelete} {t.confirm}</p> : null}
            {status === "error" ? <p className="text-sm leading-6 text-amber-100">{t.unavailable}</p> : null}
          </div>

          {metadata && metadata.status !== "CANCELLED" ? (
            <button type="button" onClick={() => { void cancelErasure(); }} disabled={status === "working"} className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-full border border-white/[0.14] px-5 font-mono text-[10px] uppercase tracking-[0.16em] text-white/[0.68] disabled:cursor-wait disabled:opacity-50">
              {status === "working" ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" /> : <RotateCcw className="h-4 w-4" aria-hidden="true" />}{t.cancel}
            </button>
          ) : !metadata ? (
            <button type="button" onClick={() => { void requestErasure(); }} disabled={status === "working" || status === "loading"} className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-full border border-red-300/[0.24] px-5 font-mono text-[10px] uppercase tracking-[0.16em] text-red-100 disabled:cursor-wait disabled:opacity-50">
              {status === "working" || status === "loading" ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" /> : <UserRoundX className="h-4 w-4" aria-hidden="true" />}
              {status === "working" || status === "loading" ? t.working : status === "confirm" ? t.confirm : t.request}
            </button>
          ) : null}
        </div>
      </div>
    </section>
  );
}
