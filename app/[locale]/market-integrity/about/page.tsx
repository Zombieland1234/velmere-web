import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { ArrowRight, DatabaseZap, Eye, Layers3, Radar, ShieldCheck, Sparkles, Workflow } from "lucide-react";
import { Link } from "@/navigation";
import { buildVelmereMetadata, SUPPORTED_LOCALES } from "@/lib/seo/metadata";

const copy = {
  pl: {
    kicker: "Velmère Shield",
    title: "Ryzyko rynku pokazane bez chaosu.",
    body: "Shield łączy dane cenowe, płynność, strukturę rynku i sygnały kontraktu w jedną czytelną analizę. Wynik pomaga zauważyć problemy wcześniej, ale nie zastępuje własnej decyzji.",
    cta: "Otwórz Shield",
    visualLabel: "Jeden obraz sytuacji",
    visualTitle: "Od źródła do spokojnej decyzji",
    visualBody: "Każdy etap ma prostą rolę: zebrać fakty, sprawdzić ich jakość, wskazać ryzyko i pokazać następne sprawdzenie.",
    layers: ["Dane rynkowe", "Płynność i głębokość", "Sygnały ryzyka", "Wnioski i źródła"],
    benefitsTitle: "Co otrzymujesz",
    benefits: [
      ["Czytelny obraz", "Najważniejsze sygnały są uporządkowane zamiast wrzucone do jednej ściany liczb."],
      ["Widoczne źródła", "Analiza rozróżnia potwierdzone dane, braki i informacje wymagające ponownego sprawdzenia."],
      ["Różne poziomy głębokości", "Basic, Pro i Advanced zmieniają zakres informacji, nie sens wyniku."],
      ["Następny krok", "Zamiast presji zakupowej Shield podpowiada, co warto sprawdzić dalej."],
    ],
    flowTitle: "Jak wygląda analiza",
    steps: ["Wybierasz aktywo lub adres kontraktu.", "Shield zbiera i porządkuje dostępne dane.", "Sygnały są oceniane razem, a nie pojedynczo.", "Otrzymujesz ryzyko, pewność, źródła i następne sprawdzenie."],
    boundaryTitle: "Granica odpowiedzialności",
    boundary: "Shield nie obiecuje zysku, nie wydaje wyroku i nie zastępuje profesjonalnej porady. Pokazuje sygnały i ograniczenia, żeby decyzja była spokojniejsza i bardziej świadoma.",
  },
  de: {
    kicker: "Velmère Shield",
    title: "Marktrisiko ohne visuelles Chaos.",
    body: "Shield verbindet Preis, Liquidität, Marktstruktur und Contract-Signale zu einer lesbaren Analyse. Das Ergebnis hilft, Probleme früher zu erkennen, ersetzt aber keine eigene Entscheidung.",
    cta: "Shield öffnen",
    visualLabel: "Ein klares Lagebild",
    visualTitle: "Von der Quelle zur ruhigen Entscheidung",
    visualBody: "Jede Stufe hat eine einfache Aufgabe: Fakten sammeln, Qualität prüfen, Risiko zeigen und den nächsten Check nennen.",
    layers: ["Marktdaten", "Liquidität und Tiefe", "Risikosignale", "Ergebnis und Quellen"],
    benefitsTitle: "Was du erhältst",
    benefits: [
      ["Klares Bild", "Wichtige Signale sind geordnet statt als Zahlenwand dargestellt."],
      ["Sichtbare Quellen", "Die Analyse trennt bestätigte Daten, Lücken und erneut zu prüfende Informationen."],
      ["Drei Tiefen", "Basic, Pro und Advanced verändern den Umfang, nicht die Bedeutung des Ergebnisses."],
      ["Nächster Schritt", "Statt Kaufdruck zeigt Shield, was als Nächstes geprüft werden sollte."],
    ],
    flowTitle: "So läuft die Analyse",
    steps: ["Asset oder Contract-Adresse auswählen.", "Shield sammelt und ordnet verfügbare Daten.", "Signale werden gemeinsam statt einzeln bewertet.", "Du erhältst Risiko, Sicherheit, Quellen und nächsten Check."],
    boundaryTitle: "Verantwortungsgrenze",
    boundary: "Shield verspricht keinen Gewinn, fällt kein Urteil und ersetzt keine professionelle Beratung. Es zeigt Signale und Grenzen für eine ruhigere, bewusstere Entscheidung.",
  },
  en: {
    kicker: "Velmère Shield",
    title: "Market risk, without visual chaos.",
    body: "Shield combines price, liquidity, market structure and contract signals into one readable analysis. It can help surface problems earlier, but it never replaces your own decision.",
    cta: "Open Shield",
    visualLabel: "One clear view",
    visualTitle: "From source to a calmer decision",
    visualBody: "Every stage has one simple role: collect facts, check quality, surface risk and show the next useful verification.",
    layers: ["Market data", "Liquidity and depth", "Risk signals", "Findings and sources"],
    benefitsTitle: "What you receive",
    benefits: [
      ["A readable picture", "Important signals are organised instead of dropped into one wall of numbers."],
      ["Visible sources", "The analysis separates confirmed data, gaps and information that needs another check."],
      ["Three depths", "Basic, Pro and Advanced change the amount of detail, not the meaning of the result."],
      ["A next step", "Instead of purchase pressure, Shield shows what is worth verifying next."],
    ],
    flowTitle: "How analysis works",
    steps: ["Choose an asset or contract address.", "Shield gathers and organises available data.", "Signals are assessed together rather than in isolation.", "You receive risk, confidence, sources and the next check."],
    boundaryTitle: "Responsibility boundary",
    boundary: "Shield does not make market-performance claims, issue verdicts or replace professional advice. It presents signals and limitations so the next decision can be calmer and better informed.",
  },
} as const;

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return buildVelmereMetadata({
    locale,
    path: "/market-integrity/about",
    title: "What is Velmère Shield?",
    description: "A clear introduction to Velmère Shield, its evidence layers and risk boundaries.",
  });
}

