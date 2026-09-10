import type {
  LocalizedString,
  Product,
  ProductBrainChecklistItem,
  ProductBrainMissingField,
  ProductBrainReadiness,
  ProductBrainResult,
  ProductImportDraft,
  ProductSizeMeasurement,
  ProductVariant,
} from "./types";
import {
  normalizeProductDraftThroughProviderAdapter,
  type VlmProviderAdapterSnapshot,
} from "./vlm-product-provider-adapter";

type Locale = "pl" | "en" | "de";

type GarmentType =
  | "hoodie"
  | "zip_hoodie"
  | "sweatshirt"
  | "tshirt"
  | "polo"
  | "pants"
  | "shorts"
  | "jacket"
  | "cap"
  | "bag"
  | "unknown";

export type VlmProductBrainRunOptions = {
  /** Preserve operator-edited title/description while recalculating detection, readiness and blockers. */
  preserveManualCopy?: boolean;
};

type ProductBrainSignal = {
  garmentType: GarmentType;
  typeConfidence: number;
  color?: string;
  fit?: "oversized" | "boxy" | "regular" | "slim";
  weight?: "light" | "mid" | "heavy";
  closure?: "zip" | "pullover";
  sizes: string[];
  materialHint?: string;
  sourceQuality: "strong" | "medium" | "weak";
};

const SIZE_ORDER = [
  "XXS",
  "XS",
  "S",
  "M",
  "L",
  "XL",
  "XXL",
  "XXXL",
  "2XL",
  "3XL",
  "4XL",
  "5XL",
];

const SIZE_PATTERN = /\b(XXS|XS|S|M|L|XL|XXL|XXXL|2XL|3XL|4XL|5XL)\b/gi;

const GARMENT_LABELS: Record<GarmentType, Record<Locale, string>> = {
  hoodie: { pl: "Bluza z kapturem", en: "Hoodie", de: "Hoodie" },
  zip_hoodie: {
    pl: "Bluza z kapturem Zip",
    en: "Zip Hoodie",
    de: "Zip-Hoodie",
  },
  sweatshirt: {
    pl: "Bluza crewneck",
    en: "Crewneck Sweatshirt",
    de: "Crewneck Sweatshirt",
  },
  tshirt: { pl: "T-shirt", en: "T-Shirt", de: "T-Shirt" },
  polo: { pl: "Polo", en: "Polo Shirt", de: "Polo-Shirt" },
  pants: { pl: "Spodnie", en: "Pants", de: "Hose" },
  shorts: { pl: "Szorty", en: "Shorts", de: "Shorts" },
  jacket: { pl: "Kurtka", en: "Jacket", de: "Jacke" },
  cap: { pl: "Czapka", en: "Cap", de: "Cap" },
  bag: { pl: "Torba", en: "Bag", de: "Tasche" },
  unknown: { pl: "Produkt", en: "Product", de: "Produkt" },
};

const COLOR_LABELS: Record<string, Record<Locale, string>> = {
  black: { pl: "czarna", en: "Black", de: "Schwarz" },
  white: { pl: "biała", en: "White", de: "Weiß" },
  grey: { pl: "szara", en: "Grey", de: "Grau" },
  gray: { pl: "szara", en: "Grey", de: "Grau" },
  cream: { pl: "kremowa", en: "Cream", de: "Creme" },
  beige: { pl: "beżowa", en: "Beige", de: "Beige" },
  navy: { pl: "granatowa", en: "Navy", de: "Navy" },
  blue: { pl: "niebieska", en: "Blue", de: "Blau" },
  red: { pl: "czerwona", en: "Red", de: "Rot" },
  green: { pl: "zielona", en: "Green", de: "Grün" },
  olive: { pl: "oliwkowa", en: "Olive", de: "Olive" },
  brown: { pl: "brązowa", en: "Brown", de: "Braun" },
  pink: { pl: "różowa", en: "Pink", de: "Pink" },
  charcoal: { pl: "grafitowa", en: "Charcoal", de: "Anthrazit" },
  natural: { pl: "naturalna", en: "Natural", de: "Natur" },
};

const MATERIAL_PATTERNS: Array<{ pattern: RegExp; label: LocalizedString }> = [
  {
    pattern: /organic cotton|bio.?baumwolle|bawełna organiczna/i,
    label: {
      pl: "bawełna organiczna",
      en: "organic cotton",
      de: "Bio-Baumwolle",
    },
  },
  {
    pattern: /cotton|baumwolle|bawełn/i,
    label: { pl: "bawełna", en: "cotton", de: "Baumwolle" },
  },
  {
    pattern: /fleece|polar/i,
    label: { pl: "dzianina fleece", en: "fleece knit", de: "Fleece-Strick" },
  },
  {
    pattern: /polyester/i,
    label: { pl: "poliester", en: "polyester", de: "Polyester" },
  },
  { pattern: /denim|jeans/i, label: { pl: "denim", en: "denim", de: "Denim" } },
  { pattern: /nylon/i, label: { pl: "nylon", en: "nylon", de: "Nylon" } },
  {
    pattern: /wool|wełn|wolle/i,
    label: { pl: "wełna", en: "wool", de: "Wolle" },
  },
];

