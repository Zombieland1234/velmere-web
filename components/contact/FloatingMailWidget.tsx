"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle2, Mail, Paperclip, Send, ShieldCheck, X } from "lucide-react";
import { useLocale } from "next-intl";
import { DrawerRoot } from "@/components/ui/OverlayPrimitives";
import { readJsonResponseBounded } from "@/lib/network/fetch-with-deadline";

const copy = {
  en: {
    chip: "Mail",
    title: "Send a private note",
    intro: "Orders, legal questions, security reports and collaboration files.",
    name: "Name / handle",
    email: "Email (optional)",
    subject: "Subject",
    message: "Message",
    file: "Attach file",
    send: "Send note",
    sending: "Sending…",
    delivered: "Delivered",
    deliveredMessage: "Delivery was confirmed.",
    queued: "Queued",
    queuedMessage: "The mail provider accepted the message for delivery. Delivery is not confirmed yet.",
    preview: "Preview only",
    previewMessage: "The message was validated locally but was not sent.",
    blocked: "Attachment blocked",
    blockedMessage: "File delivery is unavailable until independent malware scanning, CDR and private quarantine are connected.",
    seal: "Seal",
    flight: "Flight",
    error: "Message could not be sent. Try again.",
    note: "Never send seed phrases, private keys or wallet recovery data.",
    close: "Close private message",
  },
  pl: {
    chip: "Mail",
    title: "Wyślij prywatną wiadomość",
    intro:
      "Zamówienia, kwestie prawne, zgłoszenia bezpieczeństwa i współpraca.",
    name: "Imię / handle",
    email: "E-mail (opcjonalnie)",
    subject: "Tytuł",
    message: "Wiadomość",
    file: "Załącz plik",
    send: "Wyślij wiadomość",
    sending: "Wysyłanie…",
    delivered: "Dostarczono",
    deliveredMessage: "Dostarczenie zostało potwierdzone.",
    queued: "W kolejce",
    queuedMessage: "Provider pocztowy przyjął wiadomość do wysłania. Dostarczenie nie jest jeszcze potwierdzone.",
    preview: "Tylko podgląd",
    previewMessage: "Wiadomość została sprawdzona lokalnie, ale nie została wysłana.",
    blocked: "Załącznik zablokowany",
    blockedMessage: "Wysyłka plików pozostaje niedostępna do czasu podłączenia niezależnego skanowania malware, CDR i prywatnej kwarantanny.",
    seal: "Pieczęć",
    flight: "Wysyłka",
    error: "Nie udało się wysłać wiadomości. Spróbuj ponownie.",
    note: "Nigdy nie wysyłaj seed phrase, kluczy prywatnych ani danych odzyskiwania portfela.",
    close: "Zamknij prywatną wiadomość",
  },
  de: {
    chip: "Mail",
    title: "Private Nachricht senden",
    intro:
      "Bestellungen, rechtliche Fragen, Security Reports und Zusammenarbeit.",
    name: "Name / Handle",
    email: "E-Mail (optional)",
    subject: "Betreff",
    message: "Nachricht",
    file: "Datei anhängen",
    send: "Nachricht senden",
    sending: "Wird gesendet…",
    delivered: "Zugestellt",
    deliveredMessage: "Die Zustellung wurde bestätigt.",
    queued: "In Warteschlange",
    queuedMessage: "Der E-Mail-Provider hat die Nachricht zum Versand angenommen. Die Zustellung ist noch nicht bestätigt.",
    preview: "Nur Vorschau",
    previewMessage: "Die Nachricht wurde lokal geprüft, aber nicht versendet.",
    blocked: "Anhang blockiert",
    blockedMessage: "Der Dateiversand bleibt gesperrt, bis unabhängiger Malware-Scan, CDR und private Quarantäne angebunden sind.",
    seal: "Siegel",
    flight: "Versand",
    error: "Nachricht konnte nicht gesendet werden. Bitte erneut versuchen.",
    note: "Sende niemals Seed Phrases, Private Keys oder Wallet-Recovery-Daten.",
    close: "Private Nachricht schließen",
  },
} as const;

type ContactDeliveryUiState = "sent" | "queued" | "preview" | "blocked" | "error";

export function classifyContactDeliveryResponse(
  responseOk: boolean,
  payload: unknown,
): ContactDeliveryUiState {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return "error";
  const value = payload as Record<string, unknown>;
  if (
    value.state === "blocked"
    || value.deliveryMode === "blocked_external"
    || value.error === "contact_attachment_processing_unavailable"
  ) {
    return "blocked";
  }
  if (!responseOk || value.ok !== true) return "error";
  if (value.delivered === true) return "sent";
  if (value.queued === true && value.state === "queued") return "queued";
  if (value.delivered === false && value.state === "preview" && value.deliveryMode === "development_preview") {
    return "preview";
  }
  return "error";
}

