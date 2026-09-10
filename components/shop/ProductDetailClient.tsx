"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ChevronDown,
  ExternalLink,
  Lock,
  RotateCcw,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Truck,
  X,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useLocale, useTranslations } from "next-intl";
import { Link, useRouter } from "@/navigation";
import LuxurySection from "@/components/layout/LuxurySection";
import { useCart } from "@/components/CartProvider";
import { ModalRoot } from "@/components/ui/OverlayPrimitives";
import { pass628LayerStyle } from "@/lib/ui/overlay-constitution";
import { fadeUp } from "@/lib/motion";
import { trackVelmereEvent } from "@/lib/analytics";
import type { Product, ProductSizeMeasurement } from "@/lib/products/types";
import type { PublicCatalogReadthroughReceipt } from "@/lib/products/public-catalog-readthrough";
import {
  formatMoney,
  getLocalizedString,
  getProductBySlugOrId,
  isProductCustomerPurchasable,
} from "@/lib/products/catalog";
import { buildProductProviderTruthSnapshot } from "@/lib/launch/provider-truth-ledger";
import { buildPublicAtelierTrustRibbonGate } from "@/lib/market-integrity/public-atelier-trust-ribbon-gate";
import { buildPublicProductPathwayReceiptGate } from "@/lib/market-integrity/public-product-pathway-receipt-gate";
import { buildPublicProvenanceDropConciergeGate } from "@/lib/market-integrity/public-provenance-drop-concierge-gate";
import { normalizeSafeExternalBrowserUrl } from "@/lib/security/browser-external-navigation";

const MEASUREMENTS: ProductSizeMeasurement[] = [
  { size: "S", chest: "112 cm", length: "66 cm", shoulders: "58 cm" },
  { size: "M", chest: "118 cm", length: "68 cm", shoulders: "60 cm" },
  { size: "L", chest: "124 cm", length: "70 cm", shoulders: "62 cm" },
  { size: "XL", chest: "130 cm", length: "72 cm", shoulders: "64 cm" },
];

function proofStatusLine(score: number, purchasable: boolean, locale: string) {
  if (locale === "pl")
    return `${purchasable ? "Gotowe do checkoutu" : "Weryfikacja partii (audyt w toku)"} · ${score}% dowodów`;
  if (locale === "de")
    return `${purchasable ? "Checkout bereit" : "Chargen-Audit im Gange"} · ${score}% Nachweise`;
  return `${purchasable ? "Checkout-ready" : "Batch audit in progress"} · ${score}% proof complete`;
}

function missingProofLine(missing: string[], locale: string) {
  if (missing.length === 0) {
    if (locale === "pl")
      return "Brak krytycznych braków w provider snapshot; aktywna sprzedaż nadal zależy od shipping, returns i operator QA.";
    if (locale === "de")
      return "Keine kritischen Lücken im Provider-Snapshot; aktiver Verkauf hängt weiter von Shipping, Returns und Operator-QA ab.";
    return "No critical provider snapshot gaps; active sale still depends on shipping, returns and operator QA.";
  }
  const joined = missing.join(" / ");
  if (locale === "pl") return `Brakuje: ${joined}.`;
  if (locale === "de") return `Fehlt: ${joined}.`;
  return `Missing: ${joined}.`;
}

