"use client";

import Image from "next/image";
import { AlertTriangle, Eye, Lock, PackageCheck, Ruler, ShieldCheck, Truck, X } from "lucide-react";
import type { ReactNode } from "react";
import type { LocalizedString, ProductImportDraft, ProductSizeMeasurement, ProductVariant } from "@/lib/products/types";
import { formatMoney, getLocalizedString, isProductCustomerPurchasable } from "@/lib/products/catalog";

type VlmProductCustomerPreviewProps = {
  draft: ProductImportDraft;
  locale: string;
  onClose: () => void;
};

type PreviewCopy = {
  eyebrow: string;
  title: string;
  subtitle: string;
  close: string;
  customerView: string;
  operatorQa: string;
  addToCart: string;
  lockedAddToCart: string;
  comingSoon: string;
  size: string;
  details: string;
  material: string;
  composition: string;
  care: string;
  delivery: string;
  returns: string;
  sizeGuide: string;
  missing: string;
  checklist: string;
  emptyMissing: string;
  noImage: string;
  publishVerdict: string;
  customerSafe: string;
};

function getCopy(locale: string): PreviewCopy {
  if (locale === "pl") {
    return {
      eyebrow: "Customer preview gate",
      title: "Podgląd produktu przed publikacją",
      subtitle: "Tak klient zobaczy produkt po imporcie. Obok masz operator QA: co blokuje active, co jest tylko review i czy Product Brain uznaje kartę za bezpieczną dla klienta.",
      close: "Zamknij",
      customerView: "Widok klienta",
      operatorQa: "Operator QA",
      addToCart: "Dodaj do koszyka",
      lockedAddToCart: "Zablokowane przez AI gate",
      comingSoon: "Coming soon",
      size: "Rozmiar",
      details: "Szczegóły",
      material: "Materiał",
      composition: "Skład",
      care: "Pielęgnacja",
      delivery: "Dostawa",
      returns: "Zwroty",
      sizeGuide: "Tabela rozmiarów w cm",
      missing: "Braki przed publikacją",
      checklist: "Checklist VLM Product Brain",
      emptyMissing: "Brak blockerów po ostatnim re-checku.",
      noImage: "Brak zdjęcia",
      publishVerdict: "Werdykt publikacji",
      customerSafe: "Customer-safe preview: nie pokazuje obietnic bez danych, tylko fakty z truth profile.",
    };
  }
  if (locale === "de") {
    return {
      eyebrow: "Customer preview gate",
      title: "Produktvorschau vor Veröffentlichung",
      subtitle: "So sieht der Kunde den Produktentwurf. Daneben steht Operator QA: Active-Blocker, Review-Felder und ob Product Brain die Karte als kunden-sicher bewertet.",
      close: "Schließen",
      customerView: "Kundenansicht",
      operatorQa: "Operator QA",
      addToCart: "In den Warenkorb",
      lockedAddToCart: "Durch AI Gate blockiert",
      comingSoon: "Coming soon",
      size: "Größe",
      details: "Details",
      material: "Material",
      composition: "Zusammensetzung",
      care: "Pflege",
      delivery: "Lieferung",
      returns: "Rückgabe",
      sizeGuide: "Größentabelle in cm",
      missing: "Lücken vor Veröffentlichung",
      checklist: "VLM Product Brain Checklist",
      emptyMissing: "Keine Blocker nach dem letzten Re-check.",
      noImage: "Kein Bild",
      publishVerdict: "Publish verdict",
      customerSafe: "Customer-safe preview: zeigt keine unbestätigten Versprechen, nur Fakten aus dem Truth Profile.",
    };
  }
  return {
    eyebrow: "Customer preview gate",
    title: "Product preview before publish",
    subtitle: "This is how the imported product will look to a customer. Operator QA shows active blockers, review gaps and whether Product Brain marks the card as customer-safe.",
    close: "Close",
    customerView: "Customer view",
    operatorQa: "Operator QA",
    addToCart: "Add to cart",
    lockedAddToCart: "Blocked by AI gate",
    comingSoon: "Coming soon",
    size: "Size",
    details: "Details",
    material: "Material",
    composition: "Composition",
    care: "Care",
    delivery: "Delivery",
    returns: "Returns",
    sizeGuide: "Size chart in cm",
    missing: "Gaps before publish",
    checklist: "VLM Product Brain checklist",
    emptyMissing: "No blockers after the last re-check.",
    noImage: "No image",
    publishVerdict: "Publish verdict",
    customerSafe: "Customer-safe preview: no unverified claims, only facts from the truth profile.",
  };
}

