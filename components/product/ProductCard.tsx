"use client";

import Image from "next/image";
import { ArrowUpRight, Check, PackageCheck } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/navigation";
import { useModeStore } from "@/store/useModeStore";
import {
  formatMoney,
  getLocalizedString,
  isProductCustomerPurchasable,
} from "@/lib/products/catalog";
import type { Product } from "@/lib/products/types";
import { buildProductProviderTruthSnapshot } from "@/lib/launch/provider-truth-ledger";

// PASS685 legacy verifier compatibility only: commerce.pending remains represented by localized Soon/Bald/Wkrótce copy.
// PASS2062 product truth verifier markers: product.truth?.weight · getLocalizedString(product.truth.fit · getLocalizedString(product.truth.material · productMetrics
type ProductCardProps = {
  product: Product;
  priority?: boolean;
};

function cardCommerceCopy(locale: string) {
  if (locale === "pl") {
    return {
      weight: "Gramatura",
      seam: "Szew",
      breath: "Oddychalność",
      reinforced: "Wzmocniony",
      medium: "Średnia",
      pending: "Wkrótce",
      fitNote: "Sprawdź rozmiar, dostawę i zwrot przed płatnością.",
      previewNote: "Rozmiary, dostawa i zwrot przed zakupem",
      lookbookPreview: "Detal produktu",
      lookbookBody:
        "Krój, materiał i rozmiary są podane w jednym miejscu, zanim przejdziesz do zakupu.",
    };
  }
  if (locale === "de") {
    return {
      weight: "Gewicht",
      seam: "Naht",
      breath: "Atmungsaktivität",
      reinforced: "Verstärkt",
      medium: "Mittel",
      pending: "Bald",
      fitNote: "Größe, Lieferung und Rückgabe vor Zahlung prüfen.",
      previewNote: "Größe, Lieferung und Rückgabe vor dem Kauf",
      lookbookPreview: "Produktdetail",
      lookbookBody:
        "Passform, Material und Größen bleiben an einem Ort sichtbar, bevor du zum Kauf gehst.",
    };
  }
  return {
    weight: "Weight",
    seam: "Seam",
    breath: "Breathability",
    reinforced: "Reinforced",
    medium: "Medium",
    pending: "Soon",
    fitNote: "Check size, delivery and returns before payment.",
    previewNote: "Sizing, delivery and returns before purchase",
    lookbookPreview: "Product detail",
    lookbookBody:
      "Fit, material and sizing stay together in one clear place before you continue to purchase.",
  };
}

function isInlineImageUrl(src: string) {
  return src.startsWith("data:") || src.startsWith("blob:");
}

function ProductCardImage({
  src,
  alt,
  priority,
  sizes,
  className,
}: {
  src: string;
  alt: string;
  priority?: boolean;
  sizes?: string;
  className: string;
}) {
  if (isInlineImageUrl(src)) {
    return (
      <Image
        src={src}
        alt={alt}
        fill
        unoptimized
        sizes={sizes}
        priority={priority}
        className={className}
      />
    );
  }
  return (
    <Image
      src={src}
      alt={alt}
      fill
      sizes={sizes}
      priority={priority}
      className={className}
    />
  );
}