export default function FloatingMailWidget() {
  const locale = useLocale() as keyof typeof copy;
  const t = copy[locale] ?? copy.en;
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<"idle" | "loading" | ContactDeliveryUiState>(
    "idle",
  );
  const [fileName, setFileName] = useState("");
  const [sendPhase, setSendPhase] = useState<"idle" | "seal" | "flight" | "delivered">("idle");
  const sendTimersRef = useRef<number[]>([]);
  const sendAbortRef = useRef<AbortController | null>(null);
  const sendRequestSeqRef = useRef(0);
  const maxAttachmentBytes = 4 * 1024 * 1024;

  const clearSendTimers = useCallback(() => {
    sendTimersRef.current.forEach((timer) => window.clearTimeout(timer));
    sendTimersRef.current = [];
  }, []);

  const abortActiveSend = useCallback(() => {
    sendRequestSeqRef.current += 1;
    sendAbortRef.current?.abort();
    sendAbortRef.current = null;
    clearSendTimers();
  }, [clearSendTimers]);

  useEffect(() => {
    return () => {
      abortActiveSend();
    };
  }, [abortActiveSend]);

  useEffect(() => {
    const openMail = () => {
      abortActiveSend();
      setStatus("idle");
      setSendPhase("idle");
      setOpen(true);
      if (typeof window !== "undefined") {
        window.requestAnimationFrame(() => setOpen(true));
      }
    };
    window.addEventListener("velmere:open-mail", openMail);
    return () => window.removeEventListener("velmere:open-mail", openMail);
  }, [abortActiveSend]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    abortActiveSend();
    const formElement = event.currentTarget;
    const requestId = sendRequestSeqRef.current + 1;
    sendRequestSeqRef.current = requestId;
    const controller = new AbortController();
    sendAbortRef.current = controller;
    setStatus("loading");
    setSendPhase("seal");
    sendTimersRef.current.push(
      window.setTimeout(() => {
        if (sendRequestSeqRef.current === requestId && !controller.signal.aborted) {
          setSendPhase("flight");
        }
      }, 220),
    );
    const form = new FormData(formElement);
    try {
      const response = await fetch("/api/contact/message", {
        method: "POST",
        body: form,
        signal: controller.signal,
        headers: { "x-velmere-client-request-id": `contact-${requestId}` },
      });
      if (controller.signal.aborted || sendRequestSeqRef.current !== requestId) return;
      const payload: unknown = await readJsonResponseBounded<unknown>(response, 256 * 1024, { operation: "contact_message_response" }).catch(() => null);
      const deliveryState = classifyContactDeliveryResponse(response.ok, payload);
      if (deliveryState === "error") throw new Error("contact_failed");
      setSendPhase(deliveryState === "sent" ? "delivered" : "idle");
      setStatus(deliveryState);
      if (deliveryState !== "blocked") {
        formElement.reset();
        setFileName("");
      }
    } catch {
      if (controller.signal.aborted || sendRequestSeqRef.current !== requestId) return;
      setSendPhase("idle");
      setStatus("error");
    } finally {
      if (sendRequestSeqRef.current === requestId) {
        sendAbortRef.current = null;
      }
    }
  }

  return (
    <DrawerRoot
      open={open}
      onClose={() => { abortActiveSend(); setOpen(false); }}
      closeLabel={t.close}
      ariaLabelledBy="velmere-private-mail-title"
      ariaLabel={t.title}
      motionPreset="right"
      motionDuration={0.14}
      lockScroll={true}
      surfaceId="velmere-private-mail-drawer"
      surfaceClassName="velmere-command-shell velmere-side-drawer-panel velmere-private-mail-drawer velmere-private-mail-drawer-pass2184 fixed bottom-4 right-4 top-4 flex w-[min(33rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-[1.35rem] text-velmere-ivory sm:w-[min(31rem,calc(100vw-2rem))]"
      surfaceData={{ surface: "private-mail", pass1975: "header-mail-hard-open", pass1976: "visible-mail-drawer", pass2005: "solid-owned-scroll-file-guard", pass2201: "send-envelope-delivered-animation", pass2204: "premium-envelope-flight-delivered-timeline" }}
    >
      <div className="velmere-dialog-header flex shrink-0 items-start justify-between gap-4 border-b border-white/[0.08] px-5 py-5 sm:px-6">
        <div className="min-w-0">
          <p className="velmere-label inline-flex items-center gap-2 text-velmere-gold">
            <Mail className="h-4 w-4" aria-hidden="true" />
            {t.chip}
          </p>
          <h2
            id="velmere-private-mail-title"
            className="mt-2 font-serif text-2xl leading-tight text-white sm:text-3xl"
          >
            {t.title}
          </h2>
          <p className="mt-2 max-w-md text-xs leading-6 text-white/[0.46]">
            {t.intro}
          </p>
        </div>
        <button
          type="button"
          onPointerDown={(event) => { event.preventDefault(); abortActiveSend(); setOpen(false); }}
          onClick={() => { abortActiveSend(); setOpen(false); }}
          className="velmere-command-pill velmere-interaction-pulse grid h-11 w-11 shrink-0 place-items-center px-0 text-white/[0.55] hover:text-white"
          aria-label={t.close}
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      <form
        onSubmit={submit}
        data-modal-scroll-region="true"
        className="luxury-scrollbar grid min-h-0 flex-1 gap-3 overflow-y-auto overscroll-contain px-5 py-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:px-6 sm:py-6"
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <input name="name" placeholder={t.name} className="velmere-field" />
          <input
            name="email"
            type="email"
            placeholder={t.email}
            className="velmere-field"
          />
        </div>
        <input
          name="subject"
          required
          placeholder={t.subject}
          className="velmere-field"
        />
        <textarea
          name="message"
          required
          placeholder={t.message}
          className="velmere-field min-h-40 resize-y leading-7"
        />

        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
          <label className="velmere-command-pill velmere-interaction-pulse inline-flex min-h-12 cursor-pointer justify-start overflow-hidden px-4 text-[10px] text-white/[0.55]">
            <Paperclip className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span className="truncate">{fileName || t.file}</span>
            <input
              name="attachment"
              type="file"
              className="sr-only"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file && file.size > maxAttachmentBytes) {
                  event.currentTarget.value = "";
                  setFileName("");
                  setStatus("error");
                  return;
                }
                setStatus("idle");
                setFileName(file?.name ?? "");
              }}
            />
          </label>
          <button
            type="submit"
            disabled={status === "loading"}
            className="velmere-button-primary velmere-private-mail-submit velmere-private-mail-submit-pass2204 min-h-12 disabled:cursor-wait disabled:opacity-70"
            data-status={status}
            data-phase={sendPhase}
            data-pass2201-mail-send="envelope-flight"
            data-pass2204-mail-send="envelope-flight-delivered"
          >
            {status === "loading" ? (
              <span className="velmere-mail-send-flight" aria-hidden="true">
                <Mail className="h-4 w-4" />
                <span className="velmere-mail-send-flight__trail" />
              </span>
            ) : status === "sent" ? (
              <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
            ) : (
              <Send className="h-4 w-4" aria-hidden="true" />
            )}
            {status === "loading"
              ? t.sending
              : status === "sent"
                ? t.delivered
                : status === "queued"
                  ? t.queued
                  : status === "preview"
                    ? t.preview
                    : status === "blocked"
                      ? t.blocked
                      : t.send}
          </button>
        </div>

        <div className="velmere-mail-delivery-timeline-pass2204" data-phase={sendPhase} aria-live="polite" aria-atomic="true">
          {status === "loading" ? (
            <div className="velmere-mail-delivery-track-pass2204" aria-hidden="true">
              <span data-step={sendPhase === "seal" ? "active" : "done"}>{t.seal}</span>
              <span data-step={sendPhase === "flight" ? "active" : sendPhase === "delivered" ? "done" : "idle"}>{t.flight}</span>
              <span data-step={sendPhase === "delivered" ? "done" : "idle"}>{t.delivered}</span>
            </div>
          ) : null}
          {status === "sent" ? (
            <p className="velmere-status-note velmere-status-note-pass2201" data-tone="success" data-pass2201-mail-delivered="true">
              <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
              <span>{t.deliveredMessage}</span>
            </p>
          ) : null}
          {status === "queued" ? (
            <p className="velmere-status-note" data-tone="neutral">
              {t.queuedMessage}
            </p>
          ) : null}
          {status === "preview" ? (
            <p className="velmere-status-note" data-tone="neutral">
              {t.previewMessage}
            </p>
          ) : null}
          {status === "blocked" ? (
            <p className="velmere-status-note" data-tone="danger">
              {t.blockedMessage}
            </p>
          ) : null}
          {status === "error" ? (
            <p className="velmere-status-note" data-tone="danger">
              {t.error}
            </p>
          ) : null}
        </div>

        <p className="velmere-form-note">
          <ShieldCheck
            className="mt-0.5 h-4 w-4 shrink-0 text-velmere-gold"
            aria-hidden="true"
          />
          <span>{t.note}</span>
        </p>
      </form>
    </DrawerRoot>
  );
}