function statusClass(status: string) {
  if (status === "ready" || status === "pass" || status === "complete" || status === "active") return "border-emerald-300/[0.25] text-emerald-100/[0.80] bg-emerald-500/[0.055]";
  if (status === "blocked" || status === "block" || status === "missing" || status === "draft") return "border-red-300/[0.25] text-red-100/[0.80] bg-red-500/[0.055]";
  return "border-velmere-gold/[0.25] text-velmere-gold/[0.86] bg-velmere-gold/[0.055]";
}

function optionalLocalized(value: LocalizedString | undefined, locale: string) {
  if (!value) return "";
  return getLocalizedString(value, locale).trim() || value.pl.trim() || value.en.trim() || value.de.trim();
}

function variantLabel(variant: ProductVariant) {
  return [variant.size || variant.title, variant.color].filter(Boolean).join(" / ") || variant.title || variant.id;
}

function measurementHasData(measurement: ProductSizeMeasurement) {
  return Boolean(
    measurement.chest ||
      measurement.length ||
      measurement.shoulders ||
      measurement.sleeve ||
      measurement.waist ||
      measurement.hip ||
      measurement.thigh ||
      measurement.rise ||
      measurement.inseam,
  );
}

function isInlinePreviewImage(src: string) {
  return src.startsWith("data:") || src.startsWith("blob:");
}

function PreviewImage({
  src,
  alt,
  className,
}: {
  src: string;
  alt: string;
  className: string;
}) {
  if (isInlinePreviewImage(src)) {
    return <Image src={src} alt={alt} fill unoptimized sizes="(min-width: 1024px) 42vw, 100vw" className={className} />;
  }
  return <Image src={src} alt={alt} fill sizes="(min-width: 1024px) 42vw, 100vw" className={className} />;
}

