"use client";

import { ArrowLeft, Compass, Search } from "lucide-react";
import { useLocale } from "next-intl";
import { Link } from "@/navigation";

type NotFoundLocale = "pl" | "de" | "en";

const copy = {
  pl: {
    label: "404 · Velmère",
    title: "Ta ścieżka nie prowadzi do aktywnej strony.",
    body: "Wróć do głównej przestrzeni albo otwórz Lens, żeby rozpocząć od konkretnego wyszukiwania.",
    home: "Strona główna",
    lens: "Otwórz Lens",
  },
  de: {
    label: "404 · Velmère",
    title: "Dieser Pfad führt zu keiner aktiven Seite.",
    body: "Kehre zur Startseite zurück oder öffne Lens, um mit einer konkreten Suche zu beginnen.",
    home: "Startseite",
    lens: "Lens öffnen",
  },
  en: {
    label: "404 · Velmère",
    title: "This path does not lead to an active page.",
    body: "Return to the main space or open Lens to begin with a focused search.",
    home: "Home",
    lens: "Open Lens",
  },
} as const;

export default function LocaleNotFound() {
  const locale = useLocale();
  const safeLocale: NotFoundLocale = locale === "pl" || locale === "de" || locale === "en" ? locale : "en";
  const c = copy[safeLocale];

  return (
    <main
      className="velmere-public-page min-h-[100dvh] bg-velmere-black px-5 pb-24 pt-28 text-white md:px-10 md:pt-36"
    >
      <section className="mx-auto max-w-5xl">
        <div className="velmere-not-found pass2007-not-found-shell overflow-hidden rounded-[1.5rem] border border-white/[0.09] bg-[#090b0e] p-6 text-center shadow-velmere-card md:p-12">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full border border-cyan-200/[0.16] bg-cyan-300/[0.04]">
            <Compass className="h-7 w-7 text-cyan-100/[0.80]" aria-hidden="true" />
          </div>
          <p className="mt-8 font-mono text-[9px] uppercase tracking-[0.20em] text-cyan-100/[0.72]">{c.label}</p>
          <h1 className="mx-auto mt-4 max-w-3xl font-serif text-5xl leading-[0.92] tracking-[-0.055em] md:text-7xl">{c.title}</h1>
          <p className="mx-auto mt-6 max-w-xl text-sm leading-7 text-white/[0.54]">{c.body}</p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Link href="/" className="velmere-button-primary">
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              {c.home}
            </Link>
            <Link href="/search" className="velmere-button-secondary">
              <Search className="h-4 w-4" aria-hidden="true" />
              {c.lens}
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
