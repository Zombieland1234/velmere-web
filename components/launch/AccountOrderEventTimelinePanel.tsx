import { CheckCircle2, Clock3, PackageCheck, ShieldAlert, WalletCards } from "lucide-react";

type Surface = "account" | "checkout" | "ops";

const copy = {
  pl: {
    eyebrow: "account / order event timeline",
    title: "Konto i zamówienie muszą mieć jedną czytelną oś zdarzeń.",
    body: "Ten panel pokazuje przyszły timeline: checkout, płatność, provider, wysyłka, zwrot i refund. Dopóki webhooki nie działają, klient nie powinien widzieć fałszywego statusu.",
    blocked: "blocked",
    review: "review",
    ready: "ready",
    next: "następny krok",
    rows: [
      ["checkout_started", "Koszyk i dane zamówienia", "Czeka na produkcyjny checkout event."],
      ["payment_confirmed", "Płatność potwierdzona", "Wymaga webhooka payment provider i receipt id."],
      ["provider_submitted", "Provider dostał zamówienie", "Wymaga Printful/Contrado/Tapstitch event id."],
      ["shipped", "Wysłane", "Wymaga carrier, tracking, destination i timestamp."],
      ["return_requested", "Zwrot", "Wymaga customer-safe reason i statusu return window."],
      ["refunded", "Refund", "Wymaga payment refund event i customer-safe export."],
    ],
  },
  de: {
    eyebrow: "account / order event timeline",
    title: "Account und Bestellung brauchen eine klare Ereignisachse.",
    body: "Dieses Panel zeigt die künftige Timeline: Checkout, Zahlung, Provider, Versand, Rückgabe und Refund. Ohne Webhooks darf der Kunde keinen falschen Status sehen.",
    blocked: "blocked",
    review: "review",
    ready: "ready",
    next: "nächster Schritt",
    rows: [
      ["checkout_started", "Warenkorb und Order-Daten", "Wartet auf Production Checkout Event."],
      ["payment_confirmed", "Zahlung bestätigt", "Benötigt Payment Provider Webhook und Receipt ID."],
      ["provider_submitted", "Provider erhielt Bestellung", "Benötigt Printful/Contrado/Tapstitch Event ID."],
      ["shipped", "Versendet", "Benötigt Carrier, Tracking, Destination und Timestamp."],
      ["return_requested", "Rückgabe", "Benötigt customer-safe Reason und Return Window Status."],
      ["refunded", "Refund", "Benötigt Payment Refund Event und customer-safe Export."],
    ],
  },
  en: {
    eyebrow: "account / order event timeline",
    title: "Account and order need one readable event timeline.",
    body: "This panel shows the future timeline: checkout, payment, provider, shipping, return and refund. Until webhooks work, customers should not see fake status.",
    blocked: "blocked",
    review: "review",
    ready: "ready",
    next: "next step",
    rows: [
      ["checkout_started", "Cart and order data", "Waiting for production checkout event."],
      ["payment_confirmed", "Payment confirmed", "Requires payment provider webhook and receipt id."],
      ["provider_submitted", "Provider received order", "Requires Printful/Contrado/Tapstitch event id."],
      ["shipped", "Shipped", "Requires carrier, tracking, destination and timestamp."],
      ["return_requested", "Return", "Requires customer-safe reason and return window status."],
      ["refunded", "Refund", "Requires payment refund event and customer-safe export."],
    ],
  },
} as const;

function localeCopy(locale: string) {
  if (locale === "pl" || locale === "de") return copy[locale];
  return copy.en;
}

function statusForIndex(index: number, surface: Surface) {
  if (surface === "checkout" && index === 0) return "review";
  if (index <= 1) return "blocked";
  return index <= 3 ? "review" : "blocked";
}

function iconForIndex(index: number) {
  if (index === 0) return WalletCards;
  if (index === 1) return CheckCircle2;
  if (index === 2) return PackageCheck;
  if (index === 3) return Clock3;
  return ShieldAlert;
}

export default function AccountOrderEventTimelinePanel({
  locale,
  surface = "account",
}: {
  locale: string;
  surface?: Surface;
}) {
  const t = localeCopy(locale);
  return (
    <section className="mx-auto max-w-7xl px-6 py-16 md:px-12">
      <div className="aoet-shell">
        <div className="grid gap-8 lg:grid-cols-[0.78fr_1.22fr] lg:items-start">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-velmere-gold">{t.eyebrow}</p>
            <h2 className="mt-5 font-serif text-4xl leading-none tracking-[-0.045em] text-white md:text-6xl">{t.title}</h2>
            <p className="mt-5 max-w-xl text-sm leading-7 text-white/[0.58]">{t.body}</p>
            <p className="mt-5 rounded-[1.25rem] border border-velmere-gold/[0.16] bg-velmere-gold/[0.055] p-4 text-xs leading-6 text-velmere-gold/[0.82]">
              {t.next}: webhook → storage adapter → customer-safe timeline → support export
            </p>
          </div>
          <div className="grid gap-3">
            {t.rows.map(([id, label, body], index) => {
              const status = statusForIndex(index, surface);
              const Icon = iconForIndex(index);
              return (
                <article key={id} className={`aoet-row aoet-row-${status}`}>
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/[0.10] bg-black/[0.24]">
                    <Icon className="h-4 w-4 text-velmere-gold" aria-hidden="true" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-white/[0.36]">{id}</p>
                      <span>{status === "review" ? t.review : t.blocked}</span>
                    </div>
                    <h3 className="mt-1 text-sm font-semibold text-white/[0.86]">{label}</h3>
                    <p className="mt-1 text-xs leading-6 text-white/[0.54]">{body}</p>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