export default function VlmProductCustomerPreview({ draft, locale, onClose }: VlmProductCustomerPreviewProps) {
  const copy = getCopy(locale);
  const product = draft.product;
  const brain = draft.brain;
  const truth = product.truth;
  const image = product.images[0];
  const title = optionalLocalized(product.title, locale) || product.slug;
  const shortDescription = optionalLocalized(product.shortDescription, locale) || optionalLocalized(product.description, locale);
  const description = optionalLocalized(product.description, locale);
  const isPurchasable = isProductCustomerPurchasable(product) && Boolean(brain?.readiness.canPublishActive);
  const canShowComingSoon = Boolean(brain?.readiness.canPublishComingSoon) || product.status === "coming_soon";
  const measurements = truth?.sizeGuide.measurements.filter(measurementHasData) ?? [];
  const primaryVariants = product.variants.slice(0, 8);
  const missing = brain?.readiness.missing ?? [];
  const checklist = brain?.readiness.checklist ?? [];

  return (
    <div className="fixed inset-x-0 bottom-0 top-[5.35rem] z-[29] overflow-y-auto bg-black/[0.72] p-4 backdrop-blur-xl md:top-[5.75rem] md:p-6" role="dialog" aria-modal="true" aria-label={copy.title}>
      <div className="mx-auto max-w-7xl overflow-hidden rounded-[2rem] border border-velmere-gold/[0.18] bg-[#070706] shadow-2xl shadow-black/60">
        <div className="flex flex-col gap-4 border-b border-white/[0.09] bg-white/[0.035] p-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-velmere-gold">{copy.eyebrow}</p>
            <h2 className="mt-3 font-serif text-3xl text-white md:text-4xl">{copy.title}</h2>
            <p className="mt-3 max-w-4xl text-sm leading-7 text-white/[0.58]">{copy.subtitle}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-full border border-white/[0.12] px-5 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/[0.62] hover:border-white/[0.25] hover:text-white"
          >
            <X className="h-4 w-4" aria-hidden="true" />
            {copy.close}
          </button>
        </div>

        <div className="grid gap-0 xl:grid-cols-[minmax(0,1fr)_360px]">
          <section className="p-5 md:p-7">
            <div className="mb-4 flex flex-wrap gap-2 text-[10px] uppercase tracking-[0.16em]">
              <span className={`rounded-full border px-3 py-2 ${statusClass(brain?.readiness.level ?? "review")}`}>AI gate: {brain?.readiness.level ?? "review"} · {brain?.readiness.score ?? "-"}/100</span>
              <span className={`rounded-full border px-3 py-2 ${statusClass(product.status)}`}>Status: {product.status}</span>
              <span className={`rounded-full border px-3 py-2 ${statusClass(brain?.providerAdapter.imageStatus ?? "partial")}`}>Images: {brain?.providerAdapter.imageStatus ?? "unknown"}</span>
              <span className={`rounded-full border px-3 py-2 ${statusClass(brain?.providerAdapter.sizeGuideStatus ?? "partial")}`}>Size cm: {brain?.providerAdapter.sizeGuideStatus ?? "unknown"}</span>
            </div>

            <div className="rounded-[1.5rem] border border-white/[0.10] bg-[radial-gradient(circle_at_top_left,rgba(214,180,106,0.10),rgba(255,255,255,0.025)_38%,rgba(0,0,0,0.10))] p-4 md:p-6">
              <div className="mb-5 flex items-center gap-2 text-sm font-semibold text-white">
                <Eye className="h-4 w-4 text-velmere-gold" aria-hidden="true" />
                {copy.customerView}
              </div>

              <div className="grid gap-7 lg:grid-cols-[0.95fr_1.05fr]">
                <div>
                  <div className="relative flex aspect-[4/5] items-center justify-center overflow-hidden rounded-[1.4rem] border border-white/[0.10] bg-white/[0.035]">
                    {image?.url ? (
                      <PreviewImage src={image.url} alt={optionalLocalized(image.alt, locale) || title} className="object-cover" />
                    ) : (
                      <div className="flex h-full w-full flex-col items-center justify-center gap-3 text-white/[0.36]">
                        <AlertTriangle className="h-8 w-8" aria-hidden="true" />
                        <span className="text-xs uppercase tracking-[0.18em]">{copy.noImage}</span>
                      </div>
                    )}
                  </div>
                  {product.images.length > 1 ? (
                    <div className="mt-3 grid grid-cols-4 gap-2">
                      {product.images.slice(0, 4).map((item) => (
                        <div key={item.url} className="relative aspect-square overflow-hidden rounded-xl border border-white/[0.08] bg-white/[0.035]">
                          <PreviewImage src={item.url} alt={optionalLocalized(item.alt, locale) || title} className="object-cover" />
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>

                <div className="flex flex-col">
                  <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-velmere-gold">Velmère / {product.provider}</p>
                  <h3 className="mt-3 font-serif text-4xl leading-tight text-white md:text-5xl">{title}</h3>
                  <p className="mt-4 text-xl text-white/[0.86]">{product.price.amount ? formatMoney(product.price, locale) : "-"}</p>
                  {shortDescription ? <p className="mt-5 text-sm leading-7 text-white/[0.58]">{shortDescription}</p> : null}

                  <div className="mt-6">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/[0.42]">{copy.size}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {primaryVariants.length ? primaryVariants.map((variant) => (
                        <button
                          key={variant.id}
                          type="button"
                          disabled
                          className={`rounded-full border px-4 py-2 text-xs uppercase tracking-[0.14em] ${variant.available === false ? "border-white/[0.08] text-white/[0.28]" : "border-white/[0.14] text-white/[0.70]"}`}
                        >
                          {variantLabel(variant)}
                        </button>
                      )) : (
                        <span className="rounded-full border border-red-300/[0.22] px-4 py-2 text-xs uppercase tracking-[0.14em] text-red-100/[0.72]">No variants</span>
                      )}
                    </div>
                  </div>

                  <button
                    type="button"
                    disabled
                    className={`mt-7 inline-flex min-h-12 items-center justify-center gap-2 rounded-full px-6 text-[10px] font-semibold uppercase tracking-[0.18em] ${isPurchasable ? "bg-velmere-gold text-black" : canShowComingSoon ? "border border-velmere-gold/[0.28] text-velmere-gold" : "border border-white/[0.10] text-white/[0.42]"}`}
                  >
                    {isPurchasable ? <PackageCheck className="h-4 w-4" aria-hidden="true" /> : <Lock className="h-4 w-4" aria-hidden="true" />}
                    {isPurchasable ? copy.addToCart : canShowComingSoon ? copy.comingSoon : copy.lockedAddToCart}
                  </button>

                  <div className="mt-6 rounded-2xl border border-white/[0.08] bg-black/[0.24] p-4 text-xs leading-6 text-white/[0.48]">
                    <div className="flex items-start gap-3">
                      <ShieldCheck className="mt-1 h-4 w-4 shrink-0 text-velmere-gold" aria-hidden="true" />
                      <p>{copy.customerSafe}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-8 grid gap-4 lg:grid-cols-2">
                <InfoBlock title={copy.details} value={description} />
                <InfoBlock title={copy.material} value={optionalLocalized(truth?.material, locale)} />
                <InfoBlock title={copy.composition} value={optionalLocalized(truth?.composition, locale)} />
                <InfoBlock title={copy.delivery} value={optionalLocalized(truth?.deliveryNote, locale)} icon={<Truck className="h-4 w-4" aria-hidden="true" />} />
                <InfoBlock title={copy.returns} value={optionalLocalized(truth?.returnNote, locale)} />
                <div className="rounded-2xl border border-white/[0.08] bg-black/[0.22] p-4">
                  <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/[0.38]">{copy.care}</p>
                  {truth?.care.length ? (
                    <ul className="mt-3 space-y-2 text-sm leading-6 text-white/[0.58]">
                      {truth.care.map((item) => <li key={optionalLocalized(item, locale)}>• {optionalLocalized(item, locale)}</li>)}
                    </ul>
                  ) : <p className="mt-3 text-sm text-white/[0.32]">-</p>}
                </div>
              </div>

              <div className="mt-6 rounded-2xl border border-white/[0.08] bg-black/[0.22] p-4">
                <div className="flex items-center gap-2 text-white">
                  <Ruler className="h-4 w-4 text-velmere-gold" aria-hidden="true" />
                  <h4 className="font-semibold">{copy.sizeGuide}</h4>
                </div>
                {measurements.length ? (
                  <div className="mt-4 overflow-x-auto rounded-xl border border-white/[0.08]">
                    <table className="min-w-[760px] w-full border-collapse text-left text-xs">
                      <thead className="bg-white/[0.04] font-mono uppercase tracking-[0.14em] text-white/[0.36]">
                        <tr>
                          <th className="px-3 py-3">Size</th>
                          <th className="px-3 py-3">Chest</th>
                          <th className="px-3 py-3">Length</th>
                          <th className="px-3 py-3">Shoulders</th>
                          <th className="px-3 py-3">Sleeve</th>
                          <th className="px-3 py-3">Waist</th>
                          <th className="px-3 py-3">Hip</th>
                          <th className="px-3 py-3">Inseam</th>
                        </tr>
                      </thead>
                      <tbody>
                        {measurements.map((measurement) => (
                          <tr key={measurement.size} className="border-t border-white/[0.06] text-white/[0.62]">
                            <td className="px-3 py-3 font-semibold text-white">{measurement.size}</td>
                            <td className="px-3 py-3">{measurement.chest || "-"}</td>
                            <td className="px-3 py-3">{measurement.length || "-"}</td>
                            <td className="px-3 py-3">{measurement.shoulders || "-"}</td>
                            <td className="px-3 py-3">{measurement.sleeve || "-"}</td>
                            <td className="px-3 py-3">{measurement.waist || "-"}</td>
                            <td className="px-3 py-3">{measurement.hip || "-"}</td>
                            <td className="px-3 py-3">{measurement.inseam || "-"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="mt-3 rounded-xl border border-velmere-gold/[0.16] bg-velmere-gold/[0.045] p-3 text-sm text-velmere-gold/[0.72]">Size chart missing or still only review data.</p>
                )}
              </div>
            </div>
          </section>

          <aside className="border-t border-white/[0.09] bg-white/[0.025] p-5 xl:border-l xl:border-t-0">
            <div className="sticky top-5 space-y-5">
              <div className="rounded-2xl border border-white/[0.08] bg-black/[0.24] p-4">
                <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-velmere-gold">{copy.operatorQa}</p>
                <h3 className="mt-3 font-serif text-2xl text-white">{copy.publishVerdict}</h3>
                <div className="mt-4 grid gap-2 text-[10px] uppercase tracking-[0.14em]">
                  <span className={`rounded-full border px-3 py-2 ${statusClass(brain?.readiness.level ?? "review")}`}>Gate: {brain?.readiness.level ?? "review"}</span>
                  <span className={`rounded-full border px-3 py-2 ${statusClass(brain?.readiness.canPublishComingSoon ? "ready" : "blocked")}`}>Coming soon: {brain?.readiness.canPublishComingSoon ? "yes" : "no"}</span>
                  <span className={`rounded-full border px-3 py-2 ${statusClass(brain?.readiness.canPublishActive ? "ready" : "blocked")}`}>Active: {brain?.readiness.canPublishActive ? "yes" : "no"}</span>
                </div>
              </div>

              <div className="rounded-2xl border border-white/[0.08] bg-black/[0.24] p-4">
                <p className="font-semibold text-white">{copy.missing}</p>
                <div className="mt-3 space-y-3">
                  {missing.length ? missing.map((item) => (
                    <div key={item.id} className={`rounded-xl border p-3 ${item.blocksActivePublish ? "border-red-300/[0.20] bg-red-500/[0.05]" : "border-white/[0.08] bg-white/[0.03]"}`}>
                      <p className="text-sm font-semibold text-white">{item.label}</p>
                      <p className="mt-1 text-xs leading-5 text-white/[0.50]">{item.reason}</p>
                    </div>
                  )) : <p className="rounded-xl border border-emerald-300/[0.18] bg-emerald-500/[0.05] p-3 text-sm text-emerald-100/[0.74]">{copy.emptyMissing}</p>}
                </div>
              </div>

              <div className="rounded-2xl border border-white/[0.08] bg-black/[0.24] p-4">
                <p className="font-semibold text-white">{copy.checklist}</p>
                <div className="mt-3 space-y-2">
                  {checklist.map((item) => (
                    <div key={item.id} className="flex items-start justify-between gap-3 rounded-xl border border-white/[0.08] bg-white/[0.025] p-3 text-sm">
                      <div>
                        <p className="text-white/[0.76]">{item.label}</p>
                        <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.16em] text-white/[0.32]">owner: {item.owner}</p>
                      </div>
                      <span className={`shrink-0 rounded-full border px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.14em] ${statusClass(item.status)}`}>{item.status}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

function InfoBlock({ title, value, icon }: { title: string; value?: string; icon?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/[0.08] bg-black/[0.22] p-4">
      <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.18em] text-white/[0.38]">
        {icon}
        <span>{title}</span>
      </div>
      <p className="mt-3 text-sm leading-7 text-white/[0.58]">{value?.trim() || "-"}</p>
    </div>
  );
}
