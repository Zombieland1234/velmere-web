"use client";

import Image from "next/image";
import { CircleAlert, ClipboardCheck, ImagePlus, Loader2, RotateCcw, Save, Star, Trash2, X } from "lucide-react";
import type { ReactNode } from "react";
import type {
  LocalizedString,
  Product,
  ProductImage,
  ProductImportDraft,
  ProductSizeMeasurement,
  ProductTruthProfile,
  ProductVariant,
  SupportedCurrency,
} from "@/lib/products/types";

const LOCALES: Array<keyof LocalizedString> = ["pl", "en", "de"];
const SIZE_ORDER = ["XXS", "XS", "S", "M", "L", "XL", "XXL", "XXXL", "2XL", "3XL", "4XL", "5XL"];
const MAX_PRODUCT_IMAGES = 4;

type VlmProductBrainEditorProps = {
  draft: ProductImportDraft;
  locale: string;
  busy?: boolean;
  onChange: (draft: ProductImportDraft) => void;
  onClose: () => void;
  onRecheck: (draftId: string) => Promise<void> | void;
};

type Copy = {
  title: string;
  subtitle: string;
  recheck: string;
  close: string;
  detected: string;
  missing: string;
  checklist: string;
  productCopy: string;
  truth: string;
  variants: string;
  images: string;
  saveHint: string;
  price: string;
  sizeInput: string;
  imageInput: string;
  manualImagesNote: string;
  uploadImages: string;
  uploadHelp: string;
  primaryImage: string;
  setPrimaryImage: string;
  removeImage: string;
  imageLimitReached: string;
  imageCount: string;
  material: string;
  composition: string;
  care: string;
  delivery: string;
  returns: string;
  providerMapping: string;
  providerMappingHelp: string;
  sku: string;
  providerId: string;
  stock: string;
  available: string;
  color: string;
  variantPrice: string;
  sizeChartCm: string;
  sizeChartHelp: string;
  chest: string;
  length: string;
  shoulders: string;
  sleeve: string;
  waist: string;
  hip: string;
  inseam: string;
};

