import type { Metadata } from "next";
import VelmereSquareClient from "@/components/square/VelmereSquareClient";
import { buildVelmereMetadata } from "@/lib/seo/metadata";
import { Sparkles, ArrowLeft, Shield } from "lucide-react";
import Link from "next/link";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const description = locale === "pl"
    ? "Publicznie czytelna przestrzeń Velmère Square; przestrzeń społecznościowa już wkrótce."
    : locale === "de"
      ? "Velmère Square Community Space; demnächst verfügbar."
      : "Velmère Square community space; coming soon.";
  return buildVelmereMetadata({
    locale,
    path: "/square",
    title: "Velmère Square — Coming Soon",
    description,
  });
}

export default async function SquarePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const copy = {
    pl: {
      badge: "WARSTWA SPOŁECZNOŚCI · ZAUFANE SYGNAŁY",
      title: "VELMÈRE SQUARE",
      status: "COMING SOON",
      subtitle: "Prywatna przestrzeń wymiany analiz, notatek i sygnałów memberów Velmère zostanie uruchomiona po zakończeniu pełnego audytu warstwy zaufania. Funkcja pozostaje świadomie wyłączona w tym buildzie.",
      note: "Doświadczenie Square nie jest wymagane do zakupów w Atelier ani korzystania z narzędzi Shield.",
      backHome: "Wróć do strony głównej",
      exploreShieldMap: "Przejdź do Shield Map",
    },
    de: {
      badge: "COMMUNITY LAYER · TRUST SIGNALS",
      title: "VELMÈRE SQUARE",
      status: "COMING SOON",
      subtitle: "Der private Bereich für Member-Analysen, Notizen und Signale wird nach Abschluss des Sicherheitsaudits freigeschaltet. Diese Funktion ist in diesem Build bewusst noch nicht aktiv.",
      note: "Square ist weder für Einkäufe im Atelier noch für die Shield-Analyse erforderlich.",
      backHome: "Zurück zur Startseite",
      exploreShieldMap: "Zu Shield Map",
    },
    en: {
      badge: "COMMUNITY LAYER · TRUST SIGNALS",
      title: "VELMÈRE SQUARE",
      status: "COMING SOON",
      subtitle: "The private member space for research notes, signals and community exchange will open once trust layer audits are fully verified. This feature is intentionally pending activation.",
      note: "Square access is never a requirement for Atelier purchases or Shield intelligence tools.",
      backHome: "Back to Home",
      exploreShieldMap: "Go to Shield Map",
    },
  }[locale as "pl" | "de" | "en"] || {
    badge: "COMMUNITY LAYER · TRUST SIGNALS",
    title: "VELMÈRE SQUARE",
    status: "COMING SOON",
    subtitle: "The private member space for research notes, signals and community exchange will open soon.",
    note: "Square access is never a requirement for Atelier purchases or Shield intelligence tools.",
    backHome: "Back to Home",
    exploreShieldMap: "Go to Shield Map",
  };

  return (
    <div className="relative min-h-[100dvh] h-screen w-full overflow-hidden bg-[#060709]">
      {/* Blurred background showing the actual Square structure */}
      <div className="pointer-events-none select-none filter blur-xl opacity-30 scale-105 transition-all duration-700 absolute inset-0 overflow-hidden" aria-hidden="true">
        <VelmereSquareClient publicTrim="pass315" />
      </div>

      {/* Dark overlay backdrop */}
      <div className="absolute inset-0 z-20 bg-black/60 backdrop-blur-2xl" />

      {/* Central luxury Coming Soon card */}
      <main className="relative z-30 flex h-full min-h-screen items-center justify-center p-4 sm:p-6">
        <div className="velmere-command-shell relative w-full max-w-xl overflow-hidden rounded-[2.2rem] border border-white/10 bg-[#080b0f]/[0.96] p-8 text-center shadow-[0_30px_100px_rgba(0,0,0,0.85)] sm:p-12">
          {/* Subtle gold decorative glow */}
          <div className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 h-48 w-80 rounded-full bg-velmere-gold/15 blur-3xl" />

          <div className="relative z-10 space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-velmere-gold/30 bg-velmere-gold/10 px-4 py-1.5 text-[10px] font-mono uppercase tracking-[0.20em] text-velmere-gold shadow-[0_0_25px_rgba(212,175,55,0.15)]">
              <Sparkles className="h-3.5 w-3.5" />
              <span>{copy.badge}</span>
            </div>

            <div>
              <h1 className="font-serif text-4xl sm:text-5xl font-medium tracking-tight text-white">
                {copy.title}
              </h1>
              <div className="mt-2.5 inline-block rounded-full border border-white/10 bg-white/5 px-3 py-1 font-mono text-[11px] uppercase tracking-[0.25em] text-cyan-200/80">
                {copy.status}
              </div>
            </div>

            <p className="text-sm sm:text-base leading-relaxed text-white/70 max-w-md mx-auto">
              {copy.subtitle}
            </p>

            <p className="font-mono text-[11px] leading-normal text-white/40 max-w-sm mx-auto">
              {copy.note}
            </p>

            <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link
                href={`/${locale}`}
                className="velmere-button-primary w-full sm:w-auto text-[11px] py-3.5 px-6"
              >
                <ArrowLeft className="h-4 w-4 mr-1.5" />
                {copy.backHome}
              </Link>
              <Link
                href={`/${locale}/shield-map`}
                className="velmere-button-secondary w-full sm:w-auto text-[11px] py-3.5 px-6"
              >
                <Shield className="h-4 w-4 mr-1.5 text-velmere-gold" />
                {copy.exploreShieldMap}
              </Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
