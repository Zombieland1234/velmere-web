import { LifeBuoy, Mail, MessageCircle, ShieldCheck } from "lucide-react";
import { Link } from "@/navigation";

export default async function ContactPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const copy = {
    en: {
      kicker: "Contact",
      title: "One clear route to the right help.",
      body: "Product questions, order support and account access belong in one calm place. Do not send passwords, private keys or payment secrets.",
      emailLabel: "Primary inbox",
      email: "velmere141@gmail.com",
      emailBody: "Oficjalny adres do korespondencji i wsparcia klienta Velmère. Każde zgłoszenie jest rejestrowane i weryfikowane przez zespół.",
      response: "What to include",
      responseItems: ["A short description", "Order number when available", "Screenshots without sensitive data"],
      securityTitle: "Security before speed",
      securityBody: "Velmère will never ask for a seed phrase, private key or remote access to your device.",
      securityCta: "Review security",
      routes: [["Products", "Sizing, material and availability."], ["Orders", "Delivery, returns and order status."], ["Account", "Sign-in and access questions."]],
    },
    pl: {
      kicker: "Kontakt",
      title: "Jedna prosta droga do właściwej pomocy.",
      body: "Pytania o produkt, zamówienie i dostęp do konta trafiają w jedno spokojne miejsce. Nie wysyłaj haseł, kluczy prywatnych ani sekretów płatności.",
      emailLabel: "Główna skrzynka",
      email: "velmere141@gmail.com",
      emailBody: "Oficjalny adres do korespondencji i wsparcia klienta Velmère. Każde zgłoszenie jest rejestrowane i weryfikowane przez zespół.",
      response: "Co warto podać",
      responseItems: ["Krótki opis sprawy", "Numer zamówienia, jeśli istnieje", "Screeny bez wrażliwych danych"],
      securityTitle: "Bezpieczeństwo przed pośpiechem",
      securityBody: "Velmère nigdy nie poprosi o seed phrase, klucz prywatny ani zdalny dostęp do urządzenia.",
      securityCta: "Sprawdź bezpieczeństwo",
      routes: [["Produkty", "Rozmiar, materiał i dostępność."], ["Zamówienia", "Dostawa, zwroty i status."], ["Konto", "Logowanie i pytania o dostęp."]],
    },
    de: {
      kicker: "Kontakt",
      title: "Ein klarer Weg zur richtigen Hilfe.",
      body: "Produktfragen, Bestellhilfe und Account-Zugang gehören an einen ruhigen Ort. Sende keine Passwörter, Private Keys oder Zahlungsgeheimnisse.",
      emailLabel: "Zentrale Inbox",
      email: "velmere141@gmail.com",
      emailBody: "Oficjalny adres do korespondencji i wsparcia klienta Velmère. Każde zgłoszenie jest rejestrowane i weryfikowane przez zespół.",
      response: "Was du angeben solltest",
      responseItems: ["Kurze Beschreibung", "Bestellnummer, falls vorhanden", "Screenshots ohne sensible Daten"],
      securityTitle: "Sicherheit vor Tempo",
      securityBody: "Velmère fragt niemals nach Seed Phrase, Private Key oder Fernzugriff auf dein Gerät.",
      securityCta: "Sicherheit prüfen",
      routes: [["Produkte", "Größe, Material und Verfügbarkeit."], ["Bestellungen", "Lieferung, Rückgabe und Status."], ["Account", "Anmeldung und Zugangsfragen."]],
    },
  } as const;
  const c = copy[locale as keyof typeof copy] ?? copy.en;
  const routeIcons = [MessageCircle, LifeBuoy, ShieldCheck];

  return (
    <main
      className="velmere-public-page min-h-[100dvh] bg-velmere-black pb-20 pt-28 text-velmere-ivory md:pt-36"
      data-contact-intake="VERIFIED_ACTIVE"
    >
      <section className="luxury-section">
        <div className="velmere-editorial-hero overflow-hidden rounded-[2.4rem] border border-white/[0.09] bg-[#09090b]/[0.90] p-6 shadow-velmere-card md:p-10 lg:p-12">
          <div className="grid gap-10 lg:grid-cols-[minmax(0,1.12fr)_minmax(19rem,.72fr)] lg:items-start">
            <div>
              <p className="velmere-label text-velmere-gold">{c.kicker}</p>
              <h1 className="mt-5 max-w-4xl font-serif text-[clamp(3.1rem,7vw,6.4rem)] leading-[0.86] tracking-[-0.065em] text-white">{c.title}</h1>
              <p className="mt-6 max-w-2xl text-sm leading-7 text-white/[0.60] md:text-base">{c.body}</p>

              <div className="mt-9 grid gap-3 md:grid-cols-3">
                {c.routes.map(([title, body], index) => {
                  const Icon = routeIcons[index] ?? MessageCircle;
                  return (
                    <article key={title} className="velmere-premium-tile group rounded-[1.4rem] p-5">
                      <Icon className="h-5 w-5 text-velmere-gold" aria-hidden="true" />
                      <h2 className="mt-5 text-sm font-semibold text-white">{title}</h2>
                      <p className="mt-2 text-xs leading-6 text-white/[0.48]">{body}</p>
                    </article>
                  );
                })}
              </div>
            </div>

            <aside className="grid gap-4">
              <div className="velmere-contact-mail pass2007-contact-primary rounded-[1.5rem] border border-cyan-200/[0.14] bg-[#090b0e] p-6">
                <Mail className="h-5 w-5 text-cyan-100/[0.78]" aria-hidden="true" />
                <p className="mt-5 font-mono text-[9px] uppercase tracking-[0.18em] text-cyan-100/[0.72]">{c.emailLabel}</p>
                <p className="mt-3 block break-all text-xl text-amber-100">{c.email}</p>
                <p className="mt-3 text-xs leading-6 text-white/[0.52]">{c.emailBody}</p>
              </div>

              <div className="rounded-[1.7rem] border border-white/[0.08] bg-white/[0.025] p-6">
                <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-white/[0.40]">{c.response}</p>
                <div className="mt-4 grid gap-3">
                  {c.responseItems.map((item, index) => (
                    <div key={item} className="flex items-center gap-3 text-xs text-white/[0.60]">
                      <span className="flex h-7 w-7 items-center justify-center rounded-full border border-white/[0.08] bg-black/[0.18] font-mono text-[9px] text-velmere-gold">0{index + 1}</span>
                      {item}
                    </div>
                  ))}
                </div>
              </div>
            </aside>
          </div>
        </div>

        <section className="mt-5 flex flex-col gap-5 rounded-[1.8rem] border border-cyan-200/[0.10] bg-cyan-300/[0.035] p-6 md:flex-row md:items-center md:justify-between md:p-8">
          <div className="flex gap-4">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-cyan-100/[0.13] bg-black/[0.16]">
              <ShieldCheck className="h-5 w-5 text-cyan-100/[0.78]" aria-hidden="true" />
            </span>
            <div>
              <h2 className="text-base font-semibold text-white">{c.securityTitle}</h2>
              <p className="mt-2 max-w-2xl text-xs leading-6 text-white/[0.52]">{c.securityBody}</p>
            </div>
          </div>
          <Link href="/security" className="velmere-button-secondary shrink-0">
            {c.securityCta}
          </Link>
        </section>
      </section>
    </main>
  );
}