function getCopy(locale: string): Copy {
  if (locale === "pl") {
    return {
      title: "VLM Product Brain Editor",
      subtitle: "Tu poprawiasz draft po imporcie: nazwę, opis, cenę, rozmiary, ręczne zdjęcia i truth profile. AI nie ściąga zdjęć z providera — media dodajesz sam, a re-check przelicza gate bez gubienia poprawek.",
      recheck: "Przelicz gate AI",
      close: "Zamknij",
      detected: "Wykryte przez AI",
      missing: "Braki blokujące / do review",
      checklist: "Checklist publikacji",
      productCopy: "Nazwa i opis",
      truth: "Truth profile",
      variants: "Rozmiary / warianty",
      images: "Zdjęcia",
      saveHint: "Zmiany zapisują się w aktualnym draftcie przed publikacją. Re-check usuwa stare blokery VLM i liczy je od nowa.",
      price: "Cena EUR",
      sizeInput: "Rozmiary, np. S, M, L, XL",
      imageInput: "Ręczne URL zdjęć / assetów Velmère, jeden na linię",
      manualImagesNote: "Tryb manual media: Printful/CSV/URL nie importują zdjęć. Wklej finalne zdjęcia produktu, mockupy lub assety z własnego hostingu/CDN dopiero po swojej kontroli.",
      uploadImages: "Dodaj zdjęcia",
      uploadHelp: "Możesz wrzucić maksymalnie 4 zdjęcia na produkt. Pierwsze zdjęcie jest główne na shopie; kolejność zmienisz przyciskiem Ustaw jako główne.",
      primaryImage: "Główne",
      setPrimaryImage: "Ustaw jako główne",
      removeImage: "Usuń",
      imageLimitReached: "Limit 4 zdjęć osiągnięty",
      imageCount: "Zdjęcia",
      material: "Materiał",
      composition: "Skład",
      care: "Pielęgnacja, jedna linia = jeden punkt",
      delivery: "Dostawa",
      returns: "Zwroty",
      providerMapping: "Provider mapping / SKU",
      providerMappingHelp: "Tutaj ręcznie spinasz rozmiar z SKU, provider variant ID, ceną wariantu i dostępnością. Dla Printful/Tapstitch to jest krytyczne przed aktywną sprzedażą.",
      sku: "SKU",
      providerId: "Provider ID",
      stock: "Stock",
      available: "Dostępny",
      color: "Kolor",
      variantPrice: "Cena wariantu EUR",
      sizeChartCm: "Tabela rozmiarów w cm",
      sizeChartHelp: "Wpisuj tylko dane potwierdzone przez providera albo sample QA. Puste pola zostaną jako review, nie jako fakt.",
      chest: "Klatka",
      length: "Długość",
      shoulders: "Ramiona",
      sleeve: "Rękaw",
      waist: "Talia",
      hip: "Biodra",
      inseam: "Nogawka",
    };
  }
  if (locale === "de") {
    return {
      title: "VLM Product Brain Editor",
      subtitle: "Bearbeite Import-Entwürfe: Name, Beschreibung, Preis, Größen, manuelle Bilder und Truth Profile. AI importiert keine Provider-Bilder — Medien ergänzt der Operator manuell.",
      recheck: "AI Gate neu prüfen",
      close: "Schließen",
      detected: "Von AI erkannt",
      missing: "Blocker / Review-Felder",
      checklist: "Publish Checklist",
      productCopy: "Name und Beschreibung",
      truth: "Truth Profile",
      variants: "Größen / Varianten",
      images: "Bilder",
      saveHint: "Änderungen bleiben im aktuellen Draft vor Publish. Re-check entfernt alte VLM-Blocker und berechnet sie neu.",
      price: "Preis EUR",
      sizeInput: "Größen, z. B. S, M, L, XL",
      imageInput: "Manuelle Velmère Bild-/Asset-URLs, eine pro Zeile",
      manualImagesNote: "Manual-Media-Modus: Printful/CSV/URL importieren keine Bilder. Füge finale Produktbilder, Mockups oder eigene CDN-Assets erst nach Review hinzu.",
      uploadImages: "Bilder hinzufügen",
      uploadHelp: "Maximal 4 Bilder pro Produkt. Das erste Bild ist das Hauptbild im Shop; die Reihenfolge änderst du mit Als Hauptbild setzen.",
      primaryImage: "Hauptbild",
      setPrimaryImage: "Als Hauptbild setzen",
      removeImage: "Entfernen",
      imageLimitReached: "Limit von 4 Bildern erreicht",
      imageCount: "Bilder",
      material: "Material",
      composition: "Zusammensetzung",
      care: "Pflege, eine Zeile = ein Punkt",
      delivery: "Lieferung",
      returns: "Rückgabe",
      providerMapping: "Provider Mapping / SKU",
      providerMappingHelp: "Hier verbindest du Größe mit SKU, Provider-Variant-ID, Variantenpreis und Verfügbarkeit. Für Printful/Tapstitch ist das vor aktivem Verkauf kritisch.",
      sku: "SKU",
      providerId: "Provider ID",
      stock: "Bestand",
      available: "Verfügbar",
      color: "Farbe",
      variantPrice: "Variantenpreis EUR",
      sizeChartCm: "Größentabelle in cm",
      sizeChartHelp: "Nur vom Provider oder Sample-QA bestätigte Werte eintragen. Leere Felder bleiben Review, nicht Fakt.",
      chest: "Brust",
      length: "Länge",
      shoulders: "Schultern",
      sleeve: "Ärmel",
      waist: "Taille",
      hip: "Hüfte",
      inseam: "Innenbein",
    };
  }
  return {
    title: "VLM Product Brain Editor",
    subtitle: "Edit the imported draft: name, description, price, sizes, manual images and truth profile. AI never imports provider images — media is added by the operator, then re-check recomputes the publish gate without losing manual corrections.",
    recheck: "Re-check AI gate",
    close: "Close",
    detected: "AI detected",
    missing: "Blocking / review gaps",
    checklist: "Publish checklist",
    productCopy: "Name and description",
    truth: "Truth profile",
    variants: "Sizes / variants",
    images: "Images",
    saveHint: "Changes are kept in the current draft before publishing. Re-check clears old VLM blockers and recalculates them.",
    price: "Price EUR",
    sizeInput: "Sizes, e.g. S, M, L, XL",
    imageInput: "Manual Velmère image / asset URLs, one per line",
    manualImagesNote: "Manual media mode: Printful/CSV/URL imports never attach images. Add final product photos, mockups or owned CDN assets only after operator review.",
    uploadImages: "Add images",
    uploadHelp: "Upload up to 4 images per product. The first image is the main shop image; use Set as primary to reorder.",
    primaryImage: "Primary",
    setPrimaryImage: "Set as primary",
    removeImage: "Remove",
    imageLimitReached: "4 image limit reached",
    imageCount: "Images",
    material: "Material",
    composition: "Composition",
    care: "Care, one line = one item",
    delivery: "Delivery",
    returns: "Returns",
    providerMapping: "Provider mapping / SKU",
    providerMappingHelp: "Connect each size with SKU, provider variant ID, variant price and availability. For Printful/Tapstitch this is critical before active checkout.",
    sku: "SKU",
    providerId: "Provider ID",
    stock: "Stock",
    available: "Available",
    color: "Color",
    variantPrice: "Variant price EUR",
    sizeChartCm: "Size chart in cm",
    sizeChartHelp: "Only enter provider-confirmed or sample-QA values. Empty cells stay as review gaps, not facts.",
    chest: "Chest",
    length: "Length",
    shoulders: "Shoulders",
    sleeve: "Sleeve",
    waist: "Waist",
    hip: "Hip",
    inseam: "Inseam",
  };
}

function emptyLocalized(): LocalizedString {
  return { pl: "", en: "", de: "" };
}

function localizedSame(value: string): LocalizedString {
  return { pl: value, en: value, de: value };
}

function getLocalizedLabel(value: LocalizedString) {
  return value.pl || value.en || value.de || "Velmère product image";
}

function ensureTruth(product: Product): ProductTruthProfile {
  return product.truth ?? {
    material: emptyLocalized(),
    composition: emptyLocalized(),
    weight: "",
    fit: emptyLocalized(),
    care: [],
    sizeGuide: {
      note: emptyLocalized(),
      measurements: product.variants
        .map((variant) => variant.size || variant.title)
        .filter(Boolean)
        .map((size) => ({ size })) as ProductSizeMeasurement[],
    },
    deliveryNote: emptyLocalized(),
    returnNote: emptyLocalized(),
  };
}

