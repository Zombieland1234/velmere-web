"use client";

import Image from "next/image";
import { ArrowUpRight } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/navigation";
import {
  formatMoney,
  getLocalizedString,
  getProducts,
  isProductCustomerPurchasable,
} from "@/lib/products/catalog";

export default function LuxuryProductCarousel() {
  const t = useTranslations("LuxuryProductCarousel");
  const locale = useLocale();
  const products = getProducts().slice(0, 4);

  if (products.length === 0) return null;

  return (
    <section className="py-10 md:py-16">
      <div className="mb-7 flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
        <div className="max-w-2xl">
          <p className="velmere-label text-velmere-gold">{t("kicker")}</p>
          <h2 className="mt-4 font-serif text-4xl leading-[0.96] tracking-[-0.04em] text-velmere-ivory md:text-6xl">
            {t("title")}
          </h2>
          <p className="mt-4 text-sm leading-7 text-white/[0.52]">
            {locale === "pl"
              ? "Najpierw ubrania, później system. Ta sekcja ma sprzedawać sylwetki, nie komplikować decyzję."
              : locale === "de"
                ? "Zuerst die Kleidung, dann das System. Diese Sektion sollte Silhouetten verkaufen, nicht Entscheidungen verkomplizieren."
                : "Garments first, systems second. This section should sell silhouettes, not add friction to the decision."}
          </p>
        </div>
        <Link href="/shop" className="velmere-button-secondary w-fit">
          {locale === "pl"
            ? "Zobacz sklep"
            : locale === "de"
              ? "Shop ansehen"
              : "View shop"}{" "}
          <ArrowUpRight className="h-4 w-4" />
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {products.map((product, index) => {
          const purchasable = isProductCustomerPurchasable(product);
          const title = getLocalizedString(product.title, locale);
          const shortDescription = getLocalizedString(product.shortDescription, locale);
          return (
            <Link
              key={product.id}
              href={`/shop/${product.slug}`}
              className="group overflow-hidden rounded-[1.75rem] border border-white/[0.10] bg-[#111113] shadow-velmere-card transition duration-500 hover:-translate-y-1 hover:border-velmere-gold/[0.26] hover:bg-[#151518] active:scale-[0.99]"
            >
              <div className="relative aspect-[4/5] overflow-hidden bg-white">
                <Image
                  src={product.images[0].url}
                  alt={getLocalizedString(product.images[0].alt, locale)}
                  fill
                  sizes="(min-width:1280px) 25vw, (min-width:768px) 50vw, 100vw"
                  className="object-contain object-center p-4 contrast-105 transition duration-700 group-hover:scale-[1.025] group-hover:brightness-110"
                  priority={index === 0}
                />
                <div className="pointer-events-none absolute inset-x-4 top-4 flex items-center justify-between gap-3">
                  <span className="rounded-full border border-white/[0.12] bg-black/[0.34] px-3 py-1 font-mono text-[9px] uppercase tracking-[0.16em] text-white/[0.64] backdrop-blur-xl">
                    {purchasable
                      ? locale === "pl"
                        ? "Dostępne"
                        : locale === "de"
                          ? "Verfügbar"
                          : "Available"
                      : t("comingSoon")}
                  </span>
                  <span className="rounded-full border border-velmere-gold/[0.25] bg-velmere-gold/[0.10] px-3 py-1 font-mono text-[9px] uppercase tracking-[0.16em] text-velmere-gold">
                    0{index + 1}
                  </span>
                </div>
              </div>
              <div className="p-5 md:p-6">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-velmere-gold/[0.75]">
                    {product.collection === "new-drop"
                      ? locale === "pl"
                        ? "Pierwszy drop"
                        : locale === "de"
                          ? "Erster Drop"
                          : "First drop"
                      : product.collection ?? t("collection")}
                  </p>
                  <span className="rounded-full border border-white/[0.08] bg-white/[0.03] px-2.5 py-1 font-mono text-[9px] uppercase tracking-[0.14em] text-white/[0.38]">
                    {locale === "pl"
                      ? "Zapowiedź"
                      : locale === "de"
                        ? "Vorschau"
                        : "Preview"}
                  </span>
                </div>
                <h3 className="mt-4 font-serif text-2xl leading-tight text-velmere-ivory md:text-3xl">
                  {title}
                </h3>
                <p className="mt-3 line-clamp-3 text-sm leading-7 text-velmere-muted">
                  {shortDescription}
                </p>
                <div className="mt-5 grid gap-3 rounded-[1.15rem] border border-white/[0.08] bg-black/[0.22] p-4">
                  <div className="flex items-center justify-between gap-4">
                    <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/[0.34]">
                      {locale === "pl"
                        ? "Cena startowa"
                        : locale === "de"
                          ? "Startpreis"
                          : "Starting price"}
                    </span>
                    <p className="font-mono text-sm tabular-nums text-velmere-gold">
                      {formatMoney(product.price, locale)}
                    </p>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/[0.34]">
                      {locale === "pl"
                        ? "Status"
                        : locale === "de"
                          ? "Status"
                          : "Status"}
                    </span>
                    <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/[0.60] group-hover:text-white/[0.78]">
                      {purchasable
                        ? locale === "pl"
                          ? "Gotowe do zakupu"
                          : locale === "de"
                            ? "Kaufbereit"
                            : "Purchasable"
                        : t("comingSoon")}
                    </span>
                  </div>
                </div>
                <div className="mt-4 flex items-center justify-between gap-4">
                  <span className="text-xs leading-6 text-white/[0.40]">
                    {shortDescription.slice(0, 42)}
                    {shortDescription.length > 42 ? "…" : ""}
                  </span>
                  <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/[0.46] group-hover:text-white/[0.70]">
                    {t("viewProduct")}
                  </span>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