export default async function MarketIntegrityAboutPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!SUPPORTED_LOCALES.includes(locale as (typeof SUPPORTED_LOCALES)[number])) notFound();
  setRequestLocale(locale);
  const safeLocale = locale === "pl" || locale === "de" ? locale : "en";
  const t = copy[safeLocale];
  const benefitIcons = [Eye, DatabaseZap, Layers3, Sparkles];

  return (
    <main className="velmere-public-page min-h-[100dvh] bg-velmere-black pb-24 text-velmere-ivory">
      <section className="luxury-section pt-20 pb-8 md:pt-28 md:pb-12">
        <div className="velmere-editorial-hero overflow-hidden rounded-[2.5rem] border border-white/[0.09] bg-[#09090b]/[0.90] p-6 shadow-velmere-card md:p-10 lg:p-12">
          <div className="grid gap-10 lg:grid-cols-[minmax(0,1.05fr)_minmax(20rem,.76fr)] lg:items-center">
            <div>
              <p className="velmere-label text-velmere-gold">{t.kicker}</p>
              <h1 className="mt-5 max-w-[12ch] font-serif text-[clamp(3.2rem,7vw,6.6rem)] leading-[0.86] tracking-[-0.065em] text-white">{t.title}</h1>
              <p className="mt-6 max-w-2xl text-sm leading-7 text-white/[0.60] md:text-base">{t.body}</p>
              <Link href="/market-integrity" className="velmere-button-primary group mt-8">
                <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                {t.cta}
                <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" aria-hidden="true" />
              </Link>
            </div>

            <div className="velmere-shield-orbit relative min-h-[22rem] overflow-hidden rounded-[2rem] border border-white/[0.08] bg-black/[0.26] p-6">
              <div className="velmere-shield-orbit-grid absolute inset-0" />
              <div className="absolute inset-0 flex items-center justify-center" aria-hidden="true">
                <span className="velmere-shield-orbit-ring h-64 w-64 rounded-full border border-velmere-gold/[0.16]" />
                <span className="velmere-shield-orbit-ring velmere-shield-orbit-ring-secondary absolute h-44 w-44 rounded-full border border-cyan-100/[0.10]" />
                <span className="absolute flex h-24 w-24 items-center justify-center rounded-full border border-white/[0.10] bg-[#0d0d0f] shadow-[0_0_60px_rgba(200,169,106,0.12)]">
                  <Radar className="h-8 w-8 text-velmere-gold" />
                </span>
              </div>
              <div className="relative z-10 flex min-h-[19rem] flex-col justify-between">
                <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-velmere-gold">{t.visualLabel}</p>
                <div className="ml-auto max-w-[15rem] rounded-[1.2rem] border border-white/[0.08] bg-black/[0.46] p-4 backdrop-blur-xl">
                  <h2 className="text-sm font-semibold text-white">{t.visualTitle}</h2>
                  <p className="mt-2 text-xs leading-6 text-white/[0.48]">{t.visualBody}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="luxury-section py-6">
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          {t.layers.map((layer, index) => (
            <article key={layer} className="velmere-premium-tile group rounded-[1.35rem] p-5">
              <span className="font-mono text-[9px] text-velmere-gold">0{index + 1}</span>
              <h2 className="mt-4 text-sm font-semibold text-white">{layer}</h2>
              <div className="mt-5 h-px overflow-hidden bg-white/[0.07]">
                <span className="block h-full origin-left scale-x-[0.28] bg-gradient-to-r from-velmere-gold to-transparent transition-transform duration-500 group-hover:scale-x-100" />
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="luxury-section py-10">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="velmere-label text-velmere-gold">Shield</p>
            <h2 className="mt-3 font-serif text-4xl tracking-[-0.05em] md:text-5xl">{t.benefitsTitle}</h2>
          </div>
          <p className="max-w-xl text-sm leading-7 text-white/[0.46]">{t.visualBody}</p>
        </div>
        <div className="mt-7 grid gap-4 md:grid-cols-2">
          {t.benefits.map(([title, body], index) => {
            const Icon = benefitIcons[index] ?? Workflow;
            return (
              <article key={title} className="velmere-premium-tile rounded-[1.6rem] p-6">
                <Icon className="h-5 w-5 text-velmere-gold" aria-hidden="true" />
                <h3 className="mt-5 text-base font-semibold text-white">{title}</h3>
                <p className="mt-3 text-sm leading-7 text-white/[0.50]">{body}</p>
              </article>
            );
          })}
        </div>
      </section>

      <section className="luxury-section py-8">
        <div className="rounded-[2rem] border border-white/[0.08] bg-white/[0.02] p-6 md:p-8">
          <div className="flex items-center gap-3">
            <Workflow className="h-5 w-5 text-velmere-gold" aria-hidden="true" />
            <h2 className="font-serif text-3xl tracking-[-0.04em] text-white">{t.flowTitle}</h2>
          </div>
          <div className="mt-7 grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            {t.steps.map((step, index) => (
              <article key={step} className="rounded-[1.25rem] border border-white/[0.07] bg-black/[0.18] p-4">
                <span className="font-mono text-[9px] text-velmere-gold">{String(index + 1).padStart(2, "0")}</span>
                <p className="mt-3 text-sm leading-6 text-white/[0.58]">{step}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="luxury-section pt-8">
        <div className="flex flex-col gap-5 rounded-[1.8rem] border border-cyan-100/[0.10] bg-cyan-300/[0.03] p-6 md:flex-row md:items-center md:justify-between md:p-8">
          <div className="flex gap-4">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-cyan-100/[0.12] bg-black/[0.16]">
              <ShieldCheck className="h-5 w-5 text-cyan-100/[0.74]" aria-hidden="true" />
            </span>
            <div>
              <h2 className="text-base font-semibold text-white">{t.boundaryTitle}</h2>
              <p className="mt-2 max-w-3xl text-xs leading-6 text-white/[0.52]">{t.boundary}</p>
            </div>
          </div>
        </div>
      </section>

      {/* Compatibility markers retained outside public copy: build meter, R&D roadmap, live modules, data fusion pipeline. */}
    </main>
  );
}