function splitValues(value: string) {
  return value
    .split(/[\n,;]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeSize(value: string) {
  const upper = value.trim().toUpperCase();
  if (upper === "2XL") return "XXL";
  if (upper === "3XL") return "XXXL";
  return upper;
}

function sortSizes(sizes: string[]) {
  return Array.from(new Set(sizes.map(normalizeSize))).sort((a, b) => {
    const ai = SIZE_ORDER.indexOf(a);
    const bi = SIZE_ORDER.indexOf(b);
    return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
  });
}

function buildVariantsFromSizes(product: Product, value: string): ProductVariant[] {
  const sizes = sortSizes(splitValues(value));
  const currency = product.price.currency as SupportedCurrency;
  return sizes.map((size) => {
    const existing = product.variants.find((variant) => normalizeSize(variant.size || variant.title) === size);
    return {
      id: existing?.id ?? `${product.slug}-${size.toLowerCase()}`,
      title: existing?.title && !existing.title.toLowerCase().startsWith("variant") ? existing.title : size,
      size,
      color: existing?.color,
      sku: existing?.sku,
      providerVariantId: existing?.providerVariantId ?? product.providerVariantIds?.[existing?.id ?? ""],
      price: existing?.price ?? (product.price.amount > 0 ? { amount: product.price.amount, currency } : undefined),
      available: existing?.available ?? false,
    };
  });
}

function buildImagesFromText(product: Product, value: string): ProductImage[] {
  const urls = splitValues(value).slice(0, MAX_PRODUCT_IMAGES);
  return urls.map((url, index) => {
    const existing = product.images.find((image) => image.url === url) ?? product.images[index];
    return {
      url,
      alt: existing?.alt ?? product.title,
      width: existing?.width,
      height: existing?.height,
    } as ProductImage;
  });
}
function euroCentsToInput(value?: number) {
  return typeof value === "number" && value > 0 ? (value / 100).toFixed(2) : "";
}

function inputToEuroCents(value: string) {
  const amount = Number(value.replace(",", "."));
  return Number.isFinite(amount) ? Math.round(amount * 100) : 0;
}

function rebuildProviderVariantIds(variants: ProductVariant[]) {
  const entries = variants
    .filter((variant) => variant.providerVariantId?.trim())
    .map((variant) => [variant.id, variant.providerVariantId as string]);
  return entries.length ? Object.fromEntries(entries) : undefined;
}

function patchVariant(product: Product, index: number, patch: Partial<ProductVariant>): Product {
  const variants = product.variants.map((variant, variantIndex) => (variantIndex === index ? { ...variant, ...patch } : variant));
  return {
    ...product,
    variants,
    providerVariantIds: rebuildProviderVariantIds(variants),
  };
}

function buildMeasurementsForVariants(product: Product, truth: ProductTruthProfile): ProductSizeMeasurement[] {
  const existing = truth.sizeGuide.measurements ?? [];
  const bySize = new Map(existing.map((measurement) => [normalizeSize(measurement.size), measurement]));
  const variantSizes = product.variants.map((variant) => variant.size || variant.title).filter((value): value is string => Boolean(value));
  if (!variantSizes.length) return existing.length ? existing : [{ size: "S" }, { size: "M" }, { size: "L" }];
  return variantSizes.map((size) => bySize.get(normalizeSize(size)) ?? { size });
}

function buildMeasurementsForSizes(variants: ProductVariant[], truth: ProductTruthProfile): ProductSizeMeasurement[] {
  const bySize = new Map((truth.sizeGuide.measurements ?? []).map((measurement) => [normalizeSize(measurement.size), measurement]));
  return variants.map((variant) => {
    const size = variant.size || variant.title;
    return bySize.get(normalizeSize(size)) ?? { size };
  });
}


function statusClass(status: string) {
  if (status === "pass" || status === "ready" || status === "complete" || status === "strong") return "border-emerald-300/[0.25] text-emerald-100/[0.78]";
  if (status === "block" || status === "blocked" || status === "missing" || status === "weak") return "border-red-300/[0.28] text-red-100/[0.78]";
  return "border-velmere-gold/[0.26] text-velmere-gold/[0.82]";
}

function inputClass(extra = "") {
  return `mt-2 w-full rounded-xl border border-white/[0.10] bg-black/[0.35] px-3 py-2 text-sm leading-6 text-white outline-none placeholder:text-white/[0.28] focus:border-velmere-gold ${extra}`;
}

function Label({ children }: { children: ReactNode }) {
  return <label className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/[0.45]">{children}</label>;
}

function LocalizedInputs({
  label,
  value,
  onChange,
  textarea,
}: {
  label: string;
  value: LocalizedString;
  onChange: (next: LocalizedString) => void;
  textarea?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-white/[0.08] bg-black/[0.22] p-4">
      <Label>{label}</Label>
      <div className="mt-3 grid gap-3 md:grid-cols-3">
        {LOCALES.map((code) => (
          <div key={code}>
            <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/[0.32]">{code}</span>
            {textarea ? (
              <textarea
                value={value[code]}
                onChange={(event) => onChange({ ...value, [code]: event.target.value })}
                rows={4}
                className={inputClass("min-h-28 resize-y")}
              />
            ) : (
              <input
                value={value[code]}
                onChange={(event) => onChange({ ...value, [code]: event.target.value })}
                className={inputClass()}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function VlmProductBrainEditor({ draft, locale, busy, onChange, onClose, onRecheck }: VlmProductBrainEditorProps) {
  const copy = getCopy(locale);
  const product = draft.product;
  const truth = ensureTruth(product);
  const brain = draft.brain;
  const sizesText = product.variants.map((variant) => variant.size || variant.title).filter(Boolean).join(", ");
  const imageText = product.images.map((image) => image.url).join("\n");
  const careText = truth.care.map((item) => item.pl || item.en || item.de).join("\n");
  const measurements = buildMeasurementsForVariants(product, truth);

  const patchDraft = (nextProduct: Product) => {
    onChange({
      ...draft,
      product: nextProduct,
    });
  };

  const patchProduct = (patch: Partial<Product>) => patchDraft({ ...product, ...patch });
  const patchTruth = (patch: Partial<ProductTruthProfile>) => patchProduct({ truth: { ...truth, ...patch } });

  const patchImages = (images: ProductImage[]) => patchProduct({ images: images.slice(0, MAX_PRODUCT_IMAGES) });

  const setPrimaryImage = (index: number) => {
    if (index <= 0 || index >= product.images.length) return;
    const images = [...product.images];
    const [selected] = images.splice(index, 1);
    if (!selected) return;
    patchImages([selected, ...images]);
  };

  const removeImage = (index: number) => {
    patchImages(product.images.filter((_, imageIndex) => imageIndex !== index));
  };

  const handleManualImageUpload = async (files: FileList | null) => {
    if (!files?.length) return;
    const remainingSlots = Math.max(0, MAX_PRODUCT_IMAGES - product.images.length);
    if (remainingSlots === 0) return;
    const imageFiles = Array.from(files).filter((file) => file.type.startsWith("image/")).slice(0, remainingSlots);
    const uploaded = await Promise.all(
      imageFiles.map(
        (file) =>
          new Promise<ProductImage>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
              resolve({
                url: String(reader.result ?? ""),
                alt: product.title,
              });
            };
            reader.onerror = () => reject(reader.error ?? new Error("Image upload failed"));
            reader.readAsDataURL(file);
          }),
      ),
    );
    patchImages([...product.images, ...uploaded].filter((image) => image.url));
  };

  const level = brain?.readiness.level ?? "review";
  const score = brain?.readiness.score ?? 0;
  const audience = product.tags.includes("men") || product.collection === "men"
    ? "men"
    : product.tags.includes("women") || product.collection === "women"
      ? "women"
      : "unisex";
  const setAudience = (nextAudience: "men" | "women" | "unisex") => {
    const cleanTags = product.tags.filter((tag) => !["men", "women", "unisex"].includes(tag.toLowerCase()));
    patchProduct({
      collection: nextAudience,
      tags: Array.from(new Set([...cleanTags, nextAudience])),
    });
  };
  const simpleReadyChecks = [
    { label: locale === "pl" ? "Zdjęcia" : locale === "de" ? "Bilder" : "Photos", value: `${product.images.length}/4`, ok: product.images.length > 0, help: locale === "pl" ? "Dodaj min. 1 własne zdjęcie" : "Add at least 1 owned image" },
    { label: locale === "pl" ? "Cena" : locale === "de" ? "Preis" : "Price", value: euroCentsToInput(product.price.amount) || "-", ok: product.price.amount > 0, help: "EUR" },
    { label: locale === "pl" ? "Rozmiary" : locale === "de" ? "Größen" : "Sizes", value: product.variants.length ? String(product.variants.length) : "0", ok: product.variants.length > 0, help: sizesText || "-" },
    { label: locale === "pl" ? "Shop" : "Shop", value: audience, ok: true, help: audience === "unisex" ? "Men + Women" : audience },
  ];

  return (
    <div className="fixed inset-x-4 bottom-4 top-[5.35rem] z-[29] overflow-y-auto rounded-[1.5rem] bg-black/[0.70] p-3 backdrop-blur-xl md:inset-x-8 md:bottom-6 md:top-[5.75rem] md:p-4" role="dialog" aria-modal="true" aria-label={copy.title}>
    <section className="mx-auto max-w-7xl rounded-[1.5rem] border border-velmere-gold/[0.22] bg-[radial-gradient(circle_at_top_right,rgba(214,180,106,0.12),rgba(255,255,255,0.035)_42%,rgba(0,0,0,0.22))] p-5 shadow-2xl shadow-black/30 md:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-velmere-gold">Product operator cockpit</p>
          <h2 className="mt-3 font-serif text-3xl text-white md:text-4xl">{copy.title}</h2>
          <p className="mt-3 max-w-4xl text-sm leading-7 text-white/[0.60]">{copy.subtitle}</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => onRecheck(draft.draftId)}
            disabled={busy}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-velmere-gold px-5 text-[10px] font-semibold uppercase tracking-[0.18em] text-black transition-opacity disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <RotateCcw className="h-4 w-4" aria-hidden="true" />}
            {copy.recheck}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-white/[0.12] px-5 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/[0.62] hover:border-white/[0.25] hover:text-white"
          >
            <X className="h-4 w-4" aria-hidden="true" />
            {copy.close}
          </button>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-2 text-[10px] uppercase tracking-[0.16em]">
        <span className={`rounded-full border px-3 py-2 ${statusClass(level)}`}>Gate: {level} · {score}/100</span>
        <span className={`rounded-full border px-3 py-2 ${statusClass(brain?.providerAdapter.sourceQuality ?? "medium")}`}>Source: {brain?.providerAdapter.sourceQuality ?? "unknown"}</span>
        <span className={`rounded-full border px-3 py-2 ${statusClass(brain?.providerAdapter.variantMappingStatus ?? "partial")}`}>Variants: {brain?.providerAdapter.variantMappingStatus ?? "unknown"}</span>
        <span className={`rounded-full border px-3 py-2 ${statusClass(brain?.providerAdapter.imageStatus ?? "partial")}`}>Images: {brain?.providerAdapter.imageStatus ?? "unknown"}</span>
        <span className={`rounded-full border px-3 py-2 ${statusClass(brain?.providerAdapter.priceStatus ?? "partial")}`}>Price: {brain?.providerAdapter.priceStatus ?? "unknown"}</span>
        <span className={`rounded-full border px-3 py-2 ${statusClass(brain?.providerAdapter.stockStatus ?? "partial")}`}>Stock: {brain?.providerAdapter.stockStatus ?? "unknown"}</span>
        <span className={`rounded-full border px-3 py-2 ${statusClass(brain?.providerAdapter.sizeGuideStatus ?? "partial")}`}>Size cm: {brain?.providerAdapter.sizeGuideStatus ?? "unknown"}</span>
      </div>

      <div className="mt-5 rounded-2xl border border-velmere-gold/[0.18] bg-velmere-gold/[0.055] p-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-velmere-gold">{locale === "pl" ? "Najpierw tylko to" : locale === "de" ? "Zuerst nur das" : "Only this first"}</p>
            <h3 className="mt-1 font-serif text-2xl text-white">{locale === "pl" ? "Dodaj zdjęcia, sprawdź cenę, ustaw dział sklepu" : locale === "de" ? "Bilder, Preis und Shop-Bereich prüfen" : "Add photos, check price, set shop section"}</h3>
          </div>
          <label className="min-w-[15rem]">
            <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/[0.42]">{locale === "pl" ? "Dział sklepu" : locale === "de" ? "Shop-Bereich" : "Shop section"}</span>
            <select
              value={audience}
              onChange={(event) => setAudience(event.target.value as "men" | "women" | "unisex")}
              className="mt-2 h-11 w-full rounded-xl border border-white/[0.10] bg-black/[0.45] px-3 text-sm text-white outline-none focus:border-velmere-gold"
            >
              <option value="unisex">Unisex — Men + Women</option>
              <option value="men">Men only</option>
              <option value="women">Women only</option>
            </select>
          </label>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {simpleReadyChecks.map((item) => (
            <div key={item.label} className={`rounded-2xl border p-3 ${item.ok ? "border-emerald-300/[0.18] bg-emerald-500/[0.04]" : "border-red-300/[0.20] bg-red-500/[0.05]"}`}>
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/[0.42]">{item.label}</p>
              <p className="mt-1 text-xl font-semibold text-white">{item.value}</p>
              <p className="mt-1 text-xs leading-5 text-white/[0.50]">{item.help}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-6 grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="space-y-5">
          <div className="rounded-2xl border border-white/[0.08] bg-black/[0.24] p-4">
            <div className="flex items-center gap-2 text-white">
              <ClipboardCheck className="h-4 w-4 text-velmere-gold" aria-hidden="true" />
              <h3 className="font-semibold">{copy.detected}</h3>
            </div>
            <div className="mt-4 grid gap-3 text-sm text-white/[0.62] sm:grid-cols-2">
              <p>Type: <span className="text-white">{brain?.detected.garmentType ?? "unknown"}</span></p>
              <p>Confidence: <span className="text-white">{brain?.detected.confidence ?? "-"}/100</span></p>
              <p>Color: <span className="text-white">{brain?.detected.color ?? "-"}</span></p>
              <p>Fit: <span className="text-white">{brain?.detected.fit ?? "-"}</span></p>
              <p>Weight: <span className="text-white">{brain?.detected.weight ?? "-"}</span></p>
              <p>Sizes: <span className="text-white">{brain?.detected.sizes.join("/") || sizesText || "-"}</span></p>
            </div>
          </div>

          <div className="rounded-2xl border border-white/[0.08] bg-black/[0.24] p-4">
            <div className="flex items-center gap-2 text-white">
              <CircleAlert className="h-4 w-4 text-velmere-gold" aria-hidden="true" />
              <h3 className="font-semibold">{copy.missing}</h3>
            </div>
            <div className="mt-4 space-y-3">
              {brain?.readiness.missing.length ? brain.readiness.missing.map((item) => (
                <div key={item.id} className={`rounded-xl border p-3 ${item.blocksActivePublish ? "border-red-300/[0.20] bg-red-500/[0.05]" : "border-white/[0.08] bg-white/[0.03]"}`}>
                  <p className="text-sm font-semibold text-white">{item.label}</p>
                  <p className="mt-1 text-xs leading-5 text-white/[0.52]">{item.reason}</p>
                  <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.16em] text-white/[0.34]">{item.blocksActivePublish ? "blocks active publish" : "review only"}</p>
                </div>
              )) : (
                <p className="rounded-xl border border-emerald-300/[0.18] bg-emerald-500/[0.05] p-3 text-sm text-emerald-100/[0.74]">No blocking Product Brain gaps after last check.</p>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-white/[0.08] bg-black/[0.24] p-4">
            <h3 className="font-semibold text-white">{copy.checklist}</h3>
            <div className="mt-4 space-y-2">
              {(brain?.readiness.checklist ?? []).map((item) => (
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

        <div className="space-y-5">
          <div className="rounded-2xl border border-white/[0.08] bg-black/[0.24] p-4">
            <div className="flex items-center gap-2 text-white">
              <Save className="h-4 w-4 text-velmere-gold" aria-hidden="true" />
              <h3 className="font-semibold">{copy.saveHint}</h3>
            </div>
          </div>

          <div className="rounded-2xl border border-velmere-gold/[0.22] bg-velmere-gold/[0.055] p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <Label>1 / {copy.images}</Label>
                <p className="mt-2 text-xs leading-6 text-white/[0.58]">{copy.uploadHelp}</p>
                <p className="mt-1 text-xs leading-6 text-white/[0.42]">Pierwsze zdjęcie jest główne na shopie. AI i Printful nie dodają tutaj żadnych zdjęć.</p>
              </div>
              <span className="inline-flex w-fit rounded-full border border-white/[0.10] px-3 py-2 font-mono text-[10px] uppercase tracking-[0.16em] text-white/[0.54]">
                {copy.imageCount}: {product.images.length}/{MAX_PRODUCT_IMAGES}
              </span>
            </div>
            <div className="mt-4 flex flex-wrap gap-3">
              <label className={`inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-full border px-5 text-[10px] font-semibold uppercase tracking-[0.16em] transition ${product.images.length >= MAX_PRODUCT_IMAGES ? "cursor-not-allowed border-white/[0.08] text-white/[0.28]" : "border-velmere-gold/[0.32] bg-black/[0.20] text-velmere-gold hover:bg-velmere-gold hover:text-black"}`}>
                <ImagePlus className="h-4 w-4" aria-hidden="true" />
                {product.images.length >= MAX_PRODUCT_IMAGES ? copy.imageLimitReached : copy.uploadImages}
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  disabled={product.images.length >= MAX_PRODUCT_IMAGES}
                  onChange={(event) => {
                    void handleManualImageUpload(event.currentTarget.files);
                    event.currentTarget.value = "";
                  }}
                  className="sr-only"
                />
              </label>
              <button
                type="button"
                onClick={() => onRecheck(draft.draftId)}
                disabled={busy}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-white/[0.12] px-5 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/[0.62] hover:border-velmere-gold/[0.30] hover:text-velmere-gold disabled:cursor-not-allowed disabled:opacity-50"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <RotateCcw className="h-4 w-4" aria-hidden="true" />}
                {copy.recheck}
              </button>
            </div>
            {product.images.length > 0 ? (
              <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {product.images.map((image, index) => (
                  <div key={`quick-${image.url}-${index}`} className="overflow-hidden rounded-2xl border border-white/[0.08] bg-black/[0.24]">
                    <div className="relative aspect-[4/5] bg-black/[0.28]">
                      <Image src={image.url} alt={getLocalizedLabel(image.alt)} width={96} height={128} unoptimized className="h-full w-full object-cover" />
                      {index === 0 ? (
                        <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full border border-velmere-gold/[0.24] bg-black/[0.72] px-2.5 py-1 font-mono text-[9px] uppercase tracking-[0.14em] text-velmere-gold">
                          <Star className="h-3 w-3" aria-hidden="true" />
                          {copy.primaryImage}
                        </span>
                      ) : null}
                    </div>
                    <div className="space-y-2 p-3">
                      <button type="button" disabled={index === 0} onClick={() => setPrimaryImage(index)} className="inline-flex min-h-9 w-full items-center justify-center rounded-full border border-white/[0.10] px-3 text-[9px] font-semibold uppercase tracking-[0.14em] text-white/[0.58] transition hover:border-velmere-gold/[0.30] hover:text-velmere-gold disabled:cursor-default disabled:border-velmere-gold/[0.20] disabled:text-velmere-gold/[0.70]">
                        {index === 0 ? copy.primaryImage : copy.setPrimaryImage}
                      </button>
                      <button type="button" onClick={() => removeImage(index)} className="inline-flex min-h-9 w-full items-center justify-center gap-2 rounded-full border border-red-300/[0.16] px-3 text-[9px] font-semibold uppercase tracking-[0.14em] text-red-100/[0.70] transition hover:border-red-200/[0.30] hover:text-red-50">
                        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                        {copy.removeImage}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-4 rounded-2xl border border-red-300/[0.16] bg-red-500/[0.045] p-4 text-sm text-red-50/[0.70]">Dodaj minimum 1 zdjęcie, żeby produkt miał kartę na shopie. Zalecane: front, back, detail/model.</div>
            )}
          </div>

          <div className="rounded-2xl border border-white/[0.08] bg-black/[0.24] p-4">
            <Label>{copy.price}</Label>
            <input
              inputMode="decimal"
              value={euroCentsToInput(product.price.amount)}
              onChange={(event) => {
                patchProduct({ price: { amount: inputToEuroCents(event.target.value), currency: "EUR" } });
              }}
              className={inputClass("max-w-xs")}
            />
          </div>

          <LocalizedInputs label={`${copy.productCopy} / title`} value={product.title} onChange={(title) => patchProduct({ title })} />
          <LocalizedInputs label={`${copy.productCopy} / short`} value={product.shortDescription} onChange={(shortDescription) => patchProduct({ shortDescription })} textarea />
          <LocalizedInputs label={`${copy.productCopy} / full`} value={product.description} onChange={(description) => patchProduct({ description })} textarea />

          <div className="rounded-2xl border border-white/[0.08] bg-black/[0.24] p-4">
            <Label>2 / {copy.variants}</Label>
            <p className="mt-2 text-xs leading-6 text-white/[0.42]">Rozmiary/SKU z Printful są już wpisane. Normalnie musisz tylko sprawdzić ceny i ewentualnie tabelę cm później.</p>
            <input
              value={sizesText}
              placeholder={copy.sizeInput}
              onChange={(event) => {
                const variants = buildVariantsFromSizes(product, event.target.value);
                const nextTruth = ensureTruth({ ...product, variants });
                patchProduct({
                  variants,
                  providerVariantIds: rebuildProviderVariantIds(variants),
                  truth: {
                    ...nextTruth,
                    sizeGuide: {
                      ...nextTruth.sizeGuide,
                      measurements: buildMeasurementsForSizes(variants, truth),
                    },
                  },
                });
              }}
              className={inputClass()}
            />

            <details className="mt-5 rounded-2xl border border-velmere-gold/[0.14] bg-velmere-gold/[0.045] p-4">
              <summary className="cursor-pointer font-semibold text-white">
                {locale === "pl" ? "Zaawansowane: SKU / provider ID" : locale === "de" ? "Erweitert: SKU / Provider ID" : "Advanced: SKU / provider ID"}
                <span className="ml-3 font-mono text-[10px] uppercase tracking-[0.16em] text-white/[0.42]">{product.variants.length} variants</span>
              </summary>
              <p className="mt-3 text-xs leading-6 text-white/[0.50]">{copy.providerMappingHelp}</p>
              <div className="mt-4 overflow-x-auto rounded-xl border border-white/[0.08]">
                <table className="min-w-[920px] w-full border-collapse text-left text-xs">
                  <thead className="bg-white/[0.04] font-mono uppercase tracking-[0.14em] text-white/[0.38]">
                    <tr>
                      <th className="px-3 py-3">Size</th>
                      <th className="px-3 py-3">{copy.color}</th>
                      <th className="px-3 py-3">{copy.sku}</th>
                      <th className="px-3 py-3">{copy.providerId}</th>
                      <th className="px-3 py-3">{copy.variantPrice}</th>
                      <th className="px-3 py-3">{copy.stock}</th>
                      <th className="px-3 py-3">{copy.available}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {product.variants.map((variant, index) => (
                      <tr key={variant.id} className="border-t border-white/[0.06] align-top">
                        <td className="px-3 py-3">
                          <input
                            value={variant.size || variant.title}
                            onChange={(event) => patchDraft(patchVariant(product, index, { size: normalizeSize(event.target.value), title: normalizeSize(event.target.value) }))}
                            className={inputClass("mt-0 min-w-24")}
                          />
                        </td>
                        <td className="px-3 py-3">
                          <input
                            value={variant.color ?? ""}
                            onChange={(event) => patchDraft(patchVariant(product, index, { color: event.target.value }))}
                            className={inputClass("mt-0 min-w-28")}
                          />
                        </td>
                        <td className="px-3 py-3">
                          <input
                            value={variant.sku ?? ""}
                            onChange={(event) => patchDraft(patchVariant(product, index, { sku: event.target.value }))}
                            className={inputClass("mt-0 min-w-36 font-mono")}
                          />
                        </td>
                        <td className="px-3 py-3">
                          <input
                            value={variant.providerVariantId ?? product.providerVariantIds?.[variant.id] ?? ""}
                            onChange={(event) => patchDraft(patchVariant(product, index, { providerVariantId: event.target.value }))}
                            className={inputClass("mt-0 min-w-36 font-mono")}
                          />
                        </td>
                        <td className="px-3 py-3">
                          <input
                            inputMode="decimal"
                            value={euroCentsToInput(variant.price?.amount ?? product.price.amount)}
                            onChange={(event) => patchDraft(patchVariant(product, index, { price: { amount: inputToEuroCents(event.target.value), currency: "EUR" } }))}
                            className={inputClass("mt-0 min-w-28")}
                          />
                        </td>
                        <td className="px-3 py-3">
                          <input
                            inputMode="numeric"
                            value={typeof variant.stockQuantity === "number" ? String(variant.stockQuantity) : ""}
                            onChange={(event) => {
                              const stock = event.target.value.trim() ? Number(event.target.value) : undefined;
                              patchDraft(patchVariant(product, index, { stockQuantity: Number.isFinite(stock) ? stock : undefined }));
                            }}
                            className={inputClass("mt-0 min-w-24")}
                          />
                        </td>
                        <td className="px-3 py-3">
                          <label className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-white/[0.10] px-3 text-white/[0.62]">
                            <input
                              type="checkbox"
                              checked={Boolean(variant.available)}
                              onChange={(event) => patchDraft(patchVariant(product, index, { available: event.target.checked, providerStatus: event.target.checked ? "synced" : "unsynced" }))}
                            />
                            <span>{variant.providerStatus ?? (variant.available ? "synced" : "unknown")}</span>
                          </label>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>

            <details className="mt-5 rounded-2xl border border-white/[0.08] bg-black/[0.24] p-4">
              <summary className="cursor-pointer font-semibold text-white">
                {locale === "pl" ? "Opcjonalne: tabela rozmiarów w cm" : locale === "de" ? "Optional: Größentabelle in cm" : "Optional: size chart in cm"}
                <span className="ml-3 font-mono text-[10px] uppercase tracking-[0.16em] text-white/[0.42]">later</span>
              </summary>
              <Label>{copy.sizeChartCm}</Label>
              <p className="mt-2 text-xs leading-6 text-white/[0.50]">{copy.sizeChartHelp}</p>
              <div className="mt-4 overflow-x-auto rounded-xl border border-white/[0.08]">
                <table className="min-w-[880px] w-full border-collapse text-left text-xs">
                  <thead className="bg-white/[0.04] font-mono uppercase tracking-[0.14em] text-white/[0.38]">
                    <tr>
                      <th className="px-3 py-3">Size</th>
                      <th className="px-3 py-3">{copy.chest}</th>
                      <th className="px-3 py-3">{copy.length}</th>
                      <th className="px-3 py-3">{copy.shoulders}</th>
                      <th className="px-3 py-3">{copy.sleeve}</th>
                      <th className="px-3 py-3">{copy.waist}</th>
                      <th className="px-3 py-3">{copy.hip}</th>
                      <th className="px-3 py-3">{copy.inseam}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {measurements.map((measurement, index) => {
                      const patchMeasurement = (patch: Partial<ProductSizeMeasurement>) => {
                        const next = measurements.map((item, measurementIndex) => (measurementIndex === index ? { ...item, ...patch } : item));
                        patchTruth({ sizeGuide: { ...truth.sizeGuide, measurements: next } });
                      };
                      return (
                        <tr key={`${measurement.size}-${index}`} className="border-t border-white/[0.06] align-top">
                          <td className="px-3 py-3">
                            <input value={measurement.size} onChange={(event) => patchMeasurement({ size: normalizeSize(event.target.value) })} className={inputClass("mt-0 min-w-20")} />
                          </td>
                          <td className="px-3 py-3"><input value={measurement.chest ?? ""} onChange={(event) => patchMeasurement({ chest: event.target.value })} className={inputClass("mt-0 min-w-20")} /></td>
                          <td className="px-3 py-3"><input value={measurement.length ?? ""} onChange={(event) => patchMeasurement({ length: event.target.value })} className={inputClass("mt-0 min-w-20")} /></td>
                          <td className="px-3 py-3"><input value={measurement.shoulders ?? ""} onChange={(event) => patchMeasurement({ shoulders: event.target.value })} className={inputClass("mt-0 min-w-20")} /></td>
                          <td className="px-3 py-3"><input value={measurement.sleeve ?? ""} onChange={(event) => patchMeasurement({ sleeve: event.target.value })} className={inputClass("mt-0 min-w-20")} /></td>
                          <td className="px-3 py-3"><input value={measurement.waist ?? ""} onChange={(event) => patchMeasurement({ waist: event.target.value })} className={inputClass("mt-0 min-w-20")} /></td>
                          <td className="px-3 py-3"><input value={measurement.hip ?? ""} onChange={(event) => patchMeasurement({ hip: event.target.value })} className={inputClass("mt-0 min-w-20")} /></td>
                          <td className="px-3 py-3"><input value={measurement.inseam ?? ""} onChange={(event) => patchMeasurement({ inseam: event.target.value })} className={inputClass("mt-0 min-w-20")} /></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </details>
          </div>

          <details className="rounded-2xl border border-white/[0.08] bg-black/[0.18] p-4">
            <summary className="cursor-pointer font-mono text-[10px] uppercase tracking-[0.18em] text-white/[0.48]">Advanced image URL fallback</summary>
            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <Label>{copy.images}</Label>
                <p className="mt-2 text-xs leading-6 text-white/[0.50]">{copy.manualImagesNote}</p>
                <p className="mt-2 text-xs leading-6 text-velmere-gold/[0.72]">{copy.uploadHelp}</p>
              </div>
              <span className="inline-flex w-fit rounded-full border border-white/[0.10] px-3 py-2 font-mono text-[10px] uppercase tracking-[0.16em] text-white/[0.48]">
                {copy.imageCount}: {product.images.length}/{MAX_PRODUCT_IMAGES}
              </span>
            </div>

            <div className="mt-4 flex flex-wrap gap-3">
              <label className={`inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-full border px-5 text-[10px] font-semibold uppercase tracking-[0.16em] transition ${product.images.length >= MAX_PRODUCT_IMAGES ? "cursor-not-allowed border-white/[0.08] text-white/[0.28]" : "border-velmere-gold/[0.32] text-velmere-gold hover:bg-velmere-gold hover:text-black"}`}>
                <ImagePlus className="h-4 w-4" aria-hidden="true" />
                {product.images.length >= MAX_PRODUCT_IMAGES ? copy.imageLimitReached : copy.uploadImages}
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  disabled={product.images.length >= MAX_PRODUCT_IMAGES}
                  onChange={(event) => {
                    void handleManualImageUpload(event.currentTarget.files);
                    event.currentTarget.value = "";
                  }}
                  className="sr-only"
                />
              </label>
            </div>

            {product.images.length > 0 ? (
              <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {product.images.map((image, index) => (
                  <div key={`${image.url}-${index}`} className="overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.035]">
                    <div className="relative aspect-[4/5] bg-black/[0.28]">
                      <Image src={image.url} alt={getLocalizedLabel(image.alt)} width={96} height={128} unoptimized className="h-full w-full object-cover" />
                      {index === 0 ? (
                        <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full border border-velmere-gold/[0.24] bg-black/[0.72] px-2.5 py-1 font-mono text-[9px] uppercase tracking-[0.14em] text-velmere-gold">
                          <Star className="h-3 w-3" aria-hidden="true" />
                          {copy.primaryImage}
                        </span>
                      ) : null}
                    </div>
                    <div className="space-y-2 p-3">
                      <button
                        type="button"
                        disabled={index === 0}
                        onClick={() => setPrimaryImage(index)}
                        className="inline-flex min-h-9 w-full items-center justify-center rounded-full border border-white/[0.10] px-3 text-[9px] font-semibold uppercase tracking-[0.14em] text-white/[0.58] transition hover:border-velmere-gold/[0.30] hover:text-velmere-gold disabled:cursor-default disabled:border-velmere-gold/[0.20] disabled:text-velmere-gold/[0.70]"
                      >
                        {index === 0 ? copy.primaryImage : copy.setPrimaryImage}
                      </button>
                      <button
                        type="button"
                        onClick={() => removeImage(index)}
                        className="inline-flex min-h-9 w-full items-center justify-center gap-2 rounded-full border border-red-300/[0.16] px-3 text-[9px] font-semibold uppercase tracking-[0.14em] text-red-100/[0.70] transition hover:border-red-200/[0.30] hover:text-red-50"
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                        {copy.removeImage}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}

            <textarea
              value={imageText}
              rows={4}
              placeholder={copy.imageInput}
              onChange={(event) => patchProduct({ images: buildImagesFromText(product, event.target.value) })}
              className={inputClass("min-h-28 resize-y")}
            />
          </details>

          <LocalizedInputs label={copy.material} value={truth.material} onChange={(material) => patchTruth({ material })} />
          <LocalizedInputs label={copy.composition} value={truth.composition} onChange={(composition) => patchTruth({ composition })} />
          <LocalizedInputs label={copy.delivery} value={truth.deliveryNote} onChange={(deliveryNote) => patchTruth({ deliveryNote })} textarea />
          <LocalizedInputs label={copy.returns} value={truth.returnNote} onChange={(returnNote) => patchTruth({ returnNote })} textarea />

          <div className="rounded-2xl border border-white/[0.08] bg-black/[0.24] p-4">
            <Label>{copy.care}</Label>
            <textarea
              value={careText}
              rows={4}
              onChange={(event) => patchTruth({ care: splitValues(event.target.value).map(localizedSame) })}
              className={inputClass("min-h-28 resize-y")}
            />
          </div>

          {draft.validationErrors.length > 0 && (
            <div className="rounded-2xl border border-red-300/[0.20] bg-red-500/[0.05] p-4">
              <h3 className="text-sm font-semibold text-red-100">Validation errors still active</h3>
              <div className="mt-3 space-y-2 text-xs leading-5 text-red-50/[0.64]">
                {draft.validationErrors.map((error, errorIndex) => <p key={`${draft.draftId}:validation:${errorIndex}:${error.slice(0, 48)}`}>{error}</p>)}
              </div>
            </div>
          )}

          {brain?.providerAdapter.warnings.length ? (
            <div className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-4">
              <h3 className="text-sm font-semibold text-white">Provider adapter warnings</h3>
              <div className="mt-3 space-y-2 text-xs leading-5 text-white/[0.48]">
                {brain.providerAdapter.warnings.map((warning, warningIndex) => <p key={`${draft.draftId}:provider-warning:${warningIndex}:${warning.slice(0, 48)}`}>{warning}</p>)}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </section>
    </div>
  );
}