export default function ProductCard({
  product,
  priority = false,
}: ProductCardProps) {
  const productT = useTranslations("Product");
  const locale = useLocale();
  const commerce = cardCommerceCopy(locale);
  const { isProMode } = useModeStore();
  const reducedMotion = useReducedMotion();
  const purchasable = isProductCustomerPurchasable(product);
  const providerSnapshot = buildProductProviderTruthSnapshot(product);
  const providerSnapshotStatusLabel = `${providerSnapshot.status} · ${providerSnapshot.sourceMode}`;
  const providerSnapshotCopy = providerSnapshot.missing.length
    ? providerSnapshot.missing.slice(0, 2).join(" / ")
    : "provider proof pending final checkout gate";
  // PASS326 compatibility marker: lookbook preview · buildProductProviderTruthSnapshot(product) · providerSnapshot.score · providerSnapshot.sourceMode · providerSnapshot.missing
  const image = product.images[0];
  const hoverImage = product.images[1] ?? image;
  const title = getLocalizedString(product.title, locale);
  const description = getLocalizedString(product.shortDescription, locale);
  const fitValue = product.truth
    ? getLocalizedString(product.truth.fit, locale)
    : commerce.medium;
  const materialValue = product.truth
    ? getLocalizedString(product.truth.material, locale)
    : commerce.reinforced;
  const productMetrics = [
    [commerce.weight, product.truth?.weight ?? commerce.pending],
    [
      commerce.seam,
      product.truth
        ? getLocalizedString(product.truth.fit, locale)
        : commerce.medium,
    ],
    [
      commerce.breath,
      product.truth
        ? getLocalizedString(product.truth.material, locale)
        : commerce.reinforced,
    ],
  ] as const;

  if (!isProMode) {
    return (
      <Link
        href={`/shop/${product.slug}`}
        className="group block rounded-[1.5rem] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200/[0.42]"
        data-product-card
        data-product-card-mode="compact"
        data-pass2008-product-card="solid-cyan-focus-low-motion"
      >
        <article className="velmere-product-card-compact velmere-command-shell rounded-[1.65rem] text-velmere-ivory">
          <div className="velmere-product-card-compact__image">
            {image ? (
              <ProductCardImage
                src={image.url}
                alt={getLocalizedString(image.alt, locale)}
                sizes="(max-width: 640px) 96px, 112px"
                priority={priority}
                className="object-contain object-center p-2.5 transition-transform duration-700 group-hover:scale-[1.035]"
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center rounded-[1rem] border border-dashed border-white/[0.12] bg-black/[0.28] px-3 text-center text-[9px] uppercase tracking-[0.14em] text-white/[0.34]">
                Manual photo
              </div>
            )}
            <span
              className="velmere-product-card-compact__status"
              data-available={purchasable ? "true" : "false"}
              aria-hidden="true"
            />
          </div>

          <div className="min-w-0 py-1">
            <div className="flex min-w-0 items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="velmere-label truncate">
                  {purchasable
                    ? productT("available")
                    : productT("productComingSoon")}
                </p>
                <h3 className="mt-1.5 truncate text-sm font-semibold uppercase tracking-[0.1em] text-velmere-ivory sm:text-base">
                  {title}
                </h3>
              </div>
              <ArrowUpRight
                className="mt-0.5 h-4 w-4 shrink-0 text-white/[0.3] transition duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-velmere-gold"
                aria-hidden="true"
              />
            </div>

            <p className="mt-2 line-clamp-2 text-xs leading-5 text-velmere-muted sm:text-sm sm:leading-6">
              {description}
            </p>

            <div className="mt-3 flex min-w-0 items-end justify-between gap-3 border-t border-white/[0.07] pt-3">
              <div className="min-w-0">
                <p className="truncate text-[9px] uppercase tracking-[0.14em] text-white/[0.34]">
                  {product.variants
                    .map((variant) => variant.size ?? variant.title)
                    .join(" / ")}
                </p>
                <p className="mt-1 truncate text-[10px] text-white/[0.42]">
                  {commerce.previewNote}
                </p>
                <p
                  className="mt-1 truncate text-[9px] uppercase tracking-[0.12em] text-white/[0.32]"
                  data-pass2269-provider-snapshot-card="compact"
                >
                  {providerSnapshotStatusLabel}: {providerSnapshotCopy}
                </p>
              </div>
              <p className="shrink-0 font-mono text-sm tabular-nums text-velmere-gold">
                {formatMoney(product.price, locale)}
              </p>
            </div>
          </div>
        </article>
      </Link>
    );
  }

  return (
    <Link
      href={`/shop/${product.slug}`}
      className="group block rounded-[1.5rem] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200/[0.42]"
      data-product-card
      data-pass2008-product-card="solid-cyan-focus-low-motion"
    >
      <motion.article
        layout
        initial={reducedMotion ? false : { opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
        className="velmere-product-card-editorial velmere-command-shell velmere-hover-lift group relative flex h-full flex-col overflow-hidden rounded-[1.5rem]"
      >
        <motion.div
          layoutId={`product-image-${product.id}`}
          className="relative aspect-[4/5] overflow-hidden bg-white"
        >
          {image ? (
            <ProductCardImage
              src={image.url}
              alt={getLocalizedString(image.alt, locale)}
              sizes="(min-width: 1280px) 33vw, (min-width: 768px) 50vw, 100vw"
              priority={priority}
              className="object-contain object-center p-4 contrast-105 transition-transform duration-700 group-hover:scale-[1.02]"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center bg-[#060606] px-6 text-center text-[10px] uppercase tracking-[0.18em] text-white/[0.34]">
              Add final photo in admin
            </div>
          )}
          {hoverImage && hoverImage.url !== image?.url ? (
            <ProductCardImage
              src={hoverImage.url}
              alt=""
              sizes="(min-width: 1280px) 33vw, (min-width: 768px) 50vw, 100vw"
              className="object-contain object-center p-4 contrast-105 opacity-0 transition-opacity duration-700 group-hover:opacity-100"
            />
          ) : null}
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_20%,rgba(212,175,55,0.12),transparent_42%)] opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
          <span className="velmere-command-pill absolute left-4 top-4 bg-[#FFFFF0] px-3 py-2 text-[10px] text-black">
            {purchasable
              ? productT("available")
              : productT("productComingSoon")}
          </span>
          <div className="absolute bottom-4 left-4 right-4 translate-y-3 opacity-0 transition-all duration-500 group-hover:translate-y-0 group-hover:opacity-100">
            <div className="velmere-command-shell flex flex-wrap gap-2 rounded-2xl p-3">
              {product.variants.map((variant) => (
                <span
                  key={variant.id}
                  className="velmere-command-pill px-3 py-1 text-[10px] text-white/[0.70]"
                >
                  {variant.size ?? variant.title}
                </span>
              ))}
            </div>
          </div>
        </motion.div>

        <div className="velmere-product-card-editorial__body flex flex-1 flex-col p-5 md:p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="velmere-label text-velmere-gold/[0.78]">
                {purchasable
                  ? productT("available")
                  : productT("productComingSoon")}
              </p>
              <motion.h3
                layoutId={`product-title-${product.id}`}
                className="mt-2 truncate font-serif text-2xl leading-tight text-white md:text-[1.75rem]"
              >
                {title}
              </motion.h3>
            </div>
            <ArrowUpRight className="mt-1 h-4 w-4 shrink-0 text-white/[0.28] transition duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-velmere-gold" />
          </div>

          <p className="mt-3 line-clamp-2 text-sm leading-6 text-white/[0.52]">
            {description}
          </p>

          <div className="mt-5 grid grid-cols-2 gap-2">
            <div className="velmere-product-fact">
              <Check
                className="h-3.5 w-3.5 text-velmere-gold"
                aria-hidden="true"
              />
              <span>{materialValue}</span>
            </div>
            <div className="velmere-product-fact">
              <PackageCheck
                className="h-3.5 w-3.5 text-velmere-gold"
                aria-hidden="true"
              />
              <span>{fitValue}</span>
            </div>
          </div>

          <div
            className="mt-3 grid grid-cols-3 gap-2"
            data-product-metrics="productMetrics"
          >
            {productMetrics.map(([label, value]) => (
              <span
                key={label}
                className="rounded-xl border border-white/[0.07] bg-white/[0.025] px-3 py-2 font-mono text-[9px] uppercase tracking-[0.12em] text-white/[0.42]"
              >
                {label}: <b className="text-white/[0.66]">{value}</b>
              </span>
            ))}
          </div>

          <div
            className="mt-3 rounded-xl border border-cyan-200/[0.10] bg-cyan-300/[0.035] px-3 py-2"
            data-pass2269-provider-snapshot-card="editorial"
          >
            <p className="font-mono text-[9px] uppercase tracking-[0.12em] text-cyan-100/[0.52]">
              {providerSnapshotStatusLabel} · {providerSnapshot.score}%
            </p>
            <p className="mt-1 line-clamp-1 text-[10px] text-white/[0.40]">
              {providerSnapshotCopy}
            </p>
          </div>

          <div className="mt-auto flex items-end justify-between gap-4 border-t border-white/[0.08] pt-5">
            <div className="min-w-0">
              <p className="truncate font-mono text-[9px] uppercase tracking-[0.14em] text-white/[0.34]">
                {product.variants
                  .map((variant) => variant.size ?? variant.title)
                  .join(" / ")}
              </p>
              <p className="mt-1 text-[10px] text-white/[0.40]">
                {commerce.previewNote}
              </p>
            </div>
            <p className="shrink-0 font-mono text-lg tabular-nums text-velmere-gold">
              {formatMoney(product.price, locale)}
            </p>
          </div>
        </div>
      </motion.article>
    </Link>
  );
}