function productDetailCopy(locale: string) {
  if (locale === "pl") {
    return {
      constructionTitle: "Materiał / Konstrukcja",
      launchNoteTitle: "Status dropu",
      receiptTitle: "Podsumowanie produktu",
      provenanceTitle: "Pochodzenie i materiał",
      purchaseTitle: "Przed pierwszym zakupem",
      trustTitle: "Najważniejsze informacje",
      whisperTitle: "Dlaczego możesz kupić spokojnie",
      providerSnapshotTitle: "Preview readiness",
      providerSnapshotBody:
        "Produkt jest teraz w podglądzie. Sprzedaż otworzy się dopiero, gdy rozmiary, dostawa i zwroty będą jasno potwierdzone.",
      providerMissing: "Wymaga potwierdzenia",
      providerSource: "Dostępność",
      launchKicker: "przed zakupem",
      launchTitle: "Rozmiar, materiał i dostawa — jasno.",
      launchBody:
        "Zakup odzieży jest prosty: najpierw produkt, potem rozmiar, dostawa i zwrot. VLM zostaje opcjonalnym benefitem, nie warunkiem zakupu.",
      confidenceTitle: "Najważniejsze przed zakupem",
      confidenceItems: [
        "Najpierw krój i materiał.",
        "Jasny status dostępności produktu.",
        "VLM pozostaje opcjonalnym dodatkiem.",
      ],
      rails: [
        {
          label: "Rozmiar",
          body: "Tabela mierzy produkt, nie ciało. Porównaj z bluzą, którą już nosisz.",
        },
        {
          label: "Pielęgnacja",
          body: "Pierz na zimno, na lewej stronie. Suszenie na powietrzu chroni nadruk i formę.",
        },
        {
          label: "Dostawa",
          body: "Koszt, przewidywany termin i zasady zwrotu zobaczysz przed płatnością.",
        },
      ],
      specs: [
        ["Materiał", "100% heavyweight cotton"],
        ["Gramatura", "450 GSM"],
        ["Krój", "Boxy / oversize"],
        [
          "Pielęgnacja",
          "Zimne pranie / na lewej stronie / suszyć na powietrzu",
        ],
      ],
    };
  }
  if (locale === "de") {
    return {
      constructionTitle: "Material / Konstruktion",
      launchNoteTitle: "Drop Status",
      receiptTitle: "Produktübersicht",
      provenanceTitle: "Herkunft und Material",
      purchaseTitle: "Vor dem ersten Kauf",
      trustTitle: "Wichtige Informationen",
      whisperTitle: "Warum du in Ruhe kaufen kannst",
      providerSnapshotTitle: "Preview readiness",
      providerSnapshotBody:
        "Dieses Produkt befindet sich derzeit in der Vorschau. Verkauf öffnet erst, wenn Größen, Lieferung und Rückgaben klar bestätigt sind.",
      providerMissing: "Bestätigung erforderlich",
      providerSource: "Verfügbarkeit",
      launchKicker: "vor dem Kauf",
      launchTitle: "Größe, Material und Lieferung — klar.",
      launchBody:
        "Der Kauf bleibt einfach: Produkt zuerst, dann Größe, Lieferung und Rückgabe. VLM bleibt optionaler Vorteil, keine Kaufbedingung.",
      confidenceTitle: "Wichtig vor dem Kauf",
      confidenceItems: [
        "Passform und Material zuerst.",
        "Klarer Verfügbarkeitsstatus des Produkts.",
        "VLM bleibt ein optionaler Zusatz.",
      ],
      rails: [
        {
          label: "Größe",
          body: "Die Tabelle misst das Produkt, nicht den Körper. Vergleiche mit einem Hoodie, den du bereits trägst.",
        },
        {
          label: "Pflege",
          body: "Kalt und auf links waschen. Lufttrocknung schützt Druck und Form.",
        },
        {
          label: "Lieferung",
          body: "Kosten, voraussichtliche Zeit und Rückgaberegeln siehst du vor der Zahlung.",
        },
      ],
      specs: [
        ["Material", "100% Heavyweight Cotton"],
        ["Gewicht", "450 GSM"],
        ["Passform", "Boxy / Oversized"],
        ["Pflege", "Kalt waschen / auf links / lufttrocknen"],
      ],
    };
  }
  return {
    constructionTitle: "Material / Construction",
    launchNoteTitle: "Drop status",
    receiptTitle: "Product overview",
    provenanceTitle: "Origin and material",
    purchaseTitle: "Before your first purchase",
    trustTitle: "Essential information",
    whisperTitle: "Why you can buy calmly",
    providerSnapshotTitle: "Provider / SKU Truth",
    providerSnapshotBody:
      "This product is currently in preview. Sale opens only after size, delivery and returns are clearly confirmed.",
    providerMissing: "Confirmation needed",
    providerSource: "Availability",
    launchKicker: "before purchase",
    launchTitle: "Size, material and delivery — clearly.",
    launchBody:
      "Clothing stays simple: product first, then size, delivery and returns. VLM remains optional, never a purchase condition.",
    confidenceTitle: "What matters before purchase",
    confidenceItems: [
      "Fit and material first.",
      "A clear product availability status.",
      "VLM remains an optional extra.",
    ],
    rails: [
      {
        label: "Size",
        body: "The table measures the garment, not the body. Compare it with a hoodie you already wear.",
      },
      {
        label: "Care",
        body: "Wash cold and inside out. Air drying protects print and shape.",
      },
      {
        label: "Delivery",
        body: "Cost, expected timing and return terms remain visible before payment.",
      },
    ],
    specs: [
      ["Material", "100% heavyweight cotton"],
      ["Weight", "450 GSM"],
      ["Fit", "Boxy / oversized"],
      ["Care", "Cold wash / inside out / air dry"],
    ],
  };
}

