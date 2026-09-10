"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowRight, ArrowUpRight } from "lucide-react";
import { useLocale } from "next-intl";
import { Link } from "@/navigation";
import {
  formatMoney,
  getLocalizedString,
  getProducts,
} from "@/lib/products/catalog";

const copy = {
  en: {
    kicker: "Editorial focus",
    title: "One silhouette. One clear story.",
    body:
      "A large editorial frame below the carousel keeps the collection grounded in product, not just interface. Switch slides to preview the next hero story.",
    railTitle: "What this frame should do",
    railItems: [
      "Slow the page down after the grid.",
      "Keep the attention on one piece at a time.",
      "Bridge product and editorial mood without clutter.",
    ],
    cta: "Open product",
    slide: "Slide",
    previous: "Previous",
    next: "Next",
  },
  pl: {
    kicker: "Fokus redakcyjny",
    title: "Jedna sylwetka. Jedna czytelna historia.",
    body:
      "Duże zdjęcie pod karuzelą przywraca mocny fokus na ubrania. Możesz przełączać slajdy i od razu zobaczyć następną historię produktu.",
    railTitle: "Po co jest ta sekcja",
    railItems: [
      "Ma wyciszyć stronę po siatce produktów.",
      "Ma skupić uwagę na jednym produkcie naraz.",
      "Ma połączyć produkt z nastrojem redakcyjnym bez bałaganu.",
    ],
    cta: "Otwórz produkt",
    slide: "Slajd",
    previous: "Poprzedni",
    next: "Następny",
  },
  de: {
    kicker: "Redaktioneller Fokus",
    title: "Eine Silhouette. Eine klare Geschichte.",
    body:
      "Ein großes Editorial-Bild unter dem Karussell bringt den Fokus wieder auf das Produkt. Wechsle die Slides, um die nächste Produktgeschichte zu sehen.",
    railTitle: "Wofür dieser Block da ist",
    railItems: [
      "Er beruhigt die Seite nach dem Produktgitter.",
      "Er hält die Aufmerksamkeit jeweils auf einem Stück.",
      "Er verbindet Produkt und redaktionelle Stimmung ohne Unordnung.",
    ],
    cta: "Produkt öffnen",
    slide: "Folie",
    previous: "Zurück",
    next: "Weiter",
  },
} as const;

