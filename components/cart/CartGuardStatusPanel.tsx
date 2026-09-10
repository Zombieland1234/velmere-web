"use client";

import { AlertTriangle, CheckCircle2, Loader2, ShieldCheck } from "lucide-react";
import type { CartCheckoutGuardState } from "./useCartCheckoutGuard";

function copyFor(locale: string) {
  if (locale === "de") {
    return {
      checking: "Warenkorb wird serverseitig geprüft",
      allowedTitle: "Checkout bereit",
      allowedBody: "Alle Artikel wurden gegen öffentlichen Status, Variante, Preis, Bestand und Provider-Mapping geprüft.",
      blockedTitle: "Checkout blockiert",
      blockedBody: "Ein oder mehrere Artikel brauchen noch eine Korrektur, bevor Zahlung möglich ist.",
      errorTitle: "Checkout-Prüfung nicht verfügbar",
      errorBody: "Bitte prüfe den Warenkorb erneut. Zahlung bleibt blockiert, bis der Server die Artikel bestätigt.",
      emptyTitle: "Noch kein Artikel im Warenkorb",
      receipt: "Receipt",
      allowed: "frei",
      blocked: "blockiert",
      readthrough: "catalog",
    };
  }
  if (locale === "en") {
    return {
      checking: "Checking cart on the server",
      allowedTitle: "Checkout ready",
      allowedBody: "Every item was checked against public status, variant, price, stock and provider mapping.",
      blockedTitle: "Checkout blocked",
      blockedBody: "One or more items need a correction before payment can start.",
      errorTitle: "Checkout check unavailable",
      errorBody: "Please review the cart again. Payment stays blocked until the server confirms the items.",
      emptyTitle: "No item in the cart yet",
      receipt: "Receipt",
      allowed: "allowed",
      blocked: "blocked",
      readthrough: "catalog",
    };
  }
  return {
    checking: "Sprawdzam koszyk po stronie serwera",
    allowedTitle: "Checkout gotowy",
    allowedBody: "Każdy produkt został sprawdzony przez status publiczny, wariant, cenę, stock i provider mapping.",
    blockedTitle: "Checkout zablokowany",
    blockedBody: "Jeden lub kilka produktów wymaga poprawki przed płatnością.",
    errorTitle: "Nie mogę sprawdzić koszyka",
    errorBody: "Sprawdź koszyk ponownie. Płatność zostaje zablokowana, dopóki serwer nie potwierdzi produktów.",
    emptyTitle: "Brak produktu w koszyku",
    receipt: "Receipt",
    allowed: "gotowe",
    blocked: "blokady",
    readthrough: "catalog",
  };
}

export function CartGuardStatusPanel({
  guard,
  locale,
  compact = false,
}: {
  guard: CartCheckoutGuardState;
  locale: string;
  compact?: boolean;
}) {
  const copy = copyFor(locale);
  const blockedLines = guard.receipt?.lines.filter((line) => line.outcome === "blocked") ?? [];
  const allowed = guard.status === "allowed";
  const blocked = guard.status === "blocked";
  const checking = guard.status === "checking";
  const error = guard.status === "error";

  if (guard.status === "empty" || guard.status === "idle") {
    return compact ? null : (
      <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] px-4 py-3 text-[10px] text-white/[0.44]">
        {copy.emptyTitle}
      </div>
    );
  }

  const title = checking
    ? copy.checking
    : allowed
      ? copy.allowedTitle
      : blocked
        ? copy.blockedTitle
        : copy.errorTitle;
  const body = allowed ? copy.allowedBody : blocked ? copy.blockedBody : error ? copy.errorBody : "";

  return (
    <section
      className={`rounded-2xl border px-4 py-3 ${
        blocked || error
          ? "border-amber-200/[0.18] bg-amber-300/[0.055]"
          : allowed
            ? "border-emerald-200/[0.16] bg-emerald-300/[0.045]"
            : "border-cyan-200/[0.14] bg-cyan-300/[0.045]"
      }`}
      data-pass2053-cart-guard-panel={guard.status}
      aria-live="polite"
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/[0.08] bg-black/[0.22]">
          {checking ? (
            <Loader2 className="h-4 w-4 animate-spin text-cyan-100/[0.76]" aria-hidden="true" />
          ) : blocked || error ? (
            <AlertTriangle className="h-4 w-4 text-amber-100/[0.82]" aria-hidden="true" />
          ) : allowed ? (
            <CheckCircle2 className="h-4 w-4 text-emerald-100/[0.82]" aria-hidden="true" />
          ) : (
            <ShieldCheck className="h-4 w-4 text-white/[0.58]" aria-hidden="true" />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-white/[0.72]">{title}</p>
          {!compact && body ? <p className="mt-2 text-xs leading-5 text-white/[0.52]">{body}</p> : null}
          {guard.receipt ? (
            <div className="mt-3 flex flex-wrap gap-2 font-mono text-[8px] uppercase tracking-[0.14em] text-white/[0.42]">
              <span className="rounded-full border border-white/[0.07] bg-black/[0.16] px-2.5 py-1">
                {copy.allowed}: {guard.receipt.allowedCount}
              </span>
              <span className="rounded-full border border-white/[0.07] bg-black/[0.16] px-2.5 py-1">
                {copy.blocked}: {guard.receipt.blockedCount}
              </span>
              <span className="rounded-full border border-white/[0.07] bg-black/[0.16] px-2.5 py-1">
                {copy.readthrough}: {guard.receipt.catalogReadthrough?.mode ?? "static"}
              </span>
              <span className="max-w-full truncate rounded-full border border-white/[0.07] bg-black/[0.16] px-2.5 py-1">
                {copy.receipt}: {guard.receipt.receiptId}
              </span>
            </div>
          ) : null}
          {blockedLines.length > 0 ? (
            <ul className="mt-3 grid gap-2 text-xs leading-5 text-white/[0.62]">
              {blockedLines.slice(0, compact ? 2 : 4).map((line) => (
                <li key={line.lineId} className="rounded-xl border border-amber-200/[0.12] bg-black/[0.16] px-3 py-2">
                  <span className="font-medium text-white/[0.74]">{line.title ?? line.productId}</span>
                  <span className="block text-white/[0.52]">{line.message}</span>
                </li>
              ))}
            </ul>
          ) : null}
          {guard.error && !guard.receipt ? (
            <p className="mt-2 break-words font-mono text-[9px] text-white/[0.48]">{guard.error}</p>
          ) : null}
        </div>
      </div>
    </section>
  );
}