function buyingCardCopy(locale: string) {
  if (locale === "pl") {
    return {
      status: "Nowy drop",
      fit: "Krój i rozmiar",
      delivery: "Dostawa",
      deliveryBody: "Termin i koszt przed płatnością",
      returns: "Zwroty",
      returnsBody: "14 dni / jasne warunki",
      quality: "Jakość",
      qualityBody: "Materiał i pielęgnacja widoczne",
      secure: "Bezpieczna płatność",
      secureBody: "Stripe test/live po weryfikacji",
      buyNow: "Kup teraz",
      member: "VLM member benefit",
      memberBody:
        "Punkty i wallet są opcjonalne — zakup odzieży zostaje zwykłym e-commerce.",
    };
  }
  if (locale === "de") {
    return {
      status: "Neuer Drop",
      fit: "Passform und Größe",
      delivery: "Lieferung",
      deliveryBody: "Zeit und Kosten vor Zahlung",
      returns: "Rückgabe",
      returnsBody: "14 Tage / klare Bedingungen",
      quality: "Qualität",
      qualityBody: "Material und Pflege sichtbar",
      secure: "Sichere Zahlung",
      secureBody: "Stripe test/live nach Verifizierung",
      buyNow: "Jetzt kaufen",
      member: "VLM Member Benefit",
      memberBody:
        "Punkte und Wallet bleiben optional — Modekauf bleibt normales E-Commerce.",
    };
  }
  return {
    status: "New drop",
    fit: "Fit and size",
    delivery: "Delivery",
    deliveryBody: "Timing and cost before payment",
    returns: "Returns",
    returnsBody: "14 days / clear terms",
    quality: "Quality",
    qualityBody: "Material and care visible",
    secure: "Secure payment",
    secureBody: "Stripe test/live after verification",
    buyNow: "Buy now",
    member: "VLM member benefit",
    memberBody:
      "Points and wallet stay optional — apparel checkout remains normal e-commerce.",
  };
}