function localized(pl: string, en: string, de: string): LocalizedString {
  return { pl, en, de };
}

function unique<T>(items: T[]): T[] {
  return Array.from(new Set(items.filter(Boolean)));
}

function clamp(value: number, min = 0, max = 100) {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, Math.round(value)));
}

function getSourceTitle(originalTitle?: LocalizedString) {
  return cleanText(
    [originalTitle?.en, originalTitle?.pl, originalTitle?.de]
      .filter(Boolean)
      .join(" "),
  );
}

function deriveStyleTokens(
  originalTitle: LocalizedString | undefined,
  signal: ProductBrainSignal,
) {
  const source = getSourceTitle(originalTitle).toLowerCase();
  const pl: string[] = [];
  const en: string[] = [];
  const de: string[] = [];

  if (/\bunisex\b/i.test(source)) {
    pl.push("Unisex");
    en.push("Unisex");
    de.push("Unisex");
  }
  if (/long\s*sleeve|longsleeve|długi rękaw|langarm/i.test(source)) {
    pl.push("Long Sleeve");
    en.push("Long Sleeve");
    de.push("Long Sleeve");
  }
  if (/dad\s*hat|baseball cap/i.test(source)) {
    pl.push("Dad Hat");
    en.push("Dad Hat");
    de.push("Dad Hat");
  } else if (/denim/i.test(source) && signal.garmentType === "cap") {
    pl.push("Denim");
    en.push("Denim");
    de.push("Denim");
  }
  if (
    /zip|zipped|full\s*zip|rozpinan|reißverschluss/i.test(source) &&
    signal.garmentType === "hoodie"
  ) {
    pl.push("Zip");
    en.push("Zip");
    de.push("Zip");
  }

  return { pl: unique(pl), en: unique(en), de: unique(de) };
}

function sizeSentence(signal: ProductBrainSignal, locale: Locale) {
  if (!signal.sizes.length) {
    if (locale === "pl") return "Rozmiary wymagają ręcznej kontroli w adminie.";
    if (locale === "de")
      return "Größen müssen im Admin manuell geprüft werden.";
    return "Sizes need manual review in the admin panel.";
  }
  const sizes = signal.sizes.join(" / ");
  if (locale === "pl") return `Wykryte rozmiary: ${sizes}.`;
  if (locale === "de") return `Erkannte Größen: ${sizes}.`;
  return `Detected sizes: ${sizes}.`;
}

function reviewSentence(locale: Locale) {
  if (locale === "pl")
    return "Przed aktywną sprzedażą uzupełnij zdjęcia, skład, tabelę cm, dostawę i zwroty.";
  if (locale === "de")
    return "Vor aktivem Verkauf Bilder, Zusammensetzung, cm-Tabelle, Lieferung und Rückgabe ergänzen.";
  return "Before active sale, add images, composition, cm size chart, delivery and returns.";
}

