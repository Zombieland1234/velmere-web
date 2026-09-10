import type { Metadata } from "next";
import { ArrowRight, HelpCircle, MessageCircle, PackageCheck, RotateCcw, Truck } from "lucide-react";
import LuxurySection from "@/components/layout/LuxurySection";
import { Link } from "@/navigation";
import { buildVelmereMetadata } from "@/lib/seo/metadata";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return buildVelmereMetadata({
    locale,
    path: "/faq",
    title: "FAQ — Velmère",
    description: "Velmère answers for products, delivery, returns, accounts and optional VLM access.",
  });
}

export default async function FaqPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const copy = locale === "pl"
    ? {
        kicker: "Pomoc",
        title: "Najważniejsze odpowiedzi, bez szukania po całej stronie.",
        intro: "Wyjaśniamy architekturę Velmère Shield, linię dowodową audytów, zamówienia Atelier i dostęp VLM.",
        items: [
          ["Czym jest Velmère Shield i weryfikacja integralności?", "Velmère Shield to instytucjonalny terminal integralności rynkowej, który dostarcza analitykę wielu giełd w czasie rzeczywistym, weryfikację bezpieczeństwa smart kontraktów i kryptograficzną linię dowodową audytów bez fabrykowania danych."],
          ["Jak linia dowodowa (Audit Lineage) gwarantuje wiarygodność?", "Każdy audyt, hash bajtów kontraktu i wynik testów podatności są opatrzone niezmiennym skrótem SHA-256 oraz powiązane z publicznymi rejestrami on-chain i zweryfikowanymi repozytoriami."],
          ["Czy zakup w Atelier wymaga portfela Web3?", "Nie. Odzież i zamówienia w Atelier realizujesz tradycyjnymi metodami płatności. Portfel Web3 jest opcjonalny i nie blokuje realizacji zamówienia."],
          ["Kiedy produkty w Atelier stają się aktywne?", "Produkt staje się aktywny dopiero po pełnym potwierdzeniu zdjęć, wariantów, certyfikacji materiałów, kosztów dostawy i zasad zwrotu."],
          ["Gdzie zobaczę dokładny koszt dostawy i podatki?", "Pełny koszt i przewidywany termin doręczenia są prezentowane przed zatwierdzeniem płatności."],
          ["Jak działają zwroty i prawo odstąpienia?", "Warunki zwrotu są transparentnie opisane na karcie produktu i w regulaminie, gwarantując pełną ochronę praw konsumenta."],
          ["Czy dostęp VLM wiąże się z obietnicą finansową?", "Nie. VLM jest warstwą dostępu do zaawansowanych funkcji analitycznych i społeczności, bez obietnicy ceny, zysku, płynności czy notowań."],
        ],
        routes: [["Dostawa", "Sprawdź regiony i zasady."], ["Zwroty", "Zobacz warunki zwrotu."], ["Kontakt", "Napisz do wsparcia."]],
        cta: "Nadal potrzebujesz pomocy?",
        ctaBody: "Napisz jedną wiadomość z krótkim opisem sprawy. Bez haseł, seed phrase i danych płatniczych.",
        ctaButton: "Otwórz kontakt",
      }
    : locale === "de"
      ? {
          kicker: "Hilfe",
          title: "Die wichtigsten Antworten, ohne die ganze Seite zu durchsuchen.",
          intro: "Klar erklärt: Velmère Shield Marktintegrität, Audit-Linie, Atelier-Bestellungen und VLM-Zugang.",
          items: [
            ["Was ist Velmère Shield und Marktintegrität?", "Velmère Shield ist ein institutionelles Marktintegritäts- und Risikoterminal, das Multi-Venue-Echtzeitanalysen, deterministische Smart-Contract-Prüfungen und kryptografische Audit-Nachweise ohne Datenfabrication liefert."],
            ["Wie garantiert die Audit-Linie kryptografische Sicherheit?", "Jeder Audit-Bericht, Bytecode-Hash und jede Schwachstellenprüfung ist durch einen unveränderlichen SHA-256-Fingerprint mit verifizierbaren On-Chain- und Repository-Quellen verknüpft."],
            ["Brauche ich eine Web3-Wallet für Bestellungen im Atelier?", "Nein. Kleidung und Couture-Bestellungen funktionieren über reguläre Zahlungsmethoden. Eine Web3-Wallet ist optional und blockiert den Checkout niemals."],
            ["Wann sind Kollektionen im Atelier verfügbar?", "Ein Produkt geht erst live, wenn hochauflösende Bildnachweise, Materialzertifikate, Lieferzeiten und Rückgaberegeln vollständig validiert sind."],
            ["Wo sehe ich die Lieferkosten und Steuern?", "Alle Kosten und geschätzten Lieferzeiten werden vor der endgültigen Zahlung transparent aufgeführt."],
            ["Wie funktionieren Rückgaben?", "Die Rückgabebedingungen stehen auf der Produktseite und im Checkout und wahren alle gesetzlichen Verbraucherrechte."],
            ["Ist der VLM-Zugang ein Finanzinvestment?", "Nein. VLM ist eine Zugangsschicht für Analysetools und Community, ohne Gewinnversprechen, Preisprognosen oder Liquiditätszusagen."],
          ],
          routes: [["Lieferung", "Regionen und Regeln ansehen."], ["Rückgabe", "Rückgabebedingungen ansehen."], ["Kontakt", "Support anschreiben."]],
          cta: "Noch Hilfe nötig?",
          ctaBody: "Sende eine Nachricht mit kurzer Beschreibung. Keine Passwörter, Seed Phrase oder Zahlungsdaten.",
          ctaButton: "Kontakt öffnen",
        }
      : {
          kicker: "Help",
          title: "The essential answers, without searching the entire site.",
          intro: "A definitive guide to Velmère Shield market integrity, cryptographic lineage, Atelier couture, and VLM features.",
          items: [
            ["What is Velmère Shield and Market Integrity?", "Velmère Shield is an institutional market integrity and risk terminal providing real-time multi-venue market analytics, contract security verification, and cryptographic audit lineage without fabricating unverified data."],
            ["How does Audit Lineage ensure cryptographic proof?", "Every audit report, contract bytecode hash, and vulnerability check is linked with an immutable SHA-256 fingerprint and deterministic verification trails anchored to on-chain and verified sources."],
            ["Do I need a Web3 wallet to order from Atelier?", "No. Physical atelier garments and collections checkout using standard payment methods. A Web3 wallet is optional and never blocks checkout."],
            ["When do products become available?", "A product goes live only after images, variants, material certifications, delivery schedules, and return terms are fully confirmed."],
            ["Where will I see delivery costs and taxes?", "The full breakdown of delivery costs, taxes, and expected arrival appears before payment authorization."],
            ["How do returns and consumer rights work?", "Return conditions are clearly stated on the product page and checkout, preserving full consumer protection and withdrawal rights."],
            ["Is VLM an investment?", "No. VLM is strictly an access layer for advanced intelligence tools and community, without claims regarding price performance, profits, or liquidity."],
          ],
          routes: [["Delivery", "Review regions and rules."], ["Returns", "Read return conditions."], ["Contact", "Message support."]],
          cta: "Still need help?",
          ctaBody: "Send one message with a short description. Never include passwords, seed phrases or payment details.",
          ctaButton: "Open contact",
        };
  const routeIcons = [Truck, RotateCcw, MessageCircle];
  const routeHrefs = ["/shipping", "/returns", "/contact"] as const;

  return (
    <main
      className="velmere-public-page min-h-[100dvh] bg-velmere-black text-white"
    >
      <LuxurySection className="py-24 md:py-36">
        <section className="velmere-editorial-hero rounded-[2.3rem] border border-white/[0.09] bg-[#09090b]/[0.88] p-6 shadow-velmere-card md:p-10 lg:p-12">
          <div className="grid gap-10 lg:grid-cols-[minmax(0,1.05fr)_minmax(18rem,.62fr)]">
            <div>
              <p className="luxury-kicker text-velmere-gold/[0.82]">{copy.kicker}</p>
              <h1 className="mt-5 max-w-4xl font-serif text-5xl leading-[0.92] tracking-[-0.055em] md:text-7xl">{copy.title}</h1>
              <p className="mt-6 max-w-2xl text-sm leading-7 text-white/[0.58] md:text-base">{copy.intro}</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
              {copy.routes.map(([title, body], index) => {
                const Icon = routeIcons[index] ?? HelpCircle;
                return (
                  <Link key={title} href={routeHrefs[index]} className="velmere-faq-route group flex items-center gap-4 rounded-[1.25rem] border border-white/[0.08] bg-white/[0.025] p-4">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-velmere-gold/[0.14] bg-velmere-gold/[0.05]">
                      <Icon className="h-4 w-4 text-velmere-gold" aria-hidden="true" />
                    </span>
                    <span className="min-w-0">
                      <strong className="block text-sm text-white">{title}</strong>
                      <small className="mt-1 block text-xs text-white/[0.42]">{body}</small>
                    </span>
                    <ArrowRight className="ml-auto h-4 w-4 shrink-0 text-white/[0.24] transition-transform duration-300 group-hover:translate-x-1 group-hover:text-velmere-gold" aria-hidden="true" />
                  </Link>
                );
              })}
            </div>
          </div>
        </section>

        <section className="mx-auto mt-6 max-w-5xl">
          <div className="grid gap-3">
            {copy.items.map(([question, answer], index) => (
              <details key={question} className="velmere-faq-item pass2007-faq-item group border-t border-white/[0.08] first:border-t-0">
                <summary className="flex cursor-pointer list-none items-center gap-4 px-5 py-5 md:px-6">
                  <span className="font-mono text-[9px] text-cyan-100/[0.68]">{String(index + 1).padStart(2, "0")}</span>
                  <h2 className="min-w-0 flex-1 text-left text-sm font-semibold text-white md:text-base">{question}</h2>
                  <span className="velmere-faq-plus flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/[0.08] text-lg font-light text-white/[0.56]">+</span>
                </summary>
                <div className="border-t border-white/[0.07] px-5 py-5 md:px-6">
                  <p className="max-w-3xl text-sm leading-7 text-white/[0.56]">{answer}</p>
                </div>
              </details>
            ))}
          </div>
        </section>

        <section className="mx-auto mt-6 flex max-w-5xl flex-col gap-5 rounded-[1.7rem] border border-velmere-gold/[0.13] bg-velmere-gold/[0.04] p-6 md:flex-row md:items-center md:justify-between md:p-8">
          <div className="flex gap-4">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-velmere-gold/[0.14] bg-black/[0.15]">
              <PackageCheck className="h-5 w-5 text-velmere-gold" aria-hidden="true" />
            </span>
            <div>
              <h2 className="text-base font-semibold text-white">{copy.cta}</h2>
              <p className="mt-2 max-w-2xl text-xs leading-6 text-white/[0.50]">{copy.ctaBody}</p>
            </div>
          </div>
          <Link href="/contact" className="velmere-button-primary shrink-0">{copy.ctaButton}</Link>
        </section>
      </LuxurySection>
    </main>
  );
}