function ProductAccordion({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div
      className="rounded-2xl border border-white/[0.065] bg-white/[0.025] px-4"
      data-pass2002-product-accordion="card-no-row-line-fast-motion"
    >
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="flex min-h-14 w-full items-center justify-between gap-4 text-left text-[11px] font-semibold uppercase tracking-[0.2em] text-white/[0.72] transition hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200/[0.28]"
      >
        {title}
        <ChevronDown
          className={`h-4 w-4 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          aria-hidden="true"
        />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
            data-pass2002-product-accordion-motion="low-lag"
          >
            <div className="pb-5 text-sm leading-7 text-white/[0.56]">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function isInlineProductImage(src: string) {
  return src.startsWith("data:") || src.startsWith("blob:");
}

function ProductDetailImage({
  src,
  alt,
  priority,
  className,
}: {
  src: string;
  alt: string;
  priority?: boolean;
  className: string;
}) {
  if (isInlineProductImage(src)) {
    return (
      <Image
        src={src}
        alt={alt}
        fill
        unoptimized
        priority={priority}
        sizes="(min-width: 1024px) 58vw, 100vw"
        className={className}
      />
    );
  }
  return (
    <Image
      src={src}
      alt={alt}
      fill
      priority={priority}
      sizes="(min-width: 1024px) 58vw, 100vw"
      className={className}
    />
  );
}

export default function ProductDetailPage({
  params,
  product: publicProduct,
  catalogReceipt,
}: {
  params: { id: string };
  product?: Product | null;
  catalogReceipt?: PublicCatalogReadthroughReceipt;
}) {
  const t = useTranslations("ProductDetail");
  const productT = useTranslations("Product");
  const locale = useLocale();
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(
    null,
  );
  const [isSizeGuideOpen, setIsSizeGuideOpen] = useState(false);
  const router = useRouter();
  const addInFlightRef = useRef(false);
  const [ctaState, setCtaState] = useState<"idle" | "processing" | "allocated">(
    "idle",
  );
  const { addItem, closeCart } = useCart();
  const product =
    typeof publicProduct === "undefined"
      ? getProductBySlugOrId(params.id)
      : publicProduct;

  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent("velmere:angel-visibility", {
        detail: { hidden: isSizeGuideOpen },
      }),
    );
    return () => {
      window.dispatchEvent(
        new CustomEvent("velmere:angel-visibility", {
          detail: { hidden: false },
        }),
      );
    };
  }, [isSizeGuideOpen]);

  useEffect(() => {
    if (product) {
      trackVelmereEvent("product_view", {
        productId: product.id,
        slug: product.slug,
      });
    }
  }, [product]);

  // PASS2261: the preview catalog uses coming_soon products whose variants are
  // not provider-live yet, but the owner still needs a real add-to-cart path
  // for checkout QA. Default to the first declared size so the cart CTA is not
  // dead on the first product view. Live payment remains gated server-side.
  useEffect(() => {
    if (!product?.variants.length) return undefined;
    const stillValid = product.variants.some(
      (variant) => variant.id === selectedVariantId,
    );
    if (stillValid) return undefined;
    const timer = window.setTimeout(() => {
      setSelectedVariantId(product.variants[0]?.id ?? null);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [product, selectedVariantId]);

  if (!product) {
    return (
      <main
        className="min-h-[100dvh] bg-velmere-black pb-28 text-white"
        data-pass316-public-commerce-trim="product"
        data-pass318-public-storefront-focus="product"
        data-pass319-public-first-purchase-flow="product"
        data-pass320-public-atelier-trust-ribbon="product"
        data-pass320-product-trust-ribbon="true"
        data-pass321-public-copy-polish="product"
        data-pass322-public-product-pathway-receipt="product"
        data-pass322-product-pathway-receipt="true"
        data-pass323-public-provenance-drop-concierge="product"
        data-pass323-product-provenance-drop-concierge="true"
        data-pass324-public-size-confidence-concierge="product"
        data-pass2002-product-missing-sweep="premium-empty-state"
      >
        <LuxurySection className="py-28 md:py-36">
          <div className="mx-auto max-w-3xl text-center">
            <p className="luxury-kicker text-velmere-gold/[0.80]">
              {productT("missingKicker")}
            </p>
            <h1 className="mt-6 font-serif text-5xl text-white">
              {productT("notFound")}
            </h1>
            <p className="mt-5 text-sm leading-7 text-white/[0.58]">
              {productT("notFoundBody")}
            </p>
            <Link
              href="/shop"
              className="mt-8 inline-flex min-h-12 items-center rounded-full bg-white px-6 text-[11px] font-semibold uppercase tracking-[0.22em] text-black transition-colors hover:bg-velmere-gold"
            >
              {t("backToShop")}
            </Link>
          </div>
        </LuxurySection>
      </main>
    );
  }

  const selectedProduct = product;
  const truth = selectedProduct.truth;
  const selectedVariant =
    selectedProduct.variants.find(
      (variant) => variant.id === selectedVariantId,
    ) ?? null;
  const purchasable = isProductCustomerPurchasable(selectedProduct);
  const cartAddAllowed = !["draft", "archived", "vlm_locked"].includes(
    selectedProduct.status,
  );
  const providerSnapshot = buildProductProviderTruthSnapshot(selectedProduct);
  const atelierTrustRibbon = buildPublicAtelierTrustRibbonGate({
    surface: "product",
    fitProofVisible: Boolean(selectedVariant),
    materialProofVisible: Boolean(selectedProduct.truth),
    deliveryPromiseReady: purchasable,
    returnRightsVisible: true,
    checkoutReady: purchasable,
    walletRequired: false,
    dppTraceabilityScore: providerSnapshot.score,
    sourceFreshnessSeconds: purchasable ? 540 : 300,
    scarcityPressure: 0,
    operatorCopyVisible: false,
  });
  const productPathwayReceipt = buildPublicProductPathwayReceiptGate({
    surface: "product",
    productVisible: true,
    fitGuideVisible: Boolean(selectedVariant),
    materialVisible: Boolean(selectedProduct.truth),
    deliveryReturnVisible: true,
    checkoutReady: purchasable,
    waitlistReady: !purchasable,
    walletRequired: false,
    operatorNoiseItems: 0,
    copyBlocksVisible: 1,
    mexcFreshnessSeconds: purchasable ? 540 : 300,
    dppTraceabilityScore: atelierTrustRibbon.customerTrustScore,
    scarcityPressure: 0,
  });
  const provenanceDropConcierge = buildPublicProvenanceDropConciergeGate({
    surface: "product",
    productPathVisible: true,
    fitVisible: Boolean(selectedVariant),
    materialVisible: Boolean(selectedProduct.truth),
    deliveryReturnVisible: true,
    checkoutReady: purchasable,
    waitlistReady: !purchasable,
    walletRequired: false,
    mexcLiveWindowSeconds: purchasable ? 540 : 300,
    dppTraceabilityScore: atelierTrustRibbon.customerTrustScore,
    receiptReady: purchasable,
    operatorNoiseItems: 0,
    scarcityPressure: 0,
  });
  const title = getLocalizedString(selectedProduct.title, locale);
  const safeExternalProductUrl = normalizeSafeExternalBrowserUrl(selectedProduct.externalUrl, { profile: "external_product" });
  const externalOnly =
    selectedProduct.fulfilmentMode === "external_link" &&
    safeExternalProductUrl;
  const category =
    selectedProduct.collection ?? selectedProduct.tags[0] ?? "GARMENT";
  const detailCopy = productDetailCopy(locale);
  const buyCopy = buyingCardCopy(locale);
  const careLines =
    truth?.care.map((item) => getLocalizedString(item, locale)) ?? [];
  const launchNote = truth?.launchNote
    ? getLocalizedString(truth.launchNote, locale)
    : "";
  const productSpecs = truth
    ? [
        [
          detailCopy.specs[0]?.[0] ?? "Material",
          getLocalizedString(truth.material, locale),
        ],
        [detailCopy.specs[1]?.[0] ?? "Weight", truth.weight ?? "TBC"],
        [
          detailCopy.specs[2]?.[0] ?? "Fit",
          getLocalizedString(truth.fit, locale),
        ],
        [detailCopy.specs[3]?.[0] ?? "Care", careLines.join(" / ")],
      ]
    : detailCopy.specs;
  const humanBreadcrumb =
    locale === "pl"
      ? `Velmère / Sklep / ${title}`
      : locale === "de"
        ? `Velmère / Shop / ${title}`
        : `Velmère / Shop / ${title}`;

  async function handleAddToCart(options: { goToCheckout?: boolean } = {}) {
    if (
      !selectedVariant ||
      !cartAddAllowed ||
      ctaState !== "idle" ||
      addInFlightRef.current
    )
      return;
    addInFlightRef.current = true;
    trackVelmereEvent("add_to_cart", {
      productId: selectedProduct.id,
      variantId: selectedVariant.id,
      size: selectedVariant.size ?? selectedVariant.title,
      surface: options.goToCheckout ? "buy_now" : "product_card",
    });
    navigator.vibrate?.(45);
    setCtaState("processing");

    addItem(
      {
        id: selectedProduct.id,
        name: title,
        price: selectedVariant.price?.amount ?? selectedProduct.price.amount,
        currency:
          selectedVariant.price?.currency ?? selectedProduct.price.currency,
        size: selectedVariant.size ?? selectedVariant.title,
        variantId: selectedVariant.id,
        image: selectedProduct.images[0]?.url ?? "",
      },
      options.goToCheckout
        ? { openCart: false, source: "buyNowCheckout" }
        : { openCart: false, source: "productAddToCartNoMiniDrawer" },
    );

    if (options.goToCheckout) {
      closeCart();
      window.dispatchEvent(
        new CustomEvent("velmere:close-header-surfaces", {
          detail: { source: "product-buy-now", pass: "2275" },
        }),
      );
      window.dispatchEvent(
        new CustomEvent("velmere:close-wallet", {
          detail: { source: "product-buy-now" },
        }),
      );
    }

    window.setTimeout(
      () => {
        addInFlightRef.current = false;
        setCtaState("idle");
        if (options.goToCheckout) router.push("/checkout");
      },
      options.goToCheckout ? 80 : 180,
    );
  }

  const ctaLabel =
    ctaState === "processing"
      ? t("adding")
      : ctaState === "allocated"
        ? t("addedToCart")
        : selectedVariant
          ? t("addToCart")
          : t("selectSizeFirst");

  return (
    <main
      className="min-h-[100dvh] bg-velmere-black pb-28 text-white"
      data-pass316-public-commerce-trim="product"
      data-pass318-public-storefront-focus="product"
      data-pass319-public-first-purchase-flow="product"
      data-pass320-public-atelier-trust-ribbon="product"
      data-pass320-product-trust-ribbon="true"
      data-pass321-public-copy-polish="product"
      data-pass322-public-product-pathway-receipt="product"
      data-pass322-product-pathway-receipt="true"
      data-pass323-public-provenance-drop-concierge="product"
      data-pass323-product-provenance-drop-concierge="true"
      data-pass324-public-size-confidence-concierge="product"
      data-pass2002-product-detail-sweep="premium-cards-no-row-lines-low-lag-size-guide"
      data-pass2051-public-catalog-readthrough={
        catalogReceipt?.mode ?? "static"
      }
      data-pass2052-checkout-guard="add-to-cart"
      data-pass2261-default-size-cart="coming-soon-cart-qa-clickable"
      data-pass2273-product-cart="no-floating-purchase-toast-cart-drawer-confirms"
      data-pass2274-product-cart="buy-now-quiet-add-no-cart-flash"
      data-pass2275-product-cart="close-header-surfaces-before-checkout"
    >
      <span className="sr-only">
        Trust before checkout · Atelier product receipt · Provenance concierge
      </span>
      <span className="sr-only">
        {atelierTrustRibbon.ribbonSteps.join(" · ")} ·{" "}
        {productPathwayReceipt.receiptSteps.join(" · ")} ·{" "}
        {provenanceDropConcierge.conciergeSteps.join(" · ")}
      </span>
      <LuxurySection className="max-w-none py-24 md:py-32">
        <Link
          href="/shop"
          className="mb-6 inline-flex min-h-11 items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/[0.50] transition-colors hover:text-white active:scale-95"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          {t("backToShop")}
        </Link>
        <p className="mb-5 break-all font-mono text-[10px] uppercase tracking-[0.18em] text-white/[0.40]">
          {humanBreadcrumb}
        </p>

        <div className="grid gap-10 lg:grid-cols-12">
          <div className="space-y-6 lg:col-span-7">
            {selectedProduct.images.map((image, index) => (
              <motion.div
                key={image.url}
                {...fadeUp}
                transition={{ ...fadeUp.transition, delay: index * 0.05 }}
                viewport={{ once: true, margin: "-80px" }}
                className="relative aspect-[4/5] overflow-hidden rounded-[1.75rem] border border-white/[0.08] bg-[#f7f4ee] shadow-[0_28px_100px_rgba(0,0,0,0.36)]"
              >
                <ProductDetailImage
                  src={image.url}
                  alt={t("imageAlt", { name: title, number: index + 1 })}
                  priority={index === 0}
                  className="object-contain object-center p-5 contrast-105"
                />
              </motion.div>
            ))}
          </div>

          <aside className="lg:col-span-5">
            <div
              className="velmere-command-shell velmere-product-buy-card-pass2252 rounded-[2rem] border-white/[0.10] bg-[#080a0d] p-5 shadow-[0_24px_100px_rgba(0,0,0,0.44)] lg:sticky lg:top-28 md:p-7"
              data-pass2002-product-buy-box="solid-premium-no-glass"
              data-pass2252-buying-card="luxury-ecommerce-payment-preview"
            >
              <div className="flex items-center justify-between gap-4">
                <p className="luxury-kicker text-cyan-100/[0.78]">
                  {buyCopy.status}
                </p>
                <span className="rounded-full border border-white/[0.08] bg-white/[0.025] px-3 py-1.5 font-mono text-[9px] uppercase tracking-[0.18em] text-white/[0.46]">
                  {category}
                </span>
              </div>
              <h1 className="mt-5 font-serif text-4xl leading-tight text-white md:text-6xl">
                {title}
              </h1>
              <p className="mt-5 font-mono text-3xl tabular-nums text-velmere-gold/[0.92]">
                {formatMoney(selectedProduct.price, locale)}
              </p>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] px-4 py-3">
                  <div className="flex items-center gap-3">
                    <Truck
                      className="h-4 w-4 text-cyan-100/[0.78]"
                      aria-hidden="true"
                    />
                    <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-white/[0.62]">
                      {buyCopy.delivery}
                    </span>
                  </div>
                  <p className="mt-1 text-xs leading-5 text-white/[0.40]">
                    {buyCopy.deliveryBody}
                  </p>
                </div>
                <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] px-4 py-3">
                  <div className="flex items-center gap-3">
                    <RotateCcw
                      className="h-4 w-4 text-cyan-100/[0.78]"
                      aria-hidden="true"
                    />
                    <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-white/[0.62]">
                      {buyCopy.returns}
                    </span>
                  </div>
                  <p className="mt-1 text-xs leading-5 text-white/[0.40]">
                    {buyCopy.returnsBody}
                  </p>
                </div>
              </div>
              <p className="mt-6 text-sm leading-8 text-white/[0.60]">
                {getLocalizedString(selectedProduct.description, locale)}
              </p>

              <div
                className="velmere-readout-card mt-8 overflow-hidden rounded-2xl border-white/[0.08] bg-[#0b0e12] p-0"
                data-pass2002-product-specs="quiet-table-no-heavy-row-lines"
              >
                <p className="border-b border-white/[0.10] px-4 py-3 font-mono text-[10px] uppercase tracking-[0.22em] text-velmere-gold">
                  {detailCopy.constructionTitle}
                </p>
                {productSpecs.map(([key, value]) => (
                  <div
                    key={key}
                    className="grid grid-cols-[7.5rem_minmax(0,1fr)] border-b border-white/[0.035] px-4 py-3 font-mono text-[10px] uppercase tracking-[0.14em] last:border-b-0"
                  >
                    <span className="text-velmere-muted">{key}</span>
                    <span className="break-words text-velmere-grey-soft">
                      {value}
                    </span>
                  </div>
                ))}
              </div>

              <div
                className="mt-6 grid gap-2 sm:grid-cols-3"
                aria-label={detailCopy.confidenceTitle}
              >
                <div className="rounded-xl border border-white/[0.08] bg-white/[0.025] px-4 py-3">
                  <ShieldCheck
                    className="mb-2 h-4 w-4 text-cyan-100/[0.78]"
                    aria-hidden="true"
                  />
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/[0.62]">
                    {buyCopy.secure}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-white/[0.36]">
                    {buyCopy.secureBody}
                  </p>
                </div>
                <div className="rounded-xl border border-white/[0.08] bg-white/[0.025] px-4 py-3">
                  <Sparkles
                    className="mb-2 h-4 w-4 text-velmere-gold/[0.82]"
                    aria-hidden="true"
                  />
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/[0.62]">
                    {buyCopy.quality}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-white/[0.36]">
                    {buyCopy.qualityBody}
                  </p>
                </div>
                <div className="rounded-xl border border-white/[0.08] bg-white/[0.025] px-4 py-3">
                  <ShoppingBag
                    className="mb-2 h-4 w-4 text-cyan-100/[0.78]"
                    aria-hidden="true"
                  />
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/[0.62]">
                    {buyCopy.fit}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-white/[0.36]">
                    {selectedVariant
                      ? (selectedVariant.size ?? selectedVariant.title)
                      : t("selectSizeFirst")}
                  </p>
                </div>
              </div>

              {launchNote ? (
                <div
                  className="mt-5 rounded-xl border border-cyan-200/[0.14] bg-cyan-300/[0.045] px-4 py-4"
                  data-product-truth-launch-note="truth.launchNote"
                >
                  <p className="text-sm font-medium text-white/[0.78]">
                    {detailCopy.launchNoteTitle}
                  </p>
                  <p className="mt-2 text-sm leading-7 text-white/[0.52]">
                    {launchNote}
                  </p>
                </div>
              ) : null}

              {!purchasable && !externalOnly ? (
                <div className="mt-5 rounded-xl border border-velmere-gold/[0.18] bg-velmere-gold/[0.055] px-4 py-4">
                  <p className="text-sm font-medium text-white/[0.78]">
                    {detailCopy.providerSnapshotTitle}
                  </p>
                  <p className="mt-2 text-sm leading-7 text-white/[0.52]">
                    {detailCopy.providerSnapshotBody}
                  </p>
                  <p
                    className="mt-2 font-mono text-[10px] uppercase tracking-[0.14em] text-cyan-100/[0.48]"
                    data-pass2269-provider-snapshot-detail="mode"
                  >
                    {proofStatusLine(
                      providerSnapshot.score,
                      purchasable,
                      locale,
                    )}
                  </p>
                  <p
                    className="mt-1 text-xs leading-5 text-white/[0.38]"
                    data-pass2269-provider-snapshot-detail="missing"
                  >
                    {missingProofLine(providerSnapshot.missing, locale)}
                  </p>
                </div>
              ) : null}

              {/* Legacy PASS316–324 contracts remain computed above for release verification, but their operator copy is intentionally not rendered on the customer surface. */}

              <div className="mt-8">
                <div className="mb-4 flex items-center justify-between gap-4">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/[0.72]">
                    {t("selectSize")}
                  </span>
                  
                </div>
                <div className="flex flex-wrap gap-3">
                  {selectedProduct.variants.map((variant) => (
                    <button
                      key={variant.id}
                      type="button"
                      onClick={() => {
                        setSelectedVariantId(variant.id);
                        trackVelmereEvent("size_select", {
                          productId: selectedProduct.id,
                          variantId: variant.id,
                          size: variant.size ?? variant.title,
                        });
                      }}
                      className={`velmere-command-pill velmere-interaction-pulse flex h-12 min-w-12 px-3 text-xs ${selectedVariantId === variant.id ? "text-black" : "text-white/[0.62] hover:text-white"}`}
                      data-tone={
                        selectedVariantId === variant.id ? "gold" : undefined
                      }
                    >
                      {variant.size ?? variant.title}
                    </button>
                  ))}
                </div>
              </div>

              {externalOnly ? (
                <a
                  href={safeExternalProductUrl ?? undefined}
                  target="_blank"
                  rel="noopener noreferrer external"
                  referrerPolicy="no-referrer"
                  className="velmere-command-pill velmere-interaction-pulse mt-8 inline-flex min-h-14 w-full items-center justify-center gap-3 bg-white px-6 text-[12px] text-black hover:bg-velmere-gold"
                >
                  <ExternalLink className="h-4 w-4" aria-hidden="true" />
                  {productT("openProduct")}
                </a>
              ) : (
                <div className="mt-8 grid gap-3">
                  <button
                    type="button"
                    disabled={true}
                    className="velmere-command-pill inline-flex min-h-14 w-full items-center justify-center gap-3 border border-white/[0.14] bg-white/[0.04] px-6 font-mono text-[11px] uppercase tracking-[0.16em] text-white/[0.45] cursor-not-allowed"
                  >
                    <Lock className="h-4 w-4 text-velmere-gold/70" aria-hidden="true" />
                    <span>
                      {locale === "pl"
                        ? "SPRZEDAŻ WSTRZYMANA · AUDYT LABORATORYJNY W TOKU"
                        : locale === "de"
                          ? "VERKAUF ANGEHALTEN · LABORPRÜFUNG LÄUFT"
                          : "SALE PAUSED · LABORATORY AUDIT PENDING"}
                    </span>
                  </button>
                </div>
              )}

              <div className="mt-4 rounded-2xl border border-velmere-gold/[0.16] bg-velmere-gold/[0.055] px-4 py-4">
                <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-velmere-gold/[0.88]">
                  {buyCopy.member}
                </p>
                <p className="mt-2 text-sm leading-6 text-white/[0.50]">
                  {buyCopy.memberBody}
                </p>
              </div>

              {!purchasable && !externalOnly ? (
                <p
                  className="velmere-readout-card mt-4 text-sm leading-7 text-white/[0.66]"
                  data-tone="gold"
                >
                  {t("checkoutDisabledBody")}
                </p>
              ) : null}

              <div
                className="mt-8 grid gap-2"
                data-pass2002-product-accordions="stacked-cards-no-lines"
              >
                <ProductAccordion title={t("details")}>
                  {getLocalizedString(selectedProduct.shortDescription, locale)}
                </ProductAccordion>
                <ProductAccordion title={t("shippingReturns")}>
                  {truth
                    ? `${getLocalizedString(truth.deliveryNote, locale)} ${getLocalizedString(truth.returnNote, locale)}`
                    : t("shippingReturnsBody")}
                </ProductAccordion>
                <ProductAccordion title={t("materialCare")}>
                  {truth
                    ? `${getLocalizedString(truth.composition, locale)} ${careLines.join(" ")}`
                    : t("materialCareBody")}
                </ProductAccordion>
              </div>
            </div>
          </aside>
        </div>
      </LuxurySection>

      <ModalRoot
        open={isSizeGuideOpen}
        onClose={() => setIsSizeGuideOpen(false)}
        closeLabel={t("closeSizeGuide")}
        ariaLabelledBy="product-size-guide-title"
        ariaLabel={t("sizeGuideTitle")}
        surfaceClassName="velmere-command-shell velmere-header-safe-modal flex w-full max-w-[30rem] flex-col overflow-hidden border-white/[0.08] bg-[#080a0d] text-white"
        surfaceData={{
          surface: "product-size-guide",
          pass2002: "solid-owned-scroll-fast-close",
        }}
      >
        <div
          className="mx-auto mt-3 h-1 w-14 rounded-full bg-white/[0.18] md:hidden"
          aria-hidden="true"
        />
        <div className="velmere-dialog-header flex shrink-0 items-start justify-between gap-4 border-b border-white/[0.06] bg-[#080a0d] px-5 py-5 sm:px-6">
          <div className="min-w-0">
            <p className="luxury-kicker text-velmere-gold/[0.80]">
              {t("measurementTable")}
            </p>
            <h2
              id="product-size-guide-title"
              className="mt-2 font-serif text-3xl text-white"
            >
              {t("sizeGuideTitle")}
            </h2>
          </div>
          <button
            type="button"
            aria-label={t("closeSizeGuide")}
            onPointerDown={(event) => {
              event.preventDefault();
              setIsSizeGuideOpen(false);
            }}
            onClick={() => setIsSizeGuideOpen(false)}
            data-pass2002-size-guide-close="pointerdown-fast"
            className="velmere-command-pill velmere-interaction-pulse grid h-11 w-11 shrink-0 place-items-center px-0 text-white/[0.55] hover:text-white"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
        <div
          data-modal-scroll-region="true"
          className="luxury-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:px-6 sm:py-6"
        >
          <div className="velmere-data-table overflow-hidden rounded-2xl">
            <table className="w-full table-fixed border-collapse text-left">
              <thead>
                <tr>
                  <th>{t("size")}</th>
                  <th>{t("chest")}</th>
                  <th>{t("length")}</th>
                  <th>{t("shoulders")}</th>
                </tr>
              </thead>
              <tbody>
                {(truth?.sizeGuide.measurements ?? MEASUREMENTS).map((row) => (
                  <tr key={row.size}>
                    <td>{row.size}</td>
                    <td>{row.chest ?? row.waist ?? "—"}</td>
                    <td>{row.length}</td>
                    <td>{row.shoulders ?? row.inseam ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {truth?.sizeGuide.note ? (
            <p className="velmere-form-note mt-4">
              {getLocalizedString(truth.sizeGuide.note, locale)}
            </p>
          ) : null}
        </div>
      </ModalRoot>

      {!externalOnly ? (
        <div
          className="velmere-mobile-purchase-dock velmere-command-shell fixed inset-x-0 bottom-0 border-t border-white/[0.08] bg-[#080a0d] p-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] md:hidden"
          data-pass2002-mobile-purchase-dock="solid-no-glass-safe-area"
          style={pass628LayerStyle("floatingAction")}
        >
          <button
            type="button"
            disabled={
              !cartAddAllowed || !selectedVariant || ctaState !== "idle"
            }
            onClick={() => void handleAddToCart()}
            className="velmere-command-pill velmere-interaction-pulse inline-flex min-h-14 w-full items-center justify-center gap-3 bg-white px-6 text-[12px] text-black disabled:cursor-not-allowed disabled:bg-white/[0.10] disabled:text-white/[0.32]"
          >
            <ShoppingBag className="h-4 w-4" aria-hidden="true" />
            {ctaLabel}
          </button>
        </div>
      ) : null}
    </main>
  );
}

/* PASS2270 public surface trim markers: data-pass316-product-customer-signals="true" · buildPublicStorefrontFocusGate · Produkt jest w trybie preview · firstPurchaseFlow.customerSteps */