export default function EditorialFeatureSwitcher() {
  const locale = useLocale() as keyof typeof copy;
  const t = copy[locale] ?? copy.en;
  const products = useMemo(() => getProducts().slice(0, 4), []);
  const [activeIndex, setActiveIndex] = useState(0);

  if (!products.length) return null;

  const active = products[activeIndex % products.length];

  return (
    <section className="py-6 md:py-10">
      <div className="overflow-hidden rounded-[2rem] border border-white/[0.10] bg-[#111113] shadow-velmere-card">
        <div className="grid min-w-0 gap-0 lg:grid-cols-[1.08fr_0.92fr]">
          <div className="relative min-h-[22rem] min-w-0 overflow-hidden border-b border-white/[0.10] bg-black lg:min-h-[40rem] lg:border-b-0 lg:border-r">
            <AnimatePresence mode="wait">
              <motion.div
                key={active.id}
                initial={{ opacity: 0.16, scale: 1.035 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0.08, scale: 0.985 }}
                transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
                className="absolute inset-0"
              >
                <Image
                  src={active.images[0].url}
                  alt={getLocalizedString(active.images[0].alt, locale)}
                  fill
                  sizes="(min-width: 1024px) 60vw, 100vw"
                  className="object-contain object-center bg-white p-6 grayscale contrast-110"
                  priority
                />
                <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(0,0,0,0.06),rgba(0,0,0,0.28))]" />
              </motion.div>
            </AnimatePresence>
            <div className="pointer-events-none absolute inset-x-5 top-5 flex items-center justify-between gap-3 md:inset-x-6 md:top-6">
              <span className="rounded-full border border-white/[0.12] bg-black/[0.35] px-3 py-1 font-mono text-[9px] uppercase tracking-[0.16em] text-white/[0.65] backdrop-blur-xl">
                {active.collection ?? "Velmère"}
              </span>
              <span className="rounded-full border border-velmere-gold/[0.25] bg-velmere-gold/[0.10] px-3 py-1 font-mono text-[9px] uppercase tracking-[0.16em] text-velmere-gold">
                0{activeIndex + 1}
              </span>
            </div>
          </div>

          <div className="flex min-w-0 flex-col justify-between p-6 md:p-8 lg:p-10">
            <div>
              <p className="velmere-label text-velmere-gold">{t.kicker}</p>
              <h2 className="mt-5 max-w-[13ch] font-serif text-5xl leading-[0.94] tracking-[-0.05em] text-velmere-ivory md:text-6xl">
                {t.title}
              </h2>
              <p className="mt-5 max-w-xl text-sm leading-7 text-velmere-muted">
                {t.body}
              </p>
              <div className="mt-6 rounded-[1.5rem] border border-white/[0.10] bg-black/[0.24] p-5">
                <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-velmere-gold/[0.78]">
                  {t.railTitle}
                </p>
                <div className="mt-4 grid gap-3">
                  {t.railItems.map((item, index) => (
                    <div key={item} className="flex items-start gap-3">
                      <span className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.18em] text-white/[0.28]">
                        0{index + 1}
                      </span>
                      <p className="text-sm leading-6 text-white/[0.56]">{item}</p>
                    </div>
                  ))}
                </div>
              </div>

              <AnimatePresence mode="wait">
                <motion.div
                  key={active.id + "-content"}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                  className="mt-8 rounded-[1.5rem] border border-white/[0.10] bg-black/[0.24] p-5"
                >
                  <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-velmere-gold/[0.75]">
                    {active.collection ?? "Velmère"}
                  </p>
                  <h3 className="mt-4 font-serif text-3xl leading-tight text-velmere-ivory md:text-4xl">
                    {getLocalizedString(active.title, locale)}
                  </h3>
                  <p className="mt-4 text-sm leading-7 text-white/[0.62]">
                    {getLocalizedString(active.shortDescription, locale)}
                  </p>
                  <div className="mt-5 flex flex-wrap items-center gap-4">
                    <p className="font-mono text-sm text-velmere-gold">
                      {formatMoney(active.price, locale)}
                    </p>
                    <Link href={`/shop/${active.slug}`} className="velmere-button-secondary w-fit">
                      {t.cta} <ArrowUpRight className="h-4 w-4" />
                    </Link>
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>

            <div className="mt-8 flex flex-wrap items-center justify-between gap-4">
              <div className="flex gap-0.5">
                {products.map((product, index) => (
                  <button
                    key={product.id}
                    type="button"
                    aria-label={`${t.slide} ${index + 1}`}
                    aria-pressed={index === activeIndex}
                    onClick={() => setActiveIndex(index)}
                    className="grid h-11 w-11 shrink-0 place-items-center rounded-full transition hover:bg-white/[0.035] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-velmere-gold/[0.28]"
                  >
                    <span
                      className={`block h-2.5 rounded-full transition-all ${index === activeIndex ? "w-10 bg-velmere-gold" : "w-2.5 bg-white/[0.22]"}`}
                      aria-hidden="true"
                    />
                  </button>
                ))}
              </div>
              <div className="ml-auto flex gap-2">
                <button
                  type="button"
                  onClick={() => setActiveIndex((current) => (current - 1 + products.length) % products.length)}
                  className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/[0.10] bg-white/[0.035] text-white/[0.56] transition hover:border-white/[0.22] hover:text-white active:scale-95"
                  aria-label={t.previous}
                >
                  <ArrowLeft className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setActiveIndex((current) => (current + 1) % products.length)}
                  className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-velmere-gold/[0.25] bg-velmere-gold/[0.10] text-velmere-gold transition hover:border-velmere-gold/[0.45] hover:bg-velmere-gold/[0.16] active:scale-95"
                  aria-label={t.next}
                >
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