function cleanText(value: string) {
  return value
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function hasConfirmedTruthProfile(product: Product) {
  if (!product.truth) return false;
  const truthText = cleanText(
    [
      product.truth.material.pl,
      product.truth.material.en,
      product.truth.material.de,
      product.truth.composition.pl,
      product.truth.composition.en,
      product.truth.composition.de,
    ].join(" "),
  );
  return truthText.length > 2;
}

function readDraftCorpus(product: Product) {
  return cleanText(
    [
      product.slug,
      product.provider,
      product.providerProductId,
      product.externalUrl,
      product.title.pl,
      product.title.en,
      product.title.de,
      product.shortDescription.pl,
      product.shortDescription.en,
      product.shortDescription.de,
      product.description.pl,
      product.description.en,
      product.description.de,
      product.truth?.material.pl,
      product.truth?.composition.en,
      ...product.tags,
      ...product.images.flatMap((image) => [
        image.alt.pl,
        image.alt.en,
        image.alt.de,
      ]),
      ...product.variants.flatMap((variant) => [
        variant.title,
        variant.size,
        variant.color,
        variant.sku,
        variant.providerVariantId,
        variant.providerStatus,
        typeof variant.stockQuantity === "number"
          ? String(variant.stockQuantity)
          : undefined,
      ]),
    ]
      .filter(Boolean)
      .join(" "),
  );
}

function detectGarmentType(corpus: string): {
  garmentType: GarmentType;
  confidence: number;
} {
  const text = corpus.toLowerCase();
  const has = (pattern: RegExp) => pattern.test(text);

  if (
    has(/\b(zip|zipped|full zip|rozpinana|reißverschluss)\b/) &&
    has(/\b(hoodie|hood|kaptur|kapuze)\b/)
  ) {
    return { garmentType: "zip_hoodie", confidence: 96 };
  }
  if (has(/\b(hoodie|hooded|hood|kaptur|kapuze)\b/))
    return { garmentType: "hoodie", confidence: 92 };
  if (has(/\bpolo\b/)) return { garmentType: "polo", confidence: 94 };
  if (has(/\b(t[- ]?shirt|tee|koszulka)\b/))
    return { garmentType: "tshirt", confidence: 90 };
  if (has(/\b(sweatshirt|crewneck|bluza|pullover)\b/))
    return { garmentType: "sweatshirt", confidence: 86 };
  if (has(/\b(pants|trousers|jogger|sweatpants|spodnie|hose)\b/))
    return { garmentType: "pants", confidence: 88 };
  if (has(/\b(shorts|szorty)\b/))
    return { garmentType: "shorts", confidence: 88 };
  if (has(/\b(jacket|varsity|bomber|kurtka|jacke)\b/))
    return { garmentType: "jacket", confidence: 88 };
  if (has(/\b(cap|hat|czapka|mütze)\b/))
    return { garmentType: "cap", confidence: 82 };
  if (has(/\b(bag|tote|torba|tasche)\b/))
    return { garmentType: "bag", confidence: 82 };
  return { garmentType: "unknown", confidence: 28 };
}

function normalizeSize(value: string) {
  const upper = value.toUpperCase();
  if (upper === "2XL") return "XXL";
  if (upper === "3XL") return "XXXL";
  return upper;
}

function detectSizes(product: Product, corpus: string) {
  const fromVariants = product.variants
    .flatMap((variant) => [variant.size, variant.title])
    .filter(Boolean)
    .map(
      (value) =>
        String(value)
          .toUpperCase()
          .match(/\b(XXS|XS|S|M|L|XL|XXL|XXXL|2XL|3XL|4XL|5XL)\b/)?.[1],
    )
    .filter(Boolean)
    .map((value) => normalizeSize(value as string));

  const fromText = Array.from(corpus.toUpperCase().matchAll(SIZE_PATTERN)).map(
    (match) => normalizeSize(match[1]),
  );
  return unique([...fromVariants, ...fromText]).sort((a, b) => {
    const ai = SIZE_ORDER.indexOf(a);
    const bi = SIZE_ORDER.indexOf(b);
    return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
  });
}

function detectColor(corpus: string) {
  const text = corpus.toLowerCase();
  return Object.keys(COLOR_LABELS).find((color) =>
    new RegExp(`\\b${color}\\b`, "i").test(text),
  );
}

function detectFit(corpus: string): ProductBrainSignal["fit"] {
  if (/oversize|oversized|relaxed|loose|luźn|locker/i.test(corpus))
    return "oversized";
  if (/boxy|cropped box/i.test(corpus)) return "boxy";
  if (/slim|fitted|dopasowan/i.test(corpus)) return "slim";
  if (/regular|classic|standard/i.test(corpus)) return "regular";
  return undefined;
}

function detectWeight(corpus: string): ProductBrainSignal["weight"] {
  if (/heavy|heavyweight|450gsm|400gsm|gruba|schwer/i.test(corpus))
    return "heavy";
  if (/light|lightweight|lekka|leicht/i.test(corpus)) return "light";
  if (/midweight|medium|średni/i.test(corpus)) return "mid";
  return undefined;
}

function detectMaterial(corpus: string): LocalizedString | undefined {
  return MATERIAL_PATTERNS.find((entry) => entry.pattern.test(corpus))?.label;
}

function inferSignal(
  product: Product,
  adapter: VlmProviderAdapterSnapshot,
): ProductBrainSignal {
  const corpus = readDraftCorpus(product);
  const type = detectGarmentType(corpus);
  const material = detectMaterial(corpus);
  const sizes = detectSizes(product, corpus);
  const color = detectColor(corpus);
  return {
    garmentType: type.garmentType,
    typeConfidence: type.confidence,
    color,
    fit: detectFit(corpus),
    weight: detectWeight(corpus),
    closure: /\b(zip|zipped|full zip|rozpinana|reißverschluss)\b/i.test(corpus)
      ? "zip"
      : /pullover/i.test(corpus)
        ? "pullover"
        : undefined,
    sizes,
    materialHint: material?.en,
    sourceQuality: adapter.sourceQuality,
  };
}

function buildTitle(
  signal: ProductBrainSignal,
  originalTitle?: LocalizedString,
): LocalizedString {
  const type = GARMENT_LABELS[signal.garmentType];
  const color = signal.color ? COLOR_LABELS[signal.color] : undefined;
  const weight =
    signal.weight === "heavy"
      ? { pl: "Heavyweight", en: "Heavyweight", de: "Heavyweight" }
      : signal.weight === "light"
        ? { pl: "Lightweight", en: "Lightweight", de: "Lightweight" }
        : undefined;
  const fit =
    signal.fit === "oversized"
      ? { pl: "Oversize", en: "Oversized", de: "Oversized" }
      : signal.fit === "boxy"
        ? { pl: "Boxy", en: "Boxy", de: "Boxy" }
        : undefined;
  const style = deriveStyleTokens(originalTitle, signal);

  return {
    pl: unique([
      "Velmère",
      ...style.pl,
      type.pl,
      weight?.pl,
      fit?.pl,
      color?.pl,
    ]).join(" "),
    en: unique([
      "Velmère",
      color?.en,
      weight?.en,
      fit?.en,
      ...style.en,
      type.en,
    ]).join(" "),
    de: unique([
      "Velmère",
      color?.de,
      weight?.de,
      fit?.de,
      ...style.de,
      type.de,
    ]).join(" "),
  };
}

function buildShortDescription(
  signal: ProductBrainSignal,
  originalTitle?: LocalizedString,
): LocalizedString {
  const type = GARMENT_LABELS[signal.garmentType];
  const color = signal.color ? COLOR_LABELS[signal.color] : undefined;
  const sourceName = getSourceTitle(originalTitle);
  return {
    pl: `${sourceName ? `Import „${sourceName}”. ` : ""}Produkt zapisany jako ${type.pl.toLowerCase()}${color ? ` w kolorze ${color.pl}` : ""}. ${sizeSentence(signal, "pl")} ${reviewSentence("pl")}`,
    en: `${sourceName ? `Import “${sourceName}”. ` : ""}Saved as a ${color ? `${color.en.toLowerCase()} ` : ""}${type.en.toLowerCase()}. ${sizeSentence(signal, "en")} ${reviewSentence("en")}`,
    de: `${sourceName ? `Import „${sourceName}”. ` : ""}Gespeichert als ${color ? `${color.de.toLowerCase()} ` : ""}${type.de}. ${sizeSentence(signal, "de")} ${reviewSentence("de")}`,
  };
}

function buildDescription(
  signal: ProductBrainSignal,
  originalTitle: LocalizedString,
): LocalizedString {
  const type = GARMENT_LABELS[signal.garmentType];
  const color = signal.color ? COLOR_LABELS[signal.color] : undefined;
  const sourceName = getSourceTitle(originalTitle);
  return {
    pl: `${sourceName ? `Import Printful/CSV: „${sourceName}”. ` : ""}VLM Product Brain rozpoznał ${type.pl.toLowerCase()}${color ? ` w kolorze ${color.pl}` : ""} i zmapował warianty rozmiarowe. ${sizeSentence(signal, "pl")} Ten opis jest bezpiecznym szkicem: nie obiecuje materiału, gramatury ani czasu dostawy, dopóki nie wpiszesz ich ręcznie w adminie. ${reviewSentence("pl")}`,
    en: `${sourceName ? `Printful/CSV import: “${sourceName}”. ` : ""}VLM Product Brain identified a ${color ? `${color.en.toLowerCase()} ` : ""}${type.en.toLowerCase()} and mapped the size variants. ${sizeSentence(signal, "en")} This is a safe draft: it does not promise material, weight or delivery timing until you add them manually in admin. ${reviewSentence("en")}`,
    de: `${sourceName ? `Printful/CSV Import: „${sourceName}”. ` : ""}VLM Product Brain hat ${color ? `${color.de.toLowerCase()} ` : ""}${type.de} erkannt und Größenvarianten zugeordnet. ${sizeSentence(signal, "de")} Dies ist ein sicherer Entwurf: Material, Gewicht und Lieferzeit werden nicht versprochen, bis du sie im Admin manuell ergänzt. ${reviewSentence("de")}`,
  };
}

function buildSizeGuide(signal: ProductBrainSignal): ProductSizeMeasurement[] {
  return signal.sizes.map((size) => ({ size }));
}

function buildTruth(
  signal: ProductBrainSignal,
  originalTruth: Product["truth"],
): NonNullable<Product["truth"]> {
  const type = GARMENT_LABELS[signal.garmentType];
  const material = detectMaterial(signal.materialHint ?? "");
  const safeMaterial =
    material ??
    localized(
      "Materiał wymaga potwierdzenia providera.",
      "Material requires provider confirmation.",
      "Material erfordert Provider-Bestätigung.",
    );
  const fit =
    signal.fit === "oversized"
      ? localized(
          "Oversize, do potwierdzenia po size-chart QA.",
          "Oversized, pending size-chart QA.",
          "Oversized, bis Size-Chart-QA bestätigt ist.",
        )
      : signal.fit === "boxy"
        ? localized(
            "Boxy, do potwierdzenia po size-chart QA.",
            "Boxy, pending size-chart QA.",
            "Boxy, bis Size-Chart-QA bestätigt ist.",
          )
        : signal.fit === "slim"
          ? localized(
              "Slim, do potwierdzenia po size-chart QA.",
              "Slim, pending size-chart QA.",
              "Slim, bis Size-Chart-QA bestätigt ist.",
            )
          : localized(
              "Regular, do potwierdzenia po size-chart QA.",
              "Regular, pending size-chart QA.",
              "Regular, bis Size-Chart-QA bestätigt ist.",
            );

  return {
    material: originalTruth?.material ?? safeMaterial,
    composition:
      originalTruth?.composition ??
      localized(
        "Skład nie został potwierdzony w imporcie. Nie publikować jako aktywne bez finalnego składu od providera.",
        "Composition was not confirmed in the import. Do not publish as active without final provider composition.",
        "Zusammensetzung wurde im Import nicht bestätigt. Nicht aktiv veröffentlichen ohne finale Provider-Zusammensetzung.",
      ),
    weight:
      originalTruth?.weight ??
      (signal.weight === "heavy"
        ? "heavyweight signal"
        : signal.weight === "light"
          ? "lightweight signal"
          : undefined),
    fit: originalTruth?.fit ?? fit,
    care: originalTruth?.care?.length
      ? originalTruth.care
      : [
          localized(
            "Prać zgodnie z metką providera; przed publikacją sprawdzić finalne care instructions.",
            "Wash according to the provider care label; verify final care instructions before publishing.",
            "Nach Pflegeetikett des Providers waschen; finale Pflegehinweise vor Veröffentlichung prüfen.",
          ),
          localized(
            "Nie obiecywać odporności nadruku ani trwałości bez testu próbki.",
            "Do not promise print durability or garment longevity without a sample test.",
            "Keine Druckhaltbarkeit oder Langlebigkeit ohne Sample-Test versprechen.",
          ),
        ],
    sizeGuide: originalTruth?.sizeGuide ?? {
      note: localized(
        `${type.pl}: VLM Brain rozpoznał rozmiary z wariantów, ale wymiary w cm muszą pochodzić z providera lub sample QA.`,
        `${type.en}: VLM Brain detected sizes from variants, but cm measurements must come from the provider or sample QA.`,
        `${type.de}: VLM Brain hat Größen aus Varianten erkannt; cm-Maße müssen vom Provider oder Sample-QA kommen.`,
      ),
      measurements: buildSizeGuide(signal),
    },
    deliveryNote:
      originalTruth?.deliveryNote ??
      localized(
        "Dostawa i fulfillment wymagają potwierdzenia providera przed aktywnym checkoutem.",
        "Delivery and fulfilment require provider confirmation before active checkout.",
        "Lieferung und Fulfilment brauchen Provider-Bestätigung vor aktivem Checkout.",
      ),
    returnNote:
      originalTruth?.returnNote ??
      localized(
        "Polityka zwrotów musi być widoczna przed płatnością; produkty personalizowane wymagają osobnego komunikatu.",
        "Return policy must be visible before payment; personalised products need a separate notice.",
        "Rückgabepolitik muss vor Zahlung sichtbar sein; personalisierte Produkte brauchen gesonderten Hinweis.",
      ),
    launchNote:
      originalTruth?.launchNote ??
      localized(
        "VLM Product Brain uzupełnił szkic. Zdjęcia są manual-only: ręcznie sprawdź nazwę, finalne media, size chart, SKU, mapping wariantów, shipping i marżę.",
        "VLM Product Brain enriched this draft. Images are manual-only: manually verify title, final media, size chart, SKU, variant mapping, shipping and margin.",
        "VLM Product Brain hat den Entwurf ergänzt. Bilder sind manual-only: Titel, finale Medien, Size Chart, SKU, Varianten-Mapping, Versand und Marge manuell prüfen.",
      ),
  };
}

function normalizeVariants(
  product: Product,
  signal: ProductBrainSignal,
): ProductVariant[] {
  if (product.variants.length > 0) {
    return product.variants.map((variant) => {
      const size =
        variant.size ??
        variant.title
          .match(/\b(XXS|XS|S|M|L|XL|XXL|XXXL|2XL|3XL|4XL|5XL)\b/i)?.[1]
          ?.toUpperCase();
      return {
        ...variant,
        size: size ? normalizeSize(size) : undefined,
        title:
          size && variant.title.toLowerCase().startsWith("variant")
            ? normalizeSize(size)
            : variant.title,
        available: variant.available ?? false,
      };
    });
  }

  if (signal.sizes.length === 0) return product.variants;
  return signal.sizes.map((size) => ({
    id: `${product.slug}-${size.toLowerCase()}`,
    title: size,
    size,
    price: product.price.amount ? product.price : undefined,
    available: false,
  }));
}

function buildSeoTitle(title: LocalizedString): LocalizedString {
  return {
    pl: `${title.pl} | Velmère`,
    en: `${title.en} | Velmère`,
    de: `${title.de} | Velmère`,
  };
}

function buildMetaDescription(signal: ProductBrainSignal): LocalizedString {
  const type = GARMENT_LABELS[signal.garmentType];
  const color = signal.color ? COLOR_LABELS[signal.color] : undefined;
  return {
    pl: `Premium draft Velmère: ${type.pl.toLowerCase()}${color ? ` ${color.pl}` : ""}. Przed zakupem widoczne będą potwierdzone dane o materiale, rozmiarze, dostawie i zwrotach.`,
    en: `Premium Velmère draft: ${color ? `${color.en.toLowerCase()} ` : ""}${type.en.toLowerCase()}. Confirmed material, size, delivery and return data must be visible before purchase.`,
    de: `Premium Velmère Entwurf: ${color ? `${color.de.toLowerCase()} ` : ""}${type.de}. Material-, Größen-, Liefer- und Rückgabedaten müssen vor Kauf bestätigt sein.`,
  };
}

function buildAltText(
  title: LocalizedString,
  signal: ProductBrainSignal,
): LocalizedString {
  const type = GARMENT_LABELS[signal.garmentType];
  const color = signal.color ? COLOR_LABELS[signal.color] : undefined;
  return {
    pl: `${title.pl} — zdjęcie produktu ${type.pl.toLowerCase()}${color ? ` ${color.pl}` : ""}`,
    en: `${title.en} — product image of ${color ? `${color.en.toLowerCase()} ` : ""}${type.en.toLowerCase()}`,
    de: `${title.de} — Produktbild ${color ? `${color.de.toLowerCase()} ` : ""}${type.de}`,
  };
}

function missingField(
  id: string,
  label: string,
  reason: string,
  blocksActivePublish: boolean,
): ProductBrainMissingField {
  return { id, label, reason, blocksActivePublish };
}

function checklistItem(
  id: string,
  label: string,
  status: ProductBrainChecklistItem["status"],
  owner: ProductBrainChecklistItem["owner"],
): ProductBrainChecklistItem {
  return { id, label, status, owner };
}

function buildReadiness(
  product: Product,
  signal: ProductBrainSignal,
  adapter: VlmProviderAdapterSnapshot,
  hasConfirmedTruth: boolean,
): ProductBrainReadiness {
  const missing: ProductBrainMissingField[] = [];

  if (signal.garmentType === "unknown")
    missing.push(
      missingField(
        "garment_type",
        "Garment type",
        "AI could not classify whether this is hoodie, polo, pants, tee, etc.",
        true,
      ),
    );
  if (signal.sizes.length === 0 && product.variants.length === 0)
    missing.push(
      missingField(
        "sizes",
        "Sizes / variants",
        "No reliable size or variant matrix was detected.",
        true,
      ),
    );
  if (product.images.length === 0)
    missing.push(
      missingField(
        "manual_images",
        "Manual Velmère images",
        "AI/provider images are disabled. Add final product photos or owned mockups manually before active publishing.",
        true,
      ),
    );
  if (
    product.price.amount <= 0 &&
    product.variants.every((variant) => !variant.price?.amount)
  )
    missing.push(
      missingField(
        "price",
        "Retail price",
        "No EUR product price was detected.",
        true,
      ),
    );
  if (!signal.materialHint && !hasConfirmedTruth)
    missing.push(
      missingField(
        "composition",
        "Composition / material",
        "Material is not confirmed by provider metadata yet.",
        true,
      ),
    );
  if (
    adapter.variantMappingStatus !== "complete" &&
    product.fulfilmentMode === "automatic"
  )
    missing.push(
      missingField(
        "provider_mapping",
        "Provider variant mapping",
        "Automatic fulfillment requires every variant to map to provider id/SKU.",
        true,
      ),
    );
  if (
    adapter.stockStatus === "missing" &&
    product.fulfilmentMode === "automatic"
  )
    missing.push(
      missingField(
        "stock_availability",
        "Stock / provider availability",
        "Automatic checkout requires synced stock or availability for the mapped provider variants.",
        true,
      ),
    );
  if (adapter.stockStatus === "partial")
    missing.push(
      missingField(
        "stock_availability_partial",
        "Stock / provider availability",
        "Some variants still miss stock or synced availability data.",
        false,
      ),
    );
  if (adapter.imageStatus !== "complete")
    missing.push(
      missingField(
        "manual_image_set",
        "Manual image set",
        "Recommended manual media: front, back and detail/model/mockup images before public launch.",
        false,
      ),
    );
  if (adapter.sizeGuideStatus === "missing")
    missing.push(
      missingField(
        "size_chart_cm",
        "Size chart in cm",
        "AI detected size names, but provider cm measurements are not confirmed.",
        false,
      ),
    );
  if (adapter.sizeGuideStatus === "partial")
    missing.push(
      missingField(
        "size_chart_cm_partial",
        "Size chart in cm",
        "Some variants have cm measurements, but the full size matrix is not complete yet.",
        false,
      ),
    );
  if (!product.providerProductId && !product.externalUrl)
    missing.push(
      missingField(
        "source",
        "Provider source",
        "Draft has no provider product id or source URL.",
        false,
      ),
    );

  const blockers = missing.filter((item) => item.blocksActivePublish).length;
  const review = missing.length - blockers;
  const score = clamp(
    100 -
      blockers * 18 -
      review * 8 -
      adapter.warnings.length * 4 +
      (adapter.sourceQuality === "strong" ? 6 : 0),
  );
  const level =
    blockers > 0 ? "blocked" : review > 0 || score < 82 ? "review" : "ready";

  const checklist: ProductBrainChecklistItem[] = [
    checklistItem(
      "classify",
      `Detected garment: ${signal.garmentType} (${signal.typeConfidence}/100)`,
      signal.garmentType === "unknown" ? "block" : "pass",
      "ai",
    ),
    checklistItem(
      "variants",
      `Variants/sizes: ${signal.sizes.join("/") || product.variants.length}`,
      signal.sizes.length || product.variants.length ? "pass" : "block",
      "provider",
    ),
    checklistItem(
      "images",
      `Manual images: ${product.images.length}`,
      product.images.length === 0
        ? "block"
        : product.images.length >= 3
          ? "pass"
          : "review",
      "operator",
    ),
    checklistItem(
      "price",
      `Price status: ${adapter.priceStatus}`,
      adapter.priceStatus === "missing"
        ? "block"
        : adapter.priceStatus === "partial"
          ? "review"
          : "pass",
      "provider",
    ),
    checklistItem(
      "material",
      signal.materialHint
        ? `Material hint: ${signal.materialHint}`
        : "Material needs provider proof",
      signal.materialHint || hasConfirmedTruth ? "pass" : "block",
      "provider",
    ),
    checklistItem(
      "fulfilment",
      `Provider mapping: ${adapter.variantMappingStatus}`,
      adapter.variantMappingStatus === "complete"
        ? "pass"
        : adapter.variantMappingStatus === "partial"
          ? "review"
          : "block",
      "system",
    ),
    checklistItem(
      "stock",
      `Stock/availability: ${adapter.stockStatus}`,
      adapter.stockStatus === "missing" &&
        product.fulfilmentMode === "automatic"
        ? "block"
        : adapter.stockStatus === "partial"
          ? "review"
          : "pass",
      "provider",
    ),
    checklistItem(
      "size-chart",
      `Size chart cm: ${adapter.sizeGuideStatus}`,
      adapter.sizeGuideStatus === "complete" ? "pass" : "review",
      "operator",
    ),
  ];

  return {
    score,
    level,
    canPublishComingSoon: score >= 35,
    canPublishActive: blockers === 0 && score >= 82,
    missing,
    checklist,
  };
}

function buildBrainWarnings(
  signal: ProductBrainSignal,
  brain: ProductBrainResult,
) {
  const warnings = [
    `VLM Product Brain v2: detected ${signal.garmentType} (${signal.typeConfidence}/100), source=${signal.sourceQuality}, readiness=${brain.readiness.score}/100`,
    `VLM Product Brain v2: provider mapping=${brain.providerAdapter.variantMappingStatus}, stock=${brain.providerAdapter.stockStatus}, sizeChart=${brain.providerAdapter.sizeGuideStatus}`,
    signal.sizes.length
      ? `VLM Product Brain v2: sizes detected ${signal.sizes.join("/")}`
      : "VLM Product Brain v2: no reliable size variants detected",
    !signal.materialHint
      ? "VLM Product Brain v2: composition/material still needs provider proof"
      : "",
    signal.garmentType === "unknown"
      ? "VLM Product Brain v2: garment category needs manual confirmation"
      : "",
    ...brain.providerAdapter.warnings.map(
      (warning) => `VLM Provider Adapter: ${warning}`,
    ),
  ].filter(Boolean);
  return unique(warnings);
}

export function runVlmProductBrainOnDraft(
  draft: ProductImportDraft,
  options: VlmProductBrainRunOptions = {},
): ProductImportDraft {
  const normalizedWithAdapter =
    normalizeProductDraftThroughProviderAdapter(draft);
  const { adapter, ...normalized } = normalizedWithAdapter;
  const signal = inferSignal(normalized.product, adapter);
  const originalTitle = normalized.product.title;
  const hasConfirmedTruth = hasConfirmedTruthProfile(normalized.product);
  const generatedTitle = buildTitle(signal, originalTitle);
  const title = options.preserveManualCopy
    ? normalized.product.title
    : generatedTitle;
  const truth = buildTruth(signal, normalized.product.truth);
  const variants = normalizeVariants(normalized.product, signal);
  const altText = buildAltText(title, signal);
  const product: Product = {
    ...normalized.product,
    title,
    shortDescription: options.preserveManualCopy
      ? normalized.product.shortDescription
      : buildShortDescription(signal, originalTitle),
    description: options.preserveManualCopy
      ? normalized.product.description
      : buildDescription(signal, originalTitle),
    truth,
    variants,
    images: normalized.product.images.map((image) => ({
      ...image,
      alt: image.alt.pl || image.alt.en || image.alt.de ? image.alt : altText,
    })),
    tags: unique(
      [
        ...normalized.product.tags,
        "vlm-product-brain-v2",
        signal.garmentType,
        signal.color ?? "",
        signal.fit ?? "",
        signal.weight ?? "",
        ...signal.sizes.map((size) => `size-${size.toLowerCase()}`),
      ].filter((tag): tag is string => Boolean(tag)),
    ),
    collection:
      normalized.product.collection ??
      (signal.garmentType === "unknown" ? undefined : "ai-import-review"),
  };

  const readiness = buildReadiness(product, signal, adapter, hasConfirmedTruth);
  const brain: ProductBrainResult = {
    schemaVersion: "velmere.product.brain.v2",
    createdAt: new Date().toISOString(),
    detected: {
      garmentType: signal.garmentType,
      confidence: signal.typeConfidence,
      color: signal.color,
      fit: signal.fit,
      weight: signal.weight,
      sizes: signal.sizes,
      materialHint: signal.materialHint,
      provider: product.provider,
    },
    providerAdapter: adapter,
    naming: {
      title,
      seoTitle: buildSeoTitle(title),
      metaDescription: buildMetaDescription(signal),
      altText,
    },
    readiness,
  };

  const baseWarnings = normalized.warnings.filter(
    (warning) =>
      !warning.startsWith("VLM Product Brain v2:") &&
      !warning.startsWith("VLM Provider Adapter:"),
  );
  const baseValidationErrors = normalized.validationErrors.filter(
    (error) => !error.startsWith("VLM Product Brain gate:"),
  );
  const warnings = unique([
    ...baseWarnings,
    ...buildBrainWarnings(signal, brain),
  ]);
  const validationErrors = unique([
    ...baseValidationErrors,
    ...readiness.missing
      .filter((item) => item.blocksActivePublish)
      .map((item) => `VLM Product Brain gate: ${item.label} — ${item.reason}`),
  ]);

  return {
    ...normalized,
    product: {
      ...product,
      importSource: product.importSource
        ? {
            ...product.importSource,
            warnings: unique([
              ...(product.importSource.warnings ?? []),
              ...warnings,
            ]),
          }
        : product.importSource,
    },
    warnings,
    validationErrors,
    brain,
  };
}

export function applyVlmProductBrainToDraft(
  draft: ProductImportDraft,
  options: VlmProductBrainRunOptions = {},
): ProductImportDraft {
  return runVlmProductBrainOnDraft(draft, options);
}

export function applyVlmProductBrainToDrafts(
  drafts: ProductImportDraft[],
  options: VlmProductBrainRunOptions = {},
) {
  return drafts.map((draft) => applyVlmProductBrainToDraft(draft, options));
}

export function reviewVlmProductBrainDraftAfterOperatorEdits(
  draft: ProductImportDraft,
): ProductImportDraft {
  return runVlmProductBrainOnDraft(draft, { preserveManualCopy: true });
}

export function reviewVlmProductBrainDraftsAfterOperatorEdits(
  drafts: ProductImportDraft[],
): ProductImportDraft[] {
  return drafts.map(reviewVlmProductBrainDraftAfterOperatorEdits);
}
